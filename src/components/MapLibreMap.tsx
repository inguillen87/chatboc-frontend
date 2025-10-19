import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import "maplibre-gl/dist/maplibre-gl.css";
import type { HeatPoint } from "@/services/statsService";
import type { Map, LngLatLike } from "maplibre-gl";
import { GoogleHeatmapMap } from "@/components/GoogleHeatmapMap";
import type { MapProvider, MapProviderUnavailableReason } from "@/hooks/useMapProvider";

type Props = {
  center?: [number, number]; // [lon, lat]
  initialZoom?: number;
  onSelect?: (lat: number, lon: number, address?: string) => void;
  heatmapData?: HeatPoint[];
  showHeatmap?: boolean;
  marker?: [number, number];
  className?: string;
  provider?: MapProvider;
  adminLocation?: [number, number];
  fitToBounds?: [number, number][];
  boundsPadding?: number | { top?: number; bottom?: number; left?: number; right?: number };
  onBoundingBoxChange?: (bbox: [number, number, number, number] | null) => void;
  onProviderUnavailable?: (
    provider: MapProvider,
    reason: MapProviderUnavailableReason,
    details?: unknown,
  ) => void;
};

const addLayer = (map: Map, layer: any) => {
  if (!map.getLayer(layer.id)) {
    map.addLayer(layer);
  }
};

const FALLBACK_MESSAGES: Record<MapProviderUnavailableReason, string> = {
  "missing-api-key": "Google Maps no está configurado. Cambiamos automáticamente a MapLibre.",
  "load-error": "No se pudo cargar Google Maps. Cambiamos automáticamente a MapLibre.",
  "heatmap-unavailable": "Google Maps dejó de ofrecer mapas de calor. Cambiamos automáticamente a MapLibre.",
};

type MapLibreModule = typeof import("maplibre-gl");

declare global {
  interface Window {
    maplibregl?: MapLibreModule;
  }
}

let cachedMapLibre: MapLibreModule | null = null;
let maplibrePromise: Promise<MapLibreModule> | null = null;

