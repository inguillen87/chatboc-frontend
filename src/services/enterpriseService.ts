import { ApiError, apiFetch } from "@/utils/api";
import { normalizeEmployeeCoverageV2, normalizeSuperadminExecutiveSummaryV2 } from "@/api/v2/saas";
import { getOrCreateAnonId } from "@/utils/anonId";
import getOrCreateChatSessionId from "@/utils/chatSessionId";
import { createLeadCaptureIdempotencyKey } from "@/utils/leadCapture";
import type { TicketCollaborationState } from "@/types/tickets";

export type DemoRubro = "municipio" | "pyme";

export interface DemoAuthResponse {
  token: string;
  demo_mode: boolean;
  tenant?: {
    id: number;
    slug: string;
    nombre: string;
  };
  user?: {
    id: number;
    rol: string;
  };
}

export interface DemoUnavailableContract {
  contract_version?: string;
  request_id?: string;
  error?: {
    code?: number;
    message?: string;
  };
}

export class DemoModeDisabledError extends Error {
  public readonly requestId?: string;
  public readonly status?: number;
  public readonly contractVersion?: string;

  constructor(message: string, options?: { requestId?: string; status?: number; contractVersion?: string }) {
    super(message);
    this.name = "DemoModeDisabledError";
    this.requestId = options?.requestId;
    this.status = options?.status;
    this.contractVersion = options?.contractVersion;
  }
}

export interface DemoCatalogTenant {
  id?: number;
  slug?: string;
  nombre?: string;
  tipo?: string;
  rubro?: string;
  enabled?: boolean;
  login_endpoint?: string;
  login_payload?: Record<string, unknown>;
}

export interface DemoCatalogEntryPoint {
  id?: string;
  rubro?: DemoRubro;
  label?: string;
  description?: string;
  enabled?: boolean;
  login_endpoint?: string;
  login_payload?: Record<string, unknown>;
}

export interface DemoCatalogResponse {
  frontend_contract_version?: string;
  frontend?: Record<string, unknown>;
  demo_selector?: Record<string, unknown>;
  preload_before_login?: string[] | Record<string, boolean>;
  demo_login_enabled?: boolean;
  demo_login_endpoint?: string;
  tenants?: DemoCatalogTenant[];
  tenant_demos?: DemoCatalogTenant[];
  entry_points?: DemoCatalogEntryPoint[];
  supported_languages?: string[];
  credentials?: Record<string, unknown>;
}

export interface DemoSelectorContract {
  mode?: string;
  sector_default?: DemoRubro;
  require_rubro_by_sector?: boolean;
  tenant_slug_field?: string;
}

export interface DemoFrontendContract {
  frontend_contract_version?: string;
  onboarding?: {
    default_sector?: "gobierno" | "empresas";
    sector_options?: Array<{ value: "gobierno" | "empresas"; label?: string }>;
    twilio_trial?: {
      display_number?: string;
      join_phrase?: string;
      wa_deeplink?: string;
      security_limits?: {
        messages_per_session?: number;
        upgrade_required_for?: string[];
      };
    };
    activation_state?: {
      activated?: boolean;
      max_activations?: number;
      activations_used?: number;
    };
    activation_endpoint?: string;
    menus_by_tipo?: Record<DemoRubro, Array<{ id?: string; label?: string; description?: string }>>;
    demo_feature_access?: Record<string, boolean>;
  };
  demo_selector?: DemoSelectorContract;
  preload_before_login?: string[];
}

export const SUPPORTED_DEMO_FRONTEND_CONTRACT_VERSION = "1";

const toDemoModeDisabledError = (error: unknown): DemoModeDisabledError | null => {
  if (!(error instanceof ApiError) || error.status !== 404) return null;
  const body = error.body as DemoUnavailableContract | undefined;
  if (body?.contract_version !== "auth.demo.v1") return null;

  const requestId = typeof body?.request_id === "string" && body.request_id.trim()
    ? body.request_id.trim()
    : error.requestId;
  const backendMessage =
    typeof body?.error?.message === "string" && body.error.message.trim()
      ? body.error.message.trim()
      : "Demo mode disabled";
  const suffix = requestId ? ` (request_id: ${requestId})` : "";
  return new DemoModeDisabledError(`${backendMessage}${suffix}`, {
    requestId,
    status: error.status,
    contractVersion: body?.contract_version,
  });
};

const normalizeDemoRubro = (raw: unknown): DemoRubro | undefined => {
  if (typeof raw !== "string") return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized.includes("mun")) return "municipio";
  if (normalized.includes("pym") || normalized.includes("emp")) return "pyme";
  if (normalized === "municipio" || normalized === "pyme") return normalized;
  return undefined;
};

const normalizePreloadHints = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => key.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
};

