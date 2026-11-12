import { describe, expect, it } from 'vitest';
import { commercialKey, type CommercialLead } from './commercialFollowUp';
import { buildCommercialInsights, commercialActivity, commercialActivityTimestamp, queryCommercialLeads } from './commercialInsightsModel';
const now = Date.parse('2026-09-23T18:00:00Z');
const lead = (id: string, stage: string, lastSeen: string | null, name = 'José'): CommercialLead => {
  const identity = { tenantSlug: 'org-a', ticketType: 'municipio' as const, ticketId: id };
  return { ...identity, key: commercialKey(identity), name, number: `900${id}`, email: '', phone: '', category: '', stage, lastSeen };
};
const old = '2026-09-01T00:00:00Z', recent = '2026-09-22T00:00:00Z';
describe('commercial snapshot analytics', () => {
  it('keeps unknown stages outside open counts while preserving the denominator', () => {
    const result = buildCommercialInsights([lead('1', 'nuevo', old), lead('2', 'ganado', old), lead('3', 'perdido', old), lead('4', 'unexpected', null)], now);
    expect(result.total).toBe(4); expect(result.open).toBe(1); expect(result.stages.unknown).toBe(1);
    expect(result.won).toBe(1); expect(result.lost).toBe(1);
    expect(Object.values(result.stages).reduce((a, b) => a + b, 0)).toBe(result.total);
  });
  it.each([null, '', 'bad', '2026-09-01T12:00:00', '2026-09-25T12:00:00Z', '2026-02-30T12:00:00Z', '2026-09-01T25:00:00Z'])('does not derive age from %s', (value) => expect(commercialActivityTimestamp(value, now)).toBeNull());
  it('accepts explicit timezone offsets and exact seven-day boundaries', () => {
    expect(commercialActivity(lead('1', 'nuevo', '2026-09-16T15:00:00-03:00'), now)).toBe('quiet');
    expect(commercialActivity(lead('1', 'nuevo', '2026-09-16T15:00:01-03:00'), now)).toBe('recent');
  });
  it('restricts activity charts to known open stages', () => {
    const result = buildCommercialInsights([lead('1', 'nuevo', old), lead('2', 'contactado', recent), lead('3', 'calificado', null), lead('4', 'ganado', old), lead('5', '', null)], now);
    expect(result.activity).toEqual({ recent: 1, quiet: 1, unknown: 1 }); expect(result.open).toBe(3);
  });
  it('combines accented search, stage and age filters without changing source order', () => {
    const rows = [lead('3', 'nuevo', recent), lead('2', 'nuevo', old), lead('1', 'ganado', old)];
    expect(queryCommercialLeads(rows, 'jose', 'open', 'quiet', 'oldest', now).map((x) => x.ticketId)).toEqual(['2']);
    expect(rows.map((x) => x.ticketId)).toEqual(['3', '2', '1']);
  });
  it('places unverified dates last for both date sorts', () => {
    const rows = [lead('1', 'nuevo', null), lead('2', 'nuevo', old), lead('3', 'nuevo', recent)];
    expect(queryCommercialLeads(rows, '', 'all', 'all', 'recent', now).map((x) => x.ticketId)).toEqual(['3', '2', '1']);
    expect(queryCommercialLeads(rows, '', 'all', 'all', 'oldest', now).map((x) => x.ticketId)).toEqual(['2', '3', '1']);
  });
  it('keeps an explicit filter for unknown stages', () => {
    expect(queryCommercialLeads([lead('1', 'nuevo', old), lead('2', 'custom', old)], '', 'unknown', 'all', 'name', now).map((x) => x.ticketId)).toEqual(['2']);
  });
  it('keeps zero-data charts honest', () => {
    const result = buildCommercialInsights([], now); expect(result.total).toBe(0); expect(result.open).toBe(0); expect(result.won).toBe(0);
  });
});
