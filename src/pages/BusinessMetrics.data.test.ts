import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readBusinessMetrics, normalizeBusinessKpis, metricNumber } from './BusinessMetrics.data';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { resetBackendBootstrapGateForTests } from '@/utils/backendBootstrapGate';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import type { PrivateAnalyticsScope } from '@/features/analytics/privateAnalyticsScope';

vi.mock('@/utils/api', async original => original<typeof import('@/utils/api')>());
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api',
}));
const scope: PrivateAnalyticsScope = { tenantSlug: 'qa-private', tenantId: 22, kind: 'pyme', scopeKey: 'synthetic-actor:qa-private', platformAdmin: false };
const dto = {
  contract_version: 'business.metrics.v1', scope: { tenant_id: 22, source: 'pyme_pedido', period: 'all_time', order_states: 'all_recorded_states' }, total_sales: 1250, total_orders: 2, unique_customers: 1,
  new_customers: 1, avg_order_value: 625, currency: 'ARS', trend: null, conversion_rate: null,
  availability: { total_sales: { state: 'available' }, total_orders: { state: 'available' },
    unique_customers: { state: 'available' }, avg_order_value: { state: 'available' },
    new_customers: { state: 'available' }, conversion_rate: { state: 'unavailable', reason_code: 'missing_conversion_denominator' },
    trend: { state: 'unavailable', reason_code: 'missing_comparison_period' } },
};
const originalFetch = global.fetch;
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const pathOf = (url: unknown) => new URL(String(url), 'https://synthetic.example.invalid').pathname;
const terminal = (status: number) => json({ contract_version: 'shared.error.v1', status_code: status,
  reason_code: 'synthetic_unavailable', retryable: false, error: { code: status, message: 'Dato no disponible' } }, status);
function responseFor(url: unknown) {
  const path = pathOf(url);
  if (path.endsWith('/metrics/summary') || path.endsWith('/metrics/kpis')) return json(dto);
  if (path.includes('/operations/heatmap')) return json({ contract_version: 'operations.heatmap.v1', tenant_slug: scope.tenantSlug,
    points: [], cells: [], hotspots: [], facets: [], category_layers: [], render_contract: { state: 'empty', can_render_heatmap: false } });
  if (path.endsWith('/map/config')) return json({ contract_version: 'public.map_config.v1', tenant_slug: scope.tenantSlug, provider: 'maplibre' });
  if (path.endsWith('/employee-coverage')) return json({ categorias: [], zonas: [], permisos: [] });
  if (path.endsWith('/estadisticas/tickets')) return json({ charts: [{ title: 'Estado', data: { abiertos: 2 } }] });
  const reasons: Record<string, string> = { 'sales-over-time': 'sales_timeseries_not_supported', 'top-products': 'product_sales_not_supported', 'sales-by-region': 'regional_sales_not_supported' };
  const series = Object.keys(reasons).find(name => path.endsWith('/' + name));
  if (series) return json([], 200, { 'X-Metrics-Availability': 'unavailable', 'X-Metrics-Reason': reasons[series] });
  return json({});
}
beforeEach(() => {
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  safeLocalStorage.clear();
  safeLocalStorage.setItem('tenantSlug', 'unrelated-public-organization');
  safeLocalStorage.setItem('entityToken', 'synthetic-public-entity');
  safeLocalStorage.setItem('chatSessionId', 'synthetic-public-chat');
  usePanelSessionStore.setState({ authToken: 'synthetic-panel-session', user: { id: 'actor-a', email: 'actor@example.invalid', rol: 'superadmin' } as any });
  useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-widget-session', entityToken: 'synthetic-public-entity' });
  global.fetch = vi.fn().mockImplementation(async url => responseFor(url));
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  global.fetch = originalFetch; vi.restoreAllMocks(); vi.unstubAllEnvs(); resetBackendBootstrapGateForTests();
  safeLocalStorage.clear(); usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
});

