import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
import { node, reply, workspace } from '../../../tests/fixtures/institutional-assistant.synthetic';

// The page, reader, workspace parser and apiFetch are real. Only network,
// runtime readiness and the unrelated organization switcher are simulated.
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
const mocks = vi.hoisted(() => ({ ready: vi.fn(), anon: vi.fn() }));
vi.mock('@/utils/backendBootstrapGate', async original => ({ ...await original<typeof import('@/utils/backendBootstrapGate')>(), ensureBackendRuntimeReady: mocks.ready }));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(), API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: mocks.anon }));
vi.mock('@/components/tenant/TenantSwitcher', () => ({ TenantSwitcher: () => null }));

import { TenantProvider } from '@/context/TenantContext';
import TenantHomePage from './TenantHomePage';

const originalFetch = global.fetch;
const clients: QueryClient[] = [];
const publicSlug = 'qa-knowledge';
const otherSlug = 'qa-other';
const privateSlug = 'qa-private';
const genericDescription = 'Canales publicados por la organizacion para novedades, agenda, participacion y seguimiento.';
const deferred = <T,>() => { let resolve!: (value: T) => void; return { promise: new Promise<T>(r => { resolve = r; }), resolve }; };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const tenantId = (slug: string) => slug === publicSlug ? 701 : 702;
const tenantName = (slug: string) => `Espacio ${slug}`;
const publicWorkspace = (slug = publicSlug) => workspace({ tenant: { id: tenantId(slug), slug, name: tenantName(slug) }, visibility: 'public', can_edit: false });
const profile = (slug: string) => json({ contract_version: 'public.tenant_profile.v1', tenant: { id: tenantId(slug), slug, nombre: tenantName(slug), tipo: 'municipio' } });
const unavailable = () => json({ reason_code: 'knowledge_not_available' }, 404);
const knowledgeRequests = () => vi.mocked(global.fetch).mock.calls.filter(([input]) => new URL(String(input), window.location.origin).pathname.endsWith('/institutional-assistant'));

function transport(knowledge: (slug: string) => Response | Promise<Response>) {
  global.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = new URL(String(input), window.location.origin);
    if (url.pathname.endsWith('/app/me/tenants')) return Promise.resolve(json([]));
    if (url.pathname.includes('tenant-info')) return Promise.resolve(profile(url.searchParams.get('tenant')!));
    if (url.pathname.endsWith('/public-navigation')) return Promise.resolve(json({ contract_version: 'tenant.public_navigation.v1', tenant_slug: url.pathname.split('/').at(-2), items: [] }));
    if (url.pathname.endsWith('/institutional-assistant')) return Promise.resolve(knowledge(url.pathname.split('/').at(-2)!));
    if (url.pathname.includes('/institutional-assistant/nodes/')) {
      const slug = url.pathname.split('/').at(-4)!;
      return Promise.resolve(json(reply(decodeURIComponent(url.pathname.split('/').at(-1)!), publicWorkspace(slug))));
    }
    throw new Error(`Unexpected synthetic test endpoint: ${url.pathname}`);
  }) as typeof fetch;
}

