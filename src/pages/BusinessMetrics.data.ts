import { apiFetch } from '@/utils/api';
import { panelReadOptions } from '@/utils/panelReadOptions';
import { normalizeEmployeeCoverageV2 } from '@/api/v2/saas';
import { extractOperationalCharts } from '@/services/statsService';
import { isRecord, pickCollection, pickText } from '@/utils/responseShape';
import { normalizeHeatmap, getPublicMapConfigV1 } from '@/features/analytics/analyticsApi';
import { assertOperationsResponseScope } from '@/features/analytics/operationsReadState';
import type { PrivateAnalyticsScope } from '@/features/analytics/privateAnalyticsScope';

export interface BusinessKpi { value: number | null; trend: null; reasonCode: string | null }
export interface BusinessKpis {
  total_sales: BusinessKpi; total_orders: BusinessKpi; unique_customers: BusinessKpi;
  avg_order_value: BusinessKpi; currency: string | null;
}
export interface MetricSeries<T> {
  items: T[];
  availability: { state: 'available' | 'unavailable' | 'unknown'; reasonCode: string | null };
}
export const metricNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
export const metricCount = (value: unknown): number | null => {
  const number = metricNumber(value);
  return number !== null && Number.isSafeInteger(number) && number >= 0 ? number : null;
};
export const formatMetricCount = (value: unknown): string => metricCount(value)?.toLocaleString('es-AR') ?? 'No disponible';
// Canonical roots are already admitted DTOs. Unwrap only the one supported envelope.
const metricSource = (value: unknown) => isRecord(value)
  ? value.contract_version === 'business.metrics.v1' ? value : isRecord(value.summary) ? value.summary : value
  : {};
export function normalizeBusinessKpis(summary: unknown, kpis?: unknown): BusinessKpis {
  const first = metricSource(summary), second = metricSource(kpis);
  const source = first.contract_version === 'business.metrics.v1' ? first : second.contract_version === 'business.metrics.v1' ? second : {};
  const availability = isRecord(source.availability) ? source.availability : {};
  const normalize = (key: string, alias?: string): BusinessKpi => {
    const raw = key in source ? source[key] : alias ? source[alias] : undefined;
    const entry = isRecord(raw) ? raw : null;
    const status = isRecord(availability[key]) ? availability[key] : {};
    let value = metricNumber(entry ? 'value' in entry ? entry.value : 'total' in entry ? entry.total : entry.count : raw);
    if ((key === 'total_orders' || key === 'unique_customers') && (value === null || !Number.isSafeInteger(value) || value < 0)) value = null;
    if (status.state === 'unavailable') value = null;
    return { value, trend: null, reasonCode: typeof status.reason_code === 'string' ? status.reason_code : value === null ? 'missing_metric' : null };
  };
  return { total_sales: normalize('total_sales'), total_orders: normalize('total_orders'),
    unique_customers: normalize('unique_customers', 'new_customers'), avg_order_value: normalize('avg_order_value', 'average_order_value'),
    currency: typeof source.currency === 'string' && /^[A-Z]{3}$/.test(source.currency) ? source.currency : null };
}
export function metricReason(reason: string | null): string {
  switch (reason) {
    case 'mixed_or_unknown_currency': return 'Hay pedidos con monedas distintas o sin moneda informada.';
    case 'missing_order_amount': return 'Faltan importes en los pedidos para calcular esta métrica.';
    case 'invalid_order_amount': return 'Hay importes de pedidos que necesitan revisión.';
    case 'no_orders': return 'El promedio estará disponible cuando haya pedidos.';
    case 'scope_unverified': return 'Confirmá el perfil de la organización para consultar esta métrica.';
    case 'request_failed': return 'No pudimos consultar este dato. Actualizá las métricas para reintentar.';
    default: return 'Todavía no hay un dato confirmado para esta métrica.';
  }
}
export const formatBusinessAmount = (value: number, currency: string | null) =>
  value.toLocaleString('es-AR', { maximumFractionDigits: 2 }) + (currency ? ' ' + currency : ' · moneda no informada');
