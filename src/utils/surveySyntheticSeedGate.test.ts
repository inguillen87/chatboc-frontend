import { describe, expect, it } from 'vitest';

import { isSurveySyntheticSeedQaEnabled } from './surveySyntheticSeedGate';

describe('survey synthetic seed QA gate', () => {
  it('is fail-closed without the feature flag, durable tenant id, and allowlist', () => {
    expect(isSurveySyntheticSeedQaEnabled({ mode: 'production', tenantId: 22, allowedTenantIds: '22' })).toBe(false);
    expect(isSurveySyntheticSeedQaEnabled({ mode: 'production', explicitFlag: 'true', allowedTenantIds: '22' })).toBe(false);
    expect(isSurveySyntheticSeedQaEnabled({ mode: 'production', explicitFlag: 'true', tenantId: 22 })).toBe(false);
  });

  it('requires the authoritative tenant id even in local development', () => {
    expect(isSurveySyntheticSeedQaEnabled({ mode: 'development', tenantId: 22, allowedTenantIds: '22' })).toBe(true);
    expect(isSurveySyntheticSeedQaEnabled({ mode: 'development', tenantId: 23, allowedTenantIds: '22' })).toBe(false);
  });

  it('allows only explicitly listed production canary tenants', () => {
    expect(isSurveySyntheticSeedQaEnabled({
      mode: 'production',
      explicitFlag: ' TRUE ',
      allowedTenantIds: '7, 22,invalid',
      tenantId: 22,
    })).toBe(true);
    expect(isSurveySyntheticSeedQaEnabled({
      mode: 'production',
      explicitFlag: 'true',
      allowedTenantIds: '22',
      tenantId: '23',
    })).toBe(false);
  });

  it('rejects ambiguous or unsafe tenant identifiers', () => {
    expect(isSurveySyntheticSeedQaEnabled({ mode: 'development', tenantId: '22x', allowedTenantIds: '22' })).toBe(false);
    expect(isSurveySyntheticSeedQaEnabled({ mode: 'development', tenantId: 0, allowedTenantIds: '0,22' })).toBe(false);
    expect(isSurveySyntheticSeedQaEnabled({ mode: 'development', tenantId: 22.5, allowedTenantIds: '22' })).toBe(false);
  });
});
