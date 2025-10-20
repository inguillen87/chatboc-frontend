import { ApiError, apiFetch } from '@/utils/api';

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
  aggregatedCanales?: HeatmapBreakdownItem[];
  aggregatedFuentes?: HeatmapBreakdownItem[];
  dominantValues?: Record<string, string | null | undefined>;
  source?: "raw" | "cluster" | "cell";
  cellId?: string;
  pointCount?: number;
}

export interface HeatmapMetadata {
  pointCount?: number;
  cellCount?: number;
  totalWeight?: number;
  maxPointWeight?: number;
  maxCellCount?: number;
  resolution?: number;
  bounds?: [number, number, number, number];
  centroid?: [number, number];
}

export interface HeatmapDataset {
  points: HeatPoint[];
  rawPoints?: HeatPoint[];
  cells?: HeatPoint[];
  rawCells?: unknown[];
  geojson?: unknown;
  cellsGeojson?: unknown;
  providerHint?: string;
  mapConfig?: Record<string, unknown> | null;
  metadata?: HeatmapMetadata;
  raw?: unknown;
}

export interface TicketStatsResponse {
  charts?: { title: string; data: Record<string, number> }[];
  heatmap?: HeatPoint[];
  heatmapDataset?: HeatmapDataset;
}

export interface TicketStatsParams {
  tipo?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  categoria?: string | string[];
  estado?: string | string[];
  distrito?: string;
  barrio?: string;
  genero?: string | string[];
  edad_min?: string | number;
  edad_max?: string | number;
  sugerencia?: string | string[];
  prioridad?: string | string[];
}

const MUNICIPAL_TIPO_ALIASES = ['municipio', 'municipal', 'municipalidad'] as const;

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
  distrito: ['distrito', 'district', 'municipio', 'localidad', 'zone', 'zona'],
  barrio: ['barrio', 'neighborhood', 'colonia', 'sector'],
  tipoTicket: ['tipo_ticket', 'tipo', 'ticket_type', 'type'],
  estado: ['estado', 'status', 'situacion', 'situacion', 'situation'],
  ticket: ['ticket', 'ticket_id', 'ticketid', 'numero', 'nro', 'expediente'],
};

const NORMALIZED_NUMBER_FIELDS = {
  weight: ['weight', 'peso', 'count', 'cantidad', 'total', 'value', 'tickets', 'intensity', 'intensidad'],
  id: ['id', 'ticket_id', 'ticketid'],
};

const STRING_FIELD_KEYWORDS = Object.values(NORMALIZED_STRING_FIELDS).flat();
const NUMBER_FIELD_KEYWORDS = Object.values(NORMALIZED_NUMBER_FIELDS).flat();

const CHART_CONTAINER_KEYS = [
  'chart',
  'charts',
  'chartdata',
  'chartsdata',
  'graphs',
  'graph',
  'graficos',
  'grafico',
  'datasets',
  'series',
  'breakdown',
  'distribucion',
  'distribution',
];

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

const NESTED_CONTAINER_KEYS = [
  'data',
  'datos',
  'payload',
  'result',
  'results',
  'response',
  'contenido',
  'content',
  'body',
  'attributes',
  'attributesdata',
  'meta',
];

const sanitizeLooseJson = (raw: string): string => {
  let sanitized = raw
    .replace(/\bNone\b/g, 'null')
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false');

  // Remove trailing commas before closing braces/brackets.
  sanitized = sanitized.replace(/,\s*([}\]])/g, '$1');

  // Normalize keys written with single quotes (including accented characters).
  sanitized = sanitized.replace(/'([\p{L}\p{N}_-]+)'(\s*:)/gu, (_, key, suffix) => {
    const escapedKey = key.replace(/"/g, '\\"');
    return `"${escapedKey}"${suffix}`;
  });

  // Normalize string values enclosed in single quotes.
  sanitized = sanitized.replace(/:\s*'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, value) => {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `: "${escaped}"`;
  });

  // Normalize any remaining single-quoted strings (e.g. array items).
  sanitized = sanitized.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, value) => {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return `"${escaped}"`;
  });

  return sanitized;
};

const tryParseLooseJson = (raw: string): unknown => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return raw;
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch (jsonError) {
      const sanitized = sanitizeLooseJson(trimmed);
      try {
        return JSON.parse(sanitized);
      } catch (sanitizedError) {
        if (sanitized !== trimmed) {
          console.warn('[statsService] Unable to parse sanitized payload', sanitizedError);
        }
        console.warn('[statsService] Unable to parse loose payload', jsonError);
        return raw;
      }
    }
  }

  return raw;
};

const normalizeApiPayload = (
  payload: unknown,
  visited: WeakMap<object, unknown> = new WeakMap(),
): unknown => {
  if (typeof payload === 'string') {
    const parsed = tryParseLooseJson(payload);
    if (parsed !== payload) {
      return normalizeApiPayload(parsed, visited);
    }
    return payload;
  }

  if (Array.isArray(payload)) {
    if (visited.has(payload)) {
      return visited.get(payload) ?? payload;
    }
    const normalizedArray: unknown[] = [];
    visited.set(payload, normalizedArray);
    for (let index = 0; index < payload.length; index += 1) {
      normalizedArray[index] = normalizeApiPayload(payload[index], visited);
    }
    return normalizedArray;
  }

  if (payload && typeof payload === 'object') {
    const existing = visited.get(payload);
    if (existing) {
      return existing;
    }

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
  key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '');

const parseNumberValue = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const sanitized = trimmed.replace(/\s+/g, '');
    const hasComma = sanitized.includes(',');
    const hasDot = sanitized.includes('.');
    let normalized = sanitized;
    if (hasComma && hasDot) {
      normalized = normalized.replace(/\./g, '').replace(/,/g, '.');
    } else if (hasComma) {
      normalized = normalized.replace(/,/g, '.');
    }
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

const chooseCandidate = (
  first: number,
  second: number,
  order: 'auto' | 'lat-lng' | 'lng-lat',
): { lat: number; lng: number } | null => {
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

const parseCoordinatePair = (
  value: unknown,
  order: 'auto' | 'lat-lng' | 'lng-lat' = 'auto',
): { lat?: number; lng?: number } => {
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
      if (/\bpoint\b/i.test(trimmed) || /\blon\b/i.test(trimmed)) {
        hint = 'lng-lat';
      } else if (trimmed.includes(',')) {
        hint = 'lat-lng';
      }
    }
    const candidate = chooseCandidate(first, second, hint);
    return candidate ?? {};
  }

  return {};
};

