import React from 'react';
import useRequireRole from '@/hooks/useRequireRole';

interface Props {
  roles: string[];
  children: React.ReactElement;
}

const ProtectedRoute: React.FC<Props> = ({ roles, children }) => {
  useRequireRole(roles);
  return children;
};

export default ProtectedRoute;
