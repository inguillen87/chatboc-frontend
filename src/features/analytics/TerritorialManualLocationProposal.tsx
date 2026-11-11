import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  captureChatbocSessionRevision, isChatbocSessionRevisionCurrent, subscribeChatbocSessionRevision,
} from '@/utils/chatbocSessionRevision';
import { ApiError } from '@/utils/api';
import {
  createTerritorialExecutionIdempotencyKey,
  getTerritorialGeocodingDetail,
  proposeTerritorialManualLocation,
} from './territorialGeocodingApi';
import type { TerritorialManualLocationAction } from './territorialGeocodingTypes';

interface Props {
  tenantSlug: string;
  tenantId: string;
  jobId: string;
  action?: TerritorialManualLocationAction;
  disabled: boolean;
  onAccepted: () => Promise<void>;
}

const parseCoordinate = (input: string, limit: number) => {
  const decimal = input.trim();
  if (!/^[+-]?\d{1,3}(?:[.,]\d{1,10})?$/.test(decimal)) return null;
  const value = Number(decimal.replace(',', '.'));
  return Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
};

type ProposedPoint = { version: number; lat: number; lng: number };

export function TerritorialManualLocationProposal(props: Props) {
  const revision = useSyncExternalStore(
    subscribeChatbocSessionRevision, captureChatbocSessionRevision, captureChatbocSessionRevision,
  );
  const authority = JSON.stringify([revision, props.tenantSlug, props.tenantId, props.jobId]);
  return <ProposalEditor key={authority} {...props} revision={revision} />;
}

