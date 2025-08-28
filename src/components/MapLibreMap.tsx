import { useEffect, useRef } from "react";
// MapLibre se importa de forma dinámica para evitar errores en entornos donde
// la librería no esté disponible completamente o falten métodos como `on`.
import "maplibre-gl/dist/maplibre-gl.css";
import { safeOn, assertEventSource } from "@/utils/safeOn";

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
  // Referencias al mapa y al marcador; se tipan como `any` porque la librería
  // se carga dinámicamente y puede no estar presente en tiempo de ejecución.
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const apiKey = import.meta.env.VITE_MAPTILER_KEY;

  useEffect(() => {
    if (!ref.current || !apiKey) {
      if (!apiKey) {
        console.warn("MapLibreMap: missing VITE_MAPTILER_KEY; skipping map initialization.");
      }
      return;
    }
    let isMounted = true;
    (async () => {
      try {
        const mod = await import("maplibre-gl").catch((err) => {
          console.error("MapLibreMap: failed to load library", err);
          return null;
        });
        if (!isMounted || !mod || typeof (mod as any).Map !== "function") {
          console.error("MapLibreMap: Map constructor unavailable", mod);
          return;
        }
        const lib: any = (mod as any).default || mod;
        const map = new lib.Map({
          container: ref.current!,
          style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`,
          center: initialCenter,
          zoom: initialZoom,
        });

        const hasOn = typeof (map as any).on === "function";
        const hasRemove = typeof (map as any).remove === "function";
        if (!hasOn || !hasRemove) {
          console.error("MapLibreMap: map instance missing methods", map);
          try {
            map.remove?.();
          } catch (rmErr) {
            console.error("MapLibreMap: unable to cleanup incomplete map", rmErr);
          }
          return;
        }

        mapRef.current = map;
        assertEventSource(map, "map");

        try {
          map.addControl?.(new lib.NavigationControl(), "top-right");

          const clickHandler = (e: any) => {
            const { lng, lat } = e.lngLat || {};
            if (typeof lng === "number" && typeof lat === "number") {
              markerRef.current?.remove?.();
              markerRef.current = new lib.Marker().setLngLat([lng, lat]).addTo(map);
              onSelect?.(lat, lng);
            }
          };

          const styleImageMissingHandler = (e: any) => {
            const name = e.id;
            if (!name) {
              console.warn("Imagen faltante sin id válido");
              return;
            }
            const url = `/icons/${name}.png`;
            if (map.hasImage?.(name)) return;
            map.loadImage?.(url, (err: any, image: any) => {
              if (err || !image) {
                console.warn("No pude cargar icono", name, url, err);
                return;
              }
              map.addImage?.(name, image);
            });
          };

          const loadHandler = () => {
            map.loadImage?.("/icons/pin-blue.png", (err: any, image: any) => {
              if (!err && image && !map.hasImage?.("pin-blue")) {
                map.addImage?.("pin-blue", image);
              }
            });

            const sourceData = heatmapData
              ? {
                  type: "FeatureCollection",
                  features: heatmapData.map((p) => ({
                    type: "Feature",
                    properties: { weight: p.weight ?? 1 },
                    geometry: { type: "Point", coordinates: [p.lng, p.lat] },
                  })),
                }
              : "/api/puntos";

            map.addSource?.("puntos", {
              type: "geojson",
              data: sourceData as any,
            });

            map.addLayer?.({
              id: "tickets-circles",
              type: "circle",
              source: "puntos",
              paint: {
                "circle-radius": 6,
                "circle-color": "#3b82f6",
              },
            });
          };

          if (onSelect) {
            safeOn(map, "click", clickHandler);
          }
          safeOn(map, "styleimagemissing", styleImageMissingHandler);
          safeOn(map, "load", loadHandler);

          return () => {
            markerRef.current?.remove?.();
            map.off?.("click", clickHandler);
            map.off?.("styleimagemissing", styleImageMissingHandler);
            map.off?.("load", loadHandler);
            try {
              map.remove?.();
            } catch (err) {
              console.error("MapLibreMap: failed to remove map", err);
            }
          };
        } catch (err) {
          console.error("MapLibreMap: failed to configure map", err);
        }
      } catch (err) {
        console.error("Error initializing map", err);
      }
    })();
    return () => {
      isMounted = false;
      try {
        mapRef.current?.remove?.();
      } catch (err) {
        console.error("MapLibreMap: failed to remove map", err);
      }
    };
  }, [apiKey, initialCenter, initialZoom, heatmapData, onSelect]);

  useEffect(() => {
    if (!mapRef.current || typeof mapRef.current.getSource !== "function") return;
    const source = mapRef.current.getSource("puntos");
    if (!source || typeof (source as any).setData !== "function") return;
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
