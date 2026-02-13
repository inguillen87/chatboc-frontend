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

export interface BotSettingsPayload {
  tenant_id: number;
  nombre_bot?: string;
  tono?: string;
  system_prompt?: string;
  fallback_behavior?: 'derivar_humano' | 'auto_reply' | 'silent';
  branding?: {
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
  };
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

  getBotSettings: async (tenantId: number, tenantSlug?: string) => {
    return apiFetch<any>(`/admin/bot/settings?tenant_id=${tenantId}`, { tenantSlug });
  },

  updateBotSettings: async (payload: BotSettingsPayload, tenantSlug?: string) => {
    return apiFetch<any>('/admin/bot/settings', {
      method: 'PUT',
      body: payload,
      tenantSlug,
    });
  },
};
