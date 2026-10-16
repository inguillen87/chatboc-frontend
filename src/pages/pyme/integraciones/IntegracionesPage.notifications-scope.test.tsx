import React from 'react';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IntegracionesPage from './IntegracionesPage';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { useTenantNotificationSettings } from './useTenantNotificationSettings';
import { ApiError } from '@/utils/api';

// Real route/page/controls; synthetic tenant identity and APIs. No production
// data, delivery, server authorization or owner acceptance are exercised.
vi.unmock('react-router-dom');
vi.mock('@/context/TenantContext', async () => {
  const { useParams } = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { useTenant: () => { const slug = useParams().tenant || 'qa-a'; return {
    currentSlug: slug, isLoadingTenant: false, tenantError: null,
    tenant: { slug, publishedIdentity: { tenantId: slug === 'qa-a' ? 701 : 702, tenantSlug: slug } },
  }; } };
});

describe('notification request ownership — synthetic transport', () => {
  it('retires the original A read through A→B→A and accepts only the new A read', async () => {
    const oldA = deferred<any>(), newA = deferred<any>(), b = deferred<any>();
    api.adminGetNotificationSettings.mockImplementationOnce(() => oldA.promise).mockImplementationOnce(() => b.promise).mockImplementationOnce(() => newA.promise);
    const { result, rerender } = renderHook(({ tenant, scope }) => useTenantNotificationSettings(tenant, scope),
      { initialProps: { tenant: 'qa-a', scope: 'scope-a' } });
    rerender({ tenant: 'qa-b', scope: 'scope-b' }); rerender({ tenant: 'qa-a', scope: 'scope-a' });
    await act(async () => { oldA.resolve(settings(true, 'OLD-A')); b.resolve(settings(true, 'B')); });
    expect(result.current.canEdit).toBe(false);
    await act(async () => { newA.resolve(settings(false, 'NEW-A')); });
    expect(result.current.draft).toEqual(settings(false, 'NEW-A')); expect(result.current.canEdit).toBe(true);
  });
  it('does not readopt a retained old A save or edit callback after returning to A', async () => {
    api.adminGetNotificationSettings.mockResolvedValueOnce(settings(true, 'OLD-A')).mockResolvedValueOnce(settings(false, 'B')).mockResolvedValueOnce(settings(false, 'NEW-A'));
    const { result, rerender } = renderHook(({ tenant, scope }) => useTenantNotificationSettings(tenant, scope),
      { initialProps: { tenant: 'qa-a', scope: 'scope-a' } }); await waitFor(() => expect(result.current.canEdit).toBe(true));
    const oldSave = result.current.save, oldEdit = result.current.setPreference;
    rerender({ tenant: 'qa-b', scope: 'scope-b' }); await waitFor(() => expect(result.current.canEdit).toBe(true));
    rerender({ tenant: 'qa-a', scope: 'scope-a' }); await waitFor(() => expect(result.current.canEdit).toBe(true));
    await act(async () => { oldEdit('email', true); expect(await oldSave()).toBe('retired'); });
    expect(result.current.draft).toEqual(settings(false, 'NEW-A')); expect(api.adminUpdateNotificationSettings).not.toHaveBeenCalled();
  });
  it.each(['success', 'error'] as const)('retires the %s acknowledgement of an A save after switching to B', async outcome => {
    const write = deferred<any>(); api.adminGetNotificationSettings.mockImplementation(async (slug: string) => settings(slug === 'qa-a', slug));
    api.adminUpdateNotificationSettings.mockReturnValue(write.promise);
    const { result, rerender } = renderHook(({ tenant, scope }) => useTenantNotificationSettings(tenant, scope),
      { initialProps: { tenant: 'qa-a', scope: 'scope-a' } }); await waitFor(() => expect(result.current.canEdit).toBe(true));
    let save!: ReturnType<typeof result.current.save>; act(() => { save = result.current.save(); });
    rerender({ tenant: 'qa-b', scope: 'scope-b' }); await waitFor(() => expect(result.current.canEdit).toBe(true));
    await act(async () => { outcome === 'success' ? write.resolve({}) : write.reject(new Error('synthetic late error')); expect(await save).toBe('retired'); });
    expect(result.current.draft).toEqual(settings(false, 'qa-b')); expect(result.current.error).toBeNull(); expect(result.current.saving).toBe(false);
  });
  it('blocks a duplicate save synchronously before React renders its pending state', async () => {
    const write = deferred<any>(); api.adminGetNotificationSettings.mockResolvedValue(settings(true, 'A')); api.adminUpdateNotificationSettings.mockReturnValue(write.promise);
    const { result } = renderHook(() => useTenantNotificationSettings('qa-a', 'scope-a')); await waitFor(() => expect(result.current.canEdit).toBe(true));
    let one!: Promise<string>, two!: Promise<string>; act(() => { const save = result.current.save; one = save(); two = save(); });
    expect(api.adminUpdateNotificationSettings).toHaveBeenCalledTimes(1); expect(await two).toBe('retired');
    await act(async () => { write.resolve({}); expect(await one).toBe('saved'); });
  });
  it('cannot save an old draft in the event that advances the session revision', async () => {
    api.adminGetNotificationSettings.mockResolvedValue(settings(true, 'A'));
    const { result } = renderHook(() => useTenantNotificationSettings('qa-a', 'scope-a')); await waitFor(() => expect(result.current.canEdit).toBe(true));
    await act(async () => { const oldSave = result.current.save; advanceChatbocSessionRevision(); expect(await oldSave()).toBe('retired'); });
    expect(api.adminUpdateNotificationSettings).not.toHaveBeenCalled();
  });
  it.each([401, 403])('withdraws a rejected draft on save %s until a successful explicit read', async status => {
    api.adminGetNotificationSettings.mockResolvedValue(settings(true, 'A')); api.adminUpdateNotificationSettings.mockRejectedValue(new ApiError('synthetic secret must not be shown', status));
    const { result } = renderHook(() => useTenantNotificationSettings('qa-a', 'scope-a')); await waitFor(() => expect(result.current.canEdit).toBe(true));
    await act(async () => { expect(await result.current.save()).toBe('failed'); });
    expect(result.current.canEdit).toBe(false); expect(result.current.canRetry).toBe(true); expect(result.current.draft.owner_phone).toBe('');
    expect(result.current.error).not.toContain('synthetic secret');
    await act(async () => { await result.current.reload(); }); expect(result.current.canEdit).toBe(true);
  });
  it('offers explicit retry after a failed read without sending default preferences', async () => {
    const retry = deferred<any>(); api.adminGetNotificationSettings.mockRejectedValueOnce(new Error('synthetic offline')).mockReturnValueOnce(retry.promise);
    const { result } = renderHook(() => useTenantNotificationSettings('qa-a', 'scope-a')); await waitFor(() => expect(result.current.canRetry).toBe(true));
    act(() => { const reload = result.current.reload; void reload(); void reload(); });
    expect(api.adminGetNotificationSettings).toHaveBeenCalledTimes(2); expect(result.current.canEdit).toBe(false);
    await act(async () => { retry.resolve(settings(false, 'RETRY')); }); expect(result.current.canEdit).toBe(true);
  });
  it.each([null, { notification_settings: { email: 'false' } }])('does not enable edits for malformed settings %j', async response => {
    api.adminGetNotificationSettings.mockResolvedValue(response);
    const { result } = renderHook(() => useTenantNotificationSettings('qa-a', 'scope-a')); await waitFor(() => expect(result.current.canRetry).toBe(true));
    expect(result.current.canEdit).toBe(false); expect(api.adminUpdateNotificationSettings).not.toHaveBeenCalled();
  });
  it('does not read or save without a verified scope and retires a pending read after unmount', async () => {
    const read = deferred<any>(); api.adminGetNotificationSettings.mockReturnValue(read.promise);
    const { result, rerender, unmount } = renderHook(({ scope }: { scope: string | null }) => useTenantNotificationSettings('qa-a', scope), { initialProps: { scope: null } });
    expect(api.adminGetNotificationSettings).not.toHaveBeenCalled(); expect(await result.current.save()).toBe('retired');
    rerender({ scope: 'scope-a' }); expect(api.adminGetNotificationSettings).toHaveBeenCalledTimes(1);
    const reload = result.current.reload; unmount();
    await act(async () => { await reload(); read.resolve(settings(true, 'UNMOUNTED')); });
    expect(api.adminGetNotificationSettings).toHaveBeenCalledTimes(1); expect(api.adminUpdateNotificationSettings).not.toHaveBeenCalled();
  });
});
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: { id: 42 }, loading: false,
  hasVerifiedSession: true, organizationProfileVerified: true }) }));
