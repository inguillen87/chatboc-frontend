import { SAME_ORIGIN_PROXY_BASE } from '@/config';
import { ApiError, apiFetch } from '@/utils/api';
import {
  type IdentityCoverageResponseV1,
  parseIdentityCoverageResponseV1,
} from '@/services/identityCoverageContract';

export { parseIdentityCoverageResponseV1 };

const SAME_ORIGIN_API_BASE = SAME_ORIGIN_PROXY_BASE || '/api';

export interface AnalyticsFilters {
  tenant_id?: number;
  from?: string;
  to?: string;
  context?: 'overview' | 'municipio' | 'pyme';
  scope?: string;
  channel?: string;
  tz?: string;
  categoria?: string;
  categorias?: string | string[];
  category?: string;
  categories?: string | string[];
  sexo?: string;
  genero?: string;
  rango_edad?: string;
  barrio?: string;
  distrito?: string;
  canal?: string;
  geo_limit?: number;
  bbox?: string;
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
    voice_interactions_pct?: number;
    video_avatar_interactions_pct?: number;
    no_typing_completion_rate?: number;
    accessibility_usage_rate?: number;
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

export interface RealtimeHubResponse {
  ui?: {
    labels?: {
      filters_channel?: string;
      filters_sentiment?: string;
      filters_search?: string;
      option_all?: string;
      loading?: string;
      empty?: string;
      empty_filtered?: string;
      cards_events?: string;
      cards_survey_responses?: string;
      cards_survey_comments?: string;
      cards_live_chat_comments?: string;
      sections_top_channels?: string;
      sections_top_events?: string;
      sections_sentiment?: string;
      sections_live_comments?: string;
      sections_hotspots_recommendations?: string;
      actions_refresh?: string;
      actions_auto_refresh_on?: string;
      actions_auto_refresh_off?: string;
      tabs_realtime_hub?: string;
    };
  };
  totals?: {
    events?: number;
    survey_responses?: number;
    survey_comments?: number;
    live_chat_comments?: number;
  };
  top_channels?: Array<{ channel?: string; count?: number }>;
  top_events?: Array<{ event?: string; count?: number }>;
  sentiment?: Record<string, number>;
  geo_points?: Array<{ lat?: number; lng?: number; count?: number; channel?: string }>;
  hotspots?: Array<{ label?: string; count?: number }>;
  recommendations?: string[];
  comments?: Array<{ channel?: string; text?: string; created_at?: string; sentiment?: string }>;
}

export interface WhatsappFunnelStage {
  event_name: string;
  label: string;
  sessions: number;
  unique_contacts: number;
  conversion_from_prev_pct: number | null;
}

export interface WhatsappFunnelResponse {
  contract_version: string;
  tenant_id?: number | null;
  scope?: string;
  window_minutes?: number;
  stages: WhatsappFunnelStage[];
}

export interface AnalyticsEventIngestAckV1 {
  ok: true;
  contract_version: 'analytics.event_ingest.v1';
  request_id: string;
  tenant_id: number;
  event_name: string;
  contact_key?: string;
  conversation_id?: string;
  identity_source?: string;
}

export interface AnalyticsEventSchemaV1 {
  contract_version: 'analytics.event_schema.v1';
  request_id: string;
  tenant_id: number;
  required_dimensions: string[];
  recommended_dimensions: string[];
  canonical_events: string[];
}



export interface AnalyticsGeoLayerCategory {
  categoria?: string;
  color?: string;
  event_count?: number;
  total_weight?: number;
  intensity?: number;
  points?: Array<{ lat?: number; lng?: number; weight?: number }>;
}

export interface AnalyticsHeatmapResponse {
  request_id?: string;
  points: Array<{ lat?: number; lng?: number; weight?: number; categoria?: string; canal?: string; severidad?: string; estado?: string }>;
  map_layers?: Record<string, unknown>;
  ui?: {
    labels?: {
      title?: string;
      description?: string;
      empty?: string;
      applied_filters?: string;
      legend?: string;
      filter_categoria?: string;
      filter_severidad?: string;
      filter_estado?: string;
      filter_canal?: string;
      filter_all?: string;
      layers?: string;
    };
    layer_labels?: Record<string, string>;
  };
  geo_layers?: {
    provider?: string;
    contract_version?: string;
    style_url?: string;
    source?: { type?: string; features?: unknown[] };
    source_options?: { cluster?: boolean; clusterMaxZoom?: number; clusterRadius?: number };
    interactions?: { hover?: boolean; time_slider?: { enabled?: boolean; field?: string } };
    layers?: {
      heatmap?: { id?: string; type?: string; source?: string };
      clusters?: { id?: string; type?: string; source?: string };
      points?: { id?: string; type?: string; source?: string };
    };
    telemetry?: { event_endpoint?: string; events?: string[] };
    tiles?: { url?: string; attribution?: string };
    categories?: AnalyticsGeoLayerCategory[];
    legend?: { mode?: string; min_weight?: number; max_weight?: number };
  };
  segments?: Record<string, Array<{ label?: string; count?: number }>>;
  segments_filters_applied?: Record<string, unknown>;
}

export interface AnalyticsGeoPointsResponse {
  request_id?: string;
  points: Array<{ lat?: number; lng?: number; weight?: number; categoria?: string; canal?: string; severidad?: string; estado?: string }>;
  map_layers?: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const parseWhatsappFunnelResponse = (input: unknown): WhatsappFunnelResponse | null => {
  if (!isRecord(input)) return null;
  const contractVersion = typeof input.contract_version === 'string' ? input.contract_version.trim() : '';
  if (!contractVersion) return null;

  const stagesRaw = Array.isArray(input.stages) ? input.stages : [];
  const stages = stagesRaw
    .map((stage) => {
      if (!isRecord(stage)) return null;
      const eventName =
        typeof stage.event_name === 'string' && stage.event_name.trim()
          ? stage.event_name.trim()
          : typeof stage.stage === 'string'
            ? stage.stage.trim()
            : '';
      const label =
        typeof stage.label === 'string' && stage.label.trim()
          ? stage.label.trim()
          : eventName;
      const sessions =
        asFiniteNumber(stage.sessions) ?? asFiniteNumber(stage.count);
      const uniqueContacts = asFiniteNumber(stage.unique_contacts);
      const conversionFromPrevPct =
        stage.conversion_from_prev_pct === null
          ? null
          : asFiniteNumber(stage.conversion_from_prev_pct) ?? null;
      if (!eventName || sessions === undefined || uniqueContacts === undefined) return null;
      return {
        event_name: eventName,
        label,
        sessions,
        unique_contacts: uniqueContacts,
        conversion_from_prev_pct: conversionFromPrevPct,
      };
    })
    .filter((stage): stage is WhatsappFunnelStage => stage !== null);

  return {
    contract_version: contractVersion,
    tenant_id: input.tenant_id === null ? null : asFiniteNumber(input.tenant_id),
    scope: typeof input.scope === 'string' ? input.scope : undefined,
    window_minutes: asFiniteNumber(input.window_minutes),
    stages,
  };
};

export const parseAnalyticsEventIngestAckV1 = (input: unknown): AnalyticsEventIngestAckV1 | null => {
  if (!isRecord(input)) return null;
  if (input.contract_version !== 'analytics.event_ingest.v1') return null;
  if (input.ok !== true) return null;

  const tenantId = asFiniteNumber(input.tenant_id);
  const eventName = typeof input.event_name === 'string' ? input.event_name.trim() : '';
  const requestId = typeof input.request_id === 'string' ? input.request_id.trim() : '';
  if (tenantId === undefined || !eventName || !requestId) return null;

  return {
    ok: true,
    contract_version: 'analytics.event_ingest.v1',
    request_id: requestId,
    tenant_id: tenantId,
    event_name: eventName,
    ...(typeof input.contact_key === 'string' ? { contact_key: input.contact_key } : {}),
    ...(typeof input.conversation_id === 'string' ? { conversation_id: input.conversation_id } : {}),
    ...(typeof input.identity_source === 'string' ? { identity_source: input.identity_source } : {}),
  };
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
    : [];

export const parseAnalyticsEventSchemaV1 = (input: unknown): AnalyticsEventSchemaV1 | null => {
  if (!isRecord(input)) return null;
  if (input.contract_version !== 'analytics.event_schema.v1') return null;
  const tenantId = asFiniteNumber(input.tenant_id);
  const requestId = typeof input.request_id === 'string' ? input.request_id.trim() : '';
  if (tenantId === undefined || !requestId) return null;

  return {
    contract_version: 'analytics.event_schema.v1',
    request_id: requestId,
    tenant_id: tenantId,
    required_dimensions: toStringArray(input.required_dimensions),
    recommended_dimensions: toStringArray(input.recommended_dimensions),
    canonical_events: toStringArray(input.canonical_events),
  };
};

export const getWhatsappFunnel = async (tenantSlug?: string): Promise<WhatsappFunnelResponse> => {
  const requestOptions = { tenantSlug, baseUrlOverride: SAME_ORIGIN_API_BASE };
  try {
    const raw = await apiFetch<unknown>('/admin/analytics/whatsapp-funnel', requestOptions);
    const parsed = parseWhatsappFunnelResponse(raw);
    if (!parsed) {
      throw new ApiError('Respuesta inválida de WhatsApp funnel: falta contract_version o payload inválido.', 502, raw);
    }
    return parsed;
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) {
      throw error;
    }

    const raw = await apiFetch<unknown>('/api/admin/analytics/whatsapp-funnel', requestOptions);
    const parsed = parseWhatsappFunnelResponse(raw);
    if (!parsed) {
      throw new ApiError('Respuesta inválida de WhatsApp funnel: falta contract_version o payload inválido.', 502, raw);
    }
    return parsed;
  }
};

export const getIdentityCoverageV1 = async (tenantSlug?: string): Promise<IdentityCoverageResponseV1> => {
  const requestOptions = { tenantSlug, baseUrlOverride: SAME_ORIGIN_API_BASE };
  try {
    const raw = await apiFetch<unknown>('/analytics/identity/coverage', requestOptions);
    const parsed = parseIdentityCoverageResponseV1(raw);
    if (!parsed) {
      throw new ApiError('Respuesta inválida de identity coverage: contract_version o payload inválido.', 502, raw);
    }
    return parsed;
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) {
      throw error;
    }

    const raw = await apiFetch<unknown>('/api/analytics/identity/coverage', requestOptions);
    const parsed = parseIdentityCoverageResponseV1(raw);
    if (!parsed) {
      throw new ApiError('Respuesta inválida de identity coverage: contract_version o payload inválido.', 502, raw);
    }
    return parsed;
  }
};

export const getAnalyticsEventSchema = async (
  tenantId?: number,
  tenantSlug?: string,
): Promise<AnalyticsEventSchemaV1> => {
  const query = tenantId !== undefined ? `?tenant_id=${tenantId}` : '';
  try {
    const raw = await apiFetch<unknown>(`/analytics/event/schema${query}`, { tenantSlug });
    const parsed = parseAnalyticsEventSchemaV1(raw);
    if (!parsed) {
      throw new ApiError('Respuesta inválida de analytics event schema v1.', 502, raw);
    }
    return parsed;
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) {
      throw error;
    }
    const raw = await apiFetch<unknown>(`/api/analytics/event/schema${query}`, { tenantSlug });
    const parsed = parseAnalyticsEventSchemaV1(raw);
    if (!parsed) {
      throw new ApiError('Respuesta inválida de analytics event schema v1.', 502, raw);
    }
    return parsed;
  }
};

