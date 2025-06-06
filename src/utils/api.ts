// Contenido COMPLETO y FINAL para: utils/api.ts

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://api.chatboc.ar";

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
  const { method = 'GET', body } = options;
  const url = `${API_BASE_URL}${path}`;

  // --- CORRECCIÓN DEFINITIVA: Recuperar token consistentemente ---
  const token = localStorage.getItem("authToken");

  const headers: Record<string, string> = { ...(options.headers || {}) };
  const isForm = body instanceof FormData;

  if (!isForm) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: isForm ? body : (body ? JSON.stringify(body) : undefined),
    });

    // --- CORRECCIÓN DEFINITIVA: Manejo de sesión inválida ---
    // Si el token es inválido (401), limpiamos COMPLETAMENTE la sesión.
    if (response.status === 401) {
      localStorage.clear(); // Limpia 'user' y 'authToken'
      window.location.href = '/login';
      throw new ApiError('No autorizado. Redirigiendo a login...', 401, null);
    }

    if (response.status === 204) {
      return {} as T;
    }

    // El try/catch para el JSON es una buena práctica
    let data: any = null;
    try {
        const text = await response.text();
        if(text) data = JSON.parse(text);
    } catch (e) {
        // No hacer nada si el cuerpo está vacío o no es JSON válido
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