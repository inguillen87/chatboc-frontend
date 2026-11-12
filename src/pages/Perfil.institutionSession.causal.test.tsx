import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CapabilitiesProvider } from '@/context/CapabilitiesContext';

const runtime = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  getTicketStats: vi.fn(),
  getHeatmapDataset: vi.fn(),
  refreshUser: vi.fn(),
  setUser: vi.fn(),
  toast: vi.fn(),
  ticketMounts: 0,
  realTicketPanel: false,
  hasSession: true,
  sessionVerified: true,
  userLoading: false,
  profileVerified: true,
  realNavigation: false,
  user: null as Record<string, any> | null,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => runtime.realNavigation
      ? actual.useNavigate()
      : vi.fn((path: string) => console.log(`Mocked navigate to: ${path}`)),
  };
});


vi.mock('@/utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/api')>();
  return { ...actual, apiFetch: runtime.apiFetch };
});


vi.mock('@/components/ui/use-toast', () => ({ toast: runtime.toast }));
vi.mock('@/services/statsService', () => ({
  getTicketStats: runtime.getTicketStats,
  getHeatmapDataset: runtime.getHeatmapDataset,
}));
vi.mock('@/hooks/useMunicipalPosts', () => ({
  useMunicipalPosts: () => ({
    posts: [],
    isLoading: false,
    error: null,
    filters: {},
    meta: { totalCount: 0, limit: 10, offset: 0, hasMore: false },
    setFilters: vi.fn().mockResolvedValue(undefined),
    loadMore: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/services/catalogService', () => ({
  fetchCatalogVectorSyncStatus: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/services/documentIntelligenceService', () => ({
  requestDocumentPreview: vi.fn(),
}));
vi.mock('@/services/profileAvatarService', () => ({
  uploadProfileAvatar: vi.fn(),
}));

vi.mock('@/components/admin/EventForm', () => ({ EventForm: () => null }));
vi.mock('@/components/admin/PromotionForm', () => ({ PromotionForm: () => null }));
vi.mock('@/components/admin/AgendaPasteForm', () => ({ AgendaPasteForm: () => null }));
vi.mock('@/components/ui/MunicipioIcon', () => ({ default: () => <span /> }));
vi.mock('@/components/backoffice/BackofficeCommandCenter', () => ({ default: ({scope}: {scope?: string}) => <div data-testid="mock-command-center" data-scope={scope} /> }));
vi.mock('@/components/profile/ChannelActivationChecklist', () => ({
  default: ({ tenantSlug, initialData }: { tenantSlug?: string | null; initialData?: any }) => (
    <div
      data-testid="mock-channel-activation"
      data-tenant-slug={tenantSlug || ''}
      data-current-plan={initialData?.integration_access?.current_plan || ''}
    />
  ),
}));
vi.mock('@/components/analytics/Heatmap', () => ({ default: () => <div /> }));
vi.mock('@/components/ui/MiniChatWidgetPreview', () => ({ default: () => <div /> }));
vi.mock('@/components/ui/AddressAutocomplete', () => ({ default: () => <div /> }));
vi.mock('@/components/identity/IdentityAvatar', () => ({ default: () => <div /> }));
vi.mock('@/components/LazyMapLibreMap', () => ({ default: () => <div /> }));
vi.mock('@/components/catalog/ImportWizard', () => ({ default: () => <div /> }));

vi.mock('@/pages/TicketsPanel', async importOriginal => {
  const actual = await importOriginal<typeof import('@/pages/TicketsPanel')>();
  return { default: (props: React.ComponentProps<typeof actual.default>) => {
    runtime.ticketMounts += 1;
    if (runtime.realTicketPanel) return <actual.default {...props} />;
    return <div data-testid="mock-tickets" />;
  } };
});
vi.mock('@/hooks/useTicketUpdates', () => ({ default: () => undefined }));
vi.mock('@/components/tickets/NewTicketsPanel', async () => {
  const { useTickets } = await import('@/context/TicketContext');
  return { default: () => {
    const { loading, tickets } = useTickets();
    return <div data-testid="ticket-inbox-probe" data-loading={String(loading)} data-count={tickets.length} />;
  } };
});
vi.mock('@/pages/EstadisticasPage', () => ({ default: () => <div data-testid="mock-stats" /> }));
vi.mock('@/pages/analytics/AnalyticsPage', () => ({ default: () => <div data-testid="mock-analytics" /> }));
vi.mock('@/pages/UsuariosPage', () => ({
  default: ({ tenantSlugOverride, embedded }: { tenantSlugOverride?: string | null; embedded?: boolean }) => (
    <div data-testid="mock-users" data-tenant-slug={tenantSlugOverride || ''} data-embedded={String(Boolean(embedded))} />
  ),
}));
vi.mock('@/pages/SmartPedidosWrapper', () => ({ default: () => <div /> }));
vi.mock('@/pages/InternalUsers', () => ({ default: () => <div /> }));
vi.mock('@/pages/IncidentsMap', () => ({
  default: ({ tenantSlugOverride }: { tenantSlugOverride?: string | null }) => (
    <div data-testid="mock-map" data-tenant-slug={tenantSlugOverride || ''} />
  ),
}));
vi.mock('@/pages/admin/CatalogManagementPage', () => ({ default: () => <div /> }));

import Perfil from '@/pages/Perfil';

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('scrollTo', vi.fn());
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn(),
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const canonicalOrganizationUser = (kind = 'municipio', slug = 'civic-workspace', canEdit = true) => ({
  id: 9001, name: 'Personal operator', email: 'operator@example.test',
  rol: 'admin_municipio', tipo_chat: 'pyme', rubro: 'medico', plan: 'full',
  tenant_slug: slug, tenantSlug: slug,
  avatar_url: 'https://cdn.example.test/personal.png', avatar_consent: true,
  capabilities: ['tickets.read', 'orders.read'],
  organization_profile: {
    contract_version: 'organization.profile_settings.v1', tenant: { id: 303, slug },
    revision: 'a'.repeat(64), can_edit: canEdit,
    editability: { mode: canEdit ? 'editable' : 'read_only' },
    values: {
      nombre_empresa: 'Verified institution', telefono: '+541112345678', actividad: 'Public services',
      direccion: 'Institutional address', ciudad: 'Institutional city', provincia: 'Province', pais: 'Argentina',
      latitud: null, longitud: null, link_web: 'https://institution.example.test',
      logo_url: 'https://cdn.example.test/institution.png', horario_json: [],
    },
    ui: { organization_type_label_contract: 'organization.type_label.v1',
      organization_type_label: kind === 'municipio' ? 'Gobierno' : kind === 'colegio' ? 'Educación' : 'Empresa' },
  },
  organization_workspace: {
    contract_version: 'organization.profile_workspace.v1', tenant: { id: 303, slug },
    organization_type: kind,
  },
});

// Synthetic integration probe: product handlers, session guard, user provider,
// Bridge and persistence helpers remain real. Only remote APIs and SDK state
// are mocked; no actual credentials/provider/network/browser are accessed.
import {cleanup} from '@testing-library/react';
import {afterEach} from 'vitest';
import {useLocation} from 'react-router-dom';
import {UserProvider} from '@/hooks/useUser';
import SessionBootstrapGuard from '@/components/access/SessionBootstrapGuard';
import ClerkAuthBridge from '@/components/auth/ClerkAuthBridge';
import {ClerkRuntimeProvider} from '@/components/auth/ClerkRuntimeContext';
import {persistPanelLoginSession} from '@/utils/panelLoginSession';
import {safeLocalStorage,safeSessionStorage} from '@/utils/safeLocalStorage';
import {usePanelSessionStore} from '@/stores';
import {captureChatbocSessionRevision,subscribeChatbocSessionRevision} from '@/utils/chatbocSessionRevision';
import {clearLocalChatbocSession,logoutChatbocSession,hasAuthenticatedChatbocSession} from '@/utils/sessionLogout';
import {isClerkSessionRetired,registerActiveClerkIdentity,captureSessionRetirement} from '@/utils/sessionRetirement';
import {retirementProof} from '../../tests/fixtures/session-retirement.synthetic';
import {persistClerkAuthContext} from '@/utils/clerkAuthContext';

const sdk=vi.hoisted(()=>({
  auth:{isLoaded:true,isSignedIn:false,userId:'synthetic-sdk-a',sessionId:'synthetic-sid-a',getToken:vi.fn()},
  user:{id:'synthetic-sdk-a',firstName:'Previous',lastName:'Identity',updatedAt:new Date('2026-01-01T00:00:00Z'),emailAddresses:[],phoneNumbers:[],externalAccounts:[]} as any,
  sync:vi.fn(),
}));
vi.mock('@clerk/clerk-react',()=>({useAuth:()=>sdk.auth,useUser:()=>({user:sdk.user})}));
vi.mock('@/api/clerkAuth',()=>({syncClerkSession:sdk.sync,completeClerkOnboarding:vi.fn()}));
vi.mock('@/components/auth/ClerkTenantOnboardingDialog',()=>({default:()=>null}));

const jwt=(actor:number)=>`header.${btoa(JSON.stringify({user_id:actor,auth_provider:'native',asid:'synthetic-native-m',exp:4070908800}))}.signature`;
const nativeUser=()=>({...canonicalOrganizationUser('municipio','junin'),id:7,rol:'admin_municipio',tipo_chat:'municipio',rubro:'municipio',email:'native@example.invalid',name:'Synthetic native operator',capabilities:['tickets.read','market.orders.read','settings.tenant.write']});
const previousUser=()=>({id:42,rol:'superadmin',tipo_chat:'municipio',rubro:'municipio',tenant_slug:'junin',tenantSlug:'junin',name:'Synthetic previous operator',email:'previous@example.invalid',capabilities:['settings.tenant.write']});
const establishNative=()=>{
 runtime.user=nativeUser();
 persistPanelLoginSession({token:jwt(7),user:runtime.user,sessionRetirement:retirementProof({actor_id:'7',provider:'native',lineage_id:'synthetic-native-m'}),replaceIdentity:true,setUser:user=>usePanelSessionStore.getState().setUser(user as any)});
};
const LocationProbe=()=>{const location=useLocation();return <div data-testid="real-location">{location.pathname}{location.search}</div>};
const BootstrapFrame=()=>{
 React.useSyncExternalStore(subscribeChatbocSessionRevision,captureChatbocSessionRevision,captureChatbocSessionRevision);
 const identity=sdk.auth.isLoaded&&sdk.auth.isSignedIn&&sdk.auth.userId&&!isClerkSessionRetired(sdk.auth.userId,sdk.auth.sessionId)?`${sdk.auth.userId}:${sdk.auth.sessionId}`:null;
 const identityRef=React.useRef(identity);identityRef.current=identity;
 const [readyIdentity,setReadyIdentity]=React.useState<string|null>(null);
 React.useEffect(()=>{setReadyIdentity(current=>current===identity?current:null)},[identity]);
 const pending=React.useCallback((value:string)=>{if(identityRef.current===value)setReadyIdentity(null)},[]);
 const ready=React.useCallback((value:string)=>{if(identityRef.current===value)setReadyIdentity(value)},[]);
 const reset=React.useCallback(()=>setReadyIdentity(null),[]);
 const clerkStatus=!sdk.auth.isLoaded?'loading':!sdk.auth.isSignedIn||!identity?'signed_out':readyIdentity===identity?'ready':'syncing';
 return <><ClerkAuthBridge onSessionPending={pending} onSessionReady={ready} onSessionReset={reset}/><LocationProbe/><SessionBootstrapGuard clerkStatus={clerkStatus} renderRuntime={()=> <CapabilitiesProvider><Routes><Route path="/perfil" element={<Perfil/>}/><Route path="/login" element={<div data-testid="login-page">Login</div>}/><Route path="/403" element={<div>Denied</div>}/></Routes></CapabilitiesProvider>}/></>;
};
const Tree=()=> <UserProvider><BrowserRouter><ClerkRuntimeProvider value={{enabled:true,loading:false,publishableKey:'pk_test_synthetic',source:'backend',socialProviders:['google']}}><BootstrapFrame/></ClerkRuntimeProvider></BrowserRouter></UserProvider>;
const renderTree=()=>{window.history.replaceState({},'','/perfil');return render(<Tree/>)};
const navigateProfile=()=>{window.history.pushState({},'','/perfil');window.dispatchEvent(new PopStateEvent('popstate'))};
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return{promise,resolve}};
const nextClerkSession=(sessionId:string)=>({contract_version:'auth.clerk.v1',token:'synthetic-clerk-a-2',auth_provider:'clerk',user:previousUser(),onboarding:{required:false},session_retirement:retirementProof({actor_id:'42',provider:'clerk',lineage_id:'synthetic-clerk-a-2',clerk_session_id:sessionId})});
const launchPrevious=async()=>{
 runtime.user=previousUser();sdk.auth.isSignedIn=true;
 sdk.sync.mockResolvedValueOnce({contract_version:'auth.clerk.v1',token:'synthetic-clerk-a',auth_provider:'clerk',user:runtime.user,onboarding:{required:false},session_retirement:retirementProof({actor_id:'42',provider:'clerk',lineage_id:'synthetic-clerk-a',clerk_session_id:'synthetic-sid-a'})});
 const view=renderTree();
 await waitFor(()=>expect(usePanelSessionStore.getState().authToken).toBe('synthetic-clerk-a'));
 await waitFor(()=>expect(captureSessionRetirement(42)?.provider).toBe('clerk'));
 return view;
};

beforeEach(()=>{
 cleanup();safeSessionStorage.clear();safeLocalStorage.clear();clearLocalChatbocSession();registerActiveClerkIdentity('',null);
 runtime.realNavigation=true;runtime.hasSession=true;runtime.sessionVerified=true;runtime.userLoading=false;runtime.profileVerified=true;runtime.user=nativeUser();
 sdk.auth.isLoaded=true;sdk.auth.isSignedIn=false;sdk.auth.sessionId='synthetic-sid-a';sdk.auth.userId='synthetic-sdk-a';sdk.user={...sdk.user,id:'synthetic-sdk-a'};sdk.sync.mockReset();sdk.auth.getToken.mockReset().mockResolvedValue('synthetic-clerk-token');
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{status:503})));
 runtime.apiFetch.mockReset().mockImplementation(async(path:string)=>{
  if(path==='/api/me')return {...runtime.user,session_retirement:captureSessionRetirement(runtime.user?.id)};
  if(path==='/api/app/backoffice/navigation?tenant_slug=junin')return{contract_version:'backoffice.navigation.v1',modules:[{id:'operations',enabled:true}]};
  if(path==='/api/admin/tenants/junin/config')return{tenant:{id:303,slug:'junin',tipo:'municipio',plan:'full'},organization_profile:runtime.user?.organization_profile};
  if(path==='/api/v2/tenants/junin/activation/channels')return{contract_version:'tenant.channel_activation.v1',tenant:{id:303,slug:'junin',plan:'full'},integration_access:{enabled:true,current_plan:'full'},channels:[]};
  if(path==='/api/whatsapp/promocionar')return{can_send:false};
  return{};
 });
 runtime.getTicketStats.mockReset().mockResolvedValue({heatmap:[],heatmapDataset:{points:[]}});runtime.getHeatmapDataset.mockReset().mockResolvedValue({points:[]});
});
afterEach(()=>{cleanup();safeSessionStorage.clear();safeLocalStorage.clear();clearLocalChatbocSession();registerActiveClerkIdentity('',null);vi.unstubAllGlobals();});

