import { apiFetch } from '@/utils/api';
import type {
  SurveyEligibilityIssuePayload,
  SurveyEligibilityIssueReceipt,
  SurveyEligibilityReleaseScope,
  SurveyEligibilityRevocationReason,
  SurveyEligibilityRevocationReceipt,
  SurveyEligibilitySummary,
  SurveyRestrictedEligibilityMode,
} from '@/types/surveyEligibilityAdmin';

const RELEASE_LIST_CONTRACT = 'surveys.governance_releases.v1';
const RELEASE_CONTRACT = 'surveys.governance_release.v1';
const POLICY_CONTRACT = 'surveys.eligibility_policy.v1';
const GRANT_CONTRACT = 'surveys.eligibility_grant.v1';
const SUMMARY_CONTRACT = 'surveys.eligibility_aggregate.v1';
const CREDENTIAL_HEADER = 'X-Survey-Eligibility-Credential';

export const SURVEY_ELIGIBILITY_SUBJECT_REF_PATTERN = /^subj_[A-Za-z0-9_-]{43}$/;
export const SURVEY_ELIGIBILITY_REVIEW_REFERENCE_PATTERN =
  /^[a-z][a-z0-9_.-]{1,31}:[A-Za-z][A-Za-z0-9_.:-]{7,127}$/;
export const SURVEY_ELIGIBILITY_GRANT_REF_PATTERN = /^seg1_[A-Za-z0-9_-]{43}$/;
const CREDENTIAL_PATTERN = /^sec1_[A-Za-z0-9_-]{43}$/;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/;

export const SURVEY_ELIGIBILITY_REVOCATION_REASONS = [
  'administrative_revocation',
  'subject_ineligible',
  'credential_compromised',
  'duplicate_issue',
  'other_reviewed',
] as const satisfies readonly SurveyEligibilityRevocationReason[];

const RESTRICTED_MODES = new Set<SurveyRestrictedEligibilityMode>([
  'institution_attested',
  'manual_review',
]);
const ELIGIBILITY_MODES = new Set([
  'open',
  'self_attested',
  'institution_attested',
  'manual_review',
]);
const RELEASE_STATUSES = new Set(['draft', 'published', 'closed']);
const TERMINAL_STATES = new Set(['expired', 'revoked', 'redeemed']);

export class SurveyEligibilityAdminContractError extends Error {
  constructor(message = 'El backend devolvió un contrato de elegibilidad inválido. Las acciones quedaron bloqueadas.') {
    super(message);
    this.name = 'SurveyEligibilityAdminContractError';
    Object.setPrototypeOf(this, SurveyEligibilityAdminContractError.prototype);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const positiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const nonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));

const normalizeTenantSlug = (value: string) => value.trim().toLowerCase();

const assertScope = (surveyId: number, releaseId: number | undefined, tenantSlug: string) => {
  if (!positiveInteger(surveyId)) {
    throw new SurveyEligibilityAdminContractError('La encuesta no tiene un identificador válido.');
  }
  if (releaseId !== undefined && !positiveInteger(releaseId)) {
    throw new SurveyEligibilityAdminContractError('El release no tiene un identificador válido.');
  }
  const normalizedTenant = normalizeTenantSlug(tenantSlug);
  if (!normalizedTenant) {
    throw new SurveyEligibilityAdminContractError(
      'Seleccioná una organización antes de administrar elegibilidad.',
    );
  }
  return normalizedTenant;
};

const requestOptions = (tenantSlug: string) => ({
  tenantSlug,
  persistTenantSlug: false,
  cache: 'no-store' as RequestCache,
});

const readEligibilityPolicy = (
  value: unknown,
): { mode: string; policyVersion: string } | null => {
  if (!isRecord(value) || value.contract_version !== POLICY_CONTRACT) return null;
  const mode = value.mode;
  const policyVersion = typeof value.policy_version === 'string' ? value.policy_version.trim() : '';
  if (
    typeof mode !== 'string' ||
    !ELIGIBILITY_MODES.has(mode) ||
    !policyVersion ||
    value.human_review_required !== true ||
    value.automated_decision !== false ||
    value.stores_roster_or_pii !== false ||
    value.decision_state !== 'not_evaluated'
  ) {
    return null;
  }
  return { mode, policyVersion };
};