function RouteControl() {
  const navigate = useNavigate();
  return <button onClick={() => navigate(`/t/${otherSlug}`)}>Ver otro espacio</button>;
}
function mountPortal() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/t/${publicSlug}`]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TenantProvider><RouteControl /><Routes><Route path="/t/:tenant" element={<TenantHomePage />} /></Routes></TenantProvider></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  mocks.ready.mockResolvedValue(undefined);
  mocks.anon.mockResolvedValue('synthetic-public-visitor');
  safeLocalStorage.clear();
  const user = { id: 901, rol: 'admin_municipio', tenant_slug: privateSlug, permissions: ['settings.tenant.write'] };
  usePanelSessionStore.setState({ authToken: 'synthetic-private-session', user: user as any });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  useTenantStore.getState().setTenant(privateSlug);
  safeLocalStorage.setItem('authToken', 'synthetic-private-session');
  safeLocalStorage.setItem('user', JSON.stringify(user));
  window.history.replaceState({}, '', `/t/${publicSlug}`);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
  global.fetch = originalFetch;
  vi.restoreAllMocks();
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  useTenantStore.getState().clearTenant();
  window.history.replaceState({}, '', '/');
});

describe('published institutional reading comes before the generic public overview', () => {
  it('uses one validated reader request and one heading while preserving the independent private panel', async () => {
    const pending = deferred<Response>();
    transport(() => pending.promise);
    const privateUser = safeLocalStorage.getItem('user');
    mountPortal();
    await waitFor(() => expect(knowledgeRequests()).toHaveLength(1));
    expect(screen.getByText(genericDescription)).toBeInTheDocument();
    act(() => { usePanelSessionStore.setState({ authToken: 'synthetic-refreshed-session' }); safeLocalStorage.setItem('authToken', 'synthetic-refreshed-session'); });
    await act(async () => { pending.resolve(json(publicWorkspace())); });
    const reader = await screen.findByTestId('institutional-assistant');
    await waitFor(() => expect(screen.queryByText(genericDescription)).not.toBeInTheDocument());
    const heading = screen.getByRole('heading', { level: 1, name: tenantName(publicSlug) });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(heading.compareDocumentPosition(reader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(reader.compareDocumentPosition(screen.getByText('Este espacio todavia no publico canales visibles.')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(knowledgeRequests()).toHaveLength(1);
    expect(safeLocalStorage.getItem('tenantSlug')).toBe(privateSlug);
    expect(useTenantStore.getState().slug).toBe(privateSlug);
    expect(safeLocalStorage.getItem('user')).toBe(privateUser);
    expect(usePanelSessionStore.getState().user?.id).toBe(901);
    expect(usePanelSessionStore.getState().authToken).toBe('synthetic-refreshed-session');
    for (const [input, init] of vi.mocked(global.fetch).mock.calls) {
      const url = new URL(String(input), window.location.origin);
      if (url.pathname.endsWith('/app/me/tenants')) continue;
      expect(url.searchParams.get('tenant')).toBe(publicSlug);
      expect(url.searchParams.get('tenant_slug')).toBe(publicSlug);
      expect(new Headers(init?.headers).has('Authorization')).toBe(false);
      expect(new Headers(init?.headers).has('X-Entity-Token')).toBe(false);
      expect(new Headers(init?.headers).has('X-Chat-Session')).toBe(false);
      expect(init?.credentials).toBe('omit');
      expect(init?.method ?? 'GET').toBe('GET');
    }
  });

  it('keeps the reader instance, draft and keyboard result after the availability layout update', async () => {
    transport(slug => json(publicWorkspace(slug)));
    mountPortal();
    const input = await screen.findByLabelText('Escribí tu consulta');
    await waitFor(() => expect(screen.queryByText(genericDescription)).not.toBeInTheDocument());
    const reader = screen.getByTestId('institutional-assistant');
    fireEvent.change(input, { target: { value: 'Borrador explícito del visitante sintético' } });
    const topic = screen.getByRole('button', { name: 'Consultar requisitos' });
    topic.focus();
    fireEvent.click(topic);
    const result = await screen.findByRole('heading', { name: node('requirements').title });
    await waitFor(() => expect(result).toHaveFocus());
    expect(screen.getByLabelText('Escribí tu consulta')).toBe(input);
    expect(screen.getByTestId('institutional-assistant')).toBe(reader);
    expect(input).toHaveValue('Borrador explícito del visitante sintético');
    expect(knowledgeRequests()).toHaveLength(1);
    expect(vi.mocked(global.fetch).mock.calls.filter(([input]) => String(input).includes('/nodes/requirements'))).toHaveLength(1);
  });

  it('preserves the generic overview for the exact legacy unavailable contract', async () => {
    transport(unavailable);
    mountPortal();
    await screen.findByText('No pudimos cargar el conocimiento');
    expect(screen.getByText(genericDescription)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1, name: tenantName(publicSlug) })).toHaveLength(2);
    expect(screen.queryByTestId('institutional-assistant')).not.toBeInTheDocument();
    expect(knowledgeRequests()).toHaveLength(1);
  });

  it.each([
    ['another organization', () => publicWorkspace(otherSlug)],
    ['editable public metadata', () => ({ ...publicWorkspace(), can_edit: true })],
    ['unverifiable revision', () => ({ ...publicWorkspace(), revision: 'not-a-revision' })],
  ])('does not compact the page for %s', async (_label, invalid) => {
    transport(() => json(invalid()));
    mountPortal();
    await screen.findByText('No pudimos cargar el conocimiento');
    expect(screen.getByText(genericDescription)).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1, name: tenantName(publicSlug) })).toHaveLength(2);
    expect(screen.queryByTestId('institutional-assistant')).not.toBeInTheDocument();
    expect(knowledgeRequests()).toHaveLength(1);
  });

  it.each([false, true])('ignores the late former organization with next published=%s', async (nextPublished) => {
    const pending = deferred<Response>();
    transport(slug => slug === publicSlug ? pending.promise : nextPublished ? json(publicWorkspace(otherSlug)) : unavailable());
    mountPortal();
    await waitFor(() => expect(knowledgeRequests()).toHaveLength(1));
    await act(async () => { screen.getByRole('button', { name: 'Ver otro espacio' }).click(); });
    await screen.findAllByRole('heading', { level: 1, name: tenantName(otherSlug) });
    if (nextPublished) await waitFor(() => expect(screen.queryByText(genericDescription)).not.toBeInTheDocument());
    else await screen.findByText('No pudimos cargar el conocimiento');
    await act(async () => { pending.resolve(json(publicWorkspace())); });
    expect(screen.getAllByRole('heading', { level: 1, name: tenantName(otherSlug) })).toHaveLength(nextPublished ? 1 : 2);
    expect(screen.queryByRole('heading', { level: 1, name: tenantName(publicSlug) })).not.toBeInTheDocument();
    expect(Boolean(screen.queryByText(genericDescription))).toBe(!nextPublished);
    expect(knowledgeRequests()).toHaveLength(2);
    expect(useTenantStore.getState().slug).toBe(privateSlug);
    expect(usePanelSessionStore.getState().user?.tenant_slug).toBe(privateSlug);
  });
});
