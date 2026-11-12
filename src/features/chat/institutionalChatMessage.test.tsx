import React from 'react';
import {act,cleanup,fireEvent,render,renderHook,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace,node} from '../../../tests/fixtures/institutional-assistant.synthetic';
import {isInstitutionalChatPayload,parseInstitutionalChatMessage,institutionalChoiceLabel,institutionalChatBootstrapPayload,institutionalNumericChatAction} from './institutionalChatMessage';
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
import type {InstitutionalAudioReading} from '@/components/knowledge/institutionalAssistantAudio';
import {advanceChatbocSessionRevision} from '@/utils/chatbocSessionRevision';

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
 it.each(['1',' 1 ','1️⃣','1⃣'])('resolves only the currently advertised numeric option %s',input=>{
  const answer=parseInstitutionalChatMessage(payload(),'qa-knowledge');
  expect(institutionalNumericChatAction(input,answer,'qa-knowledge')).toBe('knowledge:bbbbbbbbbbbbbbbb:topic-0');
 });
 it('uses canonical zero and ten codes without deriving them from list positions',()=>{
  const answer=parseInstitutionalChatMessage(payload(),'qa-knowledge')!;
  answer.nodes[0].actions=[{code:'0',label:'Volver al menú',target:'start'},{code:'10',label:'Otras consultas',target:'other'}];
  expect(institutionalNumericChatAction('0️⃣',answer,'qa-knowledge')).toBe('knowledge:bbbbbbbbbbbbbbbb:start');
  expect(institutionalNumericChatAction('🔟',answer,'qa-knowledge')).toBe('knowledge:bbbbbbbbbbbbbbbb:other');
  expect(institutionalNumericChatAction('1',answer,'qa-knowledge')).toBeNull();
 });
 it.each(['1 CUD','CUD 1','11','01','1\n2','１','1️⃣ texto',''])('does not reinterpret text or an unadvertised code %s',input=>{
  expect(institutionalNumericChatAction(input,parseInstitutionalChatMessage(payload(),'qa-knowledge'),'qa-knowledge')).toBeNull();
 });
 it('refuses ambiguous codes, another tenant and an invalid revision',()=>{
  const answer=parseInstitutionalChatMessage(payload(),'qa-knowledge')!;
  expect(institutionalNumericChatAction('1',answer,'another-tenant')).toBeNull();
  expect(institutionalNumericChatAction('1',{...answer,revision:'invalid'},'qa-knowledge')).toBeNull();
  answer.nodes[0].actions.push({code:'1',label:'Otro destino',target:'other'});
  expect(institutionalNumericChatAction('1',answer,'qa-knowledge')).toBeNull();
 });
 it('exposes reading only when the backend supplies its complete audio capability, independently of choice paging',()=>{
  const copy:InstitutionalAudioReading={contract_version:'chatboc.institutional_audio.v1',listen:'Escuchar',pause:'Pausar',resume:'Continuar audio',stop:'Detener',loading:'Preparando audio…',error:'La información sigue disponible en texto.',disclosure:'Voz generada por IA.'};
  const w=workspace({visibility:'public',can_edit:false,audio_reading:copy});
  const initial=institutionalChatBootstrapPayload(w,w.tenant.slug);
  expect(initial.knowledge_audio_reading).toEqual(copy);expect(parseInstitutionalChatMessage(initial,w.tenant.slug)?.audioReading).toEqual(copy);
  expect(parseInstitutionalChatMessage({...payload(),knowledge_audio_reading:{...copy,disclosure:''}},'qa-knowledge')).toBeNull();
  expect(parseInstitutionalChatMessage(payload(),'qa-knowledge')?.audioReading).toBeUndefined();
 });
 it('propagates backend navigation copy through the ordinary public bootstrap without inventing copy for older workspaces',()=>{
  const w=workspace({visibility:'public',can_edit:false});
  const ui={more_options:'Otras consultas',previous_options:'Consultas previas',options_page:'Grupo {current}/{total}'};
  const next={...w,ui:{...w.ui,...ui}};
  expect(parseInstitutionalChatMessage(institutionalChatBootstrapPayload(next,w.tenant.slug),w.tenant.slug)?.ui).toEqual({...ui,large_text:w.ui.large_text,source_details:w.ui.source_details});
  expect(parseInstitutionalChatMessage(institutionalChatBootstrapPayload(w,w.tenant.slug),w.tenant.slug)?.ui).toBeUndefined();
 });
 it('validates supplied navigation copy without changing revision-bound button validation',()=>{
  const data=payload(),ui={more_options:'Más opciones',previous_options:'Opciones anteriores',options_page:'Grupo {current} de {total}',large_text:'Lectura ampliada',source_details:'Consultar documentos'};
  expect(parseInstitutionalChatMessage({...data,knowledge_ui:ui},'qa-knowledge')?.ui).toEqual(ui);
  for(const invalid of [null,{}, {...ui,options_page:'Grupo {current}'},{...ui,large_text:' '},{...ui,more_options:'x'.repeat(201)}])expect(parseInstitutionalChatMessage({...data,knowledge_ui:invalid},'qa-knowledge')).toBeNull();
 });
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
 it('shows each canonical code once in the accessible name without renumbering choices or changing the original action label',()=>{
  const answer=parseInstitutionalChatMessage(payload(),'qa-knowledge')!,onButtonClick=vi.fn();
  answer.nodes[0].actions=[{code:'5',label:'🚗 Oblea del auto',target:'car'},{code:'9',label:'🏠 Volver al menú',target:'start'}];
  render(<InstitutionalChatMessage answer={answer} onButtonClick={onButtonClick}/>);
  const car=screen.getByRole('button',{name:'5 Oblea del auto'}),home=screen.getByRole('button',{name:'9 Volver al menú'});
  expect(car.firstElementChild).toHaveTextContent('5');expect(home.firstElementChild).toHaveTextContent('9');
  expect(car).not.toHaveAttribute('aria-label');expect(car.querySelector('[aria-hidden=true]')).toHaveTextContent('🚗');
  fireEvent.click(car);
  expect(onButtonClick).toHaveBeenCalledWith({text:'🚗 Oblea del auto',action:'knowledge:bbbbbbbbbbbbbbbb:car',action_id:'knowledge:bbbbbbbbbbbbbbbb:car',source:'button'});
 });
 it('reaches all eleven options through backend-labelled pages and sends the exact final advertised action',()=>{
  const data=payload(),actions=Array.from({length:11},(_,i)=>({code:String(i),label:`📄 Consulta ${i+1}`,target:`topic-${i}`}));
  data.knowledge_nodes=[0,1,2].map(i=>({...data.knowledge_nodes[0],id:`node-${i}`,title:`Tema ${i+1}`,actions:actions.slice(i*4,i*4+4)}));
  data.botones=actions.map(a=>({texto:a.label,action_id:`knowledge:${data.context_revision.slice(0,16)}:${a.target}`}));
  const ui={more_options:'Más opciones',previous_options:'Opciones anteriores',options_page:'Grupo {current} de {total}',large_text:'Lectura ampliada',source_details:'Consultar documentos'};
  const answer=parseInstitutionalChatMessage({...data,knowledge_ui:ui},'qa-knowledge')!,onButtonClick=vi.fn(),mounted=render(<InstitutionalChatMessage answer={answer} onButtonClick={onButtonClick}/>);
  expect(screen.getByRole('button',{name:'Lectura ampliada'})).toBeVisible();expect(screen.getAllByText('Consultar documentos')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button',{name:'Más opciones'}));expect(screen.getByRole('button',{name:'4 Consulta 5'})).toHaveFocus();
  expect(screen.getAllByText(node().text)).toHaveLength(3);expect(screen.getAllByText('Información institucional de prueba')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button',{name:'Más opciones'}));expect(onButtonClick).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'10 Consulta 11'}));expect(onButtonClick).toHaveBeenCalledWith({text:data.botones[10].texto,action:data.botones[10].action_id,action_id:data.botones[10].action_id,source:'button'});
  mounted.rerender(<InstitutionalChatMessage answer={{...answer,revision:'d'.repeat(64),tenant:{id:702,slug:'other-organization'}}} onButtonClick={onButtonClick}/>);
  expect(screen.getByRole('status')).toHaveTextContent('Grupo 1 de 3');expect(screen.getByRole('button',{name:'0 Consulta 1'})).toBeVisible();
  expect(screen.queryByRole('button',{name:'Opciones anteriores'})).not.toBeInTheDocument();
 });
 it('uses the same semantic reading blocks in the widget and preserves source metadata and choices',()=>{
  const data=payload();data.knowledge_nodes[0].text='Documentación disponible.\n\n• Original legible\n• <script>literal</script>\n\nPasos de consulta.\n1. Prepará la consulta\n2. Consultá con el equipo';
  const onButtonClick=vi.fn(),answer=parseInstitutionalChatMessage(data,'qa-knowledge')!;
  const mounted=render(<InstitutionalChatMessage answer={answer} onButtonClick={onButtonClick}/>);
  const prose=mounted.container.querySelector('.institutional-chat-message__prose')!;
  expect(Array.from(prose.children,element=>element.tagName)).toEqual(['P','UL','P','OL']);
  expect(prose.querySelectorAll('li')).toHaveLength(4);expect(prose).toHaveTextContent('<script>literal</script>');expect(prose.querySelector('script')).toBeNull();
  expect(screen.getByText('Información institucional de prueba')).toBeInTheDocument();expect(screen.getByRole('button',{name:'1 Documentación'})).toBeVisible();
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
  for(const action of data.knowledge_nodes[0].actions){const label=institutionalChoiceLabel(action.label);const choice=screen.getByRole('button',{name:`${action.code} ${label.words}`});expect(choice).toBeVisible();expect(choice).toHaveAttribute('type','button');expect(choice.querySelector('[aria-hidden=true]')).toHaveTextContent(label.emoji!);expect(choice).not.toHaveAttribute('aria-label');}
  const next=payload();next.knowledge_nodes[0].id='topic-5';next.knowledge_nodes[0].title='Contacto y ayuda';next.knowledge_nodes[0].text='Consultá los canales informados por el equipo.';
  next.message_body='Consultá los canales informados por el equipo.';next.messages[0].content=next.message_body;mocks.fetch.mockResolvedValueOnce(next);
  await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'6 Contacto y ayuda'}));});
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
  expect(screen.getByRole('button',{name:'1 Documentación'})).toBeVisible();expect(onButtonClick).not.toHaveBeenCalled();
 });
 it('moves focus from an activated menu to the next heading while preserving focus for typing elsewhere',()=>{
  const answer=parseInstitutionalChatMessage(payload(),'qa-knowledge')!,mounted=render(<InstitutionalChatMessage answer={answer} onButtonClick={()=>{}}/>);
  const origin=screen.getByRole('button',{name:'1 Documentación'});origin.focus();fireEvent.click(origin);
  mounted.rerender(<InstitutionalChatMessage answer={{...answer,nodes:[{...answer.nodes[0],id:'topic-0',title:'Documentación necesaria'}]}} onButtonClick={()=>{}}/>);
  expect(screen.getByRole('heading',{name:'Documentación necesaria'})).toHaveFocus();
  const input=document.createElement('input');document.body.append(input);input.focus();
  mounted.rerender(<InstitutionalChatMessage answer={{...answer,nodes:[{...answer.nodes[0],id:'health',title:'Salud y terapias'}]}} onButtonClick={()=>{}}/>);
  expect(input).toHaveFocus();input.remove();
 });
 it('does not take focus from another reader when a new institutional response mounts',()=>{
  const answer=parseInstitutionalChatMessage(payload(),'qa-knowledge')!;
  const mounted=render(<><InstitutionalChatMessage answer={answer} onButtonClick={()=>{}}/></>);
  const origin=screen.getByRole('button',{name:'1 Documentación'});origin.focus();
  mounted.rerender(<><InstitutionalChatMessage answer={answer} onButtonClick={()=>{}}/>
   <InstitutionalChatMessage answer={{...answer,nodes:[{...answer.nodes[0],id:'later',title:'Respuesta posterior'}]}} onButtonClick={()=>{}}/></>);
  expect(origin.isConnected).toBe(true);expect(origin).toHaveFocus();
 });
 it('preserves the other reader choice when an earlier activated menu receives its delayed answer',()=>{
  const a=parseInstitutionalChatMessage(payload(),'qa-knowledge')!,b={...a,nodes:[{...a.nodes[0],id:'other-reader',title:'Otro lector'}]},onChoose=vi.fn();
  const view=(answer:typeof a)=><><InstitutionalChatMessage answer={answer} onButtonClick={onChoose}/><InstitutionalChatMessage answer={b} onButtonClick={()=>{}}/></>;
  const mounted=render(view(a)),readers=screen.getAllByTestId('institutional-chat-message');
  const origin=within(readers[0]).getByRole('button',{name:'1 Documentación'}),external=within(readers[1]).getByRole('button',{name:'2 Salud y terapias'});
  origin.focus();fireEvent.click(origin);external.focus();
  mounted.rerender(view({...a,nodes:[{...a.nodes[0],id:'topic-0',title:'Respuesta demorada'}]}));
  expect(external).toHaveFocus();expect(onChoose).toHaveBeenCalledOnce();
 });
 it('does not regain an old activation after keyboard focus leaves and returns to its menu',()=>{
  const answer=parseInstitutionalChatMessage(payload(),'qa-knowledge')!,onChoose=vi.fn();
  const mounted=render(<><input aria-label="Otra tarea"/><InstitutionalChatMessage answer={answer} onButtonClick={onChoose}/></>);
  const origin=screen.getByRole('button',{name:'1 Documentación'});origin.focus();fireEvent.click(origin);
  screen.getByRole('textbox',{name:'Otra tarea'}).focus();origin.focus();
  mounted.rerender(<><input aria-label="Otra tarea"/><InstitutionalChatMessage answer={{...answer,nodes:[{...answer.nodes[0],id:'topic-0',title:'Respuesta demorada'}]}} onButtonClick={onChoose}/></>);
  expect(origin).toHaveFocus();expect(onChoose).toHaveBeenCalledOnce();
 });
 it('keeps an unactivated choice focused instead of treating focus alone as a request',()=>{
  const answer=parseInstitutionalChatMessage(payload(),'qa-knowledge')!,mounted=render(<InstitutionalChatMessage answer={answer} onButtonClick={()=>{}}/>);
  const origin=screen.getByRole('button',{name:'1 Documentación'});origin.focus();
  mounted.rerender(<InstitutionalChatMessage answer={{...answer,nodes:[{...answer.nodes[0],id:'topic-0',title:'Otra respuesta'}]}} onButtonClick={()=>{}}/>);
  expect(origin).toHaveFocus();
 });
 it('permits an explicit pointer activation from BODY without pretending that an external input belongs to it',()=>{
  const answer=parseInstitutionalChatMessage(payload(),'qa-knowledge')!,onChoose=vi.fn(),view=(value:typeof answer)=><><input aria-label="Otra tarea"/><InstitutionalChatMessage answer={value} onButtonClick={onChoose}/></>;
  const mounted=render(view(answer));expect(document.activeElement).toBe(document.body);
  fireEvent.click(screen.getByRole('button',{name:'1 Documentación'}));
  const next={...answer,nodes:[{...answer.nodes[0],id:'topic-0',title:'Respuesta del primer clic'}]};mounted.rerender(view(next));
  expect(screen.getByRole('heading',{name:'Respuesta del primer clic'})).toHaveFocus();
  const external=screen.getByRole('textbox',{name:'Otra tarea'});external.focus();
  fireEvent.click(screen.getByRole('button',{name:'2 Salud y terapias'}));
  mounted.rerender(view({...next,nodes:[{...next.nodes[0],id:'topic-1',title:'Respuesta del segundo clic'}]}));
  expect(external).toHaveFocus();expect(onChoose).toHaveBeenCalledTimes(2);
 });
 it('does not infer ownership from BODY after a voluntary blur of the connected origin',()=>{
  const answer=parseInstitutionalChatMessage(payload(),'qa-knowledge')!,mounted=render(<InstitutionalChatMessage answer={answer} onButtonClick={()=>{}}/>);
  const origin=screen.getByRole('button',{name:'1 Documentación'});origin.focus();fireEvent.click(origin);origin.blur();
  mounted.rerender(<InstitutionalChatMessage answer={{...answer,nodes:[{...answer.nodes[0],id:'topic-0',title:'Respuesta demorada',actions:[]}]}} onButtonClick={()=>{}}/>);
  expect(origin.isConnected).toBe(false);expect(document.activeElement).toBe(document.body);
 });
 it.each(['owned','externally retired'] as const)('handles Chromium blur during React removal only for an %s activation',ownership=>{
  const answer=parseInstitutionalChatMessage(payload(),'qa-knowledge')!,view=(value:typeof answer)=><><input aria-label="Otra tarea"/><InstitutionalChatMessage answer={value} onButtonClick={()=>{}}/></>;
  const mounted=render(view(answer)),origin=screen.getByRole('button',{name:'1 Documentación'});
  origin.focus();fireEvent.click(origin);
  if(ownership==='externally retired'){const external=screen.getByRole('textbox',{name:'Otra tarea'});external.focus();external.blur();}
  const removeChild=Node.prototype.removeChild;let connectedBlur=false;
  const removal=vi.spyOn(Node.prototype,'removeChild').mockImplementation(function(this:Node,child:Node){
   if(child===origin||child.contains(origin)){expect(origin.isConnected).toBe(true);connectedBlur=true;origin.blur();}
   return removeChild.call(this,child);
  });
  try{
   mounted.rerender(view({...answer,nodes:[{...answer.nodes[0],id:'topic-0',title:'Respuesta tras retirar opción',actions:[]}]}));
   expect(connectedBlur).toBe(true);expect(origin.isConnected).toBe(false);
   if(ownership==='owned')expect(screen.getByRole('heading',{name:'Respuesta tras retirar opción'})).toHaveFocus();
   else expect(document.activeElement).toBe(document.body);
  }finally{removal.mockRestore();}
 });
 it.each(['id','slug','revision'] as const)('retires activation across a %s change and does not restore it when the old scope returns',kind=>{
  const answer=parseInstitutionalChatMessage(payload(),'qa-knowledge')!,mounted=render(<InstitutionalChatMessage answer={answer} onButtonClick={()=>{}}/>);
  const origin=screen.getByRole('button',{name:'1 Documentación'});origin.focus();fireEvent.click(origin);
  const foreign={...answer,tenant:{...answer.tenant},nodes:[{...answer.nodes[0],id:'topic-0',title:'Otro contexto'}]};
  if(kind==='id')foreign.tenant.id+=1;if(kind==='slug')foreign.tenant.slug='qa-other';if(kind==='revision')foreign.revision='c'.repeat(64);
  mounted.rerender(<InstitutionalChatMessage answer={foreign} onButtonClick={()=>{}}/>);expect(origin).toHaveFocus();
  mounted.rerender(<InstitutionalChatMessage answer={{...answer,nodes:[{...answer.nodes[0],id:'topic-0',title:'Contexto anterior'}]}} onButtonClick={()=>{}}/>);expect(origin).toHaveFocus();
 });
 it('retires the local activation after the normal authority generation changes',()=>{
  const answer=parseInstitutionalChatMessage(payload(),'qa-knowledge')!,mounted=render(<InstitutionalChatMessage answer={answer} onButtonClick={()=>{}}/>);
  const origin=screen.getByRole('button',{name:'1 Documentación'});origin.focus();fireEvent.click(origin);
  act(()=>{advanceChatbocSessionRevision();});
  mounted.rerender(<InstitutionalChatMessage answer={{...answer,nodes:[{...answer.nodes[0],id:'topic-0',title:'Sesión siguiente'}]}} onButtonClick={()=>{}}/>);expect(origin).toHaveFocus();
 });
 it('cannot transfer an unmounted reader activation to a later reader',()=>{
  const answer=parseInstitutionalChatMessage(payload(),'qa-knowledge')!,mounted=render(<InstitutionalChatMessage answer={answer} onButtonClick={()=>{}}/>);
  const origin=screen.getByRole('button',{name:'1 Documentación'});origin.focus();fireEvent.click(origin);mounted.unmount();
  render(<InstitutionalChatMessage answer={{...answer,nodes:[{...answer.nodes[0],id:'topic-0',title:'Otro montaje'}]}} onButtonClick={()=>{}}/>);
  expect(document.activeElement).toBe(document.body);
 });
 it('consumes the activation on an unrelated or repeated response without reviving it later',()=>{
  const answer=parseInstitutionalChatMessage(payload(),'qa-knowledge')!,view=(value:typeof answer)=><InstitutionalChatMessage answer={value} onButtonClick={()=>{}}/>;
  const mounted=render(view(answer));const origin=screen.getByRole('button',{name:'1 Documentación'});origin.focus();fireEvent.click(origin);
  mounted.rerender(view({...answer}));expect(origin).toHaveFocus();
  mounted.rerender(view({...answer,nodes:[{...answer.nodes[0],id:'topic-0',title:'Resultado tardío'}]}));expect(origin).toHaveFocus();
  fireEvent.click(origin);
  mounted.rerender(view({...answer,nodes:[{...answer.nodes[0],id:'topic-1',title:'Resultado de otra opción'}]}));expect(origin).toHaveFocus();
  mounted.rerender(view({...answer,nodes:[{...answer.nodes[0],id:'topic-0',title:'Resultado todavía más tarde'}]}));expect(origin).toHaveFocus();
 });
});
