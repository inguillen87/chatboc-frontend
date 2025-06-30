import React, { useEffect, useState, useRef, useCallback } from 'react';
import { apiFetch, ApiError } from '@/utils/api';
// import TicketMap from '@/components/TicketMap'; // No longer used for individual map embeds
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';

// Define the expected structure for heatmap data points
interface HeatmapDataPoint {
  location: { lat: number; lng: number };
  weight: number;
}

// Define the structure for individual markers (simplified for now)
interface MarkerData {
  position: { lat: number; lng: number };
  title?: string; // e.g., show weight or category
}

// Extend the Window interface to include initMap
declare global {
  interface Window {
    initMap?: () => void;
  }
}

export default function IncidentsMap() {
  useRequireRole(['admin'] as Role[]);

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [heatmapLayer, setHeatmapLayer] = useState<google.maps.visualization.HeatmapLayer | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);

  const [loading, setLoading] = useState(true); // For initial map load and data fetch
  const [error, setError] = useState<string | null>(null);

  // Refs for UI elements
  const heatmapToggleRef = useRef<HTMLInputElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Determine ticket type (municipio or pyme) - This might need to be dynamic based on context
  // For now, defaulting to 'municipio' as per original endpoint /municipal/incidents
  const ticketType = 'municipio';

  const clearMarkers = useCallback(() => {
    markers.forEach(marker => marker.setMap(null));
    setMarkers([]);
  }, [markers]);

  const fetchDataAndRefreshMap = useCallback(async () => {
    setLoading(true);
    setError(null);
    clearMarkers();
    if (heatmapLayer) {
      heatmapLayer.setMap(null); // Clear previous heatmap
    }

    const params = new URLSearchParams();
    if (startDateRef.current?.value) params.append('fecha_inicio', startDateRef.current.value);
    if (endDateRef.current?.value) params.append('fecha_fin', endDateRef.current.value);
    if (categoryRef.current?.value) params.append('categoria', categoryRef.current.value);

    const endpoint = `/tickets/${ticketType}/mapa?${params.toString()}`;

    try {
      const data = await apiFetch<HeatmapDataPoint[]>(endpoint);

      if (!map || !data) {
        setLoading(false);
        if (!data) setError("No se recibieron datos del servidor.");
        return;
      }

      const isHeatmapActive = heatmapToggleRef.current?.checked;

      if (isHeatmapActive) {
        const heatmapData = data.map(item => ({
          location: new google.maps.LatLng(item.location.lat, item.location.lng),
          weight: item.weight,
        }));

        let newHeatmapLayer = heatmapLayer;
        if (!newHeatmapLayer) {
          newHeatmapLayer = new google.maps.visualization.HeatmapLayer({
            data: heatmapData,
            map: map,
            radius: 20,
            dissipating: false,
          });
          setHeatmapLayer(newHeatmapLayer);
        } else {
          newHeatmapLayer.setData(heatmapData);
          newHeatmapLayer.setMap(map); // Ensure it's visible
        }
      } else {
        // Heatmap is off, show individual markers
        if (heatmapLayer) heatmapLayer.setMap(null); // Hide heatmap if it exists

        const newMarkersData = data.map(item => ({
          position: { lat: item.location.lat, lng: item.location.lng },
          title: `Tickets: ${item.weight}`, // Simple title with weight
        }));

        const newGoogleMarkers = newMarkersData.map(markerData =>
          new google.maps.Marker({
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
      setLoading(false);
    }
  }, [map, heatmapLayer, ticketType, clearMarkers]);


  const initializeMap = useCallback(() => {
    if (mapContainerRef.current && !map) {
      const googleMap = new google.maps.Map(mapContainerRef.current, {
        center: { lat: -34.603722, lng: -58.381592 }, // Default center (e.g., Buenos Aires) - Adjust as needed
        zoom: 12,
      });
      setMap(googleMap);
    }
  }, [map]); // Added map to dependency array

  // Effect for initializing map and setting up initMap callback
  useEffect(() => {
    // Define initMap globally so Google Maps API can call it
    window.initMap = () => {
      console.log("Google Maps API loaded, calling initializeMap");
      initializeMap();
    };

    // If Google Maps is already loaded (e.g., due to fast navigation or script already present)
    if (typeof google !== 'undefined' && typeof google.maps !== 'undefined') {
       console.log("Google Maps API already loaded on mount, calling initializeMap directly");
       initializeMap();
    }

    // Cleanup initMap from window object when component unmounts
    return () => {
      if (window.initMap) {
        delete window.initMap;
      }
    };
  }, [initializeMap]);


  // Effect to fetch data when map is ready or filters change (via button click)
  useEffect(() => {
    if (map) { // Only fetch if map is initialized
      fetchDataAndRefreshMap();
    }
  }, [map]); // Removed fetchDataAndRefreshMap from here to avoid loop, will be called by button or toggle

  const handleApplyFilters = () => {
    if (map) {
      fetchDataAndRefreshMap();
    } else {
      setError("El mapa no está inicializado. Intente recargar la página.");
    }
  };

  const handleHeatmapToggle = () => {
     if (map) {
      // When toggling, we need to refresh the data and display
      // This ensures markers are hidden/shown correctly and heatmap is updated
      fetchDataAndRefreshMap();
    }
  };

  // Initial loading message for the map itself
  if (!map && loading) return <p>Cargando mapa...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Mapa de Incidentes/Tickets</h1>
      <div className="mb-4 p-4 border rounded shadow-sm bg-gray-50">
        <h2 className="text-xl font-semibold mb-3 text-gray-700">Controles del Mapa</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3 items-end">
          <div className="flex items-center space-x-2 pt-5">
            <input
              type="checkbox"
              id="heatmapToggle"
              ref={heatmapToggleRef}
              onChange={handleHeatmapToggle}
              className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="heatmapToggle" className="text-sm font-medium text-gray-700 cursor-pointer">
              Mostrar Mapa de Calor
            </label>
          </div>
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Inicio
            </label>
            <input type="date" id="startDate" ref={startDateRef} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
              Fecha Fin
            </label>
            <input type="date" id="endDate" ref={endDateRef} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <input type="text" id="category" ref={categoryRef} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Ej: Bache, Alumbrado" />
          </div>
          <div className="sm:col-span-2 md:col-span-3 lg:col-span-4 flex justify-end mt-2">
            <button
              id="applyFilters"
              onClick={handleApplyFilters}
              disabled={loading}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Actualizando...' : 'Aplicar Filtros y Actualizar'}
            </button>
          </div>
        </div>
      </div>

      {error && <p className="text-red-500 text-center mb-4">Error: {error}</p>}

      <div id="mapContainer" ref={mapContainerRef} style={{ height: '600px', width: '100%' }} className="mb-6 border rounded shadow">
        {/* El mapa de Google se renderizará aquí */}
        {!map && !loading && <p className="text-center p-10">El mapa no pudo cargarse. Verifique la consola y la API Key de Google Maps.</p>}
      </div>
    </div>
  );
}
