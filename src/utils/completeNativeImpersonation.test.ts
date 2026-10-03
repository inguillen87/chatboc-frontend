import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {safeLocalStorage,safeSessionStorage} from './safeLocalStorage';
import {usePanelSessionStore,useWidgetSessionStore} from '@/stores';
import {clearLocalChatbocSession,logoutChatbocSession} from './sessionLogout';
import {captureChatbocSessionRevision,advanceChatbocSessionRevision} from './chatbocSessionRevision';
import {registerSessionRetirement,captureSessionRetirement,registerActiveClerkIdentity,isClerkSessionRetired} from './sessionRetirement';
import {hasSelectedNativePanelImpersonation} from './nativePanelSelection';
import {retirementProof,retirementReceipt} from '../../tests/fixtures/session-retirement.synthetic';
const mocks=vi.hoisted(()=>({issue:vi.fn(),ready:vi.fn()}));
vi.mock('@/api/client',()=>({apiClient:{superAdminImpersonate:mocks.issue}}));
vi.mock('@/utils/backendBootstrapGate',()=>({ensureBackendRuntimeReady:(...args:unknown[])=>mocks.ready(...args)}));
vi.mock('@/config',async original=>({...await original<typeof import('@/config')>(),API_BASE_CANDIDATES:['/api'],BASE_API_URL:'/api',SAME_ORIGIN_PROXY_BASE:'/api'}));
vi.mock('@/utils/api',async()=>await vi.importActual<typeof import('./api')>('./api'));
import {completeNativeImpersonation} from './completeNativeImpersonation';
const descriptor=()=>retirementProof({actor_id:'7',lineage_id:'synthetic-owner-lineage'});
const token=()=>`header.${btoa(JSON.stringify({user_id:7,auth_provider:'native',asid:'synthetic-owner-lineage',impersonated_by:99,exp:4070908800}))}.signature`;
const profile=()=>({id:7,email:'owner@example.invalid',rol:'admin',tenant_slug:'qa-native',tipo_chat:'pyme',
 session_retirement:descriptor(),session_context:{kind:'impersonation',initiated_by_actor_id:'99'}});
