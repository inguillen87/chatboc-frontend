import { apiFetch } from '@/utils/api';

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

export const analyticsService = {
  getSummary: async (filters: AnalyticsFilters): Promise<AnalyticsSummary> => {
    const query = buildQuery({ ...filters, scope: filters.scope ?? filters.context ?? 'municipio' });
    const response = await apiFetch<any>(`/admin/analytics/overview?${query}`, {
      tenantSlug: filters.tenantSlug,
    });
    return normalizeAnalyticsSummary(response);
  },

  getHeatmap: async (filters: AnalyticsFilters) => {
    const query = buildQuery({ ...filters, scope: filters.scope ?? filters.context ?? 'municipio' });
    const response = await apiFetch<any>(`/admin/analytics/heatmap?${query}`, {
      tenantSlug: filters.tenantSlug,
    });
    return response?.points || response?.geo_points || response?.heatmap_points || [];
  },

  getInsights: async (tenantId: number, tenantSlug?: string) => {
    const response = await apiFetch<{ insights: any[] }>(`/admin/analytics/overview?tenant_id=${tenantId}`, {
      tenantSlug,
    });
    return response?.insights || [];
  },

  exportCsvUrl: (filters: AnalyticsFilters) => `/admin/analytics/export.csv?${buildQuery(filters)}`,
  exportPdfUrl: (filters: AnalyticsFilters) => `/admin/analytics/export.pdf?${buildQuery(filters)}`,
};
