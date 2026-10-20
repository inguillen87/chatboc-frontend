import * as React from 'react';
import { notifyPwaRefreshRendererReady } from '@/pwa';

type SonnerModule = typeof import('sonner');

let sonnerModulePromise: Promise<SonnerModule> | null = null;
let sonnerModule: SonnerModule | null = null;

const loadSonner = () => {
  if (sonnerModule) {
    return Promise.resolve(sonnerModule);
  }
  if (!sonnerModulePromise) {
    sonnerModulePromise = import('sonner').then((mod) => {
      sonnerModule = mod;
      return mod;
    });
  }
  return sonnerModulePromise;
};

const LazyToaster = React.lazy(async () => {
  const mod = await loadSonner();
  const NotificationRenderer = React.forwardRef<
    React.ElementRef<typeof mod.Toaster>,
    React.ComponentPropsWithoutRef<typeof mod.Toaster>
  >((props, ref) => {
    React.useEffect(() => {
      notifyPwaRefreshRendererReady();
    }, []);
    return <mod.Toaster ref={ref} {...props} />;
  });
  NotificationRenderer.displayName = 'NotificationRenderer';
  return { default: NotificationRenderer };
});

type ToasterProps = React.ComponentProps<typeof LazyToaster>;

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = 'light';

  return (
    <React.Suspense fallback={null}>
      <LazyToaster
        theme={theme as ToasterProps['theme']}
        className="toaster group"
        toastOptions={{
          classNames: {
            toast:
              'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
            description: 'group-[.toast]:text-muted-foreground',
            actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
            cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          },
        }}
        {...props}
      />
    </React.Suspense>
  );
};

const toast = (...args: Parameters<SonnerModule['toast']>) => {
  if (sonnerModule) {
    return sonnerModule.toast(...args);
  }

  loadSonner().catch((error) => {
    console.warn('[toast] No se pudo cargar el módulo de notificaciones', error);
  });

  return undefined;
};

export { Toaster, toast };
