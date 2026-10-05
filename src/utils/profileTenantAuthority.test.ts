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

  it('preserves valid backend separators with its existing case-insensitive resolution', () => {
    expect(normalizeProfileTenantSlug('organismo_norte')).toBe('organismo_norte');
    expect(normalizeProfileTenantSlug('Organismo_Norte')).toBe('organismo_norte');
    expect(normalizeProfileTenantSlug('organismo__norte_')).toBe('organismo__norte_');
    expect(normalizeProfileTenantSlug('organismo-')).toBe('organismo-');
    expect(normalizeProfileTenantSlug(' organismo_norte ')).toBe('organismo_norte');
    const activation = { contract_version: 'tenant.channel_activation.v1', tenant: { slug: 'organismo_norte' } } as const;
    expect(activationAuthorizesTenant(activation, 'organismo_norte')).toBe(true);
    expect(activationAuthorizesTenant(activation, 'organismo-norte')).toBe(false);
    expect(activationAuthorizesTenant(activation, 'Organismo_Norte')).toBe(true);
  });

  it.each(['tdf/otro', 'tdf.otro', 'tdf%2Fotro', 'tdf\\otro', 'tierra del fuego', '-tdf', 'a'.repeat(81), '', 'localhost', 'default', 'municipio'])
    ('rejects invalid or placeholder identity instead of coercing it: %s', value => {
      expect(normalizeProfileTenantSlug(value)).toBeNull();
    });

  it('does not reinterpret a numeric id as a slug', () => {
    expect(normalizeProfileTenantSlug(46)).toBeNull();
    expect(normalizeProfileTenantSlug('46')).toBe('46');
  });

  it.each([
    'tenant=tdf&tenant=junin', 'tenant_slug=tdf&tenant_slug=junin',
    'tenant=tdf&tenant_slug=tdf&tenant_slug=junin', 'tenant=tdf&tenant=',
    'tenant=organismo_norte&tenant_slug=organismo-norte',
    'tenant_slug=tdf%2Fotro',
  ])('rejects all conflicting aliases and repetitions: %s', query => {
    expect(readExplicitTenantRequest(new URLSearchParams(query))).toEqual({ present: true, valid: false, slug: null });
  });

  it('accepts repeated exact identity and preserves the underscore query', () => {
    expect(readExplicitTenantRequest(new URLSearchParams('tenant=organismo_norte&tenant=organismo_norte&tenant_slug=organismo_norte')))
      .toEqual({ present: true, valid: true, slug: 'organismo_norte' });
    expect(readExplicitTenantRequest(new URLSearchParams('channel=whatsapp')))
      .toEqual({ present: false, valid: true, slug: null });
    expect(readExplicitTenantRequest(new URLSearchParams('tenant=Organismo_Norte&tenant_slug=organismo_norte')))
      .toEqual({ present: true, valid: true, slug: 'organismo_norte' });
  });
});
