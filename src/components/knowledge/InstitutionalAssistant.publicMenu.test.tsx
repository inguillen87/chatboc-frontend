import React from 'react';
import {cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {node,reply,workspace} from '../../../tests/fixtures/institutional-assistant.synthetic';
import type {PublishedTenantIdentity} from '@/utils/publishedTenantIdentity';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:(...args:unknown[])=>mocks.fetch(...args)}));
import InstitutionalAssistant from './InstitutionalAssistant';

const publicWorkspace=()=>{
  const value=workspace({visibility:'public',can_edit:false});
  value.knowledge!.initial.actions=Array.from({length:6},(_,i)=>({code:i===5?'0':String(i+1),label:`Tema publicado ${i+1}`,target:`topic-${i+1}`}));
  value.knowledge!.topics=value.knowledge!.initial.actions.map(action=>({id:action.target,label:action.label}));
  return value;
};
const identity=(overrides:Partial<PublishedTenantIdentity>={}):PublishedTenantIdentity=>({tenantId:701,tenantSlug:'qa-knowledge',name:'Institución de prueba',logoUrl:'/branding/published-robot.png',...overrides});
const view=(publicIdentity?:PublishedTenantIdentity|null,mode:'public'|'admin'='public')=><InstitutionalAssistant tenantSlug="qa-knowledge" mode={mode} sessionKey={mode==='admin'?'actor-a':undefined} publicIdentity={publicIdentity}/>;
beforeEach(()=>{mocks.fetch.mockReset();mocks.fetch.mockResolvedValue(publicWorkspace());});
afterEach(cleanup);

describe('one public institutional menu with the validated organization mark',()=>{
  it('shows the six supplied codes once and keeps the administrative index separate',async()=>{
    render(view());const reader=await screen.findByTestId('institutional-assistant');
    const choices=reader.querySelector('[data-choice-options]')!;
    expect(within(choices as HTMLElement).getAllByRole('button')).toHaveLength(6);
    for(const action of publicWorkspace().knowledge!.initial.actions){
      expect(screen.getAllByRole('button',{name:`${action.code} ${action.label}`})).toHaveLength(1);
      expect(screen.queryByRole('button',{name:action.label,exact:true})).not.toBeInTheDocument();
    }
    expect(reader.querySelector('aside')).toBeNull();expect(reader.querySelector('nav')).toBeNull();
    expect(reader.querySelector('details.institutional-assistant__topic-index')).toBeNull();
  });

  it('keeps canonical submenu actions, a collapsed topic index and keyboard result focus',async()=>{
    const value=publicWorkspace();render(view());await screen.findByRole('button',{name:'1 Tema publicado 1'});
    const result=node('topic-1');result.actions=[{code:'0',label:'Volver al inicio',target:'start'}];
    mocks.fetch.mockResolvedValueOnce({...reply('topic-1',value),nodes:[result]});
    fireEvent.click(screen.getByRole('button',{name:'1 Tema publicado 1'}));
    const heading=await screen.findByRole('heading',{name:result.title});
    await vi.waitFor(()=>expect(heading).toHaveFocus());
    const index=screen.getByText(value.ui.topics).closest('details')!;
    expect(index).not.toHaveAttribute('open');expect(index.querySelectorAll('nav button')).toHaveLength(6);
    fireEvent.click(index.querySelector('summary')!);expect(index).toHaveAttribute('open');
    mocks.fetch.mockResolvedValueOnce(reply('start',value));
    fireEvent.click(screen.getByRole('button',{name:'0 Volver al inicio'}));
    await screen.findByRole('heading',{name:node().title});
    expect(screen.queryByText(value.ui.topics)).not.toBeInTheDocument();
    expect(mocks.fetch.mock.calls.map(call=>call[0])).toEqual([
      '/api/public/tenants/qa-knowledge/institutional-assistant',
      `/api/public/tenants/qa-knowledge/institutional-assistant/nodes/topic-1?revision=${value.revision}`,
      `/api/public/tenants/qa-knowledge/institutional-assistant/nodes/start?revision=${value.revision}`,
    ]);
  });

  it('uses only the matching published profile logo and falls back after image failure without a request',async()=>{
    render(view(identity()));const reader=await screen.findByTestId('institutional-assistant');
    const mark=reader.querySelector('.institutional-assistant__mark')!;
    const logo=mark.querySelector('img')!;expect(logo).toHaveAttribute('src','/branding/published-robot.png');
    expect(logo).toHaveAttribute('alt','');expect(mark).toHaveAttribute('aria-hidden','true');
    fireEvent.error(logo);expect(mark.querySelector('img')).toBeNull();expect(mark).toHaveTextContent('I');
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  it.each([
    identity({tenantId:702}),identity({tenantSlug:'another-organization'}),identity({logoUrl:'javascript:alert(1)'}),
    identity({logoUrl:'https://example.org/robot.png?token=private'}),null,
  ])('does not load another organization or an unsafe logo',async supplied=>{
    render(view(supplied));const reader=await screen.findByTestId('institutional-assistant');
    expect(reader.querySelector('.institutional-assistant__mark img')).toBeNull();
    expect(reader.querySelector('.institutional-assistant__mark')).toHaveTextContent('I');
  });

  it('replaces the failed mark when the same published profile supplies a new safe logo without reloading knowledge',async()=>{
    const mounted=render(view(identity()));const reader=await screen.findByTestId('institutional-assistant');
    fireEvent.error(reader.querySelector('.institutional-assistant__mark img')!);
    mounted.rerender(view(identity({logoUrl:'/branding/new-published-robot.png'})));
    expect(reader.querySelector('.institutional-assistant__mark img')).toHaveAttribute('src','/branding/new-published-robot.png');
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });

  it('preserves the full admin index and does not import the public profile mark into the private workspace',async()=>{
    mocks.fetch.mockResolvedValueOnce(workspace());render(view(identity(),'admin'));
    const reader=await screen.findByTestId('institutional-assistant');
    expect(within(reader).getByRole('navigation',{name:'Temas de consulta'})).toBeVisible();
    expect(reader.querySelector('.institutional-assistant__mark img')).toBeNull();
  });
});
