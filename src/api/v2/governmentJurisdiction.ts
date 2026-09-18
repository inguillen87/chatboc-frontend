import { apiFetch } from '@/utils/api';

export const GOVERNMENT_JURISDICTION_READINESS_VERSION = 'government.jurisdiction.readiness.v1' as const;
export const GOVERNMENT_JURISDICTION_SUBMISSION_VERSION = 'government.jurisdiction.evidence_submission.v1' as const;
export const GOVERNMENT_JURISDICTION_REVIEW_VERSION = 'government.jurisdiction.review.v1' as const;

export type GovernmentJurisdictionState =
  | 'unverified'
  | 'evidence_submitted'
  | 'rejected'
  | 'verified'
  | 'invalid_verified_record'
  | 'not_applicable';

export type GovernmentJurisdictionNextAction =
  | 'submit_jurisdiction_evidence'
  | 'await_platform_jurisdiction_review'
  | 'resubmit_jurisdiction_evidence'
  | 'review_survey_content'
  | 'contact_platform_support'
  | 'continue_tenant_configuration';

export interface GovernmentJurisdictionAuditEvent {
  id: number;
  event_type:
    | 'tenant_jurisdiction_evidence_submitted'
    | 'tenant_jurisdiction_verified'
    | 'tenant_jurisdiction_rejected';
  actor_user_id: number | null;
  decision: 'submitted' | 'verify' | 'reject' | null;
  submission_sha256: string | null;
  reason_code: string | null;
  created_at: string | null;
}

export interface GovernmentJurisdictionReadiness {
  contract_version: typeof GOVERNMENT_JURISDICTION_READINESS_VERSION;
  tenant: {
    id: number;
    slug: string;
    type: string;
  };
  state: GovernmentJurisdictionState;
  ready_to_publish: boolean;
  next_action: GovernmentJurisdictionNextAction;
  publication_guard: {
    government_evidence_required: boolean;
    allowed_to_publish: boolean;
    reason_code: string | null;
    guard_preserved: true;
  };
  jurisdiction: {
    status: string;
    reference: string | null;
    evidence: {
      reference: string | null;
      document_sha256: string | null;
      submission_sha256: string | null;
      raw_content_stored: false;
      credentials_stored: false;
    };
    verified_by_user_id: number | null;
    verified_at: string | null;
  };
  workflow: {
    submission: GovernmentJurisdictionAuditEvent | null;
    review: GovernmentJurisdictionAuditEvent | null;
    review_matches_submission: boolean;
    separation_of_duties_enforced: true;
  };
}

export interface GovernmentJurisdictionEvidenceInput {
  tenantSlug: string;
  jurisdictionRef: string;
  evidenceRef: string;
  evidenceSha256: string;
  idempotencyKey: string;
}

export interface GovernmentJurisdictionEvidenceResult {
  contract_version: typeof GOVERNMENT_JURISDICTION_SUBMISSION_VERSION;
  replayed: boolean;
  write_performed: boolean;
  verification_granted: false;
  readiness: GovernmentJurisdictionReadiness;
}

export interface GovernmentJurisdictionReviewInput {
  tenantSlug: string;
  decision: 'verify' | 'reject';
  expectedSubmissionSha256: string;
  reasonCode?: string;
  idempotencyKey: string;
}

export interface GovernmentJurisdictionReviewResult {
  contract_version: typeof GOVERNMENT_JURISDICTION_REVIEW_VERSION;
  decision: 'verify' | 'reject';
  replayed: boolean;
  write_performed: boolean;
  readiness: GovernmentJurisdictionReadiness;
}

const TENANT_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,78}[a-z0-9])?$/;
const GENERIC_TENANT_SLUGS = new Set([
  'app',
  'admin',
  'superadmin',
  'super-admin',
  'super_admin',
  'dashboard',
  'perfil',
  'profile',
]);
const JURISDICTION_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{2,159}$/;
const EVIDENCE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{2,199}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/;
const REASON_CODE_PATTERN = /^[a-z][a-z0-9_.:-]{2,79}$/;
const STATES = new Set<GovernmentJurisdictionState>([
  'unverified',
  'evidence_submitted',
  'rejected',
  'verified',
  'invalid_verified_record',
  'not_applicable',
]);
const NEXT_ACTIONS = new Set<GovernmentJurisdictionNextAction>([
  'submit_jurisdiction_evidence',
  'await_platform_jurisdiction_review',
  'resubmit_jurisdiction_evidence',
  'review_survey_content',
  'contact_platform_support',
  'continue_tenant_configuration',
]);
const EVENT_TYPES = new Set<GovernmentJurisdictionAuditEvent['event_type']>([
  'tenant_jurisdiction_evidence_submitted',
  'tenant_jurisdiction_verified',
  'tenant_jurisdiction_rejected',
]);
const DECISIONS = new Set<Exclude<GovernmentJurisdictionAuditEvent['decision'], null>>([
  'submitted',
  'verify',
  'reject',
]);

