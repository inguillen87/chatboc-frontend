import { panelApi } from '@/api/v2/client';
import { ApiError } from '@/utils/api';

import {
  TERRITORIAL_GEOCODING_CONTRACT,
  TERRITORIAL_GEOCODING_EXECUTION_CONTRACT,
  TERRITORIAL_GEOCODING_PREVIEW_CONTRACT,
  TERRITORIAL_GEOCODING_SYNC_CONTRACT,
  type TerritorialGeocodingAttempt,
  type TerritorialGeocodingApplyRequest,
  type TerritorialGeocodingAttemptsResponse,
  type TerritorialGeocodingDetail,
  type TerritorialGeocodingExecutionRequest,
  type TerritorialGeocodingExecutionResponse,
  type TerritorialGeocodingItem,
  type TerritorialGeocodingPreviewParams,
  type TerritorialGeocodingPreviewQueue,
  type TerritorialGeocodingProposal,
  type TerritorialGeocodingQueue,
  type TerritorialGeocodingQueueParams,
  type TerritorialGeocodingReviewRequest,
  type TerritorialGeocodingReviewResponse,
  type TerritorialGeocodingSyncRequest,
  type TerritorialGeocodingSyncResponse,
  type TerritorialProposalValidation,
  type TerritorialProposalVersion,
  type TerritorialReviewDecision,
  type TerritorialReviewReceipt,
  type TerritorialReviewState,
  type TerritorialTicketSourceModel,
} from './territorialGeocodingTypes';

const QUEUE_PATH = '/api/v2/analytics/operations/geocoding-queue';
const APPROVED_REASONS = new Set(['verified_against_source', 'verified_on_map', 'verified_with_field_team']);
const REJECTED_REASONS = new Set([
  'ambiguous_candidate',
  'duplicate_job',
  'incorrect_location',
  'insufficient_precision',
  'outside_jurisdiction',
  'stale_source',
]);
const REVIEW_STATES = new Set<TerritorialReviewState>(['unreviewed', 'approved', 'rejected', 'stale']);
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const PROPOSAL_DIGEST_PATTERN = /^[a-f0-9]{64}$/;

export class TerritorialGeocodingContractError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'TerritorialGeocodingContractError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const record = (value: unknown) => isRecord(value) ? value : {};
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const bool = (value: unknown) => typeof value === 'boolean' ? value : null;
const number = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
};
const count = (value: unknown) => Math.max(0, Math.floor(number(value) ?? 0));
const stringList = (value: unknown) => Array.isArray(value)
  ? value.map(text).filter((entry): entry is string => Boolean(entry))
  : [];
const countRecord = (value: unknown) => Object.fromEntries(
  Object.entries(record(value))
    .map(([key, raw]) => [key, count(raw)])
    .filter(([key]) => Boolean(key)),
);

const normalizeTenantSlug = (value: unknown) => text(value)?.toLowerCase() ?? '';

const requireProposalDigest = (value: unknown, code: string) => {
  const digest = text(value);
  if (!digest || !PROPOSAL_DIGEST_PATTERN.test(digest)) {
    throw new TerritorialGeocodingContractError(code);
  }
  return digest;
};

const normalizeProposalVersion = (value: unknown, code: string): TerritorialProposalVersion => {
  const source = record(value);
  const attemptId = text(source.attempt_id);
  const attemptNumber = number(source.attempt_number);
  if (!attemptId || attemptNumber === null || !Number.isInteger(attemptNumber) || attemptNumber < 1) {
    throw new TerritorialGeocodingContractError(code);
  }
  return { attemptId, attemptNumber };
};

const assertProposalExpectation = (
  input: Pick<TerritorialGeocodingReviewRequest, 'expectedProposalDigest' | 'expectedAttemptId' | 'expectedAttemptNumber'>,
) => {
  if (
    typeof input.expectedProposalDigest !== 'string'
    || !PROPOSAL_DIGEST_PATTERN.test(input.expectedProposalDigest)
    || typeof input.expectedAttemptId !== 'string'
    || !input.expectedAttemptId.trim()
    || !Number.isInteger(input.expectedAttemptNumber)
    || input.expectedAttemptNumber < 1
  ) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_expected_proposal_invalid');
  }
};

const requireContract = (value: unknown) => {
  const source = record(value);
  if (source.contract_version !== TERRITORIAL_GEOCODING_CONTRACT) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_contract_version_invalid');
  }
  return source;
};

const safeActionHref = (value: unknown, suffix: '' | '/attempts' | '/review' | '/resolve' | '/apply') => {
  const href = text(record(value).href);
  if (!href || !href.startsWith(`${QUEUE_PATH}/`) || !href.endsWith(suffix)) return null;
  if (href.includes('?') || href.includes('#') || href.includes('..')) return null;
  const tail = href.slice(`${QUEUE_PATH}/`.length);
  const expected = suffix
    ? new RegExp(`^[^/]+${suffix.replace('/', '\\/')}$`)
    : /^[^/]+$/;
  if (!expected.test(tail)) return null;
  return href;
};

