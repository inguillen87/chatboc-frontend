import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { usePanelSessionStore, useWidgetSessionStore, useTenantStore } from '@/stores';
import { resetBackendBootstrapGateForTests } from '@/utils/backendBootstrapGate';

vi.mock('@/config', async original => ({
  ...(await original<typeof import('@/config')>()),
  API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api',
}));

describe('effective widget actor matches the real HTTP request policy', () => {
  let api: typeof import('@/utils/api');
  const originalFetch = global.fetch;
  const request = { isWidgetRequest: true, tenantSlug: 'qa-widget-policy',
    persistTenantSlug: false, omitEntityToken: true, chatSessionId: 'qa-bound-conversation',
    singleAttempt: true } as const;
  const fetched = () => {
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1);
    const init = vi.mocked(global.fetch).mock.calls[0][1];
    return { headers: new Headers(init?.headers), credentials: init?.credentials };
  };
  beforeAll(async () => { api = await vi.importActual<typeof import('@/utils/api')>('@/utils/api'); });
  beforeEach(() => {
    safeLocalStorage.clear(); window.sessionStorage.clear();
    usePanelSessionStore.setState({ authToken: null, user: null });
    useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
    useTenantStore.getState().clearTenant();
    window.history.replaceState({}, '', '/');
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    global.fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    }));
  });
  afterEach(() => {
    global.fetch = originalFetch; vi.restoreAllMocks(); vi.unstubAllEnvs();
    safeLocalStorage.clear(); window.sessionStorage.clear();
    usePanelSessionStore.setState({ authToken: null, user: null });
    useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
    useTenantStore.getState().clearTenant(); resetBackendBootstrapGateForTests();
  });

  it.each(['usuario', 'ciudadano', 'vecino', 'neighbor', 'CIUDADANO'])(
    'selects an existing eligible panel credential for role %s without enabling cookies', async rol => {
      usePanelSessionStore.setState({ authToken: 'synthetic-citizen-panel' });
      safeLocalStorage.setItem('user', JSON.stringify({ rol }));
      const actor = api.captureWidgetRequestAuthority();
      expect(actor).toEqual({ token: 'synthetic-citizen-panel', tokenSource: 'authToken', omitCredentials: true });
      await api.apiFetch('/api/widget/profile', request);
      expect(fetched().headers.get('Authorization')).toBe(`Bearer ${actor.token}`);
      expect(fetched().credentials).toBe('omit');
    },
  );

  it.each(['superadmin', 'super_admin', 'admin', 'tenant_admin', 'empleado', ' ciudadano '])(
    'keeps panel credential for role %s out of widget capture and HTTP', async rol => {
      usePanelSessionStore.setState({ authToken: 'synthetic-private-panel' });
      safeLocalStorage.setItem('user', JSON.stringify({ rol }));
      const actor = api.captureWidgetRequestAuthority();
      expect(actor).toEqual({ token: null, tokenSource: null, omitCredentials: true });
      await api.apiFetch('/api/widget/profile', request);
      expect(fetched().headers.has('Authorization')).toBe(false);
      expect(fetched().credentials).toBe('omit');
    },
  );

  it('selects chat credentials first and keeps store precedence identical in capture and transport', async () => {
    usePanelSessionStore.setState({ authToken: 'synthetic-panel-store' });
    useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-chat-store' });
    safeLocalStorage.setItem('authToken', 'synthetic-panel-storage');
    safeLocalStorage.setItem('chatAuthToken', 'synthetic-chat-storage');
    safeLocalStorage.setItem('user', JSON.stringify({ rol: 'ciudadano' }));
    const actor = api.captureWidgetRequestAuthority();
    expect(actor).toEqual({ token: 'synthetic-chat-store', tokenSource: 'chatAuthToken', omitCredentials: true });
    await api.apiFetch('/api/widget/profile', request);
    expect(fetched().headers.get('Authorization')).toBe(`Bearer ${actor.token}`);
  });

  it('captures the existing storage-only chat transport without decoding a JWT role or subject', async () => {
    safeLocalStorage.setItem('chatAuthToken', 'synthetic.opaque.credential');
    safeLocalStorage.setItem('user', JSON.stringify({ rol: 'super_admin' }));
    const actor = api.captureWidgetRequestAuthority();
    expect(actor.tokenSource).toBe('chatAuthToken');
    await api.apiFetch('/api/widget/profile', request);
    expect(fetched().headers.get('Authorization')).toBe(`Bearer ${actor.token}`);
  });

  it('does not treat a role alias or malformed stored profile as an added grant', async () => {
    usePanelSessionStore.setState({ authToken: 'synthetic-panel' });
    safeLocalStorage.setItem('user', JSON.stringify({ role: 'ciudadano' }));
    expect(api.captureWidgetRequestAuthority().token).toBeNull();
    safeLocalStorage.setItem('user', '{broken');
    expect(api.captureWidgetRequestAuthority().token).toBeNull();
    await api.apiFetch('/api/widget/profile', request);
    expect(fetched().headers.has('Authorization')).toBe(false);
  });

  it('honors skipAuth for both credentials while preserving an explicit cookie opt-in', async () => {
    usePanelSessionStore.setState({ authToken: 'synthetic-panel' });
    useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-chat' });
    safeLocalStorage.setItem('user', JSON.stringify({ rol: 'ciudadano' }));
    const options = { skipAuth: true, omitCredentials: false };
    expect(api.captureWidgetRequestAuthority(options)).toEqual({ token: null, tokenSource: null, omitCredentials: false });
    await api.apiFetch('/api/widget/profile', { ...request, ...options });
    expect(fetched().headers.has('Authorization')).toBe(false);
    expect(fetched().credentials).toBe('include');
  });

  it('keeps captured selection detached from future credential changes', () => {
    useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-chat-a' });
    const original = api.captureWidgetRequestAuthority();
    const key = api.widgetRequestAuthorityKey(original);
    useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-chat-b' });
    expect(original.token).toBe('synthetic-chat-a');
    expect(api.widgetRequestAuthorityKey(api.captureWidgetRequestAuthority())).not.toBe(key);
    expect(api.widgetRequestAuthorityKey({ ...original, omitCredentials: false })).not.toBe(key);
  });

  it('ignores an unused private panel credential in the effective anonymous actor key', () => {
    safeLocalStorage.setItem('user', JSON.stringify({ rol: 'super_admin' }));
    usePanelSessionStore.setState({ authToken: 'synthetic-admin-a' });
    const first = api.widgetRequestAuthorityKey(api.captureWidgetRequestAuthority());
    usePanelSessionStore.setState({ authToken: 'synthetic-admin-b' });
    expect(api.widgetRequestAuthorityKey(api.captureWidgetRequestAuthority())).toBe(first);
  });

  it('only captures memory state and does not create a cache partition or persist a credential copy', () => {
    useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-memory-only-chat' });
    const before = { ...window.localStorage };
    const snapshot = api.captureWidgetRequestAuthority();
    api.widgetRequestAuthorityKey(snapshot);
    expect({ ...window.localStorage }).toEqual(before);
    expect(JSON.stringify(window.localStorage)).not.toContain('synthetic-memory-only-chat');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('preserves a private panel request credential and include-cookie policy', async () => {
    usePanelSessionStore.setState({ authToken: 'synthetic-admin-panel' });
    useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-citizen-chat' });
    safeLocalStorage.setItem('user', JSON.stringify({ rol: 'super_admin' }));
    await api.apiFetch('/api/me', { isWidgetRequest: false, omitTenant: true,
      omitEntityToken: true, omitChatSessionId: true, singleAttempt: true });
    expect(fetched().headers.get('Authorization')).toBe('Bearer synthetic-admin-panel');
    expect(fetched().credentials).toBe('include');
  });

  it('preserves isolated panel refusal to fall back to a chat credential', async () => {
    useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-chat' });
    await api.apiFetch('/api/me', { isWidgetRequest: false, omitTenant: true,
      omitEntityToken: true, omitChatSessionId: true, singleAttempt: true });
    expect(fetched().headers.has('Authorization')).toBe(false);
    expect(fetched().credentials).toBe('include');
  });

  it('uses the captured anonymous identity in both aliases instead of a later global identity', async () => {
    safeLocalStorage.setItem('chatboc_anon_id', 'synthetic-later-anonymous');
    await api.apiFetch('/api/widget/profile', { ...request, skipAuth: true,
      anonId: 'synthetic-captured-anonymous' });
    expect(fetched().headers.get('X-Anon-Id')).toBe('synthetic-captured-anonymous');
    expect(fetched().headers.get('Anon-Id')).toBe('synthetic-captured-anonymous');
    expect(safeLocalStorage.getItem('chatboc_anon_id')).toBe('synthetic-later-anonymous');
  });

  it.each(['', 'short', 'bad\nidentity', 'bad identity', 'x'.repeat(129)])(
    'rejects an invalid captured anonymous identity before HTTP without legacy fallback: %j', async anonId => {
      safeLocalStorage.setItem('chatboc_anon_id', 'synthetic-valid-global-anonymous');
      await expect(api.apiFetch('/api/widget/profile', { ...request, anonId }))
        .rejects.toThrow('Invalid captured anonymous identity');
      expect(global.fetch).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, null])('keeps legacy anonymous resolution when the captured anonymous option is %j', async anonId => {
    safeLocalStorage.setItem('chatboc_anon_id', 'synthetic-legacy-anonymous');
    await api.apiFetch('/api/widget/profile', { ...request, skipAuth: true, anonId });
    expect(fetched().headers.get('X-Anon-Id')).toBe('synthetic-legacy-anonymous');
  });
});
