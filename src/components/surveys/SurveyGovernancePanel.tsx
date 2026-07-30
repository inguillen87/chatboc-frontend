import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import {
  adminCloseSurveyGovernanceRelease,
  adminCreateSurveyGovernanceRelease,
  adminListSurveyGovernanceReleases,
  adminPublishSurveyGovernanceRelease,
} from '@/api/encuestas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type {
  SurveyGovernanceRelease,
  SurveyGovernanceReleaseCreatePayload,
  SurveyGovernanceReleaseList,
} from '@/types/encuestas';
import { getErrorMessage } from '@/utils/api';
import {
  prepareSurveyConsentPublicText,
  SURVEY_CONSENT_TEXT_CONTENT_FORMAT,
  SURVEY_CONSENT_TEXT_MAX_CODEPOINTS,
  SURVEY_CONSENT_TEXT_NORMALIZATION,
  validateSurveyConsentPublicText,
} from '@/utils/surveyGovernance';

const RELEASE_LIST_CONTRACT = 'surveys.governance_releases.v1';
const RELEASE_CONTRACT = 'surveys.governance_release.v1';
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

type GovernanceOperation = 'create' | 'publish' | 'close';

type PendingAttempt = {
  fingerprint: string;
  key: string;
};

type ConsentDigestState = {
  source: string;
  status: 'idle' | 'verifying' | 'verified' | 'invalid';
  publicText?: string;
  textSha256?: string;
  codePointLength: number;
  error?: string;
};

const releaseStatusLabel: Record<string, string> = {
  draft: 'Borrador',
  published: 'Publicado',
  closed: 'Cerrado',
};

const eligibilityModeLabel: Record<string, string> = {
  open: 'Abierta con declaración',
  self_attested: 'Autodeclarada',
  institution_attested: 'Declarada por la institución',
  manual_review: 'Revisión manual',
};

const shortenedHash = (value?: string | null) => {
  const normalized = value?.trim() ?? '';
  if (normalized.length <= 20) return normalized || 'No informado';
  return `${normalized.slice(0, 12)}…${normalized.slice(-8)}`;
};

const secureNonce = () => {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  if (typeof cryptoApi?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  }
  throw new Error('No hay un generador criptográfico disponible. La operación quedó bloqueada.');
};

export const createSurveyGovernanceIdempotencyKey = (
  operation: GovernanceOperation,
  surveyId: number,
) => `survey-governance:${operation}:${surveyId}:${secureNonce()}`;

export const isSurveyGovernanceMutationAck = (
  value: SurveyGovernanceRelease | null | undefined,
  expected: {
    surveyId: number;
    releaseId?: number;
    status: SurveyGovernanceRelease['status'];
    requirePublicConsent?: boolean;
  },
) => {
  const publicConsentComplete = value?.completeness?.public_consent?.complete === true;
  return (
    value?.contract_version === RELEASE_CONTRACT &&
    value.survey_id === expected.surveyId &&
    Number.isInteger(value.release_id) &&
    value.release_id > 0 &&
    (expected.releaseId === undefined || value.release_id === expected.releaseId) &&
    value.status === expected.status &&
    SHA256_PATTERN.test(value.snapshot_sha256) &&
    SHA256_PATTERN.test(value.policy_sha256) &&
    (expected.requirePublicConsent !== true || publicConsentComplete) &&
    value.assurance?.regulated_election_certified === false &&
    value.assurance?.result_certified === false &&
    value.idempotency?.persisted === true &&
    (value.idempotency?.disposition === 'accepted' || value.idempotency?.disposition === 'replayed')
  );
};

const validateReleaseList = (
  value: SurveyGovernanceReleaseList,
  surveyId: number,
): SurveyGovernanceReleaseList => {
  if (
    value?.contract_version !== RELEASE_LIST_CONTRACT ||
    value.survey_id !== surveyId ||
    !Array.isArray(value.items) ||
    value.capabilities?.read !== true ||
    value.capabilities?.manage !== true
  ) {
    throw new Error(
      'El backend no devolvió una autorización explícita y verificable para gobernanza. Las acciones quedaron bloqueadas.',
    );
  }
  return value;
};

const releaseHasHonestAssurance = (release: SurveyGovernanceRelease) =>
  release.assurance?.regulated_election_certified === false &&
  release.assurance?.result_certified === false;

