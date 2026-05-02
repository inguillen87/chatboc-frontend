import { publicApi } from '@/api/v2/client';

export interface ApiV2HealthResponse {
  ok: boolean;
  version: 'v2' | string;
  request_id?: string;
}

export const getApiV2Health = () =>
  publicApi.get<ApiV2HealthResponse>('/api/v2/health');
