import { ApiError, apiFetch } from '@/utils/api';
import { SAME_ORIGIN_PROXY_BASE } from '@/config';
import { assertOrderReceipt } from '@/features/orders/orderLifecycle';
import {
  AdminOrdersResponse,
  Order,
  Cart,
  PortalContent,
  IntegrationStatus,
  PortalLoyaltySummary,
  PortalPremiumBundle,
  OrderOperationalSummary,
} from '@/types/unified';
import { Tenant, CreateTenantDTO, UpdateTenantDTO } from '@/types/superAdmin';
import { WhatsappExternalNumberPayload, WhatsappNumberCreatePayload, WhatsappNumberInventoryItem, WhatsappNumberStatus } from '@/types/whatsapp';
import { CatalogPromotion, TenantCatalog } from '@/types/catalog';
import { TENANT_PLACEHOLDER_SLUGS } from '@/constants/tenant';
import {
  parseIdentityCoverageResponseV1,
  type IdentityCoverageResponseV1 as IdentityCoverageResponse,
} from '@/services/identityCoverageContract';


export type IdentityCoverageTargetByChannel = string | Record<string, number>;

export interface PortalClaim {
  id: string;
  title: string;
  description: string | null;
  status: string;
  date: string | null;
  updated_at: string | null;
}

const SAME_ORIGIN_API_BASE = SAME_ORIGIN_PROXY_BASE || '/api';

interface WidgetTokenRequestPayload {
  tenant_id?: number;
  tenant_slug?: string;
  widget_token?: string;
  contact_key?: string;
  conversation_id?: string;
}

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const normalizeAdminOrderItem = (value: unknown, index: number) => {
  const record = isRecord(value) ? value : {};
  const quantity = asNumberOrUndefined(record.quantity ?? record.cantidad) ?? 1;
  const price = asNumberOrUndefined(record.price ?? record.unit_price ?? record.precio_float ?? record.precio) ?? 0;
  const name =
    asStringOrUndefined(record.name) ||
    asStringOrUndefined(record.title) ||
    asStringOrUndefined(record.nombre) ||
    asStringOrUndefined(record.sku) ||
    `Articulo ${index + 1}`;

  return {
    ...record,
    id: record.id ?? record.product_id ?? record.catalogo_item_id ?? `item-${index + 1}`,
    product_id: record.product_id ?? record.catalogo_item_id ?? record.id ?? null,
    name,
    title: asStringOrUndefined(record.title) || name,
    quantity,
    price,
    unit_price: asNumberOrUndefined(record.unit_price) ?? price,
    subtotal: asNumberOrUndefined(record.subtotal) ?? price * quantity,
    sku: asStringOrUndefined(record.sku),
    currency: asStringOrUndefined(record.currency ?? record.currency_id) || 'ARS',
  };
};

const normalizeAdminOrder = (value: unknown): Order => {
  const record = isRecord(value) ? value : {};
  const totals = isRecord(record.totals) ? record.totals : {};
  const items = asArray(record.items).map((item, index) => normalizeAdminOrderItem(item, index));
  const total =
    asNumberOrUndefined(record.total) ??
    asNumberOrUndefined(totals.monetary) ??
    asNumberOrUndefined(totals.total) ??
    items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);

  return {
    ...(record as Record<string, unknown>),
    id: (record.id as string | number | undefined) ?? (record.source_id as string | number | undefined) ?? 'order',
    total,
    status: asStringOrUndefined(record.status) || '',
    items,
    created_at: asStringOrUndefined(record.created_at) || '',
    updated_at: asStringOrUndefined(record.updated_at),
    channel: asStringOrUndefined(record.channel),
    notes: asStringOrUndefined(record.notes),
    customerName: asStringOrUndefined(record.customerName ?? record.contact_name),
    customerPhone: asStringOrUndefined(record.customerPhone ?? record.contact_phone),
    customerEmail: asStringOrUndefined(record.customerEmail ?? record.contact_email),
    totals: isRecord(record.totals) ? (record.totals as Order['totals']) : null,
    assisted_request: isRecord(record.assisted_request) ? (record.assisted_request as Order['assisted_request']) : null,
    crm_review_card: isRecord(record.crm_review_card) ? (record.crm_review_card as Order['crm_review_card']) : null,
    metadata: isRecord(record.metadata) ? (record.metadata as Record<string, unknown>) : null,
  } as Order;
};

