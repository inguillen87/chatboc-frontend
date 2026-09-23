import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileCheck2,
  Fingerprint,
  Loader2,
  MapPinned,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';

import {
  getGovernmentJurisdictionReadiness,
  reviewGovernmentJurisdictionEvidence,
  submitGovernmentJurisdictionEvidence,
  type GovernmentJurisdictionReadiness,
  type GovernmentJurisdictionReviewInput,
  type GovernmentJurisdictionState,
} from '@/api/v2/governmentJurisdiction';
import { useClerkRuntime } from '@/components/auth/ClerkRuntimeContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  resolveClerkStepUpErrorMessage,
  useClerkStepUpAction,
} from '@/hooks/useClerkStepUpAction';
import { ApiError, NetworkError } from '@/utils/api';
import { cn } from '@/lib/utils';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const JURISDICTION_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{2,159}$/;
const EVIDENCE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{2,199}$/;
const REASON_CODE_PATTERN = /^[a-z][a-z0-9_.:-]{2,79}$/;

const statePresentation: Record<GovernmentJurisdictionState, {
  label: string;
  title: string;
  description: string;
  icon: React.ElementType;
  badgeClassName: string;
}> = {
  unverified: {
    label: 'Evidencia pendiente',
    title: 'Acreditar el alcance institucional',
    description: 'El organismo todavía no presentó un respaldo auditable de la jurisdicción que utilizará la solución.',
    icon: MapPinned,
    badgeClassName: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-100',
  },
  evidence_submitted: {
    label: 'En revisión independiente',
    title: 'Evidencia presentada',
    description: 'La presentación quedó registrada y espera una decisión de una cuenta de plataforma autorizada.',
    icon: Clock3,
    badgeClassName: 'border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-100',
  },
  rejected: {
    label: 'Requiere corrección',
    title: 'La presentación fue observada',
    description: 'El organismo debe corregir la referencia o el respaldo y presentar una nueva huella documental.',
    icon: RotateCcw,
    badgeClassName: 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-100',
  },
  verified: {
    label: 'Verificada',
    title: 'Jurisdicción verificada',
    description: 'La revisión independiente coincide con la presentación vigente y el guard territorial está habilitado.',
    icon: CheckCircle2,
    badgeClassName: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100',
  },
  invalid_verified_record: {
    label: 'Registro inconsistente',
    title: 'La verificación necesita soporte',
    description: 'El estado almacenado no contiene toda la evidencia exigida. La publicación permanece protegida.',
    icon: ShieldX,
    badgeClassName: 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-100',
  },
  not_applicable: {
    label: 'Alcance declarado',
    title: 'Revisar requisito jurisdiccional',
    description: 'El contrato indica si este tenant debe presentar evidencia antes de publicar participación ciudadana.',
    icon: ShieldCheck,
    badgeClassName: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-200',
  },
};

const nextActionCopy: Record<GovernmentJurisdictionReadiness['next_action'], string> = {
  submit_jurisdiction_evidence: 'Presentar el respaldo institucional',
  await_platform_jurisdiction_review: 'Esperar la revisión independiente',
  resubmit_jurisdiction_evidence: 'Corregir y volver a presentar',
  review_survey_content: 'Revisar el contenido de las encuestas',
  contact_platform_support: 'Solicitar corrección a soporte de plataforma',
  continue_tenant_configuration: 'Continuar la configuración del organismo',
};

const safeErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    const message = error.body?.error?.message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  if (error instanceof Error && error.message === 'government_jurisdiction_contract_invalid') {
    return 'La plataforma respondió con un estado jurisdiccional inválido. No se habilitó ninguna acción.';
  }
  return fallback;
};

const isUncertainWriteError = (error: unknown) =>
  error instanceof NetworkError || !(error instanceof ApiError) || error.status >= 500;

const normalizeTenantSlug = (value: string) => value.trim().toLowerCase();