it('keeps an ordinary native session on institution query navigation after a reload',async()=>{
 establishNative();const view=renderTree();await screen.findByRole('heading',{level:1,name:'Verified institution'});
 view.unmount();renderTree();await screen.findByRole('heading',{level:1,name:'Verified institution'});
 fireEvent.click(screen.getByRole('button',{name:'Perfil institucional'}));
 await screen.findByRole('textbox',{name:'Nombre legal o institucional'});
 expect(window.location.pathname).toBe('/perfil');expect(new URLSearchParams(window.location.search).get('section')).toBe('general');expect(new URLSearchParams(window.location.search).get('tenant_slug')).toBe('junin');
 expect(usePanelSessionStore.getState()).toMatchObject({authToken:jwt(7),user:{id:7}});expect(fetch).not.toHaveBeenCalled();expect(sdk.sync).not.toHaveBeenCalled();
});

it('preserves native M through late signout and reappearance of the retired SDK A while opening institution',async()=>{
 const view=await launchPrevious();await act(async()=>{await logoutChatbocSession()});expect(isClerkSessionRetired('synthetic-sdk-a','synthetic-sid-a')).toBe(true);
 act(()=>{establishNative();navigateProfile()});await screen.findByRole('heading',{level:1,name:'Verified institution'});
 sdk.auth.isSignedIn=false;view.rerender(<Tree/>);sdk.auth.isSignedIn=true;sdk.user={...sdk.user};view.rerender(<Tree/>);
 fireEvent.click(screen.getByRole('button',{name:'Perfil institucional'}));await screen.findByRole('textbox',{name:'Nombre legal o institucional'});
 expect(window.location.pathname).toBe('/perfil');expect(usePanelSessionStore.getState()).toMatchObject({authToken:jwt(7),user:{id:7}});expect(captureSessionRetirement(7)?.lineage_id).toBe('synthetic-native-m');expect(fetch).toHaveBeenCalledOnce();expect(sdk.sync).toHaveBeenCalledOnce();
});

