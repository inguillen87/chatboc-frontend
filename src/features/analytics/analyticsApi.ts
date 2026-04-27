import { panelApi } from '@/api/v2/client';
import type { AnalyticsOverview } from './analyticsTypes';

export const getAnalyticsOverviewV2 = (tenantSlug?: string | null) =>
  panelApi.get<AnalyticsOverview>('/api/v2/analytics/overview', {
    tenantSlug,
    legacyFallbackPath: '/analytics/overview',
  });
