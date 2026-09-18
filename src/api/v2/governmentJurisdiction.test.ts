import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getGovernmentJurisdictionReadiness,
  parseGovernmentJurisdictionReadiness,
  reviewGovernmentJurisdictionEvidence,
  submitGovernmentJurisdictionEvidence,
} from '@/api/v2/governmentJurisdiction';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock('@/utils/api', () => ({ apiFetch: api.fetch }));

const documentSha256 = 'a'.repeat(64);
const submissionSha256 = 'b'.repeat(64);

const readiness = ({
  state = 'unverified',
  readyToPublish = false,
}: {
  state?: 'unverified' | 'evidence_submitted' | 'rejected' | 'verified';
  readyToPublish?: boolean;
} = {}) => {
  const hasSubmission = state !== 'unverified';
  const hasReview = state === 'rejected' || state === 'verified';
  const reviewEventType = state === 'verified'
    ? 'tenant_jurisdiction_verified'
    : 'tenant_jurisdiction_rejected';
  const nextAction = {
    unverified: 'submit_jurisdiction_evidence',
    evidence_submitted: 'await_platform_jurisdiction_review',
    rejected: 'resubmit_jurisdiction_evidence',
    verified: 'review_survey_content',
  }[state];
  return {
    contract_version: 'government.jurisdiction.readiness.v1',
    tenant: { id: 41, slug: 'gobierno-demo', type: 'municipio' },
    state,
    ready_to_publish: readyToPublish,
    next_action: nextAction,
    publication_guard: {
      government_evidence_required: true,
      allowed_to_publish: readyToPublish,
      reason_code: readyToPublish ? null : 'survey_tenant_jurisdiction_unverified',
      guard_preserved: true,
    },
    jurisdiction: {
      status: state === 'verified' ? 'verified' : 'unverified',
      reference: hasSubmission ? 'jurisdiccion:organismo:alcance' : null,
      evidence: {
        reference: hasSubmission ? 'evidencia:expediente:0001' : null,
        document_sha256: hasSubmission ? documentSha256 : null,
        submission_sha256: hasSubmission ? submissionSha256 : null,
        raw_content_stored: false,
        credentials_stored: false,
      },
      verified_by_user_id: state === 'verified' ? 99 : null,
      verified_at: state === 'verified' ? '2026-09-05T15:00:00+00:00' : null,
    },
    workflow: {
      submission: hasSubmission ? {
        id: 81,
        event_type: 'tenant_jurisdiction_evidence_submitted',
        actor_user_id: 7,
        decision: 'submitted',
        submission_sha256: submissionSha256,
        reason_code: null,
        created_at: '2026-09-05T14:00:00+00:00',
      } : null,
      review: hasReview ? {
        id: 82,
        event_type: reviewEventType,
        actor_user_id: 99,
        decision: state === 'verified' ? 'verify' : 'reject',
        submission_sha256: submissionSha256,
        reason_code: state === 'verified' ? 'jurisdiction_evidence_verified' : 'documento_incompleto',
        created_at: '2026-09-05T15:00:00+00:00',
      } : null,
      review_matches_submission: hasReview,
      separation_of_duties_enforced: true,
    },
  };
};

