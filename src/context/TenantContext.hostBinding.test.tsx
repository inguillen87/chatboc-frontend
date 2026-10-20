import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tenantHostFixture } from '@/test/fixtures/tenantHost';
import { publishTenantHostRuntime } from '@/utils/tenantHostBinding';
import { TenantProvider, useTenant } from './TenantContext';

const mocks=vi.hoisted(()=>({host:vi.fn(),profile:vi.fn(),follows:vi.fn(),anon:vi.fn()}));
vi.mock('@/api/tenantHost',()=>({getTenantHostBinding:mocks.host}));
vi.mock('@/api/tenant',()=>({getTenantPublicInfoFlexible:mocks.profile,listFollowedTenants:mocks.follows,followTenant:vi.fn(),unfollowTenant:vi.fn()}));
vi.mock('@/utils/anonId',()=>({ensureRemoteAnonId:mocks.anon}));
function Probe(){const value=useTenant();return <><output>{value.currentSlug}:{value.tenant?.nombre}</output><button onClick={()=>value.setTenantSlug('old-workspace')}>Select old workspace</button><button onClick={value.refreshTenant}>Refresh</button></>;}
const profile=()=>({slug:'government-east',nombre:'Organización de prueba',publishedIdentity:tenantHostFixture().identity});
function renderProvider(entry='/'){return render(<MemoryRouter initialEntries={[entry]}><TenantProvider><Probe/></TenantProvider></MemoryRouter>);}
beforeEach(()=>{
  localStorage.clear(); localStorage.setItem('tenantSlug','old-workspace');
  mocks.host.mockReset().mockResolvedValue(tenantHostFixture());mocks.profile.mockReset().mockResolvedValue(profile());mocks.follows.mockReset().mockResolvedValue([]);mocks.anon.mockReset().mockResolvedValue('synthetic-anon');
  const original=window; vi.stubGlobal('window',new Proxy(original,{get(target,key){return key==='location'?{hostname:'atencion.example.test',origin:'https://atencion.example.test',pathname:'/',search:'',hash:''}:Reflect.get(target,key);}}));
});
afterEach(()=>{vi.unstubAllGlobals();publishTenantHostRuntime(null);localStorage.clear();delete (window as any).CHATBOC_CONFIG;});
describe('authoritative custom hostname bootstrap',()=>{
  it('does not mount a generic/default profile between host resolution and the exact public profile',async()=>{
    let resolve!:(value:ReturnType<typeof profile>)=>void; mocks.profile.mockReturnValue(new Promise(r=>{resolve=r;}));
    renderProvider();
    await waitFor(()=>expect(mocks.profile).toHaveBeenCalledWith('government-east',null));
    expect(screen.getByRole('status')).toHaveTextContent('Estamos comprobando');
    expect(screen.queryByRole('button',{name:'Select old workspace'})).not.toBeInTheDocument();
    await act(async()=>resolve(profile()));
    await screen.findByText('government-east:Organización de prueba');
  });
  it('waits for exact domain resolution before reading any tenant, then preserves the old panel preference',async()=>{
    let resolve!:(value:ReturnType<typeof tenantHostFixture>)=>void; mocks.host.mockReturnValue(new Promise(r=>{resolve=r;}));
    (window as any).CHATBOC_CONFIG={tenantSlug:'foreign-script',entityToken:'foreign-owner-token'};
    renderProvider();
    expect(screen.getByRole('status')).toHaveTextContent('Estamos comprobando');expect(screen.queryByText(/government-east/)).not.toBeInTheDocument();expect(mocks.profile).not.toHaveBeenCalled();expect(mocks.anon).not.toHaveBeenCalled();
    await act(async()=>resolve(tenantHostFixture()));
    await waitFor(()=>expect(screen.getByText('government-east:Organización de prueba')).toBeInTheDocument());
    expect(mocks.host).toHaveBeenCalledWith('atencion.example.test',expect.any(AbortSignal));
    expect(mocks.profile).toHaveBeenCalledWith('government-east',null);
    expect(mocks.profile).not.toHaveBeenCalledWith('atencion',expect.anything());
    expect(localStorage.getItem('tenantSlug')).toBe('old-workspace');
    fireEvent.click(screen.getByRole('button',{name:'Select old workspace'}));
    expect(screen.getByText('government-east:Organización de prueba')).toBeInTheDocument();expect(localStorage.getItem('tenantSlug')).toBe('old-workspace');
  });
  it.each(['/t/old-workspace','/?tenant_slug=old-workspace','/perfil?tenant_slug=government-east&tenant_slug=old-workspace'])('does not mount or request another organization for %s',async entry=>{
    renderProvider(entry);await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('no corresponde');expect(mocks.profile).not.toHaveBeenCalled();expect(mocks.anon).not.toHaveBeenCalled();
    expect(screen.queryByRole('button',{name:'Select old workspace'})).not.toBeInTheDocument();
  });
  it('fails closed on unknown/unverified host and a retry can load the later valid binding',async()=>{
    mocks.host.mockRejectedValueOnce(new Error('private diagnostic'));renderProvider();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos confirmar');expect(screen.queryByText(/private diagnostic/)).not.toBeInTheDocument();expect(mocks.profile).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Reintentar'}));
    await screen.findByText('government-east:Organización de prueba');expect(mocks.host).toHaveBeenCalledTimes(2);
  });
  it('does not show a profile with the right slug but another published ID',async()=>{
    mocks.profile.mockResolvedValue({...profile(),publishedIdentity:{...tenantHostFixture().identity,tenantId:99}});
    renderProvider();expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos confirmar');
    expect(screen.queryByText('government-east:Organización de prueba')).not.toBeInTheDocument();expect(localStorage.getItem('tenantSlug')).toBe('old-workspace');
  });
  it('keeps the shared Chatboc root/login bootstrap independent of this host contract',async()=>{
    const original=window;vi.stubGlobal('window',new Proxy(original,{get(target,key){return key==='location'?{hostname:'www.chatboc.ar',origin:'https://www.chatboc.ar',pathname:'/login',search:'',hash:''}:Reflect.get(target,key);}}));
    mocks.profile.mockResolvedValue({slug:'old-workspace',nombre:'Stored selection'});renderProvider('/login');
    await screen.findByText('old-workspace:Stored selection');expect(mocks.host).not.toHaveBeenCalled();expect(mocks.profile).toHaveBeenCalledWith('old-workspace',null);
  });
});
