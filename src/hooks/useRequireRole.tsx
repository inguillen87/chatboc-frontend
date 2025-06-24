import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from './useUser';
import { normalizeRole, Role } from '@/utils/roles';

export default function useRequireRole(allowedRoles: Role[]) {
  const { user, loading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      const role = normalizeRole(user?.rol);
      if (!allowedRoles.includes(role)) {
        navigate('/403');
      }
    }
  }, [user, loading, navigate, allowedRoles]);
}
