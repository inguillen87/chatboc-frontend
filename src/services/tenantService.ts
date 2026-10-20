import { ApiError, apiFetch } from "@/utils/api";
import { panelReadOptions } from '@/utils/panelReadOptions';
import { CreateTenantPayload, CreateTenantResponse, TenantConfigBundle, TenantConfigUpdate } from "@/types/TenantConfig";
import { WhatsappExternalNumberPayload, WhatsappNumberCreatePayload, WhatsappNumberInventoryItem } from "@/types/whatsapp";
import type {
  TenantRuntimeWidgetConfig,
  TenantRuntimeWidgetUpdate,
} from "@/utils/chatCustomizerPersistence";

const BASE_URL = "/api/admin/tenants";
const PUBLIC_BASE_URL = "/api/public/tenants";
type TenantRequestLifecycle = { isCurrent?: () => boolean };

export const tenantService = {
  createTenant: async (payload: CreateTenantPayload): Promise<CreateTenantResponse> => {
    return apiFetch<CreateTenantResponse>(BASE_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getTenantConfig: async (slug: string, lifecycle: TenantRequestLifecycle = {}): Promise<TenantConfigBundle> => {
    if (lifecycle.isCurrent?.() === false) throw new ApiError('La consulta pertenece a una pantalla anterior.', 409);
    const config = await apiFetch<TenantConfigBundle>(`${BASE_URL}/${encodeURIComponent(slug)}/config`, { ...panelReadOptions(slug), ...lifecycle });
    if (lifecycle.isCurrent?.() === false) throw new ApiError('La consulta pertenece a una pantalla anterior.', 409);
    if (config?.tenant?.slug !== slug) throw new ApiError('La configuración no corresponde a esta organización.', 502);
    return config;
  },

  updateTenantConfig: async (slug: string, payload: TenantConfigUpdate, lifecycle: TenantRequestLifecycle = {}): Promise<TenantConfigBundle> => {
    if (lifecycle.isCurrent?.() === false) throw new ApiError('El guardado pertenece a una pantalla anterior.', 409);
    const response = await apiFetch<TenantConfigBundle | {
      message?: string; contract_version?: string; ok?: boolean; saved?: boolean;
      tenant?: { id?: number; slug?: string }; profile?: TenantConfigBundle['organization_profile'];
    }>(`${BASE_URL}/${slug}/config`, {
      ...panelReadOptions(slug), ...lifecycle, allowStartupRecovery: false,
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (lifecycle.isCurrent?.() === false) throw new ApiError('El guardado pertenece a una pantalla anterior.', 409);
    if (payload.organization_profile) {
      const receipt = response as { contract_version?: string; ok?: boolean; saved?: boolean;
        tenant?: { id?: number; slug?: string }; profile?: TenantConfigBundle['organization_profile'] };
      const profile = receipt?.profile;
      if (receipt?.contract_version !== 'organization.profile_save.v1' || receipt.ok !== true || typeof receipt.saved !== 'boolean' ||
        receipt.tenant?.slug !== slug || !Number.isInteger(receipt.tenant.id) || receipt.tenant.id! < 1 ||
        profile?.contract_version !== 'organization.profile_settings.v1' || profile.tenant?.slug !== slug ||
        profile.tenant.id !== receipt.tenant.id || !/^[0-9a-f]{64}$/.test(profile.revision) ||
        profile.values?.logo_url !== payload.organization_profile.logo_url) {
        throw new ApiError('No pudimos confirmar el guardado del perfil institucional. Actualizá su estado antes de reintentar.', 502);
      }
      return tenantService.getTenantConfig(slug, lifecycle);
    }
    if (response && "tenant" in response && "configs" in response) {
      if (response.tenant.slug !== slug) throw new ApiError('La configuración no corresponde a esta organización.', 502);
      return response;
    }
    return tenantService.getTenantConfig(slug, lifecycle);
  },

  getRuntimeWidgetConfig: async (slug: string): Promise<TenantRuntimeWidgetConfig> => {
    return apiFetch<TenantRuntimeWidgetConfig>('/api/tenant/config', {
      tenantSlug: slug,
    });
  },

  updateRuntimeWidgetConfig: async (
    slug: string,
    payload: TenantRuntimeWidgetUpdate,
  ): Promise<{ status?: string }> => {
    return apiFetch<{ status?: string }>('/api/tenant/config', {
      method: 'PUT',
      body: payload,
      tenantSlug: slug,
    });
  },

  getPublicRuntimeWidgetConfig: async (slug: string): Promise<TenantRuntimeWidgetConfig> => {
    return apiFetch<TenantRuntimeWidgetConfig>(`/api/public/tenants/${slug}/widget-config`, {
      tenantSlug: slug,
    });
  },

  assignWhatsappNumber: async (slug: string): Promise<{ assigned: boolean; phone_number: string; sender_id: string }> => {
    return apiFetch<{ assigned: boolean; phone_number: string; sender_id: string }>(`${BASE_URL}/${slug}/assign-whatsapp-number`, {
      method: "POST",
    });
  },

  listWhatsappNumbers: async (slug: string): Promise<{ numbers: WhatsappNumberInventoryItem[] }> => {
    return apiFetch<{ numbers: WhatsappNumberInventoryItem[] }>(`/api/admin/whatsapp/numbers?status=available&tenant_slug=${slug}`);
  },

  assignWhatsappNumberFromInventory: async (slug: string, numberId: string | number): Promise<any> => {
    return apiFetch<any>('/api/admin/whatsapp/numbers/assign', {
      method: "POST",
      body: { number_id: numberId, tenant_slug: slug },
    });
  },

  createWhatsappNumber: async (payload: WhatsappNumberCreatePayload): Promise<any> => {
    return apiFetch<any>('/api/admin/whatsapp/numbers', {
      method: "POST",
      body: payload,
    });
  },

  registerExternalWhatsappNumber: async (slug: string, payload: WhatsappExternalNumberPayload): Promise<any> => {
    return apiFetch<any>('/api/admin/whatsapp/numbers/register', {
      method: "POST",
      body: { ...payload, tenant_slug: slug },
    });
  },

  getWhatsappTechProvider: async (slug: string): Promise<any> => {
    return apiFetch<any>(`/api/v2/tenants/${encodeURIComponent(slug)}/whatsapp/tech-provider`, panelReadOptions(slug));
  },

  provisionWhatsappTechProvider: async (slug: string, payload: Record<string, unknown> = {}): Promise<any> => {
    return apiFetch<any>(`/api/v2/tenants/${encodeURIComponent(slug)}/whatsapp/tech-provider/provision`, {
      method: "POST",
      body: payload,
      tenantSlug: slug,
    });
  },

  provisionWhatsappVoiceApp: async (slug: string, payload: Record<string, unknown> = {}): Promise<any> => {
    return apiFetch<any>(`/api/v2/tenants/${encodeURIComponent(slug)}/whatsapp/tech-provider/voice-app`, {
      method: "POST",
      body: payload,
      tenantSlug: slug,
    });
  },

  completeWhatsappEmbeddedSignup: async (
    slug: string,
    payload: {
      waba_id?: string | null;
      phone_number_id?: string | null;
      session_id?: string | null;
      code?: string | null;
      auth_code?: string | null;
      authorization_code?: string | null;
      event?: string | null;
      business_id?: string | null;
    },
  ): Promise<any> => {
    return apiFetch<any>(`/api/v2/tenants/${encodeURIComponent(slug)}/whatsapp/tech-provider/embedded-signup`, {
      method: "POST",
      body: payload,
      tenantSlug: slug,
    });
  },

  registerWhatsappSender: async (slug: string, payload: Record<string, unknown> = {}): Promise<any> => {
    return apiFetch<any>(`/api/v2/tenants/${encodeURIComponent(slug)}/whatsapp/tech-provider/register-sender`, {
      method: "POST",
      body: payload,
      tenantSlug: slug,
    });
  },

  refreshWhatsappSenderStatus: async (slug: string): Promise<any> => {
    return apiFetch<any>(`/api/v2/tenants/${encodeURIComponent(slug)}/whatsapp/tech-provider/sender-status`, {
      method: "POST",
      tenantSlug: slug,
    });
  },

  runWhatsappTechProviderSmokeTest: async (slug: string, testId: string, payload: Record<string, unknown> = {}): Promise<any> => {
    return apiFetch<any>(`/api/v2/tenants/${encodeURIComponent(slug)}/whatsapp/tech-provider/smoke-test/${encodeURIComponent(testId)}`, {
      method: "POST",
      body: payload,
      tenantSlug: slug,
    });
  },

  // Public endpoints
  getPublicMenu: async (slug: string, channel: "widget" | "whatsapp" = "widget"): Promise<any> => {
    return apiFetch<any>(`${PUBLIC_BASE_URL}/${slug}/menu?channel=${channel}`);
  },

  getIntegrationEmbed: async (slug: string): Promise<any> => {
    return apiFetch<any>(`/api/portal/${slug}/integration`, { tenantSlug: slug });
  },

  getPlatformWidgetConfig: async (): Promise<any> => {
    return apiFetch<any>(`/api/public/widget-config`, {
      skipAuth: true,
      omitCredentials: true,
      isWidgetRequest: true,
      omitTenant: true,
      omitChatSessionId: true,
    });
  },

  getPublicWidgetConfig: async (slug: string): Promise<any> => {
    try {
      return await apiFetch<any>(`${PUBLIC_BASE_URL}/${slug}/widget-config`, {
        skipAuth: true,
        omitCredentials: true,
        isWidgetRequest: true,
        omitEntityToken: true,
        omitChatSessionId: true,
        persistTenantSlug: false,
        tenantSlug: slug,
      });
    } catch (error) {
      if (!(error instanceof ApiError) || ![404, 405, 501].includes(error.status)) {
        throw error;
      }
      return apiFetch<any>(`/api/public/widget-config?tenant=${encodeURIComponent(slug)}`, {
        skipAuth: true,
        omitCredentials: true,
        isWidgetRequest: true,
        omitEntityToken: true,
        omitChatSessionId: true,
        persistTenantSlug: false,
        tenantSlug: slug,
      });
    }
  }
};
