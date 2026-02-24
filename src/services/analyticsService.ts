import { ApiError, apiFetch } from '@/utils/api';

export interface AnalyticsFilters {
  tenant_id?: number;
  from?: string;
  to?: string;
  context?: 'overview' | 'municipio' | 'pyme';
  scope?: string;
  channel?: string;
  tz?: string;
  tenantSlug?: string;
}

export interface AnalyticsSummary {
  kpis: {
    total_interactions: number;
    active_users: number;
    avg_response_time_s: number;
    conversion_rate?: number;
    backlog_open?: number;
    sla_breaches?: number;
  };
  top_categories: { category: string; count: number }[];
  volume_by_day: { date: string; count: number }[];
  heatmap_points: { lat: number; lng: number; weight: number }[];
  insights: any[];
}

export interface AnalyticsHubResponse {
  tenant_id?: string | number;
  scope?: string;
  period?: { from?: string | null; to?: string | null };
  sections?: {
    general?: unknown;
    municipio?: unknown;
    ventas?: unknown;
    mapas?: unknown;
  };
  meta?: {
    contract_version?: string;
    generated_at?: string;
    request_id?: string;
    cache?: string;
  };
  navigation?: {
    primary?: Array<{ key?: string; path?: string; active?: boolean }>;
    encuestas?: {
      admin_list_endpoint?: string;
      templates_endpoint?: string;
      seed_demo_endpoint_template?: string;
      public_results_endpoint_template?: string;
    };
  };
}

const HUB_ENDPOINTS = [
  '/api/admin/analytics/hub',
  '/api/admin/analytics/dashboard',
  '/admin/analytics/hub',
  '/admin/analytics/dashboard',
] as const;

const hubCache = new Map<string, { etag?: string; data: AnalyticsHubResponse }>();

