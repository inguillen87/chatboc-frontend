import React from 'react';
import {act,cleanup,render,renderHook,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace} from '../../tests/fixtures/institutional-assistant.synthetic';
import {institutionalChatBootstrapPayload,parseInstitutionalChatMessage} from '@/features/chat/institutionalChatMessage';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',async original=>({...await original<typeof import('@/utils/api')>(),apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
vi.mock('@/hooks/useUser',()=>({useUser:()=>({user:null})}));
vi.mock('@/utils/widgetTelemetry',()=>({trackWidgetEvent:vi.fn()}));
import {ApiError} from '@/utils/api';
import {useChatLogic} from './useChatLogic';
import ChatMessage from '@/components/chat/ChatMessage';

const published=(slug='qa-knowledge')=>{
 const value=structuredClone(workspace({visibility:'public',can_edit:false}));value.tenant.slug=slug;
 const source={...value.knowledge!.sources[0],document_visibility:'private' as const};
 value.knowledge!.sources=[source];value.knowledge!.initial.sources=[{...source,pages:[1]}];
 return value;
};
const init=async(result:{current:ReturnType<typeof useChatLogic>})=>act(async()=>{await result.current.initializeConversation({force:true,resetContext:true,resetMessages:true});});
const options=(tenantSlug='qa-knowledge')=>({tipoChat:'municipio' as const,tenantSlug,skipAuth:true,socketEnabled:false,autoInitEnabled:false});
beforeEach(()=>{mocks.fetch.mockReset();window.localStorage.clear();window.sessionStorage.clear();});
afterEach(cleanup);

