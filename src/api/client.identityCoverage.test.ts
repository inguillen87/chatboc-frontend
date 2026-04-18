import { describe, expect, it } from 'vitest';
import { normalizeIdentityCoverageResponse } from '@/api/client';

describe('normalizeIdentityCoverageResponse', () => {
  it('normalizes numeric fields and alerts defensively', () => {
    const normalized = normalizeIdentityCoverageResponse({
      contract_version: 'analytics.identity_coverage.v1',
      tenant_id: '12',
      coverage_pct: '91.8',
      contact_key_coverage_pct: '95.5',
      conversation_id_coverage_pct: 88,
      combined_coverage_pct: '90',
      target_pct: '92',
      slo_status: 'below_target',
      alert_count: '2',
      summary_message: 'Baja cobertura en whatsapp',
      alerts: [
        {
          channel: 'whatsapp',
          message: 'Debajo del objetivo',
          coverage_pct: '87',
          gap_pct: '5',
          severity: 'high',
          current_pct: '87',
          target_pct: '92',
        },
      ],
    });

    expect(normalized).toEqual({
      contract_version: 'analytics.identity_coverage.v1',
      tenant_id: 12,
      coverage_pct: 91.8,
      contact_key_coverage_pct: 95.5,
      conversation_id_coverage_pct: 88,
      combined_coverage_pct: 90,
      target_pct: 92,
      slo_status: 'below_target',
      alert_count: 2,
      summary_message: 'Baja cobertura en whatsapp',
      alerts: [
        {
          channel: 'whatsapp',
          message: 'Debajo del objetivo',
          coverage_pct: 87,
          gap_pct: 5,
          severity: 'high',
          current_pct: 87,
          target_pct: 92,
        },
      ],
    });
  });

  it('returns safe defaults for malformed payloads', () => {
    const normalized = normalizeIdentityCoverageResponse('invalid');

    expect(normalized).toEqual({
      contract_version: undefined,
      tenant_id: undefined,
      coverage_pct: undefined,
      contact_key_coverage_pct: undefined,
      conversation_id_coverage_pct: undefined,
      combined_coverage_pct: undefined,
      target_pct: undefined,
      slo_status: undefined,
      alert_count: undefined,
      summary_message: undefined,
      alerts: [],
    });
  });
});
