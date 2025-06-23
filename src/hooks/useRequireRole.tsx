import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from './useUser';

export default function useRequireRole(allowedRoles: string[]) {
  const { user, loading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      const role = user?.rol || '';
      if (!allowedRoles.includes(role)) {
        navigate('/');
      }
    }
  }, [user, loading, navigate, allowedRoles]);
}
