import React, { useCallback, useEffect, useRef, useState } from 'react';
import MapLibreMap from '@/components/MapLibreMap';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { apiFetch, ApiError } from '@/utils/api';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';

interface IncidentMapPoint {
  location: { lat: number; lng: number };
  weight: number;
}

export default function IncidentsMap() {
  useRequireRole(['admin'] as Role[]);

  const [heatmapData, setHeatmapData] = useState<{ lat: number; lng: number; weight?: number }[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [center, setCenter] = useState<[number, number] | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);

  const ticketType = 'municipio';

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (startDateRef.current?.value) params.append('fecha_inicio', startDateRef.current.value);
    if (endDateRef.current?.value) params.append('fecha_fin', endDateRef.current.value);
    if (categoryRef.current?.value) params.append('categoria', categoryRef.current.value);

    try {
      const data = await apiFetch<IncidentMapPoint[]>(`/tickets/${ticketType}/mapa?${params.toString()}`);
      const points = Array.isArray(data)
        ? data.map((d) => ({ lat: d.location.lat, lng: d.location.lng, weight: d.weight }))
        : [];
      setHeatmapData(points);

      if (points.length > 0) {
        const total = points.reduce((sum, p) => sum + (p.weight ?? 1), 0);
        const avgLat = points.reduce((sum, p) => sum + p.lat * (p.weight ?? 1), 0) / total;
        const avgLng = points.reduce((sum, p) => sum + p.lng * (p.weight ?? 1), 0) / total;
        setCenter([avgLng, avgLat]);
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Error al cargar datos del mapa';
      setError(message);
      console.error('Error fetching map data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
                <input
                  type="text"
                  id="category"
                  ref={categoryRef}
                  className="mt-1 block w-full px-3 py-2 bg-input border-border text-foreground rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="Ej: Bache, Alumbrado"
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
    </div>
  );
}

