import { ZodType } from 'zod';
// utils/api.ts

import { API_BASE_CANDIDATES, BASE_API_URL, SAME_ORIGIN_PROXY_BASE } from '@/config';
import { TENANT_PLACEHOLDER_SLUGS, TENANT_ROUTE_PREFIXES } from '@/constants/tenant';
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import {
  isTenantSlugDeploymentHostnameMirror,
  readTenantSlugFromHostname,
} from '@/utils/tenantHostname';
import { usePanelSessionStore, useWidgetSessionStore, useTenantStore } from '@/stores';

import getOrCreateChatSessionId from "@/utils/chatSessionId"; // Import the new function
import { getOrCreateAnonId } from "@/utils/anonIdGenerator";
import { getIframeToken } from "@/utils/config";
import { trackFrontendEvent } from '@/utils/frontendTelemetry';

export class NetworkError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "NetworkError";
    Object.setPrototypeOf(this, NetworkError.prototype);
    this.cause = cause;
  }
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly body: any;
  public readonly requestId?: string;

  constructor(message: string, status: number, body: any = null, requestId?: string) {
    super(message);
    this.name = "ApiError";
    Object.setPrototypeOf(this, ApiError.prototype);
    this.status = status;
    this.body = body;
    this.requestId = requestId;
  }
}

const parseDebugFlag = (value?: string | null): boolean => {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
};

