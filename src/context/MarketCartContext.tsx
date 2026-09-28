import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';

import type {
  MarketCartItem,
  MarketCartResponse,
  MarketCheckoutOptions,
  MarketCheckoutPreview,
  MarketCommercialState,
  MarketContinuity,
  MarketCustomerProfile,
} from '@/types/market';
import { addMarketItem, fetchMarketCart } from '@/api/market';
import { persistStoredCart, readStoredCart } from '@/utils/marketStorage';
import { sanitizePublicInternalNavigationPath } from '@/utils/tenantPaths';

interface MarketCartContextValue {
  items: MarketCartItem[];
  totalAmount: number | null;
  totalPoints: number | null;
  isLoading: boolean;
  error: string | null;
  customerProfile: MarketCustomerProfile | null;
  commercialState: MarketCommercialState | null;
  continuity: MarketContinuity | null;
  checkoutOptions: MarketCheckoutOptions | null;
  checkoutPreview: MarketCheckoutPreview | null;
  mercadopagoReady: boolean | null;
  refreshCart: () => Promise<void>;
  addItem: (productId: string, quantity?: number) => Promise<boolean>;
}

const MarketCartContext = createContext<MarketCartContextValue | undefined>(undefined);

interface ProviderProps {
  tenantSlug: string | null;
  children: ReactNode;
}

const normalizeCartItems = (raw: any): MarketCartItem[] => {
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const catalogoItemId = item?.catalogo_item_id ?? item?.catalog_item_id ?? item?.product_id ?? item?.productId ?? item?.id ?? null;
    const id = item?.id ?? item?.product_id ?? item?.productId ?? item?.catalogo_item_id ?? item?.catalog_item_id ?? `product-${index}`;
    const quantity =
      typeof item?.quantity === 'number'
        ? item.quantity
        : typeof item?.cantidad === 'number'
          ? item.cantidad
          : 1;
    return {
      ...item,
      id: String(id),
      catalogo_item_id: catalogoItemId,
      catalog_item_id: catalogoItemId,
      product_id: item?.product_id ?? item?.productId ?? catalogoItemId,
      line_id: item?.line_id ?? item?.cart_item_id ?? item?.cartItemId ?? null,
      name: item?.name ?? item?.nombre ?? 'Producto',
      quantity,
      price: typeof item?.price === 'number' ? item.price : null,
      points: typeof item?.points === 'number' ? item.points : null,
      imageUrl: item?.imageUrl ?? item?.imagen ?? null,
      priceText:
        item?.priceText ??
        item?.precio_texto ??
        item?.price_text ??
        (typeof item?.precio === 'string' ? item.precio : null),
      currency: typeof item?.currency === 'string' ? item.currency : item?.moneda ?? null,
    };
  });
};

type CartSnapshot = Omit<MarketCartContextValue, 'isLoading' | 'error' | 'refreshCart' | 'addItem'>;
type Operation<T> = { id: number; generation: number; promise: Promise<T> };
const emptySnapshot = (): CartSnapshot => ({
  items: [], totalAmount: null, totalPoints: null, customerProfile: null,
  commercialState: null, continuity: null, checkoutOptions: null,
  checkoutPreview: null, mercadopagoReady: null,
});
const snapshotFromResponse = (response: MarketCartResponse): CartSnapshot => ({
  items: normalizeCartItems(response.items),
  totalAmount: response.totalAmount ?? null, totalPoints: response.totalPoints ?? null,
  customerProfile: response.customer_profile ?? null,
  commercialState: response.commercial_state ?? null, continuity: response.continuity ?? null,
  checkoutOptions: response.checkout_options ?? null, checkoutPreview: response.checkout_preview ?? null,
  mercadopagoReady: response.mercadopago_ready ?? null,
});

const hasSafeTenantPath = (tenantSlug: string | null): boolean => {
  if (!tenantSlug) return false;
  try {
    // Apply the existing Unicode-aware public-navigation contract without
    // changing the tenant identity forwarded to the API or browser storage.
    return Boolean(sanitizePublicInternalNavigationPath(`/t/${encodeURIComponent(tenantSlug)}/market`));
  } catch {
    return false;
  }
};

export function MarketCartProvider({ tenantSlug, children }: ProviderProps) {
  const { pathname } = useLocation();
  const disabled = !hasSafeTenantPath(tenantSlug) ||
    /^\/(?:t\/[^/]+\/|[^/]+\/)?(?:admin|analytics|municipal)(?:\/|$)/.test(pathname);
  // Enforce isolation here: catalog/product consumers need no separate key.
  return <MarketCartSession key={JSON.stringify([tenantSlug, disabled])} tenantSlug={tenantSlug} disabled={disabled}>
    {children}
  </MarketCartSession>;
}

