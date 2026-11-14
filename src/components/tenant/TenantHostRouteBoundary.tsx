import type { ReactElement } from 'react';
import { matchRoutes, useLocation } from 'react-router-dom';
import { useTenant } from '@/context/TenantContext';
import { TenantHostPrivateScope } from './TenantHostPrivateScope';
import { exactInstitutionSlug } from '@/utils/publishedTenantIdentity';
import { tenantHostRouteMatches } from '@/utils/tenantHostBinding';
import NotFound from '@/pages/NotFound';

export interface TenantHostRouteDefinition {
  path: string;
  tenantHost?: 'public' | 'private';
  tenantHostParam?: 'tenant' | 'tenantSlug' | 'slug';
}

/** Route admission for an already verified customer host; never a backend grant. */
export function TenantHostRouteBoundary({ routes, children }: {
  routes: readonly TenantHostRouteDefinition[];
  children: ReactElement;
}) {
  const { hostBinding } = useTenant();
  const location = useLocation();
  if (!hostBinding) return children;

  const match = matchRoutes(routes.map(route => ({ path: route.path, handle: route })), location)?.at(-1);
  const route = match?.route.handle as TenantHostRouteDefinition | undefined;
  const requestedTenant = route?.tenantHostParam ? match?.params[route.tenantHostParam] : undefined;
  if ((route?.tenantHost !== 'public' && route?.tenantHost !== 'private') ||
      !tenantHostRouteMatches(hostBinding, location.pathname, location.search) ||
      (route.tenantHostParam && exactInstitutionSlug(requestedTenant) !== hostBinding.tenant.slug)) {
    return <NotFound />;
  }
  return route.tenantHost === 'private'
    ? <TenantHostPrivateScope denied={<NotFound />}>{children}</TenantHostPrivateScope>
    : children;
}
