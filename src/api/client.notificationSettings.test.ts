import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) { super(message); }
  },
}));
import { apiClient } from './client';
import { ApiError } from '@/utils/api';

// Synthetic DTOs exercise the real endpoint adapter; they do not certify
// authenticated tenant access, persistence, dispatch or owner acceptance.
const canonical = (overrides: Record<string, unknown> = {}) => ({
  contract_version: 'notifications.hooks.v1', tenant: { id: 701, slug: 'qa-office' },
  preferences: { email: true, telegram: false, whatsapp: false }, triggers: [],
  delivery: { owner_phone: 'synthetic-phone', telegram_chat_id: 'synthetic-chat' }, ...overrides,
});
const draft = () => ({ owner_phone: 'synthetic-phone', telegram_chat_id: 'synthetic-chat',
  notification_settings: { email: false, telegram: true, whatsapp: false, digest: { enabled: true, hour: 8 } } });
beforeEach(() => { apiFetchMock.mockReset(); });

describe('tenant notification endpoint contract', () => {
  it.each(['GET', 'POST'])('does not dispatch a %s under explicitly retired caller authority', async method => {
    const authority = { isCurrent: () => false, expectedTenantId: 701 };
    const request = method === 'GET' ? apiClient.adminGetNotificationSettings('qa-office', authority)
      : apiClient.adminUpdateNotificationSettings('qa-office', draft(), undefined, authority);
    await expect(request).rejects.toMatchObject({ name: 'AbortError' }); expect(apiFetchMock).not.toHaveBeenCalled();
  });
  it.each([404, 405, 501])('retires the legacy GET fallback after delayed unsupported HTTP%s', async status => {
    let current = true; apiFetchMock.mockImplementation(async () => { current = false; throw new ApiError('synthetic unsupported', status); });
    await expect(apiClient.adminGetNotificationSettings('qa-office', { isCurrent: () => current })).rejects.toMatchObject({ name: 'AbortError' });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([404, 405, 501])('retires the legacy PUT fallback after delayed unsupported HTTP%s', async status => {
    let current = true; apiFetchMock.mockImplementation(async () => { current = false; throw new ApiError('synthetic unsupported', status); });
    await expect(apiClient.adminUpdateNotificationSettings('qa-office', draft(), undefined, { isCurrent: () => current })).rejects.toMatchObject({ name: 'AbortError' });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
  it('forwards the caller current guard to canonical and explicit legacy reads and writes', async () => {
    const isCurrent = () => true;
    apiFetchMock.mockRejectedValueOnce(new ApiError('synthetic unsupported', 404)).mockResolvedValueOnce(draft());
    await apiClient.adminGetNotificationSettings('qa-office', { isCurrent, expectedTenantId: 701 });
    apiFetchMock.mockRejectedValueOnce(new ApiError('synthetic unsupported', 405)).mockResolvedValueOnce({ status: 'ok' });
    await apiClient.adminUpdateNotificationSettings('qa-office', draft(), undefined, { isCurrent, expectedTenantId: 701 });
    expect(apiFetchMock).toHaveBeenCalledTimes(4);
    for (const [, options] of apiFetchMock.mock.calls) expect(options.isCurrent).toBe(isCurrent);
  });
  it.each(['GET', 'POST'])('rejects a canonical %s with the right slug and a mismatched expected tenant ID', async method => {
    apiFetchMock.mockResolvedValue(canonical({ preferences: draft().notification_settings }));
    const authority = { isCurrent: () => true, expectedTenantId: 702 };
    const request = method === 'GET' ? apiClient.adminGetNotificationSettings('qa-office', authority)
      : apiClient.adminUpdateNotificationSettings('qa-office', draft(), undefined, authority);
    await expect(request).rejects.toMatchObject({ status: 502 }); expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
  it('accepts the independently supplied canonical tenant ID on reads and acknowledgements', async () => {
    apiFetchMock.mockResolvedValue(canonical({ preferences: draft().notification_settings }));
    const authority = { isCurrent: () => true, expectedTenantId: 701 };
    await expect(apiClient.adminGetNotificationSettings('qa-office', authority)).resolves.toMatchObject(draft());
    await expect(apiClient.adminUpdateNotificationSettings('qa-office', draft(), undefined, authority)).resolves.toMatchObject(draft());
  });
  it('reads canonical destinations and retains preferences absent from the switches', async () => {
    apiFetchMock.mockResolvedValue(canonical({ preferences: draft().notification_settings }));
    expect(await apiClient.adminGetNotificationSettings('qa-office')).toMatchObject(draft());
  });
  it('accepts a valid initial empty canonical DTO', async () => {
    apiFetchMock.mockResolvedValue(canonical({ preferences: {}, delivery: {} }));
    expect(await apiClient.adminGetNotificationSettings('qa-office')).toMatchObject({
      owner_phone: null, telegram_chat_id: null, notification_settings: {},
    });
  });
  it.each([
    { error: 'synthetic server error' }, true, [],
    canonical({ contract_version: 'notifications.hooks.v2' }),
    canonical({ tenant: { id: 701, slug: 'another-office' } }),
    canonical({ tenant: { id: '701', slug: 'qa-office' } }),
    canonical({ tenant: { id: 0, slug: 'qa-office' } }), canonical({ tenant: null }),
    canonical({ preferences: [] }), canonical({ preferences: { email: 'false' } }),
    canonical({ preferences: null }), canonical({ preferences: { telegram: null } }),
    canonical({ delivery: [] }), canonical({ delivery: null }),
    canonical({ delivery: { owner_phone: 123 } }),
  ])('rejects malformed HTTP 200 GET without legacy fallback: %j', async value => {
    apiFetchMock.mockResolvedValue(value);
    await expect(apiClient.adminGetNotificationSettings('qa-office')).rejects.toThrow();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
  it('sends explicit canonical destinations and only editable preferences, without legacy aliases', async () => {
    apiFetchMock.mockResolvedValue(canonical({ preferences: draft().notification_settings }));
    await apiClient.adminUpdateNotificationSettings('qa-office', draft());
    expect(apiFetchMock).toHaveBeenCalledWith('/api/v2/notifications/hooks', expect.objectContaining({
      method: 'POST', tenantSlug: 'qa-office', singleAttempt: true,
      body: { preferences: { email: false, telegram: true, whatsapp: false },
        delivery: { owner_phone: 'synthetic-phone', telegram_chat_id: 'synthetic-chat' } },
    }));
  });
  it.each([{ error: 'uncertain' }, {}, 'ok', canonical({ tenant: { id: 702, slug: 'qa-other' } })])(
    'rejects an invalid POST acknowledgement without repeating the write: %j', async value => {
      apiFetchMock.mockResolvedValue(value);
      await expect(apiClient.adminUpdateNotificationSettings('qa-office', draft())).rejects.toThrow();
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it('uses explicit legacy GET and status:ok PUT only after an unsupported HTTP response', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('unsupported', 404)).mockResolvedValueOnce(draft());
    expect(await apiClient.adminGetNotificationSettings('qa-office')).toMatchObject(draft());
    apiFetchMock.mockRejectedValueOnce(new ApiError('unsupported', 405)).mockResolvedValueOnce({ status: 'ok' });
    await expect(apiClient.adminUpdateNotificationSettings('qa-office', draft())).resolves.toMatchObject({ status: 'ok' });
    expect(apiFetchMock).toHaveBeenLastCalledWith('/api/admin/tenants/qa-office/notifications',
      expect.objectContaining({ method: 'PUT', body: draft(), singleAttempt: true }));
  });
  it('preserves canonical null destinations and false preferences during a write', async () => {
    apiFetchMock.mockResolvedValue(canonical({ preferences: { email: false }, delivery: { owner_phone: null, telegram_chat_id: null } }));
    const snapshot = await apiClient.adminGetNotificationSettings('qa-office');
    await apiClient.adminUpdateNotificationSettings('qa-office', snapshot);
    expect(apiFetchMock).toHaveBeenLastCalledWith('/api/v2/notifications/hooks', expect.objectContaining({
      body: { preferences: { email: false }, delivery: { owner_phone: null, telegram_chat_id: null } },
    }));
  });
  it('validates a legal empty legacy GET and an explicit status:ok PUT after HTTP501', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('unsupported', 501)).mockResolvedValueOnce({
      owner_phone: null, telegram_chat_id: null, notification_settings: {},
    });
    const snapshot = await apiClient.adminGetNotificationSettings('qa-office');
    expect(snapshot).toEqual({ owner_phone: null, telegram_chat_id: null, notification_settings: {} });
    apiFetchMock.mockRejectedValueOnce(new ApiError('unsupported', 501)).mockResolvedValueOnce({ status: 'ok' });
    await expect(apiClient.adminUpdateNotificationSettings('qa-office', snapshot)).resolves.toEqual({ status: 'ok' });
  });
  it.each([{}, true, { status: 'error' }, { status: 'ok', error: 'synthetic secret' }])(
    'rejects a malformed legacy PUT acknowledgement without another write: %j', async value => {
      apiFetchMock.mockRejectedValueOnce(new ApiError('unsupported', 404)).mockResolvedValueOnce(value);
      await expect(apiClient.adminUpdateNotificationSettings('qa-office', draft())).rejects.toThrow();
      expect(apiFetchMock).toHaveBeenCalledTimes(2);
    },
  );
  it('rejects a legacy status-only GET instead of enabling an empty draft', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('unsupported', 404)).mockResolvedValueOnce({ status: 'ok' });
    await expect(apiClient.adminGetNotificationSettings('qa-office')).rejects.toThrow();
    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });
  it.each([400, 401, 403, 409, 422, 500, 502])('does not fall back after a definite HTTP%s error', async status => {
    apiFetchMock.mockRejectedValue(new ApiError('synthetic rejected request', status));
    await expect(apiClient.adminUpdateNotificationSettings('qa-office', draft())).rejects.toThrow();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not dispatch invalid channel input', async () => {
    await expect(apiClient.adminUpdateNotificationSettings('qa-office', {
      ...draft(), notification_settings: { email: 'false' },
    } as any)).rejects.toThrow();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
  it('serializes a channel-only patch without unchanged destinations or hidden preferences', async () => {
    apiFetchMock.mockResolvedValue(canonical({ preferences: { email: false, digest: { hour: 9 } },
      delivery: { owner_phone: 'synthetic-concurrent-phone', telegram_chat_id: null } }));
    await apiClient.adminUpdateNotificationSettings('qa-office', { notification_settings: { email: false } }, draft());
    expect(apiFetchMock).toHaveBeenCalledWith('/api/v2/notifications/hooks', expect.objectContaining({ body: { preferences: { email: false } } }));
  });
  it('preserves the full legacy snapshot while applying a channel-only fallback update', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('unsupported', 404)).mockResolvedValueOnce({ status: 'ok' });
    await apiClient.adminUpdateNotificationSettings('qa-office', { notification_settings: { whatsapp: true } }, draft());
    expect(apiFetchMock).toHaveBeenLastCalledWith('/api/admin/tenants/qa-office/notifications', expect.objectContaining({ body: {
      ...draft(), notification_settings: { ...draft().notification_settings, whatsapp: true },
    } }));
  });
  it('does not dispatch an unsafe legacy channel-only PUT without a complete read snapshot', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('unsupported', 404));
    await expect(apiClient.adminUpdateNotificationSettings('qa-office', { notification_settings: { email: false } })).rejects.toThrow();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([
    { name: 'channel value', update: { notification_settings: { email: false } }, ack: canonical() },
    { name: 'destination value', update: { notification_settings: {}, owner_phone: 'synthetic-new-phone' }, ack: canonical() },
    { name: 'explicit null destination omitted', update: { notification_settings: {}, owner_phone: null }, ack: canonical({ delivery: {} }) },
  ])('rejects a canonical ACK that contradicts the owned update: $name', async ({ update, ack }) => {
    apiFetchMock.mockResolvedValue(ack);
    await expect(apiClient.adminUpdateNotificationSettings('qa-office', update)).rejects.toMatchObject({ status: 502 });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });
});
