import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tenantHostPayload } from '@/test/fixtures/tenantHost';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';

const state = vi.hoisted(() => ({
  host: 'atencion.example.test', user: null as Record<string, unknown> | null,
  verified: true, loading: false, ready: vi.fn(), anon: vi.fn(), clerk: vi.fn(),
  profileMounts: vi.fn(), demoMounts: vi.fn(), docsMounts: vi.fn(), widgetMounts: vi.fn(),
}));
// Restore the real router and API over the full canonical tests/setup.ts.
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
// PWA registration is outside this route-admission fixture; App's ancillary toast renderer only calls this notification hook.
vi.mock('@/pwa', () => ({ notifyPwaRefreshRendererReady: () => undefined }));
vi.mock('@/hooks/useUser', async () => {
  const { useSessionAuthority } = await import('@/components/access/SessionAuthorityContext');
  return { UserProvider: ({ children }: { children: React.ReactNode }) => children,
    useUser: () => ({ user: state.user, loading: state.loading,
      organizationProfileVerified: state.verified, refreshUser: async () => undefined,
      hasVerifiedSession: useSessionAuthority().hasVerifiedSession }) };
});
vi.mock('@/config/featureFlags', async original => ({
  ...await original<typeof import('@/config/featureFlags')>(), FEATURE_ENCUESTAS: true,
}));
vi.mock('@/api/clerkAuth', () => ({ fetchClerkFrontendConfig: state.clerk }));
vi.mock('@/utils/backendBootstrapGate', async original => ({
  ...await original<typeof import('@/utils/backendBootstrapGate')>(), ensureBackendRuntimeReady: state.ready,
}));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: state.anon }));
vi.mock('@clerk/clerk-react', () => ({ ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ isLoaded: true, isSignedIn: false, userId: null, sessionId: null }) }));
vi.mock('@react-oauth/google', () => ({ GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/auth/ClerkAuthBridge', () => ({ default: () => null }));
vi.mock('@/context/SocketContext', () => ({ SocketProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/context/CapabilitiesContext', () => ({ CapabilitiesProvider: ({ children }: { children: React.ReactNode }) => children,
  useCapabilities: () => ({ capabilities: ['tickets.read'], hasAllCapabilities: () => true, hasAnyCapability: () => true }) }));
vi.mock('@/context/RealtimeAlertsContext', () => ({ RealtimeAlertsProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/app-shell/AppShellStatusBar', () => ({ AppShellStatusBar: () => null }));
vi.mock('@/components/app-shell/AppAccessibility', () => ({ AppAccessibility: () => null }));
vi.mock('@/components/app-shell/PwaInstallPrompt', () => ({ PwaInstallPrompt: () => null }));
vi.mock('@/components/guidance/ScrollMascotGuide', () => ({ default: () => null }));
vi.mock('@/components/layout/Layout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { default: () => <Outlet /> };
});
vi.mock('@/components/chat/ChatWidget', () => ({ default: () => {
  React.useEffect(() => { state.widgetMounts(); }, []);
  return <div data-testid="widget-probe" />;
} }));
vi.mock('@/pages/Index', () => ({ default: () => <h1>Shared platform home probe</h1> }));
vi.mock('@/pages/tenant/TenantHomePage', () => ({ default: () => <h1>Customer public portal probe</h1> }));
vi.mock('@/pages/Demo', () => ({ default: () => {
  React.useEffect(() => { state.demoMounts(); }, []);
  return <h1>Platform demo probe</h1>;
} }));
vi.mock('@/pages/Documentacion', () => ({ default: () => {
  React.useEffect(() => { state.docsMounts(); }, []);
  return <h1>Platform documentation probe</h1>;
} }));
vi.mock('@/pages/Perfil', () => ({ default: () => {
  React.useEffect(() => { state.profileMounts(); }, []);
  return <h1>Private profile probe</h1>;
} }));
vi.mock('@/pages/ChatPage', () => ({ default: () => <h1>Legacy platform chat probe</h1> }));
vi.mock('@/pages/market/MarketplaceBlueprintPage', () => ({ default: () => <h1>Platform blueprint probe</h1> }));
vi.mock('@/pages/Login', () => ({ default: () => <h1>Credential login probe</h1> }));
vi.mock('@/pages/ClerkSsoCallbackPage', () => ({ default: () => <h1>Session callback probe</h1> }));
vi.mock('@/pages/tracking/TrackingExperiencePage', () => ({ default: () => <h1>Public tracking probe</h1> }));
vi.mock('@/pages/e/[slug]', () => ({ default: () => <h1>Public survey probe</h1> }));
import App from './App';

const actor = (id = 17, slug = 'government-east') => ({
  id: 701, tenant_slug: slug, rol: 'tenant_admin',
  organization_profile: { contract_version: 'organization.profile_settings.v1', tenant: { id, slug }, values: { nombre_empresa: 'Synthetic customer' } },
  organization_workspace: { contract_version: 'organization.profile_workspace.v1', tenant: { id, slug }, organization_type: 'gobierno' },
});
const jsonResponse = (value: unknown) => new Response(JSON.stringify(value), {
  headers: { 'Content-Type': 'application/json' },
});
let reads: string[];
const mount = (path: string, user: ReturnType<typeof actor> | null = null) => {
  state.user = user;
  if (user) {
    safeLocalStorage.setItem('authToken', 'synthetic-native-session');
    safeLocalStorage.setItem('user', JSON.stringify(user));
    usePanelSessionStore.setState({ authToken: 'synthetic-native-session', user });
  }
  window.history.replaceState({}, '', path);
  return render(<App />);
};
beforeEach(() => {
  state.host = 'atencion.example.test'; state.user = null; state.verified = true; state.loading = false;
  state.ready.mockReset().mockResolvedValue(undefined);
  state.anon.mockReset().mockResolvedValue('synthetic-visitor');
  state.clerk.mockReset().mockResolvedValue({ enabled: false, environment: 'production',
    production_ready: false, ready_for_session_sync: false, social_providers: [], configuration_warnings: [] });
  for (const fn of [state.profileMounts, state.demoMounts, state.docsMounts, state.widgetMounts]) fn.mockReset();
  safeLocalStorage.clear(); sessionStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useTenantStore.getState().clearTenant(); useWidgetSessionStore.setState({ entityToken: null, chatAuthToken: null });
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() })));
  const originalWindow = window;
  const originalLocation = window.location;
  const location = new Proxy(originalLocation, { get(target, key) {
    if (key === 'hostname' || key === 'host') return state.host;
    if (key === 'origin') return `https://${state.host}`;
    if (key === 'href') return `https://${state.host}${target.pathname}${target.search}${target.hash}`;
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  } });
  vi.stubGlobal('window', new Proxy(originalWindow, { get(target, key) {
    return key === 'location' ? location : Reflect.get(target, key, target);
  } }));
  reads = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.origin);
    reads.push(url.pathname + url.search);
    expect(init?.method ?? 'GET').toBe('GET');
    if (url.pathname === '/api/public/host-resolution') return jsonResponse(tenantHostPayload(state.host));
    if (url.pathname.endsWith('/pwa/public/tenant-info')) return jsonResponse({ contract_version: 'public.tenant_profile.v1',
      tenant: { id: 17, slug: 'government-east', nombre: 'Synthetic customer', tipo: 'gobierno' } });
    if (url.pathname.endsWith('/app/me/tenants')) return jsonResponse([]);
    throw new Error(`Unexpected synthetic HTTP path: ${url.pathname}`);
  }));
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.unstubAllEnvs();
  safeLocalStorage.clear(); sessionStorage.clear(); usePanelSessionStore.setState({ authToken: null, user: null });
  useTenantStore.getState().clearTenant(); useWidgetSessionStore.setState({ entityToken: null, chatAuthToken: null });
  window.history.replaceState({}, '', '/');
});
const expectSameHostDenial = async () => {
  await screen.findByRole('heading', { name: 'No encontramos esta página' });
  expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/');
  expect(document.querySelector('a[href^="https://www.chatboc.ar"]')).toBeNull();
};

