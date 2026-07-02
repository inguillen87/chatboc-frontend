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
  tenantId?: number | string;
  from?: string;
  to?: string;
  context?: AnalyticsContext;
  scope?: string;
  channel?: string;
  tz?: string;
  categoria?: string | string[];
  categorias?: string | string[];
  category?: string;
  categories?: string | string[];
  sexo?: string;
  genero?: string | string[];
  gender?: string;
  edad?: string;
  age?: string;
  rango_edad?: string | string[];
  age_range?: string;
  barrio?: string;
  distrito?: string;
  source?: string;
  fuente?: string;
  canal?: string | string[];
  estado?: string | string[];
  agente?: string | string[];
  zona?: string | string[];
  etiquetas?: string | string[];
  metric?: string;
  group?: string | null;
  dimension?: string;
  subject?: string;
  search?: string | null;
  geo_limit?: number;
  bbox?: string | [number, number, number, number];
  tenantSlug?: string;
}

export type AnalyticsContext = 'overview' | 'municipio' | 'pyme' | 'operaciones' | 'operations';

export interface FilterCatalogResponse {
  tenants?: string[];
  canal?: string[];
  canales?: string[];
  categoria?: string[];
  categorias?: string[];
  estado?: string[];
  estados?: string[];
  agente?: string[];
  agentes?: string[];
  zona?: string[];
  zonas?: string[];
  etiquetas?: string[];
  [key: string]: unknown;
}

