import type React from 'react';
import { AlertTriangle, Ban, CloudOff, DatabaseZap, Inbox, Loader2, Layers } from 'lucide-react';

import { cn } from '@/lib/utils';

type AppViewStatus = 'loading' | 'empty' | 'error' | 'denied' | 'offline' | 'stale' | 'partial';

interface ViewStateProps {
  status: AppViewStatus;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

const STATUS_META: Record<AppViewStatus, { icon: React.ComponentType<{ className?: string }>; defaultTitle: string }> = {
  loading: { icon: Loader2, defaultTitle: 'Cargando' },
  empty: { icon: Inbox, defaultTitle: 'Sin resultados' },
  error: { icon: AlertTriangle, defaultTitle: 'No pudimos cargar los datos' },
  denied: { icon: Ban, defaultTitle: 'Acceso denegado' },
  offline: { icon: CloudOff, defaultTitle: 'Sin conexión' },
  stale: { icon: DatabaseZap, defaultTitle: 'Mostrando datos previos' },
  partial: { icon: Layers, defaultTitle: 'Contenido parcial disponible' },
};

export function ViewState({ status, title, description, action, className }: ViewStateProps) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <section className={cn('flex min-h-[220px] flex-col items-center justify-center rounded-lg border bg-muted/20 p-6 text-center', className)}>
      <Icon className={cn('mb-3 h-7 w-7 text-muted-foreground', status === 'loading' && 'animate-spin')} />
      <h2 className="text-base font-semibold">{title ?? meta.defaultTitle}</h2>
      {description ? <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

export type { AppViewStatus };
