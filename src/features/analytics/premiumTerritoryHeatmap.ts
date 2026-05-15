import type { OperationsHeatmapPoint } from './analyticsTypes';

export const PREMIUM_HEATMAP_MIN_SAMPLE_SIZE = 10;

export type TerritoryFilterKey =
  | 'categoria'
  | 'rango_edad'
  | 'genero'
  | 'canal'
  | 'barrio'
  | 'estado'
  | 'source'
  | 'tenant';

export type TerritoryFilterState = Partial<Record<TerritoryFilterKey, string>>;

export type TerritoryPolygonPoint = [number, number];

export interface TerritoryZone {
  id: string;
  label: string;
  polygon: TerritoryPolygonPoint[];
  population?: number;
}

export interface TerritoryCategoryMetric {
  key: string;
  label: string;
  total: number;
}

export interface TerritoryZoneMetric {
  zone: TerritoryZone;
  total: number;
  previousTotal: number;
  records: number;
  intensity: number;
  suppressed: boolean;
  confidence: 'insufficient' | 'medium' | 'high';
  ratePerThousand?: number;
  variationPercent?: number;
  topCategories: TerritoryCategoryMetric[];
  recommendation: string;
}

export interface TerritoryHeatmapAggregate {
  zones: TerritoryZoneMetric[];
  totalEvents: number;
  totalRecords: number;
  activeZones: number;
  alerts: number;
  confidence: 'empty' | 'low' | 'medium' | 'high';
  topCategories: TerritoryCategoryMetric[];
}

const normalizeToken = (value: unknown) => String(value ?? '').trim().toLowerCase();

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const readField = (point: OperationsHeatmapPoint, fields: string[]) => {
  for (const field of fields) {
    const value = point[field];
    const parsed = typeof value === 'number' && Number.isFinite(value) ? String(value) : asString(value);
    if (parsed) return parsed;
  }
  return undefined;
};

const readWeight = (point: OperationsHeatmapPoint) =>
  Math.max(0, asNumber(point.weight ?? point.count ?? point.total ?? point.value) ?? 1);

const readPreviousWeight = (point: OperationsHeatmapPoint) =>
  Math.max(0, asNumber(point.previous ?? point.previous_total ?? point.previous_weight) ?? 0);

const centroid = (polygon: TerritoryPolygonPoint[]): TerritoryPolygonPoint => {
  if (!polygon.length) return [50, 34];
  const [x, y] = polygon.reduce(
    (acc, point) => [acc[0] + point[0], acc[1] + point[1]],
    [0, 0] as TerritoryPolygonPoint,
  );
  return [x / polygon.length, y / polygon.length];
};

const getPointBounds = (points: OperationsHeatmapPoint[]) => {
  const coordinates = points
    .map((point) => ({ lat: asNumber(point.lat), lng: asNumber(point.lng) }))
    .filter((point): point is { lat: number; lng: number } => point.lat !== undefined && point.lng !== undefined);

  if (!coordinates.length) {
    return { minLat: -35, maxLat: -34, minLng: -61, maxLng: -60 };
  }

  const minLat = Math.min(...coordinates.map((point) => point.lat));
  const maxLat = Math.max(...coordinates.map((point) => point.lat));
  const minLng = Math.min(...coordinates.map((point) => point.lng));
  const maxLng = Math.max(...coordinates.map((point) => point.lng));
  return {
    minLat: minLat === maxLat ? minLat - 0.01 : minLat,
    maxLat: minLat === maxLat ? maxLat + 0.01 : maxLat,
    minLng: minLng === maxLng ? minLng - 0.01 : minLng,
    maxLng: minLng === maxLng ? maxLng + 0.01 : maxLng,
  };
};

const projectPoint = (
  point: OperationsHeatmapPoint,
  bounds: ReturnType<typeof getPointBounds>,
): TerritoryPolygonPoint => {
  const lat = asNumber(point.lat) ?? bounds.minLat;
  const lng = asNumber(point.lng) ?? bounds.minLng;
  const x = 10 + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 80;
  const y = 8 + ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * 52;
  return [Number.isFinite(x) ? x : 50, Number.isFinite(y) ? y : 34];
};

const distance = (a: TerritoryPolygonPoint, b: TerritoryPolygonPoint) => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
};

const categoryLabel = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (letter) => letter.toUpperCase());

