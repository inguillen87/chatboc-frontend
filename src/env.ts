const FALLBACK_GOOGLE_CLIENT_ID =
  '32341370449-g1757v5k948nrreul5ueonqf00c43m8o.apps.googleusercontent.com';

const readRuntimeEnv = (key: string): string | null => {
  if (typeof window === 'undefined') return null;
  const runtimeEnv = (window as any).__ENV || (window as any).ENV || {};
  const candidate = runtimeEnv[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
};

const resolveGoogleClientId = (): { value: string; fromFallback: boolean } => {
  const envValue = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  if (envValue.trim()) return { value: envValue.trim(), fromFallback: false };

  const runtimeValue = readRuntimeEnv('VITE_GOOGLE_CLIENT_ID');
  if (runtimeValue) return { value: runtimeValue, fromFallback: false };

  return { value: FALLBACK_GOOGLE_CLIENT_ID, fromFallback: true };
};

const { value: resolvedGoogleClientId, fromFallback } = resolveGoogleClientId();

if (fromFallback) {
  console.warn(
    '[env] VITE_GOOGLE_CLIENT_ID is missing. Falling back to the default client ID documented in the README. ' +
      'Configure the variable in your environment to silence this warning.',
  );
}

export const GOOGLE_CLIENT_ID = resolvedGoogleClientId;
