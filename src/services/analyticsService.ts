import { apiClient } from '@/api/client';
import { apiFetch } from '@/utils/api';

// Using apiClient as base or axios if preferred.
// The prompt example used `api` from `axiosConfig`, but I should align with the project's `apiFetch`.

export interface AnalyticsFilters {
  tenant_id?: number;
  from?: string; // ISO Date
  to?: string;   // ISO Date
  context?: 'overview' | 'municipio' | 'pyme';
  channel?: string;
  tenantSlug?: string; // Add slug support if needed by backend or internal logic
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

export const analyticsService = {
  getSummary: async (filters: AnalyticsFilters): Promise<AnalyticsSummary> => {
    const params = new URLSearchParams();
    if (filters.tenant_id) params.append('tenant_id', filters.tenant_id.toString());
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
    if (filters.context) params.append('context', filters.context);
    if (filters.channel) params.append('channel', filters.channel);

    // Using apiFetch which is the standard here
    // Adjust endpoint path if necessary, guide says /api/analytics/summary
    // I need to ensure tenant context is passed if needed by middleware,
    // but the guide passes tenant_id in query params.
    return apiFetch<AnalyticsSummary>(`/api/analytics/summary?${params.toString()}`, {
        tenantSlug: filters.tenantSlug
    });
  },

  getHeatmap: async (filters: AnalyticsFilters) => {
    const params = new URLSearchParams();
    if (filters.tenant_id) params.append('tenant_id', filters.tenant_id.toString());
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);

    const response = await apiFetch<{ points: any[] }>(`/api/analytics/heatmap?${params.toString()}`, {
        tenantSlug: filters.tenantSlug
    });
    return response.points;
  },

  getInsights: async (tenantId: number, tenantSlug?: string) => {
    const response = await apiFetch<{ insights: any[] }>(`/api/analytics/insights?tenant_id=${tenantId}`, {
        tenantSlug
    });
    return response.insights;
  }
};
