import { describe, expect, it } from 'vitest';

import type {
  SurveyAnalyticsProvenance,
  SurveyGovernanceRelease,
  SurveyGovernanceReleaseList,
  SurveyResponseProvenance,
} from '@/types/encuestas';

import {
  buildSurveyResultEvidence,
  buildSurveyResultEvidenceReceipt,
  SurveyGovernanceContractError,
  validateSurveyGovernanceReleaseList,
} from './surveyGovernanceContract';

const responseProvenance = (
  overrides: Partial<SurveyResponseProvenance> = {},
): SurveyResponseProvenance => ({
  contract_version: 'surveys.response_provenance.v1',
  mode: 'real',
  server_trusted_classification: true,
  contains_synthetic: false,
  real_responses_included: 8,
  synthetic_responses_included: 0,
  synthetic_responses_excluded: 3,
  unverified_responses_included: 0,
  unverified_responses_excluded: 1,
  synthetic_marker_contract: 'surveys.demo_seeding.v1',
  ...overrides,
});

const backendAnalytics: SurveyAnalyticsProvenance = {
  source: 'backend',
  synthetic: false,
  affected_modules: [],
};

const closedRelease = (
  overrides: Partial<SurveyGovernanceRelease> = {},
): SurveyGovernanceRelease => ({
  ok: true,
  contract_version: 'surveys.governance_release.v1',
  release_id: 5,
  survey_id: 42,
  version_number: 1,
  status: 'closed',
  snapshot_sha256: 'a'.repeat(64),
  policy_sha256: 'b'.repeat(64),
  published_at: '2026-09-04T11:00:00Z',
  closed_at: '2026-09-04T12:00:00Z',
  governance: {
    eligibility: {
      contract_version: 'surveys.eligibility_policy.v1',
      policy_version: 'eligibility-2026.1',
      mode: 'self_attested',
      declarations: ['resident_attested'],
      human_review_required: true,
      automated_decision: false,
      stores_roster_or_pii: false,
      decision_state: 'not_evaluated',
    },
    consent: {
      contract_version: 'surveys.consent_policy.v1',
      policy_version: 'consent-2026.1',
      public_text: 'Consentimiento institucional.',
      text_sha256: 'e'.repeat(64),
      required: true,
      stores_public_text: true,
      records_participant_input: false,
    },
    decision_rules: {
      contract_version: 'surveys.decision_rules.v1',
      quorum: { type: 'minimum_responses', value: 10 },
      tie: { procedure: 'human_review' },
      challenge: { enabled: false, window_hours: null, procedure: 'human_review' },
      human_review_required: true,
      declarative_only: true,
      computed_outcome: null,
    },
  },
  capabilities: { can_publish: false, can_close: false },
  assurance: {
    scope: 'instrument_and_policy_integrity',
    regulated_election_certified: false,
    result_certified: false,
    external_verification: 'not_performed',
  },
  closure: {
    manifest_sha256: 'c'.repeat(64),
    manifest: {
      contract_version: 'surveys.closure_manifest.v1',
      tenant_id: 7,
      survey_id: 42,
      release_id: 5,
      release_version: 1,
      snapshot_sha256: 'a'.repeat(64),
      policy_sha256: 'b'.repeat(64),
      response_count: 12,
      response_set_sha256: 'd'.repeat(64),
      human_review_reference_sha256: 'f'.repeat(64),
      closed_at: '2026-09-04T12:00:00Z',
      assurance: {
        scope: 'local_database_closure_integrity',
        regulated_election_certified: false,
        result_certified: false,
        external_anchor_verified: false,
      },
    },
  },
  ...overrides,
});

const releaseList = (
  release: SurveyGovernanceRelease = closedRelease(),
  overrides: Partial<SurveyGovernanceReleaseList> = {},
): SurveyGovernanceReleaseList => ({
  ok: true,
  contract_version: 'surveys.governance_releases.v1',
  tenant: { id: 7, slug: 'junin' },
  survey_id: 42,
  survey_state: 'cerrada',
  active_release_id: null,
  latest_release_id: release.release_id,
  capabilities: {
    read: true,
    manage: true,
    plan_allows_write: true,
    create_release: false,
    required_for_mutation: 'survey.governance.manage',
  },
  items: [release],
  total: 1,
  ...overrides,
});

const evidenceInput = (list = releaseList()) => ({
  surveyId: 42,
  tenantSlug: 'junin',
  tenantId: 7,
  releaseList: list,
  analytics: {
    totalResponses: 8,
    responseProvenance: responseProvenance(),
    frontendProvenance: backendAnalytics,
    filtered: false,
  },
});

