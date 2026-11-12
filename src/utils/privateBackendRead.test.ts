import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import { resetBackendBootstrapGateForTests } from './backendBootstrapGate';
import { clearLocalChatbocSession } from './sessionLogout';
import { safeLocalStorage } from './safeLocalStorage';

vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api', 'https://retired.example.invalid'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api',
}));
vi.mock('@/utils/api', async () => await vi.importActual<typeof import('./api')>('./api'));
import { privateBackendRead } from './privateBackendRead';

const originalFetch = global.fetch;
const establishPanelSession = () => {
  usePanelSessionStore.setState({ authToken: 'synthetic-panel-session', user: {
    id: 'synthetic-actor', email: 'actor@example.invalid', rol: 'admin',
  } });
};
const publicPresentationChanges = () => {
  safeLocalStorage.setItem('tenantSlug', 'unrelated-public-tenant');
  safeLocalStorage.setItem('entityToken', 'synthetic-public-entity');
  useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-public-token' });
};
const success = () => new Response('{"verified":true}', { headers: { 'Content-Type': 'application/json' } });
const version = () => new Response('{"backend":"synthetic-sha","frontend":"web"}');
const cold = () => new Response(JSON.stringify({ contract_version: 'chatboc.bootstrap.v1',
  status_code: 503, ok: false, reason_code: 'application_initializing', retryable: true,
  request_dispatched: false, action_hint: 'retry_after',
}), { status: 503, headers: { 'Content-Type': 'application/json', 'X-Chatboc-Bootstrap': 'initializing', 'Retry-After': '0' } });
const privateReads = [
  ['/api/admin/tenants/panel-tenant/provisioning-readiness', 'panel-tenant'],
  ['/api/v2/tenant-blueprints', null],
  ['/api/v2/tenants/panel-tenant/blueprints/government-core', 'panel-tenant'],
  ['/api/v2/tenants/panel-tenant/activation/channels', 'panel-tenant'],
  ['/api/v2/tenants/panel-tenant/government-readiness/jurisdiction', 'panel-tenant'],
] as const;

beforeEach(() => {
  safeLocalStorage.clear();
  resetBackendBootstrapGateForTests();
  useWidgetSessionStore.setState({ entityToken: null, chatAuthToken: null });
  establishPanelSession();
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  resetBackendBootstrapGateForTests();
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ entityToken: null, chatAuthToken: null });
});

describe('private configuration reads with the actual panel transport', () => {
  it.each(privateReads)('accepts HTTP200 at %s while public presentation changes', async (path, tenantSlug) => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    global.fetch = vi.fn().mockImplementation(async () => {
      publicPresentationChanges();
      return success();
    });

    await expect(privateBackendRead(path, tenantSlug)).resolves.toEqual({ verified: true });
    expect(global.fetch).toHaveBeenCalledOnce();
    const init = vi.mocked(global.fetch).mock.calls[0][1];
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer synthetic-panel-session');
    expect(headers.get('X-Tenant')).toBe(tenantSlug);
    expect(headers.has('X-Entity-Token')).toBe(false);
    expect(headers.has('X-Chat-Session')).toBe(false);
    expect(init?.credentials).toBe('include');
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('unrelated-public-tenant');
  });

  it('keeps the real private GET pending through a delayed readiness response without a false screen timeout', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
    let finishStartup!: (response: Response) => void;
    global.fetch = vi.fn().mockImplementation(async url => url === '/api/version'
      ? new Promise<Response>(resolve => { finishStartup = resolve; }) : success());
    const result = privateBackendRead(privateReads[0][0], 'panel-tenant');
    await vi.advanceTimersByTimeAsync(9_000);
    expect(global.fetch).toHaveBeenCalledOnce();
    publicPresentationChanges();
    finishStartup(version());
    await expect(result).resolves.toEqual({ verified: true });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(global.fetch).mock.calls[1][1]?.method || 'GET').toBe('GET');
  });

  it('recovers a receipt-backed undispatched GET with the same scope and credential', async () => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    let dispatches = 0;
    global.fetch = vi.fn().mockImplementation(async url => {
      if (url === '/api/version') {
        publicPresentationChanges();
        return version();
      }
      return ++dispatches === 1 ? cold() : success();
    });
    await expect(privateBackendRead(privateReads[2][0], 'panel-tenant')).resolves.toEqual({ verified: true });
    const calls = vi.mocked(global.fetch).mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[1][0]).toBe('/api/version');
    expect(calls[2]).toEqual(calls[0]);
    expect(calls.every(([url]) => !String(url).includes('retired'))).toBe(true);
  });

  it.each(['unmount', 'same-actor-relogin'] as const)('does not dispatch after %s during readiness', async change => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
    let active = true;
    global.fetch = vi.fn().mockImplementation(async () => {
      if (change === 'unmount') active = false;
      else { clearLocalChatbocSession(); establishPanelSession(); }
      return version();
    });
    await expect(privateBackendRead(privateReads[0][0], 'panel-tenant', { isCurrent: () => active }))
      .rejects.toThrow('Private read scope expired');
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe('/api/version');
  });

  it('retires a late HTTP200 when the actor logs out and returns as the same actor', async () => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    global.fetch = vi.fn().mockImplementation(async () => {
      clearLocalChatbocSession(); establishPanelSession();
      return success();
    });
    await expect(privateBackendRead(privateReads[0][0], 'panel-tenant')).rejects.toMatchObject({ name: 'AbortError' });
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it.each([403, 503])('does not recover HTTP%s without a typed undispatched bootstrap receipt', async status => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    global.fetch = vi.fn().mockResolvedValue(new Response('{"reason_code":"unavailable"}', {
      status, headers: { 'Content-Type': 'application/json' },
    }));
    await expect(privateBackendRead(privateReads[0][0], 'panel-tenant')).rejects.toMatchObject({ status });
    expect(global.fetch).toHaveBeenCalledOnce();
  });
});