export const parseSurveyEligibilityReleaseScopes = (
  value: unknown,
  expected: { surveyId: number; tenantSlug: string },
): SurveyEligibilityReleaseScope[] => {
  const normalizedTenant = assertScope(expected.surveyId, undefined, expected.tenantSlug);
  if (!isRecord(value) || value.contract_version !== RELEASE_LIST_CONTRACT) {
    throw new SurveyEligibilityAdminContractError();
  }
  const tenant = value.tenant;
  const items = value.items;
  const capabilities = value.capabilities;
  if (
    !isRecord(tenant) ||
    !positiveInteger(tenant.id) ||
    typeof tenant.slug !== 'string' ||
    normalizeTenantSlug(tenant.slug) !== normalizedTenant ||
    value.survey_id !== expected.surveyId ||
    !isRecord(capabilities) ||
    capabilities.read !== true ||
    typeof capabilities.manage !== 'boolean' ||
    typeof capabilities.plan_allows_write !== 'boolean' ||
    typeof capabilities.create_release !== 'boolean' ||
    typeof capabilities.required_for_mutation !== 'string' ||
    !capabilities.required_for_mutation.trim() ||
    !Array.isArray(items) ||
    !nonNegativeInteger(value.total) ||
    value.total !== items.length
  ) {
    throw new SurveyEligibilityAdminContractError();
  }

  const activeReleaseId = value.active_release_id;
  if (activeReleaseId !== null && activeReleaseId !== undefined && !positiveInteger(activeReleaseId)) {
    throw new SurveyEligibilityAdminContractError();
  }

  const releaseIds = new Set<number>();
  const versions = new Set<number>();
  const scopes: SurveyEligibilityReleaseScope[] = [];
  for (const item of items) {
    if (
      !isRecord(item) ||
      item.contract_version !== RELEASE_CONTRACT ||
      !positiveInteger(item.release_id) ||
      item.survey_id !== expected.surveyId ||
      !positiveInteger(item.version_number) ||
      typeof item.status !== 'string' ||
      !RELEASE_STATUSES.has(item.status) ||
      releaseIds.has(item.release_id) ||
      versions.has(item.version_number)
    ) {
      throw new SurveyEligibilityAdminContractError();
    }
    releaseIds.add(item.release_id);
    versions.add(item.version_number);

    const governance = item.governance;
    const policy = readEligibilityPolicy(isRecord(governance) ? governance.eligibility : null);
    if (!policy) {
      throw new SurveyEligibilityAdminContractError();
    }
    if (
      RESTRICTED_MODES.has(policy.mode as SurveyRestrictedEligibilityMode) &&
      item.status === 'published'
    ) {
      scopes.push({
        tenantId: tenant.id,
        surveyId: expected.surveyId,
        releaseId: item.release_id,
        versionNumber: item.version_number,
        status: 'published',
        policyVersion: policy.policyVersion,
        mode: policy.mode as SurveyRestrictedEligibilityMode,
        active: item.release_id === activeReleaseId,
        planAllowsWrite: capabilities.plan_allows_write,
      });
    }
  }
  if (positiveInteger(activeReleaseId) && !releaseIds.has(activeReleaseId)) {
    throw new SurveyEligibilityAdminContractError();
  }
  return scopes.sort((left, right) => right.versionNumber - left.versionNumber);
};

export const parseSurveyEligibilitySummary = (
  value: unknown,
  expected: SurveyEligibilityReleaseScope,
): SurveyEligibilitySummary => {
  if (!isRecord(value) || value.contract_version !== SUMMARY_CONTRACT) {
    throw new SurveyEligibilityAdminContractError();
  }
  const counts = value.counts;
  const denominator = value.denominator_status;
  if (
    value.ok !== true ||
    value.survey_id !== expected.surveyId ||
    value.release_id !== expected.releaseId ||
    value.policy_version !== expected.policyVersion ||
    !isRecord(counts) ||
    !nonNegativeInteger(counts.issued) ||
    !nonNegativeInteger(counts.active) ||
    !nonNegativeInteger(counts.expired) ||
    !nonNegativeInteger(counts.revoked) ||
    !nonNegativeInteger(counts.redeemed) ||
    counts.issued !== counts.active + counts.expired + counts.revoked + counts.redeemed ||
    value.eligible_population !== null ||
    value.participation_rate !== null ||
    value.abstentions !== null ||
    !isRecord(denominator) ||
    denominator.available !== false ||
    denominator.reason_code !== 'survey_eligible_population_not_sealed' ||
    value.subjects_exposed !== false ||
    value.regulated_election_certified !== false ||
    value.result_certified !== false
  ) {
    throw new SurveyEligibilityAdminContractError();
  }
  return {
    contractVersion: SUMMARY_CONTRACT,
    surveyId: expected.surveyId,
    releaseId: expected.releaseId,
    policyVersion: expected.policyVersion,
    counts: {
      issued: counts.issued,
      active: counts.active,
      expired: counts.expired,
      revoked: counts.revoked,
      redeemed: counts.redeemed,
    },
    eligiblePopulation: null,
    participationRate: null,
    abstentions: null,
    denominatorStatus: {
      available: false,
      reasonCode: 'survey_eligible_population_not_sealed',
    },
  };
};