export interface SummaryResponse {
  kpis?: Record<string, unknown>;
  totals?: Record<string, unknown>;
  items?: unknown[];
  generatedAt?: string;
  tenantId?: string | number;
  sla?: Record<string, unknown>;
  efficiency?: Record<string, unknown>;
  volume?: {
    perDay?: unknown[];
    byChannel?: unknown[];
    byCategory?: unknown[];
    byZone?: unknown[];
    [key: string]: unknown;
  };
  quality?: {
    byType?: unknown[];
    byAgent?: unknown[];
    [key: string]: unknown;
  };
  pyme?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TimeseriesResponse {
  items?: Array<{ date?: string; value?: number; breakdown?: Record<string, number>; [key: string]: unknown }>;
  series?: Array<{ date?: string; value?: number; breakdown?: Record<string, number>; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface BreakdownResponse {
  items?: Array<{ label?: string; value?: number; count?: number; [key: string]: unknown }>;
  summary?: Record<string, unknown>;
  [key: string]: unknown;
}

export type HeatmapResponse = AnalyticsHeatmapResponse;
export type PointsResponse = AnalyticsGeoPointsResponse;

export interface TopResponse {
  items?: Array<{ label?: string; value?: number; count?: number; [key: string]: unknown }>;
  top?: Array<{ label?: string; value?: number; count?: number; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface OperationsResponse {
  items?: unknown[];
  summary?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CohortsResponse {
  items?: unknown[];
  cohorts?: unknown[];
  [key: string]: unknown;
}

export interface TemplatesResponse {
  items?: unknown[];
  templates?: unknown[];
  [key: string]: unknown;
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
      survey_ops_title?: string;
      survey_ops_quiet?: string;
      cards_events?: string;
      cards_survey_responses?: string;
      cards_survey_comments?: string;
      cards_live_chat_comments?: string;
      sections_top_channels?: string;
      sections_top_events?: string;
      sections_sentiment?: string;
      sections_live_comments?: string;
      sections_hotspots_recommendations?: string;
      sections_map?: string;
      sections_segments?: string;
      empty_map?: string;
      applied_filters?: string;
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
  survey_operations?: {
    contract_version?: string;
    status?: 'live' | 'quiet' | string;
    headline?: string;
    window_minutes?: number;
    responses?: number;
    comments?: number;
    vote_events?: number;
    engagement?: number;
    live_signal?: boolean;
    recommended_actions?: Array<{ id?: string; label?: string; route?: string; href?: string }>;
  };
  top_channels?: Array<{ channel?: string; count?: number }>;
  top_events?: Array<{ event?: string; count?: number }>;
  sentiment?: Record<string, number>;
  geo_points?: Array<{ lat?: number; lng?: number; count?: number; channel?: string }>;
  geo_layers?: AnalyticsHeatmapResponse['geo_layers'];
  segments?: Record<string, Array<{ label?: string; count?: number }>>;
  segments_filters_applied?: Record<string, unknown>;
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

export interface AnalyticsHeatmapPoint {
  id?: string | number;
  cellId?: string | number;
  lat?: number;
  lng?: number;
  lon?: number;
  weight?: number;
  categoria?: string;
  canal?: string;
  severidad?: string;
  estado?: string;
  sexo?: string;
  genero?: string;
  rango_edad?: string;
  barrio?: string;
  distrito?: string;
  source?: string;
  fuente?: string;
  actions?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
}

export interface AnalyticsHeatmapCell {
  id?: string | number;
  cellId?: string | number;
  key?: string;
  label?: string;
  lat?: number;
  lng?: number;
  centroid_lat?: number;
  centroid_lon?: number;
  weight?: number;
  count?: number;
  breakdown?: Record<string, number>;
  categoria?: string;
  category?: string;
  actions?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface HeatmapMetadataItem {
  label: string;
  count?: number;
  percentage?: number;
}

export interface AnalyticsHeatmapMetadata {
  totals?: {
    geocoded?: number;
    missing?: number;
    coverage?: number;
    tickets?: number;
    [key: string]: unknown;
  };
  intensity?: {
    averageWeight?: number;
    totalWeight?: number;
    [key: string]: unknown;
  };
  categories?: HeatmapMetadataItem[];
  severity?: HeatmapMetadataItem[];
  status?: HeatmapMetadataItem[];
  recency?: HeatmapMetadataItem[];
  serviceLevels?: {
    responseMinutes?: {
      average?: number;
      p90?: number;
      [key: string]: unknown;
    };
    resolutionMinutes?: {
      average?: number;
      p90?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  byCategory?: HeatmapMetadataItem[];
  byChannel?: HeatmapMetadataItem[];
  byStatus?: HeatmapMetadataItem[];
  [key: string]: unknown;
}

export interface AnalyticsHeatmapCandidate {
  id?: string | number;
  ticket_id?: string | number;
  chat_id?: string;
  address?: string;
  direccion?: string;
  label?: string;
  categoria?: string;
  category?: string;
  status?: string;
  estado?: string;
  actions?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface AnalyticsHeatmapLocationQuality {
  total?: number;
  with_coordinates?: number;
  without_coordinates?: number;
  coverage_pct?: number;
  [key: string]: unknown;
}

export interface AnalyticsHeatmapResponse {
  contract_version?: string;
  request_id?: string;
  points: AnalyticsHeatmapPoint[];
  cells?: AnalyticsHeatmapCell[];
  hotspots?: AnalyticsHeatmapCell[];
  category_layers?: AnalyticsHeatmapCell[];
  location_quality?: AnalyticsHeatmapLocationQuality;
  metadata?: AnalyticsHeatmapMetadata;
  chronic?: unknown;
  geocoding?: {
    candidates?: AnalyticsHeatmapCandidate[];
    [key: string]: unknown;
  };
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
      filter_genero?: string;
      filter_rango_edad?: string;
      filter_barrio?: string;
      filter_distrito?: string;
      filter_source?: string;
      filter_all?: string;
      layers?: string;
      geocoding_queue?: string;
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
  applied_filters?: Record<string, unknown>;
  filters_applied?: Record<string, unknown>;
}

export interface AnalyticsGeoPointsResponse {
  request_id?: string;
  points: AnalyticsHeatmapPoint[];
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
    const raw = await apiFetch<unknown>(`/api/analytics/event/schema${query}`, { tenantSlug });
    const parsed = parseAnalyticsEventSchemaV1(raw);
    if (!parsed) {
      throw new ApiError('Respuesta inválida de analytics event schema v1.', 502, raw);
    }
    return parsed;
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) {
      throw error;
    }
    const raw = await apiFetch<unknown>(`/analytics/event/schema${query}`, { tenantSlug });
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
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) {
      throw error;
    }
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
  }
};

const extractCoordinatePair = (point: Record<string, unknown>): { lat: number; lng: number } | null => {
  const directLat = asFiniteNumber(point.lat ?? point.latitude ?? point.geo_lat);
  const directLng = asFiniteNumber(point.lng ?? point.lon ?? point.longitude ?? point.geo_lng);
  if (directLat !== undefined && directLng !== undefined) {
    return { lat: directLat, lng: directLng };
  }

  const nestedCandidates = [point.geo, point.location, point.ubicacion, point.coordinates];
  for (const candidate of nestedCandidates) {
    if (isRecord(candidate)) {
      const lat = asFiniteNumber(candidate.lat ?? candidate.latitude ?? candidate.geo_lat);
      const lng = asFiniteNumber(candidate.lng ?? candidate.lon ?? candidate.longitude ?? candidate.geo_lng);
      if (lat !== undefined && lng !== undefined) return { lat, lng };
    }

    if (Array.isArray(candidate) && candidate.length >= 2) {
      const first = asFiniteNumber(candidate[0]);
      const second = asFiniteNumber(candidate[1]);
      if (first !== undefined && second !== undefined) {
        return { lat: second, lng: first };
      }
    }
  }

  const geometry = point.geometry;
  if (isRecord(geometry) && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
    const lng = asFiniteNumber(geometry.coordinates[0]);
    const lat = asFiniteNumber(geometry.coordinates[1]);
    if (lat !== undefined && lng !== undefined) return { lat, lng };
  }

  return null;
};

const pickString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
};

const normalizeHeatmapActions = (value: unknown): Array<Record<string, unknown>> | undefined => {
  if (!Array.isArray(value)) return undefined;
  const actions = value.reduce<Array<Record<string, unknown>>>((acc, action) => {
    if (!isRecord(action)) return acc;
    const normalized: Record<string, unknown> = { ...action };
    const id = pickString(action.id, action.key);
    const title = pickString(action.title, action.label, action.name);
    const label = pickString(action.label, action.title, action.name);
    const method = pickString(action.method);
    const endpoint = pickString(action.endpoint, action.endpoint_template);
    const actionType = pickString(action.action_type, action.type);
    const uiHint = pickString(action.ui_hint);

    if (id) normalized.id = id;
    if (title) normalized.title = title;
    if (label) normalized.label = label;
    if (method) normalized.method = method;
    if (endpoint) normalized.endpoint = endpoint;
    if (actionType) normalized.action_type = actionType;
    if (uiHint) normalized.ui_hint = uiHint;
    if (isRecord(action.target)) normalized.target = action.target;
    if (isRecord(action.payload_template)) normalized.payload_template = action.payload_template;
    if (isRecord(action.body_template)) normalized.body_template = action.body_template;
    if (Array.isArray(action.requires)) {
      const requires = action.requires.map((item) => pickString(item)).filter((item): item is string => Boolean(item));
      if (requires.length) normalized.requires = requires;
    }
    acc.push(normalized);
    return acc;
  }, []);

  return actions.length ? actions : undefined;
};

const normalizeHeatPoint = (
  point: unknown,
  categoryFallback?: string,
): AnalyticsHeatmapPoint | null => {
  if (!isRecord(point)) return null;
  const coordinates = extractCoordinatePair(point);
  if (!coordinates) return null;
  const metadata = isRecord(point.metadata) ? point.metadata : {};
  const ticket = isRecord(point.ticket) ? point.ticket : {};
  const contact = isRecord(point.contact) ? point.contact : {};

  const weightCandidate = point.weight ?? point.count ?? point.intensity;
  const weightValue = typeof weightCandidate === 'number' ? weightCandidate : Number(weightCandidate);
  const weight = Number.isFinite(weightValue) ? weightValue : undefined;
  const categoriaRaw = pickString(point.categoria, point.category, point.tipo, point.ticket_type, ticket.categoria, metadata.categoria, metadata.category, categoryFallback);
  const canalRaw = pickString(point.canal, point.channel, ticket.canal, metadata.canal, metadata.channel);
  const severidadRaw = pickString(point.severidad, point.severity, point.priority, ticket.severidad, metadata.severity);
  const estadoRaw = pickString(point.estado, point.status, point.state, ticket.estado, metadata.status);
  const sexoRaw = pickString(point.sexo, point.genero, point.gender, contact.sexo, contact.genero, metadata.sexo, metadata.gender);
  const generoRaw = pickString(point.genero, point.gender, point.sexo, contact.genero, contact.gender, metadata.genero, metadata.gender);
  const rangoEdadRaw = pickString(point.rango_edad, point.age_range, point.ageRange, point.edad, point.age, contact.rango_edad, metadata.rango_edad, metadata.age_range);
  const barrioRaw = pickString(point.barrio, point.neighborhood, contact.barrio, contact.neighborhood, metadata.barrio, metadata.neighborhood);
  const distritoRaw = pickString(point.distrito, point.district, point.zone, point.zona, metadata.distrito, metadata.district, metadata.zone);
  const sourceRaw = pickString(point.source, point.fuente, point.origin, ticket.source, metadata.source, metadata.fuente);
  const actions = normalizeHeatmapActions(point.actions);

  return {
    ...(typeof point.id === 'string' || typeof point.id === 'number' ? { id: point.id } : {}),
    lat: coordinates.lat,
    lng: coordinates.lng,
    ...(weight !== undefined ? { weight } : {}),
    ...(categoriaRaw ? { categoria: categoriaRaw } : {}),
    ...(canalRaw ? { canal: canalRaw } : {}),
    ...(severidadRaw ? { severidad: severidadRaw } : {}),
    ...(estadoRaw ? { estado: estadoRaw } : {}),
    ...(sexoRaw ? { sexo: sexoRaw } : {}),
    ...(generoRaw ? { genero: generoRaw } : {}),
    ...(rangoEdadRaw ? { rango_edad: rangoEdadRaw } : {}),
    ...(barrioRaw ? { barrio: barrioRaw } : {}),
    ...(distritoRaw ? { distrito: distritoRaw } : {}),
    ...(sourceRaw ? { source: sourceRaw, fuente: sourceRaw } : {}),
    ...(actions ? { actions } : {}),
  };
};

const collectHeatmapPoints = (raw: unknown): AnalyticsHeatmapPoint[] => {
  const visited = new Set<unknown>();
  const points: AnalyticsHeatmapPoint[] = [];

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

  const tenantId = filters.tenant_id ?? filters.tenantId;
  if (tenantId) params.append('tenant_id', String(tenantId));
  if (filters.tenantSlug) {
    params.append('tenant_slug', filters.tenantSlug);
    params.append('tenant', filters.tenantSlug);
  }
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
  appendValue('genero', filters.genero || filters.gender);
  appendValue('gender', filters.gender);
  appendValue('edad', filters.edad || filters.age);
  appendValue('age', filters.age);
  appendValue('rango_edad', filters.rango_edad || filters.age_range);
  appendValue('age_range', filters.age_range);
  appendValue('barrio', filters.barrio);
  appendValue('distrito', filters.distrito);
  appendValue('estado', filters.estado);
  appendValue('agente', filters.agente);
  appendValue('zona', filters.zona);
  appendValue('etiquetas', filters.etiquetas);
  appendValue('source', filters.source || filters.fuente);
  appendValue('fuente', filters.fuente);
  appendValue('canal', filters.canal || filters.channel);
  if (typeof filters.geo_limit === 'number' && Number.isFinite(filters.geo_limit) && filters.geo_limit > 0) {
    params.append('geo_limit', String(Math.round(filters.geo_limit)));
  }
  if (typeof filters.bbox === 'string' && filters.bbox.trim().length > 0) {
    params.append('bbox', filters.bbox.trim());
  } else if (Array.isArray(filters.bbox) && filters.bbox.length === 4) {
    params.append('bbox', filters.bbox.join(','));
  }
  appendValue('metric', filters.metric);
  appendValue('group', filters.group || undefined);
  appendValue('dimension', filters.dimension);
  appendValue('subject', filters.subject);
  appendValue('search', filters.search || undefined);
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
    const geoQueryFilters: Record<string, unknown> = { ...filters };
    delete geoQueryFilters.tenantSlug;
    delete geoQueryFilters.tenant;
    delete geoQueryFilters.limit;
    const query = buildQuery({ ...geoQueryFilters, scope: filters.scope ?? filters.context ?? 'municipio' });
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
    const normalizeList = <T extends Record<string, unknown>>(value: unknown): T[] =>
      Array.isArray(value) ? value.filter(isRecord).map((item) => item as T) : [];
    const normalizeCellList = (value: unknown): AnalyticsHeatmapCell[] =>
      normalizeList<AnalyticsHeatmapCell>(value).map((cell) => {
        const actions = normalizeHeatmapActions(cell.actions);
        return actions ? { ...cell, actions } : cell;
      });
    const normalizeGeocodingCandidates = (value: unknown): AnalyticsHeatmapCandidate[] =>
      normalizeList<AnalyticsHeatmapCandidate>(value).map((candidate) => {
        const actions = normalizeHeatmapActions(candidate.actions);
        return actions ? { ...candidate, actions } : candidate;
      });

    const buildResponse = (raw: any): AnalyticsHeatmapResponse => {
      const geoLayers = raw?.geo_layers && typeof raw.geo_layers === 'object' ? raw.geo_layers : undefined;
      const mapLayers = raw?.map_layers && typeof raw.map_layers === 'object' ? raw.map_layers : undefined;
      const requestId =
        typeof raw?.request_id === 'string' && raw.request_id.trim().length > 0
          ? raw.request_id.trim()
          : undefined;
      const contractVersion =
        typeof raw?.contract_version === 'string' && raw.contract_version.trim().length > 0
          ? raw.contract_version.trim()
          : undefined;
      const points = collectHeatmapPoints(raw);
      const segments = raw?.segments && typeof raw.segments === 'object' ? raw.segments : undefined;
      const segmentsFiltersApplied =
        raw?.segments_filters_applied && typeof raw.segments_filters_applied === 'object'
          ? raw.segments_filters_applied
          : raw?.filters_applied && typeof raw.filters_applied === 'object'
            ? raw.filters_applied
            : raw?.applied_filters && typeof raw.applied_filters === 'object'
              ? raw.applied_filters
              : undefined;
      const geocoding =
        raw?.geocoding && typeof raw.geocoding === 'object'
          ? {
              ...raw.geocoding,
              candidates: normalizeGeocodingCandidates((raw.geocoding as Record<string, unknown>).candidates),
            }
          : undefined;
      return {
        ...(contractVersion ? { contract_version: contractVersion } : {}),
        ...(requestId ? { request_id: requestId } : {}),
        points: Array.isArray(points) ? points : [],
        cells: normalizeCellList(raw?.cells),
        hotspots: normalizeCellList(raw?.hotspots),
        category_layers: normalizeCellList(raw?.category_layers),
        ...(raw?.location_quality && typeof raw.location_quality === 'object' ? { location_quality: raw.location_quality } : {}),
        ...(geocoding ? { geocoding } : {}),
        ...(mapLayers ? { map_layers: mapLayers } : {}),
        ...(geoLayers ? { geo_layers: geoLayers } : {}),
        ...(segments ? { segments } : {}),
        ...(segmentsFiltersApplied ? { segments_filters_applied: segmentsFiltersApplied } : {}),
        ...(raw?.applied_filters && typeof raw.applied_filters === 'object' ? { applied_filters: raw.applied_filters } : {}),
        ...(raw?.filters_applied && typeof raw.filters_applied === 'object' ? { filters_applied: raw.filters_applied } : {}),
        ...(raw?.ui && typeof raw.ui === 'object' ? { ui: raw.ui } : {}),
      };
    };

    const queryFilters: Record<string, unknown> = { ...filters };
    delete queryFilters.tenant;
    delete queryFilters.limit;
    const query = buildQuery({ ...queryFilters, scope: filters.scope ?? filters.context ?? 'municipio' });
    let operationsEndpointHubCandidate: AnalyticsHubResponse | null = null;
    try {
      const response = await apiFetch<any>(`/api/v2/analytics/operations/heatmap?${query}`, {
        tenantSlug: filters.tenantSlug,
        headers: buildAnalyticsHeaders(),
      });
      if (response?.sections && typeof response.sections === 'object') {
        operationsEndpointHubCandidate = response as AnalyticsHubResponse;
      } else {
        return buildResponse(response || {});
      }
    } catch (error) {
      if (!(error instanceof ApiError) || ![404, 405, 501].includes(error.status)) {
        throw error;
      }
    }

    const hub = operationsEndpointHubCandidate ?? hubOverride ?? await analyticsService.getHub(filters).catch((): AnalyticsHubResponse | null => null);
    const hubMap = hub?.sections?.mapas as Record<string, unknown> | undefined;
    const hubGeo = (hubMap?.geo as Record<string, unknown> | undefined) ?? hubMap;
    const hubPoints = (hubGeo?.points ?? hubGeo?.geo_points ?? hubGeo?.heatmap_points) as unknown;
    const hubGeoLayers = (hubGeo as any)?.geo_layers;
    const hubGeoLayerSource = hubGeoLayers && typeof hubGeoLayers === 'object'
      ? (hubGeoLayers as Record<string, unknown>).source
      : undefined;
    const hubGeoLayerCategories = hubGeoLayers && typeof hubGeoLayers === 'object'
      ? (hubGeoLayers as Record<string, unknown>).categories
      : undefined;
    const hasHubGeoLayerFeatures =
      isRecord(hubGeoLayerSource) &&
      hubGeoLayerSource.type === 'FeatureCollection' &&
      Array.isArray(hubGeoLayerSource.features) &&
      hubGeoLayerSource.features.length > 0;
    const hasHubGeoLayerCategories = Array.isArray(hubGeoLayerCategories) && hubGeoLayerCategories.length > 0;
    if (Array.isArray(hubPoints) || hasHubGeoLayerFeatures || hasHubGeoLayerCategories) {
      return buildResponse({
        ...(Array.isArray(hubPoints) ? { points: hubPoints } : {}),
        geo_layers: hubGeoLayers,
        map_layers: (hubGeo as any)?.map_layers,
        segments: (hubGeo as any)?.segments,
        segments_filters_applied: (hubGeo as any)?.segments_filters_applied,
        request_id: (hubGeo as any)?.request_id,
      });
    }

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

    const pointsQueryFilters: Record<string, unknown> = { ...filters };
    delete pointsQueryFilters.tenantSlug;
    delete pointsQueryFilters.tenant;
    delete pointsQueryFilters.limit;
    const query = buildQuery({ ...pointsQueryFilters, scope: filters.scope ?? filters.context ?? 'municipio' });
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
  exportPdfUrl: (filters: AnalyticsFilters) => `/api/v2/analytics/operations/export.pdf?${buildQuery(filters)}`,

  summary: async (filters: AnalyticsFilters): Promise<SummaryResponse> => {
    const query = buildQuery(filters);
    return apiFetch<SummaryResponse>(`/api/v2/analytics/summary${query ? `?${query}` : ''}`, {
      tenantSlug: filters.tenantSlug,
      headers: buildAnalyticsHeaders(),
    });
  },

  timeseries: async (filters: AnalyticsFilters): Promise<TimeseriesResponse> => {
    const query = buildQuery(filters);
    return apiFetch<TimeseriesResponse>(`/api/v2/analytics/timeseries${query ? `?${query}` : ''}`, {
      tenantSlug: filters.tenantSlug,
      headers: buildAnalyticsHeaders(),
    });
  },

  breakdown: async (filters: AnalyticsFilters): Promise<BreakdownResponse> => {
    const query = buildQuery(filters);
    return apiFetch<BreakdownResponse>(`/api/v2/analytics/breakdown${query ? `?${query}` : ''}`, {
      tenantSlug: filters.tenantSlug,
      headers: buildAnalyticsHeaders(),
    });
  },

  heatmap: async (filters: AnalyticsFilters): Promise<HeatmapResponse> => analyticsService.getHeatmap(filters),

  points: async (filters: AnalyticsFilters): Promise<PointsResponse> =>
    analyticsService.getGeoPoints({ ...filters, limit: filters.geo_limit }),

  top: async (filters: AnalyticsFilters): Promise<TopResponse> => {
    const query = buildQuery(filters);
    return apiFetch<TopResponse>(`/api/v2/analytics/top${query ? `?${query}` : ''}`, {
      tenantSlug: filters.tenantSlug,
      headers: buildAnalyticsHeaders(),
    });
  },

  operations: async (filters: AnalyticsFilters): Promise<OperationsResponse> => {
    const query = buildQuery(filters);
    return apiFetch<OperationsResponse>(`/api/v2/analytics/operations/dashboard${query ? `?${query}` : ''}`, {
      tenantSlug: filters.tenantSlug,
      headers: buildAnalyticsHeaders(),
    });
  },

  cohorts: async (filters: AnalyticsFilters): Promise<CohortsResponse> => {
    const query = buildQuery(filters);
    return apiFetch<CohortsResponse>(`/api/v2/analytics/cohorts${query ? `?${query}` : ''}`, {
      tenantSlug: filters.tenantSlug,
      headers: buildAnalyticsHeaders(),
    });
  },

  templates: async (filters: AnalyticsFilters): Promise<TemplatesResponse> => {
    const query = buildQuery(filters);
    return apiFetch<TemplatesResponse>(`/api/v2/analytics/templates${query ? `?${query}` : ''}`, {
      tenantSlug: filters.tenantSlug,
      headers: buildAnalyticsHeaders(),
    });
  },

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
