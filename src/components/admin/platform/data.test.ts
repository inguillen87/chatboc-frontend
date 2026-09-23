import { describe, expect, it } from 'vitest';
import { buildPlatformOverview } from './data';

// Synthetic records with the deployed backend 912446 contract shape.
const tenants = [
  { id: 1, slug: 'qa-public', nombre: 'QA Public', tipo: 'municipio', plan: 'pro', is_active: true, status: 'active' },
  { id: 2, slug: 'qa-shop', nombre: 'QA Shop', tipo: 'pyme', plan: 'gratis', is_active: false, status: 'inactive' },
];
const healthItem = (slug: string, score: unknown) => ({
  tenant: { slug, nombre: `QA ${slug}`, tipo: 'pyme', is_active: true },
  health: { score, status: 'warning', checks: { active: true, whatsapp_configured: false } },
  metrics: { open_tickets: 2, overdue_tickets: 1 },
  alerts: [{ severity: 'medium', reason_code: 'whatsapp_configured', message: 'Check pendiente: whatsapp_configured' }],
});
const executive = (items: unknown[], total = items.length) => ({
  contract_version: 'superadmin.executive_summary.v1',
  summary: { tenants: total, avg_health_score: 100 },
  tenant_health: { items, top_risky: items.slice(0, 10) },
});
const command = (items: unknown[]) => ({
  contract_version: 'superadmin.command_center.v1',
  summary: { tenants: items.length, avg_health_score: 100 },
  tenants: { items, top_risky: items.slice(0, 10) },
});

