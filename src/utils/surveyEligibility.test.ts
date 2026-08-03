import { describe, expect, it } from 'vitest';

import type { SurveyPublic, SurveyPublicEligibilityContract } from '@/types/encuestas';
import {
  resolveSurveyPublicEligibility,
  SURVEY_ELIGIBILITY_CREDENTIAL_HEADER,
} from './surveyEligibility';

const eligibilityContract = (
  gateStatus: 'ready' | 'unavailable' = 'ready',
): SurveyPublicEligibilityContract => ({
  contract_version: 'surveys.public_eligibility.v1',
  policy_version: 'eligibility-v1',
  mode: 'institution_attested',
  credential_required: true,
  gate_status: gateStatus,
  intake_available: gateStatus === 'ready',
  decision: gateStatus === 'ready' ? 'credential_pending' : 'unavailable',
  transport: {
    kind: 'http_header',
    header_name: SURVEY_ELIGIBILITY_CREDENTIAL_HEADER,
    meta_flow_supported: false,
  },
  blocked_reason_code: gateStatus === 'ready' ? null : 'survey_eligibility_gate_unavailable',
  eligible_population: null,
  participation_rate: null,
  abstentions: null,
  denominator_status: {
    available: false,
    reason_code: 'survey_eligible_population_not_sealed',
  },
  privacy_assurance: 'pseudonymous_internal_linkability',
  assurance_level: 'human_reviewed_opaque_grant',
  authority_binding: 'operator_attested_v1',
  subject_identifier_exposed: false,
  plaintext_credential_persisted: false,
  persist_client_side: false,
  ballot_secrecy_certified: false,
  regulated_election_certified: false,
  result_certified: false,
});

const restrictedSurvey = (gateStatus: 'ready' | 'unavailable' = 'ready'): SurveyPublic => {
  const eligibility = eligibilityContract(gateStatus);
  return {
    slug: 'consulta-institucional',
    titulo: 'Consulta institucional',
    tipo: 'votacion',
    inicio_at: '2026-08-01T00:00:00Z',
    fin_at: '2026-08-31T00:00:00Z',
    politica_unicidad: 'libre',
    preguntas: [],
    frontend_contract: { eligibility },
    governance: {
      contract_version: 'surveys.public_governance.v1',
      mode: 'governed_release',
      release_required: true,
      accepting_responses: gateStatus === 'ready',
      eligibility,
      active_release: {
        contract_version: 'surveys.governance_release.v1',
        release_id: 51,
        survey_id: 42,
        version_number: 1,
        status: 'published',
        snapshot_sha256: 'a'.repeat(64),
        policy_sha256: 'b'.repeat(64),
        governance: {
          eligibility: {
            policy_version: 'eligibility-v1',
            mode: 'institution_attested',
            declarations: [],
            human_review_required: true,
            automated_decision: false,
          },
        },
      },
      latest_release: null,
      regulated_election_certified: false,
      result_certified: false,
    },
  };
};

describe('public survey eligibility contract parser', () => {
  it('binds an available restricted gate to the exact release, policy, and header', () => {
    const resolved = resolveSurveyPublicEligibility(restrictedSurvey());

    expect(resolved).toMatchObject({
      required: true,
      restricted: true,
      valid: true,
      available: true,
      releaseId: 51,
      policyVersion: 'eligibility-v1',
      headerName: SURVEY_ELIGIBILITY_CREDENTIAL_HEADER,
      expectation: {
        contractVersion: 'surveys.public_eligibility.v1',
        releaseId: 51,
        policyVersion: 'eligibility-v1',
        mode: 'institution_attested',
      },
    });
  });

  it('keeps attestation-only and legacy surveys credential-free', () => {
    const legacy = restrictedSurvey();
    delete legacy.frontend_contract;
    delete legacy.governance;

    expect(resolveSurveyPublicEligibility(legacy)).toMatchObject({
      required: false,
      restricted: false,
      valid: true,
      available: true,
      expectation: null,
    });
  });

  it('fails closed when the two public aliases disagree', () => {
    const survey = restrictedSurvey();
    if (survey.frontend_contract?.eligibility) {
      survey.frontend_contract.eligibility = {
        ...survey.frontend_contract.eligibility,
        policy_version: 'eligibility-v2',
      };
    }

    expect(resolveSurveyPublicEligibility(survey)).toMatchObject({
      required: true,
      valid: false,
      available: false,
      blockedReasonCode: 'survey_eligibility_contract_invalid',
    });
  });

  it('fails closed when a governed release omits every eligibility contract', () => {
    const survey = restrictedSurvey();
    delete survey.frontend_contract;
    if (survey.governance) {
      delete survey.governance.eligibility;
      const activeRelease = survey.governance.active_release;
      if (activeRelease?.governance) {
        delete activeRelease.governance.eligibility;
      }
    }

    expect(resolveSurveyPublicEligibility(survey)).toMatchObject({
      required: true,
      restricted: true,
      valid: false,
      available: false,
      blockedReasonCode: 'survey_eligibility_contract_invalid',
    });
  });

  it('recognizes an authoritative unavailable gate without weakening it to a checkbox', () => {
    expect(resolveSurveyPublicEligibility(restrictedSurvey('unavailable'))).toMatchObject({
      required: true,
      restricted: true,
      valid: true,
      available: false,
      blockedReasonCode: 'survey_eligibility_gate_unavailable',
      expectation: null,
    });
  });
});
