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

export default function IncidentsMap() {
  useRequireRole(['admin', 'super_admin'] as Role[]);
  const { user } = useUser();

  const [heatmapData, setHeatmapData] = useState<HeatPoint[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [center, setCenter] = useState<[number, number] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [charts, setCharts] = useState<TicketStatsResponse['charts']>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLSelectElement>(null);
  const districtRef = useRef<HTMLInputElement>(null);

  const ticketType = 'municipio';

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const filters = {
        fecha_inicio: startDateRef.current?.value,
        fecha_fin: endDateRef.current?.value,
        categoria: categoryRef.current?.value,
        distrito: districtRef.current?.value,
      };

      const [heatmapPoints, stats] = await Promise.all([
        getHeatmapPoints({ tipo_ticket: ticketType, ...filters }),
        getTicketStats({ tipo: ticketType, ...filters }),
      ]);
      setCharts(stats.charts || []);
      setHeatmapData(heatmapPoints);
      if (heatmapPoints.length > 0) {
        const total = heatmapPoints.length;
        const avgLat = heatmapPoints.reduce((sum, p) => sum + p.lat, 0) / total;
        const avgLng = heatmapPoints.reduce((sum, p) => sum + p.lng, 0) / total;
        if (!Number.isNaN(avgLat) && !Number.isNaN(avgLng)) {
          setCenter([avgLng, avgLat]);
        }
      } else if (
        user?.latitud !== undefined &&
        user?.longitud !== undefined &&
        !Number.isNaN(user.longitud) &&
        !Number.isNaN(user.latitud)
      ) {
        setCenter([user.longitud, user.latitud]);
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
  }, [ticketType]);

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
    if (
      !center &&
      user?.latitud !== undefined &&
      user?.longitud !== undefined &&
      !Number.isNaN(user.longitud) &&
      !Number.isNaN(user.latitud)
    ) {
      setCenter([user.longitud, user.latitud]);
    }
  }, [center, user?.latitud, user?.longitud]);

  const handleLocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCenter([pos.coords.longitude, pos.coords.latitude]);
      });
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Mapa de Incidentes</h1>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="filters">
          <AccordionTrigger>Filtros</AccordionTrigger>
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
                <label htmlFor="category" className="block text-sm font-medium text-muted-foreground mb-1">
                  Categoría
                </label>
                <select
                  id="category"
                  ref={categoryRef}
                  className="mt-1 block w-full px-3 py-2 bg-input border-border text-foreground rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                >
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
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
        <MapLibreMap center={center} heatmapData={heatmapData} showHeatmap={showHeatmap} className="h-[600px]" />
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

