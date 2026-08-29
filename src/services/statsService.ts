import { ApiError, apiFetch } from '@/utils/api';
import type { MapProvider } from '@/hooks/useMapProvider';
import { SAME_ORIGIN_PROXY_BASE } from '@/config';

const SAME_ORIGIN_API_BASE = SAME_ORIGIN_PROXY_BASE || '/api';

export interface HeatmapBreakdownItem {
  label: string;
  count: number;
  weight: number;
  percentage: number;
}

export interface HeatPoint {
  lat: number;
  lng: number;
  weight?: number;
  id?: number;
  ticket?: string;
  categoria?: string;
  direccion?: string;
  distrito?: string;
  barrio?: string;
  tipo_ticket?: string;
  estado?: string;
  severidad?: string;
  canal?: string;
  fuente?: string;
  ciudad?: string;
  provincia?: string;
  pais?: string;
  total?: number;
  last_ticket_at?: string | null;
  clusterId?: string;
  clusterSize?: number;
  totalWeight?: number;
  averageWeight?: number;
  radiusMeters?: number;
  maxDistanceMeters?: number;
  sampleTickets?: string[];
  aggregatedCategorias?: HeatmapBreakdownItem[];
  aggregatedBarrios?: HeatmapBreakdownItem[];
  aggregatedEstados?: HeatmapBreakdownItem[];
  aggregatedTipos?: HeatmapBreakdownItem[];
  aggregatedSeveridades?: HeatmapBreakdownItem[];
  intensity?: number;
  coordinates?: [number, number];
  location?: { lat: number; lng: number };
  feature?: Record<string, unknown>;
  // New fields for completeness
  source?: string;
  cellId?: string;
  pointCount?: number;
  aggregatedCanales?: HeatmapBreakdownItem[];
  aggregatedFuentes?: HeatmapBreakdownItem[];
  dominantValues?: Record<string, string | null | undefined>;
  categoryColor?: string;
}

type FeatureCollectionLike = {
  type: 'FeatureCollection';
  features: unknown[];
  [key: string]: unknown;
};

type FeatureLike = {
  type: 'Feature';
  [key: string]: unknown;
};

export interface HeatmapCellValue {
  value: string;
  count?: number;
  weight?: number;
}

export interface HeatmapCell {
  id: string;
  count: number;
  centroidLat?: number;
  centroidLng?: number;
  pointCount?: number;
  topValues?: Record<string, HeatmapCellValue[]>;
  dominantValues?: Record<string, string | null>;
  intensity?: number;
  location?: { lat: number; lng: number };
  coordinates?: [number, number];
  feature?: FeatureLike;
}

export interface MapLayerSource {
  kind?: string;
  supportedFormats?: string[];
  preferredFormat?: string;
  providerHint?: string;
  sourceKeys?: Record<string, string>;
  raw?: Record<string, unknown>;
}

export interface MapConfig {
  provider?: MapProvider | 'none' | string;
  google_maps_key?: string;
  maptiler_key?: string;
  style_url?: string;
  [key: string]: unknown;
}

export interface HeatmapMapMetadata {
  pointCount?: number;
  cellCount?: number;
  maxPointWeight?: number;
  maxCellCount?: number;
  totalWeight?: number;
  resolution?: number;
  bounds?: [number, number, number, number];
  centroid?: [number, number];
}

export interface HeatmapMetadata {
  map?: Record<string, HeatmapMapMetadata>;
  raw?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface HeatmapDataset {
  points: HeatPoint[];
  geojson?: FeatureCollectionLike;
  cells?: HeatmapCell[];
  cellsGeojson?: FeatureCollectionLike;
  mapConfig?: MapConfig;
  mapLayers?: Record<string, MapLayerSource>;
  metadata?: HeatmapMetadata;
  raw?: unknown;
}

export interface TicketStatsResponse {
  charts?: { title: string; data: Record<string, number> }[];
  heatmap?: HeatPoint[];
  heatmapDataset?: HeatmapDataset;
}

export interface HeatmapParams {
  tipo?: string;
  tenant_slug?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  tipo_ticket?: string; // legacy support
  categoria?: string | string[];
  estado?: string | string[];
  distrito?: string;
  barrio?: string;
  genero?: string | string[];
  edad_min?: string | number;
  edad_max?: string | number;
}

export interface TicketStatsParams extends HeatmapParams {
  genero?: string | string[];
  edad_min?: string | number;
  edad_max?: string | number;
  sugerencia?: string | string[];
  prioridad?: string | string[];
}

export interface AiReportResponse {
  summary: string;
  opportunities: string[];
  threats: string[];
  tone: string;
  _cached: boolean;
}

export interface SalesAnalyticsResponse {
  revenue: number;
  average_ticket: number;
  conversion_rate: number;
  total_orders: number;
  sales_by_product: { name: string; count: number }[];
  sales_by_hour: { hour: number; count: number }[];
  chat_conversion?: number;
  lead_source?: { source: string; count: number }[];
}

export interface BenchmarkData {
  current: number;
  previous: number;
  growth_percentage: number;
}

export interface BenchmarksResponse {
  revenue?: BenchmarkData;
  interactions?: BenchmarkData;
  orders?: BenchmarkData;
  tickets?: BenchmarkData;
}

export interface FunnelStep {
  name: string;
  count: number;
}

export interface FunnelResponse {
  steps: FunnelStep[];
}

export interface SurveySummaryResponse {
  active_survey?: { title: string; id: number };
  stats: {
    total_votes: number;
    participation_rate: number;
    results_by_option: { option: string; count: number }[];
  };
}

export interface SurveySentimentResponse {
  sentiment_score: number;
  keywords: { word: string; count: number }[];
}

export interface SurveyGeoResponse {
  points: { lat: number; lng: number; weight: number }[];
}

interface CoordinateCollector {
  latValues: number[];
  lngValues: number[];
  pairs: { lat: number; lng: number }[];
}

interface NormalizedChart {
  title: string;
  data: Record<string, number>;
}

interface NormalizeCellsResult {
  points: HeatPoint[];
  raw: Record<string, unknown>[];
}

const MUNICIPAL_TIPO_ALIASES = ['municipio', 'municipal', 'municipalidad'] as const;
const STATUS_KEYWORDS = ['estado', 'status', 'situacion'];

const LATITUDE_KEYWORDS = ['lat', 'latitude', 'latitud'];
const LONGITUDE_KEYWORDS = ['lng', 'lon', 'longitud', 'long'];
const COORDINATE_CONTAINER_KEYWORDS = [
  'coord',
  'coordenadas',
  'coordinates',
  'location',
  'ubicacion',
  'ubicación',
  'position',
  'posicion',
  'point',
  'punto',
  'geometry',
  'geom',
  'geojson',
  'center',
  'centro',
];

const NORMALIZED_STRING_FIELDS = {
  categoria: ['categoria', 'category', 'rubro'],
  direccion: ['direccion', 'address', 'domicilio', 'calle'],
  distrito: ['distrito', 'district', 'zone', 'zona'],
  barrio: ['barrio', 'neighborhood', 'colonia', 'sector'],
  tipoTicket: ['tipo_ticket', 'tipo', 'ticket_type', 'type'],
  estado: ['estado', 'status', 'situacion', 'situacion', 'situation'],
  ticket: ['ticket', 'ticket_id', 'ticketid', 'numero', 'nro', 'expediente'],
  severidad: ['severidad', 'severity'],
  canal: ['canal', 'channel'],
  fuente: ['fuente', 'source', 'origen'],
  ciudad: ['ciudad', 'city', 'localidad', 'municipio'],
  provincia: ['provincia', 'province', 'estado_provincial'],
  pais: ['pais', 'país', 'country'],
  lastTicketAt: ['last_ticket_at', 'last_ticket', 'last_at', 'last_seen', 'ultimo_ticket', 'ultima_actualizacion'],
};

const NORMALIZED_NUMBER_FIELDS = {
  weight: ['weight', 'peso', 'count', 'cantidad', 'total', 'value', 'tickets', 'intensity', 'intensidad'],
  id: ['id', 'ticket_id', 'ticketid'],
  total: ['total', 'total_weight', 'weight_total', 'totalTickets'],
};

const STRING_FIELD_KEYWORDS = Object.values(NORMALIZED_STRING_FIELDS).flat();
const NUMBER_FIELD_KEYWORDS = Object.values(NORMALIZED_NUMBER_FIELDS).flat();

const CHART_LABEL_KEYS = [
  'label',
  'name',
  'categoria',
  'category',
  'estado',
  'status',
  'tipo',
  'type',
  'segment',
  'grupo',
  'group',
  'clase',
  'class',
  'nivel',
  'level',
  'distrito',
  'district',
  'barrio',
  'neighborhood',
  'canal',
  'channel',
  'mes',
  'month',
  'semana',
  'week',
  'fecha',
  'date',
  'periodo',
  'period',
];

const CHART_VALUE_KEYS = [
  'value',
  'values',
  'count',
  'cantidad',
  'total',
  'tickets',
  'numero',
  'amount',
  'porcentaje',
  'percentage',
  'percent',
  'intensity',
];

const CHART_TITLE_KEYS = ['title', 'titulo', 'name', 'label'];

// Helper Functions
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const sanitizeLooseJson = (raw: string): string => {
  let sanitized = raw
    .replace(/\bNone\b/g, 'null')
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false');
  sanitized = sanitized.replace(/,\s*([}\]])/g, '$1');
  sanitized = sanitized.replace(/'([\p{L}\p{N}_-]+)'(\s*:)/gu, (_, key, suffix) => {
    const escapedKey = key.replace(/"/g, '\\"');
    return `"${escapedKey}"${suffix}`;
  });
  sanitized = sanitized.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, value) => {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `: "${escaped}"`;
  });
  sanitized = sanitized.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, value) => {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
  });
  return sanitized;
};

