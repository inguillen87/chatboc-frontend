import { panelApi } from '@/api/v2/client';
import type {
  AnalyticsOverview,
  OperationsAIOpsQueueItem,
  OperationsAIOpsQueueV1,
  OperationsAIBriefV1,
  OperationsAIProviderStatusItem,
  OperationsAIProviderStatusV1,
  OperationsActionCenterV1,
  OperationsActionItem,
  OperationsAlert,
  OperationsBucketItem,
  OperationsCommerce,
  OperationsDashboardV1,
  OperationsFrontendContract,
  OperationsFreshnessSource,
  OperationsFreshnessV1,
  OperationsHeatmapFacet,
  OperationsHeatmapGeoFeatureCollection,
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

const normalizeStringList = (raw: unknown): string[] | undefined =>
  Array.isArray(raw)
    ? raw.map((item) => asString(item)).filter((item): item is string => Boolean(item))
    : undefined;

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
  include_ai?: boolean | number | string | null;
  ai?: boolean | number | string | null;
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
  append('include_ai', params.include_ai);
  append('ai', params.ai);

  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

const normalizeBucketItem = (value: unknown, keyFallback?: string): OperationsBucketItem | null => {
  if (typeof value === 'string' && value.trim()) {
    const label = value.trim();
    return {
      key: keyFallback ?? label,
      label,
    };
  }

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
    href: asString(item.href),
    frontend_path: asString(item.frontend_path),
    route: asString(item.route),
    method: asString(item.method),
    action_type: asString(item.action_type),
    target: pickRecord(item.target),
    ui_hint: asString(item.ui_hint),
    payload_template: pickRecord(item.payload_template),
    body_template: pickRecord(item.body_template),
    requires: normalizeStringList(item.requires),
    writes_enabled: asBoolean(item.writes_enabled),
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
    href: asString(value.href),
    frontend_path: asString(value.frontend_path),
    route: asString(value.route),
    method: asString(value.method),
    action_type: asString(value.action_type),
    target: pickRecord(value.target),
    ui_hint: asString(value.ui_hint),
    payload_template: pickRecord(value.payload_template),
    body_template: pickRecord(value.body_template),
    requires: normalizeStringList(value.requires),
    writes_enabled: asBoolean(value.writes_enabled),
  };
};

