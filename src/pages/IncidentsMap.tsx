import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapLibreMap from '@/components/LazyMapLibreMap';
import TicketStatsCharts from '@/components/TicketStatsCharts';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
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
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { mergeAndSortStrings } from '@/utils/collections';
import { useMapProvider } from '@/hooks/useMapProvider';
import type { MapProvider, MapProviderUnavailableReason } from '@/hooks/useMapProvider';
import { MapProviderToggle } from '@/components/MapProviderToggle';
import { Activity, AlertCircle, Flame, Layers, MapPin } from 'lucide-react';

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
            Mercator Mapas y Analitica
          </p>
          <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
            Mapa operativo de incidentes
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Vista de calor, zonas agregadas y actividad real para priorizar reclamos por territorio,
            categoria y estado.
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

      <Accordion type="single" collapsible className="w-full rounded-xl border border-border bg-card px-4 shadow-sm" defaultValue='filters'>
        <AccordionItem value="filters" className="border-0">
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            Filtros y capas
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3 items-end">
              <div className="flex items-center space-x-2 pt-5">
                <input
                  type="checkbox"
                  id="heatmapToggle"
                  checked={showHeatmap}
                  onChange={() => setShowHeatmap((v) => !v)}
                  className="h-5 w-5 text-primary bg-input border-border rounded focus:ring-primary cursor-pointer"
                />
                <label htmlFor="heatmapToggle" className="text-sm font-medium text-muted-foreground cursor-pointer">
                  Mostrar Mapa de Calor
                </label>
              </div>
              <div className="pt-5">
                <Label className="block text-sm font-medium text-muted-foreground mb-1">
                  Motor de mapa
                </Label>
                <p className="mb-1 text-xs text-muted-foreground">MapLibre GL (WebGL)</p>
                <MapProviderToggle value={provider} onChange={setProvider} />
              </div>
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
              <div className="sm:col-span-full mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {error && (
        <Alert variant="default" className="border-destructive/30 bg-destructive/10 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Datos de mapa limitados</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative min-h-[520px] overflow-hidden rounded-2xl border border-border bg-slate-950 shadow-xl">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(rgba(148,163,184,0.14)_1px,transparent_1px)] bg-[size:44px_44px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_35%,rgba(239,68,68,0.22),transparent_26%),radial-gradient(circle_at_68%_58%,rgba(245,158,11,0.2),transparent_24%),radial-gradient(circle_at_52%_76%,rgba(14,165,233,0.16),transparent_22%)]" />
        <MapLibreMap
          provider={provider}
          center={center ? [center.lng, center.lat] : undefined}
          marker={center ? [center.lng, center.lat] : undefined}
          adminLocation={adminCoords}
          heatmapData={heatmapData}
          showHeatmap={showHeatmap}
          className="h-[520px] sm:h-[620px] rounded-2xl"
          fitToBounds={heatmapBounds.length === 2 ? heatmapBounds : undefined}
          onProviderUnavailable={handleProviderUnavailable}
          disableClientClustering={disableClustering}
        />
        <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 grid gap-2 md:left-4 md:right-auto md:w-[420px]">
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
        <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
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
