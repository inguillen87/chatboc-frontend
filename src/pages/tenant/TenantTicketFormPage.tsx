import { FormEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Copy, ExternalLink, Eye, EyeOff, Loader2 } from 'lucide-react';

import { TenantShell } from '@/components/tenant/TenantShell';
import { useTenant } from '@/context/TenantContext';
import { submitTenantTicket } from '@/api/tenant';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { getErrorMessage } from '@/utils/api';
import type { TenantClaimIntakeReceipt, TenantTicketPayload } from '@/types/tenant';

type SubmissionAttempt = {
  fingerprint: string;
  idempotencyKey: string;
};

type ClaimDraft = {
  categoria: string;
  descripcion: string;
  lat: string;
  lng: string;
  receipt: TenantClaimIntakeReceipt | null;
  receiptFingerprint: string | null;
};

type ClaimScope = { slug: string; ready: boolean };
type PendingSubmission = { scope: ClaimScope; controller: AbortController };

const emptyDraft: ClaimDraft = { categoria: '', descripcion: '', lat: '', lng: '', receipt: null, receiptFingerprint: null };
const normalizeSlug = (value?: string | null) => value?.trim().toLowerCase() || '';

const claimDraftPayload = (draft: ClaimDraft): TenantTicketPayload => ({
  categoria: draft.categoria.trim() || undefined,
  descripcion: draft.descripcion.trim(),
  lat: draft.lat.trim() ? Number(draft.lat) : undefined,
  lng: draft.lng.trim() ? Number(draft.lng) : undefined,
});

const claimPayloadFingerprint = (slug: string, payload: TenantTicketPayload) =>
  JSON.stringify({
    slug,
    categoria: payload.categoria ?? null,
    descripcion: payload.descripcion,
    lat: payload.lat ?? null,
    lng: payload.lng ?? null,
  });

export const createClaimIdempotencyKey = () => {
  const browserCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (browserCrypto?.randomUUID) {
    return `claim-intake-${browserCrypto.randomUUID()}`;
  }

  if (browserCrypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    browserCrypto.getRandomValues(bytes);
    const suffix = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    return `claim-intake-${suffix}`;
  }

  throw new Error('Este navegador no ofrece criptografía segura para enviar el reclamo.');
};

const ClaimReceipt = ({
  receipt,
  tenantName,
  onCreateAnother,
}: {
  receipt: TenantClaimIntakeReceipt;
  tenantName: string;
  onCreateAnother: () => void;
}) => {
  const [showPin, setShowPin] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const copyAttemptRef = useRef<object | null>(null);
  const mountedRef = useRef(false);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      copyAttemptRef.current = null;
    };
  }, []);

  const copyReceipt = async () => {
    const copyAttempt = {};
    copyAttemptRef.current = copyAttempt;
    const isCurrent = () => mountedRef.current && copyAttemptRef.current === copyAttempt;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(
        `Código: ${receipt.claim.code}\nPIN: ${receipt.access.pin}`,
      );
      if (isCurrent()) setCopyMessage('Código y PIN copiados.');
    } catch {
      if (isCurrent()) setCopyMessage('No pudimos copiarlo. Guardá el código y el PIN manualmente.');
    }
  };

  return (
    <div className="space-y-6" data-testid="claim-intake-receipt">
      <div
        className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" aria-hidden="true" />
        <div>
          <p className="font-semibold text-foreground">Tu reclamo quedó registrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {receipt.deduplicated
              ? 'Recuperamos el comprobante del envío anterior sin crear un reclamo duplicado.'
              : `El equipo de ${tenantName} ya puede comenzar a gestionarlo.`}
          </p>
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Código</p>
          <p className="mt-1 font-mono text-xl font-bold" data-testid="claim-code">
            {receipt.claim.code}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">PIN de acceso</p>
          <div className="mt-1 flex items-center gap-2">
            <p className="font-mono text-xl font-bold" data-testid="claim-pin">
              {showPin ? receipt.access.pin : '•'.repeat(receipt.access.pin.length)}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowPin((current) => !current)}
              aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
              aria-pressed={showPin}
            >
              {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Guardá este comprobante. El código y el PIN son necesarios para consultar avances de forma segura.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Button type="button" variant="outline" onClick={() => void copyReceipt()}>
          <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
          Copiar código y PIN
        </Button>
        <Button asChild>
          <a
            href={receipt.tracking.path}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            Ver seguimiento
            <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
          </a>
        </Button>
        <Button type="button" variant="ghost" onClick={onCreateAnother}>
          Crear otro reclamo
        </Button>
      </div>

      {copyMessage ? (
        <p className="text-sm text-muted-foreground" role="status">
          {copyMessage}
        </p>
      ) : null}
    </div>
  );
};