const tryParseLooseJson = (raw: string): unknown => {
  const trimmed = raw.trim();
  if (!trimmed) return raw;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch (jsonError) {
      const sanitized = sanitizeLooseJson(trimmed);
      try {
        return JSON.parse(sanitized);
      } catch (sanitizedError) {
        if (sanitized !== trimmed) console.warn('[statsService] Unable to parse sanitized payload', sanitizedError);
        console.warn('[statsService] Unable to parse loose payload', jsonError);
        return raw;
      }
    }
  }
  return raw;
};

const normalizeApiPayload = (payload: unknown, visited: WeakMap<object, unknown> = new WeakMap()): unknown => {
  if (typeof payload === 'string') {
    const parsed = tryParseLooseJson(payload);
    if (parsed !== payload) return normalizeApiPayload(parsed, visited);
    return payload;
  }
  if (Array.isArray(payload)) {
    if (visited.has(payload)) return visited.get(payload) ?? payload;
    const normalizedArray: unknown[] = [];
    visited.set(payload, normalizedArray);
    for (let index = 0; index < payload.length; index += 1) {
      normalizedArray[index] = normalizeApiPayload(payload[index], visited);
    }
    return normalizedArray;
  }
  if (payload && typeof payload === 'object') {
    const existing = visited.get(payload);
    if (existing) return existing;
    const normalizedObject: Record<string, unknown> = {};
    visited.set(payload, normalizedObject);
    Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
      normalizedObject[key] = normalizeApiPayload(value, visited);
    });
    return normalizedObject;
  }
  return payload;
};

const isHtmlPayload = (payload: unknown): payload is string =>
  typeof payload === 'string' && /<\s*(?:!doctype|html|head|body)\b/i.test(payload);

const normalizeKey = (key: string): string =>
  key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '');

const parseNumberValue = (value: unknown): number | undefined => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const sanitized = trimmed.replace(/\s+/g, '');
    const hasComma = sanitized.includes(',');
    const hasDot = sanitized.includes('.');
    let normalized = sanitized;
    if (hasComma && hasDot) normalized = normalized.replace(/\./g, '').replace(/,/g, '.');
    else if (hasComma) normalized = normalized.replace(/,/g, '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const candidateScore = (lat: number, lng: number): number => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Infinity;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return Infinity;
  let score = 0;
  if (Math.abs(lat) > 60) score += 4;
  if (Math.abs(lat) > Math.abs(lng)) score += 1;
  return score;
};

const chooseCandidate = (first: number, second: number, order: 'auto' | 'lat-lng' | 'lng-lat'): { lat: number; lng: number } | null => {
  const candidateLatLng = { lat: first, lng: second };
  const candidateLngLat = { lat: second, lng: first };
  const scoreLatLng = candidateScore(candidateLatLng.lat, candidateLatLng.lng);
  const scoreLngLat = candidateScore(candidateLngLat.lat, candidateLngLat.lng);
  if (order === 'lat-lng') {
    if (scoreLatLng !== Infinity) return candidateLatLng;
    if (scoreLngLat !== Infinity) return candidateLngLat;
    return null;
  }
  if (order === 'lng-lat') {
    if (scoreLngLat !== Infinity) return candidateLngLat;
    if (scoreLatLng !== Infinity) return candidateLatLng;
    return null;
  }
  if (scoreLatLng === Infinity && scoreLngLat === Infinity) return null;
  if (scoreLatLng <= scoreLngLat) return candidateLatLng;
  return candidateLngLat;
};

const parseCoordinatePair = (value: unknown, order: 'auto' | 'lat-lng' | 'lng-lat' = 'auto'): { lat?: number; lng?: number } => {
  if (Array.isArray(value)) {
    if (value.length < 2) return {};
    const first = parseNumberValue(value[0]);
    const second = parseNumberValue(value[1]);
    if (first === undefined || second === undefined) return {};
    const candidate = chooseCandidate(first, second, order);
    return candidate ?? {};
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    const matches = trimmed.match(/-?\d+(?:[.,]\d+)?/g);
    if (!matches || matches.length < 2) return {};
    const first = parseNumberValue(matches[0]);
    const second = parseNumberValue(matches[1]);
    if (first === undefined || second === undefined) return {};
    let hint = order;
    if (hint === 'auto') {
      if (/\bpoint\b/i.test(trimmed) || /\blon\b/i.test(trimmed)) hint = 'lng-lat';
      else if (trimmed.includes(',')) hint = 'lat-lng';
    }
    const candidate = chooseCandidate(first, second, hint);
    return candidate ?? {};
  }
  return {};
};

const pushUniqueNumber = (list: number[], value: number | undefined) => {
  if (value === undefined || !Number.isFinite(value)) return;
  if (Math.abs(value) > 1e8) return;
  if (!list.some((existing) => Math.abs(existing - value) < 1e-9)) list.push(value);
};

const pushUniquePair = (list: { lat: number; lng: number }[], pair: { lat?: number; lng?: number }) => {
  const { lat, lng } = pair;
  if (lat === undefined || lng === undefined) return;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
  if (!list.some((existing) => Math.abs(existing.lat - lat) < 1e-9 && Math.abs(existing.lng - lng) < 1e-9)) list.push({ lat, lng });
};

