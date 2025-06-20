// utils/api.ts

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://api.chatboc.ar";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

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
  sendEntityToken?: boolean;
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
  const { method = "GET", body, skipAuth, sendAnonId, sendEntityToken } = options;

  const token = safeLocalStorage.getItem("authToken");
  const anonId = safeLocalStorage.getItem("anon_id");
  const entityToken = safeLocalStorage.getItem("entityToken");

  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = { ...(options.headers || {}) };

  const isForm = body instanceof FormData;
  if (!isForm) headers["Content-Type"] = "application/json";


  if (!skipAuth && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // Si el endpoint necesita identificar usuario anónimo, mandá siempre el header "Anon-Id"
  if (((!token && anonId) || sendAnonId) && anonId) {
    headers["Anon-Id"] = anonId;
  }
  if ((sendEntityToken || false) && entityToken) {
    headers["X-Entity-Token"] = entityToken;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
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
        if (!anonId) window.location.href = "/login";
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
    console.error("❌ Error de conexión o parsing:", error);
    throw new Error("Error de conexión con el servidor.");
  }
}
