import React from 'react';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import IframePage from './IframePage';

vi.mock('@/env',()=>({GOOGLE_CLIENT_ID:''}));
vi.mock('@/context/TenantContext',()=>({TenantProvider:({children}:{children:React.ReactNode})=><>{children}</>}));
vi.mock('@/utils/backendBootstrapGate',()=>({ensureBackendRuntimeReady:vi.fn().mockResolvedValue(undefined)}));
vi.mock('@/utils/config',()=>({getChatbocConfig:()=>({endpoint:'municipio',entityToken:'',defaultOpen:true,width:'460px',height:'680px',closedWidth:'96px',closedHeight:'96px',bottom:'20px',right:'20px',primaryColor:'#007aff',accentColor:'',logoUrl:'',headerLogoUrl:'',logoAnimation:'',welcomeTitle:'',welcomeSubtitle:'',userMsgColor:'',chatBackground:'',fontFamily:''})}));
vi.mock('@/components/chat/ChatWidget',async()=>{
  const {default:ChatHeader}=await import('@/components/chat/ChatHeader');
  return {default:({welcomeTitle,welcomeSubtitle}:{welcomeTitle?:string;welcomeSubtitle?:string})=><ChatHeader onClose={()=>{}} title={welcomeTitle} subtitle={welcomeSubtitle}/>};
});
vi.mock('@/components/chat/AccessibilityToggle',()=>({default:()=> <button>Accesibilidad</button>}));
vi.mock('@/components/chat/ChatbocLogoAnimated',()=>({default:()=> <span aria-hidden="true">logo</span>}));
vi.mock('@/hooks/use-mobile',()=>({useIsMobile:()=>true}));

const originalFetch=global.fetch;
const publicConfig={contract_version:'public.widget_config.v1',slug:'example-city',tipo_chat:'municipio',welcome_title:'Hola, consultá la información de tu organización.',welcome_subtitle:'Asistente de la organización'};
beforeEach(()=>{
  window.history.replaceState({},'', '/iframe?tenantSlug=example-city&defaultOpen=true&fullpage=true');
  global.fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify(publicConfig),{headers:{'Content-Type':'application/json'}}));
});
afterEach(()=>{cleanup();global.fetch=originalFetch;delete (window as any).CHATBOC_CONFIG;vi.restoreAllMocks();window.history.replaceState({},'', '/');});

describe('IframePage persisted assistant header',()=>{
  it('renders the persisted assistant name as the title and greeting below it',async()=>{
    render(<IframePage/>);
    expect(await screen.findByTitle('Asistente de la organización')).toHaveTextContent('Asistente de la organización');
    expect(screen.getByText(publicConfig.welcome_title)).toHaveClass('truncate');
    expect(screen.queryByTitle(publicConfig.welcome_title)).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/public/tenants/example-city/widget-config',expect.objectContaining({credentials:'omit'}));
  });

  it('retains explicit embed display overrides without writing backend configuration',async()=>{
    window.history.replaceState({},'', '/iframe?tenantSlug=example-city&welcomeTitle=Nombre%20expl%C3%ADcito&welcomeSubtitle=Saludo%20expl%C3%ADcito');
    render(<IframePage/>);
    await waitFor(()=>expect(global.fetch).toHaveBeenCalledOnce());
    expect(await screen.findByTitle('Nombre explícito')).toBeVisible();
    expect(screen.getByText('Saludo explícito')).toBeVisible();
    expect(screen.queryByText(publicConfig.welcome_title)).not.toBeInTheDocument();
  });

  it('preserves the existing display semantics for an unversioned legacy config',async()=>{
    global.fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({slug:'example-city',tipo_chat:'municipio',welcome_title:'Nombre legacy',welcome_subtitle:'Descripción legacy'}),{headers:{'Content-Type':'application/json'}}));
    render(<IframePage/>);
    expect(await screen.findByTitle('Nombre legacy')).toBeVisible();
    expect(screen.getByText('Descripción legacy')).toBeVisible();
  });
});
