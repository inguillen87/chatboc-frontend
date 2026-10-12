import {act,cleanup,renderHook} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace} from '../../tests/fixtures/institutional-assistant.synthetic';
import {institutionalChatBootstrapPayload,institutionalInitialMenuContext,institutionalPresentationMode} from '@/features/chat/institutionalChatMessage';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',async original=>({...await original<typeof import('@/utils/api')>(),apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
vi.mock('@/hooks/useUser',()=>({useUser:()=>({user:null})}));
vi.mock('@/utils/widgetTelemetry',()=>({trackWidgetEvent:vi.fn()}));
import {useChatLogic} from './useChatLogic';
import type {ChatBootstrapConfig} from '@/features/chat/chatTypes';
import {advanceChatbocSessionRevision} from '@/utils/chatbocSessionRevision';

const published=(slug='qa-knowledge')=>({...workspace({visibility:'public',can_edit:false}),tenant:{id:701,slug,name:'Institución de prueba'}});
const options=(slug='qa-knowledge')=>({tipoChat:'municipio' as const,tenantSlug:slug,skipAuth:true,socketEnabled:false,autoInitEnabled:false});
const answer=(slug='qa-knowledge',id='turn-response')=>({...institutionalChatBootstrapPayload(published(slug),slug),id,message_body:`Respuesta de ${id}`});
const bootstrap=():ChatBootstrapConfig=>({contract_version:'demo.chat_bootstrap.v1',endpoint:'/api/ask/municipio',method:'POST',payload:{tipo_chat:'municipio',tenant_slug:'qa-knowledge'},session:{chat_session_id:'synthetic-chat-a',demo_session_id:'synthetic-demo-a'}});
beforeEach(()=>{mocks.fetch.mockReset();window.localStorage.clear();window.sessionStorage.clear();});
afterEach(cleanup);