const pushUniqueNumber = (list: number[], value: number | undefined) => {
  if (value === undefined || !Number.isFinite(value)) return;
  if (Math.abs(value) > 1e8) return;
  if (!list.some((existing) => Math.abs(existing - value) < 1e-9)) {
    list.push(value);
  }
};

const pushUniquePair = (
  list: { lat: number; lng: number }[],
  pair: { lat?: number; lng?: number },
) => {
  const { lat, lng } = pair;
  if (lat === undefined || lng === undefined) return;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
  if (!list.some((existing) => Math.abs(existing.lat - lat) < 1e-9 && Math.abs(existing.lng - lng) < 1e-9)) {
    list.push({ lat, lng });
  }
};

interface CoordinateCollector {
  latValues: number[];
  lngValues: number[];
  pairs: { lat: number; lng: number }[];
}

const collectCoordinates = (
  value: unknown,
  collector: CoordinateCollector,
  depth = 0,
) => {
  if (depth > 5 || value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    if (
      value.length >= 2 &&
      typeof value[0] !== 'object' &&
      typeof value[1] !== 'object'
    ) {
      const pair = parseCoordinatePair(value, 'auto');
      if (pair.lat !== undefined && pair.lng !== undefined) {
        pushUniquePair(collector.pairs, pair);
      } else {
        pushUniqueNumber(collector.latValues, pair.lat);
        pushUniqueNumber(collector.lngValues, pair.lng);
      }
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
        if (lat !== undefined) {
          pushUniqueNumber(collector.latValues, lat);
        } else {
          const pair = parseCoordinatePair(nested, 'auto');
          pushUniquePair(collector.pairs, pair);
          pushUniqueNumber(collector.latValues, pair.lat);
          pushUniqueNumber(collector.lngValues, pair.lng);
        }
        continue;
      }

      if (LONGITUDE_KEYWORDS.some((keyword) => key.includes(keyword))) {
        const lng = parseNumberValue(nested);
        if (lng !== undefined) {
          pushUniqueNumber(collector.lngValues, lng);
        } else {
          const pair = parseCoordinatePair(nested, 'auto');
          pushUniquePair(collector.pairs, pair);
          pushUniqueNumber(collector.latValues, pair.lat);
          pushUniqueNumber(collector.lngValues, pair.lng);
        }
        continue;
      }

      if (
        COORDINATE_CONTAINER_KEYWORDS.some((keyword) => key.includes(keyword)) ||
        Array.isArray(nested)
      ) {
        const order: 'auto' | 'lat-lng' | 'lng-lat' =
          key.includes('geometry') || key.includes('geom') || key.includes('geojson') || key.includes('point')
            ? 'lng-lat'
            : 'auto';
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

  if (collector.pairs.length > 0) {
    return collector.pairs[0];
  }

  const latCandidate = collector.latValues.find((value) => Math.abs(value) <= 90);
  const lngCandidate = collector.lngValues.find((value) => Math.abs(value) <= 180);
  if (latCandidate !== undefined && lngCandidate !== undefined) {
    return { lat: latCandidate, lng: lngCandidate };
  }

  if (collector.latValues.length > 0 && collector.lngValues.length > 0) {
    return { lat: collector.latValues[0], lng: collector.lngValues[0] };
  }

  return {};
};

const coerceString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
};

const coerceNumber = (value: unknown): number | null => {
  const parsed = parseNumberValue(value);
  return parsed !== undefined && Number.isFinite(parsed) ? parsed : null;
};

const formatKeyLabel = (key: string): string =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());

const findStringByKeywords = (
  record: Record<string, unknown>,
  keywords: string[],
): string | null => {
  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeKey(key);
    if (keywords.some((keyword) => normalizedKey === keyword || normalizedKey.includes(keyword))) {
      const coerced = coerceString(value);
      if (coerced) {
        return coerced;
      }
    }
  }
  return null;
};

const findNumberByKeywords = (
  record: Record<string, unknown>,
  keywords: string[],
): number | null => {
  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = normalizeKey(key);
    if (keywords.some((keyword) => normalizedKey === keyword || normalizedKey.includes(keyword))) {
      const numberValue = coerceNumber(value);
      if (numberValue !== null) {
        return numberValue;
      }
    }
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
        const label =
          findStringByKeywords(record, CHART_LABEL_KEYS) ||
          coerceString(record.label) ||
          coerceString(record.name) ||
          null;
        const numeric =
          findNumberByKeywords(record, CHART_VALUE_KEYS) ??
          coerceNumber(record.value) ??
          coerceNumber(record.count) ??
          coerceNumber(record.total) ??
          null;

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
          entries[formatKeyLabel(fallbackLabel)] =
            (entries[formatKeyLabel(fallbackLabel)] ?? 0) + fallbackValue;
        }
      } else if (typeof item === 'string') {
        const normalized = item.trim();
        if (normalized.length > 0) {
          entries[normalized] = (entries[normalized] ?? 0) + 1;
        }
      } else if (typeof item === 'number' && Number.isFinite(item)) {
        const label = `Item ${index + 1}`;
        entries[label] = (entries[label] ?? 0) + item;
      }
    });
    return entries;
  }

  if (typeof source === 'object') {
    return buildChartDataFromObject(source as Record<string, unknown>);
  }

  return {};
};

interface NormalizedChart {
  title: string;
  data: Record<string, number>;
}

const parseChartLikeObject = (raw: unknown): NormalizedChart | null => {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const title =
    findStringByKeywords(record, CHART_TITLE_KEYS) ||
    coerceString(record.title) ||
    coerceString(record.name) ||
    coerceString(record.label) ||
    '';

  const datasetCandidate =
    record.data ??
    record.values ??
    (record.series as unknown) ??
    (record.items as unknown) ??
    (record.breakdown as unknown) ??
    (record.dataset as unknown) ??
    (record.metrics as unknown) ??
    null;

  let data = buildChartData(datasetCandidate);
  if (Object.keys(data).length === 0) {
    data = buildChartData(record);
  }

  if (Object.keys(data).length === 0) {
    return null;
  }

  return { title: title || '', data };
};