it('fails closed when the currently owned Clerk session signs out without an auth HTTP failure',async()=>{
 const view=await launchPrevious();sdk.auth.isSignedIn=false;view.rerender(<Tree/>);
 await screen.findByTestId('login-page');expect(window.location.pathname).toBe('/login');expect(hasAuthenticatedChatbocSession()).toBe(false);expect(fetch).toHaveBeenCalledOnce();
});

it('does not let a different late SDK SID of previous A retire native M outside an auth entry',async()=>{
 const view=await launchPrevious();await act(async()=>{await logoutChatbocSession()});
 act(()=>{establishNative();navigateProfile()});await screen.findByRole('heading',{level:1,name:'Verified institution'});
 sdk.auth.sessionId='synthetic-late-sid-a-2';sdk.auth.getToken.mockReturnValue(new Promise(()=>{}));sdk.user={...sdk.user};view.rerender(<Tree/>);
 expect(usePanelSessionStore.getState()).toMatchObject({authToken:jwt(7),user:{id:7}});
 expect(fetch).toHaveBeenCalledOnce();
 fireEvent.click(screen.getByRole('button',{name:'Perfil institucional'}));await screen.findByRole('textbox',{name:'Nombre legal o institucional'});expect(window.location.pathname).toBe('/perfil');
 expect(captureSessionRetirement(7)?.lineage_id).toBe('synthetic-native-m');
 expect(sdk.auth.getToken).toHaveBeenCalledOnce();expect(sdk.sync).toHaveBeenCalledOnce();
});

