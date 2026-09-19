import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import fixtures from '../../../tests/fixtures/organization-setup-journeys.json';
import ChannelActivationChecklist from '@/components/profile/ChannelActivationChecklist';
import {fetchTenantChannelActivation} from '@/api/v2/channelActivation';
vi.mock('@/api/v2/channelActivation',async load=>({...await load<typeof import('@/api/v2/channelActivation')>(),fetchTenantChannelActivation:vi.fn()}));
const snapshot=(slug='tenant-a',heading='Espacio autorizado')=>({
  contract_version:'tenant.channel_activation.v1' as const,tenant:{id:1,slug},channels:[],
  organization_setup:{...JSON.parse(JSON.stringify(fixtures.empresa)),tenant:{id:1,slug},heading},
});
const deferred=()=>{let resolve!:(value:any)=>void;const promise=new Promise<any>(r=>{resolve=r;});return {promise,resolve};};
const api=vi.mocked(fetchTenantChannelActivation);
beforeEach(()=>{api.mockReset().mockResolvedValue(snapshot());});afterEach(cleanup);
describe('guided organization setup on the actual activation component',()=>{
  it('renders server content and opens the next pending step',async()=>{
    render(<ChannelActivationChecklist tenantSlug="tenant-a"/>);
    expect(await screen.findByRole('heading',{name:'Espacio autorizado'})).toBeVisible();
    expect(screen.getByRole('button',{name:/2 Canales y atención/})).toHaveAttribute('aria-current','step');
    expect(screen.getByText(/Ya existe un registro de WhatsApp/)).toBeVisible();
    expect(screen.getByText(/No certifica el plan Full/)).toBeVisible();
    expect(screen.getByRole('link',{name:'Revisar configuración'}).getAttribute('href')).toContain('tenant_slug=tenant-a');
  });
  it('lets the administrator inspect other steps without writing',async()=>{
    render(<ChannelActivationChecklist tenantSlug="tenant-a"/>);await screen.findByRole('heading',{name:'Espacio autorizado'});
    fireEvent.click(screen.getByRole('button',{name:/3 Catálogo/}));
    expect(screen.getByRole('region',{name:'Detalle de Catálogo, contenido y cobros'})).toBeVisible();
    expect(api).toHaveBeenCalledTimes(1);
  });
  it('removes previous organization data before a new response and ignores late A-B-A results',async()=>{
    const old=deferred(),middle=deferred(),latest=deferred();
    api.mockReturnValueOnce(old.promise).mockReturnValueOnce(middle.promise).mockReturnValueOnce(latest.promise);
    const view=render(<ChannelActivationChecklist tenantSlug="tenant-a" initialData={snapshot('tenant-a','Original A')}/>);
    view.rerender(<ChannelActivationChecklist tenantSlug="tenant-b" initialData={snapshot('tenant-a','Original A')}/>);
    expect(screen.queryByText('Original A')).toBeNull();
    view.rerender(<ChannelActivationChecklist tenantSlug="tenant-a"/>);
    await act(async()=>latest.resolve(snapshot('tenant-a','Latest A')));
    await act(async()=>old.resolve(snapshot('tenant-a','Stale A')));
    await act(async()=>middle.resolve(snapshot('tenant-b','Stale B')));
    expect(screen.getByRole('heading',{name:'Latest A'})).toBeVisible();
    expect(screen.queryByText('Stale A')).toBeNull();expect(screen.queryByText('Stale B')).toBeNull();
  });
  it('keeps same-tenant context during a network error but disables all next actions',async()=>{
    render(<ChannelActivationChecklist tenantSlug="tenant-a"/>);await screen.findByRole('heading',{name:'Espacio autorizado'});
    api.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fireEvent.click(screen.getByRole('button',{name:'Actualizar estado'}));await screen.findByRole('alert');
    expect(screen.getByRole('heading',{name:'Espacio autorizado'})).toBeVisible();expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByText('Failed to fetch')).toBeNull();
  });
  it('clears the old context on permission revocation',async()=>{
    render(<ChannelActivationChecklist tenantSlug="tenant-a"/>);await screen.findByRole('heading',{name:'Espacio autorizado'});
    api.mockRejectedValueOnce({status:403});fireEvent.click(screen.getByRole('button',{name:'Actualizar estado'}));
    await screen.findByText(/No tenés acceso a la configuración/);
    expect(screen.queryByText('Espacio autorizado')).toBeNull();expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
  it('rejects a wrong organization response rather than exposing it',async()=>{
    api.mockResolvedValueOnce(snapshot('other','Foreign label'));
    render(<ChannelActivationChecklist tenantSlug="tenant-a"/>);await screen.findByText(/No pudimos sincronizar/);
    expect(screen.queryByText('Foreign label')).toBeNull();
  });
  it('does not invent a v2 journey when its summary is malformed',async()=>{
    const invalid=snapshot();invalid.organization_setup.summary.progress=100;
    api.mockResolvedValueOnce(invalid);render(<ChannelActivationChecklist tenantSlug="tenant-a"/>);
    await waitFor(()=>expect(api).toHaveBeenCalled());
    expect(screen.queryByTestId('organization-setup-workspace')).toBeNull();
  });
  it('never requests a global endpoint without an explicit organization',()=>{
    render(<ChannelActivationChecklist/>);expect(api).not.toHaveBeenCalled();
  });
  it('allows only one refresh while a request is pending',async()=>{
    const pending=deferred();render(<ChannelActivationChecklist tenantSlug="tenant-a"/>);
    await screen.findByRole('heading',{name:'Espacio autorizado'});api.mockReturnValueOnce(pending.promise);
    fireEvent.click(screen.getByRole('button',{name:'Actualizar estado'}));
    expect(screen.getByRole('button',{name:'Verificando…'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Verificando…'}));expect(api).toHaveBeenCalledTimes(2);
    await act(async()=>pending.resolve(snapshot()));
  });
});
