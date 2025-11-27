// src/config.ts

// This file is the single source of truth for all backend URLs.

const VITE_BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const IS_DEV = import.meta.env.DEV;
const VITE_DEFAULT_ENTITY_TOKEN = import.meta.env.VITE_DEFAULT_ENTITY_TOKEN;
const VITE_PUBLIC_SURVEY_BASE_URL = import.meta.env.VITE_PUBLIC_SURVEY_BASE_URL;
const VITE_ENABLE_SURVEY_ANALYTICS_FALLBACK = import.meta.env.VITE_ENABLE_SURVEY_ANALYTICS_FALLBACK;

const sanitizeBaseUrl = (value?: string) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/$/, '');
};

const normalizeBackendUrl = (value: string): string => sanitizeBaseUrl(value);

const parseBooleanFlag = (value?: string | boolean | null | undefined): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }

  return null;
};

const CANONICAL_PUBLIC_SURVEY_HOST = 'www.chatboc.ar';

const normalizeSurveyBaseUrl = (value?: string): string => {
  const sanitized = sanitizeBaseUrl(value);
  if (!sanitized) return '';

  try {
    const url = new URL(sanitized);

    if (url.hostname === 'api.chatboc.ar') {
      url.hostname = CANONICAL_PUBLIC_SURVEY_HOST;
      url.port = '';
      return url.origin;
    }

    if (url.hostname.includes('chatbot-backend')) {
      return `https://${CANONICAL_PUBLIC_SURVEY_HOST}`;
    }

    return url.origin.replace(/\/$/, '');
  } catch (error) {
    return sanitized;
  }
};

const RESOLVED_BACKEND_URL = normalizeBackendUrl(VITE_BACKEND_URL);

const inferSameOriginProxy = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const currentUrl = new URL(window.location.href);

    if (RESOLVED_BACKEND_URL) {
      const backendUrl = new URL(RESOLVED_BACKEND_URL);

      const normalizeHost = (host: string) => host.split('.').slice(-2).join('.');
      const backendApex = normalizeHost(backendUrl.hostname);
      const currentApex = normalizeHost(currentUrl.hostname);

      const isApiSubdomain = backendUrl.hostname.startsWith('api.');
      const sharesApexDomain = backendApex === currentApex;

      // When the backend lives on an api.<domain> host matching the current apex
      // (e.g., api.chatboc.ar from www.chatboc.ar), prefer the same-origin /api
      // proxy to avoid CORS issues in the widget.
      if (isApiSubdomain && sharesApexDomain) {
        return '/api';
      }
    }
  } catch (error) {
    console.warn('[config] Unable to infer same-origin proxy for backend URL', error);
  }

  return null;
};

const inferBackendUrlFromOrigin = (): string => {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return '';
  }

  try {
    const url = new URL(window.location.href);
    return url.origin;
  } catch (error) {
    console.warn('[config] Unable to infer backend URL from origin', error);
    return '';
  }
};

/**
 * The base URL for all HTTP API requests.
 * In development, with a proxy, this will be an empty string,
 * resulting in relative paths (e.g., /api/login).
 * In production, it will be the full backend URL when provided, otherwise
 * it falls back to the current origin.
 */
const FALLBACK_BACKEND_URL = sanitizeBaseUrl(inferBackendUrlFromOrigin());

const preferSameOriginProxy = inferSameOriginProxy();

// When the widget is served from a host that proxies /api (e.g., www.chatboc.ar), keep
// API calls on the same origin even if VITE_BACKEND_URL is set, so that requests avoid
// CORS-preflight failures due to custom headers. Using "/api" as the base ensures that
// endpoints are routed through the proxy while still allowing backend URLs as a
// fallback for environments without one.
export const SAME_ORIGIN_PROXY_BASE = sanitizeBaseUrl(preferSameOriginProxy || '');

export const BASE_API_URL = sanitizeBaseUrl(
  SAME_ORIGIN_PROXY_BASE ||
    RESOLVED_BACKEND_URL ||
    FALLBACK_BACKEND_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')
);