export const normalizeTerritorialTicketSourceModel = (value: unknown): TerritorialTicketSourceModel | null => {
  const normalized = text(value)?.toLowerCase().replace(/[^a-z]/g, '');
  if (normalized === 'tenantticket') return 'TenantTicket';
  if (normalized === 'municipioticket') return 'MunicipioTicket';
  if (normalized === 'pymeticket') return 'PymeTicket';
  return null;
};

const normalizeValidation = (value: unknown): TerritorialProposalValidation => {
  const source = record(value);
  return {
    autoApplyEligible: bool(source.auto_apply_eligible) === true,
    issues: stringList(source.issues).slice(0, 20),
    jurisdictionStatus: text(source.jurisdiction_status),
    localityMatch: bool(source.locality_match),
    provinceMatch: bool(source.province_match),
    countryMatch: bool(source.country_match),
  };
};

const normalizeProposal = (value: unknown): TerritorialGeocodingProposal => {
  const source = record(value);
  const provenance = isRecord(source.provenance) ? source.provenance : null;
  if (text(source.provider_place_id) || text(source.place_id)) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_proposal_provider_identifier_exposed');
  }
  if (typeof source.provider_reference_present !== 'boolean') {
    throw new TerritorialGeocodingContractError('territorial_geocoding_proposal_reference_state_invalid');
  }
  if (provenance && provenance.source_address_retained !== false) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_proposal_provenance_invalid');
  }
  return {
    lat: number(source.lat),
    lng: number(source.lng),
    locationType: text(source.location_type),
    partialMatch: bool(source.partial_match),
    provider: text(source.provider),
    providerReferencePresent: source.provider_reference_present,
    coordinateReference: source.coordinate_reference === 'WGS84' ? 'WGS84' : null,
    provenance: provenance ? {
      source: text(provenance.source),
      provider: text(provenance.provider),
      proposalDigest: text(provenance.proposal_digest),
      sourceAddressRetained: false,
    } : null,
    validation: normalizeValidation(source.validation),
  };
};

const normalizeReviewState = (value: unknown): TerritorialReviewState => {
  const normalized = text(value) as TerritorialReviewState | null;
  return normalized && REVIEW_STATES.has(normalized) ? normalized : 'unreviewed';
};

const normalizeReviewReceipt = (value: unknown): TerritorialReviewReceipt => {
  const source = record(value);
  const decision = text(source.decision);
  if (decision !== 'approved' && decision !== 'rejected') {
    throw new TerritorialGeocodingContractError('territorial_geocoding_review_decision_invalid');
  }
  if (source.coordinate_write_performed !== false) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_review_write_policy_invalid');
  }
  const hasProposalVersion = source.proposal_attempt_id !== null
    && source.proposal_attempt_id !== undefined
    && source.proposal_attempt_number !== null
    && source.proposal_attempt_number !== undefined;
  const proposalVersion = hasProposalVersion
    ? normalizeProposalVersion({
      attempt_id: source.proposal_attempt_id,
      attempt_number: source.proposal_attempt_number,
    }, 'territorial_geocoding_review_proposal_version_invalid')
    : null;
  return {
    id: String(source.id ?? ''),
    decision,
    effectiveState: normalizeReviewState(source.effective_state),
    reasonCode: text(source.reason_code) ?? 'reason_not_published',
    reviewerUserId: source.reviewer_user_id === null || source.reviewer_user_id === undefined
      ? null
      : String(source.reviewer_user_id),
    reviewedJobStatus: text(source.reviewed_job_status) ?? 'status_not_published',
    proposalCurrent: source.proposal_current === true,
    proposalDigest: requireProposalDigest(
      source.proposal_digest,
      'territorial_geocoding_review_proposal_digest_invalid',
    ),
    proposalVersion,
    coordinateWritePerformed: false,
    createdAt: text(source.created_at),
  };
};

const normalizeAttempt = (value: unknown): TerritorialGeocodingAttempt => {
  const source = record(value);
  if (typeof source.coordinate_write_performed !== 'boolean') {
    throw new TerritorialGeocodingContractError('territorial_geocoding_attempt_write_state_missing');
  }
  const proposalSource = isRecord(source.proposal) ? source.proposal : null;
  if (proposalSource && (text(proposalSource.provider_place_id) || text(proposalSource.place_id))) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_attempt_provider_identifier_exposed');
  }
  return {
    id: String(source.id ?? ''),
    attemptNumber: count(source.attempt_number),
    outcomeStatus: text(source.outcome_status) ?? 'status_not_published',
    reasonCode: text(source.reason_code) ?? 'reason_not_published',
    provider: text(source.provider),
    externalCallPerformed: source.external_call_performed === true,
    coordinateWritePerformed: source.coordinate_write_performed,
    proposal: proposalSource ? {
      lat: number(proposalSource.lat),
      lng: number(proposalSource.lng),
      locationType: text(proposalSource.location_type),
      partialMatch: bool(proposalSource.partial_match),
    } : null,
    validation: normalizeValidation(source.validation),
    createdAt: text(source.created_at),
  };
};

