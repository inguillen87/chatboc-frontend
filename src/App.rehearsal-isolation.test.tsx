import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
import { rehearsal, rehearsalAccount, rehearsalResponse, rehearsalKey, rehearsalTenant, rehearsalRun } from '../tests/fixtures/survey-rehearsal.synthetic';

const mocks = vi.hoisted(() => ({ api: vi.fn(), widgetMounts: vi.fn(), widgetUnmounts: vi.fn(),
  followedTenants: vi.fn(), tenantInfo: vi.fn(), clerkConfig: vi.fn(), backendReady: vi.fn(), anonId: vi.fn(),
  publicTenant: 'organization-a', metadataFailure: 0, accountFailure: 0, resultsFailure: 0, writeFailure: false,
  user: { id: 'synthetic-account', rol: 'ciudadano', tenant_slug: 'organization-a' } }));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/api', async original => ({ ...await original<typeof import('@/utils/api')>(), apiFetch: mocks.api }));
vi.mock('@/hooks/useUser', async () => {
  const { useSessionAuthority } = await import('@/components/access/SessionAuthorityContext');
  return { UserProvider: ({ children }: { children: React.ReactNode }) => children,
    useUser: () => ({ user: mocks.user, hasVerifiedSession: useSessionAuthority().hasVerifiedSession }) };
});
vi.mock('@/api/tenant', () => ({ followTenant: vi.fn(), unfollowTenant: vi.fn(), listFollowedTenants: mocks.followedTenants,
  getTenantPublicInfoFlexible: mocks.tenantInfo }));
vi.mock('@/api/clerkAuth', () => ({ fetchClerkFrontendConfig: mocks.clerkConfig }));
vi.mock('@/utils/backendBootstrapGate', async original => ({ ...await original<typeof import('@/utils/backendBootstrapGate')>(),
  ensureBackendRuntimeReady: mocks.backendReady }));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: mocks.anonId }));
