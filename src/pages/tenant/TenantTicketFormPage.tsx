import { FormEvent, useMemo, useRef, useState } from 'react';
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

  const copyReceipt = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(
        `Código: ${receipt.claim.code}\nPIN: ${receipt.access.pin}`,
      );
      setCopyMessage('Código y PIN copiados.');
    } catch {
      setCopyMessage('No pudimos copiarlo. Guardá el código y el PIN manualmente.');
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
  const { tenant, currentSlug } = useTenant();
  const [categoria, setCategoria] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptState, setReceiptState] = useState<{
    slug: string;
    receipt: TenantClaimIntakeReceipt;
  } | null>(null);
  const submissionAttemptRef = useRef<SubmissionAttempt | null>(null);
  const submittingRef = useRef(false);

  const slug = useMemo(() => {
    const fromContext = tenant?.slug ?? currentSlug;
    if (fromContext && fromContext.trim()) return fromContext.trim();
    if (params.tenant && params.tenant.trim()) return params.tenant.trim();
    return '';
  }, [currentSlug, params.tenant, tenant?.slug]);

  const tenantName = tenant?.nombre ?? 'este espacio';
  const receipt = receiptState?.slug === slug ? receiptState.receipt : null;

  const resetForm = () => {
    setCategoria('');
    setDescripcion('');
    setLat('');
    setLng('');
    setReceiptState(null);
    submissionAttemptRef.current = null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;

    if (!slug) {
      toast({
        title: 'Seleccioná un espacio',
        description: 'Elegí un espacio desde el encabezado antes de enviar un reclamo.',
        variant: 'destructive',
      });
      return;
    }

    if (!descripcion.trim()) {
      toast({
        title: 'La descripción es obligatoria',
        description: 'Contanos qué ocurrió para poder ayudarte.',
        variant: 'destructive',
      });
      return;
    }

    const payload: TenantTicketPayload = {
      categoria: categoria.trim() || undefined,
      descripcion: descripcion.trim(),
      lat: lat.trim() ? Number(lat) : undefined,
      lng: lng.trim() ? Number(lng) : undefined,
    };
    const fingerprint = claimPayloadFingerprint(slug, payload);
    const previousAttempt = submissionAttemptRef.current;
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
    submissionAttemptRef.current = attempt;

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const confirmedReceipt = await submitTenantTicket(slug, payload, attempt.idempotencyKey);
      setReceiptState({ slug, receipt: confirmedReceipt });
    } catch (error) {
      toast({
        title: 'No pudimos enviar tu reclamo',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
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
              <ClaimReceipt receipt={receipt} tenantName={tenantName} onCreateAnother={resetForm} />
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
                      onChange={(event) => setCategoria(event.target.value)}
                      placeholder="Ej: Iluminación, Comercio, Espacio público"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Textarea
                      id="descripcion"
                      value={descripcion}
                      onChange={(event) => setDescripcion(event.target.value)}
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
                        onChange={(event) => setLat(event.target.value)}
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
                        onChange={(event) => setLng(event.target.value)}
                        placeholder="-58.3712"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={isSubmitting}>
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
