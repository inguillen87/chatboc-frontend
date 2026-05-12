import { registerSW } from 'virtual:pwa-register';
import { toast } from '@/components/ui/sonner';

declare global {
  interface Window {
    __CHATBOC_IFRAME__?: boolean;
  }
}

let refreshToastId: string | number | undefined;

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
