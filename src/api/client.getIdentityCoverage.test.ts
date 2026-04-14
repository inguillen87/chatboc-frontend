import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    body?: Record<string, unknown>;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { apiClient } from '@/api/client';
import { ApiError } from '@/utils/api';

describe('apiClient.getIdentityCoverage', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('falls back to /api prefix only for 404/405 responses', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('Not found', 404));
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'analytics.identity_coverage.v1',
      coverage_pct: 98,
      slo_status: 'ok',
      alert_count: 0,
      alerts: [],
    });

    const response = await apiClient.getIdentityCoverage('rio-grande');

    expect(response.contract_version).toBe('analytics.identity_coverage.v1');
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/analytics/identity/coverage',
      expect.objectContaining({ tenantSlug: 'rio-grande' }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/analytics/identity/coverage',
      expect.objectContaining({ tenantSlug: 'rio-grande' }),
    );
  });

  it('does not fallback on non-routable API errors', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('Server error', 500));

    await expect(apiClient.getIdentityCoverage('rio-grande')).rejects.toThrow('Server error');
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries without emit_alert_events when backend rejects analytics.admin requirement', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('Forbidden', 403));
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'analytics.identity_coverage.v1',
      coverage_pct: 92,
      slo_status: 'ok',
      alert_count: 0,
      alerts: [],
    });

    const response = await apiClient.getIdentityCoverage('rio-grande', { emit_alert_events: 1 });

    expect(response.coverage_pct).toBe(92);
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/analytics/identity/coverage?emit_alert_events=1',
      expect.objectContaining({ tenantSlug: 'rio-grande' }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/analytics/identity/coverage',
      expect.objectContaining({ tenantSlug: 'rio-grande' }),
    );
  });
});
