import React from 'react';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';

interface Props {
  roles: Role[];
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<Props> = ({ roles, children }) => {
  useRequireRole(roles);
  return children;
};

export default ProtectedRoute;
