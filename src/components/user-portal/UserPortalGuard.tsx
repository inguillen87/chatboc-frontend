import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { useUser } from '@/hooks/useUser';
import { getValidStoredToken } from '@/utils/authTokens';

interface Props {
  children: React.ReactElement;
}

const UserPortalGuard: React.FC<Props> = ({ children }) => {
  const { user, refreshUser, loading } = useUser();
  const location = useLocation();
  const [hasAttemptedRefresh, setHasAttemptedRefresh] = useState(false);

  const hasAnyToken = Boolean(
    getValidStoredToken('authToken') || getValidStoredToken('chatAuthToken'),
  );

  useEffect(() => {
    if (user || loading || !hasAnyToken || hasAttemptedRefresh) return;
    setHasAttemptedRefresh(true);
    refreshUser().catch((err) => {
      console.warn('[UserPortalGuard] refreshUser failed', err);
    });
  }, [hasAnyToken, hasAttemptedRefresh, loading, refreshUser, user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Cargando tu sesión...
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/user/login"
        state={{ redirectTo: location.pathname + location.search }}
        replace
      />
    );
  }

  return children;
};

export default UserPortalGuard;
