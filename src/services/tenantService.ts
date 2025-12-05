import { apiFetch } from "@/utils/api";
import { CreateTenantPayload, CreateTenantResponse, TenantConfigBundle } from "@/types/TenantConfig";

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

  // Public endpoints
  getPublicMenu: async (slug: string, channel: "widget" | "whatsapp" = "widget") => {
    return apiFetch(`${PUBLIC_BASE_URL}/${slug}/menu?channel=${channel}`);
  },

  getPublicWidgetConfig: async (slug: string) => {
    return apiFetch(`${PUBLIC_BASE_URL}/${slug}/widget-config`);
  }
};