const normalizeBucketItemsWithActions = (value: unknown): OperationsBucketItem[] =>
  normalizeBucketItems(value).map((item) => {
    const actions = normalizeActions(item.actions);
    return actions.length ? { ...item, actions } : item;
  });

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
  const liveControlRoom = pickRecord(record.live_control_room);
  return {
    ...record,
    summary: pickRecord(record.summary),
    items: normalizeBucketItems(record.items),
    by_status: normalizeBucketItems(record.by_status),
    by_channel: normalizeBucketItems(record.by_channel),
    by_category: normalizeBucketItems(record.by_category),
    by_priority: normalizeBucketItems(record.by_priority),
    live_control_room: liveControlRoom
      ? {
          ...liveControlRoom,
          summary: pickRecord(liveControlRoom.summary),
          monitors: normalizeBucketItems(liveControlRoom.monitors),
          actions: normalizeActions(liveControlRoom.actions),
          realtime: pickRecord(liveControlRoom.realtime),
          frontend_contract: pickRecord(liveControlRoom.frontend_contract),
        }
      : undefined,
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

const normalizeCommerce = (value: unknown): OperationsCommerce => {
  const record = pickRecord(value) ?? {};
  return {
    ...record,
    contract_version: asString(record.contract_version),
    summary: pickRecord(record.summary),
    by_state: normalizeBucketItems(record.by_state),
    by_origin: normalizeBucketItems(record.by_origin),
    by_request_kind: normalizeBucketItems(record.by_request_kind),
    review_items: normalizeBucketItemsWithActions(record.review_items),
    frontend_contract: pickRecord(record.frontend_contract),
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
    commerce: normalizeCommerce(record.commerce),
    live_chat: normalizeLiveChat(record.live_chat),
    employees: normalizeEmployees(record.employees),
    maps: normalizeMaps(record.maps),
    alerts: normalizeAlerts(record.alerts),
    next_best_actions: normalizeActions(record.next_best_actions),
    ai_brief: isRecord(record.ai_brief) ? normalizeAIBrief(record.ai_brief) : undefined,
    frontend_contract: normalizeFrontendContract(record.frontend_contract),
  };
};

const normalizeHeatmapPoint = (value: unknown): OperationsHeatmapPoint | null => {
  if (!isRecord(value)) return null;
  const lat = asNumber(value.lat ?? value.latitude);
  const lng = asNumber(value.lng ?? value.lon ?? value.longitude);
  if (lat === undefined || lng === undefined) return null;
  const actions = normalizeActions(value.actions);

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
    actions: actions.length ? actions : undefined,
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

const normalizeHeatmapQuality = (value: unknown): OperationsHeatmapV1['quality'] => {
  if (!isRecord(value)) return undefined;
  return {
    ...value,
    contract_version: asString(value.contract_version),
    state: asString(value.state),
    label: asString(value.label),
    reason_code: asString(value.reason_code),
    coverage_rate: asNumber(value.coverage_rate),
    coverage_percent: asNumber(value.coverage_percent),
    visible_points: asNumber(value.visible_points),
    total_ticket_records: asNumber(value.total_ticket_records),
    ticket_records_with_coordinates: asNumber(value.ticket_records_with_coordinates),
    ticket_records_without_coordinates: asNumber(value.ticket_records_without_coordinates),
    pending_geocode: asNumber(value.pending_geocode),
    can_render_heatmap: asBoolean(value.can_render_heatmap),
    empty_state_action: pickRecord(value.empty_state_action),
  };
};

const normalizeHeatmapRealtime = (value: unknown): OperationsHeatmapV1['realtime'] => {
  if (!isRecord(value)) return undefined;
  return {
    ...value,
    contract_version: asString(value.contract_version),
    poll_seconds: asNumber(value.poll_seconds),
    socket_namespace: asString(value.socket_namespace),
    socket_events: Array.isArray(value.socket_events)
      ? value.socket_events.map((item) => asString(item)).filter((item): item is string => Boolean(item))
      : undefined,
    latest_event_at: asString(value.latest_event_at) ?? null,
    sources: Array.isArray(value.sources)
      ? value.sources.map((item) => asString(item)).filter((item): item is string => Boolean(item))
      : undefined,
  };
};

const normalizeHeatmapMapExperience = (value: unknown): OperationsHeatmapV1['map_experience'] => {
  if (!isRecord(value)) return undefined;

  return {
    ...value,
    contract_version: asString(value.contract_version),
    preferred_visualization: asString(value.preferred_visualization),
    map_engines: normalizeStringList(value.map_engines),
    layer_groups: normalizeStringList(value.layer_groups),
    empty_state_behavior: asString(value.empty_state_behavior),
    supports_reduced_motion: asBoolean(value.supports_reduced_motion),
  };
};

const normalizeHeatmapGeocodingGuidance = (
  value: unknown,
): NonNullable<OperationsHeatmapV1['geocoding']>['guidance'] => {
  if (!isRecord(value)) return undefined;
  return {
    ...value,
    contract_version: asString(value.contract_version),
    state: asString(value.state),
    reason_code: asString(value.reason_code),
    candidate_count: asNumber(value.candidate_count),
    coverage_percent: asNumber(value.coverage_percent),
    quality_state: asString(value.quality_state),
    backend_external_calls: asString(value.backend_external_calls),
    queue_behavior: asString(value.queue_behavior),
    recommended_actions: normalizeActions(value.recommended_actions),
  };
};

const normalizeHeatmapGeocoding = (value: unknown): OperationsHeatmapV1['geocoding'] => {
  if (!isRecord(value)) return undefined;
  type GeocodingCandidate = NonNullable<NonNullable<OperationsHeatmapV1['geocoding']>['candidates']>[number];
  const candidates = Array.isArray(value.candidates)
    ? value.candidates.reduce<GeocodingCandidate[]>((acc, candidate) => {
        if (!isRecord(candidate)) return acc;
        const actions = normalizeActions(candidate.actions);
        acc.push({
          ...candidate,
          record_id:
            typeof candidate.record_id === 'string' || typeof candidate.record_id === 'number'
              ? candidate.record_id
              : undefined,
          ticket_id:
            typeof candidate.ticket_id === 'string' || typeof candidate.ticket_id === 'number'
              ? candidate.ticket_id
              : undefined,
          address: asString(candidate.address ?? candidate.direccion),
          label: asString(candidate.label ?? candidate.title ?? candidate.name),
          category: asString(candidate.category ?? candidate.categoria),
          source: asString(candidate.source ?? candidate.origen),
          reason_code: asString(candidate.reason_code),
          actions: actions.length ? actions : undefined,
        });
        return acc;
      }, [])
    : undefined;

  return {
    ...value,
    contract_version: asString(value.contract_version),
    status: asString(value.status),
    reason_code: asString(value.reason_code),
    candidate_count: asNumber(value.candidate_count),
    guidance: normalizeHeatmapGeocodingGuidance(value.guidance),
    candidates,
    recommended_action: normalizeActionObject(value.recommended_action),
  };
};

const normalizeHeatmapNarrative = (value: unknown): OperationsHeatmapV1['map_narrative'] => {
  if (!isRecord(value)) return undefined;
  return {
    ...value,
    contract_version: asString(value.contract_version),
    state: asString(value.state),
    headline: asString(value.headline),
    body: asString(value.body),
    title: asString(value.title ?? value.headline),
    subtitle: asString(value.subtitle),
    description: asString(value.description ?? value.body),
    operator_summary: asString(value.operator_summary ?? value.summary ?? value.body),
    empty_state_title: asString(value.empty_state_title),
    empty_state_description: asString(value.empty_state_description),
    primary_cta: normalizeActionObject(value.primary_cta ?? value.primary_action),
  };
};

const normalizeHeatmapLayerStyleContract = (value: unknown): OperationsHeatmapV1['layer_style_contract'] => {
  if (!isRecord(value)) return undefined;
  return {
    ...value,
    contract_version: asString(value.contract_version),
    palette: normalizeStringList(value.palette),
    style_tokens: pickRecord(value.style_tokens),
    styles: normalizeBucketItems(value.styles),
    layers: normalizeBucketItems(value.layers),
    legend_items: normalizeBucketItems(value.legend_items ?? value.legend),
  };
};

const normalizeHeatmapViewportPresetItems = (value: unknown): NonNullable<OperationsHeatmapV1['viewport_presets']>['presets'] => {
  if (!Array.isArray(value)) return [];
  return value.reduce<NonNullable<OperationsHeatmapV1['viewport_presets']>['presets']>((acc, preset, index) => {
    if (!isRecord(preset)) return acc;
    const center = pickRecord(preset.center);
    acc.push({
      ...preset,
      id: asString(preset.id ?? preset.key) ?? `viewport_${index + 1}`,
      label: asString(preset.label ?? preset.title ?? preset.name),
      mode: asString(preset.mode),
      default: asBoolean(preset.default),
      description: asString(preset.description),
      center: center
        ? {
            ...center,
            lat: asNumber(center.lat ?? center.latitude),
            lng: asNumber(center.lng ?? center.lon ?? center.longitude),
          }
        : undefined,
      zoom: asNumber(preset.zoom),
      pitch: asNumber(preset.pitch),
      bearing: asNumber(preset.bearing),
      radius_km: asNumber(preset.radius_km ?? preset.radiusKm),
      reason_code: asString(preset.reason_code),
    });
    return acc;
  }, []);
};

const normalizeHeatmapViewportPresets = (value: unknown): OperationsHeatmapV1['viewport_presets'] => {
  const record = pickRecord(value);
  const presets = normalizeHeatmapViewportPresetItems(record?.presets ?? value);
  if (!presets.length) return undefined;
  return {
    ...(record ?? {}),
    contract_version: asString(record?.contract_version),
    default_preset_id:
      asString(record?.default_preset_id) ??
      presets.find((preset) => preset.default)?.id ??
      presets[0]?.id,
    camera_constraints: pickRecord(record?.camera_constraints),
    presets,
  };
};

const normalizeHeatmapAiLayers = (value: unknown): OperationsHeatmapV1['ai_layers'] => {
  if (!isRecord(value)) return undefined;
  const frontendContract = pickRecord(value.frontend_contract);
  return {
    ...value,
    contract_version: asString(value.contract_version),
    status: asString(value.status),
    mode: asString(value.mode),
    summary: pickRecord(value.summary),
    hf_status: pickRecord(value.hf_status),
    frontend_contract: frontendContract
      ? {
          ...frontendContract,
          map_engines: normalizeStringList(frontendContract.map_engines),
          layer_groups: normalizeStringList(frontendContract.layer_groups),
        }
      : undefined,
    layers: normalizeBucketItems(value.layers),
    risk_layers: normalizeBucketItems(value.risk_layers ?? value.ai_risk_layers),
    recommendations: normalizeActions(value.recommendations ?? value.actions),
  };
};

const normalizeHeatmapAiInsights = (value: unknown): OperationsHeatmapV1['ai_insights'] => {
  if (!isRecord(value)) return undefined;
  return {
    ...value,
    contract_version: asString(value.contract_version),
    provider_family: asString(value.provider_family),
    mode: asString(value.mode),
    domain: asString(value.domain),
    advisory_policy: pickRecord(value.advisory_policy),
    thresholds: pickRecord(value.thresholds),
    hf_status: pickRecord(value.hf_status),
    groups: pickRecord(value.groups),
    summary: pickRecord(value.summary),
    collection: pickRecord(value.collection),
    recommended_actions: normalizeActions(value.recommended_actions ?? value.actions),
    frontend_contract: pickRecord(value.frontend_contract),
  };
};

const normalizeHeatmapAiStatus = (value: unknown): OperationsHeatmapV1['ai_status'] => {
  if (!isRecord(value)) return undefined;
  return {
    ...value,
    contract_version: asString(value.contract_version),
    provider_family: asString(value.provider_family),
    mode: asString(value.mode),
    status: asString(value.status),
    configured: asBoolean(value.configured),
    zero_shot_enabled: asBoolean(value.zero_shot_enabled),
    used_hf: asBoolean(value.used_hf),
    fallback_reason: asString(value.fallback_reason),
    safe_to_render_without_hf_token: asBoolean(value.safe_to_render_without_hf_token),
    ai_layers_ready: asBoolean(value.ai_layers_ready),
    map_layer_hints: normalizeStringList(value.map_layer_hints),
    requires_human_attention: asBoolean(value.requires_human_attention),
  };
};

const normalizeHeatmapHotspotActions = (value: unknown): OperationsHeatmapV1['hotspot_actions'] => {
  if (!isRecord(value)) {
    const actions = normalizeActions(value);
    return actions.length ? { actions, playbook: [] } : undefined;
  }
  return {
    ...value,
    contract_version: asString(value.contract_version),
    safe_by_default: asBoolean(value.safe_by_default),
    writes_enabled: asBoolean(value.writes_enabled),
    quality_state: asString(value.quality_state),
    actions: normalizeActions(value.actions),
    playbook: normalizeActions(value.playbook),
  };
};

const normalizeGeoFeatureCollection = (value: unknown): OperationsHeatmapGeoFeatureCollection | undefined => {
  if (!isRecord(value) || value.type !== 'FeatureCollection' || !Array.isArray(value.features)) return undefined;
  return {
    ...value,
    type: 'FeatureCollection',
    features: value.features.filter((feature): feature is Record<string, unknown> => isRecord(feature)),
  };
};

const normalizeHeatmapGeoLayers = (value: unknown): OperationsHeatmapV1['geo_layers'] => {
  if (!isRecord(value)) return undefined;
  const rawCategories = pickRecord(value.categories);
  const categories = rawCategories
    ? Object.entries(rawCategories).reduce<Record<string, NonNullable<OperationsHeatmapV1['geo_layers']>['points']>>((acc, [key, raw]) => {
        const collection = normalizeGeoFeatureCollection(raw);
        if (collection) acc[key] = collection;
        return acc;
      }, {})
    : undefined;

  return {
    ...value,
    contract_version: asString(value.contract_version),
    provider: asString(value.provider),
    coordinate_order: asString(value.coordinate_order),
    points: normalizeGeoFeatureCollection(value.points),
    cells: normalizeGeoFeatureCollection(value.cells),
    hotspots: normalizeGeoFeatureCollection(value.hotspots),
    categories,
  };
};

const normalizeHeatmapSourceQuality = (value: unknown): OperationsHeatmapV1['source_quality'] => {
  if (!isRecord(value)) return undefined;
  return {
    ...value,
    contract_version: asString(value.contract_version),
    sources: pickRecord(value.sources) as Record<string, Record<string, unknown>> | undefined,
    summary: pickRecord(value.summary),
  };
};

const normalizeHeatmapSpatialFilter = (value: unknown): OperationsHeatmapV1['spatial_filter'] => {
  if (!isRecord(value)) return undefined;
  return {
    ...value,
    bbox: pickRecord(value.bbox) ?? null,
    applied: asBoolean(value.applied),
  };
};

const normalizeHeatmap = (response: unknown): OperationsHeatmapV1 => {
  const record = pickRecord(response) ?? {};
  const renderContract = pickRecord(record.render_contract);
  const rawLayers = Array.isArray(renderContract?.layers) ? renderContract.layers : [];
  const rawPremiumMetadata = renderContract?.premium_metadata ?? renderContract?.metadata;
  const premiumMetadata = Array.isArray(rawPremiumMetadata)
    ? rawPremiumMetadata.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : pickRecord(rawPremiumMetadata);
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
          can_render_heatmap: asBoolean(renderContract.can_render_heatmap),
          recommended_views: normalizeStringList(renderContract.recommended_views ?? renderContract.views),
          premium_metadata: premiumMetadata,
        }
      : undefined,
    summary: pickRecord(record.summary),
    bounds: pickRecord(record.bounds),
    points: normalizeHeatmapPoints(record.points),
    cells: normalizeBucketItemsWithActions(record.cells),
    hotspots: normalizeBucketItemsWithActions(record.hotspots),
    category_layers: normalizeBucketItemsWithActions(record.category_layers),
    demographics: normalizeHeatmapDemographics(record.demographics),
    quality: normalizeHeatmapQuality(record.quality),
    realtime: normalizeHeatmapRealtime(record.realtime),
    legend: pickRecord(record.legend),
    geo_layers: normalizeHeatmapGeoLayers(record.geo_layers),
    map_layers: pickRecord(record.map_layers) as OperationsHeatmapV1['map_layers'],
    source_quality: normalizeHeatmapSourceQuality(record.source_quality),
    spatial_filter: normalizeHeatmapSpatialFilter(record.spatial_filter),
    ai_layers: normalizeHeatmapAiLayers(record.ai_layers),
    ai_insights: normalizeHeatmapAiInsights(record.ai_insights),
    ai_status: normalizeHeatmapAiStatus(record.ai_status),
    map_narrative: normalizeHeatmapNarrative(record.map_narrative ?? record.narrative),
    layer_style_contract: normalizeHeatmapLayerStyleContract(record.layer_style_contract ?? record.style_contract),
    viewport_presets: normalizeHeatmapViewportPresets(record.viewport_presets ?? record.viewports),
    hotspot_actions: normalizeHeatmapHotspotActions(record.hotspot_actions),
    hotspot_playbook: normalizeActions(record.hotspot_playbook),
    operator_playbook: normalizeActions(record.operator_playbook),
    map_experience: normalizeHeatmapMapExperience(record.map_experience),
    geocoding: normalizeHeatmapGeocoding(record.geocoding ?? record.geocoding_queue),
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

const normalizeAIBrief = (response: unknown): OperationsAIBriefV1 => {
  const record = pickRecord(response) ?? {};
  const summary = pickRecord(record.summary);
  const priority = pickRecord(record.priority);
  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    tenant: pickRecord(record.tenant),
    period: pickRecord(record.period),
    generated_at: asString(record.generated_at),
    source_contract: asString(record.source_contract),
    severity: asString(record.severity) ?? asString(priority?.severity),
    headline: asString(record.headline) ?? asString(summary?.headline),
    narrative: asString(record.narrative) ?? asString(summary?.narrative),
    risk_level: asString(record.risk_level) ?? asString(priority?.label),
    dominant_intent: asString(record.dominant_intent) ?? asString(summary?.dominant_intent),
    dominant_intent_label: asString(record.dominant_intent_label) ?? asString(summary?.dominant_intent_label),
    sentiment: asString(record.sentiment) ?? asString(summary?.sentiment),
    priority,
    requires_human_attention: asBoolean(record.requires_human_attention),
    requires_location_focus: asBoolean(record.requires_location_focus),
    top_action: normalizeActionObject(record.top_action ?? (Array.isArray(record.recommended_actions) ? record.recommended_actions[0] : null)),
    focus_items: normalizeBucketItems(record.focus_items ?? priority?.focus_items),
    signals: pickRecord(record.signals),
    summary,
    alerts: normalizeAlerts(record.alerts),
    model_policy: pickRecord(record.model_policy),
    frontend_contract: normalizeFrontendContract(record.frontend_contract),
  };
};

const normalizeAIOpsQueueItem = (value: unknown, index: number): OperationsAIOpsQueueItem | null => {
  if (!isRecord(value)) return null;
  return {
    ...value,
    id: asString(value.id) ?? `ai_ops_${index + 1}`,
    source: asString(value.source),
    source_model: asString(value.source_model),
    record_id: asString(value.record_id) ?? asNumber(value.record_id),
    title: asString(value.title) ?? asString(value.label),
    priority: asString(value.priority),
    reason_codes: normalizeStringList(value.reason_codes) ?? [],
    recommended_action: normalizeActionObject(value.recommended_action),
    signals: pickRecord(value.signals),
    pii: pickRecord(value.pii),
  };
};

const normalizeAIOpsQueue = (response: unknown): OperationsAIOpsQueueV1 => {
  const record = pickRecord(response) ?? {};
  const rawItems = Array.isArray(record.items) ? record.items : [];
  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    enabled: asBoolean(record.enabled),
    reason_code: asString(record.reason_code),
    agent_display_name: asString(record.agent_display_name),
    tenant: pickRecord(record.tenant),
    period: pickRecord(record.period),
    generated_at: asString(record.generated_at),
    summary: pickRecord(record.summary),
    advisory_policy: pickRecord(record.advisory_policy),
    items: rawItems
      .map((item, index) => normalizeAIOpsQueueItem(item, index))
      .filter((item): item is OperationsAIOpsQueueItem => item !== null),
    signals: pickRecord(record.signals),
    model_policy: pickRecord(record.model_policy),
    frontend_contract: normalizeFrontendContract(record.frontend_contract),
  };
};

