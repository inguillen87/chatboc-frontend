import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, NetworkError } from '@/utils/api';

import {
  applyTerritorialGeocodingJob,
  getTerritorialGeocodingAttempts,
  getTerritorialGeocodingDetail,
  getTerritorialGeocodingPreviewQueue,
  getTerritorialGeocodingQueue,
  isTerritorialQueueEndpointUnavailable,
  normalizeTerritorialGeocodingQueue,
  normalizeTerritorialGeocodingPreviewQueue,
  normalizeTerritorialGeocodingSyncResponse,
  reviewTerritorialGeocodingJob,
  resolveTerritorialGeocodingJob,
  syncTerritorialGeocodingQueue,
  TerritorialGeocodingContractError,
} from './territorialGeocodingApi';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const PROPOSAL_DIGEST = 'a'.repeat(64);

vi.mock('@/api/v2/client', () => ({ panelApi: { get: mocks.get, post: mocks.post } }));

const reviewReceipt = {
  id: 72,
  decision: 'approved',
  effective_state: 'approved',
  reason_code: 'verified_on_map',
  reviewer_user_id: 9,
  reviewed_job_status: 'ready',
  proposal_current: true,
  proposal_digest: PROPOSAL_DIGEST,
  proposal_attempt_id: 'attempt-resolve-1',
  proposal_attempt_number: 1,
  coordinate_write_performed: false,
  created_at: '2026-08-30T12:00:00Z',
};

const item = {
  id: 'geo-job-419',
  ticket_id: 419,
  source_model: 'municipio_ticket',
  status: 'ready',
  reason_code: 'pending_review',
  review_state: 'unreviewed',
  latest_review: null,
  category: 'Luminarias',
  zone: 'Zona Centro',
  quality: {
    state: 'requires_human_review',
    has_proposal: true,
    auto_apply_eligible: false,
    jurisdiction_status: 'inside',
    location_type: 'ROOFTOP',
    partial_match: false,
    locality_match: true,
    province_match: true,
    country_match: true,
    issues: [],
  },
  attempt_count: 1,
  last_attempt_at: '2026-08-30T11:50:00Z',
  created_at: '2026-08-30T11:45:00Z',
  updated_at: '2026-08-30T11:50:00Z',
  actions: {
    detail: { method: 'GET', href: '/api/v2/analytics/operations/geocoding-queue/geo-job-419' },
    attempts: { method: 'GET', href: '/api/v2/analytics/operations/geocoding-queue/geo-job-419/attempts' },
    review: {
      method: 'POST',
      href: '/api/v2/analytics/operations/geocoding-queue/geo-job-419/review',
      idempotency_header: 'Idempotency-Key',
      can_approve: true,
      can_reject: true,
      allowed_reason_codes: {
        approved: ['verified_against_source', 'verified_on_map', 'not_allowed_by_contract'],
        rejected: ['incorrect_location', 'outside_jurisdiction'],
      },
      coordinate_application_supported: false,
    },
  },
};

const queuePayload = () => ({
  contract_version: 'operations.territorial_geocoding_admin.v1',
  request_id: 'req-geo-1',
  tenant_id: 4,
  summary: {
    total: 1,
    with_proposal: 1,
    needs_human_review: 1,
    coordinate_writes_from_review: 0,
    by_status: { ready: 1 },
    by_review_state: { unreviewed: 1 },
    by_reason_code: { pending_review: 1 },
    by_quality_state: { requires_human_review: 1 },
  },
  pagination: { page: 1, per_page: 100, total: 1, has_next: false },
  items: [item],
  privacy: {
    raw_address_exposed: false,
    address_digest_exposed: false,
    exact_coordinates_exposed: false,
    aggregate_list_only: true,
  },
});

