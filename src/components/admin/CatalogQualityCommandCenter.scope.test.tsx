import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CatalogQualityCommandCenter from './CatalogQualityCommandCenter';
import { getCatalogQualityV2, patchCatalogItemV2 } from '@/api/v2/saas';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

// Real component, catalogue client, panelApi and apiFetch. Identity and HTTP
// are synthetic; no owner session, server persistence or delivery is exercised.
const identity = vi.hoisted(() => ({ actor: 42, slug: 'qa-a', tenantId: 701,
  verified: true, loading: false, role: 'superadmin', published: true,
  permissions: [] as unknown[], capabilities: [] as unknown[], scopes: [] as unknown[] }));
const bootstrap = vi.hoisted(() => ({ ready: vi.fn() }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({
  user: { id: identity.actor, rol: identity.role, permissions: identity.permissions,
    capabilities: identity.capabilities, scopes: identity.scopes }, loading: identity.loading,
  hasVerifiedSession: identity.verified, organizationProfileVerified: identity.verified,
}) }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({
  currentSlug: identity.slug, tenant: { slug: identity.slug, publishedIdentity: identity.published ? {
    tenantId: identity.tenantId, tenantSlug: identity.slug,
  } : null }, isLoadingTenant: false, tenantError: null,
}) }));
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/utils/backendBootstrapGate', () => ({ ensureBackendRuntimeReady: bootstrap.ready }));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: vi.fn().mockResolvedValue('synthetic-visitor') }));

const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
});
const model = (slug: string, itemId: number, tenantId = slug === 'qa-a' ? 701 : 702) => ({
  contract_version: 'catalog.quality.v1', tenant_slug: slug, tenant: { id: tenantId, slug },
  summary: { products: 1 }, queues: { missing_images: [{ id: itemId, item_id: itemId,
    name: `PRODUCT-${slug}-${itemId}`, precio: '100', descripcion_corta: `DESCRIPTION-${slug}` }] },
  frontend_contract: { queue_tabs: ['missing_images'] },
  imports: { latest: [], accepted_file_types: [], image_columns: [] },
});
const ack = (itemId = 501) => json({ contract_version: 'tenant.catalog_item_update.v1', item: { id: itemId } });
type Request = { path: string; slug: string; method: string; body: Record<string, unknown> | null; init: RequestInit };
let requests: Request[];
const installHttp = (respond: (request: Request) => Response | Promise<Response>) => {
  vi.stubGlobal('fetch', vi.fn((url: RequestInfo | URL, init: RequestInit = {}) => {
    const path = new URL(String(url), window.location.origin).pathname;
    const headers = new Headers(init.headers);
    const request: Request = { path, slug: path.match(/\/tenants\/([^/]+)\//)?.[1] || headers.get('X-Tenant-Slug') || headers.get('X-Tenant') || '',
      method: init.method || 'GET', body: init.body ? JSON.parse(String(init.body)) : null, init };
    if (!path.startsWith('/api/') || !request.slug) throw new Error('Network forbidden outside finite synthetic fixture');
    requests.push(request); return Promise.resolve(respond(request));
  }));
};
const setScope = (slug: string, tenantId = slug === 'qa-a' ? 701 : 702) => {
  identity.slug = slug; identity.tenantId = tenantId; useTenantStore.getState().setTenant(slug);
};
const renderPage = () => render(<CatalogQualityCommandCenter tenantSlug={identity.slug} />);
const editA = async () => { await screen.findByText('PRODUCT-qa-a-501');
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  fireEvent.change(screen.getByPlaceholderText('Precio'), { target: { value: '987' } });
};
const patchRequests = () => requests.filter(request => request.method === 'PATCH');
beforeEach(() => {
  requests = []; Object.assign(identity, { actor: 42, slug: 'qa-a', tenantId: 701, verified: true, loading: false, role: 'superadmin', published: true });
  identity.permissions = ['market.catalog.read', 'market.catalog.write'];
  identity.capabilities = ['tickets.read', 'tickets.write'];
  identity.scopes = ['analytics.read', 'market.orders.read'];
  bootstrap.ready.mockReset().mockResolvedValue(undefined);
  safeLocalStorage.clear(); useTenantStore.getState().setTenant('qa-a');
  usePanelSessionStore.setState({ authToken: 'synthetic-owner-token', user: { id: '42', email: 'owner@example.invalid', rol: 'superadmin' } });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  window.history.replaceState({}, '', '/catalogo');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null }); useTenantStore.getState().clearTenant(); });