const validIdempotency = (value: string) => IDEMPOTENCY_PATTERN.test(value);

export const parseSurveyEligibilityIssueReceipt = (
  value: unknown,
  expected: {
    release: SurveyEligibilityReleaseScope;
    subjectRef: string;
    reviewReference: string;
  },
): SurveyEligibilityIssueReceipt => {
  if (!isRecord(value) || value.contract_version !== GRANT_CONTRACT) {
    throw new SurveyEligibilityAdminContractError();
  }
  const authority = value.authority;
  const idempotency = value.idempotency;
  const assurance = value.assurance;
  const state = value.state;
  const credential = value.credential;
  const replayed = isRecord(idempotency) ? idempotency.replayed : null;
  const serialized = JSON.stringify(value);
  const activeCredentialValid = state === 'active' && typeof credential === 'string' && CREDENTIAL_PATTERN.test(credential);
  const terminalCredentialValid = TERMINAL_STATES.has(String(state)) && credential === null;
  if (
    value.ok !== true ||
    value.tenant_id !== expected.release.tenantId ||
    value.survey_id !== expected.release.surveyId ||
    value.release_id !== expected.release.releaseId ||
    !SURVEY_ELIGIBILITY_GRANT_REF_PATTERN.test(String(value.grant_ref ?? '')) ||
    !positiveInteger(value.generation) ||
    value.eligibility_mode !== expected.release.mode ||
    value.eligibility_policy_version !== expected.release.policyVersion ||
    !isoTimestamp(value.expires_at) ||
    value.credential_header !== CREDENTIAL_HEADER ||
    (!activeCredentialValid && !terminalCredentialValid) ||
    !isRecord(authority) ||
    authority.namespace !== 'chatboc_manual_review' ||
    authority.adapter_version !== 'manual_review.v1' ||
    !isRecord(idempotency) ||
    idempotency.persisted !== true ||
    typeof replayed !== 'boolean' ||
    idempotency.disposition !== (replayed ? 'replayed' : 'accepted') ||
    !isRecord(assurance) ||
    assurance.privacy !== 'pseudonymous_internal_linkability' ||
    assurance.assurance_level !== 'human_reviewed_opaque_grant' ||
    assurance.authority_binding !== 'operator_attested_v1' ||
    assurance.raw_subject_persisted !== false ||
    assurance.subject_identifier_exposed !== false ||
    assurance.plaintext_credential_persisted !== false ||
    assurance.ballot_secrecy_certified !== false ||
    assurance.regulated_election_certified !== false ||
    assurance.result_certified !== false ||
    serialized.includes(expected.subjectRef) ||
    serialized.includes(expected.reviewReference)
  ) {
    throw new SurveyEligibilityAdminContractError();
  }
  return {
    contractVersion: GRANT_CONTRACT,
    tenantId: expected.release.tenantId,
    surveyId: expected.release.surveyId,
    releaseId: expected.release.releaseId,
    grantRef: String(value.grant_ref),
    state: state as SurveyEligibilityIssueReceipt['state'],
    generation: value.generation,
    mode: expected.release.mode,
    policyVersion: expected.release.policyVersion,
    expiresAt: value.expires_at,
    credentialHeader: CREDENTIAL_HEADER,
    credential: credential as string | null,
    replayed: replayed as boolean,
  };
};

export const parseSurveyEligibilityRevocationReceipt = (
  value: unknown,
  expected: {
    release: SurveyEligibilityReleaseScope;
    grantRef: string;
    reasonCode: SurveyEligibilityRevocationReason;
  },
): SurveyEligibilityRevocationReceipt => {
  if (!isRecord(value) || value.contract_version !== GRANT_CONTRACT) {
    throw new SurveyEligibilityAdminContractError();
  }
  const idempotency = value.idempotency;
  const replayed = isRecord(idempotency) ? idempotency.replayed : null;
  if (
    value.ok !== true ||
    value.tenant_id !== expected.release.tenantId ||
    value.survey_id !== expected.release.surveyId ||
    value.release_id !== expected.release.releaseId ||
    value.grant_ref !== expected.grantRef ||
    value.state !== 'revoked' ||
    value.reason_code !== expected.reasonCode ||
    value.eligibility_policy_version !== expected.release.policyVersion ||
    !isRecord(idempotency) ||
    idempotency.persisted !== true ||
    typeof replayed !== 'boolean' ||
    idempotency.disposition !== (replayed ? 'replayed' : 'accepted') ||
    value.regulated_election_certified !== false ||
    value.result_certified !== false ||
    Object.prototype.hasOwnProperty.call(value, 'credential')
  ) {
    throw new SurveyEligibilityAdminContractError();
  }
  return {
    contractVersion: GRANT_CONTRACT,
    tenantId: expected.release.tenantId,
    surveyId: expected.release.surveyId,
    releaseId: expected.release.releaseId,
    grantRef: expected.grantRef,
    state: 'revoked',
    reasonCode: expected.reasonCode,
    policyVersion: expected.release.policyVersion,
    replayed: replayed as boolean,
  };
};

