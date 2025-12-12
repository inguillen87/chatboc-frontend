import { registerSW } from 'virtual:pwa-register';
import { toast } from '@/components/ui/sonner';

declare global {
  interface Window {
    __CHATBOC_IFRAME__?: boolean;
  }
}

let refreshToastId: string | number | undefined;

const dismissRefreshToast = () => {
  if (refreshToastId === undefined) {
    return;
  }

  toast.dismiss(refreshToastId);
  refreshToastId = undefined;
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

  const updateSW = registerSW({
    immediate: false,
    onNeedRefresh() {
      if (refreshToastId !== undefined) {
        return;
      }

      refreshToastId = toast('Nueva versión disponible', {
        description: 'Actualizá para recibir las últimas mejoras.',
        action: {
          label: 'Actualizar',
          onClick: () => {
            dismissRefreshToast();
            updateSW();
          },
        },
        cancel: {
          label: 'Después',
          onClick: () => {
            dismissRefreshToast();
          },
        },
      });
    },
    onOfflineReady() {
      // Suppress annoying offline message in demo contexts
      // toast('Listo para usar sin conexión', {
      //   description: 'Guardamos los recursos principales para que sigas trabajando offline.',
      // });
    },
  });
};
