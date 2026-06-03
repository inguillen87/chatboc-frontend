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

const normalizeCapabilities = (raw: unknown): string[] => {
  if (!Array.isArray(raw)) return [];

  return Array.from(
    new Set(raw.map(normalizeCapabilityToken).filter((value): value is string => Boolean(value))),
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