const normalizeSector = (raw: unknown): "gobierno" | "empresas" | undefined => {
  if (typeof raw !== "string") return undefined;
  const normalized = raw.trim().toLowerCase();
  if (
    normalized.includes("gob") ||
    normalized.includes("mun") ||
    normalized.includes("pub")
  )
    return "gobierno";
  if (
    normalized.includes("emp") ||
    normalized.includes("pym") ||
    normalized.includes("priv")
  )
    return "empresas";
  if (normalized === "gobierno" || normalized === "empresas") return normalized;
  return undefined;
};

const normalizeSectorOptions = (
  raw: unknown,
): Array<{ value: "gobierno" | "empresas"; label?: string }> => {
  if (!Array.isArray(raw)) return [];
  const values = new Set<"gobierno" | "empresas">();
  const options: Array<{ value: "gobierno" | "empresas"; label?: string }> = [];

  raw.forEach((item) => {
    if (typeof item === "string") {
      const value = normalizeSector(item);
      if (!value || values.has(value)) return;
      values.add(value);
      options.push({ value });
      return;
    }
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const value = normalizeSector(
        record.value ?? record.key ?? record.sector ?? record.id,
      );
      if (!value || values.has(value)) return;
      values.add(value);
      options.push({
        value,
        label: typeof record.label === "string" ? record.label : undefined,
      });
    }
  });

  return options;
};

const normalizeQuickActions = (
  raw: unknown,
): Array<{ id?: string; label?: string; description?: string }> => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const label = typeof record.label === "string" ? record.label.trim() : "";
      if (!label) return null;
      return {
        id: typeof record.id === "string" ? record.id.trim() : undefined,
        label,
        description: typeof record.description === "string" ? record.description.trim() : undefined,
      };
    })
    .filter((item): item is { id?: string; label?: string; description?: string } => Boolean(item));
};

export const extractDemoFrontendContract = (
  catalog?: DemoCatalogResponse | null,
): DemoFrontendContract => {
  const source =
    (catalog?.frontend as Record<string, unknown> | undefined) ||
    (catalog as Record<string, unknown> | undefined) ||
    {};

  const selectorRaw = source.demo_selector;
  const selector =
    selectorRaw && typeof selectorRaw === "object"
      ? (selectorRaw as Record<string, unknown>)
      : undefined;

  const versionRaw = source.frontend_contract_version;
  const onboardingRaw = source.onboarding;
  const onboarding =
    onboardingRaw && typeof onboardingRaw === "object"
      ? (onboardingRaw as Record<string, unknown>)
      : undefined;

  return {
    frontend_contract_version:
      typeof versionRaw === "string" ? versionRaw.trim() : undefined,
    onboarding: onboarding
      ? {
          default_sector: normalizeSector(onboarding.default_sector),
          sector_options: normalizeSectorOptions(onboarding.sector_options),
          twilio_trial:
            onboarding.twilio_trial && typeof onboarding.twilio_trial === "object"
              ? {
                  display_number:
                    typeof (onboarding.twilio_trial as Record<string, unknown>).display_number === "string"
                      ? ((onboarding.twilio_trial as Record<string, unknown>).display_number as string).trim()
                      : undefined,
                  join_phrase:
                    typeof (onboarding.twilio_trial as Record<string, unknown>).join_phrase === "string"
                      ? ((onboarding.twilio_trial as Record<string, unknown>).join_phrase as string).trim()
                      : undefined,
                  wa_deeplink:
                    typeof (onboarding.twilio_trial as Record<string, unknown>).wa_deeplink === "string"
                      ? ((onboarding.twilio_trial as Record<string, unknown>).wa_deeplink as string).trim()
                      : undefined,
                  security_limits: {
                    messages_per_session:
                      typeof ((onboarding.twilio_trial as Record<string, unknown>).security_limits as Record<string, unknown> | undefined)?.messages_per_session === "number"
                        ? (((onboarding.twilio_trial as Record<string, unknown>).security_limits as Record<string, unknown>).messages_per_session as number)
                        : undefined,
                    upgrade_required_for: Array.isArray(((onboarding.twilio_trial as Record<string, unknown>).security_limits as Record<string, unknown> | undefined)?.upgrade_required_for)
                      ? (((onboarding.twilio_trial as Record<string, unknown>).security_limits as Record<string, unknown>).upgrade_required_for as unknown[])
                          .filter((item): item is string => typeof item === "string")
                          .map((item) => item.trim())
                          .filter(Boolean)
                      : undefined,
                  },
                }
              : undefined,
          activation_state:
            onboarding.activation_state && typeof onboarding.activation_state === "object"
              ? {
                  activated: (onboarding.activation_state as Record<string, unknown>).activated === true,
                  max_activations:
                    typeof (onboarding.activation_state as Record<string, unknown>).max_activations === "number"
                      ? ((onboarding.activation_state as Record<string, unknown>).max_activations as number)
                      : undefined,
                  activations_used:
                    typeof (onboarding.activation_state as Record<string, unknown>).activations_used === "number"
                      ? ((onboarding.activation_state as Record<string, unknown>).activations_used as number)
                      : undefined,
                }
              : undefined,
          activation_endpoint:
            typeof onboarding.activation_endpoint === "string"
              ? onboarding.activation_endpoint.trim()
              : undefined,
          menus_by_tipo: {
            municipio: normalizeQuickActions(
              (onboarding.menus_by_tipo as Record<string, unknown> | undefined)?.municipio,
            ),
            pyme: normalizeQuickActions(
              (onboarding.menus_by_tipo as Record<string, unknown> | undefined)?.pyme,
            ),
          },
          demo_feature_access:
            onboarding.demo_feature_access && typeof onboarding.demo_feature_access === "object"
              ? Object.entries(onboarding.demo_feature_access as Record<string, unknown>).reduce<Record<string, boolean>>(
                  (acc, [key, value]) => {
                    if (value === true || value === false) {
                      acc[key] = value;
                    }
                    return acc;
                  },
                  {},
                )
              : undefined,
        }
      : undefined,
    demo_selector: selector
      ? {
          mode:
            typeof selector.mode === "string"
              ? selector.mode.trim().toLowerCase()
              : undefined,
          sector_default: normalizeDemoRubro(selector.sector_default),
          require_rubro_by_sector: selector.require_rubro_by_sector === true,
          tenant_slug_field:
            typeof selector.tenant_slug_field === "string" &&
            selector.tenant_slug_field.trim()
              ? selector.tenant_slug_field.trim()
              : undefined,
        }
      : undefined,
    preload_before_login: normalizePreloadHints(source.preload_before_login),
  };
};

