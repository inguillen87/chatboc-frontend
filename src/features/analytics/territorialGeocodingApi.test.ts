import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/utils/api';

import {
  getTerritorialGeocodingAttempts,
  getTerritorialGeocodingDetail,
  getTerritorialGeocodingQueue,
  isTerritorialQueueEndpointUnavailable,
  normalizeTerritorialGeocodingQueue,
  normalizeTerritorialGeocodingSyncResponse,
  reviewTerritorialGeocodingJob,
  syncTerritorialGeocodingQueue,
  TerritorialGeocodingContractError,
} from './territorialGeocodingApi';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@/api/v2/client', () => ({ panelApi: { get: mocks.get, post: mocks.post } }));

const reviewReceipt = {
  id: 72,
  decision: 'approved',
  effective_state: 'approved',
  reason_code: 'verified_on_map',
  reviewer_user_id: 9,
  reviewed_job_status: 'ready',
  proposal_current: true,
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

const attempt = {
  id: 3,
  attempt_number: 1,
  outcome_status: 'candidate_found',
  reason_code: 'pending_review',
  provider: 'configured_provider',
  external_call_performed: true,
  coordinate_write_performed: false,
  proposal: { lat: -33.1334, lng: -68.4861, location_type: 'ROOFTOP', partial_match: false },
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

  it('uses panel authentication and tenant scope for list, detail, and attempts', async () => {
    mocks.get
      .mockResolvedValueOnce(queuePayload())
      .mockResolvedValueOnce({
        contract_version: 'operations.territorial_geocoding_admin.v1',
        tenant_id: 4,
        item,
        selected: { proposal: attempt.proposal, proposal_digest: 'safe-digest', attempts: [attempt], reviews: [] },
        privacy: { raw_address_exposed: false, address_digest_exposed: false, exact_coordinates_exposed: true, authorized_admin_detail: true },
        write_policy: { get_is_read_only: true, provider_call_performed: false, coordinate_application_supported: false, review_is_human_decision_only: true },
      })
      .mockResolvedValueOnce({
        contract_version: 'operations.territorial_geocoding_admin.v1',
        tenant_id: 4,
        job_id: 'geo-job-419',
        ticket_id: 419,
        source_model: 'municipio_ticket',
        attempts: [attempt],
        privacy: { raw_address_exposed: false, address_digest_exposed: false, authorized_admin_detail: true },
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
    expect(attempts.ticketSourceModel).toBe('MunicipioTicket');
  });

  it('posts a controlled decision with tenant and Idempotency-Key but never applies coordinates', async () => {
    mocks.post.mockResolvedValue({
      contract_version: 'operations.territorial_geocoding_admin.v1',
      tenant_id: 4,
      job_id: 'geo-job-419',
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
    });

    expect(mocks.post).toHaveBeenCalledWith(
      '/api/v2/analytics/operations/geocoding-queue/geo-job-419/review',
      { decision: 'approved', reason_code: 'verified_on_map' },
      { tenantSlug: 'junin', headers: { 'Idempotency-Key': 'geo-review:geo-job-419:01234567' } },
    );
    expect(mocks.post.mock.calls[0][1]).not.toHaveProperty('apply_coordinates');
    expect(result).toMatchObject({ idempotentReplay: false, providerCallPerformed: false, coordinateWritePerformed: false });
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

  it('rejects a sync response that claims a provider call or coordinate write', () => {
    expect(() => normalizeTerritorialGeocodingSyncResponse({
      contract_version: 'operations.territorial_geocoding_sync.v1',
      tenant_id: 4,
      summary: {},
      execution: { provider_call_performed: true, coordinate_write_performed: false },
      idempotent_replay: false,
    })).toThrow('territorial_geocoding_sync_write_policy_invalid');
  });

  it('does not reinterpret 403 or 409 as a read-only endpoint outage', () => {
    expect(isTerritorialQueueEndpointUnavailable(new ApiError('forbidden', 403))).toBe(false);
    expect(isTerritorialQueueEndpointUnavailable(new ApiError('conflict', 409))).toBe(false);
    expect(isTerritorialQueueEndpointUnavailable(new ApiError('not found', 404))).toBe(true);
    expect(isTerritorialQueueEndpointUnavailable(new ApiError('temporarily unavailable', 503))).toBe(true);
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
    })).rejects.toBe(conflict);
  });
});