describe('survey governance release list contract', () => {
  it('keeps tenant, release ordering and explicit manage authority fail closed', () => {
    expect(validateSurveyGovernanceReleaseList(releaseList(), {
      surveyId: 42,
      tenantSlug: 'junin',
    })).toEqual(releaseList());

    expect(() => validateSurveyGovernanceReleaseList(
      releaseList(closedRelease(), {
        capabilities: {
          read: true,
          manage: false,
          plan_allows_write: true,
          create_release: false,
          required_for_mutation: 'survey.governance.manage',
        },
      }),
      { surveyId: 42, tenantSlug: 'junin' },
    )).toThrow(SurveyGovernanceContractError);

    expect(() => validateSurveyGovernanceReleaseList(releaseList(), {
      surveyId: 42,
      tenantSlug: 'junin',
      tenantId: 99,
    })).toThrow(SurveyGovernanceContractError);
  });
});

describe('survey result evidence reconciliation', () => {
  it('reconciles real analytics plus excluded synthetic and unverified rows with the manifest', () => {
    const assessment = buildSurveyResultEvidence(evidenceInput());

    expect(assessment).toMatchObject({
      status: 'reconciled',
      reasonCode: null,
      canExportReconciledCountReceipt: true,
      counts: {
        manifest: 12,
        analytics: 8,
        real: 8,
        synthetic: 3,
        unverified: 1,
        classifiedClosureSet: 12,
      },
      assurance: {
        scope: 'count_reconciliation_only',
        resultCertified: false,
        regulatedElectionCertified: false,
        externalAnchorVerified: false,
      },
    });
  });

  it('does not reconcile a mismatched response set or permit a count receipt export', () => {
    const assessment = buildSurveyResultEvidence({
      ...evidenceInput(),
      analytics: {
        ...evidenceInput().analytics,
        responseProvenance: responseProvenance({ synthetic_responses_excluded: 2 }),
      },
    });

    expect(assessment).toMatchObject({
      status: 'not_reconciled',
      reasonCode: 'response_count_mismatch',
      canExportReconciledCountReceipt: false,
    });
    expect(() => buildSurveyResultEvidenceReceipt(assessment)).toThrow(
      'survey_result_count_receipt_not_reconciled',
    );
  });

  it('rejects demo fallback, filtered analytics and weakened certification boundaries', () => {
    const fallback = buildSurveyResultEvidence({
      ...evidenceInput(),
      analytics: {
        ...evidenceInput().analytics,
        frontendProvenance: {
          source: 'mixed',
          synthetic: true,
          affected_modules: ['summary'],
        },
      },
    });
    expect(fallback.reasonCode).toBe('analytics_not_backend');

    const filtered = buildSurveyResultEvidence({
      ...evidenceInput(),
      analytics: { ...evidenceInput().analytics, filtered: true },
    });
    expect(filtered.reasonCode).toBe('analytics_filtered');

    const unsafeManifest = closedRelease();
    if (unsafeManifest.closure) {
      unsafeManifest.closure.manifest.assurance.external_anchor_verified = true as false;
    }
    const unsafe = buildSurveyResultEvidence(evidenceInput(releaseList(unsafeManifest)));
    expect(unsafe.reasonCode).toBe('closure_manifest_invalid');
  });

  it('exports only a privacy-safe count receipt without claiming client-side digest verification', () => {
    const assessment = buildSurveyResultEvidence(evidenceInput());
    const receipt = buildSurveyResultEvidenceReceipt(assessment);

    expect(receipt).toMatchObject({
      contract_version: 'surveys.closure_count_receipt.v1',
      status: 'closure_reconciled_by_count',
      declared_hash_references: {
        source: 'backend',
        client_verified: false,
      },
      reconciliation: {
        scope: 'count_only',
        validates_manifest_digest: false,
        validates_response_content: false,
        validates_result_distribution: false,
      },
      backend_declared_assurance: {
        client_verified: false,
        result_certified: false,
        regulated_election_certified: false,
        external_anchor_verified: false,
      },
      privacy: {
        pii_included: false,
        small_provenance_cells_suppressed: true,
      },
    });
    expect(receipt.response_provenance).toEqual({
      minimum_cell_size: 5,
      real: { value: 8, bucket: 'exact' },
      synthetic: { value: null, bucket: '<5' },
      unverified: { value: null, bucket: '<5' },
    });
    expect(receipt.unsupported_metrics).toEqual([
      'eligible_population',
      'participation_rate',
      'abstentions',
      'quorum',
      'winner',
    ]);
    expect(JSON.stringify(receipt)).not.toContain('Consentimiento institucional');
    expect(JSON.stringify(receipt)).not.toContain('resident_attested');
  });
});
