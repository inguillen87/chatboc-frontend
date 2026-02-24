import { apiFetch } from '@/utils/api';

export type DemoRubro = 'municipio' | 'pyme';

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
    default_sector?: 'gobierno' | 'empresas';
    sector_options?: Array<{ value: 'gobierno' | 'empresas'; label?: string }>;
  };
  demo_selector?: DemoSelectorContract;
  preload_before_login?: string[];
}

export const SUPPORTED_DEMO_FRONTEND_CONTRACT_VERSION = '1';

const normalizeDemoRubro = (raw: unknown): DemoRubro | undefined => {
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized.includes('mun')) return 'municipio';
  if (normalized.includes('pym') || normalized.includes('emp')) return 'pyme';
  if (normalized === 'municipio' || normalized === 'pyme') return normalized;
  return undefined;
};

const normalizePreloadHints = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string').map((item) => item.trim().toLowerCase()).filter(Boolean);
  }

  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => key.trim().toLowerCase())
      .filter(Boolean);
  }

  return [];
};


const normalizeSector = (raw: unknown): 'gobierno' | 'empresas' | undefined => {
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized.includes('gob') || normalized.includes('mun') || normalized.includes('pub')) return 'gobierno';
  if (normalized.includes('emp') || normalized.includes('pym') || normalized.includes('priv')) return 'empresas';
  if (normalized === 'gobierno' || normalized === 'empresas') return normalized;
  return undefined;
};

const normalizeSectorOptions = (raw: unknown): Array<{ value: 'gobierno' | 'empresas'; label?: string }> => {
  if (!Array.isArray(raw)) return [];
  const values = new Set<'gobierno' | 'empresas'>();
  const options: Array<{ value: 'gobierno' | 'empresas'; label?: string }> = [];

  raw.forEach((item) => {
    if (typeof item === 'string') {
      const value = normalizeSector(item);
      if (!value || values.has(value)) return;
      values.add(value);
      options.push({ value });
      return;
    }
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const value = normalizeSector(record.value ?? record.key ?? record.sector ?? record.id);
      if (!value || values.has(value)) return;
      values.add(value);
      options.push({
        value,
        label: typeof record.label === 'string' ? record.label : undefined,
      });
    }
  });

  return options;
};

