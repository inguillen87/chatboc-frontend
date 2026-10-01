import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { resetBackendBootstrapGateForTests } from './backendBootstrapGate';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import { safeLocalStorage } from './safeLocalStorage';
import { clearLocalChatbocSession } from './sessionLogout';
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api','https://retired.example.invalid'], BASE_API_URL:'/api', SAME_ORIGIN_PROXY_BASE:'/api',
}));
vi.mock('@/utils/api', async () => await vi.importActual<typeof import('./api')>('./api'));
let apiFetch: typeof import('./api').apiFetch;
let apiClient: typeof import('@/api/client').apiClient;
let panelApi: typeof import('@/api/v2/client').panelApi;
let followUpApi: typeof import('@/features/crm/followup/followUpApi').followUpApi;
const originalFetch = global.fetch;
beforeAll(async () => {
  apiFetch = (await vi.importActual<typeof import('./api')>('./api')).apiFetch;
  apiClient = (await vi.importActual<typeof import('@/api/client')>('@/api/client')).apiClient;
  panelApi = (await vi.importActual<typeof import('@/api/v2/client')>('@/api/v2/client')).panelApi;
  followUpApi = (await vi.importActual<typeof import('@/features/crm/followup/followUpApi')>('@/features/crm/followup/followUpApi')).followUpApi;
});
beforeEach(() => {
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
});
afterEach(() => {
  global.fetch = originalFetch; vi.unstubAllEnvs(); resetBackendBootstrapGateForTests();
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
});
const cold = () => new Response(JSON.stringify({ contract_version:'chatboc.bootstrap.v1',
  status_code:503, ok:false, reason_code:'application_initializing', retryable:true,
  request_dispatched:false, action_hint:'retry_after',
}), { status:503, headers:{ 'Content-Type':'application/json','X-Chatboc-Bootstrap':'initializing','Retry-After':'0' } });
it.each(['GET','POST'] as const)('actual apiFetch recovers %s without leaving the selected backend', async method => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED','false');
  const path = method === 'POST' ? '/api/auth/clerk/session' : '/api/admin/tenants';
  let business = 0;
  global.fetch = vi.fn().mockImplementation(async url => {
    if (url === '/api/version') return new Response('{"backend":"sha","frontend":"web"}');
    business += 1;
    return business === 1 ? cold() : new Response('{"data":"verified"}', { headers:{'Content-Type':'application/json'} });
  });
  await expect(apiFetch(path,{method,skipAuth:true,body:method==='POST'?{intent:'tenant_owner'}:undefined})).resolves.toEqual({data:'verified'});
  const calls=vi.mocked(global.fetch).mock.calls;
  expect(calls.map(call=>call[0])).toEqual([path,'/api/version',path]);
  if(method==='POST')expect(calls[2][1]?.body).toEqual(calls[0][1]?.body);
});
it('never tries an alternate API after an ambiguous Clerk network failure', async () => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED','false');
  global.fetch = vi.fn().mockRejectedValue(new TypeError('network'));
  await expect(apiFetch('/api/auth/clerk/session',{method:'POST',skipAuth:true,body:{intent:'tenant_owner'}})).rejects.toThrow('network');
  expect(global.fetch).toHaveBeenCalledOnce();
});
it('does not automatically repeat a business mutation after a cold receipt', async () => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED','false');
  global.fetch = vi.fn().mockImplementation(async () => cold());
  await expect(apiFetch('/api/orders',{method:'POST',skipAuth:true,body:{id:1}})).rejects.toMatchObject({status:503});
  expect(global.fetch).toHaveBeenCalledOnce();
});
it('cancels a stale Clerk exchange while waiting without another request', async () => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED','false');
  const controller = new AbortController();
  global.fetch = vi.fn().mockImplementation(async () => { setTimeout(()=>controller.abort(),20); return cold(); });
  await expect(apiFetch('/api/auth/clerk/session',{method:'POST',skipAuth:true,signal:controller.signal})).rejects.toMatchObject({name:'AbortError'});
  expect(global.fetch).toHaveBeenCalledOnce();
});
it('surfaces an exhausted cold response without trying the retired backend', async () => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED','false');
  global.fetch = vi.fn().mockImplementation(async url => url === '/api/version'
    ? new Response('{"backend":"sha","frontend":"web"}') : cold());
  await expect(apiFetch('/api/admin/tenants',{skipAuth:true})).rejects.toMatchObject({status:503});
  expect(vi.mocked(global.fetch).mock.calls.every(call=>!String(call[0]).includes('retired'))).toBe(true);
});