const normalizeItem = (value: unknown): TerritorialGeocodingItem => {
  const source = record(value);
  const quality = record(source.quality);
  const actions = record(source.actions);
  const reviewAction = record(actions.review);
  const resolveAction = record(actions.resolve);
  const applyAction = record(actions.apply);
  const allowedReasons = record(reviewAction.allowed_reason_codes);
  const approvedReasonCodes = stringList(allowedReasons.approved).filter((reason) => APPROVED_REASONS.has(reason));
  const rejectedReasonCodes = stringList(allowedReasons.rejected).filter((reason) => REJECTED_REASONS.has(reason));
  const coordinateApplicationSupported = reviewAction.coordinate_application_supported;
  if (coordinateApplicationSupported !== false) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_coordinate_policy_invalid');
  }
  const sourceModelRaw = text(source.source_model);
  const latestReview = isRecord(source.latest_review) ? normalizeReviewReceipt(source.latest_review) : null;
  const jobId = text(source.id) ?? (source.id === undefined || source.id === null ? null : String(source.id));
  if (!jobId) throw new TerritorialGeocodingContractError('territorial_geocoding_job_identity_missing');
  const reviewHref = safeActionHref(reviewAction, '/review');
  return {
    id: jobId,
    ticketId: text(source.ticket_id) ?? (source.ticket_id === undefined || source.ticket_id === null ? null : String(source.ticket_id)),
    sourceModelRaw,
    ticketSourceModel: normalizeTerritorialTicketSourceModel(sourceModelRaw),
    status: text(source.status) ?? 'status_not_published',
    reasonCode: text(source.reason_code) ?? 'reason_not_published',
    reviewState: normalizeReviewState(source.review_state),
    latestReview,
    category: text(source.category),
    zone: text(source.zone),
    quality: {
      state: text(quality.state) ?? 'quality_not_published',
      hasProposal: quality.has_proposal === true,
      autoApplyEligible: quality.auto_apply_eligible === true,
      jurisdictionStatus: text(quality.jurisdiction_status),
      locationType: text(quality.location_type),
      partialMatch: bool(quality.partial_match),
      localityMatch: bool(quality.locality_match),
      provinceMatch: bool(quality.province_match),
      countryMatch: bool(quality.country_match),
      issues: stringList(quality.issues).slice(0, 20),
    },
    attemptCount: count(source.attempt_count),
    lastAttemptAt: text(source.last_attempt_at),
    createdAt: text(source.created_at),
    updatedAt: text(source.updated_at),
    detailHref: safeActionHref(actions.detail, ''),
    attemptsHref: safeActionHref(actions.attempts, '/attempts'),
    reviewAction: {
      href: reviewHref,
      canApprove: Boolean(reviewHref && reviewAction.can_approve === true && approvedReasonCodes.length > 0),
      canReject: Boolean(reviewHref && reviewAction.can_reject === true && rejectedReasonCodes.length > 0),
      approvedReasonCodes,
      rejectedReasonCodes,
      coordinateApplicationSupported: false,
    },
    resolveAction: {
      href: safeActionHref(resolveAction, '/resolve'),
      enabled: resolveAction.enabled === true,
      reasonCode: text(resolveAction.reason_code) ?? 'provider_lookup_not_published',
      confirmationRequired: false,
    },
    applyAction: {
      href: safeActionHref(applyAction, '/apply'),
      enabled: applyAction.enabled === true,
      reasonCode: text(applyAction.reason_code) ?? 'coordinate_application_not_published',
      confirmationRequired: applyAction.confirmation_required === true,
    },
  };
};

const ensureListPrivacy = (value: unknown) => {
  const privacy = record(value);
  if (
    privacy.raw_address_exposed !== false
    || privacy.address_digest_exposed !== false
    || privacy.exact_coordinates_exposed !== false
    || privacy.aggregate_list_only !== true
  ) throw new TerritorialGeocodingContractError('territorial_geocoding_list_privacy_invalid');
};

export const normalizeTerritorialGeocodingQueue = (value: unknown): TerritorialGeocodingQueue => {
  const source = requireContract(value);
  ensureListPrivacy(source.privacy);
  const summary = record(source.summary);
  const pagination = record(source.pagination);
  const items = Array.isArray(source.items) ? source.items.map(normalizeItem) : [];
  return {
    contractVersion: TERRITORIAL_GEOCODING_CONTRACT,
    requestId: text(source.request_id),
    tenantId: String(source.tenant_id ?? ''),
    summary: {
      total: count(summary.total),
      withProposal: count(summary.with_proposal),
      needsHumanReview: count(summary.needs_human_review),
      coordinateWritesFromReview: 0,
      byStatus: countRecord(summary.by_status),
      byReviewState: countRecord(summary.by_review_state),
      byReasonCode: countRecord(summary.by_reason_code),
      byQualityState: countRecord(summary.by_quality_state),
    },
    pagination: {
      page: Math.max(1, count(pagination.page)),
      perPage: Math.max(1, count(pagination.per_page)),
      total: count(pagination.total),
      hasNext: pagination.has_next === true,
    },
    items,
    privacy: {
      rawAddressExposed: false,
      addressDigestExposed: false,
      exactCoordinatesExposed: false,
      aggregateListOnly: true,
    },
  };
};