export const extractDemoFrontendContract = (catalog?: DemoCatalogResponse | null): DemoFrontendContract => {
  const source = (catalog?.frontend as Record<string, unknown> | undefined) || (catalog as Record<string, unknown> | undefined) || {};

  const selectorRaw = source.demo_selector;
  const selector = selectorRaw && typeof selectorRaw === 'object'
    ? (selectorRaw as Record<string, unknown>)
    : undefined;

  const versionRaw = source.frontend_contract_version;
  const onboardingRaw = source.onboarding;
  const onboarding = onboardingRaw && typeof onboardingRaw === 'object'
    ? (onboardingRaw as Record<string, unknown>)
    : undefined;

  return {
    frontend_contract_version: typeof versionRaw === 'string' ? versionRaw.trim() : undefined,
    onboarding: onboarding
      ? {
          default_sector: normalizeSector(onboarding.default_sector),
          sector_options: normalizeSectorOptions(onboarding.sector_options),
        }
      : undefined,
    demo_selector: selector
      ? {
          mode: typeof selector.mode === 'string' ? selector.mode.trim().toLowerCase() : undefined,
          sector_default: normalizeDemoRubro(selector.sector_default),
          require_rubro_by_sector: selector.require_rubro_by_sector === true,
          tenant_slug_field:
            typeof selector.tenant_slug_field === 'string' && selector.tenant_slug_field.trim()
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
  return normalized === SUPPORTED_DEMO_FRONTEND_CONTRACT_VERSION || normalized.startsWith(`${SUPPORTED_DEMO_FRONTEND_CONTRACT_VERSION}.`);
};

export interface FranchiseProfilePayload {
  white_label_enabled?: boolean;
  reseller_enabled?: boolean;
  default_language?: 'es' | 'en' | 'pt';
  supported_languages?: Array<'es' | 'en' | 'pt'>;
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
  fallback_behavior?: 'derivar_humano' | 'auto_reply' | 'silent';
  branding?: BotSettingsBranding;
}

export interface BotSettingsResponse {
  tenant_id: number;
  settings: {
    name?: string;
    tone?: string;
    system_prompt?: string;
    fallback_behavior?: 'derivar_humano' | 'auto_reply' | 'silent';
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

const buildQueryString = (filters: Record<string, string | number | boolean | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.append(key, String(value));
  });
  return params.toString();
};

export const enterpriseService = {
  captureLead: async (payload: {
    tenant_slug?: string;
    name?: string;
    email?: string;
    phone?: string;
    interest?: string;
    message?: string;
    source?: string;
    metadata?: Record<string, unknown>;
  }) => {
    return apiFetch<any>('/api/public/lead-capture', {
      method: 'POST',
      body: payload,
      skipAuth: true,
      isWidgetRequest: true,
      omitCredentials: true,
      omitChatSessionId: true,
      sendAnonId: true,
    });
  },



  getCatalogQuality: async (filters: {
    tenant_slug?: string;
    limit?: number;
  }, tenantSlug?: string) => {
    const query = buildQueryString(filters);
    return apiFetch<CatalogQualityResponse>(`/api/admin/catalog/quality?${query}`, { tenantSlug });
  },

  getLeadsPipeline: async (filters: {
    tenant_slug?: string;
    since_days?: number;
  }, tenantSlug?: string) => {
    const query = buildQueryString(filters);
    return apiFetch<LeadsPipelineResponse>(`/api/admin/leads/pipeline?${query}`, { tenantSlug });
  },



  updateLeadStage: async (
    ticketId: string | number,
    payload: { stage: string; note?: string; ticket_type?: string },
    tenantSlug?: string,
  ) => {
    const ticketType = payload.ticket_type || 'municipio';
    return apiFetch<any>(`/api/admin/leads/${ticketType}/${ticketId}/stage`, {
      method: 'PATCH',
      body: { stage: payload.stage, note: payload.note },
      tenantSlug,
    });
  },

  bulkUpdateLeadStage: async (payload: { stage: string; updates: Array<{ ticket_type: string; ticket_id: string | number; note?: string }> }, tenantSlug?: string) => {
    return apiFetch<any>('/api/admin/leads/bulk-stage', {
      method: 'PATCH',
      body: payload,
      tenantSlug,
    });
  },

  getLeadTimeline: async (ticketType: string, ticketId: string | number, tenantSlug?: string) => {
    return apiFetch<{ items?: LeadTimelineEvent[]; timeline?: LeadTimelineEvent[] }>(`/api/admin/leads/${ticketType}/${ticketId}/timeline`, { tenantSlug });
  },

  addLeadTimelineNote: async (ticketType: string, ticketId: string | number, payload: { note: string }, tenantSlug?: string) => {
    return apiFetch<any>(`/api/admin/leads/${ticketType}/${ticketId}/timeline`, {
      method: 'POST',
      body: payload,
      tenantSlug,
    });
  },

  getStrategicOverview: async (filters: { since_days?: number }, tenantSlug?: string) => {
    const query = buildQueryString(filters);
    return apiFetch<StrategicOverviewResponse>(`/api/admin/leads/strategic-overview?${query}`, { tenantSlug });
  },

  runLeadsPlaybook: async (payload: { dry_run: boolean; only_sla_breached?: boolean; limit?: number }, tenantSlug?: string) => {
    return apiFetch<{ items?: Array<{ ticket_id?: string | number; actions?: Array<{ channel?: string; status?: string; template?: string }> }> }>('/api/admin/leads/playbooks/run', {
      method: 'POST',
      body: payload,
      tenantSlug,
    });
  },

  getLeadInteractions: async (filters: {
    tenant_id?: number;
    limit?: number;
    cursor?: string;
    priority?: string;
    tenant_slug?: string;
    from?: string;
    to?: string;
    scope?: string;
    since_days?: number;
  }, tenantSlug?: string) => {
    const query = buildQueryString(filters);
    return apiFetch<LeadInteractionsResponse>(`/api/admin/leads/interactions?${query}`, { tenantSlug });
  },

  getDemoCatalog: async (ensureUsers = false): Promise<DemoCatalogResponse> => {
    const suffix = ensureUsers ? '?ensure_users=true' : '';
    return apiFetch<DemoCatalogResponse>(`/api/auth/demo/catalog${suffix}`, {
      skipAuth: true,
      omitTenant: true,
    });
  },

  demoLoginWithPayload: async (payload: Record<string, unknown>, endpoint = '/api/auth/demo'): Promise<DemoAuthResponse> => {
    return apiFetch<DemoAuthResponse>(endpoint, {
      method: 'POST',
      body: payload,
      skipAuth: true,
      omitTenant: true,
    });
  },

  demoLogin: async (rubro: DemoRubro): Promise<DemoAuthResponse> => {
    return apiFetch<DemoAuthResponse>('/api/auth/demo', {
      method: 'POST',
      body: { rubro },
      skipAuth: true,
      omitTenant: true,
    });
  },

  getAnalyticsOverview: async (filters: EnterpriseBaseFilters, tenantSlug?: string) => {
    const query = buildQueryString(filters);
    return apiFetch<any>(`/admin/analytics/overview?${query}`, { tenantSlug });
  },

  getAnalyticsHeatmap: async (filters: EnterpriseBaseFilters, tenantSlug?: string) => {
    const query = buildQueryString(filters);
    return apiFetch<any>(`/admin/analytics/heatmap?${query}`, { tenantSlug });
  },

  trackEvent: async (
    payload: {
      tenant_id: number;
      event_name: string;
      payload?: Record<string, unknown>;
      channel?: string;
      session_id?: string;
    },
    tenantSlug?: string,
  ) => {
    return apiFetch('/analytics/event', {
      method: 'POST',
      body: payload,
      tenantSlug,
    });
  },


  getTenantLeads: async (tenantSlug: string, filters: { stage?: string; limit?: number } = {}) => {
    const query = buildQueryString(filters);
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/leads?${query}`, { tenantSlug });
  },

  updateTenantLeadStage: async (tenantSlug: string, ticketType: string, ticketId: string | number, payload: { stage: string; note?: string }) => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/leads/${ticketType}/${ticketId}/stage`, {
      method: 'PATCH',
      body: payload,
      tenantSlug,
    });
  },

  bulkUpdateTenantLeadStage: async (tenantSlug: string, payload: { stage: string; updates: Array<{ ticket_type: string; ticket_id: string | number; note?: string }> }) => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/leads/bulk-stage`, {
      method: 'PATCH',
      body: payload,
      tenantSlug,
    });
  },

  getTenantLeadTimeline: async (tenantSlug: string, ticketType: string, ticketId: string | number) => {
    return apiFetch<{ items?: LeadTimelineEvent[]; timeline?: LeadTimelineEvent[] }>(`/api/admin/tenants/${tenantSlug}/leads/${ticketType}/${ticketId}/timeline`, { tenantSlug });
  },

  addTenantLeadTimelineNote: async (tenantSlug: string, ticketType: string, ticketId: string | number, payload: { note: string }) => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/leads/${ticketType}/${ticketId}/timeline`, {
      method: 'POST',
      body: payload,
      tenantSlug,
    });
  },

  updateEmployeeScope: async (userId: string | number, payload: { categorias?: string[]; zonas?: string[]; permisos?: string[] }, tenantSlug?: string) => {
    return apiFetch<any>(`/api/admin/employees/${userId}/scope`, {
      method: 'PUT',
      body: payload,
      tenantSlug,
    });
  },

  suggestAssignee: async (tenantSlug: string, payload: { categoria?: string; zona?: string; required_permission?: string }) => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/employees/suggest-assignee`, {
      method: 'POST',
      body: payload,
      tenantSlug,
    });
  },

  autoAssignTenantTicket: async (tenantSlug: string, ticketType: string, ticketId: string | number, payload: { required_permission?: string } = {}) => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/tickets/${ticketType}/${ticketId}/auto-assign`, {
      method: 'POST',
      body: payload,
      tenantSlug,
    });
  },

  getTenantEmployeesWorkload: async (tenantSlug: string) => {
    return apiFetch<{ items?: any[] }>(`/api/admin/tenants/${tenantSlug}/employees/workload`, { tenantSlug });
  },

  getTenantEncuestasOverview: async (tenantSlug: string) => {
    return apiFetch<{ items?: any[]; total?: number }>(`/api/admin/tenants/${tenantSlug}/encuestas/overview`, { tenantSlug });
  },

  getGlobalEncuestasOverview: async (tenantSlug?: string) => {
    return apiFetch<{ items?: any[]; totals?: any }>(`/api/admin/encuestas/overview`, { tenantSlug });
  },



  getTenantUnreadSummary: async (tenantSlug: string, filters: { since_minutes?: number } = {}) => {
    const query = buildQueryString(filters);
    return apiFetch<{ total_tickets_with_unread?: number; items?: any[] }>(`/api/admin/tenants/${tenantSlug}/tickets/unread-summary?${query}`, { tenantSlug });
  },

  getTenantHealth: async (filters: { since_days?: number } = {}, tenantSlug?: string) => {
    const query = buildQueryString(filters);
    return apiFetch<{ items?: any[] }>(`/api/admin/analytics/tenant-health?${query}`, { tenantSlug });
  },

  getRealtimeAiOverview: async (filters: { minutes?: number } = {}, tenantSlug?: string) => {
    const query = buildQueryString(filters);
    return apiFetch<RealtimeAiOverviewResponse>(`/api/admin/analytics/realtime-ai?${query}`, { tenantSlug });
  },

  getStrategicHeatmapCategoriesZones: async (filters: { since_days?: number } = {}, tenantSlug?: string) => {
    const query = buildQueryString(filters);
    return apiFetch<StrategicHeatmapResponse>(`/api/admin/analytics/heatmap-categories-zones?${query}`, { tenantSlug });
  },

  getExecutiveSummary: async (
    payload: { tenant_id: number; scope?: string; from?: string; to?: string; strict_no_data_message?: boolean },
    tenantSlug?: string,
  ) => {
    return apiFetch<{ summary?: string; text?: string }>('/admin/ai/executive-summary', {
      method: 'POST',
      body: payload,
      tenantSlug,
    });
  },

  getTicketSummary: async (ticketId: string | number, payload: { scope?: string }, tenantSlug?: string) => {
    return apiFetch<{ summary?: string; text?: string }>(`/admin/tickets/${ticketId}/ai-summary`, {
      method: 'POST',
      body: payload,
      tenantSlug,
    });
  },

  getProductRecommendations: async (payload: { tenant_id: number; limit?: number; scope?: string }, tenantSlug?: string) => {
    return apiFetch<{ items?: any[]; recommendations?: any[] }>('/admin/ai/product-recommendations', {
      method: 'POST',
      body: payload,
      tenantSlug,
    });
  },

  uploadOrderDraftFromDocument: async (tenantId: number, file: File, tenantSlug?: string) => {
    const formData = new FormData();
    formData.append('tenant_id', String(tenantId));
    formData.append('file', file);
    return apiFetch<any>('/admin/ai/order-draft-from-document', {
      method: 'POST',
      body: formData,
      tenantSlug,
      headers: {},
    });
  },

  getBotSettings: async (tenantId: number, tenantSlug?: string): Promise<BotSettingsResponse> => {
    return apiFetch<BotSettingsResponse>(`/admin/bot/settings?tenant_id=${tenantId}`, { tenantSlug });
  },

  updateBotSettings: async (payload: BotSettingsPayload, tenantSlug?: string) => {
    return apiFetch<any>('/admin/bot/settings', {
      method: 'PUT',
      body: payload,
      tenantSlug,
    });
  },

  getFranchiseProfile: async (tenantSlug: string) => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/franchise-profile`, { tenantSlug });
  },

  updateFranchiseProfile: async (tenantSlug: string, payload: FranchiseProfilePayload) => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/franchise-profile`, {
      method: 'PUT',
      body: payload,
      tenantSlug,
    });
  },

  getFranchiseReadiness: async (tenantSlug: string) => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/franchise-readiness`, { tenantSlug });
  },

  getFranchisePlaybook: async (tenantSlug: string) => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/franchise-playbook`, { tenantSlug });
  },
};