const createIdempotencyKey = (prefix: string) => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}:${uuid}`;
  const bytes = new Uint8Array(16);
  globalThis.crypto?.getRandomValues?.(bytes);
  const entropy = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${prefix}:${Date.now().toString(36)}:${entropy}`;
};

const formatTimestamp = (value: string | null) => {
  if (!value) return 'Sin fecha publicada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const compactDigest = (value: string | null) =>
  value ? `${value.slice(0, 12)}…${value.slice(-8)}` : 'No publicada';

interface GovernmentJurisdictionReadinessPanelProps {
  tenantSlug: string;
  canSubmitEvidence: boolean;
  canReview: boolean;
  onReadinessChange?: (readiness: GovernmentJurisdictionReadiness) => void;
}

interface GovernmentJurisdictionReadinessPanelContentProps
  extends GovernmentJurisdictionReadinessPanelProps {
  reviewAction: typeof reviewGovernmentJurisdictionEvidence;
}

interface WriteAttempt {
  fingerprint: string;
  key: string;
}

interface RequestScope {
  tenantSlug: string;
  generation: number;
}

type ReviewDecision = 'verify' | 'reject';

const EvidenceForm = ({
  readiness,
  disabled,
  values,
  errors,
  onChange,
  onConfirm,
}: {
  readiness: GovernmentJurisdictionReadiness;
  disabled: boolean;
  values: { jurisdictionRef: string; evidenceRef: string; evidenceSha256: string };
  errors: Partial<Record<keyof typeof values, string>>;
  onChange: (field: keyof typeof values, value: string) => void;
  onConfirm: () => void;
}) => (
  <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.045] p-4 sm:p-5">
    <div className="flex items-start gap-3">
      <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden="true" />
      <div>
        <h3 className="font-semibold text-foreground">
          {readiness.state === 'rejected' ? 'Corregir la evidencia' : 'Presentar evidencia institucional'}
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Registrá identificadores internos y la huella SHA-256 del documento. No pegues archivos, enlaces firmados, credenciales ni datos personales.
        </p>
      </div>
    </div>

    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="government-jurisdiction-ref">Referencia de jurisdicción</Label>
        <Input
          id="government-jurisdiction-ref"
          value={values.jurisdictionRef}
          onChange={(event) => onChange('jurisdictionRef', event.target.value)}
          placeholder="jurisdiccion:organismo:alcance"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="government-jurisdiction-ref-help government-jurisdiction-ref-error"
          aria-invalid={Boolean(errors.jurisdictionRef)}
          disabled={disabled}
        />
        <p id="government-jurisdiction-ref-help" className="text-xs leading-5 text-muted-foreground">
          Código institucional opaco; no es un domicilio ni una URL pública.
        </p>
        {errors.jurisdictionRef ? <p id="government-jurisdiction-ref-error" className="text-xs text-red-600 dark:text-red-300">{errors.jurisdictionRef}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="government-evidence-ref">Referencia del respaldo</Label>
        <Input
          id="government-evidence-ref"
          value={values.evidenceRef}
          onChange={(event) => onChange('evidenceRef', event.target.value)}
          placeholder="evidencia:expediente:0001"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="government-evidence-ref-help government-evidence-ref-error"
          aria-invalid={Boolean(errors.evidenceRef)}
          disabled={disabled}
        />
        <p id="government-evidence-ref-help" className="text-xs leading-5 text-muted-foreground">
          Identificador interno sin enlaces, correos, claves ni parámetros de acceso.
        </p>
        {errors.evidenceRef ? <p id="government-evidence-ref-error" className="text-xs text-red-600 dark:text-red-300">{errors.evidenceRef}</p> : null}
      </div>
      <div className="space-y-2 lg:col-span-2">
        <Label htmlFor="government-evidence-sha256">Huella SHA-256 del documento</Label>
        <Input
          id="government-evidence-sha256"
          value={values.evidenceSha256}
          onChange={(event) => onChange('evidenceSha256', event.target.value.toLowerCase())}
          placeholder="64 caracteres hexadecimales"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          maxLength={64}
          className="font-mono text-xs"
          aria-describedby="government-evidence-sha256-help government-evidence-sha256-error"
          aria-invalid={Boolean(errors.evidenceSha256)}
          disabled={disabled}
        />
        <p id="government-evidence-sha256-help" className="text-xs leading-5 text-muted-foreground">
          La huella permite comprobar integridad. El documento y su contenido no se guardan en este registro.
        </p>
        {errors.evidenceSha256 ? <p id="government-evidence-sha256-error" className="text-xs text-red-600 dark:text-red-300">{errors.evidenceSha256}</p> : null}
      </div>
    </div>

    <div className="mt-4 flex flex-col gap-3 border-t border-blue-500/15 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs leading-5 text-muted-foreground">
        Presentar evidencia no verifica la jurisdicción ni habilita por sí sola la publicación.
      </p>
      <Button type="button" onClick={onConfirm} disabled={disabled} className="shrink-0">
        <FileCheck2 className="mr-2 h-4 w-4" aria-hidden="true" />
        Presentar para revisión
      </Button>
    </div>
  </div>
);

const GovernmentJurisdictionReadinessPanelContent: React.FC<GovernmentJurisdictionReadinessPanelContentProps> = ({
  tenantSlug,
  canSubmitEvidence,
  canReview,
  onReadinessChange,
  reviewAction,
}) => {
  const normalizedTenant = normalizeTenantSlug(tenantSlug);
  const activeScopeRef = React.useRef<RequestScope>({ tenantSlug: normalizedTenant, generation: 0 });
  if (activeScopeRef.current.tenantSlug !== normalizedTenant) {
    activeScopeRef.current = {
      tenantSlug: normalizedTenant,
      generation: activeScopeRef.current.generation + 1,
    };
  }

  const [readiness, setReadiness] = React.useState<GovernmentJurisdictionReadiness | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [writing, setWriting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [submissionConfirmOpen, setSubmissionConfirmOpen] = React.useState(false);
  const [reviewDecision, setReviewDecision] = React.useState<ReviewDecision | null>(null);
  const [jurisdictionRef, setJurisdictionRef] = React.useState('');
  const [evidenceRef, setEvidenceRef] = React.useState('');
  const [evidenceSha256, setEvidenceSha256] = React.useState('');
  const [rejectionReason, setRejectionReason] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<'jurisdictionRef' | 'evidenceRef' | 'evidenceSha256' | 'rejectionReason', string>>>({});
  const submissionAttemptRef = React.useRef<WriteAttempt | null>(null);
  const reviewAttemptRef = React.useRef<WriteAttempt | null>(null);

  const scopeIsCurrent = (scope: RequestScope) =>
    activeScopeRef.current.tenantSlug === scope.tenantSlug
    && activeScopeRef.current.generation === scope.generation;

  const publishReadiness = React.useCallback((nextReadiness: GovernmentJurisdictionReadiness) => {
    setReadiness(nextReadiness);
    onReadinessChange?.(nextReadiness);
  }, [onReadinessChange]);

  const loadReadiness = React.useCallback(async (options: { preserveStatus?: boolean } = {}) => {
    const scope = activeScopeRef.current;
    if (!scope.tenantSlug) return;
    if (!options.preserveStatus) setLoading(true);
    setError(null);
    try {
      const response = await getGovernmentJurisdictionReadiness(scope.tenantSlug);
      if (!scopeIsCurrent(scope)) return;
      publishReadiness(response);
      setJurisdictionRef((current) => current || response.jurisdiction.reference || '');
      setEvidenceRef((current) => current || response.jurisdiction.evidence.reference || '');
    } catch (loadError) {
      if (!scopeIsCurrent(scope)) return;
      setReadiness(null);
      setError(safeErrorMessage(
        loadError,
        'No pudimos consultar el alcance institucional. La publicación permanece protegida.',
      ));
    } finally {
      if (scopeIsCurrent(scope)) setLoading(false);
    }
  }, [publishReadiness]);

  React.useEffect(() => {
    setReadiness(null);
    setLoading(true);
    setWriting(false);
    setError(null);
    setSuccess(null);
    setSubmissionConfirmOpen(false);
    setReviewDecision(null);
    setJurisdictionRef('');
    setEvidenceRef('');
    setEvidenceSha256('');
    setRejectionReason('');
    setFieldErrors({});
    submissionAttemptRef.current = null;
    reviewAttemptRef.current = null;
    void loadReadiness();
  }, [normalizedTenant, loadReadiness]);

  React.useEffect(() => {
    if (!canSubmitEvidence) setSubmissionConfirmOpen(false);
    if (!canReview) setReviewDecision(null);
  }, [canReview, canSubmitEvidence]);

  const validateEvidence = () => {
    const nextErrors: typeof fieldErrors = {};
    const normalizedJurisdictionRef = jurisdictionRef.trim();
    const normalizedEvidenceRef = evidenceRef.trim();
    const normalizedDigest = evidenceSha256.trim().toLowerCase();
    if (!JURISDICTION_REF_PATTERN.test(normalizedJurisdictionRef)) {
      nextErrors.jurisdictionRef = 'Usá una referencia institucional de 3 a 160 caracteres seguros.';
    }
    if (
      !EVIDENCE_REF_PATTERN.test(normalizedEvidenceRef)
      || ['://', '@', '?', '#', '..'].some((token) => normalizedEvidenceRef.includes(token))
    ) {
      nextErrors.evidenceRef = 'Usá un identificador opaco; no pegues una URL, correo ni credencial.';
    }
    if (!SHA256_PATTERN.test(normalizedDigest)) {
      nextErrors.evidenceSha256 = 'Ingresá una huella SHA-256 válida de 64 caracteres hexadecimales.';
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const openSubmissionConfirmation = () => {
    if (!canSubmitEvidence || writing || !readiness || !validateEvidence()) return;
    setSubmissionConfirmOpen(true);
  };

  const confirmSubmission = async () => {
    const scope = activeScopeRef.current;
    if (!canSubmitEvidence || !readiness || !scope.tenantSlug || !validateEvidence() || writing) return;
    const normalizedValues = {
      jurisdictionRef: jurisdictionRef.trim(),
      evidenceRef: evidenceRef.trim(),
      evidenceSha256: evidenceSha256.trim().toLowerCase(),
    };
    const fingerprint = [scope.tenantSlug, ...Object.values(normalizedValues)].join(':');
    if (!submissionAttemptRef.current || submissionAttemptRef.current.fingerprint !== fingerprint) {
      submissionAttemptRef.current = {
        fingerprint,
        key: createIdempotencyKey('jurisdiction-evidence'),
      };
    }
    const attempt = submissionAttemptRef.current;
    setWriting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await submitGovernmentJurisdictionEvidence({
        tenantSlug: scope.tenantSlug,
        ...normalizedValues,
        idempotencyKey: attempt.key,
      });
      if (!scopeIsCurrent(scope)) return;
      publishReadiness(response.readiness);
      submissionAttemptRef.current = null;
      setSubmissionConfirmOpen(false);
      setEvidenceSha256('');
      setSuccess(response.replayed
        ? 'La presentación ya estaba registrada; no se duplicó ninguna escritura.'
        : 'Evidencia presentada. La verificación sigue pendiente de una revisión independiente.');
    } catch (submitError) {
      if (!scopeIsCurrent(scope)) return;
      const uncertain = isUncertainWriteError(submitError);
      if (!uncertain) submissionAttemptRef.current = null;
      setSubmissionConfirmOpen(false);
      setError(safeErrorMessage(
        submitError,
        uncertain
          ? 'No pudimos confirmar el resultado. Reintentá con los mismos datos para consultar la misma operación sin duplicarla.'
          : 'La evidencia fue rechazada antes de registrarse. Revisá los campos e intentá nuevamente.',
      ));
    } finally {
      if (scopeIsCurrent(scope)) setWriting(false);
    }
  };

  const openReviewConfirmation = (decision: ReviewDecision) => {
    if (!canReview || !readiness || readiness.state !== 'evidence_submitted' || writing) return;
    if (decision === 'reject') {
      const normalizedReason = rejectionReason.trim().toLowerCase();
      if (!REASON_CODE_PATTERN.test(normalizedReason)) {
        setFieldErrors((current) => ({
          ...current,
          rejectionReason: 'Usá un código breve, por ejemplo documento_incompleto.',
        }));
        return;
      }
    }
    setFieldErrors((current) => ({ ...current, rejectionReason: undefined }));
    setReviewDecision(decision);
  };

  const confirmReview = async () => {
    const scope = activeScopeRef.current;
    const snapshot = readiness;
    const decision = reviewDecision;
    const submissionSha256 = snapshot?.jurisdiction.evidence.submission_sha256;
    if (
      !canReview
      || !snapshot
      || snapshot.state !== 'evidence_submitted'
      || !decision
      || !submissionSha256
      || writing
    ) return;
    const reasonCode = decision === 'reject' ? rejectionReason.trim().toLowerCase() : undefined;
    if (decision === 'reject' && (!reasonCode || !REASON_CODE_PATTERN.test(reasonCode))) return;
    const fingerprint = [scope.tenantSlug, submissionSha256, decision, reasonCode || ''].join(':');
    if (!reviewAttemptRef.current || reviewAttemptRef.current.fingerprint !== fingerprint) {
      reviewAttemptRef.current = {
        fingerprint,
        key: createIdempotencyKey('jurisdiction-review'),
      };
    }
    const attempt = reviewAttemptRef.current;
    setWriting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await reviewAction({
        tenantSlug: scope.tenantSlug,
        decision,
        expectedSubmissionSha256: submissionSha256,
        ...(reasonCode ? { reasonCode } : {}),
        idempotencyKey: attempt.key,
      });
      if (!scopeIsCurrent(scope)) return;
      publishReadiness(response.readiness);
      reviewAttemptRef.current = null;
      setReviewDecision(null);
      setRejectionReason('');
      setSuccess(response.replayed
        ? 'La decisión ya estaba registrada; no se duplicó ninguna escritura.'
        : decision === 'verify'
          ? 'Revisión independiente confirmada. El guard jurisdiccional quedó actualizado.'
          : 'Observación registrada. El organismo deberá presentar evidencia corregida.');
    } catch (reviewError) {
      if (!scopeIsCurrent(scope)) return;
      const stepUpMessage = resolveClerkStepUpErrorMessage(reviewError);
      const uncertain = !stepUpMessage && isUncertainWriteError(reviewError);
      if (stepUpMessage || !uncertain) reviewAttemptRef.current = null;
      setReviewDecision(null);
      setError(stepUpMessage || safeErrorMessage(
        reviewError,
        uncertain
          ? 'No pudimos confirmar la decisión. Reintentá para consultar la misma operación sin duplicarla.'
          : 'La revisión no fue aceptada. Actualizá el estado antes de volver a decidir.',
      ));
      if (reviewError instanceof ApiError && reviewError.status === 409) {
        void loadReadiness({ preserveStatus: true });
      }
    } finally {
      if (scopeIsCurrent(scope)) setWriting(false);
    }
  };

  const presentation = readiness ? statePresentation[readiness.state] : null;
  const StateIcon = presentation?.icon || MapPinned;
  const showEvidenceForm = Boolean(
    readiness
    && canSubmitEvidence
    && ['unverified', 'rejected', 'not_applicable'].includes(readiness.state)
    && !readiness.ready_to_publish,
  );
  const pendingSubmissionSha256 = readiness?.state === 'evidence_submitted'
    ? readiness.jurisdiction.evidence.submission_sha256
    : null;

  return (
    <section
      aria-labelledby="government-jurisdiction-title"
      data-testid="government-jurisdiction-readiness"
      data-state={readiness?.state || (loading ? 'loading' : 'unavailable')}
      className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
    >
      <div className="grid gap-5 border-b border-border/70 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950 p-5 text-white sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(230px,300px)]">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-400/15 text-blue-100">
            <MapPinned className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-blue-300/30 bg-blue-400/15 text-blue-50" variant="outline">
                Paso 3 · Alcance institucional
              </Badge>
              <Badge className="border-white/15 bg-white/10 text-slate-100" variant="outline">
                Separación de funciones
              </Badge>
            </div>
            <h2 id="government-jurisdiction-title" className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">
              Verificar jurisdicción antes de publicar
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              El organismo presenta evidencia y la plataforma la revisa con una identidad independiente. Ninguna carga se autoaprueba.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.08] p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-100">Próxima acción publicada</p>
          <p className="mt-2 text-sm font-semibold text-white">
            {readiness ? nextActionCopy[readiness.next_action] : loading ? 'Consultando estado…' : 'Estado no disponible'}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 border-white/20 bg-white/5 text-white hover:bg-white/10"
            onClick={() => void loadReadiness()}
            disabled={loading || writing}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            Actualizar estado
          </Button>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        {loading ? (
          <div aria-live="polite" className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Consultando el estado jurisdiccional autorizado…
          </div>
        ) : null}

        {!loading && !readiness ? (
          <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100">
            <p className="font-semibold">No pudimos verificar este paso</p>
            <p className="mt-1 leading-6">{error || 'El estado no está disponible. La publicación permanece protegida.'}</p>
          </div>
        ) : null}

        {readiness && presentation ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(250px,330px)]">
              <div className="rounded-xl border border-border/70 bg-background/70 p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                      <StateIcon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-foreground">{presentation.title}</h3>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{presentation.description}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('w-fit shrink-0', presentation.badgeClassName)}>
                    {presentation.label}
                  </Badge>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-3" aria-label="Flujo de acreditación jurisdiccional">
                  {[
                    {
                      label: 'Presentación',
                      detail: readiness.workflow.submission ? 'Registrada' : 'Pendiente',
                      complete: Boolean(readiness.workflow.submission),
                    },
                    {
                      label: 'Revisión independiente',
                      detail: readiness.workflow.review ? 'Decidida' : readiness.workflow.submission ? 'Pendiente' : 'Sin iniciar',
                      complete: Boolean(readiness.workflow.review),
                    },
                    {
                      label: 'Guard de publicación',
                      detail: readiness.ready_to_publish ? 'Habilitado' : 'Protegido',
                      complete: readiness.ready_to_publish,
                    },
                  ].map((step) => (
                    <div key={step.label} className="rounded-lg border border-border/60 bg-card p-3">
                      <div className="flex items-center gap-2">
                        {step.complete
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                          : <Clock3 className="h-4 w-4 text-amber-600" aria-hidden="true" />}
                        <span className="text-xs font-semibold text-foreground">{step.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <aside className={cn(
                'rounded-xl border p-4 sm:p-5',
                readiness.ready_to_publish
                  ? 'border-emerald-500/25 bg-emerald-500/[0.06]'
                  : 'border-amber-500/25 bg-amber-500/[0.06]',
              )}>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Publicación territorial</p>
                <p className="mt-2 text-lg font-bold text-foreground">
                  {readiness.ready_to_publish ? 'Guard jurisdiccional habilitado' : 'Publicación protegida'}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {readiness.ready_to_publish
                    ? 'Este control habilita el requisito jurisdiccional. Los demás controles de contenido, privacidad y operación siguen vigentes.'
                    : 'Las encuestas gubernamentales no pueden publicarse hasta completar este control. No afecta la preparación interna.'}
                </p>
                {readiness.publication_guard.reason_code ? (
                  <Badge variant="outline" className="mt-3 max-w-full font-mono text-[10px]">
                    {readiness.publication_guard.reason_code}
                  </Badge>
                ) : null}
              </aside>
            </div>

            {error ? (
              <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-100">
                <p className="font-semibold">La última acción no pudo confirmarse</p>
                <p className="mt-1 leading-6">{error}</p>
              </div>
            ) : null}

            {success ? (
              <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-100">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p className="leading-6">{success}</p>
                </div>
              </div>
            ) : null}

            {showEvidenceForm ? (
              <EvidenceForm
                readiness={readiness}
                disabled={writing}
                values={{ jurisdictionRef, evidenceRef, evidenceSha256 }}
                errors={fieldErrors}
                onChange={(field, value) => {
                  if (field === 'jurisdictionRef') setJurisdictionRef(value);
                  if (field === 'evidenceRef') setEvidenceRef(value);
                  if (field === 'evidenceSha256') setEvidenceSha256(value);
                  setFieldErrors((current) => ({ ...current, [field]: undefined }));
                  setSuccess(null);
                }}
                onConfirm={openSubmissionConfirmation}
              />
            ) : null}

            {readiness.state === 'evidence_submitted' && !canReview ? (
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.05] p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700 dark:text-blue-300" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold text-foreground">Revisión asignada a la plataforma</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Tu equipo no necesita aprobar su propia evidencia. Una cuenta independiente revisará la misma huella registrada.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {canReview && readiness.state === 'evidence_submitted' && pendingSubmissionSha256 ? (
              <div className="rounded-xl border border-violet-500/25 bg-violet-500/[0.055] p-4 sm:p-5" data-testid="government-jurisdiction-platform-review">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <Fingerprint className="mt-0.5 h-5 w-5 shrink-0 text-violet-700 dark:text-violet-300" aria-hidden="true" />
                    <div>
                      <h3 className="font-semibold text-foreground">Revisión de plataforma autorizada</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Verificá el respaldo fuera de esta pantalla y decidí sobre la huella exacta. La acción exige identidad reforzada y queda auditada.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="w-fit shrink-0">No permite autoaprobación</Badge>
                </div>
                <div className="mt-4 rounded-lg border border-violet-500/15 bg-background/75 p-3">
                  <p className="text-xs font-semibold text-muted-foreground">Presentación a revisar</p>
                  <p className="mt-1 break-all font-mono text-xs text-foreground">{pendingSubmissionSha256}</p>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <div className="space-y-2">
                    <Label htmlFor="government-jurisdiction-rejection-reason">Código de observación</Label>
                    <Input
                      id="government-jurisdiction-rejection-reason"
                      value={rejectionReason}
                      onChange={(event) => {
                        setRejectionReason(event.target.value.toLowerCase());
                        setFieldErrors((current) => ({ ...current, rejectionReason: undefined }));
                      }}
                      placeholder="documento_incompleto"
                      autoComplete="off"
                      spellCheck={false}
                      aria-describedby="government-jurisdiction-rejection-help government-jurisdiction-rejection-error"
                      aria-invalid={Boolean(fieldErrors.rejectionReason)}
                      disabled={writing}
                    />
                    <p id="government-jurisdiction-rejection-help" className="text-xs leading-5 text-muted-foreground">
                      Sólo se utiliza si la presentación debe corregirse; no incluyas nombres ni texto libre sensible.
                    </p>
                    {fieldErrors.rejectionReason ? <p id="government-jurisdiction-rejection-error" className="text-xs text-red-600 dark:text-red-300">{fieldErrors.rejectionReason}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => openReviewConfirmation('reject')} disabled={writing}>
                      <AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />
                      Observar evidencia
                    </Button>
                    <Button type="button" onClick={() => openReviewConfirmation('verify')} disabled={writing}>
                      <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                      Verificar evidencia
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <details className="group rounded-xl border border-border/70 bg-muted/15">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5">
                Ver trazabilidad y límites del registro
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="grid gap-3 border-t border-border/70 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Referencia jurisdiccional</p>
                  <p className="mt-1 break-all font-mono text-xs text-foreground">{readiness.jurisdiction.reference || 'No publicada'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Referencia de evidencia</p>
                  <p className="mt-1 break-all font-mono text-xs text-foreground">{readiness.jurisdiction.evidence.reference || 'No publicada'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Huella del documento</p>
                  <p className="mt-1 font-mono text-xs text-foreground" title={readiness.jurisdiction.evidence.document_sha256 || undefined}>
                    {compactDigest(readiness.jurisdiction.evidence.document_sha256)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Última presentación</p>
                  <p className="mt-1 text-xs text-foreground">{formatTimestamp(readiness.workflow.submission?.created_at || null)}</p>
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Contenido bruto: no almacenado</Badge>
                    <Badge variant="outline">Credenciales: no almacenadas</Badge>
                    <Badge variant="outline">Funciones separadas: sí</Badge>
                    <Badge variant="outline">Guard del backend: preservado</Badge>
                  </div>
                  {readiness.workflow.review?.reason_code ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Decisión registrada: <span className="font-mono text-foreground">{readiness.workflow.review.reason_code}</span>
                    </p>
                  ) : null}
                </div>
              </div>
            </details>

            {!canSubmitEvidence && !canReview ? (
              <p className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                Tu rol puede consultar este estado. La presentación corresponde a una administración del organismo y la decisión a una cuenta independiente de plataforma.
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      <AlertDialog open={submissionConfirmOpen} onOpenChange={(open) => { if (!writing) setSubmissionConfirmOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar presentación institucional</AlertDialogTitle>
            <AlertDialogDescription>
              Se registrarán las referencias indicadas y la huella SHA-256. Esta acción no guarda el documento, no concede verificación y no habilita automáticamente la publicación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={writing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); void confirmSubmission(); }}
              disabled={writing || !canSubmitEvidence}
            >
              {writing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Confirmar presentación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(reviewDecision)} onOpenChange={(open) => { if (!open && !writing) setReviewDecision(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {reviewDecision === 'verify' ? 'Confirmar verificación independiente' : 'Confirmar observación'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {reviewDecision === 'verify'
                ? 'La plataforma vinculará esta decisión con la presentación exacta y habilitará únicamente el guard jurisdiccional. Los demás controles siguen vigentes.'
                : `La plataforma registrará la observación ${rejectionReason.trim().toLowerCase() || 'indicada'} y solicitará una nueva presentación al organismo.`}
              {' '}La acción exige una cuenta autorizada con identidad reforzada (verificación reciente) y queda auditada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={writing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => { event.preventDefault(); void confirmReview(); }}
              disabled={writing || !canReview || !reviewDecision}
            >
              {writing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {reviewDecision === 'verify' ? 'Confirmar verificación' : 'Confirmar observación'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
};

const ClerkGovernmentJurisdictionReadinessPanel: React.FC<GovernmentJurisdictionReadinessPanelProps> = (props) => {
  const reviewWithStepUp = useClerkStepUpAction<GovernmentJurisdictionReviewInput, Awaited<ReturnType<typeof reviewGovernmentJurisdictionEvidence>>>(
    reviewGovernmentJurisdictionEvidence,
  );
  return <GovernmentJurisdictionReadinessPanelContent {...props} reviewAction={reviewWithStepUp} />;
};

const GovernmentJurisdictionReadinessPanel: React.FC<GovernmentJurisdictionReadinessPanelProps> = (props) => {
  const clerkRuntime = useClerkRuntime();
  if (clerkRuntime.enabled && props.canReview) {
    return <ClerkGovernmentJurisdictionReadinessPanel {...props} />;
  }
  return <GovernmentJurisdictionReadinessPanelContent {...props} reviewAction={reviewGovernmentJurisdictionEvidence} />;
};

export default GovernmentJurisdictionReadinessPanel;