export const normalizeTerritorialGeocodingDetail = (value: unknown): TerritorialGeocodingDetail => {
  const source = requireContract(value);
  const selected = record(source.selected);
  const privacy = record(source.privacy);
  const writePolicy = record(source.write_policy);
  if (
    privacy.raw_address_exposed !== false
    || privacy.address_digest_exposed !== false
    || typeof privacy.exact_coordinates_exposed !== 'boolean'
    || privacy.exact_coordinates_classification !== 'restricted_operational'
    || privacy.exact_coordinates_access !== 'tenant_admin_only'
    || privacy.provider_place_id_exposed !== false
    || privacy.provider_place_id_retained_for_new_attempts !== false
    || privacy.authorized_admin_detail !== true
  ) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_detail_privacy_invalid');
  }
  if (
    writePolicy.get_is_read_only !== true
    || writePolicy.provider_call_performed !== false
    || writePolicy.coordinate_application_supported !== true
    || writePolicy.review_is_human_decision_only !== true
    || writePolicy.apply_requires_separate_confirmed_post !== true
  ) throw new TerritorialGeocodingContractError('territorial_geocoding_detail_write_policy_invalid');
  const proposalDigest = requireProposalDigest(
    selected.proposal_digest,
    'territorial_geocoding_detail_proposal_digest_invalid',
  );
  const proposalVersion = selected.proposal_version === null || selected.proposal_version === undefined
    ? null
    : normalizeProposalVersion(
      selected.proposal_version,
      'territorial_geocoding_detail_proposal_version_invalid',
    );
  return {
    contractVersion: TERRITORIAL_GEOCODING_CONTRACT,
    tenantId: String(source.tenant_id ?? ''),
    item: normalizeItem(source.item),
    proposal: normalizeProposal(selected.proposal),
    proposalDigest,
    proposalVersion,
    attempts: Array.isArray(selected.attempts) ? selected.attempts.map(normalizeAttempt) : [],
    reviews: Array.isArray(selected.reviews) ? selected.reviews.map(normalizeReviewReceipt) : [],
    privacy: {
      rawAddressExposed: false,
      addressDigestExposed: false,
      exactCoordinatesExposed: privacy.exact_coordinates_exposed,
      exactCoordinatesClassification: 'restricted_operational',
      exactCoordinatesAccess: 'tenant_admin_only',
      providerPlaceIdExposed: false,
      authorizedAdminDetail: true,
    },
    writePolicy: {
      getIsReadOnly: true,
      providerCallPerformed: false,
      coordinateApplicationSupported: true,
      reviewIsHumanDecisionOnly: true,
      applyRequiresSeparateConfirmedPost: true,
    },
  };
};

export const normalizeTerritorialGeocodingAttempts = (value: unknown): TerritorialGeocodingAttemptsResponse => {
  const source = requireContract(value);
  const privacy = record(source.privacy);
  if (
    privacy.raw_address_exposed !== false
    || privacy.address_digest_exposed !== false
    || typeof privacy.exact_coordinates_exposed !== 'boolean'
    || privacy.exact_coordinates_classification !== 'restricted_operational'
    || privacy.exact_coordinates_access !== 'tenant_admin_only'
    || privacy.provider_place_id_exposed !== false
    || privacy.authorized_admin_detail !== true
  ) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_attempts_privacy_invalid');
  }
  const sourceModelRaw = text(source.source_model);
  return {
    contractVersion: TERRITORIAL_GEOCODING_CONTRACT,
    tenantId: String(source.tenant_id ?? ''),
    jobId: String(source.job_id ?? ''),
    ticketId: source.ticket_id === null || source.ticket_id === undefined ? null : String(source.ticket_id),
    sourceModelRaw,
    ticketSourceModel: normalizeTerritorialTicketSourceModel(sourceModelRaw),
    attempts: Array.isArray(source.attempts) ? source.attempts.map(normalizeAttempt) : [],
    privacy: {
      rawAddressExposed: false,
      addressDigestExposed: false,
      exactCoordinatesExposed: privacy.exact_coordinates_exposed,
      exactCoordinatesClassification: 'restricted_operational',
      exactCoordinatesAccess: 'tenant_admin_only',
      providerPlaceIdExposed: false,
      authorizedAdminDetail: true,
    },
  };
};

