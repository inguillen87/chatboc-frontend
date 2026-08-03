import { useEffect, useRef, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clipboard,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import {
  getSurveyEligibilitySummary,
  issueSurveyEligibilityGrant,
  listSurveyEligibilityReleaseScopes,
  revokeSurveyEligibilityGrant,
  SURVEY_ELIGIBILITY_GRANT_REF_PATTERN,
  SURVEY_ELIGIBILITY_REVIEW_REFERENCE_PATTERN,
  SURVEY_ELIGIBILITY_SUBJECT_REF_PATTERN,
} from '@/api/surveyEligibilityAdmin';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  SurveyEligibilityIssueReceipt,
  SurveyEligibilityReleaseScope,
  SurveyEligibilityRevocationReason,
  SurveyEligibilitySummary,
} from '@/types/surveyEligibilityAdmin';
import { getErrorMessage } from '@/utils/api';

type PendingAttempt = { fingerprint: string; key: string };
type Operation = 'issue' | 'revoke' | null;

const REVOCATION_OPTIONS: Array<{ value: SurveyEligibilityRevocationReason; label: string }> = [
  { value: 'administrative_revocation', label: 'Revocación administrativa' },
  { value: 'subject_ineligible', label: 'Persona no elegible' },
  { value: 'credential_compromised', label: 'Credencial comprometida' },
  { value: 'duplicate_issue', label: 'Emisión duplicada' },
  { value: 'other_reviewed', label: 'Otro motivo revisado' },
];

const MODE_LABELS: Record<SurveyEligibilityReleaseScope['mode'], string> = {
  institution_attested: 'Acreditación institucional',
  manual_review: 'Revisión manual',
};

const createSecureNonce = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('No hay un generador criptográfico seguro disponible. La operación quedó bloqueada.');
};

export const createSurveyEligibilityIdempotencyKey = (
  operation: Exclude<Operation, null>,
  surveyId: number,
  releaseId: number,
) => `survey-eligibility:${operation}:${surveyId}:${releaseId}:${createSecureNonce()}`;

const getAttemptKey = (
  ref: React.MutableRefObject<PendingAttempt | null>,
  fingerprint: string,
  operation: Exclude<Operation, null>,
  surveyId: number,
  releaseId: number,
) => {
  if (ref.current?.fingerprint === fingerprint) return ref.current.key;
  const key = createSurveyEligibilityIdempotencyKey(operation, surveyId, releaseId);
  ref.current = { fingerprint, key };
  return key;
};

const toOptionalIsoTimestamp = (value: string): string | undefined => {
  if (!value.trim()) return undefined;
  const timestamp = new Date(value);
  if (!Number.isFinite(timestamp.getTime())) {
    throw new Error('Ingresá un vencimiento válido.');
  }
  const now = Date.now();
  if (timestamp.getTime() <= now + 5 * 60_000 || timestamp.getTime() > now + 366 * 24 * 60 * 60_000) {
    throw new Error('El vencimiento debe estar entre 5 minutos y 366 días desde ahora.');
  }
  return timestamp.toISOString();
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('es-AR') : 'Fecha no disponible';
};

interface SurveyEligibilityAdminPanelProps {
  surveyId: number;
  tenantSlug?: string | null;
}

