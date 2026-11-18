import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {assistantUi,workspace,node,reply} from '../../../tests/fixtures/institutional-assistant.synthetic';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import InstitutionalAssistant from './InstitutionalAssistant';

// TDF feedback (#2854): a question without published information inside a
// topic keeps that topic and its options instead of dropping the person.
const inTopic='Esta información no está incluida en las fuentes disponibles. Seguís en «{title}»: podés elegir una de estas opciones o escribir otra consulta.';
const inLeaf='Esta información no está incluida en las fuentes disponibles. Seguís en «{title}»: podés escribir otra consulta sobre este tema.';
const topicUi={...assistantUi,unknown_in_topic:inTopic,unknown_in_topic_no_options:inLeaf};
const uncovered=()=>({...reply(),nodes:[],text:assistantUi.unknown,selection_performed:true});
const ask=async(text:string)=>{
  const input=await screen.findByLabelText('Escribí tu consulta');
  fireEvent.change(input,{target:{value:text}});input.focus();fireEvent.submit(input.closest('form')!);
};
const openTopic=async()=>{
  await screen.findByText('Elegí un tema o escribí una pregunta.');
  mocks.fetch.mockResolvedValueOnce(reply());
  fireEvent.click(screen.getByRole('button',{name:/Consultar requisitos/}));
  await screen.findByRole('heading',{name:'Requisitos de la consulta'});
};
beforeEach(()=>{mocks.fetch.mockReset();});afterEach(cleanup);