const normalizeChartCollection = (value: unknown): NormalizedChart[] => {
  if (!value) return [];

  if (Array.isArray(value)) {
    const charts: NormalizedChart[] = [];
    value.forEach((entry) => {
      const chart = parseChartLikeObject(entry);
      if (chart) {
        charts.push(chart);
      }
    });

    if (charts.length > 0) {
      return charts;
    }

    const aggregated = buildChartData(value);
    if (Object.keys(aggregated).length > 0) {
      return [{ title: '', data: aggregated }];
    }

    return [];
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if ('title' in record || CHART_TITLE_KEYS.some((key) => key in record)) {
      const chart = parseChartLikeObject(record);
      return chart ? [chart] : [];
    }

    const direct = buildChartData(record);
    if (Object.keys(direct).length > 0) {
      return [{ title: '', data: direct }];
    }

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

const extractChartsFromPayload = (payload: unknown): NormalizedChart[] => {
  const charts: NormalizedChart[] = [];
  const visited = new Set<unknown>();
  const queue: unknown[] = [payload];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      current.forEach((item) => {
        if (item && typeof item === 'object' && !visited.has(item)) {
          queue.push(item);
        }
      });
      continue;
    }

    if (typeof current !== 'object') {
      continue;
    }

    const record = current as Record<string, unknown>;

    for (const [key, value] of Object.entries(record)) {
      const normalizedKey = normalizeKey(key);
      if (CHART_CONTAINER_KEYS.some((keyword) => normalizedKey.includes(keyword))) {
        const extracted = normalizeChartCollection(value);
        extracted.forEach((chart) => charts.push(chart));
      }

      if (value && typeof value === 'object' && !visited.has(value)) {
        queue.push(value);
      }
    }

    for (const containerKey of NESTED_CONTAINER_KEYS) {
      if (containerKey in record) {
        const nested = record[containerKey];
        if (nested && !visited.has(nested)) {
          queue.push(nested);
        }
      }
    }
  }

  if (charts.length === 0 && payload && typeof payload === 'object') {
    const fallback = normalizeChartCollection(payload);
    if (fallback.length > 0) {
      charts.push(...fallback);
    }
  }

  const dedupe = new Map<string, NormalizedChart>();
  charts.forEach((chart) => {
    const key = `${chart.title.toLowerCase()}|${JSON.stringify(chart.data)}`;
    if (!dedupe.has(key)) {
      dedupe.set(key, chart);
    }
  });

  return Array.from(dedupe.values()).map((chart, index) => ({
    title: chart.title && chart.title.trim().length > 0 ? chart.title : `Gráfico ${index + 1}`,
    data: chart.data,
  }));
};

