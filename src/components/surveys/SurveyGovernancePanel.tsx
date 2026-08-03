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
  sha256SurveyConsentText,
  validateSurveyConsentPublicText,
} from '@/utils/surveyGovernance';

const RELEASE_LIST_CONTRACT = 'surveys.governance_releases.v1';
const RELEASE_CONTRACT = 'surveys.governance_release.v1';
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const OPAQUE_REVIEW_REFERENCE_PATTERN = /^[a-z][a-z0-9_.-]{1,31}:[A-Za-z][A-Za-z0-9_.:-]{7,127}$/;
const RELEASE_STATUSES = new Set(['draft', 'published', 'closed']);

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

type SurveyGovernanceContractErrorKind = 'absent' | 'malformed';

export class SurveyGovernanceContractError extends Error {
  readonly kind: SurveyGovernanceContractErrorKind;

  constructor(kind: SurveyGovernanceContractErrorKind) {
    super(
      kind === 'absent'
        ? 'El backend no expuso el contrato versionado de gobernanza. Las acciones quedaron bloqueadas.'
        : 'El backend devolvió un contrato de gobernanza inconsistente. Las acciones quedaron bloqueadas.',
    );
    this.name = 'SurveyGovernanceContractError';
    this.kind = kind;
    Object.setPrototypeOf(this, SurveyGovernanceContractError.prototype);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isPositiveSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const isNonNegativeSafeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));

const stringArraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const releaseGovernanceMatchesCreatePayload = (
  release: SurveyGovernanceRelease,
  expected: SurveyGovernanceReleaseCreatePayload,
) => {
  const eligibility = release.governance?.eligibility;
  const consent = release.governance?.consent;
  const rules = release.governance?.decision_rules;
  return (
    eligibility?.contract_version === 'surveys.eligibility_policy.v1' &&
    eligibility.policy_version === expected.eligibility_policy.policy_version &&
    eligibility.mode === expected.eligibility_policy.mode &&
    Array.isArray(eligibility.declarations) &&
    stringArraysEqual(eligibility.declarations, expected.eligibility_policy.declarations) &&
    eligibility.human_review_required === expected.eligibility_policy.human_review_required &&
    eligibility.automated_decision === expected.eligibility_policy.automated_decision &&
    eligibility.stores_roster_or_pii === false &&
    eligibility.decision_state === 'not_evaluated' &&
    consent?.contract_version === 'surveys.consent_policy.v1' &&
    consent.policy_version === expected.consent_policy.policy_version &&
    consent.public_text === expected.consent_policy.public_text &&
    consent.text_sha256 === expected.consent_policy.text_sha256 &&
    consent.required === expected.consent_policy.required &&
    consent.content_format === SURVEY_CONSENT_TEXT_CONTENT_FORMAT &&
    consent.normalization === SURVEY_CONSENT_TEXT_NORMALIZATION &&
    consent.stores_public_text === true &&
    consent.records_participant_input === false &&
    rules?.contract_version === 'surveys.decision_rules.v1' &&
    rules.quorum?.type === expected.decision_rules.quorum.type &&
    rules.quorum?.value === expected.decision_rules.quorum.value &&
    rules.tie?.procedure === expected.decision_rules.tie.procedure &&
    rules.challenge?.enabled === expected.decision_rules.challenge.enabled &&
    rules.challenge?.window_hours === expected.decision_rules.challenge.window_hours &&
    rules.challenge?.procedure === expected.decision_rules.challenge.procedure &&
    rules.human_review_required === expected.decision_rules.human_review_required &&
    rules.declarative_only === expected.decision_rules.declarative_only &&
    rules.computed_outcome === null
  );
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
    snapshotSha256?: string;
    policySha256?: string;
    versionNumber?: number;
    humanReviewReferenceSha256?: string;
    createPayload?: SurveyGovernanceReleaseCreatePayload;
  },
) => {
  const publicConsentComplete = value?.completeness?.public_consent?.complete === true;
  const replayed = value?.idempotency?.replayed;
  const disposition = value?.idempotency?.disposition;
  const baseAck = (
    value?.ok === true &&
    value.contract_version === RELEASE_CONTRACT &&
    value.survey_id === expected.surveyId &&
    isPositiveSafeInteger(value.release_id) &&
    isPositiveSafeInteger(value.version_number) &&
    (expected.releaseId === undefined || value.release_id === expected.releaseId) &&
    (expected.versionNumber === undefined || value.version_number === expected.versionNumber) &&
    value.status === expected.status &&
    SHA256_PATTERN.test(value.snapshot_sha256) &&
    SHA256_PATTERN.test(value.policy_sha256) &&
    (expected.snapshotSha256 === undefined || value.snapshot_sha256 === expected.snapshotSha256) &&
    (expected.policySha256 === undefined || value.policy_sha256 === expected.policySha256) &&
    (expected.requirePublicConsent !== true || publicConsentComplete) &&
    value.assurance?.regulated_election_certified === false &&
    value.assurance?.result_certified === false &&
    value.idempotency?.persisted === true &&
    typeof replayed === 'boolean' &&
    (disposition === 'accepted' || disposition === 'replayed') &&
    disposition === (replayed ? 'replayed' : 'accepted')
  );
  if (!baseAck) return false;
  if (
    expected.createPayload !== undefined &&
    !releaseGovernanceMatchesCreatePayload(value, expected.createPayload)
  ) {
    return false;
  }
  if (expected.humanReviewReferenceSha256 === undefined) return true;

  const closure = value.closure;
  const manifest = closure?.manifest;
  return (
    value.status === 'closed' &&
    isRecord(closure) &&
    isRecord(manifest) &&
    SHA256_PATTERN.test(closure.manifest_sha256) &&
    manifest.contract_version === 'surveys.closure_manifest.v1' &&
    isPositiveSafeInteger(manifest.tenant_id) &&
    manifest.survey_id === value.survey_id &&
    manifest.release_id === value.release_id &&
    manifest.release_version === value.version_number &&
    manifest.snapshot_sha256 === value.snapshot_sha256 &&
    manifest.policy_sha256 === value.policy_sha256 &&
    isNonNegativeSafeInteger(manifest.response_count) &&
    typeof manifest.response_set_sha256 === 'string' &&
    SHA256_PATTERN.test(manifest.response_set_sha256) &&
    manifest.human_review_reference_sha256 === expected.humanReviewReferenceSha256 &&
    isIsoTimestamp(manifest.closed_at) &&
    manifest.closed_at === value.closed_at &&
    isRecord(manifest.assurance) &&
    manifest.assurance.scope === 'local_database_closure_integrity' &&
    manifest.assurance.regulated_election_certified === false &&
    manifest.assurance.result_certified === false &&
    manifest.assurance.external_anchor_verified === false
  );
};

