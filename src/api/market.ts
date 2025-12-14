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
import { MOCK_CATALOGS } from '@/data/mockCatalogs';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

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

// Helper to mock a cart response from default products
const mockCartResponse = (): MarketCartResponse => {
  return loadLocalDemoCart();
};

// Helper to mock catalog response
const mockCatalogResponse = (tenantSlug?: string): MarketCatalogResponse => {
  let sourceProducts = DEFAULT_PUBLIC_PRODUCTS;

  if (tenantSlug) {
      // Find matching mock catalog key
      const key = Object.keys(MOCK_CATALOGS).find(k => tenantSlug.includes(k));
      if (key) {
          sourceProducts = MOCK_CATALOGS[key];
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
    return mockCatalogResponse(tenantSlug);
  }
}

export async function addMarketItem(tenantSlug: string, payload: AddToCartPayload): Promise<MarketCartResponse> {
  try {
      // Ensure we send the correct Content-Type and handle the response correctly
      return await apiFetch<MarketCartResponse>(`/api/${tenantSlug}/carrito`, {
        method: 'POST',
        body: payload,
        tenantSlug,
        omitChatSessionId: true,
        // Explicitly request session persistence if needed by the backend
        headers: { 'X-Persist-Session': 'true' }
      });
  } catch (error) {
     if (error instanceof ApiError && ([401, 403, 404].includes(error.status) || error.status >= 500)) {
        // Fallback to local demo cart logic
        const currentCart = loadLocalDemoCart();

        let product = DEFAULT_PUBLIC_PRODUCTS.find(p => String(p.id) === payload.productId);

        // Fallback to mock catalogs search if not in default
        if (!product) {
            for (const key in MOCK_CATALOGS) {
                const found = MOCK_CATALOGS[key].find(p => String(p.id) === payload.productId);
                if (found) {
                    product = found;
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
                    price: price,
                    quantity: qty,
                    imageUrl: product.imagen_url || null,
                    currency: 'ARS',
                    points: product.precio_puntos || null,
                    priceText: null
                });
            }

            // Recalculate totals
            currentCart.totalAmount = currentCart.items.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0);
            currentCart.totalPoints = currentCart.items.reduce((sum, item) => sum + ((item.points || 0) * item.quantity), 0);

            saveLocalDemoCart(currentCart);
            return currentCart;
        }
     }
     throw error;
  }
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