describe('catalogue editor ownership with real synthetic HTTP transport', () => {
  it('saves the current item once and refreshes only its confirmed tenant', async () => {
    installHttp(request => request.method === 'GET' ? json(model(request.slug, 501)) : ack());
    renderPage(); await editA(); fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(requests.filter(request => request.method === 'GET')).toHaveLength(2));
    expect(patchRequests()).toHaveLength(1);
    const patch = patchRequests()[0];
    expect(patch).toMatchObject({ path: '/api/admin/tenants/qa-a/catalog/items/501', body: { precio: '987' } });
    expect(patch.init).toMatchObject({ credentials: 'include', redirect: 'error' });
    const headers = new Headers(patch.init.headers);
    expect(headers.get('Authorization')).toBe('Bearer synthetic-owner-token');
    expect(headers.has('X-Entity-Token')).toBe(false); expect(headers.has('X-Chat-Session-Id')).toBe(false);
  });
  it('withdraws A editor and values immediately while B is still loading', async () => {
    const b = deferred<Response>(); installHttp(request => request.slug === 'qa-a' ? json(model('qa-a', 501)) : b.promise);
    const page = renderPage(); await editA(); setScope('qa-b'); page.rerender(<CatalogQualityCommandCenter tenantSlug="qa-b" />);
    expect(screen.queryByDisplayValue('987')).not.toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    expect(patchRequests()).toHaveLength(0);
    await act(async () => { b.resolve(json(model('qa-b', 502))); await b.promise; });
    await screen.findByText('PRODUCT-qa-b-502'); expect(screen.queryByText('PRODUCT-qa-a-501')).not.toBeInTheDocument();
  });
  it('ignores a delayed A read after B has completed', async () => {
    const a = deferred<Response>(); installHttp(request => request.slug === 'qa-a' ? a.promise : json(model('qa-b', 502)));
    const page = renderPage(); await waitFor(() => expect(requests).toHaveLength(1));
    setScope('qa-b'); page.rerender(<CatalogQualityCommandCenter tenantSlug="qa-b" />); await screen.findByText('PRODUCT-qa-b-502');
    await act(async () => { a.resolve(json(model('qa-a', 501))); await a.promise; });
    expect(screen.queryByText('PRODUCT-qa-a-501')).not.toBeInTheDocument(); expect(screen.getByText('PRODUCT-qa-b-502')).toBeInTheDocument();
  });
  it('does not readopt the original A read after A→B→A', async () => {
    const original = deferred<Response>(); let aReads = 0;
    installHttp(request => request.slug === 'qa-a' && ++aReads === 1 ? original.promise : json(model(request.slug, request.slug === 'qa-a' ? 503 : 502)));
    const page = renderPage(); await waitFor(() => expect(requests).toHaveLength(1));
    setScope('qa-b'); page.rerender(<CatalogQualityCommandCenter tenantSlug="qa-b" />); await screen.findByText('PRODUCT-qa-b-502');
    setScope('qa-a'); page.rerender(<CatalogQualityCommandCenter tenantSlug="qa-a" />); await screen.findByText('PRODUCT-qa-a-503');
    await act(async () => { original.resolve(json(model('qa-a', 501))); await original.promise; });
    expect(screen.queryByText('PRODUCT-qa-a-501')).not.toBeInTheDocument(); expect(screen.getByText('PRODUCT-qa-a-503')).toBeInTheDocument();
  });
  it.each(['actor', 'revision', 'tenant-id', 'permission'] as const)('withdraws the draft when %s authority changes under the same slug', async change => {
    const next = deferred<Response>(); let reads = 0;
    installHttp(() => ++reads === 1 ? json(model('qa-a', 501)) : next.promise);
    const page = renderPage(); await editA();
    await act(async () => {
      if (change === 'actor') identity.actor = 43;
      if (change === 'revision') advanceChatbocSessionRevision();
      if (change === 'tenant-id') identity.tenantId = 703;
      if (change === 'permission') identity.role = 'empleado';
      page.rerender(<CatalogQualityCommandCenter tenantSlug="qa-a" />);
    });
    expect(screen.queryByDisplayValue('987')).not.toBeInTheDocument(); expect(patchRequests()).toHaveLength(0);
    await waitFor(() => expect(requests).toHaveLength(2));
    await act(async () => { next.resolve(json(model('qa-a', 503, identity.tenantId))); await next.promise; });
    await screen.findByText('PRODUCT-qa-a-503');
  });
  it.each(['success', 'failure'] as const)('retires the %s ACK of a submitted A patch without reloading A or changing B', async outcome => {
    const pending = deferred<Response>();
    installHttp(request => request.method === 'PATCH' ? pending.promise : json(model(request.slug, request.slug === 'qa-a' ? 501 : 502)));
    const page = renderPage(); await editA(); fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(patchRequests()).toHaveLength(1)); setScope('qa-b'); page.rerender(<CatalogQualityCommandCenter tenantSlug="qa-b" />);
    await screen.findByText('PRODUCT-qa-b-502');
    await act(async () => { outcome === 'success' ? pending.resolve(ack()) : pending.reject(new TypeError('synthetic response lost')); await pending.promise.catch(() => undefined); });
    expect(requests.filter(request => request.slug === 'qa-a' && request.method === 'GET')).toHaveLength(1);
    expect(screen.queryByText(/Cambio aplicado|No pudimos confirmar/)).not.toBeInTheDocument();
    expect(screen.getByText('PRODUCT-qa-b-502')).toBeInTheDocument();
  });
  it('blocks duplicate synchronous submissions and reload while a PATCH is pending', async () => {
    const pending = deferred<Response>(); installHttp(request => request.method === 'PATCH' ? pending.promise : json(model('qa-a', 501)));
    renderPage(); await editA(); const form = screen.getByPlaceholderText('Precio').closest('form')!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    await waitFor(() => expect(patchRequests()).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'Actualizar' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(requests.filter(request => request.method === 'GET')).toHaveLength(1);
    await act(async () => { pending.resolve(ack()); await pending.promise; });
  });
  it.each(['lost', 'wrong-item', 'malformed'] as const)('preserves current draft after %s ACK and only retries on an explicit action', async outcome => {
    let writes = 0; installHttp(request => {
      if (request.method === 'GET') return json(model('qa-a', 501));
      if (++writes > 1) return ack();
      if (outcome === 'lost') return Promise.reject(new TypeError('synthetic response lost'));
      return outcome === 'wrong-item' ? ack(502) : json({ ok: true });
    });
    renderPage(); await editA(); fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText(/No pudimos confirmar el guardado/);
    expect(screen.getByPlaceholderText('Precio')).toHaveValue('987'); expect(patchRequests()).toHaveLength(1);
    expect(requests.filter(request => request.method === 'GET')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar guardado' }));
    await waitFor(() => expect(patchRequests()).toHaveLength(2));
  });
  it('does not dispatch a prepared PATCH after its editor retires during backend readiness', async () => {
    const ready = deferred<void>(); installHttp(request => request.method === 'GET' ? json(model(request.slug, request.slug === 'qa-a' ? 501 : 502)) : ack());
    const page = renderPage(); await editA(); bootstrap.ready.mockImplementationOnce(() => ready.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    setScope('qa-b'); page.rerender(<CatalogQualityCommandCenter tenantSlug="qa-b" />); await screen.findByText('PRODUCT-qa-b-502');
    await act(async () => { ready.resolve(); await ready.promise; }); expect(patchRequests()).toHaveLength(0);
  });
  it('does not request data without verified access, and retires a read on unmount', async () => {
    const pending = deferred<Response>(); installHttp(() => pending.promise); identity.verified = false;
    const page = renderPage(); expect(requests).toHaveLength(0);
    identity.verified = true; page.rerender(<CatalogQualityCommandCenter tenantSlug="qa-a" />);
    await waitFor(() => expect(requests).toHaveLength(1)); page.unmount();
    await act(async () => { pending.resolve(json(model('qa-a', 501))); await pending.promise; }); expect(patchRequests()).toHaveLength(0);
  });
  it.each([{ slug: 'qa-b', id: 702 }, { slug: 'qa-a', id: 703 }])('rejects a foreign or changed quality identity %j', async returned => {
    installHttp(() => json(model(returned.slug, 501, returned.id))); renderPage();
    await screen.findByText(/No pudimos confirmar el catálogo de esta organización/);
    expect(screen.queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument(); expect(patchRequests()).toHaveLength(0);
  });
  it('retains the first confirmed tenant ID across a failed refresh when public identity is unavailable', async () => {
    identity.published = false; let reads = 0;
    installHttp(() => {
      reads += 1;
      if (reads === 2) return Promise.reject(new TypeError('synthetic refresh lost'));
      return json(model('qa-a', reads === 1 ? 501 : 503, reads === 1 ? 701 : 703));
    });
    renderPage(); await editA(); fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await screen.findByText(/No pudimos confirmar el catálogo de esta organización/);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(requests).toHaveLength(3));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Actualizar' })).not.toBeDisabled());
    expect(screen.queryByText('PRODUCT-qa-a-503')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Precio')).toHaveValue('987'); expect(screen.getByPlaceholderText('Precio')).toBeDisabled();
    expect(patchRequests()).toHaveLength(0);
  });
  it.each(['permissions', 'capabilities', 'scopes'] as const)('preserves draft and avoids another GET when %s membership only changes order', async field => {
    installHttp(() => json(model('qa-a', 501))); const page = renderPage(); await editA();
    identity[field] = [...identity[field]].reverse();
    await act(async () => { page.rerender(<CatalogQualityCommandCenter tenantSlug="qa-a" />); });
    expect(screen.getByPlaceholderText('Precio')).toHaveValue('987');
    expect(requests.filter(request => request.method === 'GET')).toHaveLength(1); expect(patchRequests()).toHaveLength(0);
  });
  it.each(['permissions', 'capabilities', 'scopes'] as const)('preserves draft for %s case/whitespace/duplicates and ignored nonstring values', async field => {
    installHttp(() => json(model('qa-a', 501))); const page = renderPage(); await editA();
    const original = [...identity[field]];
    identity[field] = [...original.map(value => `  ${String(value).toUpperCase()}  `).reverse(), ...original,
      '', '  ', null, false, 12, { ignored: true }];
    await act(async () => { page.rerender(<CatalogQualityCommandCenter tenantSlug="qa-a" />); });
    expect(screen.getByPlaceholderText('Precio')).toHaveValue('987');
    expect(requests.filter(request => request.method === 'GET')).toHaveLength(1); expect(patchRequests()).toHaveLength(0);
  });
  it('preserves draft when each access array has a new reference with identical content', async () => {
    installHttp(() => json(model('qa-a', 501))); const page = renderPage(); await editA();
    identity.permissions = [...identity.permissions]; identity.capabilities = [...identity.capabilities]; identity.scopes = [...identity.scopes];
    await act(async () => { page.rerender(<CatalogQualityCommandCenter tenantSlug="qa-a" />); });
    expect(screen.getByPlaceholderText('Precio')).toHaveValue('987'); expect(requests).toHaveLength(1);
  });
  it('preserves draft when token membership moves between the three combined access fields', async () => {
    installHttp(() => json(model('qa-a', 501))); const page = renderPage(); await editA();
    const membership = [...identity.permissions, ...identity.capabilities, ...identity.scopes];
    identity.permissions = []; identity.capabilities = [...membership].reverse(); identity.scopes = [];
    await act(async () => { page.rerender(<CatalogQualityCommandCenter tenantSlug="qa-a" />); });
    expect(screen.getByPlaceholderText('Precio')).toHaveValue('987'); expect(requests).toHaveLength(1);
  });
  it.each([
    ['permissions', 'remove'], ['permissions', 'add'], ['capabilities', 'remove'],
    ['capabilities', 'add'], ['scopes', 'remove'], ['scopes', 'add'],
  ] as const)('retires draft for a real %s token %s', async (field, change) => {
    const current = deferred<Response>(); let reads = 0;
    installHttp(() => ++reads === 1 ? json(model('qa-a', 501)) : current.promise);
    const page = renderPage(); await editA();
    identity[field] = change === 'remove' ? identity[field].slice(1) : [...identity[field], 'synthetic.new.access'];
    await act(async () => { page.rerender(<CatalogQualityCommandCenter tenantSlug="qa-a" />); });
    expect(screen.queryByDisplayValue('987')).not.toBeInTheDocument(); expect(patchRequests()).toHaveLength(0);
    await waitFor(() => expect(requests.filter(request => request.method === 'GET')).toHaveLength(2));
    await act(async () => { current.resolve(json(model('qa-a', 503))); await current.promise; });
    await screen.findByText('PRODUCT-qa-a-503');
  });
  it('keeps a pending PATCH through equivalent access refresh and preserves draft after an unknown ACK', async () => {
    const pending = deferred<Response>(); let writes = 0;
    installHttp(request => request.method === 'GET' ? json(model('qa-a', 501)) : ++writes === 1 ? pending.promise : ack());
    const page = renderPage(); await editA(); fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(patchRequests()).toHaveLength(1));
    identity.permissions = [...identity.permissions].reverse(); identity.capabilities = [...identity.capabilities].reverse(); identity.scopes = [...identity.scopes].reverse();
    await act(async () => { page.rerender(<CatalogQualityCommandCenter tenantSlug="qa-a" />); });
    expect(screen.getByRole('button', { name: 'Guardando...' })).toBeDisabled();
    expect(requests.filter(request => request.method === 'GET')).toHaveLength(1);
    await act(async () => { pending.reject(new TypeError('synthetic response lost')); await pending.promise.catch(() => undefined); });
    await screen.findByText(/No pudimos confirmar el guardado/);
    expect(screen.getByPlaceholderText('Precio')).toHaveValue('987'); expect(patchRequests()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar guardado' }));
    await waitFor(() => expect(patchRequests()).toHaveLength(2));
  });
  it('loads and saves under StrictMode while preserving the current ownership and duplicate lock', async () => {
    const pending = deferred<Response>(); installHttp(request => request.method === 'GET' ? json(model('qa-a', 501)) : pending.promise);
    render(<React.StrictMode><CatalogQualityCommandCenter tenantSlug="qa-a" /></React.StrictMode>);
    await editA(); const form = screen.getByPlaceholderText('Precio').closest('form')!;
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    await waitFor(() => expect(patchRequests()).toHaveLength(1));
    await act(async () => { pending.resolve(ack()); await pending.promise; });
    await screen.findByText('Cambio aplicado. Refrescando cola...');
    expect(screen.getByPlaceholderText('Precio')).toHaveValue('987'); expect(patchRequests()).toHaveLength(1);
  });
  it('retires the original delayed A read through StrictMode A→B→A', async () => {
    const original = deferred<Response>(); let aReads = 0;
    installHttp(request => request.slug === 'qa-a' && ++aReads === 1 ? original.promise : json(model(request.slug, request.slug === 'qa-a' ? 503 : 502)));
    const strictPage = (slug: string) => <React.StrictMode><CatalogQualityCommandCenter tenantSlug={slug} /></React.StrictMode>;
    const page = render(strictPage('qa-a')); await waitFor(() => expect(requests).toHaveLength(1));
    setScope('qa-b'); page.rerender(strictPage('qa-b')); await screen.findByText('PRODUCT-qa-b-502');
    setScope('qa-a'); page.rerender(strictPage('qa-a')); await screen.findByText('PRODUCT-qa-a-503');
    await act(async () => { original.resolve(json(model('qa-a', 501))); await original.promise; });
    expect(screen.queryByText('PRODUCT-qa-a-501')).not.toBeInTheDocument(); expect(screen.getByText('PRODUCT-qa-a-503')).toBeInTheDocument();
  });
});

describe('catalogue API caller retirement', () => {
  it('preserves the current legitimate legacy read fallback', async () => {
    installHttp(request => request.path.includes('/tenants/') ? json({}, 404) : json(model('qa-a', 501)));
    const quality = await getCatalogQualityV2('qa-a', { isCurrent: () => true, expectedTenantId: 701 });
    expect(quality.tenant).toEqual({ id: 701, slug: 'qa-a' }); expect(requests).toHaveLength(2);
    expect(requests[1].path).toBe('/api/v2/catalog/quality');
  });
  it('does not start legacy GET after canonical 404 belongs to a retired caller', async () => {
    const pending = deferred<Response>(); let current = true; installHttp(() => pending.promise);
    const read = getCatalogQualityV2('qa-a', { isCurrent: () => current, expectedTenantId: 701 });
    const rejected = expect(read).rejects.toThrow(); await waitFor(() => expect(requests).toHaveLength(1)); current = false;
    pending.resolve(json({}, 404)); await rejected; expect(requests).toHaveLength(1);
  });
  it('refuses a mutation from a caller already retired before transport', async () => {
    installHttp(() => ack()); await expect(patchCatalogItemV2('qa-a', 501, { precio: '987' }, { isCurrent: () => false })).rejects.toThrow();
    expect(requests).toHaveLength(0);
  });
});
