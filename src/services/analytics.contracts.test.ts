import { describe, expect, it } from 'vitest';
import {
  parseAnalyticsEventIngestAckV1,
  parseAnalyticsEventSchemaV1,
  parseIdentityCoverageResponseV1,
  parseWhatsappFunnelResponse,
} from '@/services/analyticsService';

describe('parseWhatsappFunnelResponse', () => {
  it('parses valid funnel payload with contract_version and unique_contacts', () => {
    const parsed = parseWhatsappFunnelResponse({
      contract_version: '1.1.0',
      tenant_id: 9,
      scope: 'tenant',
      window_minutes: 60,
      stages: [
        { event_name: 'sent', label: 'Enviados', sessions: 120, unique_contacts: 100, conversion_from_prev_pct: null },
        { event_name: 'read', label: 'Leídos', sessions: '95', unique_contacts: '80', conversion_from_prev_pct: '79.1' },
      ],
    });

    expect(parsed).toEqual({
      contract_version: '1.1.0',
      tenant_id: 9,
      scope: 'tenant',
      window_minutes: 60,
      stages: [
        { event_name: 'sent', label: 'Enviados', sessions: 120, unique_contacts: 100, conversion_from_prev_pct: null },
        { event_name: 'read', label: 'Leídos', sessions: 95, unique_contacts: 80, conversion_from_prev_pct: 79.1 },
      ],
    });
  });

  it('returns null when contract_version is missing', () => {
    const parsed = parseWhatsappFunnelResponse({
      stages: [{ stage: 'sent', count: 10 }],
    });

    expect(parsed).toBeNull();
  });
});

describe('parseIdentityCoverageResponseV1', () => {
  it('parses v1 coverage payload with strict contract_version', () => {
    const parsed = parseIdentityCoverageResponseV1({
      contract_version: 'analytics.identity_coverage.v1',
      request_id: 'req-cov-1',
      tenant_id: 5,
      coverage_pct: 93.4,
      slo_status: 'below_target',
      alert_count: 1,
      alerts: [
        {
          channel: 'whatsapp',
          coverage_pct: 88,
          target_pct: 95,
          gap_pct: 7,
          severity: 'high',
        },
      ],
    });

    expect(parsed).toEqual({
      contract_version: 'analytics.identity_coverage.v1',
      request_id: 'req-cov-1',
      tenant_id: 5,
      coverage_pct: 93.4,
      slo_status: 'below_target',
      alert_count: 1,
      alerts: [
        {
          channel: 'whatsapp',
          coverage_pct: 88,
          target_pct: 95,
          gap_pct: 7,
          severity: 'high',
        },
      ],
    });
  });

  it('returns null when contract_version is invalid', () => {
    const parsed = parseIdentityCoverageResponseV1({
      contract_version: 'legacy',
      coverage_pct: 99,
      slo_status: 'ok',
      alert_count: 0,
      alerts: [],
    });

    expect(parsed).toBeNull();
  });
});

describe('parseAnalyticsEventIngestAckV1', () => {
  it('parses event ingest ack v1', () => {
    const parsed = parseAnalyticsEventIngestAckV1({
      ok: true,
      contract_version: 'analytics.event_ingest.v1',
      request_id: 'req-ingest-1',
      tenant_id: 42,
      event_name: 'ticket_created',
      contact_key: 'ck-1',
      conversation_id: 'conv-1',
      identity_source: 'conversation_id',
    });

    expect(parsed).toEqual({
      ok: true,
      contract_version: 'analytics.event_ingest.v1',
      request_id: 'req-ingest-1',
      tenant_id: 42,
      event_name: 'ticket_created',
      contact_key: 'ck-1',
      conversation_id: 'conv-1',
      identity_source: 'conversation_id',
    });
  });
});

describe('parseAnalyticsEventSchemaV1', () => {
  it('parses analytics event schema v1 catalog', () => {
    const parsed = parseAnalyticsEventSchemaV1({
      contract_version: 'analytics.event_schema.v1',
      request_id: 'req-schema-1',
      tenant_id: 42,
      required_dimensions: ['event_name', 'channel'],
      recommended_dimensions: ['contact_key', 'conversation_id'],
      canonical_events: ['ticket_created', 'ticket_resolved'],
    });

    expect(parsed).toEqual({
      contract_version: 'analytics.event_schema.v1',
      request_id: 'req-schema-1',
      tenant_id: 42,
      required_dimensions: ['event_name', 'channel'],
      recommended_dimensions: ['contact_key', 'conversation_id'],
      canonical_events: ['ticket_created', 'ticket_resolved'],
    });
  });
});
