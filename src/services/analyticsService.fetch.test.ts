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

vi.mock('@/config', () => ({
  SAME_ORIGIN_PROXY_BASE: '/api',
}));

import { ApiError } from '@/utils/api';
import {
  getAnalyticsEventSchema,
  analyticsService,
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
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/admin/analytics/whatsapp-funnel', {
      tenantSlug: 'tenant-a',
      baseUrlOverride: '/api',
    });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/api/admin/analytics/whatsapp-funnel', {
      tenantSlug: 'tenant-a',
      baseUrlOverride: '/api',
    });
  });

  it('validates identity coverage v1 contract and fallback path', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('Not Found', 405));
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'analytics.identity_coverage.v1',
      request_id: 'req-cov-fetch',
      tenant_id: null,
      coverage_pct: 99,
      slo_status: 'ok',
      alert_count: 0,
      alerts: [],
    });

    const result = await getIdentityCoverageV1('tenant-a');

    expect(result.contract_version).toBe('analytics.identity_coverage.v1');
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/analytics/identity/coverage', {
      tenantSlug: 'tenant-a',
      baseUrlOverride: '/api',
    });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/api/analytics/identity/coverage', {
      tenantSlug: 'tenant-a',
      baseUrlOverride: '/api',
    });
  });

  it('loads analytics event schema v1 with endpoint fallback', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('Not Found', 404));
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'analytics.event_schema.v1',
      request_id: 'req-schema-fetch',
      tenant_id: 42,
      required_dimensions: ['event_name', 'channel'],
      recommended_dimensions: ['contact_key'],
      canonical_events: ['ticket_created'],
    });

    const result = await getAnalyticsEventSchema(42, 'tenant-a');

    expect(result.contract_version).toBe('analytics.event_schema.v1');
    expect(apiFetchMock).toHaveBeenNthCalledWith(1, '/api/analytics/event/schema?tenant_id=42', { tenantSlug: 'tenant-a' });
    expect(apiFetchMock).toHaveBeenNthCalledWith(2, '/analytics/event/schema?tenant_id=42', { tenantSlug: 'tenant-a' });
  });

  it('posts analytics event and validates ingest ack contract', async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      contract_version: 'analytics.event_ingest.v1',
      request_id: 'req-ingest-fetch',
      accepted: true,
      ignored: false,
      tenant_id: 42,
      event_name: 'ticket_created',
      contact_key: 'ck-1',
    });

    const result = await postAnalyticsEvent({ event_name: 'ticket_created' }, 'tenant-a');

    expect(result.contract_version).toBe('analytics.event_ingest.v1');
    expect(apiFetchMock).toHaveBeenCalledWith('/api/analytics/event', {
      method: 'POST',
      body: { event_name: 'ticket_created' },
      tenantSlug: 'tenant-a',
    });
  });

  it('returns a controlled ignored ack instead of raising a synthetic 502', async () => {
    apiFetchMock.mockResolvedValueOnce({
      accepted: false,
      contract_version: 'analytics.event_ingest.v1',
      event_name: 'survey_page_view',
      ignored: true,
      ok: true,
      reason: 'access_denied',
      request_id: 'req-ingest-ignored',
      success: true,
      tenant_id: 142,
    });

    const result = await postAnalyticsEvent(
      { event_name: 'survey_page_view', survey_slug: 'demo-survey' },
      'municipio',
    );

    expect(result).toEqual({
      accepted: false,
      contract_version: 'analytics.event_ingest.v1',
      event_name: 'survey_page_view',
      ignored: true,
      ok: true,
      reason: 'access_denied',
      request_id: 'req-ingest-ignored',
      tenant_id: 142,
    });
  });

  it('loads analytics geo points with fallback and preserves request_id/map_layers', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('Not Found', 404));
    apiFetchMock.mockResolvedValueOnce({
      request_id: 'req-geo-points-1',
      points: [{ lat: -34.6, lng: -58.38, weight: 4 }],
      map_layers: {
        contract_version: 'analytics.geo_layers.v1',
      },
    });

    const result = await analyticsService.getGeoPoints(
      { tenantSlug: 'tenant-a', scope: 'municipio', limit: 200 },
      { sections: {} },
    );

    expect(result.request_id).toBe('req-geo-points-1');
    expect(result.map_layers).toMatchObject({ contract_version: 'analytics.geo_layers.v1' });
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      1,
      '/analytics/geo/points?scope=municipio&limit=200',
      expect.objectContaining({ tenantSlug: 'tenant-a' }),
    );
    expect(apiFetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/analytics/geo/points?scope=municipio&limit=200',
      expect.objectContaining({ tenantSlug: 'tenant-a' }),
    );
  });
});
