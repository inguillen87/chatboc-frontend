import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapLibreMap from '@/components/MapLibreMap';
import TicketStatsCharts from '@/components/TicketStatsCharts';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { ApiError, apiFetch } from '@/utils/api';
import useRequireRole from '@/hooks/useRequireRole';
import { useUser } from '@/hooks/useUser';
import type { Role } from '@/utils/roles';
import {
  getTicketStats,
  getHeatmapPoints,
  HeatPoint,
  HeatmapDataset,
  TicketStatsResponse,
} from '@/services/statsService';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  JUNIN_DEMO_CENTER,
  JUNIN_DEMO_NOTICE,
  generateJuninDemoHeatmap,
  mergeAndSortStrings,
} from '@/utils/demoHeatmap';
import { useMapProvider } from '@/hooks/useMapProvider';
import type { MapProvider, MapProviderUnavailableReason } from '@/hooks/useMapProvider';
import { MapProviderToggle } from '@/components/MapProviderToggle';

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
  const normalizedEntries = Object.entries(filters).map(([key, value]) => {
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
  const [disableClustering, setDisableClustering] = useState(false);
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

      if (options?.fallback) {
        setCenter({ lat: JUNIN_DEMO_CENTER[1], lng: JUNIN_DEMO_CENTER[0] });
      } else if (adminCoords) {
        setCenter({ lat: adminCoords[1], lng: adminCoords[0] });
      }
    },
    [adminCoords, computeDisableClustering],
  );

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const districtRef = useRef<HTMLInputElement>(null);
  const barrioRef = useRef<HTMLSelectElement>(null);
  const genderRef = useRef<HTMLSelectElement>(null);
  const ageMinRef = useRef<HTMLInputElement>(null);
  const ageMaxRef = useRef<HTMLInputElement>(null);

  const ticketType = useMemo(() => (user?.tipo_chat === 'pyme' ? 'pyme' : 'municipio'), [user]);

  const fetchData = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
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
        tipo_ticket: ticketType,
        tipo: ticketType,
      });

      const cache = heatmapCache.current;
      const heatmapPromise = !forceRefresh && cache.has(heatmapKey)
        ? Promise.resolve(cache.get(heatmapKey) ?? { points: [] })
        : getHeatmapPoints({ tipo_ticket: ticketType, tipo: ticketType, ...filters }).then((data) => {
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
      let combinedHeatmap = heatmapPoints.length > 0 ? heatmapPoints : stats.heatmap ?? [];
      const usedFallback = combinedHeatmap.length === 0;

      if (usedFallback) {
        combinedHeatmap = generateJuninDemoHeatmap();
        setError(JUNIN_DEMO_NOTICE);
      }

      applyHeatmapDataset(
        heatmapPoints.length > 0
          ? heatmapDatasetResult
          : { points: combinedHeatmap, metadata: undefined },
        {
          mergeFilters: usedFallback,
          fallback: usedFallback,
        },
      );
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Error al cargar datos del mapa';
      setError(`${message}. ${JUNIN_DEMO_NOTICE}`);
      setCharts([]);
      const fallbackPoints = generateJuninDemoHeatmap();
      applyHeatmapDataset({ points: fallbackPoints }, { mergeFilters: true, fallback: true });
      console.error('Error fetching map data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ticketType, adminCoords, selectedCategories, selectedStates, applyHeatmapDataset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Mapa de Incidentes</h1>
      <Accordion type="single" collapsible className="w-full" defaultValue='filters'>
        <AccordionItem value="filters">
          <AccordionTrigger>Filtros y Opciones</AccordionTrigger>
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
                  Proveedor de Mapa
                </Label>
                <MapProviderToggle value={provider} onChange={setProvider} />
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
                <input
                  type="text"
                  id="district"
                  ref={districtRef}
                  className="mt-1 block w-full px-3 py-2 bg-input border-border text-foreground rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="Ej: Centro"
                />
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
              <div className="sm:col-span-full flex justify-between mt-2">
                <div className="flex items-center">
                  <Button
                    onClick={() => {
                      void fetchData(true);
                    }}
                    disabled={isLoading}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground mr-2"
                  >
                    {isLoading ? 'Actualizando...' : 'Aplicar Filtros y Actualizar Mapa'}
                  </Button>
                  <Button
                    onClick={handleLocate}
                    disabled={isLoading}
                    className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                  >
                    Centrar en mi ubicación
                  </Button>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {error && <p className="text-destructive text-center mb-4 p-3 bg-destructive/10 rounded-md">{error}</p>}

      <div className="relative mb-6 border border-border rounded-lg shadow bg-muted/20 dark:bg-slate-800/30">
        <MapLibreMap
          provider={provider}
          center={center ? [center.lng, center.lat] : undefined}
          marker={center ? [center.lng, center.lat] : undefined}
          adminLocation={adminCoords}
          heatmapData={heatmapData}
          showHeatmap={showHeatmap}
          className="h-[600px]"
          fitToBounds={heatmapBounds.length === 2 ? heatmapBounds : undefined}
          onProviderUnavailable={handleProviderUnavailable}
          disableClientClustering={disableClustering}
        />
        <div className="absolute bottom-2 left-2 bg-background/80 text-foreground px-2 py-1 rounded shadow text-xs">
          {legendText}
        </div>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
            <p className="text-lg font-semibold text-foreground">Cargando datos en el mapa...</p>
          </div>
        )}
      </div>
      {!isLoading && heatmapData.length === 0 && (
        <Alert variant="default" className="mb-6 border-border/60 border-dashed bg-muted/40">
          <AlertTitle>No hay puntos para mostrar</AlertTitle>
          <AlertDescription>
            No recibimos ubicaciones con los filtros seleccionados. Probá ampliar el rango de fechas o quitar filtros.
            Si el problema persiste, avisá al equipo de backend para revisar los datos enviados.
          </AlertDescription>
        </Alert>
      )}
      <TicketStatsCharts charts={charts} />
    </div>
  );
}

