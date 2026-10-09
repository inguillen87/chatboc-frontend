import React from 'react';
import {act,cleanup,fireEvent,render,renderHook,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace,node} from '../../../tests/fixtures/institutional-assistant.synthetic';
import {isInstitutionalChatPayload,parseInstitutionalChatMessage,institutionalChoiceLabel} from './institutionalChatMessage';
const mocks=vi.hoisted(()=>({fetch:vi.fn(),workspace:vi.fn()}));
vi.mock('@/utils/api',async importOriginal=>({...await importOriginal<typeof import('@/utils/api')>(),apiFetch:(...args:unknown[])=>String(args[0]).includes('/institutional-assistant')?mocks.workspace(...args):mocks.fetch(...args)}));
vi.mock('@/hooks/useUser',()=>({useUser:()=>({user:null})}));
vi.mock('@/context/TenantContext',()=>({useTenant:()=>({currentSlug:'qa-knowledge'})}));
vi.mock('@/utils/widgetTelemetry',()=>({trackWidgetEvent:vi.fn()}));
import {useChatLogic} from '@/hooks/useChatLogic';
import ChatMessage from '@/components/chat/ChatMessage';
import InstitutionalChatMessage from '@/components/chat/InstitutionalChatMessage';
import AccessibilityToggle,{readAccessibilityPrefs} from '@/components/chat/AccessibilityToggle';
import {ApiError} from '@/utils/api';

function payload(){
 const w=structuredClone(workspace({visibility:'public',can_edit:false})),initial=node();
 initial.actions=['📄 Documentación','🩺 Salud y terapias','🤝 Pensión y licencias','🎒 Escuela y apoyos','🛠️ Trabajo y cursos','💬 Contacto y ayuda'].map((label,index)=>({code:String(index+1),label,target:`topic-${index}`}));
 const source={...initial.sources[0],document_visibility:'private' as const,url:'https://example.test/reserved-original',origin_url:'https://example.test/reserved-origin'};
 initial.sources=[source];
 return {fuente:'institutional_knowledge',context_revision:w.revision!,knowledge_tenant:{id:w.tenant.id,slug:w.tenant.slug},knowledge_nodes:[initial],knowledge_sources:[source],
  message_body:'LEGACY_FORMATTED_BODY',messages:[{role:'assistant',content:'LEGACY_FORMATTED_BODY'}],
  botones:initial.actions.map(action=>({texto:action.label,action_id:`knowledge:${w.revision!.slice(0,16)}:${action.target}`}))};
}
beforeEach(()=>{mocks.fetch.mockReset();mocks.workspace.mockReset();mocks.workspace.mockRejectedValue(new ApiError('Not available',404,{reason_code:'knowledge_not_available'}));window.localStorage.clear();window.sessionStorage.clear();});
afterEach(cleanup);

describe('institutional responder boundary',()=>{
 it('accepts only the exact responder source, tenant and advertised revision-bound actions',()=>{
  const data=payload();expect(parseInstitutionalChatMessage(data,'qa-knowledge')?.nodes).toHaveLength(1);
  expect(isInstitutionalChatPayload(data)).toBe(true);expect(parseInstitutionalChatMessage({...data,fuente:'government_widget_menu'},'qa-knowledge')).toBeNull();
 });
 it('accepts the real public projection with the reserved source URLs omitted',()=>{
  const data=payload();delete data.knowledge_nodes[0].sources[0].url;delete data.knowledge_nodes[0].sources[0].origin_url;
  expect(parseInstitutionalChatMessage(data,'qa-knowledge')?.sources[0].url).toBeUndefined();
  expect(parseInstitutionalChatMessage(data,'qa-knowledge')?.nodes[0].sources[0].document_visibility).toBe('private');
 });
 it.each(['tenant','revision','source','button','label'] as const)('refuses incompatible %s before rendering the institutional reader',fault=>{
  const data=payload();
  if(fault==='tenant')data.knowledge_tenant.slug='other-organization';
  if(fault==='revision')data.context_revision='bad';
  if(fault==='source')data.knowledge_nodes[0].sources[0]={...data.knowledge_nodes[0].sources[0],sha256:'c'.repeat(64)};
  if(fault==='button')data.botones[0].action_id='knowledge:cccccccccccccccc:topic-0';
  if(fault==='label')data.botones[0].texto='Otro destino';
  expect(parseInstitutionalChatMessage(data,'qa-knowledge')).toBeNull();
 });
 it('keeps words in the accessible label without changing an advertised emoji action',()=>{
  expect(institutionalChoiceLabel('🛠️ Trabajo y cursos')).toEqual({emoji:'🛠️',words:'Trabajo y cursos'});
  expect(institutionalChoiceLabel('Consultar requisitos')).toEqual({emoji:null,words:'Consultar requisitos'});
  expect(institutionalChoiceLabel('💬')).toEqual({emoji:null,words:'💬'});
 });
});

