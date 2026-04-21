import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from './useUser';
import { hasRequiredRole, Role } from '@/utils/roles';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

export default function useRequireRole(allowedRoles: Role[]) {
  const { user, loading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    const token = safeLocalStorage.getItem('authToken');
    if (token && !user) {
      // Esperar a que se sincronice el perfil antes de verificar permisos
      return;
    }

    if (!hasRequiredRole(user?.rol, allowedRoles)) {
      navigate('/403');
    }
  }, [user, loading, navigate, allowedRoles]);
}
