import {
  DEFAULT_CLERK_RUNTIME,
  type ClerkRuntimeValue,
} from '@/components/auth/ClerkRuntimeContext';

interface ClerkEnvRuntimeOptions {
  allowEnvFallback: boolean;
  envEnabled: boolean;
  loading?: boolean;
  publishableKey: string;
}

const resolveClerkEnvironment = (publishableKey: string) => {
  const key = publishableKey.trim();
  if (key.startsWith('pk_live_')) return 'production';
  if (key.startsWith('pk_test_')) return 'development';
  if (key) return 'unknown';
  return 'unconfigured';
};

export const buildClerkRuntimeFromEnv = ({
  allowEnvFallback,
  envEnabled,
  loading = false,
  publishableKey,
}: ClerkEnvRuntimeOptions): ClerkRuntimeValue => {
  const enabled = Boolean(allowEnvFallback && envEnabled && publishableKey);

  return {
    ...DEFAULT_CLERK_RUNTIME,
    enabled,
    loading,
    publishableKey,
    source: enabled ? 'env' : 'disabled',
    environment: resolveClerkEnvironment(publishableKey),
    productionReady: false,
    readyForSessionSync: enabled,
  };
};

export const buildClerkBackendUnavailableRuntime = (
  options: ClerkEnvRuntimeOptions,
): ClerkRuntimeValue => {
  const runtime = buildClerkRuntimeFromEnv(options);

  return {
    ...runtime,
    configurationWarnings: [
      {
        code: 'backend_config_unavailable',
        message: options.allowEnvFallback
          ? 'No se pudo validar el contrato publico de Clerk con el backend. Se usa fallback local de desarrollo.'
          : 'No se pudo validar el contrato publico de Clerk con el backend. Clerk queda deshabilitado en produccion.',
      },
    ],
  };
};
