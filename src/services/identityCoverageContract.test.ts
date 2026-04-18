import { describe, expect, it } from 'vitest';

import { parseIdentityCoverageResponseV1 } from '@/services/identityCoverageContract';

describe('identityCoverageContract parser', () => {
  it('parses valid v1 payload', () => {
    const parsed = parseIdentityCoverageResponseV1({
      contract_version: 'analytics.identity_coverage.v1',
      tenant_id: 2,
      coverage_pct: 94,
      slo_status: 'ok',
      alert_count: 1,
      alerts: [{ channel: 'whatsapp', coverage_pct: 90, target_pct: 95, gap_pct: 5, severity: 'medium' }],
    });

    expect(parsed?.coverage_pct).toBe(94);
    expect(parsed?.alerts[0].severity).toBe('medium');
  });

  it('rejects payload with wrong contract', () => {
    const parsed = parseIdentityCoverageResponseV1({
      contract_version: 'legacy',
      coverage_pct: 94,
      slo_status: 'ok',
      alert_count: 0,
      alerts: [],
    });

    expect(parsed).toBeNull();
  });
});
