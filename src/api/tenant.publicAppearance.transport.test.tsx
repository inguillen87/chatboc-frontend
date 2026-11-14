import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTenantPublicInfoFlexible } from '@/api/tenant';
import { TenantProvider, useTenant } from '@/context/TenantContext';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

// The canonical shared setup is loaded in full. Restore the real API and router;
// HTTP responses, startup readiness and visitor registration are synthetic.
const runtime = vi.hoisted(() => ({ ready: vi.fn(), anon: vi.fn() }));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/utils/backendBootstrapGate', async original => ({
  ...await original<typeof import('@/utils/backendBootstrapGate')>(),
  ensureBackendRuntimeReady: runtime.ready,
}));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: runtime.anon }));

const projection = (id: unknown = 22, slug = 'qa-a', primary = '#003366') => ({
  contract_version: 'organization.workspace_appearance.v1', tenant: { id, slug }, version: 1,
  appearance: { active: true, primary: { background: primary, foreground: '#FFFFFF' },
    accent: { background: '#FFCC00', foreground: '#000000' } },
});
const profile = (appearance: unknown = projection(), extra: Record<string, unknown> = {}) => ({
  contract_version: 'public.tenant_profile.v1',
  tenant: { id: 22, slug: 'qa-a', nombre: 'Espacio sintético A', tipo: 'gobierno', workspace_appearance: appearance, ...extra },
});
const response = (payload: unknown) => new Response(JSON.stringify(payload), {
  status: 200, headers: { 'Content-Type': 'application/json' },
});
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
type Read = { path: string; slug: string | null; method: string };
let reads: Read[];
let profileResponse: (slug: string | null) => Response | Promise<Response>;
let fetchFixture: ReturnType<typeof vi.fn>;
const profileReads = () => reads.filter(read => read.path.endsWith('/pwa/public/tenant-info'));
const primary = () => document.documentElement.style.getPropertyValue('--primary');

function Probe() {
  const { currentSlug, tenant, isLoadingTenant, tenantError } = useTenant();
  return <>
    <output data-testid="authority">{isLoadingTenant ? 'loading' : tenantError ? 'error' : 'ready'}:{currentSlug}:{tenant?.publishedIdentity?.tenantId ?? 'none'}:{tenant?.nombre ?? 'none'}</output>
    <Link to="/t/qa-b">Ver B</Link><Link to="/t/qa-a">Ver A</Link>
  </>;
}
const mount = () => render(<MemoryRouter initialEntries={['/t/qa-a']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
  <TenantProvider><Probe /></TenantProvider>
</MemoryRouter>);

beforeEach(() => {
  runtime.ready.mockReset().mockResolvedValue(undefined);
  runtime.anon.mockReset().mockResolvedValue('synthetic-public-visitor');
  reads = [];
  profileResponse = () => response(profile());
  safeLocalStorage.clear();
  useTenantStore.getState().clearTenant();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ entityToken: null, chatAuthToken: null });
  document.documentElement.removeAttribute('style');
  window.history.replaceState({}, '', '/t/qa-a');
  fetchFixture = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost');
    reads.push({ path: url.pathname, slug: url.searchParams.get('tenant'), method: init?.method ?? 'GET' });
    if (url.pathname.endsWith('/pwa/public/tenant-info')) return profileResponse(url.searchParams.get('tenant'));
    if (url.pathname.endsWith('/app/me/tenants')) return response([]);
    throw new Error(`Unexpected synthetic fixture path: ${url.pathname}`);
  });
  vi.stubGlobal('fetch', fetchFixture);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  safeLocalStorage.clear();
  useTenantStore.getState().clearTenant();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ entityToken: null, chatAuthToken: null });
  document.documentElement.removeAttribute('style');
  window.history.replaceState({}, '', '/');
});

