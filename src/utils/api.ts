// utils/api.ts

// If no VITE_API_URL is provided fall back to "/api" so the Vite dev
// proxy handles CORS automatically. In production the env variable will
// point to the real backend URL.
const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateChatSessionId from "@/utils/chatSessionId"; // Import the new function

export class ApiError extends Error {
  public readonly status: number;
  public readonly body: any;

  constructor(message: string, status: number, body: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: any;
  skipAuth?: boolean;
  sendAnonId?: boolean;
  entityToken?: string | null;
}

/**
 * Helper centralizado para todas las llamadas a la API.
 * Soporta autenticación JWT y modo anónimo vía header "Anon-Id".
 * Elimina el uso de anon_id como query param (profesional).
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { method = "GET", body, skipAuth, sendAnonId, entityToken } = options;

  const token = safeLocalStorage.getItem("authToken");
  const anonId = safeLocalStorage.getItem("anon_id");
  const chatSessionId = getOrCreateChatSessionId(); // Get or create the chat session ID

  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = { ...(options.headers || {}) };

  const isForm = body instanceof FormData;
  if (!isForm && body) headers["Content-Type"] = "application/json";

  // Add the chat session ID header to all requests
  headers["X-Chat-Session-Id"] = chatSessionId;

  if (!skipAuth && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // Si el endpoint necesita identificar usuario anónimo, mandá siempre el header "Anon-Id"
  if (((!token && anonId) || sendAnonId) && anonId) {
    headers["Anon-Id"] = anonId;
  }
  if (entityToken) {
    headers["X-Entity-Token"] = entityToken;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
      credentials: 'include', // ensure cookies like session are sent
    });

    // Puede devolver vacío (204 No Content)
    const text = await response.text().catch(() => "");
    let data: any = null;
    try {
      if (text) data = JSON.parse(text);
    } catch {
      // body no es JSON válido
    }

    if (response.status === 401) {
      // Sólo limpia sesión si no es skipAuth
      if (!skipAuth) {
        safeLocalStorage.removeItem("authToken");
        // El widget maneja la autenticación sin salir del chat
      }
      throw new ApiError(
        data?.error || data?.message || "No autorizado",
        response.status,
        data
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    if (response.status === 403) {
      throw new ApiError(
        data?.error || data?.message || "Acceso prohibido",
        response.status,
        data
      );
    }

    if (!response.ok) {
      throw new ApiError(
        data?.error || data?.message || "Error en la respuesta de la API",
        response.status,
        data
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof TypeError && API_BASE_URL.startsWith("http")) {
      console.error(
        "❌ Posible error de CORS. Verificá que VITE_API_URL esté configurado como ruta relativa (\"/api\")."
      );
    } else {
      console.error("❌ Error de conexión o parsing:", error);
    }
    throw new Error("Error de conexión con el servidor.");
  }
}

/**
 * Extrae un mensaje amigable de error para mostrar en la interfaz.
 */
export function getErrorMessage(error: unknown, fallback = "Ocurrió un error inesperado.") {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        return "Hubo un problema con la solicitud. Por favor, verifica los datos enviados.";
      case 401:
        return "No estás autorizado para realizar esta acción. Por favor, inicia sesión de nuevo.";
      case 403:
        return "No tienes permiso para acceder a este recurso.";
      case 404:
        return "No se pudo encontrar el recurso solicitado (Error 404).";
      case 500:
        return "Ocurrió un error en el servidor. Por favor, intenta de nuevo más tarde.";
      default:
        // Usa el mensaje de la API si está disponible, si no, un genérico con el status.
        return error.message || `Ocurrió un error (código: ${error.status})`;
    }
  }
  if (error && typeof (error as any).message === "string") {
    // Para errores que no son de la API pero tienen un mensaje (ej. errores de red)
    return (error as any).message;
  }
  return fallback;
}
