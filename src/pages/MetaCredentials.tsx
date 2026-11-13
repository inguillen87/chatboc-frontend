import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ViewState } from '@/components/app-shell/ViewState';
import MetaConnectionCheck from '@/components/integrations/MetaConnectionCheck';
import { useUser } from '@/hooks/useUser';
import { normalizeRole } from '@/utils/roles';
import { captureChatbocSessionRevision, subscribeChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import {
  META_CREDENTIAL_TARGETS, MetaCredentialClientError, metaCredentialApi,
  type MetaCredentialPlan, type MetaCredentialReceipt, type MetaCredentialStatus, type MetaCredentialTarget,
} from '@/features/metaCredentials/metaCredentialApi';

type Phase = 'loading' | 'editing' | 'validating' | 'review' | 'applying' | 'uncertain' | 'checking' | 'done';
const utc = (value: number | null) => value === null ? 'Sin fecha registrada' :
  `${new Date(value * 1000).toLocaleString('es-AR', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' })} UTC`;

const errorMessage = (error: unknown) => {
  const code = error instanceof MetaCredentialClientError ? error.reasonCode : '';
  const messages: Record<string, string> = {
    meta_credentials_production_panel_required: 'Abrí esta pantalla desde el panel de producción de Chatboc.',
    meta_operation_unavailable: 'La carga privada todavía no está disponible en el servidor.',
    meta_operation_authentication_required: 'La sesión necesita verificarse nuevamente. Volvé a ingresar al panel.',
    meta_operation_clerk_session_required: 'Ingresá al panel con tu sesión de administración verificada.',
    meta_operation_rate_limited: 'Se alcanzó el límite de validaciones. Esperá antes de actualizar el estado.',
    meta_operation_token_input_invalid: 'Revisá el token pegado. Debe ser una sola credencial completa.',
    meta_token_authority_expired: 'La credencial venció. Generá una nueva en Meta antes de validarla.',
    meta_token_authority_invalid: 'Meta no confirmó la aplicación o los permisos de la credencial.',
    meta_phone_membership_unverified: 'La credencial no permite verificar el número asignado.',
    meta_app_subscription_unverified: 'Meta no confirmó la suscripción de la aplicación.',
    meta_operation_plan_mismatch: 'El plan ya no coincide con la operación. Volvé a validar las credenciales.',
    meta_operation_state_changed: 'La configuración cambió. Actualizá el estado antes de volver a validar.',
    meta_operation_revision_conflict: 'La credencial ya cambió. Actualizá el estado antes de volver a validar.',
  };
  return messages[code] || 'No se pudo completar la validación. Revisá el estado del servicio e intentá nuevamente.';
};

export default function MetaCredentials() {
  const navigate = useNavigate();
  const { user, loading, hasVerifiedSession, organizationProfileVerified } = useUser();
  const revision = useSyncExternalStore(subscribeChatbocSessionRevision, captureChatbocSessionRevision, captureChatbocSessionRevision);
  const authorized = hasVerifiedSession && organizationProfileVerified && !loading &&
    normalizeRole(user?.rol || user?.role) === 'superadmin' && Boolean(user?.id);
  const scopeKey = authorized ? JSON.stringify([user?.id, revision]) : null;
  const activeScope = useRef<string | null>(scopeKey);
  activeScope.current = scopeKey;
  const inputs = useRef<Partial<Record<MetaCredentialTarget, HTMLInputElement | null>>>({});
  const inFlight = useRef(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [statuses, setStatuses] = useState<MetaCredentialStatus[]>([]);
  const [entered, setEntered] = useState<Partial<Record<MetaCredentialTarget, boolean>>>({});
  const [plans, setPlans] = useState<MetaCredentialPlan[]>([]);
  const [receipts, setReceipts] = useState<Partial<Record<MetaCredentialTarget, MetaCredentialReceipt>>>({});
  const [uncertain, setUncertain] = useState<MetaCredentialTarget | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const clearSecrets = useCallback(() => {
    for (const target of META_CREDENTIAL_TARGETS) {
      const input = inputs.current[target];
      if (input) input.value = '';
    }
    setEntered({});
  }, []);

  useEffect(() => {
    activeScope.current = scopeKey;
    clearSecrets(); setPlans([]); setReceipts({}); setUncertain(null); setMessage(null); setStatuses([]);
    inFlight.current = false;
    if (!scopeKey) return;
    const controller = new AbortController();
    const isCurrent = () => activeScope.current === scopeKey && !controller.signal.aborted;
    setPhase('loading');
    Promise.all(META_CREDENTIAL_TARGETS.map(target => metaCredentialApi.status(target, { isCurrent, signal: controller.signal })))
      .then(result => { if (isCurrent()) { setStatuses(result); setPhase('editing'); } })
      .catch(error => { if (isCurrent()) { setMessage(errorMessage(error)); setPhase('editing'); } });
    return () => { activeScope.current = null; controller.abort(); clearSecrets(); };
  }, [scopeKey, reload, clearSecrets]);

  useEffect(() => {
    const retireForm = () => { clearSecrets(); setPlans([]); };
    window.addEventListener('pagehide', retireForm);
    return () => { window.removeEventListener('pagehide', retireForm); clearSecrets(); };
  }, [clearSecrets]);

  const editable = statuses.filter(status => status.operationAvailable && !receipts[status.target]);
  const allEntered = editable.length > 0 && editable.every(status => entered[status.target]);
  const busy = ['loading', 'validating', 'applying', 'checking'].includes(phase);
  const currentRequest = () => {
    const initiatingScope = scopeKey;
    return { isCurrent: () => Boolean(initiatingScope && activeScope.current === initiatingScope) };
  };

  const validate = async () => {
    if (!scopeKey || !allEntered || inFlight.current || phase !== 'editing') return;
    const scope = currentRequest();
    inFlight.current = true; setPhase('validating'); setMessage(null); setPlans([]);
    try {
      const next: MetaCredentialPlan[] = [];
      for (const status of editable) {
        if (!scope.isCurrent()) return;
        next.push(await metaCredentialApi.plan(status, inputs.current[status.target]?.value || '', scope));
      }
      if (scope.isCurrent()) { setPlans(next); setPhase('review'); }
    } catch (error) {
      if (scope.isCurrent()) { clearSecrets(); setMessage(errorMessage(error)); setPhase('editing'); }
    } finally { if (scope.isCurrent()) inFlight.current = false; }
  };

  const markConfirmed = (receipt: MetaCredentialReceipt) => {
    setReceipts(previous => ({ ...previous, [receipt.target]: receipt }));
    setStatuses(previous => previous.map(status => status.target === receipt.target ? {
      ...status, currentRevision: receipt.revision, expiresAt: receipt.expiresAt,
      lastPlanSha256: receipt.planSha256, operationAvailable: false,
    } : status));
  };

  const apply = async () => {
    if (!scopeKey || inFlight.current || phase !== 'review' || !plans.length || !allEntered) return;
    const scope = currentRequest();
    inFlight.current = true; setPhase('applying'); setMessage(null);
    let applying: MetaCredentialTarget | null = null;
    try {
      for (const plan of plans) {
        if (!scope.isCurrent()) return;
        applying = plan.target;
        const receipt = await metaCredentialApi.apply(plan, inputs.current[plan.target]?.value || '', scope);
        if (!scope.isCurrent()) return;
        markConfirmed(receipt);
        if (inputs.current[plan.target]) inputs.current[plan.target]!.value = '';
      }
      if (scope.isCurrent()) { setPhase('done'); setMessage('Las credenciales se guardaron y el servidor confirmó las nuevas revisiones.'); }
    } catch {
      if (scope.isCurrent()) {
        setUncertain(applying); setPhase('uncertain');
        setMessage('No se pudo confirmar el resultado. Verificá el estado antes de volver a cargar una credencial.');
      }
    } finally { if (scope.isCurrent()) { clearSecrets(); inFlight.current = false; } }
  };

  const verifyOutcome = async () => {
    if (!uncertain || !scopeKey || inFlight.current) return;
    const reviewed = plans.find(plan => plan.target === uncertain);
    if (!reviewed) return;
    const scope = currentRequest();
    inFlight.current = true; setPhase('checking');
    try {
      const status = await metaCredentialApi.status(uncertain, scope);
      if (!scope.isCurrent()) return;
      setStatuses(previous => previous.map(item => item.target === status.target ? status : item));
      if (status.tenantId === reviewed.tenantId && status.currentRevision === reviewed.nextRevision &&
          status.expiresAt === reviewed.expiresAt && status.lastPlanSha256 === reviewed.planSha256) {
        markConfirmed({ target: reviewed.target, revision: reviewed.nextRevision,
          expiresAt: reviewed.expiresAt, planSha256: reviewed.planSha256 });
        setUncertain(null); setPhase('done'); setMessage('El estado del servidor confirmó la credencial guardada.');
      } else {
        setPhase('uncertain'); setMessage('El estado todavía no confirma ese plan. No se enviará otro intento; verificá nuevamente.');
      }
    } catch {
      if (scope.isCurrent()) { setPhase('uncertain'); setMessage('Todavía no se pudo verificar el resultado. No se envió otro intento.'); }
    } finally { if (scope.isCurrent()) inFlight.current = false; }
  };

  const cancel = () => { clearSecrets(); setPlans([]); setMessage(null); navigate('/integracion?channel=whatsapp'); };
  if (loading) return <ViewState status="loading" title="Verificando la sesión" />;
  if (!authorized) return <ViewState status="denied" title="Acceso exclusivo de administración" description="Ingresá con una sesión verificada de superadmin." />;

  return <main className="mx-auto max-w-4xl space-y-6 p-4 md:p-8" data-private="true" data-sentry-mask="true">
    <div className="space-y-3">
      <Link to="/integracion?channel=whatsapp" onClick={clearSecrets} className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Integraciones</Link>
      <h1 className="flex items-center gap-3 text-2xl font-semibold"><KeyRound className="h-6 w-6" />Credenciales de WhatsApp</h1>
      <p className="text-muted-foreground">Pegá las credenciales en los campos ocultos. Primero se validan; después vas a revisar qué se guardará.</p>
    </div>
    {message && <div role={phase === 'done' ? 'status' : 'alert'} className="rounded-lg border bg-muted/30 p-4 text-sm">{message}</div>}
    {phase === 'loading' ? <ViewState status="loading" title="Verificando los destinos autorizados" /> : <>
      {!statuses.length ? <ViewState status="error" title="No se pudo verificar la configuración" action={<Button onClick={() => setReload(value => value + 1)}>Actualizar estado</Button>} /> :
        <form autoComplete="off" className="space-y-4" onSubmit={event => { event.preventDefault(); void validate(); }}>
          {statuses.map(status => {
            const plan = plans.find(item => item.target === status.target);
            const confirmed = receipts[status.target];
            return <Card key={status.target}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-3">{status.label}{confirmed && <CheckCircle2 aria-label="Credencial confirmada" className="h-5 w-5 text-green-600" />}</CardTitle>
                <CardDescription>{status.phoneNumber} · {status.environment === 'production' ? 'Producción' : 'Prueba'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <details className="text-sm"><summary className="cursor-pointer text-muted-foreground">Ver identificación del destino</summary>
                  <dl className="mt-3 grid gap-2 break-all sm:grid-cols-2">
                    <div><dt className="text-muted-foreground">Organización</dt><dd>{status.tenantSlug} · {status.tenantId}</dd></div>
                    <div><dt className="text-muted-foreground">Aplicación</dt><dd>{status.appId}</dd></div>
                    <div><dt className="text-muted-foreground">Cuenta de WhatsApp</dt><dd>{status.wabaId}</dd></div>
                    <div><dt className="text-muted-foreground">Identificador del número</dt><dd>{status.phoneNumberId}</dd></div>
                  </dl>
                </details>
                {status.operationAvailable && !confirmed && <div className="space-y-2">
                  <Label htmlFor={`meta-secret-${status.target}`}>Token de acceso · {status.label}</Label>
                  <Input id={`meta-secret-${status.target}`} name={`meta-secret-${status.target}`} type="password"
                    autoComplete="new-password" autoCapitalize="none" spellCheck={false} maxLength={4096}
                    data-lpignore="true" data-1p-ignore="true" data-private="true" data-sentry-mask="true"
                    ref={input => {
                      // Retain the element until effect cleanup can also erase
                      // a field detached by logout, navigation or confirmation.
                      if (input) inputs.current[status.target] = input;
                    }} disabled={phase !== 'editing'}
                    onChange={event => {
                      const hasValue = Boolean(event.currentTarget.value);
                      setEntered(previous => ({ ...previous, [status.target]: hasValue }));
                    }} />
                </div>}
                {plan && !confirmed && <div className="rounded-md bg-muted/40 p-3 text-sm">
                  <p>Revisión {plan.expectedRevision} → {plan.nextRevision}</p>
                  <p>Vigencia local: {utc(plan.expiresAt)}</p>
                  <p className="mt-1 text-muted-foreground">{plan.expirySource === 'provider' ? 'Fecha verificada con Meta.' : 'Límite local de 30 días, aplicado después de validar la credencial con Meta.'}</p>
                </div>}
                {confirmed && <p role="status" className="text-sm text-green-700 dark:text-green-300">Revisión {confirmed.revision} confirmada · {utc(confirmed.expiresAt)}</p>}
                {!status.operationAvailable && !confirmed && <p className="text-sm text-muted-foreground">{status.currentRevision === null ? 'Esta operación no está disponible en el estado actual.' : `Revisión actual: ${status.currentRevision}. La carga no está habilitada en el estado actual.`}</p>}
              </CardContent>
            </Card>;
          })}
          <div className="flex flex-wrap gap-3">
            {phase === 'editing' && editable.length > 0 && <Button type="submit" disabled={!allEntered}>Validar credenciales</Button>}
            {phase === 'review' && <Button type="button" onClick={() => void apply()} disabled={!allEntered}>Aplicar credenciales validadas</Button>}
            {phase === 'review' && <Button type="button" variant="outline" onClick={() => { clearSecrets(); setPlans([]); setPhase('editing'); }}>Corregir credenciales</Button>}
            {phase === 'uncertain' && <Button type="button" onClick={() => void verifyOutcome()}><RefreshCw className="mr-2 h-4 w-4" />Verificar resultado</Button>}
            {phase === 'done' && editable.length > 0 && <Button type="button" onClick={() => setReload(value => value + 1)}>Actualizar operaciones pendientes</Button>}
            {busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{phase === 'applying' ? 'Guardando las credenciales…' : 'Verificando…'}</p>}
            <Button type="button" variant="outline" disabled={busy} onClick={cancel}>{phase === 'done' ? 'Volver a Integraciones' : 'Cancelar y borrar'}</Button>
          </div>
          <p className="text-xs text-muted-foreground">Los campos se limpian al finalizar, cancelar o salir de esta pantalla.</p>
        </form>}
      <MetaConnectionCheck statuses={statuses} scopeKey={scopeKey}
        blocked={busy || uncertain !== null || !['editing', 'done'].includes(phase)} />
    </>}
  </main>;
}
