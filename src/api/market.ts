import { ApiError, NetworkError, apiFetch } from '@/utils/api';
import {
  AddToCartPayload,
  CheckoutStartPayload,
  CheckoutStartResponse,
  MarketCartItem,
  MarketCartResponse,
  MarketCatalogResponse,
  MarketProduct,
} from '@/types/market';
import { MARKET_DEMO_PRODUCTS, buildDemoMarketCatalog } from '@/data/marketDemo';
import { addItemToStoredCart, readStoredCart } from '@/utils/marketStorage';

const baseOptions = (tenantSlug: string) => ({
  omitCredentials: true,
  sendAnonId: true,
  omitChatSessionId: true,
  isWidgetRequest: true,
  tenantSlug,
});

const parseNumber = (value: any): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const normalizeProduct = (raw: any, index: number): MarketProduct => {
  const resolvedId = raw?.id ?? raw?.product_id ?? raw?.producto_id ?? raw?.slug ?? `product-${index}`;
  const resolvedName = raw?.name ?? raw?.nombre ?? raw?.title ?? `Producto ${index + 1}`;
  const currency =
    raw?.currency ?? raw?.moneda ?? raw?.currency_code ?? raw?.moneda_codigo ?? raw?.moneda_id ?? null;

  const priceText =
    (typeof raw?.price === 'string' ? raw.price : null) ??
    (typeof raw?.precio === 'string' ? raw.precio : null) ??
    (typeof raw?.precio_texto === 'string' ? raw.precio_texto : null) ??
    (typeof raw?.price_text === 'string' ? raw.price_text : null);

  const normalizedPrice =
    parseNumber(raw?.precio_monetario ?? raw?.price_amount ?? raw?.precio ?? raw?.price) ??
    (typeof raw?.precio === 'number' ? raw.precio : null) ??
    (typeof raw?.price === 'number' ? raw.price : null);

  const pointsValue = parseNumber(raw?.price_points ?? raw?.puntos ?? raw?.points ?? raw?.precio_puntos);

  return {
    id: String(resolvedId),
    name: String(resolvedName),
    description: raw?.description ?? raw?.descripcion ?? null,
    descriptionShort: raw?.descripcion_corta ?? raw?.description_short ?? null,
    price: normalizedPrice,
    priceText: priceText ?? null,
    currency: typeof currency === 'string' ? currency.toUpperCase() : null,
    modality: raw?.modalidad ?? raw?.mode ?? null,
    points: pointsValue,
    imageUrl: raw?.imageUrl ?? raw?.imagen ?? raw?.image_url ?? raw?.foto ?? null,
    category: raw?.categoria ?? raw?.category ?? null,
    unit: raw?.unidad ?? null,
    quantity: parseNumber(raw?.cantidad) ?? null,
    sku: raw?.sku ?? null,
    brand: raw?.marca ?? raw?.brand ?? null,
    promoInfo: raw?.promocion_info ?? raw?.promo ?? null,
    publicUrl: raw?.public_url ?? raw?.publicUrl ?? null,
    whatsappShareUrl: raw?.whatsapp_share_url ?? raw?.whatsappShareUrl ?? null,
  };
};

const normalizeCartItems = (rawItems: any[] | undefined | null): MarketCartItem[] => {
  if (!Array.isArray(rawItems)) return [];

  return rawItems.map((item, index) => {
    const product = normalizeProduct(item, index);
    const quantityValue = item?.quantity ?? item?.cantidad ?? 1;
    const quantity = typeof quantityValue === 'number' && quantityValue > 0 ? quantityValue : 1;

    return {
      ...product,
      quantity,
      priceText:
        product.priceText ??
        (typeof item?.precio_texto === 'string' ? item.precio_texto : item?.price_text ?? null),
    };
  });
};

const normalizeProductList = (rawItems: any[] | undefined | null): MarketProduct[] => {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((item, index) => normalizeProduct(item, index));
};

const shouldUseDemo = (error: unknown): boolean => {
  if (error instanceof ApiError) {
    return [401, 403, 404, 405, 500].includes(error.status);
  }
  return error instanceof NetworkError;
};

