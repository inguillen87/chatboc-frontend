// utils/api.ts

import { API_BASE_CANDIDATES, BASE_API_URL, SAME_ORIGIN_PROXY_BASE } from '@/config';
import { TENANT_ROUTE_PREFIXES } from '@/utils/tenantPaths';
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateChatSessionId from "@/utils/chatSessionId"; // Import the new function
import { getOrCreateAnonId } from "@/utils/anonIdGenerator";
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

const TENANT_PATH_REGEX = new RegExp(`^/(?:${TENANT_ROUTE_PREFIXES.join("|")})/([^/]+)`, "i");

const LOCAL_PLACEHOLDER_SLUGS = new Set([
  'iframe',
  'embed',
  'widget',
  'cart',
  'productos',
  'checkout',
  'checkout-productos',
  'perfil',
  'user',
  'login',
  'register',
  'portal',
  'pedidos',
  'reclamos',
  'encuestas',
  'tickets',
  'opinar',
  'integracion',
  'documentacion',
  'faqs',
  'legal',
  'chat',
  'chatpos',
  'chatcrm',
  'admin',
  'dashboard',
  'analytics',
  'settings',
  'config',
  'api',
  'estadisticas',
  'empleados',
  'municipal',
  'pyme',
  'logs',
  'consultas',
  'presupuestos',
  'recordatorios',
  'historial',
  'usuarios',
  'soluciones',
  'demo',
  'home',
  'landing',
  'incidents',
  'stats',
  'market',
  'whatsapp',
  'telegram',
  'instagram',
  'facebook'
]);

// Merge shared placeholders with API-specific ones
const PLACEHOLDER_SLUGS = new Set([
  ...LOCAL_PLACEHOLDER_SLUGS,
  "public", "auth", "portal", "admin", "pwa", "static", "assets"
]);

const readTenantFromSubdomain = () => {
  if (typeof window === "undefined") return null;
  const host = window.location?.hostname || "";
  if (!host || host === "localhost") return null;

  const [maybeSlug, ...rest] = host.split(".");
  if (!maybeSlug || rest.length === 0) return null;

  const normalized = maybeSlug.trim().toLowerCase();
  if (["www", "app", "panel"].includes(normalized)) return null;

  return maybeSlug;
};

const readTenantFromStoredUser = () => {
  try {
    const rawUser = safeLocalStorage.getItem("user");
    if (!rawUser) return null;
    const parsed = JSON.parse(rawUser);
    const candidate =
      parsed?.tenant_slug || parsed?.tenantSlug || parsed?.tenant || parsed?.endpoint;
    return typeof candidate === "string" ? candidate : null;
  } catch (error) {
    console.warn("[apiFetch] No se pudo leer tenant del usuario almacenado", error);
    return null;
  }
};

const readTenantFromStorageKey = () => {
  try {
    const candidate = safeLocalStorage.getItem("tenantSlug");
    return typeof candidate === "string" ? candidate : null;
  } catch (error) {
    console.warn("[apiFetch] No se pudo leer tenantSlug de localStorage", error);
    return null;
  }
};

const sanitizeTenantSlug = (slug?: string | null) => {
  if (!slug || typeof slug !== "string") return null;
  const normalized = slug.trim();
  if (!normalized) return null;
  return PLACEHOLDER_SLUGS.has(normalized.toLowerCase()) ? null : normalized;
};

const readTenantFromScriptDataset = () => {
  if (typeof document === "undefined") return null;

  const scripts = Array.from(
    document.querySelectorAll<HTMLScriptElement>(
      "script[data-tenant], script[data-tenant-slug], script[data-tenant_slug], script[data-endpoint]",
    ),
  );

  for (const script of scripts) {
    const candidate =
      script.dataset.tenant || script.dataset.tenantSlug || script.dataset.tenant_slug || script.dataset.endpoint;

    const normalized = sanitizeTenantSlug(candidate);
    if (normalized) return normalized;
  }

  return null;
};

