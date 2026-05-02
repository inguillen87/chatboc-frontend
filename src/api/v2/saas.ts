import { panelApi } from '@/api/v2/client';
import { ApiError } from '@/utils/api';
import type { ChatExperienceBlock } from '@/types/chat';
import type { EducationCaseAlias } from '@/types/education';

type UnknownRecord = Record<string, unknown>;

export interface SaasAction {
  id: string;
  label: string;
  type?: string;
  href?: string;
  method?: string;
  payload?: unknown;
  disabled?: boolean;
  raw?: unknown;
}

export interface SaasAlert {
  id: string;
  label: string;
  message?: string;
  severity?: string;
  action?: SaasAction;
  raw?: unknown;
}

export interface CoverageBucket {
  id: string;
  label: string;
  count: number;
  total?: number;
  percentage?: number;
  status?: string;
  raw?: unknown;
}

export interface CoverageEmployee {
  id: string;
  name: string;
  status?: string;
  scope?: unknown;
  workload?: number;
  categories: string[];
  zones: string[];
  channels: string[];
  raw?: unknown;
}

export interface EmployeeCoverageV2 {
  contract_version?: string;
  request_id?: string;
  summary: UnknownRecord;
  employees: CoverageEmployee[];
  categories: CoverageBucket[];
  zones: CoverageBucket[];
  channels: CoverageBucket[];
  alerts: SaasAlert[];
  raw: unknown;
  categorias: CoverageBucket[];
  zonas: CoverageBucket[];
  canales: CoverageBucket[];
  permisos: CoverageBucket[];
  items: CoverageBucket[];
}

export interface TenantHealthCheck {
  id: string;
  label: string;
  status?: string;
  value?: unknown;
  raw?: unknown;
}

export interface TenantHealthV2 {
  contract_version?: string;
  request_id?: string;
  score?: number;
  health_score?: number;
  status?: string;
  checks: TenantHealthCheck[];
  integrations: TenantHealthCheck[];
  queues: TenantHealthCheck[];
  recent_errors: TenantHealthCheck[];
  metrics: UnknownRecord;
  recommended_actions: SaasAction[];
  raw: unknown;
}

export interface SuperadminTenantHealthRow {
  tenant_slug: string;
  tenant_name?: string;
  score?: number;
  health_score?: number;
  status?: string;
  checks_count?: number;
  errors_count?: number;
  recommended_actions_count?: number;
  raw?: unknown;
}

export interface SuperadminExecutiveSummaryV2 {
  contract_version?: string;
  request_id?: string;
  kpis: UnknownRecord;
  strategic_overview: UnknownRecord;
  realtime: UnknownRecord;
  tenant_health: SuperadminTenantHealthRow[];
  top_risky_tenants: SuperadminTenantHealthRow[];
  recommended_actions: SaasAction[];
  raw: unknown;
}

export interface NotificationPreference {
  key: string;
  label: string;
  enabled?: boolean;
  value?: unknown;
  channel?: string;
  raw?: unknown;
}

export interface NotificationHooksV2 {
  contract_version?: string;
  request_id?: string;
  preferences: NotificationPreference[];
  raw_preferences: unknown;
  triggers: TenantHealthCheck[];
  delivery_config: UnknownRecord;
  templates: TenantHealthCheck[];
  delivery_status?: NotificationDeliveryStatusV2;
  raw: unknown;
}

export interface DeliveryBucket {
  id: string;
  label: string;
  count: number;
  rate?: number;
  raw?: unknown;
}

export interface NotificationDeliveryStatusV2 {
  contract_version?: string;
  request_id?: string;
  totals: UnknownRecord;
  by_status: DeliveryBucket[];
  by_channel: DeliveryBucket[];
  success_rate?: number;
  raw: unknown;
}

export interface OmnichannelPresenceUser {
  id: string;
  name: string;
  type: 'user' | 'agent';
  status: 'online' | 'offline' | 'idle';
  avatarUrl?: string;
  raw?: unknown;
}

export interface OmnichannelTimelineEvent {
  id: string;
  ticket_id: string;
  type: 'message_created' | 'status_changed' | 'assignment_changed' | 'presence_changed' | 'message_read' | 'typing';
  timestamp: string;
  actor: {
    id: string;
    type: 'user' | 'agent' | 'system';
    name: string;
  };
  payload: UnknownRecord;
}

