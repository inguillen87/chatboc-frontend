import { describe, expect, it } from 'vitest';
import { assertHeatmapRecordScopes, assertHeatmapScope, mergeHeatmapHubPayload } from './heatmapBoundary';

const expected = { tenant_profile_id: 22, tenantSlug: 'junin' };
const hub = { contract_version: '2026-analytics-hub-v2', tenant_id: 4, tenant_slug: 'junin' };

describe('profile and owner identities in map payloads', () => {
  it('does not compare the legacy hub owner 4 against the profile 22', () => {
    expect(() => assertHeatmapScope(hub, expected)).not.toThrow();
    expect(() => assertHeatmapScope({ tenant: { id: 22, slug: 'junin' } }, expected)).not.toThrow();
    const merged = mergeHeatmapHubPayload(hub, { tenant_id: 22, points: [] }, expected);
    expect(merged).toMatchObject({ tenant_owner_id: 4, tenant_id: 22 });
    expect(() => assertHeatmapRecordScopes(merged, expected)).not.toThrow();
  });

  it('preserves legacy owner merge semantics unless the caller selects profile explicitly', () => {
    const merged = mergeHeatmapHubPayload(hub, { tenant_id: 22, points: [] });
    expect(merged.tenant_id).toBe(4);
    expect(merged.tenant_owner_id).toBeUndefined();
    expect(() => assertHeatmapScope(merged, { tenant_id: 4, tenantSlug: 'junin' })).not.toThrow();
  });

  it('does not relabel a v2 profile identifier as an owner', () => {
    const merged = mergeHeatmapHubPayload({ contract_version: 'operations.heatmap.v1', tenant_id: 22 }, { tenant_profile_id: 22, points: [] }, expected);
    expect(merged.tenant_profile_id).toBe(22);
    expect(merged.tenant_owner_id).toBeUndefined();
  });

  it.each([{ tenant: { id: 46 } }, { tenant_profile_id: 46 }, { tenant_id: 46 }, { tenant_slug: 'foreign' }])('rejects explicit foreign geographic identity %j', foreign => {
    expect(() => assertHeatmapScope(foreign, expected)).toThrow();
  });

  it('rejects foreign profile rows inside a valid legacy hub envelope', () => {
    expect(() => assertHeatmapRecordScopes({ ...hub, sections: { mapas: { points: [{ tenant_id: 46 }] } } }, expected)).toThrow();
    expect(() => assertHeatmapRecordScopes({ ...hub, tenant_profile_id: 46 }, expected)).toThrow();
  });

  it('never infers a profile grant from a matching owner integer', () => {
    const merged = mergeHeatmapHubPayload({ ...hub, tenant_id: 22 }, { points: [] }, expected);
    expect(merged.tenant_profile_id).toBeUndefined();
    expect(merged.tenant_id).toBeUndefined();
    expect(merged.tenant_owner_id).toBe(22);
  });
});
