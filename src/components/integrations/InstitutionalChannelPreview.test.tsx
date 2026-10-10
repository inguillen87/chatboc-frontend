import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { workspace, reply, source } from '../../../tests/fixtures/institutional-assistant.synthetic';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import type { KnowledgeWorkspace } from '@/components/knowledge/institutionalAssistantContract';
import IntegracionesPage from '@/pages/pyme/integraciones/IntegracionesPage';
import { tenantService } from '@/services/tenantService';

// Actual component, runtime parsers and HTTP transport; every Response below is a LOCAL SYNTHETIC fixture.
vi.unmock('react-router-dom');
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(), API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/utils/backendBootstrapGate', () => ({ ensureBackendRuntimeReady: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: vi.fn().mockResolvedValue('synthetic-visitor') }));
const session = vi.hoisted(() => ({ loading: false, hasVerifiedSession: true, organizationProfileVerified: true,
  user: { id: 42, tenantSlug: 'actor-home' } as { id: number; tenantSlug: string; role?: string; permissions?: string[]; capabilities?: string[]; scopes?: string[] } | null }));
const tenant = vi.hoisted(() => ({ currentSlug: 'qa-office' as string | null,
  tenant: { slug: 'qa-office', publishedIdentity: undefined as undefined | { tenantId: number; tenantSlug: string } },
  isLoadingTenant: false, tenantError: null as string | null }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => session }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => tenant }));
const api = vi.hoisted(() => ({ adminGetIntegrations: vi.fn(), adminGetNotificationSettings: vi.fn(),
  adminGetCatalog: vi.fn(), adminGetMercadoPagoCredentials: vi.fn(), get: vi.fn(),
  put: vi.fn(), post: vi.fn(), adminConnectIntegration: vi.fn() }));
vi.mock('@/api/client', () => ({ apiClient: api }));
vi.mock('@/services/tenantService', () => ({ tenantService: { getTenantConfig: vi.fn(), updateTenantConfig: vi.fn() } }));
vi.mock('@/components/admin/ChatCustomizer', () => ({ default: () => null }));
vi.mock('@/components/admin/OrderDispatchSettings', () => ({ default: () => null }));
vi.mock('@/components/integrations/WhatsappTechProviderOnboarding', () => ({ default: () => null }));
vi.mock('@/components/admin/catalog/CatalogUploadWizard', () => ({ default: () => null }));
vi.mock('@/components/admin/catalog/CatalogSpreadsheetEditor', () => ({ default: () => null }));
vi.mock('@/pages/pyme/integraciones/IntegrationPreviewDialog', () => ({ default: () => null }));

import InstitutionalChannelPreview from './InstitutionalChannelPreview';

const originalFetch = global.fetch;
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>(yes => { resolve = yes; }), resolve };
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const model = (slug = 'qa-office', name = 'Institución sintética local'): KnowledgeWorkspace => workspace({
  visibility: 'public', can_edit: false, tenant: { id: slug === 'qa-office' ? 701 : 702, slug, name },
});
let navigate: ReturnType<typeof useNavigate>;
const RouteControls = () => { navigate = useNavigate(); return null; };
const fixture = (entry = '/t/qa-office/integracion') => <MemoryRouter initialEntries={[entry]}>
  <RouteControls />
  <Routes>
    <Route path="/t/:tenant/integracion" element={<InstitutionalChannelPreview />} />
    <Route path="/integracion" element={<InstitutionalChannelPreview />} />
  </Routes>
</MemoryRouter>;
const switchTenant = (slug: string) => {
  tenant.currentSlug = slug; tenant.tenant = { slug, publishedIdentity: undefined };
  navigate(`/t/${slug}/integracion`);
};
const assertPublicReads = (expectedSlug = 'qa-office') => {
  for (const [url, init] of vi.mocked(global.fetch).mock.calls) {
    const headers = new Headers(init?.headers);
    expect(init?.method).toBe('GET'); expect(init?.credentials).toBe('omit');
    expect(headers.has('Authorization')).toBe(false); expect(headers.has('X-Entity-Token')).toBe(false);
    expect(headers.has('X-Chat-Session-Id')).toBe(false); expect(headers.get('X-Tenant-Slug')).toBe(expectedSlug);
    expect(new URL(String(url), window.location.origin).pathname).toMatch(/\/api\/public\/tenants\/[^/]+\/institutional-assistant(?:\/nodes\/[^/]+)?$/);
    expect(new URL(String(url), window.location.origin).searchParams.get('tenant')).toBe(expectedSlug);
  }
};

