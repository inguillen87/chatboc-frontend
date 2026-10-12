import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace,node,reply} from '../../../tests/fixtures/institutional-assistant.synthetic';
import {institutionalChatBootstrapPayload,institutionalInitialMenuContext,institutionalPresentationMode,parseInstitutionalChatMessage,type InstitutionalChatMessage as InstitutionalAnswer} from '@/features/chat/institutionalChatMessage';
import InstitutionalAssistant from './InstitutionalAssistant';
import InstitutionalChatMessage from '@/components/chat/InstitutionalChatMessage';

const mocks=vi.hoisted(()=>({fetch:vi.fn(),readAudio:vi.fn()}));
vi.mock('@/utils/api',async original=>({...await original<typeof import('@/utils/api')>(),apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
vi.mock('./institutionalAssistantAudio',async original=>({...await original<typeof import('./institutionalAssistantAudio')>(),readInstitutionalAudio:(...args:unknown[])=>mocks.readAudio(...args)}));
const audio={contract_version:'chatboc.institutional_audio.v1' as const,listen:'Escuchar respuesta',pause:'Pausar lectura',resume:'Continuar lectura',stop:'Detener lectura',loading:'Preparando lectura',error:'No se pudo leer esta respuesta',disclosure:'Voz generada para la respuesta publicada.'};
const published=(count=6)=>{
  const value=structuredClone(workspace({visibility:'public',can_edit:false,audio_reading:audio}));
  value.ui={...value.ui,more_options:'Otras opciones',previous_options:'Opciones anteriores',options_page:'Grupo {current} de {total}'};
  value.knowledge!.node_count=count+1;
  value.knowledge!.initial.actions=Array.from({length:count},(_,index)=>({code:String(index+1),label:`Tema canónico ${index+1}`,target:`topic-${index+1}`}));
  value.knowledge!.topics=value.knowledge!.initial.actions.map(action=>({id:action.target,label:action.label}));
  return value;
};
const initialAnswer=(count=6):InstitutionalAnswer=>{
  const value=published(count);
  const answer=parseInstitutionalChatMessage(institutionalChatBootstrapPayload(value,value.tenant.slug),value.tenant.slug)!;
  return {...answer,initialMenu:institutionalInitialMenuContext(value,value.tenant.slug)!};
};
const before=(first:Element,second:Element)=>expect(first.compareDocumentPosition(second)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
beforeEach(()=>{
  mocks.fetch.mockReset();mocks.readAudio.mockReset();
  vi.spyOn(HTMLMediaElement.prototype,'pause').mockImplementation(()=>{});
  vi.spyOn(HTMLMediaElement.prototype,'load').mockImplementation(()=>{});
  vi.spyOn(HTMLMediaElement.prototype,'play').mockResolvedValue(undefined);
});
afterEach(()=>{cleanup();vi.restoreAllMocks();});

describe('canonical initial presentation authority',()=>{
  it('uses the validated published start and preserves exact advertised actions',()=>{
    const value=published();const context=institutionalInitialMenuContext(value,value.tenant.slug)!;
    const answer=initialAnswer();
    expect(context).toEqual({tenantId:value.tenant.id,tenantSlug:value.tenant.slug,revision:value.revision,startNodeId:value.knowledge!.start});
    expect(institutionalPresentationMode(answer,context)).toBe('initial-menu');
    expect(answer.nodes[0].actions).toEqual(value.knowledge!.initial.actions);
  });
  it.each(['missing','tenant-id','tenant-slug','revision','different-node','multiple-nodes'] as const)('keeps normal answer order for %s authority',kind=>{
    const answer=initialAnswer();let context=answer.initialMenu;
    if(kind==='missing')context=undefined;
    if(kind==='tenant-id')context={...context!,tenantId:900};
    if(kind==='tenant-slug')context={...context!,tenantSlug:'another-institution'};
    if(kind==='revision')context={...context!,revision:'c'.repeat(64)};
    if(kind==='different-node')answer.nodes=[node('requirements')];
    if(kind==='multiple-nodes')answer.nodes=[...answer.nodes,node('requirements')];
    expect(institutionalPresentationMode(answer,context)).toBe('answer');
  });
  it('does not accept a remote presentation hint or derive it from a greeting title',()=>{
    const value=published();const payload=institutionalChatBootstrapPayload(value,value.tenant.slug);
    const parsed=parseInstitutionalChatMessage({...payload,initialMenu:initialAnswer().initialMenu,presentation:'initial-menu'},value.tenant.slug)!;
    expect(parsed.initialMenu).toBeUndefined();
    expect(institutionalPresentationMode(parsed)).toBe('answer');
    expect(()=>institutionalInitialMenuContext(workspace(),value.tenant.slug)).toThrow();
  });
});

describe('citizen topic-first widget',()=>{
  it('offers the canonical choices before the full greeting, references and optional voice, once only',()=>{
    const answer=initialAnswer();render(<InstitutionalChatMessage answer={answer} onButtonClick={()=>{}}/>);
    const card=screen.getByTestId('institutional-chat-message');
    expect(card).toHaveAttribute('data-institutional-presentation','initial-menu');
    const choices=card.querySelector('.institutional-chat-message__choices')!;
    before(screen.getByRole('heading',{name:answer.nodes[0].title}),choices);
    before(choices,card.querySelector('.institutional-chat-message__prose')!);
    before(choices,card.querySelector('.institutional-chat-message__sources')!);
    before(choices,card.querySelector('.institutional-response-audio')!);
    expect(card.querySelectorAll('.institutional-chat-message__choices')).toHaveLength(1);
    expect(card.querySelectorAll('[data-institutional-choice]')).toHaveLength(6);
    expect(screen.getByText(answer.nodes[0].text)).toBeInTheDocument();
    expect(screen.getByText(answer.nodes[0].sources[0].title)).toBeInTheDocument();
    expect(screen.getByText(audio.disclosure)).toBeInTheDocument();
    expect(mocks.readAudio).not.toHaveBeenCalled();expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });
  it('preserves the source-first ordinary response/submenu order without initial authority',()=>{
    const answer=initialAnswer();delete answer.initialMenu;
    render(<InstitutionalChatMessage answer={answer} onButtonClick={()=>{}}/>);
    const card=screen.getByTestId('institutional-chat-message');
    expect(card).toHaveAttribute('data-institutional-presentation','answer');
    before(card.querySelector('.institutional-chat-message__prose')!,card.querySelector('.institutional-chat-message__choices')!);
    before(card.querySelector('.institutional-response-audio')!,card.querySelector('.institutional-chat-message__choices')!);
  });
  it('sends the exact advertised action from the new position',()=>{
    const answer=initialAnswer(),send=vi.fn();render(<InstitutionalChatMessage answer={answer} onButtonClick={send}/>);
    fireEvent.click(screen.getByRole('button',{name:'1 Tema canónico 1'}));
    expect(send).toHaveBeenCalledOnce();expect(send).toHaveBeenCalledWith({text:'Tema canónico 1',action:`knowledge:${answer.revision.slice(0,16)}:topic-1`,action_id:`knowledge:${answer.revision.slice(0,16)}:topic-1`,source:'button'});
  });
  it('retires historical choices and both paging directions while preserving text and reader utilities',()=>{
    const answer=initialAnswer(11),send=vi.fn();const mounted=render(<InstitutionalChatMessage answer={answer} onButtonClick={send}/>);
    fireEvent.click(screen.getByRole('button',{name:'Otras opciones'}));
    expect(screen.getByRole('status')).toHaveTextContent('Grupo 2 de 3');
    mounted.rerender(<InstitutionalChatMessage answer={answer} onButtonClick={send} interactive={false}/>);
    expect(screen.getByRole('button',{name:'Otras opciones'})).toBeDisabled();
    expect(screen.getByRole('button',{name:'Opciones anteriores'})).toBeDisabled();
    expect(screen.getByRole('button',{name:'5 Tema canónico 5'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Otras opciones'}));fireEvent.click(screen.getByRole('button',{name:'5 Tema canónico 5'}));
    expect(screen.getByRole('status')).toHaveTextContent('Grupo 2 de 3');expect(send).not.toHaveBeenCalled();
    expect(screen.getByRole('button',{name:answer.ui!.large_text})).toBeEnabled();
    expect(screen.getByRole('button',{name:audio.listen})).toBeEnabled();
    expect(screen.getByText(answer.nodes[0].text)).toBeInTheDocument();
    expect(mocks.readAudio).not.toHaveBeenCalled();
  });
});

describe('citizen topic-first workspace',()=>{
  it('uses published bootstrap choices first and restores ordinary answer reading after selection',async()=>{
    const value=published();mocks.fetch.mockResolvedValueOnce(value);
    render(<InstitutionalAssistant tenantSlug={value.tenant.slug} mode="public"/>);
    const first=await screen.findByRole('button',{name:'1 Tema canónico 1'});
    const assistant=screen.getByTestId('institutional-assistant');
    expect(assistant).toHaveAttribute('data-institutional-presentation','initial-menu');
    before(first,assistant.querySelector('.institutional-assistant__prose')!);
    before(first,assistant.querySelector('.institutional-response-audio')!);
    expect(assistant.querySelectorAll('.institutional-assistant__choices')).toHaveLength(1);
    expect(assistant.querySelectorAll('.institutional-assistant__choices button')).toHaveLength(6);
    mocks.fetch.mockResolvedValueOnce(reply('topic-1',value));fireEvent.click(first);
    await screen.findByRole('heading',{name:'Requisitos de la consulta'});
    expect(assistant).toHaveAttribute('data-institutional-presentation','answer');
    before(assistant.querySelector('.institutional-assistant__prose')!,assistant.querySelector('.institutional-assistant__choices')!);
    before(assistant.querySelector('.institutional-response-audio')!,assistant.querySelector('.institutional-assistant__choices')!);
    expect(mocks.readAudio).not.toHaveBeenCalled();
  });
  it('restores initial layout only for explicit Home with matching canonical start',async()=>{
    const value=published();mocks.fetch.mockResolvedValueOnce(value);
    render(<InstitutionalAssistant tenantSlug={value.tenant.slug} mode="public"/>);
    const first=await screen.findByRole('button',{name:'1 Tema canónico 1'});
    mocks.fetch.mockResolvedValueOnce(reply('topic-1',value));fireEvent.click(first);await screen.findByRole('heading',{name:'Requisitos de la consulta'});
    mocks.fetch.mockResolvedValueOnce({...reply('start',value),nodes:[value.knowledge!.initial],text:value.knowledge!.initial.text});
    fireEvent.click(screen.getByRole('button',{name:value.ui.home}));
    await screen.findByRole('button',{name:'1 Tema canónico 1'});
    expect(screen.getByTestId('institutional-assistant')).toHaveAttribute('data-institutional-presentation','initial-menu');
    expect(mocks.fetch.mock.calls.map(([,options])=>options.method)).toEqual(['GET','GET','GET']);
  });
  it('does not promote a free-text answer returning the same start node into an initial menu',async()=>{
    const value=published();mocks.fetch.mockResolvedValueOnce(value);
    render(<InstitutionalAssistant tenantSlug={value.tenant.slug} mode="public"/>);
    const input=await screen.findByLabelText(value.ui.question);
    mocks.fetch.mockResolvedValueOnce({...reply('start',value),nodes:[value.knowledge!.initial],text:value.knowledge!.initial.text});
    fireEvent.change(input,{target:{value:'Consulta abierta de prueba'}});fireEvent.submit(input.closest('form')!);
    await waitFor(()=>expect(screen.getByTestId('institutional-assistant')).toHaveAttribute('data-institutional-presentation','answer'));
    expect(screen.getByText('Consulta abierta de prueba')).toBeInTheDocument();
    expect(screen.getAllByRole('button',{name:'1 Tema canónico 1'})).toHaveLength(1);
  });
});