const releaseContractIsActionable = (release: SurveyGovernanceRelease, surveyId: number) =>
  release.contract_version === RELEASE_CONTRACT &&
  release.survey_id === surveyId &&
  Number.isInteger(release.release_id) &&
  release.release_id > 0 &&
  ['draft', 'published', 'closed'].includes(release.status) &&
  SHA256_PATTERN.test(release.snapshot_sha256) &&
  SHA256_PATTERN.test(release.policy_sha256) &&
  releaseHasHonestAssurance(release);

const releasePublicConsentIsStructurallyComplete = (release: SurveyGovernanceRelease) => {
  const consent = release.governance?.consent;
  if (
    release.completeness?.public_consent?.complete !== true ||
    consent?.content_format !== SURVEY_CONSENT_TEXT_CONTENT_FORMAT ||
    consent?.normalization !== SURVEY_CONSENT_TEXT_NORMALIZATION ||
    consent.required !== true ||
    consent.stores_public_text !== true ||
    consent.records_participant_input !== false ||
    typeof consent.public_text !== 'string' ||
    !SHA256_PATTERN.test(consent.text_sha256)
  ) {
    return false;
  }
  try {
    return validateSurveyConsentPublicText(consent.public_text) === consent.public_text;
  } catch {
    return false;
  }
};

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
};

