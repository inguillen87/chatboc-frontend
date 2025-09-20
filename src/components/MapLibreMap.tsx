import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import "maplibre-gl/dist/maplibre-gl.css";
import type { HeatPoint } from "@/services/statsService";
import type { Map, LngLatLike } from "maplibre-gl";

type Props = {
  center?: [number, number]; // [lon, lat]
  initialZoom?: number;
  onSelect?: (lat: number, lon: number, address?: string) => void;
  heatmapData?: HeatPoint[];
  showHeatmap?: boolean;
  marker?: [number, number];
  className?: string;
  provider?: "maplibre" | "google";
  adminLocation?: [number, number];
};

const addLayer = (map: Map, layer: any) => {
  if (!map.getLayer(layer.id)) {
    map.addLayer(layer);
  }
};

type MapLibreModule = typeof import("maplibre-gl");

declare global {
  interface Window {
    maplibregl?: MapLibreModule;
  }
}

const MAPLIBRE_VERSION = "4.7.1";
const CDN_SOURCES = [
  `https://cdn.maptiler.com/maplibre-gl-js/v${MAPLIBRE_VERSION}/maplibre-gl.js`,
  `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`,
];

let libraryPromise: Promise<MapLibreModule> | null = null;

const loadExternalScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Document is not available to load MapLibre"));
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-maplibre-loader="${src}"]`,
    );

    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }

    const script = existing ?? document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.maplibreLoader = src;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => {
      reject(new Error(`No se pudo cargar MapLibre desde ${src}`));
    };

    if (!existing) {
      document.head.appendChild(script);
    }
  });

const loadMapLibre = async (): Promise<MapLibreModule> => {
  if (typeof window === "undefined") {
    throw new Error("MapLibre solo puede inicializarse en el navegador");
  }

  if (window.maplibregl?.Map) {
    return window.maplibregl;
  }

  if (!libraryPromise) {
    libraryPromise = (async () => {
      try {
        const module = await import("maplibre-gl");
        const lib = (module as MapLibreModule & { default?: MapLibreModule }).default ?? module;
        if (lib?.Map) {
          window.maplibregl = lib;
          return lib;
        }
      } catch (err) {
        console.warn("Fallo la carga dinámica de maplibre-gl, se usará el CDN", err);
      }

      if (window.maplibregl?.Map) {
        return window.maplibregl;
      }

      for (const src of CDN_SOURCES) {
        try {
          await loadExternalScript(src);
          if (window.maplibregl?.Map) {
            return window.maplibregl;
          }
        } catch (cdnError) {
          console.warn(`Fallo la carga desde ${src}`, cdnError);
        }
      }

      throw new Error("MapLibre library failed to load");
    })();
  }

  try {
    const lib = await libraryPromise;
    return lib;
  } catch (error) {
    libraryPromise = null;
    throw error;
  }
};

const buildGeoJson = (points: HeatPoint[]) => ({
  type: "FeatureCollection",
  features: points.map((p) => ({
    type: "Feature",
    properties: {
      weight: p.weight ?? 1,
      id: p.id,
      ticket: p.ticket,
      categoria: p.categoria,
      direccion: p.direccion,
      distrito: p.distrito,
    },
    geometry: { type: "Point", coordinates: [p.lng, p.lat] },
  })),
});

const updateHeatmapSource = (map: Map, points: HeatPoint[]) => {
  const source = map.getSource("points");
  if (source && typeof (source as any).setData === "function") {
    (source as any).setData(buildGeoJson(points));
  }
};

const toggleLayers = (map: Map, showHeatmap: boolean) => {
  if (!map.getLayer("tickets-heat") || !map.getLayer("tickets-circles")) {
    return;
  }

  map.setLayoutProperty("tickets-heat", "visibility", showHeatmap ? "visible" : "none");
  map.setLayoutProperty("tickets-circles", "visibility", showHeatmap ? "none" : "visible");
};

export default function MapLibreMap({
  center,
  initialZoom = 12,
  onSelect,
  heatmapData = [],
  showHeatmap = true,
  marker,
  className,
  provider = "maplibre",
  adminLocation,
}: Props) {
  const [mapError, setMapError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const libRef = useRef<MapLibreModule | null>(null);
  const markerRef = useRef<any>(null);
  const adminMarkerRef = useRef<any>(null);
  const latestHeatmap = useRef<HeatPoint[]>(heatmapData);

  const apiKey = import.meta.env.VITE_MAPTILER_KEY;
  const apiKeyRef = useRef(apiKey);
  const centerRef = useRef(center);
  const showHeatmapRef = useRef(showHeatmap);
  const onSelectRef = useRef(onSelect);
  const initialZoomRef = useRef(initialZoom);

  useEffect(() => {
    apiKeyRef.current = apiKey;
  }, [apiKey]);

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  useEffect(() => {
    showHeatmapRef.current = showHeatmap;
  }, [showHeatmap]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    initialZoomRef.current = initialZoom;
  }, [initialZoom]);

  useEffect(() => {
    latestHeatmap.current = heatmapData;
  }, [heatmapData]);

  const shouldRenderGoogle =
    provider === "google" || (provider === "maplibre" && mapError !== null);

  const fallbackQuery = (() => {
    if (center && !Number.isNaN(center[0]) && !Number.isNaN(center[1])) {
      return `${center[1]},${center[0]}`;
    }
    if (marker && !Number.isNaN(marker[0]) && !Number.isNaN(marker[1])) {
      return `${marker[1]},${marker[0]}`;
    }
    if (adminLocation && !Number.isNaN(adminLocation[0]) && !Number.isNaN(adminLocation[1])) {
      return `${adminLocation[1]},${adminLocation[0]}`;
    }
    if (heatmapData.length > 0) {
      const totalWeight = heatmapData.reduce((sum, p) => sum + (p.weight ?? 1), 0);
      const divisor = totalWeight > 0 ? totalWeight : heatmapData.length;
      const avgLat =
        heatmapData.reduce((sum, p) => sum + p.lat * (p.weight ?? 1), 0) / divisor;
      const avgLng =
        heatmapData.reduce((sum, p) => sum + p.lng * (p.weight ?? 1), 0) / divisor;
      if (!Number.isNaN(avgLat) && !Number.isNaN(avgLng)) {
        return `${avgLat},${avgLng}`;
      }
    }
    return "Argentina";
  })();

  if (shouldRenderGoogle) {
    const url = `https://maps.google.com/maps?q=${encodeURIComponent(
      fallbackQuery,
    )}&z=${initialZoom}&output=embed`;
    const containerClassName = cn(
      "relative w-full rounded-2xl overflow-hidden",
      className,
      !className && "h-[500px]",
    );

    return (
      <div className={containerClassName}>
        <iframe
          src={url}
          className="h-full w-full border-0"
          loading="lazy"
          title="Mapa interactivo"
          referrerPolicy="no-referrer-when-downgrade"
        />
        {mapError && provider === "maplibre" && (
          <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-md bg-background/90 px-3 py-2 text-xs text-foreground shadow">
            No se pudo cargar MapLibre. Se muestra Google Maps como alternativa.
          </div>
        )}
      </div>
    );
  }

  useEffect(() => {
    if (provider !== "maplibre") {
      setMapError(null);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (adminMarkerRef.current) {
        adminMarkerRef.current.remove();
        adminMarkerRef.current = null;
      }
      return;
    }

    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    let isMounted = true;

    const initMap = async () => {
      try {
        const maplibre = await loadMapLibre();
        libRef.current = maplibre;

        if (!isMounted || !mapContainerRef.current) return;

        const key = apiKeyRef.current;
        const styleUrl = key
          ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}`
          : "https://demotiles.maplibre.org/style.json";

        const mapInstance = new maplibre.Map({
          container: mapContainerRef.current,
          style: styleUrl,
          center: centerRef.current ?? [0, 0],
          zoom: initialZoomRef.current,
        });

        mapRef.current = mapInstance;
        setMapError(null);

        if (typeof maplibre.NavigationControl === "function") {
          mapInstance.addControl(new maplibre.NavigationControl(), "top-right");
        }

        const handleLoad = () => {
          mapInstance.addSource("points", {
            type: "geojson",
            data: { type: "FeatureCollection", features: [] },
          });

          addLayer(mapInstance, {
            id: "tickets-heat",
            type: "heatmap",
            source: "points",
            maxzoom: 15,
            paint: {
              "heatmap-weight": ["get", "weight"],
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 9, 24],
              "heatmap-opacity": 0.65,
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(14,165,233,0)",
                0.3,
                "rgba(14,165,233,0.6)",
                0.6,
                "rgba(59,130,246,0.8)",
                1,
                "rgba(239,68,68,0.95)",
              ],
            },
          });

          addLayer(mapInstance, {
            id: "tickets-circles",
            type: "circle",
            source: "points",
            minzoom: 11,
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                11,
                4,
                16,
                12,
              ],
              "circle-color": "#2563eb",
              "circle-opacity": 0.9,
            },
          });

          toggleLayers(mapInstance, showHeatmapRef.current);
          updateHeatmapSource(mapInstance, latestHeatmap.current);
        };

        if (mapInstance.isStyleLoaded()) {
          handleLoad();
        } else {
          mapInstance.once("load", handleLoad);
        }

        const handleClick = (event: { lngLat: { lat: number; lng: number } }) => {
          const callback = onSelectRef.current;
          if (callback) {
            const { lng, lat } = event.lngLat;
            callback(lat, lng);
          }
        };

        const handleCircleClick = (e: any) => {
          if (!e.features?.length) return;
          const feature = e.features[0];
          const coords = (feature.geometry as any).coordinates.slice();
          const { id, ticket, categoria, direccion, distrito } = feature.properties || {};

          while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
            coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
          }

          const lines = [
            `<p>Ticket #${ticket ?? id}</p>`,
            categoria ? `<p>Categoría: ${categoria}</p>` : "",
            distrito ? `<p>Distrito: ${distrito}</p>` : "",
            direccion ? `<p>Dirección: ${direccion}</p>` : "",
            `<a href="/chat/${id}" class="text-blue-600 underline" target="_blank" rel="noopener noreferrer">Ver ticket</a>`,
          ].filter(Boolean);

          const popup = new maplibre.Popup();
          popup
            .setLngLat(coords as LngLatLike)
            .setHTML(`<div class="text-sm">${lines.join("")}</div>`)
            .addTo(mapInstance);
        };

        const handleMissingImage = (e: any) => {
          const id = e.id;
          if (!mapInstance.hasImage(id)) {
            const empty = { width: 1, height: 1, data: new Uint8Array([0, 0, 0, 0]) };
            mapInstance.addImage(id, empty as any);
          }
        };

        mapInstance.on("click", handleClick);
        mapInstance.on("click", "tickets-circles", handleCircleClick);
        mapInstance.on("styleimagemissing", handleMissingImage);

        return () => {
          mapInstance.off("click", handleClick);
          mapInstance.off("click", "tickets-circles", handleCircleClick);
          mapInstance.off("styleimagemissing", handleMissingImage);
        };
      } catch (error) {
        console.error("Failed to initialize map:", error);
        setMapError(error instanceof Error ? error.message : "No se pudo cargar el mapa");
      }

      return undefined;
    };

    const cleanupEventsPromise = initMap();

    return () => {
      isMounted = false;
      if (cleanupEventsPromise) {
        cleanupEventsPromise
          .then((cleanup) => {
            if (cleanup) {
              cleanup();
            }
          })
          .catch(() => undefined);
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (adminMarkerRef.current) {
        adminMarkerRef.current.remove();
        adminMarkerRef.current = null;
      }
    };
  }, [provider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || provider !== "maplibre") return;

    if (center && !Number.isNaN(center[0]) && !Number.isNaN(center[1])) {
      map.flyTo({ center, zoom: initialZoom });
    }
  }, [center, initialZoom, provider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || provider !== "maplibre") return;

    const applyData = () => updateHeatmapSource(map, heatmapData);
    const source = map.getSource("points");
    if (source && typeof (source as any).setData === "function") {
      applyData();
      return;
    }

    map.once("load", applyData);
    return () => {
      map.off("load", applyData);
    };
  }, [heatmapData, provider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || provider !== "maplibre") return;

    if (!map.getLayer("tickets-heat") || !map.getLayer("tickets-circles")) {
      const handler = () => toggleLayers(map, showHeatmap);
      map.once("load", handler);
      return () => {
        map.off("load", handler);
      };
    }

    toggleLayers(map, showHeatmap);
  }, [showHeatmap, provider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showHeatmap || provider !== "maplibre") return;
    let frame: number;

    const animate = () => {
      const t = (Date.now() % 2000) / 2000;
      const intensity = 1 + 0.5 * Math.sin(t * Math.PI * 2);
      map.setPaintProperty("tickets-heat", "heatmap-intensity", intensity);
      frame = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(frame);
  }, [showHeatmap, provider]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = libRef.current;
    if (!map || provider !== "maplibre") return;
    if (marker) {
      if (markerRef.current) {
        markerRef.current.setLngLat(marker);
      } else if (maplibre) {
        const el = document.createElement("div");
        el.className = "home-marker";
        el.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        `;
        markerRef.current = new maplibre.Marker({ element: el })
          .setLngLat(marker)
          .addTo(map);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [marker, provider]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = libRef.current;
    if (!map || provider !== "maplibre") {
      if (adminMarkerRef.current) {
        adminMarkerRef.current.remove();
        adminMarkerRef.current = null;
      }
      return;
    }

    if (adminLocation) {
      if (adminMarkerRef.current) {
        adminMarkerRef.current.setLngLat(adminLocation);
      } else if (maplibre) {
        const popup =
          typeof maplibre.Popup === "function"
            ? new maplibre.Popup({ offset: 12 }).setHTML(
                '<div class="text-sm font-medium">Ubicación del administrador</div>',
              )
            : undefined;

        const marker = new maplibre.Marker({ color: "#059669" }).setLngLat(adminLocation);
        if (popup) {
          marker.setPopup(popup);
        }
        adminMarkerRef.current = marker.addTo(map);
      }
    } else if (adminMarkerRef.current) {
      adminMarkerRef.current.remove();
      adminMarkerRef.current = null;
    }
  }, [adminLocation, provider]);

  return (
    <div
      ref={mapContainerRef}
      className={cn(
        "relative w-full rounded-2xl overflow-hidden",
        className,
        !className && "h-[500px]",
      )}
    />
  );
}
