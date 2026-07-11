import React from 'react';
import { useAuth, useUser as useClerkUser } from '@clerk/clerk-react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  completeClerkOnboarding,
  syncClerkSession,
  type ClerkOnboardingPayload,
  type ClerkSessionResponse,
  type ClerkUserProfilePayload,
} from '@/api/clerkAuth';
import ClerkTenantOnboardingDialog from '@/components/auth/ClerkTenantOnboardingDialog';
import { useClerkRuntime } from '@/components/auth/ClerkRuntimeContext';
import { useUser } from '@/hooks/useUser';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import {
  captureChatbocSessionRevision,
  hasPersistedClerkSession,
  isChatbocSessionRevisionCurrent,
  readPersistedClerkUserId,
  registerClerkSignOut,
  resetChatbocSessionForIdentityTransition,
} from '@/utils/sessionLogout';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';

export const buildClerkProfile = (rawUser: any): ClerkUserProfilePayload => ({
  id: rawUser?.id ?? null,
  first_name: rawUser?.firstName ?? null,
  last_name: rawUser?.lastName ?? null,
  username: rawUser?.username ?? null,
  image_url: rawUser?.imageUrl ?? rawUser?.image_url ?? null,
  profile_image_url: rawUser?.profileImageUrl ?? rawUser?.profile_image_url ?? null,
  avatar_url: rawUser?.avatarUrl ?? rawUser?.avatar_url ?? null,
  picture: rawUser?.imageUrl ?? rawUser?.picture ?? null,
  primary_email_address_id: rawUser?.primaryEmailAddressId ?? rawUser?.primaryEmailAddress?.id ?? null,
  email_addresses: Array.isArray(rawUser?.emailAddresses)
    ? rawUser.emailAddresses.map((email: any) => ({
        id: email?.id ?? null,
        email_address: email?.emailAddress ?? null,
        verification: { status: email?.verification?.status ?? null },
      }))
    : [],
  phone_numbers: Array.isArray(rawUser?.phoneNumbers)
    ? rawUser.phoneNumbers.map((phone: any) => ({
        id: phone?.id ?? null,
        phone_number: phone?.phoneNumber ?? null,
      }))
    : [],
  external_accounts: Array.isArray(rawUser?.externalAccounts)
    ? rawUser.externalAccounts.map((account: any) => ({
        id: account?.id ?? null,
        provider: account?.provider ?? account?.strategy ?? null,
        strategy: account?.strategy ?? null,
        image_url: account?.imageUrl ?? account?.image_url ?? null,
        profile_image_url: account?.profileImageUrl ?? account?.profile_image_url ?? null,
        avatar_url: account?.avatarUrl ?? account?.avatar_url ?? null,
        picture: account?.picture ?? account?.imageUrl ?? null,
      }))
    : [],
});

export const persistChatbocSession = (
  session: ClerkSessionResponse,
  clerkUserId?: string | null,
) => {
  if (!session?.token) return;
  safeLocalStorage.setItem('authToken', session.token);
  safeLocalStorage.setItem('chatAuthToken', session.token);
  safeLocalStorage.setItem('authProvider', 'clerk');
  if (clerkUserId?.trim()) {
    safeLocalStorage.setItem('clerkUserId', clerkUserId.trim());
  } else {
    safeLocalStorage.removeItem('clerkUserId');
  }
  usePanelSessionStore.getState().setAuthToken(session.token);
  useWidgetSessionStore.getState().setChatAuthToken(session.token);

  const tenantSlug = session.user?.tenantSlug || session.user?.tenant_slug || session.tenant?.slug;
  if (tenantSlug) {
    safeLocalStorage.setItem('tenantSlug', tenantSlug);
  }

  if (session.user) {
    usePanelSessionStore.getState().setUser({
      ...session.user,
      authProvider: 'clerk',
      auth_provider: 'clerk',
      tenantSlug: tenantSlug || undefined,
      tenant_slug: tenantSlug || undefined,
    } as any);
  }
};

