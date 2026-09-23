import { beforeEach, describe, expect, it, vi } from 'vitest';
const get = vi.hoisted(() => vi.fn());
vi.mock('@/api/v2/client', () => ({ panelApi: { get } }));
import { getOperationsDashboardV2, getOperationsHeatmapV2, getPublicMapConfigV1, getOperationsActionCenterV2, getOperationsAIBriefV2, getOperationsAIOpsQueueV2, getOperationsAIProviderStatusV2, getOperationsFreshnessV2 } from './analyticsApi';
const methods = [getOperationsDashboardV2, getOperationsHeatmapV2, getPublicMapConfigV1, getOperationsActionCenterV2, getOperationsAIBriefV2, getOperationsAIOpsQueueV2, getOperationsAIProviderStatusV2, getOperationsFreshnessV2];
beforeEach(() => { get.mockReset(); });
describe('raw operational response scope', () => {
  it.each(methods)('rejects a foreign raw tenant before normalizing endpoint %s', async (method) => {
    get.mockResolvedValue({ tenant_slug: 'foreign', summary: { total: 999 } });
    await expect(method({ tenantSlug: 'org-a' })).rejects.toMatchObject({ status: 403 });
    expect(get).toHaveBeenCalledOnce();
  });
  it.each(methods)('rejects contradictory tenant declarations in endpoint %s', async (method) => {
    get.mockResolvedValue({ tenant_slug: 'org-a', tenant: { slug: 'foreign' } });
    await expect(method({ tenantSlug: 'org-a' })).rejects.toMatchObject({ status: 403 });
    expect(get).toHaveBeenCalledOnce();
  });
});
