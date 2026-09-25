import React from 'react';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter,useNavigate} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
vi.mock('react-router-dom',async()=>await vi.importActual('react-router-dom'));
const state=vi.hoisted(()=>({user:null as any,verified:true,profileVerified:true,loading:false,slug:'org-a'}));
vi.mock('@/hooks/useUser',()=>({useUser:()=>({user:state.user,organizationProfileVerified:state.profileVerified,loading:state.loading})}));
vi.mock('@/context/TenantContext',()=>({useTenant:()=>({currentSlug:state.slug,tenant:null,isLoadingTenant:false,tenantError:null})}));
vi.mock('@/components/access/SessionAuthorityContext',()=>({useSessionAuthority:()=>({hasVerifiedSession:state.verified,hasBearerSession:state.verified,clerkStatus:'disabled'})}));
vi.mock('@/context/CapabilitiesContext',()=>({useCapabilities:()=>({capabilities:['tickets.read','orders.read'],hasAnyCapability:(values:string[])=>values.some(value=>['tickets.read','orders.read'].includes(value))})}));
vi.mock('@/hooks/useCartCount',()=>({default:()=>0}));
import Navbar from './Navbar';
import Footer from './Footer';
const user=(slug='org-a',name='Organización A')=>({id:12,tenant_slug:slug,rol:'admin',tipo_chat:'municipio',nombre_empresa:name,logo_url:'https://cdn.example.com/a.png'});
function Navigation(){const go=useNavigate();return <button onClick={()=>go('/perfil?tab=crm')}>Cambiar sección</button>;}
const shell=(path='/perfil?tab=tickets')=><MemoryRouter initialEntries={[path]}><Navbar/><main><Navigation/><button>Fuera del encabezado</button></main><Footer/></MemoryRouter>;
beforeEach(()=>{state.user=user();state.verified=true;state.profileVerified=true;state.loading=false;state.slug='org-a';window.localStorage.clear();});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('authenticated organization shell',()=>{
  it('uses the organization in header and footer without sales content or a public cart',()=>{
    render(shell());expect(screen.getByRole('link',{name:'Panel de Organización A'})).toHaveAttribute('href','/perfil');
    const footer=screen.getByRole('contentinfo',{name:'Información del panel privado'});
    expect(within(footer).getByText('Organización A')).toBeVisible();
    expect(within(footer).getByRole('link',{name:'Privacidad de la plataforma'})).toHaveAttribute('href','/privacidad');
    expect(screen.queryByText('Credenciales institucionales')).not.toBeInTheDocument();
    expect(screen.queryByRole('link',{name:'Ver carrito'})).not.toBeInTheDocument();
  });
  it('does not show stored branding while authenticated profile verification is pending',()=>{
    state.profileVerified=false;window.localStorage.setItem('user',JSON.stringify(user('other','Stored other brand')));
    render(shell());expect(screen.getByTestId('private-workspace-pending')).toBeVisible();
    expect(screen.queryByText('Stored other brand')).not.toBeInTheDocument();expect(screen.queryByText('Organización A')).not.toBeInTheDocument();
  });
  it('withdraws the old logo and name immediately when a refresh starts',()=>{
    const view=render(shell());expect(screen.getByTestId('private-workspace-brand')).toBeVisible();
    state.loading=true;view.rerender(shell());expect(screen.queryByText('Organización A')).not.toBeInTheDocument();
    expect(screen.queryByTestId('private-workspace-brand')).not.toBeInTheDocument();
  });
  it('keeps platform and central public branding unchanged',()=>{
    state.user={...user(),rol:'super_admin'};render(shell('/superadmin'));
    expect(screen.queryByTestId('private-workspace-brand')).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Ir al panel de ChatBoc'})).toBeVisible();
    expect(screen.queryByRole('contentinfo',{name:'Información del panel privado'})).not.toBeInTheDocument();
  });
  it('does not label a foreign organization route with the current profile',()=>{
    render(shell('/t/org-b/perfil'));expect(screen.queryByText('Organización A')).not.toBeInTheDocument();
    expect(screen.getByTestId('private-workspace-pending')).toBeVisible();
  });
  it('uses a neutral icon on image failure and resets the failure for another organization',()=>{
    const view=render(shell());const mark=screen.getByTestId('private-workspace-brand');
    fireEvent.error(mark.querySelector('img')!);expect(mark.querySelector('img')).toBeNull();
    state.user=user('org-b','Organización B');state.slug='org-b';view.rerender(shell());
    expect(screen.getByRole('link',{name:'Panel de Organización B'}).querySelector('img')).not.toBeNull();
  });
  it('closes the mobile menu and releases its overlay when the route changes',()=>{
    render(shell());fireEvent.click(screen.getByRole('button',{name:'Abrir menú'}));
    expect(document.body).toHaveClass('chatboc-mobile-menu-open');
    fireEvent.click(screen.getByRole('button',{name:'Cambiar sección'}));
    expect(screen.queryByRole('navigation',{name:'Navegación principal móvil'})).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass('chatboc-mobile-menu-open');
  });
  it('closes an open menu when the authenticated organization changes',()=>{
    const view=render(shell());fireEvent.click(screen.getByRole('button',{name:'Abrir menú'}));
    state.user=user('org-b','Organización B');state.slug='org-b';view.rerender(shell());
    expect(screen.queryByText('Organización A')).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Abrir menú'})).toHaveAttribute('aria-expanded','false');
  });
  it('closes when pointing outside without taking focus away from the destination',()=>{
    render(shell());fireEvent.click(screen.getByRole('button',{name:'Abrir menú'}));
    const outside=screen.getByRole('button',{name:'Fuera del encabezado'});outside.focus();fireEvent.pointerDown(outside);
    expect(screen.getByRole('button',{name:'Abrir menú'})).toHaveAttribute('aria-expanded','false');
    expect(outside).toHaveFocus();
  });
  it('restores the trigger after Escape, retaining the existing disclosure semantics',()=>{
    render(shell());const trigger=screen.getByRole('button',{name:'Abrir menú'});fireEvent.click(trigger);
    fireEvent.keyDown(document,{key:'Escape'});expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded','false');
  });
  it('removes the private header and footer after session verification is revoked',()=>{
    const view=render(shell());state.verified=false;state.user=null;view.rerender(shell());
    expect(screen.queryByTestId('private-workspace-brand')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo',{name:'Información del panel privado'})).not.toBeInTheDocument();
  });
});