const normalizeAIProviderStatusItem = (value: unknown, key: string): OperationsAIProviderStatusItem => {
  const record = pickRecord(value) ?? {};
  const failure = pickRecord(record.last_failure);
  return {
    ...record,
    provider: asString(record.provider) ?? key,
    configured: asBoolean(record.configured),
    enabled: asBoolean(record.enabled),
    installed: asBoolean(record.installed),
    install_extras_enabled: asBoolean(record.install_extras_enabled),
    chat_default: asBoolean(record.chat_default),
    provider_order_enabled: asBoolean(record.provider_order_enabled),
    runtime_status: asString(record.runtime_status),
    quota_depleted: asBoolean(record.quota_depleted),
    fallback_behavior: asString(record.fallback_behavior),
    mode: asString(record.mode),
    chat_model: asString(record.chat_model),
    zero_shot_enabled: asBoolean(record.zero_shot_enabled),
    zero_shot_model: asString(record.zero_shot_model),
    embeddings_enabled: asBoolean(record.embeddings_enabled),
    embedding_model: asString(record.embedding_model),
    vision_enabled: asBoolean(record.vision_enabled),
    recommended_uses: normalizeStringList(record.recommended_uses),
    required_env: normalizeStringList(record.required_env),
    optional_env: normalizeStringList(record.optional_env),
    last_failure: failure
      ? {
          reason_code: asString(failure.reason_code),
          task: asString(failure.task),
          error_type: asString(failure.error_type),
        }
      : undefined,
  };
};