const collectCoordinates = (value: unknown, collector: CoordinateCollector, depth = 0) => {
  if (depth > 5 || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    if (value.length >= 2 && typeof value[0] !== 'object' && typeof value[1] !== 'object') {
      const pair = parseCoordinatePair(value, 'auto');
      if (pair.lat !== undefined && pair.lng !== undefined) pushUniquePair(collector.pairs, pair);
      else { pushUniqueNumber(collector.latValues, pair.lat); pushUniqueNumber(collector.lngValues, pair.lng); }
    }
    value.forEach((item) => collectCoordinates(item, collector, depth + 1));
    return;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const [rawKey, nested] of Object.entries(record)) {
      const key = normalizeKey(rawKey);
      if (LATITUDE_KEYWORDS.some((keyword) => key.includes(keyword))) {
        const lat = parseNumberValue(nested);
        if (lat !== undefined) pushUniqueNumber(collector.latValues, lat);
        else {
          const pair = parseCoordinatePair(nested, 'auto');
          pushUniquePair(collector.pairs, pair);
          pushUniqueNumber(collector.latValues, pair.lat);
          pushUniqueNumber(collector.lngValues, pair.lng);
        }
        continue;
      }
      if (LONGITUDE_KEYWORDS.some((keyword) => key.includes(keyword))) {
        const lng = parseNumberValue(nested);
        if (lng !== undefined) pushUniqueNumber(collector.lngValues, lng);
        else {
          const pair = parseCoordinatePair(nested, 'auto');
          pushUniquePair(collector.pairs, pair);
          pushUniqueNumber(collector.latValues, pair.lat);
          pushUniqueNumber(collector.lngValues, pair.lng);
        }
        continue;
      }
      if (COORDINATE_CONTAINER_KEYWORDS.some((keyword) => key.includes(keyword)) || Array.isArray(nested)) {
        const order: 'auto' | 'lat-lng' | 'lng-lat' = key.includes('geometry') || key.includes('geom') || key.includes('geojson') || key.includes('point') ? 'lng-lat' : 'auto';
        const pair = parseCoordinatePair(nested, order);
        pushUniquePair(collector.pairs, pair);
        pushUniqueNumber(collector.latValues, pair.lat);
        pushUniqueNumber(collector.lngValues, pair.lng);
      }
      collectCoordinates(nested, collector, depth + 1);
    }
    return;
  }
  if (typeof value === 'string') {
    const pair = parseCoordinatePair(value, 'auto');
    pushUniquePair(collector.pairs, pair);
    pushUniqueNumber(collector.latValues, pair.lat);
    pushUniqueNumber(collector.lngValues, pair.lng);
  }
};

const extractCoordinates = (raw: unknown): { lat?: number; lng?: number } => {
  const collector: CoordinateCollector = { latValues: [], lngValues: [], pairs: [] };
  collectCoordinates(raw, collector);
  if (collector.pairs.length > 0) return collector.pairs[0];
  const latCandidate = collector.latValues.find((value) => Math.abs(value) <= 90);
  const lngCandidate = collector.lngValues.find((value) => Math.abs(value) <= 180);
  if (latCandidate !== undefined && lngCandidate !== undefined) return { lat: latCandidate, lng: lngCandidate };
  if (collector.latValues.length > 0 && collector.lngValues.length > 0) return { lat: collector.latValues[0], lng: collector.lngValues[0] };
  return {};
};

const coerceString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
};

const coerceNumber = (value: unknown): number | null => {
  const parsed = parseNumberValue(value);
  return parsed !== undefined && Number.isFinite(parsed) ? parsed : null;
};

const formatKeyLabel = (key: string): string => key.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (match) => match.toUpperCase());

const findStringByKeywords = (record: Record<string, unknown>, keywords: string[]): string | null => {
  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeKey(key);
    if (keywords.some((keyword) => normalizedKey === keyword || normalizedKey.includes(keyword))) {
      const coerced = coerceString(value);
      if (coerced) return coerced;
    }
  }
  return null;
};

const pointMetadataRecords = (record: Record<string, unknown>): Record<string, unknown>[] => {
  const properties = isPlainObject(record.properties) ? record.properties : null;
  const feature = isPlainObject(record.feature) ? record.feature : null;
  const featureProperties = feature && isPlainObject(feature.properties) ? feature.properties : null;
  const location = isPlainObject(record.location) ? record.location : null;

  // GeoJSON reserves `type` for structural values such as Feature and Point.
  // Prefer its explicit properties before the wrapper so those values never
  // masquerade as a municipal ticket type.
  return [properties, featureProperties, location, record].filter(
    (candidate): candidate is Record<string, unknown> => Boolean(candidate),
  );
};

const GEOJSON_STRUCTURAL_TYPES = new Set(['feature', 'featurecollection', 'point', 'multipoint']);

const findPointTicketType = (records: Record<string, unknown>[]): string | null => {
  for (const record of records) {
    const value = findStringByKeywords(record, NORMALIZED_STRING_FIELDS.tipoTicket);
    if (value && !GEOJSON_STRUCTURAL_TYPES.has(value.toLowerCase())) return value;
  }
  return null;
};

const findPointStringByKeywords = (
  records: Record<string, unknown>[],
  keywords: string[],
): string | null => {
  for (const record of records) {
    const value = findStringByKeywords(record, keywords);
    if (value) return value;
  }
  return null;
};

const findNumberByKeywords = (record: Record<string, unknown>, keywords: string[]): number | null => {
  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeKey(key);
    if (keywords.some((keyword) => normalizedKey === keyword || normalizedKey.includes(keyword))) {
      const numberValue = coerceNumber(value);
      if (numberValue !== null) return numberValue;
    }
  }
  return null;
};

const findPointNumberByKeywords = (
  records: Record<string, unknown>[],
  keywords: string[],
): number | null => {
  for (const record of records) {
    const value = findNumberByKeywords(record, keywords);
    if (value !== null) return value;
  }
  return null;
};

const buildChartDataFromObject = (value: Record<string, unknown>): Record<string, number> => {
  const entries: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    const numeric = coerceNumber(raw);
    if (numeric !== null) {
      const label = formatKeyLabel(key);
      entries[label] = numeric;
    }
  }
  return entries;
};

const buildChartData = (source: unknown): Record<string, number> => {
  if (!source) return {};
  if (Array.isArray(source)) {
    const entries: Record<string, number> = {};
    source.forEach((item, index) => {
      if (!item) return;
      if (typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const label = findStringByKeywords(record, CHART_LABEL_KEYS) || coerceString(record.label) || coerceString(record.name) || null;
        const numeric = findNumberByKeywords(record, CHART_VALUE_KEYS) ?? coerceNumber(record.value) ?? coerceNumber(record.count) ?? coerceNumber(record.total) ?? null;
        if (label && numeric !== null) {
          const normalizedLabel = label.trim();
          if (normalizedLabel.length > 0) {
            entries[normalizedLabel] = (entries[normalizedLabel] ?? 0) + numeric;
            return;
          }
        }
        const fallbackLabel = Object.keys(record).find((key) => {
          const normalizedKey = normalizeKey(key);
          return !CHART_VALUE_KEYS.some((keyword) => normalizedKey.includes(keyword));
        });
        const fallbackValue = fallbackLabel ? coerceNumber(record[fallbackLabel]) : null;
        if (fallbackLabel && fallbackValue !== null) {
          entries[formatKeyLabel(fallbackLabel)] = (entries[formatKeyLabel(fallbackLabel)] ?? 0) + fallbackValue;
        }
      } else if (typeof item === 'string') {
        const normalized = item.trim();
        if (normalized.length > 0) entries[normalized] = (entries[normalized] ?? 0) + 1;
      } else if (typeof item === 'number' && Number.isFinite(item)) {
        const label = `Item ${index + 1}`;
        entries[label] = (entries[label] ?? 0) + item;
      }
    });
    return entries;
  }
  if (typeof source === 'object') return buildChartDataFromObject(source as Record<string, unknown>);
  return {};
};

const parseChartLikeObject = (raw: unknown): NormalizedChart | null => {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const title = findStringByKeywords(record, CHART_TITLE_KEYS) || coerceString(record.title) || coerceString(record.name) || coerceString(record.label) || '';
  const datasetCandidate = record.data ?? record.values ?? (record.series as unknown) ?? (record.items as unknown) ?? (record.breakdown as unknown) ?? (record.dataset as unknown) ?? (record.metrics as unknown) ?? null;
  let data = buildChartData(datasetCandidate);
  if (Object.keys(data).length === 0) data = buildChartData(record);
  if (Object.keys(data).length === 0) return null;
  return { title: title || '', data };
};

