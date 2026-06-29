import { registerSW } from 'virtual:pwa-register';
import { toast } from '@/components/ui/sonner';

declare global {
  interface Window {
    __CHATBOC_IFRAME__?: boolean;
  }
}

let refreshToastId: string | number | undefined;
let localCleanupStarted = false;

const LOCAL_PREVIEW_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

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

const dismissRefreshToast = () => {
  if (refreshToastId === undefined) {
    return;
  }

  toast.dismiss(refreshToastId);
  refreshToastId = undefined;
};

const shouldAutoApplyPublicRefresh = () => {
  if (typeof window === 'undefined') return false;

  const pathname = window.location.pathname || '/';
  if (PANEL_RUNTIME_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  return PUBLIC_RUNTIME_PREFIXES.some((prefix) =>
    prefix === '/' ? pathname === '/' : pathname.startsWith(prefix),
  );
};

const isLocalPreviewHost = () => {
  if (typeof window === 'undefined') return false;
  return LOCAL_PREVIEW_HOSTS.has(window.location.hostname);
};

const cleanupLocalPwaRuntime = async () => {
  if (localCleanupStarted) return;
  localCleanupStarted = true;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  if (navigator.serviceWorker.controller && !sessionStorage.getItem('chatboc-local-pwa-cleaned')) {
    sessionStorage.setItem('chatboc-local-pwa-cleaned', '1');
    window.location.reload();
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

  if (isLocalPreviewHost()) {
    cleanupLocalPwaRuntime().catch((error) => {
      console.warn('Local PWA cleanup skipped', error);
    });
    return;
  }

  try {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        if (shouldAutoApplyPublicRefresh()) {
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
      },
      onOfflineReady() {
        // Suppress noisy offline messaging in public demo contexts.
      },
    });
  } catch (error) {
    console.warn('PWA registration skipped', error);
  }
};
