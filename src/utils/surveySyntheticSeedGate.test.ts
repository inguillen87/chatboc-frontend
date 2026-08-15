import { describe, expect, it } from 'vitest';

import { isSurveySyntheticSeedQaEnabled } from './surveySyntheticSeedGate';

describe('survey synthetic seed QA gate', () => {
  it('is fail-closed outside the explicit local development mode', () => {
    expect(isSurveySyntheticSeedQaEnabled('production')).toBe(false);
    expect(isSurveySyntheticSeedQaEnabled('preview')).toBe(false);
    expect(isSurveySyntheticSeedQaEnabled('test')).toBe(false);
  });

  it('allows the tool only in local development', () => {
    expect(isSurveySyntheticSeedQaEnabled('development')).toBe(true);
  });
});
