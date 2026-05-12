import { apiFetch, ApiError, NetworkError } from '@/utils/api';
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
import { DEFAULT_PUBLIC_PRODUCTS } from '@/data/defaultProducts';
import { DEMO_CATALOGS as MOCK_CATALOGS } from '@/data/mockCatalogs';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import {
  getProductGalleryUrls,
  getProductImageAlt,
  getProductImageStatus,
  getProductPrimaryImage,
} from '@/utils/marketImages';

// Local storage key for demo cart persistence
const DEMO_CART_KEY = 'chatboc_demo_cart_v2';

// Helper to load local demo cart
const loadLocalDemoCart = (): MarketCartResponse => {
  try {
    const stored = safeLocalStorage.getItem(DEMO_CART_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to load local demo cart", e);
  }
  return { items: [], totalAmount: 0, totalPoints: 0, isDemo: true };
};

// Helper to save local demo cart
const saveLocalDemoCart = (cart: MarketCartResponse) => {
  try {
    safeLocalStorage.setItem(DEMO_CART_KEY, JSON.stringify(cart));
  } catch (e) {
    console.warn("Failed to save local demo cart", e);
  }
};

const DEMO_KEYWORDS = ['bodega', 'ferreteria', 'almacen', 'kiosco', 'farmacia', 'restaurante', 'tienda', 'logistica', 'seguros', 'fintech', 'inmobiliaria', 'industria', 'clinica', 'medico', 'local_comercial'];

const isDemoTenant = (slug: string) => {
  if (slug === 'municipio' || slug === 'demo-municipio') return true;
  return DEMO_KEYWORDS.some(k => slug.includes(k));
};

// Helper to mock a cart response from default products
const mockCartResponse = (): MarketCartResponse => {
  return loadLocalDemoCart();
};

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
  const name =
    asStringOrNull(getFirst(record, ['name', 'nombre', 'nombre_producto'])) ??
    'Producto';
  return {
    id:
      asStringIdOrNull(getFirst(record, ['id', 'product_id', 'sku', 'codigo'])) ??
      `product-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
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
    quantity: asNumberOrNull(getFirst(record, ['quantity', 'stock', 'stock_disponible', 'cantidad'])),
    sku: asStringOrNull(getFirst(record, ['sku', 'codigo'])),
    brand: asStringOrNull(getFirst(record, ['brand', 'marca'])),
    promoInfo: asStringOrNull(getFirst(record, ['promoInfo', 'promo_info', 'promocion_activa'])),
    publicUrl: asStringOrNull(getFirst(record, ['publicUrl', 'public_url'])),
    whatsappShareUrl: asStringOrNull(getFirst(record, ['whatsappShareUrl', 'whatsapp_share_url'])),
    disponible: record.disponible === undefined ? true : Boolean(record.disponible),
    checkout_type: asStringOrNull(getFirst(record, ['checkout_type'])) as MarketProduct['checkout_type'],
    external_url: asStringOrNull(getFirst(record, ['external_url', 'externalUrl'])),
    rating: asNumberOrNull(getFirst(record, ['rating'])),
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
  };
};

// Helper to mock catalog response
const mockCatalogResponse = (tenantSlug?: string): MarketCatalogResponse => {
  let sourceProducts = DEFAULT_PUBLIC_PRODUCTS;

  if (tenantSlug) {
      // Find matching mock catalog key
      const key = Object.keys(MOCK_CATALOGS).find(k => tenantSlug.includes(k));
      if (key) {
          sourceProducts = MOCK_CATALOGS[key].map(p => ({
              ...p,
              nombre: p.name,
              descripcion: p.description,
              precio_unitario: p.price,
              precio_puntos: p.points,
              imagen_url: p.imageUrl,
              promocion_activa: p.promoInfo,
              unidades_por_caja: p.unit === 'caja' ? 6 : 1, // Basic assumption
              origen: 'demo' as const
          })) as any; // Cast to avoid strict type mismatch on ProductDetails vs MarketProduct
      }
  }

  const products = sourceProducts.map(p => ({
    id: String(p.id),
    name: p.nombre,
    description: p.descripcion ?? null,
    descriptionShort: null,
    price: typeof p.precio_unitario === 'number' ? p.precio_unitario : parseFloat(String(p.precio_unitario || 0)),
    priceText: null,
    currency: 'ARS',
    modality: p.modalidad ?? 'venta',
    points: p.precio_puntos ?? null,
    imageUrl: getProductPrimaryImage(p as unknown as Record<string, unknown>),
    galleryUrls: getProductGalleryUrls(p as unknown as Record<string, unknown>),
    imageStatus: getProductImageStatus(p as unknown as Record<string, unknown>),
    imageAlt: getProductImageAlt(p as unknown as Record<string, unknown>, p.nombre ?? 'Producto'),
    category: p.categoria ?? null,
    unit: 'u',
    quantity: 99,
    sku: null,
    brand: p.marca ?? null,
    promoInfo: p.promocion_activa ?? null,
    publicUrl: null,
    whatsappShareUrl: null,
    disponible: true,
  }));

  return {
    products,
    publicCartUrl: null,
    whatsappShareUrl: null,
    heroImageUrl: null,
    heroSubtitle: null,
    isDemo: true,
  };
};

// Mock function for fetchPublicOrder
const mockPublicOrderResponse = (ticketNumber: string): PublicOrderTrackingResponse => {
  return {
    id: 12345,
    nro_pedido: ticketNumber,
    estado: 'en_proceso',
    asunto: 'Pedido de Prueba',
    monto_total: 49500.0,
    fecha_creacion: new Date().toISOString(),
    nombre_cliente: 'Cliente Demo',
    email_cliente: 'demo@example.com',
    telefono_cliente: '+5491112345678',
    direccion: 'Calle Falsa 123, CABA',
    detalles: [
      {
        nombre_producto: 'Producto Demo 1',
        cantidad: 2,
        precio_unitario_original: 15000.0,
        subtotal_con_descuento: 30000.0,
        moneda: 'ARS',
        sku: 'DEMO-001'
      },
      {
        nombre_producto: 'Producto Demo 2',
        cantidad: 1,
        precio_unitario_original: 19500.0,
        subtotal_con_descuento: 19500.0,
        moneda: 'ARS',
        sku: 'DEMO-002'
      }
    ],
    pyme_nombre: 'Tienda Demo',
    tenant_slug: 'tienda-demo',
    tenant_logo: null,
    tenant_theme: {
      primaryColor: '#2563eb',
      secondaryColor: '#ffffff'
    }
  };
};

export async function fetchMarketCart(tenantSlug: string): Promise<MarketCartResponse> {
  try {
    const response = await apiFetch<MarketCartResponse>(`/api/${tenantSlug}/carrito`, {
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
    return normalizeMarketCartResponse(response);
  } catch (error) {
    if (error instanceof ApiError || error instanceof NetworkError) {
      // Return empty demo cart on auth, not found or server failures so the UI can continue with local cart logic
      // Also catch 400 which happens when sending mock product IDs
      const status = (error as any).status;
      if (!status || [400, 401, 403, 404].includes(status) || status >= 500) {
        return mockCartResponse();
      }
    }
    throw error;
  }
}

export async function fetchMarketCatalog(tenantSlug: string): Promise<MarketCatalogResponse> {
  try {
    const response = await apiFetch<MarketCatalogResponse>(`/api/${tenantSlug}/productos`, {
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
    return normalizeMarketCatalogResponse(response);
  } catch (error) {
    console.warn(`[MarketAPI] Failed to fetch catalog for ${tenantSlug}, using mock.`, error);
    return mockCatalogResponse(tenantSlug);
  }
}

export async function searchCatalog(tenantSlug: string, query: string): Promise<MarketCatalogResponse> {
  try {
    const params = new URLSearchParams({ q: query, tenant_slug: tenantSlug });
    const response = await apiFetch<MarketCatalogResponse>(`/catalogo/buscar?${params.toString()}`, {
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
    return normalizeMarketCatalogResponse(response);
  } catch (error) {
    console.warn(`[MarketAPI] Failed to search catalog for ${tenantSlug}`, error);
    // Fallback to fetching all and filtering or mock
    return fetchMarketCatalog(tenantSlug);
  }
}

export async function addMarketItem(tenantSlug: string, payload: AddToCartPayload): Promise<MarketCartResponse> {
  const addToLocalCart = () => {
        // Fallback to local demo cart logic
        const currentCart = loadLocalDemoCart();

        let product: any = DEFAULT_PUBLIC_PRODUCTS.find(p => String(p.id) === payload.productId);

        // Fallback to mock catalogs search if not in default
        if (!product) {
            for (const key in MOCK_CATALOGS) {
                const found = MOCK_CATALOGS[key].find(p => String(p.id) === payload.productId);
                if (found) {
                    product = {
                        ...found,
                        nombre: found.name,
                        precio_unitario: found.price,
                        imagen_url: found.imageUrl,
                        precio_puntos: found.points
                    };
                    break;
                }
            }
        }

        if (product) {
            const existingItemIndex = currentCart.items.findIndex(i => i.id === payload.productId);
            const price = typeof product.precio_unitario === 'number' ? product.precio_unitario : 0;
            const qty = payload.quantity || 1;

            if (existingItemIndex >= 0) {
                currentCart.items[existingItemIndex].quantity += qty;
            } else {
                currentCart.items.push({
                    id: String(product.id),
                    name: product.nombre,
                    description: product.descripcion ?? null,
                    descriptionShort: null,
                    price: price,
                    quantity: qty,
                    imageUrl: getProductPrimaryImage(product),
                    galleryUrls: getProductGalleryUrls(product),
                    imageStatus: getProductImageStatus(product),
                    imageAlt: getProductImageAlt(product, product.nombre || product.name || 'Producto'),
                    currency: 'ARS',
                    modality: product.modalidad ?? 'venta',
                    points: product.precio_puntos || null,
                    priceText: null,
                    category: product.categoria ?? null,
                    unit: product.unidad ?? 'u',
                    sku: product.sku ?? product.codigo ?? null,
                    brand: product.marca ?? null,
                    promoInfo: product.promocion_activa ?? null,
                    publicUrl: null,
                    whatsappShareUrl: null,
                });
            }

            // Recalculate totals
            currentCart.totalAmount = currentCart.items.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0);
            currentCart.totalPoints = currentCart.items.reduce((sum, item) => sum + ((item.points || 0) * item.quantity), 0);

            saveLocalDemoCart(currentCart);
            return currentCart;
        }
        throw new Error('Producto demo no encontrado');
  };

  try {
      // Ensure we send the correct Content-Type and handle the response correctly
      const response = await apiFetch<MarketCartResponse>(`/api/${tenantSlug}/carrito`, {
        method: 'POST',
        body: payload,
        tenantSlug,
        omitChatSessionId: true,
        // Explicitly request session persistence if needed by the backend
        headers: { 'X-Persist-Session': 'true' }
      });
      return normalizeMarketCartResponse(response);
  } catch (error) {
     const status = (error as any).status;
     if ((error instanceof ApiError || error instanceof NetworkError) && (!status || [400, 401, 403, 404].includes(status) || status >= 500)) {
        return addToLocalCart();
     }
     throw error;
  }
}

export async function removeMarketItem(tenantSlug: string, itemId: string): Promise<MarketCartResponse> {
  try {
      const response = await apiFetch<MarketCartResponse>(`/api/${tenantSlug}/carrito/${itemId}`, {
        method: 'DELETE',
        tenantSlug,
        omitChatSessionId: true,
      });
      return normalizeMarketCartResponse(response);
  } catch (error) {
      // Local Cart fallback
      const currentCart = loadLocalDemoCart();
      const newItems = currentCart.items.filter(i => i.id !== itemId);
      currentCart.items = newItems;
      currentCart.totalAmount = currentCart.items.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0);
      currentCart.totalPoints = currentCart.items.reduce((sum, item) => sum + ((item.points || 0) * item.quantity), 0);
      saveLocalDemoCart(currentCart);
      return currentCart;
  }
}

export async function clearMarketCart(tenantSlug: string): Promise<MarketCartResponse> {
  try {
    const response = await apiFetch<MarketCartResponse>(`/api/${tenantSlug}/carrito`, {
      method: 'DELETE',
      tenantSlug,
      omitChatSessionId: true,
    });
    return normalizeMarketCartResponse(response);
  } catch (error) {
    const emptyCart = normalizeMarketCartResponse({ items: [], totalAmount: 0, totalPoints: 0, isDemo: isDemoTenant(tenantSlug) });
    saveLocalDemoCart(emptyCart);
    return emptyCart;
  }
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
      if (isDemoTenant(tenantSlug)) {
        return { status: 'demo' };
      }
      throw error;
    }
  }

  try {
    const response = await apiFetch<unknown>('/api/v2/payments/preference', options);
    return normalizeCheckoutStartResponse(response);
  } catch (error) {
    if (!shouldFallbackEndpoint(error)) {
      console.error("Error starting checkout preference:", error);
      if (isDemoTenant(tenantSlug)) {
        return { status: 'demo' };
      }
      throw error;
    }
  }

  try {
    const response = await apiFetch<unknown>(`/api/market/${tenantSlug}/checkout/start`, options);
    return normalizeCheckoutStartResponse(response);
  } catch (error) {
    console.error("Error starting checkout:", error);
    if (isDemoTenant(tenantSlug)) {
      return { status: 'demo' };
    }
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
  try {
    return await apiFetch<PublicOrderTrackingResponse>(`/api/public/pyme/pedidos/${ticketNumber}`, {
      skipAuth: true
    });
  } catch (error) {
    // Robust mock fallback for all errors if it's a DEMO ticket
    if (ticketNumber.startsWith('PED-') || ticketNumber.startsWith('DEMO')) {
         console.warn("Falling back to mock order for demo/error", error);
         return mockPublicOrderResponse(ticketNumber);
    }
    throw error;
  }
}
