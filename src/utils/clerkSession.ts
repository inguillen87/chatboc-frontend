import type {
  ClerkSessionResponse,
  ClerkUserProfilePayload,
} from '@/api/clerkAuth';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import type { ClerkAuthIntent } from '@/utils/clerkAuthContext';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

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
  authIntent: ClerkAuthIntent = session.auth_intent === 'tenant_portal' ? 'tenant_portal' : 'tenant_owner',
) => {
  if (!session?.user) return;
  const sessionToken = typeof session.token === 'string' && session.token.trim()
    ? session.token.trim()
    : null;

  usePanelSessionStore.getState().setAuthToken(sessionToken);
  if (authIntent === 'tenant_portal') {
    useWidgetSessionStore.getState().setChatAuthToken(sessionToken);
  } else {
    useWidgetSessionStore.getState().setChatAuthToken(null);
  }
  safeLocalStorage.setItem('authProvider', 'clerk');
  safeLocalStorage.setItem('clerkAuthIntent', authIntent);
  safeLocalStorage.setItem('clerkSessionTransport', session.session_transport || (sessionToken ? 'bearer' : 'cookie'));
  if (clerkUserId?.trim()) {
    safeLocalStorage.setItem('clerkUserId', clerkUserId.trim());
  } else {
    safeLocalStorage.removeItem('clerkUserId');
  }
  const tenantSlug = session.user?.tenantSlug || session.user?.tenant_slug || session.tenant?.slug;
  if (tenantSlug) {
    safeLocalStorage.setItem('tenantSlug', tenantSlug);
  }

  usePanelSessionStore.getState().setUser({
    ...session.user,
    authProvider: 'clerk',
    auth_provider: 'clerk',
    authIntent,
    auth_intent: authIntent,
    tenantSlug: tenantSlug || undefined,
    tenant_slug: tenantSlug || undefined,
  } as any);
};