const TenantTicketFormPage = () => {
  const params = useParams<{ tenant: string }>();
  const { tenant, currentSlug, isLoadingTenant, tenantError } = useTenant();
  const [drafts, setDrafts] = useState(() => new Map<string, ClaimDraft>());
  const [submission, setSubmission] = useState<PendingSubmission | null>(null);
  const submissionAttemptsRef = useRef(new Map<string, SubmissionAttempt>());
  const activeSubmissionRef = useRef<PendingSubmission | null>(null);
  const currentScopeRef = useRef<ClaimScope | null>(null);

  // The route changes before TenantProvider finishes confirming its new profile.
  const slug = normalizeSlug(params.tenant) || normalizeSlug(currentSlug);
  const tenantReady = Boolean(
    slug && normalizeSlug(tenant?.slug) === slug && normalizeSlug(currentSlug) === slug && !isLoadingTenant && !tenantError,
  );
  const scope = useMemo(() => ({ slug, ready: tenantReady }), [slug, tenantReady]);
  useLayoutEffect(() => {
    currentScopeRef.current = scope;
    return () => {
      if (currentScopeRef.current === scope) currentScopeRef.current = null;
      const retired = activeSubmissionRef.current;
      if (retired?.scope === scope) {
        activeSubmissionRef.current = null;
        retired.controller.abort();
      }
    };
  }, [scope]);

  const draft = drafts.get(slug) ?? emptyDraft;
  const { categoria, descripcion, lat, lng } = draft;
  const isSubmitting = submission?.scope === scope;
  const tenantName = tenantReady ? tenant?.nombre ?? 'este espacio' : 'este espacio';
  const receipt = tenantReady ? draft.receipt : null;
  const updateDraft = (update: (current: ClaimDraft) => ClaimDraft) => {
    setDrafts((current) => {
      const next = new Map(current);
      next.set(slug, update(current.get(slug) ?? emptyDraft));
      return next;
    });
  };
  const setField = (field: 'categoria' | 'descripcion' | 'lat' | 'lng', value: string) =>
    updateDraft((current) => ({ ...current, [field]: value }));

  const resetForm = () => {
    updateDraft(() => emptyDraft);
    submissionAttemptsRef.current.delete(slug);
  };

  const createAnotherClaim = () => {
    updateDraft((current) =>
      claimPayloadFingerprint(slug, claimDraftPayload(current)) === current.receiptFingerprint
        ? emptyDraft
        : { ...current, receipt: null, receiptFingerprint: null },
    );
    submissionAttemptsRef.current.delete(slug);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (activeSubmissionRef.current?.scope === scope || currentScopeRef.current !== scope) return;

    if (!slug) {
      toast({
        title: 'Seleccioná un espacio',
        description: 'Elegí un espacio desde el encabezado antes de enviar un reclamo.',
        variant: 'destructive',
      });
      return;
    }

    if (!tenantReady) return;

    if (!descripcion.trim()) {
      toast({
        title: 'La descripción es obligatoria',
        description: 'Contanos qué ocurrió para poder ayudarte.',
        variant: 'destructive',
      });
      return;
    }

    const payload = claimDraftPayload(draft);
    const fingerprint = claimPayloadFingerprint(slug, payload);
    const previousAttempt = submissionAttemptsRef.current.get(slug);
    let attempt: SubmissionAttempt;
    try {
      attempt =
        previousAttempt?.fingerprint === fingerprint
          ? previousAttempt
          : { fingerprint, idempotencyKey: createClaimIdempotencyKey() };
    } catch (error) {
      toast({
        title: 'No pudimos preparar el envío',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return;
    }
    submissionAttemptsRef.current.set(slug, attempt);

    // A retry can reuse the key, but each running request has its own owner.
    const pending = { scope, controller: new AbortController() };
    activeSubmissionRef.current = pending;
    setSubmission(pending);
    const isCurrent = () => currentScopeRef.current === scope && activeSubmissionRef.current === pending;
    try {
      const confirmedReceipt = await submitTenantTicket(slug, payload, attempt.idempotencyKey, {
        signal: pending.controller.signal,
        isCurrent,
      });
      if (isCurrent()) updateDraft((current) => ({ ...current, receipt: confirmedReceipt, receiptFingerprint: fingerprint }));
    } catch (error) {
      if (isCurrent()) {
        toast({
          title: 'No pudimos enviar tu reclamo',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      }
    } finally {
      if (isCurrent()) {
        activeSubmissionRef.current = null;
        setSubmission(null);
      }
    }
  };

  return (
    <TenantShell>
      {!slug ? (
        <Card>
          <CardHeader>
            <CardTitle>Seleccioná un espacio</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Elegí un espacio para registrar reclamos, sugerencias o consultas.
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>{receipt ? 'Comprobante del reclamo' : 'Nuevo reclamo o solicitud'}</CardTitle>
          </CardHeader>
          <CardContent>
            {receipt ? (
              <ClaimReceipt key={`${slug}:${receipt.request_id}`} receipt={receipt} tenantName={tenantName} onCreateAnother={createAnotherClaim} />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  El equipo de {tenantName} recibirá este reporte de inmediato. Cuantos más detalles compartas, más rápido podrán resolverlo.
                </p>
                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="categoria">Tema o categoría (opcional)</Label>
                    <Input
                      id="categoria"
                      value={categoria}
                      onChange={(event) => setField('categoria', event.target.value)}
                      placeholder="Ej: Iluminación, Comercio, Espacio público"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Textarea
                      id="descripcion"
                      value={descripcion}
                      onChange={(event) => setField('descripcion', event.target.value)}
                      placeholder="Describí qué ocurrió, dónde y cuándo. Podés sumar datos de contacto si querés seguimiento personalizado."
                      rows={6}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="lat">Latitud (opcional)</Label>
                      <Input
                        id="lat"
                        type="number"
                        step="any"
                        value={lat}
                        onChange={(event) => setField('lat', event.target.value)}
                        placeholder="-34.6083"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lng">Longitud (opcional)</Label>
                      <Input
                        id="lng"
                        type="number"
                        step="any"
                        value={lng}
                        onChange={(event) => setField('lng', event.target.value)}
                        placeholder="-58.3712"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={isSubmitting || !tenantReady}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Enviar reclamo
                    </Button>
                    <Button type="button" variant="outline" disabled={isSubmitting} onClick={resetForm}>
                      Limpiar
                    </Button>
                  </div>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </TenantShell>
  );
};

export default TenantTicketFormPage;
