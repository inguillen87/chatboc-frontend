import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, Clock3, MessageCircle, Printer, ReceiptText } from 'lucide-react';

import { ApiError, apiFetch } from '@/utils/api';

type Receipt = {
  code: string;
  order_number: number;
  status: 'paid' | 'pending' | 'failed';
  lines: { name: string; quantity: number; amount: string }[];
  total: string;
  paid_reference: string | null;
  pay_url: string | null;
  return_to_chat_url: string | null;
  store: { name: string | null; slug: string | null };
};

const RETRY_DELAYS_MS = [600, 1500, 3000];
// Back from Mercado Pago the webhook may land a few seconds after the person.
const CONFIRM_POLL_MS = 3000;
const CONFIRM_POLL_ROUNDS = 20;

const STATUS = {
  paid: {
    icon: CheckCircle2,
    label: 'Pagado',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  pending: {
    icon: Clock3,
    label: 'Esperando el pago',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  failed: {
    icon: AlertCircle,
    label: 'El pago no se acreditó',
    className: 'bg-red-500/10 text-red-700 dark:text-red-300',
  },
} as const;

/** The receipt of a WhatsApp order: what was bought, the total, and whether it is paid. */
export default function ReceiptPage() {
  const { code = '' } = useParams();
  const [searchParams] = useSearchParams();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const returningApproved = ['approved'].includes(
    (searchParams.get('collection_status') || searchParams.get('status') || '').toLowerCase(),
  );

  useEffect(() => {
    document.title = 'Tu comprobante';
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = (round: number, polls: number) => {
      apiFetch<Receipt>(`/api/public/receipts/${encodeURIComponent(code)}`, {
        skipAuth: true,
        suppressPanel401Redirect: true,
      })
        .then((body) => {
          if (!active) return;
          setReceipt(body);
          setState('ready');
          if (returningApproved && body.status === 'pending' && polls < CONFIRM_POLL_ROUNDS) {
            timer = setTimeout(() => load(0, polls + 1), CONFIRM_POLL_MS);
          }
        })
        .catch((error) => {
          if (!active) return;
          const answered = error instanceof ApiError && error.status > 0 && error.status < 500;
          if (answered) {
            setState(error.status === 422 || error.status === 404 ? 'missing' : 'error');
          } else if (round < RETRY_DELAYS_MS.length) {
            timer = setTimeout(() => load(round + 1, polls), RETRY_DELAYS_MS[round]);
          } else {
            setState('error');
          }
        });
    };
    setState('loading');
    load(0, 0);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [code, attempt, returningApproved]);

  if (state === 'loading') {
    return <main className="mx-auto max-w-sm px-6 py-24 text-center text-muted-foreground">Cargando tu comprobante…</main>;
  }
  if (state !== 'ready' || !receipt) {
    return (
      <main className="mx-auto max-w-sm px-6 py-24 text-center">
        <ReceiptText className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">
          {state === 'missing' ? 'No encontramos este comprobante' : 'No pudimos cargar el comprobante'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {state === 'missing'
            ? 'Revisá que el link esté completo, tal como llegó por WhatsApp.'
            : 'Puede ser la conexión. Probá de nuevo.'}
        </p>
        {state === 'error' ? (
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="mt-6 rounded-full border px-5 py-2 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Cargar de nuevo
          </button>
        ) : null}
      </main>
    );
  }

  const confirming = returningApproved && receipt.status === 'pending';
  const status = STATUS[receipt.status] ?? STATUS.pending;
  const StatusIcon = status.icon;

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm flex-col px-6 py-12">
      <header className="text-center">
        {receipt.store.name ? <p className="text-sm font-medium text-muted-foreground">{receipt.store.name}</p> : null}
        <h1 className="mt-2 text-2xl font-semibold">Pedido #{receipt.order_number}</h1>
        <p
          className={`mx-auto mt-4 flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${status.className}`}
          role="status"
        >
          <StatusIcon className="h-4 w-4" aria-hidden="true" />
          {confirming ? 'Confirmando tu pago…' : status.label}
        </p>
      </header>

      <section aria-label="Detalle" className="mt-8 rounded-2xl border p-5">
        <ul className="space-y-3">
          {receipt.lines.map((line) => (
            <li key={line.name} className="flex items-baseline justify-between gap-4 text-sm">
              <span>
                {line.quantity > 1 ? `${line.quantity} x ` : ''}
                {line.name}
              </span>
              <span className="tabular-nums">{line.amount}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-baseline justify-between border-t pt-4 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{receipt.total}</span>
        </div>
        {receipt.paid_reference ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Operación de Mercado Pago terminada en {receipt.paid_reference}
          </p>
        ) : null}
        <p className="mt-1 font-mono text-xs text-muted-foreground">Comprobante {receipt.code}</p>
      </section>

      <div className="mt-8 flex flex-col gap-3 print:hidden">
        {receipt.pay_url && !confirming ? (
          <a
            href={receipt.pay_url}
            className="rounded-full bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {receipt.status === 'failed' ? 'Intentar el pago de nuevo' : 'Pagar con Mercado Pago'}
          </a>
        ) : null}
        {receipt.return_to_chat_url ? (
          <a
            href={receipt.return_to_chat_url}
            className={`flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-medium ${
              receipt.pay_url && !confirming ? 'border hover:bg-muted' : 'bg-[#25D366] text-white hover:opacity-90'
            }`}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> Volver al chat
          </a>
        ) : null}
        {receipt.status === 'paid' ? (
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-medium hover:bg-muted"
          >
            <Printer className="h-4 w-4" aria-hidden="true" /> Guardar comprobante
          </button>
        ) : null}
      </div>
    </main>
  );
}
