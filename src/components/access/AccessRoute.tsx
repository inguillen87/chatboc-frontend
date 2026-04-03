import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

import { useCapabilities } from '@/context/CapabilitiesContext';
import { useUser } from '@/hooks/useUser';
import { normalizeRole, type Role } from '@/utils/roles';
import { ViewState } from '@/components/app-shell/ViewState';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

interface AccessRouteProps {
  children: React.ReactElement;
  roles?: string[];
  requiredCapabilities?: string[];
}

const AccessRoute: React.FC<AccessRouteProps> = ({ children, roles, requiredCapabilities }) => {
  const { user, loading } = useUser();
  const { hasAllCapabilities } = useCapabilities();
  const [profileSyncGrace, setProfileSyncGrace] = useState(true);
  const hasToken = Boolean(
    safeLocalStorage.getItem('authToken') || safeLocalStorage.getItem('chatAuthToken'),
  );

  useEffect(() => {
    if (!hasToken || user) {
      setProfileSyncGrace(false);
      return;
    }
    const timer = window.setTimeout(() => setProfileSyncGrace(false), 1400);
    return () => window.clearTimeout(timer);
  }, [hasToken, user]);

  if (loading || (hasToken && !user && profileSyncGrace)) {
    return <ViewState status="loading" title="Validando acceso" />;
  }

  if (roles && roles.length > 0) {
    const role = normalizeRole(user?.rol);
    if (!roles.includes(role as Role)) {
      return <Navigate to="/403" replace />;
    }
  }

  if (requiredCapabilities && requiredCapabilities.length > 0 && !hasAllCapabilities(requiredCapabilities)) {
    return <Navigate to="/403" replace />;
  }

  return children;
};

export default AccessRoute;
