import { apiFetch } from '@/utils/api';

export type AnalyticsContext = 'municipio' | 'pyme' | 'operaciones' | string;

export interface AnalyticsFiltersPayload {
  tenantId: string;
  from: string;
  to: string;
  canal?: string[];
  categoria?: string[];
  estado?: string[];
  agente?: string[];
  zona?: string[];
  etiquetas?: string[];
  metric?: string;
  group?: string | null;
  dimension?: string;
  subject?: string;
  bbox?: [number, number, number, number] | null;
  context?: AnalyticsContext;
  search?: string | null;
}

function buildQuery(params: AnalyticsFiltersPayload): string {
  const query = new URLSearchParams();
  query.set('tenant_id', params.tenantId);
  query.set('from', params.from);
  query.set('to', params.to);
  if (params.context) {
    query.set('context', params.context);
  }
  const multi = [
    ['canal', params.canal],
    ['categoria', params.categoria],
    ['estado', params.estado],
    ['agente', params.agente],
    ['zona', params.zona],
    ['etiquetas', params.etiquetas],
  ] as const;
  multi.forEach(([key, value]) => {
    if (value && value.length) {
      query.set(key, value.join(','));
    }
  });
  if (params.metric) query.set('metric', params.metric);
  if (params.group) query.set('group', params.group);
  if (params.dimension) query.set('dimension', params.dimension);
  if (params.subject) query.set('subject', params.subject);
  if (params.search) query.set('search', params.search);
  if (params.bbox) {
    query.set('bbox', params.bbox.join(','));
  }
  return query.toString();
}

export interface SummaryResponse {
  generatedAt: string;
  tenantId: string;
  totals: {
    tickets: number;
    abiertos: number;
    backlog: number;
    adjuntos: number;
  };
  sla: {
    ack: { p50: number; p90: number; p95: number };
    resolve: { p50: number; p90: number; p95: number };
  };
  efficiency: {
    firstContact: number;
    reopenRate: number;
    automationRate: number;
  };
  volume: {
    perDay: { date: string; value: number }[];
    byChannel: { label: string; value: number }[];
    byCategory: { label: string; value: number }[];
    byZone: { label: string; value: number }[];
  };
  quality: {
    byType: { label: string; average: number; responses: number }[];
    byAgent: { label: string; average: number; responses: number }[];
  };
  pyme: {
    totalOrders: number;
    ticketMedio: number;
    ingresos: { date: string; value: number }[];
    topProductos: { label: string; value: number }[];
    conversion: number;
    recurrencia: { d30: number; d60: number; d90: number };
    horasPico: { hour: number; value: number }[];
    canales: { label: string; value: number }[];
    plantillas: {
      plantilla: string;
      envios: number;
      respuestas: number;
      bloqueos: number;
      ctr: number;
    }[];
  };
}

export interface TimeseriesResponse {
  metric: string;
  group: string | null;
  series: { date: string; value: number; breakdown?: Record<string, number> }[];
}

export interface BreakdownResponse {
  dimension: string;
  items: { label: string; value: number }[];
}

export interface HeatmapResponse {
  cells: {
    cellId: string;
    tenant_id: string;
    count: number;
    centroid_lat: number;
    centroid_lon: number;
    breakdown: Record<string, number>;
  }[];
  hotspots: {
    cellId: string;
    count: number;
    centroid: [number, number];
    breakdown: Record<string, number>;
  }[];
  chronic: { zone: string; weeks: { week: string; count: number }[] }[];
}

export interface PointsResponse {
  points: { cellId: string; lat: number; lon: number; categoria: string; estado: string }[];
}

export interface TopResponse {
  subject: string;
  items: { label: string; value: number }[];
}

export interface OperationsResponse {
  abiertos: number;
  slaBreaches: number;
  automated: number;
  agingBuckets: Record<string, number>;
  agents: { agente: string; abiertos: number; tiempoMedio: number; satisfaccion: number }[];
}

export interface CohortsResponse {
  cohorts: { cohort: string; pedidos: number; ingresos: number }[];
}

export interface TemplatesResponse {
  templates: {
    plantilla: string;
    envios: number;
    respuestas: number;
    bloqueos: number;
    ctr: number;
  }[];
}

export interface FilterCatalogResponse {
  canales: string[];
  categorias: string[];
  estados: string[];
  agentes: string[];
  zonas: string[];
  etiquetas: string[];
  tenants?: string[];
  defaultTenantId?: string;
  defaultContext?: AnalyticsContext;
  contexts?: AnalyticsContext[];
}

async function fetcher<T>(endpoint: string, filters: AnalyticsFiltersPayload): Promise<T> {
  const qs = buildQuery(filters);
  return apiFetch<T>(`analytics/${endpoint}?${qs}`);
}

export const analyticsService = {
  summary: (filters: AnalyticsFiltersPayload) => fetcher<SummaryResponse>('summary', filters),
  timeseries: (filters: AnalyticsFiltersPayload) =>
    fetcher<TimeseriesResponse>('timeseries', filters),
  breakdown: (filters: AnalyticsFiltersPayload) =>
    fetcher<BreakdownResponse>('breakdown', filters),
  heatmap: (filters: AnalyticsFiltersPayload) => fetcher<HeatmapResponse>('geo/heatmap', filters),
  points: (filters: AnalyticsFiltersPayload) => fetcher<PointsResponse>('geo/points', filters),
  top: (filters: AnalyticsFiltersPayload) => fetcher<TopResponse>('top', filters),
  operations: (filters: AnalyticsFiltersPayload) =>
    fetcher<OperationsResponse>('operations', filters),
  cohorts: (filters: AnalyticsFiltersPayload) => fetcher<CohortsResponse>('cohorts', filters),
  templates: (filters: AnalyticsFiltersPayload) =>
    fetcher<TemplatesResponse>('whatsapp/templates', filters),
  filters: (filters: AnalyticsFiltersPayload) => fetcher<FilterCatalogResponse>('filters', filters),
};

export type { AnalyticsFiltersPayload as AnalyticsFilters };
