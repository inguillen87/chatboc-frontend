import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, matchPath } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { useUser } from '@/hooks/useUser';
import { getValidStoredToken } from '@/utils/authTokens';
import { isBackofficeRole } from '@/utils/roles';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

interface Props {
  children: React.ReactElement;
  allowGuestPaths?: string[];
}

const isStandalonePortalShell = () => {
  if (typeof window === 'undefined') return false;
  const pathname = window.location.pathname.toLowerCase();
  return pathname === '/portal/' || pathname.endsWith('/portal/index.html');
};

const PortalShellRedirect = ({ to }: { to: string }) => {
  useEffect(() => {
    window.location.assign(to);
  }, [to]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin mr-2" />
      Abriendo panel...
    </div>
  );
};

const UserPortalGuard: React.FC<Props> = ({ children, allowGuestPaths }) => {
  const { user, refreshUser, loading } = useUser();
  const location = useLocation();
  const [hasAttemptedRefresh, setHasAttemptedRefresh] = useState(false);

  const hasAnySession = Boolean(
    getValidStoredToken('authToken') ||
    getValidStoredToken('chatAuthToken') ||
    safeLocalStorage.getItem('authProvider')?.trim().toLowerCase() === 'clerk',
  );

  useEffect(() => {
    if (user || loading || !hasAnySession || hasAttemptedRefresh) return;
    setHasAttemptedRefresh(true);
    refreshUser().catch((err) => {
      console.warn('[UserPortalGuard] refreshUser failed', err);
    });
  }, [hasAnySession, hasAttemptedRefresh, loading, refreshUser, user]);

  // Use matchPath to check if current location matches any allowed guest route (handling params like :tenant)
  const isGuestAllowed = allowGuestPaths?.some((pathPattern) => {
    const match = matchPath({ path: pathPattern, end: false }, location.pathname);
    return match;
  });

  const canBypassAuth = isGuestAllowed && !hasAnySession;

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

  if (isBackofficeRole(user.rol)) {
    if (isStandalonePortalShell()) {
      return <PortalShellRedirect to="/perfil" />;
    }

    return (
      <Navigate
        to="/perfil"
        state={{ blockedPortalPath: location.pathname + location.search }}
        replace
      />
    );
  }

  return children;
};

export default UserPortalGuard;
