import { describe, expect, it } from 'vitest';
import {
  TenantAddressesContractError, addressUnavailableReason, normalizeAddressDraft, readTenantAddresses,
} from './tenantAddresses';
import { addressesPayload, addressesScope } from '@/test/fixtures/tenantAddresses';

const NOW = 1_800_000_000;
const read = (patch: Record<string, unknown> = {}) => readTenantAddresses(addressesPayload(patch), addressesScope, NOW);

describe('organization.addresses.v2 reader', () => {
  it('accepts the unconfigured descriptor exactly as published', () => {
    const addresses = read();
    expect(addresses.base).toEqual({ url: 'https://chatboc.ar/t/institution-alpha', available: true });
    expect(addresses.platform.status).toBe('unconfigured');
    expect(addresses.capabilities.custom.can_request).toBe(true);
  });

  it('rejects a descriptor for another organization', () => {
    expect(() => read({ tenant: { id: 18, slug: 'institution-alpha' } })).toThrow(TenantAddressesContractError);
    expect(() => read({ save_endpoint: '/api/admin/tenants/other/addresses' })).toThrow(TenantAddressesContractError);
  });

  it('never treats an address as active without the active status and a current validity', () => {
    const slot = { kind: 'platform', source: 'v2', host: 'alpha.chatboc.ar', dns_proof: null, allowed_aliases: [], scope_note: 'Nota' };
    expect(() => read({ platform: { ...slot, status: 'pending_platform', active: true, valid_until: NOW + 60 } })).toThrow(TenantAddressesContractError);
    expect(() => read({ platform: { ...slot, status: 'active', active: true, valid_until: NOW - 1 } })).toThrow(TenantAddressesContractError);
    expect(read({ platform: { ...slot, status: 'active', active: true, valid_until: NOW + 60 } }).platform.active).toBe(true);
  });

  it('rejects a TXT challenge on the platform subdomain', () => {
    const proof = { type: 'TXT', name: '_chatboc-verify.alpha.chatboc.ar', value: `chatboc-domain-verification=${'b'.repeat(64)}`, expires_at: NOW + 60 };
    expect(() => read({ platform: { kind: 'platform', source: 'v2', host: 'alpha.chatboc.ar', status: 'pending_platform',
      active: false, valid_until: null, dns_proof: proof, allowed_aliases: [], scope_note: 'Nota' } })).toThrow(TenantAddressesContractError);
  });

  it('rejects provider changes claimed by a read', () => {
    expect(() => read({ provider_changes_performed: true })).toThrow(TenantAddressesContractError);
  });
});

describe('address drafts', () => {
  it('builds the exact platform host from a label', () => {
    expect(normalizeAddressDraft('platform', ' TDF ')).toBe('tdf.chatboc.ar');
    expect(normalizeAddressDraft('platform', 'junin.chatboc.ar')).toBe('junin.chatboc.ar');
  });

  it('refuses labels outside the published rule', () => {
    for (const draft of ['ab', '-tdf', 'tdf-', 'a.b', 'tierra del fuego', 'x'.repeat(41)]) {
      expect(normalizeAddressDraft('platform', draft), draft).toBeNull();
    }
  });

  it('refuses platform hosts as custom domains', () => {
    expect(normalizeAddressDraft('custom', 'atencion.example.test')).toBe('atencion.example.test');
    expect(normalizeAddressDraft('custom', 'tdf.chatboc.ar')).toBeNull();
    expect(normalizeAddressDraft('custom', 'https://example.test/x')).toBeNull();
  });
});

describe('unavailable reasons', () => {
  it('does not invent a reason for an unknown code', () => {
    const base = { eligible: false, can_request: false, can_verify_dns: false, can_revoke: false };
    expect(addressUnavailableReason({ ...base, reason_code: 'something_new' })).toBe('Esta dirección no está disponible para la organización por ahora.');
    expect(addressUnavailableReason({ ...base, reason_code: 'full_plan_required' })).toBe('El dominio propio requiere el plan Full.');
  });
});