export interface OmnichannelInboxItem {
  id: string;
  title: string;
  status: string;
  channel?: string;
  category?: string;
  sensitivity?: string;
  lastMessageAt: string;
  unreadCount: number;
  contact?: UnknownRecord;
  location?: UnknownRecord;
  school_case?: EducationCaseAlias | null;
  presence: OmnichannelPresenceUser[];
  timeline: OmnichannelTimelineEvent[];
  actions: SaasAction[];
  summary?: string;
  next_steps: string[];
  suggested_reply?: string;
  agent_copilot_suggestions: ChatExperienceBlock[];
  raw?: unknown;
}

export interface OmnichannelInboxV2 {
  contract_version?: string;
  request_id?: string;
  items: OmnichannelInboxItem[];
  summary: UnknownRecord;
  raw: unknown;
}

export interface OmnichannelInboxActionPayload {
  action: 'assign' | 'reply' | 'handoff' | 'close' | 'reopen' | 'set_priority' | string;
  ticket_id?: string | number;
  payload?: UnknownRecord;
}

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const shouldFallbackEndpoint = (error: unknown) =>
  error instanceof ApiError && [404, 405, 501].includes(error.status);

const asString = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
};

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const asBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

const getSource = (response: unknown) => {
  if (isRecord(response) && isRecord(response.data)) return response.data;
  return response;
};

const getFirst = (record: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const firstArray = (record: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value;
    if (isRecord(value) && Array.isArray(value.items)) return value.items;
  }
  return [];
};

const normalizeEducationCaseAlias = (value: unknown): EducationCaseAlias | null => {
  if (!isRecord(value)) return null;
  return {
    ...value,
    contract_version: asString(value.contract_version),
    id: asString(getFirst(value, ['id', 'alias_id'])),
    case_id: getFirst(value, ['case_id', 'school_case_id', 'education_case_id']) as string | number | null | undefined,
    ticket_id: getFirst(value, ['ticket_id', 'ticketId']) as string | number | null | undefined,
    school_id: getFirst(value, ['school_id', 'colegio_id']) as string | number | null | undefined,
    school_name: asString(getFirst(value, ['school_name', 'colegio_nombre', 'institution_name'])) ?? null,
    student_id: getFirst(value, ['student_id', 'alumno_id']) as string | number | null | undefined,
    student_name: asString(getFirst(value, ['student_name', 'alumno_nombre'])) ?? null,
    guardian_id: getFirst(value, ['guardian_id', 'family_id', 'tutor_id']) as string | number | null | undefined,
    guardian_name: asString(getFirst(value, ['guardian_name', 'family_name', 'tutor_nombre'])) ?? null,
    case_type: asString(getFirst(value, ['case_type', 'type', 'tipo'])) ?? null,
    status: asString(getFirst(value, ['status', 'estado'])) ?? null,
    sensitivity_level: asString(getFirst(value, ['sensitivity_level', 'sensitivity', 'sensibilidad'])) ?? null,
    requires_handoff: typeof value.requires_handoff === 'boolean' ? value.requires_handoff : null,
  };
};

const normalizeRatio = (value: number | undefined) => {
  if (value === undefined) return undefined;
  return value > 1 ? value / 100 : value;
};

const arrayOfStrings = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter((item): item is string => Boolean(item));
};

const normalizeExperienceBlocks = (value: unknown): ChatExperienceBlock[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (typeof item === 'string' && item.trim()) {
        const label = item.trim();
        return { id: `suggestion_${index + 1}`, label, text: label };
      }
      if (!isRecord(item)) return null;
      return {
        ...item,
        id: asString(getFirst(item, ['id', 'key', 'slug'])) ?? `suggestion_${index + 1}`,
        title: asString(item.title),
        label: asString(getFirst(item, ['label', 'title', 'text', 'name'])),
        detail: asString(getFirst(item, ['detail', 'description', 'subtitle'])),
        description: asString(getFirst(item, ['description', 'detail', 'subtitle'])),
        text: asString(getFirst(item, ['text', 'message', 'prompt', 'label', 'title'])),
        intent: asString(item.intent),
        payload: isRecord(item.payload) ? item.payload : null,
      };
    })
    .filter((item): item is ChatExperienceBlock => Boolean(item));
};

