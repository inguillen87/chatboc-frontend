import { apiFetch } from '@/utils/api';
import { Order, Cart, Ticket, PortalContent, IntegrationStatus, PortalLoyaltySummary } from '@/types/unified';

/**
 * Standardized API Client for Tenant-Aware fetching.
 * All methods require an explicit tenantSlug to ensure context isolation.
 */
export const apiClient = {
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

  adminUpdateOrder: async (tenantSlug: string, orderId: string | number, status: string): Promise<Order> => {
    return apiFetch<Order>(`/api/admin/tenants/${tenantSlug}/orders/${orderId}`, {
      method: 'PUT',
      body: { status },
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
  }
};
