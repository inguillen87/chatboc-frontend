import { AnalyticsSummary } from '@/types/analytics';
import { apiFetch } from '@/utils/api';

const USE_MOCK = true;

const MOCK_SUMMARY: AnalyticsSummary = {
  kpis: {
    total_interactions: 1250,
    active_users: 320,
    avg_response_time_s: 45,
    conversion_rate: 12.5,
    backlog_open: 15,
    sla_breaches: 3
  },
  top_categories: [
    { category: 'Consultas Generales', count: 450 },
    { category: 'Soporte Técnico', count: 320 },
    { category: 'Ventas', count: 210 },
    { category: 'Reclamos', count: 150 },
  ],
  volume_by_day: Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('es-AR', { weekday: 'short' }),
    count: Math.floor(Math.random() * 200) + 50,
  })),
  heatmap_points: Array.from({ length: 20 }, () => ({
    lat: -34.6037 + (Math.random() - 0.5) * 0.1,
    lng: -58.3816 + (Math.random() - 0.5) * 0.1,
    weight: Math.floor(Math.random() * 10) + 1,
  })),
  insights: [
    { text: "Pico de consultas sobre 'Horarios' el lunes a las 10am.", severity: 'medium', confidence: 85, tags: ['Patrones'] },
    { text: "Aumento del 15% en conversión vía WhatsApp.", severity: 'low', confidence: 92, tags: ['Tendencia'] },
    { text: "Categoría 'Reclamos' redujo su tiempo de resolución un 20%.", severity: 'low', confidence: 78, tags: ['Performance'] }
  ]
};

export const analyticsService = {
  getSummary: async (tenantSlug: string, timeRange: string): Promise<AnalyticsSummary> => {
    if (USE_MOCK) {
      return new Promise((resolve) => setTimeout(() => resolve(MOCK_SUMMARY), 800));
    }
    // TODO: Connect to real backend
    // return apiFetch(`/api/analytics/summary?tenant=${tenantSlug}&range=${timeRange}`);
    return MOCK_SUMMARY;
  },

  getHeatmap: async (tenantSlug: string, timeRange: string) => {
      // Stub for dedicated heatmap endpoint if split
      return [];
  }
};
