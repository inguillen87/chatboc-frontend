import { ApiError, apiFetch } from "@/utils/api";
import { CreateTenantPayload, CreateTenantResponse, TenantConfigBundle } from "@/types/TenantConfig";
import { WhatsappExternalNumberPayload, WhatsappNumberCreatePayload, WhatsappNumberInventoryItem } from "@/types/whatsapp";

const BASE_URL = "/api/admin/tenants";
const PUBLIC_BASE_URL = "/api/public/tenants";

export const tenantService = {
  createTenant: async (payload: CreateTenantPayload): Promise<CreateTenantResponse> => {
    return apiFetch<CreateTenantResponse>(BASE_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getTenantConfig: async (slug: string): Promise<TenantConfigBundle> => {
    return apiFetch<TenantConfigBundle>(`${BASE_URL}/${slug}/config`);
  },

  updateTenantConfig: async (slug: string, payload: Partial<TenantConfigBundle>): Promise<TenantConfigBundle> => {
    return apiFetch<TenantConfigBundle>(`${BASE_URL}/${slug}/config`, {
      method: "PUT",
      body: JSON.stringify(payload),
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
    return apiFetch<any>(`/api/v2/tenants/${encodeURIComponent(slug)}/whatsapp/tech-provider`, {
      tenantSlug: slug,
    });
  },

  provisionWhatsappTechProvider: async (slug: string, payload: Record<string, unknown> = {}): Promise<any> => {
    return apiFetch<any>(`/api/v2/tenants/${encodeURIComponent(slug)}/whatsapp/tech-provider/provision`, {
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

  // Public endpoints
  getPublicMenu: async (slug: string, channel: "widget" | "whatsapp" = "widget") => {
    return apiFetch(`${PUBLIC_BASE_URL}/${slug}/menu?channel=${channel}`);
  },

  getIntegrationEmbed: async (slug: string) => {
    return apiFetch(`/api/portal/${slug}/integration`, { tenantSlug: slug });
  },

  getPlatformWidgetConfig: async () => {
    return apiFetch(`/api/public/widget-config`, {
      skipAuth: true,
      omitCredentials: true,
      isWidgetRequest: true,
      omitTenant: true,
      omitChatSessionId: true,
    });
  },

  getPublicWidgetConfig: async (slug: string) => {
    try {
      return await apiFetch(`${PUBLIC_BASE_URL}/${slug}/widget-config`, {
        skipAuth: true,
        omitCredentials: true,
        isWidgetRequest: true,
        tenantSlug: slug,
      });
    } catch (error) {
      if (!(error instanceof ApiError) || ![404, 405, 501].includes(error.status)) {
        throw error;
      }
      return apiFetch(`/api/public/widget-config?tenant=${encodeURIComponent(slug)}`, {
        skipAuth: true,
        omitCredentials: true,
        isWidgetRequest: true,
        tenantSlug: slug,
      });
    }
  }
};