const normalizeChartCollection = (value: unknown): NormalizedChart[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    const charts: NormalizedChart[] = [];
    value.forEach((entry) => {
      const chart = parseChartLikeObject(entry);
      if (chart) charts.push(chart);
    });
    if (charts.length > 0) return charts;
    const aggregated = buildChartData(value);
    if (Object.keys(aggregated).length > 0) return [{ title: '', data: aggregated }];
    return [];
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if ('title' in record || CHART_TITLE_KEYS.some((key) => key in record)) {
      const chart = parseChartLikeObject(record);
      return chart ? [chart] : [];
    }
    const direct = buildChartData(record);
    if (Object.keys(direct).length > 0) return [{ title: '', data: direct }];
    const charts: NormalizedChart[] = [];
    for (const [key, nested] of Object.entries(record)) {
      const nestedCharts = normalizeChartCollection(nested);
      nestedCharts.forEach((chart) => {
        const title = chart.title && chart.title.trim().length > 0 ? chart.title : formatKeyLabel(key);
        charts.push({ title, data: chart.data });
      });
    }
    return charts;
  }
  return [];
};

const readNestedRecordValue = (record: Record<string, unknown>, path: readonly string[]): unknown => {
  let current: unknown = record;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
};

const OPERATIONAL_CHART_SPECS = [
  { title: 'Reclamos por estado', path: ['estados'] },
  { title: 'Reclamos por categoría', path: ['por_categoria'] },
  { title: 'Reclamos por distrito', path: ['por_distrito'] },
  { title: 'Canales de ingreso', path: ['por_canal'] },
  { title: 'Evolución mensual', path: ['tendencia_mensual'] },
  { title: 'Evolución semanal', path: ['tendencia_semanal'] },
  { title: 'Satisfacción ciudadana', path: ['satisfaccion', 'distribucion'] },
] as const;

/**
 * Builds only charts that represent municipal operations. Heatmap contracts also
 * expose nested metadata named `charts`, `series` and `breakdown`; recursively
 * interpreting those objects used to turn coordinates, supported formats and KPI
 * descriptors into meaningless bar charts.
 */
export const extractOperationalCharts = (payload: unknown): NormalizedChart[] => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return [];
  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object' && !Array.isArray(root.data)
    ? root.data as Record<string, unknown>
    : null;
  const statsCandidate = root.stats ?? data?.stats ?? root;
  const stats = statsCandidate && typeof statsCandidate === 'object' && !Array.isArray(statsCandidate)
    ? statsCandidate as Record<string, unknown>
    : null;

  const charts: NormalizedChart[] = [];
  const explicitCharts = root.charts ?? root.graficos ?? data?.charts ?? data?.graficos;
  if (explicitCharts) charts.push(...normalizeChartCollection(explicitCharts));

  if (stats) {
    for (const spec of OPERATIONAL_CHART_SPECS) {
      const chartData = buildChartData(readNestedRecordValue(stats, spec.path));
      if (Object.keys(chartData).length > 0) {
        charts.push({ title: spec.title, data: chartData });
      }
    }
  }

  const dedupe = new Map<string, NormalizedChart>();
  for (const chart of charts) {
    const dataEntries = Object.entries(chart.data).filter(([, value]) => Number.isFinite(value));
    if (dataEntries.length === 0) continue;
    const normalizedChart = { title: chart.title.trim() || 'Indicador operativo', data: Object.fromEntries(dataEntries) };
    const key = `${normalizedChart.title.toLowerCase()}|${JSON.stringify(normalizedChart.data)}`;
    if (!dedupe.has(key)) dedupe.set(key, normalizedChart);
  }
  return Array.from(dedupe.values());
};

const looksLikeHeatmapPoint = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length >= 2;
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (record.type === 'FeatureCollection') return false;
  if (record.type === 'Feature' && isPlainObject(record.geometry)) {
    return record.geometry.type === 'Point' && Array.isArray(record.geometry.coordinates);
  }
  return Object.keys(record).some((key) => {
    const normalizedKey = normalizeKey(key);
    return LATITUDE_KEYWORDS.some((keyword) => normalizedKey.includes(keyword)) || LONGITUDE_KEYWORDS.some((keyword) => normalizedKey.includes(keyword)) || COORDINATE_CONTAINER_KEYWORDS.some((keyword) => normalizedKey.includes(keyword)) || STRING_FIELD_KEYWORDS.some((keyword) => normalizedKey.includes(keyword)) || NUMBER_FIELD_KEYWORDS.some((keyword) => normalizedKey.includes(keyword));
  });
};

const normalizeHeatPoint = (raw: unknown): HeatPoint | null => {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const coords = extractCoordinates(record);
  if (coords.lat === undefined || coords.lng === undefined) return null;
  const metadataRecords = pointMetadataRecords(record);
  const id = findPointNumberByKeywords(metadataRecords, NORMALIZED_NUMBER_FIELDS.id);
  const categoria = findPointStringByKeywords(metadataRecords, NORMALIZED_STRING_FIELDS.categoria);
  const direccion = findPointStringByKeywords(metadataRecords, NORMALIZED_STRING_FIELDS.direccion);
  const distrito = findPointStringByKeywords(metadataRecords, NORMALIZED_STRING_FIELDS.distrito);
  const barrio = findPointStringByKeywords(metadataRecords, NORMALIZED_STRING_FIELDS.barrio);
  const tipoTicket = findPointTicketType(metadataRecords);
  const estado = findPointStringByKeywords(metadataRecords, NORMALIZED_STRING_FIELDS.estado);
  const ticket = findPointStringByKeywords(metadataRecords, NORMALIZED_STRING_FIELDS.ticket);
  const severidad = findPointStringByKeywords(metadataRecords, NORMALIZED_STRING_FIELDS.severidad);
  const canal = findPointStringByKeywords(metadataRecords, NORMALIZED_STRING_FIELDS.canal);
  const fuente = findPointStringByKeywords(metadataRecords, NORMALIZED_STRING_FIELDS.fuente);
  const ciudad = findPointStringByKeywords(metadataRecords, NORMALIZED_STRING_FIELDS.ciudad);
  const provincia = findPointStringByKeywords(metadataRecords, NORMALIZED_STRING_FIELDS.provincia);
  const pais = findPointStringByKeywords(metadataRecords, NORMALIZED_STRING_FIELDS.pais);
  const lastTicketAt = findPointStringByKeywords(metadataRecords, NORMALIZED_STRING_FIELDS.lastTicketAt);
  const weight = findPointNumberByKeywords(metadataRecords, NORMALIZED_NUMBER_FIELDS.weight);
  const total = findPointNumberByKeywords(metadataRecords, NORMALIZED_NUMBER_FIELDS.total);
  return {
    lat: coords.lat,
    lng: coords.lng,
    id: id ?? undefined,
    categoria: categoria ?? undefined,
    direccion: direccion ?? undefined,
    distrito: distrito ?? undefined,
    barrio: barrio ?? undefined,
    tipo_ticket: tipoTicket ?? undefined,
    estado: estado ?? undefined,
    ticket: ticket ?? undefined,
    severidad: severidad ?? undefined,
    canal: canal ?? undefined,
    fuente: fuente ?? undefined,
    ciudad: ciudad ?? undefined,
    provincia: provincia ?? undefined,
    pais: pais ?? undefined,
    last_ticket_at: lastTicketAt ?? undefined,
    weight: weight ?? undefined,
    total: total ?? undefined,
    feature: isPlainObject(record.feature) ? record.feature : record.type === 'Feature' ? record : undefined,
  };
};

