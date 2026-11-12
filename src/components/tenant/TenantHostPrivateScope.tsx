import type { ReactElement } from 'react';
import { useTenantContextPresence } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { useSessionAuthority } from '@/components/access/SessionAuthorityContext';
import { ViewState } from '@/components/app-shell/ViewState';
import { readVerifiedOrganizationIdentity } from '@/utils/verifiedOrganizationIdentity';

/** A public domain binding never grants private access or replaces the actor's organization. */
export function TenantHostPrivateScope({ children }: { children: ReactElement }) {
  const binding = useTenantContextPresence()?.hostBinding;
  const { user, loading, organizationProfileVerified } = useUser();
  const { hasVerifiedSession } = useSessionAuthority();
  if (!binding) return children;
  if (loading) return <ViewState status="loading" title="Validando acceso institucional" />;
  const identity = readVerifiedOrganizationIdentity(user, {
    hasVerifiedSession, loading, profileVerified: organizationProfileVerified === true,
  });
  if (!identity || identity.tenantId !== binding.tenant.id || identity.tenantSlug !== binding.tenant.slug) {
    return <ViewState status="denied" title="Esta cuenta no corresponde a este espacio"
      description="Ingresá con una cuenta de esta organización o usá el acceso central para abrir tu espacio."
      action={<a className="inline-flex min-h-11 items-center rounded-lg border px-4 py-2 text-sm font-semibold" href="https://www.chatboc.ar/login">Ir al acceso central</a>} />;
  }
  return children;
}
