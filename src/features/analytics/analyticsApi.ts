import { panelApi } from '@/api/v2/client';
import type {
  AnalyticsOverview,
  OperationsActionCenterV1,
  OperationsActionItem,
  OperationsAlert,
  OperationsBucketItem,
  OperationsDashboardV1,
  OperationsFrontendContract,
  OperationsFreshnessSource,
  OperationsFreshnessV1,
  OperationsHeatmapFacet,
  OperationsHeatmapPoint,
  OperationsHeatmapV1,
  OperationsTrend,
  PublicMapConfigV1,
} from './analyticsTypes';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string' && value.trim()) {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'si', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return undefined;
};

const pickRecord = (value: unknown): Record<string, unknown> | undefined =>
  isRecord(value) ? value : undefined;

const toNumberRecord = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};

const buildQuery = (params?: {
  tenant_id?: number | string | null;
  from?: string | null;
  to?: string | null;
  days?: number | string | null;
  range?: string | null;
  scope?: string | null;
  channel?: string | null;
  canal?: string | null;
  category?: string | null;
  categoria?: string | null;
  gender?: string | null;
  genero?: string | null;
  sexo?: string | null;
  age?: string | null;
  edad?: string | null;
  age_range?: string | null;
  rango_edad?: string | null;
  barrio?: string | null;
  distrito?: string | null;
  status?: string | null;
  estado?: string | null;
  severity?: string | null;
  severidad?: string | null;
  layer?: string | null;
  source?: string | null;
  bbox?: string | null;
  limit?: number | null;
}) => {
  if (!params) return '';
  const query = new URLSearchParams();
  const append = (key: string, value: unknown) => {
    if (value === null || value === undefined) return;
    const normalized = String(value).trim();
    if (normalized) query.set(key, normalized);
  };

  append('tenant_id', params.tenant_id);
  append('from', params.from);
  append('to', params.to);
  append('days', params.days);
  append('range', params.range);
  append('scope', params.scope);
  append('channel', params.channel);
  append('canal', params.canal);
  append('category', params.category);
  append('categoria', params.categoria);
  append('gender', params.gender);
  append('genero', params.genero);
  append('sexo', params.sexo);
  append('age', params.age);
  append('edad', params.edad);
  append('age_range', params.age_range);
  append('rango_edad', params.rango_edad);
  append('barrio', params.barrio);
  append('distrito', params.distrito);
  append('status', params.status);
  append('estado', params.estado);
  append('severity', params.severity);
  append('severidad', params.severidad);
  append('layer', params.layer);
  append('source', params.source);
  append('bbox', params.bbox);
  append('limit', params.limit);

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

const normalizeBucketItem = (value: unknown, keyFallback?: string): OperationsBucketItem | null => {
  if (isRecord(value)) {
    const key = asString(value.key) ?? asString(value.id) ?? keyFallback;
    const label =
      asString(value.label) ??
      asString(value.title) ??
      asString(value.name) ??
      asString(value.status) ??
      asString(value.channel) ??
      asString(value.category) ??
      key;
    const next: OperationsBucketItem = {};
    Object.entries(value).forEach(([field, raw]) => {
      (next as Record<string, unknown>)[field] = raw;
    });
    if (key !== undefined) next.key = key;
    if (label !== undefined) next.label = label;

    const numericFields = [
      'value',
      'count',
      'total',
      'current',
      'previous',
      'percent_change',
      'percentage',
    ] as const;
    numericFields.forEach((field) => {
      const parsed = asNumber(value[field]);
      if (parsed !== undefined) next[field] = parsed;
    });

    return next;
  }

  const parsed = asNumber(value);
  if (parsed === undefined) return null;
  return {
    key: keyFallback,
    label: keyFallback,
    value: parsed,
  };
};

const normalizeBucketItems = (value: unknown): OperationsBucketItem[] => {
  const source = isRecord(value) && Array.isArray(value.items) ? value.items : value;

  if (Array.isArray(source)) {
    return source
      .map((item, index) => normalizeBucketItem(item, String(index)))
      .filter((item): item is OperationsBucketItem => item !== null);
  }

  if (!isRecord(source)) return [];

  return Object.entries(source)
    .map(([key, item]) => normalizeBucketItem(item, key))
    .filter((item): item is OperationsBucketItem => item !== null);
};

const normalizeTrends = (value: unknown): { items: OperationsTrend[] } | undefined => {
  if (!value) return undefined;
  const items = normalizeBucketItems(isRecord(value) && value.items !== undefined ? value.items : value).map((item) => ({
    ...item,
    current: asNumber(item.current ?? item.value ?? item.count),
    previous: asNumber(item.previous),
    direction: asString(item.direction),
    percent_change: asNumber(item.percent_change),
  }));

  return {
    ...(isRecord(value) ? value : {}),
    items,
  };
};

const normalizeAlerts = (value: unknown): OperationsAlert[] =>
  normalizeBucketItems(value).map((item) => ({
    ...item,
    id: asString(item.id) ?? asString(item.key),
    title: asString(item.title) ?? asString(item.label),
    message: asString(item.message),
    description: asString(item.description),
    severity: asString(item.severity) ?? asString(item.priority),
    reason_code: asString(item.reason_code),
  }));

const normalizeActions = (value: unknown): OperationsActionItem[] =>
  normalizeBucketItems(value).map((item) => ({
    ...item,
    id: asString(item.id) ?? asString(item.key),
    title: asString(item.title) ?? asString(item.label),
    description: asString(item.description),
    priority: asString(item.priority),
    reason_code: asString(item.reason_code),
    endpoint: asString(item.endpoint),
    method: asString(item.method),
    ui_hint: asString(item.ui_hint),
    payload_template: pickRecord(item.payload_template),
  }));

const normalizeActionObject = (value: unknown): OperationsActionItem | undefined => {
  if (!isRecord(value)) return undefined;
  return {
    ...value,
    id: asString(value.id) ?? asString(value.key),
    title: asString(value.title) ?? asString(value.label),
    description: asString(value.description),
    priority: asString(value.priority),
    reason_code: asString(value.reason_code),
    endpoint: asString(value.endpoint),
    method: asString(value.method),
    ui_hint: asString(value.ui_hint),
    payload_template: pickRecord(value.payload_template),
  };
};

const normalizeFrontendContract = (value: unknown): OperationsFrontendContract | undefined => {
  if (!isRecord(value)) return undefined;
  return {
    ...value,
    render_as: asString(value.render_as),
    primary_refresh_seconds: asNumber(value.primary_refresh_seconds),
    empty_state_behavior: asString(value.empty_state_behavior),
    labels: pickRecord(value.labels) as Record<string, string> | undefined,
  };
};

const normalizeBreakdowns = (value: unknown) => {
  const record = pickRecord(value) ?? {};
  return {
    ...record,
    summary: pickRecord(record.summary),
    items: normalizeBucketItems(record.items),
    by_status: normalizeBucketItems(record.by_status),
    by_channel: normalizeBucketItems(record.by_channel),
    by_category: normalizeBucketItems(record.by_category),
    by_priority: normalizeBucketItems(record.by_priority),
  };
};

const normalizeLiveChat = (value: unknown) => {
  const record = pickRecord(value) ?? {};
  return {
    ...record,
    summary: pickRecord(record.summary),
    active_viewers: asNumber(record.active_viewers),
    items: normalizeBucketItems(record.items),
  };
};

const normalizeEmployees = (value: unknown) => {
  const record = pickRecord(value) ?? {};
  const coverage = pickRecord(record.coverage) ?? {};
  return {
    ...record,
    summary: pickRecord(record.summary),
    items: normalizeBucketItems(record.items),
    coverage: {
      ...coverage,
      uncovered_categories: normalizeBucketItems(coverage.uncovered_categories),
      uncovered_channels: normalizeBucketItems(coverage.uncovered_channels),
    },
  };
};

const normalizeMaps = (value: unknown) => {
  const record = pickRecord(value) ?? {};
  const heatmap = pickRecord(record.heatmap) ?? {};
  return {
    ...record,
    heatmap: {
      ...heatmap,
      hotspots: normalizeBucketItems(heatmap.hotspots),
      points: normalizeBucketItems(heatmap.points),
    },
  };
};

const normalizeDashboard = (response: unknown): OperationsDashboardV1 => {
  const record = pickRecord(response) ?? {};

  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    tenant: pickRecord(record.tenant),
    period: pickRecord(record.period),
    summary: toNumberRecord(record.summary),
    trends: normalizeTrends(record.trends),
    tickets: normalizeBreakdowns(record.tickets),
    surveys: normalizeBreakdowns(record.surveys),
    chats: normalizeBreakdowns(record.chats),
    live_chat: normalizeLiveChat(record.live_chat),
    employees: normalizeEmployees(record.employees),
    maps: normalizeMaps(record.maps),
    alerts: normalizeAlerts(record.alerts),
    next_best_actions: normalizeActions(record.next_best_actions),
    frontend_contract: normalizeFrontendContract(record.frontend_contract),
  };
};

