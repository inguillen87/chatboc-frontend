import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Camera, CheckCircle2, Clock3, Loader2, TicketX } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError, apiFetch } from '@/utils/api';
import { useTenant } from '@/context/TenantContext';

type VoucherView = { code: string; name: string | null; quantity: number; points: number | null; used_at: string | null };
type Result =
  | { kind: 'redeemed'; voucher: VoucherView }
  | { kind: 'used'; voucher: VoucherView }
  | { kind: 'invalid' }
  | { kind: 'error' };

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };

const formatDate = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** The venue checks a voucher: by camera where the browser can read QR codes, or by typing it. */
export default function VoucherCheckPage() {
  const params = useParams();
  const { currentSlug } = useTenant();
  const slug = params.tenant || currentSlug || '';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => {
    document.title = 'Validar código';
  }, []);

  const check = async (raw: string) => {
    const value = raw.trim();
    if (!value || !slug) return;
    setBusy(true);
    try {
      const body = await apiFetch<{ result: 'redeemed'; voucher: VoucherView }>(
        `/api/admin/tenants/${encodeURIComponent(slug)}/vouchers/redeem`,
        { method: 'POST', body: { code: value }, tenantSlug: slug, suppressPanel401Redirect: true },
      );
      setResult({ kind: 'redeemed', voucher: body.voucher });
    } catch (error) {
      const data = error instanceof ApiError ? (error.body as { result?: string; voucher?: VoucherView } | null) : null;
      if (error instanceof ApiError && error.status === 409 && data?.voucher) setResult({ kind: 'used', voucher: data.voucher });
      else if (error instanceof ApiError && (error.status === 422 || error.status === 404)) setResult({ kind: 'invalid' });
      else setResult({ kind: 'error' });
    } finally {
      setBusy(false);
      setCode('');
      input.current?.focus();
    }
  };

  useEffect(() => {
    if (!scanning || !video.current) return;
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const Ctor = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
    const detector = new Ctor({ formats: ['qr_code'] });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (media) => {
        stream = media;
        if (!video.current || stopped) return;
        video.current.srcObject = media;
        await video.current.play();
        const tick = async () => {
          if (stopped || !video.current) return;
          const found = await detector.detect(video.current).catch(() => []);
          if (found[0]?.rawValue) {
            setScanning(false);
            void check(found[0].rawValue);
            return;
          }
          frame = window.requestAnimationFrame(() => void tick());
        };
        void tick();
      })
      .catch(() => setScanning(false));
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  return (
    <div className="container mx-auto max-w-md space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Validar código</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escaneá el QR o escribí el código que muestra la persona. Cada código vale una sola vez.
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void check(code);
        }}
      >
        <Input
          ref={input}
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="K7MQ-4XPZ-2R"
          aria-label="Código del voucher"
          autoComplete="off"
          autoCapitalize="characters"
          className="font-mono text-lg tracking-widest"
          autoFocus
        />
        <Button type="submit" disabled={busy || !code.trim()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Validar'}
        </Button>
      </form>

      {canScan ? (
        scanning ? (
          <div className="space-y-2">
            <video ref={video} className="aspect-square w-full rounded-xl bg-black object-cover" muted playsInline />
            <Button variant="outline" className="w-full" onClick={() => setScanning(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setScanning(true)}>
            <Camera className="mr-2 h-4 w-4" /> Escanear QR
          </Button>
        )
      ) : null}

      <div aria-live="polite">
        {result?.kind === 'redeemed' ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5">
            <p className="flex items-center gap-2 text-lg font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Válido. Entregá:
            </p>
            <p className="mt-2 text-xl font-semibold">
              {result.voucher.quantity > 1 ? `${result.voucher.quantity} x ` : ''}
              {result.voucher.name}
            </p>
            <p className="mt-1 font-mono text-sm text-muted-foreground">{result.voucher.code}</p>
          </div>
        ) : result?.kind === 'used' ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5">
            <p className="flex items-center gap-2 text-lg font-semibold text-amber-700 dark:text-amber-300">
              <Clock3 className="h-5 w-5" aria-hidden="true" /> Ya se usó
            </p>
            <p className="mt-2">{result.voucher.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDate(result.voucher.used_at) ? `Se entregó el ${formatDate(result.voucher.used_at)}.` : 'Ya se entregó antes.'}
            </p>
          </div>
        ) : result?.kind === 'invalid' ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5">
            <p className="flex items-center gap-2 text-lg font-semibold text-destructive">
              <TicketX className="h-5 w-5" aria-hidden="true" /> Código no válido
            </p>
            <p className="mt-1 text-sm text-muted-foreground">No es de esta organización o está mal escrito.</p>
          </div>
        ) : result?.kind === 'error' ? (
          <p className="text-sm text-destructive">No pudimos validar ahora. Probá de nuevo.</p>
        ) : null}
      </div>
    </div>
  );
}
