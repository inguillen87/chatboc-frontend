// utils/api.ts

import { API_BASE_CANDIDATES, BASE_API_URL, SAME_ORIGIN_PROXY_BASE } from '@/config';
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateChatSessionId from "@/utils/chatSessionId"; // Import the new function
import { getIframeToken } from "@/utils/config";

export class NetworkError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "NetworkError";
    this.cause = cause;
  }
}

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

const parseDebugFlag = (value?: string | null): boolean => {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
};

const shouldLogVerboseApi = (): boolean => {
  const metaEnv =
    typeof import.meta !== "undefined" && (import.meta as any)?.env
      ? (import.meta as any).env
      : undefined;

  if (metaEnv?.DEV || metaEnv?.MODE === "development") {
    return true;
  }

  if (
    typeof process !== "undefined" &&
    typeof process.env?.CHATBOC_DEBUG_API === "string" &&
    parseDebugFlag(process.env.CHATBOC_DEBUG_API)
  ) {
    return true;
  }

  if (typeof window !== "undefined") {
    try {
      const flag = window.localStorage?.getItem("CHATBOC_DEBUG_API");
      if (parseDebugFlag(flag)) {
        return true;
      }
    } catch {
      // Access to localStorage can fail in private browsing contexts. Ignore.
    }
  }

  return false;
};

