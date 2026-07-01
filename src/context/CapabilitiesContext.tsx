import React, { createContext, useContext, useMemo } from 'react';

import { useUser } from '@/hooks/useUser';

interface CapabilitiesContextValue {
  capabilities: string[];
  hasCapability: (capability: string) => boolean;
  hasAllCapabilities: (required: string[]) => boolean;
  hasAnyCapability: (required: string[]) => boolean;
}

const CapabilitiesContext = createContext<CapabilitiesContextValue>({
  capabilities: [],
  hasCapability: () => false,
  hasAllCapabilities: () => false,
  hasAnyCapability: () => false,
});

const normalizeCapabilityToken = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const CAPABILITY_ALIASES: Record<string, string[]> = {
  'analytics.read': ['dashboard.read', 'reports.read', 'stats.read'],
  'market.catalog.read': ['catalog.read', 'catalogo.read', 'inventory.read'],
  'market.catalog.write': ['catalog.write', 'catalog.manage', 'inventory.write'],
  'market.orders.read': ['orders.read', 'commerce.orders.read', 'pedidos.read'],
  'market.orders.write': ['orders.write', 'commerce.orders.write', 'pedidos.write'],
  'tickets.read': ['crm.tickets.read', 'tickets.admin', 'crm.tickets.admin', 'claims.read', 'claims.admin', 'reclamos.read', 'reclamos.admin', 'crm_reclamos', 'tickets_read'],
  'tickets.write': ['crm.tickets.write', 'claims.write', 'reclamos.write', 'tickets_update'],
  'tickets.assign': ['crm.tickets.assign', 'claims.assign', 'reclamos.assign', 'tickets_assign'],
  'tickets.admin': ['crm.tickets.admin', 'claims.admin', 'reclamos.admin'],
};

const resolveCanonicalCapability = (token: string): string => {
  for (const [canonical, aliases] of Object.entries(CAPABILITY_ALIASES)) {
    if (token === canonical || aliases.includes(token)) {
      return canonical;
    }
  }

  return token;
};

const normalizeCapabilities = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];

  return Array.from(
    new Set(
      raw.flatMap((value) => {
        const token = normalizeCapabilityToken(value);
        if (!token) return [];
        const canonical = resolveCanonicalCapability(token);
        return canonical === token ? [token] : [token, canonical];
      }),
    ),
  );
};

export const CapabilitiesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();

  const capabilities = useMemo(() => {
    const combined = [
      ...normalizeCapabilities(user?.permissions),
      ...normalizeCapabilities(user?.capabilities),
      ...normalizeCapabilities(user?.scopes),
    ];

    return Array.from(new Set(combined));
  }, [user?.capabilities, user?.permissions, user?.scopes]);

  const value = useMemo<CapabilitiesContextValue>(
    () => ({
      capabilities,
      hasCapability: (capability: string) => capabilities.includes(normalizeCapabilityToken(capability)),
      hasAllCapabilities: (required: string[]) => {
        const normalizedRequired = normalizeCapabilities(required);
        return normalizedRequired.length > 0 && normalizedRequired.every((capability) => capabilities.includes(capability));
      },
      hasAnyCapability: (required: string[]) => normalizeCapabilities(required).some((capability) => capabilities.includes(capability)),
    }),
    [capabilities],
  );

  return <CapabilitiesContext.Provider value={value}>{children}</CapabilitiesContext.Provider>;
};

export const useCapabilities = () => useContext(CapabilitiesContext);