const previewPayload = () => ({
  contract_version: 'operations.territorial_geocoding_preview.v1',
  tenant_id: 4,
  summary: {
    discovered: 34,
    unique: 34,
    matching: 34,
    hidden: 0,
    by_source_model: { tenant_ticket: 34 },
    by_category: { luminarias: 23, bacheo: 11 },
    by_zone: { centro: 18, unclassified: 16 },
  },
  pagination: { page: 1, per_page: 1, total: 34, has_next: true },
  items: [{
    id: 'tenant_ticket:419',
    ticket_id: '419',
    source_model: 'tenant_ticket',
    category: 'luminarias',
    zone: 'centro',
    state: 'awaiting_materialization',
    reason_code: 'persisted_address_without_coordinates',
    actions: {
      inspect_source: { enabled: true, mutates_state: false },
      provider_lookup: { enabled: false, mutates_state: false },
      review: { enabled: false, mutates_state: false },
      coordinate_write: { enabled: false, mutates_state: false },
    },
  }],
  execution: {
    read_only: true,
    database_write_performed: false,
    provider_call_performed: false,
    coordinate_write_performed: false,
  },
  privacy: {
    raw_address_exposed: false,
    address_digest_exposed: false,
    candidate_fingerprint_exposed: false,
    exact_coordinates_exposed: false,
    tenant_scoped: true,
  },
});

const attempt = {
  id: 3,
  attempt_number: 1,
  outcome_status: 'candidate_found',
  reason_code: 'pending_review',
  provider: 'configured_provider',
  external_call_performed: true,
  coordinate_write_performed: false,
  proposal: {
    lat: -33.1334,
    lng: -68.4861,
    location_type: 'ROOFTOP',
    partial_match: false,
    provider_reference_present: true,
  },
  validation: {
    auto_apply_eligible: false,
    issues: [],
    jurisdiction_status: 'inside',
    locality_match: true,
    province_match: true,
    country_match: true,
  },
  created_at: '2026-08-30T11:50:00Z',
};

const executionPayload = (action: 'resolve' | 'apply') => ({
  contract_version: 'operations.territorial_geocoding_execution.v1',
  tenant_id: 4,
  tenant_slug: 'junin',
  job_id: 'geo-job-419',
  action,
  status: action === 'apply' ? 'applied' : 'pending',
  reason_code: action === 'apply' ? 'coordinates_applied' : 'provider_result_validated',
  proposal_digest: PROPOSAL_DIGEST,
  proposal_version: { attempt_id: 'attempt-resolve-1', attempt_number: 1 },
  proposal: {
    lat: -33.05,
    lng: -68.47,
    coordinate_reference: 'WGS84',
    location_type: 'ROOFTOP',
    partial_match: false,
    provider: 'google',
    provider_reference_present: true,
    provenance: { source: 'geocoding_provider', provider: 'google', source_address_retained: false },
  },
  validation: { auto_apply_eligible: true, issues: [], jurisdiction_status: 'within' },
  execution: {
    provider_call_performed: action === 'resolve',
    coordinate_write_performed: action === 'apply',
    coordinates_applied: action === 'apply',
    write_performed: action === 'apply',
  },
  transition_metrics: { action, from_status: 'pending', to_status: action === 'apply' ? 'applied' : 'pending' },
  idempotent_replay: false,
  privacy: {
    raw_address_exposed: false,
    address_digest_exposed: false,
    provider_payload_exposed: false,
    authorized_admin_detail: true,
    exact_coordinates_classification: 'restricted_operational',
    exact_coordinates_access: 'tenant_admin_only',
    provider_place_id_retained: false,
    source_address_retained_in_audit: false,
  },
});

