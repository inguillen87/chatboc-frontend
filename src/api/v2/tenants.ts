import { panelApi, publicApi } from '@/api/v2/client';
import type { TenantPublicInfo, TenantSummary } from '@/types/tenant';

export interface CurrentTenantV2Response {
  contract_version?: string;
  request_id?: string;
  tenant?: (TenantSummary & Record<string, unknown>) | null;
  user?: Record<string, unknown> | null;
}

export const getTenantProfileV2 = (slug: string) =>
  publicApi.get<TenantPublicInfo>(`/api/v2/tenants/${encodeURIComponent(slug)}/profile`, {
    tenantSlug: slug,
    legacyFallbackPath: '/public/tenant',
  });

export const getCurrentTenantV2 = (tenantSlug?: string | null) =>
  panelApi.get<CurrentTenantV2Response>('/api/v2/tenants/current', { tenantSlug });