interface ApiFetchOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: any;
  skipAuth?: boolean;
  /**
   * When true, prevents automatic redirects to /login on 401 responses for panel requests.
   * Useful for optional data fetches that should gracefully handle an unauthenticated state.
   */
  suppressPanel401Redirect?: boolean;
  sendAnonId?: boolean;
  entityToken?: string | null;
  cache?: RequestCache;
  onResponse?: (response: Response) => void;
  /**
   * Avoid sending the chat session identifier header.
   * Useful for public endpoints (e.g. encuestas) that don't expect custom headers
   * and may not declare them in their CORS configuration.
   */
  omitChatSessionId?: boolean;
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
  /**
   * When provided, attaches the tenant slug so the backend can scope the request.
   */
  tenantSlug?: string | null;
  /**
   * When provided, overrides the base URL used to resolve the request path.
   * Useful for public modules (e.g. encuestas) that must hit a canonical host
   * different from the panel/API origin.
   */
  baseUrlOverride?: string | null;
  /**
   * Avoid sending the entity token header even if one is available globally.
   * Public endpoints should not depend on tenant secrets to serve content,
   * otherwise shared links will break for vecinos sin credenciales.
   */
  omitEntityToken?: boolean;
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
    suppressPanel401Redirect,
    sendAnonId,
    entityToken,
    cache,
    onResponse,
    omitCredentials,
    isWidgetRequest,
    omitChatSessionId,
    tenantSlug,
    baseUrlOverride,
    omitEntityToken,
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

  const isLikelyWidgetEnvironment = (() => {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      const { self, top, location } = window;
      const isEmbedded = self !== top;
      if (isEmbedded) {
        return true;
      }

      const hostname = location.hostname.toLowerCase();
      if (hostname.startsWith("widget.")) {
        return true;
      }

      const pathname = location.pathname.toLowerCase();
      if (pathname.startsWith("/widget") || pathname.startsWith("/embedded-widget")) {
        return true;
      }
    } catch (err) {
      console.warn("[apiFetch] Unable to determine widget environment", err);
    }

    return false;
  })();

  const treatAsWidget = isWidgetRequest ?? (isWidgetContext && isLikelyWidgetEnvironment);
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
  const shouldAttachChatSession = !omitChatSessionId;
  const chatSessionId = shouldAttachChatSession ? getOrCreateChatSessionId() : null; // Get or create the chat session ID

  const normalizedPath = path.replace(/^\/+/, "");
  const hasApiPrefix = normalizedPath.startsWith("api/");
  const pathWithoutApiPrefix = hasApiPrefix
    ? normalizedPath.replace(/^api\/+/, "")
    : normalizedPath;
  const preferredBase =
    typeof baseUrlOverride === "string" && baseUrlOverride.trim()
      ? baseUrlOverride.trim()
      : "";

  const buildUrl = (base: string, trimApiPrefix = false) => {
    const cleanBase = (base || "").replace(/\/$/, "");

    if (!cleanBase) {
      return `/${trimApiPrefix ? pathWithoutApiPrefix : normalizedPath}`;
    }

    const isApiBase = cleanBase.endsWith("/api") || cleanBase === "/api";
    const pathForBase = trimApiPrefix || isApiBase
      ? pathWithoutApiPrefix
      : normalizedPath;

    return `${cleanBase}/${pathForBase}`;
  };

  const candidateBases = preferredBase
    ? [preferredBase.replace(/\/$/, "")]
    : API_BASE_CANDIDATES.length
      ? API_BASE_CANDIDATES
      : [BASE_API_URL].filter((value): value is string => !!value);

  const currentOrigin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin.replace(/\/$/, "")
      : "";
  const fallbackUrl =
    !preferredBase && !candidateBases.length && !!currentOrigin ? `/${normalizedPath}` : "";

  let url = buildUrl(candidateBases[0] || "");
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

  // Add the chat session ID header to requests that expect it
  if (chatSessionId) {
    headers["X-Chat-Session-Id"] = chatSessionId;
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (tenantSlug && typeof tenantSlug === "string" && tenantSlug.trim()) {
    headers["X-Tenant"] = tenantSlug.trim();
  }
  // Si el endpoint necesita identificar usuario anónimo, mandá siempre el header "Anon-Id"
  if (((!token && anonId) || sendAnonId) && anonId) {
    headers["Anon-Id"] = anonId;
    headers["X-Anon-Id"] = anonId;
  }
  if (effectiveEntityToken && !omitEntityToken) {
    headers["X-Entity-Token"] = effectiveEntityToken;
  }
  // Log request details without exposing full tokens
  const mask = (t: string | null) => (t ? `${t.slice(0, 8)}...` : null);
  const verboseLogging = shouldLogVerboseApi();
  if (verboseLogging) {
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
      chatSessionIdAttached: Boolean(chatSessionId),
      tenantSlug: tenantSlug || null,
    });
  }

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

  let response: Response | null = null;
  let lastError: unknown = null;

  for (const base of candidateBases) {
    const cleanBase = (base || "").replace(/\/$/, "");
    const isApiBase = cleanBase.endsWith("/api") || cleanBase === "/api";
    const urlsToTry = [buildUrl(base, isApiBase)];

    if (!isApiBase && hasApiPrefix) {
      urlsToTry.push(buildUrl(base, true));
    }

    for (const candidateUrl of urlsToTry) {
      url = candidateUrl;

      try {
        const candidateResponse = await fetch(candidateUrl, requestInit);

        const isMissingProxy =
          candidateResponse.status === 404 &&
          SAME_ORIGIN_PROXY_BASE &&
          cleanBase === SAME_ORIGIN_PROXY_BASE &&
          candidateBases.length > 1;

        if (isMissingProxy) {
          break;
        }

        response = candidateResponse;
        break;
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    if (response) {
      break;
    }
  }

  if (!response && fallbackUrl) {
    try {
      url = fallbackUrl;
      response = await fetch(fallbackUrl, requestInit);
    } catch (fallbackErr) {
      lastError = fallbackErr;
    }
  }

  if (!response) {
    if (lastError) {
      throw lastError;
    }
    throw new NetworkError("No fue posible establecer la conexión con el servidor.");
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

    if (verboseLogging) {
      console.log("[apiFetch] Response", {
        method,
        url,
        status: response.status,
        data,
      });
    }

    if (response.status === 401 && !skipAuth) {
      // Para peticiones del panel/admin, un 401 significa sesión expirada.
      // Debemos limpiar todo y forzar el re-login.
      if (!treatAsWidget && !suppressPanel401Redirect) {
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
      throw new NetworkError(
        "No fue posible establecer la conexión con el servidor. Verificá tu conexión o la configuración de CORS del backend.",
        error,
      );
    }

    console.error("❌ API Fetch Error:", error);
    throw new NetworkError(
      "No fue posible establecer la conexión con el servidor. Verificá tu conexión o la configuración de CORS del backend.",
      error,
    );
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
  if (error instanceof NetworkError) {
    return error.message;
  }

  if (error && typeof (error as any).message === "string") {
    // Para errores que no son de la API pero tienen un mensaje (ej. errores de red)
    return (error as any).message;
  }
  return fallback;
}