const normalizeAction = (value: unknown, index = 0): SaasAction | null => {
  if (typeof value === 'string' && value.trim()) {
    return { id: value.trim(), label: value.trim(), raw: value };
  }
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'key', 'action_id', 'slug'])) ?? `action_${index + 1}`;
  const label =
    asString(getFirst(value, ['label', 'title', 'name', 'action', 'text'])) ??
    id;
  return {
    id,
    label,
    type: asString(getFirst(value, ['type', 'kind'])),
    href: asString(getFirst(value, ['href', 'url', 'path'])),
    method: asString(value.method),
    payload: value.payload,
    disabled: asBoolean(value.disabled),
    raw: value,
  };
};

const normalizeActions = (value: unknown) => {
  const rawActions = Array.isArray(value)
    ? value
    : isRecord(value)
      ? Object.entries(value).map(([key, item]) => (isRecord(item) ? { key, ...item } : { key, label: key, value: item }))
      : [];
  return rawActions.map(normalizeAction).filter((action): action is SaasAction => Boolean(action));
};

const normalizeAlert = (value: unknown, index = 0): SaasAlert | null => {
  if (typeof value === 'string' && value.trim()) {
    return { id: `alert_${index + 1}`, label: value.trim(), raw: value };
  }
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'key', 'code', 'slug'])) ?? `alert_${index + 1}`;
  const label = asString(getFirst(value, ['label', 'title', 'name', 'message'])) ?? id;
  const action = normalizeAction(value.action, index);
  return {
    id,
    label,
    message: asString(getFirst(value, ['message', 'description', 'detail'])),
    severity: asString(getFirst(value, ['severity', 'status', 'level'])),
    action: action ?? undefined,
    raw: value,
  };
};

const normalizeAlerts = (value: unknown) => {
  const rawAlerts = Array.isArray(value)
    ? value
    : isRecord(value)
      ? Object.entries(value).map(([key, item]) => (isRecord(item) ? { key, ...item } : { key, label: key, value: item }))
      : [];
  return rawAlerts.map(normalizeAlert).filter((alert): alert is SaasAlert => Boolean(alert));
};

const normalizeBucket = (value: unknown, index = 0): CoverageBucket | null => {
  if (typeof value === 'string' && value.trim()) {
    return { id: value.trim(), label: value.trim(), count: 0, raw: value };
  }
  if (!isRecord(value)) return null;
  const id =
    asString(getFirst(value, ['id', 'key', 'slug', 'label', 'name', 'categoria', 'zona', 'channel', 'canal'])) ??
    `bucket_${index + 1}`;
  const label =
    asString(getFirst(value, ['label', 'title', 'name', 'categoria', 'zona', 'channel', 'canal'])) ??
    id;
  return {
    id,
    label,
    count: asNumber(getFirst(value, ['count', 'employees', 'employee_count', 'value', 'covered', 'total'])) ?? 0,
    total: asNumber(value.total),
    percentage: asNumber(getFirst(value, ['percentage', 'rate', 'coverage_rate'])),
    status: asString(getFirst(value, ['status', 'state'])),
    raw: value,
  };
};

const normalizeBuckets = (value: unknown) => {
  const rawBuckets = Array.isArray(value)
    ? value
    : isRecord(value)
      ? Object.entries(value).map(([key, item]) => (isRecord(item) ? { key, ...item } : { key, label: key, count: item }))
      : [];
  return rawBuckets.map(normalizeBucket).filter((bucket): bucket is CoverageBucket => Boolean(bucket));
};

const normalizeCheck = (value: unknown, index = 0): TenantHealthCheck | null => {
  if (typeof value === 'string' && value.trim()) {
    return { id: value.trim(), label: value.trim(), raw: value };
  }
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'key', 'slug', 'code', 'name'])) ?? `item_${index + 1}`;
  const label = asString(getFirst(value, ['label', 'title', 'name', 'message'])) ?? id;
  return {
    id,
    label,
    status: asString(getFirst(value, ['status', 'state', 'severity'])),
    value: getFirst(value, ['value', 'count', 'rate', 'enabled']),
    raw: value,
  };
};

