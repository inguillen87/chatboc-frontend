import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {},
}));

import {
  adminCloseSurveyGovernanceRelease,
  adminCreateSurveyGovernanceRelease,
  adminListSurveyGovernanceReleases,
  adminPublishSurveyGovernanceRelease,
} from '@/api/encuestas';
import type { SurveyGovernanceReleaseCreatePayload } from '@/types/encuestas';

const payload: SurveyGovernanceReleaseCreatePayload = {
  eligibility_policy: {
    policy_version: 'eligibility-v1',
    mode: 'self_attested',
    declarations: ['resident_attested'],
    human_review_required: true,
    automated_decision: false,
  },
  consent_policy: {
    policy_version: 'consent-v1',
    public_text: 'Texto público aprobado.',
    text_sha256: 'a'.repeat(64),
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

describe('survey governance API contract', () => {
  beforeEach(() => {
    apiFetchMock.mockReset().mockResolvedValue({});
  });

  it('uses the canonical tenant-scoped release list', async () => {
    await adminListSurveyGovernanceReleases(42, { tenantSlug: 'junin' });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/v2/surveys/42/releases', {
      tenantSlug: 'junin',
    });
  });

  it('sends the exact create policy and caller-owned idempotency key', async () => {
    await adminCreateSurveyGovernanceRelease(42, payload, 'survey-governance:create:key-1', {
      tenantSlug: 'junin',
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/v2/surveys/42/releases', {
      tenantSlug: 'junin',
      method: 'POST',
      body: payload,
      headers: { 'Idempotency-Key': 'survey-governance:create:key-1' },
    });
  });

  it('pins publish to the expected snapshot and close to the human review reference', async () => {
    await adminPublishSurveyGovernanceRelease(
      42,
      7,
      'b'.repeat(64),
      'survey-governance:publish:key-1',
      { tenantSlug: 'junin' },
    );
    await adminCloseSurveyGovernanceRelease(
      42,
      7,
      'acta:comite-001',
      'survey-governance:close:key-1',
      { tenantSlug: 'junin' },
    );

    expect(apiFetchMock.mock.calls[0]).toEqual([
      '/api/v2/surveys/42/releases/7/publish',
      {
        tenantSlug: 'junin',
        method: 'POST',
        body: { expected_snapshot_sha256: 'b'.repeat(64) },
        headers: { 'Idempotency-Key': 'survey-governance:publish:key-1' },
      },
    ]);
    expect(apiFetchMock.mock.calls[1]).toEqual([
      '/api/v2/surveys/42/releases/7/close',
      {
        tenantSlug: 'junin',
        method: 'POST',
        body: { human_review_reference: 'acta:comite-001' },
        headers: { 'Idempotency-Key': 'survey-governance:close:key-1' },
      },
    ]);
  });
});
