import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';

declare global {
  interface Window {
    __CHATBOC_IFRAME__?: boolean;
  }
}

let refreshToastId: string | number | undefined;
let ephemeralCleanupStarted = false;
let pwaSetupStarted = false;
let registrationErrorCount = 0;
let registrationRetryTimer: number | undefined;

const REGISTRATION_RETRY_DELAYS_MS = [1_000, 5_000];
const PRIVACY_PWA_CONTRACT_CACHE = 'chatboc-pwa-contract-api-network-only-v1';
const LEGACY_SENSITIVE_API_CACHES = ['app-api', 'public-api', 'public-demo-api'];

const LOCAL_PREVIEW_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const CHATBOC_CACHE_PREFIXES = [
  'workbox-precache',
  'chatboc-assets-',
  'chatboc-shell-',
  'chatboc-pwa-contract-',
  'public-api',
  'public-demo-api',
  'app-api',
];

const PUBLIC_RUNTIME_PREFIXES = [
  '/',
  '/demo',
  '/pymes',
  '/municipios',
  '/colegios',
  '/sectores',
  '/precios',
  '/casos',
  '/opinar',
  '/encuestas',
  '/e/',
  '/login',
  '/register',
  '/widget',
];

const PANEL_RUNTIME_PREFIXES = [
  '/t/',
  '/tenant/',
  '/admin',
  '/dashboard',
  '/portal',
  '/integracion',
];

// `/perfil` is the authenticated shell entry point but does not contain a
// long-lived unsaved operation on initial load. Applying a waiting worker here
// prevents an old lazy-chunk graph from breaking deep links after a release.
const SAFE_AUTHENTICATED_REFRESH_PREFIXES = ['/perfil'];

const dismissRefreshToast = () => {
  if (refreshToastId === undefined) {
    return;
  }

  toast.dismiss(refreshToastId);
  refreshToastId = undefined;
};

export const shouldAutoApplyPublicRefresh = () => {
  if (typeof window === 'undefined') return false;

  const pathname = window.location.pathname || '/';
  if (PANEL_RUNTIME_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  if (SAFE_AUTHENTICATED_REFRESH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return true;
  }

  return PUBLIC_RUNTIME_PREFIXES.some((prefix) =>
    prefix === '/' ? pathname === '/' : pathname.startsWith(prefix),
  );
};

const isLocalPreviewHost = () => {
  if (typeof window === 'undefined') return false;
  return LOCAL_PREVIEW_HOSTS.has(window.location.hostname);
};

const isLocalPwaLifecycleVerification = () => {
  if (typeof window === 'undefined' || !isLocalPreviewHost()) return false;

  const params = new URLSearchParams(window.location.search);
  const hashQuery = window.location.hash.includes('?')
    ? window.location.hash.slice(window.location.hash.indexOf('?') + 1)
    : '';
  const hashParams = new URLSearchParams(hashQuery);
  const hasVerificationFlag = (name: string) => params.has(name) || hashParams.has(name);

  return (
    hasVerificationFlag('pwa-lifecycle-e2e') ||
    hasVerificationFlag('pwa-offline') ||
    hasVerificationFlag('pwa-privacy-upgrade')
  );
};

export const shouldDisablePwaForHost = (hostname?: string | null) => {
  const normalized = String(hostname || '').trim().toLowerCase();
  return LOCAL_PREVIEW_HOSTS.has(normalized) || normalized.endsWith('.vercel.app');
};

const cleanupEphemeralPwaRuntime = async () => {
  if (ephemeralCleanupStarted) return;
  ephemeralCleanupStarted = true;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations
      .filter(isChatbocRegistration)
      .map((registration) => registration.unregister()),
  );

  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => CHATBOC_CACHE_PREFIXES.some((prefix) => cacheName.startsWith(prefix)))
        .map((cacheName) => caches.delete(cacheName)),
    );
  }

  if (navigator.serviceWorker.controller && !sessionStorage.getItem('chatboc-ephemeral-pwa-cleaned')) {
    sessionStorage.setItem('chatboc-ephemeral-pwa-cleaned', '1');
    window.location.reload();
  }
};

const workerScriptUrl = (registration: ServiceWorkerRegistration) =>
  registration.installing?.scriptURL ||
  registration.waiting?.scriptURL ||
  registration.active?.scriptURL ||
  '';

const isChatbocRegistration = (registration: ServiceWorkerRegistration) => {
  try {
    const rawScriptUrl = workerScriptUrl(registration);
    if (!rawScriptUrl) {
      return registration.scope === new URL('/', window.location.origin).href;
    }

    const scriptUrl = new URL(rawScriptUrl);
    return scriptUrl.origin === window.location.origin && scriptUrl.pathname === '/sw.js';
  } catch {
    return false;
  }
};

