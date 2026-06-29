import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileCheck2,
  Loader2,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';

import {
  fetchFinanceWebview,
  sendFinanceAction,
  type FinanceActionCatalogItem,
  type FinanceActionResponse,
  type FinanceWebviewResponse,
} from '@/api/finance';
import { Button } from '@/components/ui/button';
import { ApiError, NetworkError, getErrorMessage } from '@/utils/api';

const moneyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 2,
});

const formatAmount = (amount?: string | null, currency?: string | null) => {
  if (!amount) return null;
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) return `${currency || 'ARS'} ${amount}`;
  if ((currency || 'ARS').toUpperCase() === 'ARS') return moneyFormatter.format(parsed);
  return `${currency} ${parsed.toLocaleString('es-AR')}`;
};

const stepTone = (state: string) => {
  const normalized = state.toLowerCase();
  if (normalized === 'ready') return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100';
  if (normalized.includes('block')) return 'border-amber-400/50 bg-amber-500/10 text-amber-100';
  return 'border-sky-400/35 bg-sky-500/10 text-sky-100';
};

const statusCopy = (status: string) => {
  if (status === 'ready_for_customer_review') return 'Listo para revisar';
  if (status === 'session_required') return 'Link incompleto';
  return status.replace(/_/g, ' ');
};

const eventCopy: Record<string, string> = {
  identity_verified: 'Identidad validada',
  onboarding_submitted: 'Alta enviada',
  crm_lead_updated: 'CRM actualizado',
  payment_webhook: 'Pago confirmado',
  signature_completed: 'Firma completada',
  crm_operation_updated: 'Operacion actualizada',
  statement_opened: 'Resumen abierto',
  support_case_linked: 'Soporte vinculado',
  crm_contact_updated: 'Contacto actualizado',
  transfer_validated: 'Transferencia validada',
  transfer_receipt_ready: 'Comprobante listo',
  insurance_claim_created: 'Siniestro creado',
  attachments_uploaded: 'Adjuntos recibidos',
  crm_case_updated: 'Caso actualizado',
  financing_plan_requested: 'Plan solicitado',
};

const readableEvent = (event: string) => eventCopy[event] || event.replace(/_/g, ' ');

const financeErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    const requestSuffix = error.requestId ? ` Codigo de soporte: ${error.requestId}.` : '';
    if (error.status === 404) {
      return `Este link financiero todavia no esta habilitado para esta cuenta o el enlace fue armado con datos incompletos. No ingreses datos sensibles; volve al chat o pedi que te reenvien el link seguro.${requestSuffix}`;
    }
    if (error.status === 403 || error.status === 401) {
      return `No pudimos validar el acceso seguro de esta operacion. Pedi un nuevo link desde WhatsApp o comunicate con un asesor.${requestSuffix}`;
    }
  }

  if (error instanceof NetworkError) {
    return 'No pudimos conectar con el servicio financiero. Revisa la conexion y reintenta desde el mismo link seguro.';
  }

  return getErrorMessage(error, 'No pudimos validar este link financiero. Reintenta desde WhatsApp o pedi asistencia.');
};

