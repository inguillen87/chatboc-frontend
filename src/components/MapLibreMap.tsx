import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import { GeocodingControl } from "@maptiler/geocoding-control/maplibregl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@maptiler/geocoding-control/style.css";

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

  useEffect(() => {
    const apiKey = import.meta.env.VITE_MAPTILER_KEY!;
    const map = new maplibregl.Map({
      container: ref.current!,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`,
      center: initialCenter,
      zoom: initialZoom,
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const geocoding = new GeocodingControl({
      apiKey,
      language: "es",
      country: "ar",
      placeholder: "Buscar dirección o lugar…",
      addMarker: true,
      keepOpen: false,
    });

    // `GeocodingControl` debería exponer un método `on`, pero algunas versiones
    // solo implementan `addEventListener`. Para evitar que la app se rompa cuando
    // no existe `on`, verificamos ambas opciones antes de registrar el evento.
    const handleSelect = (item: any) => {
      const [lon, lat] = item.geometry.coordinates as [number, number];
      const address = item.place_name ?? item.text;
      onSelect?.(lat, lon, address);
    };

    if (typeof (geocoding as any).on === "function") {
      (geocoding as any).on("select", handleSelect);
    } else if (typeof (geocoding as any).addEventListener === "function") {
      (geocoding as any).addEventListener("select", (e: any) =>
        handleSelect(e.detail)
      );
    }

    map.addControl(geocoding, "top-left");

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

    return () => map.remove();
  }, [initialCenter, initialZoom, heatmapData, onSelect]);

  useEffect(() => {
    if (!mapRef.current || !heatmapData) return;
    const source = mapRef.current.getSource("puntos") as maplibregl.GeoJSONSource;
    if (!source) return;
    const geojson = {
      type: "FeatureCollection",
      features: heatmapData.map((p) => ({
        type: "Feature",
        properties: { weight: p.weight ?? 1 },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      })),
    } as const;
    source.setData(geojson as any);
  }, [heatmapData]);

  return <div ref={ref} className="w-full h-[500px] rounded-2xl overflow-hidden" />;
}
