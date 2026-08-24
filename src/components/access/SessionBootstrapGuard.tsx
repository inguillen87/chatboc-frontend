import React from 'react';
import { Navigate, matchRoutes, useLocation } from 'react-router-dom';

import { ViewState } from '@/components/app-shell/ViewState';
import {
  resolveVerifiedSession,
  SessionAuthorityProvider,
  type SessionClerkStatus,
} from '@/components/access/SessionAuthorityContext';
import routes from '@/routesConfig';
import { buildLoginPathWithNext } from '@/utils/authRedirect';
import { getValidStoredToken } from '@/utils/authTokens';
import { hasPersistedClerkSession } from '@/utils/sessionLogout';

export type ClerkBootstrapStatus = SessionClerkStatus;

interface SessionBootstrapGuardProps {
  clerkStatus: ClerkBootstrapStatus;
  renderRuntime: (tenantBootstrapEnabled: boolean) => React.ReactNode;
}

interface AccessMetadata {
  path: string;
  roles?: string[];
  requiredCapabilities?: string[];
  requiredAllCapabilities?: string[];
  requiresSession?: boolean;
  allowGuest?: boolean;
}

export type GuardDecision =
  | { kind: 'allow' }
  | { kind: 'passive' }
  | { kind: 'pending' }
  | {
      kind: 'redirect';
      to: string;
      state?: Record<string, unknown>;
    };

const accessRoutes = routes.map(
  ({
    path,
    roles,
    requiredCapabilities,
    requiredAllCapabilities,
    requiresSession,
    allowGuest,
  }) => ({
    path,
    handle: {
      path,
      roles,
      requiredCapabilities,
      requiredAllCapabilities,
      requiresSession,
      allowGuest,
    } satisfies AccessMetadata,
  }),
);

const normalizePathname = (pathname: string) =>
  pathname.trim().toLowerCase().replace(/\/+$/, '') || '/';

const readMatchedAccess = (pathname: string): AccessMetadata | null => {
  const matches = matchRoutes(accessRoutes, { pathname });
  const handle = matches?.at(-1)?.route.handle;
  return handle && typeof handle === 'object' ? (handle as AccessMetadata) : null;
};

const hasValidBearerSession = () =>
  Boolean(getValidStoredToken('authToken') || getValidStoredToken('chatAuthToken'));

export const resolveSessionBootstrapDecision = ({
  pathname,
  search = '',
  hasBearerSession,
  bearerRequiresClerkVerification,
  clerkStatus,
}: {
  pathname: string;
  search?: string;
  hasBearerSession: boolean;
  bearerRequiresClerkVerification: boolean;
  clerkStatus: ClerkBootstrapStatus;
}): GuardDecision => {
  const normalizedPath = normalizePathname(pathname);

  if (normalizedPath === '/login' || normalizedPath === '/403') {
    return { kind: 'passive' };
  }

  const access = readMatchedAccess(pathname);
  if (!access || access.allowGuest) return { kind: 'allow' };

  const requiredRoles = access.roles?.filter(Boolean) ?? [];
  const requiredCapabilities = access.requiredAllCapabilities?.length
    ? access.requiredAllCapabilities
    : access.requiredCapabilities?.filter(Boolean) ?? [];
  const requiresSession = Boolean(
    access.requiresSession || requiredRoles.length > 0 || requiredCapabilities.length > 0,
  );

  if (!requiresSession) return { kind: 'allow' };
  if (clerkStatus === 'ready') return { kind: 'allow' };
  if (hasBearerSession && !bearerRequiresClerkVerification) return { kind: 'allow' };
  if (clerkStatus === 'loading' || clerkStatus === 'syncing') return { kind: 'pending' };

  if (access.requiresSession) {
    const nextPath = normalizedPath === '/admin' ? '/perfil' : pathname;
    return {
      kind: 'redirect',
      to: buildLoginPathWithNext(nextPath, normalizedPath === '/admin' ? '' : search),
    };
  }

  return {
    kind: 'redirect',
    to: '/403',
    state: {
      reason: requiredRoles.length > 0 ? 'role' : 'capability',
      ...(requiredRoles.length > 0 ? { requiredRoles } : {}),
      ...(requiredCapabilities.length > 0 ? { requiredCapabilities } : {}),
      from: pathname,
    },
  };
};

const SessionBootstrapGuard: React.FC<SessionBootstrapGuardProps> = ({
  clerkStatus,
  renderRuntime,
}) => {
  const location = useLocation();
  const hasBearerSession = hasValidBearerSession();
  const bearerRequiresClerkVerification =
    hasBearerSession && hasPersistedClerkSession();
  const decision = resolveSessionBootstrapDecision({
    pathname: location.pathname,
    search: location.search,
    hasBearerSession,
    bearerRequiresClerkVerification,
    clerkStatus,
  });

  if (decision.kind === 'redirect') {
    return <Navigate to={decision.to} replace state={decision.state} />;
  }

  if (decision.kind === 'pending') {
    return <ViewState status="loading" title="Validando acceso seguro" />;
  }

  const hasVerifiedSession = resolveVerifiedSession({
    clerkStatus,
    hasBearerSession,
    bearerRequiresClerkVerification,
  });

  return (
    <SessionAuthorityProvider
      value={{ clerkStatus, hasBearerSession, hasVerifiedSession }}
    >
      {renderRuntime(decision.kind !== 'passive')}
    </SessionAuthorityProvider>
  );
};

export default SessionBootstrapGuard;
