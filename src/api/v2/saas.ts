import { panelApi } from '@/api/v2/client';
import { SAME_ORIGIN_PROXY_BASE } from '@/config';
import { ApiError } from '@/utils/api';
import type { ChatExperienceBlock } from '@/types/chat';
import type { EducationCaseAlias } from '@/types/education';
import type { RealtimeVoiceCapabilities } from '@/types/realtimeVoice';

type UnknownRecord = Record<string, unknown>;
const SAME_ORIGIN_API_BASE = SAME_ORIGIN_PROXY_BASE || '/api';

export interface SaasAction {
  id: string;
  label: string;
  type?: string;
  href?: string;
  endpoint?: string;
  method?: string;
  requires?: string[];
  payload?: unknown;
  payload_defaults?: UnknownRecord;
  payloadDefaults?: UnknownRecord;
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
  avatarSource?: string;
  avatarConsent?: boolean | string | number | null;
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
  legacy_id?: string;
  ticket_id?: string;
  nro_ticket?: string;
  source_model?: string;
  legacy_kind?: string;
  detail_endpoint?: string;
  conversation_id?: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  channel?: string;
  category?: string;
  intent?: string;
  sensitivity?: string;
  lastMessageAt: string;
  unreadCount: number;
  assignee?: UnknownRecord;
  contact?: UnknownRecord;
  location?: UnknownRecord;
  map?: UnknownRecord;
  canal_ingreso?: string;
  foto_url_directa?: string;
  archivos_count?: number;
  attachments: UnknownRecord[];
  sla?: UnknownRecord;
  school_case?: EducationCaseAlias | null;
  presence: OmnichannelPresenceUser[];
  timeline: OmnichannelTimelineEvent[];
  actions: SaasAction[];
  allowed_actions: SaasAction[];
  summary?: string;
  next_steps: string[];
  suggested_reply?: string;
  agent_copilot_suggestions: ChatExperienceBlock[];
  source_metadata?: UnknownRecord;
  frontend_contract?: UnknownRecord;
  raw?: unknown;
}

export interface OmnichannelInboxV2 {
  contract_version?: string;
  request_id?: string;
  items: OmnichannelInboxItem[];
  summary: UnknownRecord;
  raw: unknown;
}

export interface OmnichannelInboxDetailV2 {
  contract_version?: string;
  request_id?: string;
  item: OmnichannelInboxItem;
  raw: unknown;
}

export interface OmnichannelInboxActionPayload {
  action: 'assign' | 'reply' | 'handoff' | 'close' | 'reopen' | 'set_priority' | string;
  ticket_id?: string | number;
  endpoint?: string;
  body?: string;
  message?: string;
  visibility?: string;
  payload?: UnknownRecord;
}

export interface TenantAdminExperienceV2 {
  contract_version?: string;
  request_id?: string;
  tenant: UnknownRecord;
  profile: UnknownRecord;
  modules: UnknownRecord[];
  health: UnknownRecord;
  operations: UnknownRecord;
  lead_capture: UnknownRecord;
  surveys_votings: UnknownRecord;
  marketplace: UnknownRecord;
  whatsapp: UnknownRecord;
  whatsapp_experience?: WhatsappExperienceV2 | null;
  education: UnknownRecord;
  frontend_contract: UnknownRecord;
  raw: unknown;
}

export interface TenantOpsQaCheckV2 {
  id: string;
  label: string;
  ok: boolean;
  status?: string;
  severity?: string;
  endpoint?: string;
  details: UnknownRecord;
  next_action?: string;
  raw?: unknown;
}

export interface TenantOpsQaPlaybookV2 {
  contract_version?: string;
  request_id?: string;
  tenant: UnknownRecord;
  safe_by_default?: boolean;
  status?: string;
  score?: number;
  summary: UnknownRecord;
  checks: TenantOpsQaCheckV2[];
  e2e_flow_readiness?: ProductionSmokeE2EReadiness;
  recommended_next_actions: TenantOpsQaCheckV2[];
  execution: UnknownRecord;
  frontend_contract: UnknownRecord;
  raw: unknown;
}

export interface TenantOpsQaExecutionV2 {
  contract_version?: string;
  request_id?: string;
  tenant: UnknownRecord;
  check_id?: string;
  label?: string;
  ok?: boolean;
  status?: string;
  severity?: string;
  execution_mode?: string;
  sends_real_message?: boolean;
  details: UnknownRecord;
  next_action?: string;
  playbook_status?: string;
  playbook_score?: number;
  raw: unknown;
}

export interface WhatsappExperienceV2 {
  contract_version?: string;
  request_id?: string;
  tenant: UnknownRecord;
  channel: UnknownRecord;
  enterprise_rules: UnknownRecord;
  contact_window: UnknownRecord;
  conversation_intelligence: UnknownRecord & {
    voice_calls?: {
      enabled?: boolean;
      capabilities?: RealtimeVoiceCapabilities | null;
      raw?: UnknownRecord;
    };
  };
  content_modules: Record<string, UnknownRecord>;
  tracking: UnknownRecord;
  commerce: UnknownRecord;
  template_blueprint: UnknownRecord;
  webview_blueprint: UnknownRecord;
  finance_transactional: UnknownRecord;
  qa_playbook: UnknownRecord;
  message_ux_policy: UnknownRecord;
  admin_panel: UnknownRecord;
  education: UnknownRecord;
  frontend_contract: UnknownRecord;
  raw: unknown;
}

