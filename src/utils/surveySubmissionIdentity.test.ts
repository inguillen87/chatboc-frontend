import { describe, expect, it } from 'vitest';

import {
  assertSurveySubmissionId,
  createSecureSurveySubmissionId,
  isSurveySubmissionId,
} from './surveySubmissionIdentity';

describe('survey submission identity', () => {
  it('creates an opaque UUID without accepting participant data as input', () => {
    const first = createSecureSurveySubmissionId();
    const second = createSecureSurveySubmissionId();

    expect(isSurveySubmissionId(first)).toBe(true);
    expect(isSurveySubmissionId(second)).toBe(true);
    expect(second).not.toBe(first);
  });

  it.each([
    undefined,
    '',
    '12345678',
    '5491112345678',
    'person@example.com',
    'survey:tenant:participant-name',
  ])('rejects a missing or identity-derived key: %s', (value) => {
    expect(() => assertSurveySubmissionId(value)).toThrow(/identificador opaco y seguro/i);
  });

  it('accepts canonical v4 and v7 UUIDs used by the response contract', () => {
    expect(assertSurveySubmissionId('018f4c8e-1e56-7f38-a4df-83fd6839487d')).toBe(
      '018f4c8e-1e56-7f38-a4df-83fd6839487d',
    );
    expect(assertSurveySubmissionId('b3ed1671-d47a-4f78-a6ae-7303677fd2fb')).toBe(
      'b3ed1671-d47a-4f78-a6ae-7303677fd2fb',
    );
  });
});