function MarketCartSession({ tenantSlug, disabled, children }: ProviderProps & { disabled: boolean }) {
  const [snapshot, setSnapshot] = useState<CartSnapshot>(() => {
    if (disabled || !tenantSlug) return emptySnapshot();
    const cached = readStoredCart(tenantSlug);
    // Browser storage is only a display draft. It never supplies checkout policy,
    // customer identity or a payment capability, and can contain malformed JSON.
    if (!cached || typeof cached !== 'object' || !Array.isArray(cached.items)) return emptySnapshot();
    return { ...emptySnapshot(), items: normalizeCartItems(cached.items),
      totalAmount: typeof cached.totalAmount === 'number' && Number.isFinite(cached.totalAmount) ? cached.totalAmount : null,
      totalPoints: typeof cached.totalPoints === 'number' && Number.isFinite(cached.totalPoints) ? cached.totalPoints : null,
    };
  });
  const [isLoading, setIsLoading] = useState(!disabled);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(false), generation = useRef(0), sequence = useRef(0);
  const reader = useRef<Operation<void> | null>(null);
  const writer = useRef<Operation<boolean> | null>(null);
  const current = useCallback((op: { id: number; generation: number }) =>
    active.current && op.generation === generation.current && op.id === sequence.current, []);

  const accept = useCallback((response: MarketCartResponse) => {
    if (!response || !Array.isArray(response.items)) throw new Error();
    const next = snapshotFromResponse(response);
    setSnapshot(next);
    if (tenantSlug) persistStoredCart(tenantSlug, {
      items: next.items, totalAmount: next.totalAmount, totalPoints: next.totalPoints,
    });
  }, [tenantSlug]);
  const reject = useCallback((reason: unknown, fallback: string) => {
    // Discard the rejected display snapshot, not the server-side cart. A failed
    // read must not leave previous customer/checkout authority usable in this view.
    setSnapshot(emptySnapshot());
    if (tenantSlug) persistStoredCart(tenantSlug, { items: [], totalAmount: null, totalPoints: null });
    setError(reason instanceof Error && reason.message ? reason.message : fallback);
  }, [tenantSlug]);

  const refreshCart = useCallback((): Promise<void> => {
    if (!active.current || disabled || !tenantSlug) return Promise.resolve();
    const requestedGeneration = generation.current;
    if (writer.current) {
      // An explicit refresh while adding waits for the write, then reads once.
      // It never starts a read which can replace that write with an older cart.
      return writer.current.promise.then(() => {
        if (active.current && generation.current === requestedGeneration) return refreshCart();
      });
    }
    if (reader.current && current(reader.current)) return reader.current.promise;
    const op: Operation<void> = { id: ++sequence.current, generation: requestedGeneration, promise: Promise.resolve() };
    reader.current = op;
    setIsLoading(true); setError(null);
    op.promise = Promise.resolve().then(async () => {
      if (!current(op)) return;
      try {
        const response = await fetchMarketCart(tenantSlug);
        if (current(op)) accept(response);
      } catch (reason) {
        if (current(op)) reject(reason, 'No se pudo cargar el carrito.');
      } finally {
        if (reader.current === op) reader.current = null;
        if (current(op)) setIsLoading(false);
      }
    });
    return op.promise;
  }, [accept, current, disabled, reject, tenantSlug]);

  const addItem = useCallback((productId: string, quantity = 1): Promise<boolean> => {
    if (!active.current || disabled || !tenantSlug || writer.current ||
      typeof productId !== 'string' || !productId.trim() || !Number.isFinite(quantity) || quantity <= 0) {
      return Promise.resolve(false);
    }
    const op: Operation<boolean> = { id: ++sequence.current, generation: generation.current, promise: Promise.resolve(false) };
    writer.current = op; // Synchronous guard, before the button's React state changes.
    setIsLoading(true); setError(null);
    op.promise = Promise.resolve().then(async () => {
      if (!current(op)) return false;
      try {
        const response = await addMarketItem(tenantSlug, { productId, quantity });
        if (!current(op)) return false;
        accept(response);
        return true;
      } catch (reason) {
        if (current(op)) reject(reason, 'No se pudo agregar el producto.');
        return false;
      } finally {
        if (writer.current === op) writer.current = null;
        if (current(op)) setIsLoading(false);
      }
    });
    return op.promise;
  }, [accept, current, disabled, reject, tenantSlug]);

  useEffect(() => {
    active.current = true;
    void refreshCart();
    return () => {
      active.current = false;
      generation.current += 1;
      sequence.current += 1;
      reader.current = null;
      writer.current = null;
    };
  }, [refreshCart]);

  const value = useMemo<MarketCartContextValue>(() => ({ ...snapshot, isLoading, error, refreshCart, addItem }),
    [snapshot, isLoading, error, refreshCart, addItem]);
  return <MarketCartContext.Provider value={value}>{children}</MarketCartContext.Provider>;
}

export function useMarketCart() {
  const ctx = useContext(MarketCartContext);
  if (!ctx) {
    throw new Error('useMarketCart debe usarse dentro de MarketCartProvider');
  }
  return ctx;
}
