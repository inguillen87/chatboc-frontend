import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { clearLocalChatbocSession } from '@/utils/sessionLogout';
import { resetBackendBootstrapGateForTests } from '@/utils/backendBootstrapGate';

vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api', 'https://retired.example.invalid'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api',
}));
vi.mock('@/utils/api', async () => await vi.importActual<typeof import('@/utils/api')>('@/utils/api'));
import { backofficeService } from './backofficeService';

const originalFetch = global.fetch;
const session = () => usePanelSessionStore.setState({ authToken: 'synthetic-home-panel', user: { id: 'synthetic-home-actor', email: 'actor@example.invalid', rol: 'admin' } });
const publicPresentationChanges = () => {
  safeLocalStorage.setItem('tenantSlug', 'unrelated-public-tenant');
  safeLocalStorage.setItem('entityToken', 'synthetic-public-entity');
  useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-public-token' });
};
const reads = [
  { name: 'inbox', path: '/api/v2/backoffice/operations/inbox-summary', contract: 'backoffice.inbox_summary.v1',
    read: (isCurrent?: () => boolean) => backofficeService.getInboxSummary({ tenantSlug: 'panel-tenant', scope: 'municipio' }, { isCurrent }) },
  { name: 'orders', path: '/api/v2/backoffice/orders/summary', contract: 'backoffice.orders_summary.v1',
    read: (isCurrent?: () => boolean) => backofficeService.getOrdersSummary('panel-tenant', { isCurrent }) },
  { name: 'contacts', path: '/api/v2/backoffice/contacts/summary', contract: 'backoffice.contacts_summary.v1',
    read: (isCurrent?: () => boolean) => backofficeService.getContactsSummary('panel-tenant', { isCurrent }) },
  { name: 'team', path: '/api/v2/backoffice/team/coverage-summary', contract: 'backoffice.team_coverage_summary.v1',
    read: (isCurrent?: () => boolean) => backofficeService.getTeamCoverageSummary('panel-tenant', { isCurrent }) },
] as const;
const success = (url: unknown) => {
  const descriptor = reads.find(read => String(url).includes(read.path));
  if (!descriptor) throw new Error('Unexpected Home endpoint');
  return new Response(JSON.stringify({ contract_version: descriptor.contract, tenant_slug: 'panel-tenant', summary: { total: 0 } }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
const version = () => new Response('{"backend":"synthetic-sha","frontend":"web"}');
const cold = () => new Response(JSON.stringify({
  contract_version: 'chatboc.bootstrap.v1', status_code: 503, ok: false,
  reason_code: 'application_initializing', retryable: true, request_dispatched: false, action_hint: 'retry_after',
}), { status: 503, headers: { 'Content-Type': 'application/json', 'X-Chatboc-Bootstrap': 'initializing', 'Retry-After': '0' } });
const executiveBody = { tenant_slug: 'panel-tenant', resource: 'overview' as const, filters: { scope: 'municipio' } };
const exportBody = { tenant_slug: 'panel-tenant', resource: 'tickets' as const, format: 'pdf' as const, filters: { scope: 'municipio' } };
const writes = [
  { name: 'executive summary', body: executiveBody,
    write: (isCurrent: () => boolean) => backofficeService.requestExecutiveSummary(executiveBody, { isCurrent }) },
  { name: 'export', body: exportBody,
    write: (isCurrent: () => boolean) => backofficeService.requestExport(exportBody, { isCurrent }) },
] as const;

beforeEach(() => {
  safeLocalStorage.clear();
  resetBackendBootstrapGateForTests();
  useWidgetSessionStore.setState({ entityToken: null, chatAuthToken: null });
  session();
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

describe('Home summary reads through the actual private transport', () => {
  it.each(reads)('accepts the $name contract while public presentation changes', async descriptor => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    global.fetch = vi.fn().mockImplementation(async url => { publicPresentationChanges(); return success(url); });
    await expect(descriptor.read()).resolves.toMatchObject({ contract_version: descriptor.contract, tenant_slug: 'panel-tenant' });
    expect(global.fetch).toHaveBeenCalledOnce();
    const init = vi.mocked(global.fetch).mock.calls[0][1];
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer synthetic-home-panel');
    expect(headers.get('X-Tenant')).toBe('panel-tenant');
    expect(headers.has('X-Entity-Token')).toBe(false);
    expect(headers.has('X-Chat-Session')).toBe(false);
    expect(init?.credentials).toBe('include');
    expect(init?.method || 'GET').toBe('GET');
  });

  it('keeps all four reads pending through delayed startup before dispatching their scoped GETs', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
    let finishStartup!: (value: Response) => void;
    global.fetch = vi.fn().mockImplementation(async url => url === '/api/version'
      ? new Promise<Response>(resolve => { finishStartup = resolve; }) : success(url));
    const result = Promise.all(reads.map(descriptor => descriptor.read()));
    await vi.advanceTimersByTimeAsync(9_000);
    expect(global.fetch).toHaveBeenCalledOnce();
    publicPresentationChanges();
    finishStartup(version());
    await expect(result).resolves.toHaveLength(4);
    expect(global.fetch).toHaveBeenCalledTimes(5);
    expect(vi.mocked(global.fetch).mock.calls.slice(1).every(([, init]) => (init?.method || 'GET') === 'GET')).toBe(true);
  });

  it.each(['unmount', 'tenant-change', 'same-actor-relogin'] as const)('does not dispatch a Home GET after %s during startup', async change => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
    let active = true;
    global.fetch = vi.fn().mockImplementation(async () => {
      if (change === 'same-actor-relogin') { clearLocalChatbocSession(); session(); }
      else active = false;
      return version();
    });
    await expect(reads[1].read(() => active)).rejects.toThrow('Private read scope expired');
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe('/api/version');
  });

  it.each(['unmount', 'same-actor-relogin'] as const)('rejects a late HTTP200 after %s', async change => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    let active = true;
    global.fetch = vi.fn().mockImplementation(async url => {
      if (change === 'same-actor-relogin') { clearLocalChatbocSession(); session(); }
      else active = false;
      return success(url);
    });
    await expect(reads[0].read(() => active)).rejects.toMatchObject({ name: 'AbortError' });
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('preserves a terminal denial without a retry or another origin', async () => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    global.fetch = vi.fn().mockResolvedValue(new Response('{"reason_code":"forbidden"}', {
      status: 403, headers: { 'Content-Type': 'application/json' },
    }));
    await expect(reads[3].read()).rejects.toMatchObject({ status: 403 });
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it.each(writes)('sends exactly one $name POST for an undispatched startup receipt using the panel credential', async descriptor => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    safeLocalStorage.setItem('entityToken', 'synthetic-public-entity');
    useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-public-token' });
    global.fetch = vi.fn().mockResolvedValue(cold());
    await expect(descriptor.write(() => true)).rejects.toMatchObject({ status: 503 });
    expect(global.fetch).toHaveBeenCalledOnce();
    const init = vi.mocked(global.fetch).mock.calls[0][1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual(descriptor.body);
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer synthetic-home-panel');
    expect(headers.get('X-Tenant')).toBe('panel-tenant');
    expect(headers.has('X-Entity-Token')).toBe(false);
    expect(headers.has('X-Chat-Session')).toBe(false);
  });

  it.each(writes)('does not dispatch a $name POST after session retirement during startup', async descriptor => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
    global.fetch = vi.fn().mockImplementation(async () => { clearLocalChatbocSession(); session(); return version(); });
    await expect(descriptor.write(() => true)).rejects.toMatchObject({ name: 'AbortError' });
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe('/api/version');
  });

  it.each(writes)('does not dispatch a $name POST after the caller unmounts during startup', async descriptor => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
    let active = true;
    global.fetch = vi.fn().mockImplementation(async () => { active = false; return version(); });
    await expect(descriptor.write(() => active)).rejects.toMatchObject({ name: 'AbortError' });
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe('/api/version');
  });
});