export const normalizeTerritorialGeocodingReviewResponse = (
  value: unknown,
  expected: Pick<
    TerritorialGeocodingReviewRequest,
    'tenantSlug' | 'jobId' | 'expectedProposalDigest' | 'expectedAttemptId' | 'expectedAttemptNumber'
  >,
): TerritorialGeocodingReviewResponse => {
  const source = requireContract(value);
  if (source.provider_call_performed !== false || source.coordinate_write_performed !== false) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_review_response_policy_invalid');
  }
  const tenantId = String(source.tenant_id ?? '').trim();
  const tenantSlug = normalizeTenantSlug(source.tenant_slug);
  const jobId = String(source.job_id ?? '').trim();
  const action = text(source.action);
  const proposalDigest = requireProposalDigest(
    source.proposal_digest,
    'territorial_geocoding_review_response_proposal_digest_invalid',
  );
  const proposalVersion = normalizeProposalVersion(
    source.proposal_version,
    'territorial_geocoding_review_response_proposal_version_invalid',
  );
  const review = normalizeReviewReceipt(source.review);
  if (
    action !== 'review'
    || !tenantId
    || !tenantSlug
    || tenantSlug !== normalizeTenantSlug(expected.tenantSlug)
    || jobId !== expected.jobId
  ) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_review_response_identity_invalid');
  }
  if (
    proposalDigest !== expected.expectedProposalDigest
    || review.proposalDigest !== expected.expectedProposalDigest
    || review.proposalCurrent !== true
    || proposalVersion.attemptId !== expected.expectedAttemptId
    || proposalVersion.attemptNumber !== expected.expectedAttemptNumber
    || review.proposalVersion?.attemptId !== expected.expectedAttemptId
    || review.proposalVersion?.attemptNumber !== expected.expectedAttemptNumber
  ) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_review_response_proposal_version_invalid');
  }
  return {
    contractVersion: TERRITORIAL_GEOCODING_CONTRACT,
    action: 'review',
    tenantId,
    tenantSlug,
    jobId,
    proposalDigest,
    proposalVersion,
    review,
    idempotentReplay: source.idempotent_replay === true,
    providerCallPerformed: false,
    coordinateWritePerformed: false,
  };
};

export const normalizeTerritorialGeocodingSyncResponse = (value: unknown): TerritorialGeocodingSyncResponse => {
  const source = record(value);
  if (source.contract_version !== TERRITORIAL_GEOCODING_SYNC_CONTRACT) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_sync_contract_version_invalid');
  }
  const execution = record(source.execution);
  if (
    execution.provider_call_performed !== false
    || execution.coordinate_write_performed !== false
    || (source.provider_call_performed !== undefined && source.provider_call_performed !== false)
    || (source.coordinate_write_performed !== undefined && source.coordinate_write_performed !== false)
  ) throw new TerritorialGeocodingContractError('territorial_geocoding_sync_write_policy_invalid');
  const summary = record(source.summary);
  return {
    contractVersion: TERRITORIAL_GEOCODING_SYNC_CONTRACT,
    tenantId: String(source.tenant_id ?? ''),
    summary: {
      discovered: count(summary.discovered),
      created: count(summary.created),
      existing: count(summary.existing),
      stale: count(summary.stale),
      refreshed: count(summary.refreshed),
      hidden: count(summary.hidden),
    },
    execution: { providerCallPerformed: false, coordinateWritePerformed: false },
    idempotentReplay: source.idempotent_replay === true,
  };
};

