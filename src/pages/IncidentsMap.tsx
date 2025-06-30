import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/utils/api';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';

// Define the expected structure for heatmap data points / marker data
interface IncidentMapPoint {
  location: { lat: number; lng: number };
  weight: number; // Used for heatmap intensity or can represent count for markers
  ticket_id?: number; // Actual DB ID of one of the tickets at this point
  nro_ticket?: string; // Visible ticket number
  asunto?: string; // Brief description or title of the incident/ticket
}

// Extend the Window interface to include initMap and google
declare global {
  interface Window {
    initMap?: () => void;
    google?: typeof google; // Ensure google is typed on window
  }
}

export default function IncidentsMap() {
  useRequireRole(['admin'] as Role[]);
  const navigate = useNavigate(); // For linking to ticket details

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [heatmapLayer, setHeatmapLayer] = useState<google.maps.visualization.HeatmapLayer | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [activeInfoWindow, setActiveInfoWindow] = useState<google.maps.InfoWindow | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const heatmapToggleRef = useRef<HTMLInputElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const ticketType = 'municipio'; // This page is specific to municipal incidents

  const clearMapElements = useCallback(() => {
    markers.forEach(marker => marker.setMap(null));
    setMarkers([]);
    if (heatmapLayer) {
      heatmapLayer.setMap(null);
    }
    if (activeInfoWindow) {
      activeInfoWindow.close();
      setActiveInfoWindow(null);
    }
  }, [markers, heatmapLayer, activeInfoWindow]);

  const fetchDataAndRefreshMap = useCallback(async () => {
    if (!map) {
        console.warn("fetchDataAndRefreshMap called before map was initialized.");
        setLoading(false);
        return;
    }
    setLoading(true);
    setError(null);
    clearMapElements();

    const params = new URLSearchParams();
    if (startDateRef.current?.value) params.append('fecha_inicio', startDateRef.current.value);
    if (endDateRef.current?.value) params.append('fecha_fin', endDateRef.current.value);
    if (categoryRef.current?.value) params.append('categoria', categoryRef.current.value);

    const endpoint = `/tickets/${ticketType}/mapa?${params.toString()}`;

    try {
      const data = await apiFetch<IncidentMapPoint[]>(endpoint);

      if (!data) {
        setLoading(false);
        setError("No se recibieron datos del servidor.");
        return;
      }

      const isHeatmapActive = heatmapToggleRef.current?.checked;

      if (isHeatmapActive) {
        if(activeInfoWindow) activeInfoWindow.close();
        const heatmapData = data.map(item => ({
          location: new window.google.maps.LatLng(item.location.lat, item.location.lng),
          weight: item.weight,
        }));

        let newHeatmapLayer = heatmapLayer;
        if (!newHeatmapLayer) {
          newHeatmapLayer = new window.google.maps.visualization.HeatmapLayer({
            data: heatmapData,
            map: map,
            radius: 20,
            dissipating: true,
          });
          setHeatmapLayer(newHeatmapLayer);
        } else {
          newHeatmapLayer.setData(heatmapData);
          newHeatmapLayer.setMap(map);
        }
      } else {
        if (heatmapLayer) heatmapLayer.setMap(null);

        const newGoogleMarkers = data.map(item => {
          const marker = new window.google.maps.Marker({
            position: item.location,
            map: map,
            title: item.asunto || `Incidente (ID: ${item.ticket_id || 'N/A'})`,
          });

          marker.addListener('click', () => {
            if (activeInfoWindow) {
              activeInfoWindow.close();
            }
            const asuntoHtml = item.asunto ? item.asunto.replace(/</g, "&lt;").replace(/>/g, "&gt;") : 'Incidente';
            const nroTicketHtml = item.nro_ticket ? item.nro_ticket.replace(/</g, "&lt;").replace(/>/g, "&gt;") : '';

            let contentString = `<div style="font-family: sans-serif; font-size: 14px; color: #333; padding: 5px;">
                <h4 style="margin: 0 0 8px 0; font-weight: bold; font-size: 1.1em;">${asuntoHtml}</h4>`;
            if (nroTicketHtml) {
                contentString += `<p style="margin: 3px 0;">Ticket: <strong>${nroTicketHtml}</strong></p>`;
            }
            if (item.ticket_id) {
                contentString += `<p style="margin: 3px 0;">ID Interno: ${item.ticket_id}</p>`;
            }
            contentString += `<p style="margin: 3px 0;">Agrupados/Peso: ${item.weight}</p>`;
            if (item.ticket_id) {
                contentString += `<button onclick="document.dispatchEvent(new CustomEvent('navigateToTicket', { detail: { ticketId: ${item.ticket_id}, ticketTipo: '${ticketType}' } }))"
                                    style="color: #fff; background-color: #007bff; border: none; padding: 6px 10px; text-align: center; text-decoration: none; display: inline-block; font-size: 13px; margin-top: 8px; border-radius: 4px; cursor: pointer;">
                                    Ver Detalles del Ticket
                                </button>`;
            }
            contentString += `</div>`;

            const infoWindow = new window.google.maps.InfoWindow({
              content: contentString,
            });
            infoWindow.open(map, marker);
            setActiveInfoWindow(infoWindow);
          });
          return marker;
        });
        setMarkers(newGoogleMarkers);
      }
    } catch (err: any) {
      const message = err instanceof ApiError ? err.message : 'Error al cargar datos del mapa';
      setError(message);
      console.error("Error fetching map data:", err);
    } finally {
      setLoading(false);
    }
  }, [map, heatmapLayer, ticketType, clearMapElements, activeInfoWindow, navigate]);

  useEffect(() => {
    const handleNavigate = (event: Event) => {
        const customEvent = event as CustomEvent<{ ticketId: number; ticketTipo: string }>;
        if (customEvent.detail && customEvent.detail.ticketId) {
            navigate(`/tickets#ticket-${customEvent.detail.ticketId}`);
            console.log("Navigating to ticket:", customEvent.detail.ticketId);
        }
    };
    document.addEventListener('navigateToTicket', handleNavigate);
    return () => {
        document.removeEventListener('navigateToTicket', handleNavigate);
    };
  }, [navigate]);

  const initializeMap = useCallback(() => {
    if (mapContainerRef.current && !map && window.google && window.google.maps) {
        if (!window.google.maps.visualization) {
            console.error("Google Maps Visualization library not loaded. Heatmap will not work.");
            setError("La librería de visualización de mapas (heatmap) no cargó. El mapa de calor puede no funcionar.");
        }
        const googleMap = new window.google.maps.Map(mapContainerRef.current, {
            center: { lat: -34.603722, lng: -58.381592 },
            zoom: 12,
        });
        setMap(googleMap);
    }
  }, [map]);

  useEffect(() => {
    if (typeof window.google === 'undefined' || typeof window.google.maps === 'undefined') {
      console.warn("Google Maps API not available at component mount.");
      if(!window.initMap) {
        window.initMap = initializeMap;
      }
    } else {
      initializeMap();
    }

    return () => {
      if (window.initMap === initializeMap) {
        // delete window.initMap; // Consider implications if other components use global initMap
      }
    };
  }, [initializeMap]);

  useEffect(() => {
    if (map && !loading && (markers.length === 0 && !heatmapLayer?.getMap())) { // Check if map is set, not loading, and no data is displayed
        fetchDataAndRefreshMap();
    }
  }, [map, loading, markers, heatmapLayer, fetchDataAndRefreshMap]);


  const handleApplyFilters = () => {
    if (map) {
      fetchDataAndRefreshMap();
    } else {
      setError("El mapa no está inicializado. Intente recargar la página.");
    }
  };

  const handleHeatmapToggle = () => {
     if (map) {
      fetchDataAndRefreshMap();
    }
  };

  if (loading && !map) return <p className="p-4 text-center">Cargando mapa y datos...</p>;
  if (!map && !loading && !error) return <p className="p-4 text-center text-muted-foreground">Esperando carga del mapa...</p>;
  if (!map && error) return <p className="p-4 text-destructive text-center">Error al cargar el mapa: {error}</p>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Mapa de Incidentes</h1>
      <div className="mb-4 p-4 border rounded shadow-sm bg-card dark:bg-slate-800">
        <h2 className="text-xl font-semibold mb-3 text-foreground">Controles del Mapa</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3 items-end">
          <div className="flex items-center space-x-2 pt-5">
            <input
              type="checkbox"
              id="heatmapToggle"
              ref={heatmapToggleRef}
              onChange={handleHeatmapToggle}
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
            <input type="date" id="startDate" ref={startDateRef} className="mt-1 block w-full px-3 py-2 bg-input border-border text-foreground rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-muted-foreground mb-1">
              Fecha Fin
            </label>
            <input type="date" id="endDate" ref={endDateRef} className="mt-1 block w-full px-3 py-2 bg-input border-border text-foreground rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-muted-foreground mb-1">
              Categoría
            </label>
            <input type="text" id="category" ref={categoryRef} className="mt-1 block w-full px-3 py-2 bg-input border-border text-foreground rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm" placeholder="Ej: Bache, Alumbrado" />
          </div>
          <div className="sm:col-span-full flex justify-end mt-2">
            <Button
              onClick={handleApplyFilters}
              disabled={loading || !map}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {loading && map ? 'Actualizando...' : 'Aplicar Filtros y Actualizar Mapa'}
            </Button>
          </div>
        </div>
      </div>

      {error && !loading && <p className="text-destructive text-center mb-4 p-3 bg-destructive/10 rounded-md">{error}</p>}

      <div
        id="mapContainer"
        ref={mapContainerRef}
        style={{ height: '600px', width: '100%' }}
        className="mb-6 border border-border rounded-lg shadow bg-muted/20 dark:bg-slate-800/30"
      >
        {map && loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                <p className="text-lg font-semibold text-foreground">Cargando datos en el mapa...</p>
            </div>
        )}
      </div>
    </div>
  );
}
