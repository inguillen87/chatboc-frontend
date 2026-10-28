import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BusinessMetrics from './BusinessMetrics';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(), operationsResponse: vi.fn(), getPublicMapConfigV1: vi.fn(),
  premiumHeatmap: vi.fn(), usePrivateAnalyticsScope: vi.fn(),
}));
vi.mock('@/utils/api', () => ({
  apiFetch: mocks.apiFetch,
  getErrorMessage: (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback,
}));
vi.mock('@/features/analytics/usePrivateAnalyticsScope', () => ({ usePrivateAnalyticsScope: mocks.usePrivateAnalyticsScope }));
vi.mock('@/features/analytics/analyticsApi', async original => ({
  ...await original<typeof import('@/features/analytics/analyticsApi')>(),
  getPublicMapConfigV1: mocks.getPublicMapConfigV1,
}));
vi.mock('@/features/analytics/PremiumTerritoryMap', () => ({
  PremiumTerritoryHeatmap: (props: any) => {
    mocks.premiumHeatmap(props);
    return <div data-testid="premium-territory-heatmap">points:{props.points?.length ?? 0};contract:{props.heatmap?.contract_version ?? 'none'}</div>;
  },
}));
vi.mock('@/services/statsService', () => ({
  extractOperationalCharts: (payload: any) => payload?.charts ?? [],
}));
vi.mock('@/components/TicketStatsCharts', () => ({ default: () => <div data-testid="ticket-stats-charts" /> }));
vi.mock('@/api/v2/saas', () => ({ normalizeEmployeeCoverageV2: (value: unknown) => value }));

const legacyHeatmapSummary = {
  top_categories: [{ categoria: 'Calle', count: 3 }], top_zones: [{ zona: 'Centro', count: 2 }],
  hotspot_pairs: [{ categoria: 'Calle', zona: 'Centro', count: 2 }],
  heatmap_points: [{ id: 'legacy-1', lat: -34.58, lng: -60.94, weight: 2, categoria: 'Calle', source: 'ticket' }],
};
const operationsHeatmap = {
  contract_version: 'operations.heatmap.v1',
  points: [{ id: 'ops-1', lat: -34.59, lng: -60.95, weight: 5, categoria: 'Luminaria', source: 'tickets' }],
  cells: [], hotspots: [], facets: [], category_layers: [],
  render_contract: { state: 'ready', can_render_heatmap: true },
};
const metricDto = (overrides: Record<string, unknown> = {}) => {
  const availability = {
    total_sales: { state: 'available', definition: 'sum_order_amount' },
    total_orders: { state: 'available' }, unique_customers: { state: 'available', definition: 'distinct_order_user_ids' },
    new_customers: { state: 'available', definition: 'alias_unique_customers' },
    avg_order_value: { state: 'unavailable', reason_code: 'no_orders' },
    trend: { state: 'unavailable', reason_code: 'missing_comparison_period' },
    conversion_rate: { state: 'unavailable', reason_code: 'missing_conversion_denominator' },
  };
  return {
    contract_version: 'business.metrics.v1',
    scope: { tenant_id: mocks.usePrivateAnalyticsScope()?.scope?.tenantId ?? 22, source: 'pyme_pedido', period: 'all_time', order_states: 'all_recorded_states' },
    total_sales: 0, total_orders: 0, unique_customers: 0, avg_order_value: null, new_customers: 0,
    currency: null, conversion_rate: null, trend: null, ...overrides,
    availability: { ...availability, ...(overrides.availability as Record<string, unknown> ?? {}) },
  };
};
function selectScope(slug = 'junin', actor = 'actor-a', id = 22) {
  mocks.usePrivateAnalyticsScope.mockReturnValue({
    scope: { tenantSlug: slug, tenantId: id, kind: 'pyme', platformAdmin: false, scopeKey: actor + ':' + slug },
    pending: false, key: actor + ':' + slug, sessionRevision: 0,
  });
}
function page() { return <MemoryRouter><BusinessMetrics /></MemoryRouter>; }
function renderPage() { return render(page()); }
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function card(title: string) { return screen.getByRole('group', { name: title }); }
let summaryResponse: unknown;
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  selectScope();
  summaryResponse = metricDto();
  mocks.operationsResponse.mockResolvedValue(operationsHeatmap);
  mocks.getPublicMapConfigV1.mockResolvedValue({ contract_version: 'public.map_config.v1', provider: 'maplibre' });
  mocks.apiFetch.mockImplementation(async (path: string, options: any) => {
    if (path.includes('/operations/heatmap')) return mocks.operationsResponse();
    if (path.includes('/metrics/summary')) return summaryResponse;
    if (path.includes('/metrics/kpis')) return {};
    if (path.includes('/heatmap-summary')) return legacyHeatmapSummary;
    if (path.includes('/dashboard-bundle')) return null;
    if (path.includes('/employee-coverage') || path.includes('/employees/coverage')) return { categorias: [], zonas: [], permisos: [] };
    if (path.includes('/estadisticas/tickets')) return { charts: [] };
    if (path.includes('/metrics/')) {
      options?.onResponse?.(new Response('[]', { headers: { 'X-Metrics-Availability': 'unavailable', 'X-Metrics-Reason': 'sales_timeseries_not_supported' } }));
      return [];
    }
    return {};
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('BusinessMetrics truthful metrics', () => {
  it('reads the real summary DTO, retains true zeros and never invents a comparison', async () => {
    renderPage();
    await screen.findByText('Importe de pedidos');
    expect(card('Importe de pedidos')).toHaveTextContent('0');
    expect(card('Pedidos totales')).toHaveTextContent('0');
    expect(card('Clientes con pedidos')).toHaveTextContent('0');
    expect(card('Importe promedio por pedido')).toHaveTextContent('No disponible');
    expect(screen.queryByText(/vs\. mes anterior/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nuevos Clientes|Ventas Totales/)).not.toBeInTheDocument();
  });
  it('keeps absent monetary inputs unavailable and explains an unknown or mixed currency', async () => {
    summaryResponse = metricDto({ total_sales: null, avg_order_value: '', total_orders: 3, unique_customers: 2,
      availability: { total_sales: { state: 'unavailable', reason_code: 'mixed_or_unknown_currency' },
        total_orders: { state: 'available' }, unique_customers: { state: 'available' },
        avg_order_value: { state: 'unavailable', reason_code: 'missing_order_amount' } } });
    renderPage();
    await screen.findByText('Importe de pedidos');
    expect(card('Importe de pedidos')).toHaveTextContent('No disponible');
    expect(card('Importe de pedidos')).toHaveTextContent(/moneda/i);
    expect(card('Importe promedio por pedido')).toHaveTextContent('No disponible');
    expect(card('Clientes con pedidos')).toHaveTextContent('2');
    expect(screen.queryByText(/^\$/)).not.toBeInTheDocument();
  });
  it('uses the explicit currency code and renders useful empty states for all unsupported series', async () => {
    summaryResponse = metricDto({ total_sales: 1250, total_orders: 2, unique_customers: 1, avg_order_value: 625, currency: 'ARS',
      availability: { total_sales: { state: 'available' }, total_orders: { state: 'available' },
        unique_customers: { state: 'available' }, avg_order_value: { state: 'available' } } });
    renderPage();
    await screen.findByText('Importe de pedidos');
    expect(card('Importe de pedidos')).toHaveTextContent('ARS');
    expect(screen.getByText('Evolución de importes')).toBeInTheDocument();
    expect(screen.getByText(/La serie temporal de pedidos no está disponible/)).toBeInTheDocument();
    expect(screen.getByText(/El detalle por producto no está disponible/)).toBeInTheDocument();
    expect(screen.getByText(/El detalle por región no está disponible/)).toBeInTheDocument();
  });
  it('binds every local request to the verified tenant and a live authority callback', async () => {
    renderPage();
    await screen.findByText('Importe de pedidos');
    for (const [, options] of mocks.apiFetch.mock.calls) {
      expect(options).toEqual(expect.objectContaining({ tenantSlug: 'junin', persistTenantSlug: false,
        isWidgetRequest: false, omitEntityToken: true, omitChatSessionId: true, isCurrent: expect.any(Function), signal: expect.any(AbortSignal) }));
    }
  });
});

describe('BusinessMetrics request retirement', () => {
  it('retires loaded visuals immediately when the actor or organization ID changes', async () => {
    summaryResponse = metricDto({ total_sales: 98765, currency: 'ARS' });
    const view = renderPage();
    await screen.findByText(/98.765/);
    const pending = deferred<unknown>();
    mocks.apiFetch.mockImplementation(() => pending.promise);
    selectScope('junin', 'actor-b', 46);
    view.rerender(page());
    expect(screen.queryByText(/98.765/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('premium-territory-heatmap')).not.toBeInTheDocument();
    view.unmount();
    await act(async () => pending.resolve(metricDto()));
  });
  it('never accepts delayed A results after A to B to A', async () => {
    const first = deferred<unknown>();
    let call = 0;
    mocks.apiFetch.mockImplementation(async (path: string) => {
      if (path.includes('/metrics/summary')) return ++call === 1 ? first.promise : metricDto({ total_sales: 42, currency: 'ARS' });
      return [];
    });
    const view = renderPage();
    await waitFor(() => expect(call).toBe(1));
    selectScope('bodega', 'actor-a', 46); summaryResponse = metricDto(); view.rerender(page());
    await screen.findByText('Importe de pedidos');
    selectScope(); view.rerender(page());
    await screen.findByText('Importe de pedidos');
    await act(async () => first.resolve(metricDto({ total_sales: 99999, currency: 'ARS' })));
    expect(screen.queryByText(/99.999/)).not.toBeInTheDocument();
    expect(card('Importe de pedidos')).toHaveTextContent('42');
  });
  it('revokes loaded visuals synchronously on session revision even for the same actor', async () => {
    summaryResponse = metricDto({ total_sales: 76543, currency: 'ARS' });
    renderPage(); await screen.findByText(/76.543/);
    mocks.apiFetch.mockImplementation(() => new Promise(() => {}));
    act(() => { advanceChatbocSessionRevision(); });
    expect(screen.queryByText(/76.543/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('premium-territory-heatmap')).not.toBeInTheDocument();
  });
  it('invalidates every authority callback and aborts local reads on unmount', async () => {
    mocks.apiFetch.mockImplementation(() => new Promise(() => {}));
    const view = renderPage();
    await waitFor(() => expect(mocks.apiFetch).toHaveBeenCalled());
    const options = mocks.apiFetch.mock.calls.map(([, opts]) => opts);
    view.unmount();
    for (const value of options) {
      expect(value?.isCurrent?.()).toBe(false);
      expect(value?.signal?.aborted).toBe(true);
    }
  });
  it('does not issue reads without verified private organization authority', async () => {
    mocks.usePrivateAnalyticsScope.mockReturnValue({ scope: null, pending: false, key: null, sessionRevision: 0 });
    renderPage();
    expect(await screen.findByText('Seleccioná una organización')).toBeInTheDocument();
    expect(mocks.apiFetch).not.toHaveBeenCalled();
    expect(mocks.operationsResponse).not.toHaveBeenCalled();
  });
});

describe('BusinessMetrics real heatmap fallback', () => {
  it('renders the operations contract with no synthetic fallback', async () => {
    renderPage();
    expect(await screen.findByText('Contrato ops')).toBeInTheDocument();
    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/v2/analytics/operations/heatmap?range=30d&include_ai=0', expect.objectContaining({ tenantSlug: 'junin', signal: expect.any(AbortSignal), isCurrent: expect.any(Function) }));
    expect(mocks.premiumHeatmap).toHaveBeenCalledWith(expect.objectContaining({ points: [expect.objectContaining(operationsHeatmap.points[0])], allowDemoFallback: false }));
  });
  it('uses real tenant points only after a recoverable heatmap failure', async () => {
    mocks.operationsResponse.mockRejectedValue(Object.assign(new Error('service unavailable'), { status: 503 }));
    mocks.getPublicMapConfigV1.mockRejectedValue(Object.assign(new Error('service unavailable'), { status: 503 }));
    renderPage();
    expect(await screen.findByText('Fuente tenant')).toBeInTheDocument();
    expect(screen.getByTestId('premium-territory-heatmap')).toHaveTextContent('points:1');
    expect(mocks.premiumHeatmap).toHaveBeenCalledWith(expect.objectContaining({ allowDemoFallback: false }));
    expect(mocks.apiFetch).toHaveBeenCalledWith(expect.stringContaining('/heatmap-summary'), expect.anything());
  });
  it.each([401, 403])('never falls back to legacy heatmap after %s', async (status) => {
    mocks.operationsResponse.mockRejectedValue(Object.assign(new Error('denied'), { status }));
    renderPage();
    await screen.findByText('Error al cargar las métricas');
    expect(mocks.apiFetch.mock.calls.some(([path]) => path.includes('/heatmap-summary'))).toBe(false);
    expect(screen.queryByTestId('premium-territory-heatmap')).not.toBeInTheDocument();
  });
});

describe('BusinessMetrics secondary failures and coordinate truth', () => {
  it('keeps the summary visible when products fail, and clears old amounts after a failed refresh', async () => {
    summaryResponse = metricDto({ total_sales: 87654, currency: 'ARS' });
    const original = mocks.apiFetch.getMockImplementation()!;
    mocks.apiFetch.mockImplementation((path: string, options: any) => path.includes('/top-products')
      ? Promise.reject(Object.assign(new Error('temporarily unavailable'), { status: 503 })) : original(path, options));
    renderPage();
    await screen.findByText(/87.654/);
    expect(screen.getByText(/No pudimos consultar este detalle/)).toBeInTheDocument();
    mocks.apiFetch.mockImplementation((path: string, options: any) => path.includes('/metrics/summary') || path.includes('/metrics/kpis')
      ? Promise.reject(new TypeError('network')) : original(path, options));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar métricas' }));
    expect(screen.queryByText(/87.654/)).not.toBeInTheDocument();
    await screen.findByText('Importe de pedidos');
    expect(card('Importe de pedidos')).toHaveTextContent('No disponible');
  });
  it('does not create coordinates from absent, blank, or out-of-range tenant values', async () => {
    mocks.operationsResponse.mockRejectedValue(Object.assign(new Error('service unavailable'), { status: 503 }));
    const original = mocks.apiFetch.getMockImplementation()!;
    mocks.apiFetch.mockImplementation((path: string, options: any) => path.includes('/heatmap-summary') ? Promise.resolve({
      heatmap_points: [{ lat: null, lng: null }, { lat: '', lng: ' ' }, { lat: 91, lng: 20 },
        { lat: -34.58, lng: -60.94, source: 'ticket' }] }) : original(path, options));
    renderPage(); await screen.findByText('Fuente tenant');
    expect(screen.getByTestId('premium-territory-heatmap')).toHaveTextContent('points:1');
  });
  it('removes previous map points when the next organization has no points', async () => {
    const view = renderPage(); await screen.findByTestId('premium-territory-heatmap');
    mocks.operationsResponse.mockResolvedValue({ ...operationsHeatmap, points: [], render_contract: { state: 'empty', can_render_heatmap: false } });
    selectScope('bodega', 'actor-a', 46); summaryResponse = metricDto(); view.rerender(page());
    await screen.findByTestId('premium-territory-heatmap');
    expect(screen.getByTestId('premium-territory-heatmap')).toHaveTextContent('points:0');
    expect(mocks.premiumHeatmap).toHaveBeenLastCalledWith(expect.objectContaining({ points: [], allowDemoFallback: false }));
  });
  it.each([{ actor: 'actor-b', id: 22 }, { actor: 'actor-a', id: 46 }])('revokes visuals for a separate actor or profile change $actor/$id', async ({ actor, id }) => {
    summaryResponse = metricDto({ total_sales: 45678, currency: 'ARS' });
    const view = renderPage(); await screen.findByText(/45.678/);
    mocks.apiFetch.mockImplementation(() => new Promise(() => {}));
    selectScope('junin', actor, id); view.rerender(page());
    expect(screen.queryByText(/45.678/)).not.toBeInTheDocument();
  });
});

describe('BusinessMetrics customer definition', () => {
  it('describes distinct recorded identifiers without claiming unique real people', async () => {
    renderPage(); await screen.findByText('Clientes con pedidos');
    expect(card('Clientes con pedidos')).toHaveTextContent('Identidades registradas con pedidos');
    expect(screen.queryByText(/Personas distintas/)).not.toBeInTheDocument();
  });
});

describe('BusinessMetrics V3 completeness and absent operational counts', () => {
  it('shows unavailable throughout sparse operational, collaboration and coverage counts', async () => {
    mocks.operationsResponse.mockRejectedValue(Object.assign(new Error('recoverable'), { status: 503 }));
    const original = mocks.apiFetch.getMockImplementation()!;
    mocks.apiFetch.mockImplementation((path: string, options: any) => {
      if (path.includes('/dashboard-bundle')) return Promise.resolve({ summary: {}, unread: {},
        leads: { items: [{ name: 'Lead sintético', collaboration_state: {} }] },
        team: { items: [{ nombre: 'Operador sintético', active_ticket_views: null }] } });
      if (path.includes('/heatmap-summary')) return Promise.resolve({ heatmap_points: [],
        top_categories: [{ label: 'Categoría sin conteo' }], top_zones: [{ label: 'Zona sin conteo' }],
        hotspot_pairs: [{ label: 'Hotspot sin conteo' }] });
      if (path.includes('/employee-coverage')) return Promise.resolve({
        categorias: [{ label: 'Cobertura sin conteo' }], zonas: [], permisos: [] });
      if (path.includes('/estadisticas/tickets')) return Promise.resolve({ charts: [{ title: 'Estado', data: { pendiente: null, conocido: 0 } }] });
      return original(path, options);
    });
    renderPage(); await screen.findByText('Importe de pedidos');
    expect(screen.getByText('Leads No disponible')).toBeInTheDocument();
    expect(screen.getByText('Unread No disponible')).toBeInTheDocument();
    expect(screen.getByText('Leads backlog').nextElementSibling).toHaveTextContent('No disponible');
    expect(screen.getByText('SLA en riesgo').nextElementSibling).toHaveTextContent('No disponible');
    expect(screen.getByText('Tickets unread').nextElementSibling).toHaveTextContent('No disponible');
    expect(screen.getByText('Encuestas activas').nextElementSibling).toHaveTextContent('No disponible');
    expect(screen.getByText('No disponible activos')).toBeInTheDocument();
    expect(screen.getByText('Operador sintético').closest('.rounded-lg')).toHaveTextContent('No disponible');
    expect(screen.getByText('Categoría sin conteo · No disponible')).toBeInTheDocument();
    expect(screen.getByText('Zona sin conteo · No disponible')).toBeInTheDocument();
    expect(screen.getByText('Hotspot sin conteo').parentElement).toHaveTextContent('No disponible');
    expect(screen.getByText('Cobertura sin conteo').parentElement).toHaveTextContent('No disponible');
    expect(screen.getByText('Pendiente').nextElementSibling).toHaveTextContent('No disponible');
    expect(screen.getByText('Conocido').nextElementSibling).toHaveTextContent('0');
  });
  it('preserves explicitly observed operational zeros and distinguishes an absent team list', async () => {
    const original = mocks.apiFetch.getMockImplementation()!;
    mocks.apiFetch.mockImplementation((path: string, options: any) => path.includes('/dashboard-bundle') ? Promise.resolve({
      summary: { open_leads: 0, active_viewers: 0, unread_viewers: 0, active_surveys: 0, unread_tickets: 0 },
      unread: { total: 0 }, team: {}, leads: { total: 0 },
    }) : original(path, options));
    renderPage(); await screen.findByText('Importe de pedidos');
    expect(screen.getByText('Leads 0')).toBeInTheDocument();
    expect(screen.getByText('Unread 0')).toBeInTheDocument();
    expect(screen.getByText('Equipo No disponible')).toBeInTheDocument();
    expect(screen.getByText('Leads backlog').nextElementSibling).toHaveTextContent(/^0$/);
  });
  it('offers profile recovery and performs no reads when the verified profile ID is unknown', async () => {
    const current = mocks.usePrivateAnalyticsScope();
    mocks.usePrivateAnalyticsScope.mockReturnValue({ ...current, scope: { ...current.scope, tenantId: null } });
    renderPage();
    expect(await screen.findByText('Falta confirmar la organización')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Revisar perfil' })).toHaveAttribute('href', '/perfil');
    expect(mocks.apiFetch).not.toHaveBeenCalled();
    expect(mocks.operationsResponse).not.toHaveBeenCalled();
  });
});

describe('BusinessMetrics V3.2 observed source points', () => {
  it.each([undefined, null, {}])('does not infer a point count from the real operations normalizer default for %s', async points => {
    const original = mocks.apiFetch.getMockImplementation()!;
    mocks.apiFetch.mockImplementation((path: string, options: any) => path.includes('/operations/heatmap') ? Promise.resolve({
      contract_version: 'operations.heatmap.v1', tenant_slug: 'junin', points,
      render_contract: { state: 'empty' },
    }) : original(path, options));
    renderPage(); await screen.findByText('Importe de pedidos');
    expect(screen.getByText('Puntos con ubicación No disponible')).toBeInTheDocument();
  });
  it('keeps an explicitly supplied empty points array as an observed zero', async () => {
    const original = mocks.apiFetch.getMockImplementation()!;
    mocks.apiFetch.mockImplementation((path: string, options: any) => path.includes('/operations/heatmap') ? Promise.resolve({
      contract_version: 'operations.heatmap.v1', tenant_slug: 'junin', points: [],
      render_contract: { state: 'empty' },
    }) : original(path, options));
    renderPage(); await screen.findByText('Importe de pedidos');
    expect(screen.getByText('Puntos con ubicación 0')).toBeInTheDocument();
  });
});
