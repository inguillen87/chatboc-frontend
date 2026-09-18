import { useId } from 'react';
import { CheckCircle2, Clock3, Info, RefreshCw, ShieldCheck, WifiOff, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VerifiedPaymentStatus } from '@/utils/verifiedPaymentStatus';
import styles from './OrderVerificationPanel.module.css';

type Props = {
  status: VerifiedPaymentStatus | null;
  isLoading: boolean;
  error: string | null;
  lastCheckedAt: number | null;
  autoRefreshStopped: boolean;
  pauseReason: 'hidden' | 'offline' | null;
  onRefresh: () => void;
};

/** Shows the last verified server state, never a simulated fulfillment timeline. */
export function OrderVerificationPanel(props: Props) {
  const { status, isLoading, error, lastCheckedAt, autoRefreshStopped, pauseReason, onRefresh } = props;
  const titleId = useId();
  const tone = error ? 'error' : pauseReason ? 'info' : status?.tone ?? 'info';
  const Icon = pauseReason === 'offline' ? WifiOff : error || tone === 'error' ? XCircle
    : tone === 'success' ? CheckCircle2 : tone === 'warning' ? Clock3 : Info;
  const title = error ? 'La verificación no se completó' : pauseReason === 'offline' ? 'Sin conexión'
    : !status && isLoading ? 'Consultando el estado del pedido'
    : status?.label ?? 'Estado de pago por verificar';
  const detail = error ? error : pauseReason === 'offline'
    ? 'La consulta se reanudará al recuperar la conexión. No hace falta repetir la compra.'
    : pauseReason === 'hidden' ? 'La consulta está pausada mientras esta pestaña no está visible.'
    : autoRefreshStopped ? 'La consulta automática finalizó. Podés volver a consultar sin repetir la compra.'
    : !status ? 'Esperando la confirmación del servidor.'
    : status.pending ? 'El servidor todavía no confirma la acreditación. Actualizamos este estado automáticamente.'
    : status.tone === 'success' ? 'Acreditación confirmada por el servidor. Preparación y entrega tienen su propio estado.'
    : 'Este es el último estado informado por el servidor. Podés volver a consultarlo.';
  const checkedDate = lastCheckedAt !== null ? new Date(lastCheckedAt) : null;
  return (
    <section className={styles.panel} data-tone={tone} aria-labelledby={titleId}>
      <div className="grid min-w-0 grid-cols-[3rem_minmax(0,1fr)] gap-x-4 gap-y-2">
        <span className={cn(styles.icon, 'row-span-2')} aria-hidden="true"><Icon className="h-6 w-6" /></span>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Estado del pago</p>
          <h2 id={titleId} className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h2>
        <div className="col-span-2 space-y-2 sm:col-span-1 sm:col-start-2">
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{detail}</p>
          {(error || pauseReason) && status ? <p className="text-sm font-medium text-foreground">Último estado confirmado: {status.label}</p> : null}
        </div>
      </div>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{title}. {detail}</p>
      <div className={styles.footer}>
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          {checkedDate ? <span>Última consulta: <time dateTime={checkedDate.toISOString()}>{checkedDate.toLocaleTimeString('es-AR')}</time></span>
            : <span>Aún no hay una verificación completada</span>}
        </div>
        <Button type="button" variant="outline" onClick={onRefresh}
          disabled={isLoading || pauseReason !== null} className={cn('min-h-11 shrink-0', styles.action)}>
          <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && styles.spin)} aria-hidden="true" />
          {isLoading ? 'Verificando…' : pauseReason === 'offline' ? 'Esperando conexión' : 'Volver a consultar'}
        </Button>
      </div>
      {status?.pending ? <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Volver de la pasarela o enviar un comprobante no acredita el pago.</p> : null}
    </section>
  );
}
