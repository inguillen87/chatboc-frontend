import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';

vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
const mocks = vi.hoisted(() => ({ ready: vi.fn(), anon: vi.fn() }));
vi.mock('@/utils/backendBootstrapGate', async original => ({ ...await original<typeof import('@/utils/backendBootstrapGate')>(), ensureBackendRuntimeReady: mocks.ready }));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(), API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: mocks.anon }));
vi.mock('@/api/tenant', async original => await original<typeof import('@/api/tenant')>());
vi.mock('@/components/tenant/TenantSwitcher', () => ({ TenantSwitcher: () => null }));
vi.mock('@/components/knowledge/InstitutionalAssistant', () => ({ default: ({ tenantSlug }: { tenantSlug: string }) => <output>assistant:{tenantSlug}</output> }));

import { TenantProvider } from '@/context/TenantContext';
import TenantHomePage from './TenantHomePage';
import { getTenantPublicNavigation } from '@/api/tenant';

const originalFetch = global.fetch;
const deferred = <T,>() => { let resolve!: (value: T) => void; return { promise: new Promise<T>(r => { resolve = r; }), resolve: (value: T) => resolve(value) }; };
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const profile = (slug: string) => json({ contract_version: 'public.tenant_profile.v1', tenant: { id: slug === 'tierra-del-fuego' ? 46 : 22, slug, nombre: `Espacio ${slug}`, tipo: 'municipio' } });
const navigation = (slug: string) => json({ contract_version: 'tenant.public_navigation.v1', tenant_slug: slug, items: [] });
const urls = () => vi.mocked(global.fetch).mock.calls.map(([url]) => new URL(String(url), window.location.origin));

function RouteControl() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/t/junin')}>Ver otro espacio</button>;
}
function mountPortal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/t/tierra-del-fuego']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TenantProvider><RouteControl /><Routes><Route path="/t/:tenant" element={<TenantHomePage />} /></Routes></TenantProvider></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  mocks.ready.mockResolvedValue(undefined);
  mocks.anon.mockResolvedValue('synthetic-visitor');
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: 'synthetic-private-session', user: { id: 4, rol: 'admin_municipio', tenant_slug: 'junin' } as any });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  useTenantStore.getState().setTenant('junin');
  safeLocalStorage.setItem('authToken', 'synthetic-private-session');
  safeLocalStorage.setItem('user', JSON.stringify({ id: 4, rol: 'admin_municipio', tenant_slug: 'junin', permissions: ['settings.tenant.write'] }));
  window.history.replaceState({}, '', '/t/tierra-del-fuego');
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  useTenantStore.getState().clearTenant();
  window.history.replaceState({}, '', '/');
});

