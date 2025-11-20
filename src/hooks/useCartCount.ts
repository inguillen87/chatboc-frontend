import { useEffect, useMemo, useState } from 'react';
import { CART_EVENT_NAME, getLocalCartProducts } from '@/utils/localCart';

const calculateCount = (): number => {
  try {
    return getLocalCartProducts().reduce((sum, item) => sum + (item.cantidad || 0), 0);
  } catch {
    return 0;
  }
};

export const useCartCount = (): number => {
  const [count, setCount] = useState<number>(() => calculateCount());

  const handler = useMemo(() => () => setCount(calculateCount()), []);

  useEffect(() => {
    handler();
    window.addEventListener(CART_EVENT_NAME, handler as EventListener);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(CART_EVENT_NAME, handler as EventListener);
      window.removeEventListener('storage', handler);
    };
  }, [handler]);

  return count;
};

export default useCartCount;