const extractHeatmapFromPayload = (payload: unknown): HeatPoint[] => {
  const points: HeatPoint[] = [];
  const visited = new Set<unknown>();
  const seen = new Set<string>();
  const queue: unknown[] = [payload];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || current === null || visited.has(current)) continue;
    visited.add(current);
    if (Array.isArray(current)) {
      current.forEach((item) => {
        let normalizedItem = false;
        if (item && looksLikeHeatmapPoint(item)) {
          const normalized = normalizeHeatPoint(item);
          if (normalized) {
            const key = `${normalized.lat.toFixed(6)}|${normalized.lng.toFixed(6)}|${normalized.categoria ?? ''}|${normalized.estado ?? ''}|${normalized.ticket ?? ''}`;
            if (!seen.has(key)) { seen.add(key); points.push(normalized); }
            normalizedItem = true;
          }
        }
        if (!normalizedItem && item && typeof item === 'object' && !visited.has(item)) queue.push(item);
      });
      continue;
    }
    if (typeof current !== 'object') continue;
    const record = current as Record<string, unknown>;
    if (looksLikeHeatmapPoint(record)) {
      const directPoint = normalizeHeatPoint(record);
      if (directPoint) {
        const key = `${directPoint.lat.toFixed(6)}|${directPoint.lng.toFixed(6)}|${directPoint.categoria ?? ''}|${directPoint.estado ?? ''}|${directPoint.ticket ?? ''}`;
        if (!seen.has(key)) { seen.add(key); points.push(directPoint); }
        continue;
      }
    }
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object' && !visited.has(value)) queue.push(value);
    }
  }
  return points;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

const getFromRecord = (record: Record<string, unknown>, ...keys: string[]): unknown => {
  if (!record) return undefined;
  if (keys.length === 0) return undefined;
  const normalizedTargets = keys.map(normalizeKey);
  for (const [key, value] of Object.entries(record)) {
    if (normalizedTargets.includes(normalizeKey(key))) return value;
  }
  return undefined;
};

const gatherCandidateContainers = (root: Record<string, unknown>): Record<string, unknown>[] => {
  const seen = new Set<unknown>();
  const containers: Record<string, unknown>[] = [];
  const queue: Record<string, unknown>[] = [root];
  const nestedKeys = ['data', 'datos', 'payload', 'result', 'results', 'response', 'contenido', 'content', 'body', 'attributes', 'attributesdata', 'meta', 'metadata', 'stats', 'estadisticas', 'statistics', 'map', 'mapa', 'sections', 'mapas', 'geo', 'heatmap', 'category_layers', 'geo_layers', 'modules'];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    containers.push(current);
    nestedKeys.forEach((key) => {
      const nested = getFromRecord(current, key);
      const nestedRecord = asRecord(nested);
      if (nestedRecord && !seen.has(nestedRecord)) queue.push(nestedRecord);
    });
  }
  return containers;
};

const pickFirstValue = <T>(containers: Record<string, unknown>[], candidateKeys: string[], predicate: (value: unknown) => value is T): T | undefined => {
  for (const container of containers) {
    const value = getFromRecord(container, ...candidateKeys);
    if (predicate(value)) return value;
  }
  return undefined;
};

const toBreakdownItems = (value: unknown, totalWeight: number): HeatmapBreakdownItem[] => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const record = asRecord(entry);
    if (!record) return null;
    const label = coerceString(getFromRecord(record, 'label', 'value', 'name', 'categoria', 'category', 'estado', 'status', 'barrio', 'distrito', 'tipo', 'type', 'canal', 'fuente'));
    if (!label) return null;
    const countValue = coerceNumber(getFromRecord(record, 'count', 'cantidad', 'total', 'tickets', 'value')) ?? 0;
    const weightValue = coerceNumber(getFromRecord(record, 'weight', 'valor', 'value', 'total', 'tickets', 'count')) ?? countValue;
    const percentageValue = coerceNumber(getFromRecord(record, 'percentage', 'percent', 'porcentaje', 'ratio')) ?? (totalWeight > 0 ? (weightValue / totalWeight) * 100 : 0);
    return { label, count: Math.round(countValue), weight: Number(weightValue.toFixed(2)), percentage: Number(percentageValue.toFixed(2)) } satisfies HeatmapBreakdownItem;
  }).filter((item): item is HeatmapBreakdownItem => Boolean(item));
};

const normalizeHeatmapCells = (rawCells: unknown): NormalizeCellsResult => {
  const rawList: Record<string, unknown>[] = [];
  if (!Array.isArray(rawCells)) return { points: [], raw: rawList };
  const points: HeatPoint[] = [];
  rawCells.forEach((item, index) => {
    const cellRecord = asRecord(item);
    if (!cellRecord) return;
    rawList.push(cellRecord);
    const feature = asRecord(getFromRecord(cellRecord, 'feature'));
    const featureProps = feature ? asRecord(getFromRecord(feature, 'properties')) : null;
    const locationRecord = asRecord(getFromRecord(cellRecord, 'location', 'centroid', 'center')) || (featureProps ? asRecord(getFromRecord(featureProps, 'location')) : null);
    let lat = parseNumberValue(getFromRecord(cellRecord, 'centroid_lat', 'centroidlat', 'lat')) ?? parseNumberValue(getFromRecord(locationRecord ?? {}, 'lat', 'latitude')) ?? parseNumberValue(getFromRecord(featureProps ?? {}, 'lat', 'latitude')) ?? undefined;
    let lng = parseNumberValue(getFromRecord(cellRecord, 'centroid_lon', 'centroidlng', 'lng', 'lon', 'longitud')) ?? parseNumberValue(getFromRecord(locationRecord ?? {}, 'lng', 'lon', 'longitud')) ?? parseNumberValue(getFromRecord(featureProps ?? {}, 'lng', 'lon', 'longitud')) ?? undefined;
    if (lat === undefined || lng === undefined) {
      const fallbackPair = parseCoordinatePair(cellRecord, 'auto');
      if (fallbackPair.lat !== undefined && fallbackPair.lng !== undefined) { lat = fallbackPair.lat; lng = fallbackPair.lng; }
    }
    if (lat === undefined || lng === undefined) return;
    const count = parseNumberValue(getFromRecord(cellRecord, 'count', 'weight', 'intensity', 'total')) ?? parseNumberValue(getFromRecord(featureProps ?? {}, 'count', 'weight', 'intensity', 'total')) ?? 0;
    const pointCount = parseNumberValue(getFromRecord(cellRecord, 'point_count', 'pointcount', 'samples')) ?? parseNumberValue(getFromRecord(featureProps ?? {}, 'point_count', 'pointcount', 'samples')) ?? undefined;
    const clusterId = coerceString(getFromRecord(cellRecord, 'cell_id', 'cellid', 'cluster_id', 'clusterid', 'id')) || coerceString(getFromRecord(featureProps ?? {}, 'cell_id', 'cellid', 'cluster_id', 'clusterid', 'id')) || undefined;
    const radiusMeters = parseNumberValue(getFromRecord(cellRecord, 'radius_meters', 'radiusmeters')) ?? parseNumberValue(getFromRecord(featureProps ?? {}, 'radius_meters', 'radiusmeters')) ?? undefined;
    const maxDistanceMeters = parseNumberValue(getFromRecord(cellRecord, 'max_distance_meters', 'maxdistancemeters')) ?? parseNumberValue(getFromRecord(featureProps ?? {}, 'max_distance_meters', 'maxdistancemeters')) ?? undefined;
    const topValuesRecord = asRecord(getFromRecord(cellRecord, 'top_values', 'topvalues')) || (featureProps ? asRecord(getFromRecord(featureProps, 'top_values', 'topvalues')) : null);
    const totalWeight = count ?? 0;
    const aggregatedCategorias = toBreakdownItems(getFromRecord(topValuesRecord ?? {}, 'categoria', 'categorias', 'category', 'categories'), totalWeight);
    const aggregatedBarrios = toBreakdownItems(getFromRecord(topValuesRecord ?? {}, 'barrio', 'barrios', 'distrito', 'distritos'), totalWeight);
    const aggregatedEstados = toBreakdownItems(getFromRecord(topValuesRecord ?? {}, 'estado', 'estados', 'status', 'statuses'), totalWeight);
    const aggregatedTipos = toBreakdownItems(getFromRecord(topValuesRecord ?? {}, 'tipo', 'tipos', 'tipo_ticket', 'tipos_ticket'), totalWeight);
    const aggregatedSeveridades = toBreakdownItems(getFromRecord(topValuesRecord ?? {}, 'severidad', 'severidades', 'severity', 'severities'), totalWeight);
    const aggregatedCanales = toBreakdownItems(getFromRecord(topValuesRecord ?? {}, 'canal', 'canales'), totalWeight);
    const aggregatedFuentes = toBreakdownItems(getFromRecord(topValuesRecord ?? {}, 'fuente', 'fuentes', 'source', 'sources'), totalWeight);
    const dominantValuesRecord = asRecord(getFromRecord(cellRecord, 'dominant_values', 'dominantvalues')) || (featureProps ? asRecord(getFromRecord(featureProps, 'dominant_values', 'dominantvalues')) : null);
    const dominantValues: Record<string, string | null | undefined> | undefined = dominantValuesRecord ? Object.fromEntries(Object.entries(dominantValuesRecord).map(([key, value]) => [key, coerceString(value)])) : undefined;
    const sampleTickets = (getFromRecord(cellRecord, 'sample_tickets', 'sampletickets') as unknown[]) ?? (featureProps ? (getFromRecord(featureProps, 'sample_tickets', 'sampletickets') as unknown[]) : undefined);
    const normalizedTickets = Array.isArray(sampleTickets) ? sampleTickets.map((ticket) => coerceString(ticket)).filter((ticket): ticket is string => Boolean(ticket)) : undefined;
    const lastTicketAt = coerceString(getFromRecord(cellRecord, 'last_ticket_at', 'lastticketat', 'last_seen_at')) ?? coerceString(getFromRecord(featureProps ?? {}, 'last_ticket_at', 'lastticketat', 'last_seen_at')) ?? null;
    const clusterSize = pointCount !== undefined && pointCount > 0 ? Math.round(pointCount) : Math.max(1, Math.round(totalWeight || 1));
    const averageWeight = clusterSize > 0 ? Number((totalWeight / clusterSize).toFixed(2)) : totalWeight;
    points.push({ lat, lng, weight: totalWeight, totalWeight, averageWeight, clusterId: clusterId ?? `cell-${index + 1}`, clusterSize, radiusMeters, maxDistanceMeters, aggregatedCategorias, aggregatedBarrios, aggregatedEstados, aggregatedTipos, aggregatedSeveridades, aggregatedCanales, aggregatedFuentes, dominantValues, sampleTickets: normalizedTickets, last_ticket_at: lastTicketAt, source: 'cell', cellId: clusterId ?? undefined, pointCount: pointCount !== undefined ? Math.round(pointCount) : undefined });
  });
  return { points, raw: rawList };
};