beforeEach(() => {
  vi.clearAllMocks(); advanceChatbocSessionRevision(); safeLocalStorage.clear();
  session.loading = false; session.hasVerifiedSession = true; session.organizationProfileVerified = true;
  session.user = { id: 42, tenantSlug: 'actor-home' };
  tenant.currentSlug = 'qa-office'; tenant.tenant = { slug: 'qa-office', publishedIdentity: undefined };
  tenant.isLoadingTenant = false; tenant.tenantError = null;
  usePanelSessionStore.setState({ authToken: 'synthetic-private-session', user: { id: 42, tenant_slug: 'actor-home' } as any });
  useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-widget-session', entityToken: 'synthetic-entity' });
  useTenantStore.getState().setTenant('actor-home');
  safeLocalStorage.setItem('authToken', 'synthetic-private-session'); safeLocalStorage.setItem('tenantSlug', 'actor-home');
  window.history.replaceState({}, '', '/t/qa-office/integracion');
  global.fetch = vi.fn().mockResolvedValue(json(model()));
  api.adminGetIntegrations.mockResolvedValue([]); api.adminGetNotificationSettings.mockResolvedValue({});
  api.adminGetCatalog.mockResolvedValue({}); api.adminGetMercadoPagoCredentials.mockResolvedValue({});
  api.get.mockResolvedValue({});
  vi.mocked(tenantService.getTenantConfig).mockResolvedValue({
    tenant: { id: 701, slug: 'qa-office', nombre: 'Institución sintética local' },
    configs: { widget: {}, menu: {}, links: {}, contacts: {} },
    organization_profile: { contract_version: 'organization.profile_settings.v1', tenant: { id: 701, slug: 'qa-office' },
      revision: 'a'.repeat(64), can_edit: true, editability: { mode: 'editable' }, values: {} },
  });
});
afterEach(() => {
  cleanup(); global.fetch = originalFetch; vi.restoreAllMocks(); safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null }); useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  useTenantStore.getState().clearTenant(); window.history.replaceState({}, '', '/');
});

