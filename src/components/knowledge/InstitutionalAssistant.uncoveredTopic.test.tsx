import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {assistantUi,workspace,reply} from '../../../tests/fixtures/institutional-assistant.synthetic';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import InstitutionalAssistant from './InstitutionalAssistant';

// TDF feedback (#2854): a question without published information inside a
// topic keeps that topic and its options instead of dropping the person.
const inTopic='Esta información no está incluida en las fuentes disponibles. Seguís en «{title}»: podés elegir una de estas opciones o escribir «menú» para ver todos los temas.';
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
    mocks.fetch.mockResolvedValueOnce(workspace({ui:{...assistantUi,unknown_in_topic:inTopic}}));
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
    mocks.fetch.mockResolvedValueOnce(workspace({ui:{...assistantUi,unknown_in_topic:inTopic}}));
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
});
