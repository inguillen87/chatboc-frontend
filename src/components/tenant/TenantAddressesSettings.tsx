import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  PLATFORM_SUFFIX, TenantAddressesUnavailableError, addressUnavailableReason, getTenantAddresses,
  normalizeAddressDraft, saveTenantAddress, tenantAddressesErrorMessage,
  type AddressKind, type AddressOperation, type AddressSlot, type AddressSlotCapabilities,
  type AddressTenantScope, type TenantAddresses,
} from '@/api/tenantAddresses';
import { TenantDomainSettings } from '@/components/tenant/TenantDomainSettings';
import { ApiError } from '@/utils/api';

const SLOT_COPY: Record<AddressKind, {
  title: string; inputLabel: string; hint: string; placeholder: string; invalid: string;
  statuses: Record<AddressSlot['status'], string>;
}> = {
  platform: {
    title: 'Subdominio',
    inputLabel: 'Nombre del subdominio',
    hint: 'Entre 3 y 40 caracteres: letras, números y guiones.',
    placeholder: 'tu-organizacion',
    invalid: 'Usá entre 3 y 40 letras, números o guiones, sin empezar ni terminar con guion.',
    statuses: {
      unconfigured: 'Sin configurar',
      pending_dns: 'En verificación',
      pending_platform: 'Solicitado · falta publicarlo',
      active: 'Activo',
      revoked: 'Desvinculado',
      verification_expired: 'Verificación vencida',
      suspended: 'Suspendido',
    },
  },
  custom: {
    title: 'Dominio propio',
    inputLabel: 'Dominio completo',
    hint: 'Sin https://, puerto ni ruta. La propiedad se comprueba con un registro TXT.',
    placeholder: 'atencion.tu-organizacion.gob.ar',
    invalid: 'Ingresá sólo el dominio completo, sin https://, puerto ni ruta.',
    statuses: {
      unconfigured: 'Sin configurar',
      pending_dns: 'Falta verificar el DNS',
      pending_platform: 'DNS confirmado · falta publicación y HTTPS',
      active: 'Activo',
      revoked: 'Desvinculado',
      verification_expired: 'Verificación vencida',
      suspended: 'Suspendido',
    },
  },
};

const PENDING_STATUSES: ReadonlyArray<AddressSlot['status']> = ['pending_dns', 'pending_platform'];

type ViewState =
  | { phase: 'loading'; addresses: TenantAddresses | null }
  | { phase: 'ready'; addresses: TenantAddresses }
  | { phase: 'error'; addresses: TenantAddresses | null; message: string }
  | { phase: 'legacy' };

function StatusLabel({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${active ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />
      {children}
    </span>
  );
}

function CopyButton({ value, label, disabled }: { value: string; label: string; disabled?: boolean }) {
  const [outcome, setOutcome] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setOutcome('copied');
    } catch {
      setOutcome('failed');
    }
  };
  return (
    <>
      <Button type="button" variant="outline" className="min-h-11" disabled={disabled} onClick={() => void copy()}>
        {label}
      </Button>
      <span role="status" className="text-sm text-muted-foreground">
        {outcome === 'copied' ? 'Copiado.' : outcome === 'failed' ? 'No pudimos copiarlo. Seleccioná el texto y copialo a mano.' : ''}
      </span>
    </>
  );
}

interface SlotSectionProps {
  slot: AddressSlot;
  capabilities: AddressSlotCapabilities;
  canManage: boolean;
  writesBlocked: boolean;
  busy: boolean;
  onRun: (kind: AddressKind, operation: AddressOperation, draft?: string) => Promise<boolean>;
}