const pinnedKnowledgeOptions = {
  tenantSlug: 'qa-knowledge', persistTenantSlug: false, isWidgetRequest: false,
  omitEntityToken: true, omitChatSessionId: true, singleAttempt: true, allowStartupRecovery: true,
};
const knowledgePath = '/api/admin/tenants/qa-knowledge/institutional-assistant';
const panelCookieIdentity = () => {
  safeLocalStorage.setItem('authProvider', 'clerk');
  safeLocalStorage.setItem('clerkSessionTransport', 'cookie');
  safeLocalStorage.setItem('clerkUserId', 'synthetic-clerk-actor');
  safeLocalStorage.setItem('tenantSlug', 'actor-home');
  usePanelSessionStore.getState().setUser({ id: 'synthetic-actor', email: 'actor@example.invalid', rol: 'superadmin' });
};
const changePublicPresentationContext = () => {
  safeLocalStorage.setItem('tenantSlug', 'unrelated-public-tenant');
  useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-public-chat-token' });
};
const globalPanelOptions = { omitTenant: true, omitEntityToken: true, omitChatSessionId: true,
  isWidgetRequest: false, singleAttempt: true, allowStartupRecovery: true };
it('dispatches an isolated global directory read while public tenant and widget state change', async () => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
  panelCookieIdentity();
  safeLocalStorage.setItem('chatAuthToken', 'synthetic-public-widget-bearer');
  useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-public-widget-bearer' });
  global.fetch = vi.fn().mockImplementation(async url => {
    if (url === '/api/version') { changePublicPresentationContext(); return new Response('{"backend":"sha","frontend":"web"}'); }
    return new Response('{"tenants":[],"total":0}', { headers: { 'Content-Type': 'application/json' } });
  });
  await expect(apiFetch('/api/admin/tenants', globalPanelOptions)).resolves.toEqual({ tenants: [], total: 0 });
  const [url, init] = vi.mocked(global.fetch).mock.calls[1];
  expect(url).toBe('/api/admin/tenants');
  const headers = new Headers(init?.headers);
  expect(headers.has('X-Tenant')).toBe(false);
  expect(headers.has('Authorization')).toBe(false);
  expect(headers.has('X-Entity-Token')).toBe(false);
  expect(init?.credentials).toBe('include');
});
it.each(['token', 'same-actor-relogin'])('retires an isolated global read when authenticated %s changes', async identity => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
  panelCookieIdentity();
  global.fetch = vi.fn().mockImplementation(async () => {
    if (identity === 'token') usePanelSessionStore.setState({ authToken: 'synthetic-other-token' });
    else { clearLocalChatbocSession(); panelCookieIdentity(); }
    return new Response('{"backend":"sha","frontend":"web"}');
  });
  await expect(apiFetch('/api/admin/tenants', globalPanelOptions)).rejects.toMatchObject({ name: 'AbortError' });
  expect(global.fetch).toHaveBeenCalledOnce();
});
it.each(['directory','inventory','executive'] as const)('actual %s caller keeps global panel authority while public context initializes', async caller => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
  panelCookieIdentity();
  useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-public-widget-bearer' });
  global.fetch = vi.fn().mockImplementation(async url => {
    if (url === '/api/version') { changePublicPresentationContext(); return new Response('{"backend":"sha","frontend":"web"}'); }
    return new Response('{"verified":true}', { headers: { 'Content-Type': 'application/json' } });
  });
  const result = caller === 'directory' ? apiClient.superAdminListTenants(1,100)
    : caller === 'inventory' ? apiClient.superAdminListWhatsappNumbers()
    : panelApi.get('/api/v2/superadmin/executive-summary');
  await expect(result).resolves.toEqual({ verified: true });
  expect(global.fetch).toHaveBeenCalledTimes(2);
  const [url, init] = vi.mocked(global.fetch).mock.calls[1];
  expect(String(url)).not.toMatch(/[?&](?:tenant|tenant_slug)=/);
  expect(new Headers(init?.headers).has('X-Tenant')).toBe(false);
  expect(new Headers(init?.headers).has('Authorization')).toBe(false);
});
it('recovers a global directory cold read without acquiring public context or changing destination', async () => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  panelCookieIdentity();let reads=0;
  global.fetch = vi.fn().mockImplementation(async url => {
    if(url === '/api/version') { changePublicPresentationContext(); return new Response('{"backend":"sha","frontend":"web"}'); }
    return ++reads===1?cold():new Response('{"verified":true}', { headers: { 'Content-Type': 'application/json' } });
  });
  await expect(apiClient.superAdminListTenants()).resolves.toEqual({verified:true});
  const calls=vi.mocked(global.fetch).mock.calls;expect(calls).toHaveLength(3);
  expect(calls[0]).toEqual(calls[2]);expect(calls[1][0]).toBe('/api/version');
});
it('actual global follow-up agenda reads without inheriting parallel public context', async () => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED','true');panelCookieIdentity();
  useWidgetSessionStore.setState({chatAuthToken:'synthetic-public-widget-bearer'});
  global.fetch=vi.fn().mockImplementation(async url=>{
    if(url==='/api/version'){changePublicPresentationContext();return new Response('{"backend":"sha","frontend":"web"}');}
    return new Response('{"items":[]}',{headers:{'Content-Type':'application/json'}});
  });
  await expect(followUpApi.list()).resolves.toEqual({items:[],received:0,excluded:0});
  expect(global.fetch).toHaveBeenCalledTimes(2);const [url,init]=vi.mocked(global.fetch).mock.calls[1];
  expect(url).toBe('/api/admin/crm/leads?limit=100');expect(new Headers(init?.headers).has('Authorization')).toBe(false);
  expect(new Headers(init?.headers).has('X-Tenant')).toBe(false);
});

