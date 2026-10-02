import React from 'react';
import {act,cleanup,fireEvent,render,renderHook,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace} from '../../tests/fixtures/institutional-assistant.synthetic';
import {safeLocalStorage} from '@/utils/safeLocalStorage';
import {usePanelSessionStore,useWidgetSessionStore} from '@/stores';
import {resetBackendBootstrapGateForTests} from '@/utils/backendBootstrapGate';

const panelUser=vi.hoisted(()=>({id:900,name:'Synthetic panel operator',email:'panel@example.invalid',phone:'999999999',role:'super_admin'}));
vi.mock('@/config',async original=>({...await original<typeof import('@/config')>(),API_BASE_CANDIDATES:['/api'],BASE_API_URL:'/api',SAME_ORIGIN_PROXY_BASE:'/api'}));
vi.mock('@/utils/api',async()=>await vi.importActual<typeof import('@/utils/api')>('@/utils/api'));
vi.mock('@/hooks/useUser',()=>({useUser:()=>({user:panelUser})}));
vi.mock('@/utils/widgetTelemetry',()=>({trackWidgetEvent:vi.fn()}));
import {useChatLogic} from './useChatLogic';
import ChatMessage from '@/components/chat/ChatMessage';

const originalFetch=global.fetch;
const options=(tenantSlug='qa-visitor')=>({tipoChat:'municipio' as const,tenantSlug,skipAuth:true,socketEnabled:false,autoInitEnabled:false});
const reply=()=>new Response('{"message_body":"Respuesta vigente"}',{headers:{'Content-Type':'application/json'}});
const requestBodies=()=>vi.mocked(global.fetch).mock.calls.filter(([,request])=>request?.method==='POST')
 .map(([url,request])=>({url:String(url),body:JSON.parse(String(request?.body)),request}));
beforeEach(()=>{
 safeLocalStorage.clear();window.sessionStorage.clear();
 usePanelSessionStore.setState({authToken:'synthetic-panel-token',user:panelUser as never});
 useWidgetSessionStore.setState({chatAuthToken:null,entityToken:null});
 safeLocalStorage.setItem('user',JSON.stringify(panelUser));
 safeLocalStorage.setItem('visitor_name','Unscoped prior visitor');
 safeLocalStorage.setItem('chat_session_id','same-synthetic-browser-session');
 vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED','false');
 global.fetch=vi.fn().mockImplementation(async()=>reply());
});
afterEach(()=>{cleanup();global.fetch=originalFetch;vi.restoreAllMocks();vi.unstubAllEnvs();resetBackendBootstrapGateForTests();});