export interface SuperadminCommandCenterV2 {
  contract_version?: string;
  request_id?: string;
  summary: UnknownRecord;
  tenants: {
    items: UnknownRecord[];
    top_risky: UnknownRecord[];
  };
  tenant_creation: UnknownRecord;
  frontend_contract: UnknownRecord;
  raw: unknown;
}

export interface ProductionSmokeCheck {
  id: string;
  ok: boolean;
  status?: string;
  endpoint?: string;
  details?: UnknownRecord;
  raw: UnknownRecord;
}

export interface ProductionSmokeE2EFlow {
  id: string;
  label: string;
  surface?: string;
  ready: boolean;
  status?: string;
  endpoint?: string;
  frontend_entry?: string;
  qa_scenario_id?: string;
  meta_flow_ready?: boolean | null;
  evidence?: UnknownRecord;
  manual_test_steps: string[];
  acceptance_criteria: string[];
  automation: UnknownRecord;
  next_action?: string;
  raw: UnknownRecord;
}

export interface ProductionSmokeE2EReadiness {
  contract_version?: string;
  status: string;
  summary: UnknownRecord;
  flows: ProductionSmokeE2EFlow[];
  frontend_contract: UnknownRecord;
  raw: UnknownRecord;
}

export interface ProductionSmokeV2 {
  contract_version?: string;
  request_id?: string;
  status: string;
  summary: UnknownRecord;
  checks: ProductionSmokeCheck[];
  e2e_flow_readiness?: ProductionSmokeE2EReadiness;
  frontend_contract: UnknownRecord;
  raw: unknown;
}

export interface CatalogQualityQueueItem {
  id: string;
  item_id?: string | number;
  name: string;
  sku?: string;
  status?: string;
  category?: string;
  image_url?: string;
  price?: unknown;
  stock?: unknown;
  raw: UnknownRecord;
}

export interface CatalogQualityV2 {
  contract_version?: string;
  request_id?: string;
  summary: UnknownRecord;
  queues: Record<string, CatalogQualityQueueItem[]>;
  imports: {
    latest: UnknownRecord[];
    accepted_file_types: string[];
    image_columns: string[];
    raw: UnknownRecord;
  };
  frontend_contract: UnknownRecord;
  raw: unknown;
}

export interface CatalogItemPatchPayload {
  imagen_url?: string;
  image_url?: string;
  gallery_urls?: string[];
  precio?: string | number;
  cantidad?: string | number;
  descripcion_corta?: string;
  promocion_info?: string;
  external_url?: string;
  checkout_type?: string;
}

export interface EmployeeRoutingScope {
  categorias: string[];
  zonas: string[];
  channels: string[];
  permisos: string[];
  raw: UnknownRecord;
}

export interface EmployeeRoutingEmployee {
  id: string;
  name: string;
  scope: EmployeeRoutingScope;
  workload_open?: number;
  raw: UnknownRecord;
}

export interface EmployeeRoutingRecommendation {
  id: string;
  ticket: UnknownRecord;
  suggested_assignee: UnknownRecord;
  score?: number;
  reasons: string[];
  raw: UnknownRecord;
}

export interface EmployeeRoutingV2 {
  contract_version?: string;
  request_id?: string;
  routing_policy: UnknownRecord;
  dimensions: Record<string, string[]>;
  employees: EmployeeRoutingEmployee[];
  queues: {
    unassigned: UnknownRecord[];
    unassigned_count: number;
    raw: UnknownRecord;
  };
  recommendations: EmployeeRoutingRecommendation[];
  frontend_contract: UnknownRecord;
  raw: unknown;
}

export interface EmployeeRoutingScopePayload {
  categorias?: string[];
  zonas?: string[];
  channels?: string[];
  permisos?: string[];
}

export interface EmployeeRoutingAutoAssignPayload {
  dry_run?: boolean;
  ticket_ids?: Array<string | number>;
  limit?: number;
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
    taxonomy_label: asString(getFirst(value, ['taxonomy_label', 'case_label', 'label'])) ?? null,
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

const normalizeMaybeStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string' || typeof item === 'number') return asString(item);
        if (isRecord(item)) return asString(getFirst(item, ['label', 'title', 'text', 'description', 'id']));
        return undefined;
      })
      .filter((item): item is string => Boolean(item));
  }
  const single = asString(value);
  return single ? [single] : [];
};

const normalizeStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) return arrayOfStrings(value);
  if (isRecord(value)) return Object.keys(value).filter(Boolean);
  const single = asString(value);
  return single ? [single] : [];
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
    .filter(Boolean) as ChatExperienceBlock[];
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
  const method = asString(value.method);
  const endpoint = asString(value.endpoint);
  const href =
    asString(getFirst(value, ['href', 'url', 'path'])) ??
    (method?.toUpperCase() === 'GET' ? endpoint : undefined);
  const payloadDefaults = isRecord(value.payload_defaults)
    ? value.payload_defaults
    : isRecord(value.payloadDefaults)
      ? value.payloadDefaults
      : undefined;
  return {
    id,
    label,
    type: asString(getFirst(value, ['type', 'kind'])),
    href,
    endpoint,
    method,
    requires: Array.isArray(value.requires) ? value.requires.map(String).filter(Boolean) : undefined,
    payload: value.payload ?? payloadDefaults,
    payload_defaults: payloadDefaults,
    payloadDefaults,
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
  const permissionSource =
    getFirst(coverage, ['permisos', 'permissions', 'permission_coverage']) ??
    getFirst(record, ['permisos', 'permissions', 'permission_coverage']);
  const categories = normalizeBuckets(categorySource);
  const zones = normalizeBuckets(zoneSource);
  const channels = normalizeBuckets(channelSource);
  const permissions = normalizeBuckets(permissionSource);

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
    permisos: permissions,
    items: [...categories, ...zones, ...channels, ...permissions],
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

const asAvatarConsent = (value: unknown): OmnichannelPresenceUser['avatarConsent'] => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (value === null) return null;
  return undefined;
};