const deferred=<T,>()=>{let resolve!:(value:T)=>void;return{promise:new Promise<T>(r=>{resolve=r;}),resolve:(v:T)=>resolve(v)};};
beforeEach(()=>{
 safeLocalStorage.clear();safeSessionStorage.clear();clearLocalChatbocSession();
 usePanelSessionStore.getState().setAuthToken('synthetic-admin-a');usePanelSessionStore.getState().setUser({id:99,rol:'super_admin'} as any);
 useWidgetSessionStore.getState().setChatAuthToken('synthetic-widget-a');safeLocalStorage.setItem('authProvider','clerk');safeLocalStorage.setItem('clerkUserId','synthetic-clerk-a');
 registerActiveClerkIdentity('synthetic-clerk-a','synthetic-admin-sid');
 registerSessionRetirement(retirementProof({actor_id:'99',provider:'clerk',clerk_session_id:'synthetic-admin-sid',lineage_id:'synthetic-admin-lineage'}),{actorId:99,provider:'clerk',clerkSessionId:'synthetic-admin-sid'});
 mocks.issue.mockReset().mockResolvedValue({token:token(),redirect_url:'https://foreign.example.invalid/?token=unsafe',session_retirement:descriptor()});mocks.ready.mockReset().mockResolvedValue(undefined);
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(retirementReceipt({lineage_id:'synthetic-admin-lineage',provider_revocation:{status:'confirmed'}})),{headers:{'Content-Type':'application/json'}})));
 window.history.replaceState({},'','/superadmin');
});
afterEach(()=>{vi.unstubAllGlobals();safeLocalStorage.clear();safeSessionStorage.clear();clearLocalChatbocSession();registerActiveClerkIdentity('',null);window.history.replaceState({},'','/');});
describe('verified same-tab native impersonation handoff',()=>{
 it('uses real /me transport to verify native B before retiring A, without cookies or widget credentials',async()=>{
  const pending=deferred<Response>();vi.mocked(fetch).mockReturnValueOnce(pending.promise);
  const operation=completeNativeImpersonation('qa-native',()=>true);await vi.waitFor(()=>expect(fetch).toHaveBeenCalledOnce());
  expect(usePanelSessionStore.getState().authToken).toBe('synthetic-admin-a');expect(captureSessionRetirement('99')?.provider).toBe('clerk');
  const [url,init]=vi.mocked(fetch).mock.calls[0];expect(String(url)).toMatch(/\/api\/me$/);expect(init?.credentials).toBe('omit');
  const headers=new Headers(init!.headers);expect(headers.get('Authorization')).toBe(`Bearer ${token()}`);
  expect(headers.has('X-Tenant')).toBe(false);expect(headers.has('X-Entity-Token')).toBe(false);expect(headers.has('X-Chat-Session-Id')).toBe(false);
  pending.resolve(new Response(JSON.stringify(profile()),{headers:{'Content-Type':'application/json'}}));
  await expect(operation).resolves.toEqual({destination:'/t/qa-native/perfil'});
  expect(usePanelSessionStore.getState()).toMatchObject({authToken:token(),user:{id:7,rol:'admin',tenant_slug:'qa-native'}});
  expect(captureSessionRetirement('7')?.lineage_id).toBe('synthetic-owner-lineage');expect(hasSelectedNativePanelImpersonation()).toBe(true);
  expect(safeLocalStorage.getItem('authProvider')).toBeNull();expect(useWidgetSessionStore.getState().chatAuthToken).toBeNull();
  expect(isClerkSessionRetired('synthetic-clerk-a','synthetic-admin-sid')).toBe(true);
  expect(safeLocalStorage.getItem('user')).not.toContain('synthetic-proof');
  expect(fetch).toHaveBeenCalledTimes(2);expect(vi.mocked(fetch).mock.calls[1][0]).toBe('/api/v2/auth/sessions/retire');
  await logoutChatbocSession();expect(hasSelectedNativePanelImpersonation()).toBe(false);expect(usePanelSessionStore.getState().authToken).toBeNull();
 });
 it.each([
  {session_retirement:retirementProof({actor_id:'8'})},
  {session_retirement:retirementProof({provider:'clerk',clerk_session_id:'foreign'})},
  {session_retirement:retirementProof({lineage_id:'foreign'})},
  {session_context:{kind:'impersonation',initiated_by_actor_id:'100'}},
  {session_context:null},{tenant_slug:'foreign'},
 ])('rejects incompatible /me evidence and preserves admin A (%j)',async patch=>{
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({...profile(),...patch}),{headers:{'Content-Type':'application/json'}}));
  const revision=captureChatbocSessionRevision();await expect(completeNativeImpersonation('qa-native',()=>true)).rejects.toBeInstanceOf(Error);
  expect(captureChatbocSessionRevision()).toBe(revision);expect(usePanelSessionStore.getState().authToken).toBe('synthetic-admin-a');
  expect(captureSessionRetirement('99')?.provider).toBe('clerk');expect(hasSelectedNativePanelImpersonation()).toBe(false);expect(fetch).toHaveBeenCalledOnce();
 });
 it('cannot overwrite newer session C while candidate B verification is in flight',async()=>{
  const pending=deferred<Response>();vi.mocked(fetch).mockReturnValueOnce(pending.promise);const operation=completeNativeImpersonation('qa-native',()=>true);
  await vi.waitFor(()=>expect(fetch).toHaveBeenCalledOnce());advanceChatbocSessionRevision();usePanelSessionStore.getState().setAuthToken('synthetic-c');usePanelSessionStore.getState().setUser({id:100} as any);
  pending.resolve(new Response(JSON.stringify(profile()),{headers:{'Content-Type':'application/json'}}));await expect(operation).rejects.toMatchObject({name:'AbortError'});
  expect(usePanelSessionStore.getState()).toMatchObject({authToken:'synthetic-c',user:{id:100}});expect(fetch).toHaveBeenCalledOnce();
 });
 it('does not query candidate /me or change A after an unsupported provider response',async()=>{
  mocks.issue.mockRejectedValue({status:403,body:{reason_code:'impersonation_provider_unsupported'}});
  await expect(completeNativeImpersonation('qa-native',()=>true)).rejects.toMatchObject({status:403});expect(fetch).not.toHaveBeenCalled();expect(usePanelSessionStore.getState().authToken).toBe('synthetic-admin-a');
 });
});