const statusOf = (error: unknown) => isRecord(error) && typeof error.status === 'number' ? error.status : null;
const isAuthorityError = (error: unknown) => [401, 403].includes(statusOf(error)) || (isRecord(error) && error.name === 'AbortError');
const isRecoverable = (error: unknown) => [404, 405, 408, 429, 500, 502, 503, 504].includes(statusOf(error)) || error instanceof TypeError;
const emptySeries = <T>(reasonCode = 'request_failed'): MetricSeries<T> => ({ items: [], availability: { state: 'unavailable', reasonCode } });
const BUSINESS_METRIC_KEYS = ['total_sales', 'total_orders', 'unique_customers', 'new_customers', 'avg_order_value', 'conversion_rate', 'trend'] as const;
const businessContractFailure = (reasonCode = 'invalid_contract') => Object.assign(
  new Error(reasonCode === 'scope_unverified' ? 'Falta confirmar el perfil de la organización.' : 'El servicio no entregó un contrato de métricas completo.'),
  { status: 502, code: 'business_metrics_contract_invalid', reasonCode },
);
const admitBusinessMetrics = (payload: unknown, tenantId: number) => {
  const source = metricSource(payload);
  const candidates = isRecord(payload) && source !== payload ? [payload, source] : [source];
  for (const candidate of candidates) {
    if (!isRecord(candidate.scope) || !('tenant_id' in candidate.scope)) continue;
    const supplied = metricCount(candidate.scope.tenant_id);
    if (supplied === null || supplied <= 0) throw businessContractFailure();
    if (supplied !== tenantId) throw Object.assign(new Error('Las métricas no corresponden a la organización seleccionada.'), {
      status: 403, code: 'business_metrics_scope_mismatch',
    });
  }
  if (source.contract_version !== 'business.metrics.v1'
      || !BUSINESS_METRIC_KEYS.every(key => key in source)
      || !('currency' in source) || !isRecord(source.availability) || !isRecord(source.scope)
      || metricCount(source.scope.tenant_id) !== tenantId
      || source.scope.source !== 'pyme_pedido' || source.scope.period !== 'all_time'
      || source.scope.order_states !== 'all_recorded_states'
      || !BUSINESS_METRIC_KEYS.every(key => isRecord(source.availability[key])
        && (source.availability[key].state === 'available' || source.availability[key].state === 'unavailable'))) {
    throw businessContractFailure();
  }
  return source;
};
export async function readBusinessMetrics(scope: PrivateAnalyticsScope, signal: AbortSignal, isCurrent: () => boolean) {
  let authorityFailure: unknown = null;
  const live = () => authorityFailure === null && isCurrent() && !signal.aborted;
  const assertCurrent = () => {
    if (authorityFailure !== null) throw authorityFailure;
    if (!isCurrent() || signal.aborted) throw new DOMException('Business metrics scope retired', 'AbortError');
  };
  const guarded = async <T>(task: () => Promise<T>): Promise<T> => {
    assertCurrent();
    try {
      const result = await task();
      assertCurrent();
      return result;
    } catch (error) {
      // Revoke this batch as soon as any authority failure is observed. Other
      // responses and compatibility reads must share this same live callback.
      if (isAuthorityError(error) && authorityFailure === null) authorityFailure = error;
      throw error;
    }
  };
  const options = { ...panelReadOptions(scope.tenantSlug), signal, isCurrent: live };
  const read = <T>(path: string, extra: Parameters<typeof apiFetch>[1] = {}): Promise<T> =>
    guarded(() => apiFetch<T>(path, { ...options, ...extra }));
  const readCanonical = (path: string): Promise<Record<string, any>> => guarded(async () => {
    if (!Number.isSafeInteger(scope.tenantId) || scope.tenantId === null || scope.tenantId <= 0) {
      throw businessContractFailure('scope_unverified');
    }
    const payload = await apiFetch<unknown>(path, options);
    return admitBusinessMetrics(payload, scope.tenantId);
  });
  const readSeries = async (path: string, keys: string[]): Promise<MetricSeries<Record<string, any>>> => {
    const availability: MetricSeries<unknown>['availability'] = { state: 'unknown', reasonCode: null };
    const payload = await read<unknown>(path, { onResponse: (response) => {
      const header = response.headers.get('X-Metrics-Availability');
      if (header === 'available' || header === 'unavailable') availability.state = header;
      availability.reasonCode = response.headers.get('X-Metrics-Reason');
    } });
    return { items: availability.state === 'unavailable' ? [] : pickCollection<Record<string, any>>(payload, keys), availability };
  };
  const tenantPath = '/api/admin/tenants/' + encodeURIComponent(scope.tenantSlug);
  const heatmap = async () => {
    try {
      assertCurrent();
      const result = await guarded(async () => {
        const raw = await apiFetch<unknown>('/api/v2/analytics/operations/heatmap?range=30d&include_ai=0', options);
        assertCurrent();
        assertOperationsResponseScope(raw, scope.tenantSlug);
        return { operations: normalizeHeatmap(raw), pointsObserved: isRecord(raw) && Array.isArray(raw.points) };
      });
      assertCurrent();
      return { ...result, legacy: null };
    } catch (error) {
      assertCurrent();
      if (!isRecoverable(error) || isAuthorityError(error)) throw error;
      const legacy = await read<Record<string, any>>(tenantPath + '/heatmap-summary?since_days=30&point_limit=150');
      return { operations: null, legacy, pointsObserved: Array.isArray(legacy.heatmap_points) };
    }
  };
  const coverage = async () => {
    let raw: unknown;
    try { raw = await read('/api/v2/tenants/' + encodeURIComponent(scope.tenantSlug) + '/employee-coverage'); }
    catch (error) {
      assertCurrent();
      if (![404, 405, 501].includes(statusOf(error))) throw error;
      raw = await read(tenantPath + '/employees/coverage');
    }
    const normalized = normalizeEmployeeCoverageV2(raw);
    // The shared normalizer retains each bucket's raw source but defaults an
    // absent count to zero. This page must keep absence distinct from real zero.
    const preserveCounts = (buckets: typeof normalized.categories = []) => buckets.map(bucket => {
      const bucketSource: unknown = 'raw' in bucket ? bucket.raw : bucket;
      const source = isRecord(bucketSource) ? bucketSource : {};
      return { ...bucket, count: metricCount(source.count ?? source.employees ?? source.employee_count
        ?? source.value ?? source.covered ?? source.total) };
    });
    const categories = preserveCounts(normalized.categorias);
    const zones = preserveCounts(normalized.zonas);
    const channels = preserveCounts(normalized.canales);
    const permissions = preserveCounts(normalized.permisos);
    return { ...normalized, categories, zones, channels, categorias: categories, zonas: zones,
      canales: channels, permisos: permissions, items: [...categories, ...zones, ...channels, ...permissions] };
  };
  const results = await Promise.allSettled([
    read<Record<string, any> | null>(tenantPath + '/dashboard-bundle?since_days=30'),
    heatmap(),
    guarded(() => getPublicMapConfigV1({ tenantSlug: scope.tenantSlug, isCurrent: live })),
    coverage(),
    readCanonical('/api/metrics/summary'),
    readCanonical('/api/metrics/kpis'),
    readSeries('/api/metrics/sales-over-time?period=30d', ['data', 'items', 'sales', 'points']),
    readSeries('/api/metrics/top-products?limit=5', ['products', 'items', 'data', 'results']),
    readSeries('/api/metrics/sales-by-region', ['regions', 'items', 'data', 'results']),
    read<unknown>('/api/estadisticas/tickets?tipo=' + encodeURIComponent(scope.kind || 'pyme') + '&tenant_slug=' + encodeURIComponent(scope.tenantSlug)),
  ] as const);
  assertCurrent();
  for (const item of results) if (item.status === 'rejected' && isAuthorityError(item.reason)) throw item.reason;
  const value = <T>(item: PromiseSettledResult<T>, fallback: T): T => item.status === 'fulfilled' ? item.value : fallback;
  const summary = value(results[4], null), kpis = value(results[5], null);
  const normalizedKpis = normalizeBusinessKpis(summary, kpis);
  const metricResults = [results[4], results[5]];
  const noConfirmedMetric = (['total_sales', 'total_orders', 'unique_customers', 'avg_order_value'] as const)
    .every(key => normalizedKpis[key].value === null);
  if (noConfirmedMetric && metricResults.some(item => item.status === 'rejected')) {
    const reasonCode = metricResults.some(item => item.status === 'rejected' && isRecord(item.reason)
      && item.reason.reasonCode === 'scope_unverified') ? 'scope_unverified' : 'request_failed';
    for (const key of ['total_sales', 'total_orders', 'unique_customers', 'avg_order_value'] as const) normalizedKpis[key].reasonCode = reasonCode;
  }
  return {
    dashboardBundle: value(results[0], null),
    heatmap: value(results[1], { operations: null, legacy: null, pointsObserved: false }),
    mapConfig: value(results[2], null), employeeCoverage: value(results[3], null),
    summary: pickText(summary), kpis: normalizedKpis,
    sales: value(results[6], emptySeries()), products: value(results[7], emptySeries()), regions: value(results[8], emptySeries()),
    ticketCharts: extractOperationalCharts(value(results[9], null)),
  };
}