const normalizeAdminOrdersResponse = (raw: unknown): Order[] => {
  const candidate = Array.isArray(raw)
    ? raw
    : isRecord(raw)
      ? raw.orders ?? raw.results ?? raw.data ?? raw.items
      : [];

  return asArray(candidate).map(normalizeAdminOrder);
};

const normalizeAdminOrdersEnvelope = (raw: unknown): AdminOrdersResponse => {
  const record = isRecord(raw) ? raw : {};
  const orders = normalizeAdminOrdersResponse(raw);
  const sources = asArray(record.sources)
    .map(asStringOrUndefined)
    .filter((source): source is string => Boolean(source));
  const summary = isRecord(record.summary) ? (record.summary as OrderOperationalSummary) : null;

  return {
    orders,
    count: asNumberOrUndefined(record.count) ?? orders.length,
    total: asNumberOrUndefined(record.total) ?? orders.length,
    sources,
    summary,
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

const normalizeWidgetBootstrapResponse = (value: unknown) => {
  if (!isRecord(value)) throw new ApiError('Widget bootstrap inválido', 502, value);
  if (value.contract_version !== 'auth.widget_bootstrap.v1') {
    throw new ApiError('Widget bootstrap inválido: contract_version', 502, value);
  }

  const tenant = isRecord(value.tenant) ? value.tenant : null;
  const widget = isRecord(value.widget) ? value.widget : null;
  const jwks = isRecord(value.jwks) ? value.jwks : {};
  const tenantId = asNumberOrUndefined(tenant?.id);
  const tenantSlug = asStringOrUndefined(tenant?.slug);
  const tokenCookieName = asStringOrUndefined(widget?.token_cookie_name);
  const accessMinutes = asNumberOrUndefined(widget?.access_minutes);
  const renewDays = asNumberOrUndefined(widget?.renew_days);

  if (!tenant || !widget || tenantId === undefined || !tenantSlug || !tokenCookieName || accessMinutes === undefined || renewDays === undefined) {
    throw new ApiError('Widget bootstrap inválido: payload incompleto', 502, value);
  }

  return {
    contract_version: 'auth.widget_bootstrap.v1' as const,
    tenant: { id: tenantId, slug: tenantSlug },
    widget: { token_cookie_name: tokenCookieName, access_minutes: accessMinutes, renew_days: renewDays },
    jwks: {
      url: asStringOrUndefined(jwks.url),
      alg: asStringOrUndefined(jwks.alg),
      kid: asStringOrUndefined(jwks.kid),
    },
  };
};

const normalizeWidgetTokenAck = (value: unknown) => {
  if (!isRecord(value)) throw new ApiError('Widget token ack inválido', 502, value);
  if (value.contract_version !== 'auth.widget_token.v1') {
    throw new ApiError('Widget token ack inválido: contract_version', 502, value);
  }
  const token = asStringOrUndefined(value.token);
  const expiresIn = asNumberOrUndefined(value.expires_in);
  if (!token || expiresIn === undefined) {
    throw new ApiError('Widget token ack inválido: payload incompleto', 502, value);
  }
  return {
    contract_version: 'auth.widget_token.v1' as const,
    token,
    expires_in: expiresIn,
  };
};

const shouldFallbackToLegacyWidgetAuth = (error: unknown) =>
  error instanceof ApiError && (error.status === 404 || error.status === 405 || error.status === 501);

const shouldFallbackToLegacyEndpoint = (error: unknown) =>
  error instanceof ApiError && (error.status === 404 || error.status === 405 || error.status === 501);

const callWidgetAuthEndpoint = async <T>(
  primaryPath: string,
  legacyPath: string,
  options: NonNullable<Parameters<typeof apiFetch>[1]>,
): Promise<T> => {
  try {
    return await apiFetch<T>(primaryPath, options);
  } catch (error) {
    if (!shouldFallbackToLegacyWidgetAuth(error)) {
      throw error;
    }
    return apiFetch<T>(legacyPath, options);
  }
};

const normalizeNotificationSettingsResponse = (value: unknown) => {
  if (!isRecord(value)) return value;

  const rawPreferences = value.preferences ?? value.notification_settings ?? value.settings ?? {};
  const deliveryConfig = isRecord(value.delivery_config) ? value.delivery_config : {};
  const notificationSettings: Record<string, unknown> = {};

  if (Array.isArray(rawPreferences)) {
    rawPreferences.forEach((item) => {
      if (!isRecord(item)) return;
      const key =
        asStringOrUndefined(item.key) ??
        asStringOrUndefined(item.id) ??
        asStringOrUndefined(item.channel) ??
        asStringOrUndefined(item.name);
      if (!key) return;
      notificationSettings[key] =
        typeof item.enabled === 'boolean'
          ? item.enabled
          : typeof item.active === 'boolean'
            ? item.active
            : item.value;
    });
  } else if (isRecord(rawPreferences)) {
    Object.entries(rawPreferences).forEach(([key, item]) => {
      if (isRecord(item)) {
        notificationSettings[key] =
          typeof item.enabled === 'boolean'
            ? item.enabled
            : typeof item.active === 'boolean'
              ? item.active
              : item.value;
      } else {
        notificationSettings[key] = item;
      }
    });
  }

  return {
    ...value,
    owner_phone:
      asStringOrUndefined(value.owner_phone) ??
      asStringOrUndefined(deliveryConfig.owner_phone) ??
      asStringOrUndefined(deliveryConfig.whatsapp_phone),
    telegram_chat_id:
      asStringOrUndefined(value.telegram_chat_id) ??
      asStringOrUndefined(deliveryConfig.telegram_chat_id),
    notification_settings: {
      ...(isRecord(value.notification_settings) ? value.notification_settings : {}),
      ...notificationSettings,
    },
  };
};

const normalizePublicTicketStatus = (value: unknown) => {
  if (!isRecord(value)) throw new ApiError('Public ticket status inválido', 502, value);
  if (value.contract_version !== 'tickets.public_status.v1') {
    throw new ApiError('Public ticket status inválido: contract_version', 502, value);
  }
  const request_id = asStringOrUndefined(value.request_id);
  if (!request_id) {
    throw new ApiError('Public ticket status inválido: request_id requerido', 502, value);
  }
  const payloadError = isRecord(value.error)
    ? {
        code: asNumberOrUndefined(value.error.code) ?? 0,
        message: asStringOrUndefined(value.error.message) ?? 'Error desconocido',
      }
    : undefined;
  const ticket = isRecord(value.ticket) ? value.ticket : null;
  const nro_ticket = asStringOrUndefined(ticket?.nro_ticket);
  const estado = asStringOrUndefined(ticket?.estado);
  if ((!ticket || !nro_ticket || !estado) && !payloadError) {
    throw new ApiError('Public ticket status inválido: payload incompleto', 502, value);
  }
  return {
    contract_version: 'tickets.public_status.v1' as const,
    request_id,
    error: payloadError,
    ticket:
      ticket && nro_ticket && estado
        ? {
            nro_ticket,
            estado,
            categoria: asStringOrUndefined(ticket.categoria),
            subcategoria: asStringOrUndefined(ticket.subcategoria),
            canal_ingreso: asStringOrUndefined(ticket.canal_ingreso),
            fecha_creacion: ticket.fecha_creacion === null ? null : asStringOrUndefined(ticket.fecha_creacion),
            ultima_actualizacion: ticket.ultima_actualizacion === null ? null : asStringOrUndefined(ticket.ultima_actualizacion),
          }
        : undefined,
  };
};

const normalizePublicCatalogResponse = (value: unknown): TenantCatalog => {
  if (Array.isArray(value)) {
    return { metadata: null, links: null, columns: [], rows: [] };
  }

  if (!isRecord(value)) {
    return { metadata: null, links: null, columns: [], rows: [] };
  }

  const contractVersion = asStringOrUndefined(value.contract_version);
  if (
    contractVersion === 'public.catalog_resolution.v1' ||
    contractVersion === 'public.reserved_slug.v1'
  ) {
    const rawItems = Array.isArray(value.items) ? value.items : [];
    return {
      ...(value as TenantCatalog),
      contract_version: contractVersion,
      request_id: asStringOrUndefined(value.request_id) ?? null,
      reason_code: asStringOrUndefined(value.reason_code) ?? null,
      action_hint: asStringOrUndefined(value.action_hint) ?? null,
      message: asStringOrUndefined(value.message) ?? null,
      items: rawItems,
      cart: isRecord(value.cart) ? (value.cart as TenantCatalog['cart']) : { enabled: false },
      metadata: isRecord(value.metadata) ? (value.metadata as TenantCatalog['metadata']) : null,
      links: isRecord(value.links) ? (value.links as TenantCatalog['links']) : null,
      columns: [],
      rows: [],
    };
  }

  return value as TenantCatalog;
};

const normalizeTicketWorkflowMetadata = (value: unknown) => {
  if (!isRecord(value)) throw new ApiError('Ticket workflow metadata inválido', 502, value);
  if (value.contract_version !== 'tickets.workflow.v1') {
    throw new ApiError('Ticket workflow metadata inválido: contract_version', 502, value);
  }
  const requestId = asStringOrUndefined(value.request_id);
  if (!requestId) {
    throw new ApiError('Ticket workflow metadata inválido: request_id requerido', 502, value);
  }
  const statesRaw = Array.isArray(value.states) ? value.states : [];
  const states = statesRaw
    .map((state) => {
      if (typeof state === 'string') {
        const normalized = state.trim().toLowerCase();
        return normalized || null;
      }
      if (!isRecord(state)) return null;
      const fromKey = asStringOrUndefined(state.key);
      const fromName = asStringOrUndefined(state.name);
      const normalized = (fromKey ?? fromName ?? '').trim().toLowerCase();
      return normalized || null;
    })
    .filter((state): state is string => state !== null);

  if (states.length === 0) {
    throw new ApiError('Ticket workflow metadata inválido: states vacío', 502, value);
  }

  const transitionsRaw = isRecord(value.transitions) ? value.transitions : {};
  const transitions = Object.fromEntries(
    Object.entries(transitionsRaw).map(([from, toList]) => {
      const fromState = from.trim().toLowerCase();
      const normalizedTargets = (Array.isArray(toList) ? toList : [])
        .map((toState) => (typeof toState === 'string' ? toState.trim().toLowerCase() : ''))
        .filter(Boolean);
      return [fromState, normalizedTargets];
    }),
  );

  const finalStates = (Array.isArray(value.final_states) ? value.final_states : [])
    .map((state) => (typeof state === 'string' ? state.trim().toLowerCase() : ''))
    .filter(Boolean);

  return {
    contract_version: 'tickets.workflow.v1' as const,
    request_id: requestId,
    tenant_id: value.tenant_id === null ? null : asNumberOrUndefined(value.tenant_id),
    states,
    transitions,
    final_states: finalStates,
  };
};

/**
 * Standardized API Client for Tenant-Aware fetching.
 * All methods require an explicit tenantSlug to ensure context isolation.
 */
export interface IntegrationConnectResponse {
  url?: string | null;
  redirect_url?: string | null;
  provider?: string | null;
  status?: string | null;
  error?: string | null;
  reason_code?: string | null;
  missing?: string[] | null;
  contract?: Record<string, unknown> | null;
  setup_health?: Record<string, unknown> | null;
  frontend_contract?: {
    render_as?: string | null;
    mode?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

const INTEGRATION_PROVIDER_ALIASES: Record<string, IntegrationStatus['provider']> = {
  mercadolibre: 'mercadolibre',
  mercado_libre: 'mercadolibre',
  'mercado libre': 'mercadolibre',
  tiendanube: 'tiendanube',
  tienda_nube: 'tiendanube',
  'tienda nube': 'tiendanube',
  whatsapp: 'whatsapp',
  whats_app: 'whatsapp',
  'whats app': 'whatsapp',
  'whatsapp business': 'whatsapp',
  mercadopago: 'mercadopago',
  mercado_pago: 'mercadopago',
  'mercado pago': 'mercadopago',
};

const normalizeIntegrationProvider = (value: unknown): IntegrationStatus['provider'] | null => {
  if (typeof value !== 'string') return null;
  const raw = value.trim().toLowerCase();
  const normalized = raw.replace(/[-\s]+/g, '_');
  return INTEGRATION_PROVIDER_ALIASES[normalized] ?? INTEGRATION_PROVIDER_ALIASES[raw] ?? null;
};

const normalizeIntegrationConnected = (details: any): boolean => {
  if (typeof details?.connected === 'boolean') return details.connected;
  if (typeof details?.is_connected === 'boolean') return details.is_connected;
  if (typeof details?.enabled === 'boolean') return details.enabled;
  if (typeof details?.active === 'boolean') return details.active;
  if (typeof details?.status === 'string') {
    return ['active', 'connected', 'enabled', 'ready', 'configured', 'ok'].includes(details.status.trim().toLowerCase());
  }
  return false;
};

const normalizeIntegrationLastSync = (details: any): string | undefined =>
  details?.lastSync ?? details?.last_sync ?? details?.last_sync_at ?? details?.updated_at ?? undefined;

export const apiClient = {
  // Updated endpoints for Commerce module
  // Legacy generic methods for backward compatibility
  get: async <T>(url: string, options?: Omit<NonNullable<Parameters<typeof apiFetch>[1]>, 'method'>): Promise<T> => {
    return apiFetch<T>(url, { method: 'GET', ...options });
  },
  post: async <T, TBody = unknown>(
    url: string,
    body?: TBody,
    options?: Omit<NonNullable<Parameters<typeof apiFetch>[1]>, 'method' | 'body'>,
  ): Promise<T> => {
    return apiFetch<T>(url, { method: 'POST', body, ...options });
  },
  put: async <T, TBody = unknown>(
    url: string,
    body?: TBody,
    options?: Omit<NonNullable<Parameters<typeof apiFetch>[1]>, 'method' | 'body'>,
  ): Promise<T> => {
    return apiFetch<T>(url, { method: 'PUT', body, ...options });
  },
  delete: async <T>(url: string, options?: Omit<NonNullable<Parameters<typeof apiFetch>[1]>, 'method'>): Promise<T> => {
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
    const buildSuffix = (input?: {
      target_pct?: number;
      target_by_channel?: IdentityCoverageTargetByChannel;
      emit_alert_events?: 0 | 1;
    }) => {
      const query = new URLSearchParams();
      if (typeof input?.target_pct === 'number') {
        query.set('target_pct', String(input.target_pct));
      }
      const targetByChannel = serializeIdentityCoverageTargetByChannel(input?.target_by_channel);
      if (targetByChannel) {
        query.set('target_by_channel', targetByChannel);
      }
      if (input?.emit_alert_events !== undefined) {
        query.set('emit_alert_events', String(input.emit_alert_events));
      }
      return query.toString() ? `?${query.toString()}` : '';
    };

    const suffix = buildSuffix(params);
    const requestOptions = { tenantSlug, baseUrlOverride: SAME_ORIGIN_API_BASE };
    try {
      const response = await apiFetch<unknown>(`/analytics/identity/coverage${suffix}`, requestOptions);
      const parsed = parseIdentityCoverageResponseV1(response);
      if (!parsed) throw new ApiError('Respuesta inválida de identity coverage: contract_version o payload inválido.', 502, response);
      return parsed;
    } catch (error) {
      if (params?.emit_alert_events === 1 && error instanceof ApiError && error.status === 403) {
        const readOnlySuffix = buildSuffix(params ? { target_pct: params.target_pct, target_by_channel: params.target_by_channel } : undefined);
        const response = await apiFetch<unknown>(`/analytics/identity/coverage${readOnlySuffix}`, requestOptions);
        const parsed = parseIdentityCoverageResponseV1(response);
        if (!parsed) throw new ApiError('Respuesta inválida de identity coverage: contract_version o payload inválido.', 502, response);
        return parsed;
      }

      const shouldFallbackToApiPrefix =
        error instanceof ApiError
          ? error.status === 404 || error.status === 405
          : true;

      if (!shouldFallbackToApiPrefix) {
        throw error;
      }

      try {
        const response = await apiFetch<unknown>(`/api/analytics/identity/coverage${suffix}`, requestOptions);
        const parsed = parseIdentityCoverageResponseV1(response);
        if (!parsed) throw new ApiError('Respuesta inválida de identity coverage: contract_version o payload inválido.', 502, response);
        return parsed;
      } catch (fallbackError) {
        if (params?.emit_alert_events === 1 && fallbackError instanceof ApiError && fallbackError.status === 403) {
          const readOnlySuffix = buildSuffix(params ? { target_pct: params.target_pct, target_by_channel: params.target_by_channel } : undefined);
          const response = await apiFetch<unknown>(`/api/analytics/identity/coverage${readOnlySuffix}`, requestOptions);
          const parsed = parseIdentityCoverageResponseV1(response);
          if (!parsed) throw new ApiError('Respuesta inválida de identity coverage: contract_version o payload inválido.', 502, response);
          return parsed;
        }
        throw fallbackError;
      }
    }
  },

  getWidgetBootstrap: async (tenantSlug: string) => {
    const response = await apiFetch<unknown>('/auth/widget/bootstrap', { tenantSlug });
    return normalizeWidgetBootstrapResponse(response);
  },

  createWidgetToken: async (tenantSlug: string, payload: WidgetTokenRequestPayload) => {
    const response = await callWidgetAuthEndpoint<unknown>('/auth/widget/token', '/auth/widget-token', {
      method: 'POST',
      tenantSlug,
      body: payload,
    });
    return normalizeWidgetTokenAck(response);
  },

  refreshWidgetToken: async (tenantSlug: string, payload: WidgetTokenRequestPayload) => {
    const response = await callWidgetAuthEndpoint<unknown>('/auth/widget/refresh', '/auth/widget-refresh', {
      method: 'POST',
      tenantSlug,
      body: payload,
    });
    return normalizeWidgetTokenAck(response);
  },

  getPublicTicketStatus: async (code: string, pin: string, tenantSlug?: string) => {
    const query = new URLSearchParams({ code, pin }).toString();
    const response = await apiFetch<unknown>(`/api/tickets/public/status?${query}`, { tenantSlug });
    return normalizePublicTicketStatus(response);
  },

  getTicketWorkflowMetadata: async (tenantSlug?: string) => {
    const response = await apiFetch<unknown>('/api/tickets/workflow/metadata', {
      tenantSlug,
      suppressPanel401Redirect: true,
      omitCredentials: true,
      omitChatSessionId: true,
    });
    return normalizeTicketWorkflowMetadata(response);
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

  listClaims: async (tenantSlug: string): Promise<PortalClaim[]> => {
    return apiFetch<PortalClaim[]>(`/api/v1/portal/${tenantSlug}/claims`, { tenantSlug });
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
  // --- Admin Methods ---

  adminListOrders: async (tenantSlug: string, filters?: Record<string, any>): Promise<Order[]> => {
    const response = await apiClient.adminListOrdersWithSummary(tenantSlug, filters);
    return response.orders;
  },

  adminListOrdersWithSummary: async (tenantSlug: string, filters?: Record<string, any>): Promise<AdminOrdersResponse> => {
    const normalizedFilters = { ...(filters || {}) };
    if (String(normalizedFilters.status || '').toLowerCase() === 'all') {
      delete normalizedFilters.status;
    }
    const params = new URLSearchParams(normalizedFilters);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const raw = await apiFetch<unknown>(`/api/admin/tenants/${tenantSlug}/orders${suffix}`, { tenantSlug });
    return normalizeAdminOrdersEnvelope(raw);
  },

  adminGetOrder: async (tenantSlug: string, orderId: string | number): Promise<Order> => {
    const encodedId = encodeURIComponent(String(orderId));
    const raw = await apiFetch<unknown>(`/api/admin/tenants/${tenantSlug}/orders/${encodedId}`, { tenantSlug });
    // Validate the transport receipt before display defaults can disguise a missing identity or state.
    assertOrderReceipt(raw, String(orderId), undefined, tenantSlug);
    return normalizeAdminOrder(raw);
  },

  adminCreateOrder: async (tenantSlug: string, payload: any): Promise<Order> => {
    return apiFetch<Order>(`/api/orders`, {
      method: 'POST',
      body: payload,
      tenantSlug,
    });
  },

  adminGetIntegrations: async (tenantSlug: string): Promise<IntegrationStatus[]> => {
    // Backend might return Object { "MercadoLibre": {...} } OR Array [{ type: 'WhatsApp', ... }]
    const rawData = await apiFetch<any>(`/api/admin/tenants/${tenantSlug}/integrations`, { tenantSlug });

    if (!rawData) return [];

    if (Array.isArray(rawData)) {
      return rawData
        .map((item): IntegrationStatus | null => {
          const provider = normalizeIntegrationProvider(
            item?.provider ?? item?.type ?? item?.integration_type ?? item?.channel,
          );
          if (!provider) return null;
          return {
            provider,
            connected: normalizeIntegrationConnected(item),
            lastSync: normalizeIntegrationLastSync(item),
          };
        })
        .filter((item): item is IntegrationStatus => item !== null);
    }

    return Object.entries(rawData)
      .map(([providerKey, details]: [string, any]): IntegrationStatus | null => {
        const provider = normalizeIntegrationProvider(
          details?.provider ?? details?.type ?? details?.integration_type ?? details?.channel ?? providerKey,
        );
        if (!provider) return null;
        return {
          provider,
          connected: normalizeIntegrationConnected(details),
          lastSync: normalizeIntegrationLastSync(details),
        };
      })
      .filter((item): item is IntegrationStatus => item !== null);
  },

  adminConnectIntegration: async (tenantSlug: string, type: string): Promise<IntegrationConnectResponse> => {
    return apiFetch<IntegrationConnectResponse>(`/api/admin/tenants/${tenantSlug}/integrations/${type}/connect`, { tenantSlug });
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

  adminGetMercadoPagoCredentials: async (tenantSlug: string): Promise<any> => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/integrations/mercadopago`, { tenantSlug });
  },

  adminSetMercadoPagoCredentials: async (tenantSlug: string, accessToken: string): Promise<any> => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/integrations/mercadopago`, {
      method: 'POST',
      body: { access_token: accessToken },
      tenantSlug,
    });
  },

  adminTestMercadoPagoCredentials: async (tenantSlug: string): Promise<any> => {
    return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/integrations/mercadopago/test`, {
      method: 'POST',
      tenantSlug,
    });
  },

  adminGetNotificationSettings: async (tenantSlug: string): Promise<any> => {
    try {
      const response = await apiFetch<any>('/api/v2/notifications/hooks', { tenantSlug });
      return normalizeNotificationSettingsResponse(response);
    } catch (error) {
      if (!shouldFallbackToLegacyEndpoint(error)) throw error;
      return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/notifications`, { tenantSlug });
    }
  },

  adminUpdateNotificationSettings: async (tenantSlug: string, settings: any): Promise<any> => {
    try {
      const response = await apiFetch<any>('/api/v2/notifications/hooks', {
        method: 'POST',
        body: {
          preferences: settings?.notification_settings ?? settings?.preferences ?? {},
          delivery_config: {
            owner_phone: settings?.owner_phone,
            telegram_chat_id: settings?.telegram_chat_id,
          },
          legacy_payload: settings,
        },
        tenantSlug,
      });
      return normalizeNotificationSettingsResponse(response);
    } catch (error) {
      if (!shouldFallbackToLegacyEndpoint(error)) throw error;
      return apiFetch<any>(`/api/admin/tenants/${tenantSlug}/notifications`, {
        method: 'PUT',
        body: settings,
        tenantSlug,
      });
    }
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

  adminCreateCatalogImport: async (
    tenantSlug: string,
    payload: FormData | Record<string, unknown>,
  ): Promise<any> => {
    const isFormData = payload instanceof FormData;
    if (isFormData) {
      if (!payload.has('tenant_slug')) payload.append('tenant_slug', tenantSlug);
      if (!payload.has('source')) payload.append('source', 'admin_upload');
    }
    return apiFetch<any>('/api/admin/catalog/import', {
      method: 'POST',
      body: isFormData ? payload : { tenant_slug: tenantSlug, source: 'admin_upload', ...payload },
      tenantSlug,
      headers: isFormData ? {} : undefined,
    });
  },

  adminGetCatalogImport: async (tenantSlug: string, uploadId: string | number): Promise<any> => {
    return apiFetch<any>(`/api/admin/catalog/import/${encodeURIComponent(String(uploadId))}`, { tenantSlug });
  },

  adminUpdateCatalogImport: async (
    tenantSlug: string,
    uploadId: string | number,
    payload: Record<string, unknown>,
  ): Promise<any> => {
    return apiFetch<any>(`/api/admin/catalog/import/${encodeURIComponent(String(uploadId))}`, {
      method: 'PUT',
      body: { tenant_slug: tenantSlug, ...payload },
      tenantSlug,
    });
  },

  adminCommitCatalogImport: async (
    tenantSlug: string,
    uploadId: string | number,
    payload: Record<string, unknown> = {},
  ): Promise<any> => {
    return apiFetch<any>(`/api/admin/catalog/import/${encodeURIComponent(String(uploadId))}/commit`, {
      method: 'POST',
      body: { tenant_slug: tenantSlug, ...payload },
      tenantSlug,
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
      const query = params.toString();
      return apiFetch<any[]>(
        `/api/admin/tenants/${encodeURIComponent(tenantSlug)}/catalog/items${query ? `?${query}` : ''}`,
        {
          tenantSlug
        },
      );
  },

  adminUpdateProduct: async (tenantSlug: string, productId: string | number, data: any): Promise<any> => {
      return apiFetch<any>(`/api/catalog/${productId}`, {
          method: 'PUT',
          body: data,
          tenantSlug
      });
  },

  adminUpdateProductImages: async (
    tenantSlug: string,
    productId: string | number,
    payload: FormData | Record<string, unknown>,
  ): Promise<any> => {
      const isFormData = payload instanceof FormData;
      return apiFetch<any>(`/api/admin/market/catalog/${productId}/images`, {
          method: 'POST',
          body: payload,
          tenantSlug,
          headers: isFormData ? {} : undefined,
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

  adminListPromotions: async (pymeId: string | number, tenantSlug?: string): Promise<CatalogPromotion[]> => {
    return apiFetch<CatalogPromotion[]>(`/api/pymes/${pymeId}/promociones`, { tenantSlug });
  },

  adminCreatePromotion: async (
    pymeId: string | number,
    payload: Record<string, unknown>,
    tenantSlug?: string,
  ): Promise<CatalogPromotion> => {
    return apiFetch<CatalogPromotion>(`/api/pymes/${pymeId}/promociones`, {
      method: 'POST',
      body: payload,
      tenantSlug,
    });
  },

  adminTogglePromotion: async (
    pymeId: string | number,
    promotionId: string,
    active: boolean,
    tenantSlug?: string,
  ): Promise<CatalogPromotion> => {
    const action = active ? 'activar' : 'desactivar';
    return apiFetch<CatalogPromotion>(`/api/pymes/${pymeId}/promociones/${promotionId}/${action}`, {
      method: 'POST',
      tenantSlug,
    });
  },

  publicGetCatalog: async (tenantSlug: string): Promise<TenantCatalog> => {
    const normalizedTenantSlug = typeof tenantSlug === 'string' ? tenantSlug.trim() : '';
    if (!normalizedTenantSlug || TENANT_PLACEHOLDER_SLUGS.has(normalizedTenantSlug.toLowerCase())) {
      return {
        contract_version: 'public.catalog_resolution.local.v1',
        reason_code: 'reserved_public_slug',
        metadata: null,
        links: null,
        columns: [],
        rows: [],
        cart: { enabled: false },
      };
    }

    const options = {
      tenantSlug: normalizedTenantSlug,
      isWidgetRequest: true,
      skipAuth: true,
      omitCredentials: true,
      omitEntityToken: true,
      omitChatSessionId: true,
    } as const;

    const encodedSlug = encodeURIComponent(normalizedTenantSlug);
    let data: unknown;
    try {
      data = await apiFetch<unknown>(`/api/public/tenants/${encodedSlug}/catalog`, options);
    } catch (error) {
      if (!shouldFallbackToLegacyEndpoint(error)) throw error;
      data = await apiFetch<unknown>(`/public/tenants/${encodedSlug}/catalog`, options);
    }
    return normalizePublicCatalogResponse(data);
  },

  // --- Super Admin Methods ---

  superAdminListTenants: async (page = 1, perPage = 20): Promise<{ tenants: Tenant[], total: number }> => {
    return apiFetch<{ tenants: Tenant[], total: number }>(`/api/admin/tenants?page=${page}&per_page=${perPage}`, { omitTenant: true });
  },

  superAdminCreateTenant: async (data: CreateTenantDTO): Promise<Tenant> => {
    return apiFetch<Tenant>('/api/admin/tenants', {
      method: 'POST',
      body: data,
    });
  },

  adminUpdateOrder: async (
    tenantSlug: string,
    orderId: string | number,
    data: { status?: string; catalog_resolutions?: Array<Record<string, unknown>> },
  ) => {
    const encodedId = encodeURIComponent(String(orderId));
    const raw = await apiFetch<unknown>(`/api/admin/tenants/${tenantSlug}/orders/${encodedId}`, {
      method: 'PATCH',
      tenantSlug,
      body: data,
    });
    assertOrderReceipt(raw, String(orderId), data.status, tenantSlug);
    return normalizeAdminOrder(raw);
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
    return apiFetch<{ numbers: WhatsappNumberInventoryItem[]; total?: number }>(`/api/admin/whatsapp/numbers${suffix ? `?${suffix}` : ''}`, { omitTenant: true });
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
    // WidgetSettings is the runtime source consumed by the public widget.
    return apiFetch<any>('/api/tenant/config', { tenantSlug });
  },

  updateChatTheme: async (tenantSlug: string, data: any): Promise<any> => {
    return apiFetch<any>('/api/tenant/config', {
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