const normalizePresence = (value: unknown): OmnichannelPresenceUser[] =>
  asArray(value).map((item, index) => {
    const record = asRecord(item);
    const id = asString(getFirst(record, ['id', 'user_id', 'viewer_id', 'session_id'])) ?? `presence_${index + 1}`;
    const rawType = asString(getFirst(record, ['type', 'role', 'actor_type'])) ?? 'user';
    const rawStatus = asString(getFirst(record, ['status', 'presence_status', 'state'])) ?? 'offline';
    const avatarConsent = asAvatarConsent(
      getFirst(record, ['avatarConsent', 'avatar_consent', 'avatar_is_consented', 'profile_picture_consent']),
    );
    return {
      id,
      name: asString(getFirst(record, ['name', 'label', 'viewer_name', 'viewer_label'])) ?? id,
      type: rawType === 'agent' || rawType === 'employee' || rawType === 'admin' ? 'agent' : 'user',
      status: rawStatus === 'online' || rawStatus === 'active' ? 'online' : rawStatus === 'idle' ? 'idle' : 'offline',
      avatarUrl: asString(getFirst(record, ['avatarUrl', 'avatar_url', 'image_url'])),
      avatarSource: asString(getFirst(record, ['avatarSource', 'avatar_source', 'profile_picture_source', 'picture_source'])),
      avatarConsent,
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

const normalizeInboxAttachment = (value: unknown): UnknownRecord | null => {
  if (typeof value === 'string' && value.trim()) {
    return { url: value.trim(), name: 'Adjunto' };
  }
  if (!isRecord(value)) return null;
  const record = asRecord(value);
  const url = asString(getFirst(record, ['url', 'file_url', 'download_url', 'media_url', 'foto_url_directa', 'href']));
  const id = getFirst(record, ['id', 'archivo_adjunto_id', 'attachment_id']);
  const name = asString(getFirst(record, ['name', 'nombre', 'label', 'title', 'filename', 'file_name', 'nombre_archivo']));
  const type = asString(getFirst(record, ['type', 'tipo', 'mime_type', 'mimeType']));
  if (!url && id === undefined && !name && !type) return null;
  return {
    ...record,
    id,
    archivo_adjunto_id: getFirst(record, ['archivo_adjunto_id', 'attachment_id']),
    name,
    filename: asString(getFirst(record, ['filename', 'file_name', 'nombre_archivo', 'original_filename'])) ?? name,
    type,
    url,
  };
};

const collectInboxAttachments = (value: UnknownRecord): UnknownRecord[] => {
  const candidates: unknown[] = [];
  ['attachments', 'archivos', 'archivos_adjuntos', 'adjuntos', 'files', 'evidencias'].forEach((key) => {
    const source = value[key];
    if (Array.isArray(source)) candidates.push(...source);
  });
  const directPhoto = asString(getFirst(value, ['foto_url_directa', 'foto_url', 'image_url', 'photo_url']));
  if (directPhoto) {
    candidates.push({
      id: 'foto_url_directa',
      name: 'Foto',
      type: 'image',
      url: directPhoto,
      foto_url_directa: directPhoto,
    });
  }
  const seen = new Set<string>();
  return candidates
    .map(normalizeInboxAttachment)
    .filter((item): item is UnknownRecord => Boolean(item))
    .filter((item) => {
      const key = String(item.id ?? item.archivo_adjunto_id ?? item.url ?? item.filename ?? item.name ?? '');
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const normalizeInboxContact = (value: UnknownRecord): UnknownRecord => {
  const contact = asRecord(value.contact);
  const name =
    asString(getFirst(contact, ['name', 'nombre', 'display_name', 'nombre_vecino', 'nombre_cliente'])) ??
    asString(getFirst(value, ['nombre_vecino', 'vecino_nombre', 'nombre_cliente', 'customer_name']));
  const phone =
    asString(getFirst(contact, ['phone', 'telefono', 'telefono_vecino', 'telefono_cliente'])) ??
    asString(getFirst(value, ['telefono_vecino', 'telefono', 'phone', 'telefono_cliente', 'customer_phone']));
  const avatarUrl =
    asString(getFirst(contact, ['avatarUrl', 'avatar_url', 'contact_avatar_url', 'profile_picture_url', 'picture'])) ??
    asString(getFirst(value, ['avatarUrl', 'avatar_url', 'contact_avatar_url', 'profile_picture_url', 'picture']));
  const avatarSource =
    asString(getFirst(contact, ['avatarSource', 'avatar_source', 'profile_picture_source', 'picture_source'])) ??
    asString(getFirst(value, ['avatarSource', 'avatar_source', 'profile_picture_source', 'picture_source']));
  const avatarConsent =
    getFirst(contact, ['avatarConsent', 'avatar_consent', 'avatar_is_consented', 'profile_picture_consent']) ??
    getFirst(value, ['avatarConsent', 'avatar_consent', 'avatar_is_consented', 'profile_picture_consent']);
  return {
    ...contact,
    ...(name ? { name, nombre: name, nombre_vecino: name } : {}),
    ...(phone ? { phone, telefono: phone, telefono_vecino: phone } : {}),
    ...(avatarUrl ? { avatarUrl, avatar_url: avatarUrl } : {}),
    ...(avatarSource ? { avatarSource, avatar_source: avatarSource } : {}),
    ...(avatarConsent !== undefined ? { avatarConsent, avatar_consent: avatarConsent } : {}),
  };
};

const normalizeInboxLocation = (value: UnknownRecord): UnknownRecord => {
  const location = asRecord(value.location);
  const lat = asNumber(getFirst(location, ['latitud', 'lat', 'latitude'])) ?? asNumber(getFirst(value, ['latitud', 'lat', 'latitude']));
  const lng =
    asNumber(getFirst(location, ['longitud', 'lng', 'lon', 'longitude'])) ??
    asNumber(getFirst(value, ['longitud', 'lng', 'lon', 'longitude']));
  const address =
    asString(getFirst(location, ['direccion', 'address'])) ??
    asString(getFirst(value, ['direccion', 'address']));
  return {
    ...location,
    ...(address ? { address, direccion: address } : {}),
    ...(lat !== undefined ? { lat, latitud: lat } : {}),
    ...(lng !== undefined ? { lng, longitud: lng } : {}),
  };
};

export const normalizeOmnichannelInboxItemV2 = (value: unknown, index = 0): OmnichannelInboxItem | null => {
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'ticket_id', 'conversation_id', 'nro_ticket'])) ?? `inbox_${index + 1}`;
  const ticketId = asString(getFirst(value, ['ticket_id', 'id', 'nro_ticket']));
  const contact = normalizeInboxContact(value);
  const location = normalizeInboxLocation(value);
  const attachments = collectInboxAttachments(value);
  const archivosRaw = getFirst(value, ['archivos_count', 'cantidad_archivos', 'attachments_count', 'archivos']);
  const archivosCount = Array.isArray(archivosRaw)
    ? archivosRaw.length
    : asNumber(archivosRaw) ?? (attachments.length ? attachments.length : undefined);
  const schoolCase = normalizeEducationCaseAlias(getFirst(value, ['school_case', 'education_case', 'case_alias']));
  const timelineSource = getFirst(value, ['timeline', 'events', 'messages', 'conversation']);
  const experienceBlueprint = asRecord(value.experience_blueprint);
  const agentCopilot =
    asRecord(value.agent_copilot).suggestions ??
    getFirst(value, ['agent_copilot_suggestions', 'copilot_suggestions']) ??
    asRecord(asRecord(experienceBlueprint.agent_copilot).suggestions).items ??
    asRecord(experienceBlueprint.agent_copilot).suggestions;
  const normalizedActions = normalizeActions(getFirst(value, ['allowed_actions', 'actions', 'botones']));
  return {
    id,
    legacy_id: asString(getFirst(value, ['legacy_id', 'legacyId'])),
    ticket_id: ticketId,
    nro_ticket: asString(getFirst(value, ['nro_ticket', 'ticket_number'])),
    source_model: asString(getFirst(value, ['source_model', 'sourceModel'])),
    legacy_kind: asString(getFirst(value, ['legacy_kind', 'legacyKind'])),
    detail_endpoint: asString(getFirst(value, ['detail_endpoint', 'detail_url', 'endpoint'])),
    conversation_id: asString(getFirst(value, ['conversation_id', 'conversationId'])),
    title:
      asString(getFirst(value, ['title', 'subject', 'asunto'])) ??
      asString(getFirst(contact, ['name', 'nombre', 'display_name'])) ??
      id,
    description: asString(getFirst(value, ['description', 'descripcion', 'detalle', 'summary'])),
    status: asString(getFirst(value, ['status', 'estado', 'state'])) ?? 'unknown',
    priority: asString(getFirst(value, ['priority', 'prioridad'])),
    channel: asString(getFirst(value, ['channel', 'canal', 'canal_ingreso'])),
    category: asString(getFirst(value, ['category', 'categoria'])),
    intent: asString(getFirst(value, ['intent', 'intencion', 'intent_id'])),
    sensitivity: asString(getFirst(value, ['sensitivity', 'priority', 'prioridad'])),
    lastMessageAt: asString(getFirst(value, ['last_message_at', 'lastMessageAt', 'updated_at', 'fecha'])) ?? new Date().toISOString(),
    unreadCount: asNumber(getFirst(value, ['unread_count', 'unreadCount'])) ?? 0,
    assignee: value.assignee ? asRecord(value.assignee) : undefined,
    contact: Object.keys(contact).length ? contact : undefined,
    location: Object.keys(location).length ? location : undefined,
    map: value.map ? asRecord(value.map) : undefined,
    canal_ingreso: asString(getFirst(value, ['canal_ingreso', 'channel', 'canal'])),
    foto_url_directa: asString(getFirst(value, ['foto_url_directa', 'foto_url', 'image_url', 'photo_url'])),
    archivos_count: archivosCount,
    attachments,
    sla: value.sla ? asRecord(value.sla) : undefined,
    school_case: schoolCase,
    presence: normalizePresence(getFirst(value, ['presence', 'viewers', 'active_viewers'])),
    timeline: normalizeTimeline(timelineSource, id),
    actions: normalizedActions,
    allowed_actions: normalizedActions,
    summary: asString(getFirst(value, ['summary', 'case_summary', 'ai_summary'])),
    next_steps: arrayOfStrings(getFirst(value, ['next_steps', 'suggested_next_steps'])),
    suggested_reply: asString(getFirst(value, ['suggested_reply', 'reply_suggestion'])),
    agent_copilot_suggestions: normalizeExperienceBlocks(agentCopilot),
    source_metadata: value.source_metadata ? asRecord(value.source_metadata) : undefined,
    frontend_contract: value.frontend_contract ? asRecord(value.frontend_contract) : undefined,
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

export const normalizeOmnichannelInboxDetailV2 = (response: unknown): OmnichannelInboxDetailV2 => {
  const source = getSource(response);
  const record = asRecord(source);
  const candidate = getFirst(record, ['item', 'ticket', 'conversation', 'data']) ?? source;
  const item = normalizeOmnichannelInboxItemV2(candidate);
  if (!item) {
    throw new ApiError('Respuesta invalida del detalle omnicanal.', 502, response);
  }
  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    item,
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

export const normalizeTenantAdminExperienceV2 = (response: unknown): TenantAdminExperienceV2 => {
  const source = getSource(response);
  const record = asRecord(source);
  const operations = asRecord(record.operations);
  const whatsappSource = getFirst(record, ['whatsapp', 'whatsapp_experience', 'widget_whatsapp']);
  const whatsapp = asRecord(whatsappSource);
  const normalizedWhatsapp = Object.keys(whatsapp).length
    ? normalizeWhatsappExperienceV2(whatsapp)
    : null;
  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    tenant: asRecord(record.tenant),
    profile: asRecord(record.profile),
    modules: asArray(record.modules).map(asRecord),
    health: asRecord(record.health),
    operations: {
      ...operations,
      dashboard: asRecord(operations.dashboard),
      freshness: asRecord(operations.freshness),
    },
    lead_capture: asRecord(record.lead_capture),
    surveys_votings: asRecord(record.surveys_votings),
    marketplace: asRecord(record.marketplace),
    whatsapp,
    whatsapp_experience: normalizedWhatsapp,
    education: asRecord(record.education),
    frontend_contract: asRecord(record.frontend_contract),
    raw: response,
  };
};

export const getTenantAdminExperienceV2 = async (tenantSlug?: string | null) => {
  const encoded = tenantSlug ? encodeURIComponent(tenantSlug) : null;
  let response: unknown;
  try {
    response = await panelApi.get<unknown>(
      encoded ? `/api/v2/tenants/${encoded}/admin-experience` : '/api/v2/tenant/admin-experience',
      { tenantSlug, baseUrlOverride: SAME_ORIGIN_API_BASE, headers: { Accept: 'application/json' } },
    );
  } catch (error) {
    if (!shouldFallbackEndpoint(error) || encoded) throw error;
    response = await panelApi.get<unknown>('/api/v2/tenant/admin-experience', {
      tenantSlug,
      baseUrlOverride: SAME_ORIGIN_API_BASE,
      headers: { Accept: 'application/json' },
    });
  }
  return normalizeTenantAdminExperienceV2(response);
};

const normalizeTenantOpsQaCheckV2 = (value: unknown, index = 0): TenantOpsQaCheckV2 => {
  const record = asRecord(value);
  return {
    id: asString(getFirst(record, ['id', 'check_id'])) || `check_${index + 1}`,
    label: asString(getFirst(record, ['label', 'title', 'name'])) || `Check ${index + 1}`,
    ok: asBoolean(record.ok),
    status: asString(record.status),
    severity: asString(record.severity),
    endpoint: asString(record.endpoint),
    details: asRecord(record.details),
    next_action: asString(record.next_action),
    raw: value,
  };
};

export const normalizeTenantOpsQaPlaybookV2 = (response: unknown): TenantOpsQaPlaybookV2 => {
  const source = getSource(response);
  const record = asRecord(source);
  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    tenant: asRecord(record.tenant),
    safe_by_default: asBoolean(record.safe_by_default),
    status: asString(record.status),
    score: asNumber(record.score) ?? undefined,
    summary: asRecord(record.summary),
    checks: asArray(record.checks).map((item, index) => normalizeTenantOpsQaCheckV2(item, index)),
    e2e_flow_readiness: normalizeProductionSmokeE2EReadiness(record.e2e_flow_readiness),
    recommended_next_actions: asArray(record.recommended_next_actions).map((item, index) =>
      normalizeTenantOpsQaCheckV2(item, index),
    ),
    execution: asRecord(record.execution),
    frontend_contract: asRecord(record.frontend_contract),
    raw: response,
  };
};

export const getTenantOpsQaPlaybookV2 = async (tenantSlug?: string | null) => {
  const encoded = tenantSlug ? encodeURIComponent(tenantSlug) : null;
  const response = await panelApi.get<unknown>(
    encoded ? `/api/v2/tenants/${encoded}/ops-qa/playbook` : '/api/v2/tenant/ops-qa/playbook',
    { tenantSlug, baseUrlOverride: SAME_ORIGIN_API_BASE, headers: { Accept: 'application/json' } },
  );
  return normalizeTenantOpsQaPlaybookV2(response);
};

export const normalizeTenantOpsQaExecutionV2 = (response: unknown): TenantOpsQaExecutionV2 => {
  const source = getSource(response);
  const record = asRecord(source);
  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    tenant: asRecord(record.tenant),
    check_id: asString(record.check_id),
    label: asString(record.label),
    ok: asBoolean(record.ok),
    status: asString(record.status),
    severity: asString(record.severity),
    execution_mode: asString(record.execution_mode),
    sends_real_message: asBoolean(record.sends_real_message),
    details: asRecord(record.details),
    next_action: asString(record.next_action),
    playbook_status: asString(record.playbook_status),
    playbook_score: asNumber(record.playbook_score) ?? undefined,
    raw: response,
  };
};

export const runTenantOpsQaCheckV2 = async (tenantSlug: string | null | undefined, checkId: string) => {
  const encoded = tenantSlug ? encodeURIComponent(tenantSlug) : null;
  const encodedCheck = encodeURIComponent(checkId);
  const response = await panelApi.post<unknown>(
    encoded ? `/api/v2/tenants/${encoded}/ops-qa/check/${encodedCheck}` : `/api/v2/tenant/ops-qa/check/${encodedCheck}`,
    {},
    { tenantSlug, baseUrlOverride: SAME_ORIGIN_API_BASE, headers: { Accept: 'application/json' } },
  );
  return normalizeTenantOpsQaExecutionV2(response);
};

export const normalizeWhatsappExperienceV2 = (response: unknown): WhatsappExperienceV2 => {
  const source = getSource(response);
  const record = asRecord(source);
  const intelligence = asRecord(record.conversation_intelligence);
  const rawVoiceCalls = asRecord(intelligence.voice_calls);
  const rawCapabilities = rawVoiceCalls.capabilities;
  const contentModules = asRecord(record.content_modules);

  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    tenant: asRecord(record.tenant),
    channel: asRecord(record.channel),
    enterprise_rules: asRecord(record.enterprise_rules),
    contact_window: asRecord(record.contact_window),
    conversation_intelligence: {
      ...intelligence,
      voice_calls: {
        enabled: asBoolean(rawVoiceCalls.enabled),
        capabilities: isRecord(rawCapabilities) ? (rawCapabilities as RealtimeVoiceCapabilities) : null,
        raw: rawVoiceCalls,
      },
    },
    content_modules: Object.fromEntries(
      Object.entries(contentModules).map(([key, value]) => [key, asRecord(value)]),
    ),
    tracking: asRecord(record.tracking),
    commerce: asRecord(record.commerce),
    template_blueprint: asRecord(record.template_blueprint),
    webview_blueprint: asRecord(record.webview_blueprint),
    finance_transactional: asRecord(record.finance_transactional),
    qa_playbook: asRecord(record.qa_playbook),
    message_ux_policy: asRecord(record.message_ux_policy),
    admin_panel: asRecord(record.admin_panel),
    education: asRecord(record.education),
    frontend_contract: asRecord(record.frontend_contract),
    raw: response,
  };
};

export const getWhatsappExperienceV2 = async (tenantSlug?: string | null) => {
  const encoded = tenantSlug ? encodeURIComponent(tenantSlug) : null;
  let response: unknown;
  try {
    response = await panelApi.get<unknown>(
      encoded ? `/api/v2/tenants/${encoded}/whatsapp/experience` : '/api/v2/whatsapp/experience',
      { tenantSlug },
    );
  } catch (error) {
    if (!shouldFallbackEndpoint(error) || !encoded) throw error;
    response = await panelApi.get<unknown>('/api/v2/whatsapp/experience', { tenantSlug });
  }
  return normalizeWhatsappExperienceV2(response);
};

export const normalizeSuperadminCommandCenterV2 = (response: unknown): SuperadminCommandCenterV2 => {
  const source = getSource(response);
  const record = asRecord(source);
  const tenants = asRecord(record.tenants);
  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    summary: asRecord(record.summary),
    tenants: {
      items: asArray(getFirst(tenants, ['items', 'tenants'])).map(asRecord),
      top_risky: asArray(getFirst(tenants, ['top_risky', 'top_risky_tenants', 'risky_tenants'])).map(asRecord),
    },
    tenant_creation: asRecord(record.tenant_creation),
    frontend_contract: asRecord(record.frontend_contract),
    raw: response,
  };
};

export const getSuperadminCommandCenterV2 = async () => {
  const response = await panelApi.get<unknown>('/api/v2/superadmin/command-center');
  return normalizeSuperadminCommandCenterV2(response);
};

const normalizeProductionSmokeCheck = (value: unknown, index = 0): ProductionSmokeCheck | null => {
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'key', 'name', 'endpoint'])) ?? `check_${index + 1}`;
  return {
    id,
    ok: Boolean(asBoolean(getFirst(value, ['ok', 'passed', 'success'])) ?? String(getFirst(value, ['status', 'state'])).toLowerCase() === 'pass'),
    status: asString(getFirst(value, ['status', 'state'])),
    endpoint: asString(value.endpoint),
    details: value.details ? asRecord(value.details) : undefined,
    raw: value,
  };
};

