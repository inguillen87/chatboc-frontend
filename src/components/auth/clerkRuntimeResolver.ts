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