describe('public appearance through real tenant API and normalization', () => {
  it('keeps profile22 but rejects palette33 with the same slug', async () => {
    profileResponse = () => response(profile(projection(33)));
    const info = await getTenantPublicInfoFlexible('qa-a');
    expect(info.publishedIdentity).toMatchObject({ tenantId: 22, tenantSlug: 'qa-a' });
    expect(info.nombre).toBe('Espacio sintético A');
    expect(info.workspace_appearance).toBeNull();
    expect(profileReads()).toEqual([{ path: profileReads()[0].path, slug: 'qa-a', method: 'GET' }]);
  });

  it('accepts an active palette only for the same published ID and slug', async () => {
    const info = await getTenantPublicInfoFlexible('qa-a');
    expect(info.publishedIdentity?.tenantId).toBe(22);
    expect(info.workspace_appearance).toEqual({ tenantSlug: 'qa-a', version: 1, primary: '#003366', accent: '#FFCC00' });
    expect(profileReads()).toHaveLength(1);
  });

  it.each([0, -1, '22', true])('rejects an invalid appearance ID %s without discarding the profile', async id => {
    profileResponse = () => response(profile(projection(id)));
    const info = await getTenantPublicInfoFlexible('qa-a');
    expect(info.publishedIdentity?.tenantId).toBe(22);
    expect(info.workspace_appearance).toBeNull();
    expect(profileReads()).toHaveLength(1);
  });

  it('keeps a generic profile without applying a palette when published identity is absent', async () => {
    profileResponse = () => response(profile(projection(), { id: undefined, nombre: '' }));
    const info = await getTenantPublicInfoFlexible('qa-a');
    expect(info.slug).toBe('qa-a');
    expect(info.publishedIdentity).toBeNull();
    expect(info.workspace_appearance).toBeNull();
    expect(profileReads()).toHaveLength(1);
  });

  it('rejects another palette slug while preserving the matching profile', async () => {
    profileResponse = () => response(profile(projection(22, 'qa-b')));
    const info = await getTenantPublicInfoFlexible('qa-a');
    expect(info.publishedIdentity?.tenantSlug).toBe('qa-a');
    expect(info.workspace_appearance).toBeNull();
  });

  it('preserves the existing rejection of an explicitly invalid profile ID', async () => {
    profileResponse = () => response(profile(projection(), { id: true }));
    await expect(getTenantPublicInfoFlexible('qa-a')).rejects.toMatchObject({ name: 'TenantProfileScopeError' });
    expect(profileReads()).toHaveLength(1);
  });

  it('keeps the current palette and identity after late A and B responses across A to B to A', async () => {
    const oldA = deferred<Response>(), oldB = deferred<Response>();
    let aReads = 0;
    profileResponse = slug => {
      if (slug === 'qa-b') return oldB.promise;
      aReads += 1;
      return aReads === 1 ? oldA.promise : response(profile(projection(), { nombre: 'A vigente' }));
    };
    const view = mount();
    await waitFor(() => expect(profileReads()).toHaveLength(1));
    expect(primary()).toBe('');
    fireEvent.click(screen.getByRole('link', { name: 'Ver B' }));
    await waitFor(() => expect(profileReads()).toHaveLength(2));
    expect(primary()).toBe('');
    fireEvent.click(screen.getByRole('link', { name: 'Ver A' }));
    await waitFor(() => expect(screen.getByTestId('authority')).toHaveTextContent('ready:qa-a:22:A vigente'));
    const currentPalette = primary();
    expect(currentPalette).not.toBe('');
    await act(async () => {
      oldA.resolve(response(profile(projection(33), { nombre: 'A retirado' })));
      oldB.resolve(response(profile(projection(33, 'qa-b', '#663399'), { id: 33, slug: 'qa-b', nombre: 'B retirado' })));
    });
    expect(screen.getByTestId('authority')).toHaveTextContent('ready:qa-a:22:A vigente');
    expect(primary()).toBe(currentPalette);
    expect(profileReads().map(read => read.slug)).toEqual(['qa-a', 'qa-b', 'qa-a']);
    expect(reads.every(read => read.method === 'GET')).toBe(true);
    view.unmount();
    expect(primary()).toBe('');
  });
});
