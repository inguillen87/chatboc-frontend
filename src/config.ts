// src/config.ts

// This file is the single source of truth for all backend URLs.

const VITE_BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
const IS_DEV = import.meta.env.DEV;
const VITE_DEFAULT_ENTITY_TOKEN = import.meta.env.VITE_DEFAULT_ENTITY_TOKEN;
const VITE_PUBLIC_SURVEY_BASE_URL = import.meta.env.VITE_PUBLIC_SURVEY_BASE_URL;

const sanitizeBaseUrl = (value?: string) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/$/, '');
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

/**
 * The base URL for all HTTP API requests.
 * In development, with a proxy, this will be an empty string,
 * resulting in relative paths (e.g., /api/login).
 * In production, it will be the full backend URL.
 */
export const BASE_API_URL = VITE_BACKEND_URL ? VITE_BACKEND_URL : (IS_DEV ? '/api' : window.location.origin);

/**
 * Derives the WebSocket URL from the current environment.
 * In development, it connects to the Vite dev server, which proxies the connection.
 * In production, it derives the `ws://` or `wss://` URL from the backend URL.
 * @returns The full WebSocket URL.
 */
export const getSocketUrl = (): string => {
  if (VITE_BACKEND_URL) {
    // If a full backend URL is provided, derive the WebSocket URL from it.
    try {
      const url = new URL(VITE_BACKEND_URL);
      url.protocol = url.protocol.replace('http', 'ws');
      return url.href;
    } catch (e) {
      console.error("Invalid VITE_BACKEND_URL for WebSocket:", VITE_BACKEND_URL);
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
