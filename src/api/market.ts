import { ApiError, NetworkError } from '@/utils/api';
import {
  AddToCartPayload,
  CheckoutStartPayload,
  CheckoutStartResponse,
  MarketCartItem,
  MarketCartResponse,
  MarketCatalogResponse,
  MarketCatalogSection,
  MarketProduct,
} from '@/types/market';
import { MARKET_DEMO_PRODUCTS, buildDemoMarketCatalog } from '@/data/marketDemo';
import {
  addItemToStoredCart,
  clearStoredCart,
  readStoredCart,
  removeItemFromStoredCart,
} from '@/utils/marketStorage';
import { apiClient } from '@/api/client';

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
      currency: product.currency ?? item?.currency ?? item?.moneda ?? null,
      modality: product.modality ?? item?.modalidad ?? null,
    };
  });
};

const normalizeProductList = (rawItems: any[] | undefined | null): MarketProduct[] => {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((item, index) => normalizeProduct(item, index));
};

const normalizeSections = (
  raw: any[] | undefined | null,
  fallbackProducts?: MarketProduct[],
): MarketCatalogSection[] | undefined => {
  if (!Array.isArray(raw)) return undefined;

  return raw
    .map((item) => {
      if (!item) return null;
      const products =
        item.items || item.productos || item.products || item.canjes
          ? normalizeProductList(item.items ?? item.productos ?? item.products ?? item.canjes)
          : undefined;

      return {
        title: item.title ?? item.titulo ?? item.name ?? item.nombre,
        description: item.description ?? item.descripcion ?? null,
        badge: item.badge ?? item.etiqueta ?? null,
        items: products?.length ? products : fallbackProducts,
      } satisfies MarketCatalogSection;
    })
    .filter((section): section is MarketCatalogSection => Boolean(section?.title));
};

const shouldUseDemo = (error: unknown): boolean => {
  if (error instanceof ApiError) {
    return [401, 403, 404, 405, 500].includes(error.status);
  }
  return error instanceof NetworkError;
};

const getDemoCatalog = (tenantSlug: string) => buildDemoMarketCatalog(tenantSlug).catalog;

const buildTenantQueryParams = (tenantSlug: string) =>
  new URLSearchParams({
    tenant: tenantSlug,
    tenant_slug: tenantSlug,
  }).toString();

export async function fetchMarketCatalog(tenantSlug: string): Promise<MarketCatalogResponse> {
  try {
    const response = await apiClient.get<any>(
      `/public/market/${encodeURIComponent(tenantSlug)}/productos?${buildTenantQueryParams(tenantSlug)}`,
      tenantSlug,
    );
    const mergedProducts = [
      ...(response?.products ?? []),
      ...(response?.items ?? []),
      ...(response?.productos ?? []),
      ...(Array.isArray(response) ? response : []),
    ];

    const products = normalizeProductList(mergedProducts);

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
      heroImageUrl: response?.hero_image_url ?? response?.heroImageUrl ?? null,
      heroSubtitle: response?.hero_subtitle ?? response?.heroSubtitle ?? null,
      sections: normalizeSections(
        response?.sections ?? response?.bloques ?? response?.secciones ?? response?.catalog_sections,
        products.length ? products.slice(0, 4) : undefined,
      ),
    };
  } catch (error) {
    if (!shouldUseDemo(error)) throw error;
    return getDemoCatalog(tenantSlug);
  }
}

export async function fetchMarketCart(tenantSlug: string): Promise<MarketCartResponse> {
  try {
    const response = await apiClient.get<any>(
      `/public/market/${encodeURIComponent(tenantSlug)}/carrito?${buildTenantQueryParams(tenantSlug)}`,
      tenantSlug,
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
    const response = await apiClient.post<any>(
      `/public/market/${encodeURIComponent(tenantSlug)}/carrito?${buildTenantQueryParams(tenantSlug)}`,
      payload,
      tenantSlug,
    );

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
      currency: demoProduct?.currency ?? null,
      modality: demoProduct?.modality ?? null,
    };
    const stored = addItemToStoredCart(tenantSlug, fallbackItem, payload.quantity ?? 1);
    return { ...stored, isDemo: true };
  }
}

export async function removeMarketItem(tenantSlug: string, productId: string): Promise<MarketCartResponse> {
  try {
    const response = await apiClient.post<any>(
      `/public/market/${encodeURIComponent(tenantSlug)}/carrito/remove?${buildTenantQueryParams(tenantSlug)}`,
      { productId },
      tenantSlug,
    );

    const items = normalizeCartItems(response?.items ?? response?.cart ?? []);

    return {
      items,
      totalAmount: response?.totalAmount ?? response?.total ?? response?.total_amount ?? null,
      totalPoints: response?.totalPoints ?? response?.puntos_totales ?? response?.total_points ?? null,
      cartUrl:
        response?.cart_url ?? response?.public_cart_url ?? response?.cartUrl ?? response?.publicCartUrl ?? null,
      whatsappShareUrl: response?.whatsapp_share_url ?? response?.whatsappShareUrl ?? null,
    };
  } catch (error) {
    if (!shouldUseDemo(error)) throw error;
    const stored = removeItemFromStoredCart(tenantSlug, productId);
    return { ...stored, isDemo: true };
  }
}

export async function clearMarketCart(tenantSlug: string): Promise<MarketCartResponse> {
  try {
    await apiClient.post(
      `/public/market/${encodeURIComponent(tenantSlug)}/carrito/clear?${buildTenantQueryParams(tenantSlug)}`,
      undefined,
      tenantSlug,
    );

    return { items: [], totalAmount: null, totalPoints: null };
  } catch (error) {
    if (!shouldUseDemo(error)) throw error;
    const stored = clearStoredCart(tenantSlug);
    return { ...stored, isDemo: true };
  }
}

export async function startMarketCheckout(
  tenantSlug: string,
  payload: CheckoutStartPayload,
): Promise<CheckoutStartResponse> {
  try {
    return await apiClient.post<CheckoutStartResponse>(
      `/public/market/${encodeURIComponent(tenantSlug)}/checkout?${buildTenantQueryParams(tenantSlug)}`,
      payload,
      tenantSlug,
    );
  } catch (error) {
    if (!shouldUseDemo(error)) throw error;
    return {
      status: 'demo',
      message: 'Pedido registrado en modo demo. Te contactaremos al habilitar el catálogo en vivo.',
    };
  }
}
