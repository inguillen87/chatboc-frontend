export const TIMEZONE = import.meta.env.VITE_TIMEZONE || 'America/Argentina/Buenos_Aires';
export const LOCALE = import.meta.env.VITE_LOCALE || 'es-AR';
export const APP_TARGET = (import.meta.env.VITE_APP_TARGET || 'municipio') as
  | 'pyme'
  | 'municipio';
