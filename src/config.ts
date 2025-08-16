// src/config.ts

// --- Environment-based Configuration ---
// The values are loaded from .env files by Vite.
// See .env.example for documentation.

export const ENV = import.meta.env.VITE_ENV || 'dev';

export const PANEL_URL = import.meta.env.VITE_PANEL_URL;

export const WIDGET_URL = import.meta.env.VITE_WIDGET_URL;

export const COOKIE_DOMAIN = import.meta.env.VITE_COOKIE_DOMAIN;

// --- Original Static Configuration ---
// These were already here and are kept for now.
export const TIMEZONE = import.meta.env.VITE_TIMEZONE || 'America/Argentina/Buenos_Aires';

export const LOCALE = import.meta.env.VITE_LOCALE || 'es-AR';

export const APP_TARGET = (import.meta.env.VITE_APP_TARGET || 'pyme') as
  | 'pyme'
  | 'municipio';

// --- Validation for critical variables ---
