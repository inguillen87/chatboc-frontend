import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MetaCredentialClientError, metaCredentialApi, metaCredentialsInstalled,
  type MetaConnectionInspection, type MetaCredentialStatus,
} from '@/features/metaCredentials/metaCredentialApi';

type Props = { statuses: MetaCredentialStatus[]; blocked: boolean; scopeKey: string | null };

const failureMessage = (error: unknown): string => {
  const code = error instanceof MetaCredentialClientError ? error.reasonCode : '';
  if (['meta_operation_authentication_required', 'meta_operation_clerk_session_required',
    'meta_operation_session_revoked'].includes(code)) return 'La sesión dejó de estar vigente. Volvé a ingresar para verificar la conexión.';
  if (['meta_credential_expired_or_invalid', 'meta_token_authority_expired',
    'meta_inspection_credentials_required'].includes(code)) return 'La credencial ya no está vigente. Actualizá su estado antes de consultar.';
  if (code === 'meta_operation_rate_limited') return 'Esperá antes de volver a verificar la conexión.';
  return 'No se pudo verificar la conexión. No hay una confirmación nueva; podés volver a consultar.';
};

export default function MetaConnectionCheck({ statuses, blocked, scopeKey }: Props) {
  const [clockTick, refreshClock] = useState(0);
  const [result, setResult] = useState<{ key: string; value: MetaConnectionInspection } | null>(null);
  const [checking, setChecking] = useState(false);
  const [expired, setExpired] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const pending = useRef<AbortController | null>(null);
  const installed = metaCredentialsInstalled(statuses);
  const key = installed && scopeKey && !blocked ? JSON.stringify([scopeKey,
    statuses.map(status => [status.target, status.tenantId, status.environment, status.appId,
      status.wabaId, status.phoneNumberId, status.phoneNumber, status.currentRevision, status.expiresAt])]) : null;
  const activeKey = useRef(key);
  activeKey.current = key;

  useEffect(() => {
    activeKey.current = key;
    pending.current?.abort(); pending.current = null;
    setChecking(false); setResult(null); setError(null); setExpired(null);
    return () => { activeKey.current = null; pending.current?.abort(); pending.current = null; };
  }, [key]);

  useEffect(() => {
    const update = () => {
      if (result && result.value.validUntil <= Math.floor(Date.now() / 1000)) {
        setResult(null); setExpired(result.key);
      }
      refreshClock(value => value + 1);
    };
    const now = Date.now();
    const deadlines = [...statuses.map(status => status.expiresAt), result?.value.validUntil]
      .filter((value): value is number => typeof value === 'number' && value * 1000 > now);
    const timer = deadlines.length ? window.setTimeout(update, Math.min(Math.min(...deadlines) * 1000 - now, 2_147_483_647)) : undefined;
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [statuses, result, clockTick]);

  const verify = async () => {
    if (!key || pending.current || blocked || !metaCredentialsInstalled(statuses)) return;
    const controller = new AbortController();
    pending.current = controller;
    const isCurrent = () => pending.current === controller && activeKey.current === key &&
      !controller.signal.aborted && metaCredentialsInstalled(statuses);
    setChecking(true); setResult(null); setError(null); setExpired(null);
    try {
      const next = await metaCredentialApi.inspectConnection(statuses, { isCurrent, signal: controller.signal });
      if (isCurrent() && next.validUntil > Math.floor(Date.now() / 1000)) setResult({ key, value: next });
    } catch (failure) {
      if (isCurrent()) setError({ key, message: failureMessage(failure) });
    } finally {
      if (pending.current === controller) { pending.current = null; setChecking(false); }
    }
  };

  if (!installed) return null;
  const currentResult = key && result?.key === key && result.value.validUntil > Math.floor(Date.now() / 1000) ? result.value : null;
  return <section aria-labelledby="meta-connection-check-heading" className="space-y-3 rounded-lg border p-4">
    <h2 id="meta-connection-check-heading" className="font-semibold">Conexión con WhatsApp</h2>
    <p className="text-sm text-muted-foreground">Consultá el acceso a Meta con las credenciales guardadas.</p>
    <Button type="button" variant="outline" disabled={blocked || checking || !key} onClick={() => void verify()}>
      {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
      {checking ? 'Verificando conexión…' : 'Verificar conexión'}
    </Button>
    {currentResult && <div role="status" className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
      <h3 className="font-medium">Verificación parcial</h3>
      <p>Meta confirmó el acceso de ambos destinos. La activación de WhatsApp sigue pendiente.</p>
      <ul className="list-inside list-disc">
        {statuses.map(status => <li key={status.target}>{status.label}: acceso confirmado.</li>)}
      </ul>
      <p>{currentResult.controlIdentified ? 'Número de control identificado.' : 'No se pudo identificar el número de control.'}</p>
      {currentResult.configurationIncomplete && <p>No se pudo comprobar toda la configuración de recepción.</p>}
      <p className="text-xs">Consulta: {new Date(currentResult.checkedAt * 1000).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' })}</p>
    </div>}
    {expired && expired === key && <p role="status" className="text-sm text-muted-foreground">La verificación venció. Volvé a consultar para obtener un estado vigente.</p>}
    {error && error.key === key && <p role="alert" className="text-sm">{error.message}</p>}
  </section>;
}
