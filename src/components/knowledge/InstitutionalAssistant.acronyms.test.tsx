import React from 'react';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {reply,workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import InstitutionalAssistant from './InstitutionalAssistant';

const CUD={acronym:'CUD',expansion:'Certificado Único de Discapacidad'};
const published=(label?:string)=>{
  const base=workspace({visibility:'public',can_edit:false});
  return {...base,ui:{...base.ui,...(label?{acronyms:label}:{})}};
};
const route=(label?:string)=>mocks.fetch.mockImplementation(async(path:string)=>{
  const w=published(label);
  if(path.endsWith('/answer')||path.includes('/nodes/')){
    const answer=reply('requirements',w);
    return {...answer,nodes:answer.nodes.map(n=>({...n,acronyms:[CUD]}))};
  }
  return w;
});
beforeEach(()=>{mocks.fetch.mockReset();});
afterEach(cleanup);

describe('acronyms in the public assistant',()=>{
  it('lists the acronyms of the answer with the meaning the organization published',async()=>{
    route('Siglas');
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>);
    fireEvent.click(await screen.findByRole('button',{name:/Consultar requisitos/}));
    const group=await screen.findByRole('group',{name:'Siglas'});
    expect(within(group).getByText('CUD')).toHaveAttribute('title',CUD.expansion);
    expect(within(group).getByText(CUD.expansion)).toBeInTheDocument();
  });

  it('shows nothing when the backend does not label the block',async()=>{
    route();
    render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public"/>);
    fireEvent.click(await screen.findByRole('button',{name:/Consultar requisitos/}));
    await screen.findByText(/respuesta publicada en el documento de prueba/);
    expect(screen.queryByTestId('institutional-acronyms')).toBeNull();
  });
});