const isFeatureCollection = (value: unknown): value is FeatureCollectionLike => {
  const record = asRecord(value);
  return record?.type === 'FeatureCollection' && Array.isArray(record.features);
};

const normalizeMapConfig = (raw: unknown): MapConfig => {
  const record = asRecord(raw) ?? {};
  const tiles = asRecord(getFromRecord(record, 'tiles'));
  const tileUrl = coerceString(getFromRecord(tiles ?? {}, 'url', 'template')) || undefined;
  return { provider: coerceString(record.provider) || 'none', google_maps_key: coerceString(record.google_maps_key) || undefined, maptiler_key: coerceString(record.maptiler_key) || undefined, style_url: coerceString(record.style_url) || tileUrl };
};

const normalizeMapLayers = (raw: unknown): Record<string, MapLayerSource> => {
  const result: Record<string, MapLayerSource> = {};
  const record = asRecord(raw);
  if (!record) return result;
  Object.entries(record).forEach(([key, value]) => {
    const layer = asRecord(value);
    if (layer) { result[key] = { kind: coerceString(layer.kind) || undefined, supportedFormats: Array.isArray(layer.supported_formats) ? layer.supported_formats.map(String) : undefined, preferredFormat: coerceString(layer.preferred_format) || undefined, providerHint: coerceString(layer.provider_hint) || undefined, sourceKeys: asRecord(layer.source_keys) as Record<string, string> || undefined, raw: layer }; }
  });
  return result;
};

const normalizeHeatmapMapMetadata = (raw: unknown): HeatmapMapMetadata => {
  const record = asRecord(raw) ?? {};
  return { pointCount: parseNumberValue(record.point_count), cellCount: parseNumberValue(record.cell_count), maxPointWeight: parseNumberValue(record.max_point_weight), maxCellCount: parseNumberValue(record.max_cell_count), totalWeight: parseNumberValue(record.total_weight), resolution: parseNumberValue(record.resolution), bounds: Array.isArray(record.bounds) && record.bounds.length === 4 ? (record.bounds as [number, number, number, number]) : undefined, centroid: Array.isArray(record.centroid) && record.centroid.length === 2 ? (record.centroid as [number, number]) : undefined };
};

const normalizeHeatmapMetadata = (raw: unknown): HeatmapMetadata => {
  const record = asRecord(raw) ?? {};
  const mapMeta: Record<string, HeatmapMapMetadata> = {};
  const mapRecord = asRecord(record.map);
  if (mapRecord) { Object.entries(mapRecord).forEach(([key, value]) => { mapMeta[key] = normalizeHeatmapMapMetadata(value); }); }
  return { map: mapMeta, raw: record };
};

const normalizeHeatmapDataset = (raw: unknown): HeatmapDataset => {
  const record = asRecord(raw);
  if (!record) return { points: [] };
  const containers = gatherCandidateContainers(record);
  const geojsonCandidate = pickFirstValue(containers, ['geojson', 'feature_collection'], isFeatureCollection);
  let geojsonPoints: HeatPoint[] = [];
  if (geojsonCandidate) geojsonPoints = extractHeatmapFromPayload(geojsonCandidate);
  const explicitPointsCandidate = pickFirstValue(containers, ['points', 'puntos', 'heatmap', 'data', 'datos', 'geo_points', 'hotspots'], Array.isArray);
  const explicitPoints = explicitPointsCandidate ? extractHeatmapFromPayload(explicitPointsCandidate) : [];
  const cellsCandidate = pickFirstValue(containers, ['cells', 'celdas', 'clusters', 'grid', 'cuadricula'], Array.isArray);
  const { points: cellPoints, raw: rawCells } = normalizeHeatmapCells(cellsCandidate);
  const points = [...geojsonPoints, ...explicitPoints, ...cellPoints];
  const mapConfig = normalizeMapConfig(pickFirstValue(containers, ['map_config', 'mapconfig', 'config'], isPlainObject));
  const mapLayers = normalizeMapLayers(pickFirstValue(containers, ['map_layers', 'layers', 'capas', 'category_layers', 'geo_layers'], isPlainObject));
  const metadata = normalizeHeatmapMetadata(pickFirstValue(containers, ['metadata', 'meta', 'info'], isPlainObject));
  return { points, geojson: geojsonCandidate, cells: rawCells as unknown as HeatmapCell[], mapConfig, mapLayers, metadata, raw };
};

export const extractHeatmapDataset = (payload: unknown): HeatmapDataset => {
  return normalizeHeatmapDataset(payload);
};

const buildSearchParams = (params?: Record<string, unknown>) => {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (Array.isArray(v)) { v.filter((val) => val !== undefined && val !== null && String(val) !== '').forEach((val) => qs.append(k, String(val))); }
    else if (v !== undefined && v !== null && String(v) !== '') { qs.append(k, String(v)); }
  });
  return qs;
};

const normalizeDateParam = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const [date] = trimmed.split('T');
  return date;
};

