import { apiFetch } from '@/utils/api';
import type { ChannelActivationContract } from '@/api/v2/channelActivation';
import type { ClerkAuthIntent } from '@/utils/clerkAuthContext';

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
  terms_accepted: boolean;
  terms_version: string;
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

export interface ClerkOnboardingOption {
  value: string;
  label: string;
}

export interface ClerkOnboardingModule {
  id: string;
  label: string;
  description?: string;
}

export interface ClerkOnboardingVerticalPreset {
  rubro?: string;
  primary_goal?: string;
  preferred_channels?: string[];
  headline?: string;
  recommended_modules?: string[];
  starter_questions?: string[];
}

export interface ClerkOnboardingModalContract {
  mode?: 'tenant_setup' | 'terms_only' | string;
  existing_tenant?: ClerkSessionResponse['tenant'];
  summary_cards?: ClerkOnboardingModule[];
  starter_modules?: ClerkOnboardingModule[];
  vertical_presets?: Record<string, ClerkOnboardingVerticalPreset>;
  vertical_options?: ClerkOnboardingOption[];
  goal_options?: ClerkOnboardingOption[];
  social_login?: {
    provider?: string;
    enabled_providers?: string[];
    required_dashboard_setup?: string[];
    connection_aliases?: Record<string, string>;
  };
  whatsapp_business_requirements?: {
    production_enabled_by_default?: boolean;
    required_plan?: string;
    required_provider_setup?: string[];
    free_plan_state?: string;
    message?: string;
  };
  plan_policy?: {
    self_service_plan?: string;
    requested_plan_allowed?: boolean;
    productive_plan?: string;
    upgrade_requires?: string;
    message?: string;
  };
  terms?: {
    required?: boolean;
    version?: string;
    terms_url?: string;
    privacy_url?: string;
    label?: string;
  };
  profile_picture_policy?: string;
  steps?: Array<Record<string, unknown>>;
}

export interface ClerkSessionResponse {
  contract_version: 'auth.clerk.v1';
  token?: string | null;
  auth_provider: 'clerk';
  auth_intent?: ClerkAuthIntent;
  audience?: 'tenant_owner' | 'tenant_portal' | string;
  session_transport?: 'cookie' | 'bearer' | 'cookie_and_body' | 'pending_onboarding' | string;
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
    modal?: ClerkOnboardingModalContract;
  };
  channel_activation?: ChannelActivationContract | null;
  message?: string;
}

export interface ClerkFrontendConfigResponse {
  contract_version: 'auth.clerk.v1';
  enabled?: boolean;
  provider?: 'clerk' | string;
  environment?: 'development' | 'production' | 'unconfigured' | 'unknown' | string;
  production_ready?: boolean;
  session_sync_endpoint?: string;
  onboarding_endpoint?: string;
  webhook_endpoint?: string;
  webhook_required_events?: string[];
  oauth_callback_path?: string;
  publishable_key?: string | null;
  publishable_key_configured?: boolean;
  issuer_configured?: boolean;
  jwks_configured?: boolean;
  webhook_configured?: boolean;
  ready_for_session_sync?: boolean;
  configuration_warnings?: Array<{ code?: string; message?: string }>;
  production_requirements?: {
    live_publishable_key?: boolean;
    session_verification?: boolean;
    backend_identity_api?: boolean;
    webhook_secret?: boolean;
    authorized_parties?: boolean;
    authorized_party_required?: boolean;
    superadmin_allowlist?: boolean;
    custom_domain_or_production_instance?: boolean;
  };
  backend_identity_api_configured?: boolean;
  authorized_parties_configured?: boolean;
  authorized_party_required?: boolean;
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
  apiFetch<ClerkFrontendConfigResponse>('/api/auth/clerk/config', {
    method: 'GET',
    skipAuth: true,
    suppressPanel401Redirect: true,
    omitTenant: true,
    omitCredentials: true,
    omitChatSessionId: true,
    omitEntityToken: true,
    suppressInvalidJsonWarning: true,
  });

export const syncClerkSession = (
  token: string,
  user: ClerkUserProfilePayload,
  context: { intent?: ClerkAuthIntent; tenant_slug?: string | null } = {},
) =>
  apiFetch<ClerkSessionResponse>('/api/auth/clerk/session', {
    method: 'POST',
    skipAuth: true,
    omitTenant: true,
    omitCredentials: false,
    headers: clerkHeaders(token),
    body: { user, ...context },
  });

export const completeClerkOnboarding = (token: string, payload: ClerkOnboardingPayload) =>
  apiFetch<ClerkSessionResponse>('/api/auth/clerk/onboarding', {
    method: 'POST',
    skipAuth: true,
    omitTenant: true,
    omitCredentials: false,
    headers: clerkHeaders(token),
    body: { ...payload, intent: 'tenant_owner' },
  });