function Skeleton() {
  return (
    <div className="grid gap-4">
      <div className="h-32 animate-pulse rounded-[8px] bg-white/10" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-24 animate-pulse rounded-[8px] bg-white/10" />
        <div className="h-24 animate-pulse rounded-[8px] bg-white/10" />
        <div className="h-24 animate-pulse rounded-[8px] bg-white/10" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-[8px] border border-red-400/40 bg-red-500/10 p-5 text-red-50">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">No se pudo abrir la operacion</h2>
          <p className="mt-1 text-sm text-red-100/80">{message}</p>
          <Button onClick={onRetry} className="mt-4 h-10 rounded-[8px] bg-white text-slate-950 hover:bg-slate-100">
            Reintentar
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function FinanceWebviewPage() {
  const params = useParams<{ tenantSlug?: string; flow?: string; operationCode?: string }>();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [payload, setPayload] = useState<FinanceWebviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<FinanceActionResponse | null>(null);

  const pathParts = location.pathname.split('/').filter(Boolean);
  const financeIndex = pathParts.findIndex((part) => part.toLowerCase() === 'finanzas');
  const tenantSlug = params.tenantSlug || (financeIndex >= 0 ? pathParts[financeIndex + 1] : '') || '';
  const flow = params.flow || (financeIndex >= 0 ? pathParts[financeIndex + 2] : '') || '';
  const operationCode = params.operationCode || (financeIndex >= 0 ? pathParts[financeIndex + 3] : '') || '';
  const amountText = useMemo(
    () => formatAmount(payload?.operation.amount, payload?.operation.currency),
    [payload?.operation.amount, payload?.operation.currency],
  );
  const primary = payload?.actions.primary;
  const support = payload?.actions.support;
  const ready = primary?.enabled === true;
  const securityHighlights = payload?.security_policy.highlights?.length
    ? payload.security_policy.highlights
    : [
        'Nunca pedimos claves, PIN ni datos completos de tarjeta por chat.',
        'Los documentos se revisan desde una vista protegida.',
        'La confirmacion final llega desde el proveedor autorizado.',
      ];
  const userTasks = payload?.experience?.user_tasks ?? [];
  const successEvents = payload?.events?.success ?? [];
  const crmQueue = payload?.experience?.crm_queue;
  const templates = payload?.experience?.templates ?? [];
  const actionCatalog = useMemo<FinanceActionCatalogItem[]>(() => {
    if (payload?.action_catalog?.length) return payload.action_catalog;
    const fallback: FinanceActionCatalogItem[] = [];
    if (payload?.actions.primary) {
      fallback.push({
        ...payload.actions.primary,
        event: 'finance_secure_flow_continued',
        next_step: 'secure_webview',
      });
    }
    if (payload?.actions.support) {
      fallback.push({
        ...payload.actions.support,
        event: 'finance_agent_help_requested',
        next_step: 'crm_queue',
        disabled_reason: null,
      });
    }
    return fallback;
  }, [payload]);
  const secondaryActions = actionCatalog.filter(
    (action) => !['continue_secure_flow', 'request_agent_help', 'add_public_comment'].includes(action.id),
  );
  const actionById = (id: string) => actionCatalog.find((action) => action.id === id);
  const commentAction = actionById('add_public_comment') || actionById('request_agent_help');

  const load = async () => {
    if (!tenantSlug || !flow || !operationCode) {
      setError('El link no contiene tenant, flujo u operacion.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetchFinanceWebview({ tenantSlug, flow, operationCode, searchParams });
      setPayload(response);
    } catch (err) {
      setPayload(null);
      setError(financeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const submitAction = async (action: FinanceActionCatalogItem | undefined, overrideComment?: string) => {
    if (!action || !payload || !tenantSlug || !flow || !operationCode) return;
    setActionSubmitting(action.id);
    setActionError(null);
    setActionResult(null);
    try {
      const response = await sendFinanceAction({
        tenantSlug,
        flow,
        operationCode,
        searchParams,
        actionId: action.id,
        comment: overrideComment ?? comment,
        amount: payload.operation.amount,
        currency: payload.operation.currency,
      });
      setActionResult(response);
      if (action.id === 'add_public_comment') setComment('');
    } catch (err) {
      setActionError(financeErrorMessage(err));
    } finally {
      setActionSubmitting(null);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, flow, operationCode, searchParams.toString()]);

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-white/10 bg-white/[0.04] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-[8px] bg-emerald-400/15 text-emerald-200">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Chatboc Finance</p>
              <h1 className="text-xl font-semibold">{payload?.tenant.nombre || 'Operacion segura'}</h1>
            </div>
          </div>
          <div className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-sm font-medium text-emerald-100">
            Datos sensibles fuera del chat
          </div>
        </header>

        {loading && !payload ? <Skeleton /> : null}
        {error ? <ErrorState message={error} onRetry={load} /> : null}

        {payload ? (
          <>
            <section className="overflow-hidden rounded-[8px] border border-white/10 bg-white/[0.05] shadow-2xl shadow-black/30">
              <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
                <div className="p-6 sm:p-8">
                  <div className="mb-5 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-sky-300/35 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-sky-100">
                      {statusCopy(payload.operation.status)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-slate-200">
                      {payload.operation.code}
                    </span>
                    {payload.experience?.webview_flow_id ? (
                      <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                        {payload.experience.webview_flow_id.replace(/_/g, ' ')}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="text-3xl font-semibold tracking-normal sm:text-4xl">{payload.operation.title}</h2>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">{payload.operation.description}</p>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[8px] border border-white/10 bg-slate-950/40 p-4">
                      <Clock3 className="mb-3 h-5 w-5 text-sky-200" />
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Estado</p>
                      <p className="mt-1 font-semibold">{statusCopy(payload.operation.status)}</p>
                    </div>
                    <div className="rounded-[8px] border border-white/10 bg-slate-950/40 p-4">
                      <CreditCard className="mb-3 h-5 w-5 text-emerald-200" />
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Monto</p>
                      <p className="mt-1 font-semibold">{amountText || 'A confirmar'}</p>
                    </div>
                    <div className="rounded-[8px] border border-white/10 bg-slate-950/40 p-4">
                      <LockKeyhole className="mb-3 h-5 w-5 text-amber-200" />
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Sesion</p>
                      <p className="mt-1 font-semibold">{payload.security_policy.session_state === 'present' ? 'Validada' : 'Requerida'}</p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[8px] border border-white/10 bg-slate-950/35 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Plantillas WhatsApp</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {templates.length ? (
                          templates.slice(0, 4).map((template) => (
                            <span key={template} className="rounded-full border border-sky-300/25 bg-sky-400/10 px-3 py-1 text-xs text-sky-100">
                              {template.replace(/^finance_/, '').replace(/_/g, ' ')}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-300">A definir por tenant</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-[8px] border border-white/10 bg-slate-950/35 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Confirmacion operativa</p>
                      <div className="mt-3 grid gap-2 text-sm text-slate-200">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                          <span>Webhook servidor a servidor</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                          <span>Auditoria CRM y evento analitico</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-sky-200" />
                          <span>Datos sensibles fuera del chat</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <aside className="border-t border-white/10 bg-slate-950/60 p-6 lg:border-l lg:border-t-0">
                  <div className="rounded-[8px] border border-emerald-300/25 bg-emerald-500/10 p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-emerald-200" />
                      <div>
                        <h3 className="font-semibold text-emerald-50">Politica de seguridad</h3>
                        <p className="mt-1 text-sm leading-6 text-emerald-100/80">
                          No se aceptan tarjetas, documentos completos ni claves dentro del chat. La confirmacion se registra servidor a servidor.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-[8px] border border-white/10 bg-white/[0.04] p-4">
                    <h3 className="font-semibold text-slate-50">Proteccion de datos</h3>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                      {securityHighlights.slice(0, 4).map((item) => (
                        <li key={item} className="flex gap-2">
                          <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-sky-200" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {crmQueue ? (
                    <div className="mt-4 rounded-[8px] border border-amber-300/25 bg-amber-400/10 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-100/80">Mesa operativa</p>
                      <p className="mt-1 font-semibold text-amber-50">{crmQueue.label}</p>
                      {typeof crmQueue.sla_minutes === 'number' ? (
                        <p className="mt-1 text-sm text-amber-100/75">SLA de referencia: {crmQueue.sla_minutes} min</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-3">
                    <Button
                      disabled={!ready || actionSubmitting === primary?.id}
                      onClick={() => void submitAction(actionById(primary?.id || 'continue_secure_flow'))}
                      className="h-11 rounded-[8px] bg-white text-slate-950 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-white/30"
                    >
                      {actionSubmitting === primary?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      {primary?.label || 'Continuar gestion segura'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    {!ready && primary?.disabled_reason ? (
                      <p className="text-sm text-amber-100">{primary.disabled_reason}</p>
                    ) : null}
                    <Button
                      variant="outline"
                      disabled={actionSubmitting === support?.id}
                      onClick={() => void submitAction(actionById(support?.id || 'request_agent_help'))}
                      className="h-11 rounded-[8px] border-white/20 bg-transparent text-white hover:bg-white/10"
                    >
                      {actionSubmitting === support?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      <MessageCircle className="mr-2 h-4 w-4" />
                      {support?.label || 'Pedir ayuda'}
                    </Button>
                  </div>
                </aside>
              </div>
            </section>

            {(userTasks.length || successEvents.length) ? (
              <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                {userTasks.length ? (
                  <article className="rounded-[8px] border border-white/10 bg-white/[0.05] p-5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-sky-400/12 text-sky-100">
                        <FileCheck2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tu gestion</p>
                        <h3 className="text-lg font-semibold">Pasos claros antes de confirmar</h3>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {userTasks.map((task, index) => (
                        <div key={task} className="flex gap-3 rounded-[8px] border border-white/10 bg-slate-950/35 p-3">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-slate-950">
                            {index + 1}
                          </span>
                          <p className="text-sm leading-6 text-slate-200">{task}</p>
                        </div>
                      ))}
                    </div>
                  </article>
                ) : null}

                {successEvents.length ? (
                  <article className="rounded-[8px] border border-white/10 bg-white/[0.05] p-5">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-emerald-400/12 text-emerald-100">
                        <LockKeyhole className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Seguimiento</p>
                        <h3 className="text-lg font-semibold">Registro operativo y comprobantes</h3>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2">
                      {successEvents.slice(0, 4).map((event) => (
                        <div key={event} className="flex items-center justify-between gap-3 rounded-[8px] border border-white/10 bg-slate-950/35 px-3 py-2">
                          <span className="text-sm text-slate-200">{readableEvent(event)}</span>
                          <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                        </div>
                      ))}
                    </div>
                  </article>
                ) : null}
              </section>
            ) : null}

            <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <article className="rounded-[8px] border border-white/10 bg-white/[0.05] p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-sky-400/12 text-sky-100">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Acciones</p>
                    <h3 className="text-lg font-semibold">Resolver sin salir del flujo</h3>
                  </div>
                </div>
                <div className="mt-4 grid gap-2">
                  {secondaryActions.length ? (
                    secondaryActions.slice(0, 5).map((action) => (
                      <Button
                        key={action.id}
                        variant="outline"
                        disabled={!action.enabled || actionSubmitting === action.id}
                        onClick={() => void submitAction(action)}
                        className="h-auto justify-between rounded-[8px] border-white/15 bg-slate-950/35 px-3 py-3 text-left text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:bg-white/5"
                      >
                        <span className="min-w-0">
                          <span className="block font-semibold">{action.label}</span>
                          <span className="mt-1 block text-xs font-normal text-slate-400">
                            {action.disabled_reason || action.next_step?.replace(/_/g, ' ') || 'crm'}
                          </span>
                        </span>
                        {actionSubmitting === action.id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <ArrowRight className="h-4 w-4 shrink-0" />}
                      </Button>
                    ))
                  ) : (
                    <p className="rounded-[8px] border border-white/10 bg-slate-950/35 p-3 text-sm text-slate-300">
                      La operacion queda disponible para asistencia y seguimiento CRM.
                    </p>
                  )}
                </div>
              </article>

              <article className="rounded-[8px] border border-white/10 bg-white/[0.05] p-5">
                <label htmlFor="finance-comment" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Comentario seguro
                </label>
                <textarea
                  id="finance-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className="mt-3 min-h-[112px] w-full resize-y rounded-[8px] border border-white/10 bg-slate-950/55 px-3 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500 focus:border-sky-300/60"
                  placeholder="Consulta, observacion o pedido para el equipo..."
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button
                    disabled={!comment.trim() || actionSubmitting === commentAction?.id}
                    onClick={() => void submitAction(commentAction, comment)}
                    className="h-10 rounded-[8px] bg-white text-slate-950 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-white/30"
                  >
                    {actionSubmitting === commentAction?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Registrar comentario
                  </Button>
                  <p className="text-xs text-slate-400">No incluyas claves, PIN, CVV ni tarjetas completas.</p>
                </div>
                {actionError ? (
                  <div className="mt-4 rounded-[8px] border border-red-400/35 bg-red-500/10 p-3 text-sm text-red-100">
                    {actionError}
                  </div>
                ) : null}
                {actionResult ? (
                  <div className="mt-4 rounded-[8px] border border-emerald-300/30 bg-emerald-400/10 p-3 text-sm text-emerald-50">
                    <p className="font-semibold">{actionResult.frontend_contract?.toast || 'Gestion registrada'}</p>
                    {actionResult.ticket?.id ? (
                      <p className="mt-1 text-emerald-100/80">Ticket CRM #{actionResult.ticket.id}</p>
                    ) : null}
                  </div>
                ) : null}
              </article>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              {payload.steps.map((step) => (
                <article key={step.id} className={`rounded-[8px] border p-5 ${stepTone(step.state)}`}>
                  <FileCheck2 className="mb-4 h-5 w-5" />
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] opacity-75">{step.state.replace(/_/g, ' ')}</p>
                  <h3 className="mt-2 text-lg font-semibold">{step.label}</h3>
                  {step.detail ? <p className="mt-2 text-sm leading-6 opacity-80">{step.detail}</p> : null}
                </article>
              ))}
            </section>
          </>
        ) : null}

        {loading && payload ? (
          <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/90 px-4 py-2 text-sm text-slate-200 shadow-xl">
            <Loader2 className="h-4 w-4 animate-spin" />
            Actualizando
          </div>
        ) : null}
      </section>
    </main>
  );
}
