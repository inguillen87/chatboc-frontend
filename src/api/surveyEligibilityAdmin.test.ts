import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/utils/api', () => ({ apiFetch: apiFetchMock }));

import {
  getSurveyEligibilitySummary,
  issueSurveyEligibilityGrant,
  parseSurveyEligibilityIssueReceipt,
  parseSurveyEligibilityReleaseScopes,
  parseSurveyEligibilityRevocationReceipt,
  parseSurveyEligibilitySummary,
  revokeSurveyEligibilityGrant,
} from './surveyEligibilityAdmin';
import type { SurveyEligibilityReleaseScope } from '@/types/surveyEligibilityAdmin';

const release: SurveyEligibilityReleaseScope = {
  tenantId: 9,
  surveyId: 42,
  releaseId: 7,
  versionNumber: 3,
  status: 'published',
  policyVersion: 'eligibility-2026.1',
  mode: 'manual_review',
  active: true,
  planAllowsWrite: true,
};

const releaseList = () => ({
  ok: true,
  contract_version: 'surveys.governance_releases.v1',
  tenant: { id: 9, slug: 'junin' },
  survey_id: 42,
  active_release_id: 7,
  latest_release_id: 7,
  capabilities: {
    read: true,
    manage: true,
    plan_allows_write: true,
    create_release: false,
    required_for_mutation: 'survey.governance.manage',
  },
  total: 1,
  items: [
    {
      contract_version: 'surveys.governance_release.v1',
      release_id: 7,
      survey_id: 42,
      version_number: 3,
      status: 'published',
      governance: {
        eligibility: {
          contract_version: 'surveys.eligibility_policy.v1',
          policy_version: 'eligibility-2026.1',
          mode: 'manual_review',
          human_review_required: true,
          automated_decision: false,
          stores_roster_or_pii: false,
          decision_state: 'not_evaluated',
        },
      },
    },
  ],
});

const summary = () => ({
  ok: true,
  contract_version: 'surveys.eligibility_aggregate.v1',
  survey_id: 42,
  release_id: 7,
  policy_version: 'eligibility-2026.1',
  counts: { issued: 5, active: 2, expired: 1, revoked: 1, redeemed: 1 },
  eligible_population: null,
  participation_rate: null,
  abstentions: null,
  denominator_status: {
    available: false,
    reason_code: 'survey_eligible_population_not_sealed',
  },
  subjects_exposed: false,
  regulated_election_certified: false,
  result_certified: false,
});

const issueReceipt = () => ({
  ok: true,
  contract_version: 'surveys.eligibility_grant.v1',
  tenant_id: 9,
  survey_id: 42,
  release_id: 7,
  grant_ref: `seg1_${'G'.repeat(43)}`,
  state: 'active',
  generation: 1,
  eligibility_mode: 'manual_review',
  eligibility_policy_version: 'eligibility-2026.1',
  authority: { namespace: 'chatboc_manual_review', adapter_version: 'manual_review.v1' },
  expires_at: '2026-09-01T12:00:00+00:00',
  credential_header: 'X-Survey-Eligibility-Credential',
  credential: `sec1_${'C'.repeat(43)}`,
  idempotency: { persisted: true, replayed: false, disposition: 'accepted' },
  assurance: {
    privacy: 'pseudonymous_internal_linkability',
    assurance_level: 'human_reviewed_opaque_grant',
    authority_binding: 'operator_attested_v1',
    raw_subject_persisted: false,
    subject_identifier_exposed: false,
    plaintext_credential_persisted: false,
    ballot_secrecy_certified: false,
    regulated_election_certified: false,
    result_certified: false,
  },
});

