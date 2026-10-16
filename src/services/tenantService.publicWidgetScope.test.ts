import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';

vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(), API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/utils/backendBootstrapGate', () => ({ ensureBackendRuntimeReady: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: vi.fn().mockResolvedValue('synthetic-visitor') }));

import { tenantService } from './tenantService';

const originalFetch = global.fetch;
const deferred = () => { let resolve!: (value: Response) => void; return { promise: new Promise<Response>(r => { resolve = r; }), resolve: (value: Response) => resolve(value) }; };
const config = { contract_version: 'public.widget_config.v1', slug: 'tierra-del-fuego', welcome_subtitle: 'Conversa TDF', welcome_title: 'Saludo público' };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const refreshPrivateSession = () => {
  usePanelSessionStore.setState({ authToken: 'synthetic-refreshed-private-session' });
  safeLocalStorage.setItem('authToken', 'synthetic-refreshed-private-session');
  safeLocalStorage.setItem('tenantSlug', 'junin');
};

beforeEach(() => {
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: 'synthetic-private-session', user: { id: 4, rol: 'admin_municipio', tenant_slug: 'junin' } as any });
  useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-unrelated-chat-session', entityToken: null });
  useTenantStore.getState().setTenant('junin');
  safeLocalStorage.setItem('authToken', 'synthetic-private-session');
  safeLocalStorage.setItem('user', JSON.stringify({ id: 4, rol: 'admin_municipio', tenant_slug: 'junin', permissions: ['settings.tenant.write'] }));
  window.history.replaceState({}, '', '/t/tierra-del-fuego');
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  useTenantStore.getState().clearTenant();
  window.history.replaceState({}, '', '/');
});

function expectPublicReadOnlyTransport() {
  for (const [input, init] of vi.mocked(global.fetch).mock.calls) {
    const url = new URL(String(input), window.location.origin);
    expect(url.origin).toBe(window.location.origin);
    expect(url.searchParams.get('tenant')).toBe('tierra-del-fuego');
    expect(url.searchParams.get('tenant_slug')).toBe('tierra-del-fuego');
    const headers = new Headers(init?.headers);
    expect(headers.get('X-Tenant-Slug')).toBe('tierra-del-fuego');
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('X-Entity-Token')).toBe(false);
    expect(headers.has('X-Chat-Session-Id')).toBe(false);
    expect(init?.credentials).toBe('omit');
    expect(init?.method).toBe('GET');
  }
}

describe('public widget appearance independent of a private panel session', () => {
  it('finishes decoding a public 200 body while the independent panel session refreshes', async () => {
    let finishBody!: (value: string) => void;
    const pendingBody = new Promise<string>(resolve => { finishBody = resolve; });
    const response = json(config);
    const readBody = vi.spyOn(response, 'text').mockReturnValue(pendingBody);
    global.fetch = vi.fn().mockResolvedValue(response);
    const read = tenantService.getPublicWidgetConfig('tierra-del-fuego');
    await vi.waitFor(() => expect(readBody).toHaveBeenCalledOnce());
    refreshPrivateSession();
    finishBody(JSON.stringify(config));
    await expect(read).resolves.toEqual(config);
    expectPublicReadOnlyTransport();
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('junin');
    expect(usePanelSessionStore.getState().authToken).toBe('synthetic-refreshed-private-session');
  });

  it.each([false, true])('keeps the requested appearance during a private refresh (legacy fallback: %s)', async legacy => {
    const pending = deferred();
    global.fetch = legacy
      ? vi.fn().mockResolvedValueOnce(json({ reason_code: 'not_found' }, 404)).mockReturnValueOnce(pending.promise)
      : vi.fn().mockReturnValueOnce(pending.promise);
    const privateUser = safeLocalStorage.getItem('user');
    const read = tenantService.getPublicWidgetConfig('tierra-del-fuego');
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(legacy ? 2 : 1));
    // This public read must neither select the panel tenant nor create a chat.
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('junin');
    expect(safeLocalStorage.getItem('chat_session_id')).toBeNull();
    refreshPrivateSession();
    const response = json(config);
    const body = vi.spyOn(response, 'text');
    pending.resolve(response);
    await expect(read).resolves.toEqual(config);
    expect(body).toHaveBeenCalledOnce();
    expectPublicReadOnlyTransport();
    expect(global.fetch).toHaveBeenCalledTimes(legacy ? 2 : 1);
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('junin');
    expect(useTenantStore.getState().slug).toBe('junin');
    expect(safeLocalStorage.getItem('user')).toBe(privateUser);
    expect(usePanelSessionStore.getState().authToken).toBe('synthetic-refreshed-private-session');
    expect(useWidgetSessionStore.getState().chatAuthToken).toBe('synthetic-unrelated-chat-session');
  });

  it('keeps access denial terminal without falling back or changing the private session', async () => {
    global.fetch = vi.fn().mockResolvedValue(json({ reason_code: 'denied' }, 403));
    await expect(tenantService.getPublicWidgetConfig('tierra-del-fuego')).rejects.toMatchObject({ status: 403 });
    expect(global.fetch).toHaveBeenCalledOnce();
    expectPublicReadOnlyTransport();
    expect(usePanelSessionStore.getState().authToken).toBe('synthetic-private-session');
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('junin');
    expect(safeLocalStorage.getItem('chat_session_id')).toBeNull();
  });
});
