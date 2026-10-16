import { useEffect, useState } from 'react';
import type { WhatsappConnectionSummary } from '@/api/v2/channelActivation';

type Props = Pick<WhatsappConnectionSummary, 'configuration_status' | 'expires_at'>;
const MAX_TIMER_DELAY = 2_147_483_647;

const expiryMilliseconds = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value < 253_402_300_800
    ? value * 1000
    : null;

/** Local display of the recorded deadline; it is not a provider availability check. */
export default function MetaCredentialStatus({ configuration_status, expires_at }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const expiry = expiryMilliseconds(expires_at);
  // Read the clock while rendering too: a replacement contract cannot inherit an older clock snapshot.
  const currentTime = Math.max(now, Date.now());
  const expired = configuration_status === 'expired' || (expiry !== null && expiry <= currentTime);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      if (timer !== undefined) clearTimeout(timer);
      const timestamp = Date.now();
      setNow(timestamp);
      if (expiry !== null && expiry > timestamp) {
        timer = setTimeout(refresh, Math.min(expiry - timestamp, MAX_TIMER_DELAY));
      }
    };
    refresh();
    document.addEventListener('visibilitychange', refresh);
    return () => {
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [expiry]);

  const date = expiry === null ? null : new Date(expiry);
  return <div className="space-y-2">
    <p role="status" aria-live="polite">
      {expired
        ? 'La credencial temporal venció. Se conserva la conexión de prueba; requiere renovación.'
        : configuration_status === 'configured'
          ? 'Conexión de prueba configurada. Disponibilidad y entrega actuales pendientes de verificar.'
          : 'La conexión necesita completar su configuración.'}
    </p>
    <p className="text-sm">
      {date ? <>
        {expired ? 'Vencimiento temporal registrado: ' : 'Vigencia temporal registrada hasta '}
        <time dateTime={date.toISOString()}>{date.toLocaleString('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires', hour12: false,
        })}</time>{' (Argentina, UTC−3).'}
      </> : 'Vencimiento temporal sin confirmar.'}
    </p>
    <p className="text-sm text-muted-foreground">La vigencia registrada no confirma disponibilidad ni entrega de Meta.</p>
  </div>;
}
