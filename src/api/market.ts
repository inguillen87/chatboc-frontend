import { apiFetch } from '@/utils/api';
import {
  AddToCartPayload,
  CheckoutStartPayload,
  CheckoutStartResponse,
  MarketCartItem,
  MarketCartResponse,
  MarketCatalogResponse,
  MarketProduct,
} from '@/types/market';

const baseOptions = (slug: string) => ({
  omitCredentials: true,
  sendAnonId: true,
  omitChatSessionId: true,
  isWidgetRequest: true,
  tenantSlug: slug,
});

const normalizeProduct = (raw: any, index: number): MarketProduct => {
  const resolvedId = raw?.id ?? raw?.product_id ?? raw?.producto_id ?? raw?.slug ?? `product-${index}`;
  const resolvedName = raw?.name ?? raw?.nombre ?? raw?.title ?? `Producto ${index + 1}`;

  const parseNumber = (value: any): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(/,/g, '.'));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

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
    };
  });
};

const normalizeProductList = (rawItems: any[] | undefined | null): MarketProduct[] => {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((item, index) => normalizeProduct(item, index));
};

export async function fetchMarketCatalog(slug: string): Promise<MarketCatalogResponse> {
  const response = await apiFetch<any>(`/api/market/${encodeURIComponent(slug)}/catalog`, baseOptions(slug));
  const products = normalizeProductList(response?.products ?? response?.items ?? []);

  return {
    tenantName: response?.tenantName ?? response?.nombre ?? response?.tenant_name ?? undefined,
    tenantLogoUrl: response?.tenantLogoUrl ?? response?.logo ?? response?.tenant_logo_url ?? undefined,
    products,
  };
}

export async function fetchMarketCart(slug: string): Promise<MarketCartResponse> {
  const response = await apiFetch<any>(`/api/market/${encodeURIComponent(slug)}/cart`, baseOptions(slug));
  const items = normalizeCartItems(response?.items ?? response?.cart ?? []);

  return {
    items,
    totalAmount: response?.totalAmount ?? response?.total ?? response?.total_amount ?? null,
    totalPoints: response?.totalPoints ?? response?.puntos_totales ?? response?.total_points ?? null,
  };
}

export async function addMarketItem(slug: string, payload: AddToCartPayload): Promise<MarketCartResponse> {
  const response = await apiFetch<any>(`/api/market/${encodeURIComponent(slug)}/cart/add`, {
    ...baseOptions(slug),
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
}

export async function startMarketCheckout(
  slug: string,
  payload: CheckoutStartPayload,
): Promise<CheckoutStartResponse> {
  return apiFetch<CheckoutStartResponse>(`/api/market/${encodeURIComponent(slug)}/checkout/start`, {
    ...baseOptions(slug),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}
