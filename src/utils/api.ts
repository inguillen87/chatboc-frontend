// utils/api.ts

import { BASE_API_URL } from '@/config';
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateChatSessionId from "@/utils/chatSessionId"; // Import the new function
import { getIframeToken } from "@/utils/config";

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
  cache?: RequestCache;
  onResponse?: (response: Response) => void;
  /**
   * When true, avoids sending browser cookies with the request.
   * Useful for widget requests where the visitor should remain anonymous.
   */
  omitCredentials?: boolean;
  /**
   * Marks the request as originating from the public widget.
   * Prevents leaking panel credentials while still allowing chat auth tokens.
   */
  isWidgetRequest?: boolean;
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
  const {
    method = "GET",
    body,
    skipAuth,
    sendAnonId,
    entityToken,
    cache,
    onResponse,
    omitCredentials,
    isWidgetRequest,
  } = options;

  const rawIframeToken = getIframeToken();
  const effectiveEntityToken = entityToken ?? rawIframeToken;
  const globalEntityToken =
    typeof window !== "undefined"
      ? (window as any)?.CHATBOC_CONFIG?.entityToken
      : undefined;
  const normalizedGlobalToken =
    typeof globalEntityToken === "string" && globalEntityToken.trim()
      ? globalEntityToken.trim()
      : "";
  const isWidgetContext = Boolean(normalizedGlobalToken || entityToken);
  const treatAsWidget = isWidgetRequest ?? isWidgetContext;
  const panelToken = safeLocalStorage.getItem("authToken");
  const chatToken = safeLocalStorage.getItem("chatAuthToken");
  let storedRole: string | null = null;
  try {
    const rawUser = safeLocalStorage.getItem("user");
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed && typeof parsed === "object" && typeof parsed.rol === "string") {
        storedRole = parsed.rol;
      }
    }
  } catch {
    storedRole = null;
  }
  const normalizedRole = storedRole?.toLowerCase() || null;
  const widgetAllowsPanelToken =
    treatAsWidget && !chatToken && !!panelToken &&
    (normalizedRole === "usuario" ||
      normalizedRole === "ciudadano" ||
      normalizedRole === "vecino" ||
      normalizedRole === "neighbor");
  let token: string | null = null;
  let tokenSource: "authToken" | "chatAuthToken" | null = null;

  if (!skipAuth) {
    if (treatAsWidget) {
      if (chatToken) {
        token = chatToken;
        tokenSource = "chatAuthToken";
      } else if (widgetAllowsPanelToken) {
        token = panelToken;
        tokenSource = "authToken";
      }
    } else {
      if (panelToken) {
        token = panelToken;
        tokenSource = "authToken";
      } else if (chatToken) {
        token = chatToken;
        tokenSource = "chatAuthToken";
      }
    }
  }
  const anonId = safeLocalStorage.getItem("anon_id");
  const chatSessionId = getOrCreateChatSessionId(); // Get or create the chat session ID

  // Normalize URL to prevent double slashes
  const url = `${BASE_API_URL.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  const fallbackUrl = `/${path.replace(/^\//, "")}`;
  const headers: Record<string, string> = options.headers
    ? { ...options.headers }
    : {};
  const acceptPreferenceRaw =
    typeof headers["Accept"] === "string"
      ? headers["Accept"]
      : typeof headers["accept"] === "string"
        ? headers["accept"]
        : "";
  const acceptPreference = acceptPreferenceRaw.toLowerCase();

  const isForm = body instanceof FormData;
  if (!isForm && body) headers["Content-Type"] = "application/json";

  // Add the chat session ID header to all requests
  headers["X-Chat-Session-Id"] = chatSessionId;

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // Si el endpoint necesita identificar usuario anónimo, mandá siempre el header "Anon-Id"
  if (((!token && anonId) || sendAnonId) && anonId) {
    headers["Anon-Id"] = anonId;
    headers["X-Anon-Id"] = anonId;
  }
  if (effectiveEntityToken) {
    headers["X-Entity-Token"] = effectiveEntityToken;
  }
  // Log request details without exposing full tokens
  const mask = (t: string | null) => (t ? `${t.slice(0, 8)}...` : null);
  console.log("[apiFetch] Request", {
    method,
    url,
    hasBody: !!body,
    authToken: mask(panelToken),
    chatAuthToken: mask(chatToken),
    anonId: mask(anonId),
    entityToken: mask(effectiveEntityToken || null),
    sendAnonId,
    widgetRequest: treatAsWidget,
    storedRole: normalizedRole,
    headers,
  });

  const shouldOmitCredentials =
    omitCredentials !== undefined
      ? omitCredentials
      : treatAsWidget;

  const requestInit: RequestInit = {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
    credentials: shouldOmitCredentials ? 'omit' : 'include',
    cache,
  };

  let response: Response;
  try {
    response = await fetch(url, requestInit);
  } catch (primaryErr) {
    if (BASE_API_URL !== window.location.origin) {
      try {
        response = await fetch(fallbackUrl, requestInit);
      } catch {
        throw primaryErr;
      }
    } else {
      throw primaryErr;
    }
  }

  if (typeof onResponse === "function") {
    try {
      onResponse(response.clone());
    } catch (callbackError) {
      console.warn("[apiFetch] onResponse callback failed", callbackError);
    }
  }

  try {
    const responseAnonId =
      response.headers.get("X-Anon-Id") || response.headers.get("Anon-Id");
    if (responseAnonId) {
      try {
        const storedAnonId = safeLocalStorage.getItem("anon_id");
        if (storedAnonId !== responseAnonId) {
          safeLocalStorage.setItem("anon_id", responseAnonId);
        }
      } catch (storageError) {
        console.warn(
          "[apiFetch] Unable to persist anon_id header",
          storageError,
        );
      }
    }

    // Puede devolver vacío (204 No Content)
    const text = await response.text().catch(() => "");
    const trimmedText = text.trim();
    let data: any = null;
    let parsedAsJson = false;
    const responseContentType =
      response.headers.get("content-type")?.toLowerCase() ?? "";
    const expectsJsonResponse =
      !acceptPreference ||
      acceptPreference.includes("json") ||
      acceptPreference.includes("*/*");

    if (trimmedText) {
      try {
        data = JSON.parse(trimmedText);
        parsedAsJson = true;
      } catch (parseError) {
        data = trimmedText;
        const isProduction =
          (typeof import.meta !== "undefined" && (import.meta as any)?.env?.PROD) ||
          ((globalThis as any)?.process?.env?.NODE_ENV === "production");
        if (!isProduction) {
          console.warn(
            `[apiFetch] Response body for ${method} ${url} is not valid JSON. Returning raw text instead.`,
            parseError,
          );
        }
      }
    }

    if (!parsedAsJson && !trimmedText) {
      data = null;
    }

    if (
      response.ok &&
      expectsJsonResponse &&
      trimmedText &&
      !parsedAsJson
    ) {
      const snippet = trimmedText.slice(0, 200);
      const humanReadableType = responseContentType || 'texto';
      throw new ApiError(
        `Respuesta inesperada del servidor (tipo: ${humanReadableType}). Verificá la configuración del endpoint '${path}' y sus encabezados CORS.`,
        response.status || 502,
        {
          raw: snippet,
          contentType: responseContentType,
        },
      );
    }

    console.log("[apiFetch] Response", {
      method,
      url,
      status: response.status,
      data,
    });

    if (response.status === 401 && !skipAuth) {
      // Para peticiones del panel/admin, un 401 significa sesión expirada.
      // Debemos limpiar todo y forzar el re-login.
      if (!treatAsWidget) {
        console.warn("Received 401 Unauthorized for a panel request. Redirecting to login.");
        safeLocalStorage.removeItem("authToken");
        safeLocalStorage.removeItem("user");
        safeLocalStorage.removeItem("chatAuthToken");

        // Forzar redirección para limpiar el estado de la aplicación.
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }

        // Devolvemos una promesa que nunca se resuelve para evitar que el código subsiguiente se ejecute.
        return new Promise(() => {});
      }

      // Para el widget, el manejo es diferente, no queremos redirigir toda la página.
      // Simplemente lanzamos el error para que el componente que hizo la llamada lo maneje.
      if (tokenSource === "authToken") {
        safeLocalStorage.removeItem("authToken");
      } else if (tokenSource === "chatAuthToken") {
        safeLocalStorage.removeItem("chatAuthToken");
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
    if (error instanceof TypeError) { // Typically a network error or CORS issue
      console.error(
        `❌ Network Error or CORS issue. Ensure the backend is running and reachable at ${BASE_API_URL}, and that its CORS policy is configured correctly.`,
        error
      );
    } else {
      console.error("❌ API Fetch Error:", error);
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
