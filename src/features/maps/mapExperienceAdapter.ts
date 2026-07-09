import type { HeatPoint } from '@/services/statsService';

type AnyRecord = Record<string, unknown>;
type CoordPair = [number, number];

export interface MapExperienceOptions {
  sourceContract?: string;
  sourceKind?: string;
}

export interface MapExperienceQuality {
  sourceContract?: string;
  sourceKind?: string;
  pointCount: number;
  cellCount: number;
  displayPointCount: number;
  featureCount: number;
  usingCellFallback: boolean;
  privacyMode?: string;
  rawPointsRedacted?: boolean;
  coveragePct?: number;
  withCoordinates?: number;
  withoutCoordinates?: number;
}

export interface MapExperience {
  points: HeatPoint[];
  cells: AnyRecord[];
  cellPoints: HeatPoint[];
  displayPoints: HeatPoint[];
  bounds: CoordPair[];
  center?: CoordPair;
  geoLayerSource?: { type: 'FeatureCollection'; features: unknown[]; [key: string]: unknown };
  geoLayerConfig?: {
    contract_version?: string;
    style_url?: string;
    source?: { type: 'FeatureCollection'; features: unknown[]; [key: string]: unknown };
    source_options?: AnyRecord;
    interactions?: AnyRecord;
    layers?: AnyRecord;
    telemetry?: AnyRecord;
  };
  mapStyleUrl?: string;
  mapTileUrl?: string;
  mapTileAttribution?: string;
  mapLayers?: AnyRecord;
  quality: MapExperienceQuality;
  emptyReason?: 'no_payload' | 'no_coordinates';
}

const asRecord = (value: unknown): AnyRecord | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : undefined;

const read = (record: AnyRecord | undefined, ...keys: string[]) => {
  if (!record) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) return record[key];
  }
  return undefined;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return undefined;
};

const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'si'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
  }
  return undefined;
};

const isLat = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;

const isLng = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;

const parseCoordinateArray = (value: unknown): { lat: number; lng: number } | undefined => {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const first = asNumber(value[0]);
  const second = asNumber(value[1]);
  if (isLng(first) && isLat(second)) return { lat: second, lng: first };
  if (isLat(first) && isLng(second)) return { lat: first, lng: second };
  return undefined;
};

const readCoordinates = (record: AnyRecord | undefined): { lat: number; lng: number } | undefined => {
  if (!record) return undefined;
  const directLat = asNumber(read(record, 'lat', 'latitude', 'centroid_lat', 'centroidLat', 'center_lat', 'y'));
  const directLng = asNumber(read(record, 'lng', 'lon', 'longitude', 'longitud', 'centroid_lon', 'centroid_lng', 'centroidLng', 'centroidLon', 'center_lng', 'x'));
  if (isLat(directLat) && isLng(directLng)) return { lat: directLat, lng: directLng };

  const nested = asRecord(read(record, 'location', 'ubicacion', 'centroid', 'center'));
  const nestedCoordinates = readCoordinates(nested);
  if (nestedCoordinates) return nestedCoordinates;

  const arrayCoordinates = parseCoordinateArray(read(record, 'coordinates', 'coords', 'coordinate'));
  if (arrayCoordinates) return arrayCoordinates;

  const feature = asRecord(read(record, 'feature'));
  const featureCoordinates = readCoordinates(asRecord(read(feature, 'properties')));
  if (featureCoordinates) return featureCoordinates;
  const geometry = asRecord(read(feature, 'geometry'));
  return parseCoordinateArray(read(geometry, 'coordinates'));
};

const readWeight = (record: AnyRecord, fallback = 1) =>
  asNumber(read(record, 'weight', 'intensity', 'intensidad', 'count', 'total', 'value', 'respuestas', 'responses', 'votes', 'cantidad')) ?? fallback;

const normalizePoint = (entry: unknown, index: number): HeatPoint | null => {
  const record = asRecord(entry);
  if (!record) return null;
  const coordinates = readCoordinates(record);
  if (!coordinates) return null;
  const id = read(record, 'id', 'ticket', 'ticket_id', 'cellId', 'cell_id');
  return {
    ...(record as Partial<HeatPoint>),
    id: typeof id === 'number' ? id : undefined,
    lat: coordinates.lat,
    lng: coordinates.lng,
    weight: readWeight(record),
    categoria: asString(read(record, 'categoria', 'category')) ?? (record as Partial<HeatPoint>).categoria,
    estado: asString(read(record, 'estado', 'status')) ?? (record as Partial<HeatPoint>).estado,
    canal: asString(read(record, 'canal', 'channel')) ?? (record as Partial<HeatPoint>).canal,
    fuente: asString(read(record, 'fuente', 'source')) ?? (record as Partial<HeatPoint>).fuente,
    source: asString(read(record, 'source', 'fuente')) ?? (record as Partial<HeatPoint>).source,
    cellId: asString(read(record, 'cellId', 'cell_id', 'cluster_id')) ?? (record as Partial<HeatPoint>).cellId,
    clusterId: asString(read(record, 'clusterId', 'cluster_id', 'cellId', 'cell_id')) ?? (record as Partial<HeatPoint>).clusterId ?? `point-${index + 1}`,
    coordinates: [coordinates.lng, coordinates.lat],
  };
};