const normalizeChecks = (value: unknown) => {
  const rawItems = Array.isArray(value)
    ? value
    : isRecord(value)
      ? Object.entries(value).map(([key, item]) => (isRecord(item) ? { key, ...item } : { key, label: key, value: item }))
      : [];
  return rawItems.map(normalizeCheck).filter((item): item is TenantHealthCheck => Boolean(item));
};

const normalizeRecordBuckets = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map(normalizeBucket).filter((bucket): bucket is DeliveryBucket => Boolean(bucket)) as DeliveryBucket[];
  }
  if (!isRecord(value)) return [];
  return Object.entries(value).map(([key, item]) => {
    if (isRecord(item)) {
      return {
        id: key,
        label: asString(getFirst(item, ['label', 'name', 'status', 'channel'])) ?? key,
        count: asNumber(getFirst(item, ['count', 'total', 'value'])) ?? 0,
        rate: asNumber(getFirst(item, ['rate', 'success_rate', 'percentage'])),
        raw: item,
      };
    }
    return {
      id: key,
      label: key,
      count: asNumber(item) ?? 0,
      raw: item,
    };
  });
};

const normalizeEmployee = (value: unknown, index = 0): CoverageEmployee | null => {
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'employee_id', 'user_id', 'email'])) ?? `employee_${index + 1}`;
  const scope = asRecord(value.scope);
  return {
    id,
    name: asString(getFirst(value, ['name', 'nombre', 'label', 'email'])) ?? id,
    status: asString(getFirst(value, ['status', 'state'])),
    scope: value.scope,
    workload: asNumber(getFirst(value, ['workload', 'load', 'assigned_count', 'tickets_count'])),
    categories: arrayOfStrings(getFirst(value, ['categories', 'categorias']) ?? scope.categories ?? scope.categorias),
    zones: arrayOfStrings(getFirst(value, ['zones', 'zonas']) ?? scope.zones ?? scope.zonas),
    channels: arrayOfStrings(getFirst(value, ['channels', 'canales']) ?? scope.channels ?? scope.canales),
    raw: value,
  };
};

export const normalizeEmployeeCoverageV2 = (response: unknown): EmployeeCoverageV2 => {
  const source = getSource(response);
  const record = asRecord(source);
  const coverage = asRecord(record.coverage);
  const categorySource =
    getFirst(coverage, ['categories', 'categorias', 'category_coverage']) ??
    getFirst(record, ['categories', 'categorias', 'category_coverage']);
  const zoneSource =
    getFirst(coverage, ['zones', 'zonas', 'zone_coverage']) ??
    getFirst(record, ['zones', 'zonas', 'zone_coverage']);
  const channelSource =
    getFirst(coverage, ['channels', 'canales', 'channel_coverage']) ??
    getFirst(record, ['channels', 'canales', 'channel_coverage']);
  const categories = normalizeBuckets(categorySource);
  const zones = normalizeBuckets(zoneSource);
  const channels = normalizeBuckets(channelSource);

  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    summary: asRecord(record.summary),
    employees: firstArray(record, ['employees', 'items', 'team']).map(normalizeEmployee).filter((item): item is CoverageEmployee => Boolean(item)),
    categories,
    zones,
    channels,
    alerts: normalizeAlerts(getFirst(record, ['alerts', 'alertas'])),
    raw: response,
    categorias: categories,
    zonas: zones,
    canales: channels,
    permisos: channels,
    items: [...categories, ...zones, ...channels],
  };
};

export const normalizeTenantHealthV2 = (response: unknown): TenantHealthV2 => {
  const source = getSource(response);
  const record = asRecord(source);
  const score = asNumber(getFirst(record, ['score', 'health_score', 'healthScore']));
  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    score,
    health_score: normalizeRatio(score),
    status: asString(getFirst(record, ['status', 'state'])),
    checks: normalizeChecks(record.checks),
    integrations: normalizeChecks(getFirst(record, ['integrations', 'integraciones'])),
    queues: normalizeChecks(getFirst(record, ['queues', 'colas'])),
    recent_errors: normalizeChecks(getFirst(record, ['recent_errors', 'errors', 'errores_recientes'])),
    metrics: asRecord(record.metrics),
    recommended_actions: normalizeActions(getFirst(record, ['recommended_actions', 'actions', 'acciones_recomendadas'])),
    raw: response,
  };
};

