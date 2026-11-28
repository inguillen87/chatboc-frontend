import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTenant } from '@/context/TenantContext';
import { fetchMarketCart } from '@/api/market';
import { subscribeMarketCartChanges } from '@/utils/marketStorage';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent, subscribeChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

type CountScope = { tenantSlug: string | null; enabled: boolean; sessionRevision: number };

export const useCartCount = (enabled = true): number => {
  const { currentSlug } = useTenant();
  const sessionRevision = useSyncExternalStore(subscribeChatbocSessionRevision, captureChatbocSessionRevision, captureChatbocSessionRevision);
  const owner = useRef<CountScope>({ tenantSlug: currentSlug, enabled, sessionRevision });
  if (owner.current.tenantSlug !== currentSlug || owner.current.enabled !== enabled || owner.current.sessionRevision !== sessionRevision) {
    owner.current = { tenantSlug: currentSlug, enabled, sessionRevision };
  }
  const scope = owner.current;
  const [snapshot, setSnapshot] = useState<{ scope: CountScope; count: number } | null>(null);

  useEffect(() => {
    if (!scope.enabled || !scope.tenantSlug) return;
    let active = true;
    let sequence = 0;
    let scheduled = false;
    const current = () => active && owner.current === scope && isChatbocSessionRevisionCurrent(scope.sessionRevision);
    const read = () => {
      if (!current()) return;
      const request = ++sequence;
      void fetchMarketCart(scope.tenantSlug!)
        .then((cart) => {
          if (!current() || request !== sequence) return;
          const count = (cart.items ?? []).reduce((sum, item) =>
            sum + (Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 0), 0);
          setSnapshot({ scope, count });
        })
        .catch((reason) => {
          if (!current() || request !== sequence) return;
          // A read cut short while the cart is being written keeps the last
          // count and asks again shortly; only a real failure clears it.
          if (reason instanceof DOMException && reason.name === 'AbortError') {
            window.setTimeout(() => { if (current() && request === sequence) read(); }, 400);
            return;
          }
          setSnapshot({ scope, count: 0 });
        });
    };
    const unsubscribe = subscribeMarketCartChanges((change) => {
      if (!current() || change.tenantSlug !== scope.tenantSlug || change.sessionRevision !== scope.sessionRevision) return;
      // Retire an older GET immediately; a mutation never supplies count data.
      sequence += 1;
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => { scheduled = false; read(); });
    });
    read();

    return () => {
      active = false;
      sequence += 1;
      unsubscribe();
    };
  }, [scope]);

  // Withdraw old scope data during render, including A -> B -> A and logout/login.
  return enabled && currentSlug && snapshot?.scope === scope ? snapshot.count : 0;
};

export default useCartCount;