export const validateSurveyGovernanceReleaseList = (
  value: unknown,
  expected: { surveyId: number; tenantSlug: string },
): SurveyGovernanceReleaseList => {
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, 'contract_version')) {
    throw new SurveyGovernanceContractError('absent');
  }
  if (value.contract_version !== RELEASE_LIST_CONTRACT) {
    throw new SurveyGovernanceContractError('malformed');
  }
  const tenantSlug = expected.tenantSlug.trim();
  const tenant = value.tenant;
  const items = value.items;
  const capabilities = value.capabilities;
  if (
    !tenantSlug ||
    value.ok !== true ||
    !isRecord(tenant) ||
    !isPositiveSafeInteger(tenant.id) ||
    typeof tenant.slug !== 'string' ||
    tenant.slug.trim().toLowerCase() !== tenantSlug.toLowerCase() ||
    value.survey_id !== expected.surveyId ||
    !Array.isArray(items) ||
    !isNonNegativeSafeInteger(value.total) ||
    value.total !== items.length ||
    !isRecord(capabilities) ||
    capabilities.read !== true ||
    capabilities.manage !== true ||
    typeof capabilities.plan_allows_write !== 'boolean' ||
    typeof capabilities.create_release !== 'boolean' ||
    capabilities.required_for_mutation !== 'survey.governance.manage'
  ) {
    throw new SurveyGovernanceContractError('malformed');
  }

  const releaseIds = new Set<number>();
  const versionNumbers = new Set<number>();
  let previousVersion = Number.POSITIVE_INFINITY;
  const publishedReleaseIds: number[] = [];
  for (const item of items) {
    if (
      !isRecord(item) ||
      item.contract_version !== RELEASE_CONTRACT ||
      item.survey_id !== expected.surveyId ||
      !isPositiveSafeInteger(item.release_id) ||
      !isPositiveSafeInteger(item.version_number) ||
      item.version_number >= previousVersion ||
      releaseIds.has(item.release_id) ||
      versionNumbers.has(item.version_number) ||
      !RELEASE_STATUSES.has(String(item.status)) ||
      typeof item.snapshot_sha256 !== 'string' ||
      !SHA256_PATTERN.test(item.snapshot_sha256) ||
      typeof item.policy_sha256 !== 'string' ||
      !SHA256_PATTERN.test(item.policy_sha256) ||
      !isRecord(item.assurance) ||
      item.assurance.regulated_election_certified !== false ||
      item.assurance.result_certified !== false ||
      !isRecord(item.capabilities) ||
      typeof item.capabilities.can_publish !== 'boolean' ||
      typeof item.capabilities.can_close !== 'boolean'
    ) {
      throw new SurveyGovernanceContractError('malformed');
    }
    releaseIds.add(item.release_id);
    versionNumbers.add(item.version_number);
    previousVersion = item.version_number;
    if (item.status === 'published') publishedReleaseIds.push(item.release_id);
  }

  const expectedLatestReleaseId = items.length > 0
    ? (items[0] as Record<string, unknown>).release_id
    : null;
  if (
    publishedReleaseIds.length > 1 ||
    value.active_release_id !== (publishedReleaseIds[0] ?? null) ||
    value.latest_release_id !== expectedLatestReleaseId
  ) {
    throw new SurveyGovernanceContractError('malformed');
  }

  return value as unknown as SurveyGovernanceReleaseList;
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
  const [closeDialogReleaseId, setCloseDialogReleaseId] = useState<number | null>(null);
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
  const inFlightOperationRef = useRef<string | null>(null);
  const loadVersionRef = useRef(0);
  const normalizedTenantSlug = tenantSlug?.trim() ?? '';
  const scopeKey = `${normalizedTenantSlug.toLowerCase() || 'missing-tenant'}:${surveyId}`;
  const activeScopeRef = useRef(scopeKey);
  activeScopeRef.current = scopeKey;
  const scopedContract = contractScope === scopeKey ? contract : null;

  const requestOptions = useMemo(
    () => ({ tenantSlug: normalizedTenantSlug || undefined }),
    [normalizedTenantSlug],
  );

  const load = useCallback(async () => {
    const requestVersion = ++loadVersionRef.current;
    const requestScope = scopeKey;
    setLoading(true);
    setError(null);
    if (!normalizedTenantSlug) {
      setContract(null);
      setContractScope(null);
      setError('No pudimos verificar el tenant de gobernanza. Las acciones quedaron bloqueadas.');
      setLoading(false);
      return;
    }
    try {
      const response = await adminListSurveyGovernanceReleases(surveyId, requestOptions);
      if (loadVersionRef.current !== requestVersion || activeScopeRef.current !== requestScope) return;
      setContract(validateSurveyGovernanceReleaseList(response, {
        surveyId,
        tenantSlug: normalizedTenantSlug,
      }));
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
  }, [normalizedTenantSlug, requestOptions, scopeKey, surveyId]);

  useEffect(() => {
    attemptRef.current = null;
    inFlightOperationRef.current = null;
    setContract(null);
    setContractScope(null);
    setNotice(null);
    setPendingOperation(null);
    setCloseDialogReleaseId(null);
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
    const operationToken = `create:${operationScope}`;
    if (inFlightOperationRef.current !== null) return;
    inFlightOperationRef.current = operationToken;
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
          createPayload: payload,
        })) {
        throw new Error(
          'El servidor respondió, pero no confirmó persistencia e idempotencia del release. La clave se conserva para reintentar.',
        );
      }
      await finishAcknowledgedOperation('Release borrador confirmado por el backend.', operationScope);
    } catch (requestError) {
      failOperation(requestError, operationScope);
    } finally {
      if (inFlightOperationRef.current === operationToken) inFlightOperationRef.current = null;
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
    const operationToken = `publish:${operationScope}:${release.release_id}`;
    if (inFlightOperationRef.current !== null) return;
    inFlightOperationRef.current = operationToken;
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
          snapshotSha256: release.snapshot_sha256,
          policySha256: release.policy_sha256,
          versionNumber: release.version_number,
        })
      ) {
        throw new Error(
          'El servidor respondió, pero no confirmó una publicación durable. La clave se conserva para reintentar.',
        );
      }
      await finishAcknowledgedOperation('Publicación confirmada por el backend.', operationScope);
    } catch (requestError) {
      failOperation(requestError, operationScope);
    } finally {
      if (inFlightOperationRef.current === operationToken) inFlightOperationRef.current = null;
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
    if (!OPAQUE_REVIEW_REFERENCE_PATTERN.test(reviewReference)) {
      setError('Ingresá una referencia opaca namespaced válida antes de cerrar.');
      return;
    }
    const operationToken = `close:${operationScope}:${release.release_id}`;
    if (inFlightOperationRef.current !== null) return;
    inFlightOperationRef.current = operationToken;
    const payload = { human_review_reference: reviewReference };
    const fingerprint = JSON.stringify(['close', operationScope, surveyId, release.release_id, payload]);
    setPendingOperation(`close:${release.release_id}`);
    setError(null);
    setNotice(null);
    try {
      const humanReviewReferenceSha256 = await sha256SurveyConsentText(reviewReference);
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
          snapshotSha256: release.snapshot_sha256,
          policySha256: release.policy_sha256,
          versionNumber: release.version_number,
          humanReviewReferenceSha256,
        })
      ) {
        throw new Error(
          'El servidor respondió, pero no confirmó un cierre durable. La clave se conserva para reintentar.',
        );
      }
      setCloseDialogReleaseId(null);
      await finishAcknowledgedOperation('Cierre confirmado con referencia de revisión humana.', operationScope);
    } catch (requestError) {
      setCloseDialogReleaseId(null);
      failOperation(requestError, operationScope);
    } finally {
      if (inFlightOperationRef.current === operationToken) inFlightOperationRef.current = null;
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading || pendingOperation !== null}
        >
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
            const reviewHelpId = `${reviewInputId}-help`;
            const reviewReference = reviewReferences[release.release_id]?.trim() ?? '';
            const reviewReferenceIsValid = OPAQUE_REVIEW_REFERENCE_PATTERN.test(reviewReference);
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
                        aria-describedby={reviewHelpId}
                        disabled={pendingOperation !== null}
                        onChange={(event) =>
                          setReviewReferences((current) => ({
                            ...current,
                            [release.release_id]: event.target.value,
                          }))
                        }
                      />
                      <p id={reviewHelpId} className="text-xs text-muted-foreground">
                        Usá una referencia opaca namespaced; el backend persiste únicamente su SHA-256 en el manifiesto de cierre.
                      </p>
                    </div>
                    <AlertDialog
                      open={closeDialogReleaseId === release.release_id}
                      onOpenChange={(open) => {
                        if (pendingOperation !== null) return;
                        setCloseDialogReleaseId(open ? release.release_id : null);
                      }}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={pendingOperation !== null || !reviewReferenceIsValid}
                        >
                          {pendingOperation === `close:${release.release_id}` ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : null}
                          Cerrar release
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Cerrar definitivamente el release v{release.version_number}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            El cierre es irreversible: rechaza respuestas nuevas y conserva el conjunto ya registrado.
                            La referencia de revisión se vinculará por SHA-256 al manifiesto durable antes de confirmar.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={pendingOperation !== null}>Volver</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={pendingOperation !== null || !reviewReferenceIsValid}
                            onClick={(event) => {
                              event.preventDefault();
                              void closeRelease(release);
                            }}
                          >
                            {pendingOperation === `close:${release.release_id}` ? 'Cerrando…' : 'Confirmar cierre irreversible'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
