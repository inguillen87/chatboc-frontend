import React from 'react';
import { Navigate } from 'react-router-dom';

import { useCapabilities } from '@/context/CapabilitiesContext';
import { useUser } from '@/hooks/useUser';
import { normalizeRole, type Role } from '@/utils/roles';

interface AccessRouteProps {
  children: React.ReactElement;
  roles?: string[];
  requiredCapabilities?: string[];
}

const AccessRoute: React.FC<AccessRouteProps> = ({ children, roles, requiredCapabilities }) => {
  const { user, loading } = useUser();
  const { hasAllCapabilities } = useCapabilities();

  if (loading) {
    return null;
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
