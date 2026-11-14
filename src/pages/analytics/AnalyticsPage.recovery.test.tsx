import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsPage from '@/pages/analytics/AnalyticsPage';
import { SessionAuthorityProvider } from '@/components/access/SessionAuthorityContext';
import { usePanelSessionStore, useTenantStore } from '@/stores';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

// Restore the real router and API against the canonical shared setup.
// Identity/HTTP remain synthetic; shared setup still stubs decorative icons,
// toast and file parsers. Those implementations are not verified by this suite.
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
const identity = vi.hoisted(() => ({ user: {} as Record<string, unknown>, verified: true }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: identity.user, loading: false,
  hasVerifiedSession: identity.verified, organizationProfileVerified: identity.verified }) }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({
  tenant: { id: 22, slug: 'junin', tipo: 'municipio' }, isLoadingTenant: false, tenantError: null,
}) }));

type Read = { path: string; search: URLSearchParams; method: string; tenant: string | null };
let reads: Read[];
let fetchFixture: ReturnType<typeof vi.fn>;
const contextError = () => new Response(JSON.stringify({ error: 'tenant context is invalid for scope' }),
  { status: 400, headers: { 'Content-Type': 'application/json' } });
const hubReads = () => reads.filter(read => /\/analytics\/hub$/.test(read.path));
const summaryReads = () => reads.filter(read => /\/analytics\/overview$/.test(read.path));
const Location = () => <output data-testid="location">{useLocation().search}</output>;
const mount = (search = '?tab=analytics&tenant_slug=junin&range=30d&canal=whatsapp&categoria=arbolado&distrito=centro&keep=preserved') =>
  render(<MemoryRouter initialEntries={[`/perfil${search}`]}>
    <SessionAuthorityProvider value={{ clerkStatus: 'disabled', hasBearerSession: true, hasVerifiedSession: true }}>
      <AnalyticsPage /><Location />
    </SessionAuthorityProvider>
  </MemoryRouter>);

