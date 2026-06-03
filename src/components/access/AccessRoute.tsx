import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useCapabilities } from '@/context/CapabilitiesContext';
import { useUser } from '@/hooks/useUser';
import { hasRequiredRole, normalizeRole } from '@/utils/roles';
import { ViewState } from '@/components/app-shell/ViewState';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

interface AccessRouteProps {
  children: React.ReactElement;
  roles?: string[];
  requiredCapabilities?: string[];
  requiredAllCapabilities?: string[];
}

const AccessRoute: React.FC<AccessRouteProps> = ({
  children,
  roles,
  requiredCapabilities,
  requiredAllCapabilities,
}) => {
  const { user, loading } = useUser();
  const { hasAllCapabilities, hasAnyCapability } = useCapabilities();
  const location = useLocation();
  const [profileSyncGrace, setProfileSyncGrace] = useState(true);
  const hasToken = Boolean(
    safeLocalStorage.getItem('authToken') || safeLocalStorage.getItem('chatAuthToken'),
  );

  useEffect(() => {
    if (!hasToken || user) {
      setProfileSyncGrace(false);
      return;
    }
    const timer = window.setTimeout(() => setProfileSyncGrace(false), 8000);
    return () => window.clearTimeout(timer);
  }, [hasToken, user]);

  if (loading || (hasToken && !user && profileSyncGrace)) {
    return <ViewState status="loading" title="Validando acceso" />;
  }

  const role = normalizeRole(user?.rol);
  const isSuperadmin = hasRequiredRole(user?.rol, ['superadmin']);

  if (roles && roles.length > 0) {
    if (!hasRequiredRole(user?.rol, roles)) {
      return (
        <Navigate
          to="/403"
          replace
          state={{
            reason: 'role',
            requiredRoles: roles,
            currentRole: role,
            from: location.pathname,
          }}
        />
      );
    }
  }

  if (isSuperadmin) {
    return children;
  }

  if (requiredAllCapabilities && requiredAllCapabilities.length > 0 && !hasAllCapabilities(requiredAllCapabilities)) {
    return (
      <Navigate
        to="/403"
        replace
        state={{
          reason: 'capability',
          requiredCapabilities: requiredAllCapabilities,
          from: location.pathname,
        }}
      />
    );
  }

  if (requiredCapabilities && requiredCapabilities.length > 0 && !hasAnyCapability(requiredCapabilities)) {
    return (
      <Navigate
        to="/403"
        replace
        state={{
          reason: 'capability',
          requiredCapabilities,
          from: location.pathname,
        }}
      />
    );
  }

  return children;
};

export default AccessRoute;
