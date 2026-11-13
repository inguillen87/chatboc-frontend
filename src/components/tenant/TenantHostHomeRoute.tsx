import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { getTenantHostBinding } from '@/api/tenantHost';
import { useTenant } from '@/context/TenantContext';
import { readActiveTenantHostRuntime } from '@/utils/tenantHostBinding';
import { tenantHostCanonicalDestination, tenantHostCanonicalLookup } from '@/utils/tenantHostCanonical';

const TenantHomePage = lazy(() => import('@/pages/tenant/TenantHomePage'));

export function TenantHostHomeRoute({ children }: { children: ReactNode }) {
  const { hostBinding } = useTenant();
  const location = useLocation();
  useEffect(() => {
    if (!hostBinding || location.pathname !== '/' || location.search || location.hash) return;
    const href = window.location.href;
    const canonicalHost = tenantHostCanonicalLookup(hostBinding, href);
    if (!canonicalHost || readActiveTenantHostRuntime(hostBinding.host) !== hostBinding) return;
    const controller = new AbortController();
    let current = true;
    // This lookup never changes runtime identity and never fetches cross-origin.
    getTenantHostBinding(canonicalHost, controller.signal).then(destinationBinding => {
      if (!current || controller.signal.aborted || window.location.href !== href ||
        readActiveTenantHostRuntime(hostBinding.host) !== hostBinding) return;
      const destination = tenantHostCanonicalDestination(hostBinding, destinationBinding, window.location.href);
      if (destination) window.location.replace(destination);
    }).catch(() => { /* Keep the verified source space; unconfirmed destinations do not navigate. */ });
    return () => { current = false; controller.abort(); };
  }, [hostBinding, location.pathname, location.search, location.hash]);
  return hostBinding ? <Suspense fallback={<p role="status">Cargando espacio</p>}><TenantHomePage /></Suspense> : <>{children}</>;
}
