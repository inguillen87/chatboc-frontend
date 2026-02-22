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
}

export interface DemoCatalogEntryPoint {
  id?: string;
  rubro?: DemoRubro;
  label?: string;
  description?: string;
}

export interface DemoCatalogResponse {
  tenants?: DemoCatalogTenant[];
  entry_points?: DemoCatalogEntryPoint[];
  supported_languages?: string[];
  credentials?: Record<string, unknown>;
}

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
  created_at?: string;
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



  getLeadsPipeline: async (filters: {
    tenant_slug?: string;
    since_days?: number;
  }, tenantSlug?: string) => {
    const query = buildQueryString(filters);
    return apiFetch<LeadsPipelineResponse>(`/api/admin/leads/pipeline?${query}`, { tenantSlug });
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
  }, tenantSlug?: string) => {
    const query = buildQueryString(filters);
    return apiFetch<LeadInteractionsResponse>(`/api/admin/leads/interactions?${query}`, { tenantSlug });
  },

  getDemoCatalog: async (ensureUsers = false): Promise<DemoCatalogResponse> => {
    const suffix = ensureUsers ? '?ensure_users=true' : '';
    return apiFetch<DemoCatalogResponse>(`/auth/demo/catalog${suffix}`);
  },

  demoLogin: async (rubro: DemoRubro): Promise<DemoAuthResponse> => {
    return apiFetch<DemoAuthResponse>('/auth/demo', {
      method: 'POST',
      body: { rubro },
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
