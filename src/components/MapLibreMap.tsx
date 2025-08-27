import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type HeatPoint = { lat: number; lng: number; weight?: number };

type Props = {
  initialCenter?: [number, number]; // [lon, lat]
  initialZoom?: number;
  onSelect?: (lat: number, lon: number, address?: string) => void;
  heatmapData?: HeatPoint[];
};

export default function MapLibreMap({
  initialCenter = [-68.845, -32.889],
  initialZoom = 12,
  onSelect,
  heatmapData,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      const apiKey = import.meta.env.VITE_MAPTILER_KEY!;
      const map = new maplibregl.Map({
        container: ref.current,
        style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`,
        center: initialCenter,
        zoom: initialZoom,
      });

      mapRef.current = map;

      map.addControl(new maplibregl.NavigationControl(), "top-right");

      if (onSelect) {
        map.on("click", (e) => {
          const { lng, lat } = e.lngLat;
          markerRef.current?.remove();
          markerRef.current = new maplibregl.Marker().setLngLat([lng, lat]).addTo(map);
          onSelect(lat, lng);
        });
      }

      map.on("styleimagemissing", (e) => {
        // Evita errores cuando una imagen no existe en el sprite.
        console.warn(`Imagen faltante en el estilo: "${e.id}"`);
      });

      map.on("load", () => {
        const sourceData = heatmapData
          ? {
              type: "FeatureCollection",
              features: heatmapData.map((p) => ({
                type: "Feature",
                properties: { weight: p.weight ?? 1 },
                geometry: {
                  type: "Point",
                  coordinates: [p.lng, p.lat],
                },
              })),
            }
          : "/api/puntos";

        map.addSource("puntos", {
          type: "geojson",
          data: sourceData as any,
        });

        map.addLayer({
          id: "heat",
          type: "heatmap",
          source: "puntos",
          maxzoom: 16,
          paint: {
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 16, 3],
            "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 10, 1],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 16, 35],
            "heatmap-opacity": 0.8,
          },
        });
      });

      return () => {
        markerRef.current?.remove();
        map.remove();
      };
    } catch (err) {
      console.error("Error initializing map", err);
    }
  }, [initialCenter, initialZoom, heatmapData, onSelect]);

  useEffect(() => {
    if (!mapRef.current) return;
    const source = mapRef.current.getSource("puntos") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    const features = (heatmapData ?? []).map((p) => ({
      type: "Feature",
      properties: { weight: p.weight ?? 1 },
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
    }));
    const geojson = { type: "FeatureCollection", features } as const;
    source.setData(geojson as any);
  }, [heatmapData]);

  return <div ref={ref} className="w-full h-[500px] rounded-2xl overflow-hidden" />;
}