describe('public portal with an independently authenticated private organization', () => {
  it('loads the URL organization while the private Junín session refreshes, without changing its selection', async () => {
    const pending = deferred<Response>();
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname.endsWith('/app/me/tenants')) return Promise.resolve(json([]));
      return url.pathname.includes('tenant-info') ? pending.promise : Promise.resolve(navigation(url.pathname.split('/').at(-2)!));
    }) as typeof fetch;
    const privateUser = safeLocalStorage.getItem('user');
    mountPortal();
    await waitFor(() => expect(urls().some(url => url.pathname.includes('tenant-info'))).toBe(true));
    // A real /me/session refresh belongs to the private panel, not this anonymous read.
    act(() => { usePanelSessionStore.setState({ authToken: 'synthetic-refreshed-session' }); safeLocalStorage.setItem('authToken', 'synthetic-refreshed-session'); safeLocalStorage.setItem('tenantSlug', 'junin'); });
    await act(async () => { pending.resolve(profile('tierra-del-fuego')); });
    expect((await screen.findAllByRole('heading', { level: 1, name: 'Espacio tierra-del-fuego' }))[0]).toBeInTheDocument();
    expect(screen.getByText('assistant:tierra-del-fuego')).toBeInTheDocument();
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('junin');
    expect(useTenantStore.getState().slug).toBe('junin');
    expect(safeLocalStorage.getItem('user')).toBe(privateUser);
    expect(usePanelSessionStore.getState().user?.id).toBe(4);
    expect(usePanelSessionStore.getState().authToken).toBe('synthetic-refreshed-session');
    for (const [input, init] of vi.mocked(global.fetch).mock.calls) {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname.endsWith('/app/me/tenants')) {
        expect(url.searchParams.has('tenant')).toBe(false);
        expect(url.searchParams.has('tenant_slug')).toBe(false);
        expect(new Headers(init?.headers).has('X-Tenant-Slug')).toBe(false);
        expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer synthetic-private-session');
        expect(init?.credentials).toBe('include');
        continue;
      }
      expect(url.searchParams.get('tenant')).toBe('tierra-del-fuego');
      expect(url.searchParams.get('tenant_slug')).toBe('tierra-del-fuego');
      expect(new Headers(init?.headers).has('Authorization')).toBe(false);
      expect(new Headers(init?.headers).has('X-Entity-Token')).toBe(false);
      expect(new Headers(init?.headers).has('X-Chat-Session')).toBe(false);
      expect(init?.credentials).toBe('omit');
    }
  });

  it('does not adopt a late public profile after navigation to another organization', async () => {
    const pending = deferred<Response>();
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname.endsWith('/app/me/tenants')) return Promise.resolve(json([]));
      if (url.pathname.includes('tenant-info')) return url.searchParams.get('tenant') === 'tierra-del-fuego' ? pending.promise : Promise.resolve(profile('junin'));
      return Promise.resolve(navigation(url.pathname.split('/').at(-2)!));
    }) as typeof fetch;
    mountPortal();
    await waitFor(() => expect(urls().some(url => url.pathname.includes('tenant-info'))).toBe(true));
    await act(async () => { screen.getByRole('button', { name: 'Ver otro espacio' }).click(); });
    expect((await screen.findAllByRole('heading', { level: 1, name: 'Espacio junin' }))[0]).toBeInTheDocument();
    await act(async () => { pending.resolve(profile('tierra-del-fuego')); });
    expect(screen.getAllByRole('heading', { level: 1, name: 'Espacio junin' })[0]).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Espacio tierra-del-fuego' })).not.toBeInTheDocument();
    expect(screen.getByText('assistant:junin')).toBeInTheDocument();
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('junin');
  });

  it('keeps explicit public reads retired when their own caller scope ends', async () => {
    const pending = deferred<Response>();
    global.fetch = vi.fn().mockReturnValue(pending.promise);
    let current = true;
    const { apiFetch } = await import('@/utils/api');
    const read = apiFetch('/api/public/tenants/tierra-del-fuego/public-navigation', { tenantSlug: 'tierra-del-fuego', skipAuth: true, omitCredentials: true, isWidgetRequest: true, omitChatSessionId: true, omitEntityToken: true, persistTenantSlug: false, isCurrent: () => current });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    current = false;
    const response = navigation('tierra-del-fuego');
    const body = vi.spyOn(response, 'text');
    pending.resolve(response);
    await expect(read).rejects.toMatchObject({ name: 'AbortError' });
    expect(body).not.toHaveBeenCalled();
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('junin');
  });

  it('rejects a public navigation contract that names another organization', async () => {
    global.fetch = vi.fn().mockResolvedValue(navigation('junin'));
    await expect(getTenantPublicNavigation('tierra-del-fuego')).rejects.toThrow();
  });

  it('keeps anonymous mutations bound to their original session without replay', async () => {
    const pending = deferred<Response>();
    global.fetch = vi.fn().mockReturnValue(pending.promise);
    const { apiFetch } = await import('@/utils/api');
    const write = apiFetch('/api/public/tenants/tierra-del-fuego/example', { method: 'POST', body: { value: 'synthetic' }, tenantSlug: 'tierra-del-fuego', skipAuth: true, omitCredentials: true, isWidgetRequest: true, omitChatSessionId: true, omitEntityToken: true, persistTenantSlug: false, singleAttempt: true });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    usePanelSessionStore.setState({ authToken: 'synthetic-other-session' });
    const response = json({ ok: true });
    const body = vi.spyOn(response, 'text');
    pending.resolve(response);
    await expect(write).rejects.toMatchObject({ name: 'AbortError' });
    expect(body).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledOnce();
  });
});
