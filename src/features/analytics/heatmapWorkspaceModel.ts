import type { AnalyticsHeatmapResponse } from '@/services/analyticsService';
import { buildMapExperience } from '@/features/maps/mapExperienceAdapter';
import { geoRecord, geoText, geoNumber, isHeatmapRedacted, protectHeatmapPrivacy } from './heatmapBoundary';
export const GEO_DIMENSIONS = ['categoria', 'canal', 'distrito', 'source', 'genero', 'rango_edad'] as const;
export type GeoDimension = typeof GEO_DIMENSIONS[number];
export type GeoFilters = Record<GeoDimension, string>;
export const GEO_LABELS: Record<GeoDimension, string> = {
  categoria: 'Categoría', canal: 'Canal', distrito: 'Distrito', source: 'Fuente', genero: 'Género', rango_edad: 'Rango de edad',
};
const ALIASES: Record<GeoDimension, string[]> = {
  categoria: ['categoria','category','categories'], canal: ['canal','channel'], distrito: ['distrito','district'],
  source: ['source','fuente'], genero: ['genero','gender','sexo'], rango_edad: ['rango_edad','age_range','age_ranges'],
};
export const geoFilters = (input: Partial<GeoFilters> = {}): GeoFilters => Object.fromEntries(GEO_DIMENSIONS.map(key => [key, geoText(input[key])])) as GeoFilters;
export const activeGeoFilters = (filters: GeoFilters) => Object.fromEntries(GEO_DIMENSIONS.filter(key => filters[key]).map(key => [key, filters[key]]));
export interface GeoBreakdown { key: string; label: string; count: number }
export function geoBreakdown(value: unknown, dimension: GeoDimension): GeoBreakdown[] {
  const segments = geoRecord(geoRecord(value).segments);
  const source = ALIASES[dimension].map(key => segments[key]).find(Array.isArray);
  if (!Array.isArray(source)) return [];
  const rows = source.flatMap(item => {
    const row = geoRecord(item), key = geoText(row.key ?? row.value ?? row.label), count = geoNumber(row.count);
    return key && count !== null && Number.isSafeInteger(count) && count >= 0 ? [{ key, label: geoText(row.label) || key, count }] : [];
  });
  const counts = new Map<string, number>(); rows.forEach(row => counts.set(row.key, (counts.get(row.key) || 0) + 1));
  return rows.filter(row => counts.get(row.key) === 1).sort((a,b) => b.count - a.count || a.label.localeCompare(b.label, 'es'));
}
export function geoOptions(value: AnalyticsHeatmapResponse, dimension: GeoDimension): Array<{ key: string; label: string }> {
  const options = new Map(geoBreakdown(value, dimension).map(row => [row.key, row.label]));
  for (const item of [...(value.points || []), ...(value.cells || [])]) {
    const row = geoRecord(item), key = ALIASES[dimension].map(alias => geoText(row[alias])).find(Boolean);
    if (key && !options.has(key)) options.set(key, key);
  }
  return [...options].map(([key,label]) => ({ key,label }));
}
export function geoCoverage(value: unknown) {
  const data = geoRecord(value), quality = geoRecord(data.location_quality);
  const integer = (value: unknown) => {
    const n = geoNumber(value);
    return n !== null && Number.isSafeInteger(n) && n >= 0 ? n : null;
  };
  const ticketCoverage = quality.contract_version === 'operations.location_quality.v1';
  if (ticketCoverage) {
    const total = integer(quality.total_ticket_records);
    const reported = integer(quality.ticket_records_with_coordinates);
    const validated = integer(quality.ticket_records_with_validated_coordinates);
    const eligible = validated ?? reported;
    const rawCoverage = geoNumber(quality.coordinate_coverage_pct);
    const countsConflict = (reported !== null && validated !== null && reported !== validated)
      || (total !== null && eligible !== null && eligible > total);
    const withCoordinates = countsConflict ? null : eligible;
    const withoutCoordinates = total !== null && withCoordinates !== null ? total - withCoordinates : null;
    const coverage = rawCoverage !== null && rawCoverage >= 0 && rawCoverage <= 100 ? rawCoverage : null;
    // The producer rounds percentage points to two decimal places.
    const expected = total !== null && total > 0 && withCoordinates !== null ? 100 * withCoordinates / total : null;
    const percentageConflict = coverage !== null && (total === 0
      || (expected !== null && Math.abs(coverage - expected) > 0.005000001));
    const inconsistent = countsConflict || percentageConflict;
    return { withCoordinates, withoutCoordinates, coverage: inconsistent || expected === null ? null : coverage, total, inconsistent, ticketCoverage };
  }
  const withCoordinates = integer(quality.with_coordinates), withoutCoordinates = integer(quality.without_coordinates), total = integer(quality.total);
  const raw = geoNumber(quality.coverage_pct), coverage = raw !== null && raw >= 0 && raw <= 100 ? raw : null;
  const inconsistent = total !== null && withCoordinates !== null && withoutCoordinates !== null && total !== withCoordinates + withoutCoordinates;
  return { withCoordinates, withoutCoordinates, coverage: inconsistent ? null : coverage, total, inconsistent, ticketCoverage };
}
export function heatmapMapModel(value: AnalyticsHeatmapResponse, local: { estado: string; severidad: string }) {
  const safe = protectHeatmapPrivacy(value) as unknown as AnalyticsHeatmapResponse;
  const experience = buildMapExperience(safe, { sourceContract: safe.contract_version, sourceKind: 'analytics_heatmap' });
  const localActive = Boolean(local.estado || local.severidad);
  const displayPoints = experience.displayPoints.filter(point => {
    const row = geoRecord(point);
    return (!local.estado || geoText(row.estado) === local.estado) && (!local.severidad || geoText(row.severidad) === local.severidad);
  });
  // Zero local matches stay empty. Never restore the unfiltered source, cells or polygons.
  const source = localActive ? undefined : experience.geoLayerSource;
  const bounds = displayPoints.map(point => [point.lng, point.lat] as [number,number]);
  const center: [number,number] | undefined = bounds.length ? [bounds.reduce((n,p)=>n+p[0],0)/bounds.length,bounds.reduce((n,p)=>n+p[1],0)/bounds.length] : undefined;
  const redacted = isHeatmapRedacted(safe);
  const meta = geoRecord(safe.metadata);
  const synthetic = meta.synthetic === true || meta.demo === true || ['synthetic','demo'].includes(geoText(meta.data_mode ?? meta.source));
  return { safe, experience, displayPoints, bounds, center, source, localActive, redacted, synthetic,
    config: localActive ? undefined : experience.geoLayerConfig,
    evidence: { metadata: safe.metadata, locationQuality: safe.location_quality, requestId: safe.request_id,
      contractVersion: safe.contract_version, pointCount: displayPoints.length, cellCount: experience.cells.length,
      featureCount: source?.features.length || 0, coveragePct: geoCoverage(safe).coverage ?? undefined,
      usingCellFallback: experience.quality.usingCellFallback, rawPointsRedacted: redacted,
      privacyMode: experience.quality.privacyMode } };
}
export function assertGeoFilterReceipt(value: unknown, filters: GeoFilters): void {
  const data = geoRecord(value), applied = geoRecord(data.segments_filters_applied ?? data.filters_applied ?? data.applied_filters);
  for (const key of GEO_DIMENSIONS) {
    if (filters[key] && Object.hasOwn(applied, key) && String(applied[key]) !== filters[key]) throw new Error('El servicio no confirmó el filtro solicitado.');
  }
}
