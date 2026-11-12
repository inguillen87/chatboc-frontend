import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const transport = vi.hoisted(() => vi.fn());
vi.mock('@/api/client', async () => await vi.importActual('@/api/client'));
vi.mock('@/utils/api', () => ({ apiFetch: (...args: unknown[]) => transport(...args),
  ApiError: class ApiError extends Error { constructor(message: string, public status: number) { super(message); } } }));
import { useTenantNotificationSettings } from './useTenantNotificationSettings';

// The actual hook and client use synthetic HTTP bodies; no external access or dispatch.
const response = (preferences: Record<string, unknown> = { email: true }) => ({
  contract_version: 'notifications.hooks.v1', tenant: { id: 701, slug: 'qa-office' }, preferences,
  delivery: { owner_phone: 'synthetic-phone', telegram_chat_id: 'synthetic-chat' }, triggers: [],
});
beforeEach(() => { transport.mockReset(); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden'); })); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('notification drafts with the real endpoint adapter', () => {
  it('edits the shown channel while preserving destinations and hidden preference objects', async () => {
    transport.mockResolvedValueOnce(response({ email: true, digest: { hour: 8, channels: ['email'] }, sms: false }))
      .mockResolvedValueOnce(response({ email: false, digest: { hour: 8, channels: ['email'] }, sms: false }));
    const { result } = renderHook(() => useTenantNotificationSettings('qa-office', 'scope-office'));
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    expect(result.current.draft.notification_settings.digest).toEqual({ hour: 8, channels: ['email'] });
    act(() => result.current.setPreference('email', false));
    await act(async () => { expect(await result.current.save()).toBe('saved'); });
    expect(transport).toHaveBeenLastCalledWith('/api/v2/notifications/hooks', expect.objectContaining({ body: {
      preferences: { email: false },
    } }));
    expect(result.current.draft.owner_phone).toBe('synthetic-phone');
  });
  it('keeps an edited draft and reports failure after an invalid POST acknowledgement', async () => {
    transport.mockResolvedValueOnce(response()).mockResolvedValueOnce({ error: 'synthetic secret' });
    const { result } = renderHook(() => useTenantNotificationSettings('qa-office', 'scope-office'));
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    act(() => result.current.setPreference('email', false));
    const edited = result.current.draft;
    await act(async () => { expect(await result.current.save()).toBe('failed'); });
    expect(result.current.draft).toEqual(edited); expect(result.current.canEdit).toBe(true);
    expect(result.current.error).not.toContain('synthetic secret'); expect(transport).toHaveBeenCalledTimes(2);
  });
  it('keeps an edited draft after a malformed explicit reload and blocks saving until a valid read', async () => {
    transport.mockResolvedValueOnce(response()).mockResolvedValueOnce({ error: 'synthetic secret' }).mockResolvedValueOnce(response());
    const { result } = renderHook(() => useTenantNotificationSettings('qa-office', 'scope-office'));
    await waitFor(() => expect(result.current.canEdit).toBe(true)); act(() => result.current.setPreference('email', false));
    const edited = result.current.draft;
    await act(async () => { await result.current.reload(); });
    expect(result.current.draft).toEqual(edited); expect(result.current.canEdit).toBe(false); expect(result.current.canRetry).toBe(true);
    await act(async () => { expect(await result.current.save()).toBe('retired'); }); expect(transport).toHaveBeenCalledTimes(2);
    await act(async () => { await result.current.reload(); }); expect(result.current.canEdit).toBe(true);
  });
  it('keeps null destinations unchanged while editing a channel in an initial empty DTO', async () => {
    transport.mockResolvedValueOnce({ ...response({}), delivery: { owner_phone: null, telegram_chat_id: null } })
      .mockResolvedValueOnce({ ...response({ email: false }), delivery: { owner_phone: null, telegram_chat_id: null } });
    const { result } = renderHook(() => useTenantNotificationSettings('qa-office', 'scope-office'));
    await waitFor(() => expect(result.current.canEdit).toBe(true)); expect(result.current.draft.owner_phone).toBeNull();
    act(() => result.current.setPreference('email', false));
    await act(async () => { expect(await result.current.save()).toBe('saved'); });
    expect(transport).toHaveBeenLastCalledWith('/api/v2/notifications/hooks', expect.objectContaining({ body: {
      preferences: { email: false },
    } }));
  });
  it('does not preserve an old tenant draft if the caller reuses its scope key for another tenant', async () => {
    transport.mockResolvedValueOnce(response()).mockResolvedValueOnce({ error: 'synthetic denied' });
    const { result, rerender } = renderHook(({ tenant }) => useTenantNotificationSettings(tenant, 'same-scope'),
      { initialProps: { tenant: 'qa-office' } });
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    rerender({ tenant: 'qa-other' }); await waitFor(() => expect(result.current.canRetry).toBe(true));
    expect(result.current.draft.owner_phone).toBe(''); expect(result.current.draft.telegram_chat_id).toBe('');
    expect(result.current.canEdit).toBe(false);
  });
  it('retains edited-channel changes after a malformed acknowledgement for an explicit retry', async () => {
    transport.mockResolvedValueOnce(response()).mockResolvedValueOnce({ error: 'uncertain' }).mockResolvedValueOnce(response({ email: true, telegram: true }));
    const { result } = renderHook(() => useTenantNotificationSettings('qa-office', 'scope-office'));
    await waitFor(() => expect(result.current.canEdit).toBe(true)); act(() => result.current.setPreference('telegram', true));
    await act(async () => { expect(await result.current.save()).toBe('failed'); });
    expect(transport).toHaveBeenCalledTimes(2);
    await act(async () => { expect(await result.current.save()).toBe('saved'); });
    expect(transport).toHaveBeenLastCalledWith('/api/v2/notifications/hooks', expect.objectContaining({ body: { preferences: { telegram: true } } }));
  });
});
