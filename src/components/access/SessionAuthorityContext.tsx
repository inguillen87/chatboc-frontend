import React from 'react';

export type SessionClerkStatus =
  | 'disabled'
  | 'loading'
  | 'signed_out'
  | 'syncing'
  | 'ready';

export interface SessionAuthorityValue {
  clerkStatus: SessionClerkStatus;
  hasBearerSession: boolean;
  hasVerifiedSession: boolean;
}

const readSessionSubject = (user: unknown) => {
  if (!user || typeof user !== 'object') return null;
  const record = user as Record<string, unknown>;
  const candidates: Array<[string, unknown]> = [
    ['id', record.id],
    ['user_id', record.user_id],
    ['clerk_user_id', record.clerk_user_id],
    ['sub', record.sub],
    ['email', record.email],
  ];

  for (const [kind, value] of candidates) {
    if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) {
      const normalized = kind === 'email'
        ? String(value).trim().toLowerCase()
        : String(value).trim();
      return `${kind}:${normalized}`;
    }
  }

  return null;
};

export const buildVerifiedSessionScopeKey = ({
  hasVerifiedSession,
  tenantSlug,
  user,
}: {
  hasVerifiedSession: boolean;
  tenantSlug?: string | null;
  user: unknown;
}) => {
  if (!hasVerifiedSession) return null;
  const subject = readSessionSubject(user);
  const tenant = typeof tenantSlug === 'string' ? tenantSlug.trim().toLowerCase() : '';
  if (!subject || !tenant) return null;
  return JSON.stringify([tenant, subject]);
};

export const resolveVerifiedSession = ({
  clerkStatus,
  hasBearerSession,
  bearerRequiresClerkVerification,
}: {
  clerkStatus: SessionClerkStatus;
  hasBearerSession: boolean;
  bearerRequiresClerkVerification: boolean;
}) =>
  Boolean(
    clerkStatus === 'ready' ||
      (hasBearerSession && !bearerRequiresClerkVerification),
  );

/**
 * Whether a private screen still has to wait for Clerk before reading data.
 * A verified session (for example a native Chatboc login, which the Clerk
 * bridge deliberately does not replace with a stale SDK identity) is already
 * the authority: Clerk "syncing" can last forever there and must not block.
 */
export const isSessionAuthorityPending = ({
  clerkStatus,
  hasVerifiedSession,
}: Pick<SessionAuthorityValue, 'clerkStatus' | 'hasVerifiedSession'>) =>
  !hasVerifiedSession && (clerkStatus === 'loading' || clerkStatus === 'syncing');

const DEFAULT_SESSION_AUTHORITY: SessionAuthorityValue = {
  clerkStatus: 'disabled',
  hasBearerSession: false,
  hasVerifiedSession: false,
};

const SessionAuthorityContext = React.createContext<SessionAuthorityValue>(
  DEFAULT_SESSION_AUTHORITY,
);

export const SessionAuthorityProvider = SessionAuthorityContext.Provider;

export const useSessionAuthority = () => React.useContext(SessionAuthorityContext);