describe('real App/router/catalog on a verified customer domain', () => {
  it.each(['/demo', '/pymes', '/documentacion', '/chat', '/t/government-east/market/blueprint'])('withholds platform children before mounting %s', async path => {
    mount(path); await expectSameHostDenial();
    expect(state.demoMounts).not.toHaveBeenCalled(); expect(state.docsMounts).not.toHaveBeenCalled();
    expect(state.widgetMounts).not.toHaveBeenCalled();
  });
  it.each([[18, 'government-west'], [18, 'government-east']])('withholds /perfil for actor tenant %s/%s', async (id, slug) => {
    mount('/perfil', actor(id, slug)); await expectSameHostDenial();
    expect(state.profileMounts).not.toHaveBeenCalled();
    expect(usePanelSessionStore.getState().user).toMatchObject({ tenant_slug: slug });
  });
  it('keeps an anonymous public customer home and its widget available', async () => {
    mount('/'); await screen.findByRole('heading', { name: 'Customer public portal probe' });
    expect(await screen.findByTestId('widget-probe')).toBeInTheDocument();
    expect(reads.some(path => path.startsWith('/api/public/host-resolution?host=atencion.example.test'))).toBe(true);
    expect(usePanelSessionStore.getState().authToken).toBeNull();
  });
  it.each([['/tracking/claim/synthetic-code', 'Public tracking probe'], ['/e/synthetic-instrument', 'Public survey probe']])('preserves public service %s', async (path, title) => {
    mount(path); await screen.findByRole('heading', { name: title });
    expect(state.profileMounts).not.toHaveBeenCalled();
  });
  it('admits the fresh matching organization to /perfil', async () => {
    mount('/perfil', actor()); await screen.findByRole('heading', { name: 'Private profile probe' });
    expect(state.profileMounts).toHaveBeenCalledOnce();
  });
  it('keeps private children absent while the matching organization refreshes', async () => {
    state.loading = true; mount('/perfil', actor());
    await screen.findByText('Validando acceso institucional'); expect(state.profileMounts).not.toHaveBeenCalled();
  });
  it('does not use a matching but unverified profile as admission', async () => {
    state.verified = false; mount('/perfil', actor()); await expectSameHostDenial();
    expect(state.profileMounts).not.toHaveBeenCalled();
  });
  it.each([['/login', 'Credential login probe'], ['/sso-callback', 'Session callback probe'], ['/auth/sso-callback', 'Session callback probe']])('preserves normal same-origin authentication at %s', async (path, title) => {
    mount(path); await screen.findByRole('heading', { name: title });
    expect(state.profileMounts).not.toHaveBeenCalled();
  });
  it('redirects a guest private entry to the existing same-origin login', async () => {
    mount('/perfil'); await screen.findByRole('heading', { name: 'Credential login probe' });
    expect(window.location.pathname).toBe('/login'); expect(window.location.hostname).toBe(state.host);
    expect(state.profileMounts).not.toHaveBeenCalled();
  });
  it('keeps an undeclared path neutral without booting a widget', async () => {
    mount('/not-a-customer-service/deeper'); await expectSameHostDenial();
    expect(state.widgetMounts).not.toHaveBeenCalled();
  });
  it('rejects a foreign canonical tenant before mounting its home', async () => {
    mount('/t/government-west');
    await screen.findByRole('alert'); expect(screen.queryByText('Customer public portal probe')).not.toBeInTheDocument();
    expect(reads.some(path => path.includes('tenant=government-west'))).toBe(false);
  });
  it('leaves the platform demo available without any customer binding', async () => {
    state.host = 'www.chatboc.ar'; mount('/demo');
    await screen.findByRole('heading', { name: 'Platform demo probe' });
    expect(state.demoMounts).toHaveBeenCalledOnce(); expect(reads.some(path => path.includes('/host-resolution'))).toBe(false);
  });
});