describe('analytics contextual-error recovery with real page and client', () => {
  beforeEach(() => {
    reads = [];
    localStorage.clear();
    advanceChatbocSessionRevision();
    identity.verified = true;
    identity.user = { id: 'synthetic-actor', rol: 'admin_municipio', tipo_chat: 'municipio', tenant_slug: 'junin',
      organization_profile: { tenant: { id: 22, slug: 'junin' } } };
    usePanelSessionStore.getState().setAuthToken('synthetic-only-not-a-credential');
    usePanelSessionStore.getState().setUser(identity.user as any);
    useTenantStore.getState().setTenant('junin');
    fetchFixture = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost');
      reads.push({ path: url.pathname, search: url.searchParams, method: init?.method ?? 'GET', tenant: new Headers(init?.headers).get('X-Tenant-Slug') });
      if (/\/analytics\/hub$/.test(url.pathname)) return contextError();
      if (/\/analytics\/realtime-hub$/.test(url.pathname)) return new Response(JSON.stringify({ ui: { labels: {} }, totals: {} }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
      throw new Error(`Unexpected synthetic HTTP fixture path: ${url.pathname}`);
    });
    vi.stubGlobal('fetch', fetchFixture);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('keeps existing filters reachable after a deterministic context 400 without fabricating analytics', async () => {
    mount();
    await screen.findByText('La solicitud es inválida.');
    expect(hubReads()).toHaveLength(1);
    expect(summaryReads()).toHaveLength(0);
    expect(hubReads()[0].search.get('scope')).toBe('municipio');
    expect(hubReads()[0].search.get('tenant_profile_id')).toBe('22');
    expect(hubReads()[0].tenant).toBe('junin');
    expect(reads.every(read => read.method === 'GET')).toBe(true);
    const params = new URLSearchParams(screen.getByTestId('location').textContent ?? '');
    expect(params.get('canal')).toBe('whatsapp');
    expect(params.get('categoria')).toBe('arbolado');
    expect(params.get('distrito')).toBe('centro');
    expect(params.get('keep')).toBe('preserved');
    expect(screen.queryByText('Total de interacciones')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Filtros del resumen' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Período del resumen' })).toBeEnabled();
  });

  it('only retries after the explicit existing action and keeps the same verified authority and filters', async () => {
    mount();
    const retry = await screen.findByRole('button', { name: 'Reintentar' });
    expect(hubReads()).toHaveLength(1);
    fireEvent.click(retry);
    await waitFor(() => expect(hubReads()).toHaveLength(2));
    await screen.findByRole('button', { name: 'Reintentar' });
    expect(summaryReads()).toHaveLength(0);
    expect(hubReads().map(read => ({ path: read.path, scope: read.search.get('scope'),
      profile: read.search.get('tenant_profile_id'), category: read.search.get('categoria') }))).toEqual([
      { path: hubReads()[0].path, scope: 'municipio', profile: '22', category: 'arbolado' },
      { path: hubReads()[0].path, scope: 'municipio', profile: '22', category: 'arbolado' },
    ]);
  });

  it('canonicalizes an incompatible URL scope from verified identity without trying another organization kind', async () => {
    mount('?tab=analytics&tenant_slug=junin&scope=pyme&range=7d');
    await screen.findByRole('button', { name: 'Reintentar' });
    expect(hubReads()).toHaveLength(1);
    expect(hubReads()[0].search.get('scope')).toBe('municipio');
    expect(new URLSearchParams(screen.getByTestId('location').textContent ?? '').get('scope')).toBe('municipio');
    expect(reads.every(read => read.search.get('scope') !== 'pyme')).toBe(true);
    expect(summaryReads()).toHaveLength(0);
  });

  it('rejects a foreign organization selection before any transport', async () => {
    mount('?tab=analytics&tenant_slug=foreign&range=7d');
    await screen.findByText('Seleccioná una organización');
    expect(reads).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });

  it('does not restore a delayed context error after session authority has been retired', async () => {
    let resolveHub!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { resolveHub = resolve; });
    fetchFixture.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost');
      reads.push({ path: url.pathname, search: url.searchParams, method: init?.method ?? 'GET', tenant: new Headers(init?.headers).get('X-Tenant-Slug') });
      return /\/analytics\/hub$/.test(url.pathname) ? pending : new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const first = mount();
    await waitFor(() => expect(hubReads()).toHaveLength(1));
    advanceChatbocSessionRevision(); identity.verified = false;
    first.unmount(); mount();
    await screen.findByText('Seleccioná una organización');
    resolveHub(contextError());
    await waitFor(() => expect(screen.queryByText('La solicitud es inválida.')).not.toBeInTheDocument());
    expect(summaryReads()).toHaveLength(0);
    expect(hubReads()).toHaveLength(1);
  });
  it('keeps the context alert and disables exports/AI without starting secondary readers', async () => {
    mount();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('La solicitud es inválida.');
    expect(screen.getByRole('region', { name: 'Filtros del resumen' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Período del resumen' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeEnabled();
    const csv = screen.getByRole('button', { name: 'Export CSV', hidden: true });
    const pdf = screen.getByRole('button', { name: 'Export PDF', hidden: true });
    const ai = screen.getByRole('button', { name: 'Resumen ejecutivo IA', hidden: true });
    expect(csv).toBeDisabled(); expect(pdf).toBeDisabled(); expect(ai).toBeDisabled();
    fireEvent.click(csv); fireEvent.click(pdf); fireEvent.click(ai);
    await waitFor(() => expect(reads).toHaveLength(2));
    expect(hubReads()).toHaveLength(1); expect(summaryReads()).toHaveLength(0);
    expect(reads.every(read => /\/analytics\/(?:hub|realtime-hub)$/.test(read.path))).toBe(true);
    expect(reads.every(read => read.method === 'GET' && read.tenant === 'junin')).toBe(true);
    expect(hubReads()[0].search.get('tenant_profile_id')).toBe('22');
    expect(hubReads()[0].search.get('scope')).toBe('municipio');
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    expect(screen.queryByText('Total de interacciones')).not.toBeInTheDocument();
  });

});
