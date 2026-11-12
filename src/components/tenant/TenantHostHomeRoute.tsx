import { lazy, Suspense, type ReactNode } from 'react';
import { useTenant } from '@/context/TenantContext';

const TenantHomePage = lazy(() => import('@/pages/tenant/TenantHomePage'));

export function TenantHostHomeRoute({ children }: { children: ReactNode }) {
  const { hostBinding } = useTenant();
  return hostBinding ? <Suspense fallback={<p role="status">Cargando espacio</p>}><TenantHomePage /></Suspense> : <>{children}</>;
}
