import React, { useEffect, useRef, useState } from 'react';
import { loadGoogleMapsApi } from '@/utils/mapsLoader';
import { apiFetch } from '@/utils/api';

const EstadisticasPage: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [heatmap, setHeatmap] = useState<google.maps.visualization.HeatmapLayer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGoogleMapsApi(['visualization'])
      .then(() => {
        if (mapRef.current) {
          const mapInstance = new window.google.maps.Map(mapRef.current, {
            zoom: 13,
            center: { lat: -34.6037, lng: -58.3816 }, // Buenos Aires
          });
          setMap(mapInstance);
        }
      })
      .catch((err) => {
        console.error('Error loading Google Maps API', err);
        setError('No se pudo cargar el mapa.');
      });
  }, []);

  useEffect(() => {
    if (map) {
      apiFetch<{ lat: number; lng: number }[]>('/api/locations') // Assuming this is the endpoint
        .then((data) => {
          const points = data.map((loc) => new window.google.maps.LatLng(loc.lat, loc.lng));
          if (heatmap) {
            heatmap.setData(points);
          } else {
            const heatmapInstance = new window.google.maps.visualization.HeatmapLayer({
              data: points,
              map: map,
            });
            setHeatmap(heatmapInstance);
          }
        })
        .catch((err) => {
          console.error('Error fetching location data', err);
          setError('No se pudieron cargar los datos de ubicación.');
        });
    }
  }, [map, heatmap]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Estadísticas y Mapas de Calor</h1>
      {error && <p className="text-red-500">{error}</p>}
      <div ref={mapRef} style={{ height: '500px', width: '100%' }} />
    </div>
  );
};

export default EstadisticasPage;