const normalizeProductionSmokeE2EFlow = (value: unknown, index = 0): ProductionSmokeE2EFlow | null => {
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'key', 'name', 'endpoint'])) ?? `flow_${index + 1}`;
  return {
    id,
    label: asString(getFirst(value, ['label', 'title', 'name'])) ?? id,
    surface: asString(value.surface),
    ready: Boolean(asBoolean(getFirst(value, ['ready', 'ok', 'passed'])) ?? String(getFirst(value, ['status', 'state'])).toLowerCase() === 'ready'),
    status: asString(getFirst(value, ['status', 'state'])),
    endpoint: asString(value.endpoint),
    frontend_entry: asString(getFirst(value, ['frontend_entry', 'frontend_route', 'route', 'href'])),
    qa_scenario_id: asString(value.qa_scenario_id),
    meta_flow_ready: asBoolean(value.meta_flow_ready),
    evidence: value.evidence ? asRecord(value.evidence) : undefined,
    manual_test_steps: normalizeMaybeStringList(getFirst(value, ['manual_test_steps', 'manual_steps', 'test_steps'])),
    acceptance_criteria: normalizeMaybeStringList(getFirst(value, ['acceptance_criteria', 'criteria'])),
    automation: asRecord(value.automation),
    next_action: asString(value.next_action),
    raw: value,
  };
};