const normalizeHeatmapPoint = (value: unknown): OperationsHeatmapPoint | null => {
  if (!isRecord(value)) return null;
  const lat = asNumber(value.lat ?? value.latitude);
  const lng = asNumber(value.lng ?? value.lon ?? value.longitude);
  if (lat === undefined || lng === undefined) return null;

  return {
    ...value,
    id: (typeof value.id === 'string' || typeof value.id === 'number') ? value.id : undefined,
    lat,
    lng,
    weight: asNumber(value.weight ?? value.count ?? value.intensity) ?? 1,
    layer: asString(value.layer),
    source: asString(value.source),
    type: asString(value.type),
    label: asString(value.label ?? value.title ?? value.name),
    category: asString(value.category ?? value.categoria),
    categoria: asString(value.categoria ?? value.category),
    channel: asString(value.channel ?? value.canal),
    canal: asString(value.canal ?? value.channel),
    gender: asString(value.gender ?? value.genero ?? value.sexo),
    genero: asString(value.genero ?? value.gender ?? value.sexo),
    sexo: asString(value.sexo ?? value.genero ?? value.gender),
    age: asString(value.age ?? value.edad) ?? asNumber(value.age ?? value.edad),
    edad: asString(value.edad ?? value.age) ?? asNumber(value.edad ?? value.age),
    age_range: asString(value.age_range ?? value.rango_edad ?? value.ageRange),
    rango_edad: asString(value.rango_edad ?? value.age_range ?? value.ageRange),
    barrio: asString(value.barrio ?? value.neighborhood),
    distrito: asString(value.distrito ?? value.district),
    status: asString(value.status ?? value.estado),
    estado: asString(value.estado ?? value.status),
    severity: asString(value.severity ?? value.severidad),
    severidad: asString(value.severidad ?? value.severity),
  };
};

