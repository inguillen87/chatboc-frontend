import { apiFetch, ApiError } from '@/utils/api';
import {
  MarketCartResponse,
  MarketCatalogResponse,
  MarketProduct,
  AddToCartPayload,
  CheckoutStartResponse,
  CheckoutStartPayload,
  MarketCheckoutOptions,
  MarketCheckoutPreview,
  MarketNextStep,
  MarketPaymentCheckoutStatus,
  MarketPaymentStatusResponse,
  MarketRewardRedeemResponse,
  MarketRewardRedemption,
  MarketRewardsProfile,
} from '@/types/market';
import { PublicOrderTrackingResponse } from '@/types/tracking';
import {
  getProductGalleryUrls,
  getProductImageAlt,
  getProductImageStatus,
  getProductPrimaryImage,
} from '@/utils/marketImages';

const asStringOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const asStringIdOrNull = (value: unknown): string | null => {
  const direct = asStringOrNull(value);
  if (direct) return direct;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const asBooleanOrNull = (value: unknown): boolean | null =>
  typeof value === 'boolean' ? value : null;

const asRecordOrNull = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asArrayOfStringsOrNull = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .map((item) => asStringOrNull(item))
    .filter((item): item is string => Boolean(item));
  return normalized.length ? normalized : [];
};

const asUnknownRecord = (value: unknown): Record<string, unknown> => asRecordOrNull(value) ?? {};

const getFirst = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

const getSource = (input: unknown): unknown => {
  const record = asRecordOrNull(input);
  if (record && asRecordOrNull(record.data)) return record.data;
  return input;
};

