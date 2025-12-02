import { apiFetch } from '@/utils/api';
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

  return {
    id: String(resolvedId),
    name: String(resolvedName),
    description: raw?.description ?? raw?.descripcion ?? null,
    price: parseNumber(raw?.price ?? raw?.precio ?? raw?.price_amount),
    points: parseNumber(raw?.points ?? raw?.puntos ?? raw?.loyalty_points),
    imageUrl: raw?.imageUrl ?? raw?.imagen ?? raw?.image_url ?? raw?.foto ?? null,
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

export async function fetchMarketCatalog(tenantSlug: string): Promise<MarketCatalogResponse> {
  try {
    const response = await apiFetch<any>(
      `/api/market/${encodeURIComponent(tenantSlug)}/catalog`,
      baseOptions(tenantSlug),
    );
    const mergedProducts = [
      ...(response?.products ?? []),
      ...(response?.items ?? []),
      ...(response?.productos ?? []),
      ...(response?.canjes ?? []),
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
  const response = await apiFetch<any>(
    `/api/market/${encodeURIComponent(tenantSlug)}/cart`,
    baseOptions(tenantSlug),
  );
  const items = normalizeCartItems(response?.items ?? response?.cart ?? []);

  return {
    items,
    totalAmount: parseNumber(response?.totalAmount ?? response?.total ?? response?.total_amount),
    totalPoints: parseNumber(response?.totalPoints ?? response?.puntos_totales ?? response?.total_points),
    availableAmount: parseNumber(
      response?.availableAmount ??
        response?.saldo ??
        response?.saldo_en_pesos ??
        response?.wallet_amount,
    ),
    availablePoints: parseNumber(
      response?.availablePoints ??
        response?.saldo_puntos ??
        response?.wallet_points ??
        response?.loyalty_points,
    ),
  };
}

export async function addMarketItem(
  tenantSlug: string,
  payload: AddToCartPayload,
): Promise<MarketCartResponse> {
  const response = await apiFetch<any>(`/api/market/${encodeURIComponent(tenantSlug)}/cart/add`, {
    ...baseOptions(tenantSlug),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

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
    const response = await apiFetch<any>(`/api/market/${encodeURIComponent(tenantSlug)}/cart/remove`, {
      ...baseOptions(tenantSlug),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId }),
    });

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
    await apiFetch<any>(`/api/market/${encodeURIComponent(tenantSlug)}/cart/clear`, {
      ...baseOptions(tenantSlug),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

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
  return apiFetch<CheckoutStartResponse>(`/api/market/${encodeURIComponent(tenantSlug)}/checkout/start`, {
    ...baseOptions(tenantSlug),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