const normalizeTenantHealthRow = (value: unknown, index = 0): SuperadminTenantHealthRow | null => {
  if (!isRecord(value)) return null;
  const tenantSlug =
    asString(getFirst(value, ['tenant_slug', 'slug', 'tenant', 'tenant_id'])) ??
    `tenant_${index + 1}`;
  const score = asNumber(getFirst(value, ['score', 'health_score', 'healthScore']));
  const checks = firstArray(value, ['checks']);
  const recentErrors = firstArray(value, ['recent_errors', 'errors']);
  const actions = firstArray(value, ['recommended_actions', 'actions']);
  return {
    tenant_slug: tenantSlug,
    tenant_name: asString(getFirst(value, ['tenant_name', 'name', 'nombre'])),
    score,
    health_score: normalizeRatio(score),
    status: asString(getFirst(value, ['status', 'state'])),
    checks_count: asNumber(value.checks_count) ?? checks.length,
    errors_count: asNumber(value.errors_count) ?? recentErrors.length,
    recommended_actions_count: asNumber(value.recommended_actions_count) ?? actions.length,
    raw: value,
  };
};

const normalizeTenantHealthRows = (value: unknown) =>
  asArray(value).map(normalizeTenantHealthRow).filter((row): row is SuperadminTenantHealthRow => Boolean(row));

export const normalizeSuperadminExecutiveSummaryV2 = (response: unknown): SuperadminExecutiveSummaryV2 => {
  const source = getSource(response);
  const record = asRecord(source);
  const kpis = asRecord(getFirst(record, ['kpis', 'summary', 'strategic_overview', 'metrics']));
  const tenantHealthSource = getFirst(record, ['tenant_health', 'health_by_tenant', 'tenants_health']);
  const tenantHealth = normalizeTenantHealthRows(
    isRecord(tenantHealthSource) && Array.isArray(tenantHealthSource.items)
      ? tenantHealthSource.items
      : tenantHealthSource,
  );
  const topRisky = normalizeTenantHealthRows(getFirst(record, ['top_risky_tenants', 'risky_tenants']));
  const avgHealthScore = asNumber(getFirst(kpis, ['avg_health_score', 'average_health_score', 'health_score']));
  const riskyCount = asNumber(getFirst(kpis, ['risky_tenants', 'top_risky_tenants', 'risk_count'])) ?? topRisky.length;

  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    kpis,
    strategic_overview: {
      ...kpis,
      total_tenants: getFirst(kpis, ['total_tenants', 'tenants', 'tenant_count']) ?? tenantHealth.length,
      active_tenants: getFirst(kpis, ['active_tenants', 'active_tenant_count']),
      avg_health_score: normalizeRatio(avgHealthScore),
      risky_tenants: riskyCount,
    },
    realtime: asRecord(record.realtime),
    tenant_health: tenantHealth,
    top_risky_tenants: topRisky,
    recommended_actions: normalizeActions(getFirst(record, ['recommended_actions', 'actions', 'acciones_recomendadas'])),
    raw: response,
  };
};

const normalizePreferences = (preferences: unknown): NotificationPreference[] => {
  if (Array.isArray(preferences)) {
    return preferences.map((item, index) => {
      if (!isRecord(item)) {
        const key = asString(item) ?? `preference_${index + 1}`;
        return { key, label: key, value: item, raw: item };
      }
      const key = asString(getFirst(item, ['key', 'id', 'channel', 'name', 'slug'])) ?? `preference_${index + 1}`;
      return {
        key,
        label: asString(getFirst(item, ['label', 'title', 'name', 'channel'])) ?? key,
        enabled: asBoolean(getFirst(item, ['enabled', 'active', 'value'])),
        value: getFirst(item, ['value', 'enabled', 'active']),
        channel: asString(item.channel),
        raw: item,
      };
    });
  }
  if (!isRecord(preferences)) return [];
  return Object.entries(preferences).map(([key, value]) => {
    const entry = asRecord(value);
    return {
      key,
      label: asString(getFirst(entry, ['label', 'title', 'name', 'channel'])) ?? key,
      enabled: asBoolean(isRecord(value) ? getFirst(entry, ['enabled', 'active', 'value']) : value),
      value: isRecord(value) ? getFirst(entry, ['value', 'enabled', 'active']) : value,
      channel: asString(entry.channel),
      raw: value,
    };
  });
};

