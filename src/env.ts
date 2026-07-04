const readRuntimeEnv = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  const runtimeEnv = (window as any).__ENV || (window as any).ENV || {};
  const candidate = runtimeEnv[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
};

const resolveGoogleClientId = (): string => {
  const envValue = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  if (envValue.trim()) return envValue.trim();

  const runtimeValue = readRuntimeEnv('VITE_GOOGLE_CLIENT_ID');
  if (runtimeValue) return runtimeValue;

  return '';
};

export const GOOGLE_CLIENT_ID = resolveGoogleClientId();

export const CLERK_PUBLISHABLE_KEY =
  (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim() ||
  readRuntimeEnv('VITE_CLERK_PUBLISHABLE_KEY') ||
  readRuntimeEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY') ||
  '';

export const CLERK_AUTH_ENABLED = Boolean(CLERK_PUBLISHABLE_KEY);

export const CLOUDFLARE_TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_CLOUDFLARE_TURNSTILE_SITE_KEY || '').trim() ||
  readRuntimeEnv('VITE_CLOUDFLARE_TURNSTILE_SITE_KEY') ||
  '';