const normalizeProductionSmokeE2EReadiness = (value: unknown): ProductionSmokeE2EReadiness | undefined => {
  if (!isRecord(value)) return undefined;
  return {
    contract_version: asString(value.contract_version),
    status: asString(getFirst(value, ['status', 'state'])) ?? 'unknown',
    summary: asRecord(value.summary),
    flows: asArray(value.flows)
      .map(normalizeProductionSmokeE2EFlow)
      .filter((item): item is ProductionSmokeE2EFlow => Boolean(item)),
    frontend_contract: asRecord(value.frontend_contract),
    raw: value,
  };
};

export const normalizeProductionSmokeV2 = (response: unknown): ProductionSmokeV2 => {
  const source = getSource(response);
  const record = asRecord(source);
  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    status: asString(getFirst(record, ['status', 'state'])) ?? 'unknown',
    summary: asRecord(record.summary),
    checks: asArray(record.checks)
      .map(normalizeProductionSmokeCheck)
      .filter((item): item is ProductionSmokeCheck => Boolean(item)),
    e2e_flow_readiness: normalizeProductionSmokeE2EReadiness(record.e2e_flow_readiness),
    frontend_contract: asRecord(record.frontend_contract),
    raw: response,
  };
};

export const getProductionSmokeV2 = async (tenantSlug?: string | null) => {
  const encoded = tenantSlug ? encodeURIComponent(tenantSlug) : null;
  const response = await panelApi.get<unknown>(
    encoded ? `/api/v2/tenants/${encoded}/production-smoke` : '/api/v2/platform/production-smoke',
    { tenantSlug },
  );
  return normalizeProductionSmokeV2(response);
};