const normalizeTipo = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const buildMunicipalAttemptList = (tipo?: string | null): string[] => {
  const normalizedTipo = normalizeTipo(tipo)?.toLowerCase();
  if (!normalizedTipo) return ['municipio'];
  if (!shouldTryMunicipalAliases(normalizedTipo)) return [normalizedTipo];
  const candidates = [normalizedTipo, 'municipio'] as const;
  return Array.from(new Set(candidates.filter(Boolean)));
};

const shouldTryMunicipalAliases = (value?: string | null): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return MUNICIPAL_TIPO_ALIASES.includes(normalized as (typeof MUNICIPAL_TIPO_ALIASES)[number]);
};

const RECOVERABLE_STATUSES = new Set([400, 404, 409, 422, 500, 502, 503]);

const tryMunicipalAliases = async <T>(attempt: (tipo?: string) => Promise<T>, tipo?: string, shouldRetry?: (result: T) => boolean): Promise<T> => {
  const attempts = buildMunicipalAttemptList(tipo);
  let lastError: unknown = null;
  let fallbackResult: T | null = null;
  for (const alias of attempts.slice(0, 2)) {
    try {
      const result = await attempt(alias);
      if (!shouldRetry || !shouldRetry(result)) return result;
      if (fallbackResult === null) fallbackResult = result;
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError) {
        if (error.status === 400 || error.status === 404) throw new ApiError('No hay datos para este período.', error.status, error.body);
        if (!RECOVERABLE_STATUSES.has(error.status)) throw error;
        console.warn('[statsService] Municipal alias attempt failed', { alias, status: error.status, message: error.message });
      } else throw error;
      if (error instanceof ApiError && error.status >= 500) break;
    }
  }
  if (fallbackResult !== null) return fallbackResult;
  if (lastError) throw lastError;
  throw new Error('No municipal alias produced a successful response');
};

export const getTicketStats = async (params?: TicketStatsParams): Promise<TicketStatsResponse> => {
  const fetchStats = async (overrideTipo?: string): Promise<TicketStatsResponse> => {
    const normalizedParams: TicketStatsParams = { ...(params || {}), tipo: normalizeTipo(overrideTipo ?? params?.tipo ?? params?.tipo_ticket), fecha_inicio: normalizeDateParam(params?.fecha_inicio), fecha_fin: normalizeDateParam(params?.fecha_fin) };
    delete (normalizedParams as any).tipo_ticket;
    const query = buildSearchParams(normalizedParams as unknown as Record<string, unknown>).toString();
    const candidatePaths = [`/api/estadisticas/tickets${query ? `?${query}` : ''}`, `/estadisticas/tickets${query ? `?${query}` : ''}`, `/api/municipal/estadisticas/tickets${query ? `?${query}` : ''}`, `/municipal/estadisticas/tickets${query ? `?${query}` : ''}`];
    const tenantRequestOptions = normalizedParams.tenant_slug
      ? { tenantSlug: normalizedParams.tenant_slug }
      : null;
    let resp: unknown = null;
    let lastError: unknown = null;
    for (const path of candidatePaths) {
      try { resp = tenantRequestOptions ? await apiFetch<unknown>(path, tenantRequestOptions) : await apiFetch<unknown>(path); break; } catch (error) { lastError = error; const errorCode = (error as Error & { code?: string }).code; if (errorCode === 'HTML_PAYLOAD') continue; if (error instanceof ApiError) { if (error.status === 404) continue; if (error.message && error.message.includes('Respuesta inesperada')) continue; } throw error; }
    }
    if (resp === null) throw lastError ?? new Error('No stats endpoint responded successfully');
    const normalizedPayload = normalizeApiPayload(resp);
    if (isHtmlPayload(normalizedPayload)) { console.warn('[statsService] Received HTML payload for /api/estadisticas/tickets, aborting further alias attempts.'); const error = new Error('HTML payload returned from /api/estadisticas/tickets'); (error as Error & { code?: string }).code = 'HTML_PAYLOAD'; throw error; }
    const charts = extractOperationalCharts(normalizedPayload).map((chart) => ({ title: chart.title, data: chart.data }));
    const heatmapDataset = extractHeatmapDataset(normalizedPayload);
    const heatmap = heatmapDataset.points;
    return { charts, heatmap, heatmapDataset };
  };
  try {
    const tipoValue = normalizeTipo(params?.tipo ?? params?.tipo_ticket);
    return await tryMunicipalAliases(fetchStats, tipoValue, (result) => {
      const chartsEmpty = !result?.charts || result.charts.length === 0;
      const heatmapEmpty = (!result?.heatmap || result.heatmap.length === 0) && (!result?.heatmapDataset?.points || result.heatmapDataset.points.length === 0);
      return chartsEmpty && heatmapEmpty;
    });
  } catch (err) { console.error('Error fetching ticket stats:', err); throw err; }
};

export const getHeatmapDataset = async (params?: HeatmapParams): Promise<HeatmapDataset> => {
  const requestHeatmap = async (overrideTipo?: string): Promise<HeatmapDataset> => {
    const normalizedParams: HeatmapParams = { ...(params || {}), tipo: normalizeTipo(overrideTipo ?? params?.tipo ?? params?.tipo_ticket), fecha_inicio: normalizeDateParam(params?.fecha_inicio), fecha_fin: normalizeDateParam(params?.fecha_fin) };
    delete (normalizedParams as any).tipo_ticket;
    const query = buildSearchParams(normalizedParams as unknown as Record<string, unknown>).toString();
    const candidatePaths = [`/api/estadisticas/mapa_calor/datos${query ? `?${query}` : ''}`, `/estadisticas/mapa_calor/datos${query ? `?${query}` : ''}`, `/api/municipal/estadisticas/mapa_calor/datos${query ? `?${query}` : ''}`, `/municipal/estadisticas/mapa_calor/datos${query ? `?${query}` : ''}`];
    const tenantRequestOptions = normalizedParams.tenant_slug
      ? { tenantSlug: normalizedParams.tenant_slug }
      : null;
    let payload: unknown = null;
    let lastError: unknown = null;
    for (const path of candidatePaths) {
      try { payload = tenantRequestOptions ? await apiFetch<unknown>(path, tenantRequestOptions) : await apiFetch<unknown>(path); break; } catch (error) { lastError = error; const errorCode = (error as Error & { code?: string }).code; if (errorCode === 'HTML_PAYLOAD') continue; if (error instanceof ApiError) { if (error.status === 404) continue; if (error.message && error.message.includes('Respuesta inesperada')) continue; } throw error; }
    }
    if (payload === null) throw lastError ?? new Error('No heatmap endpoint responded successfully');
    const normalizedPayload = normalizeApiPayload(payload);
    if (isHtmlPayload(normalizedPayload)) { console.warn('[statsService] Received HTML payload for /api/estadisticas/mapa_calor/datos, aborting further alias attempts.'); const error = new Error('HTML payload returned from /api/estadisticas/mapa_calor/datos'); (error as Error & { code?: string }).code = 'HTML_PAYLOAD'; throw error; }
    return extractHeatmapDataset(normalizedPayload);
  };
  try {
    const tipoValue = normalizeTipo(params?.tipo ?? params?.tipo_ticket);
    return await tryMunicipalAliases(requestHeatmap, tipoValue, (dataset) => !dataset || dataset.points.length === 0);
  } catch (err) { console.error('Error fetching heatmap points:', err); throw err; }
};

export const getHeatmapPoints = async (params?: HeatmapParams): Promise<HeatPoint[]> => {
  const dataset = await getHeatmapDataset(params);
  return dataset.points;
};

// --- NEW ENDPOINTS IMPLEMENTATION ---

