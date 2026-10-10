import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {useRef} from 'react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace} from '../../tests/fixtures/institutional-assistant.synthetic';
import {usePanelSessionStore,useWidgetSessionStore} from '@/stores';
import {safeLocalStorage} from '@/utils/safeLocalStorage';
import {resetBackendBootstrapGateForTests} from '@/utils/backendBootstrapGate';
vi.mock('@/config',async original=>({...await original<typeof import('@/config')>(),API_BASE_CANDIDATES:['/api'],BASE_API_URL:'/api',SAME_ORIGIN_PROXY_BASE:'/api'}));
vi.mock('@/utils/api',async()=>await vi.importActual<typeof import('@/utils/api')>('@/utils/api'));
vi.mock('@/hooks/useUser',()=>({useUser:()=>({user:null})}));
vi.mock('@/utils/widgetTelemetry',()=>({trackWidgetEvent:vi.fn()}));
import {apiFetch} from '@/utils/api';
import {useChatLogic} from './useChatLogic';

const originalFetch=global.fetch;
const deferred=<T,>()=>{let resolve!:(value:T)=>void;return {promise:new Promise<T>(done=>{resolve=done;}),resolve:(value:T)=>resolve(value)};};
const options=(tenantSlug:string)=>({tipoChat:'municipio' as const,tenantSlug,skipAuth:true,socketEnabled:false,autoInitEnabled:false});
const published=()=>{
 const value=structuredClone(workspace({visibility:'public',can_edit:false}));value.tenant.slug='qa-b';
 const source={...value.knowledge!.sources[0],document_visibility:'private' as const};
 value.knowledge!.sources=[source];value.knowledge!.initial.sources=[{...source,pages:[1]}];
 return value;
};
beforeEach(()=>{
 safeLocalStorage.clear();window.sessionStorage.clear();
 usePanelSessionStore.setState({authToken:null,user:null});useWidgetSessionStore.setState({chatAuthToken:null,entityToken:null});
 vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED','false');
});
afterEach(()=>{cleanup();global.fetch=originalFetch;vi.restoreAllMocks();vi.unstubAllEnvs();resetBackendBootstrapGateForTests();});