describe('BusinessMetrics seam through real apiFetch and synthetic HTTP', () => {
  it('pins every request to the private organization, without widget credentials or global tenant writes', async () => {
    const result = await readBusinessMetrics(scope, new AbortController().signal, () => true);
    expect(result.kpis.total_sales.value).toBe(1250);
    expect(result.kpis.currency).toBe('ARS');
    expect(result.ticketCharts).toEqual([{ title: 'Estado', data: { Abiertos: 2 } }]);
    expect(result.sales).toEqual({ items: [], availability: { state: 'unavailable', reasonCode: 'sales_timeseries_not_supported' } });
    expect(result.products.availability.reasonCode).toBe('product_sales_not_supported');
    expect(result.regions.availability.reasonCode).toBe('regional_sales_not_supported');
    const calls = vi.mocked(global.fetch).mock.calls;
    expect(calls).toHaveLength(10);
    for (const [, options] of calls) {
      const headers = new Headers(options?.headers);
      expect(headers.get('X-Tenant')).toBe('qa-private');
      expect(headers.get('X-Tenant-Slug')).toBe('qa-private');
      expect(headers.get('Authorization')).toBe('Bearer synthetic-panel-session');
      expect(headers.has('X-Entity-Token')).toBe(false);
      expect(headers.has('X-Chat-Session-Id')).toBe(false);
      expect(options?.credentials).toBe('include');
    }
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('unrelated-public-organization');
  });
  it('keeps confirmed totals when only a secondary product request fails', async () => {
    global.fetch = vi.fn().mockImplementation(async url => pathOf(url).endsWith('/top-products') ? terminal(503) : responseFor(url));
    const result = await readBusinessMetrics(scope, new AbortController().signal, () => true);
    expect(result.kpis.total_sales.value).toBe(1250);
    expect(result.products).toEqual({ items: [], availability: { state: 'unavailable', reasonCode: 'request_failed' } });
    expect(result.sales.availability.reasonCode).toBe('sales_timeseries_not_supported');
  });
  it('uses the real tenant heatmap summary after a recoverable primary response', async () => {
    global.fetch = vi.fn().mockImplementation(async url => pathOf(url).includes('/operations/heatmap') ? terminal(503)
      : pathOf(url).endsWith('/heatmap-summary') ? json({ heatmap_points: [{ lat: -34.5, lng: -60.9, source: 'ticket' }] }) : responseFor(url));
    const result = await readBusinessMetrics(scope, new AbortController().signal, () => true);
    expect(result.heatmap.operations).toBeNull();
    expect(result.heatmap.legacy?.heatmap_points).toHaveLength(1);
    expect(vi.mocked(global.fetch).mock.calls.filter(([url]) => pathOf(url).endsWith('/heatmap-summary'))).toHaveLength(1);
  });
  it('never requests a legacy heatmap after an HTTP authorization failure', async () => {
    global.fetch = vi.fn().mockImplementation(async url => pathOf(url).includes('/operations/heatmap') ? terminal(403) : responseFor(url));
    await expect(readBusinessMetrics(scope, new AbortController().signal, () => true)).rejects.toMatchObject({ status: 403 });
    expect(vi.mocked(global.fetch).mock.calls.some(([url]) => pathOf(url).endsWith('/heatmap-summary'))).toBe(false);
  });
  it.each(['revision', 'actor'] as const)('rejects old HTTP responses after a same-scope %s transition before response side effects', async change => {
    const waiting: Array<{ url: unknown; resolve: (response: Response) => void }> = [];
    global.fetch = vi.fn().mockImplementation(url => new Promise<Response>(resolve => waiting.push({ url, resolve })));
    const result = readBusinessMetrics(scope, new AbortController().signal, () => true);
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(waiting).toHaveLength(10));
    if (change === 'revision') advanceChatbocSessionRevision();
    else usePanelSessionStore.setState({ user: { id: 'actor-b', email: 'actor-b@example.invalid', rol: 'superadmin' } as any });
    for (const entry of waiting) entry.resolve(json({}, 200, { 'X-Anon-Id': 'retired-response-identity' }));
    await rejected;
    expect(safeLocalStorage.getItem('anon_id')).toBeNull();
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('unrelated-public-organization');
    expect(global.fetch).toHaveBeenCalledTimes(10);
  });
  it('retires a complete attempt before dispatch when its scope is no longer current', async () => {
    await expect(readBusinessMetrics(scope, new AbortController().signal, () => false)).rejects.toMatchObject({ name: 'AbortError' });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('BusinessMetrics missing-value contract', () => {
  it.each([null, undefined, '', '  ', false, true, NaN, Infinity])('never coerces missing or invalid %s into a confirmed zero', value => {
    expect(metricNumber(value)).toBeNull();
    const result = normalizeBusinessKpis({ ...dto, total_sales: value });
    expect(result.total_sales.value).toBeNull();
    expect(result.total_sales.trend).toBeNull();
  });
  it('prefers the summary DTO and preserves an explicitly null canonical customer count over a legacy alias', () => {
    expect(normalizeBusinessKpis({ ...dto, unique_customers: null, new_customers: 8 }, { ...dto, total_sales: 9999 }).unique_customers.value).toBeNull();
    expect(normalizeBusinessKpis(dto, { ...dto, total_sales: 9999 }).total_sales.value).toBe(1250);
  });
  it('keeps real zero and respects unavailable metadata even when a numeric value is present', () => {
    expect(normalizeBusinessKpis({ ...dto, total_sales: 0 }).total_sales.value).toBe(0);
    const result = normalizeBusinessKpis({ ...dto, availability: { total_sales: { state: 'unavailable', reason_code: 'mixed_or_unknown_currency' } } });
    expect(result.total_sales).toMatchObject({ value: null, reasonCode: 'mixed_or_unknown_currency', trend: null });
  });
});

describe('BusinessMetrics independent peer counterexamples', () => {
  it('rejects a v1 DTO with a contradictory tenant receipt even when the request tenant is pinned', async () => {
    global.fetch = vi.fn().mockImplementation(async url => pathOf(url).endsWith('/metrics/summary')
      ? json({ ...dto, scope: { tenant_id: 999, source: 'pyme_pedido', period: 'all_time', order_states: 'all_recorded_states' } }) : responseFor(url));
    await expect(readBusinessMetrics(scope, new AbortController().signal, () => true))
      .rejects.toMatchObject({ status: 403, code: 'business_metrics_scope_mismatch' });
  });
  it('revokes the local batch before a later recoverable heatmap error can dispatch a legacy read', async () => {
    let resolveSummary!: (response: Response) => void;
    let resolveHeatmap!: (response: Response) => void;
    global.fetch = vi.fn().mockImplementation(url => pathOf(url).endsWith('/metrics/summary')
      ? new Promise<Response>(resolve => { resolveSummary = resolve; })
      : pathOf(url).includes('/operations/heatmap') ? new Promise<Response>(resolve => { resolveHeatmap = resolve; })
        : Promise.resolve(responseFor(url)));
    const api = await import('@/utils/api');
    const spy = vi.spyOn(api, 'apiFetch');
    const attempt = readBusinessMetrics(scope, new AbortController().signal, () => true);
    const rejected = expect(attempt).rejects.toMatchObject({ status: 403 });
    await vi.waitFor(() => expect(resolveSummary && resolveHeatmap).toBeTypeOf('function'));
    const summaryIndex = spy.mock.calls.findIndex(([path]) => path.includes('/metrics/summary'));
    const summaryPromise = spy.mock.results[summaryIndex].value;
    resolveSummary(terminal(403));
    await expect(summaryPromise).rejects.toMatchObject({ status: 403 });
    const lateHeatmap = terminal(503); lateHeatmap.headers.set('X-Anon-Id', 'retired-heatmap-response');
    resolveHeatmap(lateHeatmap);
    await rejected;
    expect(safeLocalStorage.getItem('anon_id')).toBeNull();
    expect(vi.mocked(global.fetch).mock.calls.some(([url]) => pathOf(url).endsWith('/heatmap-summary'))).toBe(false);
  });
});

describe('BusinessMetrics V3 real coverage absence', () => {
  it('preserves absent coverage counts through the public normalizer instead of inheriting its zero default', async () => {
    global.fetch = vi.fn().mockImplementation(async url => pathOf(url).endsWith('/employee-coverage') ? json({
      categories: [{ label: 'missing' }, { label: 'observed-zero', count: 0 }, { label: 'null-count', count: null },
        { label: 'blank-count', count: ' ' }, { label: 'observed-employees', employees: 3 }],
      permissions: ['label-only'],
    }) : responseFor(url));
    const result = await readBusinessMetrics(scope, new AbortController().signal, () => true);
    expect(result.employeeCoverage?.categorias.map(item => item.count)).toEqual([null, 0, null, null, 3]);
    expect(result.employeeCoverage?.permisos[0].count).toBeNull();
  });
});

describe('BusinessMetrics V3 canonical admission and error provenance', () => {
  it.each(['/api/metrics/summary', '/api/metrics/kpis'])('rejects a wrapped foreign receipt at %s using the same extracted source that normalizes', async endpoint => {
    global.fetch = vi.fn().mockImplementation(async url => pathOf(url) === endpoint
      ? json({ summary: { ...dto, total_sales: 77, scope: { ...dto.scope, tenant_id: 999 } } }) : responseFor(url));
    await expect(readBusinessMetrics(scope, new AbortController().signal, () => true))
      .rejects.toMatchObject({ status: 403, code: 'business_metrics_scope_mismatch' });
  });
  it('never admits incomplete unversioned canonical figures as silent legacy values', async () => {
    const incomplete = { total_sales: 77, total_orders: 1, unique_customers: 1, avg_order_value: 77 };
    global.fetch = vi.fn().mockImplementation(async url => pathOf(url).includes('/metrics/')
      && (pathOf(url).endsWith('/summary') || pathOf(url).endsWith('/kpis')) ? json(incomplete) : responseFor(url));
    const result = await readBusinessMetrics(scope, new AbortController().signal, () => true);
    expect(result.kpis.total_sales.value).toBeNull();
    expect(result.kpis.total_orders.value).toBeNull();
    expect(result.kpis.total_sales.reasonCode).toBe('request_failed');
  });
  it('does not admit canonical figures before an independent profile ID is known', async () => {
    const result = await readBusinessMetrics({ ...scope, tenantId: null }, new AbortController().signal, () => true);
    expect(result.kpis.total_sales).toMatchObject({ value: null, reasonCode: 'scope_unverified' });
    expect(vi.mocked(global.fetch).mock.calls.some(([url]) => ['/api/metrics/summary', '/api/metrics/kpis'].includes(pathOf(url)))).toBe(false);
  });
  it('exposes a failed canonical read when the companion payload has no confirmed metric', async () => {
    global.fetch = vi.fn().mockImplementation(async url => pathOf(url).endsWith('/metrics/summary') ? terminal(500)
      : pathOf(url).endsWith('/metrics/kpis') ? json({}) : responseFor(url));
    const result = await readBusinessMetrics(scope, new AbortController().signal, () => true);
    expect(result.kpis.total_sales).toMatchObject({ value: null, reasonCode: 'request_failed' });
  });
  it('accepts a matching complete envelope and retains genuine zero counts', async () => {
    global.fetch = vi.fn().mockImplementation(async url => pathOf(url).endsWith('/metrics/summary')
      ? json({ summary: { ...dto, total_sales: 0, total_orders: 0, unique_customers: 0, avg_order_value: null, currency: null } }) : responseFor(url));
    const result = await readBusinessMetrics(scope, new AbortController().signal, () => true);
    expect(result.kpis.total_sales.value).toBe(0);
    expect(result.kpis.total_orders.value).toBe(0);
  });
  it('retains explicit WGS84 origin while the real operations normalizer excludes null and blank coordinates', async () => {
    const { isValidWgs84Position } = await import('@/features/analytics/premiumTerritoryHeatmap');
    expect(isValidWgs84Position(0, 0)).toBe(true);
    expect(isValidWgs84Position(null, null)).toBe(false);
    expect(isValidWgs84Position('', ' ')).toBe(false);
    global.fetch = vi.fn().mockImplementation(async url => pathOf(url).includes('/operations/heatmap') ? json({
      contract_version: 'operations.heatmap.v1', tenant_slug: scope.tenantSlug,
      points: [{ id: 'explicit-origin', lat: 0, lng: 0 }, { id: 'missing', lat: null, lng: null }, { id: 'blank', lat: '', lng: ' ' }],
      cells: [], hotspots: [], facets: [], category_layers: [],
      render_contract: { state: 'ready', can_render_heatmap: true },
    }) : responseFor(url));
    const result = await readBusinessMetrics(scope, new AbortController().signal, () => true);
    expect(result.heatmap.operations?.points).toEqual([expect.objectContaining({ id: 'explicit-origin', lat: 0, lng: 0 })]);
  });
});

describe('BusinessMetrics V3.2 idempotent canonical source', () => {
  it.each(['root', 'summary envelope'])('normalizes exactly the admitted %s DTO and never a nested foreign summary', async shape => {
    const foreign = { ...dto, scope: { ...dto.scope, tenant_id: 999 }, total_sales: 999, currency: 'USD' };
    const admitted = { ...dto, summary: foreign };
    global.fetch = vi.fn().mockImplementation(async url => pathOf(url).endsWith('/metrics/summary')
      ? json(shape === 'root' ? admitted : { summary: admitted }) : responseFor(url));
    const result = await readBusinessMetrics(scope, new AbortController().signal, () => true);
    expect(result.kpis.total_sales.value).toBe(1250);
    expect(result.kpis.currency).toBe('ARS');
  });
});

describe('BusinessMetrics V3.2 raw points through actual HTTP and normalization', () => {
  it.each([
    ['absent', undefined, false], ['null', null, false], ['non-array', {}, false], ['explicit empty', [], true],
  ])('retains %s point-array provenance without another operations GET', async (_label, points, observed) => {
    global.fetch = vi.fn().mockImplementation(async url => pathOf(url).includes('/operations/heatmap') ? json({
      contract_version: 'operations.heatmap.v1', tenant_slug: scope.tenantSlug,
      ...(points === undefined ? {} : { points }), render_contract: { state: 'empty' },
    }) : responseFor(url));
    const controller = new AbortController();
    const result = await readBusinessMetrics(scope, controller.signal, () => true);
    expect(result.heatmap.pointsObserved).toBe(observed);
    expect(result.heatmap.operations?.points).toEqual([]);
    const calls = vi.mocked(global.fetch).mock.calls.filter(([url]) => pathOf(url).includes('/operations/heatmap'));
    expect(calls).toHaveLength(1);
    const [url, options] = calls[0];
    const parsed = new URL(String(url), 'https://synthetic.example.invalid');
    expect(parsed.pathname).toBe('/api/v2/analytics/operations/heatmap');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({ range: '30d', include_ai: '0', tenant_slug: scope.tenantSlug, tenant: scope.tenantSlug });
    expect(options?.signal).toBe(controller.signal);
    expect(new Headers(options?.headers).get('X-Tenant-Slug')).toBe(scope.tenantSlug);
  });
  it('retains the shared operations scope rejection without starting a compatibility GET', async () => {
    global.fetch = vi.fn().mockImplementation(async url => pathOf(url).includes('/operations/heatmap') ? json({
      contract_version: 'operations.heatmap.v1', tenant_slug: 'foreign-synthetic', points: [],
    }) : responseFor(url));
    await expect(readBusinessMetrics(scope, new AbortController().signal, () => true)).rejects.toMatchObject({ status: 403 });
    expect(vi.mocked(global.fetch).mock.calls.some(([url]) => pathOf(url).endsWith('/heatmap-summary'))).toBe(false);
  });
});
