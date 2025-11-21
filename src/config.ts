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

const CANONICAL_FRONTEND_HOSTS = ['chatboc.ar', 'www.chatboc.ar'];

const shouldUseSameOriginProxy = (backendUrl: string): boolean => {
  if (typeof window === 'undefined') return false;

  try {
    const url = new URL(backendUrl);
    return (
      url.hostname.includes('chatbot-backend') &&
      CANONICAL_FRONTEND_HOSTS.includes(window.location.hostname)
    );
  } catch (error) {
    console.warn('Invalid VITE_BACKEND_URL provided, using same-origin proxy instead.', error);
    return false;
  }
};

const CANONICAL_BACKEND_ORIGIN = 'https://api.chatboc.ar';

const resolveBackendUrl = (): string => {
  const sanitized = sanitizeBaseUrl(VITE_BACKEND_URL);

  if (sanitized) {
    if (shouldUseSameOriginProxy(sanitized)) {
      return '';
    }
    return sanitized;
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname.toLowerCase();
    if (CANONICAL_FRONTEND_HOSTS.includes(hostname)) {
      return CANONICAL_BACKEND_ORIGIN;
    }
  }

  return '';
};

const RESOLVED_BACKEND_URL = resolveBackendUrl();

/**
 * The base URL for all HTTP API requests.
 * In development, with a proxy, this will be an empty string,
 * resulting in relative paths (e.g., /api/login).
 * In production, it will be the full backend URL, unless we intentionally
 * fallback to the same-origin proxy for canonical chatboc hosts.
 */
export const BASE_API_URL = RESOLVED_BACKEND_URL
  ? RESOLVED_BACKEND_URL
  : IS_DEV
    ? '/api'
    : window.location.origin;

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
