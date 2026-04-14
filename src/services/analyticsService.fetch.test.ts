import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {
    status: number;
    body?: unknown;
    constructor(message: string, status: number, body?: unknown) {
      super(message);
      this.status = status;
      this.body = body;
    }
  },
}));

import { ApiError } from '@/utils/api';
import { getIdentityCoverageV1, getWhatsappFunnel } from '@/services/analyticsService';

describe('analyticsService fetch helpers', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('falls back whatsapp funnel endpoint on 404 and validates contract_version', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('Not Found', 404));
    apiFetchMock.mockResolvedValueOnce({
      contract_version: '1.0.0',
      stages: [{ event_name: 'sent', label: 'Sent', sessions: 10, unique_contacts: 8, conversion_from_prev_pct: null }],
    });

    const result = await getWhatsappFunnel('tenant-a');

    expect(result.contract_version).toBe('1.0.0');
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/admin/analytics/whatsapp-funnel', { tenantSlug: 'tenant-a' });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/api/admin/analytics/whatsapp-funnel', { tenantSlug: 'tenant-a' });
  });

  it('validates identity coverage v1 contract and fallback path', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('Not Found', 405));
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'analytics.identity_coverage.v1',
      tenant_id: null,
      coverage_pct: 99,
      slo_status: 'ok',
      alert_count: 0,
      alerts: [],
    });

    const result = await getIdentityCoverageV1('tenant-a');

    expect(result.contract_version).toBe('analytics.identity_coverage.v1');
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/analytics/identity/coverage', { tenantSlug: 'tenant-a' });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/api/analytics/identity/coverage', { tenantSlug: 'tenant-a' });
  });
});