const looksLikeHeatmapPoint = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.length >= 2;
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).some((key) => {
    const normalizedKey = normalizeKey(key);
    return (
      LATITUDE_KEYWORDS.some((keyword) => normalizedKey.includes(keyword)) ||
      LONGITUDE_KEYWORDS.some((keyword) => normalizedKey.includes(keyword)) ||
      COORDINATE_CONTAINER_KEYWORDS.some((keyword) => normalizedKey.includes(keyword)) ||
      STRING_FIELD_KEYWORDS.some((keyword) => normalizedKey.includes(keyword)) ||
      NUMBER_FIELD_KEYWORDS.some((keyword) => normalizedKey.includes(keyword))
    );
  });
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
        if (item && looksLikeHeatmapPoint(item)) {
          const normalized = normalizeHeatPoint(item);
          if (normalized) {
            const key = `${normalized.lat.toFixed(6)}|${normalized.lng.toFixed(6)}|${normalized.categoria ?? ''}|${normalized.estado ?? ''}|${normalized.ticket ?? ''}`;
            if (!seen.has(key)) {
              seen.add(key);
              points.push(normalized);
            }
          }
        }
        if (item && typeof item === 'object' && !visited.has(item)) {
          queue.push(item);
        }
      });
      continue;
    }

    if (typeof current !== 'object') {
      continue;
    }

    const record = current as Record<string, unknown>;
    if (looksLikeHeatmapPoint(record)) {
      const directPoint = normalizeHeatPoint(record);
      if (directPoint) {
        const key = `${directPoint.lat.toFixed(6)}|${directPoint.lng.toFixed(6)}|${directPoint.categoria ?? ''}|${directPoint.estado ?? ''}|${directPoint.ticket ?? ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          points.push(directPoint);
        }
      }
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === 'object' && !visited.has(value)) {
        queue.push(value);
      }
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
    if (normalizedTargets.includes(normalizeKey(key))) {
      return value;
    }
  }
  return undefined;
};

const gatherCandidateContainers = (root: Record<string, unknown>): Record<string, unknown>[] => {
  const seen = new Set<unknown>();
  const containers: Record<string, unknown>[] = [];
  const queue: Record<string, unknown>[] = [root];

  const nestedKeys = [
    'data',
    'datos',
    'payload',
    'result',
    'results',
    'response',
    'contenido',
    'content',
    'body',
    'attributes',
    'attributesdata',
    'meta',
    'metadata',
    'stats',
    'estadisticas',
    'statistics',
    'map',
    'mapa',
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || seen.has(current)) {
      continue;
    }
    seen.add(current);
    containers.push(current);

    nestedKeys.forEach((key) => {
      const nested = getFromRecord(current, key);
      const nestedRecord = asRecord(nested);
      if (nestedRecord && !seen.has(nestedRecord)) {
        queue.push(nestedRecord);
      }
    });
  }

  return containers;
};

const pickFirstValue = <T>(
  containers: Record<string, unknown>[],
  candidateKeys: string[],
  predicate: (value: unknown) => value is T,
): T | undefined => {
  for (const container of containers) {
    const value = getFromRecord(container, ...candidateKeys);
    if (predicate(value)) {
      return value;
    }
  }
  return undefined;
};

const toBreakdownItems = (
  value: unknown,
  totalWeight: number,
): HeatmapBreakdownItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }

      const label = coerceString(
        getFromRecord(record, 'label', 'value', 'name', 'categoria', 'category', 'estado', 'status', 'barrio', 'distrito', 'tipo', 'type', 'canal', 'fuente'),
      );
      if (!label) {
        return null;
      }

      const countValue =
        coerceNumber(getFromRecord(record, 'count', 'cantidad', 'total', 'tickets', 'value')) ?? 0;
      const weightValue =
        coerceNumber(getFromRecord(record, 'weight', 'valor', 'value', 'total', 'tickets', 'count')) ?? countValue;

      const percentageValue =
        coerceNumber(getFromRecord(record, 'percentage', 'percent', 'porcentaje', 'ratio')) ??
        (totalWeight > 0 ? (weightValue / totalWeight) * 100 : 0);

      return {
        label,
        count: Math.round(countValue),
        weight: Number(weightValue.toFixed(2)),
        percentage: Number(percentageValue.toFixed(2)),
      } satisfies HeatmapBreakdownItem;
    })
    .filter((item): item is HeatmapBreakdownItem => Boolean(item));
};

type NormalizeCellsResult = {
  points: HeatPoint[];
  raw: Record<string, unknown>[];
};

const normalizeHeatmapCells = (rawCells: unknown): NormalizeCellsResult => {
  const rawList: Record<string, unknown>[] = [];
  if (!Array.isArray(rawCells)) {
    return { points: [], raw: rawList };
  }

  const points: HeatPoint[] = [];

  rawCells.forEach((item, index) => {
    const cellRecord = asRecord(item);
    if (!cellRecord) {
      return;
    }
    rawList.push(cellRecord);

    const feature = asRecord(getFromRecord(cellRecord, 'feature'));
    const featureProps = feature ? asRecord(getFromRecord(feature, 'properties')) : null;
    const locationRecord =
      asRecord(getFromRecord(cellRecord, 'location', 'centroid', 'center')) ||
      (featureProps ? asRecord(getFromRecord(featureProps, 'location')) : null);

    let lat =
      parseNumberValue(getFromRecord(cellRecord, 'centroid_lat', 'centroidlat', 'lat')) ??
      parseNumberValue(getFromRecord(locationRecord ?? {}, 'lat', 'latitude')) ??
      parseNumberValue(getFromRecord(featureProps ?? {}, 'lat', 'latitude')) ?? undefined;
    let lng =
      parseNumberValue(getFromRecord(cellRecord, 'centroid_lon', 'centroidlng', 'lng', 'lon', 'longitud')) ??
      parseNumberValue(getFromRecord(locationRecord ?? {}, 'lng', 'lon', 'longitud')) ??
      parseNumberValue(getFromRecord(featureProps ?? {}, 'lng', 'lon', 'longitud')) ?? undefined;

    if (lat === undefined || lng === undefined) {
      const fallbackPair = parseCoordinatePair(cellRecord, 'auto');
      if (fallbackPair.lat !== undefined && fallbackPair.lng !== undefined) {
        lat = fallbackPair.lat;
        lng = fallbackPair.lng;
      }
    }

    if (lat === undefined || lng === undefined) {
      return;
    }

    const count =
      parseNumberValue(getFromRecord(cellRecord, 'count', 'weight', 'intensity', 'total')) ??
      parseNumberValue(getFromRecord(featureProps ?? {}, 'count', 'weight', 'intensity', 'total')) ??
      0;
    const pointCount =
      parseNumberValue(getFromRecord(cellRecord, 'point_count', 'pointcount', 'samples')) ??
      parseNumberValue(getFromRecord(featureProps ?? {}, 'point_count', 'pointcount', 'samples')) ??
      undefined;

    const clusterId =
      coerceString(getFromRecord(cellRecord, 'cell_id', 'cellid', 'cluster_id', 'clusterid', 'id')) ||
      coerceString(getFromRecord(featureProps ?? {}, 'cell_id', 'cellid', 'cluster_id', 'clusterid', 'id')) ||
      undefined;

    const radiusMeters =
      parseNumberValue(getFromRecord(cellRecord, 'radius_meters', 'radiusmeters')) ??
      parseNumberValue(getFromRecord(featureProps ?? {}, 'radius_meters', 'radiusmeters')) ??
      undefined;

    const maxDistanceMeters =
      parseNumberValue(getFromRecord(cellRecord, 'max_distance_meters', 'maxdistancemeters')) ??
      parseNumberValue(getFromRecord(featureProps ?? {}, 'max_distance_meters', 'maxdistancemeters')) ??
      undefined;

    const topValuesRecord =
      asRecord(getFromRecord(cellRecord, 'top_values', 'topvalues')) ||
      (featureProps ? asRecord(getFromRecord(featureProps, 'top_values', 'topvalues')) : null);

    const totalWeight = count ?? 0;
    const aggregatedCategorias = toBreakdownItems(
      getFromRecord(topValuesRecord ?? {}, 'categoria', 'categorias', 'category', 'categories'),
      totalWeight,
    );
    const aggregatedBarrios = toBreakdownItems(
      getFromRecord(topValuesRecord ?? {}, 'barrio', 'barrios', 'distrito', 'distritos'),
      totalWeight,
    );
    const aggregatedEstados = toBreakdownItems(
      getFromRecord(topValuesRecord ?? {}, 'estado', 'estados', 'status', 'statuses'),
      totalWeight,
    );
    const aggregatedTipos = toBreakdownItems(
      getFromRecord(topValuesRecord ?? {}, 'tipo', 'tipos', 'tipo_ticket', 'tipos_ticket'),
      totalWeight,
    );
    const aggregatedSeveridades = toBreakdownItems(
      getFromRecord(topValuesRecord ?? {}, 'severidad', 'severidades', 'severity', 'severities'),
      totalWeight,
    );
    const aggregatedCanales = toBreakdownItems(
      getFromRecord(topValuesRecord ?? {}, 'canal', 'canales'),
      totalWeight,
    );
    const aggregatedFuentes = toBreakdownItems(
      getFromRecord(topValuesRecord ?? {}, 'fuente', 'fuentes', 'source', 'sources'),
      totalWeight,
    );

    const dominantValuesRecord =
      asRecord(getFromRecord(cellRecord, 'dominant_values', 'dominantvalues')) ||
      (featureProps ? asRecord(getFromRecord(featureProps, 'dominant_values', 'dominantvalues')) : null);

    const dominantValues: Record<string, string | null | undefined> | undefined = dominantValuesRecord
      ? Object.fromEntries(
          Object.entries(dominantValuesRecord).map(([key, value]) => [key, coerceString(value)]),
        )
      : undefined;

    const sampleTickets =
      (getFromRecord(cellRecord, 'sample_tickets', 'sampletickets') as unknown[]) ??
      (featureProps ? (getFromRecord(featureProps, 'sample_tickets', 'sampletickets') as unknown[]) : undefined);

    const normalizedTickets = Array.isArray(sampleTickets)
      ? sampleTickets
          .map((ticket) => coerceString(ticket))
          .filter((ticket): ticket is string => Boolean(ticket))
      : undefined;

    const lastTicketAt =
      coerceString(getFromRecord(cellRecord, 'last_ticket_at', 'lastticketat', 'last_seen_at')) ??
      coerceString(getFromRecord(featureProps ?? {}, 'last_ticket_at', 'lastticketat', 'last_seen_at')) ??
      null;

    const clusterSize =
      pointCount !== undefined && pointCount > 0
        ? Math.round(pointCount)
        : Math.max(1, Math.round(totalWeight || 1));
    const averageWeight = clusterSize > 0 ? Number((totalWeight / clusterSize).toFixed(2)) : totalWeight;

    points.push({
      lat,
      lng,
      weight: totalWeight,
      totalWeight,
      averageWeight,
      clusterId: clusterId ?? `cell-${index + 1}`,
      clusterSize,
      radiusMeters,
      maxDistanceMeters,
      aggregatedCategorias,
      aggregatedBarrios,
      aggregatedEstados,
      aggregatedTipos,
      aggregatedSeveridades,
      aggregatedCanales,
      aggregatedFuentes,
      dominantValues,
      sampleTickets: normalizedTickets,
      last_ticket_at: lastTicketAt,
      source: 'cell',
      cellId: clusterId ?? undefined,
      pointCount: pointCount !== undefined ? Math.round(pointCount) : undefined,
    });
  });

  return { points, raw: rawList };
};

const normalizeHeatmapDataset = (payload: unknown): HeatmapDataset => {
  const dataset: HeatmapDataset = { points: [], raw: payload };
  const rootRecord = asRecord(payload);

  if (!rootRecord) {
    dataset.points = extractHeatmapFromPayload(payload);
    return dataset;
  }

  const containers = gatherCandidateContainers(rootRecord);

  const rawHeatmap = pickFirstValue(containers, ['heatmap', 'heatmap_points', 'heatmapdata', 'geo_heatmap'], Array.isArray);
  if (rawHeatmap) {
    dataset.rawPoints = rawHeatmap
      .map((item) => normalizeHeatPoint(item))
      .filter((point): point is HeatPoint => Boolean(point));
  }

  const rawCells = pickFirstValue(containers, ['heatmap_cells', 'heatmapcells', 'heatmap_grid', 'grid_cells'], Array.isArray);
  if (rawCells) {
    const normalizedCells = normalizeHeatmapCells(rawCells);
    dataset.cells = normalizedCells.points;
    dataset.rawCells = normalizedCells.raw;
  }

  const mapConfig = pickFirstValue(
    containers,
    ['map_config', 'mapconfig'],
    (value): value is Record<string, unknown> => Boolean(asRecord(value)),
  );
  if (mapConfig) {
    dataset.mapConfig = mapConfig;
  }

  const heatmapGeojson = pickFirstValue(
    containers,
    ['heatmap_geojson', 'heatmapgeojson'],
    (value): value is unknown => value !== undefined,
  );
  if (heatmapGeojson !== undefined) {
    dataset.geojson = heatmapGeojson;
  }

  const cellsGeojson = pickFirstValue(
    containers,
    ['heatmap_cells_geojson', 'heatmapcellsgeojson'],
    (value): value is unknown => value !== undefined,
  );
  if (cellsGeojson !== undefined) {
    dataset.cellsGeojson = cellsGeojson;
  }

  const mapLayers = pickFirstValue(
    containers,
    ['map_layers', 'maplayers'],
    (value): value is Record<string, unknown> => Boolean(asRecord(value)),
  );
  if (mapLayers) {
    const layersRecord = asRecord(mapLayers);
    if (layersRecord) {
      dataset.providerHint =
        coerceString(getFromRecord(layersRecord, 'provider_hint', 'provider', 'preferred_provider')) ??
        dataset.providerHint;

      const heatmapLayer = asRecord(getFromRecord(layersRecord, 'heatmap'));
      if (heatmapLayer) {
        dataset.providerHint =
          coerceString(getFromRecord(heatmapLayer, 'provider_hint', 'provider', 'preferred_provider')) ??
          dataset.providerHint;
      }
    }
  }

  const metadataRecord = pickFirstValue(
    containers,
    ['metadata'],
    (value): value is Record<string, unknown> => Boolean(asRecord(value)),
  );
  if (metadataRecord) {
    const metadataMap = asRecord(getFromRecord(metadataRecord, 'map', 'mapa')) ?? metadataRecord;
    const heatmapMetadata = asRecord(getFromRecord(metadataMap, 'heatmap', 'geo_heatmap'));
    if (heatmapMetadata) {
      const meta: HeatmapMetadata = {};

      const pointCount = parseNumberValue(getFromRecord(heatmapMetadata, 'point_count', 'pointcount', 'points'));
      if (pointCount !== undefined) meta.pointCount = pointCount;

      const cellCount = parseNumberValue(getFromRecord(heatmapMetadata, 'cell_count', 'cellcount', 'cells'));
      if (cellCount !== undefined) meta.cellCount = cellCount;

      const totalWeight = parseNumberValue(
        getFromRecord(heatmapMetadata, 'total_weight', 'weight_total', 'totalweight'),
      );
      if (totalWeight !== undefined) meta.totalWeight = totalWeight;

      const maxPointWeight = parseNumberValue(
        getFromRecord(heatmapMetadata, 'max_point_weight', 'maxpointweight', 'max_weight'),
      );
      if (maxPointWeight !== undefined) meta.maxPointWeight = maxPointWeight;

      const maxCellCount = parseNumberValue(
        getFromRecord(heatmapMetadata, 'max_cell_count', 'maxcellcount', 'max_cells'),
      );
      if (maxCellCount !== undefined) meta.maxCellCount = maxCellCount;

      const resolution = parseNumberValue(getFromRecord(heatmapMetadata, 'resolution', 'resolucion'));
      if (resolution !== undefined) meta.resolution = resolution;

      const centroidValue = getFromRecord(heatmapMetadata, 'centroid', 'centro');
      const centroidPair = parseCoordinatePair(centroidValue, 'auto');
      if (centroidPair.lat !== undefined && centroidPair.lng !== undefined) {
        meta.centroid = [centroidPair.lng, centroidPair.lat];
      }

      const boundsValue = getFromRecord(heatmapMetadata, 'bounds', 'limites', 'bounding_box');
      if (Array.isArray(boundsValue) && boundsValue.length >= 4) {
        const [west, south, east, north] = boundsValue;
        const normalizedBounds = [west, south, east, north]
          .map((coord) => parseNumberValue(coord))
          .filter((coord): coord is number => coord !== undefined);
        if (normalizedBounds.length === 4) {
          meta.bounds = normalizedBounds as [number, number, number, number];
        }
      }

      if (!dataset.providerHint) {
        dataset.providerHint = coerceString(
          getFromRecord(heatmapMetadata, 'provider_hint', 'provider', 'preferred_provider'),
        ) ?? dataset.providerHint;
      }

      if (Object.keys(meta).length > 0) {
        dataset.metadata = meta;
      }
    }
  }

  if (!dataset.providerHint) {
    dataset.providerHint = 'maplibre';
  }

  if (dataset.cells && dataset.cells.length > 0) {
    dataset.points = dataset.cells;
  } else if (dataset.rawPoints && dataset.rawPoints.length > 0) {
    dataset.points = dataset.rawPoints;
  } else {
    dataset.points = extractHeatmapFromPayload(payload);
  }

  return dataset;
};

const extractValueByKeywords = <T>(
  source: unknown,
  keywords: string[],
  transform: (value: unknown) => T | undefined,
  match: 'exact' | 'includes' = 'includes',
  depth = 0,
  allowTransform = false,
): T | undefined => {
  if (depth > 5 || source === null || source === undefined) return undefined;

  if (Array.isArray(source)) {
    for (const item of source) {
      const result = extractValueByKeywords(
        item,
        keywords,
        transform,
        match,
        depth + 1,
        allowTransform,
      );
      if (result !== undefined) {
        return result;
      }
    }
    return undefined;
  }

  if (typeof source !== 'object') {
    return allowTransform ? transform(source) : undefined;
  }

  for (const [rawKey, value] of Object.entries(source as Record<string, unknown>)) {
    const key = normalizeKey(rawKey);
    const matched =
      match === 'exact'
        ? keywords.includes(key)
        : keywords.some((keyword) => key.includes(keyword));

    if (matched) {
      const transformed = transform(value);
      if (transformed !== undefined) {
        return transformed;
      }
      const nestedMatch = extractValueByKeywords(
        value,
        keywords,
        transform,
        match,
        depth + 1,
        true,
      );
      if (nestedMatch !== undefined) {
        return nestedMatch;
      }
      continue;
    }

    const nested = extractValueByKeywords(
      value,
      keywords,
      transform,
      match,
      depth + 1,
      allowTransform,
    );
    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
};

const stringTransformer = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
};

const numberTransformer = (value: unknown): number | undefined => parseNumberValue(value);

const pickStringValue = (source: unknown, keywords: string[]): string | undefined => {
  const exact = extractValueByKeywords(source, keywords, stringTransformer, 'exact');
  if (exact) return exact;
  return extractValueByKeywords(source, keywords, stringTransformer, 'includes');
};

const pickNumberValue = (source: unknown, keywords: string[]): number | undefined => {
  const exact = extractValueByKeywords(source, keywords, numberTransformer, 'exact');
  if (exact !== undefined) return exact;
  return extractValueByKeywords(source, keywords, numberTransformer, 'includes');
};

const normalizeHeatPoint = (raw: unknown): HeatPoint | null => {
  if (Array.isArray(raw)) {
    const pair = parseCoordinatePair(raw, 'auto');
    if (pair.lat === undefined || pair.lng === undefined) return null;
    const point: HeatPoint = { lat: pair.lat, lng: pair.lng };
    if (raw.length >= 3) {
      const weight = parseNumberValue(raw[2]);
      if (weight !== undefined) point.weight = weight;
    }
    if (raw.length >= 4) {
      const category = coerceString(raw[3]);
      if (category) point.categoria = category;
    }
    return point;
  }

  if (!raw || typeof raw !== 'object') return null;

  const { lat, lng } = extractCoordinates(raw);
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return null;
  }

  const weight = pickNumberValue(raw, NORMALIZED_NUMBER_FIELDS.weight);
  const id = pickNumberValue(raw, NORMALIZED_NUMBER_FIELDS.id);
  const ticket = pickStringValue(raw, NORMALIZED_STRING_FIELDS.ticket);
  const categoria = pickStringValue(raw, NORMALIZED_STRING_FIELDS.categoria);
  const direccion = pickStringValue(raw, NORMALIZED_STRING_FIELDS.direccion);
  const distrito = pickStringValue(raw, NORMALIZED_STRING_FIELDS.distrito);
  const tipoTicket = pickStringValue(raw, NORMALIZED_STRING_FIELDS.tipoTicket);
  const estado = pickStringValue(raw, NORMALIZED_STRING_FIELDS.estado);

  let barrio = pickStringValue(raw, NORMALIZED_STRING_FIELDS.barrio);
  if (!barrio && distrito) {
    barrio = distrito;
  }

  const point: HeatPoint = { lat, lng };
  if (weight !== undefined) point.weight = weight;
  if (id !== undefined) point.id = id;
  if (ticket) point.ticket = ticket;
  if (categoria) point.categoria = categoria;
  if (direccion) point.direccion = direccion;
  if (distrito) point.distrito = distrito;
  if (barrio) point.barrio = barrio;
  if (tipoTicket) point.tipo_ticket = tipoTicket;
  if (estado) point.estado = estado;

  return point;
};

const buildSearchParams = (params?: Record<string, unknown>) => {
  const qs = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (Array.isArray(v)) {
      v
        .filter((val) => val !== undefined && val !== null && String(val) !== '')
        .forEach((val) => qs.append(k, String(val)));
    } else if (v !== undefined && v !== null && String(v) !== '') {
      qs.append(k, String(v));
    }
  });
  return qs;
};

const shouldTryMunicipalAliases = (value?: string | null): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return MUNICIPAL_TIPO_ALIASES.includes(normalized as (typeof MUNICIPAL_TIPO_ALIASES)[number]);
};

const RECOVERABLE_STATUSES = new Set([400, 404, 409, 422, 500, 502, 503]);

const tryMunicipalAliases = async <T>(
  attempt: (tipo?: string) => Promise<T>,
  tipo?: string,
  shouldRetry?: (result: T) => boolean,
): Promise<T> => {
  if (!shouldTryMunicipalAliases(tipo)) {
    return attempt(tipo);
  }

  const normalizedTipo = tipo?.trim().toLowerCase() ?? '';
  const aliases = (
    [
      ...MUNICIPAL_TIPO_ALIASES.filter((alias) => alias === normalizedTipo),
      ...MUNICIPAL_TIPO_ALIASES.filter((alias) => alias !== normalizedTipo),
    ]
  ).filter((alias, index, arr) => arr.indexOf(alias) === index);

  let lastError: unknown = null;
  let fallbackResult: T | null = null;

  for (const alias of aliases) {
    try {
      const result = await attempt(alias);
      if (!shouldRetry || !shouldRetry(result)) {
        return result;
      }
      if (fallbackResult === null) {
        fallbackResult = result;
      }
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError) {
        if (!RECOVERABLE_STATUSES.has(error.status)) {
          throw error;
        }
        console.warn(
          '[statsService] Municipal alias attempt failed, trying next alias',
          {
            alias,
            status: error.status,
            message: error.message,
          },
        );
      } else {
        throw error;
      }
    }
  }

  if (fallbackResult !== null) {
    return fallbackResult;
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error('No municipal alias produced a successful response');
};

export const getTicketStats = async (
  params?: TicketStatsParams,
): Promise<TicketStatsResponse> => {
  const fetchStats = async (overrideTipo?: string): Promise<TicketStatsResponse> => {
    const normalizedParams: TicketStatsParams = {
      ...(params || {}),
    };

    if (overrideTipo) {
      normalizedParams.tipo = overrideTipo;
    }

    const query = buildSearchParams(normalizedParams).toString();
    const resp = await apiFetch<unknown>(
      `/estadisticas/tickets${query ? `?${query}` : ''}`,
    );

    const normalizedPayload = normalizeApiPayload(resp);

    if (isHtmlPayload(normalizedPayload)) {
      console.warn('[statsService] Received HTML payload for /estadisticas/tickets, aborting further alias attempts.');
      const error = new Error('HTML payload returned from /estadisticas/tickets');
      (error as Error & { code?: string }).code = 'HTML_PAYLOAD';
      throw error;
    }

    const charts = extractChartsFromPayload(normalizedPayload).map((chart) => ({
      title: chart.title,
      data: chart.data,
    }));

    const heatmapDataset = normalizeHeatmapDataset(normalizedPayload);

    return { charts, heatmap: heatmapDataset.points, heatmapDataset };
  };

  try {
    return await tryMunicipalAliases(fetchStats, params?.tipo, (result) => {
      const chartsEmpty = !result?.charts || result.charts.length === 0;
      const heatmapEmpty =
        (!result?.heatmap || result.heatmap.length === 0) &&
        (!result?.heatmapDataset?.points || result.heatmapDataset.points.length === 0);
      return chartsEmpty && heatmapEmpty;
    });
  } catch (err) {
    console.error('Error fetching ticket stats:', err);
    throw err;
  }
};

export interface HeatmapParams {
  tipo_ticket?: string;
  tipo?: string;
  municipio_id?: number;
  rubro_id?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  categoria?: string | string[];
  estado?: string | string[];
  distrito?: string;
  barrio?: string;
  genero?: string | string[];
  edad_min?: string | number;
  edad_max?: string | number;
  sugerencia?: string | string[];
}

export const getHeatmapDataset = async (
  params?: HeatmapParams,
): Promise<HeatmapDataset> => {
  const requestHeatmap = async (overrideTipo?: string): Promise<HeatmapDataset> => {
    const baseParams: HeatmapParams = {
      ...(params || {}),
    };

    const sanitizeTipoValue = (value?: string | null) => {
      if (typeof value !== 'string') return value ?? undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const normalizedBase: HeatmapParams = { ...baseParams };
    if (typeof normalizedBase.tipo_ticket === 'string') {
      normalizedBase.tipo_ticket = sanitizeTipoValue(normalizedBase.tipo_ticket);
    }
    if (typeof normalizedBase.tipo === 'string') {
      normalizedBase.tipo = sanitizeTipoValue(normalizedBase.tipo);
    }

    const overrideValue = sanitizeTipoValue(overrideTipo);

    const variants: HeatmapParams[] = [];
    const seen = new Set<string>();

    const pushVariant = (variant: HeatmapParams) => {
      const entries = Object.entries(variant)
        .filter(([, value]) => {
          if (value === undefined || value === null) return false;
          if (typeof value === 'string') return value.trim().length > 0;
          if (Array.isArray(value)) return value.length > 0;
          return true;
        })
        .map(([key, value]) => [key, Array.isArray(value) ? [...value] : value]);

      entries.sort(([a], [b]) => a.localeCompare(b));
      const key = JSON.stringify(entries);
      if (!seen.has(key)) {
        seen.add(key);
        variants.push(variant);
      }
    };

    pushVariant(normalizedBase);

    const withOverride: HeatmapParams = { ...normalizedBase };

    if (overrideValue) {
      withOverride.tipo = overrideValue;
      withOverride.tipo_ticket = overrideValue;
    } else {
      const baseTipo = sanitizeTipoValue(normalizedBase.tipo);
      const baseTipoTicket = sanitizeTipoValue(
        typeof normalizedBase.tipo_ticket === 'string'
          ? normalizedBase.tipo_ticket
          : undefined,
      );

      if (baseTipo && !baseTipoTicket) {
        withOverride.tipo = baseTipo;
        withOverride.tipo_ticket = baseTipo;
      } else if (!baseTipo && baseTipoTicket) {
        withOverride.tipo = baseTipoTicket;
        withOverride.tipo_ticket = baseTipoTicket;
      }
    }

    pushVariant(withOverride);

    if ('tipo' in withOverride) {
      const withoutTipo = { ...withOverride };
      delete withoutTipo.tipo;
      pushVariant(withoutTipo);
    }

    if ('tipo_ticket' in withOverride) {
      const withoutTipoTicket = { ...withOverride };
      delete withoutTipoTicket.tipo_ticket;
      pushVariant(withoutTipoTicket);
    }

    if (overrideValue) {
      const ticketOnlyOverride = { ...normalizedBase };
      delete ticketOnlyOverride.tipo;
      ticketOnlyOverride.tipo_ticket = overrideValue;
      pushVariant(ticketOnlyOverride);

      const tipoOnlyOverride = { ...normalizedBase };
      delete tipoOnlyOverride.tipo_ticket;
      tipoOnlyOverride.tipo = overrideValue;
      pushVariant(tipoOnlyOverride);
    }

    let fallbackResult: HeatmapDataset | null = null;
    let lastError: unknown = null;

    for (const variant of variants) {
      const query = buildSearchParams(variant).toString();
      try {
        const payload = await apiFetch<unknown>(
          `/estadisticas/mapa_calor/datos${query ? `?${query}` : ''}`,
        );
        const normalizedPayload = normalizeApiPayload(payload);
        if (isHtmlPayload(normalizedPayload)) {
          console.warn('[statsService] Received HTML payload for /estadisticas/mapa_calor/datos, aborting further alias attempts.');
          const error = new Error('HTML payload returned from /estadisticas/mapa_calor/datos');
          (error as Error & { code?: string }).code = 'HTML_PAYLOAD';
          throw error;
        }
        const dataset = normalizeHeatmapDataset(normalizedPayload);
        if (dataset.points.length > 0) {
          return dataset;
        }
        if (fallbackResult === null) {
          fallbackResult = dataset;
        }
      } catch (error) {
        lastError = error;
        if (error instanceof ApiError) {
          if (!RECOVERABLE_STATUSES.has(error.status)) {
            throw error;
          }
          console.warn('[statsService] Heatmap request failed, retrying with variant', {
            params: variant,
            status: error.status,
            message: error.message,
          });
        } else {
          throw error;
        }
      }
    }

    if (fallbackResult !== null) {
      return fallbackResult;
    }

    if (lastError) {
      throw lastError;
    }

    return { points: [] };
  };

  try {
    const result = await tryMunicipalAliases(
      requestHeatmap,
      params?.tipo ?? params?.tipo_ticket,
      (dataset) => !dataset || dataset.points.length === 0,
    );

    if (
      (!result || result.points.length === 0) &&
      shouldTryMunicipalAliases(params?.tipo_ticket) &&
      !shouldTryMunicipalAliases(params?.tipo)
    ) {
      return await tryMunicipalAliases(
        requestHeatmap,
        params?.tipo_ticket,
        (dataset) => !dataset || dataset.points.length === 0,
      );
    }

    return result;
  } catch (err) {
    console.error('Error fetching heatmap points:', err);
    throw err;
  }
};

export const getHeatmapPoints = async (params?: HeatmapParams): Promise<HeatPoint[]> => {
  const dataset = await getHeatmapDataset(params);
  return dataset.points;
};

type MunicipalStatesPayload =
  | string[]
  | {
      estados?: unknown;
      states?: unknown;
      data?: unknown;
      [key: string]: unknown;
    };

const normalizeStatesResponse = (payload: MunicipalStatesPayload | null | undefined): string[] => {
  const potentialLists: unknown[] = [];
  if (Array.isArray(payload)) {
    potentialLists.push(payload);
  } else if (payload && typeof payload === 'object') {
    potentialLists.push(payload.estados, payload.states, payload.data);
  }

  for (const value of potentialLists) {
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item): item is string => item.length > 0);
    }
  }

  return [];
};

const STATUS_KEYWORDS = ['estado', 'status', 'situacion', 'situación'];

const extractStatusKeysFromCharts = (
  charts: TicketStatsResponse['charts'],
): string[] => {
  if (!Array.isArray(charts)) return [];
  const statusChart = charts.find((chart) => {
    const title = (chart?.title ?? '').toString().toLowerCase();
    return STATUS_KEYWORDS.some((keyword) => title.includes(keyword));
  });

  if (!statusChart || !statusChart.data) return [];

  return Object.keys(statusChart.data).filter((key) => typeof key === 'string' && key.trim().length > 0);
};

export const getMunicipalTicketStates = async (): Promise<string[]> => {
  let payload: MunicipalStatesPayload | null = null;
  try {
    payload = await apiFetch<MunicipalStatesPayload>('/municipal/estados');
  } catch (err) {
    console.warn('Error fetching municipal ticket states from /municipal/estados, attempting fallback.', err);
  }

  const normalized = normalizeStatesResponse(payload);
  if (normalized.length > 0) {
    return Array.from(new Set(normalized));
  }

  try {
    const stats = await getTicketStats({ tipo: 'municipio' });
    const derived = extractStatusKeysFromCharts(stats?.charts);
    return Array.from(new Set(derived));
  } catch (err) {
    console.error('Error fetching municipal ticket states:', err);
    return [];
  }
};

