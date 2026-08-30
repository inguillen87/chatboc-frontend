import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import MapLibreMap from '@/components/LazyMapLibreMap';
import TicketStatsCharts from '@/components/TicketStatsCharts';
import { PremiumTerritoryHeatmap } from '@/features/analytics/PremiumTerritoryMap';
import { resolveTerritoryDataProvenance } from '@/features/analytics/premiumTerritoryHeatmap';
import { getOperationsHeatmapV2 } from '@/features/analytics/analyticsApi';
import type {
  OperationsBucketItem,
  OperationsHeatmapPoint,
  OperationsHeatmapV1,
  PublicMapConfigV1,
} from '@/features/analytics/analyticsTypes';
import { Button } from '@/components/ui/button';
import { ApiError, apiFetch } from '@/utils/api';
import useRequireRole from '@/hooks/useRequireRole';
import { useUser } from '@/hooks/useUser';
import type { Role } from '@/utils/roles';
import {
  getTicketStats,
  getHeatmapDataset,
  HeatPoint,
  HeatmapDataset,
  TicketStatsResponse,
} from '@/services/statsService';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { mergeAndSortStrings } from '@/utils/collections';
import { useMapProvider } from '@/hooks/useMapProvider';
import type { MapProvider, MapProviderUnavailableReason } from '@/hooks/useMapProvider';
import { MapProviderToggle } from '@/components/MapProviderToggle';
import { normalizeProfileTenantSlug } from '@/utils/profileTenantAuthority';
import {
  Activity,
  AlertCircle,
  Flame,
  Layers,
  LocateFixed,
  MapPin,
  Radio,
  RefreshCw,
  SlidersHorizontal,
  Target,
} from 'lucide-react';

const HEATMAP_CACHE_LIMIT = 20;
const LEGACY_COMPATIBILITY_STATUSES = new Set([404, 405, 501]);

type HeatmapContractSource = 'operations_v2' | 'legacy_partial' | null;

type IncidentTimeRange = 'custom' | '7d' | '30d' | '90d';

type IncidentMapFilters = {
  fecha_inicio?: string;
  fecha_fin?: string;
  categoria: string[];
  estado: string[];
  distrito?: string;
  barrio?: string;
  genero?: string;
  edad_min?: string;
  edad_max?: string;
};

const dateValuesForRange = (range: IncidentTimeRange, now = new Date()) => {
  if (range === 'custom') return { start: '', end: '' };

  const end = now.toISOString().slice(0, 10);
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - days);
  return { start: startDate.toISOString().slice(0, 10), end };
};

const defaultIncidentMapFilters = (): IncidentMapFilters => {
  const dates = dateValuesForRange('30d');
  return {
    fecha_inicio: dates.start,
    fecha_fin: dates.end,
    categoria: [],
    estado: [],
  };
};

const normalizeValue = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value.trim();
  return String(value);
};

const normalizeArrayValue = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeValue(item))
    .filter((item): item is string => item.length > 0)
    .sort((a, b) => a.localeCompare(b));
};

const buildHeatmapCacheKey = (filters: Record<string, unknown>): string => {
  const normalizedEntries: Array<[string, string | string[]]> = Object.entries(filters).map(([key, value]) => {
    if (Array.isArray(value)) {
      return [key, normalizeArrayValue(value)];
    }
    return [key, normalizeValue(value)];
  });

  normalizedEntries.sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(normalizedEntries);
};

const sanitizeFilterValue = (value?: string | null): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  value.toLocaleString('es-AR', options);

const formatCountLabel = (value: number, singular: string, plural: string) =>
  `${formatNumber(value)} ${Math.abs(value) === 1 ? singular : plural}`;

const MAP_LABELS: Record<string, string> = {
  employee_aggregated: 'Datos agregados del equipo',
  tenant_aggregated: 'Datos agregados del municipio',
  public_aggregated: 'Datos públicos agregados',
  coordinates_without_customer_pii: 'Sin datos personales',
  client_filter: 'Filtro operativo',
  pending: 'Pendiente',
  queued: 'En revisión',
  ready: 'Disponible',
  real: 'Procedencia declarada como real',
  synthetic: 'Datos simulados',
  privileged_exact: 'Acceso institucional protegido',
};

const formatMapLabel = (value?: string | null) => {
  if (!value) return 'Sin dato';
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return MAP_LABELS[normalized] ?? value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
};

const getPointWeight = (point: HeatPoint) => {
  const candidates = [
    point.totalWeight,
    point.total,
    point.weight,
    point.clusterSize,
    point.pointCount,
  ];
  const value = candidates.find((item) => typeof item === 'number' && Number.isFinite(item));
  return Math.max(1, Number(value ?? 1));
};

const buildWeightedBreakdown = (
  points: HeatPoint[],
  getLabel: (point: HeatPoint) => string | null | undefined,
) => {
  const totals = new Map<string, { count: number; weight: number }>();
  points.forEach((point) => {
    const rawLabel = getLabel(point);
    const label = typeof rawLabel === 'string' && rawLabel.trim() ? rawLabel.trim() : null;
    if (!label) return;
    const current = totals.get(label) ?? { count: 0, weight: 0 };
    current.count += 1;
    current.weight += getPointWeight(point);
    totals.set(label, current);
  });
  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, ...value }))
    .sort((a, b) => b.weight - a.weight);
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readFiniteNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const readString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const filterDisplayValue = (value: unknown): string | undefined => {
  const values = (Array.isArray(value) ? value : [value])
    .map((item) => (typeof item === 'string' || typeof item === 'number' ? String(item).trim() : ''))
    .filter(Boolean);
  return values.length > 0 ? values.join(', ') : undefined;
};

const OPERATIONS_FILTER_LABELS: Record<string, string> = {
  category: 'Categorías',
  categoria: 'Categorías',
  status: 'Estados',
  estado: 'Estados',
  zone: 'Zona',
  zona: 'Zona',
  barrio: 'Barrio',
  distrito: 'Distrito',
  gender: 'Género',
  genero: 'Género',
  age_range: 'Edad',
  rango_edad: 'Edad',
  sla_state: 'SLA',
  assignee_id: 'Responsable',
  source: 'Fuente',
  channel: 'Canal',
};

const bucketCount = (item?: OperationsBucketItem): number =>
  Math.max(0, readFiniteNumber(item?.count, item?.total, item?.value) ?? 0);

const operationPointToLegacyHeatPoint = (
  value: OperationsHeatmapPoint | OperationsBucketItem,
  index: number,
): HeatPoint | null => {
  const record = asRecord(value);
  if (!record) return null;
  const lat = readFiniteNumber(record.lat, record.latitude, record.centroid_lat);
  const lng = readFiniteNumber(record.lng, record.lon, record.longitude, record.centroid_lng, record.centroid_lon);
  if (lat === undefined || lng === undefined) return null;

  return {
    id: readFiniteNumber(record.id) ?? index + 1,
    lat,
    lng,
    weight: Math.max(1, readFiniteNumber(record.weight, record.count, record.total) ?? 1),
    categoria: readString(record.categoria, record.category),
    estado: readString(record.estado, record.status),
    barrio: readString(record.barrio, record.zone, record.zona),
    distrito: readString(record.distrito),
    ciudad: readString(record.ciudad, record.city, record.localidad),
    canal: readString(record.canal, record.channel),
    fuente: readString(record.fuente, record.source, record.layer),
    severidad: readString(record.severidad, record.severity),
  };
};

const heatPointsFromOperations = (heatmap: OperationsHeatmapV1): HeatPoint[] => {
  const exactPoints = heatmap.points
    .map(operationPointToLegacyHeatPoint)
    .filter((point): point is HeatPoint => Boolean(point));
  if (exactPoints.length > 0) return exactPoints;
  return heatmap.cells
    .map(operationPointToLegacyHeatPoint)
    .filter((point): point is HeatPoint => Boolean(point));
};

