import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error { constructor(message: string, public status = 500) { super(message); } },
}));

import { analyticsService } from './analyticsService';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

const profile = { tenant_profile_id: 22, tenantSlug: 'junin', scope: 'municipio' };
const queryAt = (index: number) => new URL(String(apiFetchMock.mock.calls[index][0]), 'https://example.test').searchParams;
const expectProfile = (index: number) => {
  expect(queryAt(index).get('tenant_profile_id')).toBe('22');
  expect(queryAt(index).has('tenant_id')).toBe(false);
  expect(apiFetchMock.mock.calls[index][1].tenantSlug).toBe('junin');
};

describe('explicit profile namespace in private analytics reads', () => {
  beforeEach(() => { apiFetchMock.mockReset(); advanceChatbocSessionRevision(); });

  it('serializes Mauricio profile 22 without converting it into owner 22 for hub, overview, realtime and insights', async () => {
    apiFetchMock.mockResolvedValue({ sections: {}, insights: [] });
    await analyticsService.getHub(profile, { strictAccess: true });
    await analyticsService.getSummary(profile, null);
    await analyticsService.getRealtimeHub({ ...profile, window_minutes: 30 });
    await analyticsService.getInsights(profile);
    [0, 1, 2, 3].forEach(expectProfile);
  });

  it('retains the owner namespace for existing legacy consumers', async () => {
    apiFetchMock.mockResolvedValue({ sections: {}, insights: [] });
    await analyticsService.getHub({ tenant_id: 4, tenantSlug: 'junin', scope: 'municipio' });
    await analyticsService.getRealtimeHub({ tenant_id: 4, tenantSlug: 'junin', scope: 'municipio' });
    await analyticsService.getInsights(4, 'junin');
    for (let index = 0; index < 3; index += 1) {
      expect(queryAt(index).get('tenant_id')).toBe('4');
      expect(queryAt(index).has('tenant_profile_id')).toBe(false);
    }
  });

  it('partitions cached hub snapshots by namespace even when the numeric values coincide', async () => {
    apiFetchMock.mockImplementation(async (_path, options) => {
      options.onResponse?.(new Response(null, { headers: { ETag: 'owner-snapshot' } }));
      return { sections: {} };
    });
    await analyticsService.getHub({ tenant_id: 22, tenantSlug: 'junin', scope: 'municipio' });
    await analyticsService.getHub(profile);
    expect(apiFetchMock.mock.calls[1][1].headers['If-None-Match']).toBeUndefined();
    expectProfile(1);
  });

  it('uses the verified slug and explicit profile namespace for the v2 map', async () => {
    apiFetchMock.mockResolvedValue({ contract_version: 'operations.heatmap.v1', tenant: { id: 22, slug: 'junin' }, points: [] });
    await analyticsService.getHeatmap(profile);
    expect(apiFetchMock.mock.calls[0][0]).toContain('/api/v2/analytics/operations/heatmap?');
    expectProfile(0);
  });

  it.each([{ id: 46, slug: 'junin' }, { id: 22, slug: 'foreign' }])('rejects a map with foreign identity %j without trying a fallback', async (tenant) => {
    apiFetchMock.mockResolvedValue({ contract_version: 'operations.heatmap.v1', tenant, points: [] });
    await expect(analyticsService.getHeatmap(profile)).rejects.toThrow();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it('exports the profile namespace instead of a legacy owner ID', () => {
    for (const url of [analyticsService.exportCsvUrl(profile), analyticsService.exportPdfUrl(profile)]) {
      const query = new URL(url, 'https://example.test').searchParams;
      expect(query.get('tenant_profile_id')).toBe('22');
      expect(query.has('tenant_id')).toBe(false);
      expect(query.get('tenant_slug')).toBe('junin');
    }
  });
});
