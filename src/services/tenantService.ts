import { apiFetch } from "@/utils/api";
import { CreateTenantPayload, CreateTenantResponse, TenantConfigBundle } from "@/types/TenantConfig";
import { WhatsappExternalNumberPayload, WhatsappNumberInventoryItem, WhatsappNumberRequestPayload } from "@/types/whatsapp";

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
    return apiFetch<{ numbers: WhatsappNumberInventoryItem[] }>(`${BASE_URL}/${slug}/whatsapp/numbers`);
  },

  assignWhatsappNumberFromInventory: async (slug: string, numberId: string | number): Promise<any> => {
    return apiFetch<any>(`${BASE_URL}/${slug}/whatsapp/numbers/${numberId}/assign`, {
      method: "POST",
    });
  },

  requestWhatsappNumber: async (slug: string, payload: WhatsappNumberRequestPayload): Promise<any> => {
    return apiFetch<any>(`${BASE_URL}/${slug}/whatsapp/numbers/request`, {
      method: "POST",
      body: payload,
    });
  },

  registerExternalWhatsappNumber: async (slug: string, payload: WhatsappExternalNumberPayload): Promise<any> => {
    return apiFetch<any>(`${BASE_URL}/${slug}/whatsapp/numbers/external`, {
      method: "POST",
      body: payload,
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
