import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/utils/api', async importOriginal => ({ ...await importOriginal<typeof import('@/utils/api')>(), apiFetch: mocks.fetch }));
import { ApiError } from '@/utils/api';
import { createRehearsal, getRehearsal, getRehearsalAccountStatus, getRehearsalCreationStatus, getRehearsalResponseStatus, listRehearsals, readRehearsal, readRehearsalList, readRehearsalResponse, respondToRehearsal } from './surveyRehearsals';
import { rehearsal as data, rehearsalList as list, rehearsalResponse as response, rehearsalAccount as account, rehearsalKey as key, rehearsalRun as run, rehearsalTenant as tenant } from '../../tests/fixtures/survey-rehearsal.synthetic';
beforeEach(() => mocks.fetch.mockReset());
describe('production rehearsal real bound transport', () => {
  it('reads metadata/results as public without inherited bearer or widget scope', async () => {
    mocks.fetch.mockResolvedValue(data()); const current = vi.fn(() => true); await getRehearsal(tenant, run, current); await getRehearsal(tenant, run, current, true);
    expect(mocks.fetch.mock.calls.map(call => call[0])).toEqual([data().links.metadata_api, data().links.results_api]);
    expect(mocks.fetch.mock.calls[0][1]).toMatchObject({ omitCredentials: true, omitTenant: true, omitEntityToken: true, singleAttempt: true, isCurrent: current });
  });
  it.each(['tenant', 'branding', 'run', 'official', 'certified', 'anonymous', 'seeded', 'mismatched count', 'foreign URL', 'question options', 'socket claim'] as const)('rejects %s metadata', kind => {
    const raw = data(); if (kind === 'tenant') raw.tenant_slug = 'foreign'; if (kind === 'branding') raw.branding.tenant_slug = 'foreign'; if (kind === 'run') raw.run_id = 'rehearsal_' + '9'.repeat(32);
    if (kind === 'official') Object.assign(raw, { official: true }); if (kind === 'certified') Object.assign(raw, { unique_person_certified: true }); if (kind === 'anonymous') Object.assign(raw, { authentication_required: false }); if (kind === 'seeded') Object.assign(raw, { seeded_responses: 1 });
    if (kind === 'mismatched count') raw.metrics.total_responses = 1; if (kind === 'foreign URL') raw.links.respond_api = 'https://foreign.invalid'; if (kind === 'question options') raw.question.options[1] = raw.question.options[0]; if (kind === 'socket claim') Object.assign(raw.refresh, { socket_delivery_proven: true });
    expect(() => readRehearsal(raw, tenant, run)).toThrow();
  });
  it('reads a scoped admin descriptor and creates once with matching key', async () => {
    mocks.fetch.mockResolvedValueOnce(list()); const current = vi.fn(() => true); await listRehearsals(tenant, current);
    expect(mocks.fetch).toHaveBeenCalledWith(`/api/v2/tenants/${tenant}/survey-rehearsals`, expect.objectContaining({ tenantSlug: tenant, singleAttempt: true, isCurrent: current }));
    mocks.fetch.mockReset().mockResolvedValueOnce({ ...data(), submission_id: key, replayed: false }); await createRehearsal(list(), key, current);
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith(`/api/v2/tenants/${tenant}/survey-rehearsals`, expect.objectContaining({ method: 'POST', body: {}, singleAttempt: true, allowStartupRecovery: false, headers: { 'Idempotency-Key': key } }));
  });
  it('refuses a foreign admin descriptor and a backend-denied create before any POST', async () => {
    expect(() => readRehearsalList({ ...list(), source_tenant: { ...list().source_tenant, slug: 'foreign' } }, tenant)).toThrow();
    const blocked = list(); blocked.create_action.can_create = false; blocked.create_action.blocked_reason_code = 'strict_mfa_required';
    await expect(createRehearsal(blocked, key, () => true)).rejects.toThrow(); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('sends one normal bearer response with the same key in header and body', async () => {
    mocks.fetch.mockResolvedValueOnce(response()); const current = vi.fn(() => true); await respondToRehearsal(data(), key, 'yes', current);
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith(data().links.respond_api, expect.objectContaining({ method: 'POST', tenantSlug: tenant, omitCredentials: false, omitEntityToken: true, singleAttempt: true, allowStartupRecovery: false,
      headers: { 'Idempotency-Key': key }, body: { submission_id: key, option_id: 'yes' }, isCurrent: current }));
  });
  it.each([409, 503])('does not retry a POST HTTP %s', async status => { mocks.fetch.mockRejectedValueOnce(new ApiError('synthetic', status)); await expect(respondToRehearsal(data(), key, 'yes', () => true)).rejects.toThrow(); expect(mocks.fetch).toHaveBeenCalledOnce(); });
  it.each(['key', 'option', 'account', 'instrument', 'tenant', 'official', 'run'] as const)('refuses a foreign %s receipt', kind => {
    const raw = response(); if (kind === 'key') raw.receipt.submission_id = 'foreign'; if (kind === 'option') raw.receipt.option_id = 'no'; if (kind === 'account') Object.assign(raw.receipt, { verified_current_account: false });
    if (kind === 'instrument') raw.receipt.instrument_sha256 = 'd'.repeat(64); if (kind === 'tenant') raw.receipt.tenant_slug = 'foreign'; if (kind === 'official') Object.assign(raw, { official: true }); if (kind === 'run') raw.receipt.run_id = 'foreign';
    expect(() => readRehearsalResponse(raw, data(), key, 'yes')).toThrow();
  });
  it('resolves uncertainty with GET for the same intention, never by total counts', async () => {
    mocks.fetch.mockResolvedValueOnce(response()); await getRehearsalResponseStatus(data(), key, 'yes', () => true); expect(mocks.fetch.mock.calls[0][0]).toBe(data().links.respond_api + `/status?submission_id=${key}`);
    mocks.fetch.mockReset().mockResolvedValueOnce({ ...data(), submission_id: key, replayed: true }); await getRehearsalCreationStatus(tenant, key, () => true); expect(mocks.fetch.mock.calls[0][0]).toBe(`/api/v2/tenants/${tenant}/survey-rehearsals/status?submission_id=${key}`);
  });
  it('reads current-account participation from the server without a browser identifier', async () => {
    mocks.fetch.mockResolvedValueOnce(account(true)); await expect(getRehearsalAccountStatus(data(), () => true)).resolves.toEqual(account(true));
    expect(mocks.fetch.mock.calls[0][0]).toBe(data().links.respond_api + '/status'); expect(mocks.fetch.mock.calls[0][1]).toMatchObject({ omitCredentials: false, tenantSlug: tenant, singleAttempt: true });
  });
  it('rejects a foreign current-account response instead of enabling the form', async () => {
    mocks.fetch.mockResolvedValueOnce({ ...account(), tenant_slug: 'foreign' }); await expect(getRehearsalAccountStatus(data(), () => true)).rejects.toThrow();
  });
  it('rejects a created run bound to another intent', async () => {
    mocks.fetch.mockResolvedValueOnce({ ...data(), submission_id: '87654321-4321-4567-89ab-123456789abc', replayed: false });
    await expect(createRehearsal(list(), key, () => true)).rejects.toThrow(); expect(mocks.fetch).toHaveBeenCalledOnce();
  });
});
