import { describe, expect, it, vi, beforeEach } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}));

import { analyticsService } from '@/services/analyticsService';

describe('analyticsService.getSummary', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('normalizes totals.total_interactions when kpis are missing', async () => {
    apiFetchMock.mockResolvedValue({
      totals: { total_interactions: 12, active_users: 7 },
      top_categories: [{ category: 'A', count: 2 }],
    });

    const result = await analyticsService.getSummary({ tenant_id: 1, scope: 'municipio' });

    expect(result.kpis.total_interactions).toBe(12);
    expect(result.kpis.active_users).toBe(7);
    expect(result.volume_by_day).toEqual([]);
  });
});