export const listSurveyEligibilityReleaseScopes = async (
  surveyId: number,
  tenantSlug: string,
) => {
  const normalizedTenant = assertScope(surveyId, undefined, tenantSlug);
  const response = await apiFetch<unknown>(`/api/v2/surveys/${surveyId}/releases`, {
    ...requestOptions(normalizedTenant),
  });
  return parseSurveyEligibilityReleaseScopes(response, {
    surveyId,
    tenantSlug: normalizedTenant,
  });
};

export const getSurveyEligibilitySummary = async (
  release: SurveyEligibilityReleaseScope,
  tenantSlug: string,
) => {
  const normalizedTenant = assertScope(release.surveyId, release.releaseId, tenantSlug);
  const response = await apiFetch<unknown>(
    `/api/v2/surveys/${release.surveyId}/releases/${release.releaseId}/eligibility-summary`,
    requestOptions(normalizedTenant),
  );
  return parseSurveyEligibilitySummary(response, release);
};

export const issueSurveyEligibilityGrant = async (
  release: SurveyEligibilityReleaseScope,
  payload: SurveyEligibilityIssuePayload,
  idempotencyKey: string,
  tenantSlug: string,
) => {
  const normalizedTenant = assertScope(release.surveyId, release.releaseId, tenantSlug);
  if (!validIdempotency(idempotencyKey)) {
    throw new SurveyEligibilityAdminContractError('No se pudo generar una clave idempotente segura.');
  }
  const subjectRef = payload.subjectRef.trim();
  const reviewReference = payload.reviewReference.trim();
  if (
    !SURVEY_ELIGIBILITY_SUBJECT_REF_PATTERN.test(subjectRef) ||
    !SURVEY_ELIGIBILITY_REVIEW_REFERENCE_PATTERN.test(reviewReference)
  ) {
    throw new SurveyEligibilityAdminContractError('Las referencias opacas no tienen el formato requerido.');
  }
  const expiresAt = payload.expiresAt?.trim();
  if (expiresAt && !isoTimestamp(expiresAt)) {
    throw new SurveyEligibilityAdminContractError('El vencimiento no es una fecha ISO-8601 válida.');
  }
  const response = await apiFetch<unknown>(
    `/api/v2/surveys/${release.surveyId}/releases/${release.releaseId}/eligibility-grants`,
    {
      ...requestOptions(normalizedTenant),
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: {
        subject_ref: subjectRef,
        review_reference: reviewReference,
        ...(expiresAt ? { expires_at: expiresAt } : {}),
      },
    },
  );
  return parseSurveyEligibilityIssueReceipt(response, {
    release,
    subjectRef,
    reviewReference,
  });
};

export const revokeSurveyEligibilityGrant = async (
  release: SurveyEligibilityReleaseScope,
  grantRefValue: string,
  reasonCode: SurveyEligibilityRevocationReason,
  idempotencyKey: string,
  tenantSlug: string,
) => {
  const normalizedTenant = assertScope(release.surveyId, release.releaseId, tenantSlug);
  const grantRef = grantRefValue.trim();
  if (!SURVEY_ELIGIBILITY_GRANT_REF_PATTERN.test(grantRef)) {
    throw new SurveyEligibilityAdminContractError('La referencia del grant no es válida.');
  }
  if (!SURVEY_ELIGIBILITY_REVOCATION_REASONS.includes(reasonCode) || !validIdempotency(idempotencyKey)) {
    throw new SurveyEligibilityAdminContractError('La revocación no cumple el contrato permitido.');
  }
  const response = await apiFetch<unknown>(
    `/api/v2/surveys/${release.surveyId}/releases/${release.releaseId}/eligibility-grants/${encodeURIComponent(grantRef)}/revoke`,
    {
      ...requestOptions(normalizedTenant),
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: { reason_code: reasonCode },
    },
  );
  return parseSurveyEligibilityRevocationReceipt(response, {
    release,
    grantRef,
    reasonCode,
  });
};