const chartsFromOperations = (heatmap: OperationsHeatmapV1): TicketStatsResponse['charts'] => {
  const chartSpecs = [
    ['Por estado', heatmap.segments?.status, false],
    ['Por categoría', heatmap.segments?.category, false],
    ['Por zona', heatmap.segments?.zone, true],
  ] as const;

  return chartSpecs.flatMap(([title, items, requiresPublishedZone]) => {
    const data = (items ?? []).reduce<Record<string, number>>((accumulator, item) => {
      const label = readString(item.label, item.key) ?? 'Sin dato';
      const normalizedLabel = label.trim().toLowerCase().replace(/_/g, ' ');
      const count = bucketCount(item);
      if (
        count <= 0 ||
        (requiresPublishedZone && ['sin zona', 'unknown', 'sin dato'].includes(normalizedLabel))
      ) {
        return accumulator;
      }
      accumulator[label] = (accumulator[label] ?? 0) + count;
      return accumulator;
    }, {});
    return Object.keys(data).length > 0 ? [{ title, data }] : [];
  });
};

const isLegacyCompatibilityError = (error: unknown): error is ApiError =>
  error instanceof ApiError && LEGACY_COMPATIBILITY_STATUSES.has(error.status);

const ageBucketsForRange = (minimum?: string, maximum?: string): string | undefined => {
  const min = readFiniteNumber(minimum);
  const max = readFiniteNumber(maximum);
  if (min === undefined && max === undefined) return undefined;
  const lower = min ?? 0;
  const upper = max ?? Number.POSITIVE_INFINITY;
  const buckets = [
    { key: 'menor_18', min: 0, max: 17 },
    { key: '18_24', min: 18, max: 24 },
    { key: '25_34', min: 25, max: 34 },
    { key: '35_44', min: 35, max: 44 },
    { key: '45_59', min: 45, max: 59 },
    { key: '60_plus', min: 60, max: Number.POSITIVE_INFINITY },
  ];
  const selected = buckets
    .filter((bucket) => bucket.max >= lower && bucket.min <= upper)
    .map((bucket) => bucket.key);
  return selected.length > 0 ? selected.join(',') : undefined;
};

const getExplicitTerritoryLabel = (point: HeatPoint): string | null => {
  const value = [point.barrio, point.distrito, point.ciudad].find(
    (candidate) => typeof candidate === 'string' && candidate.trim().length > 0,
  );
  return typeof value === 'string' ? value.trim() : null;
};

type TerritoryDataQuality = {
  coordinatePoints: number;
  classifiedPoints: number;
  pendingClassification: number;
  coveragePercent: number;
  state: 'complete' | 'partial' | 'missing';
};

const summarizeTerritoryDataQuality = (points: HeatPoint[]): TerritoryDataQuality => {
  const coordinatePoints = points.filter(
    (point) => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)),
  );
  const classifiedPoints = coordinatePoints.filter((point) => getExplicitTerritoryLabel(point)).length;
  const pendingClassification = coordinatePoints.length - classifiedPoints;
  const coveragePercent = coordinatePoints.length
    ? Math.round((classifiedPoints / coordinatePoints.length) * 100)
    : 0;

  return {
    coordinatePoints: coordinatePoints.length,
    classifiedPoints,
    pendingClassification,
    coveragePercent,
    state:
      coordinatePoints.length === 0
        ? 'missing'
        : pendingClassification === 0
          ? 'complete'
          : classifiedPoints > 0
            ? 'partial'
            : 'missing',
  };
};

type TelemetryNode = {
  id: string;
  x: number;
  y: number;
  weight: number;
  label: string;
};

type HotZoneSummary = {
  label: string;
  count: number;
  weight: number;
};

const TELEMETRY_WIDTH = 760;
const TELEMETRY_HEIGHT = 430;

const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const buildTelemetryNodes = (points: HeatPoint[]): TelemetryNode[] => {
  const numericPoints = points
    .map((point, index) => ({
      point,
      index,
      lat: Number(point.lat),
      lng: Number(point.lng),
      weight: getPointWeight(point),
    }))
    .filter(({ lat, lng }) => Number.isFinite(lat) && Number.isFinite(lng))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 18);

  if (!numericPoints.length) return [];

  const lats = numericPoints.map((item) => item.lat);
  const lngs = numericPoints.map((item) => item.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(0.0001, maxLat - minLat);
  const lngSpan = Math.max(0.0001, maxLng - minLng);

  return numericPoints.map(({ point, index, lat, lng, weight }) => {
    const x = 72 + ((lng - minLng) / lngSpan) * (TELEMETRY_WIDTH - 144);
    const y = 64 + (1 - (lat - minLat) / latSpan) * (TELEMETRY_HEIGHT - 128);
    return {
      id: String(point.id ?? point.ticket ?? point.cellId ?? point.clusterId ?? index),
      x: clampNumber(x, 48, TELEMETRY_WIDTH - 48),
      y: clampNumber(y, 44, TELEMETRY_HEIGHT - 44),
      weight,
      label: getExplicitTerritoryLabel(point) ?? `Punto ${index + 1}`,
    };
  });
};

const buildTelemetryRoute = (nodes: TelemetryNode[]) => {
  const routeNodes = nodes.slice(0, 5);
  if (routeNodes.length < 2) return '';
  const [first, ...rest] = routeNodes;
  return rest.reduce((path, node, index) => {
    const previous = routeNodes[index];
    const controlX = (previous.x + node.x) / 2;
    const controlY = Math.min(previous.y, node.y) - 46 - index * 10;
    return `${path} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${node.x.toFixed(1)} ${node.y.toFixed(1)}`;
  }, `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`);
};

