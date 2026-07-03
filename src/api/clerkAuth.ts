import { apiFetch } from '@/utils/api';

export interface ClerkEmailAddressPayload {
  id?: string | null;
  email_address?: string | null;
  verification?: { status?: string | null } | null;
}

export interface ClerkExternalAccountPayload {
  id?: string | null;
  provider?: string | null;
  strategy?: string | null;
  image_url?: string | null;
  profile_image_url?: string | null;
  avatar_url?: string | null;
  picture?: string | null;
}

export interface ClerkUserProfilePayload {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  primary_email_address_id?: string | null;
  email_addresses?: ClerkEmailAddressPayload[];
  external_accounts?: ClerkExternalAccountPayload[];
  phone_numbers?: Array<{ id?: string | null; phone_number?: string | null }>;
  image_url?: string | null;
  profile_image_url?: string | null;
  avatar_url?: string | null;
  picture?: string | null;
}

export interface ClerkOnboardingPayload {
  tenant_name: string;
  vertical: string;
  rubro: string;
  telefono?: string;
  website?: string;
  ciudad?: string;
  provincia?: string;
  pais?: string;
  primary_goal?: string;
  team_size?: string;
  preferred_channels?: string[];
  user?: ClerkUserProfilePayload;
}

export interface ClerkSessionResponse {
  contract_version: 'auth.clerk.v1';
  token: string;
  auth_provider: 'clerk';
  user: {
    id: number | string;
    name?: string | null;
    email?: string | null;
    rol?: string | null;
    role?: string | null;
    tipo_chat?: string | null;
    tenant_id?: number | string | null;
    tenant_slug?: string | null;
    tenantSlug?: string | null;
    email_verified?: boolean;
    telefono?: string | null;
    avatar_url?: string | null;
    avatar_source?: string | null;
    avatar_consent?: boolean | string | number | null;
    profile_picture_consent?: boolean | string | number | null;
    picture?: string | null;
    identity?: Record<string, unknown> | null;
  };
  tenant?: {
    id: number | string;
    slug: string;
    nombre?: string | null;
    tipo?: string | null;
    vertical?: string | null;
    subvertical?: string | null;
    plan?: string | null;
    is_active?: boolean;
  } | null;
  onboarding?: {
    required?: boolean;
    status?: string;
    title?: string;
    description?: string;
    submit_endpoint?: string;
    modal?: Record<string, unknown>;
  };
  message?: string;
}

export interface ClerkFrontendConfigResponse {
  contract_version: 'auth.clerk.v1';
  enabled?: boolean;
  provider?: 'clerk' | string;
  session_sync_endpoint?: string;
  onboarding_endpoint?: string;
  webhook_endpoint?: string;
  oauth_callback_path?: string;
  publishable_key?: string | null;
  publishable_key_configured?: boolean;
  issuer_configured?: boolean;
  jwks_configured?: boolean;
  webhook_configured?: boolean;
  ready_for_session_sync?: boolean;
  configuration_warnings?: Array<{ code?: string; message?: string }>;
  social_providers?: string[];
  superadmin_policy?: {
    mode?: 'email_allowlist' | string;
    default_owner_guardrail?: boolean;
    allowlist_env_configured?: boolean;
  };
}

const clerkHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
});

export const fetchClerkFrontendConfig = () =>
  apiFetch<ClerkFrontendConfigResponse>('/auth/clerk/config', {
    method: 'GET',
    skipAuth: true,
    suppressPanel401Redirect: true,
    omitTenant: true,
    omitCredentials: true,
    omitChatSessionId: true,
    omitEntityToken: true,
    suppressInvalidJsonWarning: true,
  });

export const syncClerkSession = (token: string, user: ClerkUserProfilePayload) =>
  apiFetch<ClerkSessionResponse>('/auth/clerk/session', {
    method: 'POST',
    skipAuth: true,
    omitTenant: true,
    omitCredentials: true,
    headers: clerkHeaders(token),
    body: { user },
  });

export const completeClerkOnboarding = (token: string, payload: ClerkOnboardingPayload) =>
  apiFetch<ClerkSessionResponse>('/auth/clerk/onboarding', {
    method: 'POST',
    skipAuth: true,
    omitTenant: true,
    omitCredentials: true,
    headers: clerkHeaders(token),
    body: payload,
  });