describe('local bootstrap presentation and response correlation',()=>{
 it('marks only the validated canonical bootstrap, without changing the public GET',async()=>{
  const value=published();mocks.fetch.mockResolvedValueOnce(value);
  const hook=renderHook(()=>useChatLogic(options()));
  await act(async()=>{await hook.result.current.initializeConversation({force:true});});
  const initial=hook.result.current.messages[0].institutional!;
  expect(initial.initialMenu).toEqual(institutionalInitialMenuContext(value,value.tenant.slug));
  expect(institutionalPresentationMode(initial,initial.initialMenu)).toBe('initial-menu');
  expect(mocks.fetch).toHaveBeenCalledOnce();expect(mocks.fetch.mock.calls[0][1]).toMatchObject({method:'GET',omitCredentials:true});
 });
 it('keeps a normal same-start answer unmarked and reports its exact local message ID once',async()=>{
  mocks.fetch.mockResolvedValueOnce(published());const hook=renderHook(()=>useChatLogic(options()));
  await act(async()=>{await hook.result.current.initializeConversation({force:true});});
  const initialId=hook.result.current.messages[0].id,respond=vi.fn();
  mocks.fetch.mockResolvedValueOnce(answer());
  await act(async()=>{await hook.result.current.handleSend('Otra consulta',{onInstitutionalResponse:respond});});
  const latest=hook.result.current.messages.at(-1)!;
  expect(latest.id).not.toBe(initialId);expect(latest.institutional?.nodes[0].id).toBe('start');
  expect(latest.institutional?.initialMenu).toBeUndefined();
  expect(respond).toHaveBeenCalledOnce();expect(respond).toHaveBeenCalledWith(latest.id);
  const [,request]=mocks.fetch.mock.calls[1];
  expect(request.body).not.toHaveProperty('onInstitutionalResponse');expect(request.body).not.toHaveProperty('presentation');
  expect(request.body).not.toHaveProperty('initialMenu');expect(request.body).toMatchObject({pregunta:'Otra consulta',tenant_slug:'qa-knowledge'});
 });
 it('reports the last valid institutional message in this response batch, not an existing menu',async()=>{
  mocks.fetch.mockResolvedValueOnce([answer('qa-knowledge','batch-first'),answer('qa-knowledge','batch-last')]);
  const hook=renderHook(()=>useChatLogic(options())),respond=vi.fn();
  await act(async()=>{await hook.result.current.handleSend('Consulta',{onInstitutionalResponse:respond});});
  expect(hook.result.current.messages.filter(message=>message.institutional).map(message=>message.id)).toEqual(['batch-first','batch-last']);
  expect(respond).toHaveBeenCalledOnce();expect(respond).toHaveBeenCalledWith('batch-last');
 });
 it.each(['generic','malformed','error','duplicate'] as const)('does not correlate a %s body as a new institutional response',async kind=>{
  const hook=renderHook(()=>useChatLogic(options())),respond=vi.fn();
  const payload=kind==='generic'?{message_body:'Información genérica'}:kind==='malformed'?{...answer(),botones:[]}:kind==='error'?{...answer(),isError:true}:answer();
  if(kind==='duplicate'){
   mocks.fetch.mockResolvedValueOnce(payload);
   await act(async()=>{await hook.result.current.handleSend('Consulta anterior');});
  }
  mocks.fetch.mockResolvedValueOnce(payload);
  await act(async()=>{await hook.result.current.handleSend('Consulta actual',{onInstitutionalResponse:respond});});
  expect(respond).not.toHaveBeenCalled();
 });
 it.each(['switch','aba','unmount'] as const)('retires the response callback after %s without a new dispatch',async kind=>{
  let resolve!:(value:unknown)=>void;mocks.fetch.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  const hook=renderHook(({slug})=>useChatLogic(options(slug)),{initialProps:{slug:'qa-knowledge'}}),respond=vi.fn();
  let pending!:Promise<void>;act(()=>{pending=hook.result.current.handleSend('Consulta retirada',{onInstitutionalResponse:respond});});
  if(kind==='unmount')hook.unmount();else{hook.rerender({slug:'qa-another'});if(kind==='aba')hook.rerender({slug:'qa-knowledge'});}
  await act(async()=>{resolve(answer());await pending;});
  expect(respond).not.toHaveBeenCalled();expect(mocks.fetch).toHaveBeenCalledOnce();
  if(kind!=='unmount')expect(hook.result.current.messages.some(message=>message.id==='turn-response')).toBe(false);
 });
 it('does not mark a delayed bootstrap from a retired scope even if a remote hint requests it',async()=>{
  let resolve!:(value:unknown)=>void;mocks.fetch.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  const hook=renderHook(({slug})=>useChatLogic(options(slug)),{initialProps:{slug:'qa-knowledge'}});
  let pending!:Promise<void>;act(()=>{pending=hook.result.current.initializeConversation({force:true});});
  hook.rerender({slug:'qa-current'});
  await act(async()=>{resolve({...published(),initialMenu:institutionalInitialMenuContext(published(),'qa-knowledge')});await pending;});
  expect(hook.result.current.messages).toHaveLength(0);
  mocks.fetch.mockResolvedValueOnce(published('qa-current'));
  await act(async()=>{await hook.result.current.initializeConversation({force:true});});
  expect(hook.result.current.messages[0].institutional?.initialMenu?.tenantSlug).toBe('qa-current');
 });
 it.each(['1','1️⃣'])('does not revive a numeric institutional action %s behind a newer user message',async text=>{
  mocks.fetch.mockResolvedValueOnce(published());const hook=renderHook(()=>useChatLogic(options()));
  await act(async()=>{await hook.result.current.initializeConversation({force:true});});
  act(()=>hook.result.current.setMessages(messages=>[...messages,{id:'newer-user',text:'Mi nueva consulta',isBot:false,timestamp:new Date()}]));
  mocks.fetch.mockResolvedValueOnce({message_body:'Respuesta genérica vigente'});
  await act(async()=>{await hook.result.current.handleSend({text,source:'input'});});
  const [,request]=mocks.fetch.mock.calls.at(-1)!;
  expect(request.body.action).toBeUndefined();expect(request.body.action_id).toBeUndefined();
 });
 it.each(['chat-session','demo-session','endpoint','same-origin','method','session-query-alias'] as const)('retires the same-tenant response and typing after bootstrap %s changes',async kind=>{
  const initial=bootstrap(),changed=structuredClone(initial),respond=vi.fn();
  if(kind==='chat-session')changed.session!.chat_session_id='synthetic-chat-b';
  if(kind==='demo-session')changed.session!.demo_session_id='synthetic-demo-b';
  if(kind==='endpoint')changed.endpoint='/api/demo/runtime/message';
  if(kind==='same-origin')changed.same_origin_endpoint='/api/demo/runtime/message';
  if(kind==='method')changed.method='PUT';
  if(kind==='session-query-alias'){delete initial.session;delete changed.session;initial.query={chat_session_id:'synthetic-query-a'};changed.query={session_id:'synthetic-query-b'};}
  let resolve!:(value:unknown)=>void;mocks.fetch.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  const hook=renderHook(({contract})=>useChatLogic({...options(),chatBootstrap:contract}),{initialProps:{contract:initial}});
  let pending!:Promise<void>;act(()=>{pending=hook.result.current.handleSend('Consulta retirada',{onInstitutionalResponse:respond});});
  expect(hook.result.current.isTyping).toBe(true);
  hook.rerender({contract:changed});expect(hook.result.current.isTyping).toBe(false);
  await act(async()=>{resolve(answer());await pending;});
  expect(respond).not.toHaveBeenCalled();expect(hook.result.current.messages.some(message=>message.id==='turn-response')).toBe(false);
  expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it('does not re-admit a bootstrap-session response after same-tenant A to B to A',async()=>{
  const initial=bootstrap(),changed=structuredClone(initial);changed.session!.chat_session_id='synthetic-chat-b';
  let resolve!:(value:unknown)=>void;mocks.fetch.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  const hook=renderHook(({contract})=>useChatLogic({...options(),chatBootstrap:contract}),{initialProps:{contract:initial}}),respond=vi.fn();
  let pending!:Promise<void>;act(()=>{pending=hook.result.current.handleSend('Consulta retirada',{onInstitutionalResponse:respond});});
  hook.rerender({contract:changed});hook.rerender({contract:initial});
  await act(async()=>{resolve(answer());await pending;});
  expect(respond).not.toHaveBeenCalled();expect(hook.result.current.messages).toHaveLength(0);expect(hook.result.current.isTyping).toBe(false);
 });
 it('keeps an equivalent recreated bootstrap on the same conversation without reset',async()=>{
  const initial=bootstrap();let resolve!:(value:unknown)=>void;mocks.fetch.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  const hook=renderHook(({contract})=>useChatLogic({...options(),chatBootstrap:contract}),{initialProps:{contract:initial}}),respond=vi.fn();
  let pending!:Promise<void>;act(()=>{pending=hook.result.current.handleSend('Consulta vigente',{onInstitutionalResponse:respond});});
  hook.rerender({contract:structuredClone(initial)});expect(hook.result.current.isTyping).toBe(true);
  await act(async()=>{resolve(answer());await pending;});
  expect(respond).toHaveBeenCalledWith('turn-response');expect(hook.result.current.messages.at(-1)?.id).toBe('turn-response');
 });
 it('retires a same-tenant same-token response when the session authority advances',async()=>{
  let resolve!:(value:unknown)=>void;mocks.fetch.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));
  const hook=renderHook(()=>useChatLogic(options())),respond=vi.fn();
  let pending!:Promise<void>;act(()=>{pending=hook.result.current.handleSend('Consulta de sesión retirada',{onInstitutionalResponse:respond});});
  act(()=>{advanceChatbocSessionRevision();});
  expect(hook.result.current.isTyping).toBe(false);
  await act(async()=>{resolve(answer());await pending;});
  expect(respond).not.toHaveBeenCalled();expect(hook.result.current.messages.some(message=>message.id==='turn-response')).toBe(false);
  expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it('does not let an older session ACK clear or replace a newer current-session request',async()=>{
  let resolveA!:(value:unknown)=>void,resolveB!:(value:unknown)=>void;
  mocks.fetch.mockImplementationOnce(()=>new Promise(done=>{resolveA=done;})).mockImplementationOnce(()=>new Promise(done=>{resolveB=done;}));
  const hook=renderHook(()=>useChatLogic(options())),respondA=vi.fn(),respondB=vi.fn();
  let a!:Promise<void>,b!:Promise<void>;act(()=>{a=hook.result.current.handleSend('Consulta de A',{onInstitutionalResponse:respondA});});
  act(()=>{advanceChatbocSessionRevision();});
  act(()=>{b=hook.result.current.handleSend('Consulta de B',{onInstitutionalResponse:respondB});});
  expect(hook.result.current.isTyping).toBe(true);
  await act(async()=>{resolveA(answer('qa-knowledge','retired-session-a'));await a;});
  expect(hook.result.current.isTyping).toBe(true);expect(respondA).not.toHaveBeenCalled();
  expect(hook.result.current.messages.some(message=>message.id==='retired-session-a')).toBe(false);
  await act(async()=>{resolveB(answer('qa-knowledge','current-session-b'));await b;});
  expect(hook.result.current.isTyping).toBe(false);expect(respondB).toHaveBeenCalledWith('current-session-b');
  expect(hook.result.current.messages.at(-1)?.id).toBe('current-session-b');
 });
});
