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
const deferred = <T,>() => { let resolve!: (value: T) => void; return { promise: new Promise<T>(r => { resolve = r; }), resolve }; };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const tenantId = (slug: string) => slug === publicSlug ? 701 : 702;
const tenantName = (slug: string) => `Espacio ${slug}`;
const publicWorkspace = (slug = publicSlug) => workspace({ tenant: { id: tenantId(slug), slug, name: tenantName(slug) }, visibility: 'public', can_edit: false });
const profile = (slug: string) => json({ contract_version: 'public.tenant_profile.v1', tenant: { id: tenantId(slug), slug, nombre: tenantName(slug), tipo: 'municipio', logo_url: `/branding/${slug}.png` } });
const unavailable = () => json({ reason_code: 'knowledge_not_available' }, 404);
const knowledgeRequests = () => vi.mocked(global.fetch).mock.calls.filter(([input]) => new URL(String(input), window.location.origin).pathname.endsWith('/institutional-assistant'));

function transport(knowledge: (slug: string) => Response | Promise<Response>) {
  global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), window.location.origin);
    if (url.pathname.endsWith('/app/me/tenants')) return Promise.resolve(json([]));
    if (url.pathname.includes('tenant-info')) return Promise.resolve(profile(url.searchParams.get('tenant')!));
    if (url.pathname.endsWith('/public-navigation')) return Promise.resolve(json({ contract_version: 'tenant.public_navigation.v1', tenant_slug: url.pathname.split('/').at(-2), items: [] }));
    if (url.pathname.endsWith('/institutional-assistant/answer')) {
      const slug = url.pathname.split('/').at(-3)!;
      const body = JSON.parse(String(init?.body ?? '{}')) as { node_id?: string; question?: string };
      return Promise.resolve(json({
        ...reply('requirements', publicWorkspace(slug)),
        text: body.question ? node('requirements').text : '',
      }));
    }
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

