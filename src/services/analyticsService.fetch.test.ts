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
import {
  getAnalyticsEventSchema,
  getIdentityCoverageV1,
  getWhatsappFunnel,
  postAnalyticsEvent,
} from '@/services/analyticsService';

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

  it('loads analytics event schema v1 with endpoint fallback', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('Not Found', 404));
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'analytics.event_schema.v1',
      tenant_id: 42,
      required_dimensions: ['event_name', 'channel'],
      recommended_dimensions: ['contact_key'],
      canonical_events: ['ticket_created'],
    });

    const result = await getAnalyticsEventSchema(42, 'tenant-a');

    expect(result.contract_version).toBe('analytics.event_schema.v1');
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/analytics/event/schema?tenant_id=42', { tenantSlug: 'tenant-a' });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/api/analytics/event/schema?tenant_id=42', { tenantSlug: 'tenant-a' });
  });

  it('posts analytics event and validates ingest ack contract', async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      contract_version: 'analytics.event_ingest.v1',
      tenant_id: 42,
      event_name: 'ticket_created',
      contact_key: 'ck-1',
    });

    const result = await postAnalyticsEvent({ event_name: 'ticket_created' }, 'tenant-a');

    expect(result.contract_version).toBe('analytics.event_ingest.v1');
    expect(apiFetchMock).toHaveBeenCalledWith('/analytics/event', {
      method: 'POST',
      body: { event_name: 'ticket_created' },
      tenantSlug: 'tenant-a',
    });
  });
});
