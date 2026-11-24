import { useLocation } from 'react-router-dom';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { isSessionAuthorityPending, useSessionAuthority } from '@/components/access/SessionAuthorityContext';
import { captureChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { resolvePrivateAnalyticsScope } from './privateAnalyticsScope';

export function usePrivateAnalyticsScope() {
  const { user, loading, hasVerifiedSession, organizationProfileVerified } = useUser();
  const authority = useSessionAuthority();
  const { tenant, isLoadingTenant, tenantError } = useTenant();
  const location = useLocation();
  const pending = loading || isSessionAuthorityPending(authority);
  const scope = pending ? null : resolvePrivateAnalyticsScope({ user, verified: hasVerifiedSession, profileVerified: organizationProfileVerified,
    pathname: location.pathname, search: location.search, tenant, tenantPending: isLoadingTenant, tenantError });
  const sessionRevision = captureChatbocSessionRevision();
  return { scope, pending, sessionRevision, key: scope ? `${scope.scopeKey}:${sessionRevision}` : null };
}