const api = vi.hoisted(() => ({ adminGetIntegrations: vi.fn(), adminGetNotificationSettings: vi.fn(),
  adminGetCatalog: vi.fn(), adminGetMercadoPagoCredentials: vi.fn(), get: vi.fn(), adminUpdateNotificationSettings: vi.fn() }));
vi.mock('@/api/client', () => ({ apiClient: api }));
vi.mock('@/api/v2/channelActivation', () => ({ fetchTenantChannelActivation: vi.fn(async (slug: string) => ({
  tenant: { id: slug === 'qa-a' ? 701 : 702, slug }, whatsapp_connection: { provider: 'unconfigured', production_ready: false }, channels: [] })) }));
vi.mock('@/components/admin/ChatCustomizer', () => ({ default: () => null }));
vi.mock('@/components/admin/OrderDispatchSettings', () => ({ default: () => null }));
vi.mock('@/components/admin/catalog/CatalogUploadWizard', () => ({ default: () => null }));
vi.mock('@/components/admin/catalog/CatalogSpreadsheetEditor', () => ({ default: () => null }));
vi.mock('@/components/integrations/InstitutionalChannelPreview', () => ({ default: () => null }));
vi.mock('@/components/integrations/InstitutionalProfileAccess', () => ({ default: () => null }));
vi.mock('@/components/integrations/WhatsappTechProviderOnboarding', () => ({ default: () => null }));
vi.mock('@/pages/pyme/integraciones/IntegrationPreviewDialog', () => ({ default: () => null }));
const deferred = <T,>() => { let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const settings = (email: boolean, suffix: string) => ({ owner_phone: `synthetic-phone-${suffix}`, telegram_chat_id: `synthetic-chat-${suffix}`,
  notification_settings: { email, telegram: false, whatsapp: false } });
const notificationAuthority = (expectedTenantId: number) => ({ expectedTenantId, isCurrent: expect.any(Function) });
function Page() { const navigate = useNavigate(); return <><button onClick={() => navigate('/t/qa-b/integraciones?channel=email')}>Cambiar a B</button>
  <button onClick={() => navigate('/t/qa-a/integraciones?channel=email')}>Cambiar a A</button><IntegracionesPage /></>; }
const fixture = () => <MemoryRouter initialEntries={['/t/qa-a/integraciones?channel=email']}><Routes>
  <Route path="/t/:tenant/integraciones" element={<Page />} /></Routes></MemoryRouter>;
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden'); }));
  api.adminGetIntegrations.mockResolvedValue([]); api.adminGetCatalog.mockResolvedValue({});
  api.adminGetMercadoPagoCredentials.mockResolvedValue({}); api.get.mockResolvedValue({}); api.adminUpdateNotificationSettings.mockResolvedValue({});
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('notification drafts belong to the verified tenant/session', () => {
  it('ignores a delayed A read after B has loaded and saves only the B settings', async () => {
    const a = deferred<any>(); api.adminGetNotificationSettings.mockImplementation((slug: string) => slug === 'qa-a' ? a.promise : Promise.resolve(settings(false, 'B')));
    const user = userEvent.setup(); const { unmount } = render(fixture());
    await waitFor(() => expect(api.adminGetNotificationSettings).toHaveBeenCalledWith('qa-a', notificationAuthority(701)));
    const aAuthority = api.adminGetNotificationSettings.mock.calls[0][1]; expect(aAuthority.isCurrent()).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Cambiar a B' }));
    await waitFor(() => expect(api.adminGetNotificationSettings).toHaveBeenCalledWith('qa-b', notificationAuthority(702)));
    const bAuthority = api.adminGetNotificationSettings.mock.calls[1][1];
    expect(aAuthority.isCurrent()).toBe(false); expect(bAuthority.isCurrent()).toBe(true);
    await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false'));
    await act(async () => { a.resolve(settings(true, 'A')); await a.promise; });
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    await user.click(screen.getByRole('button', { name: 'Guardar Preferencias' }));
    expect(api.adminUpdateNotificationSettings).toHaveBeenCalledWith('qa-b', { notification_settings: {} }, settings(false, 'B'), notificationAuthority(702));
    const saveAuthority = api.adminUpdateNotificationSettings.mock.calls[0][3];
    expect(saveAuthority.isCurrent()).toBe(true);
    unmount(); expect(bAuthority.isCurrent()).toBe(false); expect(saveAuthority.isCurrent()).toBe(false);
  });
  it('does not allow saving a previous draft before B notification settings are read', async () => {
    const b = deferred<any>(); api.adminGetNotificationSettings.mockImplementation((slug: string) => slug === 'qa-a' ? Promise.resolve(settings(true, 'A')) : b.promise);
    const user = userEvent.setup(); render(fixture()); await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true'));
    await user.click(screen.getByRole('button', { name: 'Cambiar a B' }));
    await waitFor(() => expect(api.adminGetNotificationSettings).toHaveBeenCalledWith('qa-b', notificationAuthority(702)));
    expect(api.adminGetNotificationSettings.mock.calls[0][1].isCurrent()).toBe(false);
    expect(api.adminGetNotificationSettings.mock.calls[1][1].isCurrent()).toBe(true);
    expect(screen.getByRole('button', { name: 'Guardar Preferencias' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Guardar Preferencias' })); expect(api.adminUpdateNotificationSettings).not.toHaveBeenCalled();
  });
  it('reloads notification settings when the verified session revision changes', async () => {
    api.adminGetNotificationSettings.mockResolvedValue(settings(true, 'A')); render(fixture());
    await waitFor(() => expect(api.adminGetNotificationSettings).toHaveBeenCalledTimes(1));
    await act(async () => { advanceChatbocSessionRevision(); });
    await waitFor(() => expect(api.adminGetNotificationSettings).toHaveBeenCalledTimes(2));
  });
  it('preserves an edited draft after a save transport failure in the same scope', async () => {
    api.adminGetNotificationSettings.mockResolvedValue(settings(true, 'A')); api.adminUpdateNotificationSettings.mockRejectedValue(new Error('synthetic transport error'));
    const user = userEvent.setup(); render(fixture()); await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true'));
    await user.click(screen.getByRole('switch')); await user.click(screen.getByRole('button', { name: 'Guardar Preferencias' }));
    await waitFor(() => expect(api.adminUpdateNotificationSettings).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });
});