export const postAnalyticsEvent = async (
  payload: Record<string, unknown>,
  tenantSlug?: string,
): Promise<AnalyticsEventIngestAckV1> => {
  try {
    const raw = await apiFetch<unknown>('/analytics/event', {
      method: 'POST',
      body: payload,
      tenantSlug,
    });
    const parsed = parseAnalyticsEventIngestAckV1(raw);
    if (!parsed) {
      throw new ApiError('Respuesta inválida de analytics event ingest v1.', 502, raw);
    }
    return parsed;
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) {
      throw error;
    }
    const raw = await apiFetch<unknown>('/api/analytics/event', {
      method: 'POST',
      body: payload,
      tenantSlug,
    });
    const parsed = parseAnalyticsEventIngestAckV1(raw);
    if (!parsed) {
      throw new ApiError('Respuesta inválida de analytics event ingest v1.', 502, raw);
    }
    return parsed;
  }
};

const normalizeHeatPoint = (
  point: unknown,
  categoryFallback?: string,
): { lat?: number; lng?: number; weight?: number; categoria?: string; canal?: string; severidad?: string; estado?: string } | null => {
  if (!isRecord(point)) return null;
  const latCandidate = point.lat ?? point.latitude;
  const lngCandidate = point.lng ?? point.lon ?? point.longitude;
  const lat = typeof latCandidate === 'number' ? latCandidate : Number(latCandidate);
  const lng = typeof lngCandidate === 'number' ? lngCandidate : Number(lngCandidate);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const weightCandidate = point.weight ?? point.count ?? point.intensity;
  const weightValue = typeof weightCandidate === 'number' ? weightCandidate : Number(weightCandidate);
  const weight = Number.isFinite(weightValue) ? weightValue : undefined;
  const categoriaRaw = point.categoria ?? point.category ?? point.tipo ?? categoryFallback;
  const canalRaw = point.canal ?? point.channel;
  const severidadRaw = point.severidad ?? point.severity ?? point.priority;
  const estadoRaw = point.estado ?? point.status ?? point.state;

  return {
    lat,
    lng,
    ...(weight !== undefined ? { weight } : {}),
    ...(typeof categoriaRaw === 'string' && categoriaRaw.trim().length > 0 ? { categoria: categoriaRaw.trim() } : {}),
    ...(typeof canalRaw === 'string' && canalRaw.trim().length > 0 ? { canal: canalRaw.trim() } : {}),
    ...(typeof severidadRaw === 'string' && severidadRaw.trim().length > 0 ? { severidad: severidadRaw.trim() } : {}),
    ...(typeof estadoRaw === 'string' && estadoRaw.trim().length > 0 ? { estado: estadoRaw.trim() } : {}),
  };
};