vi.mock('@clerk/clerk-react', () => ({ ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ isLoaded: true, isSignedIn: false, userId: null, sessionId: null }) }));
vi.mock('@react-oauth/google', () => ({ GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/auth/ClerkAuthBridge', () => ({ default: () => null }));
vi.mock('@/context/SocketContext', () => ({ SocketProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/context/CapabilitiesContext', () => ({ CapabilitiesProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/context/RealtimeAlertsContext', () => ({ RealtimeAlertsProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/app-shell/AppShellStatusBar', () => ({ AppShellStatusBar: () => null }));
vi.mock('@/components/app-shell/AppAccessibility', () => ({ AppAccessibility: () => null }));
vi.mock('@/components/app-shell/PwaInstallPrompt', () => ({ PwaInstallPrompt: () => null }));
vi.mock('@/components/layout/Layout', async () => {
  const { Link, Outlet } = await import('react-router-dom');
  return { default: () => <><Link to="/">Synthetic public home</Link><Outlet /></> };
});
vi.mock('@/components/chat/ChatWidget', () => ({ default: () => {
  React.useEffect(() => { mocks.widgetMounts(); return () => { mocks.widgetUnmounts(); }; }, []);
  return <div data-testid="global-widget">Synthetic global widget</div>;
} }));
vi.mock('./routesConfig', async () => {
  const { Link } = await import('react-router-dom');
  const { default: RehearsalPage } = await import('@/pages/encuestas/RehearsalPage');
  return { default: [
    { path: '/', element: <Link to={`/pruebas/encuestas/organization-a/rehearsal_${'4'.repeat(32)}`}>Synthetic open rehearsal</Link>, allowGuest: true },
    { path: '/pruebas/encuestas/:tenantSlug/:runId', element: <RehearsalPage />, allowGuest: true },
  ] };
});
import App from './App';

const route = () => `/pruebas/encuestas/${mocks.publicTenant}/${rehearsalRun}`;
const apiBase = () => `/api/v2/public/tenants/${mocks.publicTenant}/survey-rehearsals/${rehearsalRun}`;
const metadata = () => ({ ...rehearsal(), tenant_slug: mocks.publicTenant,
  branding: { tenant_slug: mocks.publicTenant, display_name: 'Synthetic public organization' },
  links: { metadata_api: apiBase(), respond_api: apiBase() + '/respond', results_api: apiBase() + '/results' } });
const account = () => ({ ...rehearsalAccount(), tenant_slug: mocks.publicTenant });
const receipt = (replayed = false) => ({ ...rehearsalResponse(), tenant_slug: mocks.publicTenant, replayed,
  receipt: { ...rehearsalResponse().receipt, tenant_slug: mocks.publicTenant } });
const posts = () => mocks.api.mock.calls.filter(([, options]) => options?.method === 'POST');
const expectPrivateActorUnchanged = () => {
  expect(usePanelSessionStore.getState().user).toEqual(mocks.user);
  expect(usePanelSessionStore.getState().authToken).toBe('synthetic-native-session');
  expect(safeLocalStorage.getItem('authToken')).toBe('synthetic-native-session');
  expect(JSON.parse(safeLocalStorage.getItem('user')!)).toEqual(mocks.user);
};
const expectWidgetAbsent = () => {
  expect(screen.queryByTestId('global-widget')).not.toBeInTheDocument();
  expect(mocks.widgetMounts).not.toHaveBeenCalled();
};
beforeEach(() => {
  safeLocalStorage.clear(); sessionStorage.clear();
  mocks.publicTenant = rehearsalTenant; mocks.metadataFailure = 0; mocks.accountFailure = 0; mocks.resultsFailure = 0; mocks.writeFailure = false;
  mocks.widgetMounts.mockReset(); mocks.widgetUnmounts.mockReset(); mocks.api.mockReset();
  mocks.followedTenants.mockReset().mockResolvedValue([]);
  mocks.tenantInfo.mockReset().mockImplementation(async (slug: string) => ({ slug, nombre: 'Synthetic organization', tipo: 'municipio' }));
  mocks.clerkConfig.mockReset().mockResolvedValue({ enabled: false, environment: 'production', production_ready: false,
    ready_for_session_sync: false, social_providers: [], configuration_warnings: [] });
  mocks.backendReady.mockReset().mockResolvedValue(undefined);
  mocks.anonId.mockReset().mockResolvedValue('synthetic-visitor');
  mocks.user = { id: 'synthetic-account', rol: 'ciudadano', tenant_slug: rehearsalTenant };
  usePanelSessionStore.setState({ authToken: 'synthetic-native-session', user: mocks.user });
  useTenantStore.getState().clearTenant(); useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  safeLocalStorage.setItem('authToken', 'synthetic-native-session'); safeLocalStorage.setItem('user', JSON.stringify(mocks.user));
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unexpected network: synthetic test only')));
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(rehearsalKey);
  mocks.api.mockImplementation(async (path: string, options: { method?: string } = {}) => {
    if (path === apiBase()) { if (mocks.metadataFailure) throw new ApiError('synthetic metadata failure', mocks.metadataFailure); return metadata(); }
    if (path === apiBase() + '/results') { if (mocks.resultsFailure) throw new ApiError('synthetic results failure', mocks.resultsFailure); return metadata(); }
    if (path === apiBase() + '/respond/status') { if (mocks.accountFailure) throw new ApiError('synthetic account denied', mocks.accountFailure); return account(); }
    if (path.startsWith(apiBase() + '/respond/status?')) return receipt(true);
    if (path === apiBase() + '/respond' && options.method === 'POST') {
      if (mocks.writeFailure) throw new TypeError('synthetic uncertain transport');
      return receipt();
    }
    throw new Error('Unexpected synthetic API path');
  });
  window.history.replaceState({}, '', route());
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  safeLocalStorage.clear(); sessionStorage.clear(); usePanelSessionStore.setState({ authToken: null, user: null });
  useTenantStore.getState().clearTenant(); useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  window.history.replaceState({}, '', '/');
});
const ready = async () => {
  await screen.findByRole('heading', { name: rehearsal().ui.title });
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Sí' })).toBeEnabled());
};

describe('actual App bounded rehearsal composition', () => {
  it('loads the actual routed form and account status without mounting global chat/commerce or changing the private actor', async () => {
    render(<App />); await ready();
    expect(mocks.api).toHaveBeenCalledWith(apiBase(), expect.objectContaining({ omitCredentials: true }));
    expect(mocks.api).toHaveBeenCalledWith(apiBase() + '/respond/status', expect.objectContaining({ tenantSlug: rehearsalTenant, omitCredentials: false }));
    expectWidgetAbsent(); expectPrivateActorUnchanged(); expect(posts()).toHaveLength(0);
  });
  it('keeps public metadata readable for a guest and requires login before any participation', async () => {
    safeLocalStorage.removeItem('authToken'); usePanelSessionStore.setState({ authToken: null });
    render(<App />); await screen.findByRole('link', { name: rehearsal().ui.login_label });
    expect(screen.getByRole('radio', { name: 'Sí' })).toBeDisabled(); expectWidgetAbsent();
    expect(mocks.api.mock.calls.some(([path]) => String(path).includes('/respond'))).toBe(false);
  });
  it('does not derive a private grant from a foreign public run while preserving its account denial', async () => {
    mocks.publicTenant = 'organization-b'; mocks.accountFailure = 403; window.history.replaceState({}, '', route());
    render(<App />); await screen.findByText(metadata().ui.error_message);
    expect(screen.getByRole('heading', { name: rehearsal().ui.title })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Sí' })).toBeDisabled(); expect(posts()).toHaveLength(0);
    expectWidgetAbsent(); expectPrivateActorUnchanged();
  });
  it.each([404, 500])('keeps real metadata HTTP%s visible without adding global widget bootstrap', async status => {
    mocks.metadataFailure = status; render(<App />);
    expect(await screen.findByRole('alert')).toBeVisible(); expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver a consultar' })).toBeEnabled();
    expectWidgetAbsent(); expectPrivateActorUnchanged(); expect(posts()).toHaveLength(0);
  });
  it('exposes results failure and inhibits participation until another explicit successful read', async () => {
    render(<App />); await ready(); mocks.resultsFailure = 500;
    fireEvent.click(screen.getByRole('button', { name: rehearsal().ui.refresh_label }));
    expect(await screen.findByRole('alert')).toHaveTextContent(rehearsal().ui.error_message);
    expect(screen.getByRole('radio', { name: 'Sí' })).toBeDisabled(); expectWidgetAbsent(); expect(posts()).toHaveLength(0);
    mocks.resultsFailure = 0; fireEvent.click(screen.getByRole('button', { name: rehearsal().ui.refresh_label })); await ready();
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });
  it('preserves one response POST and reconciles uncertain transport through the same GET intent only', async () => {
    mocks.writeFailure = true; render(<App />); await ready();
    fireEvent.click(screen.getByRole('radio', { name: 'Sí' }));
    const submit = screen.getByRole('button', { name: rehearsal().ui.submit_label }); fireEvent.click(submit); fireEvent.click(submit);
    await screen.findByText(rehearsal().ui.uncertain_message); expect(posts()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: rehearsal().ui.check_status_label }));
    await screen.findByText(receipt().ui.label, { exact: false });
    expect(mocks.api).toHaveBeenCalledWith(apiBase() + `/respond/status?submission_id=${rehearsalKey}`, expect.objectContaining({ tenantSlug: rehearsalTenant }));
    expect(posts()).toHaveLength(1); expectWidgetAbsent(); expectPrivateActorUnchanged();
  });
  it('unmounts global widget on SPA entry and restores it on an adjacent public route', async () => {
    window.history.replaceState({}, '', '/'); render(<App />);
    await screen.findByTestId('global-widget'); expect(mocks.widgetMounts).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('link', { name: 'Synthetic open rehearsal' })); await ready();
    expect(screen.queryByTestId('global-widget')).not.toBeInTheDocument(); expect(mocks.widgetUnmounts).toHaveBeenCalledOnce();
    expect(posts()).toHaveLength(0); expectPrivateActorUnchanged();
    fireEvent.click(screen.getByRole('link', { name: 'Synthetic public home' })); await screen.findByTestId('global-widget');
    expect(mocks.widgetMounts).toHaveBeenCalledTimes(2); expect(posts()).toHaveLength(0);
  });
});
