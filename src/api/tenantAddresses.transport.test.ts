import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from '@/utils/api';
import { addressesPayload, addressesScope } from '@/test/fixtures/tenantAddresses';
import {
  addressSaveRequiresStatusCheck, getTenantAddresses, readTenantAddresses, saveTenantAddress,
  TenantAddressesContractError, TenantAddressesUnavailableError, tenantAddressesErrorMessage,
} from './tenantAddresses';

vi.mock('@/utils/api', async original => ({ ...await original<typeof import('@/utils/api')>(), apiFetch: vi.fn() }));
beforeEach(() => { vi.mocked(apiFetch).mockReset(); });

describe('address contract discovery and write certainty', () => {
  it('permits v1 fallback only for the missing-route shared error', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError('missing route', 404, {
      contract_version: 'shared.error.v1', reason_code: 'not_found',
    }));
    await expect(getTenantAddresses(addressesScope, () => true)).rejects.toBeInstanceOf(TenantAddressesUnavailableError);
  });

  it.each([
    [404, { contract_version: 'organization.addresses_error.v2', reason_code: 'address_not_found' }],
    [404, { reason_code: 'not_found' }],
    [404, null],
    [400, { contract_version: 'shared.error.v1', reason_code: 'not_found' }],
    [405, { contract_version: 'shared.error.v1', reason_code: 'not_found' }],
    [503, { contract_version: 'shared.error.v1', reason_code: 'not_found' }],
  ])('does not turn HTTP %s / %j into a legacy writer', async (status, body) => {
    const error = new ApiError('private diagnostic', status as number, body);
    vi.mocked(apiFetch).mockRejectedValue(error);
    await expect(getTenantAddresses(addressesScope, () => true)).rejects.toBe(error);
  });

  it('retires a stale response even if it would otherwise permit fallback', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new ApiError('missing route', 404, {
      contract_version: 'shared.error.v1', reason_code: 'not_found',
    }));
    await expect(getTenantAddresses(addressesScope, () => false)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('requires reconciliation unless a valid v2 error explicitly proves no write', () => {
    const known = { contract_version: 'organization.addresses_error.v2', reason_code: 'address_host_in_use', writes_performed: false };
    expect(addressSaveRequiresStatusCheck(new ApiError('conflict', 409, known))).toBe(false);
    for (const body of [
      { ...known, requires_status_check: true },
      { ...known, requires_status_check: 'false' },
      { ...known, reason_code: 'address_save_unconfirmed' },
      { ...known, reason_code: 'address_revision_conflict' },
      { ...known, writes_performed: undefined },
      { ...known, reason_code: undefined },
      { ...known, contract_version: 'shared.error.v1' },
    ]) expect(addressSaveRequiresStatusCheck(new ApiError('unconfirmed', 503, body))).toBe(true);
    expect(addressSaveRequiresStatusCheck(new Error('connection lost'))).toBe(true);
    expect(addressSaveRequiresStatusCheck(new TenantAddressesContractError())).toBe(true);
  });

  it('treats an invalid or foreign success acknowledgement as unconfirmed', async () => {
    const current = readTenantAddresses(addressesPayload(), addressesScope);
    vi.mocked(apiFetch).mockResolvedValue({ contract_version: 'organization.addresses_save.v2', saved: true,
      provider_changes_performed: false, addresses: addressesPayload({ tenant: { id: 18, slug: addressesScope.slug } }) });
    const error = await saveTenantAddress(addressesScope, current, 'platform', 'request', 'alpha', () => true).catch(value => value);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(error).toBeInstanceOf(TenantAddressesContractError);
    expect(addressSaveRequiresStatusCheck(error)).toBe(true);
  });

  it('uses the real owner reason codes without exposing raw diagnostics', () => {
    const error = (reason_code: string) => new ApiError('private diagnostic', 400, { reason_code });
    expect(tenantAddressesErrorMessage(error('address_full_required'))).toContain('Full');
    expect(tenantAddressesErrorMessage(error('address_host_in_use'))).toContain('ya está en uso');
    expect(tenantAddressesErrorMessage(error('address_dns_request_expired'))).toContain('venció');
    expect(tenantAddressesErrorMessage(error('address_new_code'))).not.toContain('private');
  });
});