const normalizeHeatmapPoints = (value: unknown): OperationsHeatmapPoint[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((point) => normalizeHeatmapPoint(point))
    .filter((point): point is OperationsHeatmapPoint => point !== null);
};

const normalizeHeatmapSegments = (value: unknown): Record<string, OperationsBucketItem[]> | undefined => {
  if (!isRecord(value)) return undefined;
  return Object.entries(value).reduce<Record<string, OperationsBucketItem[]>>((acc, [key, raw]) => {
    const items = normalizeBucketItems(raw);
    if (items.length) acc[key] = items;
    return acc;
  }, {});
};

const normalizeHeatmapFacets = (value: unknown): OperationsHeatmapFacet[] => {
  if (Array.isArray(value)) {
    return value.reduce<OperationsHeatmapFacet[]>((acc, facet, index) => {
      if (!isRecord(facet)) return acc;
      const key = asString(facet.key) ?? asString(facet.field) ?? asString(facet.query_param) ?? `facet_${index + 1}`;
      const items = normalizeBucketItems(
        facet.items ?? facet.options ?? facet.values ?? facet.buckets,
      );
      if (!key || !items.length) return acc;
      acc.push({
        ...facet,
        key,
        field: asString(facet.field) ?? key,
        query_param: asString(facet.query_param) ?? asString(facet.param) ?? key,
        label: asString(facet.label) ?? asString(facet.title) ?? key,
        ui_hint: asString(facet.ui_hint),
        items,
      });
      return acc;
    }, []);
  }

  if (!isRecord(value)) return [];
  return Object.entries(value)
    .reduce<OperationsHeatmapFacet[]>((acc, [key, raw]) => {
      const items = normalizeBucketItems(raw);
      if (!items.length) return acc;
      acc.push({
        key,
        field: key,
        query_param: key,
        label: key,
        items,
      });
      return acc;
    }, []);
};

const normalizeHeatmapDemographics = (value: unknown): OperationsHeatmapV1['demographics'] => {
  if (!isRecord(value)) return undefined;
  return {
    ...value,
    source: asString(value.source),
    gender: normalizeBucketItems(value.gender),
    age_ranges: normalizeBucketItems(value.age_ranges ?? value.ageRanges),
    known_gender_points: asNumber(value.known_gender_points),
    known_age_points: asNumber(value.known_age_points),
    unknown_gender_points: asNumber(value.unknown_gender_points),
    unknown_age_points: asNumber(value.unknown_age_points),
  };
};