const collectHeatmapPoints = (raw: unknown): Array<{ lat?: number; lng?: number; weight?: number; categoria?: string; canal?: string; severidad?: string; estado?: string }> => {
  const visited = new Set<unknown>();
  const points: Array<{ lat?: number; lng?: number; weight?: number; categoria?: string; canal?: string; severidad?: string; estado?: string }> = [];

  const visit = (candidate: unknown, categoryFallback?: string) => {
    if (!candidate || visited.has(candidate)) return;

    if (Array.isArray(candidate)) {
      visited.add(candidate);
      candidate.forEach((item) => visit(item, categoryFallback));
      return;
    }

    if (!isRecord(candidate)) return;
    visited.add(candidate);

    const normalized = normalizeHeatPoint(candidate, categoryFallback);
    if (normalized) {
      points.push(normalized);
      return;
    }

    const nestedCategory =
      typeof candidate.categoria === 'string' && candidate.categoria.trim().length > 0
        ? candidate.categoria.trim()
        : typeof candidate.category === 'string' && candidate.category.trim().length > 0
          ? candidate.category.trim()
          : categoryFallback;

    const layerBuckets = [
      candidate.points,
      candidate.geo_points,
      candidate.heatmap_points,
      candidate.hotspots,
      candidate.cells,
      candidate.category_layers,
      candidate.geo_layers,
      candidate.map_layers,
      candidate.categories,
      candidate.layers,
      candidate.data,
      candidate.result,
      candidate.results,
      candidate.response,
      candidate.payload,
      candidate.sections,
      candidate.mapas,
      candidate.geo,
    ];

    layerBuckets.forEach((next) => visit(next, nestedCategory));
  };

  visit(raw);
  return points;
};
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
  const appendValue = (key: string, value: string | string[] | undefined) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value
        .map((item) => item?.trim())
        .filter(Boolean)
        .forEach((item) => params.append(key, item));
      return;
    }
    const normalized = value.trim();
    if (normalized) params.append(key, normalized);
  };

  if (filters.tenant_id) params.append('tenant_id', String(filters.tenant_id));
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);
  if (filters.scope) params.append('scope', filters.scope);
  if (filters.tz) params.append('tz', filters.tz);
  const singleCategory = filters.category ?? filters.categoria;
  const multiCategories = filters.categories ?? filters.categorias;
  appendValue('category', singleCategory);
  appendValue('categories', multiCategories);
  if (!filters.category && filters.categoria) appendValue('categoria', filters.categoria);
  if (!filters.categories && filters.categorias) appendValue('categorias', filters.categorias);
  appendValue('sexo', filters.sexo);
  appendValue('genero', filters.genero);
  appendValue('rango_edad', filters.rango_edad);
  appendValue('barrio', filters.barrio);
  appendValue('distrito', filters.distrito);
  appendValue('canal', filters.canal || filters.channel);
  if (typeof filters.geo_limit === 'number' && Number.isFinite(filters.geo_limit) && filters.geo_limit > 0) {
    params.append('geo_limit', String(Math.round(filters.geo_limit)));
  }
  if (typeof filters.bbox === 'string' && filters.bbox.trim().length > 0) {
    params.append('bbox', filters.bbox.trim());
  }
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
    voice_interactions_pct: Number(rawKpis.voice_interactions_pct ?? totals.voice_interactions_pct ?? 0) || 0,
    video_avatar_interactions_pct: Number(rawKpis.video_avatar_interactions_pct ?? totals.video_avatar_interactions_pct ?? 0) || 0,
    no_typing_completion_rate: Number(rawKpis.no_typing_completion_rate ?? totals.no_typing_completion_rate ?? 0) || 0,
    accessibility_usage_rate: Number(rawKpis.accessibility_usage_rate ?? totals.accessibility_usage_rate ?? 0) || 0,
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
    const hub = hubOverride ?? await analyticsService.getHub(filters).catch((): AnalyticsHubResponse | null => null);
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

  getHeatmap: async (filters: AnalyticsFilters, hubOverride?: AnalyticsHubResponse | null): Promise<AnalyticsHeatmapResponse> => {
    const buildResponse = (raw: any): AnalyticsHeatmapResponse => {
      const geoLayers = raw?.geo_layers && typeof raw.geo_layers === 'object' ? raw.geo_layers : undefined;
      const mapLayers = raw?.map_layers && typeof raw.map_layers === 'object' ? raw.map_layers : undefined;
      const requestId =
        typeof raw?.request_id === 'string' && raw.request_id.trim().length > 0
          ? raw.request_id.trim()
          : undefined;
      const points = collectHeatmapPoints(raw);
      const segments = raw?.segments && typeof raw.segments === 'object' ? raw.segments : undefined;
      const segmentsFiltersApplied =
        raw?.segments_filters_applied && typeof raw.segments_filters_applied === 'object'
          ? raw.segments_filters_applied
          : undefined;
      return {
        ...(requestId ? { request_id: requestId } : {}),
        points: Array.isArray(points) ? points : [],
        ...(mapLayers ? { map_layers: mapLayers } : {}),
        ...(geoLayers ? { geo_layers: geoLayers } : {}),
        ...(segments ? { segments } : {}),
        ...(segmentsFiltersApplied ? { segments_filters_applied: segmentsFiltersApplied } : {}),
      };
    };

    const hub = hubOverride ?? await analyticsService.getHub(filters).catch((): AnalyticsHubResponse | null => null);
    const hubMap = hub?.sections?.mapas as Record<string, unknown> | undefined;
    const hubGeo = (hubMap?.geo as Record<string, unknown> | undefined) ?? hubMap;
    const hubPoints = (hubGeo?.points ?? hubGeo?.geo_points ?? hubGeo?.heatmap_points) as unknown;
    if (Array.isArray(hubPoints)) {
      return buildResponse({
        points: hubPoints,
        geo_layers: (hubGeo as any)?.geo_layers,
        map_layers: (hubGeo as any)?.map_layers,
        segments: (hubGeo as any)?.segments,
        segments_filters_applied: (hubGeo as any)?.segments_filters_applied,
        request_id: (hubGeo as any)?.request_id,
      });
    }

    const query = buildQuery({ ...filters, scope: filters.scope ?? filters.context ?? 'municipio' });
    const response = await apiFetch<any>(`/admin/analytics/heatmap?${query}`, {
      tenantSlug: filters.tenantSlug,
      headers: buildAnalyticsHeaders(),
    });
    return buildResponse(response || {});
  },

  getGeoPoints: async (
    filters: AnalyticsFilters & { limit?: number },
    hubOverride?: AnalyticsHubResponse | null,
  ): Promise<AnalyticsGeoPointsResponse> => {
    if (filters.limit !== undefined) {
      const validLimit = Number.isInteger(filters.limit) && filters.limit >= 1 && filters.limit <= 5000;
      if (!validLimit) {
        throw new ApiError('Parámetro limit inválido para /analytics/geo/points. Debe ser entero entre 1 y 5000.', 400, {
          error: { code: 400, message: 'invalid_limit' },
        });
      }
    }

    const buildResponse = (raw: any): AnalyticsGeoPointsResponse => {
      const points = collectHeatmapPoints(raw);
      const mapLayers = raw?.map_layers && typeof raw.map_layers === 'object' ? raw.map_layers : undefined;
      const requestId =
        typeof raw?.request_id === 'string' && raw.request_id.trim().length > 0
          ? raw.request_id.trim()
          : undefined;

      return {
        ...(requestId ? { request_id: requestId } : {}),
        points: Array.isArray(points) ? points : [],
        ...(mapLayers ? { map_layers: mapLayers } : {}),
      };
    };

    const hub = hubOverride ?? await analyticsService.getHub(filters).catch((): AnalyticsHubResponse | null => null);
    const hubMap = hub?.sections?.mapas as Record<string, unknown> | undefined;
    const hubGeo = (hubMap?.geo as Record<string, unknown> | undefined) ?? hubMap;
    const hubPoints = (hubGeo?.points ?? hubGeo?.geo_points ?? hubGeo?.heatmap_points) as unknown;
    if (Array.isArray(hubPoints)) {
      return buildResponse({
        points: hubPoints,
        map_layers: (hubGeo as any)?.map_layers,
        request_id: (hubGeo as any)?.request_id,
      });
    }

    const query = buildQuery({ ...filters, scope: filters.scope ?? filters.context ?? 'municipio' });
    const limitSuffix = filters.limit !== undefined ? `${query ? '&' : ''}limit=${filters.limit}` : '';
    const queryWithLimit = `${query}${limitSuffix}`;
    const endpoint = `/analytics/geo/points${queryWithLimit ? `?${queryWithLimit}` : ''}`;

    try {
      const response = await apiFetch<any>(endpoint, {
        tenantSlug: filters.tenantSlug,
        headers: buildAnalyticsHeaders(),
      });
      return buildResponse(response || {});
    } catch (error) {
      if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) {
        throw error;
      }
      const fallbackEndpoint = `/api/analytics/geo/points${queryWithLimit ? `?${queryWithLimit}` : ''}`;
      const response = await apiFetch<any>(fallbackEndpoint, {
        tenantSlug: filters.tenantSlug,
        headers: buildAnalyticsHeaders(),
      });
      return buildResponse(response || {});
    }
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

  getRealtimeHub: async (params: { tenant_id: number; scope?: string; window_minutes?: number; tenantSlug?: string }) => {
    const query = new URLSearchParams();
    query.set('tenant_id', String(params.tenant_id));
    if (params.scope) query.set('scope', params.scope);
    if (params.window_minutes) query.set('window_minutes', String(params.window_minutes));

    return apiFetch<RealtimeHubResponse>(`/admin/analytics/realtime-hub?${query.toString()}`, {
      tenantSlug: params.tenantSlug,
      headers: buildAnalyticsHeaders(),
    });
  },
};