const normalizeCellPoint = (entry: unknown, index: number): HeatPoint | null => {
  const record = asRecord(entry);
  if (!record) return null;
  const coordinates = readCoordinates(record);
  if (!coordinates) return null;
  const weight = readWeight(record, 1);
  const cellId = asString(read(record, 'cellId', 'cell_id', 'id', 'key', 'cluster_id')) ?? `cell-${index + 1}`;
  const pointCount = asNumber(read(record, 'point_count', 'pointCount', 'samples', 'count')) ?? weight;
  return {
    ...(record as Partial<HeatPoint>),
    lat: coordinates.lat,
    lng: coordinates.lng,
    weight,
    totalWeight: weight,
    clusterId: cellId,
    cellId,
    clusterSize: Math.max(1, Math.round(pointCount)),
    pointCount: Math.max(1, Math.round(pointCount)),
    source: 'cell',
    categoria: asString(read(record, 'categoria', 'category')),
    estado: asString(read(record, 'estado', 'status')),
    canal: asString(read(record, 'canal', 'channel')),
    fuente: asString(read(record, 'fuente', 'source')),
    coordinates: [coordinates.lng, coordinates.lat],
  };
};

const normalizeFeatureCollection = (value: unknown): MapExperience['geoLayerSource'] => {
  const record = asRecord(value);
  if (!record || record.type !== 'FeatureCollection' || !Array.isArray(record.features)) return undefined;
  return record as MapExperience['geoLayerSource'];
};

const pointsFromFeatureCollection = (source: MapExperience['geoLayerSource']): HeatPoint[] => {
  if (!source) return [];
  return source.features
    .map((feature, index) => {
      const record = asRecord(feature);
      if (!record) return null;
      const geometry = asRecord(read(record, 'geometry'));
      const properties = asRecord(read(record, 'properties')) ?? {};
      const coordinates = parseCoordinateArray(read(geometry, 'coordinates')) ?? readCoordinates(properties);
      if (!coordinates) return null;
      return normalizePoint({ ...properties, lat: coordinates.lat, lng: coordinates.lng }, index);
    })
    .filter((point): point is HeatPoint => Boolean(point));
};