const normalizeCatalogQualityQueueItem = (value: unknown, index = 0): CatalogQualityQueueItem | null => {
  if (!isRecord(value)) return null;
  const itemId = getFirst(value, ['item_id', 'product_id', 'catalog_item_id', 'id']);
  const id = asString(itemId) ?? asString(getFirst(value, ['sku', 'codigo'])) ?? `catalog_item_${index + 1}`;
  return {
    id,
    item_id: itemId as string | number | undefined,
    name: asString(getFirst(value, ['nombre', 'name', 'title', 'label', 'sku'])) ?? id,
    sku: asString(getFirst(value, ['sku', 'codigo', 'code'])),
    status: asString(getFirst(value, ['status', 'estado', 'image_status'])),
    category: asString(getFirst(value, ['categoria', 'category', 'category_name'])),
    image_url: asString(getFirst(value, ['imagen_url', 'image_url', 'thumbnail', 'foto', 'photo'])),
    price: getFirst(value, ['precio', 'price', 'amount']),
    stock: getFirst(value, ['cantidad', 'stock', 'available_stock']),
    raw: value,
  };
};

export const normalizeCatalogQualityV2 = (response: unknown): CatalogQualityV2 => {
  const source = getSource(response);
  const record = asRecord(source);
  const queuesSource = asRecord(record.queues);
  const queues = Object.fromEntries(
    Object.entries(queuesSource).map(([key, value]) => [
      key,
      asArray(value)
        .map(normalizeCatalogQualityQueueItem)
        .filter((item): item is CatalogQualityQueueItem => Boolean(item)),
    ]),
  );
  const imports = asRecord(record.imports);
  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    summary: asRecord(record.summary),
    queues,
    imports: {
      latest: asArray(imports.latest).map(asRecord),
      accepted_file_types: normalizeStringList(imports.accepted_file_types),
      image_columns: normalizeStringList(imports.image_columns),
      raw: imports,
    },
    frontend_contract: asRecord(record.frontend_contract),
    raw: response,
  };
};

