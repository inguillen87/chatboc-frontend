import { apiFetch } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { clearCachedWidgetToken } from '@/utils/widgetTokenScope';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';

type ClerkSignOut = () => Promise<unknown> | unknown;
type JwtClaims = Record<string, unknown>;

let activeClerkSignOut: ClerkSignOut | null = null;
let sessionRevision = 0;

const decodeJwtClaims = (token?: string | null): JwtClaims | null => {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) return null;

  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const decoded = globalThis.atob(padded);
    const claims = JSON.parse(decoded);
    return claims && typeof claims === 'object' ? claims : null;
  } catch {
    return null;
  }
};

const normalizeClaim = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const readActiveStoredToken = () =>
  safeLocalStorage.getItem('authToken') || safeLocalStorage.getItem('chatAuthToken');

export const hasPersistedClerkSession = () => {
  if (normalizeClaim(safeLocalStorage.getItem('authProvider')) === 'clerk') {
    return true;
  }

  const claims = decodeJwtClaims(readActiveStoredToken());
  return (
    normalizeClaim(claims?.auth_provider) === 'clerk' ||
    normalizeClaim(claims?.session_kind) === 'clerk'
  );
};

export const readPersistedClerkUserId = () => {
  const value = safeLocalStorage.getItem('clerkUserId');
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

export const registerClerkSignOut = (signOut: ClerkSignOut) => {
  activeClerkSignOut = signOut;

  return () => {
    if (activeClerkSignOut === signOut) {
      activeClerkSignOut = null;
    }
  };
};

export const captureChatbocSessionRevision = () => sessionRevision;

export const isChatbocSessionRevisionCurrent = (revision: number) =>
  revision === sessionRevision;

export const advanceChatbocSessionRevision = () => {
  sessionRevision += 1;
  return sessionRevision;
};

export const clearLocalChatbocSession = () => {
  advanceChatbocSessionRevision();
  usePanelSessionStore.getState().clearSession();
  useWidgetSessionStore.getState().clearSession();
  useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ entityToken: null });
  clearCachedWidgetToken();
  safeLocalStorage.removeItem('authProvider');
  safeLocalStorage.removeItem('clerkUserId');
  return sessionRevision;
};

const requestBackendLogout = () =>
  apiFetch('/api/v2/auth/logout', {
    method: 'POST',
    body: {},
    omitTenant: true,
    omitEntityToken: true,
    omitChatSessionId: true,
    preserveAuthOn401: true,
    suppressPanel401Redirect: true,
  });

const startBackendLogout = () => {
  try {
    return Promise.resolve(requestBackendLogout());
  } catch (error) {
    return Promise.reject(error);
  }
};

const warnLogoutFailure = (name: 'backend' | 'clerk', reason: unknown) => {
  console.warn(`[sessionLogout] Fallo el logout ${name}.`, reason);
};

export const resetChatbocSessionForIdentityTransition = () => {
  // Start while A's bearer still exists, then invalidate every local identity synchronously.
  const backendLogout = startBackendLogout();
  const revision = clearLocalChatbocSession();
  const completion = backendLogout.catch((error) => {
    warnLogoutFailure('backend', error);
  });

  return { completion, revision };
};

const resolveClerkSignOut = (): ClerkSignOut | null => {
  if (activeClerkSignOut) return activeClerkSignOut;
  if (typeof window === 'undefined') return null;

  const clerk = (window as Window & { Clerk?: { signOut?: ClerkSignOut } }).Clerk;
  return typeof clerk?.signOut === 'function' ? clerk.signOut.bind(clerk) : null;
};

interface LogoutChatbocSessionOptions {
  clerkEnabled?: boolean;
}

export const logoutChatbocSession = async ({
  clerkEnabled = false,
}: LogoutChatbocSessionOptions = {}) => {
  // apiFetch captures the current bearer token before the synchronous local clear.
  const backendLogout = startBackendLogout();
  const hasRegisteredClerkHandler = Boolean(activeClerkSignOut);
  const persistedClerkSession = hasPersistedClerkSession();
  const resolvedClerkSignOut = resolveClerkSignOut();
  const clerkSignOut =
    resolvedClerkSignOut &&
    (hasRegisteredClerkHandler || persistedClerkSession || clerkEnabled)
      ? resolvedClerkSignOut
      : null;

  const logoutRevision = clearLocalChatbocSession();

  const tasks: Array<{ name: 'backend' | 'clerk'; promise: Promise<unknown> }> = [
    { name: 'backend', promise: backendLogout },
  ];
  if (clerkSignOut) {
    tasks.push({ name: 'clerk', promise: Promise.resolve().then(() => clerkSignOut()) });
  }

  const results = await Promise.allSettled(tasks.map(({ promise }) => promise));
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      warnLogoutFailure(tasks[index].name, result.reason);
    }
  });
  return logoutRevision;
};