export const normalizeTerritorialGeocodingExecutionResponse = (
  value: unknown,
  expected: {
    action: 'resolve' | 'apply';
    tenantSlug: string;
    jobId: string;
    expectedProposalDigest?: string;
    expectedAttemptId?: string;
    expectedAttemptNumber?: number;
  },
): TerritorialGeocodingExecutionResponse => {
  const source = record(value);
  if (source.contract_version !== TERRITORIAL_GEOCODING_EXECUTION_CONTRACT) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_execution_contract_version_invalid');
  }
  const action = text(source.action);
  if ((action !== 'resolve' && action !== 'apply') || action !== expected.action) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_execution_action_invalid');
  }
  const tenantId = String(source.tenant_id ?? '').trim();
  const tenantSlug = normalizeTenantSlug(source.tenant_slug);
  const jobId = String(source.job_id ?? '').trim();
  if (
    !tenantId
    || !tenantSlug
    || tenantSlug !== normalizeTenantSlug(expected.tenantSlug)
    || jobId !== expected.jobId
  ) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_execution_identity_invalid');
  }
  const proposalDigest = requireProposalDigest(
    source.proposal_digest,
    'territorial_geocoding_execution_proposal_digest_invalid',
  );
  const proposalVersion = normalizeProposalVersion(
    source.proposal_version,
    'territorial_geocoding_execution_proposal_version_invalid',
  );
  const privacy = record(source.privacy);
  if (
    privacy.raw_address_exposed !== false
    || privacy.address_digest_exposed !== false
    || privacy.provider_payload_exposed !== false
    || privacy.authorized_admin_detail !== true
    || privacy.exact_coordinates_classification !== 'restricted_operational'
    || privacy.exact_coordinates_access !== 'tenant_admin_only'
    || privacy.provider_place_id_retained !== false
    || privacy.source_address_retained_in_audit !== false
  ) throw new TerritorialGeocodingContractError('territorial_geocoding_execution_privacy_invalid');
  const execution = record(source.execution);
  if (
    typeof execution.provider_call_performed !== 'boolean'
    || typeof execution.coordinate_write_performed !== 'boolean'
    || typeof execution.coordinates_applied !== 'boolean'
    || typeof execution.write_performed !== 'boolean'
  ) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_execution_receipt_invalid');
  }
  const status = text(source.status) ?? 'status_not_published';
  const reasonCode = text(source.reason_code) ?? 'reason_not_published';
  if (action === 'resolve') {
    if (
      execution.coordinate_write_performed !== false
      || execution.coordinates_applied !== false
      || execution.write_performed !== false
    ) throw new TerritorialGeocodingContractError('territorial_geocoding_execution_policy_invalid');
  } else {
    if (
      status !== 'applied'
      || reasonCode !== 'coordinates_applied'
      || execution.provider_call_performed !== false
      || execution.coordinate_write_performed !== true
      || execution.coordinates_applied !== true
      || execution.write_performed !== true
    ) throw new TerritorialGeocodingContractError('territorial_geocoding_apply_receipt_not_applied');
    if (
      proposalDigest !== expected.expectedProposalDigest
      || proposalVersion.attemptId !== expected.expectedAttemptId
      || proposalVersion.attemptNumber !== expected.expectedAttemptNumber
    ) throw new TerritorialGeocodingContractError('territorial_geocoding_apply_receipt_proposal_mismatch');
  }
  const proposalSource = isRecord(source.proposal) ? source.proposal : null;
  if (proposalSource && (text(proposalSource.provider_place_id) || text(proposalSource.place_id))) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_execution_provider_identifier_exposed');
  }
  const transition = record(source.transition_metrics);
  const transitionAction = text(transition.action);
  return {
    contractVersion: TERRITORIAL_GEOCODING_EXECUTION_CONTRACT,
    tenantId,
    tenantSlug,
    jobId,
    action,
    status,
    reasonCode,
    proposalDigest,
    proposalVersion,
    proposal: proposalSource ? normalizeProposal({ ...proposalSource, validation: source.validation }) : null,
    validation: normalizeValidation(source.validation),
    execution: {
      providerCallPerformed: execution.provider_call_performed,
      coordinateWritePerformed: execution.coordinate_write_performed,
      coordinatesApplied: execution.coordinates_applied,
      writePerformed: execution.write_performed,
    },
    transition: transitionAction === action ? {
      action,
      fromStatus: text(transition.from_status) ?? 'unknown',
      toStatus: text(transition.to_status) ?? 'unknown',
    } : null,
    idempotentReplay: source.idempotent_replay === true,
  };
};

