import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/api/client';
import type { Order } from '@/types/unified';
import { assertOrderReceipt } from './orderLifecycle';

type Mutation = Parameters<typeof apiClient.adminUpdateOrder>[2];
/** Mount with a key made of tenant and order ID. No automatic mutation retries or list fallback. */
export function useAdminOrderSession(tenantSlug: string, id: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [requiresRefresh, setRequiresRefresh] = useState(false);
  const [dispatchInfo, setDispatchInfo] = useState<{ email?: string; phone?: string }>({});
  const alive = useRef(false), version = useRef(0), writeLock = useRef(false), readLock = useRef(false), refreshLock = useRef(false);
  const refresh = async () => {
    if (writeLock.current || readLock.current) return;
    const request = ++version.current;
    readLock.current = true; setLoading(true); setOrder(null); setError(''); setDispatchInfo({});
    try {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(tenantSlug) || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/.test(id)) throw new Error('Identidad inválida');
      const data = await apiClient.adminGetOrder(tenantSlug, id);
      if (!alive.current || request !== version.current) return;
      assertOrderReceipt(data, id, undefined, tenantSlug);
      setOrder(data); refreshLock.current = false; setRequiresRefresh(false);
      // Dispatch settings are auxiliary and never substitute the verified order detail.
      void apiClient.getFulfillmentConfig(tenantSlug).then((settings) => {
        if (alive.current && request === version.current && !refreshLock.current) setDispatchInfo({ email: settings?.tenant?.dispatch_email, phone: settings?.tenant?.dispatch_phone });
      }).catch(() => {});
    } catch {
      if (alive.current && request === version.current) {
        setOrder(null); refreshLock.current = true; setRequiresRefresh(true);
        setError('No pudimos verificar este pedido. No se muestran datos anteriores ni se habilitan cambios.');
      }
    } finally {
      if (request === version.current) { readLock.current = false; if (alive.current) setLoading(false); }
    }
  };
  useEffect(() => {
    alive.current = true; readLock.current = false; void refresh();
    return () => { alive.current = false; version.current += 1; };
  }, []);
  const mutate = async (payload: Mutation): Promise<Order | null> => {
    if (!order || writeLock.current || readLock.current || refreshLock.current) return null;
    writeLock.current = true; setBusy(true); setError('');
    const request = version.current;
    try {
      const data = await apiClient.adminUpdateOrder(tenantSlug, id, payload);
      if (!alive.current || request !== version.current) return null;
      assertOrderReceipt(data, id, payload.status, tenantSlug);
      setOrder(data); return data;
    } catch (failure) {
      if (!alive.current || request !== version.current) return null;
      refreshLock.current = true; setRequiresRefresh(true);
      const status = Number((failure as { status?: number } | null)?.status);
      if ([401, 403, 404].includes(status)) { setOrder(null); setDispatchInfo({}); }
      setError('No se confirmó el cambio. No se reenviará automáticamente. Actualizá y revisá el estado antes de volver a intentar.');
      throw failure;
    } finally {
      writeLock.current = false;
      if (alive.current && request === version.current) setBusy(false);
    }
  };
  return { order, loading, busy, error, requiresRefresh, dispatchInfo, refresh, mutate };
}
