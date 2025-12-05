import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, matchPath } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { useUser } from '@/hooks/useUser';
import { getValidStoredToken } from '@/utils/authTokens';

interface Props {
  children: React.ReactElement;
  allowGuestPaths?: string[];
}

const UserPortalGuard: React.FC<Props> = ({ children, allowGuestPaths }) => {
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

  // Use matchPath to check if current location matches any allowed guest route (handling params like :tenant)
  const isGuestAllowed = allowGuestPaths?.some((pathPattern) => {
    const match = matchPath({ path: pathPattern, end: false }, location.pathname);
    return match;
  });

  const canBypassAuth = isGuestAllowed && !hasAnyToken;
  console.log('[UserPortalGuard]', { pathname: location.pathname, isGuestAllowed, allowGuestPaths, hasAnyToken, user: !!user });

  if (loading && !canBypassAuth) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Cargando tu sesión...
      </div>
    );
  }

  if (!user && isGuestAllowed) {
    return children;
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