describe('territorialGeocodingApi', () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.post.mockReset();
  });

  it('normalizes the privacy-safe list and preserves typed ticket identity and review capabilities', () => {
    const result = normalizeTerritorialGeocodingQueue(queuePayload());

    expect(result.items[0]).toMatchObject({
      id: 'geo-job-419',
      ticketId: '419',
      sourceModelRaw: 'municipio_ticket',
      ticketSourceModel: 'MunicipioTicket',
      detailHref: '/api/v2/analytics/operations/geocoding-queue/geo-job-419',
      reviewAction: {
        canApprove: true,
        canReject: true,
        approvedReasonCodes: ['verified_against_source', 'verified_on_map'],
        rejectedReasonCodes: ['incorrect_location', 'outside_jurisdiction'],
        coordinateApplicationSupported: false,
      },
    });
    expect(result.privacy).toEqual({
      rawAddressExposed: false,
      addressDigestExposed: false,
      exactCoordinatesExposed: false,
      aggregateListOnly: true,
    });
  });

  it('fails closed when privacy or coordinate-write policy is weakened', () => {
    const unsafePrivacy = queuePayload();
    unsafePrivacy.privacy.raw_address_exposed = true;
    expect(() => normalizeTerritorialGeocodingQueue(unsafePrivacy)).toThrow(TerritorialGeocodingContractError);

    const unsafeWrite = queuePayload();
    unsafeWrite.items[0] = structuredClone(item);
    unsafeWrite.items[0].actions.review.coordinate_application_supported = true;
    expect(() => normalizeTerritorialGeocodingQueue(unsafeWrite)).toThrow('territorial_geocoding_coordinate_policy_invalid');
  });

  it('normalizes the live read-only preview without accepting provider, review, or coordinate actions', async () => {
    const result = normalizeTerritorialGeocodingPreviewQueue(previewPayload());
    expect(result).toMatchObject({
      tenantId: '4',
      summary: { discovered: 34, matching: 34, byCategory: { luminarias: 23, bacheo: 11 } },
      items: [{
        id: 'tenant_ticket:419',
        ticketId: '419',
        ticketSourceModel: 'TenantTicket',
        inspectSourceEnabled: true,
      }],
      execution: { readOnly: true, providerCallPerformed: false, coordinateWritePerformed: false },
    });

    mocks.get.mockResolvedValueOnce(previewPayload());
    await getTerritorialGeocodingPreviewQueue({ tenantSlug: 'junin', page: 1, perPage: 100, category: 'luminarias' });
    expect(mocks.get).toHaveBeenCalledWith(
      '/api/v2/analytics/operations/geocoding-queue/preview?page=1&per_page=100&category=luminarias',
      { tenantSlug: 'junin' },
    );

    const unsafe = previewPayload();
    unsafe.items[0].actions.provider_lookup.enabled = true;
    expect(() => normalizeTerritorialGeocodingPreviewQueue(unsafe)).toThrow(
      'territorial_geocoding_preview_action_policy_invalid',
    );

    const ambiguousIdentity = previewPayload();
    ambiguousIdentity.items[0].source_model = 'future_ticket';
    expect(() => normalizeTerritorialGeocodingPreviewQueue(ambiguousIdentity)).toThrow(
      'territorial_geocoding_preview_source_model_invalid',
    );

    const incoherentCounts = previewPayload();
    incoherentCounts.pagination.total = 33;
    expect(() => normalizeTerritorialGeocodingPreviewQueue(incoherentCounts)).toThrow(
      'territorial_geocoding_preview_counts_incoherent',
    );
  });

  it('uses panel authentication and tenant scope for list, detail, and attempts', async () => {
    mocks.get
      .mockResolvedValueOnce(queuePayload())
      .mockResolvedValueOnce({
        contract_version: 'operations.territorial_geocoding_admin.v1',
        tenant_id: 4,
        item,
        selected: {
          proposal: attempt.proposal,
          proposal_digest: PROPOSAL_DIGEST,
          proposal_version: { attempt_id: 'attempt-resolve-1', attempt_number: 1 },
          attempts: [attempt],
          reviews: [],
        },
        privacy: {
          raw_address_exposed: false,
          address_digest_exposed: false,
          exact_coordinates_exposed: true,
          exact_coordinates_classification: 'restricted_operational',
          exact_coordinates_access: 'tenant_admin_only',
          provider_place_id_exposed: false,
          provider_place_id_retained_for_new_attempts: false,
          authorized_admin_detail: true,
        },
        write_policy: { get_is_read_only: true, provider_call_performed: false, coordinate_application_supported: true, review_is_human_decision_only: true, apply_requires_separate_confirmed_post: true },
      })
      .mockResolvedValueOnce({
        contract_version: 'operations.territorial_geocoding_admin.v1',
        tenant_id: 4,
        job_id: 'geo-job-419',
        ticket_id: 419,
        source_model: 'municipio_ticket',
        attempts: [attempt],
        privacy: {
          raw_address_exposed: false,
          address_digest_exposed: false,
          exact_coordinates_exposed: true,
          exact_coordinates_classification: 'restricted_operational',
          exact_coordinates_access: 'tenant_admin_only',
          provider_place_id_exposed: false,
          authorized_admin_detail: true,
        },
      });

    await getTerritorialGeocodingQueue({ tenantSlug: 'junin', page: 1, perPage: 100, category: 'Luminarias' });
    const detail = await getTerritorialGeocodingDetail('geo-job-419', 'junin');
    const attempts = await getTerritorialGeocodingAttempts('geo-job-419', 'junin');

    expect(mocks.get).toHaveBeenNthCalledWith(
      1,
      '/api/v2/analytics/operations/geocoding-queue?page=1&per_page=100&category=Luminarias',
      { tenantSlug: 'junin' },
    );
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/api/v2/analytics/operations/geocoding-queue/geo-job-419', { tenantSlug: 'junin' });
    expect(mocks.get).toHaveBeenNthCalledWith(3, '/api/v2/analytics/operations/geocoding-queue/geo-job-419/attempts', { tenantSlug: 'junin' });
    expect(detail.proposal).toMatchObject({ lat: -33.1334, lng: -68.4861 });
    expect(detail.proposalVersion).toEqual({ attemptId: 'attempt-resolve-1', attemptNumber: 1 });
    expect(detail.privacy).toMatchObject({
      exactCoordinatesClassification: 'restricted_operational',
      exactCoordinatesAccess: 'tenant_admin_only',
      providerPlaceIdExposed: false,
    });
    expect(attempts.ticketSourceModel).toBe('MunicipioTicket');
    expect(attempts.privacy).toMatchObject({
      exactCoordinatesClassification: 'restricted_operational',
      exactCoordinatesAccess: 'tenant_admin_only',
      providerPlaceIdExposed: false,
    });
  });

  it('posts a controlled decision with tenant and Idempotency-Key but never applies coordinates', async () => {
    mocks.post.mockResolvedValue({
      contract_version: 'operations.territorial_geocoding_admin.v1',
      action: 'review',
      tenant_id: 4,
      tenant_slug: 'junin',
      job_id: 'geo-job-419',
      proposal_digest: PROPOSAL_DIGEST,
      proposal_version: { attempt_id: 'attempt-resolve-1', attempt_number: 1 },
      review: reviewReceipt,
      idempotent_replay: false,
      provider_call_performed: false,
      coordinate_write_performed: false,
    });

    const result = await reviewTerritorialGeocodingJob({
      tenantSlug: 'junin',
      jobId: 'geo-job-419',
      decision: 'approved',
      reasonCode: 'verified_on_map',
      idempotencyKey: 'geo-review:geo-job-419:01234567',
      expectedProposalDigest: PROPOSAL_DIGEST,
      expectedAttemptId: 'attempt-resolve-1',
      expectedAttemptNumber: 1,
    });

    expect(mocks.post).toHaveBeenCalledWith(
      '/api/v2/analytics/operations/geocoding-queue/geo-job-419/review',
      {
        decision: 'approved',
        reason_code: 'verified_on_map',
        expected_proposal_digest: PROPOSAL_DIGEST,
        expected_attempt_id: 'attempt-resolve-1',
        expected_attempt_number: 1,
      },
      { tenantSlug: 'junin', headers: { 'Idempotency-Key': 'geo-review:geo-job-419:01234567' } },
    );
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('apply_coordinates');
    expect(result).toMatchObject({
      action: 'review',
      tenantSlug: 'junin',
      proposalDigest: PROPOSAL_DIGEST,
      proposalVersion: { attemptId: 'attempt-resolve-1', attemptNumber: 1 },
      idempotentReplay: false,
      providerCallPerformed: false,
      coordinateWritePerformed: false,
    });
  });

  it('rejects provider identifiers hidden inside attempt history', async () => {
    mocks.get.mockResolvedValue({
      contract_version: 'operations.territorial_geocoding_admin.v1',
      tenant_id: 4,
      job_id: 'geo-job-419',
      ticket_id: 419,
      source_model: 'municipio_ticket',
      attempts: [{
        ...attempt,
        proposal: { ...attempt.proposal, provider_place_id: 'provider-secret-reference' },
      }],
      privacy: {
        raw_address_exposed: false,
        address_digest_exposed: false,
        exact_coordinates_exposed: true,
        exact_coordinates_classification: 'restricted_operational',
        exact_coordinates_access: 'tenant_admin_only',
        provider_place_id_exposed: false,
        authorized_admin_detail: true,
      },
    });

    await expect(getTerritorialGeocodingAttempts('geo-job-419', 'junin')).rejects.toMatchObject({
      code: 'territorial_geocoding_attempt_provider_identifier_exposed',
    });
  });

  it('rejects a review receipt for another proposal version and validates expectations before I/O', async () => {
    mocks.post.mockResolvedValue({
      contract_version: 'operations.territorial_geocoding_admin.v1',
      action: 'review',
      tenant_id: 4,
      tenant_slug: 'junin',
      job_id: 'geo-job-419',
      proposal_digest: PROPOSAL_DIGEST,
      proposal_version: { attempt_id: 'attempt-resolve-1', attempt_number: 1 },
      review: { ...reviewReceipt, proposal_attempt_id: 'attempt-resolve-2', proposal_attempt_number: 2 },
      idempotent_replay: false,
      provider_call_performed: false,
      coordinate_write_performed: false,
    });

    await expect(reviewTerritorialGeocodingJob({
      tenantSlug: 'junin',
      jobId: 'geo-job-419',
      decision: 'approved',
      reasonCode: 'verified_on_map',
      idempotencyKey: 'geo-review:geo-job-419:01234567',
      expectedProposalDigest: PROPOSAL_DIGEST,
      expectedAttemptId: 'attempt-resolve-1',
      expectedAttemptNumber: 1,
    })).rejects.toMatchObject({ code: 'territorial_geocoding_review_response_proposal_version_invalid' });

    mocks.post.mockClear();
    await expect(reviewTerritorialGeocodingJob({
      tenantSlug: 'junin',
      jobId: 'geo-job-419',
      decision: 'approved',
      reasonCode: 'verified_on_map',
      idempotencyKey: 'geo-review:geo-job-419:01234567',
      expectedProposalDigest: 'invalid',
      expectedAttemptId: 'attempt-resolve-1',
      expectedAttemptNumber: 1,
    })).rejects.toMatchObject({ code: 'territorial_geocoding_expected_proposal_invalid' });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each([
    ['action', { action: 'apply' }, 'territorial_geocoding_review_response_identity_invalid'],
    ['tenant', { tenant_slug: 'otro-tenant' }, 'territorial_geocoding_review_response_identity_invalid'],
    ['job', { job_id: 'geo-job-otro' }, 'territorial_geocoding_review_response_identity_invalid'],
    ['digest', { proposal_digest: 'b'.repeat(64) }, 'territorial_geocoding_review_response_proposal_version_invalid'],
    ['version', { proposal_version: { attempt_id: 'attempt-resolve-2', attempt_number: 2 } }, 'territorial_geocoding_review_response_proposal_version_invalid'],
    ['review digest', { review: { ...reviewReceipt, proposal_digest: 'b'.repeat(64) } }, 'territorial_geocoding_review_response_proposal_version_invalid'],
  ])('rejects a review receipt with mismatched %s binding', async (_field, override, code) => {
    mocks.post.mockResolvedValue({
      contract_version: 'operations.territorial_geocoding_admin.v1',
      action: 'review',
      tenant_id: 4,
      tenant_slug: 'junin',
      job_id: 'geo-job-419',
      proposal_digest: PROPOSAL_DIGEST,
      proposal_version: { attempt_id: 'attempt-resolve-1', attempt_number: 1 },
      review: reviewReceipt,
      idempotent_replay: false,
      provider_call_performed: false,
      coordinate_write_performed: false,
      ...override,
    });

    await expect(reviewTerritorialGeocodingJob({
      tenantSlug: 'junin',
      jobId: 'geo-job-419',
      decision: 'approved',
      reasonCode: 'verified_on_map',
      idempotencyKey: 'geo-review:geo-job-419:01234567',
      expectedProposalDigest: PROPOSAL_DIGEST,
      expectedAttemptId: 'attempt-resolve-1',
      expectedAttemptNumber: 1,
    })).rejects.toMatchObject({ code });
  });

  it('materializes the queue explicitly with an empty body, tenant scope, and an idempotency key', async () => {
    mocks.post.mockResolvedValue({
      contract_version: 'operations.territorial_geocoding_sync.v1',
      tenant_id: 4,
      summary: { discovered: 63, created: 12, existing: 48, stale: 4, refreshed: 3, hidden: 3 },
      provider_call_performed: false,
      coordinate_write_performed: false,
      execution: { provider_call_performed: false, coordinate_write_performed: false },
      idempotent_replay: true,
    });

    const result = await syncTerritorialGeocodingQueue({
      tenantSlug: 'junin',
      idempotencyKey: 'geo-sync:0123456789abcdef',
    });

    expect(mocks.post).toHaveBeenCalledWith(
      '/api/v2/analytics/operations/geocoding-queue/sync',
      {},
      { tenantSlug: 'junin', headers: { 'Idempotency-Key': 'geo-sync:0123456789abcdef' } },
    );
    expect(result).toMatchObject({
      idempotentReplay: true,
      summary: { discovered: 63, created: 12, existing: 48, stale: 4, refreshed: 3, hidden: 3 },
      execution: { providerCallPerformed: false, coordinateWritePerformed: false },
    });
  });

  it('keeps provider lookup and confirmed coordinate application as separate audited posts', async () => {
    const response = (action: 'resolve' | 'apply') => ({
      contract_version: 'operations.territorial_geocoding_execution.v1',
      tenant_id: 4,
      tenant_slug: 'junin',
      job_id: 'geo-job-419',
      action,
      status: action === 'apply' ? 'applied' : 'pending',
      reason_code: action === 'apply' ? 'coordinates_applied' : 'provider_result_validated',
      proposal_digest: PROPOSAL_DIGEST,
      proposal_version: { attempt_id: 'attempt-resolve-1', attempt_number: 1 },
      proposal: {
        lat: -33.05,
        lng: -68.47,
        coordinate_reference: 'WGS84',
        location_type: 'ROOFTOP',
        partial_match: false,
        provider: 'google',
        provider_reference_present: true,
        provenance: { source: 'geocoding_provider', provider: 'google', source_address_retained: false },
      },
      validation: { auto_apply_eligible: true, issues: [], jurisdiction_status: 'within' },
      execution: {
        provider_call_performed: action === 'resolve',
        coordinate_write_performed: action === 'apply',
        coordinates_applied: action === 'apply',
        write_performed: action === 'apply',
      },
      transition_metrics: { action, from_status: 'pending', to_status: action === 'apply' ? 'applied' : 'pending' },
      idempotent_replay: false,
      privacy: {
        raw_address_exposed: false,
        address_digest_exposed: false,
        provider_payload_exposed: false,
        authorized_admin_detail: true,
        exact_coordinates_classification: 'restricted_operational',
        exact_coordinates_access: 'tenant_admin_only',
        provider_place_id_retained: false,
        source_address_retained_in_audit: false,
      },
    });
    mocks.post.mockResolvedValueOnce(response('resolve')).mockResolvedValueOnce(response('apply'));

    await resolveTerritorialGeocodingJob({ tenantSlug: 'junin', jobId: 'geo-job-419', idempotencyKey: 'geo-resolve:419:12345678' });
    await applyTerritorialGeocodingJob({
      tenantSlug: 'junin',
      jobId: 'geo-job-419',
      idempotencyKey: 'geo-apply:419:12345678',
      expectedProposalDigest: PROPOSAL_DIGEST,
      expectedAttemptId: 'attempt-resolve-1',
      expectedAttemptNumber: 1,
    });

    expect(mocks.post).toHaveBeenNthCalledWith(1, '/api/v2/analytics/operations/geocoding-queue/geo-job-419/resolve', {}, {
      tenantSlug: 'junin', headers: { 'Idempotency-Key': 'geo-resolve:419:12345678' },
    });
    expect(mocks.post).toHaveBeenNthCalledWith(2, '/api/v2/analytics/operations/geocoding-queue/geo-job-419/apply', {
      confirmed: true,
      expected_proposal_digest: PROPOSAL_DIGEST,
      expected_attempt_id: 'attempt-resolve-1',
      expected_attempt_number: 1,
    }, {
      tenantSlug: 'junin', headers: { 'Idempotency-Key': 'geo-apply:419:12345678' },
    });
  });

  it.each([
    ['tenant', { tenant_slug: 'otro-tenant' }, 'territorial_geocoding_execution_identity_invalid'],
    ['job', { job_id: 'geo-job-otro' }, 'territorial_geocoding_execution_identity_invalid'],
    ['action', { action: 'apply' }, 'territorial_geocoding_execution_action_invalid'],
    ['digest', { proposal_digest: 'not-a-digest' }, 'territorial_geocoding_execution_proposal_digest_invalid'],
    ['version', { proposal_version: { attempt_id: '', attempt_number: 0 } }, 'territorial_geocoding_execution_proposal_version_invalid'],
  ])('rejects a resolve receipt with mismatched %s identity', async (_field, override, code) => {
    mocks.post.mockResolvedValue({ ...executionPayload('resolve'), ...override });

    await expect(resolveTerritorialGeocodingJob({
      tenantSlug: 'junin',
      jobId: 'geo-job-419',
      idempotencyKey: 'geo-resolve:419:12345678',
    })).rejects.toMatchObject({ code });
  });

  it('rejects provider identifiers even in an otherwise valid restricted proposal', async () => {
    const payload = executionPayload('resolve');
    mocks.post.mockResolvedValue({
      ...payload,
      proposal: { ...payload.proposal, provider_place_id: 'provider-secret-reference' },
    });

    await expect(resolveTerritorialGeocodingJob({
      tenantSlug: 'junin',
      jobId: 'geo-job-419',
      idempotencyKey: 'geo-resolve:419:12345678',
    })).rejects.toMatchObject({ code: 'territorial_geocoding_execution_provider_identifier_exposed' });
  });

  it.each([
    ['status', { status: 'pending' }],
    ['coordinates_applied', { execution: { ...executionPayload('apply').execution, coordinates_applied: false } }],
    ['provider call', { execution: { ...executionPayload('apply').execution, provider_call_performed: true } }],
    ['write receipt', { execution: { ...executionPayload('apply').execution, write_performed: false } }],
  ])('never accepts apply success when %s is not authoritative', async (_field, override) => {
    mocks.post.mockResolvedValue({ ...executionPayload('apply'), ...override });

    await expect(applyTerritorialGeocodingJob({
      tenantSlug: 'junin',
      jobId: 'geo-job-419',
      idempotencyKey: 'geo-apply:419:12345678',
      expectedProposalDigest: PROPOSAL_DIGEST,
      expectedAttemptId: 'attempt-resolve-1',
      expectedAttemptNumber: 1,
    })).rejects.toMatchObject({ code: 'territorial_geocoding_apply_receipt_not_applied' });
  });

  it('rejects an apply receipt for another approved proposal version', async () => {
    mocks.post.mockResolvedValue({
      ...executionPayload('apply'),
      proposal_version: { attempt_id: 'attempt-resolve-2', attempt_number: 2 },
    });

    await expect(applyTerritorialGeocodingJob({
      tenantSlug: 'junin',
      jobId: 'geo-job-419',
      idempotencyKey: 'geo-apply:419:12345678',
      expectedProposalDigest: PROPOSAL_DIGEST,
      expectedAttemptId: 'attempt-resolve-1',
      expectedAttemptNumber: 1,
    })).rejects.toMatchObject({ code: 'territorial_geocoding_apply_receipt_proposal_mismatch' });
  });

  it('rejects a sync response that claims a provider call or coordinate write', () => {
    expect(() => normalizeTerritorialGeocodingSyncResponse({
      contract_version: 'operations.territorial_geocoding_sync.v1',
      tenant_id: 4,
      summary: {},
      execution: { provider_call_performed: true, coordinate_write_performed: false },
      idempotent_replay: false,
    })).toThrow('territorial_geocoding_sync_write_policy_invalid');
  });

  it('only treats explicit endpoint-absence statuses as eligible for read-only fallback', () => {
    expect(isTerritorialQueueEndpointUnavailable(new ApiError('forbidden', 403))).toBe(false);
    expect(isTerritorialQueueEndpointUnavailable(new ApiError('conflict', 409))).toBe(false);
    expect(isTerritorialQueueEndpointUnavailable(new ApiError('not found', 404))).toBe(true);
    expect(isTerritorialQueueEndpointUnavailable(new ApiError('method not allowed', 405))).toBe(true);
    expect(isTerritorialQueueEndpointUnavailable(new ApiError('not implemented', 501))).toBe(true);
    expect(isTerritorialQueueEndpointUnavailable(new ApiError('bad gateway', 502))).toBe(false);
    expect(isTerritorialQueueEndpointUnavailable(new ApiError('temporarily unavailable', 503))).toBe(false);
    expect(isTerritorialQueueEndpointUnavailable(new ApiError('gateway timeout', 504))).toBe(false);
    expect(isTerritorialQueueEndpointUnavailable(new NetworkError('offline'))).toBe(false);
  });

  it('propagates authorization and idempotency conflicts without weakening them', async () => {
    const forbidden = new ApiError('forbidden', 403);
    mocks.get.mockRejectedValueOnce(forbidden);
    await expect(getTerritorialGeocodingQueue({ tenantSlug: 'junin' })).rejects.toBe(forbidden);

    const conflict = new ApiError('conflict', 409);
    mocks.post.mockRejectedValueOnce(conflict);
    await expect(reviewTerritorialGeocodingJob({
      tenantSlug: 'junin',
      jobId: 'geo-job-419',
      decision: 'rejected',
      reasonCode: 'incorrect_location',
      idempotencyKey: 'geo-review:geo-job-419:abcdefgh',
      expectedProposalDigest: PROPOSAL_DIGEST,
      expectedAttemptId: 'attempt-resolve-1',
      expectedAttemptNumber: 1,
    })).rejects.toBe(conflict);
  });
});