export const isSupportedDemoFrontendContract = (version?: string | null) => {
  if (!version) return true;
  const normalized = version.trim();
  return (
    normalized === SUPPORTED_DEMO_FRONTEND_CONTRACT_VERSION ||
    normalized.startsWith(`${SUPPORTED_DEMO_FRONTEND_CONTRACT_VERSION}.`)
  );
};

export interface FranchiseProfilePayload {
  white_label_enabled?: boolean;
  reseller_enabled?: boolean;
  default_language?: "es" | "en" | "pt";
  supported_languages?: Array<"es" | "en" | "pt">;
  country?: string;
  currency?: string;
  timezone?: string;
  target_markets?: string[];
  partner_program?: string;
}

export interface BotSettingsBranding {
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
}

export interface BotSettingsPayload {
  tenant_id: number;
  name?: string;
  tone?: string;
  system_prompt?: string;
  fallback_behavior?: "derivar_humano" | "auto_reply" | "silent";
  branding?: BotSettingsBranding;
}

export interface BotSettingsResponse {
  tenant_id: number;
  settings: {
    name?: string;
    tone?: string;
    system_prompt?: string;
    fallback_behavior?: "derivar_humano" | "auto_reply" | "silent";
    branding?: BotSettingsBranding;
  };
}

export interface LeadInteractionItem {
  id?: number | string;
  tenant_id?: number;
  tenant_slug?: string;
  priority?: string;
  lead_name?: string;
  lead_email?: string;
  lead_phone?: string;
  intent?: string;
  score?: number;
  last_message?: string;
  created_at?: string;
  updated_at?: string;
}

export interface LeadInteractionsResponse {
  items?: LeadInteractionItem[];
  interactions?: LeadInteractionItem[];
  next_cursor?: string | null;
  cursor?: string | null;
}

export interface EnterpriseCollaborationSummary {
  active_viewers?: number;
  unread_viewers?: number;
}

export interface EnterpriseLeadItem {
  id?: number | string;
  ticket_id?: number | string;
  nro_ticket?: number | string;
  ticket_type?: string;
  tenant_slug?: string;
  nombre?: string;
  name?: string;
  email?: string;
  telefono?: string;
  phone?: string;
  stage?: string;
  relevance_score?: number;
  confidence_score?: number;
  created_at?: string;
  updated_at?: string;
  collaboration_state?: TicketCollaborationState | null;
}

export interface TenantUnreadSummaryItem {
  ticket_id?: string | number;
  ticket_type?: string;
  unread_count?: number;
  last_message_at?: string;
  collaboration_state?: TicketCollaborationState | null;
  [key: string]: unknown;
}

export interface TenantUnreadSummaryResponse {
  total_tickets_with_unread?: number;
  items?: TenantUnreadSummaryItem[];
}

export interface TenantDashboardBundleResponse {
  tenant?: Record<string, any>;
  summary?: Record<string, any> & EnterpriseCollaborationSummary;
  leads?: Record<string, any> & {
    items?: EnterpriseLeadItem[];
  };
  surveys?: Record<string, any>;
  unread?: Record<string, any>;
  team?: Record<string, any>;
  recommended_actions?: any[];
  meta?: Record<string, any>;
}

export interface LeadsPipelineItem {
  id?: number | string;
  tenant_slug?: string;
  nombre?: string;
  name?: string;
  email?: string;
  telefono?: string;
  phone?: string;
  stage?: string;
  nro_ticket?: number | string;
  ticket_id?: number | string;
  relevance_score?: number;
  confidence_score?: number;
  created_at?: string;
}

