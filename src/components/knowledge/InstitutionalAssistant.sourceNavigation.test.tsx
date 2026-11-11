import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {workspace,source,node,reply} from '../../../tests/fixtures/institutional-assistant.synthetic';
const transport=vi.hoisted(()=>({fetch:vi.fn()}));
// Actual components and contract. HTTP responses and session identities are synthetic in jsdom.
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>transport.fetch(...args)}));
import InstitutionalAssistant from './InstitutionalAssistant';
import InstitutionalChatMessage from '@/components/chat/InstitutionalChatMessage';
import {parseInstitutionalChatMessage} from '@/features/chat/institutionalChatMessage';

const guide='Consultá los documentos de respaldo de este espacio. El catálogo no certifica por sí solo el contenido completo.';
const answer=(w=workspace())=>({contract_version:w.contract_version,result_type:'source_navigation',
  tenant:{id:w.tenant.id,slug:w.tenant.slug},revision:w.revision,nodes:[],sources:structuredClone(w.knowledge!.sources),
  text:guide,selection_performed:false,business_writes_performed:false});
const view=(slug='qa-knowledge',actor='actor-a')=><InstitutionalAssistant tenantSlug={slug} sessionKey={actor}/>;
const deferred=()=>{let resolve!:(value:unknown)=>void;return {promise:new Promise<unknown>(yes=>{resolve=yes;}),resolve};};
beforeEach(()=>{transport.fetch.mockReset();transport.fetch.mockResolvedValue(workspace());});
afterEach(cleanup);

describe('source navigation with the real institutional reader',()=>{
  it('answers the reported question with an operable source dialog and keyboard focus return',async()=>{
    const user=userEvent.setup();render(view());const input=await screen.findByLabelText(workspace().ui.question);
    transport.fetch.mockResolvedValueOnce(answer());
    await user.type(input,'¿Dónde puedo ver los documentos que respaldan esta información?');await user.keyboard('{Enter}');
    const result=await screen.findByRole('region',{name:workspace().ui.sources});
    expect(within(result).getByRole('status')).toHaveTextContent(guide);
    expect(screen.queryByText(workspace().ui.unknown)).not.toBeInTheDocument();expect(screen.queryByText(node().text)).not.toBeInTheDocument();
    const action=within(result).getByRole('button',{name:workspace().ui.sources});action.focus();await user.keyboard('{Enter}');
    const dialog=await screen.findByRole('dialog',{name:workspace().ui.sources});
    expect(within(dialog).getByText(source.title)).toBeVisible();
    await user.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(action).toHaveFocus();expect(transport.fetch).toHaveBeenCalledTimes(2);
    expect(transport.fetch.mock.calls[1][1]).toMatchObject({method:'POST',singleAttempt:true,tenantSlug:'qa-knowledge'});
  });
  it('keeps a normal canonical answer working after navigating to sources',async()=>{
    render(view());const input=await screen.findByLabelText(workspace().ui.question);
    transport.fetch.mockResolvedValueOnce(reply());fireEvent.click(screen.getByRole('button',{name:'1 Consultar requisitos'}));
    await screen.findByRole('heading',{name:reply().nodes[0].title});
    transport.fetch.mockResolvedValueOnce(answer());fireEvent.change(input,{target:{value:'Mostrar fuentes'}});fireEvent.submit(input.closest('form')!);
    await screen.findByText(guide);transport.fetch.mockResolvedValueOnce(reply());
    fireEvent.change(input,{target:{value:'¿Qué documentos tengo que presentar?'}});fireEvent.submit(input.closest('form')!);
    expect(await screen.findByRole('heading',{name:reply().nodes[0].title})).toBeVisible();
    expect(screen.queryByText(guide)).not.toBeInTheDocument();expect(screen.getByText(reply().nodes[0].text.split('\n\n')[0])).toBeVisible();
    expect(transport.fetch.mock.calls.at(-1)![1].body.node_id).toBe('requirements');
  });
  it.each(['tenant','actor','aba'])('retires a delayed source response after a %s change',async change=>{
    const mounted=render(view());const input=await screen.findByLabelText(workspace().ui.question),pending=deferred();
    transport.fetch.mockReturnValueOnce(pending.promise);fireEvent.change(input,{target:{value:'Mostrar fuentes'}});fireEvent.submit(input.closest('form')!);
    const nextSlug=change==='tenant'?'qa-other':'qa-knowledge';
    const next=workspace({tenant:{id:change==='tenant'?702:701,slug:nextSlug,name:'Current synthetic space'}});
    transport.fetch.mockResolvedValue(next);
    if(change==='aba'){mounted.rerender(view('qa-other'));mounted.rerender(view());}
    else mounted.rerender(view(nextSlug,change==='actor'?'actor-b':'actor-a'));
    await screen.findByText(next.tenant.name);
    await act(async()=>{pending.resolve(answer());await pending.promise;});
    expect(screen.queryByText(guide)).not.toBeInTheDocument();expect(screen.getByLabelText(next.ui.question)).toHaveValue('');
  });
  it('does not expose an unrelated catalog on a mismatched source response',async()=>{
    render(view());const input=await screen.findByLabelText(workspace().ui.question),value=answer();
    value.sources[0].title='FOREIGN SYNTHETIC CATALOG';transport.fetch.mockResolvedValueOnce(value);
    fireEvent.change(input,{target:{value:'Ver fuentes'}});fireEvent.submit(input.closest('form')!);
    await screen.findByRole('alert');expect(screen.queryByText('FOREIGN SYNTHETIC CATALOG')).not.toBeInTheDocument();
  });
});

describe('source navigation in the widget reader',()=>{
  it('keeps source metadata focusable and toggles disclosure without fabricated answers, original fetch or audio',async()=>{
    const w=workspace({visibility:'public',can_edit:false}),user=userEvent.setup(),onButtonClick=vi.fn();
    const privateSource={...source,id:'private-source',title:'Private original metadata',url:undefined,document_visibility:'private' as const};
    const parsed=parseInstitutionalChatMessage({fuente:'institutional_knowledge_sources',knowledge_tenant:w.tenant,context_revision:w.revision,
      knowledge_sources:[source,privateSource],message_body:guide,
      knowledge_ui:{sources:w.ui.sources,source_details:w.ui.source_details,large_text:w.ui.large_text}},w.tenant.slug)!;
    const mounted=render(<InstitutionalChatMessage answer={parsed} onButtonClick={onButtonClick}/>);
    expect(screen.getByRole('heading',{name:w.ui.sources})).toBeVisible();expect(screen.getByRole('status')).toHaveTextContent(guide);
    const details=mounted.container.querySelector('details')!,summary=details.querySelector('summary')!;
    await user.tab();expect(screen.getByRole('button',{name:w.ui.large_text})).toHaveFocus();
    // user-event omits native summary Tab/Enter defaults; those require the browser check.
    summary.focus();expect(summary).toHaveFocus();await user.click(summary);expect(details.open).toBe(true);
    expect(screen.getByText(privateSource.title)).toBeVisible();expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(node().text)).not.toBeInTheDocument();expect(mounted.container.querySelector('audio')).toBeNull();
    expect(onButtonClick).not.toHaveBeenCalled();expect(transport.fetch).not.toHaveBeenCalled();
  });
});
