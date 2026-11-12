import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OmnichannelInboxItem, SaasAction } from '@/api/v2/saas';

const mocks = vi.hoisted(() => ({ detail: vi.fn(), assignment: vi.fn() }));
vi.mock('@/api/v2/saas', async () => ({
  ...await vi.importActual<typeof import('@/api/v2/saas')>('@/api/v2/saas'),
  getOmnichannelInboxDetailV2: (...args: unknown[]) => mocks.detail(...args),
}));
vi.mock('../TicketAssignment', () => ({default:(props:unknown)=>{
  mocks.assignment(props);
  return <div data-testid="published-assignment" />;
}}));
import { TicketConversationPane } from './TicketConversationPane';

const base: OmnichannelInboxItem = {
  id:'municipio:42',ticket_id:'42',source_model:'MunicipioTicket',tenant_slug:'junin',
  title:'Caso de prueba',status:'nuevo',lastMessageAt:'2026-09-26T12:00:00Z',
  unreadCount:0,attachments:[],presence:[],timeline:[],actions:[],allowed_actions:[],
  next_steps:[],agent_copilot_suggestions:[],
};
const claim:SaasAction = {id:'claim',label:'Atender por contrato'};
const assign:SaasAction = {id:'assign',label:'Elegir responsable oficial'};
const show = (item:OmnichannelInboxItem, raw:unknown=null) => {
  mocks.detail.mockResolvedValue({item,raw});
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  const view=render(<QueryClientProvider client={client}><TicketConversationPane ticketId={item.id} tenantSlug="junin" /></QueryClientProvider>);
  return {client,...view};
};

describe('Inbox ownership publication',()=>{
  beforeEach(()=>{mocks.detail.mockReset();mocks.assignment.mockReset();window.localStorage.clear();});
  it.each([[],[{id:'reply',label:'Responder'}],[{...claim,disabled:true}],[{...claim,enabled:false}],[{...claim,label:''}],[claim,claim]])('does not mount ownership controls for %j',async actions=>{
    show({...base,allowed_actions:actions});
    await screen.findByRole('region',{name:'Control operativo del caso'});
    expect(document.querySelector('.inbox-assignment-control')).toBeNull();
    expect(mocks.assignment).not.toHaveBeenCalled();
  });
  it('does not resurrect an action from a secondary list after explicit revocation',async()=>{
    show({...base,allowed_actions:[],actions:[claim]});
    await screen.findByRole('region',{name:'Control operativo del caso'});
    expect(mocks.assignment).not.toHaveBeenCalled();
    expect(screen.queryByText(claim.label)).not.toBeInTheDocument();
  });
  it.each([claim,assign])('uses the published label and passes the exact contract for $id',async action=>{
    show({...base,allowed_actions:[action]});
    expect(await screen.findByText(action.label)).toBeVisible();
    expect(screen.getByText(action.label).closest('details')).not.toHaveAttribute('open');
    expect(mocks.assignment).toHaveBeenCalledWith(expect.objectContaining({ticket:expect.objectContaining({id:42,tenant_slug:'junin'}),assignmentActions:[action]}));
    expect(screen.queryByRole('button',{name:action.label})).not.toBeInTheDocument();
    expect(screen.queryByText('Gestionar responsable')).not.toBeInTheDocument();
  });
  it('supports the legacy actions list only when allowed_actions is absent',async()=>{
    show({...base,allowed_actions:undefined as unknown as SaasAction[],actions:[claim]});
    expect(await screen.findByText(claim.label)).toBeVisible();
  });
  it('requires a routable identity even when the action is published',async()=>{
    show({...base,ticket_id:'opaque:case',allowed_actions:[claim]});
    await screen.findByRole('region',{name:'Control operativo del caso'});
    expect(mocks.assignment).not.toHaveBeenCalled();
  });
  it('uses the backend envelope when the item has no tenant slug',async()=>{
    const item={...base,tenant_slug:undefined,allowed_actions:[claim]};
    show(item,{tenant:{slug:'junin'}});
    expect(await screen.findByText(claim.label)).toBeVisible();
    expect(mocks.assignment).toHaveBeenCalledWith(expect.objectContaining({ticket:expect.objectContaining({tenant_slug:'junin'})}));
  });
  it('removes controls when a refreshed detail revokes the action',async()=>{
    const {client}=show({...base,allowed_actions:[claim]});
    await screen.findByText(claim.label);
    mocks.detail.mockResolvedValue({item:base,raw:null});
    await client.invalidateQueries({queryKey:['inbox-omnichannel-v2-detail']});
    await waitFor(()=>expect(document.querySelector('.inbox-assignment-control')).toBeNull());
  });
});
