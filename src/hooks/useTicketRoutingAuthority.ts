import { useCallback, useEffect, useMemo, useState } from 'react';

import { getEmployeeRoutingV2, type EmployeeRoutingV2 } from '@/api/v2/saas';
import {
  getTicketRoutingIdentity,
  resolveTicketRoutingAuthority,
  type TicketRoutingAuthorityResolution,
} from '@/components/tickets/ticketRoutingAuthority';
import { useTenant } from '@/context/TenantContext';
import type { Ticket } from '@/types/tickets';
import { getErrorMessage } from '@/utils/api';

const ROUTING_CACHE_TTL_MS = 30_000;
const routingCache = new Map<string, { value: EmployeeRoutingV2; loadedAt: number }>();
const routingRequests = new Map<string, Promise<EmployeeRoutingV2>>();

const routingCacheKey = (tenantSlug?: string | null) =>
  String(tenantSlug || '__session_tenant__').trim().toLowerCase();

const normalizedTenantSlug = (value?: string | null) =>
  String(value ?? '').trim().toLowerCase();

const loadRouting = async (
  tenantSlug?: string | null,
  force = false,
): Promise<EmployeeRoutingV2> => {
  const key = routingCacheKey(tenantSlug);
  const cached = routingCache.get(key);
  if (!force && cached && Date.now() - cached.loadedAt < ROUTING_CACHE_TTL_MS) {
    return cached.value;
  }

  const pending = routingRequests.get(key);
  if (!force && pending) return pending;

  const request = getEmployeeRoutingV2(tenantSlug).then((value) => {
    routingCache.set(key, { value, loadedAt: Date.now() });
    return value;
  }).finally(() => {
    routingRequests.delete(key);
  });
  routingRequests.set(key, request);
  return request;
};

export const clearTicketRoutingAuthorityCache = (tenantSlug?: string | null) => {
  routingCache.delete(routingCacheKey(tenantSlug));
};

export interface TicketRoutingAuthorityState {
  loading: boolean;
  error: string | null;
  resolution: TicketRoutingAuthorityResolution | null;
  routing: EmployeeRoutingV2 | null;
  refresh: () => Promise<void>;
}

export const useTicketRoutingAuthority = (
  ticket: Ticket | null,
): TicketRoutingAuthorityState => {
  const { currentSlug } = useTenant();
  const [routing, setRouting] = useState<EmployeeRoutingV2 | null>(null);
  const [loading, setLoading] = useState(Boolean(ticket));
  const [error, setError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const ticketIdentity = getTicketRoutingIdentity(ticket);
  const ticketTenantSlug = normalizedTenantSlug(ticket?.tenant_slug);
  const contextTenantSlug = normalizedTenantSlug(currentSlug);
  const tenantConflict = Boolean(
    ticketTenantSlug && contextTenantSlug && ticketTenantSlug !== contextTenantSlug,
  );
  const routingTenantSlug = ticketTenantSlug || contextTenantSlug || null;

  useEffect(() => {
    let active = true;
    if (!ticket || !ticketIdentity) {
      setRouting(null);
      setLoading(false);
      setError(null);
      return () => {
        active = false;
      };
    }
    if (tenantConflict) {
      setRouting(null);
      setLoading(false);
      setError('El caso no pertenece al tenant operativo seleccionado.');
      return () => {
        active = false;
      };
    }
    setLoading(true);
    setError(null);
    loadRouting(routingTenantSlug)
      .then((value) => {
        if (active) setRouting(value);
      })
      .catch((requestError) => {
        if (!active) return;
        setRouting(null);
        setError(getErrorMessage(requestError, 'No se pudo verificar la autoridad de asignación.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadVersion, routingTenantSlug, tenantConflict, ticketIdentity]);

  const resolution = useMemo(
    () => (ticket ? resolveTicketRoutingAuthority(routing, ticket) : null),
    [routing, ticket],
  );

  const refresh = useCallback(async () => {
    clearTicketRoutingAuthorityCache(routingTenantSlug);
    setReloadVersion((value) => value + 1);
  }, [routingTenantSlug]);

  return { loading, error, resolution, routing, refresh };
};

export default useTicketRoutingAuthority;
