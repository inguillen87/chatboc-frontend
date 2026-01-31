import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { analyticsService } from '../../services/analyticsService';

interface Props {
  tenantId: number;
  dateRange: { from: string; to: string };
}

const HeatmapDashboard: React.FC<Props> = ({ tenantId, dateRange }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [points, setPoints] = useState<any[]>([]);

  useEffect(() => {
    analyticsService.getHeatmap({
        tenant_id: tenantId,
        from: dateRange.from,
        to: dateRange.to
    }).then(data => setPoints(data || []));
  }, [tenantId, dateRange]);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json', // Replace with your style
      center: [-58.38, -34.60], // Buenos Aires default
      zoom: 11
    });

    map.current.on('load', () => {
        // Init logic
    });
  }, []);

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    // Convert points to GeoJSON
    const geojson = {
        type: 'FeatureCollection',
        features: points.map(p => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            properties: { weight: p.weight }
        }))
    };

    const sourceId = 'heatmap-source';
    const layerId = 'heatmap-layer';

    if (map.current.getSource(sourceId)) {
        (map.current.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson as any);
    } else {
        map.current.addSource(sourceId, { type: 'geojson', data: geojson as any });
        map.current.addLayer({
            id: layerId,
            type: 'heatmap',
            source: sourceId,
            paint: {
                'heatmap-weight': ['get', 'weight'],
                'heatmap-intensity': 1,
                'heatmap-color': [
                    'interpolate', ['linear'], ['heatmap-density'],
                    0, 'rgba(33,102,172,0)',
                    0.2, 'rgb(103,169,207)',
                    0.4, 'rgb(209,229,240)',
                    0.6, 'rgb(253,219,199)',
                    0.8, 'rgb(239,138,98)',
                    1, 'rgb(178,24,43)'
                ],
                'heatmap-radius': 20,
                'heatmap-opacity': 0.8
            }
        });
    }

  }, [points]);

  return <div ref={mapContainer} className="w-full h-[500px] rounded-lg border shadow-sm" />;
};

export default HeatmapDashboard;
