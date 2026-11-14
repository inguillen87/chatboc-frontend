import React from 'react';
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import {MemoryRouter,useLocation,useNavigate} from 'react-router-dom';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import Navbar from './Navbar';
import {tenantHostFixture} from '@/test/fixtures/tenantHost';

// Restore real Router links/navigation after the canonical shared setup.
vi.mock('react-router-dom',async()=>await vi.importActual('react-router-dom'));
const fixtures=vi.hoisted(()=>({tenant:{} as any,user:{} as any,session:{} as any,
  privateShell:{active:false,identity:null} as any,cart:vi.fn((_enabled:boolean)=>6)}));
vi.mock('@/context/TenantContext',()=>({useTenant:()=>fixtures.tenant}));
vi.mock('@/hooks/useUser',()=>({useUser:()=>fixtures.user}));
vi.mock('@/components/access/SessionAuthorityContext',()=>({useSessionAuthority:()=>fixtures.session}));
vi.mock('@/hooks/usePrivateWorkspacePresentation',()=>({usePrivateWorkspacePresentation:()=>fixtures.privateShell}));
vi.mock('@/hooks/useCartCount',()=>({default:(enabled:boolean)=>fixtures.cart(enabled)}));
vi.mock('@/context/CapabilitiesContext',()=>({useCapabilities:()=>({capabilities:[],hasAnyCapability:()=>false})}));
vi.mock('@/components/auth/ClerkRuntimeContext',()=>({useClerkRuntime:()=>({enabled:false})}));
vi.mock('@/components/brand/ChatbocBrandLockup',()=>({default:()=> <span>Chatboc.ar</span>}));

const publicTenant=(slug='institution-a',id=41,name='Published institution A')=>({
  currentSlug:slug,isLoadingTenant:false,tenantError:null,hostBinding:null,
  tenant:{slug,nombre:'Legacy name must not brand',tipo:'municipio',
    publishedIdentity:{tenantId:id,tenantSlug:slug,name,logoUrl:'/published-a.svg'}},
});
function Harness(){const navigate=useNavigate();const location=useLocation();return <>
  <Navbar/><button onClick={()=>navigate('/t/institution-b')}>Fixture navigate B</button>
  <output data-testid="fixture-path">{location.pathname}</output>
</>;}
function mount(path='/t/institution-a'){return render(<MemoryRouter initialEntries={[path]}><Harness/></MemoryRouter>);}
const header=()=>screen.getByRole('banner');
const openMobile=()=>fireEvent.click(within(header()).getByRole('button',{name:/abrir men/i}));
function expectNoPlatformCommerce(){
  expect(within(header()).queryByRole('link',{name:'Ver demo'})).not.toBeInTheDocument();
  expect(within(header()).queryByText('Plan y facturación')).not.toBeInTheDocument();
}
function expectNeutral(){
  expect(screen.getByTestId('public-workspace-pending')).toHaveAttribute('aria-hidden','true');
  expect(within(header()).queryByTestId('institutional-access-brand')).not.toBeInTheDocument();
  expect(within(header()).queryByText('Published institution A')).not.toBeInTheDocument();
  expect(within(header()).queryByText('Legacy name must not brand')).not.toBeInTheDocument();
  expect(within(header()).queryByText('Chatboc.ar')).not.toBeInTheDocument();
  expect(within(header()).queryByRole('link',{name:'Iniciar sesión'})).not.toBeInTheDocument();
  expect(within(header()).queryByRole('link',{name:/carrito/i})).not.toBeInTheDocument();
  expectNoPlatformCommerce();
}

beforeEach(()=>{
  vi.clearAllMocks();window.localStorage.clear();document.documentElement.classList.remove('dark');
  fixtures.tenant=publicTenant();fixtures.user={user:null,loading:false,organizationProfileVerified:false};
  fixtures.session={hasVerifiedSession:false,hasBearerSession:false};fixtures.privateShell={active:false,identity:null};
  fixtures.cart.mockReturnValue(6);
  vi.stubGlobal('matchMedia',vi.fn((query:string)=>({matches:false,media:query,onchange:null,
    addEventListener:vi.fn(),removeEventListener:vi.fn(),addListener:vi.fn(),removeListener:vi.fn(),dispatchEvent:vi.fn()})));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();document.body.classList.remove('chatboc-mobile-menu-open');});