describe('uncovered question inside a topic',()=>{
  it('keeps the topic options and asks the next question from the same topic',async()=>{
    mocks.fetch.mockResolvedValueOnce(workspace({ui:topicUi}));
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" sessionKey="topic-reader"/>);
    await openTopic();
    mocks.fetch.mockResolvedValueOnce(uncovered());
    await ask('¿Y si soy de Ushuaia?');
    const notice=await screen.findByText(inTopic.replace('{title}','Requisitos de la consulta'));
    await waitFor(()=>expect(notice).toHaveFocus());expect(notice).toHaveAttribute('role','status');
    expect(screen.queryByText(/Esta es la respuesta publicada/)).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:/Volver al menú/})).toBeEnabled();
    expect(mocks.fetch.mock.calls[2][1].body).toEqual({revision:'b'.repeat(64),node_id:'requirements',question:'¿Y si soy de Ushuaia?'});
    mocks.fetch.mockResolvedValueOnce(reply());
    await ask('¿Y en Río Grande?');
    await screen.findByRole('heading',{name:'Requisitos de la consulta'});
    expect(mocks.fetch.mock.calls[3][1].body).toEqual({revision:'b'.repeat(64),node_id:'requirements',question:'¿Y en Río Grande?'});
    expect(screen.queryByText(inTopic.replace('{title}','Requisitos de la consulta'))).not.toBeInTheDocument();
  });

  it('a second uncovered question stays in the same topic, and an option leaves it',async()=>{
    mocks.fetch.mockResolvedValueOnce(workspace({ui:topicUi}));
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" sessionKey="topic-repeat"/>);
    await openTopic();
    mocks.fetch.mockResolvedValueOnce(uncovered());await ask('Primera consulta sin fuente');
    await screen.findByText(inTopic.replace('{title}','Requisitos de la consulta'));
    mocks.fetch.mockResolvedValueOnce(uncovered());await ask('Segunda consulta sin fuente');
    await waitFor(()=>expect(mocks.fetch).toHaveBeenCalledTimes(4));
    expect(mocks.fetch.mock.calls[3][1].body.node_id).toBe('requirements');
    await screen.findByText(inTopic.replace('{title}','Requisitos de la consulta'));
    mocks.fetch.mockResolvedValueOnce(reply('start'));
    fireEvent.click(screen.getByRole('button',{name:/Volver al menú/}));
    await screen.findByText('Elegí un tema o escribí una pregunta.');
    expect(screen.queryByText(/Seguís en/)).not.toBeInTheDocument();
    mocks.fetch.mockResolvedValueOnce(uncovered());await ask('Consulta desde el inicio');
    await screen.findByText(assistantUi.unknown);
    expect(mocks.fetch.mock.calls[5][1].body.node_id).toBe('start');
    expect(screen.getByRole('button',{name:/Consultar requisitos/})).toBeEnabled();
  });

  it('falls back to the existing notice when the server does not provide the topic wording',async()=>{
    mocks.fetch.mockResolvedValueOnce(workspace());
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" sessionKey="topic-fallback"/>);
    await openTopic();
    mocks.fetch.mockResolvedValueOnce(uncovered());await ask('¿Y si soy de Tolhuin?');
    await screen.findByText(assistantUi.unknown);
    expect(screen.getByRole('button',{name:/Volver al menú/})).toBeEnabled();
    expect(mocks.fetch.mock.calls[2][1].body.node_id).toBe('requirements');
  });

  it('keeps the topic across the source catalog opened between two uncovered questions',async()=>{
    const w=workspace({ui:topicUi});
    mocks.fetch.mockResolvedValueOnce(w);
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" sessionKey="topic-sources"/>);
    await openTopic();
    mocks.fetch.mockResolvedValueOnce(uncovered());await ask('Consulta sin fuente');
    await screen.findByText(inTopic.replace('{title}','Requisitos de la consulta'));
    mocks.fetch.mockResolvedValueOnce({contract_version:w.contract_version,result_type:'source_navigation',tenant:{id:w.tenant.id,slug:w.tenant.slug},
      revision:w.revision,nodes:[],sources:structuredClone(w.knowledge!.sources),text:'Catálogo de fuentes.',selection_performed:false,business_writes_performed:false});
    await ask('fuentes');
    await screen.findByText('Catálogo de fuentes.');
    expect(screen.queryByRole('button',{name:/Volver al menú/})).not.toBeInTheDocument();
    expect(mocks.fetch.mock.calls[3][1].body.node_id).toBe('requirements');
    mocks.fetch.mockResolvedValueOnce(uncovered());await ask('Otra consulta sin fuente');
    await screen.findByText(inTopic.replace('{title}','Requisitos de la consulta'));
    expect(mocks.fetch.mock.calls[4][1].body.node_id).toBe('requirements');
    expect(screen.getByRole('button',{name:/Volver al menú/})).toBeEnabled();
  });

  it('uses the leaf wording without options and keeps a $ in the title literal',async()=>{
    mocks.fetch.mockResolvedValueOnce(workspace({ui:topicUi}));
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" sessionKey="topic-leaf"/>);
    await screen.findByText('Elegí un tema o escribí una pregunta.');
    const leaf={...node('requirements'),title:"Tasa $' anual $&",actions:[]};
    mocks.fetch.mockResolvedValueOnce({...reply(),nodes:[leaf],text:leaf.text});
    fireEvent.click(screen.getByRole('button',{name:/Consultar requisitos/}));
    await screen.findByRole('heading',{name:"Tasa $' anual $&"});
    mocks.fetch.mockResolvedValueOnce(uncovered());await ask('¿Y en Tolhuin?');
    await screen.findByText(inLeaf.split('{title}').join("Tasa $' anual $&"));
    expect(screen.queryByRole('button',{name:/Volver al menú|Consultar requisitos/})).not.toBeInTheDocument();
    expect(mocks.fetch.mock.calls[2][1].body.node_id).toBe('requirements');
  });

  it('does not name a topic after an answer that combined several nodes',async()=>{
    mocks.fetch.mockResolvedValueOnce(workspace({ui:topicUi}));
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" sessionKey="topic-several"/>);
    await screen.findByText('Elegí un tema o escribí una pregunta.');
    const second={...node('requirements'),id:'second',title:'Segundo tema',text:'Texto del segundo tema.'};
    mocks.fetch.mockResolvedValueOnce({...reply(),nodes:[node('requirements'),second],text:'combinado'});
    await ask('Consulta de dos temas');
    await screen.findByRole('heading',{name:'Segundo tema'});
    mocks.fetch.mockResolvedValueOnce(uncovered());await ask('Consulta sin fuente');
    await screen.findByText(assistantUi.unknown);
    expect(screen.queryByText(/Seguís en/)).not.toBeInTheDocument();
    expect(mocks.fetch.mock.calls[2][1].body.node_id).toBe('second');
  });
});
