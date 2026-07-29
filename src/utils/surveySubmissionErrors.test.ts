import { describe, expect, it } from 'vitest';

import { ApiError, NetworkError } from '@/utils/api';
import {
  AmbiguousSurveySubmissionError,
  getSurveySubmissionReasonCode,
  isSurveyResponseDuplicateError,
  isSurveySubmissionIdConflictError,
  shouldReuseSurveySubmissionAttempt,
} from './surveySubmissionErrors';

describe('survey submission error semantics', () => {
  it('recognizes only the explicit uniqueness reason as a duplicate', () => {
    const duplicate = new ApiError('Duplicate', 409, { reason_code: 'survey_response_duplicate' });
    const conflict = new ApiError('Conflict', 409, { reason_code: 'survey_submission_id_conflict' });
    const stale = new ApiError('Stale instrument', 409, { reason_code: 'survey_instrument_revision_conflict' });

    expect(isSurveyResponseDuplicateError(duplicate)).toBe(true);
    expect(isSurveyResponseDuplicateError(conflict)).toBe(false);
    expect(isSurveyResponseDuplicateError(stale)).toBe(false);
    expect(isSurveySubmissionIdConflictError(conflict)).toBe(true);
  });

  it('reads normalized direct and nested reason codes', () => {
    expect(getSurveySubmissionReasonCode(new ApiError('Conflict', 409, {
      error: { reasonCode: ' SURVEY_SUBMISSION_ID_CONFLICT ' },
    }))).toBe('survey_submission_id_conflict');
  });

  it('reuses an attempt for every unchanged retry except terminal identity outcomes', () => {
    expect(shouldReuseSurveySubmissionAttempt(new NetworkError('offline'))).toBe(true);
    expect(shouldReuseSurveySubmissionAttempt(new ApiError('Unavailable', 503))).toBe(true);
    expect(shouldReuseSurveySubmissionAttempt(new AmbiguousSurveySubmissionError('Incomplete ack'))).toBe(true);
    expect(shouldReuseSurveySubmissionAttempt(new ApiError('Rate limited', 429))).toBe(true);
    expect(shouldReuseSurveySubmissionAttempt(new ApiError('Invalid', 400))).toBe(true);
    expect(shouldReuseSurveySubmissionAttempt(new Error('Invalid ack'))).toBe(true);
    expect(shouldReuseSurveySubmissionAttempt(new ApiError('Conflict', 409, {
      reason_code: 'survey_submission_id_conflict',
    }))).toBe(false);
    expect(shouldReuseSurveySubmissionAttempt(new ApiError('Duplicate', 409, {
      reason_code: 'survey_response_duplicate',
    }))).toBe(false);
  });
});