const normalizeMarketProduct = (input: unknown): MarketProduct => {
  const record = asUnknownRecord(input);
  const tenantRecord = asRecordOrNull(record.tenant);
  const ownerRecord = asRecordOrNull(record.owner);
  const catalogItemId = asStringIdOrNull(getFirst(record, [
    'catalogo_item_id',
    'catalog_item_id',
    'catalogItemId',
    'market_catalog_item_id',
    'marketCatalogItemId',
  ]));
  const productId = asStringIdOrNull(getFirst(record, ['product_id', 'productId', 'producto_id']));
  const itemId = asStringIdOrNull(getFirst(record, ['item_id', 'itemId']));
  const name =
    asStringOrNull(getFirst(record, ['name', 'nombre', 'nombre_producto'])) ??
    'Producto';
  return {
    id:
      catalogItemId ??
      productId ??
      itemId ??
      asStringIdOrNull(getFirst(record, ['id', 'sku', 'codigo'])) ??
      `product-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    catalogo_item_id: catalogItemId,
    catalog_item_id: asStringIdOrNull(record.catalog_item_id) ?? catalogItemId,
    product_id: productId,
    item_id: itemId,
    tenant_slug:
      asStringOrNull(getFirst(record, ['tenant_slug', 'tenantSlug', 'slug_tenant'])) ??
      asStringOrNull(tenantRecord?.['slug']),
    tenant: asStringOrNull(getFirst(record, ['tenant', 'tenant_key'])),
    owner_slug:
      asStringOrNull(getFirst(record, ['owner_slug', 'ownerSlug'])) ??
      asStringOrNull(ownerRecord?.['slug']),
    tenant_id: asStringIdOrNull(getFirst(record, ['tenant_id', 'tenantId'])),
    name,
    description: asStringOrNull(getFirst(record, ['description', 'descripcion'])),
    descriptionShort: asStringOrNull(getFirst(record, ['descriptionShort', 'description_short', 'descripcion_corta'])),
    price: asNumberOrNull(getFirst(record, ['price', 'precio_unitario', 'precio', 'amount'])),
    priceText: asStringOrNull(getFirst(record, ['priceText', 'price_text', 'precio_texto'])),
    currency: asStringOrNull(getFirst(record, ['currency', 'moneda'])) ?? 'ARS',
    modality: asStringOrNull(getFirst(record, ['modality', 'modalidad'])) ?? 'venta',
    points: asNumberOrNull(getFirst(record, ['points', 'precio_puntos', 'puntos'])),
    imageUrl: getProductPrimaryImage(record),
    galleryUrls: getProductGalleryUrls(record),
    imageStatus: getProductImageStatus(record),
    imageAlt: getProductImageAlt(record, name),
    category: asStringOrNull(getFirst(record, ['category', 'categoria'])),
    unit: asStringOrNull(getFirst(record, ['unit', 'unidad'])) ?? 'u',
    quantity: asNumberOrNull(getFirst(record, ['quantity', 'stock_quantity', 'stock', 'stock_disponible', 'cantidad'])),
    stock_quantity: asNumberOrNull(getFirst(record, ['stock_quantity', 'stock', 'stock_disponible', 'cantidad'])),
    stock_status: asStringOrNull(getFirst(record, ['stock_status', 'stockStatus', 'availability_status'])),
    available_to_sell: asBooleanOrNull(getFirst(record, ['available_to_sell', 'availableToSell'])),
    amount_validated: asBooleanOrNull(getFirst(record, ['amount_validated', 'amountValidated'])),
    inventory: asRecordOrNull(record.inventory),
    sku: asStringOrNull(getFirst(record, ['sku', 'codigo'])),
    brand: asStringOrNull(getFirst(record, ['brand', 'marca'])),
    promoInfo: asStringOrNull(getFirst(record, ['promoInfo', 'promo_info', 'promocion_activa'])),
    publicUrl: asStringOrNull(getFirst(record, ['publicUrl', 'public_url'])),
    whatsappShareUrl: asStringOrNull(getFirst(record, ['whatsappShareUrl', 'whatsapp_share_url'])),
    disponible: record.disponible === undefined ? true : Boolean(record.disponible),
    checkout_type: asStringOrNull(getFirst(record, ['checkout_type'])) as MarketProduct['checkout_type'],
    external_url: asStringOrNull(getFirst(record, ['external_url', 'externalUrl'])),
    rating: asNumberOrNull(getFirst(record, ['rating'])),
    ratingCount: asNumberOrNull(getFirst(record, ['ratingCount', 'rating_count', 'reviews_count'])),
    tags: asArrayOfStringsOrNull(getFirst(record, ['tags', 'etiquetas'])),
  };
};

const normalizeMarketCatalogResponse = (input: unknown): MarketCatalogResponse => {
  const source = getSource(input);
  const record = asUnknownRecord(source);
  const rawProducts =
    Array.isArray(record.products)
      ? record.products
      : Array.isArray(record.items)
        ? record.items
        : Array.isArray(source)
          ? source
          : [];
  return {
    ...(record as Partial<MarketCatalogResponse>),
    products: rawProducts.map((item) => normalizeMarketProduct(item)),
    publicCartUrl: asStringOrNull(getFirst(record, ['publicCartUrl', 'public_cart_url', 'cart_url'])),
    whatsappShareUrl: asStringOrNull(getFirst(record, ['whatsappShareUrl', 'whatsapp_share_url'])),
    heroImageUrl: asStringOrNull(getFirst(record, ['heroImageUrl', 'hero_image_url', 'banner_url'])),
    heroSubtitle: asStringOrNull(getFirst(record, ['heroSubtitle', 'hero_subtitle'])),
  } as MarketCatalogResponse;
};

const shouldFallbackEndpoint = (error: unknown) =>
  error instanceof ApiError && [404, 405, 501].includes(error.status);

const normalizeCheckoutUrls = (value: unknown): Record<string, string | null> | null => {
  const record = asRecordOrNull(value);
  if (!record) return null;
  return Object.entries(record).reduce<Record<string, string | null>>((acc, [key, item]) => {
    acc[key] = asStringOrNull(item);
    return acc;
  }, {});
};

const normalizeCapabilities = (value: unknown): Record<string, unknown> | unknown[] | null =>
  Array.isArray(value) ? value : asRecordOrNull(value);

const normalizeMarketCheckoutOptions = (input: unknown): MarketCheckoutOptions | null => {
  const record = asRecordOrNull(input);
  if (!record) return null;
  const options: MarketCheckoutOptions = {
    payment_required: asBooleanOrNull(getFirst(record, ['payment_required', 'paymentRequired'])),
    requires_contact_or_auth: asBooleanOrNull(getFirst(record, ['requires_contact_or_auth', 'requiresContactOrAuth'])),
    gateway: asStringOrNull(getFirst(record, ['gateway', 'payment_gateway'])),
    gateway_hint: asStringOrNull(getFirst(record, ['gateway_hint', 'gatewayHint'])),
    checkout_urls: normalizeCheckoutUrls(getFirst(record, ['checkout_urls', 'checkoutUrls'])),
    missing: asArrayOfStringsOrNull(record.missing),
    capabilities: normalizeCapabilities(record.capabilities),
  };

  const hasSignal = Object.values(options).some((value) =>
    Array.isArray(value)
      ? value.length > 0
      : value !== null && value !== undefined,
  );

  return hasSignal ? options : null;
};

const normalizeMarketNextSteps = (value: unknown): MarketNextStep[] | null => {
  if (!Array.isArray(value)) return null;
  const steps = value
    .map((item): MarketNextStep | null => {
      if (typeof item === 'string' && item.trim()) {
        return { title: item.trim(), description: null };
      }
      const record = asRecordOrNull(item);
      if (!record) return null;
      const title = asStringOrNull(getFirst(record, ['title', 'label', 'name']));
      const description = asStringOrNull(getFirst(record, ['description', 'detail', 'message']));
      if (!title && !description) return null;
      return { title, description };
    })
    .filter((item): item is MarketNextStep => Boolean(item));
  return steps.length ? steps : [];
};

const normalizeMarketCheckoutPreview = (input: unknown): MarketCheckoutPreview | null => {
  const source = getSource(input);
  const record = asRecordOrNull(source);
  if (!record) return null;
  const optionsSource = getFirst(record, ['checkout_options', 'checkoutOptions']);
  const preview: MarketCheckoutPreview = {
    state: asStringOrNull(getFirst(record, ['state', 'status', 'estado'])),
    next_step_label: asStringOrNull(getFirst(record, ['next_step_label', 'nextStepLabel', 'message', 'action_hint'])),
    total_monetary: asNumberOrNull(getFirst(record, ['total_monetary', 'totalAmount', 'total_amount', 'total'])),
    total_points: asNumberOrNull(getFirst(record, ['total_points', 'totalPoints'])),
    amount_validated: asBooleanOrNull(getFirst(record, ['amount_validated', 'amountValidated'])),
    stock_status: asStringOrNull(getFirst(record, ['stock_status', 'stockStatus'])),
    available_to_sell: asBooleanOrNull(getFirst(record, ['available_to_sell', 'availableToSell'])),
    payment_required: asBooleanOrNull(getFirst(record, ['payment_required', 'paymentRequired'])),
    payment_ready: asBooleanOrNull(getFirst(record, ['payment_ready', 'paymentReady'])),
    contact_ready: asBooleanOrNull(getFirst(record, ['contact_ready', 'contactReady'])),
    checkout_options: normalizeMarketCheckoutOptions(optionsSource ?? record),
    next_steps: normalizeMarketNextSteps(getFirst(record, ['next_steps', 'nextSteps'])),
  };

  const hasSignal = Object.values(preview).some((value) =>
    Array.isArray(value)
      ? value.length > 0
      : value !== null && value !== undefined,
  );

  return hasSignal ? preview : null;
};

const normalizePaymentCheckoutStatus = (input: unknown): MarketPaymentCheckoutStatus => {
  const source = getSource(input);
  const record = asUnknownRecord(source);
  return {
    contract_version: asStringOrNull(record.contract_version),
    request_id: asStringOrNull(record.request_id),
    payment_ready: asBooleanOrNull(getFirst(record, ['payment_ready', 'paymentReady'])),
    mercadopago_ready: asBooleanOrNull(getFirst(record, ['mercadopago_ready', 'mercadoPagoReady'])),
    gateway: asStringOrNull(getFirst(record, ['gateway', 'payment_gateway'])),
    gateway_hint: asStringOrNull(getFirst(record, ['gateway_hint', 'gatewayHint'])),
    missing: asArrayOfStringsOrNull(record.missing),
    capabilities: normalizeCapabilities(record.capabilities),
    checkout_urls: normalizeCheckoutUrls(getFirst(record, ['checkout_urls', 'checkoutUrls'])),
    checkout_options: normalizeMarketCheckoutOptions(getFirst(record, ['checkout_options', 'checkoutOptions']) ?? record),
    raw: input,
  };
};

const normalizeCheckoutStartResponse = (input: unknown): CheckoutStartResponse => {
  const source = getSource(input);
  const record = asUnknownRecord(source);
  const payment = asUnknownRecord(record.payment);
  const order = asUnknownRecord(record.order);
  const checkoutUrl =
    asStringOrNull(getFirst(record, ['checkoutUrl', 'checkout_url', 'init_point', 'payment_url', 'url'])) ??
    asStringOrNull(getFirst(payment, ['checkoutUrl', 'checkout_url', 'init_point', 'payment_url', 'url']));
  const preferenceId =
    asStringOrNull(getFirst(record, ['preferenceId', 'preference_id'])) ??
    asStringOrNull(getFirst(payment, ['preferenceId', 'preference_id']));
  const orderId =
    getFirst(record, ['orderId', 'order_id', 'market_order_id', 'pedido_id']) ??
    getFirst(order, ['id', 'order_id', 'market_order_id', 'pedido_id']);

  return {
    contract_version: asStringOrNull(record.contract_version),
    request_id: asStringOrNull(record.request_id),
    checkoutUrl: checkoutUrl ?? undefined,
    preferenceId: preferenceId ?? undefined,
    orderId: typeof orderId === 'string' || typeof orderId === 'number' ? orderId : undefined,
    order_id: getFirst(record, ['order_id', 'pedido_id']) as CheckoutStartResponse['order_id'],
    market_order_id: getFirst(record, ['market_order_id']) as CheckoutStartResponse['market_order_id'],
    preference_id: preferenceId,
    init_point: asStringOrNull(getFirst(record, ['init_point', 'initPoint'])) ?? checkoutUrl,
    external_reference: asStringOrNull(getFirst(record, ['external_reference', 'externalReference'])),
    status: asStringOrNull(getFirst(record, ['status', 'estado'])) ?? asStringOrNull(payment.status) ?? undefined,
    estado: asStringOrNull(record.estado),
    tipo: asStringOrNull(record.tipo),
    message: asStringOrNull(getFirst(record, ['message', 'detail', 'next_step_label'])),
    amount_validated:
      asBooleanOrNull(getFirst(record, ['amount_validated', 'amountValidated'])) ??
      asBooleanOrNull(getFirst(order, ['amount_validated', 'amountValidated'])),
    stock_status:
      asStringOrNull(getFirst(record, ['stock_status', 'stockStatus'])) ??
      asStringOrNull(getFirst(order, ['stock_status', 'stockStatus'])),
    available_to_sell:
      asBooleanOrNull(getFirst(record, ['available_to_sell', 'availableToSell'])) ??
      asBooleanOrNull(getFirst(order, ['available_to_sell', 'availableToSell'])),
    inventory_policy: asRecordOrNull(getFirst(record, ['inventory_policy', 'inventoryPolicy'])),
    order,
    checkout_options: normalizeMarketCheckoutOptions(getFirst(record, ['checkout_options', 'checkoutOptions'])),
    customer_profile: asRecordOrNull(record.customer_profile) as CheckoutStartResponse['customer_profile'],
    commercial_state: asRecordOrNull(record.commercial_state) as CheckoutStartResponse['commercial_state'],
    tracking: asRecordOrNull(record.tracking) as CheckoutStartResponse['tracking'],
    next_steps: normalizeMarketNextSteps(getFirst(record, ['next_steps', 'nextSteps'])),
    support_channels: asRecordOrNull(record.support_channels) as CheckoutStartResponse['support_channels'],
  };
};

const normalizePaymentStatusResponse = (input: unknown): MarketPaymentStatusResponse => {
  const source = getSource(input);
  const record = asUnknownRecord(source);
  return {
    contract_version: asStringOrNull(record.contract_version),
    request_id: asStringOrNull(record.request_id),
    payment: asRecordOrNull(record.payment) as MarketPaymentStatusResponse['payment'],
    mp_payment_id: getFirst(record, ['mp_payment_id', 'payment_id']) as MarketPaymentStatusResponse['mp_payment_id'],
    preference_id: asStringOrNull(getFirst(record, ['preference_id', 'preferenceId'])),
    order: asRecordOrNull(record.order),
    timeline: Array.isArray(record.timeline) ? record.timeline : null,
    raw: input,
  };
};

const normalizeRewardRedemption = (input: unknown): MarketRewardRedemption | null => {
  const record = asRecordOrNull(input);
  if (!record) return null;
  return {
    id: getFirst(record, ['id', 'reward_id']) as MarketRewardRedemption['id'],
    reward_id: getFirst(record, ['reward_id', 'id']) as MarketRewardRedemption['reward_id'],
    label: asStringOrNull(getFirst(record, ['label', 'name', 'title'])),
    title: asStringOrNull(getFirst(record, ['title', 'label', 'name'])),
    description: asStringOrNull(getFirst(record, ['description', 'detail'])),
    points: asNumberOrNull(getFirst(record, ['points', 'puntos'])),
    cost_points: asNumberOrNull(getFirst(record, ['cost_points', 'points_cost', 'puntos_costo'])),
    disabled: asBooleanOrNull(getFirst(record, ['disabled', 'unavailable'])),
    raw: input,
  };
};

const normalizeRewardsProfile = (input: unknown): MarketRewardsProfile => {
  const source = getSource(input);
  const record = asUnknownRecord(source);
  const wallet = asUnknownRecord(record.wallet);
  return {
    contract_version: asStringOrNull(record.contract_version),
    request_id: asStringOrNull(record.request_id),
    wallet: {
      ...wallet,
      balance: asNumberOrNull(getFirst(wallet, ['balance', 'saldo'])),
      pending_cart_points: asNumberOrNull(getFirst(wallet, ['pending_cart_points', 'pendingCartPoints'])),
    },
    rules: Array.isArray(record.rules) ? record.rules : asRecordOrNull(record.rules),
    available_redemptions: Array.isArray(record.available_redemptions)
      ? record.available_redemptions
          .map(normalizeRewardRedemption)
          .filter((item): item is MarketRewardRedemption => Boolean(item))
      : [],
    history: Array.isArray(record.history) ? record.history : [],
    summary: asRecordOrNull(record.summary),
    raw: input,
  };
};

const normalizeRewardRedeemResponse = (input: unknown): MarketRewardRedeemResponse => {
  const source = getSource(input);
  const record = asUnknownRecord(source);
  return {
    contract_version: asStringOrNull(record.contract_version),
    request_id: asStringOrNull(record.request_id),
    redemption_id: getFirst(record, ['redemption_id', 'id']) as MarketRewardRedeemResponse['redemption_id'],
    reward_id: getFirst(record, ['reward_id']) as MarketRewardRedeemResponse['reward_id'],
    balance: asNumberOrNull(record.balance),
    duplicate: asBooleanOrNull(record.duplicate),
    raw: input,
  };
};

const withQuery = (path: string, params?: Record<string, string | number | boolean | null | undefined>) => {
  if (!params) return path;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

const normalizeMarketCartResponse = (input: MarketCartResponse | null | undefined): MarketCartResponse => {
  const payload = (input ?? {}) as MarketCartResponse & Record<string, unknown>;
  const continuityRaw = asRecordOrNull(payload.continuity);
  const portalLinksRaw = asRecordOrNull(continuityRaw?.portal_links);
  const checkoutOptionsRaw = asRecordOrNull(payload.checkout_options);
  const checkoutPreviewRaw = asRecordOrNull(payload.checkout_preview);

  return {
    ...payload,
    items: Array.isArray(payload.items) ? payload.items : [],
    totalAmount: typeof payload.totalAmount === 'number' ? payload.totalAmount : null,
    totalPoints: typeof payload.totalPoints === 'number' ? payload.totalPoints : null,
    continuity: continuityRaw
      ? {
          resume_key: asStringOrNull(continuityRaw.resume_key),
          preferred_handoff_channel: asStringOrNull(continuityRaw.preferred_handoff_channel),
          summary: asStringOrNull(continuityRaw.summary),
          conversation_id: asStringOrNull(continuityRaw.conversation_id),
          portal_links: portalLinksRaw
            ? {
                home: asStringOrNull(portalLinksRaw.home),
                orders: asStringOrNull(portalLinksRaw.orders),
                profile: asStringOrNull(portalLinksRaw.profile),
              }
            : null,
        }
      : null,
    checkout_options: normalizeMarketCheckoutOptions(checkoutOptionsRaw),
    checkout_preview: normalizeMarketCheckoutPreview(checkoutPreviewRaw),
    mercadopago_ready: asBooleanOrNull(payload.mercadopago_ready),
    amount_validated: asBooleanOrNull(payload.amount_validated),
    stock_status: asStringOrNull(payload.stock_status),
    available_to_sell: asBooleanOrNull(payload.available_to_sell),
    inventory_policy: asRecordOrNull(payload.inventory_policy),
  };
};

export async function fetchMarketCart(tenantSlug: string): Promise<MarketCartResponse> {
  const response = await apiFetch<MarketCartResponse>(`/api/${tenantSlug}/carrito`, {
    tenantSlug,
    suppressPanel401Redirect: true,
    omitChatSessionId: true,
  });
  return normalizeMarketCartResponse(response);
}

export async function fetchMarketCatalog(tenantSlug: string): Promise<MarketCatalogResponse> {
  const response = await apiFetch<MarketCatalogResponse>(
    `/api/public/tenants/${encodeURIComponent(tenantSlug)}/catalog`,
    {
    tenantSlug,
    suppressPanel401Redirect: true,
    omitChatSessionId: true,
    },
  );
  return normalizeMarketCatalogResponse(response);
}

export async function searchCatalog(tenantSlug: string, query: string): Promise<MarketCatalogResponse> {
  const params = new URLSearchParams({ q: query, tenant_slug: tenantSlug });
  const response = await apiFetch<MarketCatalogResponse>(`/catalogo/buscar?${params.toString()}`, {
    tenantSlug,
    suppressPanel401Redirect: true,
    omitChatSessionId: true,
  });
  return normalizeMarketCatalogResponse(response);
}

const normalizeAddToCartPayload = (payload: AddToCartPayload): AddToCartPayload => {
  const itemId =
    payload.catalogo_item_id ??
    payload.catalog_item_id ??
    payload.product_id ??
    payload.productId;

  const normalizedItemId =
    typeof itemId === 'string'
      ? itemId.trim()
      : typeof itemId === 'number' && Number.isFinite(itemId)
        ? itemId
        : null;

  return {
    ...payload,
    ...(normalizedItemId !== null
      ? {
          catalogo_item_id: normalizedItemId,
          catalog_item_id: normalizedItemId,
          productId: String(normalizedItemId),
        }
      : {}),
    ...(payload.quantity !== undefined && payload.cantidad === undefined
      ? { cantidad: payload.quantity }
      : {}),
  };
};

export async function addMarketItem(tenantSlug: string, payload: AddToCartPayload): Promise<MarketCartResponse> {
  const response = await apiFetch<MarketCartResponse>(`/api/${tenantSlug}/carrito`, {
    method: 'POST',
    body: normalizeAddToCartPayload(payload),
    tenantSlug,
    omitChatSessionId: true,
    headers: { 'X-Persist-Session': 'true' }
  });
  return normalizeMarketCartResponse(response);
}

export async function removeMarketItem(tenantSlug: string, itemId: string): Promise<MarketCartResponse> {
  const response = await apiFetch<MarketCartResponse>(`/api/${tenantSlug}/carrito/${itemId}`, {
    method: 'DELETE',
    tenantSlug,
    omitChatSessionId: true,
  });
  return normalizeMarketCartResponse(response);
}

export async function clearMarketCart(tenantSlug: string): Promise<MarketCartResponse> {
  const response = await apiFetch<MarketCartResponse>(`/api/${tenantSlug}/carrito`, {
    method: 'DELETE',
    tenantSlug,
    omitChatSessionId: true,
  });
  return normalizeMarketCartResponse(response);
}

export async function startMarketCheckout(tenantSlug: string, payload: CheckoutStartPayload): Promise<CheckoutStartResponse> {
  const options = {
    method: 'POST' as const,
    body: payload,
    tenantSlug,
    suppressPanel401Redirect: true,
    omitChatSessionId: true,
  };

  try {
    const response = await apiFetch<unknown>('/api/v2/payments/checkout-session', options);
    return normalizeCheckoutStartResponse(response);
  } catch (error) {
    if (!shouldFallbackEndpoint(error)) {
      console.error("Error starting checkout:", error);
      throw error;
    }
  }

  try {
    const response = await apiFetch<unknown>('/api/v2/payments/preference', options);
    return normalizeCheckoutStartResponse(response);
  } catch (error) {
    if (!shouldFallbackEndpoint(error)) {
      console.error("Error starting checkout preference:", error);
      throw error;
    }
  }

  try {
    const response = await apiFetch<unknown>(`/api/market/${tenantSlug}/checkout/start`, options);
    return normalizeCheckoutStartResponse(response);
  } catch (error) {
    console.error("Error starting checkout:", error);
    throw error;
  }
}

export async function fetchPaymentCheckoutStatus(
  tenantSlug: string,
  params?: Record<string, string | number | boolean | null | undefined>,
): Promise<MarketPaymentCheckoutStatus | null> {
  try {
    const response = await apiFetch<unknown>(withQuery('/api/v2/payments/checkout-status', params), {
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
    return normalizePaymentCheckoutStatus(response);
  } catch (error) {
    if (shouldFallbackEndpoint(error)) return null;
    throw error;
  }
}

export async function fetchPaymentCapabilities(tenantSlug: string): Promise<MarketPaymentCheckoutStatus | null> {
  try {
    const response = await apiFetch<unknown>('/api/v2/payments/capabilities', {
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
    return normalizePaymentCheckoutStatus(response);
  } catch (error) {
    if (shouldFallbackEndpoint(error)) return null;
    throw error;
  }
}

export async function previewPaymentCheckout(
  tenantSlug: string,
  payload: CheckoutStartPayload,
): Promise<MarketCheckoutPreview | null> {
  try {
    const response = await apiFetch<unknown>('/api/v2/payments/checkout-preview', {
      method: 'POST',
      body: payload,
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
    return normalizeMarketCheckoutPreview(response);
  } catch (error) {
    if (shouldFallbackEndpoint(error)) return null;
    throw error;
  }
}

export async function fetchPaymentStatus(
  tenantSlug: string,
  params: Record<string, string | number | boolean | null | undefined>,
): Promise<MarketPaymentStatusResponse | null> {
  try {
    const response = await apiFetch<unknown>('/api/v2/payments/status', {
      method: 'POST',
      body: params,
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
    return normalizePaymentStatusResponse(response);
  } catch (error) {
    if (!shouldFallbackEndpoint(error)) throw error;
  }

  try {
    const response = await apiFetch<unknown>(withQuery('/api/v2/payments/status', params), {
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
    return normalizePaymentStatusResponse(response);
  } catch (error) {
    if (shouldFallbackEndpoint(error)) return null;
    throw error;
  }
}

export async function fetchRewardsProfile(tenantSlug: string): Promise<MarketRewardsProfile | null> {
  try {
    const response = await apiFetch<unknown>('/api/v2/rewards/profile', {
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
    return normalizeRewardsProfile(response);
  } catch (error) {
    if (shouldFallbackEndpoint(error)) return null;
    if (error instanceof ApiError && [401, 403].includes(error.status)) return null;
    throw error;
  }
}

export async function redeemReward(
  tenantSlug: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<MarketRewardRedeemResponse> {
  const response = await apiFetch<unknown>('/api/v2/rewards/redeem', {
    method: 'POST',
    body: payload,
    tenantSlug,
    suppressPanel401Redirect: true,
    omitChatSessionId: true,
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });
  return normalizeRewardRedeemResponse(response);
}

export async function fetchPublicOrder(ticketNumber: string): Promise<PublicOrderTrackingResponse> {
  return apiFetch<PublicOrderTrackingResponse>(`/api/public/pyme/pedidos/${ticketNumber}`, {
    skipAuth: true
  });
}
