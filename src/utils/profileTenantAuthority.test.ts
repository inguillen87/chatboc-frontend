import { describe, expect, it } from 'vitest';

import {
  activationAuthorizesTenant,
  getActivationPlan,
  normalizeProfileTenantSlug,
  readExplicitTenantRequest,
} from '@/utils/profileTenantAuthority';

describe('profile tenant authority', () => {
  it('accepts a matching explicit tenant pair and rejects conflicting or generic values', () => {
    expect(
      readExplicitTenantRequest(new URLSearchParams('tenant_slug=junin&tenant=junin')),
    ).toEqual({ present: true, valid: true, slug: 'junin' });

    expect(
      readExplicitTenantRequest(new URLSearchParams('tenant_slug=junin&tenant=mendoza')),
    ).toEqual({ present: true, valid: false, slug: null });

    expect(readExplicitTenantRequest(new URLSearchParams('tenant=municipio'))).toEqual({
      present: true,
      valid: false,
      slug: null,
    });
    expect(normalizeProfileTenantSlug(' MUNICIPIO ')).toBeNull();
  });

  it('trusts only a matching backend activation contract and derives its plan', () => {
    const activation = {
      contract_version: 'tenant.channel_activation.v1',
      tenant: { slug: 'junin', plan: 'full' },
      integration_access: { current_plan: 'free' },
    } as const;

    expect(activationAuthorizesTenant(activation, 'junin')).toBe(true);
    expect(activationAuthorizesTenant(activation, 'mendoza')).toBe(false);
    expect(getActivationPlan(activation)).toBe('full');
  });
});
