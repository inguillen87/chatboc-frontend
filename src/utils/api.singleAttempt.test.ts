import {afterEach,beforeAll,describe,it,expect,vi} from 'vitest';
import {resetBackendBootstrapGateForTests} from './backendBootstrapGate';
vi.mock('@/config',async(importOriginal)=>({...await importOriginal<typeof import('@/config')>(),API_BASE_CANDIDATES:['/api','https://other-backend.example.invalid'],BASE_API_URL:'/api',SAME_ORIGIN_PROXY_BASE:'/api'}));
let apiFetch:typeof import('./api').apiFetch;const originalFetch=global.fetch;
beforeAll(async()=>{apiFetch=(await vi.importActual<typeof import('./api')>('./api')).apiFetch;});
afterEach(()=>{global.fetch=originalFetch;vi.restoreAllMocks();vi.unstubAllEnvs();resetBackendBootstrapGateForTests();});
const path='/api/admin/tenants/guide-control-qa/conversation-guide-control';
describe('single-attempt transport',()=>{
 it.each(['GET','PUT'] as const)('never retries a network rejection for %s',async method=>{
  global.fetch=vi.fn().mockRejectedValue(new TypeError('network response lost'));
  await expect(apiFetch(path,{method,singleAttempt:true,tenantSlug:'guide-control-qa',body:method==='PUT'?{enabled:true}:undefined})).rejects.toThrow();
  expect(global.fetch).toHaveBeenCalledOnce();expect(vi.mocked(global.fetch).mock.calls[0][1]).toMatchObject({method,redirect:'error'});
 });
 it.each([404,502,503])('never switches path or base on HTTP %s',async status=>{
  global.fetch=vi.fn().mockResolvedValue(new Response('{"reason_code":"request_failed"}',{status,headers:{'Content-Type':'application/json'}}));
  await expect(apiFetch(path,{method:'PUT',singleAttempt:true,baseUrlOverride:'https://primary.example.invalid',allowSafeBaseFallback:true})).rejects.toMatchObject({status});
  expect(global.fetch).toHaveBeenCalledOnce();expect(vi.mocked(global.fetch).mock.calls[0][0]).toContain('https://primary.example.invalid/api/admin/tenants/');
 });
 it('does not resend when a proxy returns the HTML shell instead of a receipt',async()=>{
  global.fetch=vi.fn().mockResolvedValue(new Response('<html>shell</html>',{status:200,headers:{'Content-Type':'text/html'}}));
  await expect(apiFetch(path,{method:'PUT',singleAttempt:true,suppressInvalidJsonWarning:true})).rejects.toThrow();
  expect(global.fetch).toHaveBeenCalledOnce();
 });
 it('keeps the original authentication, tenant and request headers',async()=>{
  global.fetch=vi.fn().mockResolvedValue(new Response('{"ok":true}',{headers:{'Content-Type':'application/json'}}));
  await expect(apiFetch(path,{method:'PUT',singleAttempt:true,tenantSlug:'guide-control-qa',headers:{'X-Chatboc-Guide-Control':'1'},body:{enabled:true}})).resolves.toEqual({ok:true});
  expect(global.fetch).toHaveBeenCalledOnce();const init=vi.mocked(global.fetch).mock.calls[0][1]!;
  expect(init.credentials).toBe('include');expect(init.redirect).toBe('error');expect(init.headers).toMatchObject({'X-Chatboc-Guide-Control':'1','X-Tenant':'guide-control-qa'});expect(JSON.parse(init.body as string)).toEqual({enabled:true});
 });
});