function ProposalEditor({ tenantSlug, tenantId, jobId, action, disabled, onAccepted, revision }: Props & { revision: number }) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);
  const operation = useRef<symbol | null>(null);
  const idempotencyKeys = useRef(new Map<string, string>());
  const uncertainPoint = useRef<ProposedPoint | null>(null);
  const focusResult = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<'read' | 'save' | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<'saved' | 'matching' | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current = null;
    };
  }, []);

  const isLive = () => mounted.current && isChatbocSessionRevisionCurrent(revision);
  const authorityFor = (token: symbol) => () => isLive() && operation.current === token;
  const finish = async (result: 'saved' | 'matching', isCurrent: () => boolean) => {
    uncertainPoint.current = null;
    focusResult.current = true;
    setNotice(result);
    setRefreshFailed(false);
    setOpen(false);
    setLatText('');
    setLngText('');
    try {
      await onAccepted();
    } catch {
      if (isCurrent()) setRefreshFailed(true);
    }
  };

  const loadVersion = async () => {
    if (!isLive() || operation.current) return;
    const token = Symbol();
    operation.current = token;
    const isCurrent = authorityFor(token);
    setPending('read');
    setVersion(null);
    setConfirmed(false);
    setMessage('');
    setConflict(false);
    try {
      const detail = await getTerritorialGeocodingDetail(jobId, tenantSlug, isCurrent);
      if (!isCurrent()) return;
      if (detail.tenantId !== tenantId || detail.item.id !== jobId) {
        setMessage('La propuesta manual no está habilitada en la revisión actual de este caso.');
        return;
      }
      const previous = uncertainPoint.current;
      if (previous && detail.proposalVersion && detail.proposalVersion.attemptNumber > previous.version
        && detail.proposal.provenance?.source === 'manual_operator'
        && detail.proposal.lat === previous.lat && detail.proposal.lng === previous.lng) {
        await finish('matching', isCurrent);
        return;
      }
      if (!detail.item.manualLocationAction) {
        setMessage('La propuesta manual no está habilitada en la revisión actual de este caso.');
        return;
      }
      setVersion(detail.item.manualLocationAction.expectedAttemptCount);
    } catch {
      if (isCurrent()) setMessage('No pudimos consultar la revisión del caso. Volvé a intentarlo desde esta ventana.');
    } finally {
      if (isCurrent()) {
        operation.current = null;
        setPending(null);
      }
    }
  };

  const changeOpen = (next: boolean) => {
    if (next) {
      if (!action || disabled || !isLive()) return;
      setNotice(null);
      setOpen(true);
      void loadVersion();
    } else if (pending !== 'save') {
      operation.current = null;
      setOpen(false);
      setPending(null);
      setLatText('');
      setLngText('');
    }
  };

  const lat = parseCoordinate(latText, 90);
  const lng = parseCoordinate(lngText, 180);
  const canSubmit = Boolean(action) && version !== null && lat !== null && lng !== null
    && confirmed && !pending && !conflict && !disabled;

  const submit = async () => {
    if (!canSubmit || version === null || lat === null || lng === null || operation.current || !isLive()) return;
    const token = Symbol();
    operation.current = token;
    const isCurrent = authorityFor(token);
    const identity = JSON.stringify([version, lat, lng]);
    const key = idempotencyKeys.current.get(identity) ?? createTerritorialExecutionIdempotencyKey('manual-location', jobId);
    idempotencyKeys.current.set(identity, key);
    setPending('save');
    setMessage('');
    try {
      await proposeTerritorialManualLocation({
        tenantSlug, tenantId, jobId, lat, lng, expectedAttemptCount: version, confirmed: true,
        idempotencyKey: key, isCurrent,
      });
      if (!isCurrent()) return;
      await finish('saved', isCurrent);
    } catch (error) {
      if (!isCurrent()) return;
      const status = error instanceof ApiError ? error.status : null;
      const reason = error instanceof ApiError ? error.body?.reason_code : null;
      const outside = reason === 'geocoding_proposal_outside_official_polygon';
      const missingBoundary = reason === 'geocoding_official_polygon_required';
      const changed = !outside && !missingBoundary && (status === 409 || status === 412);
      setConflict(changed);
      if (outside) {
        setConfirmed(false);
        setMessage('El punto está fuera del límite oficial. Verificá las coordenadas antes de volver a confirmar.');
      } else if (missingBoundary) {
        setConflict(true);
        setMessage('La organización necesita un límite territorial oficial verificado para recibir propuestas.');
      } else if (status === 401 || status === 403) {
        setConflict(true);
        setMessage('La sesión actual no tiene acceso a la propuesta. Volvé a consultar antes de enviar.');
      } else if (changed) {
        setMessage('El caso cambió. Volvé a consultar la revisión y confirmá la propuesta con los datos actualizados.');
      } else {
        if (status === null || status >= 500) uncertainPoint.current = { version, lat, lng };
        setMessage('No pudimos confirmar la propuesta. Los datos siguen en el formulario. Podés reintentar el mismo envío o consultar el estado.');
      }
    } finally {
      if (isCurrent()) {
        operation.current = null;
        setPending(null);
      }
    }
  };

  if (!action && !open && !notice) return null;

  return (
    <div className="mt-3 border-t pt-3">
      <Dialog open={open} onOpenChange={changeOpen}>
        {action ? (
          <DialogTrigger asChild>
            <Button ref={trigger} type="button" variant="outline" size="sm" disabled={disabled || pending === 'save'}>
              Proponer punto manual
            </Button>
          </DialogTrigger>
        ) : null}
        <DialogContent onCloseAutoFocus={(event) => {
          const target = focusResult.current || !trigger.current
            ? document.getElementById('territorial-admin-detail-title')
            : trigger.current;
          if (target?.isConnected) {
            event.preventDefault();
            target.focus();
          }
          focusResult.current = false;
        }}>
          <DialogHeader>
            <DialogTitle>Proponer punto manual</DialogTitle>
            <DialogDescription>
              <span id={id + '-help'}>
                Copiá la latitud y longitud en WGS84 desde un mapa oficial. La propuesta queda pendiente de revisión
                y no cambia la ubicación del reclamo. Usá hasta 10 decimales, con coma o punto.
              </span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <fieldset disabled={pending === 'save'} className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor={id + '-lat'} className="text-sm font-medium">Latitud</label>
                <input
                  id={id + '-lat'} type="text" inputMode="decimal" autoComplete="off"
                  placeholder="-54,8" value={latText}
                  aria-describedby={id + '-help' + (latText && lat === null ? ' ' + id + '-lat-error' : '')}
                  aria-invalid={Boolean(latText && lat === null)}
                  className="min-h-11 rounded-md border bg-background px-3 py-2 text-base"
                  onChange={(event) => { setLatText(event.currentTarget.value); setConfirmed(false); }}
                />
                {latText && lat === null ? <p id={id + '-lat-error'} className="text-sm text-destructive">Ingresá un decimal entre −90 y 90, con hasta 10 decimales.</p> : null}
              </div>
              <div className="grid gap-1.5">
                <label htmlFor={id + '-lng'} className="text-sm font-medium">Longitud</label>
                <input
                  id={id + '-lng'} type="text" inputMode="decimal" autoComplete="off"
                  placeholder="-68,3" value={lngText}
                  aria-describedby={id + '-help' + (lngText && lng === null ? ' ' + id + '-lng-error' : '')}
                  aria-invalid={Boolean(lngText && lng === null)}
                  className="min-h-11 rounded-md border bg-background px-3 py-2 text-base"
                  onChange={(event) => { setLngText(event.currentTarget.value); setConfirmed(false); }}
                />
                {lngText && lng === null ? <p id={id + '-lng-error'} className="text-sm text-destructive">Ingresá un decimal entre −180 y 180, con hasta 10 decimales.</p> : null}
              </div>
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox" className="mt-0.5 size-4 shrink-0" checked={confirmed}
                  disabled={lat === null || lng === null || version === null || conflict}
                  onChange={(event) => setConfirmed(event.currentTarget.checked)}
                />
                Confirmo que quiero enviar este punto a revisión.
              </label>
            </fieldset>
            {pending === 'read' ? <p role="status" className="mt-3 text-sm">Consultando la revisión actual…</p> : null}
            {message ? <p role="alert" className="mt-3 text-sm text-destructive">{message}</p> : null}
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" disabled={pending === 'save'} onClick={() => changeOpen(false)}>
                Cancelar
              </Button>
              {message ? (
                <Button type="button" variant="outline" disabled={Boolean(pending)} onClick={() => void loadVersion()}>
                  Volver a consultar
                </Button>
              ) : null}
              <Button type="submit" disabled={!canSubmit}>
                {pending === 'save' ? 'Enviando propuesta…' : 'Enviar propuesta a revisión'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {notice ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          {notice === 'saved' ? 'Propuesta manual guardada para revisión.'
            : 'El detalle actual ya muestra una propuesta manual con ese punto. Revisá su estado.'}
          {refreshFailed ? ' Actualizá el detalle para ver la propuesta.' : ''}
        </p>
      ) : null}
    </div>
  );
}
