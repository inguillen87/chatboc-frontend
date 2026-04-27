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

export const loginWithGoogle = (payload: GoogleLoginRequest) =>
  panelApi.post<GoogleLoginResponse>('/api/v2/auth/google', payload, {
    legacyFallbackPath: '/api/google-login',
  });
