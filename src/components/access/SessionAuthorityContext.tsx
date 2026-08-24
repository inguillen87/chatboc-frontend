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