const isAuthEntryPath = (pathname: string) =>
  pathname === '/login' ||
  pathname === '/register' ||
  pathname === '/login/' ||
  pathname === '/register/';

const ClerkAuthBridge: React.FC = () => {
  const clerkRuntime = useClerkRuntime();
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const { user: clerkUser } = useClerkUser();
  const { refreshUser } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [onboardingOpen, setOnboardingOpen] = React.useState(false);
  const [onboardingRequired, setOnboardingRequired] = React.useState(false);
  const [onboardingContract, setOnboardingContract] = React.useState<ClerkSessionResponse['onboarding']>();
  const [onboardingLoading, setOnboardingLoading] = React.useState(false);
  const [onboardingError, setOnboardingError] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<ClerkUserProfilePayload | undefined>();
  const syncKeyRef = React.useRef<string | null>(null);
  const previousSignedInRef = React.useRef<boolean | undefined>(undefined);
  const activeClerkUserIdRef = React.useRef<string | null | undefined>(undefined);
  const navigateRef = React.useRef(navigate);
  const pathnameRef = React.useRef(location.pathname);
  navigateRef.current = navigate;
  pathnameRef.current = location.pathname;

  const resetBridgeState = React.useCallback(() => {
    syncKeyRef.current = null;
    setProfile(undefined);
    setOnboardingRequired(false);
    setOnboardingOpen(false);
    setOnboardingContract(undefined);
    setOnboardingError(null);
  }, []);

  React.useEffect(() => registerClerkSignOut(signOut), [signOut]);

  React.useEffect(() => {
    if (!isLoaded || typeof isSignedIn !== 'boolean') return;

    const wasSignedIn = previousSignedInRef.current;
    previousSignedInRef.current = isSignedIn;
    const signedOutAfterTransition = wasSignedIn === true && isSignedIn === false;
    const hasActiveClerkIdentity = Boolean(activeClerkUserIdRef.current);
    const persistedClerkSession = hasPersistedClerkSession();
    const loadedWithStaleClerkSession =
      wasSignedIn === undefined && isSignedIn === false && persistedClerkSession;
    const signedOutFromChatbocClerkSession =
      signedOutAfterTransition && (hasActiveClerkIdentity || persistedClerkSession);
    if (!signedOutFromChatbocClerkSession && !loadedWithStaleClerkSession) return;

    const transition = resetChatbocSessionForIdentityTransition();
    void transition.completion;
    activeClerkUserIdRef.current = null;
    resetBridgeState();
  }, [isLoaded, isSignedIn, resetBridgeState]);

  React.useEffect(() => {
    if (!clerkRuntime.enabled || !isLoaded || !isSignedIn || !clerkUser) return;

    const currentClerkUserId = String(clerkUser.id || '').trim();
    if (!currentClerkUserId) return;

    const persistedClerkSession = hasPersistedClerkSession();
    if (activeClerkUserIdRef.current === undefined) {
      activeClerkUserIdRef.current = persistedClerkSession
        ? readPersistedClerkUserId()
        : null;
    }

    const previousClerkUserId = activeClerkUserIdRef.current;
    const isIdentitySwitch = Boolean(
      previousClerkUserId && previousClerkUserId !== currentClerkUserId,
    );
    const isUnattributedPersistedSession =
      persistedClerkSession && !previousClerkUserId;
    let transitionCompletion: Promise<unknown> = Promise.resolve();

    if (isIdentitySwitch || isUnattributedPersistedSession) {
      const transition = resetChatbocSessionForIdentityTransition();
      transitionCompletion = transition.completion;
      resetBridgeState();
    }
    activeClerkUserIdRef.current = currentClerkUserId;

    const syncKey = `${clerkUser.id}:${(clerkUser as any)?.updatedAt?.getTime?.() ?? ''}`;
    if (syncKeyRef.current === syncKey) return;
    syncKeyRef.current = syncKey;

    let cancelled = false;
    let sessionRevision: number | null = null;
    const hasCurrentIdentity = () =>
      !cancelled && activeClerkUserIdRef.current === currentClerkUserId;
    const isCurrentSync = () =>
      hasCurrentIdentity() &&
      sessionRevision !== null &&
      isChatbocSessionRevisionCurrent(sessionRevision);
    const run = async () => {
      try {
        await transitionCompletion;
        if (!hasCurrentIdentity()) return;
        sessionRevision = captureChatbocSessionRevision();
        const token = await getToken();
        if (!token || !isCurrentSync()) {
          if (isCurrentSync()) syncKeyRef.current = null;
          return;
        }
        const nextProfile = buildClerkProfile(clerkUser);
        const session = await syncClerkSession(token, nextProfile);
        if (!isCurrentSync()) return;

        if (!session.token) {
          const transition = resetChatbocSessionForIdentityTransition();
          await transition.completion;
          if (
            cancelled ||
            activeClerkUserIdRef.current !== currentClerkUserId ||
            !isChatbocSessionRevisionCurrent(transition.revision)
          ) return;
          setProfile(nextProfile);
          setOnboardingContract(session.onboarding);
          setOnboardingRequired(Boolean(session.onboarding?.required));
          setOnboardingOpen(Boolean(session.onboarding?.required));
          return;
        }

        persistChatbocSession(session, currentClerkUserId);
        setProfile(nextProfile);
        setOnboardingContract(session.onboarding);
        if (session.onboarding?.required) {
          setOnboardingRequired(true);
          setOnboardingOpen(true);
          return;
        }
        setOnboardingRequired(false);
        setOnboardingContract(session.onboarding);
        await refreshUser();
        if (isCurrentSync() && isAuthEntryPath(pathnameRef.current)) {
          navigateRef.current('/perfil', { replace: true });
        }
      } catch (error) {
        if (!isCurrentSync()) return;
        console.error('[ClerkAuthBridge] No se pudo sincronizar Clerk con Chatboc', error);
        syncKeyRef.current = null;
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [clerkRuntime.enabled, clerkUser, getToken, isLoaded, isSignedIn, refreshUser, resetBridgeState]);

  if (!clerkRuntime.enabled || !isLoaded || !isSignedIn) return null;

  const defaultTenantName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ').trim();

  const handleOnboardingSubmit = async (payload: ClerkOnboardingPayload) => {
    const submitRevision = captureChatbocSessionRevision();
    const submitClerkUserId = String(clerkUser?.id || '').trim();
    const isCurrentSubmit = () =>
      Boolean(submitClerkUserId) &&
      activeClerkUserIdRef.current === submitClerkUserId &&
      isChatbocSessionRevisionCurrent(submitRevision);
    setOnboardingLoading(true);
    setOnboardingError(null);
    try {
      const token = await getToken();
      if (!token || !isCurrentSubmit()) {
        throw new Error('No se pudo obtener la sesion Clerk.');
      }
      const session = await completeClerkOnboarding(token, {
        ...payload,
        user: profile || buildClerkProfile(clerkUser),
      });
      if (!isCurrentSubmit()) return;
      if (!session.token) {
        const transition = resetChatbocSessionForIdentityTransition();
        await transition.completion;
        throw new Error(session.message || 'El backend no creo una sesion Chatboc valida.');
      }
      persistChatbocSession(session, submitClerkUserId);
      setOnboardingContract(session.onboarding);
      await refreshUser();
      if (!isCurrentSubmit()) return;
      setOnboardingRequired(false);
      setOnboardingOpen(false);
      navigate('/perfil?setup=channels', { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo completar el onboarding.';
      setOnboardingError(message);
    } finally {
      setOnboardingLoading(false);
    }
  };

  return (
    <ClerkTenantOnboardingDialog
      open={onboardingOpen}
      onOpenChange={setOnboardingOpen}
      userProfile={profile}
      defaultTenantName={defaultTenantName}
      onboarding={onboardingContract}
      required={onboardingRequired}
      loading={onboardingLoading}
      error={onboardingError}
      onSubmit={handleOnboardingSubmit}
    />
  );
};

export default ClerkAuthBridge;