describe('published institutional assistant in the public services home', () => {
  it('uses one validated workspace request and one page heading while preserving the independent private panel', async () => {
    const pending = deferred<Response>();
    transport(() => pending.promise);
    const privateUser = safeLocalStorage.getItem('user');
    mountPortal();
    await waitFor(() => expect(knowledgeRequests()).toHaveLength(1));
    expect(screen.getAllByRole('heading', { level: 1, name: tenantName(publicSlug) })).toHaveLength(1);
    act(() => { usePanelSessionStore.setState({ authToken: 'synthetic-refreshed-session' }); safeLocalStorage.setItem('authToken', 'synthetic-refreshed-session'); });
    await act(async () => { pending.resolve(json(publicWorkspace())); });
    const reader = await screen.findByTestId('institutional-assistant');
    expect(reader).toHaveClass('institutional-assistant--services');
    expect(reader.querySelector('.institutional-assistant__mark')).toBeNull();
    expect(screen.getByRole('img', { name: `Logo de ${tenantName(publicSlug)}` })).toHaveAttribute('src', `/branding/${publicSlug}.png`);
    const heading = screen.getByRole('heading', { level: 1, name: tenantName(publicSlug) });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(heading.compareDocumentPosition(reader) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Este espacio todavía no publicó canales visibles.')).not.toBeInTheDocument();
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
    const reader = screen.getByTestId('institutional-assistant');
    fireEvent.change(input, { target: { value: 'Borrador explícito del visitante sintético' } });
    const topic = screen.getByRole('button', { name: '1 Consultar requisitos' });
    topic.focus();
    fireEvent.click(topic);
    const result = await screen.findByRole('heading', { name: node('requirements').title });
    await waitFor(() => expect(result).toHaveFocus());
    // The search moves above the topics on the services home, so its field may be a new node; the reader and the draft are what must survive.
    expect(screen.getByTestId('institutional-assistant')).toBe(reader);
    expect(screen.getByLabelText('Escribí tu consulta')).toHaveValue('Borrador explícito del visitante sintético');
    expect(knowledgeRequests()).toHaveLength(1);
    expect(vi.mocked(global.fetch).mock.calls.filter(([input]) => String(input).includes('/nodes/requirements'))).toHaveLength(1);
  });

  it('submits the services search through the existing public assistant POST exactly once', async () => {
    transport(slug => json(publicWorkspace(slug)));
    mountPortal();
    const input = await screen.findByLabelText('Escribí tu consulta');
    const reader = screen.getByTestId('institutional-assistant');
    expect(reader).toHaveClass('institutional-assistant--services');
    const firstTopic = screen.getByRole('button', { name: '1 Consultar requisitos' });
    expect(input.compareDocumentPosition(firstTopic) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.change(input, { target: { value: '¿Qué documentos necesito?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));

    expect(await screen.findByRole('heading', { name: node('requirements').title })).toBeVisible();
    const answerPosts = vi.mocked(global.fetch).mock.calls.filter(([request]) =>
      new URL(String(request), window.location.origin).pathname.endsWith('/institutional-assistant/answer'));
    expect(answerPosts).toHaveLength(1);
    expect(answerPosts[0][1]?.method).toBe('POST');
    expect(JSON.parse(String(answerPosts[0][1]?.body))).toMatchObject({
      node_id: 'start',
      question: '¿Qué documentos necesito?',
      revision: publicWorkspace().revision,
    });
  });

  it('keeps a neutral services home when the organization has no published assistant', async () => {
    const pending = deferred<Response>();
    transport(() => pending.promise);
    mountPortal();
    await waitFor(() => expect(knowledgeRequests()).toHaveLength(1));
    await act(async () => { pending.resolve(unavailable()); });
    await waitFor(() => expect(screen.queryByText('Cargando conocimiento')).not.toBeInTheDocument());
    expect(screen.getAllByRole('heading', { level: 1, name: tenantName(publicSlug) })).toHaveLength(1);
    expect(screen.queryByText('No pudimos cargar el conocimiento')).not.toBeInTheDocument();
    expect(screen.queryByTestId('institutional-assistant')).not.toBeInTheDocument();
    expect(knowledgeRequests()).toHaveLength(1);
  });

  it.each([
    ['another organization', () => publicWorkspace(otherSlug)],
    ['editable public metadata', () => ({ ...publicWorkspace(), can_edit: true })],
    ['unverifiable revision', () => ({ ...publicWorkspace(), revision: 'not-a-revision' })],
  ])('rejects an invalid public workspace for %s without duplicating the page heading', async (_label, invalid) => {
    transport(() => json(invalid()));
    mountPortal();
    await screen.findByText('No pudimos cargar el conocimiento');
    expect(screen.getAllByRole('heading', { level: 1, name: tenantName(publicSlug) })).toHaveLength(1);
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
    if (!nextPublished) {
      await waitFor(() => expect(knowledgeRequests()).toHaveLength(2));
      await waitFor(() => expect(screen.queryByText('Cargando conocimiento')).not.toBeInTheDocument());
      expect(screen.queryByText('No pudimos cargar el conocimiento')).not.toBeInTheDocument();
    }
    await act(async () => { pending.resolve(json(publicWorkspace())); });
    expect(screen.getAllByRole('heading', { level: 1, name: tenantName(otherSlug) })).toHaveLength(1);
    if (nextPublished) {
      expect(screen.getByTestId('institutional-assistant')).toHaveClass('institutional-assistant--services');
      expect(screen.getByRole('img', { name: `Logo de ${tenantName(otherSlug)}` })).toHaveAttribute('src', `/branding/${otherSlug}.png`);
    }
    expect(screen.queryByRole('heading', { level: 1, name: tenantName(publicSlug) })).not.toBeInTheDocument();
    expect(knowledgeRequests()).toHaveLength(2);
    expect(useTenantStore.getState().slug).toBe(privateSlug);
    expect(usePanelSessionStore.getState().user?.tenant_slug).toBe(privateSlug);
  });
});