const createRequestId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // no-op
  }
  return `analytics-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const buildAnalyticsHeaders = (etag?: string) => {
  const headers: Record<string, string> = {
    'X-Request-Id': createRequestId(),
  };
  if (etag) {
    headers['If-None-Match'] = etag;
  }
  return headers;
};


const buildQuery = (filters: AnalyticsFilters) => {
  const params = new URLSearchParams();
  if (filters.tenant_id) params.append('tenant_id', String(filters.tenant_id));
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);
  if (filters.scope) params.append('scope', filters.scope);
  if (filters.tz) params.append('tz', filters.tz);
  return params.toString();
};

const normalizeAnalyticsSummary = (payload: any): AnalyticsSummary => {
  const totals = payload?.totals ?? {};
  const rawKpis = payload?.kpis ?? {};

  const kpis = {
    total_interactions: Number(rawKpis.total_interactions ?? totals.total_interactions ?? 0) || 0,
    active_users: Number(rawKpis.active_users ?? totals.active_users ?? totals.unique_users ?? 0) || 0,
    avg_response_time_s: Number(rawKpis.avg_response_time_s ?? totals.avg_response_time_s ?? 0) || 0,
    conversion_rate: Number(rawKpis.conversion_rate ?? totals.conversion_rate ?? 0) || 0,
    backlog_open: Number(rawKpis.backlog_open ?? totals.backlog_open ?? 0) || 0,
    sla_breaches: Number(rawKpis.sla_breaches ?? totals.sla_breaches ?? 0) || 0,
  };

  return {
    kpis,
    top_categories: Array.isArray(payload?.top_categories) ? payload.top_categories : [],
    volume_by_day: Array.isArray(payload?.volume_by_day) ? payload.volume_by_day : [],
    heatmap_points: Array.isArray(payload?.heatmap_points) ? payload.heatmap_points : [],
    insights: Array.isArray(payload?.insights) ? payload.insights : [],
  };
};

const getHubCacheKey = (filters: AnalyticsFilters) => `${filters.tenantSlug || ''}|${buildQuery(filters)}`;

const extractHubSectionSummary = (hub: AnalyticsHubResponse | null | undefined, section: 'general' | 'municipio' | 'ventas'): AnalyticsSummary | null => {
  const raw = hub?.sections?.[section];
  if (!raw || typeof raw !== 'object') return null;

  const payload = raw as Record<string, unknown>;
  const hasSignal =
    (payload.kpis && typeof payload.kpis === 'object' && Object.keys(payload.kpis).length > 0) ||
    (payload.totals && typeof payload.totals === 'object' && Object.keys(payload.totals).length > 0) ||
    (Array.isArray(payload.top_categories) && payload.top_categories.length > 0) ||
    (Array.isArray(payload.volume_by_day) && payload.volume_by_day.length > 0) ||
    (Array.isArray(payload.heatmap_points) && payload.heatmap_points.length > 0) ||
    (Array.isArray(payload.insights) && payload.insights.length > 0);

  if (!hasSignal) return null;
  return normalizeAnalyticsSummary(payload);
};

export const analyticsService = {
  getHub: async (filters: AnalyticsFilters): Promise<AnalyticsHubResponse | null> => {
    const query = buildQuery({ ...filters, scope: filters.scope ?? filters.context ?? 'municipio' });
    const cacheKey = getHubCacheKey(filters);
    const cached = hubCache.get(cacheKey);
    let responseEtag = cached?.etag;

    for (const endpoint of HUB_ENDPOINTS) {
      try {
        const response = await apiFetch<AnalyticsHubResponse>(`${endpoint}?${query}`, {
          tenantSlug: filters.tenantSlug,
          headers: buildAnalyticsHeaders(cached?.etag),
          onResponse: (raw) => {
            const nextEtag = raw.headers.get('ETag') || raw.headers.get('etag');
            if (nextEtag) responseEtag = nextEtag;
          },
        });
        const normalized = response && typeof response === 'object' ? response : {};
        hubCache.set(cacheKey, { data: normalized, etag: responseEtag });
        return normalized;
      } catch (error) {
        if (error instanceof ApiError && error.status === 304 && cached?.data) {
          return cached.data;
        }
        const shouldRetryAlias =
          error instanceof ApiError && [401, 403, 404, 405, 500, 502, 503, 504].includes(error.status);
        if (!shouldRetryAlias) {
          throw error;
        }
      }
    }

    return cached?.data ?? null;
  },

  getSummary: async (filters: AnalyticsFilters, hubOverride?: AnalyticsHubResponse | null): Promise<AnalyticsSummary> => {
    const hub = hubOverride ?? await analyticsService.getHub(filters).catch(() => null);
    const contextKey = (filters.context === 'pyme' ? 'ventas' : filters.context === 'overview' ? 'general' : filters.context) as 'general' | 'municipio' | 'ventas' | undefined;
    const hubSummary = contextKey ? extractHubSectionSummary(hub, contextKey) : null;
    if (hubSummary) return hubSummary;

    const query = buildQuery({ ...filters, scope: filters.scope ?? filters.context ?? 'municipio' });
    const response = await apiFetch<any>(`/admin/analytics/overview?${query}`, {
      tenantSlug: filters.tenantSlug,
      headers: buildAnalyticsHeaders(),
    });
    return normalizeAnalyticsSummary(response);
  },

  getHeatmap: async (filters: AnalyticsFilters, hubOverride?: AnalyticsHubResponse | null) => {
    const hub = hubOverride ?? await analyticsService.getHub(filters).catch(() => null);
    const hubMap = hub?.sections?.mapas as Record<string, unknown> | undefined;
    const hubGeo = (hubMap?.geo as Record<string, unknown> | undefined) ?? hubMap;
    const hubPoints = (hubGeo?.points ?? hubGeo?.geo_points ?? hubGeo?.heatmap_points) as unknown;
    if (Array.isArray(hubPoints)) {
      return hubPoints;
    }

    const query = buildQuery({ ...filters, scope: filters.scope ?? filters.context ?? 'municipio' });
    const response = await apiFetch<any>(`/admin/analytics/heatmap?${query}`, {
      tenantSlug: filters.tenantSlug,
      headers: buildAnalyticsHeaders(),
    });
    return response?.points || response?.geo_points || response?.heatmap_points || [];
  },

  getInsights: async (tenantId: number, tenantSlug?: string) => {
    const response = await apiFetch<{ insights: any[] }>(`/admin/analytics/overview?tenant_id=${tenantId}`, {
      tenantSlug,
      headers: buildAnalyticsHeaders(),
    });
    return response?.insights || [];
  },

  exportCsvUrl: (filters: AnalyticsFilters) => `/admin/analytics/export.csv?${buildQuery(filters)}`,
  exportPdfUrl: (filters: AnalyticsFilters) => `/admin/analytics/export.pdf?${buildQuery(filters)}`,
};
