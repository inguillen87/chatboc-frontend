import {
  DEFAULT_CLERK_RUNTIME,
  type ClerkRuntimeValue,
} from '@/components/auth/ClerkRuntimeContext';
import { isDisabilityAIAgentDemoPath } from '@/config/publicPresentationRoutes';

export const CLERK_RUNTIME_BOOTSTRAP_TIMEOUT_MS = 5_000;

interface PublicPreviewPresentationOptions {
  hostname?: string;
  pathname?: string;
  search?: string;
}

export const isPublicPreviewPresentation = ({
  hostname,
  pathname,
  search,
}: PublicPreviewPresentationOptions): boolean => {
  const normalizedHostname = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  const isPreviewHost =
    normalizedHostname === 'localhost' ||
    normalizedHostname === '127.0.0.1' ||
    normalizedHostname === '::1' ||
    normalizedHostname === 'chatboc-r2-preview.vercel.app';
  if (!isPreviewHost) return false;

  const normalizedPathname = String(pathname || '').trim().toLowerCase().replace(/\/+$/, '') || '/';
  if (normalizedPathname !== '/demo') return false;

  try {
    return new URLSearchParams(String(search || '')).get('remote_preview_qa') === '1';
  } catch {
    return false;
  }
};

export const isPublicClerkBypassPresentation = (
  options: PublicPreviewPresentationOptions,
): boolean =>
  isDisabilityAIAgentDemoPath(options.pathname) || isPublicPreviewPresentation(options);

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

interface ClerkOriginCompatibilityOptions {
  environment?: string;
  hostname?: string;
  publishableKey: string;
}

export const isClerkOriginCompatible = ({
  environment,
  hostname,
  publishableKey,
}: ClerkOriginCompatibilityOptions): boolean => {
  const liveKey = publishableKey.trim().startsWith('pk_live_');
  if (environment !== 'production' && !liveKey) return true;

  const normalizedHostname = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  return normalizedHostname === 'chatboc.ar' || normalizedHostname.endsWith('.chatboc.ar');
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

export const buildPublicPreviewPresentationRuntime = (
  publishableKey: string,
): ClerkRuntimeValue => ({
  ...buildClerkRuntimeFromEnv({
    allowEnvFallback: false,
    envEnabled: false,
    loading: false,
    publishableKey,
  }),
  configurationWarnings: [
    {
      code: 'public_preview_presentation',
      message: 'Clerk queda deshabilitado en la presentacion publica de Preview.',
    },
  ],
});

export const buildPublicClerkBypassRuntime = (
  publishableKey: string,
): ClerkRuntimeValue => ({
  ...buildClerkRuntimeFromEnv({
    allowEnvFallback: false,
    envEnabled: false,
    loading: false,
    publishableKey,
  }),
  configurationWarnings: [
    {
      code: 'public_clerk_bypass_presentation',
      message: 'Clerk queda deshabilitado exclusivamente en esta presentación pública estática.',
    },
  ],
});

export const isPublicPreviewPresentationRuntime = (
  runtime: Pick<ClerkRuntimeValue, 'configurationWarnings'>,
): boolean =>
  Boolean(
    runtime.configurationWarnings?.some(
      (warning) => warning.code === 'public_preview_presentation',
    ),
  );

export const isPublicClerkBypassRuntime = (
  runtime: Pick<ClerkRuntimeValue, 'configurationWarnings'>,
): boolean =>
  Boolean(
    runtime.configurationWarnings?.some(
      (warning) =>
        warning.code === 'public_preview_presentation' ||
        warning.code === 'public_clerk_bypass_presentation',
    ),
  );

interface PublicPreviewExitOptions extends PublicPreviewPresentationOptions {
  runtime: Pick<ClerkRuntimeValue, 'configurationWarnings'>;
}

export const shouldReloadAfterPublicPreviewNavigation = ({
  runtime,
  ...location
}: PublicPreviewExitOptions): boolean =>
  isPublicClerkBypassRuntime(runtime) !==
  isPublicClerkBypassPresentation(location);
