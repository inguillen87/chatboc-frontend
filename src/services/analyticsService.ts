import { AnalyticsSummary } from '@/types/analytics';
import { apiFetch } from '@/utils/api';

const USE_MOCK = true;

const MOCK_SUMMARY: AnalyticsSummary = {
  kpis: {
    total_interactions: 15430,
    active_users: 1205,
    avg_response_time_s: 42,
    conversion_rate: 3.8,
    backlog_open: 15,
    sla_breaches: 2
  },
  top_categories: [
    { category: 'Ventas', count: 450 },
    { category: 'Soporte', count: 320 },
    { category: 'Envíos', count: 210 },
    { category: 'Pagos', count: 180 },
    { category: 'Devoluciones', count: 90 },
  ],
  volume_by_day: [
    { date: 'Lun', count: 2400 },
    { date: 'Mar', count: 1398 },
    { date: 'Mie', count: 9800 },
    { date: 'Jue', count: 3908 },
    { date: 'Vie', count: 4800 },
    { date: 'Sab', count: 3800 },
    { date: 'Dom', count: 4300 },
  ],
  heatmap_points: [
    { lat: -34.6037, lng: -58.3816, weight: 0.9 }, // Obelisco
    { lat: -34.5889, lng: -58.4098, weight: 0.7 }, // Palermo
    { lat: -34.6150, lng: -58.4333, weight: 0.5 }, // Caballito
    { lat: -34.5711, lng: -58.4233, weight: 0.8 }, // Belgrano
    { lat: -34.6212, lng: -58.3731, weight: 0.6 }, // San Telmo
  ],
  insights: [
    { text: 'Pico de consultas sobre "Envíos" los lunes a las 10am.', tags: ['patrón', 'horario'], severity: 'medium' },
    { text: 'El 15% de los usuarios abandona al pedir "Factura A".', tags: ['fricción', 'ventas'], severity: 'high' },
    { text: 'Alta satisfacción en interacciones menores a 2 minutos.', tags: ['calidad'], severity: 'low' },
    { text: 'Spike detectado: "Cortes de luz" en zona Palermo (Cluster #4)', tags: ['alerta', 'infraestructura'], severity: 'high' },
  ],
  // Extended Mock Data for Funnel
  funnel_data: [
    { value: 15000, name: 'Ingresos', fill: '#8884d8' },
    { value: 8500, name: 'Conversaciones', fill: '#83a6ed' },
    { value: 3200, name: 'Leads Calificados', fill: '#8dd1e1' },
    { value: 1200, name: 'Ventas Cerradas', fill: '#82ca9d' }
  ]
} as any;

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