describe('public institutional preview — local synthetic fixtures', () => {
  it('renders real parsed corpus counts, all initial actions and public source references; node choices use only scoped GETs', async () => {
    const publicModel = model();
    publicModel.knowledge!.node_count = 64;
    publicModel.knowledge!.sources = Array.from({ length: 10 }, (_, index) => ({ ...source, id: index ? `source-${index}` : source.id }));
    publicModel.knowledge!.initial.actions.push(...Array.from({ length: 3 }, (_, index) => ({ code: `${index + 2}`, label: `Tema sintético ${index + 2}`, target: `topic-${index + 2}` })));
    const pending = deferred<Response>();
    global.fetch = vi.fn((input: RequestInfo | URL) => String(input).includes('/nodes/') ? pending.promise : Promise.resolve(json(publicModel))) as typeof fetch;
    render(fixture());
    expect(await screen.findByText('Institución sintética local')).toBeVisible();
    expect(screen.getByText('64 nodos · 10 fuentes')).toBeVisible();
    expect(screen.getByRole('button', { name: '4 Tema sintético 4' })).toBeVisible();
    fireEvent.click(screen.getByText('Fuentes y revisión'));
    expect(screen.getByText(source.title)).toBeVisible();
    expect(screen.getByText(/Revisión pendiente · Vigencia no verificada/)).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '1 Consultar requisitos' }));
    expect(screen.queryByTestId('institutional-chat-message')).not.toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    const url = new URL(String(vi.mocked(global.fetch).mock.calls[1][0]), window.location.origin);
    expect(url.pathname).toBe('/api/public/tenants/qa-office/institutional-assistant/nodes/requirements');
    expect(url.searchParams.get('revision')).toBe(publicModel.revision);
    await act(async () => pending.resolve(json(reply('requirements', publicModel))));
    expect(await screen.findByText('Requisitos de la consulta')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Referencia institucional' })).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('button', { name: publicModel.ui.home })).toHaveClass('min-h-11');
    assertPublicReads();
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('actor-home');
    expect(useTenantStore.getState().slug).toBe('actor-home');
    expect(usePanelSessionStore.getState().authToken).toBe('synthetic-private-session');
  });

  it('preserves an underscore tenant and keeps reserved original URLs out of public references', async () => {
    const data = model('medico_general');
    const reserved = { ...source, document_visibility: 'private' as const, url: 'https://example.org/reserved-original.pdf', origin_url: 'https://example.org/reserved-origin' };
    data.knowledge!.sources = [reserved]; data.knowledge!.initial.sources = [{ ...reserved, pages: [1] }];
    tenant.currentSlug = 'medico_general'; tenant.tenant = { slug: 'medico_general', publishedIdentity: undefined };
    global.fetch = vi.fn().mockResolvedValue(json(data));
    const { container } = render(fixture('/t/medico_general/integracion'));
    expect(await screen.findByText('Institución sintética local')).toBeVisible();
    fireEvent.click(screen.getByText('Fuentes y revisión'));
    expect(screen.getByText('El texto se basa en fuentes del equipo. El documento original está reservado.')).toBeVisible();
    expect(container.innerHTML).not.toContain('reserved-original'); expect(container.innerHTML).not.toContain('reserved-origin');
    assertPublicReads('medico_general');
  });

  it.each([
    [503, { reason_code: 'knowledge_unavailable' }], [403, { reason_code: 'forbidden' }],
    [404, { reason_code: 'unknown_tenant' }], [404, { reason_code: 'knowledge_not_available', extra: true }],
  ])('fails closed for HTTP %s without silently using legacy content and retries only explicitly', async (status, body) => {
    global.fetch = vi.fn().mockResolvedValueOnce(json(body, status as number)).mockResolvedValueOnce(json(model()));
    render(fixture());
    expect(await screen.findByRole('alert')).toHaveTextContent('La respuesta, sus opciones y sus fuentes se retiraron');
    expect(screen.queryByTestId('institutional-chat-message')).not.toBeInTheDocument();
    expect(screen.queryByText(/usa la configuración anterior/)).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar contenido público' }));
    expect(await screen.findByText('Institución sintética local')).toBeVisible(); expect(global.fetch).toHaveBeenCalledTimes(2);
    assertPublicReads();
  });

  it('marks the institutional menu unavailable for the exact runtime 404 without assuming legacy exists or calling legacy endpoints', async () => {
    global.fetch = vi.fn().mockResolvedValue(json({ reason_code: 'knowledge_not_available' }, 404));
    const { container } = render(fixture());
    expect(await screen.findByText('No hay un menú institucional público disponible para esta organización.')).toBeVisible();
    expect(screen.queryByText(/usa la configuración anterior/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByTestId('institutional-chat-message')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent(/menú publicado/i);
    expect(global.fetch).toHaveBeenCalledOnce(); assertPublicReads();
  });

  it.each(['wrong-slug', 'wrong-id', 'private', 'editable', 'invalid-source', 'unregistered-source', 'invalid-contract'])('rejects %s workspace identity or contract instead of accepting its content', async invalid => {
    const data = model();
    if (invalid === 'wrong-slug') data.tenant.slug = 'qa-other';
    if (invalid === 'wrong-id') tenant.tenant.publishedIdentity = { tenantId: 999, tenantSlug: 'qa-office' };
    if (invalid === 'private') data.visibility = 'private';
    if (invalid === 'editable') data.can_edit = true;
    if (invalid === 'invalid-source') data.knowledge!.initial.sources[0].sha256 = 'bad';
    if (invalid === 'unregistered-source') data.knowledge!.initial.sources[0].id = 'unregistered';
    if (invalid === 'invalid-contract') (data as any).contract_version = 'other.v1';
    global.fetch = vi.fn().mockResolvedValue(json(data));
    render(fixture());
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos verificar el contenido público');
    expect(screen.queryByTestId('institutional-chat-message')).not.toBeInTheDocument();
    expect(screen.queryByText(/usa la configuración anterior/)).not.toBeInTheDocument(); assertPublicReads();
  });

  it.each(['503', '403', '404', 'revision', 'source', 'identity'])('retires the preceding response, options and sources after a %s node failure', async invalid => {
    const data = model(), answer = reply('requirements', data);
    if (invalid === 'revision') answer.revision = 'c'.repeat(64);
    if (invalid === 'source') answer.nodes[0].sources[0].sha256 = 'd'.repeat(64);
    if (invalid === 'identity') answer.tenant.id = 999;
    const status = /^\d/.test(invalid) ? Number(invalid) : 200;
    global.fetch = vi.fn().mockResolvedValueOnce(json(data)).mockResolvedValueOnce(json(status === 200 ? answer : { reason_code: 'knowledge_not_available' }, status));
    render(fixture()); await screen.findByText('Institución sintética local');
    fireEvent.click(screen.getByRole('button', { name: '1 Consultar requisitos' }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByTestId('institutional-chat-message')).not.toBeInTheDocument();
    expect(screen.queryByText(source.title)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1 Consultar requisitos' })).not.toBeInTheDocument();
    expect(screen.queryByText(/usa la configuración anterior/)).not.toBeInTheDocument(); assertPublicReads();
  });

  it('ignores initial reads after tenant A→B→A even when old response bodies finish late', async () => {
    const oldBody = deferred<string>(); const first = json(model('qa-office', 'A anterior'));
    vi.spyOn(first, 'text').mockReturnValue(oldBody.promise);
    const second = deferred<Response>();
    global.fetch = vi.fn().mockResolvedValueOnce(first).mockReturnValueOnce(second.promise).mockResolvedValueOnce(json(model('qa-office', 'A vigente')));
    render(fixture()); await waitFor(() => expect(first.text).toHaveBeenCalledOnce());
    act(() => switchTenant('qa-other')); await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    act(() => switchTenant('qa-office')); expect(await screen.findByText('A vigente')).toBeVisible();
    await act(async () => { oldBody.resolve(JSON.stringify(model('qa-office', 'A anterior'))); second.resolve(json(model('qa-other', 'B anterior'))); });
    expect(screen.getByText('A vigente')).toBeVisible(); expect(screen.queryByText('A anterior')).not.toBeInTheDocument();
    expect(screen.queryByText('B anterior')).not.toBeInTheDocument();
  });

  it('ignores a late node response and detached options after A→B→A', async () => {
    const pending = deferred<Response>();
    global.fetch = vi.fn().mockResolvedValueOnce(json(model())).mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(json(model('qa-other', 'B vigente'))).mockResolvedValueOnce(json(model('qa-office', 'A vigente')));
    render(fixture()); const oldChoice = await screen.findByRole('button', { name: '1 Consultar requisitos' });
    fireEvent.click(oldChoice); await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    act(() => switchTenant('qa-other')); expect(await screen.findByText('B vigente')).toBeVisible();
    act(() => switchTenant('qa-office')); expect(await screen.findByText('A vigente')).toBeVisible();
    fireEvent.click(oldChoice);
    await act(async () => pending.resolve(json(reply('requirements', model()))));
    expect(screen.getByText('A vigente')).toBeVisible(); expect(screen.queryByText('Requisitos de la consulta')).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  it('retires responses for actor changes and for logout/login as the same actor', async () => {
    const first = deferred<Response>(), second = deferred<Response>();
    global.fetch = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockResolvedValueOnce(json(model('qa-office', 'Sesión vigente')));
    const view = render(fixture()); await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    session.user = { id: 43, tenantSlug: 'actor-home' }; view.rerender(fixture());
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    act(() => { session.hasVerifiedSession = false; advanceChatbocSessionRevision(); });
    expect(screen.getByRole('alert')).toHaveTextContent('sesión verificadas');
    session.hasVerifiedSession = true; act(() => advanceChatbocSessionRevision());
    expect(await screen.findByText('Sesión vigente')).toBeVisible();
    await act(async () => { first.resolve(json(model('qa-office', 'Actor anterior'))); second.resolve(json(model('qa-office', 'Sesión anterior'))); });
    expect(screen.getByText('Sesión vigente')).toBeVisible(); expect(screen.queryByText('Actor anterior')).not.toBeInTheDocument();
    expect(screen.queryByText('Sesión anterior')).not.toBeInTheDocument(); assertPublicReads();
  });

  it.each(['role', 'permissions', 'capabilities', 'scopes'])('retires same-actor %s changes and never revives an ABA read', async field => {
    const old = deferred<Response>(), middle = deferred<Response>();
    global.fetch = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(middle.promise).mockResolvedValueOnce(json(model('qa-office', 'Autoridad vigente')));
    const view = render(fixture()); await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    session.user = { ...session.user!, [field]: field === 'role' ? 'changed-role' : ['changed-authority'] };
    view.rerender(fixture()); await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    session.user = { id: 42, tenantSlug: 'actor-home' }; view.rerender(fixture());
    expect(await screen.findByText('Autoridad vigente')).toBeVisible();
    await act(async () => { old.resolve(json(model('qa-office', 'Autoridad anterior'))); middle.resolve(json(model('qa-office', 'Autoridad intermedia'))); });
    expect(screen.getByText('Autoridad vigente')).toBeVisible(); expect(screen.queryByText('Autoridad anterior')).not.toBeInTheDocument();
    expect(screen.queryByText('Autoridad intermedia')).not.toBeInTheDocument(); assertPublicReads();
  });

  it('withdraws profile verification immediately and requires a fresh read after same-actor re-verification', async () => {
    const old = deferred<Response>();
    global.fetch = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce(json(model('qa-office', 'Perfil vigente')));
    const view = render(fixture()); await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    session.organizationProfileVerified = false; view.rerender(fixture());
    expect(screen.getByRole('alert')).toHaveTextContent('sesión verificadas'); expect(global.fetch).toHaveBeenCalledOnce();
    session.organizationProfileVerified = true; view.rerender(fixture());
    expect(await screen.findByText('Perfil vigente')).toBeVisible();
    await act(async () => old.resolve(json(model('qa-office', 'Perfil retirado'))));
    expect(screen.queryByText('Perfil retirado')).not.toBeInTheDocument(); assertPublicReads();
  });

  it('retires batched panel-token A→B→A without an epoch change and blocks a detached action before rerender', async () => {
    const pending = deferred<Response>();
    global.fetch = vi.fn().mockResolvedValueOnce(json(model())).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(json(model('qa-office', 'Panel vigente')));
    render(fixture()); const oldChoice = await screen.findByRole('button', { name: '1 Consultar requisitos' });
    fireEvent.click(oldChoice); await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    act(() => {
      usePanelSessionStore.setState({ authToken: 'synthetic-rotated-session' });
      usePanelSessionStore.setState({ authToken: 'synthetic-private-session' });
      fireEvent.click(oldChoice);
    });
    expect(await screen.findByText('Panel vigente')).toBeVisible();
    await act(async () => pending.resolve(json(reply('requirements', model()))));
    expect(screen.queryByText('Requisitos de la consulta')).not.toBeInTheDocument(); expect(global.fetch).toHaveBeenCalledTimes(3);
    assertPublicReads();
  });

  it('retires published-identity ID A→B→A even when the tenant slug remains unchanged', async () => {
    const old = deferred<Response>(), middle = deferred<Response>();
    tenant.tenant.publishedIdentity = { tenantId: 701, tenantSlug: 'qa-office' };
    global.fetch = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(middle.promise).mockResolvedValueOnce(json(model('qa-office', 'Identidad vigente')));
    const view = render(fixture()); await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    tenant.tenant.publishedIdentity = { tenantId: 999, tenantSlug: 'qa-office' }; view.rerender(fixture());
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    tenant.tenant.publishedIdentity = { tenantId: 701, tenantSlug: 'qa-office' }; view.rerender(fixture());
    expect(await screen.findByText('Identidad vigente')).toBeVisible();
    await act(async () => { old.resolve(json(model('qa-office', 'Identidad anterior'))); middle.resolve(json(model('qa-office', 'Identidad intermedia'))); });
    expect(screen.getByText('Identidad vigente')).toBeVisible(); expect(screen.queryByText('Identidad anterior')).not.toBeInTheDocument();
    expect(screen.queryByText('Identidad intermedia')).not.toBeInTheDocument();
  });

  it('continues keyboard navigation at the new answer heading without stealing focus moved elsewhere', async () => {
    const pending = deferred<Response>();
    global.fetch = vi.fn().mockResolvedValueOnce(json(model())).mockReturnValueOnce(pending.promise);
    render(fixture()); const choice = await screen.findByRole('button', { name: '1 Consultar requisitos' });
    choice.focus(); fireEvent.click(choice, { detail: 0 });
    expect(screen.getByRole('status')).toHaveFocus();
    await act(async () => pending.resolve(json(reply('requirements', model()))));
    expect(screen.getByRole('heading', { name: 'Requisitos de la consulta' })).toHaveFocus();
    const next = deferred<Response>(); vi.mocked(global.fetch).mockReturnValueOnce(next.promise);
    const home = screen.getByRole('button', { name: '9 Volver al menú' }); home.focus(); fireEvent.click(home, { detail: 0 });
    const heading = screen.getByRole('heading', { name: 'Contenido del agente público' });
    heading.tabIndex = -1; heading.focus();
    await act(async () => next.resolve(json(reply('start', model()))));
    expect(heading).toHaveFocus(); expect(screen.getByRole('heading', { name: '¿Sobre qué querés consultar?' })).not.toHaveFocus();
  });

  it('removes ready content immediately when route/context identity conflicts and cannot invoke an old action', async () => {
    render(fixture()); const choice = await screen.findByRole('button', { name: '1 Consultar requisitos' });
    act(() => navigate('/t/qa-office/integracion?tenant_slug=qa-other'));
    expect(screen.getByRole('alert')).toHaveTextContent('organización de la dirección no coincide');
    expect(screen.queryByTestId('institutional-chat-message')).not.toBeInTheDocument();
    fireEvent.click(choice); expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('does not guess a tenant from the actor home or from conflicting query values', () => {
    render(fixture('/integracion?tenant=qa-office&tenant_slug=qa-other'));
    expect(screen.getByRole('alert')).toHaveTextContent('dirección no coincide'); expect(global.fetch).not.toHaveBeenCalled();
  });

  it('aborts the initial read on unmount and never restores late content', async () => {
    const pending = deferred<Response>(); global.fetch = vi.fn().mockReturnValue(pending.promise);
    const view = render(fixture()); await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    const signal = vi.mocked(global.fetch).mock.calls[0][1]!.signal!;
    view.unmount(); expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(json(model())));
    expect(screen.queryByTestId('institutional-chat-message')).not.toBeInTheDocument(); expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('places the public corpus before optional transport, labels sandbox provenance and preserves the R8 profile CTA and draft', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(json(model())).mockResolvedValueOnce(json({ reason_code: 'temporary_failure' }, 503))
      .mockResolvedValueOnce(json(model()));
    render(<MemoryRouter initialEntries={['/t/qa-office/integracion']}><Routes>
      <Route path="/t/:tenant/integracion" element={<IntegracionesPage />} />
    </Routes></MemoryRouter>);
    const publicHeading = await screen.findByRole('heading', { name: 'Contenido del agente público' });
    await screen.findByRole('button', { name: '1 Consultar requisitos' });
    const profile = await screen.findByRole('link', { name: 'Perfil institucional' });
    expect(profile).toHaveAttribute('href', '/perfil?section=general&tenant_slug=qa-office');
    const summary = screen.getByText('Simulación de WhatsApp');
    expect(summary).toHaveClass('min-h-11'); expect(summary.closest('details')).not.toHaveAttribute('open');
    expect(publicHeading.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Opciones de prueba')).toBeVisible();
    expect(screen.getByText(/Estas opciones provienen del sandbox/)).toBeVisible();
    expect(screen.queryByText('Menu publicado')).not.toBeInTheDocument();
    const draft = screen.getByPlaceholderText('Mensaje que querés mandar para iniciar la demo.');
    expect(draft).toHaveValue(''); fireEvent.change(draft, { target: { value: 'Borrador sintético sin enviar' } });
    fireEvent.click(summary); expect(within(summary.closest('details')!).getByText('Borrador sintético sin enviar')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '1 Consultar requisitos' }));
    await screen.findByRole('button', { name: 'Reintentar contenido público' });
    expect(draft).toHaveValue('Borrador sintético sin enviar');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar contenido público' }));
    await screen.findByRole('button', { name: '1 Consultar requisitos' }); fireEvent.click(profile);
    expect(draft).toHaveValue('Borrador sintético sin enviar');
    expect(api.put).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled();
    expect(api.adminConnectIntegration).not.toHaveBeenCalled(); expect(tenantService.updateTenantConfig).not.toHaveBeenCalled(); assertPublicReads();
  });
});
