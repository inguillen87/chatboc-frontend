import { describe, expect, it } from 'vitest';
import { toCanonicalTenantPath } from '@/utils/canonicalTenantRouting';

describe('toCanonicalTenantPath', () => {
  it('normalizes legacy market prefix to canonical /t', () => {
    expect(toCanonicalTenantPath('/market/junin/portal/dashboard')).toBe('/t/junin/portal/dashboard');
  });

  it('normalizes municipio and preserves deep-link path segments', () => {
    expect(toCanonicalTenantPath('/municipio/quilmes/encuestas/abc')).toBe('/t/quilmes/encuestas/abc');
  });

  it('returns null for already canonical routes', () => {
    expect(toCanonicalTenantPath('/t/junin/portal/dashboard')).toBeNull();
  });

  it('returns null for non-tenant or placeholder slug paths', () => {
    expect(toCanonicalTenantPath('/market/login')).toBeNull();
    expect(toCanonicalTenantPath('/integracion')).toBeNull();
    expect(toCanonicalTenantPath('/pyme/metrics')).toBeNull();
    expect(toCanonicalTenantPath('/pyme/catalog')).toBeNull();
    expect(toCanonicalTenantPath('/market/blueprint')).toBeNull();
  });

  it('returns null for malformed url-encoded tenant segments', () => {
    expect(toCanonicalTenantPath('/market/%/portal')).toBeNull();
  });
});