const passesFilters = (point: OperationsHeatmapPoint, filters?: TerritoryFilterState) => {
  if (!filters) return true;
  const checks: Array<[TerritoryFilterKey, string[]]> = [
    ['categoria', ['categoria', 'category']],
    ['rango_edad', ['rango_edad', 'age_range', 'ageRange', 'edad', 'age']],
    ['genero', ['genero', 'gender', 'sexo']],
    ['canal', ['canal', 'channel']],
    ['barrio', ['barrio', 'neighborhood', 'distrito', 'district']],
    ['estado', ['estado', 'status']],
    ['source', ['source', 'type', 'layer']],
    ['tenant', ['tenant', 'tenant_slug', 'tenantSlug']],
  ];

  return checks.every(([key, fields]) => {
    const expected = normalizeToken(filters[key]);
    if (!expected) return true;
    const actual = normalizeToken(readField(point, fields));
    return actual === expected;
  });
};

const resolvePointZone = (
  point: OperationsHeatmapPoint,
  zones: TerritoryZone[],
  bounds: ReturnType<typeof getPointBounds>,
) => {
  const zoneToken = normalizeToken(
    readField(point, ['barrio', 'neighborhood', 'distrito', 'district', 'zone', 'zona']),
  );
  const direct = zones.find((zone) => normalizeToken(zone.id) === zoneToken || normalizeToken(zone.label) === zoneToken);
  if (direct) return direct;

  const projected = projectPoint(point, bounds);
  return zones.reduce((best, zone) => {
    const zoneDistance = distance(projected, centroid(zone.polygon));
    return zoneDistance < best.distance ? { zone, distance: zoneDistance } : best;
  }, { zone: zones[0], distance: Number.POSITIVE_INFINITY }).zone;
};

export const DEFAULT_TERRITORY_ZONES: TerritoryZone[] = [
  { id: 'centro', label: 'Centro', population: 32000, polygon: [[31, 25], [48, 21], [58, 31], [52, 45], [35, 47], [25, 36]] },
  { id: 'norte', label: 'Norte', population: 22000, polygon: [[30, 7], [53, 6], [61, 21], [48, 21], [31, 25], [22, 17]] },
  { id: 'sur', label: 'Sur', population: 26000, polygon: [[34, 47], [52, 45], [63, 57], [51, 65], [28, 62], [20, 51]] },
  { id: 'oeste', label: 'Oeste', population: 18000, polygon: [[8, 21], [22, 17], [31, 25], [25, 36], [13, 43], [5, 34]] },
  { id: 'este', label: 'Este', population: 21000, polygon: [[61, 21], [82, 18], [92, 32], [79, 43], [58, 31]] },
  { id: 'parque', label: 'Parque', population: 14000, polygon: [[13, 43], [25, 36], [35, 47], [28, 62], [10, 58], [5, 49]] },
  { id: 'ribera', label: 'Ribera', population: 12000, polygon: [[79, 43], [92, 32], [97, 52], [86, 63], [63, 57], [52, 45]] },
  { id: 'industrial', label: 'Industrial', population: 15000, polygon: [[53, 6], [76, 7], [90, 17], [82, 18], [61, 21]] },
];

const DEMO_CATEGORIES = {
  gobierno: ['reclamos', 'turnos', 'salud', 'espacios_publicos'],
  empresa: ['ventas', 'soporte', 'leads', 'riesgo'],
  colegio: ['asistencia', 'consultas', 'convivencia', 'becas'],
  general: ['demanda', 'soporte', 'incidentes', 'consultas'],
};

const DEMO_AGE_RANGES = ['0-12', '13-17', '18-29', '30-44', '45-64', '65+'];
const DEMO_GENDERS = ['femenino', 'masculino', 'no_informado'];
const DEMO_CHANNELS = ['whatsapp', 'widget', 'web'];
const DEMO_STATUS = ['nuevo', 'en_gestion', 'resuelto'];

export const getDemoTerritoryHeatmapPoints = (
  profile: keyof typeof DEMO_CATEGORIES = 'general',
): OperationsHeatmapPoint[] => {
  const categories = DEMO_CATEGORIES[profile] ?? DEMO_CATEGORIES.general;
  const points: OperationsHeatmapPoint[] = [];

  DEFAULT_TERRITORY_ZONES.forEach((zone, zoneIndex) => {
    const [x, y] = centroid(zone.polygon);
    categories.forEach((category, categoryIndex) => {
      const records = 4 + ((zoneIndex + categoryIndex) % 5);
      Array.from({ length: records }).forEach((_, recordIndex) => {
        const offsetX = ((recordIndex % 4) - 1.5) * 0.006;
        const offsetY = ((recordIndex % 3) - 1) * 0.005;
        const weight = 1 + ((zoneIndex + categoryIndex + recordIndex) % 4);
        points.push({
          id: `demo-${zone.id}-${category}-${recordIndex}`,
          lat: -34.75 + (68 - y) * 0.006 + offsetY,
          lng: -60.98 + x * 0.007 + offsetX,
          weight,
          previous: Math.max(0, weight - ((zoneIndex + recordIndex) % 2)),
          barrio: zone.label,
          categoria: category,
          category,
          rango_edad: DEMO_AGE_RANGES[(zoneIndex + recordIndex) % DEMO_AGE_RANGES.length],
          genero: DEMO_GENDERS[(categoryIndex + recordIndex) % DEMO_GENDERS.length],
          canal: DEMO_CHANNELS[(zoneIndex + categoryIndex) % DEMO_CHANNELS.length],
          estado: DEMO_STATUS[(recordIndex + categoryIndex) % DEMO_STATUS.length],
          source: categoryIndex % 2 === 0 ? 'tickets' : 'analytics_events',
        });
      });
    });
  });

  return points;
};