const clearRegistrationRetryState = () => {
  registrationErrorCount = 0;
  if (registrationRetryTimer !== undefined) {
    window.clearTimeout(registrationRetryTimer);
    registrationRetryTimer = undefined;
  }
};

const removeLegacySensitiveApiCaches = async () => {
  if (!('caches' in window)) return;
  await Promise.all(LEGACY_SENSITIVE_API_CACHES.map((cacheName) => caches.delete(cacheName)));
};

const requiresMandatoryPrivacyUpgrade = async () => {
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration?.active) return false;

  // The marker is written only after the NetworkOnly worker activates and
  // verifies that the legacy URL-keyed API caches are gone. A missing marker
  // identifies the one-time upgrade from the unsafe legacy contract.
  if (!('caches' in window)) return true;
  return !(await caches.has(PRIVACY_PWA_CONTRACT_CACHE));
};

const monitorRegistrationHealth = (
  registration: ServiceWorkerRegistration,
  scheduleRetry: () => void,
) => {
  let observedWorker: ServiceWorker | null = null;

  const observeWorker = (worker: ServiceWorker | null) => {
    if (!worker || worker === observedWorker) return;
    observedWorker = worker;

    worker.addEventListener('statechange', () => {
      if (worker.state === 'activated') {
        clearRegistrationRetryState();
        return;
      }

      // A redundant initial worker is a definitive install failure. Retry the
      // registration, but never unregister a worker merely because a slow
      // network keeps it in `installing` for a long time.
      if (worker.state === 'redundant' && !registration.active) {
        scheduleRetry();
      }
    });
  };

  if (registration.active) clearRegistrationRetryState();
  observeWorker(registration.installing);
  registration.addEventListener('updatefound', () => observeWorker(registration.installing));

  navigator.serviceWorker.ready
    .then(clearRegistrationRetryState)
    .catch((error) => {
      console.warn('PWA readiness check failed', error);
    });
};

const registerPwaWorker = () => {
  const scheduleRetry = () => {
    if (registrationRetryTimer !== undefined) return;
    const delay = REGISTRATION_RETRY_DELAYS_MS[registrationErrorCount];
    if (delay === undefined) return;

    registrationErrorCount += 1;
    registrationRetryTimer = window.setTimeout(() => {
      registrationRetryTimer = undefined;
      registerPwaWorker();
    }, delay);
  };

  try {
    const updateSW = registerSW({
      immediate: true,
      onRegistered(registration) {
        if (!registration) {
          scheduleRetry();
          return;
        }
        monitorRegistrationHealth(registration, scheduleRetry);
      },
      onRegisterError(error) {
        console.warn('PWA registration failed', error);
        scheduleRetry();
      },
      onNeedRefresh() {
        requiresMandatoryPrivacyUpgrade()
          .then((mandatoryUpgrade) => {
            if (mandatoryUpgrade || shouldAutoApplyPublicRefresh()) {
              updateSW(true);
              return;
            }

            if (refreshToastId !== undefined) {
              return;
            }

            refreshToastId = toast('Nueva version disponible', {
              description: 'Actualiza para recibir las ultimas mejoras.',
              action: {
                label: 'Actualizar',
                onClick: () => {
                  dismissRefreshToast();
                  updateSW(true);
                },
              },
              cancel: {
                label: 'Despues',
                onClick: () => {
                  dismissRefreshToast();
                },
              },
            });
          })
          // Fail closed for this privacy migration. This can auto-apply one
          // update if Cache Storage is unavailable, never unregister workers.
          .catch(() => updateSW(true));
      },
      onOfflineReady() {
        // The status bar owns connectivity messaging; avoid duplicate toasts.
      },
    });
  } catch (error) {
    console.warn('PWA registration failed', error);
    scheduleRetry();
  }
};

export const setupPWA = () => {
  if (typeof window === 'undefined') {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (window.__CHATBOC_IFRAME__) {
    return;
  }

  // Vercel aliases are release-verification surfaces, not installable PWA
  // origins. A worker registered on a stable Preview alias can combine a
  // cached HTML shell from release A with immutable chunks from release B.
  // Keep PWA support on production/custom domains and make Preview deterministic.
  const allowLocalLifecycleVerification = import.meta.env.PROD && isLocalPwaLifecycleVerification();
  if (
    !allowLocalLifecycleVerification &&
    ((import.meta.env.DEV && isLocalPreviewHost()) || shouldDisablePwaForHost(window.location.hostname))
  ) {
    cleanupEphemeralPwaRuntime().catch((error) => {
      console.warn('Ephemeral PWA cleanup skipped', error);
    });
    return;
  }

  if (pwaSetupStarted) return;
  pwaSetupStarted = true;
  removeLegacySensitiveApiCaches().catch((error) => {
    console.warn('Legacy PWA API cache cleanup failed', error);
  });
  registerPwaWorker();
};
