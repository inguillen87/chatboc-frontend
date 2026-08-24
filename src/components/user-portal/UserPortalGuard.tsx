import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, matchPath } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { useSessionAuthority } from '@/components/access/SessionAuthorityContext';
import { useUser } from '@/hooks/useUser';
import { isBackofficeRole } from '@/utils/roles';
import { sanitizeClerkTenantSlug } from '@/utils/clerkAuthContext';
import { buildTenantPath } from '@/utils/tenantPaths';

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

const buildPortalLoginPath = (pathname: string, search: string, hash: string) => {
  const destination = `${pathname}${search}${hash}`;
  const tenantMatch = pathname.match(/^\/t\/([^/]+)\/portal(?:\/|$)/i);
  let tenantSlug: string | null = null;
  try {
    tenantSlug = sanitizeClerkTenantSlug(
      tenantMatch?.[1] ? decodeURIComponent(tenantMatch[1]) : null,
    );
  } catch {
    tenantSlug = null;
  }
  const loginPath = buildTenantPath('/user/login', tenantSlug);

  return {
    destination,
    loginPath: `${loginPath}?next=${encodeURIComponent(destination)}`,
  };
};

const UserPortalGuard: React.FC<Props> = ({ children, allowGuestPaths }) => {
  const { user, refreshUser, loading } = useUser();
  const { hasVerifiedSession } = useSessionAuthority();
  const location = useLocation();
  const [refreshState, setRefreshState] = useState<'idle' | 'pending' | 'complete'>('idle');
  const refreshStateRef = useRef(refreshState);
  const refreshGenerationRef = useRef(0);
  const hasVerifiedSessionRef = useRef(hasVerifiedSession);
  hasVerifiedSessionRef.current = hasVerifiedSession;

  useEffect(() => {
    if (!hasVerifiedSession) {
      refreshGenerationRef.current += 1;
      refreshStateRef.current = 'idle';
      setRefreshState('idle');
      return;
    }

    if (user) {
      refreshStateRef.current = 'complete';
      setRefreshState('complete');
      return;
    }

    if (loading || refreshStateRef.current !== 'idle') return;

    refreshStateRef.current = 'pending';
    setRefreshState('pending');
    const refreshGeneration = ++refreshGenerationRef.current;

    void Promise.resolve(refreshUser())
      .catch((err) => {
        console.warn('[UserPortalGuard] refreshUser failed', err);
      })
      .finally(() => {
        if (
          refreshGenerationRef.current !== refreshGeneration ||
          !hasVerifiedSessionRef.current
        ) {
          return;
        }
        refreshStateRef.current = 'complete';
        setRefreshState('complete');
      });
  }, [hasVerifiedSession, loading, refreshUser, user]);

  // Use matchPath to check if current location matches any allowed guest route (handling params like :tenant)
  const isGuestAllowed = allowGuestPaths?.some((pathPattern) => {
    const match = matchPath({ path: pathPattern, end: false }, location.pathname);
    return match;
  });

  const canBypassAuth = Boolean(isGuestAllowed && !hasVerifiedSession);
  const { destination, loginPath } = buildPortalLoginPath(
    location.pathname,
    location.search,
    location.hash,
  );

  if (canBypassAuth) {
    return children;
  }

  if (!hasVerifiedSession) {
    return (
      <Navigate
        to={loginPath}
        state={{ redirectTo: destination }}
        replace
      />
    );
  }

  if (loading || (hasVerifiedSession && !user && refreshState !== 'complete')) {
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
        to={loginPath}
        state={{ redirectTo: destination }}
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
