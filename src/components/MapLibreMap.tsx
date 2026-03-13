import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import "maplibre-gl/dist/maplibre-gl.css";
import type { HeatPoint } from "@/services/statsService";
import type { Map, LngLatLike } from "maplibre-gl";
import { GoogleHeatmapMap } from "@/components/GoogleHeatmapMap";
import type { MapProvider, MapProviderUnavailableReason } from "@/hooks/useMapProvider";
import { clusterHeatmapPoints } from "@/utils/heatmap";
import { trackFrontendEvent } from "@/utils/frontendTelemetry";

type Props = {
  center?: [number, number]; // [lon, lat]
  initialZoom?: number;
  onSelect?: (lat: number, lon: number, address?: string) => void;
  heatmapData?: HeatPoint[];
  polygons?: { type: "FeatureCollection"; features: any[] };
  showHeatmap?: boolean;
  showPolygons?: boolean;
  marker?: [number, number];
  className?: string;
  provider?: MapProvider;
  mapStyleUrl?: string | null;
  mapTileUrl?: string | null;
  mapTileAttribution?: string | null;
  maptilerKey?: string | null;
  googleMapsKey?: string | null;
  geoLayerConfig?: {
    contract_version?: string;
    style_url?: string;
    source?: unknown;
    source_options?: Record<string, unknown>;
    interactions?: {
      hover?: boolean;
      time_slider?: {
        enabled?: boolean;
        field?: string;
      };
    };
    layers?: {
      heatmap?: { id?: string };
      clusters?: { id?: string };
      points?: { id?: string };
    };
    telemetry?: {
      event_endpoint?: string;
      events?: string[];
    };
  } | null;
  adminLocation?: [number, number];
  fitToBounds?: [number, number][];
  boundsPadding?: number | { top?: number; bottom?: number; left?: number; right?: number };
  onBoundingBoxChange?: (bbox: [number, number, number, number] | null) => void;
  onProviderUnavailable?: (
    provider: MapProvider,
    reason: MapProviderUnavailableReason,
    details?: unknown,
  ) => void;
  disableClientClustering?: boolean;
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
      weight: p.totalWeight ?? p.weight ?? 1,
      intensity: p.intensity ?? p.totalWeight ?? p.weight ?? 1,
      id: p.id,
      ticket: p.ticket,
      categoria: p.categoria,
      categoryColor: p.categoryColor,
      direccion: p.direccion,
      distrito: p.distrito,
      barrio: p.barrio,
      estado: p.estado,
      tipo_ticket: p.tipo_ticket,
      severidad: p.severidad,
      last_ticket_at: p.last_ticket_at ?? null,
      clusterId: p.clusterId ?? null,
      clusterSize: p.clusterSize ?? 1,
      averageWeight: p.averageWeight ?? p.weight ?? 1,
      totalWeight: p.totalWeight ?? p.weight ?? 1,
      radiusMeters: p.radiusMeters ?? null,
      maxDistanceMeters: p.maxDistanceMeters ?? null,
      sampleTickets: p.sampleTickets ?? [],
      aggregatedCategorias: p.aggregatedCategorias ?? [],
      aggregatedBarrios: p.aggregatedBarrios ?? [],
      aggregatedEstados: p.aggregatedEstados ?? [],
      aggregatedTipos: p.aggregatedTipos ?? [],
      aggregatedSeveridades: p.aggregatedSeveridades ?? [],
    },
    geometry: { type: "Point", coordinates: [p.lng, p.lat] },
  })),
});

const isFeatureCollection = (value: unknown): value is { type: "FeatureCollection"; features: unknown[] } => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.type === "FeatureCollection" && Array.isArray(record.features);
};

const updateHeatmapSource = (map: Map, points: HeatPoint[]) => {
  const source = map.getSource("points");
  if (source && typeof (source as any).setData === "function") {
    (source as any).setData(buildGeoJson(points));
  }
};

