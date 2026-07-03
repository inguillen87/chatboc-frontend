import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import MapLibreMap from '@/components/LazyMapLibreMap';
import TicketStatsCharts from '@/components/TicketStatsCharts';
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

const formatMapLabel = (value?: string | null) => {
  if (!value) return 'Sin dato';
  return value.replace(/_/g, ' ');
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
      label: formatMapLabel(point.barrio || point.distrito || point.categoria || point.ticket || point.cellId),
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
  showHeatmap,
  isLoading,
}: {
  points: HeatPoint[];
  hotZones: HotZoneSummary[];
  totalWeight: number;
  showHeatmap: boolean;
  isLoading: boolean;
}) {
  const reactId = useId().replace(/:/g, '');
  const gridId = `${reactId}-grid`;
  const heatGradientId = `${reactId}-heat`;
  const routeGradientId = `${reactId}-route`;
  const nodes = useMemo(() => buildTelemetryNodes(points), [points]);
  const routePath = useMemo(() => buildTelemetryRoute(nodes), [nodes]);
  const focusNode = nodes[0];
  const statusLabel = isLoading
    ? 'Sincronizando telemetria territorial'
    : nodes.length
      ? `${nodes.length} nodos activos`
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
              <animate attributeName="r" values="42;92;42" dur="5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.72;0.08;0.72" dur="5s" repeatCount="indefinite" />
            </circle>
            <g opacity="0.62">
              <line x1="-96" x2="96" y1="0" y2="0" stroke="rgba(125,211,252,0.55)" strokeWidth="1" />
              <line x1="0" x2="0" y1="-96" y2="96" stroke="rgba(125,211,252,0.55)" strokeWidth="1" />
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0"
                to="360"
                dur="13s"
                repeatCount="indefinite"
              />
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
            <circle r="5" fill="#f8fafc" stroke="#22d3ee" strokeWidth="2">
              <animateMotion dur="7s" repeatCount="indefinite" rotate="auto">
                <mpath href={`#${reactId}-path`} />
              </animateMotion>
            </circle>
          </g>
        ) : null}

        {nodes.map((node, index) => {
          const radius = clampNumber(7 + node.weight * 0.8, 8, 26);
          return (
            <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
              <circle r={radius + 10} fill="#f59e0b" opacity="0.08">
                <animate attributeName="r" values={`${radius + 8};${radius + 26};${radius + 8}`} dur={`${4 + index * 0.25}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.24;0.04;0.24" dur={`${4 + index * 0.25}s`} repeatCount="indefinite" />
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
          Comando territorial
        </div>
        <p className="mt-1.5 text-sm font-semibold leading-tight">{statusLabel}</p>
        <div className="mt-2 grid gap-1.5 text-[11px]">
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2">
            <span className="block text-white/55">Peso total</span>
            <strong>{formatNumber(totalWeight)}</strong>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.06] p-2">
            <span className="block text-white/55">Top zona</span>
            <strong className="block truncate">{formatMapLabel(hotZones[0]?.label)}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IncidentsMap() {
  useRequireRole(['admin', 'super_admin'] as Role[]);
  const { user } = useUser();

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
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [center, setCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charts, setCharts] = useState<TicketStatsResponse['charts']>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [availableBarrios, setAvailableBarrios] = useState<string[]>([]);
  const [availableDistritos, setAvailableDistritos] = useState<string[]>([]);
  const [disableClustering, setDisableClustering] = useState(false);
  const [timeRange, setTimeRange] = useState<'custom' | '7d' | '30d' | '90d'>('30d');
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

  const heatmapCache = useRef<Map<string, HeatmapDataset>>(new Map());

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

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const districtRef = useRef<HTMLSelectElement>(null);
  const barrioRef = useRef<HTMLSelectElement>(null);
  const genderRef = useRef<HTMLSelectElement>(null);
  const ageMinRef = useRef<HTMLInputElement>(null);
  const ageMaxRef = useRef<HTMLInputElement>(null);

  const setDateRange = useCallback((range: 'custom' | '7d' | '30d' | '90d') => {
    setTimeRange(range);
    if (!startDateRef.current || !endDateRef.current) return;

    if (range === 'custom') {
      startDateRef.current.value = '';
      endDateRef.current.value = '';
      return;
    }

    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days);
    const start = startDate.toISOString().slice(0, 10);
    startDateRef.current.value = start;
    endDateRef.current.value = end;
  }, []);

  const ticketType = useMemo(() => (user?.tipo_chat === 'pyme' ? 'pyme' : 'municipio'), [user]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      if (timeRange !== 'custom') {
        setDateRange(timeRange);
      }

      const filters = {
        fecha_inicio: sanitizeFilterValue(startDateRef.current?.value),
        fecha_fin: sanitizeFilterValue(endDateRef.current?.value),
        categoria: selectedCategories,
        estado: selectedStates,
        distrito: sanitizeFilterValue(districtRef.current?.value),
        barrio: sanitizeFilterValue(barrioRef.current?.value),
        genero: sanitizeFilterValue(genderRef.current?.value),
        edad_min: sanitizeFilterValue(ageMinRef.current?.value),
        edad_max: sanitizeFilterValue(ageMaxRef.current?.value),
      };

      const heatmapKey = buildHeatmapCacheKey({
        ...filters,
        tipo: ticketType,
      });

      const cache = heatmapCache.current;
      const heatmapPromise = !forceRefresh && cache.has(heatmapKey)
        ? Promise.resolve(cache.get(heatmapKey) ?? { points: [] })
        : getHeatmapDataset({ tipo: ticketType, ...filters }).then((data) => {
            cache.set(heatmapKey, data);
            if (cache.size > HEATMAP_CACHE_LIMIT) {
              const firstKey = cache.keys().next().value;
              if (firstKey) {
                cache.delete(firstKey);
              }
            }
            return data;
          });

      const [heatmapDatasetResult, stats] = await Promise.all([
        heatmapPromise,
        getTicketStats({ tipo: ticketType, ...filters }),
      ]);
      setCharts(stats.charts || []);

      const heatmapPoints = heatmapDatasetResult.points ?? [];
      const statsDataset = stats.heatmapDataset;
      let combinedHeatmap = heatmapPoints.length > 0 ? heatmapPoints : statsDataset?.points ?? stats.heatmap ?? [];
      const usedFallback = combinedHeatmap.length === 0;

      if (usedFallback) {
        setError('No hay puntos de mapa disponibles con los filtros actuales.');
      }

      applyHeatmapDataset(
        heatmapPoints.length > 0
          ? heatmapDatasetResult
          : statsDataset && (statsDataset.points?.length ?? 0) > 0
            ? statsDataset
            : { points: combinedHeatmap, metadata: undefined },
        {
          mergeFilters: usedFallback,
          fallback: usedFallback,
        },
      );
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Error al cargar datos del mapa';
      setError(message);
      setCharts([]);
      applyHeatmapDataset({ points: [] }, { mergeFilters: false, fallback: false });
      console.error('Error fetching map data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ticketType, adminCoords, selectedCategories, selectedStates, applyHeatmapDataset, setDateRange, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setDateRange(timeRange);
  }, [setDateRange, timeRange]);

  useEffect(() => {
    const categoriesUrl = ticketType === 'pyme' ? '/pyme/categorias' : '/municipal/categorias';
    apiFetch<{ categorias: { nombre: string }[] }>(categoriesUrl, {
      sendEntityToken: true,
    })
      .then((data) => {
        const names = Array.isArray(data.categorias)
          ? data.categorias.map((c) => c.nombre)
          : [];
        setCategories(names);
      })
      .catch((err) => console.error('Error fetching categories:', err));
  }, [ticketType]);

  useEffect(() => {
    const statesUrl = ticketType === 'pyme' ? '/pyme/estados' : '/municipal/estados';
    apiFetch<{ estados: { nombre: string }[] | string[] }>(statesUrl, {
      sendEntityToken: true,
    })
      .then((data) => {
        const raw = (data as any).estados;
        const names = Array.isArray(raw)
          ? raw.map((e: any) => (typeof e === 'string' ? e : e.nombre))
          : [];
        setStates(names);
      })
      .catch((err) => console.error('Error fetching states:', err));
  }, [ticketType]);

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
    selectedCategories.length
      ? `Categorías: ${selectedCategories.join(', ')}`
      : 'Todas las categorías',
    selectedStates.length
      ? `Estados: ${selectedStates.join(', ')}`
      : 'Todos los estados',
  ].join(' | ');

  const mapInsights = useMemo(() => {
    const totalWeight = heatmapData.reduce((sum, point) => sum + getPointWeight(point), 0);
    const weightedZones = buildWeightedBreakdown(
      heatmapData,
      (point) => point.barrio || point.distrito || point.ciudad,
    );
    const weightedCategories = buildWeightedBreakdown(heatmapData, (point) => point.categoria);
    const weightedStates = buildWeightedBreakdown(heatmapData, (point) => point.estado);
    const clusteredZones = heatmapData.filter(
      (point) => (point.clusterSize ?? 0) > 1 || Boolean(point.clusterId) || Boolean(point.cellId),
    ).length;

    return {
      totalWeight,
      pointCount: heatmapData.length,
      zoneCount: weightedZones.length,
      hotZones: weightedZones.slice(0, 4),
      topCategory: weightedCategories[0],
      topState: weightedStates[0],
      clusteredZones,
    };
  }, [heatmapData]);

  const activeFilterCount = [
    selectedCategories.length,
    selectedStates.length,
    sanitizeFilterValue(districtRef.current?.value) ? 1 : 0,
    sanitizeFilterValue(barrioRef.current?.value) ? 1 : 0,
    sanitizeFilterValue(genderRef.current?.value) ? 1 : 0,
    sanitizeFilterValue(ageMinRef.current?.value) || sanitizeFilterValue(ageMaxRef.current?.value) ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);

  const mapKpis = [
    {
      label: 'Incidencias',
      value: formatNumber(mapInsights.totalWeight),
      detail: `${formatNumber(mapInsights.pointCount)} puntos`,
      icon: Activity,
    },
    {
      label: 'Zonas activas',
      value: formatNumber(mapInsights.zoneCount),
      detail: `${formatNumber(mapInsights.clusteredZones)} agregadas`,
      icon: Layers,
    },
    {
      label: 'Zona caliente',
      value: formatMapLabel(mapInsights.hotZones[0]?.label),
      detail: mapInsights.hotZones[0]
        ? `${formatNumber(mapInsights.hotZones[0].weight)} reportes`
        : 'Sin ubicaciones',
      icon: Flame,
    },
    {
      label: 'Estado dominante',
      value: formatMapLabel(mapInsights.topState?.label),
      detail: mapInsights.topCategory
        ? `Categoria: ${formatMapLabel(mapInsights.topCategory.label)}`
        : 'Sin categoria',
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
            Mapa vivo de reclamos y calor operativo
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Priorizacion por zona, categoria, estado y actividad reciente con telemetria visual sobre el mapa real.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border bg-background px-3 py-1">
            {activeFilterCount > 0 ? `${activeFilterCount} filtros activos` : 'Sin filtros activos'}
          </span>
          <span className="rounded-full border border-border bg-background px-3 py-1">
            {showHeatmap ? 'Capa calor activa' : 'Puntos y clusters'}
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
              {showHeatmap ? 'Calor activo' : 'Solo puntos'}
            </button>
            <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
              <span>Motor</span>
              <MapProviderToggle value={provider} onChange={setProvider} size="sm" />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[160px_1fr_1fr_auto_auto] xl:min-w-[720px]">
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
              onClick={() => {
                void fetchData(true);
              }}
              disabled={isLoading}
              className="h-10 gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Actualizando' : 'Actualizar'}
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
              Filtros avanzados y segmentacion
            </span>
            <span className="text-xs font-medium text-muted-foreground group-open:hidden">
              Categoria, estado, ubicacion, edad y genero
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
                  ref={startDateRef}
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
                  ref={endDateRef}
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
                  ref={barrioRef}
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
                  ref={districtRef}
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
                  ref={genderRef}
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
                  ref={ageMinRef}
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
                  ref={ageMaxRef}
                  className="mt-1 block w-full px-3 py-2 bg-input border-border text-foreground rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                />
              </div>
              <div className="hidden">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button
                    onClick={() => {
                      void fetchData(true);
                    }}
                    disabled={isLoading}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isLoading ? 'Actualizando...' : 'Aplicar Filtros y Actualizar Mapa'}
                  </Button>
                  <Button
                    onClick={handleLocate}
                    disabled={isLoading}
                    variant="outline"
                    className="gap-2"
                  >
                    Centrar en mi ubicación
                  </Button>
                </div>
              </div>
            </div>
        </details>
      </section>

      {error && (
        <Alert variant="default" className="border-destructive/30 bg-destructive/10 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Datos de mapa limitados</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
        />
        <IncidentsTelemetryOverlay
          points={heatmapData}
          hotZones={mapInsights.hotZones}
          totalWeight={mapInsights.totalWeight}
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
                    : 'Sin zona dominante'}
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
                <span className="block text-white/55">Zonas</span>
                <strong>{formatNumber(mapInsights.zoneCount)}</strong>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="rounded-xl bg-background/90 px-3 py-2 text-xs text-foreground shadow-lg backdrop-blur">
            {legendText}
          </div>
          <div className="rounded-xl bg-background/90 px-3 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur">
            {provider === 'google' ? 'Google con fallback MapLibre' : 'MapLibre GL local'}
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
              <p className="text-sm font-semibold text-foreground">Zonas calientes</p>
              <p className="text-xs text-muted-foreground">Ordenadas por peso de reclamos.</p>
            </div>
            <Flame className="h-5 w-5 text-amber-500" />
          </div>
          <div className="mt-4 space-y-3">
            {mapInsights.hotZones.length > 0 ? (
              mapInsights.hotZones.map((zone, index) => {
                const pct =
                  mapInsights.totalWeight > 0
                    ? Math.min(100, Math.round((zone.weight / mapInsights.totalWeight) * 100))
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
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Todavia no hay zonas con coordenadas para los filtros actuales.
              </div>
            )}
          </div>
        </aside>
      </section>
      {!isLoading && heatmapData.length === 0 && (
        <Alert variant="default" className="mb-6 border-border/60 border-dashed bg-muted/40">
          <AlertTitle>No hay puntos para mostrar</AlertTitle>
          <AlertDescription>
            No recibimos ubicaciones con los filtros seleccionados. Probá ampliar el rango de fechas o quitar filtros.
            Si el problema persiste, avisa al equipo de soporte para revisar los datos enviados.
          </AlertDescription>
        </Alert>
      )}
      <TicketStatsCharts charts={charts} />
    </div>
  );
}
