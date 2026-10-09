export type GeoRecord = Record<string, unknown>;
export const geoRecord = (value: unknown): GeoRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as GeoRecord : {};
export const geoText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
export const geoNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !/^[+-]?\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const number = Number(value); return Number.isFinite(number) ? number : null;
};
const enabled = (value: unknown) => value === true || value === 'true';
export function isHeatmapRedacted(value: unknown): boolean {
  const data = geoRecord(value), meta = geoRecord(data.metadata), privacy = geoRecord(data.privacy);
  return [data.raw_points_redacted, meta.raw_points_redacted, privacy.raw_points_redacted].some(enabled)
    || ['aggregated', 'cells_only', 'aggregate_only'].includes(geoText(meta.privacy_mode || data.privacy_mode).toLowerCase());
}
export interface HeatmapScopeExpectation { tenantSlug?: string | null; tenant_id?: number | string; tenant_profile_id?: number | string }
export function assertHeatmapScope(value: unknown, expected: HeatmapScopeExpectation): void {
  const data = geoRecord(value), tenant = geoRecord(data.tenant);
  for (const slug of [data.tenant_slug, data.tenantSlug, tenant.slug]) {
    if (slug !== undefined && slug !== null && expected.tenantSlug && slug !== expected.tenantSlug) throw new Error('La respuesta geográfica corresponde a otra organización.');
  }
  if (expected.tenant_profile_id !== undefined) {
    // The legacy hub explicitly reports its owner as tenant_id. Geographic
    // records and the v2 tenant object report TenantProfile identities.
    const legacyOwnerEnvelope = data.contract_version === '2026-analytics-hub-v2';
    const profileIds = [data.tenant_profile_id, tenant.id, ...(legacyOwnerEnvelope ? [] : [data.tenant_id])];
    for (const id of profileIds) {
      if (id !== undefined && id !== null && String(id) !== String(expected.tenant_profile_id)) throw new Error('La identidad geográfica recibida no coincide.');
    }
  } else {
    for (const id of [data.tenant_id, tenant.id]) {
      if (id !== undefined && id !== null && expected.tenant_id !== undefined && String(id) !== String(expected.tenant_id)) throw new Error('La identidad geográfica recibida no coincide.');
    }
  }
}
export function protectHeatmapPrivacy(value: unknown): GeoRecord {
  const data = geoRecord(value);
  if (!isHeatmapRedacted(data)) return data;
  // Only the server's aggregate cells survive an explicit raw-location redaction.
  const layers = geoRecord(data.geo_layers);
  return { ...data, points: [], puntos: [], geo_points: [], heatmap_points: [], heatmap: undefined,
    source: undefined, geojson: undefined, geo_json: undefined, feature_collection: undefined, map_layers: undefined,
    geo_layers: Object.keys(layers).length ? { ...layers, source: undefined, categories: [], telemetry: undefined } : undefined,
    geocoding: undefined, hotspots: [], category_layers: [], raw_points_redacted: true,
    metadata: { ...geoRecord(data.metadata), raw_points_redacted: true } };
}
export function mergeHeatmapHubPayload(hubValue: unknown, geoValue: unknown, expected: HeatmapScopeExpectation = {}): GeoRecord {
  const hub = geoRecord(hubValue), geo = geoRecord(geoValue);
  if (expected.tenant_profile_id !== undefined) {
    return { ...geo, ...(hub.tenant_slug !== undefined ? { tenant_slug: hub.tenant_slug } : {}),
      ...(hub.tenant_profile_id !== undefined ? { tenant_profile_id: hub.tenant_profile_id } : {}),
      ...(hub.contract_version === '2026-analytics-hub-v2' && hub.tenant_id !== undefined ? { tenant_owner_id: hub.tenant_id } : {}),
      ...(isHeatmapRedacted(hub) ? { raw_points_redacted: true } : {}) };
  }
  return { ...geo, ...(hub.tenant_slug !== undefined ? { tenant_slug: hub.tenant_slug } : {}),
    ...(hub.tenant_id !== undefined ? { tenant_id: hub.tenant_id } : {}),
    ...(isHeatmapRedacted(hub) ? { raw_points_redacted: true } : {}) };
}
export function assertHeatmapRecordScopes(value: unknown, expected: HeatmapScopeExpectation):void {
  const queue:unknown[]=[value],seen=new Set<object>();
  const fields=['points','puntos','geo_points','heatmap_points','cells','hotspots','category_layers','geo_layers','map_layers','source','features','properties','categories','layers','data','result','results','response','payload','geo','sections','mapas'];
  while(queue.length){
    const item=queue.pop();
    if(!item || typeof item!=='object' || seen.has(item))continue;
    seen.add(item);
    if(Array.isArray(item)){item.forEach(value=>queue.push(value));continue;}
    const row=geoRecord(item);assertHeatmapScope(row,expected);
    for(const field of fields)if(row[field] && typeof row[field]==='object')queue.push(row[field]);
  }
}
