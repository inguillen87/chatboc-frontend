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

  adminListOrders: async (tenantSlug: string): Promise<Order[]> => {
    return apiFetch<Order[]>(`/api/admin/tenants/${tenantSlug}/orders`, { tenantSlug });
  },

  adminCreateOrder: async (tenantSlug: string, payload: any): Promise<Order> => {
    return apiFetch<Order>(`/api/admin/tenants/${tenantSlug}/orders`, {
      method: 'POST',
      body: payload,
      tenantSlug,
    });
  },

  adminGetIntegrations: async (tenantSlug: string): Promise<IntegrationStatus[]> => {
    // Backend returns Object { "MercadoLibre": {...} }, we must transform to Array
    const rawData = await apiFetch<Record<string, any>>(`/api/admin/tenants/${tenantSlug}/integrations`, { tenantSlug });

    return Object.entries(rawData).map(([provider, details]) => ({
      provider: provider.toLowerCase() as any,
      connected: details.connected,
      lastSync: details.lastSync
    }));
  },

  adminConnectIntegration: async (tenantSlug: string, type: string): Promise<{ url: string }> => {
    return apiFetch<{ url: string }>(`/api/admin/tenants/${tenantSlug}/integrations/${type}/connect`, { tenantSlug });
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

  adminImportCatalog: async (tenantSlug: string, formData: FormData): Promise<any> => {
    // Note: apiFetch handles JSON body by default. For FormData, we need to handle it carefully or pass specific options.
    // However, apiFetch wrapper might try to JSON.stringify body.
    // Let's assume apiFetch detects FormData or we bypass it if needed.
    // Standard fetch with body=FormData works.
    // We'll use skipAuth if needed but here we need admin auth.
    return apiFetch<any>(`/api/admin/catalogo/importar`, {
      method: 'POST',
      body: formData,
      tenantSlug,
      // Headers for FormData are usually auto-set by browser (Content-Type: multipart/form-data; boundary=...)
      // If apiFetch sets Content-Type to application/json, we need to unset it.
      headers: {}, // Force empty headers to let browser set Content-Type
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

  adminUpdateOrder: async (tenantSlug: string, orderId: number, data: { status: string }) => {
    return apiFetch<Order>(`/api/admin/tenants/${tenantSlug}/orders/${orderId}`, {
      method: 'PUT',
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
};