export const normalizeNotificationHooksV2 = (response: unknown): NotificationHooksV2 => {
  const source = getSource(response);
  const record = asRecord(source);
  const rawPreferences = getFirst(record, ['preferences', 'notification_settings', 'settings']) ?? {};
  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    preferences: normalizePreferences(rawPreferences),
    raw_preferences: rawPreferences,
    triggers: normalizeChecks(record.triggers),
    delivery_config: asRecord(record.delivery_config),
    templates: normalizeChecks(record.templates),
    delivery_status: record.delivery_status ? normalizeNotificationDeliveryStatusV2(record.delivery_status) : undefined,
    raw: response,
  };
};

export const normalizeNotificationDeliveryStatusV2 = (response: unknown): NotificationDeliveryStatusV2 => {
  const source = getSource(response);
  const record = asRecord(source);
  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    totals: asRecord(record.totals),
    by_status: normalizeRecordBuckets(getFirst(record, ['by_status', 'status_totals', 'statuses'])),
    by_channel: normalizeRecordBuckets(getFirst(record, ['by_channel', 'channel_totals', 'channels'])),
    success_rate: normalizeRatio(asNumber(record.success_rate)),
    raw: response,
  };
};

const normalizePresence = (value: unknown): OmnichannelPresenceUser[] =>
  asArray(value).map((item, index) => {
    const record = asRecord(item);
    const id = asString(getFirst(record, ['id', 'user_id', 'viewer_id', 'session_id'])) ?? `presence_${index + 1}`;
    const rawType = asString(getFirst(record, ['type', 'role', 'actor_type'])) ?? 'user';
    const rawStatus = asString(getFirst(record, ['status', 'presence_status', 'state'])) ?? 'offline';
    return {
      id,
      name: asString(getFirst(record, ['name', 'label', 'viewer_name', 'viewer_label'])) ?? id,
      type: rawType === 'agent' || rawType === 'employee' || rawType === 'admin' ? 'agent' : 'user',
      status: rawStatus === 'online' || rawStatus === 'active' ? 'online' : rawStatus === 'idle' ? 'idle' : 'offline',
      avatarUrl: asString(getFirst(record, ['avatarUrl', 'avatar_url', 'image_url'])),
      raw: item,
    };
  });

const normalizeTimeline = (value: unknown, ticketId: string): OmnichannelTimelineEvent[] =>
  asArray(value).map((item, index) => {
    const record = asRecord(item);
    const actorRecord = asRecord(record.actor);
    const rawType = asString(getFirst(record, ['type', 'event_type', 'kind'])) ?? '';
    const content = getFirst(record, ['content', 'text', 'message', 'mensaje', 'comentario', 'preview_text']);
    const type: OmnichannelTimelineEvent['type'] =
      rawType === 'assignment_changed'
        ? 'assignment_changed'
        : rawType === 'presence_changed'
          ? 'presence_changed'
          : rawType === 'message_read'
            ? 'message_read'
            : rawType === 'typing'
              ? 'typing'
              : content !== undefined
                ? 'message_created'
                : 'status_changed';
    const actorTypeRaw = asString(getFirst(actorRecord, ['type', 'role'])) ?? asString(getFirst(record, ['actor_type', 'role']));
    const actorType = actorTypeRaw === 'agent' || actorTypeRaw === 'employee' || actorTypeRaw === 'admin'
      ? 'agent'
      : actorTypeRaw === 'system'
        ? 'system'
        : 'user';

    return {
      id: asString(getFirst(record, ['id', 'event_id', 'message_id'])) ?? `${ticketId}:event:${index + 1}`,
      ticket_id: ticketId,
      type,
      timestamp: asString(getFirst(record, ['timestamp', 'created_at', 'date', 'fecha'])) ?? new Date().toISOString(),
      actor: {
        id: asString(getFirst(actorRecord, ['id', 'user_id'])) ?? asString(record.actor_id) ?? 'system',
        type: actorType,
        name: asString(getFirst(actorRecord, ['name', 'label'])) ?? asString(record.actor_name) ?? actorType,
      },
      payload: {
        ...record,
        content,
        new_status: getFirst(record, ['new_status', 'status', 'estado']),
        new_assignee_name: getFirst(record, ['new_assignee_name', 'assignee_name']),
      },
    };
  });

