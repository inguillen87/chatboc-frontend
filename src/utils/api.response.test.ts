import {afterEach,beforeAll,beforeEach,describe,expect,it,vi} from 'vitest';
import {safeLocalStorage} from './safeLocalStorage';
import {usePanelSessionStore,useTenantStore,useWidgetSessionStore} from '@/stores';
import {advanceChatbocSessionRevision} from './chatbocSessionRevision';
const mocks=vi.hoisted(()=>({ready:vi.fn()}));
vi.mock('@/utils/backendBootstrapGate',()=>({ensureBackendRuntimeReady:(...args:unknown[])=>mocks.ready(...args)}));
vi.mock('@/config',async original=>({...await original<typeof import('@/config')>(),API_BASE_CANDIDATES:['/api'],BASE_API_URL:'/api',SAME_ORIGIN_PROXY_BASE:'/api'}));
vi.mock('@/utils/api',async()=>await vi.importActual<typeof import('./api')>('./api'));
let apiFetch:typeof import('./api').apiFetch;
const originalFetch=global.fetch;
const options={responseType:'response' as const,tenantSlug:'qa-knowledge',persistTenantSlug:false,omitEntityToken:true,omitChatSessionId:true,isWidgetRequest:false,singleAttempt:true,allowStartupRecovery:true,preserveAuthOn401:true,suppressPanel401Redirect:true};
const path='/api/admin/tenants/qa-knowledge/institutional-assistant/sources/synthetic?revision='+ 'b'.repeat(64);
const deferred=()=>{let resolve!:(value:any)=>void;return {promise:new Promise<any>(r=>{resolve=r;}),resolve:(value:any)=>resolve(value)};};
beforeAll(async()=>{apiFetch=(await vi.importActual<typeof import('./api')>('./api')).apiFetch;});
beforeEach(()=>{safeLocalStorage.clear();usePanelSessionStore.setState({authToken:null,user:null});useWidgetSessionStore.setState({chatAuthToken:null,entityToken:null});useTenantStore.getState().clearTenant();
 window.history.replaceState({},'','/admin/knowledge?tenant_slug=qa-knowledge');safeLocalStorage.setItem('authProvider','clerk');safeLocalStorage.setItem('clerkSessionTransport','cookie');safeLocalStorage.setItem('clerkUserId','synthetic-actor-a');mocks.ready.mockReset().mockResolvedValue(undefined);});