export function SurveyEligibilityAdminPanel({
  surveyId,
  tenantSlug,
}: SurveyEligibilityAdminPanelProps) {
  const normalizedTenant = tenantSlug?.trim() ?? '';
  const scopeKey = `${normalizedTenant.toLowerCase()}:${surveyId}`;
  const activeScopeRef = useRef(scopeKey);
  const issueAttemptRef = useRef<PendingAttempt | null>(null);
  const revokeAttemptRef = useRef<PendingAttempt | null>(null);
  const inFlightRef = useRef<Operation>(null);

  const [releases, setReleases] = useState<SurveyEligibilityReleaseScope[]>([]);
  const [releasesScopeKey, setReleasesScopeKey] = useState('');
  const [selectedReleaseId, setSelectedReleaseId] = useState<number | null>(null);
  const [releasesLoading, setReleasesLoading] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  const [summary, setSummary] = useState<SurveyEligibilitySummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryVersion, setSummaryVersion] = useState(0);

  const [subjectRef, setSubjectRef] = useState('');
  const [reviewReference, setReviewReference] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [credential, setCredential] = useState<string | null>(null);
  const [credentialVisible, setCredentialVisible] = useState(false);
  const [issuedReceipt, setIssuedReceipt] = useState<Omit<SurveyEligibilityIssueReceipt, 'credential'> | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const [grantRef, setGrantRef] = useState('');
  const [revocationReason, setRevocationReason] =
    useState<SurveyEligibilityRevocationReason>('administrative_revocation');
  const [operation, setOperation] = useState<Operation>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationStatus, setOperationStatus] = useState<string | null>(null);

  const selectedRelease = releases.find((release) => release.releaseId === selectedReleaseId) ?? null;

  const clearCredential = (message?: string) => {
    setCredential(null);
    setCredentialVisible(false);
    setCopyStatus(message ?? null);
  };

  useEffect(() => {
    activeScopeRef.current = scopeKey;
    issueAttemptRef.current = null;
    revokeAttemptRef.current = null;
    inFlightRef.current = null;
    setReleases([]);
    setReleasesScopeKey('');
    setSelectedReleaseId(null);
    setSummary(null);
    setSummaryError(null);
    setIssuedReceipt(null);
    setGrantRef('');
    setSubjectRef('');
    setReviewReference('');
    setExpiresAt('');
    setOperationError(null);
    setOperationStatus(null);
    clearCredential();

    if (!normalizedTenant || !Number.isSafeInteger(surveyId) || surveyId <= 0) {
      setReleaseError('No se pudo verificar el tenant y la encuesta. La gestión de elegibilidad quedó bloqueada.');
      return undefined;
    }

    let current = true;
    setReleasesLoading(true);
    setReleaseError(null);
    void listSurveyEligibilityReleaseScopes(surveyId, normalizedTenant)
      .then((items) => {
        if (!current || activeScopeRef.current !== scopeKey) return;
        setReleases(items);
        setReleasesScopeKey(scopeKey);
        const preferred = items.find((item) => item.active) ?? items[0] ?? null;
        setSelectedReleaseId(preferred?.releaseId ?? null);
      })
      .catch((error) => {
        if (!current || activeScopeRef.current !== scopeKey) return;
        setReleaseError(getErrorMessage(error, 'No se pudieron verificar los releases de elegibilidad.'));
      })
      .finally(() => {
        if (current && activeScopeRef.current === scopeKey) setReleasesLoading(false);
      });

    return () => {
      current = false;
      if (activeScopeRef.current === scopeKey) activeScopeRef.current = '';
    };
  }, [normalizedTenant, reloadVersion, scopeKey, surveyId]);

  useEffect(() => {
    issueAttemptRef.current = null;
    revokeAttemptRef.current = null;
    setIssuedReceipt(null);
    setGrantRef('');
    setOperationError(null);
    setOperationStatus(null);
    clearCredential();
  }, [scopeKey, selectedReleaseId]);

  useEffect(() => {
    setSummary(null);
    setSummaryError(null);
    if (!selectedRelease || !normalizedTenant || releasesScopeKey !== scopeKey) return undefined;

    const requestScope = `${scopeKey}:${selectedRelease.releaseId}`;
    let current = true;
    setSummaryLoading(true);
    void getSurveyEligibilitySummary(selectedRelease, normalizedTenant)
      .then((nextSummary) => {
        if (!current || `${activeScopeRef.current}:${selectedRelease.releaseId}` !== requestScope) return;
        setSummary(nextSummary);
      })
      .catch((error) => {
        if (!current || `${activeScopeRef.current}:${selectedRelease.releaseId}` !== requestScope) return;
        setSummaryError(
          getErrorMessage(
            error,
            'El backend no autorizó o no confirmó este scope de elegibilidad. Las acciones quedaron bloqueadas.',
          ),
        );
      })
      .finally(() => {
        if (current && `${activeScopeRef.current}:${selectedRelease.releaseId}` === requestScope) {
          setSummaryLoading(false);
        }
      });

    return () => {
      current = false;
    };
  }, [normalizedTenant, releasesScopeKey, scopeKey, selectedReleaseId, summaryVersion]);

  const refreshSummary = () => setSummaryVersion((value) => value + 1);

  const issueGrant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlightRef.current || !selectedRelease || !summary || !normalizedTenant) return;
    const normalizedSubject = subjectRef.trim();
    const normalizedReview = reviewReference.trim();
    if (!SURVEY_ELIGIBILITY_SUBJECT_REF_PATTERN.test(normalizedSubject)) {
      setOperationError('subject_ref debe comenzar con subj_ y contener 43 caracteres opacos; no uses DNI, email ni teléfono.');
      return;
    }
    if (!SURVEY_ELIGIBILITY_REVIEW_REFERENCE_PATTERN.test(normalizedReview)) {
      setOperationError('La referencia de revisión debe ser opaca y namespaced, por ejemplo review:caso-00000001.');
      return;
    }

    let normalizedExpiry: string | undefined;
    try {
      normalizedExpiry = toOptionalIsoTimestamp(expiresAt);
    } catch (error) {
      setOperationError(getErrorMessage(error, 'El vencimiento no es válido.'));
      return;
    }

    const requestScope = activeScopeRef.current;
    const fingerprint = JSON.stringify({
      requestScope,
      releaseId: selectedRelease.releaseId,
      subjectRef: normalizedSubject,
      reviewReference: normalizedReview,
      expiresAt: normalizedExpiry ?? null,
    });
    let idempotencyKey: string;
    try {
      idempotencyKey = getAttemptKey(
        issueAttemptRef,
        fingerprint,
        'issue',
        surveyId,
        selectedRelease.releaseId,
      );
    } catch (error) {
      setOperationError(getErrorMessage(error));
      return;
    }

    inFlightRef.current = 'issue';
    setOperation('issue');
    setOperationError(null);
    setOperationStatus(null);
    setIssuedReceipt(null);
    clearCredential();
    try {
      const receipt = await issueSurveyEligibilityGrant(
        selectedRelease,
        {
          subjectRef: normalizedSubject,
          reviewReference: normalizedReview,
          expiresAt: normalizedExpiry,
        },
        idempotencyKey,
        normalizedTenant,
      );
      if (activeScopeRef.current !== requestScope) return;
      const { credential: issuedCredential, ...safeReceipt } = receipt;
      setIssuedReceipt(safeReceipt);
      setGrantRef(receipt.grantRef);
      setCredential(issuedCredential);
      setCredentialVisible(false);
      setSubjectRef('');
      setReviewReference('');
      setExpiresAt('');
      issueAttemptRef.current = null;
      setOperationStatus(
        issuedCredential
          ? receipt.replayed
            ? 'Emisión recuperada de forma idempotente. La credencial está lista para copiar.'
            : 'Emisión durable confirmada. La credencial está lista para copiar.'
          : `El grant está ${receipt.state} y no tiene una credencial activa para entregar.`,
      );
      refreshSummary();
    } catch (error) {
      if (activeScopeRef.current === requestScope) {
        setOperationError(
          `${getErrorMessage(error, 'No se pudo confirmar la emisión.')} La misma solicitud conservará su clave idempotente al reintentar.`,
        );
      }
    } finally {
      if (inFlightRef.current === 'issue') inFlightRef.current = null;
      if (activeScopeRef.current === requestScope) setOperation(null);
    }
  };

  const copyCredential = async () => {
    if (!credential) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard_unavailable');
      await navigator.clipboard.writeText(credential);
      setCopyStatus('Credencial copiada. Entregala por un canal seguro y luego borrala de esta pantalla.');
    } catch {
      setCopyStatus('No se pudo copiar automáticamente. Podés mostrarla y copiarla manualmente.');
    }
  };

  const revokeGrant = async () => {
    if (inFlightRef.current || !selectedRelease || !summary || !normalizedTenant) return;
    const normalizedGrantRef = grantRef.trim();
    if (!SURVEY_ELIGIBILITY_GRANT_REF_PATTERN.test(normalizedGrantRef)) {
      setOperationError('La referencia debe tener el formato opaco seg1_ esperado.');
      return;
    }
    const requestScope = activeScopeRef.current;
    const fingerprint = JSON.stringify({
      requestScope,
      releaseId: selectedRelease.releaseId,
      grantRef: normalizedGrantRef,
      reasonCode: revocationReason,
    });
    let idempotencyKey: string;
    try {
      idempotencyKey = getAttemptKey(
        revokeAttemptRef,
        fingerprint,
        'revoke',
        surveyId,
        selectedRelease.releaseId,
      );
    } catch (error) {
      setOperationError(getErrorMessage(error));
      return;
    }

    inFlightRef.current = 'revoke';
    setOperation('revoke');
    setOperationError(null);
    setOperationStatus(null);
    if (issuedReceipt?.grantRef === normalizedGrantRef) clearCredential();
    try {
      const receipt = await revokeSurveyEligibilityGrant(
        selectedRelease,
        normalizedGrantRef,
        revocationReason,
        idempotencyKey,
        normalizedTenant,
      );
      if (activeScopeRef.current !== requestScope) return;
      revokeAttemptRef.current = null;
      setGrantRef('');
      setOperationStatus(
        receipt.replayed
          ? 'La revocación durable ya existía y fue recuperada de forma idempotente.'
          : 'Revocación durable confirmada.',
      );
      refreshSummary();
    } catch (error) {
      if (activeScopeRef.current === requestScope) {
        setOperationError(
          `${getErrorMessage(error, 'No se pudo confirmar la revocación.')} La misma solicitud conservará su clave idempotente al reintentar.`,
        );
      }
    } finally {
      if (inFlightRef.current === 'revoke') inFlightRef.current = null;
      if (activeScopeRef.current === requestScope) setOperation(null);
    }
  };

  const actionsEnabled = Boolean(
    selectedRelease?.planAllowsWrite && summary && !summaryLoading && !summaryError,
  );

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              Elegibilidad opaca
            </CardTitle>
            <CardDescription>
              Emisión y revocación auditables para releases restringidos. No persiste padrón, DNI, email ni credenciales en storage, caché, URL o logs.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReloadVersion((value) => value + 1)}
            disabled={releasesLoading || operation !== null}
          >
            {releasesLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Recargar releases
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {releaseError ? (
          <Alert variant="destructive">
            <Ban className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Gestión bloqueada</AlertTitle>
            <AlertDescription>{releaseError}</AlertDescription>
          </Alert>
        ) : null}

        {!releaseError && !releasesLoading && releases.length === 0 ? (
          <Alert>
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Sin release restringido publicado</AlertTitle>
            <AlertDescription>
              Publicá primero un release de gobernanza con acreditación institucional o revisión manual. Los modos abiertos no usan credenciales.
            </AlertDescription>
          </Alert>
        ) : null}

        {releases.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="survey-eligibility-release">Release autorizado</Label>
            <Select
              value={selectedReleaseId ? String(selectedReleaseId) : undefined}
              onValueChange={(value) => setSelectedReleaseId(Number(value))}
              disabled={operation !== null}
            >
              <SelectTrigger id="survey-eligibility-release" aria-describedby="survey-eligibility-release-help">
                <SelectValue placeholder="Seleccioná un release" />
              </SelectTrigger>
              <SelectContent>
                {releases.map((release) => (
                  <SelectItem key={release.releaseId} value={String(release.releaseId)}>
                    v{release.versionNumber} · {MODE_LABELS[release.mode]}{release.active ? ' · activo' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p id="survey-eligibility-release-help" className="text-xs text-muted-foreground">
              El tenant, la encuesta, el release y la política se reconcilian antes de habilitar acciones.
            </p>
          </div>
        ) : null}

        {summaryLoading ? (
          <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Verificando capability y resumen del release…
          </div>
        ) : null}

        {summaryError ? (
          <Alert variant="destructive">
            <Ban className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Capability no confirmada</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{summaryError}</p>
              <Button type="button" variant="outline" size="sm" onClick={refreshSummary}>
                Reintentar verificación
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {summary ? (
          <section aria-labelledby="survey-eligibility-summary-title" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="survey-eligibility-summary-title" className="font-semibold">
                Estado del release v{selectedRelease?.versionNumber}
              </h3>
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Scope y capability confirmados
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {([
                ['Emitidas', summary.counts.issued],
                ['Activas', summary.counts.active],
                ['Redimidas', summary.counts.redeemed],
                ['Revocadas', summary.counts.revoked],
                ['Vencidas', summary.counts.expired],
              ] as const).map(([label, value]) => (
                <div key={label} className="rounded-lg border bg-muted/20 p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-xl font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              Población elegible, participación y abstención: no disponibles. Este release no tiene un padrón sellado y no se inventan denominadores.
            </p>
          </section>
        ) : null}

        {summary && selectedRelease && !selectedRelease.planAllowsWrite ? (
          <Alert variant="destructive">
            <Ban className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Plan sin escritura habilitada</AlertTitle>
            <AlertDescription>
              El backend autorizó la lectura del resumen, pero el contrato del tenant no habilita emitir ni revocar grants.
            </AlertDescription>
          </Alert>
        ) : null}

        {actionsEnabled ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <form className="space-y-4 rounded-xl border p-4" onSubmit={issueGrant}>
              <div>
                <h3 className="font-semibold">Emitir credencial</h3>
                <p className="text-xs text-muted-foreground">
                  Sólo referencias opacas provenientes de la revisión autorizada. Nunca pegues datos personales.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="survey-eligibility-subject">subject_ref opaco</Label>
                <Input
                  id="survey-eligibility-subject"
                  value={subjectRef}
                  onChange={(event) => setSubjectRef(event.target.value)}
                  placeholder="subj_…"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="survey-eligibility-subject-help"
                  disabled={operation !== null}
                />
                <p id="survey-eligibility-subject-help" className="text-xs text-muted-foreground">
                  Formato: subj_ más 43 caracteres URL-safe. No uses DNI, email ni teléfono.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="survey-eligibility-review">Referencia de revisión</Label>
                <Input
                  id="survey-eligibility-review"
                  value={reviewReference}
                  onChange={(event) => setReviewReference(event.target.value)}
                  placeholder="review:caso-00000001"
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby="survey-eligibility-review-help"
                  disabled={operation !== null}
                />
                <p id="survey-eligibility-review-help" className="text-xs text-muted-foreground">
                  Referencia opaca y namespaced de evidencia humana; el backend persiste sólo su HMAC.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="survey-eligibility-expiry">Vencimiento opcional</Label>
                <Input
                  id="survey-eligibility-expiry"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  disabled={operation !== null}
                />
                <p className="text-xs text-muted-foreground">Si se omite, el backend aplica 30 días y limita por la ventana del release.</p>
              </div>
              <Button type="submit" disabled={operation !== null}>
                {operation === 'issue' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                Emitir con revisión humana
              </Button>
            </form>

            <section className="space-y-4 rounded-xl border p-4" aria-labelledby="survey-eligibility-revoke-title">
              <div>
                <h3 id="survey-eligibility-revoke-title" className="font-semibold">Revocar grant</h3>
                <p className="text-xs text-muted-foreground">
                  La revocación es terminal. Requiere referencia opaca, motivo permitido y confirmación explícita.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="survey-eligibility-grant-ref">grant_ref</Label>
                <Input
                  id="survey-eligibility-grant-ref"
                  value={grantRef}
                  onChange={(event) => setGrantRef(event.target.value)}
                  placeholder="seg1_…"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={operation !== null}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="survey-eligibility-reason">Motivo revisado</Label>
                <Select
                  value={revocationReason}
                  onValueChange={(value) => setRevocationReason(value as SurveyEligibilityRevocationReason)}
                  disabled={operation !== null}
                >
                  <SelectTrigger id="survey-eligibility-reason">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REVOCATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={operation !== null || !SURVEY_ELIGIBILITY_GRANT_REF_PATTERN.test(grantRef.trim())}
                  >
                    {operation === 'revoke' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Ban className="mr-2 h-4 w-4" aria-hidden="true" />
                    )}
                    Revocar credencial
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Confirmar revocación terminal?</AlertDialogTitle>
                    <AlertDialogDescription>
                      El grant dejará de admitir respuestas. Esta acción se registra con auditoría e idempotencia y no expone a la persona.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={operation !== null}>Volver</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={operation !== null}
                      onClick={() => void revokeGrant()}
                    >
                      Confirmar revocación
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </section>
          </div>
        ) : null}

        {issuedReceipt ? (
          <Alert>
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Recibo durable del grant</AlertTitle>
            <AlertDescription>
              <p>
                {issuedReceipt.grantRef} · generación {issuedReceipt.generation} · vence {formatTimestamp(issuedReceipt.expiresAt)}
              </p>
              <p className="mt-1 text-xs">
                Garantía: vínculo seudónimo interno con revisión humana. No certifica secreto de voto, elección regulada ni resultados.
              </p>
            </AlertDescription>
          </Alert>
        ) : null}

        {credential ? (
          <section className="space-y-3 rounded-xl border border-amber-500/50 bg-amber-500/5 p-4" aria-labelledby="survey-eligibility-credential-title">
            <div>
              <h3 id="survey-eligibility-credential-title" className="font-semibold text-amber-700 dark:text-amber-300">
                Credencial de entrega única
              </h3>
              <p id="survey-eligibility-credential-help" className="text-xs text-muted-foreground">
                Vive sólo en memoria de esta vista. No se guarda en React Query, storage, URL ni logs. Borrarla no limpia el portapapeles del sistema.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="Credencial de elegibilidad emitida"
                aria-describedby="survey-eligibility-credential-help"
                type={credentialVisible ? 'text' : 'password'}
                value={credential}
                readOnly
                autoComplete="one-time-code"
                spellCheck={false}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setCredentialVisible((visible) => !visible)}
                aria-pressed={credentialVisible}
              >
                {credentialVisible ? <EyeOff className="mr-2 h-4 w-4" aria-hidden="true" /> : <Eye className="mr-2 h-4 w-4" aria-hidden="true" />}
                {credentialVisible ? 'Ocultar' : 'Mostrar'}
              </Button>
              <Button type="button" variant="outline" onClick={() => void copyCredential()}>
                <Clipboard className="mr-2 h-4 w-4" aria-hidden="true" />
                Copiar
              </Button>
              <Button type="button" variant="destructive" onClick={() => clearCredential('Credencial borrada de esta pantalla.')}>
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                Borrar credencial
              </Button>
            </div>
          </section>
        ) : null}

        <div aria-live="polite" className="space-y-2">
          {operationStatus ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{operationStatus}</p> : null}
          {copyStatus ? <p className="text-sm text-muted-foreground">{copyStatus}</p> : null}
        </div>
        {operationError ? (
          <Alert variant="destructive">
            <Ban className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Operación no confirmada</AlertTitle>
            <AlertDescription>{operationError}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default SurveyEligibilityAdminPanel;
