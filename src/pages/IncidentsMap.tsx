import React, { useEffect, useState, useRef, useCallback } from 'react';
import { loadGoogleMapsApi } from '@/utils/mapsLoader';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { apiFetch, ApiError } from '@/utils/api';
import useRequireRole from '@/hooks/useRequireRole';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import type { Role } from '@/utils/roles';

// Define the expected structure for heatmap data points / marker data
interface IncidentMapPoint {
  location: { lat: number; lng: number };
  weight: number; // Used for heatmap intensity or can represent count for markers
  ticket_id?: number; // Actual DB ID of one of the tickets at this point
  nro_ticket?: string; // Visible ticket number
  asunto?: string; // Brief description or title of the incident/ticket
}

// Extend the Window interface to include the Google object
declare global {
  interface Window {
    google?: typeof google; // Ensure google is typed on window
  }
}

export default function IncidentsMap() {
  useRequireRole(['admin'] as Role[]);
  const navigate = useNavigate();

  const [mapState, setMapState] = useState<google.maps.Map | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const [heatmapLayer, setHeatmapLayer] = useState<google.maps.visualization.HeatmapLayer | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [activeInfoWindow, setActiveInfoWindow] = useState<google.maps.InfoWindow | null>(null);

  const [isMapInitializing, setIsMapInitializing] = useState(true);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heatmapToggleRef = useRef<HTMLInputElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const ticketType = 'municipio';

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

  const initializeMap = useCallback(() => {
    if (mapRef.current) {
      if (!mapState && mapRef.current) setMapState(mapRef.current);
      return;
    }
    if (mapContainerRef.current && window.google && window.google.maps) {
      if (!window.google.maps.visualization) {
        console.warn("Google Maps Visualization library not loaded. Heatmap functionality might be affected.");
      }
      const googleMap = new window.google.maps.Map(mapContainerRef.current, {
        center: { lat: -34.603722, lng: -58.381592 },
        zoom: 12,
      });
      mapRef.current = googleMap;
      setMapState(googleMap);
    } else {
      console.warn("initializeMap: mapContainerRef or window.google.maps not available.");
      setError("No se pudo inicializar el mapa (dependencias no listas después de API load).");
    }
  }, [setError, setMapState, mapState]); // mapState dependency to sync if ref set but state not.

  useEffect(() => {
    setIsMapInitializing(true);
    setError(null);
    loadGoogleMapsApi(["visualization"])
      .then(() => {
        console.log("Google Maps API loaded successfully.");
        initializeMap();
      })
      .catch((err) => {
        console.error("Google Maps API failed to load", err);
        setError(`No se pudo cargar Google Maps: ${err.message}`);
      })
      .finally(() => {
        setIsMapInitializing(false);
      });
  }, [initializeMap, setError]);


  const fetchDataAndRefreshMap = useCallback(async () => {
    const currentMap = mapRef.current;
    if (!currentMap) {
      console.warn("fetchDataAndRefreshMap called before map was initialized.");
      return;
    }
    setIsDataLoading(true);
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
        setError("No se recibieron datos del servidor.");
        return;
      }

      const isHeatmapActive = heatmapToggleRef.current?.checked;

      if (isHeatmapActive) {
        if(activeInfoWindow) activeInfoWindow.close();
        markers.forEach(marker => marker.setMap(null));
        setMarkers([]);

        const heatmapData = data.map(item => ({
          location: new window.google.maps.LatLng(item.location.lat, item.location.lng),
          weight: item.weight,
        }));

        let newHeatmapLayer = heatmapLayer;
        if (!newHeatmapLayer) {
          newHeatmapLayer = new window.google.maps.visualization.HeatmapLayer({
            data: heatmapData,
            map: currentMap,
            radius: 20,
            dissipating: true,
          });
          setHeatmapLayer(newHeatmapLayer);
        } else {
          newHeatmapLayer.setData(heatmapData);
          newHeatmapLayer.setMap(currentMap);
        }
      } else {
        if (heatmapLayer) heatmapLayer.setMap(null);

        const newGoogleMarkers = data.map(item => {
          const marker = new window.google.maps.Marker({
            position: item.location,
            map: currentMap,
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

            const infoWindow = new window.google.maps.InfoWindow({ content: contentString });
            infoWindow.open(currentMap, marker);
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
      setIsDataLoading(false);
    }
  }, [heatmapLayer, ticketType, clearMapElements, activeInfoWindow, navigate, setError, setMarkers, setHeatmapLayer, setActiveInfoWindow, markers]); // Added markers to deps of fetch data

  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<{ ticketId: number; ticketTipo: string }>;
      if (customEvent.detail && customEvent.detail.ticketId) {
        navigate(`/tickets#ticket-${customEvent.detail.ticketId}`);
      }
    };
    document.addEventListener('navigateToTicket', handleNavigate);
    return () => {
      document.removeEventListener('navigateToTicket', handleNavigate);
    };
  }, [navigate]);

  useEffect(() => {
    if (mapState && !isMapInitializing && !isDataLoading) {
      if (markers.length === 0 && (!heatmapLayer || !heatmapLayer.getMap())) {
        fetchDataAndRefreshMap();
      }
    }
  }, [mapState, isMapInitializing, isDataLoading, markers, heatmapLayer, fetchDataAndRefreshMap]);

  const handleApplyFilters = () => {
    if (mapRef.current) {
      fetchDataAndRefreshMap();
    } else {
      setError("El mapa no está inicializado. Intente recargar la página.");
    }
  };

  const handleHeatmapToggle = () => {
    if (mapRef.current) {
      fetchDataAndRefreshMap();
    }
  };

  if (isMapInitializing) return <p className="p-4 text-center">Cargando API de Mapas y componente...</p>;
  if (error && !mapRef.current) return <p className="p-4 text-destructive text-center">Error al cargar el mapa: {error}</p>;
  if (!mapRef.current && !isMapInitializing && !error) return <p className="p-4 text-center text-muted-foreground">Mapa no disponible. Contacte a soporte.</p>;


  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Mapa de Incidentes</h1>
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="item-1">
          <AccordionTrigger>Filtros</AccordionTrigger>
          <AccordionContent>
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
              <div className="sm:col-span-full flex justify-between mt-2">
                <div>
                  <input
                    type="text"
                    placeholder="Buscar dirección"
                    className="mt-1 block w-full px-3 py-2 bg-input border-border text-foreground rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                  />
                </div>
                <div className="flex items-center">
                  <Button
                    onClick={handleApplyFilters}
                    disabled={isDataLoading || !mapRef.current || isMapInitializing}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground mr-2"
                  >
                    {(isDataLoading && mapRef.current) ? 'Actualizando...' : 'Aplicar Filtros y Actualizar Mapa'}
                  </Button>
                  <Button
                    onClick={() => {
                      if (navigator.geolocation) {
                        navigator.geolocation.getCurrentPosition((position) => {
                          const pos = {
                            lat: position.coords.latitude,
                            lng: position.coords.longitude,
                          };
                          mapRef.current?.setCenter(pos);
                        });
                      }
                    }}
                    disabled={!mapRef.current || isMapInitializing}
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

      <div
        id="mapContainer"
        ref={mapContainerRef}
        style={{ height: '600px', width: '100%' }}
        className="mb-6 border border-border rounded-lg shadow bg-muted/20 dark:bg-slate-800/30"
      >
        {(isDataLoading && mapRef.current) && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                <p className="text-lg font-semibold text-foreground">Cargando datos en el mapa...</p>
            </div>
        )}
      </div>
    </div>
  );
}
