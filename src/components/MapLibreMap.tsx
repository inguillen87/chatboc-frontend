import { useEffect, useRef } from "react";
// MapLibre se importa de forma dinámica para evitar errores en entornos donde
// la librería no esté disponible completamente o falten métodos como `on`.
// Intentamos importar el bundle de MapLibre de manera dinámica. Si no está
// disponible (por ejemplo, cuando la dependencia no pudo instalarse), se
// cargará desde un CDN junto con su hoja de estilos.
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
        let lib: any = null;

        async function loadFromCDN() {
          const existing = (window as any).maplibregl;
          if (existing) return existing;

          const scriptUrl = "https://unpkg.com/maplibre-gl@3.5.2/dist/maplibre-gl.js";
          const cssUrl = "https://unpkg.com/maplibre-gl@3.5.2/dist/maplibre-gl.css";

          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = scriptUrl;
            script.onload = () => resolve();
            script.onerror = () => reject();
            document.head.appendChild(script);
          }).catch((cdnErr) => {
            console.error("MapLibreMap: CDN script load failed", cdnErr);
          });

          if (!document.querySelector(`link[href="${cssUrl}"]`)) {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = cssUrl;
            document.head.appendChild(link);
          }

          return (window as any).maplibregl || null;
        }

        try {
          const mod = await import("maplibre-gl");
          lib = (mod as any).default || mod;
        } catch (err) {
          console.error("MapLibreMap: failed to load library", err);
          lib = await loadFromCDN();
        }

        if (!isMounted || !lib || typeof lib.Map !== "function") {
          console.error("MapLibreMap: Map constructor unavailable", lib);
          return;
        }
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
            const raw = e.id as string | undefined;
            if (!raw || !raw.trim()) {
              // El estilo solicitó una imagen sin nombre válido: añadimos un pixel transparente
              // para evitar que MapLibre siga registrando errores en consola.
              const key = raw ?? "";
              if (!map.hasImage?.(key)) {
                const empty = { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 0]) };
                try {
                  map.addImage?.(key, empty as any);
                } catch (imgErr) {
                  console.warn("No se pudo agregar imagen vacía", imgErr);
                }
              }
              return;
            }
            const name = raw.trim();
            if (map.hasImage?.(name)) return;
            const url = `/icons/${name}.png`;
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
              id: "tickets-heat",
              type: "heatmap",
              source: "puntos",
              maxzoom: 15,
              paint: {
                "heatmap-weight": ["get", "weight"],
                "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3],
                "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 9, 20],
                "heatmap-opacity": 0.6,
              },
            });

            map.addLayer?.({
              id: "tickets-circles",
              type: "circle",
              source: "puntos",
              minzoom: 14,
              paint: {
                "circle-radius": 6,
                "circle-color": "#3b82f6",
                "circle-opacity": 0.9,
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
