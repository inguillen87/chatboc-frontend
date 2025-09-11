import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
// Importar el CSS garantiza que los estilos estén disponibles incluso si la
// librería se carga de manera dinámica más adelante.
import "maplibre-gl/dist/maplibre-gl.css";
import { safeOn, assertEventSource } from "@/utils/safeOn";

type HeatPoint = {
  lat: number;
  lng: number;
  weight?: number;
  id?: number;
  ticket?: string;
  estado?: string;
};

type Props = {
  center?: [number, number]; // [lon, lat]
  initialZoom?: number;
  onSelect?: (lat: number, lon: number, address?: string) => void;
  heatmapData?: HeatPoint[];
  /**
   * When true the heatmap layer is shown, otherwise points are rendered as circles.
   */
  showHeatmap?: boolean;
  className?: string;
};

export default function MapLibreMap({
  center,
  initialZoom = 12,
  onSelect,
  heatmapData,
  showHeatmap = true,
  className,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Referencias al mapa y al marcador; se tipan como `any` porque la librería
  // se carga dinámicamente y puede no estar presente en tiempo de ejecución.
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const libRef = useRef<any>(null);
  const apiKey = import.meta.env.VITE_MAPTILER_KEY;
  const initialCenter = center ?? [0, 0];

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    if (!apiKey) {
      console.warn(
        "MapLibreMap: missing VITE_MAPTILER_KEY; using public demo tiles."
      );
    }
      let isMounted = true;
      // Handlers are declared in the outer scope so they can be cleaned up on unmount
      let clickHandler: any;
      let styleImageMissingHandler: any;
      let loadHandler: any;

      const init = async () => {
        async function loadLocal() {
          try {
            const libMod = await import("maplibre-gl");
            const workerMod = await import(
              "maplibre-gl/dist/maplibre-gl-csp-worker"
            );
            const lib = (libMod as any).default || libMod;
            const worker = (workerMod as any).default || workerMod;
            if (worker) {
              if ("workerClass" in lib) {
                (lib as any).workerClass = worker;
              } else if (typeof (lib as any).setWorkerClass === "function") {
                (lib as any).setWorkerClass(worker);
              }
            }
            return lib;
          } catch (err) {
            console.error("MapLibreMap: failed to load local library", err);
            return null;
          }
        }

        async function loadFromCDN() {
          const existing = (window as any).maplibregl;
          if (existing) return existing;

          const scriptUrl = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
          const cssUrl = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";

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

        loadLocal()
          .catch(() => null)
          .then(async (loaded) => {
            let lib = loaded;
            if (!lib || typeof lib.Map !== "function") {
              lib = await loadFromCDN();
            }

            if (!isMounted || !lib || typeof lib.Map !== "function") {
              console.error("MapLibreMap: Map constructor unavailable", lib);
              return;
            }

            const styleUrl = apiKey
              ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`
              : "https://demotiles.maplibre.org/style.json";

            const map = new lib.Map({
              container: ref.current!,
              style: styleUrl,
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
            libRef.current = lib;
            assertEventSource(map, "map");
            safeOn(map, "error", (e) => {
              console.error(
                "MapLibreMap: style or runtime error",
                (e as any)?.error ?? e
              );
              // Evita que MapLibre eleve el error y detenga la carga del mapa
              (e as any)?.preventDefault?.();
            });

            try {
              if (typeof lib.NavigationControl === "function") {
                map.addControl?.(new lib.NavigationControl(), "top-right");
              }

              clickHandler = (e: any) => {
                const { lng, lat } = e.lngLat || {};
                if (typeof lng === "number" && typeof lat === "number") {
                  markerRef.current?.remove?.();
                  markerRef.current = new lib.Marker()
                    .setLngLat([lng, lat])
                    .addTo(map);
                  onSelect?.(lat, lng);
                }
              };

              styleImageMissingHandler = (e: any) => {
                const name = (e.id as string | undefined)?.trim() ?? "";
                // Evita llamadas inválidas cuando el nombre viene vacío
                if (!name || map.hasImage?.(name)) return;
                // Si el estilo solicita un icono que no tenemos disponible,
                // agregamos un pixel transparente para evitar errores fatales.
                const empty = {
                  width: 1,
                  height: 1,
                  data: new Uint8Array([0, 0, 0, 0]),
                };
                try {
                  map.addImage?.(name, empty as any);
                } catch (imgErr) {
                  console.warn("No se pudo agregar imagen vacía", imgErr);
                }
              };

              loadHandler = () => {
                // Solo agregamos la capa de calor si se proporcionan datos.
                if (heatmapData && heatmapData.length > 0) {
                  const sourceData = {
                    type: "FeatureCollection",
                    features: heatmapData.map((p) => ({
                      type: "Feature",
                      properties: {
                        weight:
                          p.weight ?? (p.estado?.toLowerCase() === "resuelto" ? 2 : 1),
                      },
                      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
                    })),
                  } as const;

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
                      "heatmap-intensity": [
                        "interpolate",
                        ["linear"],
                        ["zoom"],
                        0,
                        1,
                        15,
                        3,
                      ],
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
                }
              };

              if (onSelect) {
                safeOn(map, "click", clickHandler);
              }
              safeOn(map, "styleimagemissing", styleImageMissingHandler);
              safeOn(map, "load", loadHandler);
            } catch (err) {
              console.error("MapLibreMap: failed to configure map", err);
            }
          });
        };

        init();
      return () => {
        isMounted = false;
        // Remove marker and all event listeners safely
        markerRef.current?.remove?.();
        const map = mapRef.current;
        map?.off?.("click", clickHandler);
      map?.off?.("styleimagemissing", styleImageMissingHandler);
      map?.off?.("load", loadHandler);
      try {
        map?.remove?.();
      } catch (err) {
        console.error("MapLibreMap: failed to remove map", err);
      }
    };
    }, [apiKey, initialZoom, onSelect]);

  // Allow external components to re-center the map after initialization
  useEffect(() => {
    if (
      mapRef.current &&
      center &&
      typeof center[0] === "number" &&
      typeof center[1] === "number" &&
      !Number.isNaN(center[0]) &&
      !Number.isNaN(center[1])
    ) {
      try {
        mapRef.current.setCenter(center);
      } catch (err) {
        console.error("MapLibreMap: failed to set center", err);
      }
    }
  }, [center]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const features = (heatmapData ?? []).map((p) => ({
      type: "Feature",
      properties: {
        weight: p.weight ?? (p.estado?.toLowerCase() === 'resuelto' ? 2 : 1),
        id: p.id,
        ticket: p.ticket,
      },
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
    }));
    const geojson = { type: "FeatureCollection", features } as const;

    let source = map.getSource("puntos") as any;
    if (!source) {
      map.addSource?.("puntos", { type: "geojson", data: geojson as any });
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
        layout: { visibility: showHeatmap ? "visible" : "none" },
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
        layout: { visibility: showHeatmap ? "none" : "visible" },
      });
      map.on?.("click", "tickets-circles", (e: any) => {
        const feature = e.features?.[0];
        const coords = feature?.geometry?.coordinates;
        if (!feature || !coords || !libRef.current?.Popup) return;
        const { id, ticket } = feature.properties || {};
        new libRef.current.Popup()
          .setLngLat(coords as [number, number])
          .setHTML(
            `<div class="text-sm"><p>Ticket #${ticket ?? id}</p><a href="/chat/${id}" class="text-blue-600 underline">Ver ticket</a></div>`
          )
          .addTo(map);
      });
      source = map.getSource("puntos") as any;
    }
    source?.setData?.(geojson as any);
    if (map.getLayer?.("tickets-heat")) {
      map.setLayoutProperty(
        "tickets-heat",
        "visibility",
        showHeatmap ? "visible" : "none"
      );
    }
    if (map.getLayer?.("tickets-circles")) {
      map.setLayoutProperty(
        "tickets-circles",
        "visibility",
        showHeatmap ? "none" : "visible"
      );
    }
  }, [heatmapData, showHeatmap]);

  // Update visibility if toggle changes but data already rendered
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    if (map.getLayer?.("tickets-heat")) {
      map.setLayoutProperty(
        "tickets-heat",
        "visibility",
        showHeatmap ? "visible" : "none"
      );
    }
    if (map.getLayer?.("tickets-circles")) {
      map.setLayoutProperty(
        "tickets-circles",
        "visibility",
        showHeatmap ? "none" : "visible"
      );
    }
  }, [showHeatmap]);

  return (
    <div
      ref={ref}
      className={cn("w-full rounded-2xl overflow-hidden", className ?? "h-[500px]")}
    />
  );
}
