import { describe, expect, it, vi } from 'vitest';
import Papa from 'papaparse';
import { buildOrganizationsCsv } from './exportOrganizations';
import type { Tenant } from '@/types/superAdmin';
vi.unmock('papaparse');

const org = (fields: Partial<Tenant>): Tenant => ({ id: 1, slug: 'sur', nombre: 'Gobierno del Sur', tipo: 'municipio', plan: 'pro', status: 'active', is_active: true, created_at: '', ...fields });

describe('organization CSV export', () => {
  it('round-trips Spanish names, quotes and line breaks using a real CSV parser', () => {
    const csv = buildOrganizationsCsv([org({ nombre: 'Área "A", Río\nGrande' })]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const result = Papa.parse<Record<string, string>>(csv, { header: true });
    expect(result.errors).toHaveLength(0);
    expect(result.data[0]).toMatchObject({ Organización: 'Área "A", Río\nGrande', Tipo: 'Gobierno', Estado: 'Activa' });
  });
  it.each(['=1+1', ' +SUM(1)', '@IMPORT', '-1+2', '\t=1', '\r=1'])('neutralizes spreadsheet formulas in %j', (value) => {
    const result = Papa.parse<Record<string, string>>(buildOrganizationsCsv([org({ nombre: value })]), { header: true });
    expect(result.data[0].Organización).toBe(`'${value}`);
  });
  it('exports only provided rows and the explicit safe field allowlist', () => {
    const csv = buildOrganizationsCsv([org({ slug: 'visible', token: 'DO-NOT-EXPORT', owner_email: 'admin@example.test' } as Partial<Tenant>)]);
    expect(csv).toContain('visible');
    expect(csv).not.toContain('DO-NOT-EXPORT');
    expect(Papa.parse(csv, { header: true }).data).toHaveLength(1);
  });
});