function SlotSection({ slot, capabilities, canManage, writesBlocked, busy, onRun }: SlotSectionProps) {
  const copy = SLOT_COPY[slot.kind];
  const headingId = useId(), inputId = useId(), hintId = useId(), errorId = useId();
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const locked = busy || writesBlocked;
  const occupied = slot.active || PENDING_STATUSES.includes(slot.status);
  const showForm = canManage && capabilities.can_request && !occupied;
  const showUnavailable = canManage && !occupied && !capabilities.can_request;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!normalizeAddressDraft(slot.kind, draft)) {
      setDraftError(copy.invalid);
      return;
    }
    setDraftError(null);
    if (await onRun(slot.kind, 'request', draft)) setDraft('');
  };

  return (
    <section aria-labelledby={headingId} className="space-y-3 border-t pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={headingId} className="text-base font-semibold">{copy.title}</h3>
        <StatusLabel active={slot.active}>{copy.statuses[slot.status]}</StatusLabel>
      </div>

      {slot.host ? <p className="break-all font-mono text-sm">{slot.host}</p> : null}
      <p className="text-sm text-muted-foreground">{slot.scope_note}</p>

      {slot.active && slot.host ? (
        <a className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4" href={`https://${slot.host}/`} target="_blank" rel="noopener noreferrer">
          Abrir {slot.host}
        </a>
      ) : null}

      {slot.status === 'pending_platform' ? (
        <p className="text-sm">
          La solicitud quedó registrada. La dirección empieza a funcionar cuando el equipo de la plataforma la publica y se verifica el acceso seguro (HTTPS).
        </p>
      ) : null}

      {slot.dns_proof ? (
        <div className="space-y-3 rounded-lg border p-4">
          {slot.status === 'pending_dns' ? <p className="text-sm">Agregá este registro en el DNS del dominio:</p> : null}
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Tipo</dt><dd>TXT</dd>
            <dt className="text-muted-foreground">Nombre</dt><dd className="select-text break-all font-mono">{slot.dns_proof.name}</dd>
            <dt className="text-muted-foreground">Valor</dt><dd className="select-text break-all font-mono">{slot.dns_proof.value}</dd>
          </dl>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton value={slot.dns_proof.value} label="Copiar valor" disabled={busy} />
            {canManage && capabilities.can_verify_dns ? (
              <Button type="button" className="min-h-11" disabled={locked} onClick={() => void onRun(slot.kind, 'verify_dns')}>
                Comprobar registro
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showForm ? (
        <form className="space-y-2" noValidate onSubmit={event => void submit(event)}>
          <Label htmlFor={inputId}>{copy.inputLabel}</Label>
          <div className="flex items-stretch">
            <Input
              id={inputId}
              className={`min-h-11 ${slot.kind === 'platform' ? 'rounded-r-none' : ''}`}
              autoComplete="off" autoCapitalize="none" spellCheck={false}
              placeholder={copy.placeholder}
              aria-describedby={draftError ? `${hintId} ${errorId}` : hintId}
              aria-invalid={draftError ? true : undefined}
              value={draft}
              disabled={locked}
              onChange={event => { setDraft(event.target.value); setDraftError(null); }}
            />
            {slot.kind === 'platform' ? (
              <span className="inline-flex items-center rounded-r-md border border-l-0 bg-muted px-3 text-sm text-muted-foreground">{PLATFORM_SUFFIX}</span>
            ) : null}
          </div>
          <p id={hintId} className="text-sm text-muted-foreground">{copy.hint}</p>
          {draftError ? <p id={errorId} role="alert" className="text-sm text-destructive">{draftError}</p> : null}
          <Button type="submit" className="min-h-11" disabled={locked || !draft.trim()}>
            {slot.kind === 'platform' ? 'Solicitar subdominio' : 'Solicitar verificación'}
          </Button>
        </form>
      ) : null}

      {showUnavailable ? <p className="text-sm text-muted-foreground">{addressUnavailableReason(capabilities)}</p> : null}

      {canManage && capabilities.can_revoke && slot.host ? (
        <>
          <Button type="button" variant="outline" className="min-h-11" disabled={locked} onClick={() => setConfirmRevoke(true)}>
            Desvincular
          </Button>
          <AlertDialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Desvincular {slot.host}</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta dirección va a dejar de abrir la organización. No se borran datos ni se modifica el DNS en tu proveedor.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction disabled={locked} onClick={() => void onRun(slot.kind, 'revoke')}>
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </section>
  );
}

/**
 * Las tres direcciones de una organización: el enlace base, un subdominio de la
 * plataforma y un dominio propio. Qué se muestra y qué se puede pedir lo decide
 * el servidor. Si el servidor todavía no ofrece este contrato, se muestra la
 * configuración anterior (sólo dominio propio).
 */
export function TenantAddressesSettings({ tenant, scopeKey }: { tenant: AddressTenantScope; scopeKey: string }) {
  const requestKey = JSON.stringify([scopeKey, tenant.id, tenant.slug]);
  const activeKey = useRef(requestKey);
  activeKey.current = requestKey;
  const inFlight = useRef(false);
  const [view, setView] = useState<ViewState>({ phase: 'loading', addresses: null });

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const initiating = requestKey;
    const isCurrent = () => activeKey.current === initiating;
    setView(previous => ({ phase: 'loading', addresses: 'addresses' in previous ? previous.addresses : null }));
    try {
      const addresses = await getTenantAddresses(tenant, isCurrent);
      if (isCurrent()) setView({ phase: 'ready', addresses });
    } catch (error) {
      if (!isCurrent()) return;
      if (error instanceof TenantAddressesUnavailableError) {
        setView({ phase: 'legacy' });
      } else {
        // Un rechazo de acceso retira lo que se había mostrado antes.
        const denied = error instanceof ApiError && [401, 403].includes(error.status);
        setView(previous => ({
          phase: 'error',
          addresses: denied || !('addresses' in previous) ? null : previous.addresses,
          message: tenantAddressesErrorMessage(error),
        }));
      }
    } finally {
      inFlight.current = false;
    }
  // `tenant` se identifica por id y slug, ya incluidos en requestKey.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  useEffect(() => {
    setView({ phase: 'loading', addresses: null });
    void load();
    return () => { if (activeKey.current === requestKey) activeKey.current = ''; };
  }, [requestKey, load]);

  const run = useCallback(async (kind: AddressKind, operation: AddressOperation, draft?: string): Promise<boolean> => {
    if (inFlight.current || view.phase === 'legacy' || !view.addresses) return false;
    inFlight.current = true;
    const initiating = requestKey;
    const isCurrent = () => activeKey.current === initiating;
    const before = view.addresses;
    setView({ phase: 'loading', addresses: before });
    try {
      const addresses = await saveTenantAddress(tenant, before, kind, operation, draft, isCurrent);
      if (isCurrent()) setView({ phase: 'ready', addresses });
      return true;
    } catch (error) {
      if (isCurrent()) {
        const denied = error instanceof ApiError && [401, 403].includes(error.status);
        setView({ phase: 'error', addresses: denied ? null : before, message: tenantAddressesErrorMessage(error) });
      }
      return false;
    } finally {
      inFlight.current = false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, view]);

  if (view.phase === 'legacy') return <TenantDomainSettings tenant={tenant} scopeKey={scopeKey} />;

  const addresses = view.addresses;
  const busy = view.phase === 'loading';

  return (
    <Card className="mt-4" aria-busy={busy}>
      <CardHeader>
        <CardTitle>Direcciones</CardTitle>
        <CardDescription>Desde dónde entran las personas a tu espacio.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {addresses ? (
          <>
            <section className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-base font-semibold">Enlace base</h3>
                <StatusLabel active={addresses.base.available}>{addresses.base.available ? 'Activo' : 'No disponible'}</StatusLabel>
              </div>
              <p className="break-all font-mono text-sm">{addresses.base.url.replace(/^https:\/\//, '')}</p>
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton value={addresses.base.url} label="Copiar enlace" />
              </div>
            </section>

            {(['platform', 'custom'] as const).map(kind => (
              <SlotSection
                key={kind}
                slot={addresses[kind]}
                capabilities={addresses.capabilities[kind]}
                canManage={addresses.capabilities.can_manage}
                writesBlocked={addresses.capabilities.writes_blocked}
                busy={busy}
                onRun={run}
              />
            ))}

            {!addresses.capabilities.can_manage ? (
              <p className="border-t pt-5 text-sm text-muted-foreground">
                Sólo un administrador de la organización puede cambiar estas direcciones.
              </p>
            ) : addresses.capabilities.writes_blocked ? (
              <p className="border-t pt-5 text-sm text-muted-foreground">
                Los cambios de direcciones están en pausa por ahora. Podés consultar el estado.
              </p>
            ) : null}
          </>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            {busy ? 'Consultando direcciones…' : 'No pudimos confirmar las direcciones de la organización.'}
          </p>
        )}

        {view.phase === 'error' ? <p role="alert" className="text-sm text-destructive">{view.message}</p> : null}

        <div className="border-t pt-5">
          <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => void load()}>
            Actualizar estado
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default TenantAddressesSettings;
