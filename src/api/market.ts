import { apiFetch, ApiError, NetworkError } from '@/utils/api';
import {
  MarketCartResponse,
  MarketCatalogResponse,
  MarketCartItem,
  AddToCartPayload,
  CheckoutStartResponse,
  CheckoutStartPayload
} from '@/types/market';
import { DEFAULT_PUBLIC_PRODUCTS } from '@/data/defaultProducts';
import { DEMO_CATALOGS as MOCK_CATALOGS } from '@/data/mockCatalogs';
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

const DEMO_KEYWORDS = ['bodega', 'ferreteria', 'almacen', 'kiosco', 'farmacia', 'restaurante', 'tienda', 'logistica', 'seguros', 'fintech', 'inmobiliaria', 'industria', 'clinica', 'medico', 'local_comercial'];

const isDemoTenant = (slug: string) => {
  if (slug === 'municipio' || slug === 'demo-municipio') return true;
  return DEMO_KEYWORDS.some(k => slug.includes(k));
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
        throw new Error('Producto demo no encontrado');
  };

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
     const status = (error as any).status;
     if ((error instanceof ApiError || error instanceof NetworkError) && (!status || [400, 401, 403, 404].includes(status) || status >= 500)) {
        return addToLocalCart();
     }
     throw error;
  }
}

export async function removeMarketItem(tenantSlug: string, itemId: string): Promise<MarketCartResponse> {
  try {
      return await apiFetch<MarketCartResponse>(`/api/${tenantSlug}/carrito/${itemId}`, {
        method: 'DELETE',
        tenantSlug,
        omitChatSessionId: true,
      });
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

export async function startMarketCheckout(tenantSlug: string, payload: CheckoutStartPayload): Promise<CheckoutStartResponse> {
  try {
      return await apiFetch<CheckoutStartResponse>(`/api/${tenantSlug}/checkout`, {
        method: 'POST',
        body: payload,
        tenantSlug,
        omitChatSessionId: true,
      });
  } catch (error) {
      // If server checkout fails, treat as demo success if tenant is known demo
      if (isDemoTenant(tenantSlug) || (error as any)?.status === 404 || (error as any)?.status >= 500) {
          return { status: 'demo' };
      }
      throw error;
  }
}
