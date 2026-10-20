import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelSessionStore, useWidgetSessionStore, useTenantStore } from '@/stores';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { resetBackendBootstrapGateForTests } from '@/utils/backendBootstrapGate';
import { advanceChatbocSessionRevision, captureChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/utils/api', async () => await vi.importActual<typeof import('@/utils/api')>('@/utils/api'));
import { syncClerkSession } from '@/api/clerkAuth';
import { apiFetch } from '@/utils/api';

type ApiFetchOptions = NonNullable<Parameters<typeof apiFetch>[1]>;

const originalFetch = global.fetch;
const responseBody = {
  contract_version: 'auth.clerk.v1', auth_provider: 'clerk', session_transport: 'cookie',
  user: { id: 901, rol: 'SuperAdmin' }, tenant: null,
};
const reply = () => new Response(JSON.stringify(responseBody), {
  status: 200, headers: { 'Content-Type': 'application/json' },
});

describe('read-only Clerk session exchange and real apiFetch retirement seam', () => {
  beforeEach(() => {
    safeLocalStorage.clear(); window.sessionStorage.clear();
    usePanelSessionStore.setState({ authToken: null, user: null });
    useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
    useTenantStore.getState().clearTenant();
    window.history.replaceState({}, '', '/');
    delete (window as any).CHATBOC_CONFIG;
    safeLocalStorage.setItem('tenantSlug', 'synthetic-tdf');
    safeLocalStorage.setItem('clerkUserId', 'synthetic-clerk-actor-a');
    safeLocalStorage.setItem('authProvider', 'clerk');
    safeLocalStorage.setItem('clerkSessionTransport', 'cookie');
    safeLocalStorage.setItem('chatboc_anon_id', 'synthetic-clerk-anonymous');
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  });
  afterEach(() => {
    global.fetch = originalFetch; vi.restoreAllMocks(); vi.unstubAllEnvs();
    safeLocalStorage.clear(); window.sessionStorage.clear();
    usePanelSessionStore.setState({ authToken: null, user: null });
    useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
    useTenantStore.getState().clearTenant(); resetBackendBootstrapGateForTests();
  });

  const pendingExchange = async (signal?: AbortSignal, isCurrent?: () => boolean) => {
    let resolve!: (response: Response) => void;
    global.fetch = vi.fn().mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    // Attach both branches synchronously: even a failing regression never creates
    // an unhandled rejection or authorizes a second network attempt.
    const settled = syncClerkSession('synthetic-explicit-clerk-bearer',
      { id: 'synthetic-clerk-actor-a' }, { intent: 'tenant_owner' }, signal, isCurrent)
      .then(value => ({ status: 'fulfilled' as const, value }),
        error => ({ status: 'rejected' as const, name: error?.name, message: error?.message }));
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    return { resolve, settled };
  };
  const finish = async (pending: Awaited<ReturnType<typeof pendingExchange>>) => {
    pending.resolve(reply());
    const result = await pending.settled;
    expect(global.fetch).toHaveBeenCalledTimes(1);
    return result;
  };

  it('accepts an unchanged exchange with its explicit bearer, cookie transport and no tenant query', async () => {
    const pending = await pendingExchange();
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    const headers = new Headers(init?.headers);
    const parsed = new URL(String(url), 'https://synthetic.example.invalid');
    expect(parsed.pathname).toBe('/api/auth/clerk/session');
    expect(parsed.searchParams.has('tenant_slug')).toBe(false);
    expect(parsed.searchParams.has('tenant')).toBe(false);
    expect(init?.method).toBe('POST'); expect(init?.credentials).toBe('include');
    expect(init?.redirect).toBe('error');
    expect(headers.get('Authorization')).toBe('Bearer synthetic-explicit-clerk-bearer');
    expect(headers.has('X-Token')).toBe(false);
    expect(headers.has('X-Entity-Token')).toBe(false);
    expect(headers.has('X-Chat-Session-Id')).toBe(false);
    expect(JSON.parse(String(init?.body))).toEqual({
      user: { id: 'synthetic-clerk-actor-a' }, intent: 'tenant_owner',
    });
    expect(await finish(pending)).toEqual({ status: 'fulfilled', value: responseBody });
  });

  it('does not retire this tenant-omitting exchange when only presentation tenantSlug changes', async () => {
    const pending = await pendingExchange();
    const revision = captureChatbocSessionRevision();
    safeLocalStorage.setItem('tenantSlug', 'synthetic-junin');
    expect(captureChatbocSessionRevision()).toBe(revision);
    expect(await finish(pending)).toEqual({ status: 'fulfilled', value: responseBody });
  });

  it('does not retire this explicit-Clerk-bearer exchange when only the unrelated widget bearer changes', async () => {
    const pending = await pendingExchange();
    useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-widget-bearer-b' });
    expect(await finish(pending)).toEqual({ status: 'fulfilled', value: responseBody });
  });

  it('retires after the panel store authority changes', async () => {
    const pending = await pendingExchange();
    usePanelSessionStore.setState({ authToken: 'synthetic-panel-authority-b' });
    expect(await finish(pending)).toEqual({ status: 'rejected', name: 'AbortError', message: 'Request context retired' });
  });

  it('retires after the stored Clerk actor changes', async () => {
    const pending = await pendingExchange();
    safeLocalStorage.setItem('clerkUserId', 'synthetic-clerk-actor-b');
    expect(await finish(pending)).toEqual({ status: 'rejected', name: 'AbortError', message: 'Request context retired' });
  });

  it('retires after the panel session revision advances even if identity strings remain equal', async () => {
    const pending = await pendingExchange();
    advanceChatbocSessionRevision();
    expect(await finish(pending)).toEqual({ status: 'rejected', name: 'AbortError', message: 'Request context retired' });
  });

  it('honors an explicit caller cancellation after dispatch without replay', async () => {
    const controller = new AbortController();
    const pending = await pendingExchange(controller.signal);
    controller.abort(new DOMException('Synthetic caller left', 'AbortError'));
    expect(await finish(pending)).toEqual({ status: 'rejected', name: 'AbortError', message: 'Synthetic caller left' });
  });

  it('retires a late exchange when its caller attempt ends even with unchanged identity strings', async () => {
    let current = true;
    const pending = await pendingExchange(undefined, () => current);
    current = false;
    expect(await finish(pending)).toEqual({ status: 'rejected', name: 'AbortError', message: 'Request context retired' });
  });

  it('does not dispatch for a caller that was already retired', async () => {
    global.fetch = vi.fn().mockImplementation(async () => reply());
    await expect(syncClerkSession('synthetic-explicit-clerk-bearer',
      { id: 'synthetic-clerk-actor-a' }, {}, undefined, () => false))
      .rejects.toMatchObject({ name: 'AbortError', message: 'Request context retired' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each(['authProvider', 'clerkSessionTransport'])(
    'still retires the exchange when %s changes', async key => {
      const pending = await pendingExchange();
      safeLocalStorage.setItem(key, 'synthetic-replacement');
      expect(await finish(pending)).toEqual({ status: 'rejected', name: 'AbortError', message: 'Request context retired' });
    },
  );

  it('retires a panel authority ABA when its monotonic revision advances', async () => {
    const pending = await pendingExchange();
    usePanelSessionStore.setState({ authToken: 'synthetic-other-authority' });
    advanceChatbocSessionRevision();
    usePanelSessionStore.setState({ authToken: null });
    expect(await finish(pending)).toEqual({ status: 'rejected', name: 'AbortError', message: 'Request context retired' });
  });

  it.each<[string, string, Partial<ApiFetchOptions>]>([
    ['other endpoint', '/api/auth/clerk/onboarding', {}],
    ['widget transport', '/api/auth/clerk/session', { isWidgetRequest: true }],
    ['entity token allowed', '/api/auth/clerk/session', { omitEntityToken: false }],
    ['chat identifier allowed', '/api/auth/clerk/session', { omitChatSessionId: false }],
    ['cookies omitted', '/api/auth/clerk/session', { omitCredentials: true }],
    ['tenant persistence allowed', '/api/auth/clerk/session', { persistTenantSlug: true }],
    ['tenant allowed', '/api/auth/clerk/session', { omitTenant: false }],
    ['no caller lifetime', '/api/auth/clerk/session', { isCurrent: undefined }],
    ['no explicit bearer', '/api/auth/clerk/session', { headers: {} }],
  ])('does not extend Clerk isolation to %s', async (_name, path, overrides) => {
    let resolve!: (response: Response) => void;
    global.fetch = vi.fn().mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    const pending = apiFetch(path, {
      method: 'POST', skipAuth: true, omitTenant: true, omitCredentials: false,
      isWidgetRequest: false, omitEntityToken: true, omitChatSessionId: true,
      persistTenantSlug: false, isCurrent: () => true,
      headers: { Authorization: 'Bearer synthetic-explicit-clerk-bearer' },
      body: { user: { id: 'synthetic-clerk-actor-a' } }, ...overrides,
    }).then(value => ({ status: 'fulfilled', value }),
      error => ({ status: 'rejected', name: error?.name, message: error?.message }));
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    safeLocalStorage.setItem('tenantSlug', 'synthetic-junin');
    resolve(reply());
    expect(await pending).toEqual({ status: 'rejected', name: 'AbortError', message: 'Request context retired' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