export const normalizeOmnichannelInboxItemV2 = (value: unknown, index = 0): OmnichannelInboxItem | null => {
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'ticket_id', 'conversation_id', 'nro_ticket'])) ?? `inbox_${index + 1}`;
  const contact = asRecord(value.contact);
  const schoolCase = normalizeEducationCaseAlias(getFirst(value, ['school_case', 'education_case', 'case_alias']));
  const timelineSource = getFirst(value, ['timeline', 'events', 'messages', 'conversation']);
  const experienceBlueprint = asRecord(value.experience_blueprint);
  const agentCopilot =
    asRecord(value.agent_copilot).suggestions ??
    getFirst(value, ['agent_copilot_suggestions', 'copilot_suggestions']) ??
    asRecord(asRecord(experienceBlueprint.agent_copilot).suggestions).items ??
    asRecord(experienceBlueprint.agent_copilot).suggestions;
  return {
    id,
    title:
      asString(getFirst(value, ['title', 'subject', 'asunto'])) ??
      asString(getFirst(contact, ['name', 'nombre', 'display_name'])) ??
      id,
    status: asString(getFirst(value, ['status', 'estado', 'state'])) ?? 'unknown',
    channel: asString(getFirst(value, ['channel', 'canal'])),
    category: asString(getFirst(value, ['category', 'categoria'])),
    sensitivity: asString(getFirst(value, ['sensitivity', 'priority', 'prioridad'])),
    lastMessageAt: asString(getFirst(value, ['last_message_at', 'lastMessageAt', 'updated_at', 'fecha'])) ?? new Date().toISOString(),
    unreadCount: asNumber(getFirst(value, ['unread_count', 'unreadCount'])) ?? 0,
    contact: value.contact ? contact : undefined,
    location: value.location ? asRecord(value.location) : undefined,
    school_case: schoolCase,
    presence: normalizePresence(getFirst(value, ['presence', 'viewers', 'active_viewers'])),
    timeline: normalizeTimeline(timelineSource, id),
    actions: normalizeActions(value.actions),
    summary: asString(getFirst(value, ['summary', 'case_summary', 'ai_summary'])),
    next_steps: arrayOfStrings(getFirst(value, ['next_steps', 'suggested_next_steps'])),
    suggested_reply: asString(getFirst(value, ['suggested_reply', 'reply_suggestion'])),
    agent_copilot_suggestions: normalizeExperienceBlocks(agentCopilot),
    raw: value,
  };
};

export const normalizeOmnichannelInboxV2 = (response: unknown): OmnichannelInboxV2 => {
  const source = getSource(response);
  const record = asRecord(source);
  const itemsSource = firstArray(record, ['items', 'tickets', 'conversations', 'inbox']);
  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    items: itemsSource.map(normalizeOmnichannelInboxItemV2).filter((item): item is OmnichannelInboxItem => Boolean(item)),
    summary: asRecord(record.summary),
    raw: response,
  };
};

export const getEmployeeCoverageV2 = async (tenantSlug?: string | null) => {
  const encoded = tenantSlug ? encodeURIComponent(tenantSlug) : null;
  let response: unknown;
  try {
    response = await panelApi.get<unknown>(
      encoded ? `/api/v2/tenants/${encoded}/employee-coverage` : '/api/v2/employee-coverage',
      { tenantSlug },
    );
  } catch (error) {
    if (!shouldFallbackEndpoint(error) || !encoded) throw error;
    try {
      response = await panelApi.get<unknown>('/api/v2/employee-coverage', { tenantSlug });
    } catch (fallbackError) {
      if (!shouldFallbackEndpoint(fallbackError)) throw fallbackError;
      response = await panelApi.get<unknown>(`/api/admin/tenants/${encoded}/employees/coverage`, { tenantSlug });
    }
  }
  return normalizeEmployeeCoverageV2(response);
};