describe('public visitor contact isolation',()=>{
 it('sends an institutional Contactos button only to chat, despite a signed-in administrative panel',async()=>{
  const value=structuredClone(workspace({visibility:'public',can_edit:false}));value.tenant.slug='qa-visitor';
  value.knowledge!.initial.actions[0].label='Contactos por ciudad';
  global.fetch=vi.fn().mockImplementation(async(_url,request)=>request?.method==='GET'
   ?new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}}):reply());
  const hook=renderHook(()=>useChatLogic(options()));
  await act(async()=>{await hook.result.current.initializeConversation();});
  render(<ChatMessage message={hook.result.current.messages[0]} isTyping={false} onButtonClick={hook.result.current.handleSend}/>);
  fireEvent.click(screen.getByRole('button',{name:'Contactos por ciudad'}));
  await waitFor(()=>expect(hook.result.current.isTyping).toBe(false));
  const posts=requestBodies();expect(posts).toHaveLength(1);
  expect(posts[0].url).toContain('/ask/municipio');
  expect(posts[0].body).toMatchObject({pregunta:'Contactos por ciudad',tenant_slug:'qa-visitor',action_id:expect.stringMatching(/^knowledge:/)});
  expect(posts[0].body).not.toHaveProperty('nombre_usuario');
  expect(JSON.stringify(posts[0].body)).not.toContain(panelUser.email);
  expect(JSON.stringify(posts[0].body)).not.toContain(panelUser.name);
  expect(new Headers(posts[0].request?.headers).get('Authorization')).toBeNull();
  expect(posts[0].request?.credentials).toBe('omit');
  expect(hook.result.current.contexto.datos_reclamo.nombre_ciudadano).toBeNull();
  expect(safeLocalStorage.getItem('chat_session_id')).toBe('same-synthetic-browser-session');
  expect(safeLocalStorage.getItem('user')).toBe(JSON.stringify(panelUser));
  expect(safeLocalStorage.getItem('visitor_name')).toBe('Unscoped prior visitor');
 });
 it.each(['Necesito contacto por WhatsApp','Quiero comprar y hablar con ventas'])('does not interpret %s as permission to create a lead',async(text)=>{
  const hook=renderHook(()=>useChatLogic(options()));
  await act(async()=>{await hook.result.current.handleSend(text);});
  const posts=requestBodies();expect(posts).toHaveLength(1);expect(posts[0].url).toContain('/ask/municipio');
  expect(JSON.stringify(posts[0].body)).not.toContain(panelUser.email);
  expect(posts[0].body).not.toHaveProperty('nombre_usuario');
 });
 it('starts an anonymous claim with blank visitor fields instead of the panel profile',async()=>{
  const hook=renderHook(()=>useChatLogic(options()));
  await act(async()=>{await hook.result.current.handleSend({action:'iniciar_creacion_reclamo'});});
  expect(global.fetch).not.toHaveBeenCalled();
  expect(hook.result.current.contexto).toMatchObject({estado_conversacion:'recolectando_datos_personales',datos_reclamo:{nombre_ciudadano:null,email_ciudadano:null}});
  expect(hook.result.current.messages.some(message=>message.text.includes(panelUser.name))).toBe(false);
 });
 it('preserves the current authenticated user in the existing private claim flow',async()=>{
  safeLocalStorage.setItem('authToken','synthetic-private-token');
  const hook=renderHook(()=>useChatLogic({...options(),skipAuth:false}));
  await act(async()=>{await hook.result.current.handleSend({action:'iniciar_creacion_reclamo'});});
  expect(global.fetch).not.toHaveBeenCalled();
  expect(hook.result.current.contexto).toMatchObject({estado_conversacion:'confirmando_reclamo',datos_reclamo:{nombre_ciudadano:panelUser.name,email_ciudadano:panelUser.email}});
 });
 it('preserves explicit visitor form data for the current claim and never carries it into another tenant',async()=>{
  const hook=renderHook(({slug})=>useChatLogic(options(slug)),{initialProps:{slug:'qa-visitor'}});
  const visitor={nombre:'Synthetic visitor',email:'visitor@example.invalid',telefono:'111111111',dni:'12345678'};
  await act(async()=>{await hook.result.current.handleSend({action:'submit_personal_data',payload:visitor});});
  expect(global.fetch).not.toHaveBeenCalled();
  expect(hook.result.current.contexto.datos_reclamo).toMatchObject({nombre_ciudadano:visitor.nombre,email_ciudadano:visitor.email,telefono_ciudadano:visitor.telefono,dni_ciudadano:visitor.dni});
  await act(async()=>{await hook.result.current.handleSend({action:'iniciar_creacion_reclamo'});});
  expect(hook.result.current.contexto.estado_conversacion).toBe('confirmando_reclamo');
  await act(async()=>{await hook.result.current.handleSend('Contacto para continuar');});
  expect(requestBodies()[0].body.nombre_usuario).toBe(visitor.nombre);
  expect(requestBodies()).toHaveLength(1);
  hook.rerender({slug:'qa-other'});
  await act(async()=>{await hook.result.current.handleSend('Contacto en esta organización');});
  expect(requestBodies()).toHaveLength(2);
  expect(requestBodies()[1].body).not.toHaveProperty('nombre_usuario');
  expect(requestBodies()[1].body.contexto_previo.datos_reclamo.nombre_ciudadano).toBeNull();
  hook.rerender({slug:'qa-visitor'});
  await act(async()=>{await hook.result.current.handleSend('Volver a esta organización');});
  expect(requestBodies()[2].body).not.toHaveProperty('nombre_usuario');
 });
});