describe('government jurisdiction API', () => {
  beforeEach(() => {
    api.fetch.mockReset();
  });

  it('loads a tenant-scoped fail-closed readiness contract', async () => {
    api.fetch.mockResolvedValueOnce(readiness());

    const result = await getGovernmentJurisdictionReadiness(' Gobierno-Demo ');

    expect(result.state).toBe('unverified');
    expect(result.ready_to_publish).toBe(false);
    expect(api.fetch).toHaveBeenCalledWith(
      '/api/v2/tenants/gobierno-demo/government-readiness/jurisdiction',
      {
        cache: 'no-store',
        omitTenant: true,
        persistTenantSlug: false,
      },
    );
  });

  it('rejects a response from a different tenant and an unsafe generic selector', () => {
    expect(() => parseGovernmentJurisdictionReadiness(
      { ...readiness(), tenant: { id: 41, slug: 'otro-tenant', type: 'municipio' } },
      'gobierno-demo',
    )).toThrow('government_jurisdiction_scope_mismatch');
    expect(() => parseGovernmentJurisdictionReadiness(readiness(), 'admin'))
      .toThrow('government_jurisdiction_request_invalid');
  });

  it('submits only opaque references and a digest without granting verification', async () => {
    api.fetch.mockResolvedValueOnce({
      contract_version: 'government.jurisdiction.evidence_submission.v1',
      replayed: false,
      write_performed: true,
      verification_granted: false,
      readiness: readiness({ state: 'evidence_submitted' }),
    });

    const result = await submitGovernmentJurisdictionEvidence({
      tenantSlug: 'gobierno-demo',
      jurisdictionRef: ' jurisdiccion:organismo:alcance ',
      evidenceRef: ' evidencia:expediente:0001 ',
      evidenceSha256: documentSha256.toUpperCase(),
      idempotencyKey: 'jurisdiction-evidence:attempt-001',
    });

    expect(result.verification_granted).toBe(false);
    expect(result.readiness.state).toBe('evidence_submitted');
    expect(api.fetch).toHaveBeenCalledWith(
      '/api/v2/tenants/gobierno-demo/government-readiness/jurisdiction/evidence',
      {
        method: 'POST',
        body: {
          jurisdiction_ref: 'jurisdiccion:organismo:alcance',
          evidence_ref: 'evidencia:expediente:0001',
          evidence_sha256: documentSha256,
        },
        headers: { 'Idempotency-Key': 'jurisdiction-evidence:attempt-001' },
        cache: 'no-store',
        omitTenant: true,
        persistTenantSlug: false,
      },
    );
  });

  it('rejects evidence references that could carry URLs or credentials before fetching', async () => {
    await expect(submitGovernmentJurisdictionEvidence({
      tenantSlug: 'gobierno-demo',
      jurisdictionRef: 'jurisdiccion:organismo:alcance',
      evidenceRef: 'https://storage.example/private?token=secret',
      evidenceSha256: documentSha256,
      idempotencyKey: 'jurisdiction-evidence:attempt-002',
    })).rejects.toThrow('government_jurisdiction_request_invalid');
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it('binds platform verification to the exact submitted digest and omits a reason code', async () => {
    api.fetch.mockResolvedValueOnce({
      contract_version: 'government.jurisdiction.review.v1',
      decision: 'verify',
      replayed: false,
      write_performed: true,
      readiness: readiness({ state: 'verified', readyToPublish: true }),
    });

    const result = await reviewGovernmentJurisdictionEvidence({
      tenantSlug: 'gobierno-demo',
      decision: 'verify',
      expectedSubmissionSha256: submissionSha256,
      idempotencyKey: 'jurisdiction-review:attempt-001',
    });

    expect(result.readiness.ready_to_publish).toBe(true);
    expect(api.fetch).toHaveBeenCalledWith(
      '/api/v2/tenants/gobierno-demo/government-readiness/jurisdiction/review',
      {
        method: 'POST',
        body: {
          decision: 'verify',
          expected_submission_sha256: submissionSha256,
        },
        headers: { 'Idempotency-Key': 'jurisdiction-review:attempt-001' },
        cache: 'no-store',
        omitTenant: true,
        persistTenantSlug: false,
      },
    );
  });

  it('requires a safe reason code for rejection and preserves it in the request', async () => {
    await expect(reviewGovernmentJurisdictionEvidence({
      tenantSlug: 'gobierno-demo',
      decision: 'reject',
      expectedSubmissionSha256: submissionSha256,
      idempotencyKey: 'jurisdiction-review:attempt-002',
    })).rejects.toThrow('government_jurisdiction_request_invalid');
    expect(api.fetch).not.toHaveBeenCalled();

    api.fetch.mockResolvedValueOnce({
      contract_version: 'government.jurisdiction.review.v1',
      decision: 'reject',
      replayed: false,
      write_performed: true,
      readiness: readiness({ state: 'rejected' }),
    });
    await reviewGovernmentJurisdictionEvidence({
      tenantSlug: 'gobierno-demo',
      decision: 'reject',
      expectedSubmissionSha256: submissionSha256,
      reasonCode: ' Documento_Incompleto ',
      idempotencyKey: 'jurisdiction-review:attempt-003',
    });

    expect(api.fetch).toHaveBeenCalledWith(
      '/api/v2/tenants/gobierno-demo/government-readiness/jurisdiction/review',
      expect.objectContaining({
        body: {
          decision: 'reject',
          expected_submission_sha256: submissionSha256,
          reason_code: 'documento_incompleto',
        },
      }),
    );
  });

  it('rejects any submission response that claims automatic verification', async () => {
    api.fetch.mockResolvedValueOnce({
      contract_version: 'government.jurisdiction.evidence_submission.v1',
      replayed: false,
      write_performed: true,
      verification_granted: true,
      readiness: readiness({ state: 'evidence_submitted' }),
    });

    await expect(submitGovernmentJurisdictionEvidence({
      tenantSlug: 'gobierno-demo',
      jurisdictionRef: 'jurisdiccion:organismo:alcance',
      evidenceRef: 'evidencia:expediente:0001',
      evidenceSha256: documentSha256,
      idempotencyKey: 'jurisdiction-evidence:attempt-003',
    })).rejects.toThrow('government_jurisdiction_contract_invalid');
  });
});