const invalidContract = (): never => {
  throw new Error('government_jurisdiction_contract_invalid');
};

const invalidRequest = (): never => {
  throw new Error('government_jurisdiction_request_invalid');
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, expected: readonly string[]) => {
  const actual = Object.keys(value);
  return actual.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && Boolean(value.trim());

const isNullableString = (value: unknown): value is string | null =>
  value === null || isNonEmptyString(value);

const isNullablePositiveInteger = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isInteger(value) && value > 0);

const normalizeTenantSlug = (value: string) => value.trim().toLowerCase();

const assertTenantSlug = (value: string) => {
  const normalized = normalizeTenantSlug(value);
  if (!TENANT_SLUG_PATTERN.test(normalized) || GENERIC_TENANT_SLUGS.has(normalized)) {
    return invalidRequest();
  }
  return normalized;
};

const parseNullableDigest = (value: unknown) => {
  if (value === null) return null;
  if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) return invalidContract();
  return value;
};

const parseAuditEvent = (value: unknown): GovernmentJurisdictionAuditEvent | null => {
  if (value === null) return null;
  if (
    !isRecord(value)
    || !hasExactKeys(value, [
      'id',
      'event_type',
      'actor_user_id',
      'decision',
      'submission_sha256',
      'reason_code',
      'created_at',
    ])
    || typeof value.id !== 'number'
    || !Number.isInteger(value.id)
    || value.id <= 0
    || !EVENT_TYPES.has(value.event_type as GovernmentJurisdictionAuditEvent['event_type'])
    || !isNullablePositiveInteger(value.actor_user_id)
    || !(value.decision === null || DECISIONS.has(value.decision as Exclude<GovernmentJurisdictionAuditEvent['decision'], null>))
    || !isNullableString(value.reason_code)
    || !isNullableString(value.created_at)
  ) {
    return invalidContract();
  }
  return {
    id: value.id,
    event_type: value.event_type as GovernmentJurisdictionAuditEvent['event_type'],
    actor_user_id: value.actor_user_id,
    decision: value.decision as GovernmentJurisdictionAuditEvent['decision'],
    submission_sha256: parseNullableDigest(value.submission_sha256),
    reason_code: value.reason_code,
    created_at: value.created_at,
  };
};