export const API_BASE_CANDIDATES = [
  SAME_ORIGIN_PROXY_BASE,
  RESOLVED_BACKEND_URL,
  FALLBACK_BACKEND_URL,
  typeof window !== 'undefined' ? sanitizeBaseUrl(window.location.origin) : '',
]
  .filter((value): value is string => typeof value === 'string' && !!value)
  .filter((value, index, self) => self.indexOf(value) === index);

/**
 * Derives the WebSocket URL from the current environment.
 * In development, it connects to the Vite dev server, which proxies the connection.
 * In production, it derives the `ws://` or `wss://` URL from the backend URL.
 * @returns The full WebSocket URL.
 */
export const getSocketUrl = (): string => {
  if (RESOLVED_BACKEND_URL) {
    // If a full backend URL is provided, derive the WebSocket URL from it.
    try {
      const url = new URL(RESOLVED_BACKEND_URL);
      url.protocol = url.protocol.replace('http', 'ws');
      return url.href;
    } catch (e) {
      console.error("Invalid backend URL for WebSocket:", RESOLVED_BACKEND_URL);
      // Fallback to current location in case of invalid URL.
      const fallbackUrl = new URL(window.location.href);
      fallbackUrl.protocol = fallbackUrl.protocol.replace('http', 'ws');
      return fallbackUrl.origin;
    }
  }

  // In dev mode with proxy, or in production when VITE_BACKEND_URL is not set,
  // connect to the same host that is serving the frontend.
  const url = new URL(window.location.href);
  url.protocol = url.protocol.replace('http', 'ws');
  return url.origin;
};

// --- Other Environment Variables ---

export const ENV = import.meta.env.VITE_ENV || 'dev';
export const PANEL_URL = import.meta.env.VITE_PANEL_URL;
export const WIDGET_URL = import.meta.env.VITE_WIDGET_URL;
export const COOKIE_DOMAIN = import.meta.env.VITE_COOKIE_DOMAIN;
export const TIMEZONE = import.meta.env.VITE_TIMEZONE || 'America/Argentina/Buenos_Aires';
export const LOCALE = import.meta.env.VITE_LOCALE || 'es-AR';
export const APP_TARGET = (import.meta.env.VITE_APP_TARGET || 'pyme') as 'pyme' | 'municipio';
export const DEFAULT_ENTITY_TOKEN =
  typeof VITE_DEFAULT_ENTITY_TOKEN === 'string' && VITE_DEFAULT_ENTITY_TOKEN.trim()
    ? VITE_DEFAULT_ENTITY_TOKEN.trim()
    : '';
const FALLBACK_PUBLIC_SURVEY_BASE_URL = (() => {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return '';
  }
  return normalizeSurveyBaseUrl(window.location.origin);
})();

export const PUBLIC_SURVEY_BASE_URL =
  normalizeSurveyBaseUrl(VITE_PUBLIC_SURVEY_BASE_URL) || FALLBACK_PUBLIC_SURVEY_BASE_URL;

const analyticsFallbackPreference = (() => {
  const fromEnv = parseBooleanFlag(VITE_ENABLE_SURVEY_ANALYTICS_FALLBACK);
  if (fromEnv !== null) {
    return fromEnv;
  }

  if (typeof window !== 'undefined') {
    try {
      const fromStorage = parseBooleanFlag(window.localStorage?.getItem('CHATBOC_ENABLE_SURVEY_ANALYTICS_FALLBACK'));
      if (fromStorage !== null) {
        return fromStorage;
      }
    } catch {
      // Access to localStorage can fail in private contexts. Ignore and fallback to defaults.
    }

    const fromGlobal = parseBooleanFlag((window as any)?.CHATBOC_ENABLE_SURVEY_ANALYTICS_FALLBACK);
    if (fromGlobal !== null) {
      return fromGlobal;
    }
  }

  return null;
})();

export const ENABLE_SURVEY_ANALYTICS_FALLBACK =
  analyticsFallbackPreference !== null ? analyticsFallbackPreference : IS_DEV;
