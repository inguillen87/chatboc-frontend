import { useId, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  BrainCircuit,
  ChevronDown,
  Database,
  Layers3,
  MapPin,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

import LazyMapLibreMap from '@/components/LazyMapLibreMap';
import type { HeatPoint } from '@/services/statsService';
import type {
  SurveyLiveHeatmap,
  SurveyLiveHeatmapCell,
  SurveyLiveHeatmapPoint,
} from '@/types/encuestas';

type TerritorialDatum = {
  id: string;
  value: number;
  label?: string;
  channel?: string;
  lat?: number;
  lng?: number;
  kind: 'point' | 'cell';
};

type HeatmapSummaryItem = {
  label: string;
  value: number;
};

type SurveyMapMode = 'hybrid' | 'density' | 'points';

type ResolvedJurisdiction = {
  displayName: string;
  municipality?: string;
  province?: string;
  country?: string;
  contractVersion?: string;
  coordinateReference?: string;
  coordinateSource?: string;
  center?: [number, number];
};

interface SurveyLiveHeatmapPreviewProps {
  heatmap?: SurveyLiveHeatmap | null;
  aiSignal?: {
    provider_family?: string;
    mode?: string;
    hf_status?: Record<string, unknown>;
    summary?: Record<string, unknown>;
    recommended_actions?: Array<Record<string, unknown>>;
    frontend_contract?: Record<string, unknown>;
  } | null;
  operatorRecommendations?: Array<Record<string, unknown>> | null;
  title?: string;
  subtitle?: string;
  pointsLabel?: string;
  cellsLabel?: string;
  emptyLabel?: string;
}

const NUMBER_FORMAT = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

const SOURCE_LABELS: Record<string, string> = {
  demo_seeded_responses: 'Simulación controlada para demostración',
  backend_demo_contract: 'Escenario demostrativo verificable',
  chatboc_demo_seed: 'Generador de escenario territorial',
  tenant_demo_profile: 'Perfil territorial configurado',
  generic_demo_anchor: 'Referencia territorial genérica',
};

const DENSITY_LEGEND_GRADIENT =
  'linear-gradient(90deg, rgba(68,1,84,0) 0%, rgba(68,1,84,.62) 18%, rgba(59,82,139,.72) 38%, rgba(33,145,140,.78) 58%, rgba(94,201,98,.86) 78%, rgba(253,231,37,.96) 100%)';
const POINTS_COLOR_STOPS = [
  { position: 0, color: '#38bdf8' },
  { position: 0.3, color: '#2563eb' },
  { position: 0.58, color: '#1d4ed8' },
  { position: 1, color: '#ef4444' },
] as const;
const POINTS_LEGEND_GRADIENT = `linear-gradient(90deg, ${POINTS_COLOR_STOPS.map(
  ({ position, color }) => `${color} ${Number((position * 100).toFixed(2))}%`,
).join(', ')})`;

const SURVEY_MAP_BOUNDS_PADDING = { top: 72, right: 52, bottom: 92, left: 52 } as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toFiniteNumber = (value: unknown, fallback = Number.NaN) => {
  if (typeof value !== 'number' && typeof value !== 'string') return fallback;
  if (typeof value === 'string' && !value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isValidCoordinatePair = (lat: number, lng: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180 &&
  !(lat === 0 && lng === 0);

const readNumber = (item: Record<string, unknown>, keys: string[], fallback = Number.NaN) => {
  for (const key of keys) {
    const value = toFiniteNumber(item[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
};

const readString = (item: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
};

const readFlag = (item: Record<string, unknown>, keys: string[]) =>
  keys.some((key) => {
    const value = item[key];
    if (value === true) return true;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') return ['true', '1', 'yes', 'si', 'sí'].includes(value.trim().toLowerCase());
    return false;
  });

const datumValue = (item: Record<string, unknown>) =>
  Math.max(0, readNumber(item, ['value', 'respuestas', 'votos', 'count', 'total', 'weight', 'intensity'], 0));

const normalizeDatum = (
  item: SurveyLiveHeatmapPoint | SurveyLiveHeatmapCell,
  index: number,
  kind: TerritorialDatum['kind'],
): TerritorialDatum => {
  const record = item as Record<string, unknown>;
  const lat = readNumber(record, ['lat', 'latitude', 'centroid_lat']);
  const lng = readNumber(record, ['lng', 'lon', 'longitude', 'centroid_lng', 'centroid_lon']);
  const hasValidCoordinates = isValidCoordinatePair(lat, lng);

  return {
    id: `${kind}-${readString(record, ['id', 'clusterId', 'cluster_id', 'cellId', 'cell_id']) ?? index}`,
    value: datumValue(record),
    label: readString(record, ['barrio', 'zona', 'distrito', 'ciudad', 'label', 'name', 'categoria', 'cellId', 'cell_id']),
    channel: readString(record, ['canal', 'channel', 'source', 'fuente']),
    lat: hasValidCoordinates ? lat : undefined,
    lng: hasValidCoordinates ? lng : undefined,
    kind,
  };
};

const summarizeBy = (
  items: TerritorialDatum[],
  picker: (item: TerritorialDatum) => string | undefined,
): HeatmapSummaryItem[] => {
  const totals = new Map<string, number>();
  items.forEach((item) => {
    const label = picker(item);
    if (!label || item.value <= 0) return;
    totals.set(label, (totals.get(label) ?? 0) + item.value);
  });
  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
};

const parseJurisdictionCenter = (value: unknown): [number, number] | undefined => {
  if (Array.isArray(value) && value.length >= 2) {
    const lng = toFiniteNumber(value[0]);
    const lat = toFiniteNumber(value[1]);
    return isValidCoordinatePair(lat, lng) ? [lng, lat] : undefined;
  }
  if (!isRecord(value)) return undefined;
  const lat = readNumber(value, ['lat', 'latitude']);
  const lng = readNumber(value, ['lng', 'lon', 'longitude']);
  return isValidCoordinatePair(lat, lng) ? [lng, lat] : undefined;
};

const resolveJurisdiction = (heatmap?: SurveyLiveHeatmap | null): ResolvedJurisdiction | null => {
  if (!heatmap) return null;
  const metadata = isRecord(heatmap.metadata) ? heatmap.metadata : {};
  const raw = heatmap.jurisdiction ?? metadata.jurisdiction ?? metadata.jurisdiccion;
  if (typeof raw === 'string' && raw.trim()) return { displayName: raw.trim() };

  const jurisdiction: Record<string, unknown> = isRecord(raw)
    ? raw
    : {
        display_name: metadata.jurisdiction_name ?? metadata.jurisdiccion_nombre,
        municipality: metadata.municipality ?? metadata.municipio,
        province: metadata.province ?? metadata.provincia,
        country: metadata.country ?? metadata.pais,
        center: metadata.center ?? metadata.centro,
        contract_version: metadata.jurisdiction_contract_version,
        coordinate_reference: metadata.coordinate_reference,
        coordinate_source: metadata.coordinate_source,
      };

  const municipality = readString(jurisdiction, ['municipality', 'municipio', 'city', 'locality']);
  const province = readString(jurisdiction, ['province', 'provincia', 'state']);
  const country = readString(jurisdiction, ['country', 'pais']);
  const assembledName = [municipality, province].filter(Boolean).join(', ');
  const displayName =
    readString(jurisdiction, ['display_name', 'displayName', 'label', 'name']) ??
    (assembledName || country);

  if (!displayName) return null;
  return {
    displayName,
    municipality,
    province,
    country,
    contractVersion: readString(jurisdiction, ['contract_version']),
    coordinateReference: readString(jurisdiction, ['coordinate_reference', 'crs']),
    coordinateSource: readString(jurisdiction, ['coordinate_source', 'source']),
    center: parseJurisdictionCenter(jurisdiction.center),
  };
};

const interpolateHexColor = (start: string, end: string, ratio: number) => {
  const startValue = Number.parseInt(start.slice(1), 16);
  const endValue = Number.parseInt(end.slice(1), 16);
  const channel = (shift: number) => {
    const from = (startValue >> shift) & 0xff;
    const to = (endValue >> shift) & 0xff;
    return Math.round(from + (to - from) * ratio);
  };
  return `#${[channel(16), channel(8), channel(0)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
};

const resolveRelativePointColor = (value: number, minValue: number, maxValue: number) => {
  if (maxValue <= minValue) return POINTS_COLOR_STOPS[POINTS_COLOR_STOPS.length - 1].color;

  const relativeValue = Math.max(0, Math.min(1, (value - minValue) / (maxValue - minValue)));
  const upperIndex = POINTS_COLOR_STOPS.findIndex(({ position }) => position >= relativeValue);
  if (upperIndex <= 0) return POINTS_COLOR_STOPS[0].color;
  const lower = POINTS_COLOR_STOPS[upperIndex - 1];
  const upper = POINTS_COLOR_STOPS[upperIndex];
  const segmentRatio = (relativeValue - lower.position) / (upper.position - lower.position);
  return interpolateHexColor(lower.color, upper.color, segmentRatio);
};

const buildMapLibreHeatmapData = (items: TerritorialDatum[]): HeatPoint[] => {
  const mapped = items.filter(
    (item): item is TerritorialDatum & { lat: number; lng: number } =>
      isValidCoordinatePair(item.lat ?? Number.NaN, item.lng ?? Number.NaN),
  );
  const minValue = Math.min(...mapped.map((item) => item.value));
  const observedMaxValue = Math.max(...mapped.map((item) => item.value));
  const weightMaxValue = Math.max(1, observedMaxValue);

  return mapped.map((item) => ({
    lat: item.lat,
    lng: item.lng,
    weight: item.value / weightMaxValue,
    intensity: item.value / weightMaxValue,
    totalWeight: item.value,
    averageWeight: item.value,
    clusterSize: Math.max(1, Math.round(item.value)),
    barrio: item.label,
    distrito: item.label,
    canal: item.channel,
    fuente: item.channel,
    categoria: item.kind === 'point' ? 'respuesta' : 'celda agregada',
    clusterId: item.id,
    cellId: item.kind === 'cell' ? item.id : undefined,
    source: item.kind === 'point' ? 'survey_live_point' : 'survey_live_cell',
    total: item.value,
    categoryColor: resolveRelativePointColor(item.value, minValue, observedMaxValue),
  }));
};

const resolveMapCenter = (
  points: HeatPoint[],
  jurisdictionCenter?: [number, number],
): [number, number] | undefined => {
  if (!points.length) return jurisdictionCenter;
  // The camera center must depend on geography, not on live vote weights. Otherwise
  // every response can move the map while an operator is inspecting a location.
  const lat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const lng = points.reduce((sum, point) => sum + point.lng, 0) / points.length;
  return [lng, lat];
};

const formatMetric = (value: number) => NUMBER_FORMAT.format(value);
const formatPercent = (value: number, total: number) =>
  total > 0 ? `${NUMBER_FORMAT.format((value / total) * 100)}%` : '0%';
const formatCount = (visible: number, total: number) =>
  total > visible ? `${visible}/${total}` : String(visible);
const formatLocations = (count: number) =>
  `${formatMetric(count)} ${count === 1 ? 'ubicación' : 'ubicaciones'}`;

const humanizeSource = (value?: string) => {
  if (!value) return 'No informada por el contrato';
  return SOURCE_LABELS[value] ?? value.replace(/[_-]+/g, ' ');
};

const median = (values: number[]) => {
  if (!values.length) return 0;
  const midpoint = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? ((values[midpoint - 1] ?? 0) + (values[midpoint] ?? 0)) / 2
    : (values[midpoint] ?? 0);
};

function RankingList({
  items,
  total,
  emptyLabel,
  testId,
}: {
  items: HeatmapSummaryItem[];
  total: number;
  emptyLabel: string;
  testId: string;
}) {
  if (!items.length) return <p className="text-sm text-slate-400">{emptyLabel}</p>;

  return (
    <ol className="space-y-3" data-testid={testId}>
      {items.map((item, index) => {
        const percentage = total > 0 ? (item.value / total) * 100 : 0;
        return (
          <li key={item.label} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-300">
              {index + 1}
            </span>
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-medium text-slate-100">{item.label}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatPercent(item.value, total)}</span>
              </div>
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800"
                role="meter"
                aria-label={`${item.label}: ${formatMetric(item.value)} respuestas representadas`}
                aria-valuemin={0}
                aria-valuemax={Math.max(total, item.value)}
                aria-valuenow={item.value}
              >
                <div
                  className="h-full rounded-full bg-blue-400"
                  style={{ width: `${Math.max(3, Math.min(100, percentage))}%` }}
                />
              </div>
            </div>
            <strong className="tabular-nums text-sm text-white">{formatMetric(item.value)}</strong>
          </li>
        );
      })}
    </ol>
  );
}

const priorityTone = (value: unknown) => {
  const priority = String(value ?? 'medium').trim().toLowerCase();
  if (['high', 'critical', 'alta'].includes(priority)) return 'border-rose-300/25 bg-rose-400/10 text-rose-50';
  if (['low', 'baja'].includes(priority)) return 'border-slate-700 bg-slate-900 text-slate-200';
  return 'border-amber-200/20 bg-amber-300/10 text-amber-50';
};

const displayText = (value: unknown, fallback: string) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
};

export function SurveyLiveHeatmapPreview({
  heatmap,
  aiSignal,
  operatorRecommendations,
  title = 'Distribución territorial de respuestas',
  subtitle = 'Muestra geolocalizada para los filtros activos, con fuente, tamaño y procedencia verificables.',
  pointsLabel = 'Puntos',
  cellsLabel = 'Celdas',
  emptyLabel = 'Sin actividad geolocalizada para los filtros actuales',
}: SurveyLiveHeatmapPreviewProps) {
  const reactId = useId().replace(/:/g, '');
  const mapDescriptionId = `${reactId}-territory-map-description`;
  const [mapMode, setMapMode] = useState<SurveyMapMode>('hybrid');
  const [selectedZone, setSelectedZone] = useState('all');
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [fitBoundsRequestKey, setFitBoundsRequestKey] = useState(0);

  const metadata = useMemo<Record<string, unknown>>(
    () => (isRecord(heatmap?.metadata) ? heatmap?.metadata ?? {} : {}),
    [heatmap?.metadata],
  );
  const pointData = useMemo(
    () => (heatmap?.points ?? []).map((point, index) => normalizeDatum(point, index, 'point')),
    [heatmap?.points],
  );
  const cellData = useMemo(
    () => (heatmap?.cells ?? []).map((cell, index) => normalizeDatum(cell, index, 'cell')),
    [heatmap?.cells],
  );
  const summaryData = pointData.length ? pointData : cellData;
  const mappedCandidates = pointData.some((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
    ? pointData
    : cellData;
  const baseMappedSource = useMemo(
    () => mappedCandidates.filter((item) =>
      isValidCoordinatePair(item.lat ?? Number.NaN, item.lng ?? Number.NaN),
    ),
    [mappedCandidates],
  );
  const mapZoneOptions = useMemo(
    () => summarizeBy(baseMappedSource, (item) => item.label).slice(0, 8),
    [baseMappedSource],
  );
  const mapChannelOptions = useMemo(
    () => summarizeBy(baseMappedSource, (item) => item.channel).slice(0, 8),
    [baseMappedSource],
  );
  const effectiveZone = selectedZone === 'all' || mapZoneOptions.some((item) => item.label === selectedZone)
    ? selectedZone
    : 'all';
  const effectiveChannel = selectedChannel === 'all' || mapChannelOptions.some((item) => item.label === selectedChannel)
    ? selectedChannel
    : 'all';
  const mappedSource = useMemo(
    () => baseMappedSource.filter((item) =>
      (effectiveZone === 'all' || item.label === effectiveZone) &&
      (effectiveChannel === 'all' || item.channel === effectiveChannel),
    ),
    [baseMappedSource, effectiveChannel, effectiveZone],
  );
  const mapLibreHeatmapData = useMemo(() => buildMapLibreHeatmapData(mappedSource), [mappedSource]);
  const jurisdiction = useMemo(() => resolveJurisdiction(heatmap), [heatmap]);
  const mapCenter = useMemo(
    () => resolveMapCenter(mapLibreHeatmapData, jurisdiction?.center),
    [jurisdiction?.center, mapLibreHeatmapData],
  );
  const mapBounds = useMemo(
    () => mapLibreHeatmapData.map((point) => [point.lng, point.lat] as [number, number]),
    [mapLibreHeatmapData],
  );

  const rawPointsCount = heatmap?.points?.length ?? 0;
  const rawCellsCount = heatmap?.cells?.length ?? 0;
  const totalPointsCount = Math.max(
    rawPointsCount,
    readNumber(metadata, ['points_count', 'point_count', 'total_points', 'raw_points_count'], rawPointsCount),
  );
  const totalCellsCount = Math.max(
    rawCellsCount,
    readNumber(metadata, ['cells_count', 'cell_count', 'total_cells'], rawCellsCount),
  );
  const datasetLimited = readFlag(metadata, ['truncated_points', 'truncated_cells']);
  const usesSyntheticPoints = readFlag(metadata, ['using_synthetic_points', 'synthetic', 'demo_mode']);
  const privacyMode = readString(metadata, ['privacy_mode'])?.toLowerCase();
  const privacyProtected = metadata.raw_points_redacted === true || privacyMode === 'public_aggregated';
  const source = readString(
    { ...metadata, heatmap_source: heatmap?.source },
    ['heatmap_source', 'source', 'fuente'],
  );
  const provider = readString(metadata, ['provider', 'provider_hint']);
  const contractVersion = readString(metadata, ['contract_version']);
  const totalSignal = summaryData.reduce((sum, item) => sum + item.value, 0);
  const visibleMapSignal = mappedSource.reduce((sum, item) => sum + item.value, 0);
  const zoneSummaries = useMemo(() => summarizeBy(summaryData, (item) => item.label), [summaryData]);
  const channelSummaries = useMemo(() => summarizeBy(summaryData, (item) => item.channel), [summaryData]);
  const topZones = useMemo(() => zoneSummaries.slice(0, 5), [zoneSummaries]);
  const topChannels = useMemo(() => channelSummaries.slice(0, 5), [channelSummaries]);
  const focusZone = topZones[0];
  const dominantChannel = topChannels[0];
  const hasTerritorialData = summaryData.length > 0;
  const hasBaseMappedData = baseMappedSource.length > 0;
  const hasMappedData = mapLibreHeatmapData.length > 0;
  const values = useMemo(
    () => mappedSource.map((item) => item.value).filter((value) => value > 0).sort((a, b) => a - b),
    [mappedSource],
  );
  const intensityScale = {
    min: values[0] ?? 0,
    median: median(values),
    max: values[values.length - 1] ?? 0,
  };
  const provenanceLabel = usesSyntheticPoints
    ? 'Datos sintéticos de demostración'
    : privacyProtected
      ? 'Datos agregados con privacidad'
      : source
        ? 'Datos informados por el contrato'
        : 'Procedencia no informada';
  const datasetLimitLabel = datasetLimited
    ? `Dataset limitado por backend: ${formatCount(rawPointsCount, totalPointsCount)} puntos y ${formatCount(rawCellsCount, totalCellsCount)} celdas`
    : null;

  const aiSummary = aiSignal?.summary ?? {};
  const hfStatus = aiSignal?.hf_status ?? {};
  const aiRecommendations = useMemo(() => {
    const sourceRecommendations = operatorRecommendations?.length
      ? operatorRecommendations
      : aiSignal?.recommended_actions;
    return (sourceRecommendations ?? [])
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .slice(0, 4);
  }, [aiSignal?.recommended_actions, operatorRecommendations]);
  const hasAiSignal = Boolean(aiSignal || aiRecommendations.length);
  const aiModeLabel = hfStatus.used === true
    ? 'Hugging Face activo'
    : hfStatus.configured === true
      ? 'HF listo con fallback'
      : 'Fallback local seguro';
  const dominantIntent = displayText(aiSummary.dominant_intent_label ?? aiSummary.dominant_intent, 'Consulta general');
  const riskLevel = displayText(aiSummary.risk_level ?? aiSummary.risk_signal, 'Normal');
  const humanAttention = aiSummary.requires_human_attention === true;
  const mainActionLabel = displayText(aiRecommendations[0]?.label, 'Sin recomendación informada');
  const mapAriaLabel = jurisdiction
    ? `Mapa de participación de ${jurisdiction.displayName}`
    : 'Mapa de participación territorial';
  const mapLegendTitle = mapMode === 'hybrid'
    ? 'Densidad y volumen combinados'
    : mapMode === 'density'
      ? 'Densidad espacial relativa'
      : 'Volumen por ubicación';
  const mapLegendShort = mapMode === 'hybrid'
    ? 'Calor + puntos'
    : mapMode === 'density'
      ? 'Densidad'
      : 'Puntos';

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-50 shadow-lg shadow-slate-950/10"
      aria-labelledby={`${reactId}-title`}
      data-testid="survey-live-heatmap-preview"
    >
      <header className="border-b border-slate-800 bg-slate-950/95 p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-300/20 bg-blue-400/10 text-blue-100">
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 id={`${reactId}-title`} className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                {title}
              </h3>
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-300">{subtitle}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200"
                  data-testid="survey-live-heatmap-jurisdiction"
                >
                  <MapPin className="h-3.5 w-3.5 text-blue-200" aria-hidden="true" />
                  <strong className="font-semibold text-white">{jurisdiction?.displayName ?? 'No informada'}</strong>
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium ${
                    usesSyntheticPoints
                      ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
                      : source || privacyProtected
                        ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
                        : 'border-slate-700 bg-slate-900 text-slate-300'
                  }`}
                  data-testid="survey-live-heatmap-provenance"
                >
                  {usesSyntheticPoints || (!source && !privacyProtected)
                    ? <Database className="h-3.5 w-3.5" aria-hidden="true" />
                    : <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                  {provenanceLabel}
                </span>
                {privacyProtected ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1.5 font-medium text-emerald-100"
                    data-testid="survey-live-heatmap-privacy"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Privacidad protegida
                  </span>
                ) : null}
                {datasetLimitLabel ? (
                  <span
                    className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 font-medium text-amber-100"
                    data-testid="survey-live-heatmap-dataset-limit"
                  >
                    {datasetLimitLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2 lg:min-w-[25rem]" aria-live="polite">
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Cobertura</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{formatLocations(baseMappedSource.length)}</dd>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Volumen</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{formatMetric(totalSignal)}</dd>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-3" data-testid="survey-live-heatmap-zones-count">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Zonas</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums text-white">{zoneSummaries.length}</dd>
            </div>
          </dl>
        </div>
      </header>

      <div
        className="grid gap-4 p-3 sm:p-4 lg:p-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(18rem,0.62fr)]"
        data-testid="survey-live-heatmap-layout"
      >
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/45">
          <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Mapa de cobertura</p>
              {hasBaseMappedData ? (
                <p className="mt-1 text-xs text-slate-400" aria-live="polite" data-testid="survey-live-heatmap-visible-scope">
                  <strong className="font-semibold text-slate-200">{formatLocations(mapLibreHeatmapData.length)}</strong>
                  {' · '}<strong className="font-semibold text-slate-200">{formatMetric(visibleMapSignal)} respuestas representadas</strong>
                  {effectiveZone !== 'all' ? ` · ${effectiveZone}` : ''}
                  {effectiveChannel !== 'all' ? ` · ${effectiveChannel}` : ''}
                </p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">La intensidad representa volumen, no prioridad ni gravedad.</p>
              )}
            </div>
            {hasBaseMappedData ? (
              <button
                type="button"
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                onClick={() => setFitBoundsRequestKey((current) => current + 1)}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Ajustar área
              </button>
            ) : null}
          </div>

          {hasBaseMappedData ? (
            <details className="group border-b border-slate-800 bg-slate-950/45" data-testid="survey-live-heatmap-map-options">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 [&::-webkit-details-marker]:hidden">
                <span>Opciones del mapa</span>
                <span className="flex items-center gap-2 font-normal text-slate-400">
                  {mapLegendShort}
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                </span>
              </summary>
              <div className="grid gap-3 border-t border-slate-800 px-4 py-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Representación</p>
                    <p className="mt-0.5 text-xs text-slate-500">Elegí densidad, ubicaciones o ambas capas.</p>
                  </div>
                  <div
                    className="inline-flex w-fit rounded-lg border border-slate-700 bg-slate-950 p-1"
                    role="group"
                    aria-label="Modo de visualización territorial"
                  >
                    {([
                      ['hybrid', 'Calor + puntos'],
                      ['density', 'Densidad'],
                      ['points', 'Puntos'],
                    ] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        className={`min-h-9 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 sm:px-3 ${
                          mapMode === mode ? 'bg-slate-100 text-slate-950 shadow-sm' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                        aria-pressed={mapMode === mode}
                        onClick={() => setMapMode(mode)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {mapZoneOptions.length > 1 || mapChannelOptions.length > 1 ? (
                  <div
                    className="grid gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                    data-testid="survey-live-heatmap-map-filters"
                  >
                    <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Zona
                      <select
                        className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm font-medium normal-case tracking-normal text-white outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-300/25"
                        value={effectiveZone}
                        onChange={(event) => setSelectedZone(event.target.value)}
                      >
                        <option value="all">Todas las zonas</option>
                        {mapZoneOptions.map((item) => (
                          <option key={item.label} value={item.label}>{item.label} · {formatMetric(item.value)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Canal
                      <select
                        className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm font-medium normal-case tracking-normal text-white outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-300/25"
                        value={effectiveChannel}
                        onChange={(event) => setSelectedChannel(event.target.value)}
                      >
                        <option value="all">Todos los canales</option>
                        {mapChannelOptions.map((item) => (
                          <option key={item.label} value={item.label}>{item.label} · {formatMetric(item.value)}</option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={effectiveZone === 'all' && effectiveChannel === 'all'}
                      onClick={() => {
                        setSelectedZone('all');
                        setSelectedChannel('all');
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Restablecer
                    </button>
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}

          <p id={mapDescriptionId} className="sr-only">
            {mapAriaLabel}. Incluye {formatLocations(mapLibreHeatmapData.length)} cartografiable{mapLibreHeatmapData.length === 1 ? '' : 's'} y un volumen visible de {formatMetric(visibleMapSignal)} respuestas.
          </p>
          <div className="relative h-[21rem] scroll-mt-20 sm:h-[27rem] lg:h-[31rem]" data-testid="survey-live-heatmap-map-region">
            {hasMappedData ? (
              <div className="absolute inset-0" data-testid="survey-live-heatmap-maplibre">
                <LazyMapLibreMap
                  center={mapCenter}
                  fitToBounds={mapBounds}
                  fitBoundsRequestKey={fitBoundsRequestKey}
                  boundsPadding={SURVEY_MAP_BOUNDS_PADDING}
                  heatmapData={mapLibreHeatmapData}
                  popupContext="survey"
                  showHeatmap={mapMode !== 'points'}
                  showPoints={mapMode !== 'density'}
                  disableClientClustering
                  initialZoom={11}
                  className="absolute inset-0 h-full rounded-none"
                  ariaLabel={mapAriaLabel}
                  ariaDescribedBy={mapDescriptionId}
                  evidence={{
                    metadata,
                    source: usesSyntheticPoints ? undefined : source,
                    provider: usesSyntheticPoints ? undefined : provider,
                    contractVersion,
                    usingSyntheticPoints: usesSyntheticPoints,
                    synthetic: usesSyntheticPoints,
                    pointCount: rawPointsCount,
                    cellCount: rawCellsCount,
                    label: usesSyntheticPoints ? 'Escenario demostrativo' : 'Datos territoriales informados',
                  }}
                />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div className="max-w-md rounded-xl border border-dashed border-slate-700 bg-slate-950/70 p-6">
                  <MapPin className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
                  <p className="mt-3 font-semibold text-slate-100">
                    {hasBaseMappedData ? 'Sin coincidencias para estos filtros' : emptyLabel}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {hasBaseMappedData
                      ? 'Probá otra combinación territorial o restablecé la vista completa.'
                      : hasTerritorialData
                        ? 'El contrato tiene agregados territoriales, pero no coordenadas suficientes para ubicarlos en el mapa.'
                        : 'Ajustá los filtros o esperá nuevas respuestas con información territorial.'}
                  </p>
                  {hasBaseMappedData ? (
                    <button
                      type="button"
                      className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-600 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                      onClick={() => {
                        setSelectedZone('all');
                        setSelectedChannel('all');
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Ver todo el territorio
                    </button>
                  ) : null}
                </div>
              </div>
            )}

            {hasMappedData ? (
              <details
                className="group absolute bottom-3 left-3 right-3 z-10 overflow-hidden rounded-lg border border-slate-700/80 bg-slate-950/90 shadow-lg backdrop-blur sm:left-4 sm:right-auto sm:w-[min(25rem,calc(100%-2rem))]"
                aria-label={`${mapLegendTitle}. Volumen observado: mínimo ${formatMetric(intensityScale.min)}, mediana ${formatMetric(intensityScale.median)}, máximo ${formatMetric(intensityScale.max)}`}
                data-testid="survey-live-heatmap-quantitative-legend"
              >
                <summary
                  className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[11px] font-semibold text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 sm:hidden [&::-webkit-details-marker]:hidden"
                  data-testid="survey-live-heatmap-legend-summary"
                >
                  <span className="uppercase tracking-wide">{mapLegendTitle}</span>
                  <span className="flex items-center gap-2 whitespace-nowrap text-slate-400">
                    {formatMetric(intensityScale.min)}–{formatMetric(intensityScale.max)}
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </span>
                </summary>
                <div className="hidden px-3 py-2.5 group-open:block sm:block">
                  <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                    <span>{mapLegendTitle}</span>
                    <span>{mapLegendShort}</span>
                  </div>
                  <div
                    className="mt-2 h-2.5 rounded-full border border-white/10"
                    style={{ background: mapMode === 'points' ? POINTS_LEGEND_GRADIENT : DENSITY_LEGEND_GRADIENT }}
                    data-testid="survey-live-heatmap-color-ramp"
                  />
                  {mapMode === 'hybrid' ? (
                    <div
                      className="mt-1.5 h-2.5 rounded-full border border-white/10"
                      style={{ background: POINTS_LEGEND_GRADIENT }}
                      data-testid="survey-live-heatmap-point-ramp"
                    />
                  ) : null}
                  <div className="mt-1.5 flex justify-between gap-3 text-[11px] text-slate-400" aria-hidden="true">
                    <span>Menor</span>
                    <span>Intermedia</span>
                    <span>Mayor</span>
                  </div>
                  <div className="mt-2 border-t border-slate-700/80 pt-2 text-[11px] text-slate-300">
                    <span className="font-semibold text-slate-200">Volumen observado:</span>{' '}
                    mín. {formatMetric(intensityScale.min)} · mediana {formatMetric(intensityScale.median)} · máx. {formatMetric(intensityScale.max)}
                  </div>
                </div>
              </details>
            ) : null}
          </div>
        </div>

        <aside className="grid content-start gap-4" aria-label="Resumen ejecutivo territorial">
          {hasTerritorialData ? (
            <section
              className="rounded-xl border border-blue-200/15 bg-blue-400/[0.055] p-4 sm:p-5"
              data-testid="survey-live-heatmap-executive-summary"
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-200" aria-hidden="true" />
                <h4 className="text-sm font-semibold text-white">Lectura ejecutiva</h4>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Síntesis descriptiva de la muestra visible. No implica prioridad, causalidad ni representatividad estadística.
              </p>
              <dl className="mt-4 divide-y divide-slate-800">
                <div className="py-3 first:pt-0">
                  <dt className="text-xs text-slate-400">Mayor participación</dt>
                  <dd className="mt-1 font-semibold text-white">{focusZone?.label ?? 'Sin zona identificada'}</dd>
                  {focusZone ? <p className="mt-0.5 text-xs text-blue-100">{formatMetric(focusZone.value)} · {formatPercent(focusZone.value, totalSignal)}</p> : null}
                </div>
                <div className="py-3">
                  <dt className="text-xs text-slate-400">Canal principal</dt>
                  <dd className="mt-1 font-semibold text-white">{dominantChannel?.label ?? 'No informado'}</dd>
                  {dominantChannel ? <p className="mt-0.5 text-xs text-blue-100">{formatMetric(dominantChannel.value)} · {formatPercent(dominantChannel.value, totalSignal)}</p> : null}
                </div>
                <div className="py-3 last:pb-0">
                  <dt className="text-xs text-slate-400">Próxima acción</dt>
                  <dd className="mt-1 text-sm font-semibold leading-snug text-white">{mainActionLabel}</dd>
                </div>
              </dl>
            </section>
          ) : (
            <section className="rounded-xl border border-slate-800 bg-slate-900/45 p-4 sm:p-5">
              <h4 className="text-sm font-semibold text-white">Lectura ejecutiva</h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                Todavía no hay evidencia territorial suficiente para elaborar una lectura responsable.
              </p>
            </section>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900/45 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Cómo leer el mapa</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Más intensidad significa más respuestas registradas en esa ubicación. La escala se recalcula con la selección visible.
            </p>
          </div>
        </aside>
      </div>

      <div className="grid gap-3 border-t border-slate-800 bg-slate-950/75 p-3 sm:p-4 lg:p-5">
        <details
          className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900/45"
          data-testid="survey-live-heatmap-evidence-summary"
        >
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-200" aria-hidden="true" />
              Evidencia y metodología
            </span>
            <span className="flex items-center gap-2 text-xs font-normal text-slate-400">
              {humanizeSource(source)}
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            </span>
          </summary>
          <div className="border-t border-slate-800 px-4 py-4">
            <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-xs text-slate-400">Jurisdicción</dt>
                <dd className="mt-1 font-medium text-slate-100">{jurisdiction?.displayName ?? 'No informada por el contrato'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Fuente</dt>
                <dd className="mt-1 font-medium capitalize text-slate-100">{humanizeSource(source)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Proveedor / proceso</dt>
                <dd className="mt-1 font-medium capitalize text-slate-100">{humanizeSource(provider)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Procedencia</dt>
                <dd className={usesSyntheticPoints ? 'mt-1 font-medium text-amber-100' : 'mt-1 font-medium text-emerald-100'}>
                  {provenanceLabel}
                </dd>
              </div>
              <div data-testid="survey-live-heatmap-points-count">
                <dt className="text-xs text-slate-400">{pointsLabel} recibidos</dt>
                <dd className="mt-1 font-medium tabular-nums text-slate-100">{formatCount(rawPointsCount, totalPointsCount)}</dd>
              </div>
              <div data-testid="survey-live-heatmap-cells-count">
                <dt className="text-xs text-slate-400">{cellsLabel} agregadas</dt>
                <dd className="mt-1 font-medium tabular-nums text-slate-100">{formatCount(rawCellsCount, totalCellsCount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Tamaño cartográfico</dt>
                <dd className="mt-1 font-medium text-slate-100">
                  {formatLocations(baseMappedSource.length)} · {formatMetric(totalSignal)} respuestas representadas
                </dd>
              </div>
              {(jurisdiction?.coordinateReference || jurisdiction?.coordinateSource) ? (
                <div>
                  <dt className="text-xs text-slate-400">Referencia territorial</dt>
                  <dd className="mt-1 font-medium text-slate-100">
                    {[jurisdiction.coordinateReference, humanizeSource(jurisdiction.coordinateSource)].filter(Boolean).join(' · ')}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </details>

        {hasTerritorialData ? (
          <div className="grid gap-3 lg:grid-cols-2" data-testid="survey-live-heatmap-operational-summary">
            <details className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900/45">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-blue-200" aria-hidden="true" />
                  Ranking territorial
                </span>
                <span className="flex items-center gap-2 text-xs font-normal text-slate-400">
                  Top {topZones.length} de {zoneSummaries.length}
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                </span>
              </summary>
              <div className="border-t border-slate-800 p-4" aria-labelledby={`${reactId}-zones-ranking`}>
                <h4 id={`${reactId}-zones-ranking`} className="sr-only">Ranking territorial</h4>
                <RankingList
                  items={topZones}
                  total={totalSignal}
                  emptyLabel="El contrato no incluye nombres de zonas para construir el ranking."
                  testId="survey-live-heatmap-zone-ranking"
                />
              </div>
            </details>

            <details className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900/45">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-200" aria-hidden="true" />
                  Distribución por canal
                </span>
                <span className="flex items-center gap-2 text-xs font-normal text-slate-400">
                  {topChannels.length} canales
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                </span>
              </summary>
              <div className="border-t border-slate-800 p-4" aria-labelledby={`${reactId}-channels-ranking`}>
                <h4 id={`${reactId}-channels-ranking`} className="sr-only">Distribución por canal</h4>
                <RankingList
                  items={topChannels}
                  total={totalSignal}
                  emptyLabel="El origen de las respuestas no fue informado por el contrato."
                  testId="survey-live-heatmap-channel-ranking"
                />
              </div>
            </details>
          </div>
        ) : null}

        {hasAiSignal ? (
          <details
            className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900/35"
            data-testid="survey-live-heatmap-ai-signal"
          >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-violet-200" aria-hidden="true" />
                Asistencia analítica
              </span>
              <span className="flex items-center gap-2 text-xs font-normal text-slate-400">
                {aiModeLabel}
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              </span>
            </summary>
            <div className="grid gap-3 border-t border-slate-800 p-4 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]">
              <dl className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm sm:grid-cols-3 lg:grid-cols-1">
                <div>
                  <dt className="text-xs text-slate-400">Modo</dt>
                  <dd className="mt-1 font-semibold text-white">{aiModeLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Intención dominante</dt>
                  <dd className="mt-1 font-semibold text-white">{dominantIntent}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Riesgo operativo</dt>
                  <dd className={`mt-1 font-semibold ${humanAttention ? 'text-rose-100' : 'text-emerald-100'}`}>{riskLevel}</dd>
                </div>
              </dl>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Acciones recomendadas</p>
                {aiRecommendations.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {aiRecommendations.map((action, index) => (
                      <div
                        key={`${displayText(action.id, 'action')}-${index}`}
                        className={`rounded-lg border px-3 py-2.5 ${priorityTone(action.priority)}`}
                      >
                        <p className="text-sm font-medium text-white">{displayText(action.label, 'Revisar señal territorial')}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">Sin recomendaciones nuevas para estos filtros.</p>
                )}
              </div>
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}

export default SurveyLiveHeatmapPreview;
