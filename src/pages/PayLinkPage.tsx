import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, ShieldCheck, Wallet } from 'lucide-react';

import { ApiError, apiFetch } from '@/utils/api';

type PayLink = {
  code: string;
  concept: string;
  description: string | null;
  amount: string | null;
  free_amount: boolean;
  min_amount: string | null;
  suggested: { value: number; label: string }[];
  available: boolean;
  store: { name: string | null; slug: string | null };
};

const RETRY_DELAYS_MS = [600, 1500, 3000];

const ERRORS: Record<string, string> = {
  payment_link_amount_invalid: 'Revisá el monto: tiene que ser un número y llegar al mínimo.',
  payment_link_inactive: 'Este cobro está pausado.',
  payment_unavailable: 'El pago online no está disponible en este momento. Probá más tarde.',
};

/** A charge shared as a link: concept, amount (or the amount the person chooses) and «Pagar». */
export default function PayLinkPage() {
  const { code = '' } = useParams();
  const [link, setLink] = useState<PayLink | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [amount, setAmount] = useState('');
  const [paying, setPaying] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Pagar';
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = (round: number) => {
      apiFetch<PayLink>(`/api/public/pay/${encodeURIComponent(code)}`, { skipAuth: true, suppressPanel401Redirect: true })
        .then((body) => {
          if (!active) return;
          setLink(body);
          setState('ready');
          if (body.store.name) document.title = `Pagar · ${body.store.name}`;
        })
        .catch((error) => {
          if (!active) return;
          const answered = error instanceof ApiError && error.status > 0 && error.status < 500;
          if (answered) setState('missing');
          else if (round < RETRY_DELAYS_MS.length) timer = setTimeout(() => load(round + 1), RETRY_DELAYS_MS[round]);
          else setState('error');
        });
    };
    load(0);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [code]);

  const pay = async (event: React.FormEvent) => {
    event.preventDefault();
    setPaying(true);
    setProblem(null);
    try {
      const result = await apiFetch<{ pay_url: string }>(`/api/public/pay/${encodeURIComponent(code)}`, {
        method: 'POST',
        body: link?.free_amount ? { amount } : {},
        skipAuth: true,
        suppressPanel401Redirect: true,
      });
      window.location.assign(result.pay_url);
    } catch (error) {
      const reason = error instanceof ApiError ? (error.body as { error?: string } | null)?.error : undefined;
      setProblem((reason && ERRORS[reason]) || 'No pudimos iniciar el pago. Probá de nuevo.');
      setPaying(false);
    }
  };

  if (state === 'loading') {
    return <main className="mx-auto max-w-sm px-6 py-24 text-center text-muted-foreground">Cargando…</main>;
  }
  if (state !== 'ready' || !link) {
    return (
      <main className="mx-auto max-w-sm px-6 py-24 text-center">
        <Wallet className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <h1 className="mt-4 text-xl font-semibold">
          {state === 'missing' ? 'No encontramos este cobro' : 'No pudimos cargar el cobro'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {state === 'missing' ? 'Revisá que el link esté completo.' : 'Puede ser la conexión. Probá de nuevo en unos segundos.'}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-sm flex-col px-6 py-12">
      <header className="text-center">
        {link.store.name ? <p className="text-sm font-medium text-muted-foreground">{link.store.name}</p> : null}
        <h1 className="mt-2 text-2xl font-semibold leading-tight">{link.concept}</h1>
        {link.description ? <p className="mt-2 text-sm text-muted-foreground">{link.description}</p> : null}
        {!link.free_amount && link.amount ? (
          <p className="mt-6 text-4xl font-semibold tabular-nums">{link.amount}</p>
        ) : null}
      </header>

      <form onSubmit={pay} className="mt-8 space-y-4">
        {link.free_amount ? (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">¿Cuánto querés aportar?</legend>
            {link.suggested.length ? (
              <div className="grid grid-cols-2 gap-2">
                {link.suggested.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={amount === String(option.value)}
                    onClick={() => setAmount(String(option.value))}
                    className={`rounded-lg border px-3 py-3 text-sm font-medium tabular-nums ${
                      amount === String(option.value) ? 'border-primary bg-primary/10' : 'hover:bg-muted'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
            <label className="block text-sm">
              <span className="text-muted-foreground">Otro monto</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder={link.min_amount ? `Desde ${link.min_amount}` : 'En pesos'}
                className="mt-1 w-full rounded-lg border bg-background px-3 py-2"
                required
              />
            </label>
          </fieldset>
        ) : null}

        {problem ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {problem}
          </p>
        ) : null}

        {link.available ? (
          <button
            type="submit"
            disabled={paying}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {paying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Pagar con Mercado Pago
          </button>
        ) : (
          <p className="rounded-lg border p-3 text-center text-sm text-muted-foreground">
            Este cobro no está disponible para pagar ahora.
          </p>
        )}
        <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Pagás en Mercado Pago. Después ves tu comprobante.
        </p>
      </form>
    </main>
  );
}