describe('shared institutional bootstrap',()=>{
 it('loads public knowledge without INIT POST or credentials and renders the existing typed message',async()=>{
  const value=published();mocks.fetch.mockResolvedValue(value);
  const hook=renderHook(()=>useChatLogic(options()));await init(hook.result);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  const [path,request]=mocks.fetch.mock.calls[0];
  expect(path).toBe('/api/public/tenants/qa-knowledge/institutional-assistant');
  expect(request).toMatchObject({method:'GET',tenantSlug:'qa-knowledge',skipAuth:true,omitCredentials:true,omitEntityToken:true,omitChatSessionId:true,persistTenantSlug:false,isWidgetRequest:false});
  expect(request.body).toBeUndefined();expect(request.signal).toBeInstanceOf(AbortSignal);
  const message=hook.result.current.messages.find(m=>m.isBot)!;
  expect(message.institutional?.tenant).toEqual({id:value.tenant.id,slug:value.tenant.slug});
  render(<ChatMessage message={message} isTyping={false} onButtonClick={()=>{}}/>);
  expect(screen.getByTestId('institutional-chat-message')).toBeVisible();
  expect(screen.getByRole('button',{name:'Consultar requisitos'})).toBeVisible();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(hook.result.current.suppressLegacyInitialMenu).toBe(true);
 });
 it('binds initial source identity to the public catalog with the existing parsers',()=>{
  const value=published();value.knowledge!.initial.sources[0].sha256='c'.repeat(64);
  expect(()=>institutionalChatBootstrapPayload(value,'qa-knowledge')).toThrow('knowledge_source_changed');
  expect(parseInstitutionalChatMessage(institutionalChatBootstrapPayload(published(),'qa-knowledge'),'qa-knowledge')).not.toBeNull();
 });
 it('uses the ordinary municipal INIT only for exact unpublished 404',async()=>{
  mocks.fetch.mockRejectedValueOnce(new ApiError('Not available',404,{reason_code:'knowledge_not_available'}));
  mocks.fetch.mockResolvedValueOnce({message_body:'Legacy operational welcome',botones:[]});
  const hook=renderHook(()=>useChatLogic(options('qa-legacy')));await init(hook.result);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  expect(mocks.fetch.mock.calls[1]).toEqual(['/ask/municipio',expect.objectContaining({method:'POST',body:expect.objectContaining({pregunta:'__INIT__',tenant_slug:'qa-legacy'})})]);
  expect(hook.result.current.messages[0].text).toBe('Legacy operational welcome');
  expect(hook.result.current.suppressLegacyInitialMenu).toBe(false);
 });
 it('keeps a signed demo bootstrap on its existing contract without discovering a public menu',async()=>{
  mocks.fetch.mockResolvedValue({message_body:'Respuesta del contrato firmado'});
  const hook=renderHook(()=>useChatLogic({...options('qa-signed'),chatBootstrap:{contract_version:'demo.chat_bootstrap.v1',endpoint:'/api/ask/municipio',method:'POST',payload:{tipo_chat:'municipio',tenant_slug:'qa-signed',demo_mode:true}}}));
  await init(hook.result);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(mocks.fetch.mock.calls[0][1]).toMatchObject({method:'POST',body:expect.objectContaining({pregunta:'__INIT__',tenant_slug:'qa-signed',demo_mode:true})});
  expect(hook.result.current.messages[0].text).toBe('Respuesta del contrato firmado');
  expect(hook.result.current.suppressLegacyInitialMenu).toBe(false);
 });
 it('discovers the menu automatically with existing messages and preserves the same session and unfinished context',async()=>{
  window.localStorage.setItem('chat_session_id','same-browser-session');
  const stored=JSON.stringify({tipo_chat:'municipio',tenant_slug:'qa-knowledge',ticket_id:71,consulta_pin:'qa-pin',demo_session:true});
  window.localStorage.setItem('chatboc_public_chat_context',stored);
  mocks.fetch.mockResolvedValue(published());
  const hook=renderHook(()=>useChatLogic({...options(),autoInitEnabled:true}));
  act(()=>{
   hook.result.current.setMessages([{id:'prior-question',text:'Consulta ingresada anteriormente',isBot:false,timestamp:new Date()}]);
   hook.result.current.setContexto(previous=>({...previous,estado_conversacion:'recolectando_info',datos_reclamo:{...previous.datos_reclamo,descripcion:'Borrador conservado'}}));
  });
  await waitFor(()=>expect(hook.result.current.messages.some(message=>message.institutional)).toBe(true));
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(hook.result.current.messages[0].text).toBe('Consulta ingresada anteriormente');
  expect(hook.result.current.contexto).toMatchObject({estado_conversacion:'recolectando_info',datos_reclamo:{descripcion:'Borrador conservado'}});
  expect(window.localStorage.getItem('chat_session_id')).toBe('same-browser-session');
  expect(window.localStorage.getItem('chatboc_public_chat_context')).toBe(stored);
 });
 it('preserves an existing conversation on a legacy 404 without an unsolicited INIT',async()=>{
  mocks.fetch.mockRejectedValue(new ApiError('Not available',404,{reason_code:'knowledge_not_available'}));
  const hook=renderHook(()=>useChatLogic(options('qa-legacy')));
  act(()=>hook.result.current.setMessages([{id:'prior',text:'Pregunta conservada',isBot:false,timestamp:new Date()}]));
  await act(async()=>{await hook.result.current.initializeConversation();});
  expect(mocks.fetch).toHaveBeenCalledTimes(1);expect(hook.result.current.messages).toHaveLength(1);
  expect(hook.result.current.messages[0].text).toBe('Pregunta conservada');
  expect(hook.result.current.suppressLegacyInitialMenu).toBe(false);
 });
 it.each(['before','after'] as const)('keeps a question and its operational state when the public read finishes %s its response',async(order)=>{
  let resolveWorkspace!:(value:unknown)=>void,resolveQuestion!:(value:unknown)=>void;
  mocks.fetch.mockImplementation((path:string)=>new Promise(resolve=>{
   if(path.includes('/institutional-assistant'))resolveWorkspace=resolve;else resolveQuestion=resolve;
  }));
  const hook=renderHook(()=>useChatLogic(options()));let bootstrap!:Promise<void>,question!:Promise<void>;
  act(()=>{bootstrap=hook.result.current.initializeConversation({force:true,resetContext:true,resetMessages:true});});
  act(()=>{question=hook.result.current.handleSend('Mi consulta ingresada durante la carga');});
  const reply={message_body:'Respuesta operativa vigente',accion_backend:'crear_reclamo',pedir_info:true,datos_estructura:{descripcion:'Detalle que conserva el flujo'}};
  if(order==='before'){
   await act(async()=>{resolveWorkspace(published());await bootstrap;});
   expect(hook.result.current.isTyping).toBe(true);
   await act(async()=>{resolveQuestion(reply);await question;});
  }else{
   await act(async()=>{resolveQuestion(reply);await question;});
   await act(async()=>{resolveWorkspace(published());await bootstrap;});
  }
  expect(hook.result.current.messages.some(message=>message.text==='Mi consulta ingresada durante la carga'&&!message.isBot)).toBe(true);
  expect(hook.result.current.messages.some(message=>message.text==='Respuesta operativa vigente')).toBe(true);
  expect(hook.result.current.messages.some(message=>message.institutional)).toBe(true);
  expect(hook.result.current.contexto).toMatchObject({estado_conversacion:'recolectando_info',datos_reclamo:{descripcion:'Detalle que conserva el flujo'}});
  expect(hook.result.current.isTyping).toBe(false);
  expect(mocks.fetch.mock.calls.map(([,request])=>request.method)).toEqual(['GET','POST']);
 });
 it('preserves an admitted human conversation room and credential when appending the public menu',async()=>{
  mocks.fetch.mockResolvedValueOnce({message_body:'Atención humana vigente',ticket_id:321,data:{ticket_id:321,status:'en_vivo',socket_room:'ticket_municipio_321',live_chat_access_token:'synthetic-room-credential'}});
  const hook=renderHook(()=>useChatLogic(options()));
  await act(async()=>{await hook.result.current.handleSend('Consulta anterior');});
  expect(hook.result.current.isLiveChatActive).toBe(true);
  const previous={activeTicketId:hook.result.current.activeTicketId,liveChatTicketId:hook.result.current.liveChatTicketId,liveChatSocketRoom:hook.result.current.liveChatSocketRoom,liveChatAccessToken:hook.result.current.liveChatAccessToken,liveChatStatus:hook.result.current.liveChatStatus};
  mocks.fetch.mockResolvedValueOnce(published());await init(hook.result);
  expect(hook.result.current).toMatchObject(previous);
  expect(hook.result.current.messages.some(message=>message.text==='Atención humana vigente')).toBe(true);
  expect(hook.result.current.messages.some(message=>message.institutional)).toBe(true);
  expect(mocks.fetch.mock.calls.map(([,request])=>request.method)).toEqual(['POST','GET']);
 });
 it('keeps earlier messages and context when the public read fails despite legacy reset options',async()=>{
  mocks.fetch.mockRejectedValue(new Error('Network interrupted'));
  const hook=renderHook(()=>useChatLogic(options()));
  act(()=>{
   hook.result.current.setMessages([{id:'prior',text:'Consulta anterior conservada',isBot:false,timestamp:new Date()}]);
   hook.result.current.setContexto(previous=>({...previous,estado_conversacion:'confirmando_reclamo'}));
  });
  await init(hook.result);
  expect(hook.result.current.messages[0].text).toBe('Consulta anterior conservada');
  expect(hook.result.current.contexto.estado_conversacion).toBe('confirmando_reclamo');
  expect(hook.result.current.messages.at(-1)?.isError).toBe(true);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
 });
 it.each([
  ['startup',()=>new ApiError('Not ready',503,{reason_code:'backend_initializing'})],
  ['unrelated404',()=>new ApiError('Unknown',404,{reason_code:'route_not_found'})],
  ['ambiguous404',()=>new ApiError('Unknown',404,{reason_code:'knowledge_not_available',visibility:'public'})],
  ['malformed404',()=>new ApiError('Unknown',404,'HTML body')],
  ['network',()=>new Error('Network interrupted')],
 ] as const)('does not fabricate a legacy greeting after %s',async(_name,error)=>{
  mocks.fetch.mockRejectedValue(error());const hook=renderHook(()=>useChatLogic(options()));await init(hook.result);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);expect(hook.result.current.messages[0].isError).toBe(true);
  expect(hook.result.current.messages[0].text).toContain('No se pudo cargar el menú inicial');
  expect(hook.result.current.suppressLegacyInitialMenu).toBe(true);
 });
 it('rejects another tenant before rendering its text or any legacy request',async()=>{
  const value=published('other-tenant');value.knowledge!.initial.text='FOREIGN_INFORMATION';mocks.fetch.mockResolvedValue(value);
  const hook=renderHook(()=>useChatLogic(options()));await init(hook.result);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(hook.result.current.messages.some(m=>m.text.includes('FOREIGN_INFORMATION'))).toBe(false);
  expect(hook.result.current.messages[0].institutional).toBeUndefined();
 });
 it('retires a delayed workspace when its tenant changes, with no old-tenant fallback POST',async()=>{
  let rejectOld!:(reason:unknown)=>void;
  mocks.fetch.mockImplementationOnce(()=>new Promise((_resolve,reject)=>{rejectOld=reject;}));
  const hook=renderHook(({slug})=>useChatLogic(options(slug)),{initialProps:{slug:'qa-old'}});
  let pending!:Promise<void>;
  act(()=>{pending=hook.result.current.initializeConversation({force:true,resetContext:true});});
  const old=mocks.fetch.mock.calls[0][1];expect(hook.result.current.institutionalBootstrapPending).toBe(true);
  hook.rerender({slug:'qa-new'});expect(old.signal.aborted).toBe(true);expect(old.isCurrent()).toBe(false);
  await act(async()=>{rejectOld(new ApiError('Not available',404,{reason_code:'knowledge_not_available'}));await pending;});
  expect(mocks.fetch).toHaveBeenCalledTimes(1);expect(hook.result.current.messages).toHaveLength(0);
  mocks.fetch.mockResolvedValueOnce(published('qa-new'));await init(hook.result);
  expect(hook.result.current.messages[0].institutional?.tenant.slug).toBe('qa-new');
 });
 it('aborts on unmount and ignores a late successful body',async()=>{
  let resolve!:(value:unknown)=>void;mocks.fetch.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  const hook=renderHook(()=>useChatLogic(options()));let pending!:Promise<void>;
  act(()=>{pending=hook.result.current.initializeConversation({force:true});});
  const request=mocks.fetch.mock.calls[0][1];hook.unmount();expect(request.signal.aborted).toBe(true);
  await act(async()=>{resolve(published());await pending;});expect(mocks.fetch).toHaveBeenCalledTimes(1);
 });
 it('keeps a real question quota error visible after public menu bootstrap',async()=>{
  const onTrialLimit=vi.fn();mocks.fetch.mockResolvedValueOnce(published());
  const hook=renderHook(()=>useChatLogic({...options(),onTrialLimit}));await init(hook.result);
  mocks.fetch.mockRejectedValueOnce(new ApiError('Demo limit',403,{reason_code:'demo_message_limit_reached',message:'Llegaste al límite de mensajes gratis de esta demo.'}));
  await act(async()=>{await hook.result.current.handleSend('Consulta sobre documentación');});
  expect(onTrialLimit).toHaveBeenCalledWith(expect.objectContaining({code:'demo_message_limit_reached'}));
  expect(hook.result.current.messages.some(m=>m.text.includes('Llegaste al límite'))).toBe(true);
  expect(mocks.fetch.mock.calls[1][1]).toMatchObject({method:'POST',body:expect.objectContaining({tenant_slug:'qa-knowledge'})});
 });
 it.each([409,403])('retires a delayed %s from another tenant without changing the active session, messages or pending question',async(status)=>{
  let rejectA!:(reason:unknown)=>void,resolveB!:(value:unknown)=>void;
  const onTrialLimit=vi.fn();
  mocks.fetch.mockImplementation((path:string,request:{method:string;body?:{tenant_slug?:string}})=>{
   if(request.method==='GET')return Promise.resolve(published('qa-b'));
   return new Promise((resolve,reject)=>{if(request.body?.tenant_slug==='qa-a')rejectA=reject;else resolveB=resolve;});
  });
  const hook=renderHook(({slug})=>useChatLogic({...options(slug),onTrialLimit}),{initialProps:{slug:'qa-a'}});
  let a!:Promise<void>,b!:Promise<void>;
  act(()=>{a=hook.result.current.handleSend('Pregunta de A');});
  hook.rerender({slug:'qa-b'});
  expect(hook.result.current.isTyping).toBe(false);
  window.localStorage.setItem('chat_session_id','active-b-session');
  await act(async()=>{await hook.result.current.initializeConversation();});
  act(()=>{b=hook.result.current.handleSend('Pregunta vigente de B');});
  const messagesB=hook.result.current.messages;
  expect(hook.result.current.isTyping).toBe(true);
  await act(async()=>{rejectA(new ApiError('Retired error',status,status===403?{reason_code:'demo_message_limit_reached',message:'RETIRADO_A'}:{reason_code:'session_conflict'}));await a;});
  expect(window.localStorage.getItem('chat_session_id')).toBe('active-b-session');
  expect(hook.result.current.messages).toBe(messagesB);
  expect(hook.result.current.isTyping).toBe(true);expect(onTrialLimit).not.toHaveBeenCalled();
  expect(mocks.fetch).toHaveBeenCalledTimes(3);
  await act(async()=>{resolveB({message_body:'Respuesta vigente de B'});await b;});
  expect(hook.result.current.messages.at(-1)?.text).toBe('Respuesta vigente de B');
  expect(hook.result.current.isTyping).toBe(false);
 });
 it('releases old typing and fingerprints when switching tenant, without replaying a dispatched mutation',async()=>{
  let resolveA!:(value:unknown)=>void;
  const identical={id:91,message_body:'Respuesta compartida de prueba'};
  mocks.fetch.mockResolvedValueOnce(identical);
  const hook=renderHook(({slug})=>useChatLogic(options(slug)),{initialProps:{slug:'qa-a'}});
  await act(async()=>{await hook.result.current.handleSend('Primera consulta de A');});
  mocks.fetch.mockImplementationOnce(()=>new Promise(resolve=>{resolveA=resolve;}));
  let pendingA!:Promise<void>;
  act(()=>{pendingA=hook.result.current.handleSend('Consulta pendiente de A');});
  hook.rerender({slug:'qa-b'});expect(hook.result.current.isTyping).toBe(false);
  mocks.fetch.mockResolvedValueOnce(published('qa-b'));
  await act(async()=>{await hook.result.current.initializeConversation();});
  await act(async()=>{resolveA({message_body:'Respuesta tardía de A'});await pendingA;});
  expect(hook.result.current.messages.some(message=>message.text==='Respuesta tardía de A')).toBe(false);
  mocks.fetch.mockResolvedValueOnce(identical);
  await act(async()=>{await hook.result.current.handleSend('Consulta de B');});
  expect(hook.result.current.messages.at(-1)?.text).toBe(identical.message_body);
  const posts=mocks.fetch.mock.calls.filter(([,request])=>request.method==='POST');
  expect(posts.map(([,request])=>request.body.tenant_slug)).toEqual(['qa-a','qa-a','qa-b']);
 });
 it('does not re-admit a delayed error after switching away and back to the same tenant',async()=>{
  let reject!:(reason:unknown)=>void;const onTrialLimit=vi.fn();
  mocks.fetch.mockImplementationOnce(()=>new Promise((_resolve,fail)=>{reject=fail;}));
  const hook=renderHook(({slug})=>useChatLogic({...options(slug),onTrialLimit}),{initialProps:{slug:'qa-a'}});
  let pending!:Promise<void>;act(()=>{pending=hook.result.current.handleSend('Consulta retirada');});
  hook.rerender({slug:'qa-b'});hook.rerender({slug:'qa-a'});
  window.localStorage.setItem('chat_session_id','returned-a-session');
  await act(async()=>{reject(new ApiError('Retired conflict',409,{reason_code:'session_conflict'}));await pending;});
  expect(window.localStorage.getItem('chat_session_id')).toBe('returned-a-session');
  expect(hook.result.current.messages).toHaveLength(0);expect(hook.result.current.isTyping).toBe(false);
  expect(onTrialLimit).not.toHaveBeenCalled();expect(mocks.fetch).toHaveBeenCalledTimes(1);
 });
 it('ignores a rejected dispatched mutation after unmount without changing the shared session',async()=>{
  let reject!:(reason:unknown)=>void;
  mocks.fetch.mockImplementationOnce(()=>new Promise((_resolve,fail)=>{reject=fail;}));
  const hook=renderHook(()=>useChatLogic(options()));let pending!:Promise<void>;
  act(()=>{pending=hook.result.current.handleSend('Consulta saliente');});
  hook.unmount();window.localStorage.setItem('chat_session_id','another-mounted-session');
  await act(async()=>{reject(new ApiError('Retired conflict',409,{reason_code:'session_conflict'}));await pending;});
  expect(window.localStorage.getItem('chat_session_id')).toBe('another-mounted-session');
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
 });
});
