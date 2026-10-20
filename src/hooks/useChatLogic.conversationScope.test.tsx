import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace} from '../../tests/fixtures/institutional-assistant.synthetic';
import {usePanelSessionStore,useWidgetSessionStore} from '@/stores';
import {safeLocalStorage} from '@/utils/safeLocalStorage';
import {resetBackendBootstrapGateForTests} from '@/utils/backendBootstrapGate';
vi.mock('@/config',async original=>({...await original<typeof import('@/config')>(),API_BASE_CANDIDATES:['/api'],BASE_API_URL:'/api',SAME_ORIGIN_PROXY_BASE:'/api'}));
vi.mock('@/utils/api',async()=>await vi.importActual<typeof import('@/utils/api')>('@/utils/api'));
vi.mock('@/hooks/useUser',()=>({useUser:()=>({user:null})}));
vi.mock('@/utils/widgetTelemetry',()=>({trackWidgetEvent:vi.fn()}));
import {useChatLogic} from '@/hooks/useChatLogic';
const originalFetch=global.fetch;
const sent:Array<{tenant:string;session:string;header:string|null;authorization:string|null}>=[];
const contexts=new Map<string,string>();
let forcedReason:string|null=null;
const scopeError='La sesion indicada no pertenece al alcance validado. No se realizo ninguna accion.';
const published=(slug:string)=>{const value=structuredClone(workspace({visibility:'public',can_edit:false}));value.tenant.slug=slug;value.tenant.id=slug==='qa-tdf'?701:702;
 value.knowledge!.initial.actions=[{code:'5',label:'Contactos',target:'requirements'}];return value;};