const extractTenantFromPath = (rawPath?: string | null): string | null => {
  if (typeof rawPath !== "string") return null;

  const normalizedPath = (() => {
    const trimmed = rawPath.trim();
    if (!trimmed) return "";

    try {
      if (/^https?:\/\//i.test(trimmed)) {
        const url = new URL(trimmed);
        return `${url.pathname}${url.search}${url.hash}`;
      }
    } catch (error) {
      console.warn("[apiFetch] No se pudo normalizar el path para tenant", error);
    }

    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  })();

  if (!normalizedPath) return null;

  // 1. Specific API patterns (Higher priority)
  // Matches /api/public/tenants/:slug/...
  const publicTenantMatch = normalizedPath.match(/^\/api\/public\/tenants\/([^/?#]+)/i);
  if (publicTenantMatch?.[1]) {
    const candidate = sanitizeTenantSlug(publicTenantMatch[1]);
    if (candidate) return candidate;
  }

  // Matches /api/portal/:slug/...
  const portalTenantMatch = normalizedPath.match(/^\/api\/portal\/([^/?#]+)/i);
  if (portalTenantMatch?.[1]) {
    const candidate = sanitizeTenantSlug(portalTenantMatch[1]);
    if (candidate) return candidate;
  }

  // 2. Generic API match
  // This might match /api/public/... -> 'public' (which is a placeholder)
  const apiMatch = normalizedPath.match(/^\/api\/([^/?#]+)/i);
  if (apiMatch?.[1]) {
    const candidate = sanitizeTenantSlug(apiMatch[1]);
    // If it's a valid tenant, return it.
    // If it's a placeholder (like 'public'), we continue to try other patterns.
    if (candidate) return candidate;
  }

  // 3. Frontend Routes
  const tenantRouteMatch = normalizedPath.match(
    new RegExp(`^/(?:${TENANT_ROUTE_PREFIXES.join("|")})/([^/?#]+)`, "i"),
  );
  if (tenantRouteMatch?.[1]) {
    const candidate = sanitizeTenantSlug(tenantRouteMatch[1]);
    if (candidate) return candidate;
  }

  return null;
};

const inferTenantSlug = (explicitTenant?: string | null, pathForFallback?: string | null): string | null => {
  const candidate = sanitizeTenantSlug(explicitTenant);
  if (candidate) return candidate;

  const fromPath = sanitizeTenantSlug(extractTenantFromPath(pathForFallback));
  if (fromPath) return fromPath;

  const storedUserTenant = sanitizeTenantSlug(readTenantFromStoredUser());
  if (storedUserTenant) return storedUserTenant;

  const storedTenantSlug = sanitizeTenantSlug(readTenantFromStorageKey());
  if (storedTenantSlug) return storedTenantSlug;

  if (typeof window === "undefined") return null;

  const { pathname = "", search = "" } = window.location || {};
  const match = pathname.match(TENANT_PATH_REGEX);
  if (match?.[1]) {
    try {
      return sanitizeTenantSlug(decodeURIComponent(match[1]));
    } catch (error) {
      console.warn("[apiFetch] No se pudo decodificar el slug de la URL", error);
      return sanitizeTenantSlug(match[1]);
    }
  }

  if (search) {
    try {
      const params = new URLSearchParams(search);
      const fromQuery =
        params.get("tenant") || params.get("tenant_slug") || params.get("endpoint");
      const normalized = sanitizeTenantSlug(fromQuery);
      if (normalized) return normalized;
    } catch (error) {
      console.warn("[apiFetch] No se pudo leer la query string para tenant", error);
    }
  }

  const scriptTenant = readTenantFromScriptDataset();
  if (scriptTenant) return scriptTenant;

  try {
    const cfg = (window as any).CHATBOC_CONFIG || {};
    const fromConfig =
      cfg.tenant?.toString?.() ||
      cfg.tenantSlug?.toString?.() ||
      cfg.tenant_slug?.toString?.() ||
      cfg.endpoint?.toString?.();
    const normalized = sanitizeTenantSlug(fromConfig);
    if (normalized) return normalized;
  } catch (error) {
    console.warn("[apiFetch] No se pudo leer CHATBOC_CONFIG para tenant", error);
  }

  const subdomainTenant = sanitizeTenantSlug(readTenantFromSubdomain());
  if (subdomainTenant) return subdomainTenant;

  return null;
};

export const resolveTenantSlug = (
  explicitTenant?: string | null,
  pathForFallback?: string | null,
): string | null => {
  const resolved = inferTenantSlug(explicitTenant, pathForFallback);

  if (resolved) {
    try {
      safeLocalStorage.setItem("tenantSlug", resolved);
    } catch (error) {
      console.warn("[apiFetch] No se pudo persistir tenantSlug resuelto", error);
    }
  } else {
    // Attempt to recover from entity token if tenant slug resolution failed
    try {
        const entityToken = safeLocalStorage.getItem("entityToken") ||
            (typeof window !== "undefined" && (window as any).CHATBOC_CONFIG?.entityToken);

        // This is a heuristic: if we have an entity token but no slug, we might be in a widget context
        // where the slug is not yet resolved. We don't have a direct mapping here without an API call,
        // but we can at least log this state or try to use a stored slug if available.
        // For now, let's trust that inferTenantSlug covers most cases, but we might want to extend this
        // to handle widget-specific config scenarios better in the future.
    } catch (e) {
        // ignore
    }
  }

  return resolved;
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
   * When true, avoids inferring or appending tenant parameters to the request.
   * Useful for panel endpoints that already scope by session and fail when
   * extra tenant query params are provided.
   */
  omitTenant?: boolean;
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
 * Soporta autenticación JWT y modo anónimo vía header "X-Anon-Id".
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
    omitTenant,
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
  const resolvedTenantSlug = omitTenant
    ? null
    : treatAsWidget && tenantSlug === undefined
      ? null
      : resolveTenantSlug(tenantSlug, path);
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
  const shouldAttachChatSession = !omitChatSessionId;
  const chatSessionId = shouldAttachChatSession ? getOrCreateChatSessionId() : null; // Get or create the chat session ID

  const anonId = getOrCreateAnonId();

  const appendTenantQueryParams = (rawPath: string, slug: string | null) => {
    // If omitTenant is true, we should NOT append any tenant params, regardless of slug existence.
    // However, this helper is called before we fully decide on 'omitTenant' inside the main logic flow
    // which is confusing. Let's fix the call site instead.
    if (!slug) return rawPath;

    try {
      const isAbsolute = /^https?:\/\//i.test(rawPath);
      const placeholderBase =
        typeof window !== "undefined" && window.location?.origin
          ? window.location.origin
          : "http://placeholder";
      const url = isAbsolute
        ? new URL(rawPath)
        : new URL(rawPath, placeholderBase);
      const hasTenantParam = url.searchParams.has("tenant");
      const hasTenantSlugParam = url.searchParams.has("tenant_slug");

      if (!hasTenantSlugParam) {
        url.searchParams.set("tenant_slug", slug);
      }

      if (!hasTenantParam) {
        url.searchParams.set("tenant", slug);
      }

      if (isAbsolute) {
        return url.toString();
      }

      const normalizedPathname = url.pathname.replace(/^\//, "");
      return `${normalizedPathname}${url.search}${url.hash}`;
    } catch (error) {
      console.warn("[apiFetch] No se pudieron adjuntar query params de tenant", error);
      return rawPath;
    }
  };

  const isAbsolutePath = /^https?:\/\//i.test(path);
  const normalizedPath = isAbsolutePath ? path : path.replace(/^\/+/, "");

  const normalizedPathWithTenant = appendTenantQueryParams(
    normalizedPath,
    resolvedTenantSlug,
  );

  const tenantFromQueryParams = (() => {
    try {
      const url = new URL(normalizedPathWithTenant, 'http://placeholder');
      const fromQuery =
        url.searchParams.get('tenant_slug') ||
        url.searchParams.get('tenant');

      return sanitizeTenantSlug(fromQuery);
    } catch {
      return null;
    }
  })();

  const effectiveTenantSlug = resolvedTenantSlug ?? tenantFromQueryParams;
  const hasApiPrefix = normalizedPathWithTenant.startsWith("api/");
  const pathWithoutApiPrefix = hasApiPrefix
    ? normalizedPathWithTenant.replace(/^api\/+/, "")
    : normalizedPathWithTenant;
  const preferredBase =
    typeof baseUrlOverride === "string" && baseUrlOverride.trim()
      ? baseUrlOverride.trim()
      : "";

  const buildUrl = (base: string, trimApiPrefix = false) => {
    const cleanBase = (base || "").replace(/\/$/, "");

    if (!cleanBase) {
      return `/${trimApiPrefix ? pathWithoutApiPrefix : normalizedPathWithTenant}`;
    }

    const isApiBase = cleanBase.endsWith("/api") || cleanBase === "/api";
    const pathForBase = trimApiPrefix || isApiBase
      ? pathWithoutApiPrefix
      : normalizedPathWithTenant;

    return `${cleanBase}/${pathForBase}`;
  };

  const candidateBases = isAbsolutePath
    ? []
    : preferredBase
      ? [preferredBase.replace(/\/$/, "")]
      : API_BASE_CANDIDATES.length
        ? API_BASE_CANDIDATES
        : [BASE_API_URL].filter((value): value is string => !!value);

  const currentOrigin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin.replace(/\/$/, "")
      : "";
  const fallbackUrl =
    !preferredBase && !isAbsolutePath && !candidateBases.length && !!currentOrigin
      ? `/${normalizedPathWithTenant}`
      : "";

  let url = isAbsolutePath ? normalizedPathWithTenant : buildUrl(candidateBases[0] || "");
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

  // Ensure X-Tenant is sent if we have a resolved tenant, even if not explicitly passed
  const headerTenant = effectiveTenantSlug || resolvedTenantSlug;
  if (headerTenant) {
    headers["X-Tenant"] = headerTenant;
  }
  // Always send X-Anon-Id for session persistence, prioritizing the new key
  if (anonId) {
    headers["X-Anon-Id"] = anonId;
    // Keep legacy header for backward compatibility if needed, but usage is deprecated
    if (!token || sendAnonId) {
       headers["Anon-Id"] = anonId;
    }
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
      tenantSlug: effectiveTenantSlug || null,
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

  if (isAbsolutePath) {
    try {
      response = await fetch(url, requestInit);
    } catch (err) {
      lastError = err;
    }
  }

  for (let baseIndex = 0; baseIndex < candidateBases.length; baseIndex++) {
    const base = candidateBases[baseIndex];
    const cleanBase = (base || "").replace(/\/$/, "");
    const isApiBase = cleanBase.endsWith("/api") || cleanBase === "/api";
    const isSameOriginProxy =
      Boolean(SAME_ORIGIN_PROXY_BASE) && cleanBase === SAME_ORIGIN_PROXY_BASE;
    const allowAuthFallback = isSameOriginProxy && treatAsWidget;
    const urlsToTry = [buildUrl(base, isApiBase)];

    if (!isApiBase && hasApiPrefix) {
      urlsToTry.push(buildUrl(base, true));
    }

    for (let urlIndex = 0; urlIndex < urlsToTry.length; urlIndex++) {
      const candidateUrl = urlsToTry[urlIndex];
      url = candidateUrl;

      try {
        const candidateResponse = await fetch(candidateUrl, requestInit);

        const shouldRetryForStatus = (status: number) => {
          if (status === 404) {
            return true;
          }

          if (allowAuthFallback && (status === 401 || status === 403)) {
            return true;
          }

          return false;
        };

        const isMissingProxy =
          candidateResponse.status === 404 &&
          SAME_ORIGIN_PROXY_BASE &&
          cleanBase === SAME_ORIGIN_PROXY_BASE &&
          candidateBases.length > 1;

        const hasMoreCandidateUrls = urlIndex < urlsToTry.length - 1;
        const hasMoreBases = baseIndex < candidateBases.length - 1;
        const isRetryableStatus = shouldRetryForStatus(candidateResponse.status);
        const shouldTryNextCandidate = isRetryableStatus && hasMoreCandidateUrls;
        const shouldTryNextBase = isRetryableStatus && !hasMoreCandidateUrls && hasMoreBases;

        if (isMissingProxy || shouldTryNextCandidate) {
          continue;
        }

        if (shouldTryNextBase) {
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