it('does not adopt a different late SDK SID over native M even when its token and exchange are ready',async()=>{
 const view=await launchPrevious();await act(async()=>{await logoutChatbocSession()});
 act(()=>{establishNative();navigateProfile()});await screen.findByRole('heading',{level:1,name:'Verified institution'});
 sdk.auth.sessionId='synthetic-late-sid-a-2';sdk.sync.mockResolvedValueOnce(nextClerkSession(sdk.auth.sessionId));sdk.user={...sdk.user};
 await act(async()=>{view.rerender(<Tree/>)});
 expect(usePanelSessionStore.getState()).toMatchObject({authToken:jwt(7),user:{id:7}});
 expect(captureSessionRetirement(7)?.lineage_id).toBe('synthetic-native-m');expect(fetch).toHaveBeenCalledOnce();
 expect(sdk.auth.getToken).toHaveBeenCalledOnce();expect(sdk.sync).toHaveBeenCalledOnce();
});

it('preserves a reloaded native owner when the first SDK snapshot is a different signed in SID',async()=>{
 establishNative();sdk.auth.isSignedIn=true;sdk.auth.sessionId='synthetic-late-sid-a-2';sdk.sync.mockResolvedValueOnce(nextClerkSession(sdk.auth.sessionId));
 await act(async()=>{renderTree()});
 expect(usePanelSessionStore.getState()).toMatchObject({authToken:jwt(7),user:{id:7}});expect(captureSessionRetirement(7)?.lineage_id).toBe('synthetic-native-m');
 await screen.findByRole('heading',{level:1,name:'Verified institution'});
 expect(fetch).not.toHaveBeenCalled();expect(sdk.auth.getToken).not.toHaveBeenCalled();expect(sdk.sync).not.toHaveBeenCalled();
});

