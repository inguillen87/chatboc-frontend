import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { useTenantNotificationSettings } from './useTenantNotificationSettings';

vi.mock('@/api/client', async () => await vi.importActual('@/api/client'));
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/utils/backendBootstrapGate', () => ({ ensureBackendRuntimeReady: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: vi.fn().mockResolvedValue('synthetic-visitor') }));

// Real hook, endpoint adapter, HTTP orchestration and session/tenant stores.
// Only identity and local fetch responses are synthetic; external traffic is forbidden.
const originalFetch = global.fetch;
const deferred = <T,>() => {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const dto = (slug: string, preferences: Record<string, unknown> = {
  email: slug === 'qa-a', telegram: false, whatsapp: false, digest: { hour: 8 },
}) => ({ contract_version: 'notifications.hooks.v1', tenant: { id: slug === 'qa-a' ? 701 : 702, slug },
  preferences, triggers: [], delivery: { owner_phone: `synthetic-phone-${slug}`, telegram_chat_id: `synthetic-chat-${slug}` } });
const legacy = (slug: string) => ({ owner_phone: `synthetic-phone-${slug}`, telegram_chat_id: `synthetic-chat-${slug}`,
  notification_settings: dto(slug).preferences });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
});
type Call = { path: string; tenant: string | null; method: string; body?: unknown };
let calls: Call[];
const installFetch = (answer: (call: Call) => Response | Promise<Response>) => {
  global.fetch = vi.fn(async (input, init) => {
    const url = new URL(String(input), window.location.origin);
    if (url.origin !== window.location.origin) throw new Error('External fixture traffic forbidden');
    const call: Call = { path: url.pathname, tenant: new Headers(init?.headers).get('X-Tenant-Slug'),
      method: init?.method || 'GET', ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) };
    calls.push(call);
    if (call.path !== '/api/v2/notifications/hooks' && !/^\/api\/admin\/tenants\/qa-[ab]\/notifications$/.test(call.path)) {
      throw new Error('Unexpected fixture fetch path: ' + call.path);
    }
    return answer(call);
  });
};
const isLegacy = (call: Call) => call.path.startsWith('/api/admin/tenants/');
const writes = () => calls.filter(call => ['POST', 'PUT'].includes(call.method));
const ready = (result: { current: ReturnType<typeof useTenantNotificationSettings> }) =>
  waitFor(() => expect(result.current.canEdit).toBe(true));
beforeEach(() => {
  vi.clearAllMocks(); calls = []; safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: 'synthetic-panel-session', user: { id: 42 } as any });
  safeLocalStorage.setItem('authToken', 'synthetic-panel-session');
  safeLocalStorage.setItem('user', JSON.stringify({ id: 42 }));
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  useTenantStore.getState().setTenant('qa-a');
});
afterEach(() => {
  cleanup(); global.fetch = originalFetch; vi.restoreAllMocks(); safeLocalStorage.clear();
  useTenantStore.getState().clearTenant();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
});