export const normalizeTerritorialGeocodingPreviewQueue = (value: unknown): TerritorialGeocodingPreviewQueue => {
  const source = record(value);
  if (source.contract_version !== TERRITORIAL_GEOCODING_PREVIEW_CONTRACT) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_preview_contract_version_invalid');
  }
  const execution = record(source.execution);
  if (
    execution.read_only !== true
    || execution.database_write_performed !== false
    || execution.provider_call_performed !== false
    || execution.coordinate_write_performed !== false
  ) throw new TerritorialGeocodingContractError('territorial_geocoding_preview_write_policy_invalid');
  const privacy = record(source.privacy);
  if (
    privacy.raw_address_exposed !== false
    || privacy.address_digest_exposed !== false
    || privacy.candidate_fingerprint_exposed !== false
    || privacy.exact_coordinates_exposed !== false
    || privacy.tenant_scoped !== true
  ) throw new TerritorialGeocodingContractError('territorial_geocoding_preview_privacy_invalid');

  const items = (Array.isArray(source.items) ? source.items : []).map((value) => {
    const item = record(value);
    const actions = record(item.actions);
    const inspectSource = record(actions.inspect_source);
    const providerLookup = record(actions.provider_lookup);
    const review = record(actions.review);
    const coordinateWrite = record(actions.coordinate_write);
    if (
      inspectSource.enabled !== true
      || inspectSource.mutates_state !== false
      || providerLookup.enabled !== false
      || providerLookup.mutates_state !== false
      || review.enabled !== false
      || review.mutates_state !== false
      || coordinateWrite.enabled !== false
      || coordinateWrite.mutates_state !== false
    ) throw new TerritorialGeocodingContractError('territorial_geocoding_preview_action_policy_invalid');
    const id = text(item.id);
    const ticketId = text(item.ticket_id);
    const sourceModelRaw = text(item.source_model);
    if (!id || !ticketId || !sourceModelRaw) {
      throw new TerritorialGeocodingContractError('territorial_geocoding_preview_identity_missing');
    }
    const ticketSourceModel = normalizeTerritorialTicketSourceModel(sourceModelRaw);
    if (!ticketSourceModel) {
      throw new TerritorialGeocodingContractError('territorial_geocoding_preview_source_model_invalid');
    }
    if (
      item.state !== 'awaiting_materialization'
      || item.reason_code !== 'persisted_address_without_coordinates'
    ) throw new TerritorialGeocodingContractError('territorial_geocoding_preview_state_invalid');
    return {
      id,
      ticketId,
      sourceModelRaw,
      ticketSourceModel,
      category: text(item.category),
      zone: text(item.zone),
      state: 'awaiting_materialization' as const,
      reasonCode: 'persisted_address_without_coordinates' as const,
      inspectSourceEnabled: true as const,
    };
  });
  const summary = record(source.summary);
  const pagination = record(source.pagination);
  const exactNonNegativeInteger = (value: unknown, code: string) => {
    const parsed = number(value);
    if (parsed === null || !Number.isInteger(parsed) || parsed < 0) {
      throw new TerritorialGeocodingContractError(code);
    }
    return parsed;
  };
  const discovered = exactNonNegativeInteger(summary.discovered, 'territorial_geocoding_preview_summary_invalid');
  const unique = exactNonNegativeInteger(summary.unique, 'territorial_geocoding_preview_summary_invalid');
  const matching = exactNonNegativeInteger(summary.matching, 'territorial_geocoding_preview_summary_invalid');
  const hidden = exactNonNegativeInteger(summary.hidden, 'territorial_geocoding_preview_summary_invalid');
  const page = exactNonNegativeInteger(pagination.page, 'territorial_geocoding_preview_pagination_invalid');
  const perPage = exactNonNegativeInteger(pagination.per_page, 'territorial_geocoding_preview_pagination_invalid');
  const total = exactNonNegativeInteger(pagination.total, 'territorial_geocoding_preview_pagination_invalid');
  if (page < 1 || perPage < 1 || perPage > 100 || discovered < unique || unique < matching || matching !== total) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_preview_counts_incoherent');
  }
  const firstIndex = (page - 1) * perPage;
  const expectedItemCount = Math.max(0, Math.min(perPage, total - firstIndex));
  const expectedHasNext = firstIndex + expectedItemCount < total;
  if (
    items.length !== expectedItemCount
    || pagination.has_next !== expectedHasNext
    || new Set(items.map((item) => item.id)).size !== items.length
  ) throw new TerritorialGeocodingContractError('territorial_geocoding_preview_page_incoherent');
  return {
    contractVersion: TERRITORIAL_GEOCODING_PREVIEW_CONTRACT,
    tenantId: String(source.tenant_id ?? ''),
    summary: {
      discovered,
      unique,
      matching,
      hidden,
      bySourceModel: countRecord(summary.by_source_model),
      byCategory: countRecord(summary.by_category),
      byZone: countRecord(summary.by_zone),
    },
    pagination: {
      page,
      perPage,
      total,
      hasNext: expectedHasNext,
    },
    items,
    execution: {
      readOnly: true,
      databaseWritePerformed: false,
      providerCallPerformed: false,
      coordinateWritePerformed: false,
    },
    privacy: {
      rawAddressExposed: false,
      addressDigestExposed: false,
      candidateFingerprintExposed: false,
      exactCoordinatesExposed: false,
      tenantScoped: true,
    },
  };
};

const addParam = (params: URLSearchParams, key: string, value: unknown) => {
  if (value === undefined || value === null || value === '') return;
  params.set(key, String(value));
};

export const getTerritorialGeocodingQueue = async (input: TerritorialGeocodingQueueParams) => {
  const params = new URLSearchParams();
  addParam(params, 'page', input.page ?? 1);
  addParam(params, 'per_page', input.perPage ?? 100);
  addParam(params, 'status', input.status);
  addParam(params, 'review_state', input.reviewState);
  addParam(params, 'source_model', input.sourceModel);
  addParam(params, 'reason_code', input.reasonCode);
  addParam(params, 'ticket_id', input.ticketId);
  addParam(params, 'category', input.category);
  addParam(params, 'zone', input.zone);
  addParam(params, 'quality_state', input.qualityState);
  const response = await panelApi.get<unknown>(`${QUEUE_PATH}?${params}`, { tenantSlug: input.tenantSlug });
  return normalizeTerritorialGeocodingQueue(response);
};

export const getTerritorialGeocodingPreviewQueue = async (input: TerritorialGeocodingPreviewParams) => {
  const params = new URLSearchParams();
  addParam(params, 'page', input.page ?? 1);
  addParam(params, 'per_page', input.perPage ?? 100);
  addParam(params, 'source_model', input.sourceModel);
  addParam(params, 'ticket_id', input.ticketId);
  addParam(params, 'category', input.category);
  addParam(params, 'zone', input.zone);
  const response = await panelApi.get<unknown>(`${QUEUE_PATH}/preview?${params}`, { tenantSlug: input.tenantSlug });
  return normalizeTerritorialGeocodingPreviewQueue(response);
};