it('dispatches a pinned panel tenant after readiness even if public presentation context changes', async () => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
  panelCookieIdentity();
  global.fetch = vi.fn().mockImplementation(async (url) => {
    if (url === '/api/version') {
      changePublicPresentationContext();
      return new Response('{"backend":"sha","frontend":"web"}');
    }
    return new Response('{"verified":true}', { headers: { 'Content-Type': 'application/json' } });
  });

  await expect(apiFetch(knowledgePath, pinnedKnowledgeOptions)).resolves.toEqual({ verified: true });
  expect(global.fetch).toHaveBeenCalledTimes(2);
  const [url, init] = vi.mocked(global.fetch).mock.calls[1];
  expect(String(url)).toContain(knowledgePath);
  expect(new Headers(init?.headers).get('X-Tenant')).toBe('qa-knowledge');
  expect(new Headers(init?.headers).has('Authorization')).toBe(false);
  expect(new Headers(init?.headers).has('X-Entity-Token')).toBe(false);
  expect(init?.credentials).toBe('include');
  expect(safeLocalStorage.getItem('tenantSlug')).toBe('unrelated-public-tenant');
});

it('recovers a pinned knowledge GET only on the undispatched receipt, preserving URL and panel authority', async () => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  panelCookieIdentity();
  let dispatched = 0;
  global.fetch = vi.fn().mockImplementation(async (url) => {
    if (url === '/api/version') {
      changePublicPresentationContext();
      return new Response('{"backend":"sha","frontend":"web"}');
    }
    dispatched += 1;
    return dispatched === 1 ? cold() : new Response('{"verified":true}', { headers: { 'Content-Type': 'application/json' } });
  });

  await expect(apiFetch(knowledgePath, pinnedKnowledgeOptions)).resolves.toEqual({ verified: true });
  const calls = vi.mocked(global.fetch).mock.calls;
  expect(calls).toHaveLength(3);
  expect(calls[1][0]).toBe('/api/version');
  expect(calls[2][0]).toBe(calls[0][0]);
  expect(calls[2][1]).toEqual(calls[0][1]);
  expect(calls.every(([url]) => !String(url).includes('retired'))).toBe(true);
});