const normalizeHeatmap = (response: unknown): OperationsHeatmapV1 => {
  const record = pickRecord(response) ?? {};
  const renderContract = pickRecord(record.render_contract);
  const rawLayers = Array.isArray(renderContract?.layers) ? renderContract.layers : [];
  const segments = normalizeHeatmapSegments(record.segments);
  const appliedFilters = pickRecord(record.applied_filters ?? record.filters_applied ?? record.segments_filters_applied);
  const facets = [
    ...normalizeHeatmapFacets(record.facets),
    ...normalizeHeatmapFacets(record.segment_facets),
    ...normalizeHeatmapFacets(record.filters),
  ];

  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    tenant: pickRecord(record.tenant),
    period: pickRecord(record.period),
    render_contract: renderContract
      ? {
          ...renderContract,
          state: asString(renderContract.state),
          map_engine: asString(renderContract.map_engine),
          layers: rawLayers.filter((item): item is string => typeof item === 'string' && item.trim().length > 0),
          point_format: pickRecord(renderContract.point_format) as Record<string, string> | undefined,
        }
      : undefined,
    summary: pickRecord(record.summary),
    bounds: pickRecord(record.bounds),
    points: normalizeHeatmapPoints(record.points),
    cells: normalizeBucketItems(record.cells),
    hotspots: normalizeBucketItems(record.hotspots),
    category_layers: normalizeBucketItems(record.category_layers),
    demographics: normalizeHeatmapDemographics(record.demographics),
    facets,
    segments,
    applied_filters: appliedFilters,
    filters_applied: appliedFilters,
    ui: pickRecord(record.ui) as OperationsHeatmapV1['ui'],
    frontend_contract: normalizeFrontendContract(record.frontend_contract),
  };
};

const normalizeMapConfig = (response: unknown): PublicMapConfigV1 => {
  const record = pickRecord(response) ?? {};
  return {
    ...record,
    contract_version: asString(record.contract_version),
    provider: asString(record.provider),
    available_providers: Array.isArray(record.available_providers)
      ? record.available_providers.map((item) => asString(item)).filter((item): item is string => Boolean(item))
      : undefined,
    provider_aliases: pickRecord(record.provider_aliases),
    style_url: asString(record.style_url),
    style_url_source: asString(record.style_url_source),
    style_url_warning: asString(record.style_url_warning) ?? null,
    maptiler_key: asString(record.maptiler_key),
    google_maps_key: asString(record.google_maps_key),
  };
};

const buildTenantQuery = (tenantSlug?: string | null) => {
  const normalized = asString(tenantSlug);
  if (!normalized) return '';
  const query = new URLSearchParams();
  query.set('tenant_slug', normalized);
  query.set('tenant', normalized);
  return `?${query.toString()}`;
};

const normalizeActionCenter = (response: unknown): OperationsActionCenterV1 => {
  const record = pickRecord(response) ?? {};

  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    tenant: pickRecord(record.tenant),
    period: pickRecord(record.period),
    summary: pickRecord(record.summary),
    items: normalizeActions(record.items),
    alerts: normalizeAlerts(record.alerts),
    trends: normalizeTrends(record.trends),
    frontend_contract: normalizeFrontendContract(record.frontend_contract),
  };
};

const normalizeFreshnessSource = (value: unknown, index: number): OperationsFreshnessSource | null => {
  if (!isRecord(value)) return null;
  return {
    ...value,
    key: asString(value.key) ?? asString(value.id) ?? `source_${index + 1}`,
    label: asString(value.label) ?? asString(value.title) ?? asString(value.key),
    status: asString(value.status),
    reason_code: asString(value.reason_code),
    period_count: asNumber(value.period_count ?? value.count),
    latest_at: asString(value.latest_at),
    age_seconds: asNumber(value.age_seconds),
    stale_after_seconds: asNumber(value.stale_after_seconds),
    recommended_action: normalizeActionObject(value.recommended_action),
  };
};

const normalizeFreshness = (response: unknown): OperationsFreshnessV1 => {
  const record = pickRecord(response) ?? {};
  const summaryRecord = pickRecord(record.summary) ?? {};
  const sources = Array.isArray(record.sources) ? record.sources : [];

  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    tenant: pickRecord(record.tenant),
    period: pickRecord(record.period),
    status: asString(record.status),
    reason_code: asString(record.reason_code),
    summary: {
      ...summaryRecord,
      sources: asNumber(summaryRecord.sources),
      fresh_sources: asNumber(summaryRecord.fresh_sources),
      stale_sources: asNumber(summaryRecord.stale_sources),
      empty_sources: asNumber(summaryRecord.empty_sources),
      latest_at: asString(summaryRecord.latest_at),
      employee_count: asNumber(summaryRecord.employee_count),
      has_operational_data: asBoolean(summaryRecord.has_operational_data),
      can_render_dashboard: asBoolean(summaryRecord.can_render_dashboard),
      can_render_heatmap: asBoolean(summaryRecord.can_render_heatmap),
    },
    sources: sources
      .map((source, index) => normalizeFreshnessSource(source, index))
      .filter((source): source is OperationsFreshnessSource => source !== null),
    frontend_contract: normalizeFrontendContract(record.frontend_contract),
  };
};

