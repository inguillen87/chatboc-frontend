import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { usePanelSessionStore, useWidgetSessionStore, useTenantStore } from '@/stores';
import { resetBackendBootstrapGateForTests } from '@/utils/backendBootstrapGate';

vi.mock('@/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config')>()),
  API_BASE_CANDIDATES: ['/api'],
  BASE_API_URL: '/api',
  SAME_ORIGIN_PROXY_BASE: '/api',
}));

describe('apiFetch Clerk cookie panel transport', () => {
  let apiFetch: typeof import('@/utils/api').apiFetch;
  const originalFetch = global.fetch;
  const originalSelf = Object.getOwnPropertyDescriptor(window, 'self');
  const reply = (status = 200) => new Response(JSON.stringify(
    status === 200 ? { id: 7, verified: true } : { reason_code: 'token_expired' },
  ), { status, headers: { 'Content-Type': 'application/json' } });

  beforeAll(async () => {
    apiFetch = (await vi.importActual<typeof import('@/utils/api')>('@/utils/api')).apiFetch;
  });

  beforeEach(() => {
    safeLocalStorage.clear();
    usePanelSessionStore.setState({ authToken: null, user: null });
    useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
    useTenantStore.getState().clearTenant();
    window.history.replaceState({}, '', '/perfil');
    delete (window as any).CHATBOC_CONFIG;
    safeLocalStorage.setItem('authProvider', 'clerk');
    safeLocalStorage.setItem('clerkSessionTransport', 'cookie');
    safeLocalStorage.setItem('clerkUserId', 'clerk-synthetic-user');
    safeLocalStorage.setItem('entityToken', 'synthetic-widget-owner');
    safeLocalStorage.setItem('tenantSlug', 'municipio');
    global.fetch = vi.fn().mockImplementation(async () => reply());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    safeLocalStorage.clear();
    usePanelSessionStore.setState({ authToken: null, user: null });
    useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
    useTenantStore.getState().clearTenant();
    delete (window as any).CHATBOC_CONFIG;
    if (originalSelf) Object.defineProperty(window, 'self', originalSelf);
    window.history.replaceState({}, '', '/');
    resetBackendBootstrapGateForTests();
  });

  it.each(['/api/me', '/api/admin/tenants'])('keeps the cookie identity for %s when an entity token is stored', async (path) => {
    // Production token selection prioritizes these headers over the panel cookie.
    // Exercise the real request builder; only the HTTP boundary is substituted.
    global.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const headers = new Headers(init.headers);
      return reply(headers.has('X-Token') || headers.has('X-Entity-Token') ? 401 : 200);
    });

    await expect(apiFetch(path, { suppressPanel401Redirect: true })).resolves.toEqual({ id: 7, verified: true });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(init?.credentials).toBe('include');
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('X-Token')).toBe(false);
    expect(headers.has('X-Entity-Token')).toBe(false);
    expect(headers.get('X-Tenant-Slug')).toBe('municipio');
    expect(String(url)).toContain('tenant_slug=municipio');
    expect(safeLocalStorage.getItem('entityToken')).toBe('synthetic-widget-owner');
  });

  it('also excludes an implicit global widget token from a cookie-authenticated panel request', async () => {
    (window as any).CHATBOC_CONFIG = { entityToken: 'synthetic-global-widget' };
    await apiFetch('/api/me');
    const headers = new Headers(vi.mocked(global.fetch).mock.calls[0][1]?.headers);
    expect(headers.has('X-Token')).toBe(false);
    expect(headers.has('X-Entity-Token')).toBe(false);
  });

  it('preserves explicit widget requests and keeps panel cookies out of them', async () => {
    await apiFetch('/api/widget/profile', { isWidgetRequest: true, tenantSlug: 'widget-tenant' });
    const init = vi.mocked(global.fetch).mock.calls[0][1];
    expect(init?.credentials).toBe('omit');
    expect(new Headers(init?.headers).get('X-Entity-Token')).toBe('synthetic-widget-owner');
  });

  it('preserves the automatically detected public iframe transport', async () => {
    Object.defineProperty(window, 'self', { value: {}, configurable: true });
    (window as any).CHATBOC_CONFIG = { entityToken: 'synthetic-iframe-widget' };
    await apiFetch('/api/widget/profile');
    const init = vi.mocked(global.fetch).mock.calls[0][1];
    expect(init?.credentials).toBe('omit');
    expect(new Headers(init?.headers).get('X-Entity-Token')).toBe('synthetic-iframe-widget');
  });

  it('preserves caller-selected entity credentials', async () => {
    await apiFetch('/api/widget/profile', { entityToken: 'synthetic-explicit-widget' });
    expect(new Headers(vi.mocked(global.fetch).mock.calls[0][1]?.headers).get('X-Entity-Token')).toBe('synthetic-explicit-widget');
  });

  it('preserves existing Bearer transport when a stored cookie marker is present', async () => {
    usePanelSessionStore.setState({ authToken: 'synthetic-panel-bearer' });
    await apiFetch('/api/me');
    const headers = new Headers(vi.mocked(global.fetch).mock.calls[0][1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer synthetic-panel-bearer');
    expect(headers.get('X-Entity-Token')).toBe('synthetic-widget-owner');
  });

  it('does not change legacy non-Clerk transport', async () => {
    safeLocalStorage.removeItem('authProvider');
    safeLocalStorage.removeItem('clerkSessionTransport');
    await apiFetch('/api/me');
    expect(new Headers(vi.mocked(global.fetch).mock.calls[0][1]?.headers).get('X-Token')).toBe('synthetic-widget-owner');
  });

  it.each([401, 403])('still rejects a server denial with status %s', async (status) => {
    global.fetch = vi.fn().mockImplementation(async () => reply(status));
    await expect(apiFetch('/api/me', { suppressPanel401Redirect: true })).rejects.toMatchObject({ status });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
