import { describe, expect, it } from 'vitest';

import { resolveSurveyAnalyticsFallbackEnabled } from './config';

describe('survey analytics fallback runtime gate', () => {
  it('fails closed in production even when browser or environment preference requests it', () => {
    expect(
      resolveSurveyAnalyticsFallbackEnabled({ isDev: false, isTest: false }, true),
    ).toBe(false);
  });

  it('allows an explicit preference only in development or tests', () => {
    expect(resolveSurveyAnalyticsFallbackEnabled({ isDev: true, isTest: false }, true)).toBe(true);
    expect(resolveSurveyAnalyticsFallbackEnabled({ isDev: false, isTest: true }, true)).toBe(true);
    expect(resolveSurveyAnalyticsFallbackEnabled({ isDev: true, isTest: false }, false)).toBe(false);
  });
});
