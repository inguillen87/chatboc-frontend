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

import { fetchFinanceWebview, type FinanceWebviewResponse } from '@/api/finance';
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
                  <div className="mt-4 grid gap-3">
                    <Button disabled={!ready} className="h-11 rounded-[8px] bg-white text-slate-950 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-white/30">
                      {primary?.label || 'Continuar gestion segura'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    {!ready && primary?.disabled_reason ? (
                      <p className="text-sm text-amber-100">{primary.disabled_reason}</p>
                    ) : null}
                    <Button variant="outline" className="h-11 rounded-[8px] border-white/20 bg-transparent text-white hover:bg-white/10">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      {support?.label || 'Pedir ayuda'}
                    </Button>
                  </div>
                </aside>
              </div>
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