export interface LeadTimelineEvent {
  id?: number | string;
  event_type?: string;
  note?: string;
  stage?: string;
  created_at?: string;
  actor?: string;
}

export interface StrategicHeatmapPoint {
  lat?: number;
  lon?: number;
  categoria?: string;
  zona?: string;
  tipo?: string;
  count?: number;
}

export interface StrategicHeatmapResponse {
  top_categories?: Array<{ categoria?: string; count?: number }>;
  top_zones?: Array<{ zona?: string; count?: number }>;
  heatmap_points?: StrategicHeatmapPoint[];
}

export interface RealtimeAiOverviewResponse {
  active_sessions?: number;
  llm_status?: string;
  open_tickets?: number;
  assigned_tickets?: number;
  unassigned_tickets?: number;
  coverage_ratio?: number;
}

export interface StrategicOverviewResponse {
  totals?: Record<string, number>;
  by_stage?: Record<string, number>;
  by_tenant?: Record<string, number>;
  total_leads?: number;
  open_leads?: number;
  won?: number;
  lost?: number;
  sla_breached?: number;
  win_rate?: number;
}

export interface CatalogQualityItem {
  id?: number | string;
  tenant_slug?: string;
  product_name?: string;
  confidence_score?: number;
  quality_issues?: string[];
  review_required?: boolean;
}

export interface CatalogQualityResponse {
  items?: CatalogQualityItem[];
}

export interface LeadsPipelineResponse {
  total?: number;
  by_stage?: Record<string, number>;
  by_tenant?: Record<string, number>;
  conversion_rate?: number;
  avg_first_response_seconds?: number;
  items?: LeadsPipelineItem[];
}

interface EnterpriseBaseFilters {
  tenant_id: number;
  scope?: string;
  from?: string;
  to?: string;
  tz?: string;
}

const normalizeCollaborationState = (raw: unknown): TicketCollaborationState | null => {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const toCount = (value: unknown) => {
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  return {
    latest_comment_id:
      (record.latest_comment_id as string | number | null | undefined) ??
      (record.latestCommentId as string | number | null | undefined) ??
      null,
    latest_read_at:
      (record.latest_read_at as string | null | undefined) ??
      (record.latestReadAt as string | null | undefined) ??
      null,
    unread_count: toCount(record.unread_count ?? record.unreadCount),
    has_unread: Boolean(record.has_unread ?? record.hasUnread ?? false),
    unread_viewer_count: toCount(
      record.unread_viewer_count ?? record.unreadViewerCount,
    ),
    active_viewers_count: toCount(
      record.active_viewers_count ?? record.activeViewersCount,
    ),
  };
};

const normalizeEnterpriseLeadItem = (raw: unknown): EnterpriseLeadItem | null => {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  return {
    ...item,
    id: (item.id as string | number | undefined) ?? undefined,
    ticket_id:
      (item.ticket_id as string | number | undefined) ??
      (item.ticketId as string | number | undefined) ??
      undefined,
    nro_ticket:
      (item.nro_ticket as string | number | undefined) ??
      (item.nroTicket as string | number | undefined) ??
      undefined,
    ticket_type:
      (item.ticket_type as string | undefined) ??
      (item.ticketType as string | undefined) ??
      undefined,
    tenant_slug:
      (item.tenant_slug as string | undefined) ??
      (item.tenantSlug as string | undefined) ??
      undefined,
    collaboration_state: normalizeCollaborationState(item.collaboration_state),
  };
};

const normalizeTenantUnreadSummaryItem = (raw: unknown): TenantUnreadSummaryItem | null => {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  return {
    ...item,
    ticket_id:
      (item.ticket_id as string | number | undefined) ??
      (item.ticketId as string | number | undefined) ??
      undefined,
    ticket_type:
      (item.ticket_type as string | undefined) ??
      (item.ticketType as string | undefined) ??
      undefined,
    unread_count:
      typeof item.unread_count === "number"
        ? item.unread_count
        : typeof item.unreadCount === "number"
          ? item.unreadCount
          : Number(item.unread_count ?? item.unreadCount ?? 0) || 0,
    last_message_at:
      (item.last_message_at as string | undefined) ??
      (item.lastMessageAt as string | undefined) ??
      undefined,
    collaboration_state: normalizeCollaborationState(item.collaboration_state),
  };
};

const normalizeTenantDashboardBundle = (
  raw: unknown,
): TenantDashboardBundleResponse => {
  if (!raw || typeof raw !== "object") return {};
  const bundle = raw as Record<string, unknown>;
  const leads =
    bundle.leads && typeof bundle.leads === "object"
      ? (bundle.leads as Record<string, unknown>)
      : undefined;
  const summary =
    bundle.summary && typeof bundle.summary === "object"
      ? (bundle.summary as Record<string, unknown>)
      : undefined;

  return {
    ...bundle,
    summary: summary
      ? {
          ...summary,
          active_viewers:
            typeof summary.active_viewers === "number"
              ? summary.active_viewers
              : Number(summary.active_viewers ?? 0) || 0,
          unread_viewers:
            typeof summary.unread_viewers === "number"
              ? summary.unread_viewers
              : Number(summary.unread_viewers ?? 0) || 0,
        }
      : undefined,
    leads: leads
      ? {
          ...leads,
          items: Array.isArray(leads.items)
            ? leads.items
                .map(normalizeEnterpriseLeadItem)
                .filter((item): item is EnterpriseLeadItem => Boolean(item))
            : [],
        }
      : undefined,
  };
};

const buildQueryString = (
  filters: Record<string, string | number | boolean | undefined>,
) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.append(key, String(value));
  });
  return params.toString();
};

