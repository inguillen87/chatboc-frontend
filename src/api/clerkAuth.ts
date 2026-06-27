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

const clerkHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
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