const resolveResponseRequestId = (response: Response, data: unknown): string | undefined => {
  const fromHeader =
    response.headers.get("X-Request-Id") ||
    response.headers.get("x-request-id") ||
    response.headers.get("X-Correlation-Id") ||
    response.headers.get("x-correlation-id");
  if (typeof fromHeader === "string" && fromHeader.trim()) {
    return fromHeader.trim();
  }

  if (data && typeof data === "object") {
    const value = (data as Record<string, unknown>).request_id;
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

const TENANT_PATH_REGEX = new RegExp(`^/(?:${TENANT_ROUTE_PREFIXES.join("|")})/([^/]+)`, "i");

const LOCAL_PLACEHOLDER_SLUGS = new Set([
  ...TENANT_PLACEHOLDER_SLUGS,
  'e',
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
  'crm',
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
  'facebook',
  'mapas',
  'ticket',
  'tickets',
  'admin',
  'me'
]);

// Merge shared placeholders with API-specific ones
const PLACEHOLDER_SLUGS = new Set([
  ...LOCAL_PLACEHOLDER_SLUGS,
  "public", "auth", "portal", "admin", "pwa", "static", "assets"
]);

const readTenantFromSubdomain = () => {
  if (typeof window === "undefined") return null;
  return readTenantSlugFromHostname(window.location?.hostname);
};

const isDeploymentHostnameMirror = (candidate?: string | null): boolean =>
  typeof window !== 'undefined' &&
  isTenantSlugDeploymentHostnameMirror(candidate, window.location?.hostname);

const readTenantFromStoredUser = () => {
  try {
    const rawUser = safeLocalStorage.getItem("user");
    if (!rawUser) return null;
    const parsed = JSON.parse(rawUser);
    const candidate =
      parsed?.tenant_slug || parsed?.tenantSlug || parsed?.tenant || parsed?.endpoint;
    if (typeof candidate !== "string" || isDeploymentHostnameMirror(candidate)) return null;
    return candidate;
  } catch (error) {
    console.warn(
      "[apiFetch] No se pudo leer tenant del usuario almacenado",
      redactApiDiagnosticData(error),
    );
    return null;
  }
};

const readTenantFromStorageKey = () => {
  try {
    const candidate = safeLocalStorage.getItem("tenantSlug");
    if (typeof candidate !== "string") return null;
    if (isDeploymentHostnameMirror(candidate)) {
      safeLocalStorage.removeItem("tenantSlug");
      return null;
    }
    return candidate;
  } catch (error) {
    console.warn(
      "[apiFetch] No se pudo leer tenantSlug de localStorage",
      redactApiDiagnosticData(error),
    );
    return null;
  }
};

const sanitizeTenantSlug = (slug?: string | null) => {
  if (!slug || typeof slug !== "string") return null;
  const normalized = slug.trim();
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (
    PLACEHOLDER_SLUGS.has(lowered) ||
    lowered === "localhost" ||
    lowered === "::1" ||
    /^\d+$/.test(lowered) ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(lowered)
  ) {
    return null;
  }
  return normalized;
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
      console.warn(
        "[apiFetch] No se pudo normalizar el path para tenant",
        redactApiDiagnosticData(error),
      );
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
      console.warn(
        "[apiFetch] No se pudo decodificar el slug de la URL",
        redactApiDiagnosticData(error),
      );
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
      console.warn(
        "[apiFetch] No se pudo leer la query string para tenant",
        redactApiDiagnosticData(error),
      );
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
    console.warn(
      "[apiFetch] No se pudo leer CHATBOC_CONFIG para tenant",
      redactApiDiagnosticData(error),
    );
  }

  const subdomainTenant = sanitizeTenantSlug(readTenantFromSubdomain());
  if (subdomainTenant) return subdomainTenant;

  return null;
};

export const resolveTenantSlug = (
  explicitTenant?: string | null,
  pathForFallback?: string | null,
  options: { persist?: boolean } = {},
): string | null => {
  const resolved = inferTenantSlug(explicitTenant, pathForFallback);

  if (resolved && options.persist !== false) {
    try {
      safeLocalStorage.setItem("tenantSlug", resolved);
    } catch (error) {
      console.warn(
        "[apiFetch] No se pudo persistir tenantSlug resuelto",
        redactApiDiagnosticData(error),
      );
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

export const REDACTED_API_LOG_VALUE = "[REDACTED]" as const;

const SENSITIVE_API_DIAGNOSTIC_KEY_FRAGMENTS = [
  "authorization",
  "token",
  "credential",
  "secret",
  "apikey",
  "pin",
  "cookie",
  "session",
] as const;

const isSensitiveApiDiagnosticKey = (key: string): boolean => {
  const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_API_DIAGNOSTIC_KEY_FRAGMENTS.some((fragment) =>
    normalizedKey.includes(fragment),
  );
};

/**
 * Produces a detached, deeply redacted value exclusively for diagnostics.
 * The original request headers/payload are never mutated.
 */
export const redactApiDiagnosticData = (
  value: unknown,
  seen: WeakSet<object> = new WeakSet<object>(),
): unknown => {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  if (typeof Headers !== "undefined" && value instanceof Headers) {
    const redactedHeaders: Record<string, unknown> = {};
    value.forEach((headerValue, headerName) => {
      redactedHeaders[headerName] = isSensitiveApiDiagnosticKey(headerName)
        ? REDACTED_API_LOG_VALUE
        : headerValue;
    });
    return redactedHeaders;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactApiDiagnosticData(entry, seen));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const source = value as Record<string, unknown>;
  const keys =
    value instanceof Error
      ? Array.from(
          new Set(["name", "message", "stack", "cause", ...Object.keys(value)]),
        )
      : Object.keys(value);
  const redactedRecord: Record<string, unknown> = {};

  for (const key of keys) {
    if (isSensitiveApiDiagnosticKey(key)) {
      redactedRecord[key] = REDACTED_API_LOG_VALUE;
      continue;
    }

    try {
      redactedRecord[key] = redactApiDiagnosticData(source[key], seen);
    } catch {
      redactedRecord[key] = "[Unavailable]";
    }
  }

  return redactedRecord;
};

const identityTelemetryEmitted = new Set<string>();

const emitIdentityContextTelemetry = (
  event: 'identity_context_attached' | 'identity_context_missing',
  payload: {
    tenant_slug?: string | null;
    has_conversation_id?: boolean;
    path?: string;
    method?: string;
  },
) => {
  const dedupeKey = `${event}:${payload.tenant_slug || 'global'}:${payload.path || ''}:${payload.method || ''}`;
  if (identityTelemetryEmitted.has(dedupeKey)) {
    return;
  }
  identityTelemetryEmitted.add(dedupeKey);
  trackFrontendEvent(event, payload);
};


const extractErrorTextCandidate = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';

  const payload = value as Record<string, unknown>;
  for (const key of ['raw', 'html', 'text', 'body', 'message', 'mensaje', 'detail', 'error']) {
    const candidate = payload[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (candidate && typeof candidate === 'object') {
      const nested = extractErrorTextCandidate(candidate);
      if (nested) return nested;
    }
  }
  return '';
};

export const isLikelyHtmlErrorBody = (value: unknown): boolean => {
  const text = extractErrorTextCandidate(value).trim().toLowerCase();
  if (!text) return false;

  return (
    text.includes('<!doctype html') ||
    text.includes('<html') ||
    text.includes('<head') ||
    text.includes('<body') ||
    text.includes('</html>') ||
    text.includes('502 bad gateway') ||
    text.includes('504 gateway timeout') ||
    text.includes('503 service unavailable') ||
    text.includes('cloudflare') ||
    text.includes('nginx')
  );
};

const safeServerErrorMessage = (status?: number, fallback = 'No pudimos completar la solicitud. Intentalo de nuevo en unos segundos.') => {
  if (status && [500, 502, 503, 504].includes(status)) {
    return 'El servidor no pudo responder correctamente. Intentalo de nuevo en unos segundos.';
  }
  return fallback;
};

const redactApiLogData = (data: unknown, status?: number, contentType?: string) => {
  const logData = isLikelyHtmlErrorBody(data)
    ? {
        redacted: true,
        reason: 'html_error_body',
        status,
        contentType,
      }
    : data;
  return redactApiDiagnosticData(logData);
};

const resolveApiErrorMessage = (data: unknown, fallback: string, status?: number) => {
  if (isLikelyHtmlErrorBody(data)) {
    return safeServerErrorMessage(status, fallback);
  }

  if (typeof data === 'string') {
    const trimmed = data.trim();
    return trimmed || fallback;
  }

  if (data && typeof data === 'object') {
    const payload = data as Record<string, unknown>;
    const payloadError = payload.error;
    const nestedErrorMessage =
      payloadError && typeof payloadError === 'object'
        ? (payloadError as Record<string, unknown>).message
        : null;
    const nestedErrorMensaje =
      payloadError && typeof payloadError === 'object'
        ? (payloadError as Record<string, unknown>).mensaje
        : null;
    const nestedErrorCode =
      payloadError && typeof payloadError === 'object'
        ? (payloadError as Record<string, unknown>).code
        : null;
    const payloadErrorText = typeof payloadError === 'string' ? payloadError : null;
    const directMessage =
      nestedErrorMessage ??
      nestedErrorMensaje ??
      payloadErrorText ??
      payload.message ??
      payload.mensaje ??
      payload.detail ??
      payload.action_hint ??
      payload.reason_code ??
      payload.codigo ??
      nestedErrorCode;

    if (typeof directMessage === 'string') {
      const trimmed = directMessage.trim();
      if (isLikelyHtmlErrorBody(trimmed)) {
        return safeServerErrorMessage(status, fallback);
      }
      if (trimmed) return trimmed;
    }

    if (Array.isArray(directMessage)) {
      const joined = directMessage.filter((item) => typeof item === 'string').join(' · ').trim();
      if (joined) return joined;
    }
  }

  return fallback;
};

interface ApiFetchOptions {
  schema?: ZodType<any, any, any>;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  headers?: Record<string, string>;
  body?: any;
  skipAuth?: boolean;
  /**
   * When true, prevents automatic redirects to /login on 401 responses for panel requests.
   * Useful for optional data fetches that should gracefully handle an unauthenticated state.
   */
  suppressPanel401Redirect?: boolean;
  /**
   * When true, preserves auth tokens on 401 responses.
   * Useful for upload flows where we want to surface the error without clearing session state.
   */
  preserveAuthOn401?: boolean;
  sendAnonId?: boolean;
  /**
   * Legacy compatibility flag used by widget/public modules.
   * apiFetch already sends X-Entity-Token when a token is available unless
   * omitEntityToken is true; keeping this option prevents older callers from
   * falling out of the typed contract.
   */
  sendEntityToken?: boolean;
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
   * Uses an already-issued chat session instead of the browser-global fallback.
   * Demo bootstraps bind this value to their signed demo session.
   */
  chatSessionId?: string | null;
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
   * Set false for scoped demo requests so public examples never overwrite
   * the browser's real tenant context.
   */
  persistTenantSlug?: boolean;
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
  /**
   * Public tracking pin for ticket/timeline requests.
   * Sent as header to preserve public access context across refresh/retry flows.
   */
  pin?: string | null;
  /**
   * Omnichannel identity key propagated to backend request headers.
   */
  contactKey?: string | null;
  /**
   * Omnichannel conversation identifier (e.g. WhatsApp handoff).
   */
  conversationId?: string | null;
  /**
   * Optional/advisory endpoints can receive legacy HTML gateway pages from
   * hosting layers. When true, apiFetch still throws ApiError but avoids a
   * duplicate dev-console warning before the caller applies its own fallback.
   */
  suppressInvalidJsonWarning?: boolean;
}

const normalizeHeaderValue = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const parseStoredJsonRecord = (key: string): Record<string, unknown> | null => {
  try {
    const raw = safeLocalStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

interface OmnichannelIdentitySnapshot {
  contactKey?: string | null;
  conversationId?: string | null;
}

const OMNICHANNEL_IDENTITY_STORAGE_PREFIX = "chatboc_omnichannel_identity";

const buildOmnichannelIdentityStorageKey = (tenantSlug?: string | null) => {
  const normalizedTenant = normalizeHeaderValue(tenantSlug)?.toLowerCase() || "global";
  return `${OMNICHANNEL_IDENTITY_STORAGE_PREFIX}:${normalizedTenant}`;
};

const readOmnichannelIdentitySnapshot = (tenantSlug?: string | null): OmnichannelIdentitySnapshot | null => {
  const key = buildOmnichannelIdentityStorageKey(tenantSlug);
  const parsed = parseStoredJsonRecord(key);
  if (!parsed) return null;

  return {
    contactKey: normalizeHeaderValue(parsed.contactKey),
    conversationId: normalizeHeaderValue(parsed.conversationId),
  };
};

const persistOmnichannelIdentitySnapshot = (
  tenantSlug: string | null | undefined,
  identity: OmnichannelIdentitySnapshot,
) => {
  const contactKey = normalizeHeaderValue(identity.contactKey);
  const conversationId = normalizeHeaderValue(identity.conversationId);
  if (!contactKey && !conversationId) return;

  const key = buildOmnichannelIdentityStorageKey(tenantSlug);
  const existing = readOmnichannelIdentitySnapshot(tenantSlug) || {};
  const payload = {
    contactKey: contactKey ?? existing.contactKey ?? null,
    conversationId: conversationId ?? existing.conversationId ?? null,
    updatedAt: new Date().toISOString(),
  };

  try {
    safeLocalStorage.setItem(key, JSON.stringify(payload));
  } catch (error) {
    console.warn(
      "[apiFetch] Unable to persist omnichannel identity",
      redactApiDiagnosticData(error),
    );
  }
};

export const resolveOmnichannelContactKey = (
  explicitContactKey: string | null | undefined,
  existingHeaders: Record<string, string>,
  anonId: string | null,
  persistedIdentity?: OmnichannelIdentitySnapshot | null,
): string | null => {
  const headerContact =
    normalizeHeaderValue(existingHeaders["X-Contact-Key"]) ||
    normalizeHeaderValue(existingHeaders["x-contact-key"]);

  if (headerContact) return headerContact;

  const explicit = normalizeHeaderValue(explicitContactKey);
  if (explicit) return explicit;

  const persistedContactKey = normalizeHeaderValue(persistedIdentity?.contactKey);
  if (persistedContactKey) return persistedContactKey;

  const storedUser = parseStoredJsonRecord("user");
  const userContact =
    normalizeHeaderValue(storedUser?.contact_key) ||
    normalizeHeaderValue(storedUser?.contactKey);
  if (userContact) return userContact;

  const storedContact =
    normalizeHeaderValue(safeLocalStorage.getItem("chatboc_contact_key")) ||
    normalizeHeaderValue(safeLocalStorage.getItem("contact_key"));
  if (storedContact) return storedContact;

  return normalizeHeaderValue(anonId);
};

export const resolveOmnichannelConversationId = (
  explicitConversationId: string | null | undefined,
  existingHeaders: Record<string, string>,
  persistedIdentity?: OmnichannelIdentitySnapshot | null,
): string | null => {
  const headerConversationId =
    normalizeHeaderValue(existingHeaders["X-Conversation-Id"]) ||
    normalizeHeaderValue(existingHeaders["x-conversation-id"]);
  if (headerConversationId) return headerConversationId;

  const explicit = normalizeHeaderValue(explicitConversationId);
  if (explicit) return explicit;

  const persistedConversationId = normalizeHeaderValue(persistedIdentity?.conversationId);
  if (persistedConversationId) return persistedConversationId;

  const widgetContext = parseStoredJsonRecord("chatboc_public_chat_context");
  const contextConversationId =
    normalizeHeaderValue(widgetContext?.conversation_id) ||
    normalizeHeaderValue(widgetContext?.conversationId) ||
    normalizeHeaderValue(widgetContext?.whatsapp_conversation_id);

  if (contextConversationId) return contextConversationId;

  const ticketPublicAccess = parseStoredJsonRecord("ticket_public_access");
  return (
    normalizeHeaderValue(ticketPublicAccess?.conversation_id) ||
    normalizeHeaderValue(ticketPublicAccess?.conversationId) ||
    normalizeHeaderValue(ticketPublicAccess?.whatsapp_conversation_id)
  );
};

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
    preserveAuthOn401,
    sendAnonId,
    entityToken,
    cache,
    onResponse,
    omitCredentials,
    isWidgetRequest,
    omitChatSessionId,
    chatSessionId: explicitChatSessionId,
    tenantSlug,
    persistTenantSlug,
    baseUrlOverride,
    omitEntityToken,
    omitTenant,
    pin,
    contactKey,
    conversationId,
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
      console.warn(
        "[apiFetch] Unable to determine widget environment",
        redactApiDiagnosticData(err),
      );
    }

    return false;
  })();

  const treatAsWidget = isWidgetRequest ?? (isWidgetContext && isLikelyWidgetEnvironment);
  const resolvedTenantSlug = omitTenant
    ? null
    : treatAsWidget && tenantSlug === undefined
      ? null
      : resolveTenantSlug(tenantSlug, path, { persist: persistTenantSlug !== false });
  const panelToken = usePanelSessionStore.getState().authToken || safeLocalStorage.getItem("authToken");
  const chatToken = useWidgetSessionStore.getState().chatAuthToken || safeLocalStorage.getItem("chatAuthToken");
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
  const chatSessionId = shouldAttachChatSession
    ? normalizeHeaderValue(explicitChatSessionId) || getOrCreateChatSessionId()
    : null;

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
      console.warn(
        "[apiFetch] No se pudieron adjuntar query params de tenant",
        redactApiDiagnosticData(error),
      );
      return rawPath;
    }
  };

  const isAbsolutePath = /^https?:\/\//i.test(path);
  const normalizedPath = isAbsolutePath ? path : path.replace(/^\/+/, "");
  const isPublicRoute = !isAbsolutePath && /^(?:api\/)?public(?:[/?#]|$)/i.test(normalizedPath);
  const isPublicTenantInfoRoute =
    !isAbsolutePath && /^(?:api\/)?pwa\/tenant-info(?:[/?#]|$)/i.test(normalizedPath);
  const shouldOmitEntityTokenForRoute = isPublicRoute || isPublicTenantInfoRoute;

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
  const expectsJsonResponse =
    !acceptPreference ||
    acceptPreference.includes("json") ||
    acceptPreference.includes("*/*");

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
  const persistedIdentity = readOmnichannelIdentitySnapshot(headerTenant);
  if (headerTenant) {
    headers["X-Tenant"] = headerTenant;
    headers["X-Tenant-Slug"] = headerTenant;
  }
  const resolvedContactKey = resolveOmnichannelContactKey(contactKey, headers, anonId, persistedIdentity);
  if (resolvedContactKey) {
    headers["X-Contact-Key"] = resolvedContactKey;
  }
  const resolvedConversationId = resolveOmnichannelConversationId(conversationId, headers, persistedIdentity);
  if (resolvedConversationId) {
    headers["X-Conversation-Id"] = resolvedConversationId;
  }

  if (resolvedContactKey) {
    emitIdentityContextTelemetry('identity_context_attached', {
      tenant_slug: headerTenant,
      has_conversation_id: Boolean(resolvedConversationId),
      path: normalizedPathWithTenant,
      method,
    });
  } else {
    emitIdentityContextTelemetry('identity_context_missing', {
      tenant_slug: headerTenant,
      has_conversation_id: Boolean(resolvedConversationId),
      path: normalizedPathWithTenant,
      method,
    });
  }

  // Always send X-Anon-Id for session persistence, prioritizing the new key
  if (anonId) {
    headers["X-Anon-Id"] = anonId;
    // Keep legacy header for backward compatibility if needed, but usage is deprecated
    if (!token || sendAnonId) {
       headers["Anon-Id"] = anonId;
    }
  }
  if (effectiveEntityToken && !omitEntityToken && !shouldOmitEntityTokenForRoute) {
    headers["X-Entity-Token"] = effectiveEntityToken;
    headers["X-Token"] = effectiveEntityToken;
  }
  if (typeof pin === "string" && pin.trim()) {
    const normalizedPin = pin.trim();
    headers.pin = normalizedPin;
    headers["X-Tracking-Pin"] = normalizedPin;
  }
  // Keep the transport headers intact and redact only the detached diagnostic copy.
  const mask = (t: string | null) => (t ? `${t.slice(0, 8)}...` : null);
  const verboseLogging = shouldLogVerboseApi();
  if (verboseLogging) {
    console.log(
      "[apiFetch] Request",
      redactApiDiagnosticData({
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
      }),
    );
  }

  const shouldOmitCredentials =
    omitCredentials !== undefined
      ? omitCredentials
      : treatAsWidget;

  const requestInit: RequestInit = {
    method,
    headers,
    body: isForm ? body : (typeof body === "string" ? body : (body ? JSON.stringify(body) : undefined)),
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
    const isCurrentOriginBase = Boolean(currentOrigin) && cleanBase === currentOrigin;
    const allowAuthFallback = isSameOriginProxy && treatAsWidget;
    const allowPublicOriginFallback = (isSameOriginProxy || isCurrentOriginBase) && shouldOmitEntityTokenForRoute;
    const urlsToTry = [buildUrl(base, isApiBase)];

    if (!isApiBase && hasApiPrefix && !isPublicRoute) {
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

          if (allowPublicOriginFallback && status === 403) {
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
        const candidateContentType =
          candidateResponse.headers.get("content-type")?.toLowerCase() ?? "";
        const looksLikeFrontendHtmlShell =
          candidateResponse.ok &&
          expectsJsonResponse &&
          candidateContentType.includes("text/html");
        const shouldTryNextCandidate = isRetryableStatus && hasMoreCandidateUrls;
        const shouldTryNextBase = isRetryableStatus && !hasMoreCandidateUrls && hasMoreBases;

        if (looksLikeFrontendHtmlShell) {
          if (hasMoreCandidateUrls) {
            continue;
          }
          if (hasMoreBases) {
            break;
          }
          lastError = new ApiError(
            'La ruta de API devolvio la aplicacion web en lugar de datos JSON. Revisa el proxy o la URL del backend.',
            502,
            { contentType: candidateContentType, url: candidateUrl },
          );
          response = null;
          break;
        }

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
      console.warn(
        "[apiFetch] onResponse callback failed",
        redactApiDiagnosticData(callbackError),
      );
    }
  }

  try {
    const responseTenantSlug = sanitizeTenantSlug(
      response.headers.get("X-Tenant-Slug") ||
      response.headers.get("x-tenant-slug") ||
      response.headers.get("X-Tenant") ||
      response.headers.get("x-tenant") ||
      headerTenant,
    );
    const responseContactKey =
      response.headers.get("X-Contact-Key") ||
      response.headers.get("x-contact-key");
    const responseConversationId =
      response.headers.get("X-Conversation-Id") ||
      response.headers.get("x-conversation-id");
    persistOmnichannelIdentitySnapshot(responseTenantSlug, {
      contactKey: responseContactKey,
      conversationId: responseConversationId,
    });

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
          redactApiDiagnosticData(storageError),
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

    if (trimmedText) {
      try {
        data = JSON.parse(trimmedText);
        parsedAsJson = true;
      } catch (parseError) {
        data = trimmedText;
        const isProduction =
          (typeof import.meta !== "undefined" && (import.meta as any)?.env?.PROD) ||
          ((globalThis as any)?.process?.env?.NODE_ENV === "production");
        if (!isProduction && !options.suppressInvalidJsonWarning) {
          console.warn(
            `[apiFetch] Response body for ${method} ${url} is not valid JSON. Returning raw text instead.`,
            redactApiDiagnosticData(parseError),
          );
        }
      }
    }

    if (data && typeof data === "object") {
      const payload = data as Record<string, unknown>;
      const payloadError = payload.error;
      const payloadErrorRecord =
        payloadError && typeof payloadError === "object"
          ? (payloadError as Record<string, unknown>)
          : null;

      persistOmnichannelIdentitySnapshot(responseTenantSlug, {
        contactKey:
          normalizeHeaderValue(payload.contact_key) ||
          normalizeHeaderValue(payload.contactKey) ||
          normalizeHeaderValue(payloadErrorRecord?.contact_key) ||
          normalizeHeaderValue(payloadErrorRecord?.contactKey),
        conversationId:
          normalizeHeaderValue(payload.conversation_id) ||
          normalizeHeaderValue(payload.conversationId) ||
          normalizeHeaderValue(payloadErrorRecord?.conversation_id) ||
          normalizeHeaderValue(payloadErrorRecord?.conversationId),
      });
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
        `Respuesta inesperada del servidor (tipo: ${humanReadableType}). Intentalo de nuevo o contacta a soporte con el ID de solicitud.`,
        response.status || 502,
        {
          raw: snippet,
          contentType: responseContentType,
        },
        resolveResponseRequestId(response, data),
      );
    }

    if (verboseLogging) {
      console.log(
        "[apiFetch] Response",
        redactApiDiagnosticData({
          method,
          url,
          status: response.status,
          data: redactApiLogData(data, response.status, responseContentType),
        }),
      );
    }


    const responseRequestId = resolveResponseRequestId(response, data);

    // Si la respuesta es un objeto, le inyectamos el request_id / correlation_id para observabilidad.
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (responseRequestId) {
        (data as any).request_id = responseRequestId;
      }
    }


    if (response.status === 401 && !skipAuth) {
      // Para peticiones del panel/admin, un 401 significa sesión expirada.
      // Debemos limpiar todo y forzar el re-login.
      if (!treatAsWidget && !suppressPanel401Redirect) {
        console.warn("Received 401 Unauthorized for a panel request. Redirecting to login.");
        usePanelSessionStore.getState().clearSession();
        useWidgetSessionStore.getState().clearSession();

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
        if (!preserveAuthOn401) {
          usePanelSessionStore.getState().setAuthToken(null);
        }
      } else if (tokenSource === "chatAuthToken") {
        if (!preserveAuthOn401) {
          useWidgetSessionStore.getState().setChatAuthToken(null);
        }
      }

      throw new ApiError(
        resolveApiErrorMessage(data, "No autorizado", response.status),
        response.status,
        data,
        responseRequestId,
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    if (response.status === 403) {
      throw new ApiError(
        resolveApiErrorMessage(data, "Acceso prohibido", response.status),
        response.status,
        data,
        responseRequestId,
      );
    }

    if (!response.ok) {
      throw new ApiError(
        resolveApiErrorMessage(data, "Error en la respuesta de la API", response.status),
        response.status,
        data,
        responseRequestId,
      );
    }


    if (options.schema) {
      const parseResult = options.schema.safeParse(data);
      if (!parseResult.success) {
        throw new ApiError(
          `Error de validación del esquema para la respuesta de ${path}`,
          response.status,
          parseResult.error.format(),
          responseRequestId
        );
      }
      return parseResult.data as T;
    }

    return data as T;

  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof TypeError) { // Typically a network error or CORS issue
      console.error(
        `Network/API connection issue while reaching ${BASE_API_URL}.`,
        redactApiDiagnosticData(error)
      );
      throw new NetworkError(
        "No fue posible establecer la conexion con el servidor. Verifica tu conexion e intenta nuevamente.",
        error,
      );
    }

    console.error("API Fetch Error:", redactApiDiagnosticData(error));
    throw new NetworkError(
      "No fue posible establecer la conexion con el servidor. Verifica tu conexion e intenta nuevamente.",
      error,
    );
  }
}

/**
 * Extrae un mensaje amigable de error para mostrar en la interfaz.
 */
export function getErrorMessage(error: unknown, fallback = "Ocurrió un error inesperado.") {
  if (error instanceof ApiError) {
    const requestIdMsg = error.requestId ? ` (Req ID: ${error.requestId})` : "";
    let baseMessage = isLikelyHtmlErrorBody(error.message)
      ? safeServerErrorMessage(error.status, fallback)
      : error.message;
    const bodyMessage = resolveApiErrorMessage(error.body, "", error.status);

    if (bodyMessage) {
      baseMessage = bodyMessage;
    }

    if (!baseMessage || baseMessage === "Error en la respuesta de la API") {
      switch (error.status) {
        case 400:
          baseMessage = "Hubo un problema con la solicitud. Por favor, verifica los datos enviados.";
          break;
        case 401:
          baseMessage = "No estás autorizado para realizar esta acción. Por favor, inicia sesión de nuevo.";
          break;
        case 403:
          baseMessage = "No tienes permiso para acceder a este recurso.";
          break;
        case 404:
          baseMessage = "No pudimos encontrar la informacion solicitada.";
          break;
        case 500:
          baseMessage = "Ocurrió un error en el servidor. Por favor, intenta de nuevo más tarde.";
          break;
        default:
          baseMessage = `Ocurrió un error (código: ${error.status})`;
      }
    }

    // If we have validation errors from zod, we might append them
    if (error.body && typeof error.body === 'object' && '_errors' in error.body) {
       baseMessage += ` [Validación fallida]`;
    }

    return `${baseMessage}${requestIdMsg}`;
  }

  if (error instanceof NetworkError) {
    return error.message;
  }

  if (error && typeof (error as any).message === "string") {
    if (isLikelyHtmlErrorBody((error as any).message)) {
      return fallback;
    }
    // Para errores que no son de la API pero tienen un mensaje (ej. errores de red)
    return (error as any).message;
  }
  return fallback;
}
