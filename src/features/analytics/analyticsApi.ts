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
  OperationsHeatmapPoint,
  OperationsHeatmapV1,
  OperationsTrend,
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
  range?: string | null;
  scope?: string | null;
  channel?: string | null;
  canal?: string | null;
  category?: string | null;
  categoria?: string | null;
  distrito?: string | null;
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
  append('range', params.range);
  append('scope', params.scope);
  append('channel', params.channel);
  append('canal', params.canal);
  append('category', params.category);
  append('categoria', params.categoria);
  append('distrito', params.distrito);
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
  };
};

const normalizeHeatmapPoints = (value: unknown): OperationsHeatmapPoint[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((point) => normalizeHeatmapPoint(point))
    .filter((point): point is OperationsHeatmapPoint => point !== null);
};

const normalizeHeatmap = (response: unknown): OperationsHeatmapV1 => {
  const record = pickRecord(response) ?? {};
  const renderContract = pickRecord(record.render_contract);
  const rawLayers = Array.isArray(renderContract?.layers) ? renderContract.layers : [];

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
  };
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
  range?: string | null;
  scope?: string | null;
  bbox?: string | null;
  limit?: number | null;
}) => {
  const query = buildQuery(params);
  const response = await panelApi.get<unknown>(`/api/v2/analytics/operations/heatmap${query}`, {
    tenantSlug: params?.tenantSlug,
  });
  return normalizeHeatmap(response);
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