describe('platform overview source boundaries', () => {
  it('uses the directory total without promoting a limited command cohort to the global total', () => {
    const data = buildPlatformOverview({ tenants, total: 131, commandCenter: command([healthItem('qa-public', 50)]) });
    expect(data.directory).toMatchObject({ total: 131, loaded: 2, complete: false, activeLoaded: 1, inactiveLoaded: 1 });
    expect(data.health).toMatchObject({ mean: 50, denominator: 1, totalRows: 1, scope: 'command_center_tenants' });
    expect(data.planDistribution.reduce((sum, row) => sum + row.count, 0)).toBe(2);
  });

  it('reads nested executive rows from raw instead of displaying invented tenant_N identities', () => {
    const data = buildPlatformOverview({ executiveSummary: {
      tenant_health: [{ tenant_slug: 'tenant_1', health_score: 1 }],
      raw: executive([healthItem('qa-public', 66.67)]),
    } });
    expect(data.health.rows[0]).toEqual({
      slug: 'qa-public', name: 'QA qa-public', score: 66.67, status: 'warning',
      alerts: ['Check pendiente: whatsapp_configured'],
    });
    expect(data.health.mean).toBe(66.67);
  });

  it('never multiplies a one-point health score by one hundred', () => {
    const data = buildPlatformOverview({ executiveSummary: executive([healthItem('qa-a', 1), healthItem('qa-b', 0)]) });
    expect(data.health).toMatchObject({ mean: 0.5, denominator: 2 });
    expect(data.health.rows.map(row => row.score)).toEqual([0, 1]);
  });

  it('does not turn the backend empty-cohort default of 100 into measured health', () => {
    const data = buildPlatformOverview({ tenants: [], total: 0, executiveSummary: executive([]), crmItems: [] });
    expect(data.directory).toMatchObject({ total: 0, loaded: 0, complete: true, activeLoaded: 0 });
    expect(data.health).toMatchObject({ mean: null, denominator: 0, totalRows: 0 });
    expect(data.crm.loaded).toBe(0);
  });

  it('keeps request errors unavailable even when stale successful values remain in state', () => {
    const data = buildPlatformOverview({
      tenants, total: 2, tenantsError: true,
      executiveSummary: executive([healthItem('qa-a', 100)]), executiveError: true,
      commandCenter: command([healthItem('qa-b', 100)]), commandError: true,
      crmItems: [{ lead_temperature: 'hot' }], crmSummary: { total: 1, hot: 1, warm: 0, cold: 0 }, crmError: true,
    });
    expect(data.directory).toMatchObject({ total: null, loaded: null, activeLoaded: null, complete: false });
    expect(data.planDistribution).toEqual([]);
    expect(data.health).toMatchObject({ mean: null, denominator: null, rows: [], scope: 'unavailable' });
    expect(data.crm).toMatchObject({ loaded: null, hot: null, cold: null });
    expect(data.executiveTotal).toBeNull();
  });

  it('marks missing input unavailable, not an empty successful request', () => {
    const data = buildPlatformOverview({});
    expect(data.directory.loaded).toBeNull();
    expect(data.crm.loaded).toBeNull();
    expect(data.health.mean).toBeNull();
  });

  it('reveals conflicting snapshots without overwriting the directory total', () => {
    const data = buildPlatformOverview({ tenants, total: 31, executiveSummary: executive([], 28) });
    expect(data.directory.total).toBe(31);
    expect(data.executiveTotal).toBe(28);
    expect(data.executiveCountMismatch).toBe(true);
  });

  it('counts only returned CRM contacts and leaves missing or unfamiliar temperature unclassified', () => {
    const data = buildPlatformOverview({ crmItems: [
      { lead_temperature: 'hot' }, { lead_temperature: 'warm' }, { lead_temperature: 'cold' },
      { lead_temperature: null }, { lead_temperature: 'urgent' },
    ], crmSummary: { total: 999, hot: 1, warm: 1, cold: 997 } });
    expect(data.crm).toEqual({ loaded: 5, hot: 1, warm: 1, cold: 1, unknown: 2, scope: 'returned_items', summaryMatchesItems: false });
  });

  it('recognizes a matching returned-item CRM summary without claiming global coverage', () => {
    const data = buildPlatformOverview({ crmItems: [{ lead_temperature: 'hot' }], crmSummary: { total: 1, hot: 1, warm: 0, cold: 0 } });
    expect(data.crm).toMatchObject({ loaded: 1, scope: 'returned_items', summaryMatchesItems: true });
  });

  it('uses only valid score denominators and rejects missing identities and duplicates', () => {
    const data = buildPlatformOverview({ executiveSummary: executive([
      healthItem('qa-valid', 60), healthItem('qa-invalid', 101), healthItem('qa-null', null),
      healthItem('qa-string', '90'), healthItem('qa-nan', NaN),
      { health: { score: 100 } }, healthItem('qa-valid', 20),
    ]) });
    expect(data.health).toMatchObject({ mean: 60, denominator: 1, totalRows: 7 });
    expect(data.health.rows).toHaveLength(5);
    expect(data.health.rows.every(row => !row.slug.startsWith('tenant_'))).toBe(true);
  });

  it('does not silently label unknown plans, types or conflicting statuses as free/active', () => {
    const data = buildPlatformOverview({ tenants: [{ slug: 'qa-unknown', is_active: true, status: 'inactive' }], total: 1 });
    expect(data.directory).toMatchObject({ activeLoaded: 0, inactiveLoaded: 0, unknownStatusLoaded: 1 });
    expect(data.planDistribution).toEqual([{ key: 'unknown', count: 1 }]);
    expect(data.typeDistribution).toEqual([{ key: 'unknown', count: 1 }]);
  });

  it('exposes rejected directory rows and does not claim full coverage after deduplication', () => {
    const data = buildPlatformOverview({ tenants: [tenants[0], tenants[0], null, { nombre: 'No slug' }], total: 1 });
    expect(data.directory).toMatchObject({ total: 1, loaded: 1, complete: false, discardedRows: 3 });
  });

  it('falls back to a separately successful command cohort without reusing a failed executive snapshot', () => {
    const data = buildPlatformOverview({ executiveError: true, executiveSummary: executive([healthItem('old', 100)]), commandCenter: command([healthItem('current', 60)]) });
    expect(data.health).toMatchObject({ mean: 60, denominator: 1, scope: 'command_center_tenants' });
    expect(data.health.rows[0].slug).toBe('current');
  });

  it('rejects unknown contract versions and normalized rows without their source contract', () => {
    const data = buildPlatformOverview({ executiveSummary: { ...executive([healthItem('qa', 90)]), contract_version: 'superadmin.executive_summary.v2' }, commandCenter: { tenants: { items: [{ slug: 'invented', health_score: 90 }] } } });
    expect(data.health).toMatchObject({ mean: null, rows: [], scope: 'unavailable' });
  });
});
