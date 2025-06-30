import React, { useEffect, useState, useRef, useCallback } from 'react';
import { apiFetch, ApiError } from '@/utils/api';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import { loadGoogleMapsApi } from '@/utils/mapsLoader';

// Define the expected structure for heatmap data points
interface HeatmapDataPoint {
  location: { lat: number; lng: number };
  weight: number;
}

export default function IncidentsMap() {
  useRequireRole(['admin'] as Role[]);

  const [mapsApi, setMapsApi] = useState<typeof google.maps | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [heatmapLayer, setHeatmapLayer] = useState<google.maps.visualization.HeatmapLayer | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);

  const [loadingData, setLoadingData] = useState(false); // For data fetching
  const [loadingMap, setLoadingMap] = useState(true); // For initial map library load
  const [error, setError] = useState<string | null>(null);

  // Refs for UI elements
  const heatmapToggleRef = useRef<HTMLInputElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const ticketType = 'municipio';

  const clearMarkers = useCallback(() => {
    markers.forEach(marker => marker.setMap(null));
    setMarkers([]);
  }, [markers]);

  const fetchDataAndRefreshMap = useCallback(async () => {
    if (!mapsApi || !map) {
      setError("API de Google Maps o instancia de mapa no disponible.");
      return;
    }
    setLoadingData(true);
    setError(null);
    clearMarkers();
    if (heatmapLayer) {
      heatmapLayer.setMap(null);
    }

    const params = new URLSearchParams();
    if (startDateRef.current?.value) params.append('fecha_inicio', startDateRef.current.value);
    if (endDateRef.current?.value) params.append('fecha_fin', endDateRef.current.value);
    if (categoryRef.current?.value) params.append('categoria', categoryRef.current.value);

    const endpoint = `/tickets/${ticketType}/mapa?${params.toString()}`;

    try {
      const data = await apiFetch<HeatmapDataPoint[]>(endpoint);

      if (!data) {
        setError("No se recibieron datos del servidor.");
        return;
      }

      const isHeatmapActive = heatmapToggleRef.current?.checked;

      if (isHeatmapActive) {
        const heatmapData = data.map(item => ({
          location: new mapsApi.LatLng(item.location.lat, item.location.lng),
          weight: item.weight,
        }));

        if (heatmapLayer) {
          heatmapLayer.setData(heatmapData);
          heatmapLayer.setMap(map);
        } else {
          const newHeatmapLayer = new mapsApi.visualization.HeatmapLayer({
            data: heatmapData,
            map: map,
            radius: 20,
            dissipating: false,
          });
          setHeatmapLayer(newHeatmapLayer);
        }
      } else {
        if (heatmapLayer) heatmapLayer.setMap(null);

        const newMarkersData = data.map(item => ({
          position: { lat: item.location.lat, lng: item.location.lng },
          title: `Tickets: ${item.weight}`,
        }));

        const newGoogleMarkers = newMarkersData.map(markerData =>
          new mapsApi.Marker({
            position: markerData.position,
            map: map,
            title: markerData.title,
          })
        );
        setMarkers(newGoogleMarkers);
      }
    } catch (err: any) {
      const message = err instanceof ApiError ? err.message : 'Error al cargar datos del mapa';
      setError(message);
      console.error("Error fetching map data:", err);
    } finally {
      setLoadingData(false);
    }
  }, [mapsApi, map, heatmapLayer, ticketType, clearMarkers]);

  const initializeMap = useCallback((loadedMapsApi: typeof google.maps) => {
    if (mapContainerRef.current && !map) {
      const googleMap = new loadedMapsApi.Map(mapContainerRef.current, {
        center: { lat: -34.603722, lng: -58.381592 },
        zoom: 12,
      });
      setMap(googleMap);
      setLoadingMap(false); // Map is initialized
    }
  }, [map]); // map dependency to prevent re-init if already set

  useEffect(() => {
    loadGoogleMapsApi(['visualization']) // Requesting 'visualization' library
      .then(api => {
        setMapsApi(api.maps);
        initializeMap(api.maps);
      })
      .catch(err => {
        console.error("Failed to load Google Maps API for IncidentsMap:", err);
        setError("Error al cargar la API de Google Maps. Verifique la consola y la API Key.");
        setLoadingMap(false);
      });
  }, [initializeMap]);

  useEffect(() => {
    if (map && mapsApi) { // Only fetch if map and API are initialized
      fetchDataAndRefreshMap();
    }
  }, [map, mapsApi, fetchDataAndRefreshMap]); // fetchDataAndRefreshMap is now a dependency

  const handleApplyFilters = () => {
    if (map && mapsApi) {
      fetchDataAndRefreshMap();
    } else {
      setError("El mapa no está inicializado completamente. Intente recargar la página.");
    }
  };

  const handleHeatmapToggle = () => {
     if (map && mapsApi) {
      fetchDataAndRefreshMap();
    }
  };

  if (loadingMap) return <p className="p-4 text-center">Cargando API de mapa...</p>;
  if (!map && !loadingMap && error) return <p className="p-4 text-center text-red-500">Error: {error}</p>;
  if (!map && !loadingMap) return <p className="p-4 text-center">Mapa no pudo inicializarse.</p>;


  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Mapa de Incidentes/Tickets</h1>
      <div className="mb-4 p-4 border rounded shadow-sm bg-gray-50 dark:bg-gray-800">
        <h2 className="text-xl font-semibold mb-3 text-gray-700 dark:text-gray-200">Controles del Mapa</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3 items-end">
          <div className="flex items-center space-x-2 pt-5">
            <input
              type="checkbox"
              id="heatmapToggle"
              ref={heatmapToggleRef}
              onChange={handleHeatmapToggle}
              className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="heatmapToggle" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              Mostrar Mapa de Calor
            </label>
          </div>
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha Inicio
            </label>
            <input type="date" id="startDate" ref={startDateRef} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha Fin
            </label>
            <input type="date" id="endDate" ref={endDateRef} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Categoría
            </label>
            <input type="text" id="category" ref={categoryRef} className="mt-1 block w-full px-3 py-2 bg-white dark:bg-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Ej: Bache, Alumbrado" />
          </div>
          <div className="sm:col-span-1 md:col-span-2 lg:col-span-3 flex justify-end mt-2">
             {/* Placeholder for alignment or future controls */}
          </div>
          <div className="flex justify-end mt-2">
            <button
              id="applyFilters"
              onClick={handleApplyFilters}
              disabled={loadingData || loadingMap}
              className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loadingData ? 'Actualizando...' : 'Aplicar Filtros y Actualizar'}
            </button>
          </div>
        </div>
      </div>

      {error && !loadingData && <p className="text-red-500 text-center mb-4">Error: {error}</p>}

      <div id="mapContainer" ref={mapContainerRef} style={{ height: '600px', width: '100%' }} className="mb-6 border rounded shadow dark:border-gray-700">
        {/* El mapa de Google se renderizará aquí */}
        {map && loadingData && <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 dark:bg-gray-800 dark:bg-opacity-50"><p>Cargando datos del mapa...</p></div>}
      </div>
    </div>
  );
}