describe('PYME notification attempts with real HTTP orchestration', () => {
  for (const phase of ['read', 'save'] as const) {
    for (const retirement of ['A→B', 'A→B→A', 'unmount', 'session revision'] as const) {
      it(`does not start legacy ${phase === 'read' ? 'GET' : 'PUT'} after ${phase} retirement: ${retirement}`, async () => {
        const pending = deferred<Response>(); let delayed = false;
        installFetch(call => {
          if (isLegacy(call)) return json(call.method === 'PUT' ? { status: 'ok' } : legacy(call.tenant!));
          if (!delayed && call.tenant === 'qa-a' && call.method === (phase === 'read' ? 'GET' : 'POST')) {
            delayed = true; return pending.promise;
          }
          return json(dto(call.tenant!));
        });
        const { result, rerender, unmount } = renderHook(({ tenant, scopeKey }) => useTenantNotificationSettings(tenant, scopeKey),
          { initialProps: { tenant: 'qa-a', scopeKey: 'scope-qa-a' } });
        let savePromise: Promise<'saved' | 'failed' | 'retired'> | undefined;
        if (phase === 'save') {
          await ready(result); act(() => result.current.setPreference('email', false));
          act(() => { savePromise = result.current.save(); });
        }
        await waitFor(() => expect(delayed).toBe(true));
        if (retirement === 'unmount') unmount();
        else if (retirement === 'session revision') act(() => { advanceChatbocSessionRevision(); });
        else {
          act(() => { useTenantStore.getState().setTenant('qa-b'); rerender({ tenant: 'qa-b', scopeKey: 'scope-qa-b' }); });
          await ready(result); expect(result.current.draft.notification_settings.email).toBe(false);
          if (retirement === 'A→B→A') {
            act(() => { useTenantStore.getState().setTenant('qa-a'); rerender({ tenant: 'qa-a', scopeKey: 'scope-qa-a' }); });
            await ready(result); expect(result.current.draft.notification_settings.email).toBe(true);
          }
        }
        await act(async () => {
          pending.resolve(json({ error: 'synthetic unsupported route' }, 404)); await pending.promise;
          if (savePromise) expect(await savePromise).toBe('retired');
        });
        expect(calls.filter(isLegacy)).toHaveLength(0);
        expect(writes()).toHaveLength(phase === 'save' ? 1 : 0);
        if (retirement === 'A→B' || retirement === 'A→B→A') {
          expect(result.current.canEdit).toBe(true); expect(result.current.error).toBeNull();
          expect(result.current.draft.owner_phone).toBe(`synthetic-phone-${retirement === 'A→B' ? 'qa-b' : 'qa-a'}`);
        }
      });
    }
  }

  it('preserves a current-scope legacy GET and PUT with hidden preferences and destinations', async () => {
    installFetch(call => !isLegacy(call) ? json({ error: 'unsupported' }, 404)
      : json(call.method === 'PUT' ? { status: 'ok' } : legacy(call.tenant!)));
    const { result } = renderHook(() => useTenantNotificationSettings('qa-a', 'scope-qa-a', 701));
    await ready(result); expect(result.current.draft.notification_settings.digest).toEqual({ hour: 8 });
    act(() => result.current.setPreference('email', false));
    await act(async () => { expect(await result.current.save()).toBe('saved'); });
    expect(calls.map(call => call.method)).toEqual(['GET', 'GET', 'POST', 'PUT']);
    expect(calls[3]).toMatchObject({ path: '/api/admin/tenants/qa-a/notifications', tenant: 'qa-a', body: {
      owner_phone: 'synthetic-phone-qa-a', telegram_chat_id: 'synthetic-chat-qa-a',
      notification_settings: { email: false, telegram: false, whatsapp: false, digest: { hour: 8 } },
    } });
    expect(result.current.error).toBeNull();
  });

  for (const failure of ['malformed ACK', 'lost POST'] as const) {
    it(`preserves the edited draft after ${failure} and requires an explicit save retry`, async () => {
      let posted = false;
      installFetch(call => {
        if (call.method === 'GET') return json(dto(call.tenant!));
        if (!posted) {
          posted = true;
          if (failure === 'lost POST') return Promise.reject(new TypeError('synthetic lost response'));
          return json({ error: 'synthetic private malformed ACK' });
        }
        return json(dto(call.tenant!, { email: false, telegram: false, whatsapp: false }));
      });
      const { result } = renderHook(() => useTenantNotificationSettings('qa-a', 'scope-qa-a'));
      await ready(result); act(() => result.current.setPreference('email', false));
      const edited = result.current.draft;
      await act(async () => { expect(await result.current.save()).toBe('failed'); });
      expect(result.current.draft).toEqual(edited); expect(result.current.canEdit).toBe(true);
      expect(result.current.error).not.toContain('synthetic'); expect(writes()).toHaveLength(1);
      expect(calls.filter(isLegacy)).toHaveLength(0);
      await act(async () => { expect(await result.current.save()).toBe('saved'); });
      expect(writes()).toHaveLength(2);
      expect(writes()[1].body).toEqual({ preferences: { email: false } });
    });
  }

  it('keeps a legitimate initial empty DTO and null destinations on a channel-only save', async () => {
    installFetch(call => json({ ...dto(call.tenant!, call.method === 'POST' ? { email: false } : {}),
      delivery: { owner_phone: null, telegram_chat_id: null } }));
    const { result } = renderHook(() => useTenantNotificationSettings('qa-a', 'scope-qa-a'));
    await ready(result); expect(result.current.draft.owner_phone).toBeNull(); expect(result.current.draft.telegram_chat_id).toBeNull();
    act(() => result.current.setPreference('email', false));
    await act(async () => { expect(await result.current.save()).toBe('saved'); });
    expect(writes()[0].body).toEqual({ preferences: { email: false } });
    expect(calls.filter(isLegacy)).toHaveLength(0);
  });

  it('rejects a canonical read whose tenant ID differs from the published organization', async () => {
    installFetch(call => json({ ...dto(call.tenant!), tenant: { id: 999, slug: call.tenant } }));
    const { result } = renderHook(() => useTenantNotificationSettings('qa-a', 'scope-qa-a', 701));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canEdit).toBe(false); expect(result.current.canRetry).toBe(true);
    expect(result.current.draft.owner_phone).toBe(''); expect(calls).toHaveLength(1);
    expect(calls.filter(isLegacy)).toHaveLength(0);
  });

  it('keeps the edited draft when a canonical ACK has the right slug but another tenant ID', async () => {
    installFetch(call => json(call.method === 'GET' ? dto(call.tenant!) : {
      ...dto(call.tenant!, { email: false }), tenant: { id: 999, slug: call.tenant },
    }));
    const { result } = renderHook(() => useTenantNotificationSettings('qa-a', 'scope-qa-a', 701));
    await ready(result); act(() => result.current.setPreference('email', false));
    const edited = result.current.draft;
    await act(async () => { expect(await result.current.save()).toBe('failed'); });
    expect(result.current.draft).toEqual(edited); expect(result.current.error).not.toBeNull();
    expect(writes()).toHaveLength(1); expect(calls.filter(isLegacy)).toHaveLength(0);
  });

  it('retires a delayed read when the published ID changes with the same slug and scope key', async () => {
    const pending = deferred<Response>(); let delayed = false;
    installFetch(call => {
      if (isLegacy(call)) return json(legacy(call.tenant!));
      if (!delayed) { delayed = true; return pending.promise; }
      return json({ ...dto(call.tenant!), tenant: { id: 702, slug: call.tenant } });
    });
    const { result, rerender } = renderHook(({ id }) => useTenantNotificationSettings('qa-a', 'same-scope', id),
      { initialProps: { id: 701 } });
    await waitFor(() => expect(delayed).toBe(true));
    rerender({ id: 702 }); await ready(result);
    await act(async () => { pending.resolve(json({ error: 'unsupported old read' }, 404)); await pending.promise; });
    expect(calls.filter(isLegacy)).toHaveLength(0); expect(calls).toHaveLength(2);
    expect(result.current.error).toBeNull(); expect(result.current.canEdit).toBe(true);
  });

  it('retires a delayed save when the published ID changes with the same slug and scope key', async () => {
    const pending = deferred<Response>(); let activeId = 701;
    installFetch(call => {
      if (isLegacy(call)) return json({ status: 'ok' });
      if (call.method === 'POST') return pending.promise;
      return json({ ...dto(call.tenant!), tenant: { id: activeId, slug: call.tenant } });
    });
    const { result, rerender } = renderHook(({ id }) => useTenantNotificationSettings('qa-a', 'same-scope', id),
      { initialProps: { id: 701 } });
    await ready(result); act(() => result.current.setPreference('email', false));
    let savePromise!: ReturnType<typeof result.current.save>;
    act(() => { savePromise = result.current.save(); });
    await waitFor(() => expect(writes()).toHaveLength(1));
    activeId = 702; rerender({ id: 702 }); await ready(result);
    expect(result.current.draft.notification_settings.email).toBe(true);
    await act(async () => {
      pending.resolve(json({ error: 'unsupported old save' }, 404)); await pending.promise;
      expect(await savePromise).toBe('retired');
    });
    expect(calls.filter(isLegacy)).toHaveLength(0); expect(writes()).toHaveLength(1);
    expect(result.current.canEdit).toBe(true); expect(result.current.error).toBeNull();
  });

  it('does not preserve the previous published-ID draft if the new identity read fails', async () => {
    installFetch(call => json(dto(call.tenant!)));
    const { result, rerender } = renderHook(({ id }) => useTenantNotificationSettings('qa-a', 'same-scope', id),
      { initialProps: { id: 701 } });
    await ready(result); act(() => result.current.setPreference('email', false));
    rerender({ id: 702 });
    await waitFor(() => expect(result.current.canRetry).toBe(true));
    expect(result.current.canEdit).toBe(false); expect(result.current.draft.owner_phone).toBe('');
    expect(result.current.draft.telegram_chat_id).toBe(''); expect(writes()).toHaveLength(0);
  });
});
