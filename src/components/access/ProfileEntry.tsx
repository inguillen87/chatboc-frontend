import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useUser } from '@/hooks/useUser';
import { useSessionAuthority } from './SessionAuthorityContext';
import { hasRequiredRole } from '@/utils/roles';

const Perfil = React.lazy(() => import('@/pages/Perfil'));

/** A platform administrator starts at the platform, while explicit tenant tasks retain their route. */
export default function ProfileEntry() {
  const { user } = useUser();
  const { hasVerifiedSession } = useSessionAuthority();
  const { pathname, search } = useLocation();
  if (hasVerifiedSession && hasRequiredRole(user?.rol || user?.role, ['superadmin']) &&
      pathname.replace(/\/+$/, '') === '/perfil' && !search) {
    return <Navigate to="/superadmin" replace />;
  }
  return <Perfil />;
}
