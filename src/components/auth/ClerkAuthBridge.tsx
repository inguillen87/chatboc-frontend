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

const persistChatbocSession = (session: ClerkSessionResponse) => {
  if (!session?.token) return;
  safeLocalStorage.setItem('authToken', session.token);
  safeLocalStorage.setItem('chatAuthToken', session.token);
  usePanelSessionStore.getState().setAuthToken(session.token);
  useWidgetSessionStore.getState().setChatAuthToken(session.token);

  const tenantSlug = session.user?.tenantSlug || session.user?.tenant_slug || session.tenant?.slug;
  if (tenantSlug) {
    safeLocalStorage.setItem('tenantSlug', tenantSlug);
  }

  if (session.user) {
    usePanelSessionStore.getState().setUser({
      ...session.user,
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
  const { isLoaded, isSignedIn, getToken } = useAuth();
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

  React.useEffect(() => {
    if (!clerkRuntime.enabled || !isLoaded || !isSignedIn || !clerkUser) return;

    const syncKey = `${clerkUser.id}:${(clerkUser as any)?.updatedAt?.getTime?.() ?? ''}`;
    if (syncKeyRef.current === syncKey) return;
    syncKeyRef.current = syncKey;

    let cancelled = false;
    const run = async () => {
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        const nextProfile = buildClerkProfile(clerkUser);
        setProfile(nextProfile);
        const session = await syncClerkSession(token, nextProfile);
        if (cancelled) return;
        persistChatbocSession(session);
        setOnboardingContract(session.onboarding);
        if (session.onboarding?.required) {
          setOnboardingRequired(true);
          setOnboardingOpen(true);
          return;
        }
        setOnboardingRequired(false);
        setOnboardingContract(session.onboarding);
        await refreshUser();
        if (isAuthEntryPath(location.pathname)) {
          navigate('/perfil', { replace: true });
        }
      } catch (error) {
        console.error('[ClerkAuthBridge] No se pudo sincronizar Clerk con Chatboc', error);
        syncKeyRef.current = null;
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [clerkRuntime.enabled, clerkUser, getToken, isLoaded, isSignedIn, location.pathname, navigate, refreshUser]);

  if (!clerkRuntime.enabled || !isLoaded || !isSignedIn) return null;

  const defaultTenantName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ').trim();

  const handleOnboardingSubmit = async (payload: ClerkOnboardingPayload) => {
    setOnboardingLoading(true);
    setOnboardingError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('No se pudo obtener la sesion Clerk.');
      const session = await completeClerkOnboarding(token, {
        ...payload,
        user: profile || buildClerkProfile(clerkUser),
      });
      persistChatbocSession(session);
      setOnboardingContract(session.onboarding);
      await refreshUser();
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
