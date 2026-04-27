import { publicApi } from '@/api/v2/client';
import type { TenantPublicInfo } from '@/types/tenant';

export const getTenantProfileV2 = (slug: string) =>
  publicApi.get<TenantPublicInfo>(`/api/v2/tenants/${encodeURIComponent(slug)}/profile`, {
    tenantSlug: slug,
    legacyFallbackPath: '/public/tenant',
  });
