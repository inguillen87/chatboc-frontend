// Contenido COMPLETO y FINAL para: utils/api.ts

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://api.chatboc.ar";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

export class ApiError extends Error {
  public readonly status: number;
  public readonly body: any;

  constructor(message: string, status: number, body: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  // Opcional: una bandera para indicar que una ruta no necesita autenticación
  skipAuth?: boolean; 
}

/**
 * Helper centralizado para todas las llamadas a la API.
 * Ahora lee el token de forma consistente desde localStorage["authToken"].
 * Limpia la sesión de forma segura en caso de error 401.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { method = 'GET', body, skipAuth } = options; // Desestructurar skipAuth
  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = { ...(options.headers || {}) };
  const isForm = body instanceof FormData;

  if (!isForm) {
    headers["Content-Type"] = "application/json";
  }

  // --- CORRECCIÓN SUGERIDA: Solo añadir Authorization si no se omite y hay token ---
  if (!skipAuth) { // Si no estamos en una ruta que omite la autenticación
    const token = safeLocalStorage.getItem("authToken");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: isForm ? body : (body ? JSON.stringify(body) : undefined),
    });

    const text = await response.text().catch(() => '');
    let data: any = null;
    try {
      if (text) data = JSON.parse(text);
    } catch {
      // cuerpo no es JSON válido
    }

    if (response.status === 401) {
      if (!skipAuth) {
        safeLocalStorage.clear();
        window.location.href = '/login';
      }
      throw new ApiError(
        data?.error || data?.message || 'No autorizado',
        response.status,
        data
      );
    }

    if (response.status === 204) {
      return {} as T;
    }
    
    if (response.status === 403) {
      throw new ApiError(
        data?.error || data?.message || 'Acceso prohibido',
        response.status,
        data
      );
    }

    if (!response.ok) {
      throw new ApiError(
        data?.error || data?.message || 'Error en la respuesta de la API',
        response.status,
        data
      );
    }

    return data as T;

  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error('❌ Error de conexión o parsing:', error);
    throw new Error('Error de conexión con el servidor.');
  }
}