it.each(['panel-token', 'stored-token', 'clerk-user', 'provider', 'transport', 'panel-actor', 'stored-actor', 'same-actor-relogin'])
  ('cancels a pinned request before dispatch when authenticated %s changes during readiness', async (identity) => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
    panelCookieIdentity();
    global.fetch = vi.fn().mockImplementation(async () => {
      if (identity === 'panel-token') usePanelSessionStore.setState({ authToken: 'synthetic-new-panel-token' });
      if (identity === 'stored-token') safeLocalStorage.setItem('authToken', 'synthetic-new-stored-token');
      if (identity === 'clerk-user') safeLocalStorage.setItem('clerkUserId', 'synthetic-other-clerk-actor');
      if (identity === 'provider') safeLocalStorage.setItem('authProvider', 'other');
      if (identity === 'transport') safeLocalStorage.setItem('clerkSessionTransport', 'bearer');
      if (identity === 'panel-actor') usePanelSessionStore.setState({ user: { id: 'other-actor', email: 'other@example.invalid', rol: 'superadmin' } });
      if (identity === 'stored-actor') safeLocalStorage.setItem('user', JSON.stringify({ id: 'other-actor' }));
      if (identity === 'same-actor-relogin') { clearLocalChatbocSession(); panelCookieIdentity(); }
      return new Response('{"backend":"sha","frontend":"web"}');
    });

    await expect(apiFetch(knowledgePath, pinnedKnowledgeOptions)).rejects.toMatchObject({ name: 'AbortError' });
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe('/api/version');
  });

it('keeps a stored public chat bearer out of the pinned Clerk panel credential', async () => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  panelCookieIdentity();
  useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-public-widget-bearer' });
  safeLocalStorage.setItem('chatAuthToken', 'synthetic-public-widget-bearer');
  global.fetch = vi.fn().mockResolvedValue(new Response('{"verified":true}', { headers: { 'Content-Type': 'application/json' } }));

  await expect(apiFetch(knowledgePath, pinnedKnowledgeOptions)).resolves.toEqual({ verified: true });
  const init = vi.mocked(global.fetch).mock.calls[0][1];
  expect(init?.credentials).toBe('include');
  expect(new Headers(init?.headers).has('Authorization')).toBe(false);
  expect(new Headers(init?.headers).has('X-Entity-Token')).toBe(false);
  expect(safeLocalStorage.getItem('chatAuthToken')).toBe('synthetic-public-widget-bearer');
});

it.each(['token', 'same-actor-relogin'])('cancels pinned GET recovery when authenticated %s changes after the cold receipt', async (identity) => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  panelCookieIdentity();
  global.fetch = vi.fn().mockImplementation(async (url) => {
    if (url === '/api/version') {
      if (identity === 'token') usePanelSessionStore.setState({ authToken: 'synthetic-other-token' });
      else { clearLocalChatbocSession(); panelCookieIdentity(); }
      return new Response('{"backend":"sha","frontend":"web"}');
    }
    return cold();
  });
  await expect(apiFetch(knowledgePath, pinnedKnowledgeOptions)).rejects.toMatchObject({ name: 'AbortError' });
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(vi.mocked(global.fetch).mock.calls[1][0]).toBe('/api/version');
});

it('still retires an implicit tenant request when the presentation tenant changes before dispatch', async () => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
  panelCookieIdentity();
  global.fetch = vi.fn().mockImplementation(async () => {
    changePublicPresentationContext();
    return new Response('{"backend":"sha","frontend":"web"}');
  });
  await expect(apiFetch('/api/cart', { singleAttempt: true })).rejects.toMatchObject({ name: 'AbortError' });
  expect(global.fetch).toHaveBeenCalledOnce();
});

it.each(['PUT', 'POST'] as const)('keeps pinned knowledge %s single-attempt even if startup recovery is requested', async (method) => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  panelCookieIdentity();
  global.fetch = vi.fn().mockImplementation(async () => cold());
  await expect(apiFetch(knowledgePath, { ...pinnedKnowledgeOptions, method, body: { revision: 'synthetic' } }))
    .rejects.toMatchObject({ status: 503 });
  expect(global.fetch).toHaveBeenCalledOnce();
});

it.each([403, 503])('does not replay or leave the selected backend on a pinned GET HTTP %s without an undispatched receipt', async (status) => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  panelCookieIdentity();
  global.fetch = vi.fn().mockResolvedValue(new Response('{"reason_code":"request_failed"}', { status, headers: { 'Content-Type': 'application/json' } }));
  await expect(apiFetch(knowledgePath, pinnedKnowledgeOptions)).rejects.toMatchObject({ status });
  expect(global.fetch).toHaveBeenCalledOnce();
});

it('does not replay or leave the selected backend after an ambiguous pinned GET network failure', async () => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  panelCookieIdentity();
  global.fetch = vi.fn().mockRejectedValue(new TypeError('network response lost'));
  await expect(apiFetch(knowledgePath, pinnedKnowledgeOptions)).rejects.toThrow('network response lost');
  expect(global.fetch).toHaveBeenCalledOnce();
});
