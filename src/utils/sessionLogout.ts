import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { clearCachedWidgetToken } from '@/utils/widgetTokenScope';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
import { clearClerkAuthContext } from '@/utils/clerkAuthContext';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import {captureSessionRetirement,clearSessionRetirementAuthority,retireLocalSessionAuthority,dispatchSessionRetirement,setLogoutNotice,type SessionRetirementResult} from './sessionRetirement';
import {isChatbocSessionRevisionCurrent} from './chatbocSessionRevision';
import {clearNativePanelSelection} from './nativePanelSelection';
export {
  captureChatbocSessionRevision,
  isChatbocSessionRevisionCurrent,
  advanceChatbocSessionRevision,
} from '@/utils/chatbocSessionRevision';

type JwtClaims = Record<string, unknown>;
let pendingLocalRetirement:{revision:number;completion:Promise<SessionRetirementResult>;blockClerk:boolean}|null=null;

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

export const hasAuthenticatedChatbocSession = () =>
  Boolean(readActiveStoredToken() || hasPersistedClerkSession());

export const readPersistedClerkUserId = () => {
  const value = safeLocalStorage.getItem('clerkUserId');
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

export const clearLocalChatbocSession = () => {
  pendingLocalRetirement=null;
  clearSessionRetirementAuthority();
  clearNativePanelSelection();
  const sessionRevision = advanceChatbocSessionRevision();
  usePanelSessionStore.getState().clearSession();
  useWidgetSessionStore.getState().clearSession();
  useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ entityToken: null });
  clearCachedWidgetToken();
  safeLocalStorage.removeItem('authProvider');
  safeLocalStorage.removeItem('clerkUserId');
  safeLocalStorage.removeItem('clerkAuthIntent');
  safeLocalStorage.removeItem('clerkSessionTransport');
  clearClerkAuthContext();
  return sessionRevision;
};

const startRetirement = (blockClerk:boolean) => {
  const panel=usePanelSessionStore.getState();const actor=panel.user?.id;
  const authority=captureSessionRetirement(actor);
  if(!authority&&!panel.user&&!panel.authToken&&pendingLocalRetirement&&
    (pendingLocalRetirement.blockClerk||!blockClerk)&&isChatbocSessionRevisionCurrent(pendingLocalRetirement.revision))return pendingLocalRetirement;
  // An explicit logout during an incomplete SDK exchange must still retire
  // that captured SDK session locally, even before it has a Chatboc profile.
  const unboundSdkSession=!authority&&!panel.user&&!panel.authToken&&!hasAuthenticatedChatbocSession();
  retireLocalSessionAuthority(authority,readPersistedClerkUserId(),blockClerk&&(authority?.provider==='clerk'||(!authority&&hasPersistedClerkSession())||unboundSdkSession));
  const revision=clearLocalChatbocSession();
  setLogoutNotice({status:authority?'pending':'unavailable',providerStatus:'unknown'});
  const completion=dispatchSessionRetirement(authority).then(result=>{
    const panel=usePanelSessionStore.getState();
    if(isChatbocSessionRevisionCurrent(revision)&&!panel.user&&!panel.authToken)setLogoutNotice(result);
    return result;
  });
  pendingLocalRetirement={completion,revision,blockClerk};return pendingLocalRetirement;
};

export const resetChatbocSessionForIdentityTransition = () => {
  return startRetirement(false);
};

interface LogoutChatbocSessionOptions {
  clerkEnabled?: boolean;
}

export const logoutChatbocSession = (_options:LogoutChatbocSessionOptions = {}):Promise<SessionRetirementResult> => {
  // Capture A and retire local state synchronously. No global Clerk operation,
  // cookie mutation, delayed store clear or navigation can affect a future B.
  return startRetirement(true).completion;
};