const isEndpointMissing = (error: unknown) =>
  error instanceof ApiError && [404, 405, 501].includes(error.status);

const apiFetchWithFallback = async <T>(
  primaryPath: string,
  fallbackPath: string,
  options: Parameters<typeof apiFetch>[1] = {},
) => {
  try {
    return await apiFetch<T>(primaryPath, options);
  } catch (error) {
    if (!isEndpointMissing(error)) throw error;
    return apiFetch<T>(fallbackPath, options);
  }
};

export const enterpriseService = {
  captureLead: async (payload: {
    tenant_slug?: string;
    name?: string;
    email?: string;
    phone?: string;
    interest?: string;
    message?: string;
    chat_session_id?: string;
    anon_id?: string;
    channel?: string;
    source?: string;
    trigger?: string;
    intent?: string;
    idempotency_key?: string;
    metadata?: Record<string, unknown>;
  }) => {
    const chatSessionId = payload.chat_session_id || getOrCreateChatSessionId();
    const anonId = payload.anon_id || getOrCreateAnonId();
    const trigger = payload.trigger || payload.intent || "lead_capture";
    const idempotencyKey =
      payload.idempotency_key ||
      createLeadCaptureIdempotencyKey(payload.tenant_slug, chatSessionId, trigger);

    return apiFetch<any>("/api/public/lead-capture", {
      method: "POST",
      body: {
        ...payload,
        chat_session_id: chatSessionId,
        anon_id: anonId || undefined,
        channel: payload.channel || "web",
        source: payload.source || "widget_chat",
        trigger,
        intent: payload.intent || trigger,
        idempotency_key: idempotencyKey,
      },
      headers: {
        "Idempotency-Key": idempotencyKey,
      },
      skipAuth: true,
      isWidgetRequest: true,
      tenantSlug: payload.tenant_slug,
      omitCredentials: true,
      sendAnonId: true,
    });
  },

  getCatalogQuality: async (
    filters: {
      tenant_slug?: string;
      limit?: number;
    },
    tenantSlug?: string,
  ) => {
    const query = buildQueryString(filters);
    return apiFetch<CatalogQualityResponse>(
      `/api/admin/catalog/quality?${query}`,
      { tenantSlug },
    );
  },

  getLeadsPipeline: async (
    filters: {
      tenant_slug?: string;
      since_days?: number;
    },
    tenantSlug?: string,
  ) => {
    const query = buildQueryString(filters);
    return apiFetch<LeadsPipelineResponse>(
      `/api/admin/leads/pipeline?${query}`,
      { tenantSlug },
    );
  },

  updateLeadStage: async (
    ticketId: string | number,
    payload: { stage: string; note?: string; ticket_type?: string },
    tenantSlug?: string,
  ) => {
    const ticketType = payload.ticket_type || "municipio";
    return apiFetch<any>(`/api/admin/leads/${ticketType}/${ticketId}/stage`, {
      method: "PATCH",
      body: { stage: payload.stage, note: payload.note },
      tenantSlug,
    });
  },

  bulkUpdateLeadStage: async (
    payload: {
      stage: string;
      updates: Array<{
        ticket_type: string;
        ticket_id: string | number;
        note?: string;
      }>;
    },
    tenantSlug?: string,
  ) => {
    return apiFetch<any>("/api/admin/leads/bulk-stage", {
      method: "PATCH",
      body: payload,
      tenantSlug,
    });
  },

  getLeadTimeline: async (
    ticketType: string,
    ticketId: string | number,
    tenantSlug?: string,
  ) => {
    return apiFetch<{
      items?: LeadTimelineEvent[];
      timeline?: LeadTimelineEvent[];
    }>(`/api/admin/leads/${ticketType}/${ticketId}/timeline`, { tenantSlug });
  },

  addLeadTimelineNote: async (
    ticketType: string,
    ticketId: string | number,
    payload: { note: string },
    tenantSlug?: string,
  ) => {
    return apiFetch<any>(
      `/api/admin/leads/${ticketType}/${ticketId}/timeline`,
      {
        method: "POST",
        body: payload,
        tenantSlug,
      },
    );
  },

  getStrategicOverview: async (
    filters: { since_days?: number },
    tenantSlug?: string,
  ) => {
    const query = buildQueryString(filters);
    return apiFetch<StrategicOverviewResponse>(
      `/api/admin/leads/strategic-overview?${query}`,
      { tenantSlug },
    );
  },

  runLeadsPlaybook: async (
    payload: { dry_run: boolean; only_sla_breached?: boolean; limit?: number },
    tenantSlug?: string,
  ) => {
    return apiFetch<{
      items?: Array<{
        ticket_id?: string | number;
        actions?: Array<{
          channel?: string;
          status?: string;
          template?: string;
        }>;
      }>;
    }>("/api/admin/leads/playbooks/run", {
      method: "POST",
      body: payload,
      tenantSlug,
    });
  },

  getLeadInteractions: async (
    filters: {
      tenant_id?: number;
      limit?: number;
      cursor?: string;
      priority?: string;
      tenant_slug?: string;
      from?: string;
      to?: string;
      scope?: string;
      since_days?: number;
    },
    tenantSlug?: string,
  ) => {
    const query = buildQueryString(filters);
    return apiFetch<LeadInteractionsResponse>(
      `/api/admin/leads/interactions?${query}`,
      { tenantSlug },
    );
  },

  getDemoCatalog: async (ensureUsers = false): Promise<DemoCatalogResponse> => {
    const suffix = ensureUsers ? "?ensure_users=true" : "";
    try {
      return await apiFetch<DemoCatalogResponse>(`/api/auth/demo/catalog${suffix}`, {
        skipAuth: true,
        omitTenant: true,
      });
    } catch (error) {
      const normalized = toDemoModeDisabledError(error);
      if (normalized) throw normalized;
      throw error;
    }
  },

  demoLoginWithPayload: async (
    payload: Record<string, unknown>,
    endpoint = "/api/auth/demo",
  ): Promise<DemoAuthResponse> => {
    try {
      return await apiFetch<DemoAuthResponse>(endpoint, {
        method: "POST",
        body: payload,
        skipAuth: true,
        omitTenant: true,
      });
    } catch (error) {
      const normalized = toDemoModeDisabledError(error);
      if (normalized) throw normalized;
      throw error;
    }
  },

  demoLogin: async (rubro: DemoRubro): Promise<DemoAuthResponse> => {
    try {
      return await apiFetch<DemoAuthResponse>("/api/auth/demo", {
        method: "POST",
        body: { rubro },
        skipAuth: true,
        omitTenant: true,
      });
    } catch (error) {
      const normalized = toDemoModeDisabledError(error);
      if (normalized) throw normalized;
      throw error;
    }
  },

  getAnalyticsOverview: async (
    filters: EnterpriseBaseFilters,
    tenantSlug?: string,
  ) => {
    const query = buildQueryString(filters);
    return apiFetch<any>(`/api/admin/analytics/overview?${query}`, {
      tenantSlug,
    });
  },

  getAnalyticsHeatmap: async (
    filters: EnterpriseBaseFilters,
    tenantSlug?: string,
  ) => {
    const query = buildQueryString(filters);
    return apiFetch<any>(`/api/admin/analytics/heatmap?${query}`, {
      tenantSlug,
    });
  },

  trackEvent: async (
    payload: {
      tenant_id?: number;
      event_name?: string;
      event?: string;
      payload?: Record<string, unknown>;
      channel?: string;
      session_id?: string;
      fallback_event_name?: string;
      event_endpoint_preferred?: string;
    },
    tenantSlug?: string,
  ) => {
    const eventName =
      payload.event_name ||
      payload.event ||
      payload.fallback_event_name ||
      "frontend_analytics_event";

    const normalizedPayload = {
      tenant_id:
        typeof payload.tenant_id === "number" &&
        Number.isFinite(payload.tenant_id)
          ? payload.tenant_id
          : undefined,
      tenant_slug: tenantSlug || undefined,
      event_name: eventName,
      payload: payload.payload,
      channel: payload.channel ?? "web",
      session_id: payload.session_id,
    };

    const preferredEndpoint =
      typeof payload.event_endpoint_preferred === "string" &&
      payload.event_endpoint_preferred.trim()
        ? payload.event_endpoint_preferred.trim()
        : "/analytics/event";

    return apiFetch(preferredEndpoint, {
      method: "POST",
      body: normalizedPayload,
      tenantSlug,
      omitTenant: true,
    });
  },

  getTenantLeads: async (
    tenantSlug: string,
    filters: { stage?: string; limit?: number } = {},
  ) => {
    const query = buildQueryString(filters);
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/leads?${query}`, {
      tenantSlug,
    });
  },

  updateTenantLeadStage: async (
    tenantSlug: string,
    ticketType: string,
    ticketId: string | number,
    payload: { stage: string; note?: string },
  ) => {
    return apiFetch<any>(
      `/api/admin/tenants/${tenantSlug}/leads/${ticketType}/${ticketId}/stage`,
      {
        method: "PATCH",
        body: payload,
        tenantSlug,
      },
    );
  },

  bulkUpdateTenantLeadStage: async (
    tenantSlug: string,
    payload: {
      stage: string;
      updates: Array<{
        ticket_type: string;
        ticket_id: string | number;
        note?: string;
      }>;
    },
  ) => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/leads/bulk-stage`, {
      method: "PATCH",
      body: payload,
      tenantSlug,
    });
  },

  getTenantLeadTimeline: async (
    tenantSlug: string,
    ticketType: string,
    ticketId: string | number,
  ) => {
    return apiFetch<{
      items?: LeadTimelineEvent[];
      timeline?: LeadTimelineEvent[];
    }>(
      `/api/admin/tenants/${tenantSlug}/leads/${ticketType}/${ticketId}/timeline`,
      { tenantSlug },
    );
  },

  addTenantLeadTimelineNote: async (
    tenantSlug: string,
    ticketType: string,
    ticketId: string | number,
    payload: { note: string },
  ) => {
    return apiFetch<any>(
      `/api/admin/tenants/${tenantSlug}/leads/${ticketType}/${ticketId}/timeline`,
      {
        method: "POST",
        body: payload,
        tenantSlug,
      },
    );
  },

  updateEmployeeScope: async (
    userId: string | number,
    payload: { categorias?: string[]; zonas?: string[]; permisos?: string[] },
    tenantSlug?: string,
  ) => {
    return apiFetch<any>(`/api/admin/employees/${userId}/scope`, {
      method: "PUT",
      body: payload,
      tenantSlug,
    });
  },

  suggestAssignee: async (
    tenantSlug: string,
    payload: {
      categoria?: string;
      zona?: string;
      required_permission?: string;
    },
  ) => {
    return apiFetch<any>(
      `/api/admin/tenants/${tenantSlug}/employees/suggest-assignee`,
      {
        method: "POST",
        body: payload,
        tenantSlug,
      },
    );
  },

  autoAssignTenantTicket: async (
    tenantSlug: string,
    ticketType: string,
    ticketId: string | number,
    payload: { required_permission?: string } = {},
  ) => {
    return apiFetch<any>(
      `/api/admin/tenants/${tenantSlug}/tickets/${ticketType}/${ticketId}/auto-assign`,
      {
        method: "POST",
        body: payload,
        tenantSlug,
      },
    );
  },

  getTenantEmployeesWorkload: async (tenantSlug: string) => {
    return apiFetch<{ items?: any[] }>(
      `/api/admin/tenants/${tenantSlug}/employees/workload`,
      { tenantSlug },
    );
  },

  getTenantEncuestasOverview: async (tenantSlug: string) => {
    return apiFetch<{ items?: any[]; total?: number }>(
      `/api/admin/tenants/${tenantSlug}/encuestas/overview`,
      { tenantSlug },
    );
  },

  getGlobalEncuestasOverview: async (tenantSlug?: string) => {
    return apiFetch<{ items?: any[]; totals?: any }>(
      `/api/admin/encuestas/overview`,
      { tenantSlug },
    );
  },

  getTenantUnreadSummary: async (
    tenantSlug: string,
    filters: { since_minutes?: number } = {},
  ) => {
    const query = buildQueryString(filters);
    const response = await apiFetch<TenantUnreadSummaryResponse>(
      `/api/admin/tenants/${tenantSlug}/tickets/unread-summary?${query}`,
      { tenantSlug },
    );
    return {
      ...response,
      items: Array.isArray(response?.items)
        ? response.items
            .map(normalizeTenantUnreadSummaryItem)
            .filter((item): item is TenantUnreadSummaryItem => Boolean(item))
        : [],
    };
  },

  getTenantHealth: async (
    filters: { since_days?: number } = {},
    tenantSlug?: string,
  ) => {
    const query = buildQueryString(filters);
    const canonicalPath = tenantSlug
      ? `/api/v2/tenants/${encodeURIComponent(tenantSlug)}/health${query ? `?${query}` : ""}`
      : `/api/v2/tenant-health${query ? `?${query}` : ""}`;
    return apiFetchWithFallback<{ items?: any[] }>(
      canonicalPath,
      `/api/admin/analytics/tenant-health?${query}`,
      { tenantSlug },
    );
  },

  getTenantProfile360: async (
    tenantSlug: string,
    filters: { since_days?: number } = {},
  ) => {
    const query = buildQueryString(filters);
    return apiFetch<any>(
      `/api/admin/tenants/${tenantSlug}/profile-360${query ? `?${query}` : ""}`,
      { tenantSlug },
    );
  },

  getTenantDashboardBundle: async (
    tenantSlug: string,
    filters: { since_days?: number } = {},
  ) => {
    const query = buildQueryString(filters);
    const response = await apiFetch<TenantDashboardBundleResponse>(
      `/api/admin/tenants/${tenantSlug}/dashboard-bundle${query ? `?${query}` : ""}`,
      { tenantSlug },
    );
    return normalizeTenantDashboardBundle(response);
  },

  getTenantHeatmapSummary: async (
    tenantSlug: string,
    filters: { since_days?: number; point_limit?: number } = {},
  ) => {
    const query = buildQueryString(filters);
    return apiFetch<{
      top_categories?: any[];
      top_zones?: any[];
      hotspot_pairs?: any[];
      heatmap_points?: any[];
      meta?: any;
    }>(
      `/api/admin/tenants/${tenantSlug}/heatmap-summary${query ? `?${query}` : ""}`,
      { tenantSlug },
    );
  },

  getTenantEmployeeCoverage: async (tenantSlug: string) => {
    const response = await apiFetchWithFallback<unknown>(
      `/api/v2/tenants/${encodeURIComponent(tenantSlug)}/employee-coverage`,
      `/api/admin/tenants/${tenantSlug}/employees/coverage`,
      { tenantSlug },
    );
    return normalizeEmployeeCoverageV2(response) as {
      categorias?: any[];
      zonas?: any[];
      permisos?: any[];
      canales?: any[];
      items?: any[];
      meta?: any;
    };
  },

  getRealtimeAiOverview: async (
    filters: { minutes?: number } = {},
    tenantSlug?: string,
  ) => {
    const query = buildQueryString(filters);
    return apiFetch<RealtimeAiOverviewResponse>(
      `/api/admin/analytics/realtime-ai?${query}`,
      { tenantSlug },
    );
  },

  getStrategicHeatmapCategoriesZones: async (
    filters: { since_days?: number } = {},
    tenantSlug?: string,
  ) => {
    const query = buildQueryString(filters);
    return apiFetch<StrategicHeatmapResponse>(
      `/api/admin/analytics/heatmap-categories-zones?${query}`,
      { tenantSlug },
    );
  },

  getExecutiveSummary: async (
    filters: {
      since_days?: number;
      tenant_slug?: string;
      include_heatmap?: boolean;
      include_realtime?: boolean;
    } = {},
    tenantSlug?: string,
  ) => {
    const query = buildQueryString(filters);
    const response = await apiFetchWithFallback<unknown>(
      `/api/v2/superadmin/executive-summary${query ? `?${query}` : ""}`,
      `/api/v2/super-admin/executive-summary${query ? `?${query}` : ""}`,
      { tenantSlug },
    );
    return normalizeSuperadminExecutiveSummaryV2(response) as {
      strategic_overview?: any;
      tenant_health?: { items?: any[] } | any[];
      realtime?: any;
      heatmap?: any;
      recommended_actions?: any[];
    };
  },

  getTicketSummary: async (
    ticketId: string | number,
    payload: { scope?: string },
    tenantSlug?: string,
  ) => {
    return apiFetch<{ summary?: string; text?: string }>(
      `/admin/tickets/${ticketId}/ai-summary`,
      {
        method: "POST",
        body: payload,
        tenantSlug,
      },
    );
  },

  getProductRecommendations: async (
    payload: { tenant_id: number; limit?: number; scope?: string },
    tenantSlug?: string,
  ) => {
    return apiFetch<{ items?: any[]; recommendations?: any[] }>(
      "/admin/ai/product-recommendations",
      {
        method: "POST",
        body: payload,
        tenantSlug,
      },
    );
  },

  uploadOrderDraftFromDocument: async (
    tenantId: number,
    file: File,
    tenantSlug?: string,
  ) => {
    const formData = new FormData();
    formData.append("tenant_id", String(tenantId));
    formData.append("file", file);
    return apiFetch<any>("/admin/ai/order-draft-from-document", {
      method: "POST",
      body: formData,
      tenantSlug,
      headers: {},
    });
  },

  getBotSettings: async (
    tenantId: number,
    tenantSlug?: string,
  ): Promise<BotSettingsResponse> => {
    return apiFetch<BotSettingsResponse>(
      `/admin/bot/settings?tenant_id=${tenantId}`,
      { tenantSlug },
    );
  },

  updateBotSettings: async (
    payload: BotSettingsPayload,
    tenantSlug?: string,
  ) => {
    return apiFetch<any>("/admin/bot/settings", {
      method: "PUT",
      body: payload,
      tenantSlug,
    });
  },

  getFranchiseProfile: async (tenantSlug: string) => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/franchise-profile`, {
      tenantSlug,
    });
  },

  updateFranchiseProfile: async (
    tenantSlug: string,
    payload: FranchiseProfilePayload,
  ) => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/franchise-profile`, {
      method: "PUT",
      body: payload,
      tenantSlug,
    });
  },

  getFranchiseReadiness: async (tenantSlug: string) => {
    return apiFetch<any>(
      `/api/admin/tenants/${tenantSlug}/franchise-readiness`,
      { tenantSlug },
    );
  },

  getFranchisePlaybook: async (tenantSlug: string) => {
    return apiFetch<any>(
      `/api/admin/tenants/${tenantSlug}/franchise-playbook`,
      { tenantSlug },
    );
  },
};