export const getTerritorialGeocodingDetail = async (jobId: string, tenantSlug: string) => {
  const response = await panelApi.get<unknown>(`${QUEUE_PATH}/${encodeURIComponent(jobId)}`, { tenantSlug });
  return normalizeTerritorialGeocodingDetail(response);
};

export const getTerritorialGeocodingAttempts = async (jobId: string, tenantSlug: string) => {
  const response = await panelApi.get<unknown>(`${QUEUE_PATH}/${encodeURIComponent(jobId)}/attempts`, { tenantSlug });
  return normalizeTerritorialGeocodingAttempts(response);
};

export const reviewTerritorialGeocodingJob = async (input: TerritorialGeocodingReviewRequest) => {
  if (!IDEMPOTENCY_PATTERN.test(input.idempotencyKey)) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_idempotency_key_invalid');
  }
  const allowed = input.decision === 'approved' ? APPROVED_REASONS : REJECTED_REASONS;
  if (!allowed.has(input.reasonCode)) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_review_reason_invalid');
  }
  assertProposalExpectation(input);
  const body = {
    decision: input.decision,
    reason_code: input.reasonCode,
    expected_proposal_digest: input.expectedProposalDigest,
    expected_attempt_id: input.expectedAttemptId,
    expected_attempt_number: input.expectedAttemptNumber,
  };
  const response = await panelApi.post<unknown>(
    `${QUEUE_PATH}/${encodeURIComponent(input.jobId)}/review`,
    body,
    { tenantSlug: input.tenantSlug, headers: { 'Idempotency-Key': input.idempotencyKey } },
  );
  return normalizeTerritorialGeocodingReviewResponse(response, input);
};

export const syncTerritorialGeocodingQueue = async (input: TerritorialGeocodingSyncRequest) => {
  if (!IDEMPOTENCY_PATTERN.test(input.idempotencyKey)) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_sync_idempotency_key_invalid');
  }
  const response = await panelApi.post<unknown>(
    `${QUEUE_PATH}/sync`,
    {},
    { tenantSlug: input.tenantSlug, headers: { 'Idempotency-Key': input.idempotencyKey } },
  );
  return normalizeTerritorialGeocodingSyncResponse(response);
};

const executeTerritorialGeocodingAction = async (
  action: 'resolve' | 'apply',
  input: TerritorialGeocodingExecutionRequest | TerritorialGeocodingApplyRequest,
) => {
  if (!IDEMPOTENCY_PATTERN.test(input.idempotencyKey)) {
    throw new TerritorialGeocodingContractError('territorial_geocoding_execution_idempotency_key_invalid');
  }
  const applyInput = action === 'apply' ? input as TerritorialGeocodingApplyRequest : null;
  if (applyInput) assertProposalExpectation(applyInput);
  const response = await panelApi.post<unknown>(
    `${QUEUE_PATH}/${encodeURIComponent(input.jobId)}/${action}`,
    applyInput ? {
      confirmed: true,
      expected_proposal_digest: applyInput.expectedProposalDigest,
      expected_attempt_id: applyInput.expectedAttemptId,
      expected_attempt_number: applyInput.expectedAttemptNumber,
    } : {},
    { tenantSlug: input.tenantSlug, headers: { 'Idempotency-Key': input.idempotencyKey } },
  );
  return normalizeTerritorialGeocodingExecutionResponse(response, {
    action,
    tenantSlug: input.tenantSlug,
    jobId: input.jobId,
    expectedProposalDigest: applyInput?.expectedProposalDigest,
    expectedAttemptId: applyInput?.expectedAttemptId,
    expectedAttemptNumber: applyInput?.expectedAttemptNumber,
  });
};

export const resolveTerritorialGeocodingJob = (input: TerritorialGeocodingExecutionRequest) =>
  executeTerritorialGeocodingAction('resolve', input);

export const applyTerritorialGeocodingJob = (input: TerritorialGeocodingApplyRequest) =>
  executeTerritorialGeocodingAction('apply', input);

export const isTerritorialQueueEndpointUnavailable = (error: unknown) =>
  error instanceof ApiError && [404, 405, 501].includes(error.status);

export const isTerritorialApiStatus = (error: unknown, status: number) => error instanceof ApiError && error.status === status;

export const createTerritorialReviewIdempotencyKey = (jobId: string) => {
  const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `geo-review:${jobId}:${randomPart}`.slice(0, 128);
};

export const createTerritorialSyncIdempotencyKey = () => {
  const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `geo-sync:${randomPart}`.slice(0, 128);
};

export const createTerritorialExecutionIdempotencyKey = (action: 'resolve' | 'apply', jobId: string) => {
  const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `geo-${action}:${jobId}:${randomPart}`.slice(0, 128);
};
