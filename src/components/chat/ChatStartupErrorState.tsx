import React, {useId} from 'react';
import {Button} from '@/components/ui/button';
import {ApiError} from '@/utils/api';

export interface ChatStartupFailure {
  title: string;
  message: string;
  status?: number;
  requestId?: string;
}

/** Infrastructure recovery copy, independent of tenant/business conversation. */
export function describeChatStartupFailure(error: unknown): ChatStartupFailure {
  const fallback = {
    title: 'No pudimos iniciar el asistente',
    message: 'No pudimos cargar la información para iniciar el asistente. Podés volver a intentarlo.',
  };
  if (!(error instanceof ApiError)) return fallback;
  const bodyId = error.body && typeof error.body === 'object' ? error.body.request_id : undefined;
  const rawId = error.requestId ?? bodyId;
  const diagnostics = {
    status: error.status,
    requestId: typeof rawId === 'string' && rawId.trim() ? rawId.trim() : undefined,
  };
  if (error.status === 503) return {
    title: 'El asistente no está disponible por el momento',
    message: 'El servicio no está disponible temporalmente. Podés intentar nuevamente más tarde.',
    ...diagnostics,
  };
  if (error.status >= 500) return {
    title: fallback.title,
    message: 'Ocurrió un problema en el servidor. Podés intentar nuevamente más tarde.',
    ...diagnostics,
  };
  return {...fallback, ...diagnostics};
}

export default function ChatStartupErrorState({failure, pending, onRetry}: {
  failure: ChatStartupFailure;
  pending: boolean;
  onRetry: () => void;
}) {
  const id = useId();
  return (
    <section className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4 text-left text-card-foreground">
      <div role="alert" aria-labelledby={`${id}-title`} className="space-y-2">
        <h3 id={`${id}-title`} className="text-base font-semibold leading-6">{failure.title}</h3>
        <p className="text-sm leading-6">{failure.message}</p>
      </div>
      {failure.status !== undefined || failure.requestId ? (
        <details className="min-w-0 text-sm">
          <summary className="min-h-11 cursor-pointer rounded-md py-3 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            Detalles técnicos
          </summary>
          <div className="min-w-0 space-y-2 pb-2 leading-6">
            {failure.status !== undefined ? <p>Código HTTP: {failure.status}</p> : null}
            {failure.requestId ? (
              <p>Referencia de soporte: <code className="select-text break-all font-mono text-xs">{failure.requestId}</code></p>
            ) : null}
          </div>
        </details>
      ) : null}
      <Button type="button" className="min-h-11 w-full" aria-disabled={pending} aria-busy={pending}
        onClick={() => {if (!pending) onRetry();}}>
        {pending ? 'Comprobando disponibilidad…' : 'Reintentar'}
      </Button>
      {pending ? <p role="status" className="text-sm leading-6">Comprobando disponibilidad. Esperá un momento.</p> : null}
    </section>
  );
}
