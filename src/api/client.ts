import { ApiError, apiFetch } from '@/utils/api';
import { Order, Cart, Ticket, PortalContent, IntegrationStatus, PortalLoyaltySummary, PortalPremiumBundle } from '@/types/unified';
import { Tenant, CreateTenantDTO, UpdateTenantDTO } from '@/types/superAdmin';
import { WhatsappExternalNumberPayload, WhatsappNumberCreatePayload, WhatsappNumberInventoryItem, WhatsappNumberStatus } from '@/types/whatsapp';
import { TenantCatalog } from '@/types/catalog';

export interface IdentityCoverageAlert {
  channel?: string;
  message?: string;
  coverage_pct?: number;
  current_pct?: number;
  target_pct?: number;
  gap_pct?: number;
  severity?: 'low' | 'medium' | 'high';
}

export interface IdentityCoverageResponse {
  contract_version?: string;
  tenant_id?: number | null;
  coverage_pct?: number;
  contact_key_coverage_pct?: number;
  conversation_id_coverage_pct?: number;
  combined_coverage_pct?: number;
  target_pct?: number;
  slo_status?: 'ok' | 'below_target';
  alert_count?: number;
  summary_message?: string;
  alerts?: IdentityCoverageAlert[];
}

export type IdentityCoverageTargetByChannel = string | Record<string, number>;

const asNumberOrUndefined = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const asStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

export const normalizeIdentityCoverageResponse = (value: unknown): IdentityCoverageResponse => {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const alertsRaw = Array.isArray(raw.alerts) ? raw.alerts : [];
  const alerts: IdentityCoverageAlert[] = alertsRaw
    .map((alert) => {
      const item = alert && typeof alert === 'object' ? (alert as Record<string, unknown>) : null;
      if (!item) return null;
      return {
        channel: asStringOrUndefined(item.channel),
        message: asStringOrUndefined(item.message),
        coverage_pct: asNumberOrUndefined(item.coverage_pct),
        current_pct: asNumberOrUndefined(item.current_pct),
        target_pct: asNumberOrUndefined(item.target_pct),
        gap_pct: asNumberOrUndefined(item.gap_pct),
        severity:
          item.severity === 'low' || item.severity === 'medium' || item.severity === 'high'
            ? item.severity
            : undefined,
      };
    })
    .filter((alert): alert is IdentityCoverageAlert => alert !== null);

  const normalizedSloStatus = raw.slo_status === 'ok' || raw.slo_status === 'below_target' ? raw.slo_status : undefined;

  return {
    contract_version: asStringOrUndefined(raw.contract_version),
    tenant_id:
      raw.tenant_id === null
        ? null
        : asNumberOrUndefined(raw.tenant_id),
    coverage_pct: asNumberOrUndefined(raw.coverage_pct),
    contact_key_coverage_pct: asNumberOrUndefined(raw.contact_key_coverage_pct),
    conversation_id_coverage_pct: asNumberOrUndefined(raw.conversation_id_coverage_pct),
    combined_coverage_pct: asNumberOrUndefined(raw.combined_coverage_pct),
    target_pct: asNumberOrUndefined(raw.target_pct),
    slo_status: normalizedSloStatus,
    alert_count: asNumberOrUndefined(raw.alert_count),
    summary_message: asStringOrUndefined(raw.summary_message),
    alerts,
  };
};