export const getTenantHealthV2 = async (tenantSlug?: string | null) => {
  const encoded = tenantSlug ? encodeURIComponent(tenantSlug) : null;
  let response: unknown;
  try {
    response = await panelApi.get<unknown>(
      encoded ? `/api/v2/tenants/${encoded}/health` : '/api/v2/tenant-health',
      { tenantSlug },
    );
  } catch (error) {
    if (!shouldFallbackEndpoint(error) || !encoded) throw error;
    try {
      response = await panelApi.get<unknown>('/api/v2/tenant-health', { tenantSlug });
    } catch (fallbackError) {
      if (!shouldFallbackEndpoint(fallbackError)) throw fallbackError;
      response = await panelApi.get<unknown>('/api/admin/analytics/tenant-health', { tenantSlug });
    }
  }
  return normalizeTenantHealthV2(response);
};

export const getSuperadminExecutiveSummaryV2 = async () => {
  let response: unknown;
  try {
    response = await panelApi.get<unknown>('/api/v2/superadmin/executive-summary');
  } catch (error) {
    if (!shouldFallbackEndpoint(error)) throw error;
    try {
      response = await panelApi.get<unknown>('/api/v2/super-admin/executive-summary');
    } catch (fallbackError) {
      if (!shouldFallbackEndpoint(fallbackError)) throw fallbackError;
      response = await panelApi.get<unknown>('/api/admin/analytics/executive-summary');
    }
  }
  return normalizeSuperadminExecutiveSummaryV2(response);
};

export const getNotificationHooksV2 = async (tenantSlug?: string | null) => {
  const response = await panelApi.get<unknown>('/api/v2/notifications/hooks', { tenantSlug });
  return normalizeNotificationHooksV2(response);
};

export const updateNotificationHooksV2 = async (payload: unknown, tenantSlug?: string | null) => {
  const response = await panelApi.post<unknown>('/api/v2/notifications/hooks', payload, { tenantSlug });
  return normalizeNotificationHooksV2(response);
};

export const getNotificationDeliveryStatusV2 = async (tenantSlug?: string | null) => {
  const response = await panelApi.get<unknown>('/api/v2/notifications/delivery-status', { tenantSlug });
  return normalizeNotificationDeliveryStatusV2(response);
};

export const getOmnichannelInboxV2 = async (tenantSlug?: string | null) => {
  const response = await panelApi.get<unknown>('/api/v2/inbox/omnichannel', { tenantSlug });
  return normalizeOmnichannelInboxV2(response);
};

export const postOmnichannelInboxActionV2 = async (
  ticketId: string,
  payload: OmnichannelInboxActionPayload,
  tenantSlug?: string | null,
) => {
  const encodedTicketId = encodeURIComponent(ticketId);
  const payloadWithTicket = { ...payload, ticket_id: payload.ticket_id ?? ticketId };
  let response: unknown;
  try {
    response = await panelApi.post<unknown>(
      `/api/v2/inbox/omnichannel/${encodedTicketId}/actions`,
      payloadWithTicket,
      { tenantSlug },
    );
  } catch (error) {
    if (!shouldFallbackEndpoint(error)) throw error;
    response = await panelApi.post<unknown>(
      '/api/v2/inbox/omnichannel/actions',
      payloadWithTicket,
      { tenantSlug },
    );
  }
  const source = getSource(response);
  const record = asRecord(source);
  const candidate =
    getFirst(record, ['ticket', 'item', 'conversation', 'data']) ??
    source;
  const normalized =
    normalizeOmnichannelInboxItemV2(candidate) ??
    normalizeOmnichannelInboxItemV2({ ...record, id: ticketId });

  if (!normalized) {
    throw new ApiError('Respuesta invalida del endpoint de accion omnicanal.', 502, response);
  }

  return normalized;
};
