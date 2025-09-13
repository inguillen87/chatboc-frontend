import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  TicketStatsResponse,
} from '@/services/statsService';
import { Checkbox } from '@/components/ui/checkbox';

export default function IncidentsMap() {
  useRequireRole(['admin', 'super_admin'] as Role[]);
  const { user } = useUser();

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
  const [provider, setProvider] = useState<'maplibre' | 'google'>('maplibre');

  const heatmapCache = useRef<Record<string, HeatPoint[]>>({});
  const lastFiltersRef = useRef<{
    fecha_inicio?: string;
    fecha_fin?: string;
    distrito?: string;
    barrio?: string;
  }>({});

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const districtRef = useRef<HTMLInputElement>(null);
  const barrioRef = useRef<HTMLSelectElement>(null);
  const genderRef = useRef<HTMLSelectElement>(null);
  const ageMinRef = useRef<HTMLInputElement>(null);
  const ageMaxRef = useRef<HTMLInputElement>(null);

  const ticketType = 'municipio';

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const filters = {
        fecha_inicio: startDateRef.current?.value,
        fecha_fin: endDateRef.current?.value,
        categoria: selectedCategories,
        estado: selectedStates,
        distrito: districtRef.current?.value,
        barrio: barrioRef.current?.value,
        genero: genderRef.current?.value,
        edad_min: ageMinRef.current?.value,
        edad_max: ageMaxRef.current?.value,
      };

      const { fecha_inicio, fecha_fin, distrito, barrio, categoria } = filters;
      const otherFilters = { fecha_inicio, fecha_fin, distrito, barrio };
      const lastFilters = lastFiltersRef.current;
      if (
        lastFilters.fecha_inicio !== otherFilters.fecha_inicio ||
        lastFilters.fecha_fin !== otherFilters.fecha_fin ||
        lastFilters.distrito !== otherFilters.distrito ||
        lastFilters.barrio !== otherFilters.barrio
      ) {
        heatmapCache.current = {};
        lastFiltersRef.current = otherFilters;
      }

      const categoryKey = categoria || 'all';
      const heatmapPromise = heatmapCache.current[categoryKey]
        ? Promise.resolve(heatmapCache.current[categoryKey])
        : getHeatmapPoints({ tipo_ticket: ticketType, ...filters }).then((data) => {
            heatmapCache.current[categoryKey] = data;
            return data;
          });

      const [heatmapPoints, stats] = await Promise.all([
        heatmapPromise,
        getTicketStats({ tipo: ticketType, ...filters }),
      ]);
      setCharts(stats.charts || []);
      setHeatmapData(heatmapPoints);

      const barrios = Array.from(new Set(heatmapPoints.map((d) => d.barrio).filter(Boolean))) as string[];
      setAvailableBarrios(barrios);

      if (heatmapPoints.length > 0) {
        const total = heatmapPoints.length;
        const avgLat = heatmapPoints.reduce((sum, p) => sum + p.lat, 0) / total;
        const avgLng = heatmapPoints.reduce((sum, p) => sum + p.lng, 0) / total;
        if (!Number.isNaN(avgLat) && !Number.isNaN(avgLng)) {
          setCenter({ lat: avgLat, lng: avgLng });
        }
      } else if (
        user?.latitud !== undefined &&
        user?.longitud !== undefined &&
        !Number.isNaN(user.longitud) &&
        !Number.isNaN(user.latitud)
      ) {
        setCenter({ lat: user.latitud, lng: user.longitud });
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Error al cargar datos del mapa';
      setError(message);
      setCharts([]);
      setHeatmapData([]);
      console.error('Error fetching map data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ticketType, user, selectedCategories, selectedStates]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    apiFetch<{ categorias: { nombre: string }[] }>('/municipal/categorias', {
      sendEntityToken: true,
    })
      .then((data) => {
        const names = Array.isArray(data.categorias)
          ? data.categorias.map((c) => c.nombre)
          : [];
        setCategories(names);
      })
      .catch((err) => console.error('Error fetching categories:', err));
  }, []);

  useEffect(() => {
    apiFetch<{ estados: { nombre: string }[] | string[] }>('/municipal/estados', {
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
  }, []);

  useEffect(() => {
    if (
      !center &&
      user?.latitud !== undefined &&
      user?.longitud !== undefined &&
      !Number.isNaN(user.longitud) &&
      !Number.isNaN(user.latitud)
    ) {
      setCenter({ lat: user.latitud, lng: user.longitud });
    }
  }, [center, user?.latitud, user?.longitud]);

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
                <RadioGroup
                  value={provider}
                  onValueChange={(v) => setProvider(v as 'maplibre' | 'google')}
                  className="flex space-x-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="maplibre" id="provider-maplibre" />
                    <Label htmlFor="provider-maplibre" className="text-sm text-muted-foreground">
                      MapLibre
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="google" id="provider-google" />
                    <Label htmlFor="provider-google" className="text-sm text-muted-foreground">
                      Google
                    </Label>
                  </div>
                </RadioGroup>
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
                    onClick={fetchData}
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
          heatmapData={heatmapData}
          showHeatmap={showHeatmap}
          className="h-[600px]"
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
      <TicketStatsCharts charts={charts} />
    </div>
  );
}

