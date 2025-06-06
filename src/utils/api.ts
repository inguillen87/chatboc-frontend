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
 * Lee SIEMPRE el token desde localStorage["user"].token.
 * Compatible con uploads (FormData).
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { method = 'GET', body } = options;
  const baseUrl = import.meta.env.VITE_API_URL || "https://api.chatboc.ar";
  const url = `${baseUrl}${path}`;

  // --- Recuperar token desde el objeto user ---
  let token = "";
  const userRaw = localStorage.getItem("user");
  if (userRaw) {
    try {
      const user = JSON.parse(userRaw);
      token = user.token;
    } catch {}
  }

  // --- Armado de headers dinámicos ---
  let headers: Record<string, string> = { ...(options.headers || {}) };
  const isForm = body instanceof FormData;
  if (!isForm) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // --- DEBUG: Log de request solo en DEV ---
  if (import.meta.env.DEV) {
    console.groupCollapsed(`[API Fetch] ${method} ${url}`);
    console.log('Headers:', headers);
    if (body) console.log('Body:', body);
    console.groupEnd();
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: isForm ? body : (body ? JSON.stringify(body) : undefined),
    });

    // 401 = Sesión inválida, limpiá SOLO "user"
    if (response.status === 401) {
      localStorage.removeItem("user");
      window.location.href = '/login';
      throw new ApiError('No autorizado. Redirigiendo a login...', 401, null);
    }

    // 204 No Content
    if (response.status === 204) {
      return null as T;
    }

    let data: any = null;
    try { data = await response.json(); } catch {}

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
    throw new Error('Error de conexión con el servidor. Por favor, revisa tu conexión a internet.');
  }
}