const normalizeOverview = (response: unknown): AnalyticsOverview => {
  const source = isRecord(response) && isRecord(response.summary) ? response.summary : response;
  if (!isRecord(source)) return {};

  return {
    conversations: asNumber(source.conversations ?? source.conversaciones),
    open_tickets: asNumber(source.open_tickets ?? source.tickets_abiertos),
    overdue_tickets: asNumber(source.overdue_tickets ?? source.tickets_vencidos),
    response_time: asNumber(source.response_time ?? source.first_response_time ?? source.frt),
    survey_responses: asNumber(source.survey_responses ?? source.respuestas_encuestas),
    nps: asNumber(source.nps),
    csat: asNumber(source.csat),
    handoff_rate: asNumber(source.handoff_rate),
  };
};

export const getAnalyticsOverviewV2 = async (tenantSlug?: string | null) => {
  const response = await panelApi.get<unknown>('/api/v2/analytics/overview', {
    tenantSlug,
    legacyFallbackPath: '/analytics/overview',
  });
  return normalizeOverview(response);
};

export const getOperationsDashboardV2 = async (params?: {
  tenantSlug?: string | null;
  tenant_id?: number | string | null;
  from?: string | null;
  to?: string | null;
  days?: number | string | null;
  range?: string | null;
  scope?: string | null;
}) => {
  const query = buildQuery(params);
  const response = await panelApi.get<unknown>(`/api/v2/analytics/operations/dashboard${query}`, {
    tenantSlug: params?.tenantSlug,
  });
  return normalizeDashboard(response);
};

export const getOperationsHeatmapV2 = async (params?: {
  tenantSlug?: string | null;
  tenant_id?: number | string | null;
  from?: string | null;
  to?: string | null;
  days?: number | string | null;
  range?: string | null;
  scope?: string | null;
  channel?: string | null;
  canal?: string | null;
  category?: string | null;
  categoria?: string | null;
  gender?: string | null;
  genero?: string | null;
  sexo?: string | null;
  age?: string | null;
  edad?: string | null;
  age_range?: string | null;
  rango_edad?: string | null;
  barrio?: string | null;
  distrito?: string | null;
  status?: string | null;
  estado?: string | null;
  severity?: string | null;
  severidad?: string | null;
  layer?: string | null;
  source?: string | null;
  bbox?: string | null;
  limit?: number | null;
}) => {
  const query = buildQuery(params);
  const response = await panelApi.get<unknown>(`/api/v2/analytics/operations/heatmap${query}`, {
    tenantSlug: params?.tenantSlug,
  });
  return normalizeHeatmap(response);
};

export const getPublicMapConfigV1 = async (params?: { tenantSlug?: string | null }) => {
  const query = buildTenantQuery(params?.tenantSlug);
  const response = await panelApi.get<unknown>(`/api/map/config${query}`, {
    tenantSlug: params?.tenantSlug,
  });
  return normalizeMapConfig(response);
};

export const getOperationsActionCenterV2 = async (params?: {
  tenantSlug?: string | null;
  tenant_id?: number | string | null;
  from?: string | null;
  to?: string | null;
  range?: string | null;
  scope?: string | null;
}) => {
  const query = buildQuery(params);
  const response = await panelApi.get<unknown>(`/api/v2/analytics/operations/action-center${query}`, {
    tenantSlug: params?.tenantSlug,
  });
  return normalizeActionCenter(response);
};

export const getOperationsFreshnessV2 = async (params?: {
  tenantSlug?: string | null;
  tenant_id?: number | string | null;
  from?: string | null;
  to?: string | null;
  range?: string | null;
  scope?: string | null;
}) => {
  const query = buildQuery(params);
  const response = await panelApi.get<unknown>(`/api/v2/analytics/operations/freshness${query}`, {
    tenantSlug: params?.tenantSlug,
  });
  return normalizeFreshness(response);
};