export const parseGovernmentJurisdictionReadiness = (
  payload: unknown,
  requestedTenantSlug: string,
): GovernmentJurisdictionReadiness => {
  const normalizedTenant = assertTenantSlug(requestedTenantSlug);
  if (
    !isRecord(payload)
    || !hasExactKeys(payload, [
      'contract_version',
      'tenant',
      'state',
      'ready_to_publish',
      'next_action',
      'publication_guard',
      'jurisdiction',
      'workflow',
    ])
    || payload.contract_version !== GOVERNMENT_JURISDICTION_READINESS_VERSION
    || !isRecord(payload.tenant)
    || !hasExactKeys(payload.tenant, ['id', 'slug', 'type'])
    || typeof payload.tenant.id !== 'number'
    || !Number.isInteger(payload.tenant.id)
    || payload.tenant.id <= 0
    || !isNonEmptyString(payload.tenant.slug)
    || !isNonEmptyString(payload.tenant.type)
    || !STATES.has(payload.state as GovernmentJurisdictionState)
    || typeof payload.ready_to_publish !== 'boolean'
    || !NEXT_ACTIONS.has(payload.next_action as GovernmentJurisdictionNextAction)
    || !isRecord(payload.publication_guard)
    || !hasExactKeys(payload.publication_guard, [
      'government_evidence_required',
      'allowed_to_publish',
      'reason_code',
      'guard_preserved',
    ])
    || typeof payload.publication_guard.government_evidence_required !== 'boolean'
    || typeof payload.publication_guard.allowed_to_publish !== 'boolean'
    || !isNullableString(payload.publication_guard.reason_code)
    || payload.publication_guard.guard_preserved !== true
    || payload.ready_to_publish !== payload.publication_guard.allowed_to_publish
    || !isRecord(payload.jurisdiction)
    || !hasExactKeys(payload.jurisdiction, [
      'status',
      'reference',
      'evidence',
      'verified_by_user_id',
      'verified_at',
    ])
    || !isNonEmptyString(payload.jurisdiction.status)
    || !isNullableString(payload.jurisdiction.reference)
    || !isNullablePositiveInteger(payload.jurisdiction.verified_by_user_id)
    || !isNullableString(payload.jurisdiction.verified_at)
    || !isRecord(payload.jurisdiction.evidence)
    || !hasExactKeys(payload.jurisdiction.evidence, [
      'reference',
      'document_sha256',
      'submission_sha256',
      'raw_content_stored',
      'credentials_stored',
    ])
    || !isNullableString(payload.jurisdiction.evidence.reference)
    || payload.jurisdiction.evidence.raw_content_stored !== false
    || payload.jurisdiction.evidence.credentials_stored !== false
    || !isRecord(payload.workflow)
    || !hasExactKeys(payload.workflow, [
      'submission',
      'review',
      'review_matches_submission',
      'separation_of_duties_enforced',
    ])
    || typeof payload.workflow.review_matches_submission !== 'boolean'
    || payload.workflow.separation_of_duties_enforced !== true
  ) {
    return invalidContract();
  }
  if (normalizeTenantSlug(payload.tenant.slug) !== normalizedTenant) {
    throw new Error('government_jurisdiction_scope_mismatch');
  }

  const documentSha256 = parseNullableDigest(payload.jurisdiction.evidence.document_sha256);
  const submissionSha256 = parseNullableDigest(payload.jurisdiction.evidence.submission_sha256);
  const submission = parseAuditEvent(payload.workflow.submission);
  const review = parseAuditEvent(payload.workflow.review);
  if (
    (submission && submission.event_type !== 'tenant_jurisdiction_evidence_submitted')
    || (review && !['tenant_jurisdiction_verified', 'tenant_jurisdiction_rejected'].includes(review.event_type))
    || (submission?.submission_sha256 ?? null) !== submissionSha256
    || (payload.workflow.review_matches_submission
      && (!review || !submissionSha256 || review.submission_sha256 !== submissionSha256))
    || (payload.state === 'evidence_submitted' && !submission)
    || (payload.state === 'rejected' && review?.event_type !== 'tenant_jurisdiction_rejected')
  ) {
    return invalidContract();
  }

  return {
    contract_version: GOVERNMENT_JURISDICTION_READINESS_VERSION,
    tenant: {
      id: payload.tenant.id,
      slug: payload.tenant.slug,
      type: payload.tenant.type,
    },
    state: payload.state as GovernmentJurisdictionState,
    ready_to_publish: payload.ready_to_publish,
    next_action: payload.next_action as GovernmentJurisdictionNextAction,
    publication_guard: {
      government_evidence_required: payload.publication_guard.government_evidence_required,
      allowed_to_publish: payload.publication_guard.allowed_to_publish,
      reason_code: payload.publication_guard.reason_code,
      guard_preserved: true,
    },
    jurisdiction: {
      status: payload.jurisdiction.status,
      reference: payload.jurisdiction.reference,
      evidence: {
        reference: payload.jurisdiction.evidence.reference,
        document_sha256: documentSha256,
        submission_sha256: submissionSha256,
        raw_content_stored: false,
        credentials_stored: false,
      },
      verified_by_user_id: payload.jurisdiction.verified_by_user_id,
      verified_at: payload.jurisdiction.verified_at,
    },
    workflow: {
      submission,
      review,
      review_matches_submission: payload.workflow.review_matches_submission,
      separation_of_duties_enforced: true,
    },
  };
};

const assertEvidenceInput = (input: GovernmentJurisdictionEvidenceInput) => {
  const tenantSlug = assertTenantSlug(input.tenantSlug);
  const jurisdictionRef = input.jurisdictionRef.trim();
  const evidenceRef = input.evidenceRef.trim();
  const evidenceSha256 = input.evidenceSha256.trim().toLowerCase();
  if (
    !JURISDICTION_REF_PATTERN.test(jurisdictionRef)
    || !EVIDENCE_REF_PATTERN.test(evidenceRef)
    || evidenceRef.includes('://')
    || evidenceRef.includes('@')
    || evidenceRef.includes('?')
    || evidenceRef.includes('#')
    || evidenceRef.includes('..')
    || !SHA256_PATTERN.test(evidenceSha256)
    || !IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)
  ) {
    return invalidRequest();
  }
  return { tenantSlug, jurisdictionRef, evidenceRef, evidenceSha256 };
};

