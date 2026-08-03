export type SurveyRestrictedEligibilityMode = 'institution_attested' | 'manual_review';

export interface SurveyEligibilityReleaseScope {
  tenantId: number;
  surveyId: number;
  releaseId: number;
  versionNumber: number;
  status: 'published';
  policyVersion: string;
  mode: SurveyRestrictedEligibilityMode;
  active: boolean;
  planAllowsWrite: boolean;
}

export interface SurveyEligibilitySummary {
  contractVersion: 'surveys.eligibility_aggregate.v1';
  surveyId: number;
  releaseId: number;
  policyVersion: string;
  counts: {
    issued: number;
    active: number;
    expired: number;
    revoked: number;
    redeemed: number;
  };
  eligiblePopulation: null;
  participationRate: null;
  abstentions: null;
  denominatorStatus: {
    available: false;
    reasonCode: 'survey_eligible_population_not_sealed';
  };
}

export interface SurveyEligibilityIssuePayload {
  subjectRef: string;
  reviewReference: string;
  expiresAt?: string;
}

export interface SurveyEligibilityIssueReceipt {
  contractVersion: 'surveys.eligibility_grant.v1';
  tenantId: number;
  surveyId: number;
  releaseId: number;
  grantRef: string;
  state: 'active' | 'expired' | 'revoked' | 'redeemed';
  generation: number;
  mode: SurveyRestrictedEligibilityMode;
  policyVersion: string;
  expiresAt: string;
  credentialHeader: 'X-Survey-Eligibility-Credential';
  /** Sensitive runtime-only value. Never put this object in a cache or persistent store. */
  credential: string | null;
  replayed: boolean;
}

export type SurveyEligibilityRevocationReason =
  | 'administrative_revocation'
  | 'subject_ineligible'
  | 'credential_compromised'
  | 'duplicate_issue'
  | 'other_reviewed';

export interface SurveyEligibilityRevocationReceipt {
  contractVersion: 'surveys.eligibility_grant.v1';
  tenantId: number;
  surveyId: number;
  releaseId: number;
  grantRef: string;
  state: 'revoked';
  reasonCode: SurveyEligibilityRevocationReason;
  policyVersion: string;
  replayed: boolean;
}
