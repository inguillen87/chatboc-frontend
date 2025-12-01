import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { MarketCartItem, MarketCartResponse } from '@/types/market';
import { addMarketItem, fetchMarketCart } from '@/api/market';

interface MarketCartContextValue {
  items: MarketCartItem[];
  totalAmount: number | null;
  totalPoints: number | null;
  isLoading: boolean;
  error: string | null;
  refreshCart: () => Promise<void>;
  addItem: (productId: string, quantity?: number) => Promise<void>;
}

const MarketCartContext = createContext<MarketCartContextValue | undefined>(undefined);

interface ProviderProps {
  tenantSlug: string | null;
  children: ReactNode;
}

const normalizeCartItems = (raw: any): MarketCartItem[] => {
  if (!Array.isArray(raw)) return [];

  return raw.map((item, index) => {
    const id = item?.id ?? item?.product_id ?? `product-${index}`;
    return {
      id: String(id),
      name: item?.name ?? item?.nombre ?? 'Producto',
      quantity: typeof item?.quantity === 'number' ? item.quantity : 1,
      price: typeof item?.price === 'number' ? item.price : null,
      points: typeof item?.points === 'number' ? item.points : null,
      imageUrl: item?.imageUrl ?? item?.imagen ?? null,
    };
  });
};

export function MarketCartProvider({ tenantSlug, children }: ProviderProps) {
  const [items, setItems] = useState<MarketCartItem[]>([]);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshCart = useCallback(async () => {
    if (!tenantSlug) {
      setItems([]);
      setTotalAmount(null);
      setTotalPoints(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchMarketCart(tenantSlug);
      const resolvedItems = normalizeCartItems(response?.items ?? []);
      setItems(resolvedItems);
      setTotalAmount(response?.totalAmount ?? null);
      setTotalPoints(response?.totalPoints ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el carrito.');
    } finally {
      setIsLoading(false);
    }
  }, [tenantSlug]);

  const addItem = useCallback(
    async (productId: string, quantity = 1) => {
      if (!tenantSlug) return;
      setIsLoading(true);
      setError(null);
      try {
        const response = await addMarketItem(tenantSlug, { productId, quantity });
        const resolvedItems = normalizeCartItems(response?.items ?? []);
        setItems(resolvedItems);
        setTotalAmount(response?.totalAmount ?? null);
        setTotalPoints(response?.totalPoints ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo agregar el producto.');
      } finally {
        setIsLoading(false);
      }
    },
    [tenantSlug],
  );

  useEffect(() => {
    refreshCart().catch(() => {});
  }, [refreshCart]);

  const value = useMemo<MarketCartContextValue>(
    () => ({ items, totalAmount, totalPoints, isLoading, error, refreshCart, addItem }),
    [items, totalAmount, totalPoints, isLoading, error, refreshCart, addItem],
  );

  return <MarketCartContext.Provider value={value}>{children}</MarketCartContext.Provider>;
}

export function useMarketCart() {
  const ctx = useContext(MarketCartContext);
  if (!ctx) {
    throw new Error('useMarketCart debe usarse dentro de MarketCartProvider');
  }
  return ctx;
}