describe('actual embedded chat normalization and renderer',()=>{
 it('uses the same semantic reading blocks in the widget and preserves source metadata and choices',()=>{
  const data=payload();data.knowledge_nodes[0].text='Documentación disponible.\n\n• Original legible\n• <script>literal</script>\n\nPasos de consulta.\n1. Prepará la consulta\n2. Consultá con el equipo';
  const onButtonClick=vi.fn(),answer=parseInstitutionalChatMessage(data,'qa-knowledge')!;
  const mounted=render(<InstitutionalChatMessage answer={answer} onButtonClick={onButtonClick}/>);
  const prose=mounted.container.querySelector('.institutional-chat-message__prose')!;
  expect(Array.from(prose.children,element=>element.tagName)).toEqual(['P','UL','P','OL']);
  expect(prose.querySelectorAll('li')).toHaveLength(4);expect(prose).toHaveTextContent('<script>literal</script>');expect(prose.querySelector('script')).toBeNull();
  expect(screen.getByText('Información institucional de prueba')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Documentación'})).toBeVisible();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();expect(mounted.container.textContent).not.toContain('reserved-');expect(onButtonClick).not.toHaveBeenCalled();
 });
 it('preserves the institutional envelope over legacy messages, renders all six choices and sends the exact action through the existing chat',async()=>{
  const data=payload();mocks.fetch.mockResolvedValue(data);
  const hook=renderHook(()=>useChatLogic({tipoChat:'municipio',tenantSlug:'qa-knowledge',skipAuth:true,socketEnabled:false,autoInitEnabled:false}));
  await act(async()=>{await hook.result.current.initializeConversation({force:true,resetContext:true,resetMessages:true});});
  const message=hook.result.current.messages.find(item=>item.isBot)!;
  expect(message.institutional?.tenant).toEqual(data.knowledge_tenant);expect(message.botones).toHaveLength(6);
  render(<ChatMessage message={message} isTyping={false} onButtonClick={value=>void hook.result.current.handleSend(value)}/>);
  const reader=screen.getByTestId('institutional-chat-message');expect(reader.querySelector('pre')).toBeNull();
  expect(screen.getByText('Elegí un tema o escribí una pregunta.').tagName).toBe('P');
  expect(screen.queryByText('LEGACY_FORMATTED_BODY')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:/Mostrar.*opciones/})).not.toBeInTheDocument();
  for(const action of data.knowledge_nodes[0].actions){const label=institutionalChoiceLabel(action.label);const choice=screen.getByRole('button',{name:label.words});expect(choice).toBeVisible();expect(choice).toHaveAttribute('type','button');expect(choice.querySelector('[aria-hidden=true]')).toHaveTextContent(label.emoji!);}
  const next=payload();next.knowledge_nodes[0].id='topic-5';next.knowledge_nodes[0].title='Contacto y ayuda';next.knowledge_nodes[0].text='Consultá los canales informados por el equipo.';
  next.message_body='Consultá los canales informados por el equipo.';next.messages[0].content=next.message_body;mocks.fetch.mockResolvedValueOnce(next);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Contacto y ayuda'}));});
  expect(mocks.fetch).toHaveBeenCalledTimes(2);expect(mocks.fetch.mock.calls[1][1].body).toMatchObject({action_id:data.botones[5].action_id,pregunta:data.botones[5].texto,tenant_slug:'qa-knowledge'});
  expect(mocks.fetch.mock.calls[1][1].headers['Idempotency-Key']).toBeTruthy();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();expect(reader.textContent).not.toContain('reserved-');
 });
 it('does not display a foreign tenant answer or preserve its controls through generic fallback',async()=>{
  const data={...payload(),ticket_id:999,datos_estructura:{descripcion:'FOREIGN_CASE_DESCRIPTION'}};data.knowledge_tenant.slug='other-organization';mocks.fetch.mockResolvedValue(data);
  const hook=renderHook(()=>useChatLogic({tipoChat:'municipio',tenantSlug:'qa-knowledge',skipAuth:true,socketEnabled:false,autoInitEnabled:false}));
  await act(async()=>{await hook.result.current.initializeConversation({force:true,resetContext:true,resetMessages:true});});
  const message=hook.result.current.messages.find(item=>item.isBot)!;
  expect(message.institutional).toBeUndefined();expect(message.botones).toBeUndefined();expect(message.text).toContain('No pudimos verificar');expect(message.text).not.toContain('LEGACY_FORMATTED_BODY');
  expect(hook.result.current.contexto.id_ticket_creado).toBeNull();expect(hook.result.current.contexto.datos_reclamo.descripcion).toBeNull();
  expect(mocks.fetch).toHaveBeenCalledOnce();
 });
 it('labels the existing reading preference without a diagnosis and preserves its stored key',()=>{
  window.localStorage.setItem('chatboc_accessibility',JSON.stringify({dyslexia:true}));
  render(<AccessibilityToggle/>);fireEvent.click(screen.getByRole('button',{name:'Abrir ajustes de accesibilidad'}));
  expect(screen.getByText('Lectura espaciada')).toBeVisible();expect(screen.queryByText('Modo dislexia')).not.toBeInTheDocument();
  expect(readAccessibilityPrefs().dyslexia).toBe(true);
 });
 it('preserves a normal operational message without enabling the institutional renderer',async()=>{
  mocks.fetch.mockResolvedValue({fuente:'government_widget_menu',message_body:'Respuesta operativa',botones:[{texto:'Crear caso',action_id:'crear_reclamo'}]});
  const hook=renderHook(()=>useChatLogic({tipoChat:'municipio',tenantSlug:'qa-knowledge',skipAuth:true,socketEnabled:false,autoInitEnabled:false}));
  await act(async()=>{await hook.result.current.initializeConversation({force:true,resetContext:true,resetMessages:true});});
  const message=hook.result.current.messages.find(item=>item.isBot)!;expect(message.institutional).toBeUndefined();expect(message.botones?.[0].action_id).toBe('crear_reclamo');
 });
 it('enlarges text without replacing the response or changing its menu destinations',()=>{
  const onButtonClick=vi.fn(),answer=parseInstitutionalChatMessage(payload(),'qa-knowledge')!;
  render(<InstitutionalChatMessage answer={answer} onButtonClick={onButtonClick}/>);
  const toggle=screen.getByRole('button',{name:'Texto más grande'});fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-pressed','true');expect(screen.getByTestId('institutional-chat-message')).toHaveClass('institutional-chat-message--large');
  expect(screen.getByRole('button',{name:'Documentación'})).toBeVisible();expect(onButtonClick).not.toHaveBeenCalled();
 });
 it('moves focus from an activated menu to the next heading while preserving focus for typing elsewhere',()=>{
  const answer=parseInstitutionalChatMessage(payload(),'qa-knowledge')!,mounted=render(<InstitutionalChatMessage answer={answer} onButtonClick={()=>{}}/>);
  screen.getByRole('button',{name:'Documentación'}).focus();
  mounted.rerender(<InstitutionalChatMessage answer={{...answer,nodes:[{...answer.nodes[0],id:'requirements',title:'Documentación necesaria'}]}} onButtonClick={()=>{}}/>);
  expect(screen.getByRole('heading',{name:'Documentación necesaria'})).toHaveFocus();
  const input=document.createElement('input');document.body.append(input);input.focus();
  mounted.rerender(<InstitutionalChatMessage answer={{...answer,nodes:[{...answer.nodes[0],id:'health',title:'Salud y terapias'}]}} onButtonClick={()=>{}}/>);
  expect(input).toHaveFocus();input.remove();
 });
});
