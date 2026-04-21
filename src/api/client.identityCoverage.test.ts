import { describe, expect, it } from 'vitest';
import { parseIdentityCoverageResponseV1 } from '@/services/identityCoverageContract';

describe('parseIdentityCoverageResponseV1', () => {
  it('normalizes numeric fields and alerts with strict contract', () => {
    const normalized = parseIdentityCoverageResponseV1({
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

  it('returns null for malformed payloads', () => {
    expect(parseIdentityCoverageResponseV1('invalid')).toBeNull();
  });
});