const loadMapLibre = async (): Promise<MapLibreModule> => {
  if (typeof window === "undefined") {
    throw new Error("MapLibre solo puede inicializarse en el navegador");
  }

  if (cachedMapLibre?.Map) {
    return cachedMapLibre;
  }

  if (window.maplibregl?.Map) {
    cachedMapLibre = window.maplibregl;
    return window.maplibregl;
  }

  if (!maplibrePromise) {
    maplibrePromise = import("maplibre-gl")
      .then((module) => {
        const lib = (module as MapLibreModule & { default?: MapLibreModule }).default ?? module;
        if (!lib?.Map) {
          throw new Error("MapLibre library failed to load");
        }
        window.maplibregl = lib;
        cachedMapLibre = lib;
        return lib;
      })
      .catch((error) => {
        maplibrePromise = null;
        throw error;
      });
  }

  return maplibrePromise;
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
  fitToBounds,
  boundsPadding,
  onBoundingBoxChange,
  onProviderUnavailable,
}: Props) {
  const [mapError, setMapError] = useState<string | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [providerOverride, setProviderOverride] = useState<MapProvider | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const libRef = useRef<MapLibreModule | null>(null);
  const markerRef = useRef<any>(null);
  const adminMarkerRef = useRef<any>(null);
  const latestHeatmap = useRef<HeatPoint[]>(heatmapData);
  const boundingBoxCallbackRef = useRef<Props['onBoundingBoxChange']>(onBoundingBoxChange);

  const effectiveProvider = providerOverride ?? provider;

  useEffect(() => {
    setProviderOverride(null);
    setFallbackMessage(null);
  }, [provider]);

  const handleProviderUnavailable = useCallback(
    (reason: MapProviderUnavailableReason, details?: unknown) => {
      setProviderOverride("maplibre");
      setFallbackMessage(FALLBACK_MESSAGES[reason] ?? FALLBACK_MESSAGES["load-error"]);
      setMapError(null);
      onProviderUnavailable?.("google", reason, details);
    },
    [onProviderUnavailable],
  );

  if (effectiveProvider === "google") {
    return (
      <GoogleHeatmapMap
        center={center}
        initialZoom={initialZoom}
        onSelect={onSelect}
        heatmapData={heatmapData}
        showHeatmap={showHeatmap}
        marker={marker}
        className={className}
        adminLocation={adminLocation}
        fitToBounds={fitToBounds}
        boundsPadding={boundsPadding}
        onBoundingBoxChange={onBoundingBoxChange}
        onProviderUnavailable={handleProviderUnavailable}
      />
    );
  }

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

  useEffect(() => {
    boundingBoxCallbackRef.current = onBoundingBoxChange;
  }, [onBoundingBoxChange]);

  useEffect(() => {
    setMapError(null);
  }, [provider, effectiveProvider]);

  useEffect(() => {
    if (effectiveProvider !== "maplibre") {
      return;
    }

    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    let isMounted = true;

    const initMap = async () => {
      try {
        setMapError(null);
        const maplibre = await loadMapLibre();
        libRef.current = maplibre;

        if (!isMounted || !mapContainerRef.current) return;

        const key = apiKeyRef.current;
        const styleCandidates = [
          key ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}` : null,
          "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
          "https://tiles.stadiamaps.com/styles/alidade_smooth.json",
          "https://demotiles.maplibre.org/style.json",
        ].filter((value): value is string => typeof value === "string" && value.length > 0);

        let currentStyleIndex = 0;
        let exhaustedStyles = false;

        const initialStyle = styleCandidates[0] ?? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

        const mapInstance = new maplibre.Map({
          container: mapContainerRef.current,
          style: initialStyle,
          center: centerRef.current ?? [0, 0],
          zoom: initialZoomRef.current,
        });

        mapRef.current = mapInstance;

        if (typeof maplibre.NavigationControl === "function") {
          mapInstance.addControl(new maplibre.NavigationControl(), "top-right");
        }

        const ensureSourcesAndLayers = () => {
          if (!mapRef.current) {
            return;
          }

          const map = mapRef.current;
          setMapError(null);

          if (!map.getSource("points")) {
            map.addSource("points", {
              type: "geojson",
              data: { type: "FeatureCollection", features: [] },
            });
          }

          addLayer(map, {
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

          addLayer(map, {
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

          toggleLayers(map, showHeatmapRef.current);
          updateHeatmapSource(map, latestHeatmap.current);
        };

        const cycleStyle = (reason?: string) => {
          if (exhaustedStyles || styleCandidates.length === 0) {
            return;
          }

          if (currentStyleIndex < styleCandidates.length - 1) {
            currentStyleIndex += 1;
            const nextStyle = styleCandidates[currentStyleIndex];
            console.warn("[MapLibreMap] Falling back to alternate style", {
              nextStyle,
              reason,
            });
            mapInstance.setStyle(nextStyle);
          } else {
            exhaustedStyles = true;
            setMapError(
              "No se pudieron cargar los estilos del mapa. Verificá la clave de MapTiler o la conexión de red.",
            );
          }
        };

        const handleStyleError = (event: any) => {
          if (exhaustedStyles) return;
          const resourceType = event?.resourceType;
          const status = event?.error?.status ?? event?.error?.code;
          const message = event?.error?.message;
          const shouldFallback =
            resourceType === "style" ||
            resourceType === "source" ||
            resourceType === "sprite" ||
            resourceType === "tile" ||
            status === 401 ||
            status === 403 ||
            status === 404 ||
            status === 0;

          if (shouldFallback) {
            cycleStyle(typeof message === "string" ? message : String(status ?? "unknown"));
          }
        };

        mapInstance.on("load", ensureSourcesAndLayers);
        mapInstance.on("style.load", ensureSourcesAndLayers);
        mapInstance.on("error", handleStyleError);

        if (mapInstance.isStyleLoaded()) {
          ensureSourcesAndLayers();
        }

        const handleClick = (event: { lngLat: { lat: number; lng: number } }) => {
          const callback = onSelectRef.current;
          if (callback) {
            const { lng, lat } = event.lngLat;
            callback(lat, lng);
          }
        };

        const emitBoundingBox = () => {
          const callback = boundingBoxCallbackRef.current;
          if (!callback || typeof mapInstance.getBounds !== "function") return;
          const bounds = mapInstance.getBounds();
          if (!bounds) return;
          callback([
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth(),
          ]);
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
        if (boundingBoxCallbackRef.current) {
          mapInstance.on("boxzoomend", emitBoundingBox);
        }

        return () => {
          mapInstance.off("click", handleClick);
          mapInstance.off("click", "tickets-circles", handleCircleClick);
          mapInstance.off("styleimagemissing", handleMissingImage);
          if (boundingBoxCallbackRef.current) {
            mapInstance.off("boxzoomend", emitBoundingBox);
          }
          mapInstance.off("load", ensureSourcesAndLayers);
          mapInstance.off("style.load", ensureSourcesAndLayers);
          mapInstance.off("error", handleStyleError);
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
  }, [effectiveProvider, provider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || effectiveProvider !== "maplibre") return;

    if (center && !Number.isNaN(center[0]) && !Number.isNaN(center[1])) {
      map.flyTo({ center, zoom: initialZoomRef.current });
    }
  }, [center, effectiveProvider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || effectiveProvider !== "maplibre") return;

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
  }, [heatmapData, effectiveProvider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || effectiveProvider !== "maplibre") return;

    if (!map.getLayer("tickets-heat") || !map.getLayer("tickets-circles")) {
      const handler = () => toggleLayers(map, showHeatmap);
      map.once("load", handler);
      return () => {
        map.off("load", handler);
      };
    }

    toggleLayers(map, showHeatmap);
  }, [showHeatmap, effectiveProvider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showHeatmap || effectiveProvider !== "maplibre") return;
    let frame: number;

    const animate = () => {
      const t = (Date.now() % 2000) / 2000;
      const intensity = 1 + 0.5 * Math.sin(t * Math.PI * 2);
      map.setPaintProperty("tickets-heat", "heatmap-intensity", intensity);
      frame = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(frame);
  }, [showHeatmap, effectiveProvider]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = libRef.current;
    if (!map || effectiveProvider !== "maplibre") return;
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
  }, [marker, effectiveProvider]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = libRef.current;
    if (!map || effectiveProvider !== "maplibre") {
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

        const markerInstance = new maplibre.Marker({ color: "#059669" }).setLngLat(adminLocation);
        if (popup) {
          markerInstance.setPopup(popup);
        }
        adminMarkerRef.current = markerInstance.addTo(map);

        const markerElement = adminMarkerRef.current.getElement();
        if (markerElement) {
          markerElement.style.zIndex = "10";
        }
      }
    } else if (adminMarkerRef.current) {
      adminMarkerRef.current.remove();
      adminMarkerRef.current = null;
    }
  }, [adminLocation, effectiveProvider]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = libRef.current;
    if (!map || effectiveProvider !== "maplibre") return;

    const coords = (fitToBounds ?? []).filter(
      (value): value is [number, number] =>
        Array.isArray(value) &&
        value.length === 2 &&
        Number.isFinite(value[0]) &&
        Number.isFinite(value[1]),
    );

    if (!coords.length) {
      return;
    }

    const applyBounds = () => {
      if (coords.length === 1) {
        map.flyTo({ center: coords[0], zoom: initialZoomRef.current });
        return;
      }

      if (maplibre?.LngLatBounds) {
        const bounds = coords.slice(1).reduce(
          (acc, coord) => acc.extend(coord),
          new maplibre.LngLatBounds(coords[0], coords[0]),
        );

        const samePoint =
          typeof bounds.getNorth === "function" &&
          bounds.getNorth() === bounds.getSouth() &&
          bounds.getEast() === bounds.getWest();

        if (samePoint && typeof bounds.getCenter === "function") {
          map.flyTo({ center: bounds.getCenter().toArray() as [number, number], zoom: initialZoomRef.current });
          return;
        }

        try {
          map.fitBounds(bounds, {
            padding: boundsPadding ?? 48,
            duration: 1000,
          });
          return;
        } catch (err) {
          console.warn("No se pudo ajustar el mapa a los límites proporcionados", err);
        }
      }

      map.flyTo({ center: coords[0], zoom: initialZoomRef.current });
    };

    if (map.isStyleLoaded()) {
      applyBounds();
    } else {
      map.once("load", applyBounds);
      return () => {
        map.off("load", applyBounds);
      };
    }
  }, [fitToBounds, boundsPadding, effectiveProvider]);

  const containerClassName = cn(
    "relative w-full rounded-2xl overflow-hidden",
    className,
    !className && "h-[500px]",
  );

  return (
    <div className={containerClassName}>
      <div ref={mapContainerRef} className="absolute inset-0" />
      {fallbackMessage && (
        <div className="absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-md bg-background/90 px-3 py-2 text-xs text-foreground shadow">
          {fallbackMessage}
        </div>
      )}
      {mapError && (
        <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-md bg-background/90 px-3 py-2 text-xs text-foreground shadow">
          No se pudo cargar el mapa: {mapError}
        </div>
      )}
    </div>
  );
}
