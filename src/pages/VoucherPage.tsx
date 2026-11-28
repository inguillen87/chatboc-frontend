import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Clock3, TicketX } from 'lucide-react';

import { ApiError, apiFetch } from '@/utils/api';

type Voucher = {
  code: string;
  status: 'valid' | 'used';
  name: string | null;
  quantity: number;
  kind: string | null;
  points: number | null;
  issued_at: string | null;
  used_at: string | null;
  store: { name: string | null; slug: string | null };
};

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
};

const RETRY_DELAYS_MS = [600, 1500, 3000];

/** A person's voucher: the code large, its QR, and whether it was already used. */
export default function VoucherPage() {
  const { code = '' } = useParams();
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    document.title = 'Tu código';
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    setState('loading');
    // Opened cold from WhatsApp, the first request can race the app's own
    // start-up; a failure that is not the server's answer is retried quietly.
    const load = (round: number) => {
      apiFetch<Voucher>(`/api/public/vouchers/${encodeURIComponent(code)}`, { skipAuth: true, suppressPanel401Redirect: true })
        .then((body) => {
          if (!active) return;
          setVoucher(body);
          setState('ready');
        })
        .catch((error) => {
          if (!active) return;
          const answered = error instanceof ApiError && error.status > 0 && error.status < 500;
          if (answered) {
            setState(error.status === 422 || error.status === 404 ? 'missing' : 'error');
          } else if (round < RETRY_DELAYS_MS.length) {
            retryTimer = setTimeout(() => load(round + 1), RETRY_DELAYS_MS[round]);
          } else {
            setState('error');
          }
        });
    };
    load(0);
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [code, attempt]);

  if (state === 'loading') {
    return <main className="mx-auto max-w-sm px-6 py-24 text-center text-muted-foreground">Cargando tu código…</main>;
  }
  if (state !== 'ready' || !voucher) {
    return (
      <main className="mx-auto max-w-sm px-6 py-24 text-center">
        <TicketX className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">
          {state === 'missing' ? 'No encontramos este código' : 'No pudimos cargar el código'}
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

  const used = voucher.status === 'used';
  const usedAt = formatDate(voucher.used_at);
  const plainCode = voucher.code.replace(/-/g, '');

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm flex-col items-center px-6 py-12 text-center">
      {voucher.store.name ? <p className="text-sm font-medium text-muted-foreground">{voucher.store.name}</p> : null}
      <h1 className="mt-2 text-2xl font-semibold leading-tight">
        {voucher.quantity > 1 ? `${voucher.quantity} x ` : ''}
        {voucher.name}
      </h1>
      {voucher.points ? (
        <p className="mt-1 text-sm text-muted-foreground">{voucher.points.toLocaleString('es-AR')} puntos</p>
      ) : null}

      <div className={`relative mt-8 w-full rounded-2xl border bg-white p-5 ${used ? 'opacity-40' : ''}`}>
        <img
          src={`/api/public/vouchers/${encodeURIComponent(plainCode)}/qr.svg`}
          alt={`Código QR de ${voucher.code}`}
          className="mx-auto aspect-square w-full max-w-[16rem]"
        />
      </div>
      <p className="mt-5 font-mono text-3xl font-semibold tracking-[0.12em]" aria-label={`Código ${voucher.code.split('').join(' ')}`}>
        {voucher.code}
      </p>

      {used ? (
        <p className="mt-6 flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-medium">
          <Clock3 className="h-4 w-4" aria-hidden="true" /> Ya usado{usedAt ? ` · ${usedAt}` : ''}
        </p>
      ) : (
        <p className="mt-6 flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Válido · Mostralo al retirar o al llegar
        </p>
      )}
    </main>
  );
}
