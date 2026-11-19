import {
  DEFAULT_CLERK_RUNTIME,
  type ClerkRuntimeValue,
} from '@/components/auth/ClerkRuntimeContext';
import { isDisabilityAIAgentDemoPath } from '@/config/publicPresentationRoutes';
import { STARTUP_CONTINUITY_BUDGET_MS } from '@/utils/backendRequestContinuity';

// Keep the provider pending while the public configuration can still recover.
export const CLERK_RUNTIME_BOOTSTRAP_TIMEOUT_MS = STARTUP_CONTINUITY_BUDGET_MS + 5_000;

interface PublicPreviewPresentationOptions {
  hostname?: string;
  pathname?: string;
  search?: string;
}

// An organization's public home is read by anonymous visitors, often on a
// modest phone and a metered connection. The sign-in runtime is several hundred
// kilobytes that page never uses for them, so it stays out until they leave for
// a page that needs it. A browser that shows any trace of a session keeps the
// normal runtime, and so does every other route.
const ORGANIZATION_PUBLIC_HOME = /^\/t\/[^/]+$/;

export const isOrganizationPublicHomePath = (pathname?: string): boolean =>
  ORGANIZATION_PUBLIC_HOME.test(
    String(pathname || '').trim().toLowerCase().replace(/\/+$/, '') || '/',
  );

interface SessionTraceOptions {
  cookie?: string;
  search?: string;
  storedSession?: boolean;
}

// The sign-in provider leaves these behind once someone has signed in:
// `__client_uat` holds a timestamp ("0" after signing out), and a redirect back
// from it carries `__clerk…` parameters. A session this application stored
// itself counts too.
export const hasSessionTrace = ({ cookie, search, storedSession }: SessionTraceOptions): boolean => {
  if (storedSession) return true;
  if (/(?:^|[?&])__clerk/i.test(String(search || ''))) return true;

  return String(cookie || '').split(';').some((pair) => {
    const separator = pair.indexOf('=');
    const name = (separator < 0 ? pair : pair.slice(0, separator)).trim();
    const value = separator < 0 ? '' : pair.slice(separator + 1).trim();
    if (/^__client_uat(?:_|$)/.test(name)) return value !== '' && value !== '0';
    return /^(?:__session|__clerk_db_jwt)(?:_|$)/.test(name) && value !== '';
  });
};

interface GuestPublicHomeOptions extends SessionTraceOptions {
  pathname?: string;
}

export const isGuestPublicHomePresentation = ({
  pathname,
  ...trace
}: GuestPublicHomeOptions): boolean =>
  isOrganizationPublicHomePath(pathname) && !hasSessionTrace(trace);

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
      message: 'Clerk queda deshabilitado en la presentación pública de Preview.',
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

export const buildGuestPublicHomeRuntime = (
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
      code: 'public_guest_home_presentation',
      message: 'El inicio público de una organización se abre sin el inicio de sesión cargado para visitantes anónimos.',
    },
  ],
});

export const isGuestPublicHomeRuntime = (
  runtime: Pick<ClerkRuntimeValue, 'configurationWarnings'>,
): boolean =>
  Boolean(
    runtime.configurationWarnings?.some(
      (warning) => warning.code === 'public_guest_home_presentation',
    ),
  );

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
}: PublicPreviewExitOptions): boolean => {
  // The light home only needs the reload on the way out, or when the sign-in
  // provider sends the visitor back to it. Arriving with the runtime already
  // loaded keeps it: nothing is gained by dropping it.
  if (isGuestPublicHomeRuntime(runtime)) {
    return (
      !isOrganizationPublicHomePath(location.pathname) ||
      hasSessionTrace({ search: location.search })
    );
  }

  return (
    isPublicClerkBypassRuntime(runtime) !==
    isPublicClerkBypassPresentation(location)
  );
};
