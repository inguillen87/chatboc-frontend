import { describe, expect, it } from 'vitest';
import type { SurveyAdmin } from '@/types/encuestas';
import { surveyCanShare, surveyIsReceiving } from './surveyPublicationLifecycle';

const record = (overrides: Partial<SurveyAdmin> = {}): SurveyAdmin => ({
  estado: 'publicada',
  admin_lifecycle: { capabilities: { can_share: true }, accepts_responses: true },
  ...overrides,
} as SurveyAdmin);

describe('effective public survey availability', () => {
  it('does not infer public access from the stored published state', () => {
    expect(surveyCanShare(record({ admin_lifecycle: undefined }))).toBe(false);
  });
  it('requires public access despite contradictory lifecycle flags', () => {
    const item = record({ public_access: { contract_version: 'surveys.public_access.v1', allowed: false, reason_code: 'scope_unverified', next_action: 'review_scope' } });
    expect(surveyCanShare(item)).toBe(false);
    expect(surveyIsReceiving(item)).toBe(false);
  });
  it('honors authorized public availability independently of readiness to publish a new release', () => {
    const item = record();
    item.admin_lifecycle!.government_survey_evidence_gate = { contract_version: 'surveys.government_evidence_gate.v1', required: true, ready: false, reason_code: 'scope_unverified', next_action: 'review_scope' };
    expect(surveyIsReceiving(item)).toBe(true);
  });
  it('distinguishes sharing from receiving responses', () => {
    const item = record();
    item.admin_lifecycle!.accepts_responses = false;
    expect(surveyCanShare(item)).toBe(true);
    expect(surveyIsReceiving(item)).toBe(false);
  });
});
