import React from 'react';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {reply,workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';
import type {InstitutionalEasyReadCopy} from './institutionalAssistantContract';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import InstitutionalAssistant from './InstitutionalAssistant';

// Synthetic copy and text; the backend owns the real wording and verification.
const copy:InstitutionalEasyReadCopy={contract_version:'chatboc.institutional_easy_read.v1',action:'Explicámelo más simple',
  original:'Ver la versión original',loading:'Preparando una versión más simple…',
  error:'No se pudo preparar una versión más simple.',disclosure:'Versión simple hecha con IA a partir de esta respuesta.'};
const SIMPLE='• Esta es la respuesta.\n• No confirma una inscripción.';
const published=()=>workspace({visibility:'public',can_edit:false,easy_read:copy});
const easyReply=(nodeId='requirements')=>({contract_version:'chatboc.institutional_easy_read.v1',tenant:{id:701,slug:'qa-knowledge'},
  revision:'b'.repeat(64),node_id:nodeId,text:SIMPLE,disclosure:copy.disclosure});
const route=(answer:unknown)=>mocks.fetch.mockImplementation(async(path:string)=>{
  if(path.endsWith('/easy-read'))return easyReply();
  if(path.endsWith('/answer')||path.includes('/nodes/'))return answer;
  return published();
});
const view=()=><InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>;
beforeEach(()=>{mocks.fetch.mockReset();route(reply('requirements',published()));});
afterEach(cleanup);

describe('«Explicámelo más simple» in the public assistant',()=>{
  it('offers the easy-read version of an answer, then returns to the original',async()=>{
    render(view());
    fireEvent.click(await screen.findByRole('button',{name:/Consultar requisitos/}));
    const action=await screen.findByRole('button',{name:'Explicámelo más simple'});
    expect(screen.queryByRole('button',{name:'Explicámelo más simple',hidden:false})).toBe(action);
    fireEvent.click(action);
    expect(await screen.findByText('Esta es la respuesta.')).toBeInTheDocument();
    expect(screen.getByText(copy.disclosure)).toBeInTheDocument();
    const toggle=screen.getByRole('button',{name:'Ver la versión original'});
    expect(toggle).toHaveAttribute('aria-expanded','true');
    const [path,options]=mocks.fetch.mock.calls.find(([p])=>String(p).endsWith('/easy-read'))!;
    expect(path).toBe('/api/public/tenants/qa-knowledge/institutional-assistant/easy-read');
    expect(options).toMatchObject({method:'POST',body:{revision:'b'.repeat(64),node_id:'requirements'},skipAuth:true,omitCredentials:true});
    fireEvent.click(toggle);
    await waitFor(()=>expect(screen.queryByText('Esta es la respuesta.')).not.toBeInTheDocument());
    expect(screen.getByRole('button',{name:'Explicámelo más simple'})).toHaveFocus();
  });

  it('never offers it on the start menu nor without the capability',async()=>{
    render(view());await screen.findByRole('button',{name:/Consultar requisitos/});
    expect(screen.queryByRole('button',{name:'Explicámelo más simple'})).toBeNull();
    cleanup();mocks.fetch.mockReset();
    mocks.fetch.mockImplementation(async(path:string)=>path.endsWith('/answer')||path.includes('/nodes/')?reply('requirements',published())
      :workspace({visibility:'public',can_edit:false}));
    render(view());fireEvent.click(await screen.findByRole('button',{name:/Consultar requisitos/}));
    await screen.findByText(/respuesta publicada en el documento de prueba/);
    expect(screen.queryByRole('button',{name:'Explicámelo más simple'})).toBeNull();
  });

  it('opens it by itself after a typed «explicámelo más simple»',async()=>{
    route({...reply('requirements',published()),easy_read_requested:true});
    render(view());
    const input=await screen.findByLabelText('Escribí tu consulta');
    fireEvent.change(input,{target:{value:'Explicámelo más simple'}});
    fireEvent.submit(input.closest('form')!);
    expect(await screen.findByText('Esta es la respuesta.')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Ver la versión original'})).toBeInTheDocument();
  });

  it('keeps the original and says so when no verified version is available',async()=>{
    mocks.fetch.mockImplementation(async(path:string)=>{
      if(path.endsWith('/easy-read'))throw Object.assign(new Error('unverified'),{status:422});
      if(path.endsWith('/answer')||path.includes('/nodes/'))return reply('requirements',published());
      return published();
    });
    render(view());
    fireEvent.click(await screen.findByRole('button',{name:/Consultar requisitos/}));
    fireEvent.click(await screen.findByRole('button',{name:'Explicámelo más simple'}));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.error);
    expect(screen.getByText(/respuesta publicada en el documento de prueba/)).toBeInTheDocument();
  });

  it('rejects an easy-read response for another node or revision',async()=>{
    mocks.fetch.mockImplementation(async(path:string)=>{
      if(path.endsWith('/easy-read'))return {...easyReply(),node_id:'start'};
      if(path.endsWith('/answer')||path.includes('/nodes/'))return reply('requirements',published());
      return published();
    });
    render(view());
    fireEvent.click(await screen.findByRole('button',{name:/Consultar requisitos/}));
    fireEvent.click(await screen.findByRole('button',{name:'Explicámelo más simple'}));
    expect(await screen.findByRole('alert')).toHaveTextContent(copy.error);
    expect(screen.queryByText('Esta es la respuesta.')).toBeNull();
  });
});