export const getCatalogQualityV2 = async (tenantSlug?: string | null) => {
  const encoded = tenantSlug ? encodeURIComponent(tenantSlug) : null;
  let response: unknown;
  try {
    response = await panelApi.get<unknown>(
      encoded ? `/api/v2/tenants/${encoded}/catalog/quality` : '/api/v2/catalog/quality',
      { tenantSlug },
    );
  } catch (error) {
    if (!shouldFallbackEndpoint(error) || !encoded) throw error;
    response = await panelApi.get<unknown>('/api/v2/catalog/quality', { tenantSlug });
  }
  return normalizeCatalogQualityV2(response);
};

export const patchCatalogItemV2 = async (
  tenantSlug: string,
  itemId: string | number,
  payload: CatalogItemPatchPayload,
) => {
  const encodedSlug = encodeURIComponent(tenantSlug);
  const encodedItem = encodeURIComponent(String(itemId));
  return panelApi.patch<unknown>(
    `/api/admin/tenants/${encodedSlug}/catalog/items/${encodedItem}`,
    payload,
    { tenantSlug },
  );
};

const normalizeRoutingScope = (value: unknown): EmployeeRoutingScope => {
  const record = asRecord(value);
  return {
    categorias: normalizeStringList(record.categorias),
    zonas: normalizeStringList(record.zonas),
    channels: normalizeStringList(getFirst(record, ['channels', 'canales'])),
    permisos: normalizeStringList(record.permisos),
    raw: record,
  };
};

