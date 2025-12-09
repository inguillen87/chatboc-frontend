import { apiFetch, ApiError } from '@/utils/api';
import {
  MarketCartResponse,
  MarketCatalogResponse,
  MarketCartItem,
  AddToCartPayload,
  CheckoutStartResponse,
  CheckoutStartPayload
} from '@/types/market';
import { DEFAULT_PUBLIC_PRODUCTS } from '@/data/defaultProducts';

// Helper to mock a cart response from default products
const mockCartResponse = (): MarketCartResponse => {
  return {
    items: [],
    totalAmount: 0,
    totalPoints: 0,
    isDemo: true,
  };
};

// Helper to mock catalog response
const mockCatalogResponse = (): MarketCatalogResponse => {
  const products = DEFAULT_PUBLIC_PRODUCTS.map(p => ({
    id: String(p.id),
    name: p.nombre,
    description: p.descripcion ?? null,
    descriptionShort: null,
    price: typeof p.precio_unitario === 'number' ? p.precio_unitario : parseFloat(String(p.precio_unitario || 0)),
    priceText: null,
    currency: 'ARS',
    modality: p.modalidad ?? 'venta',
    points: p.precio_puntos ?? null,
    imageUrl: p.imagen_url ?? null,
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

export async function fetchMarketCart(tenantSlug: string): Promise<MarketCartResponse> {
  try {
    return await apiFetch<MarketCartResponse>(`/api/${tenantSlug}/carrito`, {
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      // Return empty demo cart on auth, not found or server failures so the UI can continue with local cart logic
      if ([401, 403, 404].includes(error.status) || error.status >= 500) {
        return mockCartResponse();
      }
    }
    throw error;
  }
}

export async function fetchMarketCatalog(tenantSlug: string): Promise<MarketCatalogResponse> {
  try {
    return await apiFetch<MarketCatalogResponse>(`/api/${tenantSlug}/productos`, {
      tenantSlug,
      suppressPanel401Redirect: true,
      omitChatSessionId: true,
    });
  } catch (error) {
    console.warn(`[MarketAPI] Failed to fetch catalog for ${tenantSlug}, using mock.`, error);
    return mockCatalogResponse();
  }
}

export async function addMarketItem(tenantSlug: string, payload: AddToCartPayload): Promise<MarketCartResponse> {
  // Ensure we send the correct Content-Type and handle the response correctly
  return await apiFetch<MarketCartResponse>(`/api/${tenantSlug}/carrito`, {
    method: 'POST',
    body: payload,
    tenantSlug,
    omitChatSessionId: true,
    // Explicitly request session persistence if needed by the backend
    headers: { 'X-Persist-Session': 'true' }
  });
}

export async function removeMarketItem(tenantSlug: string, itemId: string): Promise<MarketCartResponse> {
  return await apiFetch<MarketCartResponse>(`/api/${tenantSlug}/carrito/${itemId}`, {
    method: 'DELETE',
    tenantSlug,
    omitChatSessionId: true,
  });
}

export async function startMarketCheckout(tenantSlug: string, payload: CheckoutStartPayload): Promise<CheckoutStartResponse> {
  return await apiFetch<CheckoutStartResponse>(`/api/${tenantSlug}/checkout`, {
    method: 'POST',
    body: payload,
    tenantSlug,
    omitChatSessionId: true,
  });
}
