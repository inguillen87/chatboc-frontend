import React from 'react';
import { SessionAuthorityProvider, useSessionAuthority } from '@/components/access/SessionAuthorityContext';

// Browser-fixture identity only. No credentials, authentication service or production records.
// Vite aliases only useUser; the runtime session provider and private-scope hook remain real.
interface SyntheticProfile {
  user: { id: number; rol: string; tipo_chat: 'municipio'; tenant_slug: string; tenant_id: number; organization_profile: { tenant: { id: number; slug: string } } } | null;
  organizationProfileVerified: boolean;
}
const SyntheticProfileContext = React.createContext<SyntheticProfile>({ user: null, organizationProfileVerified: false });

export function SyntheticAnalyticsSessionProvider({ children, tenantSlug, tenantId, verified, profileVerified }: {
  children: React.ReactNode; tenantSlug: string; tenantId: number; verified: boolean; profileVerified: boolean;
}) {
  const user = { id: 9007, rol: 'tenant_admin', tipo_chat: 'municipio' as const, tenant_slug: tenantSlug, tenant_id: tenantId,
    organization_profile: { tenant: { id: tenantId, slug: tenantSlug } } };
  return <SessionAuthorityProvider value={{ clerkStatus: verified ? 'ready' : 'signed_out', hasBearerSession: false, hasVerifiedSession: verified }}>
    <SyntheticProfileContext.Provider value={{ user, organizationProfileVerified: profileVerified }}>{children}</SyntheticProfileContext.Provider>
  </SessionAuthorityProvider>;
}

export function useUser() {
  const profile = React.useContext(SyntheticProfileContext);
  const authority = useSessionAuthority();
  return { ...profile, ...authority, loading: false };
}