const normalizeRoutingEmployee = (value: unknown, index = 0): EmployeeRoutingEmployee | null => {
  if (!isRecord(value)) return null;
  const id = asString(getFirst(value, ['id', 'employee_id', 'user_id', 'email'])) ?? `routing_employee_${index + 1}`;
  return {
    id,
    name: asString(getFirst(value, ['name', 'nombre', 'display_name', 'email'])) ?? id,
    scope: normalizeRoutingScope(value.scope),
    workload_open: asNumber(getFirst(value, ['workload_open', 'workload_open_tickets', 'open_tickets'])),
    raw: value,
  };
};

const normalizeRoutingRecommendation = (value: unknown, index = 0): EmployeeRoutingRecommendation | null => {
  if (!isRecord(value)) return null;
  const ticket = asRecord(value.ticket);
  const assignee = asRecord(value.suggested_assignee);
  return {
    id:
      asString(getFirst(value, ['id', 'recommendation_id'])) ??
      `${asString(getFirst(ticket, ['source_model', 'type'])) ?? 'ticket'}_${asString(getFirst(ticket, ['id', 'ticket_id'])) ?? index + 1}`,
    ticket,
    suggested_assignee: assignee,
    score: asNumber(value.score),
    reasons: normalizeStringList(value.reasons),
    raw: value,
  };
};

export const normalizeEmployeeRoutingV2 = (response: unknown): EmployeeRoutingV2 => {
  const source = getSource(response);
  const record = asRecord(source);
  const dimensionsSource = asRecord(record.dimensions);
  const queues = asRecord(record.queues);
  return {
    contract_version: asString(record.contract_version),
    request_id: asString(record.request_id),
    routing_policy: asRecord(record.routing_policy),
    dimensions: Object.fromEntries(
      Object.entries(dimensionsSource).map(([key, value]) => [key, normalizeStringList(value)]),
    ),
    employees: asArray(record.employees)
      .map(normalizeRoutingEmployee)
      .filter((item): item is EmployeeRoutingEmployee => Boolean(item)),
    queues: {
      unassigned: asArray(queues.unassigned).map(asRecord),
      unassigned_count: asNumber(getFirst(queues, ['unassigned_count', 'count'])) ?? asArray(queues.unassigned).length,
      raw: queues,
    },
    recommendations: asArray(record.recommendations)
      .map(normalizeRoutingRecommendation)
      .filter((item): item is EmployeeRoutingRecommendation => Boolean(item)),
    frontend_contract: asRecord(record.frontend_contract),
    raw: response,
  };
};

export const getEmployeeRoutingV2 = async (tenantSlug?: string | null) => {
  const encoded = tenantSlug ? encodeURIComponent(tenantSlug) : null;
  let response: unknown;
  try {
    response = await panelApi.get<unknown>(
      encoded ? `/api/v2/tenants/${encoded}/employee-routing` : '/api/v2/employee-routing',
      { tenantSlug },
    );
  } catch (error) {
    if (!shouldFallbackEndpoint(error) || !encoded) throw error;
    response = await panelApi.get<unknown>('/api/v2/employee-routing', { tenantSlug });
  }
  return normalizeEmployeeRoutingV2(response);
};

export const patchEmployeeRoutingScopeV2 = async (
  employeeId: string | number,
  payload: EmployeeRoutingScopePayload,
  tenantSlug?: string | null,
) => {
  const encodedEmployee = encodeURIComponent(String(employeeId));
  return panelApi.patch<unknown>(`/api/v2/employees/${encodedEmployee}/routing-scope`, payload, { tenantSlug });
};

export const postEmployeeRoutingAutoAssignV2 = async (
  payload: EmployeeRoutingAutoAssignPayload,
  tenantSlug?: string | null,
) => panelApi.post<unknown>('/api/v2/employee-routing/auto-assign', payload, { tenantSlug });

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

export const getOmnichannelInboxDetailV2 = async (
  ticketId: string | number,
  tenantSlug?: string | null,
  detailEndpoint?: string | null,
) => {
  const encodedTicketId = encodeURIComponent(String(ticketId));
  const endpoint = detailEndpoint && detailEndpoint.startsWith('/')
    ? detailEndpoint
    : `/api/v2/inbox/omnichannel/${encodedTicketId}`;
  const response = await panelApi.get<unknown>(endpoint, { tenantSlug });
  return normalizeOmnichannelInboxDetailV2(response);
};

export const postOmnichannelInboxActionV2 = async (
  ticketId: string,
  payload: OmnichannelInboxActionPayload,
  tenantSlug?: string | null,
) => {
  const encodedTicketId = encodeURIComponent(ticketId);
  const nestedPayload =
    payload.payload && typeof payload.payload === 'object' && !Array.isArray(payload.payload)
      ? payload.payload
      : {};
  const explicitEndpoint =
    asString(payload.endpoint) ||
    asString(nestedPayload.endpoint);
  const payloadWithTicket = {
    ...nestedPayload,
    ...payload,
    ...(payload.action === 'reply'
      ? {
          body: payload.body ?? payload.message ?? nestedPayload.body ?? nestedPayload.message,
          message: payload.message ?? payload.body ?? nestedPayload.message ?? nestedPayload.body,
          visibility: payload.visibility ?? nestedPayload.visibility ?? 'public',
        }
      : {}),
    ticket_id: payload.ticket_id ?? nestedPayload.ticket_id ?? nestedPayload.legacy_id ?? ticketId,
  };
  delete (payloadWithTicket as UnknownRecord).endpoint;
  delete (payloadWithTicket as UnknownRecord).payload;
  let response: unknown;
  try {
    response = await panelApi.post<unknown>(
      explicitEndpoint && explicitEndpoint.startsWith('/')
        ? explicitEndpoint
        : `/api/v2/inbox/omnichannel/${encodedTicketId}/actions`,
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