function IncidentsTelemetryOverlay({
  points,
  hotZones,
  totalWeight,
  territoryQuality,
  showHeatmap,
  isLoading,
}: {
  points: HeatPoint[];
  hotZones: HotZoneSummary[];
  totalWeight: number;
  territoryQuality: TerritoryDataQuality;
  showHeatmap: boolean;
  isLoading: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();
  const reactId = useId().replace(/:/g, '');
  const gridId = `${reactId}-grid`;
  const heatGradientId = `${reactId}-heat`;
  const routeGradientId = `${reactId}-route`;
  const nodes = useMemo(() => buildTelemetryNodes(points), [points]);
  const routePath = useMemo(() => buildTelemetryRoute(nodes), [nodes]);
  const focusNode = nodes[0];
  const statusLabel = isLoading
    ? 'Actualizando vista territorial'
    : nodes.length
      ? `${nodes.length} ubicaciones visibles`
      : 'Esperando coordenadas';

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[6] overflow-hidden"
      data-testid="incidents-telemetry-overlay"
      aria-hidden="true"
    >
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${TELEMETRY_WIDTH} ${TELEMETRY_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <defs>
          <pattern id={gridId} width="38" height="38" patternUnits="userSpaceOnUse">
            <path d="M 38 0 L 0 0 0 38" fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="1" />
          </pattern>
          <radialGradient id={heatGradientId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(251,191,36,0.54)" />
            <stop offset="48%" stopColor="rgba(14,165,233,0.22)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0)" />
          </radialGradient>
          <linearGradient id={routeGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="52%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>

        <rect width="100%" height="100%" fill={`url(#${gridId})`} opacity="0.75" />
        <rect width="100%" height="100%" fill="rgba(2,6,23,0.14)" />

        {focusNode ? (
          <g transform={`translate(${focusNode.x} ${focusNode.y})`}>
            <circle r="118" fill={`url(#${heatGradientId})`} opacity={showHeatmap ? 0.62 : 0.28} />
            <circle r="42" fill="none" stroke="rgba(34,211,238,0.42)" strokeWidth="1.4">
              {!shouldReduceMotion ? (
                <>
                  <animate attributeName="r" values="42;92;42" dur="5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.72;0.08;0.72" dur="5s" repeatCount="indefinite" />
                </>
              ) : null}
            </circle>
            <g opacity="0.62">
              <line x1="-96" x2="96" y1="0" y2="0" stroke="rgba(125,211,252,0.55)" strokeWidth="1" />
              <line x1="0" x2="0" y1="-96" y2="96" stroke="rgba(125,211,252,0.55)" strokeWidth="1" />
              {!shouldReduceMotion ? (
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0"
                  to="360"
                  dur="13s"
                  repeatCount="indefinite"
                />
              ) : null}
            </g>
          </g>
        ) : null}

        {routePath ? (
          <g>
            <path
              id={`${reactId}-path`}
              d={routePath}
              fill="none"
              stroke={`url(#${routeGradientId})`}
              strokeDasharray="8 10"
              strokeLinecap="round"
              strokeWidth="3"
              opacity="0.78"
            />
            {!shouldReduceMotion ? (
              <circle r="5" fill="#f8fafc" stroke="#22d3ee" strokeWidth="2">
                <animateMotion dur="7s" repeatCount="indefinite" rotate="auto">
                  <mpath href={`#${reactId}-path`} />
                </animateMotion>
              </circle>
            ) : null}
          </g>
        ) : null}

        {nodes.map((node, index) => {
          const radius = clampNumber(7 + node.weight * 0.8, 8, 26);
          return (
            <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
              <circle r={radius + 10} fill="#f59e0b" opacity="0.08">
                {!shouldReduceMotion ? (
                  <>
                    <animate attributeName="r" values={`${radius + 8};${radius + 26};${radius + 8}`} dur={`${4 + index * 0.25}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.24;0.04;0.24" dur={`${4 + index * 0.25}s`} repeatCount="indefinite" />
                  </>
                ) : null}
              </circle>
              <circle r={radius} fill={index === 0 ? '#fbbf24' : '#38bdf8'} opacity="0.9" />
              <circle r={Math.max(3, radius / 2.8)} fill="#020617" opacity="0.72" />
            </g>
          );
        })}
      </svg>

      <div className="absolute right-3 top-3 hidden w-[180px] rounded-xl border border-white/15 bg-slate-950/82 p-2.5 text-white shadow-2xl backdrop-blur md:block">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-100/80">
          <Radio className="h-4 w-4" />
          Estado territorial
        </div>
        <p className="mt-1.5 text-sm font-semibold leading-tight">{statusLabel}</p>
        <div className="mt-2 grid gap-1.5 text-[11px]">
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2">
            <span className="block text-white/55">Peso total</span>
            <strong>{formatNumber(totalWeight)}</strong>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2">
            <span className="block text-white/55">
              {hotZones[0] ? 'Zona principal' : 'Calidad territorial'}
            </span>
            <strong className="block truncate">
              {hotZones[0]
                ? formatMapLabel(hotZones[0].label)
                : `${formatNumber(territoryQuality.pendingClassification)} sin zona publicada`}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface IncidentsMapProps {
  tenantSlugOverride?: string | null;
}

export default function IncidentsMap({ tenantSlugOverride }: IncidentsMapProps = {}) {
  useRequireRole(['admin', 'super_admin'] as Role[]);
  const { user } = useUser();
  const canonicalTenantSlug = useMemo(
    () =>
      normalizeProfileTenantSlug(tenantSlugOverride) ||
      normalizeProfileTenantSlug(
        user?.tenantSlug ||
          (user as any)?.tenant_slug ||
          (user as any)?.tenant?.slug ||
          (user as any)?.tenant?.tenant_slug,
      ),
    [tenantSlugOverride, user],
  );

  const parseCoordinate = (value: unknown): number | undefined => {
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  };

  const adminCoords = useMemo(() => {
    const lat = parseCoordinate(user?.latitud);
    const lng = parseCoordinate(user?.longitud);
    if (lat === undefined || lng === undefined) {
      return undefined;
    }
    return [lng, lat] as [number, number];
  }, [user?.latitud, user?.longitud]);

  const [heatmapData, setHeatmapData] = useState<HeatPoint[]>([]);
  const [operationsHeatmap, setOperationsHeatmap] = useState<OperationsHeatmapV1 | null>(null);
  const [heatmapContractSource, setHeatmapContractSource] = useState<HeatmapContractSource>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [center, setCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [charts, setCharts] = useState<TicketStatsResponse['charts']>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const initialDateRange = useMemo(() => dateValuesForRange('30d'), []);
  const [startDate, setStartDate] = useState(initialDateRange.start);
  const [endDate, setEndDate] = useState(initialDateRange.end);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedBarrio, setSelectedBarrio] = useState('');
  const [selectedGender, setSelectedGender] = useState('');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<IncidentMapFilters>(() =>
    defaultIncidentMapFilters(),
  );
  const [availableBarrios, setAvailableBarrios] = useState<string[]>([]);
  const [availableDistritos, setAvailableDistritos] = useState<string[]>([]);
  const [disableClustering, setDisableClustering] = useState(false);
  const [timeRange, setTimeRange] = useState<IncidentTimeRange>('30d');
  const { provider, setProvider } = useMapProvider();
  const handleProviderUnavailable = useCallback(
    (currentProvider: MapProvider, reason: MapProviderUnavailableReason, details?: unknown) => {
      console.warn('[IncidentsMap] Map provider unavailable, falling back to MapLibre', {
        provider: currentProvider,
        reason,
        details,
      });
      setProvider('maplibre');
    },
    [setProvider],
  );

  const [heatmapBounds, setHeatmapBounds] = useState<[number, number][]>([]);

  const operationsHeatmapCache = useRef<Map<string, OperationsHeatmapV1>>(new Map());
  const legacyHeatmapCache = useRef<Map<string, HeatmapDataset>>(new Map());
  const requestGeneration = useRef(0);

  const computeDisableClustering = useCallback((dataset: HeatmapDataset | null | undefined) => {
    if (!dataset) {
      return false;
    }

    const points = Array.isArray(dataset.points) ? dataset.points : [];
    if (!points.length) {
      return false;
    }

    if (Array.isArray(dataset.cells) && dataset.cells.length > 0) {
      return true;
    }

    const metadata = dataset.metadata?.map?.heatmap;
    if (metadata) {
      if (typeof metadata.cellCount === 'number' && metadata.cellCount > 0) {
        return true;
      }
      if (
        typeof metadata.pointCount === 'number' &&
        metadata.pointCount > points.length &&
        points.length > 0
      ) {
        return true;
      }
    }

    return points.some(
      (point) =>
        (typeof point.clusterSize === 'number' && point.clusterSize > 1) ||
        Boolean(point.clusterId) ||
        (Array.isArray(point.sampleTickets) && point.sampleTickets.length > 0) ||
        (Array.isArray(point.aggregatedCategorias) && point.aggregatedCategorias.length > 0) ||
        (Array.isArray(point.aggregatedEstados) && point.aggregatedEstados.length > 0) ||
        (Array.isArray(point.aggregatedTipos) && point.aggregatedTipos.length > 0) ||
        (Array.isArray(point.aggregatedBarrios) && point.aggregatedBarrios.length > 0) ||
        (Array.isArray(point.aggregatedSeveridades) && point.aggregatedSeveridades.length > 0),
    );
  }, []);

  const applyHeatmapDataset = useCallback(
    (dataset: HeatmapDataset, options?: { mergeFilters?: boolean; fallback?: boolean }) => {
      const points = dataset.points ?? [];
      setHeatmapData(points);
      setDisableClustering(computeDisableClustering(dataset));

      const barrios = Array.from(
        new Set(points.map((d) => d.barrio).filter((b): b is string => Boolean(b))),
      ).sort((a, b) => a.localeCompare(b));
      setAvailableBarrios(barrios);

      const distritos = Array.from(
        new Set(points.map((d) => d.distrito).filter((d): d is string => Boolean(d))),
      ).sort((a, b) => a.localeCompare(b));
      setAvailableDistritos(distritos);

      if (options?.mergeFilters) {
        const categoriesFromPoints = Array.from(
          new Set(points.map((d) => d.categoria).filter((c): c is string => Boolean(c))),
        );
        if (categoriesFromPoints.length > 0) {
          setCategories((prev) => mergeAndSortStrings(prev, categoriesFromPoints));
        }

        const statesFromPoints = Array.from(
          new Set(points.map((d) => d.estado).filter((s): s is string => Boolean(s))),
        );
        if (statesFromPoints.length > 0) {
          setStates((prev) => mergeAndSortStrings(prev, statesFromPoints));
        }
      }

      const mapMetadata = dataset.metadata?.map?.heatmap;
      if (mapMetadata?.bounds && mapMetadata.bounds.length === 4) {
        const [west, south, east, north] = mapMetadata.bounds;
        if (
          [west, south, east, north].every(
            (value) => typeof value === 'number' && Number.isFinite(value),
          )
        ) {
          setHeatmapBounds([
            [west, south],
            [east, north],
          ]);
        } else {
          setHeatmapBounds([]);
        }
      } else {
        setHeatmapBounds([]);
      }

      if (points.length > 0) {
        const totalWeight = points.reduce((sum, p) => sum + (p.weight ?? 1), 0);
        const divisor = totalWeight > 0 ? totalWeight : points.length;
        const avgLat = points.reduce((sum, p) => sum + p.lat * (p.weight ?? 1), 0) / divisor;
        const avgLng = points.reduce((sum, p) => sum + p.lng * (p.weight ?? 1), 0) / divisor;
        if (!Number.isNaN(avgLat) && !Number.isNaN(avgLng)) {
          setCenter({ lat: avgLat, lng: avgLng });
          return;
        }
      }

      if (mapMetadata?.centroid) {
        const [centroidLng, centroidLat] = mapMetadata.centroid;
        if (
          typeof centroidLat === 'number' &&
          typeof centroidLng === 'number' &&
          Number.isFinite(centroidLat) &&
          Number.isFinite(centroidLng)
        ) {
          setCenter({ lat: centroidLat, lng: centroidLng });
          return;
        }
      }

      if (adminCoords) {
        setCenter({ lat: adminCoords[1], lng: adminCoords[0] });
      }
    },
    [adminCoords, computeDisableClustering],
  );

  const applyOperationsHeatmap = useCallback(
    (heatmap: OperationsHeatmapV1) => {
      const points = heatPointsFromOperations(heatmap);
      const bounds = asRecord(heatmap.bounds);
      const west = readFiniteNumber(bounds?.west);
      const south = readFiniteNumber(bounds?.south);
      const east = readFiniteNumber(bounds?.east);
      const north = readFiniteNumber(bounds?.north);
      const hasBounds = [west, south, east, north].every(
        (value) => value !== undefined && Number.isFinite(value),
      );

      applyHeatmapDataset({
        points,
        metadata: hasBounds
          ? {
              map: {
                heatmap: {
                  bounds: [west!, south!, east!, north!],
                  pointCount: readFiniteNumber(heatmap.summary?.points) ?? points.length,
                  cellCount: readFiniteNumber(heatmap.summary?.cells) ?? heatmap.cells.length,
                },
              },
            }
          : undefined,
      });

      const categoryLabels = (heatmap.segments?.category ?? [])
        .map((item) => readString(item.label, item.key))
        .filter((value): value is string => Boolean(value));
      const stateLabels = (heatmap.segments?.status ?? [])
        .map((item) => readString(item.label, item.key))
        .filter((value): value is string => Boolean(value));
      if (categoryLabels.length > 0) {
        setCategories((current) => mergeAndSortStrings(current, categoryLabels));
      }
      if (stateLabels.length > 0) {
        setStates((current) => mergeAndSortStrings(current, stateLabels));
      }

      setCharts(chartsFromOperations(heatmap));
      setOperationsHeatmap(heatmap);
      setHeatmapContractSource('operations_v2');
    },
    [applyHeatmapDataset],
  );

  const setDateRange = useCallback((range: IncidentTimeRange) => {
    setTimeRange(range);
    const dates = dateValuesForRange(range);
    setStartDate(dates.start);
    setEndDate(dates.end);
  }, []);

  const draftFilters = useMemo<IncidentMapFilters>(
    () => ({
      fecha_inicio: sanitizeFilterValue(startDate),
      fecha_fin: sanitizeFilterValue(endDate),
      categoria: selectedCategories,
      estado: selectedStates,
      distrito: sanitizeFilterValue(selectedDistrict),
      barrio: sanitizeFilterValue(selectedBarrio),
      genero: sanitizeFilterValue(selectedGender),
      edad_min: sanitizeFilterValue(ageMin),
      edad_max: sanitizeFilterValue(ageMax),
    }),
    [
      ageMax,
      ageMin,
      endDate,
      selectedBarrio,
      selectedCategories,
      selectedDistrict,
      selectedGender,
      selectedStates,
      startDate,
    ],
  );

  const applyDraftFilters = useCallback(() => {
    setAppliedFilters({
      ...draftFilters,
      categoria: [...draftFilters.categoria],
      estado: [...draftFilters.estado],
    });
  }, [draftFilters]);

  const clearFilters = useCallback(() => {
    const dates = dateValuesForRange('30d');
    setTimeRange('30d');
    setStartDate(dates.start);
    setEndDate(dates.end);
    setSelectedCategories([]);
    setSelectedStates([]);
    setSelectedDistrict('');
    setSelectedBarrio('');
    setSelectedGender('');
    setAgeMin('');
    setAgeMax('');
    setAppliedFilters({
      fecha_inicio: dates.start,
      fecha_fin: dates.end,
      categoria: [],
      estado: [],
    });
  }, []);

  const expandToNinetyDays = useCallback(() => {
    const dates = dateValuesForRange('90d');
    setTimeRange('90d');
    setStartDate(dates.start);
    setEndDate(dates.end);
    setAppliedFilters((current) => ({
      ...current,
      fecha_inicio: dates.start,
      fecha_fin: dates.end,
    }));
  }, []);

  const ticketType = useMemo(() => (user?.tipo_chat === 'pyme' ? 'pyme' : 'municipio'), [user]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    const generation = ++requestGeneration.current;
    const isCurrentRequest = () => requestGeneration.current === generation;
    setIsLoading(true);
    setError(null);

    try {
      const filters = appliedFilters;
      const heatmapKey = buildHeatmapCacheKey({
        ...filters,
        tipo: ticketType,
        tenant_slug: canonicalTenantSlug || undefined,
      });
      const operationsCache = operationsHeatmapCache.current;

      try {
        const operations = !forceRefresh && operationsCache.has(heatmapKey)
          ? operationsCache.get(heatmapKey)!
          : await getOperationsHeatmapV2({
              tenantSlug: canonicalTenantSlug || undefined,
              from: filters.fecha_inicio,
              to: filters.fecha_fin,
              categoria: filters.categoria.length > 0 ? filters.categoria.join(',') : undefined,
              estado: filters.estado.length > 0 ? filters.estado.join(',') : undefined,
              zone: [filters.barrio, filters.distrito].filter(Boolean).join(',') || undefined,
              genero: filters.genero,
              age_range: ageBucketsForRange(filters.edad_min, filters.edad_max),
              include_ai: 0,
            });

        operationsCache.set(heatmapKey, operations);
        if (operationsCache.size > HEATMAP_CACHE_LIMIT) {
          const firstKey = operationsCache.keys().next().value;
          if (firstKey) operationsCache.delete(firstKey);
        }
        if (!isCurrentRequest()) return;
        applyOperationsHeatmap(operations);
        return;
      } catch (operationsError) {
        if (!isCurrentRequest()) return;
        if (!isLegacyCompatibilityError(operationsError)) throw operationsError;
      }

      const legacyCache = legacyHeatmapCache.current;
      const heatmapPromise = !forceRefresh && legacyCache.has(heatmapKey)
        ? Promise.resolve(legacyCache.get(heatmapKey) ?? { points: [] })
        : getHeatmapDataset({
            tipo: ticketType,
            ...filters,
            tenant_slug: canonicalTenantSlug || undefined,
          }).then((data) => {
            legacyCache.set(heatmapKey, data);
            if (legacyCache.size > HEATMAP_CACHE_LIMIT) {
              const firstKey = legacyCache.keys().next().value;
              if (firstKey) legacyCache.delete(firstKey);
            }
            return data;
          });

      const [heatmapDatasetResult, stats] = await Promise.all([
        heatmapPromise,
        getTicketStats({
          tipo: ticketType,
          ...filters,
          tenant_slug: canonicalTenantSlug || undefined,
        }),
      ]);
      if (!isCurrentRequest()) return;
      const heatmapPoints = heatmapDatasetResult.points ?? [];
      const statsDataset = stats.heatmapDataset;
      const combinedHeatmap = heatmapPoints.length > 0
        ? heatmapPoints
        : statsDataset?.points ?? stats.heatmap ?? [];

      setOperationsHeatmap(null);
      setHeatmapContractSource('legacy_partial');
      setCharts(stats.charts || []);
      applyHeatmapDataset(
        heatmapPoints.length > 0
          ? heatmapDatasetResult
          : statsDataset && (statsDataset.points?.length ?? 0) > 0
            ? statsDataset
            : { points: combinedHeatmap, metadata: undefined },
        { mergeFilters: true, fallback: true },
      );
    } catch (err) {
      if (!isCurrentRequest()) return;
      const message =
        err instanceof ApiError ? err.message : 'Error al cargar datos del mapa';
      setError(message);
      setCharts([]);
      setOperationsHeatmap(null);
      setHeatmapContractSource(null);
      applyHeatmapDataset({ points: [] }, { mergeFilters: false, fallback: false });
      console.error('Error fetching map data:', err);
    } finally {
      if (isCurrentRequest()) setIsLoading(false);
    }
  }, [appliedFilters, applyHeatmapDataset, applyOperationsHeatmap, canonicalTenantSlug, ticketType]);

  useEffect(() => {
    void fetchData();
    return () => {
      requestGeneration.current += 1;
    };
  }, [fetchData]);

  useEffect(() => {
    const categoriesUrl = ticketType === 'pyme' ? '/pyme/categorias' : '/municipal/categorias';
    apiFetch<{ categorias: { nombre: string }[] }>(categoriesUrl, {
      sendEntityToken: true,
      tenantSlug: canonicalTenantSlug,
    })
      .then((data) => {
        const names = Array.isArray(data.categorias)
          ? data.categorias.map((c) => c.nombre)
          : [];
        setCategories(names);
      })
      .catch((err) => console.error('Error fetching categories:', err));
  }, [canonicalTenantSlug, ticketType]);

  useEffect(() => {
    const statesUrl = ticketType === 'pyme' ? '/pyme/estados' : '/municipal/estados';
    apiFetch<{ estados: { nombre: string }[] | string[] }>(statesUrl, {
      sendEntityToken: true,
      tenantSlug: canonicalTenantSlug,
    })
      .then((data) => {
        const raw = (data as any).estados;
        const names = Array.isArray(raw)
          ? raw.map((e: any) => (typeof e === 'string' ? e : e.nombre))
          : [];
        setStates(names);
      })
      .catch((err) => console.error('Error fetching states:', err));
  }, [canonicalTenantSlug, ticketType]);

  useEffect(() => {
    if (!center && adminCoords) {
      setCenter({ lat: adminCoords[1], lng: adminCoords[0] });
    }
  }, [adminCoords, center]);

  const handleLocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      });
    }
  };

  const legendText = [
    appliedFilters.categoria.length
      ? `Categorías: ${appliedFilters.categoria.join(', ')}`
      : 'Todas las categorías',
    appliedFilters.estado.length
      ? `Estados: ${appliedFilters.estado.join(', ')}`
      : 'Todos los estados',
  ].join(' | ');

  const mapInsights = useMemo(() => {
    if (operationsHeatmap && heatmapContractSource === 'operations_v2') {
      const summary = operationsHeatmap.summary ?? {};
      const quality = operationsHeatmap.quality ?? {};
      const toBreakdown = (items: OperationsBucketItem[] | undefined) =>
        (items ?? [])
          .map((item) => ({
            label: readString(item.label, item.key) ?? 'Sin dato',
            count: bucketCount(item),
            weight: bucketCount(item),
          }))
          .filter((item) => item.count > 0);
      const zones = toBreakdown(operationsHeatmap.segments?.zone).filter(
        (item) => !['sin_zona', 'sin zona', 'unknown'].includes(item.label.toLowerCase()),
      );
      const categories = toBreakdown(operationsHeatmap.segments?.category);
      const statesFromContract = toBreakdown(operationsHeatmap.segments?.status);
      const pointCount = Math.max(
        0,
        readFiniteNumber(summary.points, summary.aggregated_observations) ?? 0,
      );
      const totalTicketRecords = Math.max(
        0,
        readFiniteNumber(quality.total_ticket_records, pointCount) ?? pointCount,
      );
      const pointsWithCoordinates = Math.max(
        0,
        readFiniteNumber(quality.ticket_records_with_coordinates, quality.visible_points, pointCount) ?? pointCount,
      );
      const coveragePercent = Math.max(
        0,
        Math.min(
          100,
          readFiniteNumber(quality.coverage_percent, summary.coverage_percent) ??
            (totalTicketRecords > 0 ? (pointsWithCoordinates / totalTicketRecords) * 100 : 0),
        ),
      );
      const pendingClassification = Math.max(
        0,
        readFiniteNumber(
          quality.pending_geocode,
          quality.ticket_records_without_coordinates,
          summary.pending_geocode,
        ) ?? 0,
      );
      const territoryQuality: TerritoryDataQuality = {
        coordinatePoints: totalTicketRecords,
        classifiedPoints: pointsWithCoordinates,
        pendingClassification,
        coveragePercent: Math.round(coveragePercent),
        state:
          pointCount === 0
            ? 'missing'
            : coveragePercent >= 99.5
              ? 'complete'
              : coveragePercent > 0
                ? 'partial'
                : 'missing',
      };

      return {
        totalWeight: Math.max(0, readFiniteNumber(summary.aggregated_observations, summary.points) ?? pointCount),
        pointCount,
        cellCount: Math.max(0, readFiniteNumber(summary.cells) ?? 0),
        hotZones: zones.slice(0, 4),
        topCategory: categories[0],
        topState: statesFromContract[0],
        territoryQuality,
        classifiedTerritoryWeight: zones.reduce((sum, zone) => sum + zone.weight, 0),
        isEnterpriseContract: true,
      };
    }

    const totalWeight = heatmapData.reduce((sum, point) => sum + getPointWeight(point), 0);
    const weightedZones = buildWeightedBreakdown(
      heatmapData,
      getExplicitTerritoryLabel,
    );
    const weightedCategories = buildWeightedBreakdown(heatmapData, (point) => point.categoria);
    const weightedStates = buildWeightedBreakdown(heatmapData, (point) => point.estado);
    const territoryQuality = summarizeTerritoryDataQuality(heatmapData);
    const classifiedTerritoryWeight = weightedZones.reduce((sum, zone) => sum + zone.weight, 0);

    return {
      totalWeight,
      pointCount: heatmapData.length,
      hotZones: weightedZones.slice(0, 4),
      topCategory: weightedCategories[0],
      topState: weightedStates[0],
      territoryQuality,
      classifiedTerritoryWeight,
      cellCount: 0,
      isEnterpriseContract: false,
    };
  }, [heatmapContractSource, heatmapData, operationsHeatmap]);

  const activeFilterCount = [
    appliedFilters.categoria.length,
    appliedFilters.estado.length,
    appliedFilters.distrito ? 1 : 0,
    appliedFilters.barrio ? 1 : 0,
    appliedFilters.genero ? 1 : 0,
    appliedFilters.edad_min || appliedFilters.edad_max ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  const premiumActiveFilters = useMemo(() => {
    if (heatmapContractSource === 'operations_v2' && operationsHeatmap?.applied_filters) {
      return Object.entries(operationsHeatmap.applied_filters)
        .map(([key, value]) => {
          const displayValue = filterDisplayValue(value);
          return displayValue
            ? { key, label: OPERATIONS_FILTER_LABELS[key] ?? formatMapLabel(key), value: displayValue }
            : null;
        })
        .filter((item): item is { key: string; label: string; value: string } => Boolean(item));
    }

    return [
      appliedFilters.categoria.length
        ? { key: 'category', label: 'Categorías', value: appliedFilters.categoria.join(', ') }
        : null,
      appliedFilters.estado.length
        ? { key: 'status', label: 'Estados', value: appliedFilters.estado.join(', ') }
        : null,
      appliedFilters.barrio
        ? { key: 'barrio', label: 'Barrio', value: appliedFilters.barrio }
        : null,
      appliedFilters.distrito
        ? { key: 'district', label: 'Distrito', value: appliedFilters.distrito }
        : null,
      appliedFilters.genero
        ? { key: 'gender', label: 'Género', value: appliedFilters.genero }
        : null,
      appliedFilters.edad_min || appliedFilters.edad_max
        ? {
            key: 'age_range',
            label: 'Edad',
            value: `${appliedFilters.edad_min || '0'}–${appliedFilters.edad_max || 'más'}`,
          }
        : null,
    ].filter((item): item is { key: string; label: string; value: string } => Boolean(item));
  }, [appliedFilters, heatmapContractSource, operationsHeatmap?.applied_filters]);

  const premiumMapConfig = useMemo<PublicMapConfigV1>(
    () => ({ provider }),
    [provider],
  );

  const operationsPrivacyLabel = operationsHeatmap?.privacy?.mode
    ? formatMapLabel(operationsHeatmap.privacy.mode)
    : 'Sin modo declarado';
  const operationsDataProvenance = useMemo(
    () => resolveTerritoryDataProvenance(operationsHeatmap, false, operationsHeatmap?.points ?? []),
    [operationsHeatmap],
  );
  const operationsTrustLabel =
    operationsDataProvenance.state === 'real'
      ? 'Datos territoriales verificados'
      : operationsDataProvenance.state === 'synthetic' || operationsDataProvenance.state === 'demo'
        ? 'Datos de demostración declarados'
        : 'Datos disponibles sin validación completa';
  const syntheticResponsesExcluded = readFiniteNumber(
    operationsHeatmap?.response_provenance?.synthetic_responses_excluded,
  );
  const operationsKMin = readFiniteNumber(
    operationsHeatmap?.privacy?.k_min,
    operationsHeatmap?.privacy?.minimum_sample_size,
  );
  const operationsPrecision = readFiniteNumber(
    operationsHeatmap?.privacy?.coordinate_precision_decimals,
  );
  const operationsSuppressed = asRecord(operationsHeatmap?.privacy?.suppressed);
  const operationsSuppressedRecords = readFiniteNumber(
    operationsSuppressed?.records,
    operationsHeatmap?.summary?.suppressed_records,
  );
  const operationsSuppressedCells = readFiniteNumber(
    operationsSuppressed?.cells,
    operationsSuppressed?.low_cardinality_cells,
    operationsHeatmap?.summary?.suppressed_cells,
  );
  const hasRenderableMapData =
    heatmapContractSource === 'operations_v2'
      ? operationsHeatmap?.render_contract?.can_render_heatmap !== undefined
        ? operationsHeatmap.render_contract.can_render_heatmap
        : Boolean(
            operationsHeatmap?.points.length ||
              operationsHeatmap?.cells.length ||
              operationsHeatmap?.geo_layers?.points?.features.length ||
              operationsHeatmap?.geo_layers?.cells?.features.length,
          )
      : heatmapData.length > 0;

  const mapKpis = [
    {
      label: 'Volumen ponderado',
      value: formatNumber(mapInsights.totalWeight),
      detail: formatCountLabel(mapInsights.pointCount, 'punto', 'puntos'),
      icon: Activity,
    },
    {
      label: 'Cobertura territorial',
      value: mapInsights.isEnterpriseContract
        ? `${formatNumber(mapInsights.territoryQuality.coveragePercent)}%`
        : `${formatNumber(mapInsights.territoryQuality.classifiedPoints)}/${formatNumber(mapInsights.territoryQuality.coordinatePoints)}`,
      detail: mapInsights.isEnterpriseContract
        ? formatCountLabel(
            mapInsights.territoryQuality.pendingClassification,
            'ubicación pendiente',
            'ubicaciones pendientes',
          )
        : `${formatNumber(mapInsights.territoryQuality.coveragePercent)}% con zona explícita`,
      icon: Layers,
    },
    {
      label: mapInsights.hotZones[0] ? 'Zona prioritaria' : 'Calidad de datos',
      value: mapInsights.hotZones[0]
        ? formatMapLabel(mapInsights.hotZones[0].label)
        : mapInsights.isEnterpriseContract && mapInsights.cellCount > 0
          ? `${formatNumber(mapInsights.cellCount)} ${mapInsights.cellCount === 1 ? 'celda segura' : 'celdas seguras'}`
          : `${formatNumber(mapInsights.territoryQuality.pendingClassification)} pendientes`,
      detail: mapInsights.hotZones[0]
        ? formatCountLabel(mapInsights.hotZones[0].weight, 'reporte', 'reportes')
        : 'Con GPS, sin barrio, zona o localidad',
      icon: Flame,
    },
    {
      label: 'Estado dominante',
      value: formatMapLabel(mapInsights.topState?.label),
      detail: mapInsights.topCategory
        ? `Categoría: ${formatMapLabel(mapInsights.topCategory.label)}`
        : 'Sin categoría',
      icon: AlertCircle,
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Inteligencia territorial CRM
          </p>
          <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
            Mapa operativo de reclamos y demanda territorial
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Priorización por zona, categoría, estado y actividad reciente sobre el mapa operativo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border bg-background px-3 py-1">
            {activeFilterCount > 0 ? `${activeFilterCount} filtros activos` : 'Sin filtros activos'}
          </span>
          <span className="rounded-full border border-border bg-background px-3 py-1">
            {heatmapContractSource === 'operations_v2'
              ? operationsTrustLabel
              : showHeatmap
                ? 'Capa calor activa'
                : 'Puntos agrupados'}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {mapKpis.map(({ label, value, detail, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-2 truncate text-2xl font-bold text-foreground">{value}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
              </div>
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <Icon className="h-4 w-4" />
              </span>
            </div>
          </div>
        ))}
      </div>

      <section
        className="rounded-2xl border border-border/70 bg-card/95 p-3 shadow-sm"
        data-testid="incidents-filter-command"
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <SlidersHorizontal className="h-4 w-4" />
              Filtros operativos
            </span>
            {heatmapContractSource === 'legacy_partial' ? (
              <button
                type="button"
                onClick={() => setShowHeatmap((value) => !value)}
                className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition ${
                  showHeatmap
                    ? 'border-amber-300/50 bg-amber-400/15 text-amber-700 dark:text-amber-100'
                    : 'border-border bg-background text-muted-foreground'
                }`}
              >
                <Flame className="h-4 w-4" />
                {showHeatmap ? 'Densidad activa' : 'Solo puntos'}
              </button>
            ) : (
              <span className="inline-flex h-9 items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 text-sm font-medium text-primary">
                <Layers className="h-4 w-4" />
                Capas de análisis disponibles
              </span>
            )}
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              <span>Vista</span>
              <MapProviderToggle
                value={provider}
                onChange={setProvider}
                size="sm"
                ariaLabel="Proveedor cartográfico"
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-[180px_auto_auto] xl:min-w-[520px]">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Rango rápido</label>
                <select
                  className="mt-1 block w-full px-3 py-2 bg-input border-border text-foreground rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  value={timeRange}
                  onChange={(e) => setDateRange(e.target.value as typeof timeRange)}
                >
                  <option value="7d">Últimos 7 días</option>
                  <option value="30d">Últimos 30 días</option>
                  <option value="90d">Últimos 90 días</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
            <Button
              onClick={applyDraftFilters}
              disabled={isLoading}
              className="h-10 gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Aplicando' : 'Aplicar'}
            </Button>
            <Button onClick={handleLocate} disabled={isLoading} variant="outline" className="h-10 gap-2">
              <LocateFixed className="h-4 w-4" />
              Mi zona
            </Button>
          </div>
        </div>

        <details className="group mt-3 rounded-xl border border-dashed border-border/70 bg-muted/25">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-foreground">
            <span className="inline-flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Filtros avanzados y segmentación
            </span>
            <span className="text-xs font-medium text-muted-foreground group-open:hidden">
              Categoría, estado, ubicación, edad y género
            </span>
            <span className="hidden text-xs font-medium text-muted-foreground group-open:inline">
              Ocultar filtros avanzados
            </span>
          </summary>
          <div className="grid grid-cols-1 gap-3 border-t border-border/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-muted-foreground mb-1">
                  Fecha Inicio
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-input border-border text-foreground rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  disabled={timeRange !== 'custom'}
                />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-muted-foreground mb-1">
                  Fecha Fin
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-input border-border text-foreground rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  disabled={timeRange !== 'custom'}
                />
              </div>
              <div>
                <span className="block text-sm font-medium text-muted-foreground mb-1">
                  Categorías
                </span>
                <div className="mt-1 max-h-40 overflow-y-auto px-3 py-2 bg-input border border-border text-foreground rounded-md shadow-sm">
                  {categories.map((c) => (
                    <div key={c} className="flex items-center space-x-2">
                      <Checkbox
                        id={`cat-${c}`}
                        checked={selectedCategories.includes(c)}
                        onCheckedChange={(checked) =>
                          setSelectedCategories((prev) =>
                            checked ? [...prev, c] : prev.filter((x) => x !== c),
                          )
                        }
                      />
                      <label htmlFor={`cat-${c}`} className="text-sm font-medium">
                        {c}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <span className="block text-sm font-medium text-muted-foreground mb-1">
                  Estados
                </span>
                <div className="mt-1 max-h-40 overflow-y-auto px-3 py-2 bg-input border border-border text-foreground rounded-md shadow-sm">
                  {states.map((s) => (
                    <div key={s} className="flex items-center space-x-2">
                      <Checkbox
                        id={`state-${s}`}
                        checked={selectedStates.includes(s)}
                        onCheckedChange={(checked) =>
                          setSelectedStates((prev) =>
                            checked ? [...prev, s] : prev.filter((x) => x !== s),
                          )
                        }
                      />
                      <label htmlFor={`state-${s}`} className="text-sm font-medium capitalize">
                        {s.replace(/_/g, ' ')}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="barrio" className="block text-sm font-medium text-muted-foreground mb-1">
                  Barrio
                </label>
                <select
                  id="barrio"
                  value={selectedBarrio}
                  onChange={(event) => setSelectedBarrio(event.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-input border-border text-foreground rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                >
                  <option value="">Todos</option>
                  {availableBarrios.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="district" className="block text-sm font-medium text-muted-foreground mb-1">
                  Distrito
                </label>
                <select
                  id="district"
                  value={selectedDistrict}
                  onChange={(event) => setSelectedDistrict(event.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-input border-border text-foreground rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                >
                  <option value="">Todos</option>
                  {availableDistritos.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="gender" className="block text-sm font-medium text-muted-foreground mb-1">
                  Género
                </label>
                <select
                  id="gender"
                  value={selectedGender}
                  onChange={(event) => setSelectedGender(event.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-input border-border text-foreground rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                >
                  <option value="">Todos</option>
                  <option value="F">Femenino</option>
                  <option value="M">Masculino</option>
                  <option value="X">Otro</option>
                </select>
              </div>
              <div>
                <label htmlFor="ageMin" className="block text-sm font-medium text-muted-foreground mb-1">
                  Edad mínima
                </label>
                <input
                  type="number"
                  id="ageMin"
                  value={ageMin}
                  onChange={(event) => setAgeMin(event.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-input border-border text-foreground rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                />
              </div>
              <div>
                <label htmlFor="ageMax" className="block text-sm font-medium text-muted-foreground mb-1">
                  Edad máxima
                </label>
                <input
                  type="number"
                  id="ageMax"
                  value={ageMax}
                  onChange={(event) => setAgeMax(event.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-input border-border text-foreground rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                />
              </div>
              <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:col-span-2 sm:flex-row sm:justify-end lg:col-span-4">
                <Button type="button" variant="ghost" onClick={clearFilters} disabled={isLoading}>
                  Limpiar filtros
                </Button>
                <Button type="button" onClick={applyDraftFilters} disabled={isLoading} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? 'Aplicando filtros' : 'Aplicar filtros'}
                </Button>
              </div>
            </div>
        </details>
      </section>

      {error ? (
        <Alert
          role="alert"
          data-testid="incidents-map-error"
          variant="default"
          className="border-destructive/30 bg-destructive/10 text-destructive"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No pudimos cargar el mapa</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{error}</p>
            <Button type="button" variant="outline" onClick={() => void fetchData(true)}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading && !hasRenderableMapData ? (
        <div
          data-testid="incidents-map-loading"
          role="status"
          className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm"
        >
          <div className="space-y-3">
            <RefreshCw className="mx-auto h-7 w-7 animate-spin text-primary" aria-hidden="true" />
            <div>
              <p className="font-semibold text-foreground">Verificando cobertura territorial</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Recuperando coordenadas y metadatos publicados para esta vista.
              </p>
            </div>
          </div>
        </div>
      ) : !hasRenderableMapData ? (
        <Alert
          data-testid="incidents-map-empty"
          variant="default"
          className="border-border/60 bg-muted/30"
        >
          <MapPin className="h-4 w-4" />
          <AlertTitle>
            {operationsHeatmap?.map_narrative?.headline || 'No hay ubicaciones para esta vista'}
          </AlertTitle>
          <AlertDescription className="space-y-4">
            <p>
              {operationsHeatmap?.map_narrative?.body ||
                'No encontramos reclamos geocodificados con los filtros aplicados. Ampliá el período o limpiá la segmentación para recuperar cobertura.'}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={expandToNinetyDays}>
                Ampliar a 90 días
              </Button>
              <Button type="button" variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
              <Button type="button" variant="ghost" onClick={() => void fetchData(true)}>
                Reintentar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : heatmapContractSource === 'operations_v2' && operationsHeatmap ? (
        <>
          <div
            data-testid="operations-heatmap-evidence"
            className="rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-sm"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Calidad y privacidad de los datos</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {operationsDataProvenance.state === 'real'
                    ? 'Fuente operativa verificada'
                    : operationsDataProvenance.label}{' '}
                  · {operationsPrivacyLabel} ·{' '}
                  {Object.keys(operationsHeatmap.applied_filters ?? {}).length === 1
                    ? '1 filtro aplicado'
                    : `${Object.keys(operationsHeatmap.applied_filters ?? {}).length} filtros aplicados`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-medium">
                <span className="rounded-full border border-primary/20 bg-background px-3 py-1 text-foreground">
                  {operationsKMin !== undefined
                    ? `Privacidad protegida desde ${formatCountLabel(operationsKMin, 'caso', 'casos')}`
                    : 'Privacidad protegida'}
                </span>
                <span className="rounded-full border border-primary/20 bg-background px-3 py-1 text-foreground">
                  {syntheticResponsesExcluded !== undefined
                    ? formatCountLabel(
                        syntheticResponsesExcluded,
                        'respuesta simulada excluida',
                        'respuestas simuladas excluidas',
                      )
                    : 'Sin mezcla de datos simulados'}
                </span>
              </div>
            </div>
            <details className="mt-3 border-t border-primary/15 pt-3 text-xs text-muted-foreground">
              <summary className="w-fit cursor-pointer font-medium text-foreground transition hover:text-primary">
                Ver detalles técnicos de auditoría
              </summary>
              <div className="mt-3 flex flex-wrap gap-2" data-testid="operations-heatmap-audit-details">
                <span className="rounded-full border border-primary/20 bg-background px-3 py-1">
                  Contrato: {operationsHeatmap.contract_version || 'operations.heatmap.v1'}
                </span>
                <span className="rounded-full border border-primary/20 bg-background px-3 py-1">
                  Fuente: {operationsHeatmap.source_quality?.contract_version || 'no declarada'}
                </span>
                <span className="rounded-full border border-primary/20 bg-background px-3 py-1">
                  {operationsPrecision !== undefined
                    ? `Precisión: ${formatCountLabel(operationsPrecision, 'decimal', 'decimales')}`
                    : operationsHeatmap.privacy?.coordinate_precision
                      ? `Precisión: ${formatMapLabel(operationsHeatmap.privacy.coordinate_precision)}`
                      : 'Precisión: no declarada'}
                </span>
                <span className="rounded-full border border-primary/20 bg-background px-3 py-1">
                  Supresión: {operationsSuppressedRecords !== undefined || operationsSuppressedCells !== undefined
                    ? `${formatNumber(operationsSuppressedRecords ?? 0)} ${(operationsSuppressedRecords ?? 0) === 1 ? 'registro' : 'registros'} · ${formatNumber(operationsSuppressedCells ?? 0)} ${(operationsSuppressedCells ?? 0) === 1 ? 'celda' : 'celdas'}`
                    : operationsHeatmap.privacy?.suppressed === true
                      ? 'activa'
                      : operationsHeatmap.privacy?.suppressed === false
                        ? 'sin supresión declarada'
                        : 'no declarada'}
                </span>
                <span className="rounded-full border border-primary/20 bg-background px-3 py-1">
                  Procedencia: {operationsDataProvenance.label}
                </span>
              </div>
            </details>
          </div>
          <PremiumTerritoryHeatmap
            points={operationsHeatmap.points}
            heatmap={operationsHeatmap}
            labels={operationsHeatmap.ui?.labels}
            activeFilters={premiumActiveFilters}
            mapConfig={premiumMapConfig}
            minSampleSize={operationsHeatmap.privacy?.minimum_sample_size}
            allowDemoFallback={false}
            className="min-h-[560px]"
          />
        </>
      ) : (
      <>
      <Alert
        data-testid="legacy-heatmap-evidence"
        variant="default"
        className="border-amber-500/35 bg-amber-500/10"
      >
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Vista alternativa · evidencia parcial</AlertTitle>
        <AlertDescription>
          La fuente territorial avanzada todavía no está disponible en este entorno. La vista conserva
          los puntos publicados, pero no certifica privacidad, procedencia ni todos los filtros institucionales.
        </AlertDescription>
      </Alert>
      <div
        data-testid="territory-data-quality"
        className={`rounded-2xl border p-4 shadow-sm ${
          mapInsights.territoryQuality.state === 'complete'
            ? 'border-emerald-500/25 bg-emerald-500/10'
            : 'border-amber-500/30 bg-amber-500/10'
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={`mt-0.5 rounded-xl p-2 ${
                mapInsights.territoryQuality.state === 'complete'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
              }`}
            >
              <LocateFixed className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">
                {mapInsights.territoryQuality.state === 'complete'
                  ? 'Cobertura territorial completa'
                  : mapInsights.territoryQuality.state === 'partial'
                    ? 'Cobertura territorial parcial'
                    : 'Coordenadas disponibles; zonas pendientes'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatNumber(mapInsights.territoryQuality.classifiedPoints)} de{' '}
                {formatNumber(mapInsights.territoryQuality.coordinatePoints)} puntos tienen barrio,
                zona o localidad explícitos.{' '}
                {formatNumber(mapInsights.territoryQuality.pendingClassification)} quedan pendientes de
                enriquecimiento territorial.
              </p>
              {mapInsights.territoryQuality.pendingClassification > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  No se infieren barrios desde coordenadas ni categorías: requieren geocodificación
                  inversa o límites oficiales validados.
                </p>
              ) : null}
            </div>
          </div>
          <span className="w-fit shrink-0 rounded-full border border-current/15 bg-background/70 px-3 py-1 text-xs font-semibold text-foreground">
            {formatNumber(mapInsights.territoryQuality.coveragePercent)}% clasificado
          </span>
        </div>
      </div>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative min-h-[560px] overflow-hidden rounded-2xl border border-border bg-slate-950 shadow-xl">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(rgba(148,163,184,0.14)_1px,transparent_1px)] bg-[size:44px_44px]" />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(59,130,246,0.18),transparent_34%),linear-gradient(45deg,transparent_35%,rgba(245,158,11,0.12),transparent_62%)]" />
        <MapLibreMap
          provider={provider}
          center={center ? [center.lng, center.lat] : undefined}
          marker={center ? [center.lng, center.lat] : undefined}
          adminLocation={adminCoords}
          heatmapData={heatmapData}
          showHeatmap={showHeatmap}
          className="h-[560px] rounded-2xl sm:h-[680px]"
          fitToBounds={heatmapBounds.length === 2 ? heatmapBounds : undefined}
          onProviderUnavailable={handleProviderUnavailable}
          disableClientClustering={disableClustering}
          ariaLabel="Mapa operativo de reclamos y demanda territorial"
        />
        <IncidentsTelemetryOverlay
          points={heatmapData}
          hotZones={mapInsights.hotZones}
          totalWeight={mapInsights.totalWeight}
          territoryQuality={mapInsights.territoryQuality}
          showHeatmap={showHeatmap}
          isLoading={isLoading}
        />
        <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 grid gap-2 md:left-4 md:right-auto md:w-[420px]">
          <div className="rounded-xl border border-white/15 bg-slate-950/82 p-3 text-white shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-white/60">
                  Lectura territorial
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {mapInsights.hotZones[0]
                    ? formatMapLabel(mapInsights.hotZones[0].label)
                    : formatCountLabel(
                        mapInsights.territoryQuality.pendingClassification,
                        'punto sin zona publicada',
                        'puntos sin zona publicada',
                      )}
                </p>
              </div>
              <MapPin className="h-5 w-5 text-amber-300" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg bg-white/10 p-2">
                <span className="block text-white/55">Peso</span>
                <strong>{formatNumber(mapInsights.totalWeight)}</strong>
              </div>
              <div className="rounded-lg bg-white/10 p-2">
                <span className="block text-white/55">Puntos</span>
                <strong>{formatNumber(mapInsights.pointCount)}</strong>
              </div>
              <div className="rounded-lg bg-white/10 p-2">
                <span className="block text-white/55">Con zona</span>
                <strong>{formatNumber(mapInsights.territoryQuality.classifiedPoints)}</strong>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="rounded-xl bg-background/90 px-3 py-2 text-xs text-foreground shadow-lg backdrop-blur">
            {legendText}
          </div>
          <div className="rounded-xl bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur">
            {provider === 'google'
              ? 'Cartografía Google con respaldo automático'
              : 'Cartografía estándar'}
          </div>
        </div>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
            <p className="text-lg font-semibold text-foreground">Cargando datos en el mapa...</p>
          </div>
        )}
        </div>

        <aside className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {mapInsights.hotZones.length > 0 ? 'Zonas informadas' : 'Calidad territorial'}
              </p>
              <p className="text-xs text-muted-foreground">
                {mapInsights.hotZones.length > 0
                  ? 'Ordenadas por peso y dato territorial explícito.'
                  : 'Puntos visibles pendientes de barrio, zona o localidad.'}
              </p>
            </div>
            <Flame className="h-5 w-5 text-amber-500" />
          </div>
          <div className="mt-4 space-y-3">
            {mapInsights.territoryQuality.pendingClassification > 0 &&
            mapInsights.hotZones.length > 0 ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-foreground">
                <strong>
                  {formatCountLabel(
                    mapInsights.territoryQuality.pendingClassification,
                    'punto sin zona',
                    'puntos sin zona',
                  )}
                </strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  Se excluyen del ranking hasta contar con un dato territorial validado.
                </p>
              </div>
            ) : null}
            {mapInsights.hotZones.length > 0 ? (
              mapInsights.hotZones.map((zone, index) => {
                const pct =
                  mapInsights.classifiedTerritoryWeight > 0
                    ? Math.min(
                        100,
                        Math.round((zone.weight / mapInsights.classifiedTerritoryWeight) * 100),
                      )
                    : 0;
                return (
                  <div key={zone.label} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium">
                        {index + 1}. {formatMapLabel(zone.label)}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatNumber(zone.weight)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div
                data-testid="territory-enrichment-queue"
                className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground"
              >
                <strong>
                  {formatCountLabel(
                    mapInsights.territoryQuality.pendingClassification,
                    'candidato a enriquecimiento territorial',
                    'candidatos a enriquecimiento territorial',
                  )}
                </strong>
                <p className="mt-2 text-muted-foreground">
                  Los puntos tienen coordenadas, pero la fuente no publicó barrio, zona o localidad.
                  No se asignan nombres automáticamente.
                </p>
                <p className="mt-3 text-xs font-medium text-muted-foreground">
                  Próximo paso controlado: cruce con límites oficiales o geocodificación inversa
                  validada.
                </p>
              </div>
            )}
          </div>
        </aside>
      </section>
      </>
      )}
      <TicketStatsCharts
        charts={charts}
        sampleSize={Math.round(mapInsights.totalWeight)}
        contextLabel={mapInsights.totalWeight === 1 ? 'caso agregado' : 'casos agregados'}
        privacyFloor={heatmapContractSource === 'operations_v2' ? operationsKMin : undefined}
        privacySuppressed={operationsHeatmap?.privacy?.suppressed === true}
      />
    </div>
  );
}
