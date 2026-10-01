import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { resetBackendBootstrapGateForTests } from './backendBootstrapGate';
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api','https://retired.example.invalid'], BASE_API_URL:'/api', SAME_ORIGIN_PROXY_BASE:'/api',
}));
let apiFetch: typeof import('./api').apiFetch;
const originalFetch = global.fetch;
beforeAll(async () => { apiFetch = (await vi.importActual<typeof import('./api')>('./api')).apiFetch; });
afterEach(() => { global.fetch = originalFetch; vi.unstubAllEnvs(); resetBackendBootstrapGateForTests(); });
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