const options=(tenantSlug:string)=>({tipoChat:'municipio' as const,tenantSlug,skipAuth:true,socketEnabled:false,autoInitEnabled:false});
const init=async(hook:{current:ReturnType<typeof useChatLogic>})=>{
 await act(async()=>{await hook.current.initializeConversation({force:true,resetContext:true,resetMessages:true});});
 await waitFor(()=>expect(hook.current.conversationHandle?.isCurrent()).toBe(true));
};
beforeEach(()=>{safeLocalStorage.clear();window.sessionStorage.clear();sent.length=0;contexts.clear();forcedReason=null;
 usePanelSessionStore.setState({authToken:null,user:null});useWidgetSessionStore.setState({chatAuthToken:null,entityToken:null});
 vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED','false');
 global.fetch=vi.fn().mockImplementation((url:RequestInfo|URL,request:RequestInit={})=>{
  const path=new URL(String(url),'https://synthetic.example');
  if(request.method==='GET'){const match=path.pathname.match(/tenants\/([^/]+)\/institutional-assistant$/);if(!match)throw new Error('Unexpected synthetic GET '+path.pathname);
   return Promise.resolve(new Response(JSON.stringify(published(match[1])),{headers:{'Content-Type':'application/json'}}));}
  if(request.method!=='POST'||typeof request.body!=='string')throw new Error('Unexpected synthetic mutation');
  const body=JSON.parse(request.body),headers=new Headers(request.headers),tenant=String(body.tenant_slug),session=String(body.session_id);
  sent.push({tenant,session,header:headers.get('X-Chat-Session-Id'),authorization:headers.get('Authorization')});
  const conflict=Boolean(forcedReason)||(contexts.has(session)&&contexts.get(session)!==tenant);
  if(!conflict)contexts.set(session,tenant);
  return Promise.resolve(new Response(JSON.stringify(conflict?{contract_version:'shared.error.v1',ok:false,reason_code:forcedReason||'municipio_chat_idempotency_scope_conflict',message:scopeError,retryable:false,error:{code:409,message:scopeError}}:{success:true,message_body:'Respuesta actual de '+tenant}),{status:conflict?409:200,headers:{'Content-Type':'application/json'}}));
 });
});
afterEach(()=>{cleanup();global.fetch=originalFetch;vi.restoreAllMocks();vi.unstubAllEnvs();resetBackendBootstrapGateForTests();});
describe('scoped widget conversation with actual hook and API, synthetic backend',()=>{
 it('must isolate an existing TDF chat session from JUNI after a synthetic SuperAdmin login',async()=>{
  const first=renderHook(()=>useChatLogic(options('qa-tdf')));await init(first.result);
  await act(async()=>{await first.result.current.handleSend('Consulta CUD');});first.unmount();
  usePanelSessionStore.getState().setAuthToken('synthetic-superadmin-token');safeLocalStorage.setItem('user',JSON.stringify({id:900,rol:'super_admin'}));
  const second=renderHook(()=>useChatLogic(options('qa-juni')));await init(second.result);
  expect(second.result.current.messages.some(message=>message.institutional?.tenant.slug==='qa-juni')).toBe(true);
  await act(async()=>{await second.result.current.handleSend({text:'5',source:'input'});});
  expect(sent).toHaveLength(2);expect(sent[0].header).toBe(sent[0].session);expect(sent[1].header).toBe(sent[1].session);
  expect(sent[1].authorization).toBeNull();
  const rejected=second.result.current.messages.some(message=>message.isError&&message.text.includes(scopeError));
  expect(safeLocalStorage.getItem('chat_session_id')).toBeNull();
  expect(sent[1].session,'JUNI must not reuse TDF browser session').not.toBe(sent[0].session);
  expect(rejected,'published menu must not hide a guaranteed scope rejection').toBe(false);
 });
 it('retains same-tenant continuity on remount without an unsolicited INIT mutation',async()=>{
  const first=renderHook(()=>useChatLogic(options('qa-juni')));await init(first.result);await act(async()=>{await first.result.current.handleSend('Consulta inicial');});first.unmount();
  const second=renderHook(()=>useChatLogic(options('qa-juni')));await init(second.result);expect(sent).toHaveLength(1);await act(async()=>{await second.result.current.handleSend('Otra consulta');});
  expect(sent).toHaveLength(2);expect(sent[0].session).toBe(sent[1].session);expect(second.result.current.messages.some(message=>message.isError)).toBe(false);
 });
 it('keeps another tenant context intact without a rejected cross-tenant dispatch',async()=>{
  const first=renderHook(()=>useChatLogic(options('qa-tdf')));await init(first.result);await act(async()=>{await first.result.current.handleSend('Consulta anterior');});first.unmount();
  const second=renderHook(()=>useChatLogic(options('qa-juni')));await init(second.result);await act(async()=>{await second.result.current.handleSend('Contactos');});
  expect(sent).toHaveLength(2);expect(second.result.current.messages.some(message=>message.isError)).toBe(false);expect(sent[0].session).not.toBe(sent[1].session);
  expect(contexts.get(sent[0].session)).toBe('qa-tdf');
 });
 it('retires only the active scoped ID after a confirmed scope409, without touching legacy storage or replaying',async()=>{
  safeLocalStorage.setItem('chat_session_id','legacy-unrelated-session');
  const hook=renderHook(()=>useChatLogic(options('qa-juni')));await init(hook.result);
  const previous=hook.result.current.conversationHandle!;expect(previous?.isCurrent()).toBe(true);
  forcedReason='municipio_chat_idempotency_scope_conflict';
  await act(async()=>{await hook.result.current.handleSend('Contactos');});
  expect(sent).toHaveLength(1);expect(previous.isCurrent()).toBe(false);
  expect(safeLocalStorage.getItem('chat_session_id')).toBe('legacy-unrelated-session');
  expect(hook.result.current.messages.some(message=>message.isError&&message.text.includes(scopeError))).toBe(true);
  await waitFor(()=>expect(hook.result.current.conversationHandle?.sessionId).not.toBe(previous.sessionId));
  forcedReason=null;await act(async()=>{await hook.result.current.handleSend('Contactos otra vez');});
  expect(sent).toHaveLength(2);expect(sent[1].session).not.toBe(sent[0].session);
 });
 it('keeps session ownership on a business payload409 instead of rotating by HTTP status',async()=>{
  const hook=renderHook(()=>useChatLogic(options('qa-juni')));await init(hook.result);
  const previous=hook.result.current.conversationHandle!;
  forcedReason='municipio_chat_idempotency_payload_conflict';
  await act(async()=>{await hook.result.current.handleSend('Contactos');});
  expect(sent).toHaveLength(1);expect(previous.isCurrent()).toBe(true);
  expect(hook.result.current.conversationHandle?.sessionId).toBe(previous.sessionId);
 });
 it('does not let an old tenant scope409 retire the new tenant conversation',async()=>{
  const original=vi.mocked(global.fetch).getMockImplementation()!;
  let release!:()=>void;
  global.fetch=vi.fn().mockImplementation((url:RequestInfo|URL,request:RequestInit={})=>{
   const result=original(url,request);
   if(request.method==='POST'&&!release)return new Promise<Response>(resolve=>{release=()=>{Promise.resolve(result).then(resolve);};});
   return result;
  });
  const hook=renderHook(({slug})=>useChatLogic(options(slug)),{initialProps:{slug:'qa-tdf'}});await init(hook.result);
  forcedReason='municipio_chat_idempotency_scope_conflict';let pending!:Promise<void>;
  act(()=>{pending=hook.result.current.handleSend('Consulta anterior');});
  await waitFor(()=>expect(sent).toHaveLength(1));
  hook.rerender({slug:'qa-juni'});forcedReason=null;await init(hook.result);
  const current=hook.result.current.conversationHandle!;
  await act(async()=>{release();await pending;});
  expect(current.isCurrent()).toBe(true);expect(hook.result.current.conversationHandle?.sessionId).toBe(current.sessionId);
  expect(hook.result.current.messages.some(message=>message.isError)).toBe(false);expect(sent).toHaveLength(1);
 });
 it('deduplicates simultaneous menu initialization while scoped identity is being captured',async()=>{
  const hook=renderHook(()=>useChatLogic(options('qa-juni')));
  await act(async()=>{await Promise.all([hook.result.current.initializeConversation({force:true}),hook.result.current.initializeConversation({force:true})]);});
  expect(global.fetch).toHaveBeenCalledOnce();expect(sent).toHaveLength(0);
 });
});