describe('mounted chat retirement with the actual API transport',()=>{
 it.each(['json','audio','signed'] as const)('does not persist late %s mutation headers or replay the dispatch after tenant retirement',async(transport)=>{
  const pending=deferred<Response>();
  global.fetch=vi.fn().mockImplementation((_url,request:RequestInit)=>request.method==='GET'
   ?Promise.resolve(new Response(JSON.stringify(published()),{headers:{'Content-Type':'application/json'}}))
   :pending.promise);
  const hook=renderHook(({slug})=>useChatLogic({...options(slug),...(transport==='signed'?{chatBootstrap:{contract_version:'demo.chat_bootstrap.v1',endpoint:'/api/ask/municipio',method:'POST',payload:{tenant_slug:slug,tipo_chat:'municipio',demo_mode:true}}}: {})}),{initialProps:{slug:'qa-a'}});
  let outgoing!:Promise<void>;
  act(()=>{outgoing=hook.result.current.handleSend(transport==='audio'?{text:'Consulta A',audioBlob:new Blob(['synthetic-audio'],{type:'audio/webm'})}:'Consulta A');});
  await waitFor(()=>expect(global.fetch).toHaveBeenCalledOnce());
  const sent=vi.mocked(global.fetch).mock.calls[0][1]!;
  expect(sent.signal).toBeUndefined();
  if(typeof sent.body==='string')expect(JSON.parse(sent.body)).not.toHaveProperty('isCurrent');
  hook.rerender({slug:'qa-b'});
  if(transport!=='signed')await act(async()=>{await hook.result.current.initializeConversation();});
  safeLocalStorage.setItem('anon_id','active-synthetic-anon');
  const before=hook.result.current.messages;
  const response=new Response('{"message_body":"RETIRED_A"}',{headers:{'Content-Type':'application/json','X-Tenant-Slug':'qa-a','X-Contact-Key':'retired-contact','X-Conversation-Id':'retired-conversation','X-Anon-Id':'retired-anon'}});
  const read=vi.spyOn(response,'text');
  await act(async()=>{pending.resolve(response);await outgoing;});
  expect(safeLocalStorage.getItem('anon_id')).toBe('active-synthetic-anon');
  expect(safeLocalStorage.getItem('chatboc_omnichannel_identity:qa-a')).toBeNull();
  expect(hook.result.current.messages).toBe(before);expect(hook.result.current.isTyping).toBe(false);
  expect(read).not.toHaveBeenCalled();
  expect(vi.mocked(global.fetch).mock.calls.filter(([,request])=>request?.method==='POST')).toHaveLength(1);
 });

 it.each([200,401])('retires a delayed JSON %s body before identity payloads or authentication effects',async(status)=>{
  usePanelSessionStore.getState().setAuthToken('synthetic-panel-token');
  useWidgetSessionStore.getState().setChatAuthToken('synthetic-widget-token');
  safeLocalStorage.setItem('tenantSlug','same-storage-identity');
  const pending=deferred<string>();
  const response=new Response('',{status,headers:{'Content-Type':'application/json'}});
  const text=vi.spyOn(response,'text').mockReturnValue(pending.promise);
  global.fetch=vi.fn().mockResolvedValue(response);
  const hook=renderHook(({scope})=>{
   const current=useRef(scope);current.current=scope;
   return ()=>apiFetch('/api/ask/pyme',{method:'POST',body:{pregunta:'Consulta'},skipAuth:false,isWidgetRequest:true,tenantSlug:'qa-a',persistTenantSlug:false,
    omitEntityToken:true,singleAttempt:true,suppressPanel401Redirect:true,isCurrent:()=>current.current===scope});
  },{initialProps:{scope:'qa-a'}});
  const rejected=hook.result.current().catch(error=>error);
  await waitFor(()=>expect(text).toHaveBeenCalledOnce());
  expect(new Headers(vi.mocked(global.fetch).mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer synthetic-widget-token');
  const storageIdentity=safeLocalStorage.getItem('tenantSlug');
  hook.rerender({scope:'qa-b'});
  pending.resolve(JSON.stringify({reason_code:'unauthorized',contact_key:'retired-body-contact',conversation_id:'retired-body-conversation'}));
  expect(await rejected).toMatchObject({name:'AbortError'});
  expect(usePanelSessionStore.getState().authToken).toBe('synthetic-panel-token');
  expect(useWidgetSessionStore.getState().chatAuthToken).toBe('synthetic-widget-token');
  expect(safeLocalStorage.getItem('tenantSlug')).toBe(storageIdentity);
  expect(safeLocalStorage.getItem('chatboc_omnichannel_identity:qa-a')).toBeNull();
  expect(global.fetch).toHaveBeenCalledOnce();
 });

 it('rechecks scope after onResponse before persisting response headers',async()=>{
  const response=new Response('{"ok":true}',{headers:{'Content-Type':'application/json','X-Tenant-Slug':'qa-a','X-Contact-Key':'retired-callback-contact','X-Anon-Id':'retired-callback-anon'}});
  const read=vi.spyOn(response,'text');global.fetch=vi.fn().mockResolvedValue(response);
  safeLocalStorage.setItem('anon_id','active-synthetic-anon');
  const hook=renderHook(({scope})=>{const current=useRef(scope);current.current=scope;return ()=>current.current===scope;},{initialProps:{scope:'qa-a'}});
  const onResponse=vi.fn(()=>hook.rerender({scope:'qa-b'}));
  await expect(apiFetch('/api/ask/municipio',{method:'POST',body:{pregunta:'Consulta'},skipAuth:true,isWidgetRequest:true,singleAttempt:true,tenantSlug:'qa-a',
   isCurrent:hook.result.current,onResponse})).rejects.toMatchObject({name:'AbortError'});
  expect(onResponse).toHaveBeenCalledOnce();expect(read).not.toHaveBeenCalled();
  expect(safeLocalStorage.getItem('anon_id')).toBe('active-synthetic-anon');
  expect(safeLocalStorage.getItem('chatboc_omnichannel_identity:qa-a')).toBeNull();expect(global.fetch).toHaveBeenCalledOnce();
 });
 it('keeps a current widget authentication denial terminal and preserves the existing token retirement policy',async()=>{
  usePanelSessionStore.getState().setAuthToken('synthetic-current-panel-token');
  useWidgetSessionStore.getState().setChatAuthToken('synthetic-current-widget-token');
  global.fetch=vi.fn().mockResolvedValue(new Response('{"reason_code":"unauthorized"}',{status:401,headers:{'Content-Type':'application/json'}}));
  await expect(apiFetch('/api/ask/pyme',{method:'POST',body:{pregunta:'Consulta actual'},skipAuth:false,isWidgetRequest:true,tenantSlug:'qa-a',
   singleAttempt:true,suppressPanel401Redirect:true,isCurrent:()=>true})).rejects.toMatchObject({status:401});
  expect(useWidgetSessionStore.getState().chatAuthToken).toBeNull();
  expect(usePanelSessionStore.getState().authToken).toBe('synthetic-current-panel-token');expect(global.fetch).toHaveBeenCalledOnce();
 });
});
