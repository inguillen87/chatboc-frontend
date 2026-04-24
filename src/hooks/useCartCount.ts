import { useEffect, useMemo, useState } from 'react';
import { CART_EVENT_NAME, getLocalCartProducts } from '@/utils/localCart';
import { useTenant } from '@/context/TenantContext';
import { fetchMarketCart } from '@/api/market';

const calculateLocalCount = (): number => {
  try {
    return getLocalCartProducts().reduce((sum, item) => sum + (item.cantidad || 0), 0);
  } catch {
    return 0;
  }
};

export const useCartCount = (): number => {
  const { currentSlug } = useTenant();
  const [count, setCount] = useState<number>(() => calculateLocalCount());

  const handler = useMemo(() => () => setCount(calculateLocalCount()), []);

  // Sync with local storage events (for fallback/local mode)
  useEffect(() => {
    handler();
    window.addEventListener(CART_EVENT_NAME, handler as EventListener);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(CART_EVENT_NAME, handler as EventListener);
      window.removeEventListener('storage', handler);
    };
  }, [handler]);

  // Try to fetch server-side count if we have a tenant context (e.g. demo mode)
  useEffect(() => {
    if (!currentSlug) return;

    let active = true;
    fetchMarketCart(currentSlug)
      .then(cart => {
        if (active && cart.items) {
          const serverCount = cart.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
          // If server count is different, update.
          // Note: This might conflict with local updates if not careful,
          // but for the "Demo" experience where persistence is key, server truth is preferred.
          if (serverCount > 0) {
             setCount(serverCount);
          }
        }
      })
      .catch(() => {
        // Ignore errors, rely on local
      });

    return () => { active = false; };
  }, [currentSlug]);

  return count;
};

export default useCartCount;
