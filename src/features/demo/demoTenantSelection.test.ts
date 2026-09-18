import { describe, expect, it } from 'vitest';

import {
  normalizeRequestedDemoTenantSlug,
  resolveDemoTenantSlug,
} from './demoTenantSelection';

describe('demo tenant selection', () => {
  it('keeps an explicit valid tenant ahead of catalog fallbacks', () => {
    expect(resolveDemoTenantSlug(' Junin ', 'municipio')).toBe('junin');
  });

  it('falls back safely when the query tenant is absent or malformed', () => {
    expect(resolveDemoTenantSlug(null, 'municipio')).toBe('municipio');
    expect(resolveDemoTenantSlug('https://evil.example', 'municipio')).toBe('municipio');
    expect(resolveDemoTenantSlug('../junin', 'municipio')).toBe('municipio');
  });

  it('rejects tenant values that are not canonical slugs', () => {
    expect(normalizeRequestedDemoTenantSlug('-junin')).toBeNull();
    expect(normalizeRequestedDemoTenantSlug('junin/otra')).toBeNull();
    expect(normalizeRequestedDemoTenantSlug('')).toBeNull();
  });
});
