import React from 'react';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { useLocation, useParams } from 'react-router-dom';
import { useSessionAuthority, buildVerifiedSessionScopeKey } from '@/components/access/SessionAuthorityContext';
import { ViewState } from '@/components/app-shell/ViewState';
import { Button } from '@/components/ui/button';
import { exactInstitutionSlug } from '@/utils/publishedTenantIdentity';
import { readAuthenticatedPrivateTenantSlug } from '@/utils/privateWorkspaceIdentity';
import { TENANT_PLACEHOLDER_SLUGS } from '@/constants/tenant';
import { hasRequiredRole } from '@/utils/roles';
import PedidosPage from '@/pages/PedidosPage'; // Classic/Municipal
import PymePedidosPage from '@/pages/pyme/pedidos/PedidosPage'; // New/Pyme

const SmartPedidosWrapper: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { tenant, isLoadingTenant, tenantError } = useTenant();
  const { user, loading, hasVerifiedSession, organizationProfileVerified, refreshUser } = useUser();
  const { clerkStatus } = useSessionAuthority();
  const location = useLocation();
  const { tenant: routeTenant } = useParams();
  const failure = <ViewState status="error" title="No pudimos validar la organización de los pedidos"
    action={<Button onClick={() => void refreshUser()}>Reintentar</Button>} />;
  if (loading || clerkStatus === 'loading' || clerkStatus === 'syncing') return <ViewState status="loading" title="Validando acceso" />;
  if (!hasVerifiedSession || !organizationProfileVerified || !user || !hasRequiredRole(user.rol || user.role, ['tenant_admin', 'employee', 'superadmin'])) return failure;

  const query = new URLSearchParams(location.search);
  const supplied = [routeTenant, ...['tenant', 'tenant_slug', 'tenantSlug', 'endpoint'].flatMap(key => query.getAll(key))].filter(value => value !== undefined);
  const requested = supplied.map(exactInstitutionSlug);
  if (requested.some(slug => !slug || TENANT_PLACEHOLDER_SLUGS.has(slug)) || new Set(requested).size > 1) return failure;
  const selection = requested[0] || null;
  const platform = hasRequiredRole(user.rol || user.role, ['superadmin']);
  const actorTenant = readAuthenticatedPrivateTenantSlug(user);
  const tenantSlug = platform ? selection : actorTenant;
  if (!tenantSlug || (!platform && selection && selection !== actorTenant)) return failure;

  // Platform selection is explicit; public metadata supplies its type only.
  if (platform && isLoadingTenant) return <ViewState status="loading" title="Validando organización" />;
  if (platform && (tenantError || exactInstitutionSlug(tenant?.slug) !== tenantSlug)) return failure;
  const type = platform ? tenant?.tipo : user.tipo_chat;
  const scopeKey = buildVerifiedSessionScopeKey({ hasVerifiedSession, tenantSlug, user });
  if (!scopeKey || (type !== 'pyme' && type !== 'municipio')) return failure;
  return type === 'pyme' ? <PymePedidosPage key={scopeKey} tenantSlug={tenantSlug} /> : <PedidosPage key={scopeKey} tenantSlug={tenantSlug} embedded={embedded} />;
};

export default SmartPedidosWrapper;
