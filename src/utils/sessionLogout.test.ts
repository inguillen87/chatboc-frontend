import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {usePanelSessionStore,useTenantStore,useWidgetSessionStore} from '@/stores';
import {safeLocalStorage,safeSessionStorage} from './safeLocalStorage';
import {retirementProof,retirementReceipt} from '../../tests/fixtures/session-retirement.synthetic';
import {captureChatbocSessionRevision,advanceChatbocSessionRevision} from './chatbocSessionRevision';
import {registerSessionRetirement,captureSessionRetirement,registerActiveClerkIdentity,isClerkSessionRetired,readLogoutNotice} from './sessionRetirement';
import {clearLocalChatbocSession,hasAuthenticatedChatbocSession,hasPersistedClerkSession,logoutChatbocSession,resetChatbocSessionForIdentityTransition} from './sessionLogout';
const mocks=vi.hoisted(()=>({api:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:mocks.api}));
const deferred=()=>{let resolve!:(value:Response|PromiseLike<Response>)=>void;return{promise:new Promise<Response>(r=>{resolve=r;}),resolve:(value:Response|PromiseLike<Response>)=>resolve(value)};};
const establish=(id='7',token='synthetic-a',lineage='synthetic-lineage-a')=>{
 advanceChatbocSessionRevision();usePanelSessionStore.getState().setAuthToken(token);
 usePanelSessionStore.getState().setUser({id,email:'synthetic@example.test',rol:'admin'});
 registerSessionRetirement(retirementProof({actor_id:id,lineage_id:lineage,proof:`synthetic-proof-${lineage}`}),{actorId:id,provider:'native'});
};
beforeEach(()=>{safeLocalStorage.clear();safeSessionStorage.clear();clearLocalChatbocSession();registerActiveClerkIdentity('',null);mocks.api.mockReset();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify(retirementReceipt()),{headers:{'Content-Type':'application/json'}})));});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();safeLocalStorage.clear();safeSessionStorage.clear();clearLocalChatbocSession();});
describe('exact session retirement',()=>{
 it('retires local state before the one frozen cookie-free A request completes, independently of readiness',async()=>{
  establish();const pending=deferred();vi.mocked(fetch).mockReturnValue(pending.promise);
  useWidgetSessionStore.setState({chatAuthToken:'synthetic-chat-a',entityToken:'synthetic-entity'});useTenantStore.getState().setTenant('synthetic-tenant');
  safeLocalStorage.setItem('owner_token','synthetic-owner');const revision=captureChatbocSessionRevision();
  const completion=logoutChatbocSession();
  expect(captureChatbocSessionRevision()).toBe(revision+1);expect(usePanelSessionStore.getState()).toMatchObject({authToken:null,user:null});
  expect(useWidgetSessionStore.getState()).toMatchObject({chatAuthToken:null,entityToken:null});expect(useTenantStore.getState().slug).toBeNull();expect(safeLocalStorage.getItem('owner_token')).toBeNull();
  expect(fetch).toHaveBeenCalledOnce();expect(mocks.api).not.toHaveBeenCalled();const [path,init]=vi.mocked(fetch).mock.calls[0];
  expect(path).toBe('/api/v2/auth/sessions/retire');expect(init).toMatchObject({method:'POST',credentials:'omit',redirect:'error',keepalive:true});
  expect(JSON.parse(init!.body as string)).toEqual({proof:'synthetic-proof-synthetic-lineage-a',request_id:expect.any(String)});
  expect(new Headers(init!.headers).has('Authorization')).toBe(false);expect(new Headers(init!.headers).has('X-Tenant')).toBe(false);
  pending.resolve(new Response(JSON.stringify(retirementReceipt())));await expect(completion).resolves.toEqual({status:'retired',providerStatus:'not_applicable'});
 });
 it.each(['7','8'].flatMap(actorId=>([200,401,503,'network'] as const).map(outcome=>({actorId,outcome}))))('late A $outcome cannot affect B actor $actorId',async({actorId,outcome})=>{
  establish();const pending=deferred();vi.mocked(fetch).mockReturnValue(pending.promise);const completion=logoutChatbocSession();
  const sent=vi.mocked(fetch).mock.calls[0][1]!.body;establish(actorId,'synthetic-b','synthetic-lineage-b');
  if(outcome==='network')pending.resolve(Promise.reject(new TypeError('SYNTHETIC_PRIVATE_ERROR')));
  else pending.resolve(new Response(JSON.stringify(retirementReceipt()),{status:outcome}));
  const result=await completion;expect(result.status).toBe(outcome===200?'retired':'uncertain');
  expect(usePanelSessionStore.getState()).toMatchObject({authToken:'synthetic-b',user:{id:actorId}});expect(captureSessionRetirement(actorId)?.lineage_id).toBe('synthetic-lineage-b');
  expect(vi.mocked(fetch).mock.calls[0][1]!.body).toBe(sent);expect(fetch).toHaveBeenCalledOnce();expect(readLogoutNotice()).toBeNull();
 });
 it('never invokes global Clerk signOut for native or Clerk retirement and blocks only captured Clerk SID A',async()=>{
  const signOut=vi.fn();(window as any).Clerk={signOut};establish();await logoutChatbocSession({clerkEnabled:true});expect(signOut).not.toHaveBeenCalled();
  safeLocalStorage.setItem('authProvider','clerk');safeLocalStorage.setItem('clerkUserId','synthetic-clerk-user');
  usePanelSessionStore.getState().setUser({id:'7'} as any);registerActiveClerkIdentity('synthetic-clerk-user','synthetic-sid-a');
  registerSessionRetirement(retirementProof({provider:'clerk',clerk_session_id:'synthetic-sid-a',lineage_id:'synthetic-clerk-lineage'}),{actorId:'7',provider:'clerk',clerkSessionId:'synthetic-sid-a'});
  await logoutChatbocSession({clerkEnabled:true});expect(signOut).not.toHaveBeenCalled();
  expect(isClerkSessionRetired('synthetic-clerk-user','synthetic-sid-a')).toBe(true);expect(isClerkSessionRetired('synthetic-clerk-user','synthetic-sid-b')).toBe(false);delete (window as any).Clerk;
 });
 it('retires a missing-proof legacy session locally without falsely claiming server success',async()=>{
  usePanelSessionStore.getState().setAuthToken('synthetic-legacy');
  await expect(logoutChatbocSession()).resolves.toEqual({status:'unavailable',providerStatus:'unknown'});expect(fetch).not.toHaveBeenCalled();expect(usePanelSessionStore.getState().authToken).toBeNull();
 });
 it('coalesces repeated logout clicks for the already retired local session',async()=>{
  establish();const pending=deferred();vi.mocked(fetch).mockReturnValue(pending.promise);
  const first=logoutChatbocSession(),revision=captureChatbocSessionRevision(),second=logoutChatbocSession();
  expect(second).toBe(first);expect(captureChatbocSessionRevision()).toBe(revision);expect(fetch).toHaveBeenCalledOnce();
  pending.resolve(new Response(JSON.stringify(retirementReceipt())));await expect(second).resolves.toMatchObject({status:'retired'});
 });
 it('explicit logout during an incomplete SDK exchange advances its generation and blocks only SDK A',async()=>{
  registerActiveClerkIdentity('synthetic-clerk-user','synthetic-sid-a');
  const transition=resetChatbocSessionForIdentityTransition();
  const revision=captureChatbocSessionRevision();await logoutChatbocSession();
  expect(captureChatbocSessionRevision()).toBe(revision+1);expect(isClerkSessionRetired('synthetic-clerk-user','synthetic-sid-a')).toBe(true);
  expect(isClerkSessionRetired('synthetic-clerk-user','synthetic-sid-b')).toBe(false);expect(fetch).not.toHaveBeenCalled();await transition.completion;
 });
 it('missing-proof legacy A cannot locally block a foreign captured SDK B',async()=>{
  usePanelSessionStore.getState().setUser({id:'7'} as any);usePanelSessionStore.getState().setAuthToken('synthetic-legacy-a');
  safeLocalStorage.setItem('authProvider','clerk');safeLocalStorage.setItem('clerkUserId','synthetic-clerk-a');
  registerActiveClerkIdentity('synthetic-clerk-b','synthetic-sid-b');await logoutChatbocSession();
  expect(isClerkSessionRetired('synthetic-clerk-b','synthetic-sid-b')).toBe(false);expect(fetch).not.toHaveBeenCalled();expect(readLogoutNotice()?.status).toBe('unavailable');
 });
 it('identity transition retires A without blocking the still active Clerk SDK identity',async()=>{
  establish();const transition=resetChatbocSessionForIdentityTransition();await transition.completion;
  expect(usePanelSessionStore.getState().authToken).toBeNull();expect(fetch).toHaveBeenCalledOnce();
 });
 it('recognizes cookie-backed Clerk hints without treating them as retirement proof',()=>{
  safeLocalStorage.setItem('authProvider','clerk');safeLocalStorage.setItem('clerkUserId','synthetic-clerk-user');safeLocalStorage.setItem('clerkSessionTransport','cookie');
  expect(hasPersistedClerkSession()).toBe(true);expect(hasAuthenticatedChatbocSession()).toBe(true);expect(captureSessionRetirement('7')).toBeNull();
 });
});