export const getAiReportLatest = async (params: { tenant_id?: string | number, segment: string }): Promise<AiReportResponse> => {
    const query = buildSearchParams(params as unknown as Record<string, unknown>).toString();
    const candidates = [
      `/api/analytics/report/latest${query ? `?${query}` : ''}`,
      `/analytics/report/latest${query ? `?${query}` : ''}`,
    ];

    let lastError: unknown = null;
    for (const endpoint of candidates) {
      try {
        return await apiFetch<AiReportResponse>(endpoint, {
          suppressPanel401Redirect: true,
          preserveAuthOn401: true,
          baseUrlOverride: SAME_ORIGIN_API_BASE,
        });
      } catch (error) {
        lastError = error;
        if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
          continue;
        }
        throw error;
      }
    }

    if (lastError instanceof ApiError && [401, 403, 404].includes(lastError.status)) {
      return {
        summary: '',
        opportunities: [],
        threats: [],
        tone: 'neutral',
        _cached: true,
      };
    }

    throw lastError ?? new Error('No latest report endpoint responded successfully');
};

export const generateAiReport = async (params: { tenant_id?: string | number, segment: string, from?: string, to?: string, force?: boolean }): Promise<AiReportResponse> => {
  return apiFetch<AiReportResponse>('/api/analytics/report/generate', {
    method: 'POST',
    body: JSON.stringify(params),
    suppressPanel401Redirect: true,
    preserveAuthOn401: true,
    baseUrlOverride: SAME_ORIGIN_API_BASE,
  });
};

export const getAiReportExport = async (params: { tenant_id?: string | number, segment: string, format: 'pdf' | 'excel' }): Promise<void> => {
  const query = buildSearchParams(params as unknown as Record<string, unknown>).toString();
  // Trigger file download via browser navigation or fetch-blob
  const url = `/api/analytics/report/export?${query}`;

  // Create a temporary link to trigger download
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `reporte_mensual.${params.format === 'excel' ? 'xlsx' : 'pdf'}`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const getSalesAnalytics = async (params?: { tenant_id?: string | number, from?: string, to?: string }): Promise<SalesAnalyticsResponse> => {
  const query = buildSearchParams(params as unknown as Record<string, unknown>).toString();
  return apiFetch<SalesAnalyticsResponse>(`/api/analytics/sales${query ? `?${query}` : ''}`, { suppressPanel401Redirect: true, preserveAuthOn401: true });
};

export const getBenchmarks = async (params?: { tenant_id?: string | number, from?: string, to?: string }): Promise<BenchmarksResponse> => {
  const query = buildSearchParams(params as unknown as Record<string, unknown>).toString();
  return apiFetch<BenchmarksResponse>(`/api/analytics/benchmarks${query ? `?${query}` : ''}`, { suppressPanel401Redirect: true, preserveAuthOn401: true });
};

export const getFunnel = async (params?: { tenant_id?: string | number, from?: string, to?: string }): Promise<FunnelResponse> => {
  const query = buildSearchParams(params as unknown as Record<string, unknown>).toString();
  return apiFetch<FunnelResponse>(`/api/analytics/funnel${query ? `?${query}` : ''}`, { suppressPanel401Redirect: true, preserveAuthOn401: true });
};

export const getSurveySummary = async (tenantId: string | number): Promise<SurveySummaryResponse> => {
  return apiFetch<SurveySummaryResponse>(`/api/analytics/surveys/summary?tenant_id=${tenantId}`);
};

export const getSurveySentiment = async (tenantId: string | number): Promise<SurveySentimentResponse> => {
  return apiFetch<SurveySentimentResponse>(`/api/analytics/surveys/sentiment?tenant_id=${tenantId}`);
};

export const getSurveyGeo = async (tenantId: string | number): Promise<SurveyGeoResponse> => {
  return apiFetch<SurveyGeoResponse>(`/api/analytics/surveys/geo?tenant_id=${tenantId}`);
};

export const getGeoPolygons = async (tenantId: string | number): Promise<FeatureCollectionLike> => {
  return apiFetch<FeatureCollectionLike>(`/api/geo/polygons?tenant_id=${tenantId}`);
};

export const getMunicipalTicketStates = async (): Promise<string[]> => {
  let payload: MunicipalStatesPayload | null = null;
  try { payload = await apiFetch<MunicipalStatesPayload>('/municipio/estados'); } catch (err) { console.warn('Error fetching municipal ticket states from /municipio/estados, attempting fallback.', err); }
  const normalized = normalizeStatesResponse(payload);
  if (normalized.length > 0) return Array.from(new Set(normalized));
  try { const stats = await getTicketStats({ tipo: 'municipio' }); const derived = extractStatusKeysFromCharts(stats?.charts); return Array.from(new Set(derived)); } catch (err) { console.error('Error fetching municipal ticket states:', err); return []; }
};

type MunicipalStatesPayload = string[] | { estados?: unknown; states?: unknown; data?: unknown; [key: string]: unknown };
const extractStatusKeysFromCharts = (charts: TicketStatsResponse['charts']): string[] => {
  if (!Array.isArray(charts)) return [];
  const statusChart = charts.find((chart) => { const title = (chart?.title ?? '').toString().toLowerCase(); return STATUS_KEYWORDS.some((keyword) => title.includes(keyword)); });
  if (!statusChart || !statusChart.data) return [];
  return Object.keys(statusChart.data).filter((key) => typeof key === 'string' && key.trim().length > 0);
};
const normalizeStatesResponse = (payload: MunicipalStatesPayload | null | undefined): string[] => {
  const potentialLists: unknown[] = [];
  if (Array.isArray(payload)) potentialLists.push(payload); else if (payload && typeof payload === 'object') potentialLists.push(payload.estados, payload.states, payload.data);
  for (const value of potentialLists) { if (Array.isArray(value)) return value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter((item): item is string => item.length > 0); }
  return [];
};


// -------------------------------------------------------------------------
// GovTech Enterprise OS: Executive Mayor Dashboard & Sentinel API Clients
// -------------------------------------------------------------------------

export interface SecretariaPerformance {
  secretaria: string;
  total_reclamos: number;
  resueltos: number;
  pendientes: number;
  porcentaje_resolucion: number;
  tiempo_promedio_horas: number;
  cumplimiento_sla_porcentaje: number;
  semaforo: 'green' | 'yellow' | 'red';
  estado_rendimiento: string;
  csat_estimado: number;
}

export interface CrisisAlert {
  alerta_id: string;
  tipo: string;
  severidad: 'CRITICA' | 'ALTA' | 'MEDIA';
  distrito: string;
  categoria_principal: string;
  reclamos_afectados: number;
  resumen: string;
  accion_recomendada: string;
}

export interface MunicipalExecutiveSummaryResponse {
  timestamp: string;
  scorecards: Record<string, unknown>;
  semaforo_secretarias: {
    resumen_general: {
      total_reclamos: number;
      total_resueltos: number;
      tasa_resolucion_global: number;
      cumplimiento_sla_global: number;
      semaforo_gobierno: 'green' | 'yellow' | 'red';
      secretarias_evaluadas: number;
    };
    ranking_secretarias: SecretariaPerformance[];
  };
  centinela_crisis: {
    estado_centinela: 'NORMAL' | 'ALERTA_PREVENTIVA' | 'CRISIS_DETECTADA';
    nivel_amenaza: string;
    alertas_activas: CrisisAlert[];
    total_alertas: number;
    escaneado_en: string;
  };
}

export const getMunicipalExecutiveSummary = async (): Promise<MunicipalExecutiveSummaryResponse> => {
  return apiFetch<MunicipalExecutiveSummaryResponse>('/api/gov/analytics/executive-summary', {
    suppressPanel401Redirect: true,
    preserveAuthOn401: true,
  });
};

export const getSecretariasTrafficLight = async () => {
  return apiFetch('/api/gov/analytics/traffic-light', {
    suppressPanel401Redirect: true,
    preserveAuthOn401: true,
  });
};

export const getCrisisSentinelAlerts = async () => {
  return apiFetch('/api/gov/analytics/crisis-sentinel', {
    suppressPanel401Redirect: true,
    preserveAuthOn401: true,
  });
};
