import React from 'react';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {node,workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';
import type {InstitutionalEasyReadCopy} from '@/components/knowledge/institutionalAssistantContract';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',async importOriginal=>({...await importOriginal<typeof import('@/utils/api')>(),apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import {institutionalChatBootstrapPayload,parseInstitutionalChatMessage} from './institutionalChatMessage';
import InstitutionalChatMessage from '@/components/chat/InstitutionalChatMessage';

const copy:InstitutionalEasyReadCopy={contract_version:'chatboc.institutional_easy_read.v1',action:'Explicámelo más simple',
  original:'Ver la versión original',loading:'Preparando una versión más simple…',
  error:'No se pudo preparar una versión más simple.',disclosure:'Versión simple hecha con IA a partir de esta respuesta.'};
const SIMPLE='• Esta es la respuesta.\n• No confirma una inscripción.';
const answerPayload=(extra:Record<string,unknown>={})=>{
  const w=workspace({visibility:'public',can_edit:false}),answer=node('requirements');
  return {fuente:'institutional_knowledge',context_revision:w.revision!,knowledge_tenant:{id:w.tenant.id,slug:w.tenant.slug},
    knowledge_nodes:[answer],knowledge_sources:answer.sources,message_body:'Cuerpo del chat',
    botones:answer.actions.map(action=>({texto:action.label,action_id:`knowledge:${w.revision!.slice(0,16)}:${action.target}`})),...extra};
};
beforeEach(()=>{mocks.fetch.mockReset();});
afterEach(cleanup);

describe('easy-read in the chat widget',()=>{
  it('accepts the capability and a verified text, and rejects incomplete announcements',()=>{
    const parsed=parseInstitutionalChatMessage(answerPayload({knowledge_easy_read:copy,knowledge_easy_read_text:SIMPLE}),'qa-knowledge');
    expect(parsed).toMatchObject({easyRead:copy,easyReadText:SIMPLE});
    expect(parseInstitutionalChatMessage(answerPayload({knowledge_easy_read_text:SIMPLE}),'qa-knowledge')).toBeNull();
    expect(parseInstitutionalChatMessage(answerPayload({knowledge_easy_read:{...copy,action:''}}),'qa-knowledge')).toBeNull();
    expect(parseInstitutionalChatMessage(answerPayload({knowledge_easy_read:copy,knowledge_easy_read_text:''}),'qa-knowledge')).toBeNull();
    const w=workspace({visibility:'public',can_edit:false,easy_read:copy});
    expect(institutionalChatBootstrapPayload(w,w.tenant.slug).knowledge_easy_read).toEqual(copy);
  });

  it('shows the verified text of a typed request open, with its notice, and lets the person go back',()=>{
    const answer=parseInstitutionalChatMessage(answerPayload({knowledge_easy_read:copy,knowledge_easy_read_text:SIMPLE}),'qa-knowledge')!;
    render(<InstitutionalChatMessage answer={answer} interactive onButtonClick={vi.fn()}/>);
    expect(screen.getByText('Esta es la respuesta.')).toBeInTheDocument();
    expect(screen.getByText(copy.disclosure)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Ver la versión original'}));
    expect(screen.queryByText('Esta es la respuesta.')).toBeNull();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('asks the backend for one answer when the person presses the button',async()=>{
    mocks.fetch.mockResolvedValue({contract_version:'chatboc.institutional_easy_read.v1',tenant:{id:701,slug:'qa-knowledge'},
      revision:'b'.repeat(64),node_id:'requirements',text:SIMPLE,disclosure:copy.disclosure});
    const answer=parseInstitutionalChatMessage(answerPayload({knowledge_easy_read:copy}),'qa-knowledge')!;
    render(<InstitutionalChatMessage answer={answer} interactive onButtonClick={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Explicámelo más simple'}));
    expect(await screen.findByText('Esta es la respuesta.')).toBeInTheDocument();
    expect(mocks.fetch).toHaveBeenCalledWith('/api/public/tenants/qa-knowledge/institutional-assistant/easy-read',
      expect.objectContaining({method:'POST',body:{revision:'b'.repeat(64),node_id:'requirements'}}));
  });

  it('offers nothing without the capability',()=>{
    const answer=parseInstitutionalChatMessage(answerPayload(),'qa-knowledge')!;
    render(<InstitutionalChatMessage answer={answer} interactive onButtonClick={vi.fn()}/>);
    expect(screen.queryByRole('button',{name:'Explicámelo más simple'})).toBeNull();
  });
});