const uniquePoints = (points: HeatPoint[]) => {
  const seen = new Set<string>();
  const result: HeatPoint[] = [];
  points.forEach((point) => {
    const key = `${point.id ?? ''}:${point.cellId ?? ''}:${point.lat.toFixed(7)}:${point.lng.toFixed(7)}:${point.weight ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(point);
  });
  return result;
};

const boundsFromPoints = (points: HeatPoint[]): CoordPair[] =>
  points
    .map((point) => [Number(point.lng), Number(point.lat)] as CoordPair)
    .filter(([lng, lat]) => isLng(lng) && isLat(lat));

const centerFromPoints = (points: HeatPoint[]): CoordPair | undefined => {
  const valid = points.filter((point) => isLat(Number(point.lat)) && isLng(Number(point.lng)));
  if (!valid.length) return undefined;
  const totalWeight = valid.reduce((sum, point) => sum + (Number(point.weight) || 1), 0);
  const divisor = totalWeight > 0 ? totalWeight : valid.length;
  const lat = valid.reduce((sum, point) => sum + Number(point.lat) * (Number(point.weight) || 1), 0) / divisor;
  const lng = valid.reduce((sum, point) => sum + Number(point.lng) * (Number(point.weight) || 1), 0) / divisor;
  return isLat(lat) && isLng(lng) ? [lng, lat] : undefined;
};

const getGeoLayers = (payload: AnyRecord | undefined): AnyRecord | undefined =>
  asRecord(read(payload, 'geo_layers', 'geoLayers')) ?? asRecord(read(asRecord(read(payload, 'map_layers', 'mapLayers')), 'geo_layers', 'geoLayers'));

const getMetadata = (payload: AnyRecord | undefined): AnyRecord | undefined =>
  asRecord(read(payload, 'metadata', 'meta')) ?? asRecord(read(asRecord(read(payload, 'heatmap')), 'metadata', 'meta'));

export const buildMapExperience = (payload: unknown, options: MapExperienceOptions = {}): MapExperience => {
  const record = asRecord(payload);
  if (!record) {
    return {
      points: [],
      cells: [],
      cellPoints: [],
      displayPoints: [],
      bounds: [],
      quality: { pointCount: 0, cellCount: 0, displayPointCount: 0, featureCount: 0, usingCellFallback: false },
      emptyReason: 'no_payload',
    };
  }

  const geoLayers = getGeoLayers(record);
  const metadata = getMetadata(record);
  const locationQuality = asRecord(read(record, 'location_quality', 'locationQuality')) ?? asRecord(read(metadata, 'location_quality', 'locationQuality'));
  const mapConfig = asRecord(read(record, 'map_config', 'mapConfig')) ?? asRecord(read(geoLayers, 'map_config', 'mapConfig'));
  const tiles = asRecord(read(geoLayers, 'tiles'));
  const geoLayerSource =
    normalizeFeatureCollection(read(geoLayers, 'source')) ??
    normalizeFeatureCollection(read(record, 'geojson', 'geo_json', 'feature_collection', 'featureCollection')) ??
    normalizeFeatureCollection(read(record, 'source'));

  const pointCandidates = [
    ...asArray(read(record, 'points', 'puntos', 'geo_points', 'geoPoints')),
    ...asArray(read(asRecord(read(record, 'heatmap')), 'points', 'puntos')),
  ];
  const points = uniquePoints([
    ...pointsFromFeatureCollection(geoLayerSource),
    ...pointCandidates.map(normalizePoint).filter((point): point is HeatPoint => Boolean(point)),
  ]);

  const cellCandidates = [
    ...asArray(read(record, 'cells', 'celdas', 'grid', 'clusters')),
    ...asArray(read(asRecord(read(record, 'heatmap')), 'cells', 'celdas', 'grid', 'clusters')),
  ];
  const cells = cellCandidates.map(asRecord).filter((cell): cell is AnyRecord => Boolean(cell));
  const cellPoints = uniquePoints(cellCandidates.map(normalizeCellPoint).filter((point): point is HeatPoint => Boolean(point)));
  const displayPoints = points.length ? points : cellPoints;
  const mapLayers = asRecord(read(record, 'map_layers', 'mapLayers')) ?? asRecord(read(geoLayers, 'layers'));
  const styleUrl = asString(read(geoLayers, 'style_url', 'styleUrl')) ?? asString(read(mapConfig, 'style_url', 'styleUrl'));
  const contractVersion = asString(read(record, 'contract_version', 'contractVersion')) ?? asString(read(geoLayers, 'contract_version', 'contractVersion')) ?? options.sourceContract;

  const quality: MapExperienceQuality = {
    sourceContract: contractVersion,
    sourceKind: options.sourceKind ?? asString(read(record, 'source_kind', 'sourceKind', 'context', 'scope')),
    pointCount: points.length,
    cellCount: cells.length,
    displayPointCount: displayPoints.length,
    featureCount: geoLayerSource?.features?.length ?? 0,
    usingCellFallback: points.length === 0 && cellPoints.length > 0,
    privacyMode: asString(read(metadata, 'privacy_mode', 'privacyMode')) ?? asString(read(record, 'privacy_mode', 'privacyMode')),
    rawPointsRedacted:
      asBoolean(read(metadata, 'raw_points_redacted', 'rawPointsRedacted')) ??
      asBoolean(read(record, 'raw_points_redacted', 'rawPointsRedacted')),
    coveragePct: asNumber(read(locationQuality, 'coverage_pct', 'coveragePct', 'coverage')),
    withCoordinates: asNumber(read(locationQuality, 'with_coordinates', 'withCoordinates', 'geocoded')),
    withoutCoordinates: asNumber(read(locationQuality, 'without_coordinates', 'withoutCoordinates', 'missing')),
  };

  return {
    points,
    cells,
    cellPoints,
    displayPoints,
    bounds: boundsFromPoints(displayPoints),
    center: centerFromPoints(displayPoints),
    geoLayerSource,
    geoLayerConfig: geoLayers
      ? {
          contract_version: contractVersion,
          style_url: styleUrl,
          source: geoLayerSource,
          source_options: asRecord(read(geoLayers, 'source_options', 'sourceOptions')),
          interactions: asRecord(read(geoLayers, 'interactions')),
          layers: asRecord(read(geoLayers, 'layers')),
          telemetry: asRecord(read(geoLayers, 'telemetry')),
        }
      : undefined,
    mapStyleUrl: styleUrl,
    mapTileUrl: asString(read(tiles, 'url', 'template')),
    mapTileAttribution: asString(read(tiles, 'attribution', 'attribution_html', 'attributionHtml')),
    mapLayers,
    quality,
    emptyReason: displayPoints.length || (geoLayerSource?.features?.length ?? 0) ? undefined : 'no_coordinates',
  };
};