const normalizeAIProviderStatus = (response: unknown): OperationsAIProviderStatusV1 => {
  const record = pickRecord(response) ?? {};
  const providerRecord = pickRecord(record.providers) ?? {};
  const readiness = pickRecord(record.readiness) ?? {};
  const providers = Object.fromEntries(
    Object.entries(providerRecord).map(([key, value]) => [key, normalizeAIProviderStatusItem(value, key)]),
  );

  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    generated_at: asString(record.generated_at),
    secret_values_exposed: asBoolean(record.secret_values_exposed),
    llm_provider_order: normalizeStringList(record.llm_provider_order) ?? [],
    readiness: {
      ...readiness,
      chat_ready: asBoolean(readiness.chat_ready),
      specialized_ai_ready: asBoolean(readiness.specialized_ai_ready),
      status: asString(readiness.status),
      warnings: normalizeStringList(readiness.warnings) ?? [],
    },
    providers,
    model_policy: pickRecord(record.model_policy),
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
  include_ai?: boolean | number | string | null;
  ai?: boolean | number | string | null;
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

export const getOperationsAIBriefV2 = async (params?: {
  tenantSlug?: string | null;
  tenant_id?: number | string | null;
  from?: string | null;
  to?: string | null;
  range?: string | null;
  scope?: string | null;
}) => {
  const query = buildQuery(params);
  const response = await panelApi.get<unknown>(`/api/v2/analytics/operations/ai-brief${query}`, {
    tenantSlug: params?.tenantSlug,
  });
  return normalizeAIBrief(response);
};

export const getOperationsAIOpsQueueV2 = async (params?: {
  tenantSlug?: string | null;
  tenant_id?: number | string | null;
  from?: string | null;
  to?: string | null;
  range?: string | null;
  scope?: string | null;
  limit?: number | null;
}) => {
  const query = buildQuery(params);
  const response = await panelApi.get<unknown>(`/api/v2/analytics/operations/ai-ops-queue${query}`, {
    tenantSlug: params?.tenantSlug,
  });
  return normalizeAIOpsQueue(response);
};

export const getOperationsAIProviderStatusV2 = async (params?: {
  tenantSlug?: string | null;
  tenant_id?: number | string | null;
  from?: string | null;
  to?: string | null;
  range?: string | null;
  scope?: string | null;
}) => {
  const query = buildQuery(params);
  const response = await panelApi.get<unknown>(`/api/v2/analytics/operations/ai-provider-status${query}`, {
    tenantSlug: params?.tenantSlug,
  });
  return normalizeAIProviderStatus(response);
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
