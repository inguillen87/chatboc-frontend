import { describe, expect, it } from 'vitest';
import { assertStageReceipt, canonicalTicketId, commercialCsv, commercialKey, commercialPath, filterCommercialLeads, parseCommercialList, parseCommercialTimeline, validateCommercialNote } from './commercialFollowUp';
const identity = { tenantSlug: 'org-a', ticketType: 'municipio' as const, ticketId: '12' };
const row = { ticket_id: 12, ticket_type: 'municipio', nro: '9001', nombre: 'José Pérez', stage: 'nuevo' };
const list = (items: unknown[] = [row], tenant = 'org-a') => ({ tenant_slug: tenant, total: items.length, items });
describe('commercial follow-up contracts', () => {
  it('uses the internal ID instead of a distinct display number', () => {
    const value = parseCommercialList(list(), 'org-a').items[0];
    expect(value.ticketId).toBe('12'); expect(value.number).toBe('9001');
    expect(commercialPath(value, 'stage')).toBe('/api/admin/tenants/org-a/leads/municipio/12/stage');
  });
  it.each([null, undefined, '', '0', 0, -1, '12/../13', '12?tenant=x', '1e2', 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid ID %s', (value) => expect(canonicalTicketId(value)).toBeNull());
  it('preserves string IDs without lossy numeric conversion', () => expect(canonicalTicketId('9007199254740993')).toBe('9007199254740993'));
  it('does not manufacture an internal ID from the display number', () => expect(parseCommercialList(list([{ ...row, ticket_id: undefined }]), 'org-a').excluded).toBe(1));
  it('includes tenant and type in selection identity', () => {
    expect(commercialKey(identity)).not.toBe(commercialKey({ ...identity, tenantSlug: 'org-b' }));
    expect(commercialKey(identity)).not.toBe(commercialKey({ ...identity, ticketType: 'pyme' }));
  });
  it('rejects a foreign list envelope', () => expect(() => parseCommercialList(list([], 'org-b'), 'org-a')).toThrow());
  it('excludes foreign rows and all ambiguous duplicate identities', () => {
    const result = parseCommercialList(list([row, { ...row, nombre: 'Duplicate' }, { ...row, ticket_id: 13, tenant_slug: 'org-b' }, { ...row, ticket_id: 14 }]), 'org-a');
    expect(result.items.map((x) => x.ticketId)).toEqual(['14']); expect(result.excluded).toBe(3);
  });
  it.each(['../org-b', 'org-a/../../org-b', 'org-a?tenant=org-b', '', ' org-a'])('rejects route injection %s', (slug) => expect(() => commercialPath({ ...identity, tenantSlug: slug }, 'timeline')).toThrow());
  it('rejects timeline identity mismatch even for a successful HTTP payload', () => expect(() => parseCommercialTimeline({ ticket_id: 13, ticket_type: 'municipio', timeline: [] }, identity)).toThrow());
  it('requires explicit write confirmation', () => expect(() => parseCommercialTimeline({ ticket_id: 12, ticket_type: 'municipio', timeline: [] }, identity, true)).toThrow());
  it('does not mutate server event order while showing newest first', () => {
    const raw = { ticket_id: 12, ticket_type: 'municipio', timeline: [{ note: 'old' }, { note: 'new' }] };
    expect(parseCommercialTimeline(raw, identity).map((x) => x.note)).toEqual(['new', 'old']);
    expect(raw.timeline[0].note).toBe('old');
  });
  it.each([{ ok: true, ticket_id: 13, ticket_type: 'municipio', lead_stage: 'ganado' }, { ok: true, ticket_id: 12, ticket_type: 'pyme', lead_stage: 'ganado' }, { ok: true, ticket_id: 12, ticket_type: 'municipio', lead_stage: 'perdido' }])('rejects incoherent stage confirmation', (raw) => expect(() => assertStageReceipt(raw, identity, 'ganado')).toThrow());
  it('validates notes before writing', () => {
    expect(validateCommercialNote(' visita realizada ')).toBe('visita realizada');
    expect(() => validateCommercialNote(' ')).toThrow(); expect(() => validateCommercialNote('a'.repeat(1001))).toThrow();
  });
  it('combines accented search with an explicit stage filter without inventing unknown stages', () => {
    const rows = parseCommercialList(list([row, { ...row, ticket_id: 13, stage: 'perdido' }, { ...row, ticket_id: 14, stage: undefined }]), 'org-a').items;
    expect(filterCommercialLeads(rows, 'jose', 'open').map((x) => x.ticketId)).toEqual(['12']);
    expect(filterCommercialLeads(rows, '9001', 'perdido').map((x) => x.ticketId)).toEqual(['13']);
  });
  it('exports only selected rows, neutralizes formulas and escapes quotes/newlines', () => {
    const lead = parseCommercialList(list([{ ...row, nombre: '=SUM(1,2)', email: 'a"b\nc@example.test', telefono: '+541234' }]), 'org-a').items[0];
    const csv = commercialCsv([lead]); expect(csv).toContain('"\'=SUM(1,2)"'); expect(csv).toContain('"\'+541234"');
    expect(csv).toContain('"a""b\nc@example.test"'); expect(csv).toContain('"12","9001"');
    expect(commercialCsv([]).split('\r\n')).toHaveLength(2);
  });
});