const parseEvidenceResult = (
  payload: unknown,
  tenantSlug: string,
): GovernmentJurisdictionEvidenceResult => {
  if (
    !isRecord(payload)
    || !hasExactKeys(payload, [
      'contract_version',
      'replayed',
      'write_performed',
      'verification_granted',
      'readiness',
    ])
    || payload.contract_version !== GOVERNMENT_JURISDICTION_SUBMISSION_VERSION
    || typeof payload.replayed !== 'boolean'
    || typeof payload.write_performed !== 'boolean'
    || payload.replayed === payload.write_performed
    || payload.verification_granted !== false
  ) {
    return invalidContract();
  }
  return {
    contract_version: GOVERNMENT_JURISDICTION_SUBMISSION_VERSION,
    replayed: payload.replayed,
    write_performed: payload.write_performed,
    verification_granted: false,
    readiness: parseGovernmentJurisdictionReadiness(payload.readiness, tenantSlug),
  };
};

export const getGovernmentJurisdictionReadiness = async (tenantSlug: string) => {
  const requestedTenantSlug = assertTenantSlug(tenantSlug);
  const payload = await apiFetch<unknown>(
    `/api/v2/tenants/${encodeURIComponent(requestedTenantSlug)}/government-readiness/jurisdiction`,
    {
      cache: 'no-store',
      omitTenant: true,
      persistTenantSlug: false,
    },
  );
  return parseGovernmentJurisdictionReadiness(payload, requestedTenantSlug);
};

export const submitGovernmentJurisdictionEvidence = async (
  input: GovernmentJurisdictionEvidenceInput,
) => {
  const normalized = assertEvidenceInput(input);
  const payload = await apiFetch<unknown>(
    `/api/v2/tenants/${encodeURIComponent(normalized.tenantSlug)}/government-readiness/jurisdiction/evidence`,
    {
      method: 'POST',
      body: {
        jurisdiction_ref: normalized.jurisdictionRef,
        evidence_ref: normalized.evidenceRef,
        evidence_sha256: normalized.evidenceSha256,
      },
      headers: { 'Idempotency-Key': input.idempotencyKey },
      cache: 'no-store',
      omitTenant: true,
      persistTenantSlug: false,
    },
  );
  return parseEvidenceResult(payload, normalized.tenantSlug);
};

const parseReviewResult = (
  payload: unknown,
  tenantSlug: string,
  expectedDecision: 'verify' | 'reject',
): GovernmentJurisdictionReviewResult => {
  if (
    !isRecord(payload)
    || !hasExactKeys(payload, ['contract_version', 'decision', 'replayed', 'write_performed', 'readiness'])
    || payload.contract_version !== GOVERNMENT_JURISDICTION_REVIEW_VERSION
    || payload.decision !== expectedDecision
    || typeof payload.replayed !== 'boolean'
    || typeof payload.write_performed !== 'boolean'
    || payload.replayed === payload.write_performed
  ) {
    return invalidContract();
  }
  return {
    contract_version: GOVERNMENT_JURISDICTION_REVIEW_VERSION,
    decision: expectedDecision,
    replayed: payload.replayed,
    write_performed: payload.write_performed,
    readiness: parseGovernmentJurisdictionReadiness(payload.readiness, tenantSlug),
  };
};

export const reviewGovernmentJurisdictionEvidence = async (
  input: GovernmentJurisdictionReviewInput,
) => {
  const tenantSlug = assertTenantSlug(input.tenantSlug);
  const expectedSubmissionSha256 = input.expectedSubmissionSha256.trim().toLowerCase();
  const reasonCode = input.reasonCode?.trim().toLowerCase();
  if (
    !SHA256_PATTERN.test(expectedSubmissionSha256)
    || !IDEMPOTENCY_KEY_PATTERN.test(input.idempotencyKey)
    || (input.decision === 'reject' && (!reasonCode || !REASON_CODE_PATTERN.test(reasonCode)))
    || (input.decision === 'verify' && Boolean(reasonCode))
  ) {
    return invalidRequest();
  }
  const body = input.decision === 'reject'
    ? {
        decision: 'reject' as const,
        expected_submission_sha256: expectedSubmissionSha256,
        reason_code: reasonCode,
      }
    : {
        decision: 'verify' as const,
        expected_submission_sha256: expectedSubmissionSha256,
      };
  const payload = await apiFetch<unknown>(
    `/api/v2/tenants/${encodeURIComponent(tenantSlug)}/government-readiness/jurisdiction/review`,
    {
      method: 'POST',
      body,
      headers: { 'Idempotency-Key': input.idempotencyKey },
      cache: 'no-store',
      omitTenant: true,
      persistTenantSlug: false,
    },
  );
  return parseReviewResult(payload, tenantSlug, input.decision);
};
