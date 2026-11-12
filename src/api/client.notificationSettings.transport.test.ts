import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
import { apiClient } from './client';

vi.mock('@/api/client', async () => await vi.importActual('@/api/client'));
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api', 'https://other.example.invalid'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/utils/backendBootstrapGate', () => ({ ensureBackendRuntimeReady: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: vi.fn().mockResolvedValue('synthetic-visitor') }));

// Real HTTP orchestration, synthetic responses only. No provider/network dispatch.
const originalFetch = global.fetch;
const draft = { owner_phone: null, telegram_chat_id: 'synthetic-chat', notification_settings: { email: false } };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
});
beforeEach(() => {
  safeLocalStorage.clear(); useTenantStore.getState().setTenant('old-home');
  usePanelSessionStore.setState({ authToken: 'synthetic-owner-token', user: null });
  useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-widget-token', entityToken: 'synthetic-entity' });
  safeLocalStorage.setItem('tenantSlug', 'old-home');
});
afterEach(() => {
  global.fetch = originalFetch; vi.restoreAllMocks(); safeLocalStorage.clear();
  useTenantStore.getState().clearTenant(); usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
});
const expectPrivateSinglePost = () => {
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const [url, init] = vi.mocked(global.fetch).mock.calls[0], headers = new Headers(init?.headers);
  expect(new URL(String(url), window.location.origin).pathname).toBe('/api/v2/notifications/hooks');
  expect(init?.method).toBe('POST'); expect(init?.redirect).toBe('error'); expect(init?.credentials).toBe('include');
  expect(headers.get('Authorization')).toBe('Bearer synthetic-owner-token'); expect(headers.get('X-Tenant-Slug')).toBe('qa-office');
  expect(headers.has('X-Entity-Token')).toBe(false); expect(headers.has('X-Chat-Session-Id')).toBe(false);
  expect(safeLocalStorage.getItem('tenantSlug')).toBe('old-home'); expect(useTenantStore.getState().slug).toBe('old-home');
  expect(JSON.parse(String(init?.body))).toEqual({ preferences: { email: false },
    delivery: { owner_phone: null, telegram_chat_id: 'synthetic-chat' } });
};
describe('notification writes use one chosen transport destination', () => {
  it('returns a validated canonical acknowledgement with private tenant transport', async () => {
    global.fetch = vi.fn().mockResolvedValue(json({ contract_version: 'notifications.hooks.v1',
      tenant: { id: 701, slug: 'qa-office' }, preferences: draft.notification_settings,
      delivery: { owner_phone: null, telegram_chat_id: 'synthetic-chat' }, triggers: [] }));
    await expect(apiClient.adminUpdateNotificationSettings('qa-office', draft)).resolves.toEqual(draft);
    expectPrivateSinglePost();
  });
  it('does not replay a POST after its response is lost', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('synthetic response lost'));
    await expect(apiClient.adminUpdateNotificationSettings('qa-office', draft)).rejects.toThrow();
    expectPrivateSinglePost();
  });
  it('does not replay a POST after an invalid HTTP200 acknowledgement', async () => {
    global.fetch = vi.fn().mockResolvedValue(json({ error: 'synthetic server error' }));
    await expect(apiClient.adminUpdateNotificationSettings('qa-office', draft)).rejects.toThrow();
    expectPrivateSinglePost();
  });
  it('does not replay a legacy PUT after the primary route is explicitly unsupported', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(json({ error: 'not found' }, 404))
      .mockRejectedValueOnce(new TypeError('synthetic legacy response lost'));
    await expect(apiClient.adminUpdateNotificationSettings('qa-office', draft)).rejects.toThrow();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [url, init] = vi.mocked(global.fetch).mock.calls[1];
    expect(new URL(String(url), window.location.origin).pathname).toBe('/api/admin/tenants/qa-office/notifications');
    expect(init?.method).toBe('PUT'); expect(init?.redirect).toBe('error');
  });
});