const toggleLayers = (
  map: Map,
  showHeatmap: boolean,
  showPolygons: boolean,
  layerIds: { heat: string; circles: string },
) => {
  if (map.getLayer(layerIds.heat)) {
    map.setLayoutProperty(
      layerIds.heat,
      "visibility",
      showHeatmap && !showPolygons ? "visible" : "none",
    );
  }
  if (map.getLayer(layerIds.circles)) {
    map.setLayoutProperty(
      layerIds.circles,
      "visibility",
      !showHeatmap && !showPolygons ? "visible" : "none",
    );
  }
  if (map.getLayer("polygons-fill")) {
    map.setLayoutProperty("polygons-fill", "visibility", showPolygons ? "visible" : "none");
  }
  if (map.getLayer("polygons-outline")) {
    map.setLayoutProperty("polygons-outline", "visibility", showPolygons ? "visible" : "none");
  }
};

export default function MapLibreMap({
  center,
  initialZoom = 12,
  onSelect,
  heatmapData = [],
  polygons,
  showHeatmap = true,
  showPolygons = false,
  marker,
  className,
  provider = "maplibre",
  mapStyleUrl,
  mapTileUrl,
  mapTileAttribution,
  maptilerKey,
  googleMapsKey,
  geoLayerConfig,
  adminLocation,
  fitToBounds,
  boundsPadding,
  onBoundingBoxChange,
  onProviderUnavailable,
  disableClientClustering = false,
}: Props) {
  const [mapError, setMapError] = useState<string | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [providerOverride, setProviderOverride] = useState<MapProvider | null>(null);
  const normalizedHeatmap = useMemo(
    () =>
      (heatmapData ?? []).filter(
        (point): point is HeatPoint & { lat: number; lng: number } =>
          Boolean(point) && Number.isFinite(point.lat) && Number.isFinite(point.lng),
      ),
    [heatmapData],
  );
  const aggregatedHint = useMemo(
    () =>
      normalizedHeatmap.some(
        (point) =>
          (typeof point.clusterSize === "number" && point.clusterSize > 1) ||
          Boolean(point.clusterId) ||
          (Array.isArray(point.sampleTickets) && point.sampleTickets.length > 0) ||
          (Array.isArray(point.aggregatedCategorias) && point.aggregatedCategorias.length > 0) ||
          (Array.isArray(point.aggregatedEstados) && point.aggregatedEstados.length > 0) ||
          (Array.isArray(point.aggregatedTipos) && point.aggregatedTipos.length > 0) ||
          (Array.isArray(point.aggregatedBarrios) && point.aggregatedBarrios.length > 0) ||
          (Array.isArray(point.aggregatedSeveridades) && point.aggregatedSeveridades.length > 0),
      ),
    [normalizedHeatmap],
  );
  const shouldCluster = useMemo(
    () => !disableClientClustering && !aggregatedHint,
    [disableClientClustering, aggregatedHint],
  );
  const processedHeatmap = useMemo(
    () => (shouldCluster ? clusterHeatmapPoints(normalizedHeatmap) : normalizedHeatmap),
    [normalizedHeatmap, shouldCluster],
  );
  const configuredGeoSource = useMemo(
    () => (isFeatureCollection(geoLayerConfig?.source) ? geoLayerConfig.source : null),
    [geoLayerConfig?.source],
  );
  const configuredSourceOptions = useMemo(() => {
    const raw = geoLayerConfig?.source_options;
    if (!raw || typeof raw !== "object") return {} as { cluster?: boolean; clusterMaxZoom?: number; clusterRadius?: number };
    const cluster = typeof raw.cluster === "boolean" ? raw.cluster : undefined;
    const clusterMaxZoom = Number.isFinite(Number(raw.clusterMaxZoom)) ? Number(raw.clusterMaxZoom) : undefined;
    const clusterRadius = Number.isFinite(Number(raw.clusterRadius)) ? Number(raw.clusterRadius) : undefined;
    return {
      ...(cluster !== undefined ? { cluster } : {}),
      ...(clusterMaxZoom !== undefined ? { clusterMaxZoom } : {}),
      ...(clusterRadius !== undefined ? { clusterRadius } : {}),
    };
  }, [geoLayerConfig?.source_options]);
  const configuredLayerIds = useMemo(
    () => ({
      heat: geoLayerConfig?.layers?.heatmap?.id?.trim() || "tickets-heat",
      circles: geoLayerConfig?.layers?.points?.id?.trim() || "tickets-circles",
    }),
    [geoLayerConfig?.layers?.heatmap?.id, geoLayerConfig?.layers?.points?.id],
  );
  const configuredInteractions = useMemo(
    () => ({
      hover: geoLayerConfig?.interactions?.hover !== false,
      timeSliderEnabled: Boolean(geoLayerConfig?.interactions?.time_slider?.enabled),
      timeSliderField: geoLayerConfig?.interactions?.time_slider?.field,
    }),
    [geoLayerConfig?.interactions?.hover, geoLayerConfig?.interactions?.time_slider?.enabled, geoLayerConfig?.interactions?.time_slider?.field],
  );
  const telemetryConfig = useMemo(() => {
    const endpoint = typeof geoLayerConfig?.telemetry?.event_endpoint === "string"
      ? geoLayerConfig.telemetry.event_endpoint.trim()
      : "";
    const events = Array.isArray(geoLayerConfig?.telemetry?.events)
      ? geoLayerConfig.telemetry.events.filter((event): event is string => typeof event === "string" && event.trim().length > 0)
      : [];
    return {
      endpoint: endpoint || null,
      events,
    };
  }, [geoLayerConfig?.telemetry?.event_endpoint, geoLayerConfig?.telemetry?.events]);

  const emitBackendMapEvent = useCallback((eventName: string, payload: Record<string, unknown>) => {
    if (!telemetryConfig.endpoint) return;
    if (telemetryConfig.events.length > 0 && !telemetryConfig.events.includes(eventName)) return;
    if (typeof window === "undefined") return;

    const body = JSON.stringify({
      event: eventName,
      payload,
      source: "maplibre_frontend",
      ts: new Date().toISOString(),
    });

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      try {
        const blob = new Blob([body], { type: "application/json" });
        if (navigator.sendBeacon(telemetryConfig.endpoint, blob)) return;
      } catch {
        // fallback fetch below
      }
    }

    fetch(telemetryConfig.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "include",
    }).catch(() => undefined);
  }, [telemetryConfig.endpoint, telemetryConfig.events]);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const libRef = useRef<MapLibreModule | null>(null);
  const markerRef = useRef<any>(null);
  const adminMarkerRef = useRef<any>(null);
  const latestHeatmap = useRef<HeatPoint[]>(processedHeatmap);
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

  const resolvedGoogleMapsKey = (googleMapsKey ?? import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();
  const wantsGoogle = effectiveProvider === "google";
  const shouldUseGoogle = wantsGoogle && resolvedGoogleMapsKey.length > 0;

  useEffect(() => {
    if (wantsGoogle && !resolvedGoogleMapsKey) {
      handleProviderUnavailable("missing-api-key");
    }
  }, [handleProviderUnavailable, resolvedGoogleMapsKey, wantsGoogle]);

  if (shouldUseGoogle) {
    return (
      <GoogleHeatmapMap
        center={center}
        initialZoom={initialZoom}
        onSelect={onSelect}
        heatmapData={normalizedHeatmap}
        showHeatmap={showHeatmap}
        marker={marker}
        className={className}
        adminLocation={adminLocation}
        fitToBounds={fitToBounds}
        boundsPadding={boundsPadding}
        onBoundingBoxChange={onBoundingBoxChange}
        onProviderUnavailable={handleProviderUnavailable}
        disableClustering={!shouldCluster}
        googleMapsKey={resolvedGoogleMapsKey}
      />
    );
  }

  const resolvedMaptilerKey = (maptilerKey ?? import.meta.env.VITE_MAPTILER_KEY ?? "").trim();
  const apiKeyRef = useRef(resolvedMaptilerKey);
  const centerRef = useRef(center);
  const showHeatmapRef = useRef(showHeatmap);
  const showPolygonsRef = useRef(showPolygons);
  const polygonsRef = useRef(polygons);
  const onSelectRef = useRef(onSelect);
  const initialZoomRef = useRef(initialZoom);

  useEffect(() => {
    apiKeyRef.current = resolvedMaptilerKey;
  }, [resolvedMaptilerKey]);

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  useEffect(() => {
    showHeatmapRef.current = showHeatmap;
  }, [showHeatmap]);

  useEffect(() => {
    showPolygonsRef.current = showPolygons;
  }, [showPolygons]);

  useEffect(() => {
    polygonsRef.current = polygons;
  }, [polygons]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    initialZoomRef.current = initialZoom;
  }, [initialZoom]);

  useEffect(() => {
    latestHeatmap.current = processedHeatmap;
  }, [processedHeatmap]);

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
        const contractStyleUrl = typeof geoLayerConfig?.style_url === "string" ? geoLayerConfig.style_url.trim() : "";
        const envStyleUrl = String(
          import.meta.env.VITE_MAPLIBRE_STYLE_URL ?? import.meta.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL ?? "",
        ).trim();
        const customStyle = (mapStyleUrl ?? "").trim() || contractStyleUrl || envStyleUrl;
        const customTileUrl = (mapTileUrl ?? "").trim();
        const customTileAttribution =
          (mapTileAttribution ?? "").trim() || "© OpenStreetMap contributors";
        const tileStyle = customTileUrl
          ? {
              version: 8,
              sources: {
                osm: {
                  type: "raster",
                  tiles: [customTileUrl],
                  tileSize: 256,
                  attribution: customTileAttribution,
                },
              },
              layers: [
                {
                  id: "osm",
                  type: "raster",
                  source: "osm",
                },
              ],
            }
          : null;
        const styleCandidates = [
          customStyle || null,
          key ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}` : null,
          "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
          "https://tiles.stadiamaps.com/styles/alidade_smooth.json",
          "https://demotiles.maplibre.org/style.json",
        ].filter((value): value is string => typeof value === "string" && value.length > 0);

        let currentStyleIndex = 0;
        let exhaustedStyles = false;

        const initialStyle = tileStyle ?? styleCandidates[0] ?? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

        const mapInstance = new maplibre.Map({
          container: mapContainerRef.current,
          style: initialStyle,
          center: centerRef.current ?? [0, 0],
          zoom: initialZoomRef.current,
        });

        mapRef.current = mapInstance;

        const numberFormatter = new Intl.NumberFormat("es-AR", {
          maximumFractionDigits: 2,
        });

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
              data: configuredGeoSource ?? { type: "FeatureCollection", features: [] },
              ...configuredSourceOptions,
            });
          }

          if (!map.getSource("polygons")) {
            map.addSource("polygons", {
              type: "geojson",
              data: polygonsRef.current ?? { type: "FeatureCollection", features: [] },
            });
          }

          addLayer(map, {
            id: "polygons-fill",
            type: "fill",
            source: "polygons",
            paint: {
              "fill-color": [
                "coalesce",
                ["get", "fill"],
                [
                  "interpolate",
                  ["linear"],
                  ["coalesce", ["get", "density"], 0],
                  0,
                  "rgba(0,0,0,0)",
                  20,
                  "#fecaca",
                  50,
                  "#ef4444",
                  80,
                  "#b91c1c",
                  100,
                  "#7f1d1d",
                ],
              ],
              "fill-opacity": 0.6,
            },
          });

          addLayer(map, {
            id: "polygons-outline",
            type: "line",
            source: "polygons",
            paint: {
              "line-color": "#ffffff",
              "line-width": 1.5,
              "line-opacity": 0.8,
            },
          });

          addLayer(map, {
            id: configuredLayerIds.heat,
            type: "heatmap",
            source: "points",
            maxzoom: 15,
            paint: {
              "heatmap-weight": ["coalesce", ["get", "intensity"], ["get", "weight"], 1],
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3.5],
              "heatmap-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                0,
                [
                  "max",
                  4,
                  [
                    "*",
                    ["sqrt", ["coalesce", ["get", "clusterSize"], 1]],
                    2.6,
                  ],
                ],
                9,
                [
                  "max",
                  14,
                  [
                    "*",
                    ["sqrt", ["coalesce", ["get", "clusterSize"], 1]],
                    4.8,
                  ],
                ],
                13,
                [
                  "max",
                  18,
                  [
                    "*",
                    ["sqrt", ["coalesce", ["get", "clusterSize"], 1]],
                    6.4,
                  ],
                ],
              ],
              "heatmap-opacity": 0.65,
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(34, 197, 94, 0)", // Transparent Green
                0.2,
                "rgba(34, 197, 94, 0.6)", // Green-500
                0.4,
                "rgba(234, 179, 8, 0.7)", // Yellow-500
                0.6,
                "rgba(249, 115, 22, 0.8)", // Orange-500
                1,
                "rgba(239, 68, 68, 0.95)", // Red-500
              ],
            },
          });

          addLayer(map, {
            id: configuredLayerIds.circles,
            type: "circle",
            source: "points",
            minzoom: 9,
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                9,
                [
                  "max",
                  [
                    "+",
                    4,
                    [
                      "*",
                      ["sqrt", ["coalesce", ["get", "clusterSize"], 1]],
                      1.2,
                    ],
                  ],
                  6,
                ],
                16,
                [
                  "max",
                  [
                    "+",
                    6,
                    [
                      "*",
                      ["sqrt", ["coalesce", ["get", "clusterSize"], 1]],
                      2.4,
                    ],
                  ],
                  14,
                ],
              ],
              "circle-color": [
                "case",
                ["has", "categoryColor"],
                ["get", "categoryColor"],
                [
                  "interpolate",
                  ["linear"],
                  ["coalesce", ["get", "averageWeight"], 1],
                  0,
                  "#38bdf8",
                  10,
                  "#2563eb",
                  20,
                  "#1d4ed8",
                  35,
                  "#ef4444",
                ],
              ],
              "circle-stroke-color": [
                "case",
                [">", ["coalesce", ["get", "clusterSize"], 1], 12],
                "rgba(15, 23, 42, 0.35)",
                "rgba(255, 255, 255, 0.95)",
              ],
              "circle-stroke-width": 1.5,
              "circle-opacity": 0.88,
              "circle-blur": 0.12,
            },
          });

          toggleLayers(map, showHeatmapRef.current, showPolygonsRef.current, configuredLayerIds);
          trackFrontendEvent("map_loaded", {
            provider: "maplibre",
            contract_version: geoLayerConfig?.contract_version ?? null,
            hover_enabled: configuredInteractions.hover,
            time_slider_enabled: configuredInteractions.timeSliderEnabled,
            time_slider_field: configuredInteractions.timeSliderField ?? null,
          });
          emitBackendMapEvent("map_loaded", {
            provider: "maplibre",
            contract_version: geoLayerConfig?.contract_version ?? null,
            hover_enabled: configuredInteractions.hover,
            time_slider_enabled: configuredInteractions.timeSliderEnabled,
            time_slider_field: configuredInteractions.timeSliderField ?? null,
          });
          updateHeatmapSource(map, latestHeatmap.current);
        };

        const cycleStyle = (reason?: string) => {
          if (tileStyle || exhaustedStyles || styleCandidates.length === 0) {
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
              "No se pudieron cargar los estilos del mapa. Verificá la conexión o usá un tile OSM del backend.",
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

        const formatBreakdown = (
          title: string,
          items?: HeatPoint["aggregatedCategorias"],
        ): string => {
          if (!items?.length) return "";
          const rows = items.slice(0, 3).map(
            (item) =>
              `<li><span class="font-medium text-slate-700">${item.label}</span> · ${numberFormatter.format(
                item.weight,
              )} (${item.percentage.toFixed(1)}%)</li>`,
          );

          return `
            <div class="mt-3 text-xs leading-relaxed">
              <p class="font-semibold uppercase tracking-wide text-slate-500">${title}</p>
              <ul class="mt-1 space-y-0.5">${rows.join("")}</ul>
            </div>
          `;
        };

        const handleCircleClick = (e: any) => {
          if (!e.features?.length) return;
          const feature = e.features[0];
          const coords = (feature.geometry as any).coordinates.slice();
          const properties = feature.properties ?? {};
          const clusterId = typeof properties.clusterId === "string" ? properties.clusterId : null;
          const cluster = clusterId
            ? latestHeatmap.current.find((point) => point.clusterId === clusterId)
            : undefined;

          while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
            coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
          }

          const sections: string[] = [];

          trackFrontendEvent("map_cluster_click", {
            provider: "maplibre",
            cluster_id: clusterId,
            feature_id: properties?.id ?? null,
            contract_version: geoLayerConfig?.contract_version ?? null,
          });
          emitBackendMapEvent("cluster_click", {
            provider: "maplibre",
            cluster_id: clusterId,
            feature_id: properties?.id ?? null,
            contract_version: geoLayerConfig?.contract_version ?? null,
          });

          if (cluster) {
            const clusterSize = Number.isFinite(cluster.clusterSize)
              ? Number(cluster.clusterSize)
              : 1;
            const totalWeight = Number.isFinite(cluster.totalWeight)
              ? Number(cluster.totalWeight)
              : Number(cluster.weight ?? 0);

            sections.push(
              `<p class="text-sm font-semibold text-slate-800">Reportes en la zona: ${clusterSize.toLocaleString(
                "es-AR",
              )}</p>`,
            );

            if (totalWeight > 0) {
              sections.push(
                `<p class="text-xs text-slate-600">Peso agregado: <span class="font-medium">${numberFormatter.format(
                  totalWeight,
                )}</span></p>`,
              );
            }

            if (Number.isFinite(cluster.averageWeight) && clusterSize > 1) {
              sections.push(
                `<p class="text-xs text-slate-600">Peso promedio por reporte: ${numberFormatter.format(
                  Number(cluster.averageWeight),
                )}</p>`,
              );
            }

            const topBarrio = cluster.aggregatedBarrios?.[0];
            if (topBarrio) {
              sections.push(
                `<p class="text-xs text-slate-600">Zona destacada: <span class="font-medium">${topBarrio.label}</span> (${topBarrio.percentage.toFixed(1)}%)</p>`,
              );
            } else if (cluster.barrio || cluster.distrito) {
              sections.push(
                `<p class="text-xs text-slate-600">Zona: ${cluster.barrio ?? cluster.distrito}</p>`,
              );
            }

            if (cluster.last_ticket_at) {
              const parsed = Date.parse(cluster.last_ticket_at);
              if (Number.isFinite(parsed)) {
                sections.push(
                  `<p class="text-xs text-slate-600">Último ticket: ${new Date(parsed).toLocaleString("es-AR")}</p>`,
                );
              }
            }

            const categoriasBlock = formatBreakdown(
              "Categorías principales",
              cluster.aggregatedCategorias,
            );
            if (categoriasBlock) sections.push(categoriasBlock);

            const estadosBlock = formatBreakdown("Estados", cluster.aggregatedEstados);
            if (estadosBlock) sections.push(estadosBlock);

            const severidadesBlock = formatBreakdown(
              "Severidad",
              cluster.aggregatedSeveridades,
            );
            if (severidadesBlock) sections.push(severidadesBlock);

            const tiposBlock = formatBreakdown(
              "Tipos de ticket",
              cluster.aggregatedTipos,
            );
            if (tiposBlock) sections.push(tiposBlock);

            const samples = cluster.sampleTickets ?? [];
            if (samples.length) {
              const links = samples.slice(0, 3).map((ticketId) => {
                const safeId = `${ticketId}`;
                return `<a href="/chat/${safeId}" class="text-blue-600 underline hover:text-blue-500" target="_blank" rel="noopener noreferrer">#${safeId}</a>`;
              });
              sections.push(
                `<p class="mt-3 text-xs text-slate-600">Tickets relacionados: ${links.join(
                  " · ",
                )}</p>`,
              );
            } else if (cluster.ticket || cluster.id) {
              const fallbackId = `${cluster.ticket ?? cluster.id}`;
              sections.push(
                `<p class="mt-3 text-xs"><a href="/chat/${fallbackId}" class="text-blue-600 underline hover:text-blue-500" target="_blank" rel="noopener noreferrer">Ver ticket de referencia</a></p>`,
              );
            }
          } else {
            const { id, ticket, categoria, direccion, distrito } = properties;
            const fallbackLines = [
              ticket || id ? `<p class="text-sm font-semibold">Ticket #${ticket ?? id}</p>` : "",
              categoria ? `<p class="text-xs text-slate-600">Categoría: ${categoria}</p>` : "",
              distrito ? `<p class="text-xs text-slate-600">Distrito: ${distrito}</p>` : "",
              direccion ? `<p class="text-xs text-slate-600">Dirección: ${direccion}</p>` : "",
              id
                ? `<p class="mt-3 text-xs"><a href="/chat/${id}" class="text-blue-600 underline hover:text-blue-500" target="_blank" rel="noopener noreferrer">Ver ticket</a></p>`
                : "",
            ].filter(Boolean);
            sections.push(...fallbackLines);
          }

          const popup = new maplibre.Popup();
          popup
            .setLngLat(coords as LngLatLike)
            .setHTML(`<div class="max-w-xs space-y-1">${sections.join("")}</div>`)
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
        mapInstance.on("click", configuredLayerIds.circles, handleCircleClick);
        mapInstance.on("styleimagemissing", handleMissingImage);
        const bboxEvents = [
          "boxzoomend",
          "moveend",
          "zoomend",
          "dragend",
          "rotateend",
          "pitchend",
        ] as const;
        const shouldEmitBoundingBox = Boolean(boundingBoxCallbackRef.current);
        if (shouldEmitBoundingBox) {
          bboxEvents.forEach((eventName) => mapInstance.on(eventName, emitBoundingBox));
          if (mapInstance.isStyleLoaded()) {
            emitBoundingBox();
          } else {
            mapInstance.once("load", emitBoundingBox);
          }
        }

        return () => {
          mapInstance.off("click", handleClick);
          mapInstance.off("click", configuredLayerIds.circles, handleCircleClick);
          mapInstance.off("styleimagemissing", handleMissingImage);
          if (shouldEmitBoundingBox) {
            bboxEvents.forEach((eventName) => mapInstance.off(eventName, emitBoundingBox));
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
  }, [configuredGeoSource, configuredInteractions.hover, configuredInteractions.timeSliderEnabled, configuredInteractions.timeSliderField, configuredLayerIds, configuredSourceOptions, effectiveProvider, emitBackendMapEvent, geoLayerConfig?.contract_version, geoLayerConfig?.style_url, mapStyleUrl, provider, resolvedMaptilerKey]);

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

    const applyData = () => {
      const source = map.getSource("points");
      if (!source || typeof (source as any).setData !== "function") return;
      (source as any).setData(configuredGeoSource ?? buildGeoJson(processedHeatmap));
    };
    const source = map.getSource("points");
    if (source && typeof (source as any).setData === "function") {
      applyData();
      return;
    }

    map.once("load", applyData);
    return () => {
      map.off("load", applyData);
    };
  }, [configuredGeoSource, processedHeatmap, effectiveProvider]);

  useEffect(() => {
    if (!configuredInteractions.timeSliderEnabled) return;
    trackFrontendEvent("map_time_slider_changed", {
      provider: "maplibre",
      field: configuredInteractions.timeSliderField ?? null,
      contract_version: geoLayerConfig?.contract_version ?? null,
      feature_count: configuredGeoSource?.features?.length ?? processedHeatmap.length,
    });
    emitBackendMapEvent("time_slider_changed", {
      provider: "maplibre",
      field: configuredInteractions.timeSliderField ?? null,
      contract_version: geoLayerConfig?.contract_version ?? null,
      feature_count: configuredGeoSource?.features?.length ?? processedHeatmap.length,
    });
  }, [configuredGeoSource?.features?.length, configuredInteractions.timeSliderEnabled, configuredInteractions.timeSliderField, emitBackendMapEvent, geoLayerConfig?.contract_version, processedHeatmap.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || effectiveProvider !== "maplibre") return;

    if (!map.getLayer(configuredLayerIds.heat) || !map.getLayer(configuredLayerIds.circles)) {
      const handler = () => toggleLayers(map, showHeatmap, showPolygons, configuredLayerIds);
      map.once("load", handler);
      return () => {
        map.off("load", handler);
      };
    }

    toggleLayers(map, showHeatmap, showPolygons, configuredLayerIds);
    trackFrontendEvent("map_layer_toggle", {
      provider: "maplibre",
      show_heatmap: showHeatmap,
      show_polygons: showPolygons,
      contract_version: geoLayerConfig?.contract_version ?? null,
    });
    emitBackendMapEvent("layer_toggle", {
      provider: "maplibre",
      show_heatmap: showHeatmap,
      show_polygons: showPolygons,
      contract_version: geoLayerConfig?.contract_version ?? null,
    });
  }, [configuredLayerIds, effectiveProvider, emitBackendMapEvent, geoLayerConfig?.contract_version, showHeatmap, showPolygons]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || effectiveProvider !== "maplibre") return;

    const source = map.getSource("polygons");
    if (source && typeof (source as any).setData === "function") {
      (source as any).setData(polygons ?? { type: "FeatureCollection", features: [] });
    }
  }, [polygons, effectiveProvider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showHeatmap || showPolygons || effectiveProvider !== "maplibre") return;
    let frame: number;

    const animate = () => {
      // Slower, deeper pulse for a "breathing" effect
      const t = (Date.now() % 4000) / 4000;
      const intensity = 1 + 0.3 * Math.sin(t * Math.PI * 2);
      if (map.getLayer(configuredLayerIds.heat)) {
        map.setPaintProperty(configuredLayerIds.heat, "heatmap-intensity", intensity);
      }
      frame = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(frame);
  }, [configuredLayerIds.heat, showHeatmap, effectiveProvider]);

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

  useEffect(() => {
    if (effectiveProvider !== "maplibre") return;

    const container = mapContainerRef.current;
    const map = mapRef.current;
    if (!container || !map) return;

    let rafId: number | null = null;
    const requestResize = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        const liveMap = mapRef.current;
        if (!liveMap) return;
        try {
          liveMap.resize();
        } catch {
          // noop
        }
      });
    };

    requestResize();

    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => requestResize())
      : null;
    observer?.observe(container);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        requestResize();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("orientationchange", requestResize);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("orientationchange", requestResize);
    };
  }, [effectiveProvider, fitToBounds, processedHeatmap.length]);

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