export const aggregateTerritoryHeatmap = ({
  points,
  filters,
  zones = DEFAULT_TERRITORY_ZONES,
  minSampleSize = PREMIUM_HEATMAP_MIN_SAMPLE_SIZE,
}: {
  points: OperationsHeatmapPoint[];
  filters?: TerritoryFilterState;
  zones?: TerritoryZone[];
  minSampleSize?: number;
}): TerritoryHeatmapAggregate => {
  const filteredPoints = points.filter((point) => passesFilters(point, filters));
  const bounds = getPointBounds(filteredPoints);
  const byZone = new Map(
    zones.map((zone) => [
      zone.id,
      {
        zone,
        total: 0,
        previousTotal: 0,
        records: 0,
        categories: new Map<string, number>(),
      },
    ]),
  );

  filteredPoints.forEach((point) => {
    const zone = resolvePointZone(point, zones, bounds);
    const metric = byZone.get(zone.id);
    if (!metric) return;
    const weight = readWeight(point);
    const previous = readPreviousWeight(point);
    const category = readField(point, ['categoria', 'category']) ?? 'sin_categoria';
    metric.total += weight;
    metric.previousTotal += previous;
    metric.records += 1;
    metric.categories.set(category, (metric.categories.get(category) ?? 0) + weight);
  });

  const maxTotal = Math.max(1, ...Array.from(byZone.values()).map((metric) => metric.total));
  const categoryTotals = new Map<string, number>();
  byZone.forEach((metric) => {
    metric.categories.forEach((total, key) => categoryTotals.set(key, (categoryTotals.get(key) ?? 0) + total));
  });

  const zonesMetrics = Array.from(byZone.values()).map<TerritoryZoneMetric>((metric) => {
    const suppressed = metric.records > 0 && metric.records < minSampleSize;
    const topCategories = suppressed
      ? []
      : Array.from(metric.categories.entries())
          .map(([key, total]) => ({ key, label: categoryLabel(key), total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 3);
    const variationPercent =
      metric.previousTotal > 0 ? ((metric.total - metric.previousTotal) / metric.previousTotal) * 100 : undefined;
    const confidence = suppressed ? 'insufficient' : metric.records >= 30 ? 'high' : 'medium';
    const recommendation = suppressed
      ? 'Ampliar muestra antes de decidir.'
      : topCategories[0]
        ? `Priorizar ${topCategories[0].label.toLowerCase()} en esta zona.`
        : 'Mantener monitoreo operativo.';

    return {
      zone: metric.zone,
      total: Number(metric.total.toFixed(2)),
      previousTotal: Number(metric.previousTotal.toFixed(2)),
      records: metric.records,
      intensity: metric.total / maxTotal,
      suppressed,
      confidence,
      ratePerThousand: metric.zone.population
        ? Number(((metric.total / metric.zone.population) * 1000).toFixed(2))
        : undefined,
      variationPercent: variationPercent === undefined ? undefined : Number(variationPercent.toFixed(1)),
      topCategories,
      recommendation,
    };
  });

  const totalEvents = zonesMetrics.reduce((sum, metric) => sum + metric.total, 0);
  const totalRecords = zonesMetrics.reduce((sum, metric) => sum + metric.records, 0);
  const activeZones = zonesMetrics.filter((metric) => metric.records > 0).length;
  const alerts = zonesMetrics.filter((metric) => !metric.suppressed && metric.intensity >= 0.72).length;
  const confidence =
    totalRecords === 0
      ? 'empty'
      : totalRecords < minSampleSize
        ? 'low'
        : zonesMetrics.some((metric) => metric.confidence === 'high')
          ? 'high'
          : 'medium';

  return {
    zones: zonesMetrics,
    totalEvents: Number(totalEvents.toFixed(2)),
    totalRecords,
    activeZones,
    alerts,
    confidence,
    topCategories: Array.from(categoryTotals.entries())
      .map(([key, total]) => ({ key, label: categoryLabel(key), total: Number(total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5),
  };
};

export const territoryPolygonToPath = (polygon: TerritoryPolygonPoint[]) =>
  polygon.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ') + ' Z';

export const territoryCentroid = centroid;