const serializeIdentityCoverageTargetByChannel = (
  targetByChannel?: IdentityCoverageTargetByChannel,
): string | null => {
  if (typeof targetByChannel === 'string') {
    const normalized = targetByChannel.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (!targetByChannel || typeof targetByChannel !== 'object') {
    return null;
  }

  const normalizedEntries = Object.entries(targetByChannel).filter(
    ([channel, target]) => typeof channel === 'string' && channel.trim().length > 0 && Number.isFinite(target),
  );

  if (!normalizedEntries.length) {
    return null;
  }

  return JSON.stringify(Object.fromEntries(normalizedEntries));
};

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

  getIdentityCoverage: async (
    tenantSlug: string,
    params?: {
      target_pct?: number;
      target_by_channel?: IdentityCoverageTargetByChannel;
      emit_alert_events?: 0 | 1;
    },
  ): Promise<IdentityCoverageResponse> => {
    const query = new URLSearchParams();
    if (typeof params?.target_pct === 'number') {
      query.set('target_pct', String(params.target_pct));
    }
    const targetByChannel = serializeIdentityCoverageTargetByChannel(params?.target_by_channel);
    if (targetByChannel) {
      query.set('target_by_channel', targetByChannel);
    }
    if (params?.emit_alert_events !== undefined) {
      query.set('emit_alert_events', String(params.emit_alert_events));
    }

    const suffix = query.toString() ? `?${query.toString()}` : '';
    try {
      const response = await apiFetch<unknown>(`/analytics/identity/coverage${suffix}`, { tenantSlug });
      return normalizeIdentityCoverageResponse(response);
    } catch (error) {
      const shouldFallbackToApiPrefix =
        error instanceof ApiError
          ? error.status === 404 || error.status === 405
          : true;

      if (!shouldFallbackToApiPrefix) {
        throw error;
      }

      const response = await apiFetch<unknown>(`/api/analytics/identity/coverage${suffix}`, { tenantSlug });
      return normalizeIdentityCoverageResponse(response);
    }
  },

  // --- Portal Methods ---

  getPortalContent: async (tenantSlug: string): Promise<PortalContent> => {
    return apiFetch<PortalContent>(`/api/v1/portal/${tenantSlug}/content`, { tenantSlug });
  },

  listOrders: async (tenantSlug: string): Promise<Order[]> => {
    return apiFetch<Order[]>(`/api/v1/portal/${tenantSlug}/orders`, { tenantSlug });
  },

  getOrderDetail: async (tenantSlug: string, orderId: string | number): Promise<Order> => {
    return apiFetch<Order>(`/api/v1/portal/${tenantSlug}/orders/${orderId}`, { tenantSlug });
  },

  getPortalHistory: async (tenantSlug: string, includeNetwork = false): Promise<any> => {
    const suffix = includeNetwork ? '?include_network=true' : '';
    return apiFetch<any>(`/api/v1/portal/${tenantSlug}/history${suffix}`, { tenantSlug });
  },

  getPortalSurveysHistory: async (tenantSlug: string, includeNetwork = false): Promise<any> => {
    const suffix = includeNetwork ? '?include_network=true' : '';
    return apiFetch<any>(`/api/v1/portal/${tenantSlug}/surveys/history${suffix}`, { tenantSlug });
  },

  getPortalDashboard: async (tenantSlug: string, includeNetwork = false): Promise<any> => {
    const suffix = includeNetwork ? '?include_network=true' : '';
    return apiFetch<any>(`/api/v1/portal/${tenantSlug}/dashboard${suffix}`, { tenantSlug });
  },

  getPortalPremiumBundle: async (tenantSlug: string): Promise<PortalPremiumBundle> => {
    try {
      return await apiFetch<PortalPremiumBundle>(`/api/v1/portal/${tenantSlug}/premium-bundle`, { tenantSlug });
    } catch (error) {
      return apiFetch<PortalPremiumBundle>(`/api/v1/portal/${tenantSlug}/dashboard-bundle`, { tenantSlug });
    }
  },

  getPortalNetworkFeed: async (tenantSlug: string): Promise<any> => {
    return apiFetch<any>(`/api/v1/portal/${tenantSlug}/network/feed`, { tenantSlug });
  },

  getPortalBenefits: async (tenantSlug: string): Promise<any> => {
    return apiFetch<any>(`/api/v1/portal/${tenantSlug}/benefits`, { tenantSlug });
  },

  listPortalRedeems: async (tenantSlug: string): Promise<any[]> => {
    return apiFetch<any[]>(`/api/v1/portal/${tenantSlug}/redeems`, { tenantSlug });
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

  adminGetFranchiseProfile: async (tenantSlug: string): Promise<any> => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/franchise-profile`, { tenantSlug });
  },

  adminUpdateFranchiseProfile: async (tenantSlug: string, payload: any): Promise<any> => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/franchise-profile`, {
      method: 'PUT',
      body: payload,
      tenantSlug,
    });
  },

  adminGetFranchiseReadiness: async (tenantSlug: string): Promise<any> => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/franchise-readiness`, { tenantSlug });
  },

  adminGetFranchisePlaybook: async (tenantSlug: string): Promise<any> => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/franchise-playbook`, { tenantSlug });
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

  adminUpdateImportPreview: async (tenantSlug: string, jobId: string, data: { rows: any[] }): Promise<any> => {
    return apiFetch<any>(`/api/catalog/import/${jobId}`, {
      method: "PUT",
      body: data,
      tenantSlug
    });
  },

  adminConfirmCatalog: async (tenantSlug: string, payload: { upload_token: string; mapping_override?: Record<string, string> }): Promise<any> => {
      return apiFetch<any>("/api/catalog/confirm", {
          method: "POST",
          body: payload,
          headers: { "Content-Type": "application/json" },
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

  adminGetCatalog: async (tenantSlug: string): Promise<TenantCatalog> => {
    return apiFetch<TenantCatalog>(`/api/admin/tenants/${tenantSlug}/catalog`, { tenantSlug });
  },

  adminUpdateCatalogItem: async (
    tenantSlug: string,
    itemId: string | number,
    payload: Record<string, unknown>,
  ): Promise<any> => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/catalog/items/${itemId}`, {
      method: "PATCH",
      body: payload,
      tenantSlug,
    });
  },

  adminUpdateCatalogDraft: async (tenantSlug: string, payload: any): Promise<TenantCatalog> => {
    return apiFetch<TenantCatalog>(`/api/admin/tenants/${tenantSlug}/catalog/draft`, {
      method: 'PUT',
      body: payload,
      tenantSlug,
    });
  },

  adminPublishCatalog: async (tenantSlug: string): Promise<TenantCatalog> => {
    return apiFetch<TenantCatalog>(`/api/admin/tenants/${tenantSlug}/catalog/publish`, {
      method: 'POST',
      tenantSlug,
    });
  },

  publicGetCatalog: async (tenantSlug: string): Promise<TenantCatalog> => {
    const data = await apiFetch<TenantCatalog | any[]>(`/api/public/tenants/${tenantSlug}/catalog`, {
      tenantSlug,
      isWidgetRequest: true,
      skipAuth: true,
      omitCredentials: true,
      omitEntityToken: true,
      omitChatSessionId: true,
    });
    if (Array.isArray(data)) {
      return { metadata: null, links: null, columns: [], rows: [] };
    }
    return data;
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
