import React from 'react';
import {cleanup,render,screen,within} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {node,workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';
import {parseInstitutionalChatMessage} from './institutionalChatMessage';
import InstitutionalChatMessage from '@/components/chat/InstitutionalChatMessage';

const ui={more_options:'Más opciones',previous_options:'Opciones anteriores',options_page:'Opciones: grupo {current} de {total}',
  large_text:'Texto ampliado',source_details:'Consultar fuentes'};
const CUD={acronym:'CUD',expansion:'Certificado Único de Discapacidad'};
const payload=(acronyms:unknown,label?:string)=>{
  const w=workspace({visibility:'public',can_edit:false}),answer={...node('requirements'),acronyms};
  return {fuente:'institutional_knowledge',context_revision:w.revision!,knowledge_tenant:{id:w.tenant.id,slug:w.tenant.slug},
    knowledge_nodes:[answer],knowledge_sources:answer.sources,message_body:'Cuerpo del chat',
    knowledge_ui:{...ui,...(label!==undefined?{acronyms:label}:{})},
    botones:answer.actions.map(action=>({texto:action.label,action_id:`knowledge:${w.revision!.slice(0,16)}:${action.target}`}))};
};
afterEach(cleanup);

describe('acronyms in the chat widget',()=>{
  it('explains the acronyms of an answer with the published meaning',()=>{
    const answer=parseInstitutionalChatMessage(payload([CUD,{acronym:'x',expansion:'inválida'}],'Siglas'),'qa-knowledge')!;
    render(<InstitutionalChatMessage answer={answer} interactive onButtonClick={vi.fn()}/>);
    const group=screen.getByRole('group',{name:'Siglas'});
    expect(within(group).getByText('CUD')).toHaveAttribute('title',CUD.expansion);
    expect(within(group).getByText(CUD.expansion)).toBeInTheDocument();
    expect(within(group).queryByText('inválida')).toBeNull();
  });

  it('shows nothing without the backend label or without acronyms',()=>{
    let answer=parseInstitutionalChatMessage(payload([CUD]),'qa-knowledge')!;
    const {unmount}=render(<InstitutionalChatMessage answer={answer} interactive onButtonClick={vi.fn()}/>);
    expect(screen.queryByTestId('institutional-acronyms')).toBeNull();
    unmount();
    answer=parseInstitutionalChatMessage(payload(undefined,'Siglas'),'qa-knowledge')!;
    render(<InstitutionalChatMessage answer={answer} interactive onButtonClick={vi.fn()}/>);
    expect(screen.queryByTestId('institutional-acronyms')).toBeNull();
  });
});
