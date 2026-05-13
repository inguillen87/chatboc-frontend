import { useEffect, useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { fetchMarketCart } from '@/api/market';

export const useCartCount = (): number => {
  const { currentSlug } = useTenant();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!currentSlug) {
      setCount(0);
      return;
    }

    let active = true;
    fetchMarketCart(currentSlug)
      .then((cart) => {
        if (!active) return;
        const serverCount = (cart.items ?? []).reduce((sum, item) => sum + (item.quantity || 0), 0);
        setCount(serverCount);
      })
      .catch(() => {
        if (active) setCount(0);
      });

    return () => {
      active = false;
    };
  }, [currentSlug]);

  return count;
};

export default useCartCount;
