// Archivo: src/utils/api.ts

/**
 * Clase de error personalizada para representar errores de la API.
 * Contiene el estado HTTP y el cuerpo de la respuesta del error.
 */
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

/**
 * Opciones avanzadas para la función apiFetch.
 */
interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
}

/**
 * Función centralizada y robusta para realizar peticiones a la API.
 * * @template T El tipo de dato esperado en la respuesta exitosa.
 * @param path El endpoint de la API al que se va a llamar (ej. '/login').
 * @param options Opciones de la petición como método, cuerpo y encabezados.
 * @returns Una promesa que se resuelve con los datos de la API del tipo T.
 * @throws {ApiError} Si la respuesta del servidor no es exitosa (no es 2xx).
 * @throws {Error} Si ocurre un error de red u otro problema inesperado.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { method = 'GET', body } = options;
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const url = `${baseUrl}${path}`;

  // 1. Construcción de encabezados dinámicos
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // 2. Inyección automática del token de autenticación
  const token = localStorage.getItem('authToken');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 3. Logs de depuración solo en modo de desarrollo
  if (import.meta.env.DEV) {
    console.groupCollapsed(`[API Fetch] ${method} ${path}`);
    console.log('URL:', url);
    console.log('Método:', method);
    console.log('Headers:', headers);
    if (body) console.log('Body:', body);
    console.groupEnd();
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // 4. Manejo de respuesta 401 Unauthorized (Token inválido/expirado)
    if (response.status === 401) {
      // Limpiamos la sesión del usuario
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      // Redirigimos a la página de login para evitar bucles
      window.location.href = '/login'; 
      // Lanzamos un error para detener la ejecución actual
      throw new ApiError('No autorizado. Redirigiendo a login...', 401, null);
    }
    
    // 5. Manejo de respuesta 204 No Content
    if (response.status === 204) {
      return null as T; // Devolvemos null de forma segura
    }

    const data = await response.json();

    if (!response.ok) {
      // 6. Lanzamos nuestro error personalizado con toda la información
      console.error('❌ Error de API:', response.status, data);
      throw new ApiError(data.message || 'Error en la respuesta de la API', response.status, data);
    }

    // 7. Retornamos los datos con el tipo correcto
    return data as T;

  } catch (error) {
    // Si el error ya es de nuestro tipo, lo relanzamos
    if (error instanceof ApiError) {
      throw error;
    }

    // 8. Manejo de errores de red o errores de parsing de JSON
    console.error('❌ Error de Conexión o Parsing:', error);
    throw new Error('Error de conexión con el servidor. Por favor, revisa tu conexión a internet.');
  }
}