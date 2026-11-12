import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClerkAuthBridge from './ClerkAuthBridge';
import { ClerkRuntimeProvider } from './ClerkRuntimeContext';
import { UserProvider } from '@/hooks/useUser';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import { safeLocalStorage, safeSessionStorage } from '@/utils/safeLocalStorage';
import { clearLocalChatbocSession } from '@/utils/sessionLogout';
import { resetBackendBootstrapGateForTests } from '@/utils/backendBootstrapGate';

// Product bridge, UserProvider, exchange client, apiFetch, continuity, stores and
// persistence are real. Only SDK identity, configuration and HTTP are fixtures.
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api',
}));
const sdk = vi.hoisted(() => ({
  auth: { isLoaded: true, isSignedIn: true, sessionId: 'synthetic-sdk-session-a', getToken: vi.fn() },
  user: { id: 'synthetic-sdk-a', firstName: 'Synthetic', lastName: 'Operator',
    updatedAt: new Date('2026-01-01T00:00:00Z'), emailAddresses: [], phoneNumbers: [], externalAccounts: [] },
}));
vi.mock('@clerk/clerk-react', () => ({ useAuth: () => sdk.auth, useUser: () => ({ user: sdk.user }) }));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};
const sessionResponse = (actor = 101) => new Response(JSON.stringify({
  contract_version: 'auth.clerk.v1', auth_provider: 'clerk', token: null, session_transport: 'cookie',
  user: { id: actor, name: 'Synthetic operator', rol: 'superadmin', tipo_chat: 'municipio',
    rubro: 'municipio', tenant_slug: 'synthetic-private-office' }, onboarding: { required: false },
}), { headers: { 'Content-Type': 'application/json' } });
const profileResponse = (actor = 101) => new Response(JSON.stringify({
  id: actor, name: 'Synthetic operator', rol: 'superadmin', tipo_chat: 'municipio',
  rubro: 'municipio', tenant_slug: 'synthetic-private-office',
}), { headers: { 'Content-Type': 'application/json' } });
const ready = vi.fn();
const NavigationFixture = () => {
  const location = useLocation();
  const navigate = useNavigate();
  React.useEffect(() => {
    if (location.pathname !== '/demo') return;
    // Public presentation initialization can change these actual global stores
    // while the independent Clerk SDK exchange remains pending.
    safeLocalStorage.setItem('tenantSlug', 'synthetic-public-demo');
    useWidgetSessionStore.getState().setChatAuthToken('synthetic-widget-token');
  }, [location.pathname]);
  return <><button onClick={() => navigate('/demo')}>Ver demo fixture</button>
    <div data-testid="route">{location.pathname}</div></>;
};
const tree = () => <UserProvider><BrowserRouter><ClerkRuntimeProvider value={{
  enabled: true, loading: false, publishableKey: 'pk_test_synthetic', source: 'backend', socialProviders: ['google'],
}}><ClerkAuthBridge onSessionReady={ready}/><NavigationFixture/></ClerkRuntimeProvider></BrowserRouter></UserProvider>;
const jsonPath = (input: RequestInfo | URL) => new URL(String(input), window.location.origin).pathname;
let exchanges: Array<ReturnType<typeof deferred<Response>>>;
let requests: Array<{ path: string; init?: RequestInit }>;
let failNext: unknown;
beforeEach(() => {
  cleanup(); safeSessionStorage.clear(); safeLocalStorage.clear(); clearLocalChatbocSession();
  resetBackendBootstrapGateForTests(); window.history.replaceState({}, '', '/');
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  sdk.auth.isLoaded = true; sdk.auth.isSignedIn = true; sdk.auth.sessionId = 'synthetic-sdk-session-a';
  sdk.auth.getToken.mockReset().mockResolvedValue('synthetic-sdk-token');
  sdk.user = { ...sdk.user, id: 'synthetic-sdk-a' };
  ready.mockReset(); exchanges = []; requests = []; failNext = undefined;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = jsonPath(input); requests.push({ path, init });
    if (path.endsWith('/auth/clerk/session')) {
      if (failNext) {
        const failure = failNext; failNext = undefined;
        return failure instanceof Response ? Promise.resolve(failure) : Promise.reject(failure);
      }
      const pending = deferred<Response>(); exchanges.push(pending); return pending.promise;
    }
    if (path === '/api/me') return Promise.resolve(profileResponse(sdk.user.id.endsWith('-b') ? 202 : 101));
    throw new Error(`Unexpected fixture request: ${path}`);
  }));
});
afterEach(() => {
  cleanup(); clearLocalChatbocSession(); safeLocalStorage.clear(); safeSessionStorage.clear();
  resetBackendBootstrapGateForTests(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

describe('real Clerk exchange during public navigation', () => {
  it('finishes the current SDK exchange after navigation changes public tenant and widget state', async () => {
    render(tree()); await waitFor(() => expect(exchanges).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Ver demo fixture' }));
    expect(screen.getByTestId('route')).toHaveTextContent('/demo');
    await act(async () => { exchanges[0].resolve(sessionResponse()); });
    await waitFor(() => expect(ready).toHaveBeenCalledOnce());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(usePanelSessionStore.getState().user?.id).toBe(101);
    expect(requests.filter(item => item.path.endsWith('/auth/clerk/session'))).toHaveLength(1);
    const headers = new Headers(requests.find(item => item.path.endsWith('/auth/clerk/session'))!.init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer synthetic-sdk-token');
    expect(headers.get('X-Tenant-Slug')).toBeNull();
    expect(headers.get('X-Entity-Token')).toBeNull();
    expect(headers.get('X-Chat-Session-Id')).toBeNull();
  });

  it('does not accept a delayed SDK exchange after local session revision retirement', async () => {
    render(tree()); await waitFor(() => expect(exchanges).toHaveLength(1));
    act(() => { clearLocalChatbocSession(); });
    await act(async () => { exchanges[0].resolve(sessionResponse()); });
    expect(ready).not.toHaveBeenCalled();
    expect(usePanelSessionStore.getState().user).toBeNull();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(requests.filter(item => item.path.endsWith('/auth/clerk/session'))).toHaveLength(1);
  });

  it('does not accept the former SDK identity after a new identity starts syncing', async () => {
    const view = render(tree()); await waitFor(() => expect(exchanges).toHaveLength(1));
    sdk.user = { ...sdk.user, id: 'synthetic-sdk-b' }; sdk.auth.sessionId = 'synthetic-sdk-session-b';
    view.rerender(tree()); await waitFor(() => expect(exchanges).toHaveLength(2));
    await act(async () => { exchanges[0].resolve(sessionResponse()); });
    expect(ready).not.toHaveBeenCalled(); expect(usePanelSessionStore.getState().user).toBeNull();
    await act(async () => { exchanges[1].resolve(sessionResponse(202)); });
    await waitFor(() => expect(ready).toHaveBeenCalledWith('synthetic-sdk-b:synthetic-sdk-session-b'));
    expect(usePanelSessionStore.getState().user?.id).toBe(202);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ignores a retired result after unmount without persisting or reporting success', async () => {
    const view = render(tree()); await waitFor(() => expect(exchanges).toHaveLength(1));
    view.unmount(); await act(async () => { exchanges[0].resolve(sessionResponse()); });
    expect(ready).not.toHaveBeenCalled(); expect(usePanelSessionStore.getState().user).toBeNull();
  });

  it('keeps a genuine current transport abort visible and retries only after explicit action', async () => {
    failNext = new DOMException('Synthetic transport abort', 'AbortError'); render(tree());
    expect(await screen.findByRole('alert')).toHaveTextContent('El acceso se interrumpió');
    expect(ready).not.toHaveBeenCalled(); expect(exchanges).toHaveLength(0);
    expect(requests.filter(item => item.path.endsWith('/auth/clerk/session'))).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(exchanges).toHaveLength(1));
    await act(async () => { exchanges[0].resolve(sessionResponse()); });
    await waitFor(() => expect(ready).toHaveBeenCalledOnce());
    expect(requests.filter(item => item.path.endsWith('/auth/clerk/session'))).toHaveLength(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps an actual current HTTP denial visible without accepting a session or automatic retry', async () => {
    failNext = new Response(JSON.stringify({ error: 'Acceso denegado sintético' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
    render(tree());
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso denegado sintético');
    expect(ready).not.toHaveBeenCalled(); expect(usePanelSessionStore.getState().user).toBeNull();
    expect(requests.filter(item => item.path.endsWith('/auth/clerk/session'))).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
