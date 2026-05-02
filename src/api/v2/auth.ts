import { panelApi } from '@/api/v2/client';

export interface GoogleLoginRequest {
  id_token: string;
}

export interface GoogleLoginResponse {
  token: string;
  id: number;
  name: string;
  email: string;
}

export interface AuthV2User {
  id: number | string;
  name?: string | null;
  email?: string | null;
  rol?: string | null;
  role?: string | null;
  tenant_slug?: string | null;
  tenantSlug?: string | null;
  tipo_chat?: 'pyme' | 'municipio' | string | null;
  plan?: string | null;
}

export interface AuthV2LoginRequest {
  email: string;
  password: string;
  tenant_slug?: string | null;
  empresa_token?: string | null;
  anon_id?: string | null;
  remember?: boolean;
}

export interface AuthV2SessionResponse {
  token?: string;
  access_token?: string;
  refresh_token?: string;
  user?: AuthV2User;
  request_id?: string;
  contract_version?: string;
}

export const loginWithGoogle = (payload: GoogleLoginRequest) =>
  panelApi.post<GoogleLoginResponse>('/api/v2/auth/google', payload, {
    legacyFallbackPath: '/api/google-login',
  });

export const loginV2 = (payload: AuthV2LoginRequest) =>
  panelApi.post<AuthV2SessionResponse>('/api/v2/auth/login', payload, {
    skipAuth: true,
  });

export const refreshAuthV2 = (payload?: { refresh_token?: string | null }) =>
  panelApi.post<AuthV2SessionResponse>('/api/v2/auth/refresh', payload ?? {});

export const logoutV2 = () =>
  panelApi.post<{ ok?: boolean; request_id?: string; contract_version?: string }>('/api/v2/auth/logout', {});

export const getAuthMeV2 = () =>
  panelApi.get<AuthV2User & { request_id?: string; contract_version?: string }>('/api/v2/auth/me');