afterEach(()=>{global.fetch=originalFetch;vi.restoreAllMocks();safeLocalStorage.clear();usePanelSessionStore.setState({authToken:null,user:null});useWidgetSessionStore.setState({chatAuthToken:null,entityToken:null});useTenantStore.getState().clearTenant();window.history.replaceState({},'','/');});
describe('explicit raw API response mode',()=>{
 it('returns the authenticated response without decoding or logging its private bytes',async()=>{
  const response=new Response('PRIVATE_BINARY_SENTINEL',{headers:{'Content-Type':'application/pdf'}});const read=vi.spyOn(response,'text');
  const logs=vi.spyOn(console,'log').mockImplementation(()=>{});const debug=vi.spyOn(console,'debug').mockImplementation(()=>{});
  global.fetch=vi.fn().mockResolvedValue(response);safeLocalStorage.setItem('entityToken','synthetic-widget');
  const result=await apiFetch(path,options);expect(result).toBe(response);expect(result.bodyUsed).toBe(false);expect(read).not.toHaveBeenCalled();
  expect(JSON.stringify([...logs.mock.calls,...debug.mock.calls])).not.toContain('PRIVATE_BINARY_SENTINEL');
  expect(global.fetch).toHaveBeenCalledOnce();const init=vi.mocked(global.fetch).mock.calls[0][1]!;
  expect(init.credentials).toBe('include');const headers=new Headers(init.headers);expect(headers.get('X-Tenant-Slug')).toBe('qa-knowledge');
  expect(headers.has('X-Entity-Token')).toBe(false);expect(headers.has('X-Token')).toBe(false);expect(headers.has('X-Chat-Session')).toBe(false);
 });
 it('preserves the ordinary JSON default',async()=>{global.fetch=vi.fn().mockResolvedValue(new Response('{"value":7}',{headers:{'Content-Type':'application/json'}}));await expect(apiFetch('/api/me',{...options,responseType:'json'})).resolves.toEqual({value:7});});
 it('uses the selected panel Bearer and preserves it after a document access denial',async()=>{
  usePanelSessionStore.getState().setAuthToken('synthetic-panel-token');
  const response=new Response('PRIVATE_BINARY_DENIAL',{status:401,headers:{'Content-Type':'application/json'}});const body=vi.spyOn(response,'text');
  global.fetch=vi.fn().mockResolvedValue(response);
  await expect(apiFetch(path,options)).rejects.toMatchObject({status:401});
  const headers=new Headers(vi.mocked(global.fetch).mock.calls[0][1]!.headers);
  expect(headers.get('Authorization')).toBe('Bearer synthetic-panel-token');expect(usePanelSessionStore.getState().authToken).toBe('synthetic-panel-token');
  expect(body).not.toHaveBeenCalled();expect(global.fetch).toHaveBeenCalledOnce();
 });
 it.each([401,403,404,412])('keeps status %i terminal and reports the same API error contract',async status=>{
  global.fetch=vi.fn().mockResolvedValue(new Response('{"reason_code":"denied"}',{status,headers:{'Content-Type':'application/json'}}));
  await expect(apiFetch(path,options)).rejects.toMatchObject({status});expect(global.fetch).toHaveBeenCalledOnce();
 });
 it.each(['application/pdf','application/json'])('does not decode an error body labelled %s or include private bytes in the error',async mime=>{
  const response=new Response('PRIVATE_BINARY_DENIAL',{status:403,headers:{'Content-Type':mime}});const body=vi.spyOn(response,'text');global.fetch=vi.fn().mockResolvedValue(response);
  const error=await apiFetch(path,options).catch(cause=>cause);expect(error).toMatchObject({status:403});expect(body).not.toHaveBeenCalled();expect(JSON.stringify(error)).not.toContain('PRIVATE_BINARY_DENIAL');
 });
 it('does not dispatch A after B replaces its identity during readiness',async()=>{
  const pending=deferred();mocks.ready.mockReturnValue(pending.promise);global.fetch=vi.fn();const read=apiFetch(path,options);
  safeLocalStorage.setItem('clerkUserId','synthetic-actor-b');pending.resolve(undefined);await expect(read).rejects.toMatchObject({name:'AbortError'});expect(global.fetch).not.toHaveBeenCalled();
 });
 it('does not hand over a late A response to B or read its body',async()=>{
  const pending=deferred();global.fetch=vi.fn().mockReturnValue(pending.promise);const read=apiFetch(path,options);
  await vi.waitFor(()=>expect(global.fetch).toHaveBeenCalledOnce());const response=new Response('PRIVATE_A_BYTES');const body=vi.spyOn(response,'text');
  safeLocalStorage.setItem('clerkUserId','synthetic-actor-b');pending.resolve(response);await expect(read).rejects.toMatchObject({name:'AbortError'});expect(body).not.toHaveBeenCalled();expect(global.fetch).toHaveBeenCalledOnce();
 });
 it('retires logout/login as the same actor without decoding the previous response',async()=>{
  const pending=deferred();global.fetch=vi.fn().mockReturnValue(pending.promise);const read=apiFetch(path,options);await vi.waitFor(()=>expect(global.fetch).toHaveBeenCalledOnce());
  advanceChatbocSessionRevision();pending.resolve(new Response('OLD_SESSION_BYTES'));await expect(read).rejects.toMatchObject({name:'AbortError'});expect(global.fetch).toHaveBeenCalledOnce();
 });
});