export function SurveyGovernancePanel({
  surveyId,
  tenantSlug,
}: {
  surveyId: number;
  tenantSlug?: string | null;
}) {
  const [contract, setContract] = useState<SurveyGovernanceReleaseList | null>(null);
  const [contractScope, setContractScope] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<string | null>(null);
  const [eligibilityVersion, setEligibilityVersion] = useState('eligibility-v1');
  const [eligibilityMode, setEligibilityMode] = useState<
    SurveyGovernanceReleaseCreatePayload['eligibility_policy']['mode']
  >('open');
  const [declarations, setDeclarations] = useState('');
  const [consentVersion, setConsentVersion] = useState('consent-v1');
  const [consentPublicText, setConsentPublicText] = useState('');
  const [consentDigest, setConsentDigest] = useState<ConsentDigestState>({
    source: '',
    status: 'idle',
    codePointLength: 0,
  });
  const [reviewReferences, setReviewReferences] = useState<Record<number, string>>({});
  const attemptRef = useRef<PendingAttempt | null>(null);
  const loadVersionRef = useRef(0);
  const scopeKey = `${tenantSlug?.trim().toLowerCase() || 'unscoped'}:${surveyId}`;
  const activeScopeRef = useRef(scopeKey);
  activeScopeRef.current = scopeKey;
  const scopedContract = contractScope === scopeKey ? contract : null;

  const requestOptions = useMemo(
    () => ({ tenantSlug: tenantSlug?.trim() || undefined }),
    [tenantSlug],
  );

  const load = useCallback(async () => {
    const requestVersion = ++loadVersionRef.current;
    const requestScope = scopeKey;
    setLoading(true);
    setError(null);
    try {
      const response = await adminListSurveyGovernanceReleases(surveyId, requestOptions);
      if (loadVersionRef.current !== requestVersion || activeScopeRef.current !== requestScope) return;
      setContract(validateReleaseList(response, surveyId));
      setContractScope(requestScope);
    } catch (requestError) {
      if (loadVersionRef.current !== requestVersion || activeScopeRef.current !== requestScope) return;
      setContract(null);
      setContractScope(null);
      setError(
        getErrorMessage(
          requestError,
          'No pudimos verificar el estado ni los permisos de gobernanza. Las acciones quedaron bloqueadas.',
        ),
      );
    } finally {
      if (loadVersionRef.current === requestVersion && activeScopeRef.current === requestScope) {
        setLoading(false);
      }
    }
  }, [requestOptions, scopeKey, surveyId]);

  useEffect(() => {
    attemptRef.current = null;
    setContract(null);
    setContractScope(null);
    setNotice(null);
    setPendingOperation(null);
    setReviewReferences({});
    void load();
    return () => {
      loadVersionRef.current += 1;
    };
  }, [load, scopeKey]);

  useEffect(() => {
    let active = true;
    if (!consentPublicText) {
      setConsentDigest({ source: '', status: 'idle', codePointLength: 0 });
      return () => {
        active = false;
      };
    }
    setConsentDigest({
      source: consentPublicText,
      status: 'verifying',
      codePointLength: Array.from(consentPublicText).length,
    });
    void prepareSurveyConsentPublicText(consentPublicText)
      .then((prepared) => {
        if (!active) return;
        setConsentDigest({
          source: consentPublicText,
          status: 'verified',
          publicText: prepared.publicText,
          textSha256: prepared.textSha256,
          codePointLength: prepared.codePointLength,
        });
      })
      .catch((digestError: unknown) => {
        if (!active) return;
        setConsentDigest({
          source: consentPublicText,
          status: 'invalid',
          codePointLength: Array.from(consentPublicText).length,
          error: getErrorMessage(digestError, 'No se pudo verificar el consentimiento.'),
        });
      });
    return () => {
      active = false;
    };
  }, [consentPublicText]);

  const idempotencyKeyFor = (operation: GovernanceOperation, fingerprint: string) => {
    if (attemptRef.current?.fingerprint === fingerprint) return attemptRef.current.key;
    const key = createSurveyGovernanceIdempotencyKey(operation, surveyId);
    attemptRef.current = { fingerprint, key };
    return key;
  };

  const finishAcknowledgedOperation = async (message: string, operationScope = scopeKey) => {
    if (activeScopeRef.current !== operationScope) return;
    attemptRef.current = null;
    setNotice(message);
    await load();
  };

  const failOperation = (requestError: unknown, operationScope = scopeKey) => {
    if (activeScopeRef.current !== operationScope) return;
    setError(
      getErrorMessage(
        requestError,
        'No recibimos una confirmación durable. Reintentá la misma operación para conservar su clave de idempotencia.',
      ),
    );
  };

  const createRelease = async () => {
    if (scopedContract?.capabilities?.create_release !== true) return;
    const operationScope = scopeKey;
    const declarationCodes = Array.from(
      new Set<string>(
        declarations
          .split(',')
          .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
      ),
    );
    setPendingOperation('create');
    setError(null);
    setNotice(null);
    try {
      const preparedConsent = await prepareSurveyConsentPublicText(consentPublicText);
      const payload: SurveyGovernanceReleaseCreatePayload = {
        eligibility_policy: {
          policy_version: eligibilityVersion.trim(),
          mode: eligibilityMode,
          declarations: declarationCodes,
          human_review_required: true,
          automated_decision: false,
        },
        consent_policy: {
          policy_version: consentVersion.trim(),
          public_text: preparedConsent.publicText,
          text_sha256: preparedConsent.textSha256,
          required: true,
        },
        decision_rules: {
          quorum: { type: 'none', value: null },
          tie: { procedure: 'human_review' },
          challenge: { enabled: false, window_hours: null, procedure: 'human_review' },
          human_review_required: true,
          declarative_only: true,
        },
      };
      const fingerprint = JSON.stringify(['create', operationScope, surveyId, payload]);
      const response = await adminCreateSurveyGovernanceRelease(
        surveyId,
        payload,
        idempotencyKeyFor('create', fingerprint),
        requestOptions,
      );
      if (!isSurveyGovernanceMutationAck(response, {
        surveyId,
        status: 'draft',
        requirePublicConsent: true,
      })) {
        throw new Error(
          'El servidor respondió, pero no confirmó persistencia e idempotencia del release. La clave se conserva para reintentar.',
        );
      }
      await finishAcknowledgedOperation('Release borrador confirmado por el backend.', operationScope);
    } catch (requestError) {
      failOperation(requestError, operationScope);
    } finally {
      if (activeScopeRef.current === operationScope) setPendingOperation(null);
    }
  };

  const publishRelease = async (release: SurveyGovernanceRelease) => {
    if (
      release.capabilities?.can_publish !== true ||
      !releaseContractIsActionable(release, surveyId) ||
      !releasePublicConsentIsStructurallyComplete(release)
    ) {
      return;
    }
    const operationScope = scopeKey;
    const payload = { expected_snapshot_sha256: release.snapshot_sha256 };
    const fingerprint = JSON.stringify(['publish', operationScope, surveyId, release.release_id, payload]);
    setPendingOperation(`publish:${release.release_id}`);
    setError(null);
    setNotice(null);
    try {
      const consent = release.governance?.consent;
      const preparedConsent = await prepareSurveyConsentPublicText(consent?.public_text ?? '');
      if (preparedConsent.textSha256 !== consent?.text_sha256) {
        throw new Error(
          'La huella del consentimiento público no coincide. La publicación quedó bloqueada.',
        );
      }
      const response = await adminPublishSurveyGovernanceRelease(
        surveyId,
        release.release_id,
        release.snapshot_sha256,
        idempotencyKeyFor('publish', fingerprint),
        requestOptions,
      );
      if (
        !isSurveyGovernanceMutationAck(response, {
          surveyId,
          releaseId: release.release_id,
          status: 'published',
          requirePublicConsent: true,
        })
      ) {
        throw new Error(
          'El servidor respondió, pero no confirmó una publicación durable. La clave se conserva para reintentar.',
        );
      }
      await finishAcknowledgedOperation('Publicación confirmada por el backend.');
    } catch (requestError) {
      failOperation(requestError);
    } finally {
      if (activeScopeRef.current === operationScope) setPendingOperation(null);
    }
  };

  const closeRelease = async (release: SurveyGovernanceRelease) => {
    if (
      release.capabilities?.can_close !== true ||
      !releaseContractIsActionable(release, surveyId)
    ) return;
    const operationScope = scopeKey;
    const reviewReference = reviewReferences[release.release_id]?.trim() ?? '';
    if (!reviewReference) {
      setError('Ingresá la referencia de la revisión humana antes de cerrar.');
      return;
    }
    const payload = { human_review_reference: reviewReference };
    const fingerprint = JSON.stringify(['close', operationScope, surveyId, release.release_id, payload]);
    setPendingOperation(`close:${release.release_id}`);
    setError(null);
    setNotice(null);
    try {
      const response = await adminCloseSurveyGovernanceRelease(
        surveyId,
        release.release_id,
        reviewReference,
        idempotencyKeyFor('close', fingerprint),
        requestOptions,
      );
      if (
        !isSurveyGovernanceMutationAck(response, {
          surveyId,
          releaseId: release.release_id,
          status: 'closed',
        })
      ) {
        throw new Error(
          'El servidor respondió, pero no confirmó un cierre durable. La clave se conserva para reintentar.',
        );
      }
      await finishAcknowledgedOperation('Cierre confirmado con referencia de revisión humana.');
    } catch (requestError) {
      failOperation(requestError);
    } finally {
      if (activeScopeRef.current === operationScope) setPendingOperation(null);
    }
  };

  const items = Array.isArray(scopedContract?.items) ? scopedContract.items : [];
  const canCreate = scopedContract?.capabilities?.create_release === true;
  const consentDigestIsCurrent = consentDigest.source === consentPublicText;
  const visibleConsentDigestStatus = !consentPublicText
    ? 'idle'
    : consentDigestIsCurrent
      ? consentDigest.status
      : 'verifying';
  const consentDigestReady = consentDigestIsCurrent && consentDigest.status === 'verified';

  return (
    <Card className="border-border/70" data-testid="survey-governance-panel">
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
            Gobernanza del release
          </CardTitle>
          <CardDescription className="mt-2 max-w-3xl">
            Versiona el instrumento, la elegibilidad y el consentimiento antes de publicar. Publicar o cerrar
            requiere autorización explícita del backend.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          Actualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">Alcance de assurance</p>
          <p className="mt-1">
            Este contrato protege la integridad local del instrumento y sus políticas. NO certifica una elección
            regulada ni sus resultados, y no reemplaza la revisión humana.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
            <AlertTriangle className="mr-2 inline h-4 w-4" aria-hidden="true" />
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
            <CheckCircle2 className="mr-2 inline h-4 w-4" aria-hidden="true" />
            {notice}
          </div>
        ) : null}
        {loading && !scopedContract ? (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden="true" />
            Verificando releases y permisos…
          </div>
        ) : null}

        {canCreate ? (
          <section className="space-y-4 rounded-2xl border border-border/70 p-4" aria-labelledby="create-governance-release">
            <div>
              <h3 id="create-governance-release" className="font-bold">Crear release gobernado</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Se guarda una fotografía inmutable. Las reglas quedan declarativas y la elegibilidad nunca se decide automáticamente.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="governance-eligibility-version">Versión de elegibilidad</Label>
                <Input
                  id="governance-eligibility-version"
                  value={eligibilityVersion}
                  onChange={(event) => setEligibilityVersion(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="governance-eligibility-mode">Modo de elegibilidad</Label>
                <select
                  id="governance-eligibility-mode"
                  className="flex h-10 w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                  value={eligibilityMode}
                  onChange={(event) =>
                    setEligibilityMode(
                      event.target.value as SurveyGovernanceReleaseCreatePayload['eligibility_policy']['mode'],
                    )
                  }
                >
                  <option value="open">Abierta con declaración</option>
                  <option value="self_attested">Autodeclarada</option>
                  <option value="institution_attested">Declarada por la institución</option>
                  <option value="manual_review">Revisión manual</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="governance-declarations">Códigos declarativos (separados por coma)</Label>
                <Input
                  id="governance-declarations"
                  placeholder="resident_attested, age_requirement_attested"
                  value={declarations}
                  onChange={(event) => setDeclarations(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">No ingreses padrones, DNI, nombres ni otra PII.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="governance-consent-version">Versión de consentimiento</Label>
                <Input
                  id="governance-consent-version"
                  value={consentVersion}
                  onChange={(event) => setConsentVersion(event.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="governance-consent-text">Texto público aprobado</Label>
                <Textarea
                  id="governance-consent-text"
                  className="min-h-36"
                  value={consentPublicText}
                  onChange={(event) => setConsentPublicText(event.target.value)}
                  placeholder="Texto institucional exacto que cada participante debe leer antes de aceptar."
                  aria-describedby="governance-consent-text-help governance-consent-digest-status"
                />
                <p id="governance-consent-text-help" className="text-xs text-muted-foreground">
                  Texto plano, 1–{SURVEY_CONSENT_TEXT_MAX_CODEPOINTS} caracteres. No incluyas DNI, nombres,
                  correos ni otra PII. Se normaliza a NFC/LF y se publica sin HTML ni enlaces automáticos.
                </p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="governance-consent-hash">SHA-256 calculado con Web Crypto</Label>
                <Input
                  id="governance-consent-hash"
                  autoComplete="off"
                  spellCheck={false}
                  readOnly
                  placeholder="Se calcula desde el texto normalizado"
                  value={consentDigestIsCurrent ? consentDigest.textSha256 ?? '' : ''}
                />
                <p
                  id="governance-consent-digest-status"
                  className={visibleConsentDigestStatus === 'invalid' ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}
                  role={visibleConsentDigestStatus === 'invalid' ? 'alert' : 'status'}
                >
                  {visibleConsentDigestStatus === 'verifying'
                    ? 'Verificando integridad…'
                    : visibleConsentDigestStatus === 'verified'
                      ? `${consentDigest.codePointLength} caracteres · huella verificada localmente.`
                      : visibleConsentDigestStatus === 'invalid'
                        ? consentDigest.error
                        : 'Ingresá el texto aprobado para calcular su huella.'}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
              Quórum: no definido · Empate: revisión humana · Challenge: desactivado · Resultado automático: ninguno.
            </div>
            <Button
              type="button"
              onClick={() => void createRelease()}
              disabled={pendingOperation !== null || !consentDigestReady}
            >
              {pendingOperation === 'create' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FileCheck2 className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Crear release borrador
            </Button>
          </section>
        ) : null}

        {!loading && scopedContract && !items.length && !canCreate ? (
          <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            El backend no autorizó crear un release para el estado actual de la encuesta.
          </div>
        ) : null}

        <div className="space-y-4">
          {items.map((release) => {
            const eligibility = release.governance?.eligibility;
            const consent = release.governance?.consent;
            const rules = release.governance?.decision_rules;
            const isActive = scopedContract?.active_release_id === release.release_id;
            const isLatest = scopedContract?.latest_release_id === release.release_id;
            const actionableContract = releaseContractIsActionable(release, surveyId);
            const publicConsentComplete = releasePublicConsentIsStructurallyComplete(release);
            const canPublish =
              release.capabilities?.can_publish === true && actionableContract && publicConsentComplete;
            const canClose = release.capabilities?.can_close === true && actionableContract;
            const reviewInputId = `governance-review-${release.release_id}`;
            return (
              <article key={release.release_id} className="rounded-2xl border border-border/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">Release v{release.version_number}</h3>
                      <span className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-0.5 text-xs font-semibold">
                        {releaseStatusLabel[release.status] || release.status}
                      </span>
                      {isActive ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">Activo</span>
                      ) : null}
                      {isLatest ? (
                        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800">Más reciente</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(release.published_at) ? `Publicado ${formatDate(release.published_at)}` : 'Todavía no publicado'}
                      {formatDate(release.closed_at) ? ` · Cerrado ${formatDate(release.closed_at)}` : ''}
                    </p>
                  </div>
                  <LockKeyhole className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>

                <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                  <div className="rounded-lg bg-muted/25 p-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Snapshot SHA-256</dt>
                    <dd className="mt-1 font-mono text-xs" title={release.snapshot_sha256}>{shortenedHash(release.snapshot_sha256)}</dd>
                  </div>
                  <div className="rounded-lg bg-muted/25 p-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Policy SHA-256</dt>
                    <dd className="mt-1 font-mono text-xs" title={release.policy_sha256}>{shortenedHash(release.policy_sha256)}</dd>
                  </div>
                  <div className="rounded-lg bg-muted/25 p-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Elegibilidad</dt>
                    <dd className="mt-1">
                      {eligibility
                        ? `${eligibility.policy_version} · ${eligibilityModeLabel[eligibility.mode] || eligibility.mode}`
                        : 'Política no informada'}
                    </dd>
                    <dd className="mt-1 text-xs text-muted-foreground">
                      {eligibility?.declarations?.length
                        ? `Declaraciones: ${eligibility.declarations.join(', ')}`
                        : 'Sin códigos declarativos adicionales'}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-muted/25 p-3">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consentimiento</dt>
                    <dd className="mt-1">{consent?.policy_version || 'Política no informada'}</dd>
                    <dd className="mt-1 font-mono text-xs text-muted-foreground" title={consent?.text_sha256}>
                      Texto: {shortenedHash(consent?.text_sha256)}
                    </dd>
                    {publicConsentComplete ? (
                      <dd
                        className="mt-3 whitespace-pre-wrap break-words rounded-md border border-border/60 bg-background p-3 text-xs"
                        data-testid={`survey-governance-consent-text-${release.release_id}`}
                      >
                        {consent?.public_text}
                      </dd>
                    ) : (
                      <dd className="mt-2 text-xs font-semibold text-destructive">
                        Texto público ausente o no verificable. El release legacy permanece visible pero incompleto.
                      </dd>
                    )}
                  </div>
                </dl>

                <div className="mt-3 rounded-lg border border-border/60 p-3 text-sm">
                  <p className="font-semibold">Decisión declarativa con revisión humana</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Revisión humana: {rules?.human_review_required === true ? 'obligatoria' : 'no verificada'} · Reglas declarativas:{' '}
                    {rules?.declarative_only === true ? 'sí' : 'no verificadas'} · Quórum: {rules?.quorum?.type || 'no informado'} · Empate:{' '}
                    {rules?.tie?.procedure || 'no informado'}.
                  </p>
                </div>

                {!actionableContract || (release.status === 'draft' && !publicConsentComplete) ? (
                  <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    Contrato, hashes, assurance o consentimiento público incompletos. La publicación de este release quedó bloqueada.
                  </p>
                ) : null}

                {canPublish ? (
                  <Button
                    type="button"
                    className="mt-4"
                    onClick={() => void publishRelease(release)}
                    disabled={pendingOperation !== null}
                  >
                    {pendingOperation === `publish:${release.release_id}` ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    Publicar snapshot verificado
                  </Button>
                ) : null}

                {canClose ? (
                  <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border/60 p-3 md:flex-row md:items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={reviewInputId}>Referencia de revisión humana</Label>
                      <Input
                        id={reviewInputId}
                        placeholder="acta:comite-2026-07-30"
                        value={reviewReferences[release.release_id] ?? ''}
                        onChange={(event) =>
                          setReviewReferences((current) => ({
                            ...current,
                            [release.release_id]: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => void closeRelease(release)}
                      disabled={pendingOperation !== null}
                    >
                      {pendingOperation === `close:${release.release_id}` ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : null}
                      Cerrar release
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default SurveyGovernancePanel;
