import { describe, expect, it } from 'vitest';
import { ApiError } from '@/utils/api';
import { addressActivationBlockingReason, readTenantAddresses, TenantAddressesContractError } from './tenantAddresses';
import { addressesPayload, addressesScope } from '@/test/fixtures/tenantAddresses';

const NOW = 1_800_000_000;
const pending = (patch: Record<string, unknown>) => addressesPayload({
  platform: { kind: 'platform', source: 'v2', host: 'institution-alpha.chatboc.ar', status: 'pending_platform', active: false,
    valid_until: null, dns_proof: null, scope_note: 'Synthetic scope', ...patch },
});
const guidance = {
  contract_version: 'organization.address_operator_guidance.v1',
  labels: { blocked_title: 'B', next_action: 'N', pending_until: 'P', expired_since: 'E', active_until: 'A' },
  messages: { pending_window: 'W', expired_action: 'X', active_expiry: 'Y' },
  blocking: { provider_routes_unavailable: { message: 'M', action: 'C' } },
};
const rejected = (body: Record<string, unknown>, status = 409) => new ApiError('synthetic', status, body);

describe('address guidance contract', () => {
  it('reads a request deadline, tolerates an older server and rejects a deadline on the wrong state', () => {
    expect(readTenantAddresses(pending({ pending_until: NOW + 60 }), addressesScope, NOW).platform.pending_until).toBe(NOW + 60);
    expect(readTenantAddresses(pending({ status: 'verification_expired', pending_until: NOW - 60 }), addressesScope, NOW).platform.pending_until).toBe(NOW - 60);
    expect(readTenantAddresses(pending({}), addressesScope, NOW).platform.pending_until).toBeNull();
    for (const patch of [{ pending_until: 'tomorrow' }, { pending_until: 1.5 },
      { status: 'active', active: true, valid_until: NOW + 60, pending_until: NOW + 60 }]) {
      expect(() => readTenantAddresses(pending(patch), addressesScope, NOW)).toThrow(TenantAddressesContractError);
    }
  });
  it('accepts only complete, safe guidance and otherwise leaves it out', () => {
    expect(readTenantAddresses(addressesPayload({ operator_guidance: guidance }), addressesScope, NOW).operator_guidance?.blocking)
      .toEqual({ provider_routes_unavailable: { message: 'M', action: 'C' } });
    for (const broken of [{ ...guidance, contract_version: 'v2' }, { ...guidance, labels: { ...guidance.labels, next_action: ' ' } },
      { ...guidance, blocking: { 'Not-A-Code': { message: 'M', action: 'C' } } },
      { ...guidance, blocking: { provider_routes_unavailable: { message: 'M\u0007', action: 'C' } } }]) {
      expect(readTenantAddresses(addressesPayload({ operator_guidance: broken }), addressesScope, NOW).operator_guidance).toBeUndefined();
    }
  });
  it('takes a blocking reason only from an explicit no-write verification rejection', () => {
    const base = { contract_version: 'organization.addresses_error.v2', reason_code: 'address_provider_verification_failed',
      retryable: false, writes_performed: false, blocking_reason: 'provider_routes_unavailable' };
    expect(addressActivationBlockingReason(rejected(base))).toBe('provider_routes_unavailable');
    expect(addressActivationBlockingReason(rejected({ ...base, writes_performed: undefined, requires_status_check: true }))).toBeNull();
    expect(addressActivationBlockingReason(rejected({ ...base, reason_code: 'address_plan_conflict' }))).toBeNull();
    expect(addressActivationBlockingReason(rejected({ ...base, blocking_reason: 'Has spaces' }))).toBeNull();
    expect(addressActivationBlockingReason(rejected(base, 503))).toBeNull();
    expect(addressActivationBlockingReason(new Error('x'))).toBeNull();
  });
});