describe('survey eligibility admin contracts', () => {
  beforeEach(() => apiFetchMock.mockReset());

  it('reconciles the tenant, survey, active release and restricted policy', () => {
    expect(parseSurveyEligibilityReleaseScopes(releaseList(), { surveyId: 42, tenantSlug: 'JUNIN' }))
      .toEqual([release]);
    expect(() =>
      parseSurveyEligibilityReleaseScopes(
        { ...releaseList(), tenant: { id: 9, slug: 'otro' } },
        { surveyId: 42, tenantSlug: 'junin' },
      ),
    ).toThrow(/contrato de elegibilidad inválido/i);
    const malformedRestricted = releaseList();
    delete malformedRestricted.items[0].governance.eligibility.stores_roster_or_pii;
    expect(() =>
      parseSurveyEligibilityReleaseScopes(malformedRestricted, { surveyId: 42, tenantSlug: 'junin' }),
    ).toThrow(/contrato de elegibilidad inválido/i);
  });

  it('rejects invented denominators and mismatched aggregate totals', () => {
    expect(parseSurveyEligibilitySummary(summary(), release)).toMatchObject({
      surveyId: 42,
      releaseId: 7,
      eligiblePopulation: null,
      participationRate: null,
      abstentions: null,
    });
    expect(() =>
      parseSurveyEligibilitySummary({ ...summary(), eligible_population: 100 }, release),
    ).toThrow(/contrato de elegibilidad inválido/i);
    expect(() =>
      parseSurveyEligibilitySummary({
        ...summary(),
        counts: { ...summary().counts, issued: 6 },
      }, release),
    ).toThrow(/contrato de elegibilidad inválido/i);
  });

  it('accepts only a durable active credential receipt without subject or review leakage', () => {
    const subjectRef = `subj_${'S'.repeat(43)}`;
    const reviewReference = 'review:case-eligibility-0001';
    expect(
      parseSurveyEligibilityIssueReceipt(issueReceipt(), {
        release,
        subjectRef,
        reviewReference,
      }),
    ).toMatchObject({
      credential: `sec1_${'C'.repeat(43)}`,
      grantRef: `seg1_${'G'.repeat(43)}`,
      replayed: false,
    });
    expect(() =>
      parseSurveyEligibilityIssueReceipt(
        { ...issueReceipt(), debug_subject: subjectRef },
        { release, subjectRef, reviewReference },
      ),
    ).toThrow(/contrato de elegibilidad inválido/i);
    expect(() =>
      parseSurveyEligibilityIssueReceipt(
        { ...issueReceipt(), tenant_id: 10 },
        { release, subjectRef, reviewReference },
      ),
    ).toThrow(/contrato de elegibilidad inválido/i);
    expect(() =>
      parseSurveyEligibilityIssueReceipt(
        { ...issueReceipt(), release_id: 8 },
        { release, subjectRef, reviewReference },
      ),
    ).toThrow(/contrato de elegibilidad inválido/i);
  });

  it('sends opaque review data only in the body and keeps every request no-store and tenant scoped', async () => {
    const subjectRef = `subj_${'S'.repeat(43)}`;
    const reviewReference = 'review:case-eligibility-0001';
    apiFetchMock.mockResolvedValueOnce(issueReceipt());

    await issueSurveyEligibilityGrant(
      release,
      { subjectRef, reviewReference },
      'survey-eligibility:issue:42:nonce-0001',
      'junin',
    );

    const [path, options] = apiFetchMock.mock.calls[0];
    expect(path).toBe('/api/v2/surveys/42/releases/7/eligibility-grants');
    expect(path).not.toContain(subjectRef);
    expect(path).not.toContain(reviewReference);
    expect(options).toMatchObject({
      method: 'POST',
      tenantSlug: 'junin',
      persistTenantSlug: false,
      cache: 'no-store',
      headers: { 'Idempotency-Key': 'survey-eligibility:issue:42:nonce-0001' },
      body: { subject_ref: subjectRef, review_reference: reviewReference },
    });
  });

  it('uses only an allowed reason and the exact grant route for revocation', async () => {
    const grantRef = `seg1_${'G'.repeat(43)}`;
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      contract_version: 'surveys.eligibility_grant.v1',
      tenant_id: 9,
      survey_id: 42,
      release_id: 7,
      grant_ref: grantRef,
      state: 'revoked',
      reason_code: 'credential_compromised',
      eligibility_policy_version: 'eligibility-2026.1',
      idempotency: { persisted: true, replayed: false, disposition: 'accepted' },
      regulated_election_certified: false,
      result_certified: false,
    });

    await revokeSurveyEligibilityGrant(
      release,
      grantRef,
      'credential_compromised',
      'survey-eligibility:revoke:42:nonce-0001',
      'junin',
    );

    expect(apiFetchMock).toHaveBeenCalledWith(
      `/api/v2/surveys/42/releases/7/eligibility-grants/${grantRef}/revoke`,
      expect.objectContaining({
        method: 'POST',
        tenantSlug: 'junin',
        persistTenantSlug: false,
        cache: 'no-store',
        body: { reason_code: 'credential_compromised' },
      }),
    );

    expect(() =>
      parseSurveyEligibilityRevocationReceipt(
        {
          ok: true,
          contract_version: 'surveys.eligibility_grant.v1',
          tenant_id: 99,
          survey_id: 42,
          release_id: 7,
          grant_ref: grantRef,
          state: 'revoked',
          reason_code: 'credential_compromised',
          eligibility_policy_version: 'eligibility-2026.1',
          idempotency: { persisted: true, replayed: false, disposition: 'accepted' },
          regulated_election_certified: false,
          result_certified: false,
        },
        { release, grantRef, reasonCode: 'credential_compromised' },
      ),
    ).toThrow(/contrato de elegibilidad inválido/i);
    expect(() =>
      parseSurveyEligibilityRevocationReceipt(
        {
          ok: true,
          contract_version: 'surveys.eligibility_grant.v1',
          tenant_id: 9,
          survey_id: 42,
          release_id: 8,
          grant_ref: grantRef,
          state: 'revoked',
          reason_code: 'credential_compromised',
          eligibility_policy_version: 'eligibility-2026.1',
          idempotency: { persisted: true, replayed: false, disposition: 'accepted' },
          regulated_election_certified: false,
          result_certified: false,
        },
        { release, grantRef, reasonCode: 'credential_compromised' },
      ),
    ).toThrow(/contrato de elegibilidad inválido/i);
  });

  it('reads capability through the exact scoped summary route', async () => {
    apiFetchMock.mockResolvedValueOnce(summary());
    await expect(getSurveyEligibilitySummary(release, 'junin')).resolves.toMatchObject({
      surveyId: 42,
      releaseId: 7,
    });
    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v2/surveys/42/releases/7/eligibility-summary',
      { tenantSlug: 'junin', persistTenantSlug: false, cache: 'no-store' },
    );
  });
});
