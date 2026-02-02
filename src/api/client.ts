import { apiFetch } from '@/utils/api';
import { Order, Cart, Ticket, PortalContent, IntegrationStatus, PortalLoyaltySummary } from '@/types/unified';
import { Tenant, CreateTenantDTO, UpdateTenantDTO } from '@/types/superAdmin';
import { WhatsappExternalNumberPayload, WhatsappNumberCreatePayload, WhatsappNumberInventoryItem, WhatsappNumberStatus } from '@/types/whatsapp';

/**
 * Standardized API Client for Tenant-Aware fetching.
 * All methods require an explicit tenantSlug to ensure context isolation.
 */
export const apiClient = {
  // Updated endpoints for Commerce module
  // Legacy generic methods for backward compatibility
  get: async <T>(url: string, options?: any): Promise<T> => {
    return apiFetch<T>(url, { method: 'GET', ...options });
  },
  post: async <T>(url: string, body?: any, options?: any): Promise<T> => {
    return apiFetch<T>(url, { method: 'POST', body, ...options });
  },
  put: async <T>(url: string, body?: any, options?: any): Promise<T> => {
    return apiFetch<T>(url, { method: 'PUT', body, ...options });
  },
  delete: async <T>(url: string, options?: any): Promise<T> => {
    return apiFetch<T>(url, { method: 'DELETE', ...options });
  },

  // --- Portal Methods ---

  getPortalContent: async (tenantSlug: string): Promise<PortalContent> => {
    return apiFetch<PortalContent>(`/api/v1/portal/${tenantSlug}/content`, { tenantSlug });
  },

  listOrders: async (tenantSlug: string): Promise<Order[]> => {
    return apiFetch<Order[]>(`/api/v1/portal/${tenantSlug}/orders`, { tenantSlug });
  },

  listTickets: async (tenantSlug: string): Promise<Ticket[]> => {
    return apiFetch<Ticket[]>(`/api/v1/portal/${tenantSlug}/tickets`, { tenantSlug });
  },

  getLoyalty: async (tenantSlug: string): Promise<PortalLoyaltySummary> => {
    return apiFetch<PortalLoyaltySummary>(`/api/v1/portal/${tenantSlug}/loyalty`, { tenantSlug });
  },

  redeemBenefit: async (tenantSlug: string, benefitId: string): Promise<any> => {
    return apiFetch<any>(`/api/v1/portal/${tenantSlug}/redeem`, {
      method: 'POST',
      body: { benefitId },
      tenantSlug,
    });
  },

  // --- Market Methods ---

  getCart: async (tenantSlug: string): Promise<Cart> => {
    return apiFetch<Cart>(`/api/market/${tenantSlug}/cart`, { tenantSlug });
  },

  addToCart: async (tenantSlug: string, productId: string | number, quantity: number): Promise<Cart> => {
    return apiFetch<Cart>(`/api/market/${tenantSlug}/cart/add`, {
      method: 'POST',
      body: { productId, quantity },
      tenantSlug,
    });
  },

  startCheckout: async (tenantSlug: string, payload: any): Promise<any> => {
    return apiFetch<any>(`/api/market/${tenantSlug}/checkout/start`, {
      method: 'POST',
      body: payload,
      tenantSlug,
    });
  },

  // --- Admin Methods ---

  adminListOrders: async (tenantSlug: string, filters?: Record<string, any>): Promise<Order[]> => {
    const params = new URLSearchParams(filters);
    // Guide: GET /api/orders (alias for admin order list)
    return apiFetch<Order[]>(`/api/orders?${params.toString()}`, { tenantSlug });
  },

  adminGetOrder: async (tenantSlug: string, orderId: string | number): Promise<Order> => {
     // Guide implies /api/orders/{id} or similar standard REST
    return apiFetch<Order>(`/api/orders/${orderId}`, { tenantSlug });
  },

  adminCreateOrder: async (tenantSlug: string, payload: any): Promise<Order> => {
    return apiFetch<Order>(`/api/orders`, {
      method: 'POST',
      body: payload,
      tenantSlug,
    });
  },

  adminGetIntegrations: async (tenantSlug: string): Promise<IntegrationStatus[]> => {
    // Backend might return Object { "MercadoLibre": {...} } OR Array [{ provider: 'mercadolibre', ... }]
    const rawData = await apiFetch<any>(`/api/admin/tenants/${tenantSlug}/integrations`, { tenantSlug });

    if (!rawData) return [];

    if (Array.isArray(rawData)) {
        return rawData.map((item) => ({
            provider: item.provider ? item.provider.toLowerCase() : 'unknown',
            connected: !!item.connected,
            lastSync: item.lastSync
        }));
    }

    return Object.entries(rawData).map(([provider, details]: [string, any]) => ({
      provider: provider.toLowerCase() as any,
      connected: details.connected,
      lastSync: details.lastSync
    }));
  },

  adminConnectIntegration: async (tenantSlug: string, type: string): Promise<{ url: string }> => {
    return apiFetch<{ url: string }>(`/api/admin/tenants/${tenantSlug}/integrations/${type}/connect`, { tenantSlug });
  },

  adminPreviewIntegration: async (tenantSlug: string, type: string): Promise<any> => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/integrations/${type}/preview`, { tenantSlug });
  },

  adminSyncIntegration: async (tenantSlug: string, type: string): Promise<any> => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/integrations/${type}/sync`, {
      method: 'POST',
      tenantSlug
    });
  },

  adminGetNotificationSettings: async (tenantSlug: string): Promise<any> => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/notifications`, { tenantSlug });
  },

  adminUpdateNotificationSettings: async (tenantSlug: string, settings: any): Promise<any> => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/notifications`, {
      method: 'PUT',
      body: settings,
      tenantSlug,
    });
  },

  adminGetTicketCategories: async (tenantSlug: string): Promise<any[]> => {
    return apiFetch<any[]>(`/api/admin/tenants/${tenantSlug}/ticket-categories`, { tenantSlug });
  },

  // Legacy import - to be replaced by Wizard
  adminImportCatalog: async (tenantSlug: string, formData: FormData): Promise<any> => {
    return apiFetch<any>(`/api/admin/catalogo/importar`, {
      method: 'POST',
      body: formData,
      tenantSlug,
      headers: {},
    });
  },

  // New Catalog Wizard API
  adminUploadCatalog: async (tenantSlug: string, payload: FormData | { file_url: string }): Promise<any> => {
    const isFormData = payload instanceof FormData;
    return apiFetch<any>('/api/catalog/upload', {
        method: 'POST',
        body: payload,
        tenantSlug,
        headers: isFormData ? {} : undefined // Let browser set multipart headers if FormData
    });
  },

  adminConfirmCatalog: async (tenantSlug: string, payload: { upload_token: string; mapping_override?: Record<string, string> }): Promise<any> => {
      return apiFetch<any>('/api/catalog/confirm', {
          method: 'POST',
          body: payload,
          tenantSlug
      });
  },

  adminListProducts: async (tenantSlug: string, filters?: Record<string, any>): Promise<any[]> => {
      const params = new URLSearchParams(filters);
      return apiFetch<any[]>(`/api/catalog?${params.toString()}`, {
          tenantSlug
      });
  },

  adminUpdateProduct: async (tenantSlug: string, productId: string | number, data: any): Promise<any> => {
      return apiFetch<any>(`/api/catalog/${productId}`, {
          method: 'PUT',
          body: data,
          tenantSlug
      });
  },

  adminGetCatalogSyncStatus: async (tenantSlug: string): Promise<{ status: string; progress: number; message?: string }> => {
    return apiFetch<{ status: string; progress: number; message?: string }>(`/api/pymes/${tenantSlug}/catalog-vector-sync/status`, { tenantSlug });
  },

  // --- Super Admin Methods ---

  superAdminListTenants: async (page = 1, perPage = 20): Promise<{ tenants: Tenant[], total: number }> => {
    return apiFetch<{ tenants: Tenant[], total: number }>(`/api/admin/tenants?page=${page}&per_page=${perPage}`);
  },

  superAdminCreateTenant: async (data: CreateTenantDTO): Promise<Tenant> => {
    return apiFetch<Tenant>('/api/admin/tenants', {
      method: 'POST',
      body: data,
    });
  },

  adminUpdateOrder: async (tenantSlug: string, orderId: string | number, data: { status: string }) => {
    // Guide: PATCH /api/orders/{order_id}
    return apiFetch<Order>(`/api/orders/${orderId}`, {
      method: 'PATCH',
      tenantSlug,
      body: data,
    });
  },

  superAdminGetTenant: async (slug: string): Promise<Tenant> => {
    return apiFetch<Tenant>(`/api/admin/tenants/${slug}`);
  },

  superAdminUpdateTenant: async (slug: string, data: UpdateTenantDTO): Promise<Tenant> => {
    return apiFetch<Tenant>(`/api/admin/tenants/${slug}`, {
      method: 'PUT',
      body: data,
    });
  },

  superAdminDeactivateTenant: async (slug: string): Promise<void> => {
    return apiFetch<void>(`/api/admin/tenants/${slug}`, {
      method: 'DELETE',
    });
  },

  superAdminPurgeTenant: async (slug: string, payload: { confirm: boolean; purge_users?: boolean }): Promise<any> => {
    return apiFetch<any>(`/api/admin/tenants/${slug}/purge`, {
      method: 'DELETE',
      body: payload,
    });
  },

  superAdminActivateTenant: async (slug: string): Promise<void> => {
    return apiFetch<void>(`/api/admin/tenants/${slug}/activate`, {
      method: 'POST',
    });
  },

  superAdminImpersonate: async (slug: string): Promise<{ token: string; redirect_url: string }> => {
    return apiFetch<{ token: string; redirect_url: string }>(`/api/admin/tenants/${slug}/impersonate`, {
      method: 'POST',
    });
  },

  // User & Integration Management
  superAdminCreateAdminUser: async (slug: string, payload: any): Promise<any> => {
    return apiFetch<any>(`/api/admin/tenants/${slug}/admin-user`, {
      method: 'POST',
      body: payload
    });
  },

  superAdminResetPassword: async (slug: string, payload: any): Promise<any> => {
    return apiFetch<any>(`/api/admin/tenants/${slug}/password`, {
      method: 'PUT',
      body: payload
    });
  },

  superAdminUpdateWhatsapp: async (slug: string, payload: any): Promise<any> => {
    return apiFetch<any>(`/api/admin/tenants/${slug}/whatsapp`, {
      method: 'PUT',
      body: payload
    });
  },

  superAdminListWhatsappNumbers: async (filters?: { status?: WhatsappNumberStatus; tenant_slug?: string; prefix?: string }): Promise<{ numbers: WhatsappNumberInventoryItem[]; total?: number }> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.tenant_slug) params.append('tenant_slug', filters.tenant_slug);
    if (filters?.prefix) params.append('prefix', filters.prefix);
    const suffix = params.toString();
    return apiFetch<{ numbers: WhatsappNumberInventoryItem[]; total?: number }>(`/api/admin/whatsapp/numbers${suffix ? `?${suffix}` : ''}`);
  },

  superAdminCreateWhatsappNumber: async (payload: WhatsappNumberCreatePayload): Promise<any> => {
    return apiFetch<any>('/api/admin/whatsapp/numbers', {
      method: 'POST',
      body: payload,
    });
  },

  superAdminReserveWhatsappNumber: async (payload: { number_id: string | number; tenant_slug?: string | null }): Promise<any> => {
    return apiFetch<any>('/api/admin/whatsapp/numbers/reserve', {
      method: 'POST',
      body: payload,
    });
  },

  superAdminReleaseWhatsappNumber: async (payload: { number_id: string | number }): Promise<any> => {
    return apiFetch<any>('/api/admin/whatsapp/numbers/release', {
      method: 'POST',
      body: payload,
    });
  },

  superAdminAssignWhatsappNumber: async (payload: { number_id: string | number; tenant_slug: string }): Promise<any> => {
    return apiFetch<any>('/api/admin/whatsapp/numbers/assign', {
      method: 'POST',
      body: payload,
    });
  },

  superAdminRegisterExternalWhatsappNumber: async (payload: WhatsappExternalNumberPayload): Promise<any> => {
    return apiFetch<any>('/api/admin/whatsapp/numbers/register', {
      method: 'POST',
      body: payload,
    });
  },

  // --- Widget & Theme Methods ---

  getChatTheme: async (tenantSlug: string): Promise<any> => {
    // Use the admin config endpoint which includes theme_config
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/config`, { tenantSlug });
  },

  updateChatTheme: async (tenantSlug: string, data: any): Promise<any> => {
    // Update the tenant config (merges with existing)
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/config`, {
      method: 'PUT',
      body: data,
      tenantSlug
    });
  },

  getFulfillmentConfig: async (tenantSlug: string): Promise<any> => {
    // New specialized endpoint for fulfillment settings
    return apiFetch<any>(`/api/fulfillment-config`, { tenantSlug });
  },

  updateFulfillmentConfig: async (tenantSlug: string, data: any): Promise<any> => {
     // The endpoint expects the simplified payload structure directly
     // Payload: { dispatch_email, dispatch_phone, send_buyer_email, ... }
    return apiFetch<any>(`/api/fulfillment-config`, {
      method: 'PUT',
      body: data,
      tenantSlug
    });
  },

  // --- CRM & Contact Methods ---

  adminListContacts: async (tenantSlug: string, filters?: Record<string, any>): Promise<any> => {
    const params = new URLSearchParams(filters);
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/contacts?${params.toString()}`, { tenantSlug });
  },

  adminGetContactHistory: async (tenantSlug: string, contactId: string): Promise<any> => {
    // Guide: GET /crm/contacts/{contact_id}
    return apiFetch<any>(`/crm/contacts/${contactId}`, { tenantSlug });
  },
};