const getDemoCatalog = (tenantSlug: string) => buildDemoMarketCatalog(tenantSlug).catalog;

export async function fetchMarketCatalog(tenantSlug: string): Promise<MarketCatalogResponse> {
  try {
    const response = await apiFetch<any>(
      `/api/market/${encodeURIComponent(tenantSlug)}/catalog`,
      baseOptions(tenantSlug),
    );
    const products = normalizeProductList(response?.products ?? response?.items ?? []);

    if (!products.length) {
      const demo = getDemoCatalog(tenantSlug);
      return { ...demo, isDemo: true, demoReason: demo.demoReason };
    }

    return {
      tenantName: response?.tenantName ?? response?.nombre ?? response?.tenant_name ?? undefined,
      tenantLogoUrl: response?.tenantLogoUrl ?? response?.logo ?? response?.tenant_logo_url ?? undefined,
      products,
      publicCartUrl:
        response?.cart_url ??
        response?.public_cart_url ??
        response?.publicCartUrl ??
        response?.public_cart ??
        null,
      whatsappShareUrl: response?.whatsapp_share_url ?? response?.whatsappShareUrl ?? null,
    };
  } catch (error) {
    if (!shouldUseDemo(error)) throw error;
    return getDemoCatalog(tenantSlug);
  }
}

export async function fetchMarketCart(tenantSlug: string): Promise<MarketCartResponse> {
  try {
    const response = await apiFetch<any>(
      `/api/market/${encodeURIComponent(tenantSlug)}/cart`,
      baseOptions(tenantSlug),
    );
    const items = normalizeCartItems(response?.items ?? response?.cart ?? []);

    return {
      items,
      totalAmount: response?.totalAmount ?? response?.total ?? response?.total_amount ?? null,
      totalPoints: response?.totalPoints ?? response?.puntos_totales ?? response?.total_points ?? null,
      cartUrl:
        response?.cart_url ??
        response?.public_cart_url ??
        response?.cartUrl ??
        response?.publicCartUrl ??
        null,
      whatsappShareUrl: response?.whatsapp_share_url ?? response?.whatsappShareUrl ?? null,
    };
  } catch (error) {
    if (!shouldUseDemo(error)) throw error;
    const fallbackCart = readStoredCart(tenantSlug);
    return { ...fallbackCart, isDemo: true };
  }
}

export async function addMarketItem(
  tenantSlug: string,
  payload: AddToCartPayload,
): Promise<MarketCartResponse> {
  try {
    const response = await apiFetch<any>(`/api/market/${encodeURIComponent(tenantSlug)}/cart/add`, {
      ...baseOptions(tenantSlug),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const items = normalizeCartItems(response?.items ?? response?.cart ?? []);

    return {
      items,
      totalAmount: response?.totalAmount ?? response?.total ?? response?.total_amount ?? null,
      totalPoints: response?.totalPoints ?? response?.puntos_totales ?? response?.total_points ?? null,
    };
  } catch (error) {
    if (!shouldUseDemo(error)) throw error;
    const demoProduct = MARKET_DEMO_PRODUCTS.find((product) => product.id === payload.productId);
    const fallbackItem: MarketCartItem = {
      id: payload.productId,
      name: demoProduct?.name ?? 'Producto',
      quantity: payload.quantity ?? 1,
      price: demoProduct?.price ?? null,
      points: demoProduct?.points ?? null,
      imageUrl: demoProduct?.imageUrl ?? null,
    };
    const stored = addItemToStoredCart(tenantSlug, fallbackItem, payload.quantity ?? 1);
    return { ...stored, isDemo: true };
  }
}

export async function startMarketCheckout(
  tenantSlug: string,
  payload: CheckoutStartPayload,
): Promise<CheckoutStartResponse> {
  try {
    return await apiFetch<CheckoutStartResponse>(`/api/market/${encodeURIComponent(tenantSlug)}/checkout/start`, {
      ...baseOptions(tenantSlug),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (!shouldUseDemo(error)) throw error;
    return {
      status: 'demo',
      message: 'Pedido registrado en modo demo. Te contactaremos al habilitar el catálogo en vivo.',
    };
  }
}
