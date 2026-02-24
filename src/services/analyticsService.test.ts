import { describe, expect, it, vi, beforeEach } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    body?: unknown;
    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
}));

import { analyticsService } from '@/services/analyticsService';
import { ApiError } from '@/utils/api';

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


describe('analyticsService.getHub', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('falls back across hub aliases and returns navigation when primary endpoint is unavailable', async () => {
    apiFetchMock
      .mockRejectedValueOnce(new ApiError('forbidden', 403))
      .mockResolvedValueOnce({
        sections: {
          general: { totals: { total_interactions: 99 } },
        },
        navigation: {
          primary: [{ key: 'encuestas', path: '/admin/encuestas', active: false }],
        },
      });

    const hub = await analyticsService.getHub({ scope: 'municipio' });

    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/api/admin/analytics/hub?scope=municipio', expect.any(Object));
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/api/admin/analytics/dashboard?scope=municipio', expect.any(Object));
    expect(hub?.navigation?.primary?.[0]?.key).toBe('encuestas');
  });

  it('uses hub general section to normalize summary before overview fallback', async () => {
    apiFetchMock.mockResolvedValueOnce({
      sections: {
        general: {
          totals: { total_interactions: 21, active_users: 11 },
        },
      },
    });

    const result = await analyticsService.getSummary({ scope: 'municipio', context: 'overview' });

    expect(result.kpis.total_interactions).toBe(21);
    expect(result.kpis.active_users).toBe(11);
  });
});