describe('Navbar public root identity',()=>{
  it.each(['/t/institution-a','/t/institution-a/'])('uses only the published identity and scoped access on %s',path=>{
    mount(path);
    const brand=screen.getByRole('link',{name:'Published institution A'});
    expect(brand).toHaveAttribute('href','/t/institution-a');expect(brand).toHaveAttribute('data-tenant-id','41');
    expect(brand.querySelector('img')).toHaveAttribute('src','/published-a.svg');
    expect(brand.querySelector('img')).toHaveAttribute('alt','');
    expect(screen.getByRole('link',{name:'Iniciar sesión'})).toHaveAttribute('href','/t/institution-a/login');
    expect(screen.getByRole('link',{name:'Ver carrito'})).toHaveAttribute('href','/t/institution-a/cart');
    expect(screen.getByRole('link',{name:'Ver carrito'})).toHaveTextContent('6');
    expectNoPlatformCommerce();expect(fixtures.cart).toHaveBeenLastCalledWith(true);
    openMobile();
    screen.getAllByRole('link',{name:'Iniciar sesión'}).forEach(link=>expect(link).toHaveAttribute('href','/t/institution-a/login'));
    expect(within(screen.getByRole('navigation',{name:'Navegación principal móvil'})).getByRole('link',{name:/Carrito/})).toHaveAttribute('href','/t/institution-a/cart');
    expectNoPlatformCommerce();
  });
  it.each(['loading','error','missing','zero-id','boolean-id','fractional-id','current-slug','tenant-slug','identity-slug','empty-name'])(
    'stays neutral for %s rather than retaining a brand or account access',state=>{
      const value=publicTenant();
      if(state==='loading')value.isLoadingTenant=true;
      if(state==='error')fixtures.tenant={...value,tenantError:new Error('synthetic failure')};
      else fixtures.tenant=value;
      if(state==='missing')fixtures.tenant.tenant.publishedIdentity=null;
      if(state==='zero-id')fixtures.tenant.tenant.publishedIdentity.tenantId=0;
      if(state==='boolean-id')fixtures.tenant.tenant.publishedIdentity.tenantId=true;
      if(state==='fractional-id')fixtures.tenant.tenant.publishedIdentity.tenantId=1.5;
      if(state==='current-slug')fixtures.tenant.currentSlug='other-institution';
      if(state==='tenant-slug')fixtures.tenant.tenant.slug='other-institution';
      if(state==='identity-slug')fixtures.tenant.tenant.publishedIdentity.tenantSlug='other-institution';
      if(state==='empty-name')fixtures.tenant.tenant.publishedIdentity.name='   ';
      mount();expectNeutral();openMobile();expectNeutral();expect(fixtures.cart).toHaveBeenLastCalledWith(false);
    });
  it('does not expose the signed-in foreign actor, plan or private navigation on the public root',()=>{
    fixtures.user={user:{id:9,name:'Foreign actor',email:'foreign@example.test',rol:'superadmin',tenant_slug:'foreign-org',plan:'full'},loading:false,organizationProfileVerified:true};
    fixtures.session={hasVerifiedSession:true,hasBearerSession:true};
    const before=JSON.stringify(fixtures.user);mount();openMobile();
    expect(screen.getByRole('link',{name:'Published institution A'})).toBeInTheDocument();
    expect(within(header()).queryByText('Foreign actor')).not.toBeInTheDocument();
    expect(within(header()).queryByText('foreign@example.test')).not.toBeInTheDocument();
    expect(within(header()).queryByRole('button',{name:/mi cuenta|super admin/i})).not.toBeInTheDocument();
    expect(header().querySelector('a[href^="/perfil"]')).toBeNull();
    expectNoPlatformCommerce();expect(JSON.stringify(fixtures.user)).toBe(before);
  });
  it('retires A immediately on route A to B while A data is retained, then admits only B',()=>{
    const view=mount();expect(screen.getByRole('link',{name:'Published institution A'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Fixture navigate B'}));
    expect(screen.getByTestId('fixture-path')).toHaveTextContent('/t/institution-b');expectNeutral();
    expect(fixtures.cart).toHaveBeenLastCalledWith(false);
    fixtures.tenant={...publicTenant('institution-b',52,'Published institution B'),isLoadingTenant:true};
    view.rerender(<MemoryRouter><Harness/></MemoryRouter>);expectNeutral();
    fixtures.tenant=publicTenant('institution-b',52,'Published institution B');
    view.rerender(<MemoryRouter><Harness/></MemoryRouter>);
    expect(screen.getByRole('link',{name:'Published institution B'})).toHaveAttribute('data-tenant-id','52');
    expect(screen.getByRole('link',{name:'Iniciar sesión'})).toHaveAttribute('href','/t/institution-b/login');
    expect(screen.getByRole('link',{name:'Ver carrito'})).toHaveAttribute('href','/t/institution-b/cart');
    expect(fixtures.cart).toHaveBeenLastCalledWith(true);
    expect(within(header()).queryByText('Published institution A')).not.toBeInTheDocument();
  });
  it('resets image failure on a new published ID and sanitizes an unsafe logo without losing identity',()=>{
    const view=mount();fireEvent.error(screen.getByRole('link',{name:'Published institution A'}).querySelector('img')!);
    expect(screen.getByRole('link',{name:'Published institution A'}).querySelector('img')).toBeNull();
    fixtures.tenant=publicTenant('institution-a',42,'Published institution A');
    view.rerender(<MemoryRouter><Harness/></MemoryRouter>);
    expect(screen.getByRole('link',{name:'Published institution A'}).querySelector('img')).toHaveAttribute('src','/published-a.svg');
    fixtures.tenant.tenant.publishedIdentity.logoUrl='https://cdn.example.test/logo.svg?token=private';
    view.rerender(<MemoryRouter><Harness/></MemoryRouter>);
    expect(screen.getByRole('link',{name:'Published institution A'}).querySelector('img')).toBeNull();
  });
  it('closes the neutral mobile menu with Escape and restores the trigger',()=>{
    fixtures.tenant={...publicTenant(),isLoadingTenant:true};mount();openMobile();
    fireEvent.keyDown(document,{key:'Escape'});
    expect(screen.queryByRole('navigation',{name:'Navegación principal móvil'})).not.toBeInTheDocument();
    expect(screen.getByRole('button',{name:/abrir men/i})).toHaveFocus();
  });
  it('moves focus to the existing desktop theme control when a neutral menu closes at the breakpoint',()=>{
    const listeners=new Set<(event:MediaQueryListEvent)=>void>();
    const media={matches:false,media:'(min-width: 768px)',onchange:null,
      addEventListener:(_type:string,listener:(event:MediaQueryListEvent)=>void)=>listeners.add(listener),
      removeEventListener:(_type:string,listener:(event:MediaQueryListEvent)=>void)=>listeners.delete(listener)};
    vi.stubGlobal('matchMedia',vi.fn(()=>media));
    fixtures.tenant={...publicTenant(),isLoadingTenant:true};mount();openMobile();
    const theme=screen.getAllByRole('button',{name:'Activar modo oscuro'})[0];
    act(()=>{media.matches=true;listeners.forEach(listener=>listener({matches:true} as MediaQueryListEvent));});
    expect(screen.queryByRole('navigation',{name:'Navegación principal móvil'})).not.toBeInTheDocument();
    expect(theme).toHaveFocus();expectNeutral();
  });
});

describe('Navbar preserved presentation boundaries',()=>{
  it.each(['pyme','municipio','empresa',undefined])('preserves a nonempty tenant cart from the public home without inferring commerce from type %s',type=>{
    fixtures.tenant=publicTenant('shop-space',75,'Published shop');
    fixtures.tenant.tenant.tipo=type;
    if(type!==undefined){
      fixtures.tenant.tenant.public_cart_url='/t/shop-space/cart';
      fixtures.tenant.tenant.public_catalog_url='/t/shop-space/market';
    }
    mount('/t/shop-space');
    expect(screen.getByRole('link',{name:'Published shop'})).toHaveAttribute('href','/t/shop-space');
    const desktopCart=screen.getByRole('link',{name:'Ver carrito'});
    expect(desktopCart).toHaveAttribute('href','/t/shop-space/cart');expect(desktopCart).toHaveTextContent('6');
    expect(fixtures.cart).toHaveBeenLastCalledWith(true);expectNoPlatformCommerce();
    openMobile();
    const mobileCart=within(screen.getByRole('navigation',{name:'Navegación principal móvil'})).getByRole('link',{name:/Carrito/});
    expect(mobileCart).toHaveAttribute('href','/t/shop-space/cart');expect(mobileCart).toHaveTextContent('6');
    fireEvent.click(mobileCart);
    expect(screen.getByTestId('fixture-path')).toHaveTextContent('/t/shop-space/cart');
    expect(screen.queryByRole('navigation',{name:'Navegación principal móvil'})).not.toBeInTheDocument();
  });

  it('keeps a verified host binding ahead of public path and private identity',()=>{
    const binding=tenantHostFixture();fixtures.tenant={...publicTenant(),hostBinding:binding};
    fixtures.privateShell={active:true,identity:{tenantSlug:'private-org',name:'Private org',logoUrl:null}};
    mount();expect(screen.getByRole('link',{name:binding.identity.name})).toHaveAttribute('href','/');
    expect(screen.queryByText('Published institution A')).not.toBeInTheDocument();
  });
  it('keeps the private shell ahead of public path branding',()=>{
    fixtures.privateShell={active:true,identity:{tenantSlug:'private-org',name:'Private org',logoUrl:null}};
    mount();expect(screen.getByRole('link',{name:'Panel de Private org'})).toHaveAttribute('href','/perfil');
    expect(screen.queryByText('Published institution A')).not.toBeInTheDocument();
  });
  it('preserves scoped institutional login presentation',()=>{
    mount('/t/institution-a/login');expect(screen.getByRole('link',{name:'Published institution A'})).toBeInTheDocument();
    expect(screen.queryByTestId('public-workspace-pending')).not.toBeInTheDocument();
  });
  it('preserves an existing cart with items on its commerce route',()=>{
    mount('/t/institution-a/cart');expect(screen.getByRole('link',{name:'Ver carrito'})).toHaveAttribute('href','/t/institution-a/cart');
    expect(screen.getByRole('link',{name:'Ver carrito'})).toHaveTextContent('6');
    expect(fixtures.cart).toHaveBeenLastCalledWith(true);expect(screen.queryByTestId('public-workspace-pending')).not.toBeInTheDocument();
  });
  it('preserves the platform landing and commercial demo outside the public tenant root',()=>{
    mount('/');expect(screen.getByText('Chatboc.ar')).toBeInTheDocument();
    expect(screen.getByRole('link',{name:'Ver demo'})).toHaveAttribute('href','/demo');
    expect(screen.getByRole('link',{name:'Iniciar sesión'})).toHaveAttribute('href','/login');
  });
});