it('clears the currently owned Clerk A1 before trusting the new A2 SID and keeps the guard pending',async()=>{
 const view=await launchPrevious();const token=deferred<string>();sdk.auth.getToken.mockReturnValueOnce(token.promise);
 sdk.auth.sessionId='synthetic-new-owned-sid-a-2';sdk.sync.mockResolvedValueOnce(nextClerkSession(sdk.auth.sessionId));sdk.user={...sdk.user};
 view.rerender(<Tree/>);
 expect(usePanelSessionStore.getState()).toMatchObject({authToken:null,user:null});expect(captureSessionRetirement(42)).toBeNull();
 await screen.findByText('Validando acceso seguro');expect(fetch).toHaveBeenCalledOnce();expect(sdk.sync).toHaveBeenCalledOnce();
 await act(async()=>{token.resolve('synthetic-new-clerk-token');await token.promise});
 await waitFor(()=>expect(usePanelSessionStore.getState()).toMatchObject({authToken:'synthetic-clerk-a-2',user:{id:42}}));
 expect(captureSessionRetirement(42)?.clerk_session_id).toBe('synthetic-new-owned-sid-a-2');expect(sdk.sync).toHaveBeenCalledTimes(2);
});

it('allows an explicitly selected fresh A2 at the login entry to exchange after native M',async()=>{
 const view=await launchPrevious();await act(async()=>{await logoutChatbocSession()});
 act(()=>{establishNative();navigateProfile()});await screen.findByRole('heading',{level:1,name:'Verified institution'});
 act(()=>{window.history.pushState({},'','/login');window.dispatchEvent(new PopStateEvent('popstate'))});await screen.findByTestId('login-page');
 persistClerkAuthContext({intent:'tenant_owner',returnTo:'/perfil'});
 runtime.user=previousUser();sdk.auth.sessionId='synthetic-explicit-sid-a-2';sdk.sync.mockResolvedValueOnce(nextClerkSession(sdk.auth.sessionId));sdk.user={...sdk.user};
 await act(async()=>{view.rerender(<Tree/>)});
 await waitFor(()=>expect(usePanelSessionStore.getState()).toMatchObject({authToken:'synthetic-clerk-a-2',user:{id:42}}));
 expect(captureSessionRetirement(42)?.clerk_session_id).toBe('synthetic-explicit-sid-a-2');expect(safeLocalStorage.getItem('authProvider')).toBe('clerk');
 expect(isClerkSessionRetired('synthetic-sdk-a','synthetic-sid-a')).toBe(true);expect(sdk.sync).toHaveBeenCalledTimes(2);
 await waitFor(()=>expect(window.location.pathname).toBe('/superadmin'));
});
