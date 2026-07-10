import { describe, expect, it } from 'vitest';

import { resolveOperationalTenantSlug } from '@/utils/tenantIdentity';

describe('resolveOperationalTenantSlug', () => {
  it('uses only operational tenant identity fields before storage fallback', () => {
    expect(
      resolveOperationalTenantSlug({
        user: {
          empresa: 'Municipalidad de Junin',
          nombre_empresa: 'Gobierno local',
        },
        perfil: {
          municipio: 'Junin',
          endpoint: 'municipalidad-de-junin',
        },
        storedTenantSlug: 'junin',
      }),
    ).toBe('junin');
  });

  it('prefers authenticated tenant slug over stale storage and display names', () => {
    expect(
      resolveOperationalTenantSlug({
        user: {
          tenant_slug: 'juni',
          empresa: 'Municipalidad de Junin',
        },
        perfil: {
          slug: 'municipalidad-de-junin',
        },
        storedTenantSlug: 'stale-tenant',
      }),
    ).toBe('juni');
  });

  it('rejects reserved route words as tenant slugs', () => {
    expect(
      resolveOperationalTenantSlug({
        user: { tenant_slug: 'tickets' },
        perfil: { slug: 'perfil' },
        storedTenantSlug: 'junin',
      }),
    ).toBe('junin');
  });
});
