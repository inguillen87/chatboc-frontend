import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, HeatmapLayerF, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { cn } from "@/lib/utils";
import type { HeatPoint } from "@/services/statsService";
import type { MapProviderUnavailableReason } from "@/hooks/useMapProvider";
import { clusterHeatmapPoints } from "@/utils/heatmap";

type GoogleHeatmapMapProps = {
  center?: [number, number];
  initialZoom: number;
  onSelect?: (lat: number, lon: number, address?: string) => void;
  heatmapData: HeatPoint[];
  showHeatmap: boolean;
  marker?: [number, number];
  className?: string;
  adminLocation?: [number, number];
  fitToBounds?: [number, number][];
  boundsPadding?: number | { top?: number; bottom?: number; left?: number; right?: number };
  onBoundingBoxChange?: (bbox: [number, number, number, number] | null) => void;
  onProviderUnavailable?: (reason: MapProviderUnavailableReason, details?: unknown) => void;
  disableClustering?: boolean;
  googleMapsKey?: string | null;
};

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

const GOOGLE_LIBRARIES: ("visualization")[] = ["visualization"];

const toLatLngLiteral = (coordinates?: [number, number]) => {
  if (!coordinates) return undefined;
  const [lng, lat] = coordinates;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return undefined;
  }
  return { lat, lng } as const;
};

const mapPaddingToGoogle = (
  padding?: number | { top?: number; bottom?: number; left?: number; right?: number },
) => {
  if (padding === undefined) {
    return undefined;
  }

  if (typeof padding === "number") {
    return padding;
  }

  return {
    top: padding.top ?? 0,
    right: padding.right ?? 0,
    bottom: padding.bottom ?? 0,
    left: padding.left ?? 0,
  } satisfies google.maps.Padding;
};

const computeFallbackCenter = (
  center: GoogleHeatmapMapProps["center"],
  marker: GoogleHeatmapMapProps["marker"],
  adminLocation: GoogleHeatmapMapProps["adminLocation"],
  heatmapData: HeatPoint[],
  fitToBounds: GoogleHeatmapMapProps["fitToBounds"],
) => {
  const preferred = toLatLngLiteral(center) ?? toLatLngLiteral(marker) ?? toLatLngLiteral(adminLocation);
  if (preferred) {
    return preferred;
  }

  if (heatmapData.length > 0) {
    const totalWeight = heatmapData.reduce(
      (sum, point) => sum + (point.totalWeight ?? point.weight ?? 1),
      0,
    );
    const divisor = totalWeight > 0 ? totalWeight : heatmapData.length;
    const avgLat =
      heatmapData.reduce(
        (sum, point) => sum + point.lat * (point.totalWeight ?? point.weight ?? 1),
        0,
      ) / divisor;
    const avgLng =
      heatmapData.reduce(
        (sum, point) => sum + point.lng * (point.totalWeight ?? point.weight ?? 1),
        0,
      ) / divisor;

    if (Number.isFinite(avgLat) && Number.isFinite(avgLng)) {
      return { lat: avgLat, lng: avgLng } as const;
    }
  }

  if (fitToBounds?.length) {
    const literal = toLatLngLiteral(fitToBounds[0]);
    if (literal) {
      return literal;
    }
  }

  return { lat: -34.6037, lng: -58.3816 } as const; // Buenos Aires as neutral fallback
};

const googleMapsApiKey = import.meta.env.VITE_Maps_API_KEY || "";

export function GoogleHeatmapMap({
  center,
  initialZoom,
  onSelect,
  heatmapData,
  showHeatmap,
  marker,
  className,
  adminLocation,
  fitToBounds,
  boundsPadding,
  onBoundingBoxChange,
  onProviderUnavailable,
  disableClustering,
  googleMapsKey,
}: GoogleHeatmapMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const unavailableReportedRef = useRef(false);
  const [heatmapLayerAvailable, setHeatmapLayerAvailable] = useState(false);
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
    () => !disableClustering && !aggregatedHint,
    [disableClustering, aggregatedHint],
  );
  const aggregatedHeatmap = useMemo(
    () => (shouldCluster ? clusterHeatmapPoints(normalizedHeatmap) : normalizedHeatmap),
    [normalizedHeatmap, shouldCluster],
  );
  const heatmapRadius = useMemo(() => {
    if (!aggregatedHeatmap.length) {
      return 28;
    }

    const totalRadius = aggregatedHeatmap.reduce(
      (sum, point) => sum + (Number.isFinite(point.radiusMeters) ? Number(point.radiusMeters) : 0),
      0,
    );
    const averageMeters = totalRadius / aggregatedHeatmap.length;
    if (!Number.isFinite(averageMeters) || averageMeters <= 0) {
      return 28;
    }

    return Math.max(20, Math.min(64, averageMeters / 10));
  }, [aggregatedHeatmap]);
  const titleNumberFormatter = useMemo(
    () => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }),
    [],
  );

  const resolvedGoogleKey = (googleMapsKey ?? googleMapsApiKey).trim();

  const { isLoaded, loadError } = useJsApiLoader({
    id: "chatboc-google-maps",
    googleMapsApiKey: resolvedGoogleKey,
    libraries: GOOGLE_LIBRARIES,
    language: "es",
    region: "AR",
  });

  const reportUnavailable = useCallback(
    (reason: MapProviderUnavailableReason, details?: unknown) => {
      if (unavailableReportedRef.current) {
        return;
      }
      unavailableReportedRef.current = true;
      onProviderUnavailable?.(reason, details);
    },
    [onProviderUnavailable],
  );

  useEffect(() => {
    if (!resolvedGoogleKey) {
      reportUnavailable("missing-api-key");
    }
  }, [reportUnavailable, resolvedGoogleKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const previous = window.gm_authFailure;
    const handler = () => {
      reportUnavailable("load-error", new Error("gm_authFailure"));
      if (typeof previous === "function") {
        try {
          previous();
        } catch (error) {
          console.warn("[GoogleHeatmapMap] Previous gm_authFailure handler threw", error);
        }
      }
    };

    window.gm_authFailure = handler;

    return () => {
      window.gm_authFailure = previous;
    };
  }, [reportUnavailable]);

  useEffect(() => {
    if (!isLoaded) {
      setHeatmapLayerAvailable(false);
      return;
    }

    const visualization = window.google?.maps?.visualization;
    const available = Boolean(visualization?.HeatmapLayer);

    setHeatmapLayerAvailable(available);

    if (!available) {
      reportUnavailable("heatmap-unavailable");
    }

    if (!window.google?.maps?.Map) {
      reportUnavailable("load-error", new Error("google.maps.Map unavailable"));
    }
  }, [isLoaded, reportUnavailable]);

  const circleSymbolPath =
    typeof window !== "undefined" && window.google?.maps?.SymbolPath?.CIRCLE !== undefined
      ? window.google.maps.SymbolPath.CIRCLE
      : 0;

  const mapContainerClassName = cn(
    "relative w-full overflow-hidden rounded-2xl",
    !className && "h-[500px]",
    className,
  );

  const fallbackCenter = useMemo(
    () => computeFallbackCenter(center, marker, adminLocation, aggregatedHeatmap, fitToBounds),
    [center, marker, adminLocation, aggregatedHeatmap, fitToBounds],
  );

  const heatmapPoints = useMemo(() => {
    if (!isLoaded || !window.google?.maps) {
      return undefined;
    }

    const googleMaps = window.google.maps;
    const points = aggregatedHeatmap
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
      .map((point) => ({
        location: new googleMaps.LatLng(point.lat, point.lng),
        weight: point.totalWeight ?? point.weight ?? 1,
      }));

    if (!points.length) {
      return undefined;
    }

    return new googleMaps.MVCArray(points);
  }, [aggregatedHeatmap, isLoaded]);

  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    map.setOptions({
      clickableIcons: true,
      fullscreenControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      zoomControl: true,
      gestureHandling: "greedy",
    });

    if (fallbackCenter) {
      map.setCenter(fallbackCenter);
      map.setZoom(initialZoom);
    }
  }, [fallbackCenter, initialZoom]);

  const handleMapUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const handleClick = useCallback(
    (event: google.maps.MapMouseEvent) => {
      if (!onSelect) return;
      const latLng = event.latLng;
      if (!latLng) return;
      onSelect(latLng.lat(), latLng.lng());
    },
    [onSelect],
  );

  const handleIdle = useCallback(() => {
    const callback = onBoundingBoxChange;
    const map = mapRef.current;
    if (!callback || !map) return;
    const bounds = map.getBounds();
    if (!bounds) {
      callback(null);
      return;
    }

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    callback([sw.lng(), sw.lat(), ne.lng(), ne.lat()]);
  }, [onBoundingBoxChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded || !window.google?.maps) {
      return;
    }

    const coordinates = (fitToBounds ?? []).filter(
      (value): value is [number, number] =>
        Array.isArray(value) &&
        value.length === 2 &&
        Number.isFinite(value[0]) &&
        Number.isFinite(value[1]),
    );

    if (!coordinates.length) {
      return;
    }

    if (coordinates.length === 1) {
      const [lng, lat] = coordinates[0];
      map.panTo({ lat, lng });
      map.setZoom(initialZoom);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    coordinates.forEach(([lng, lat]) => bounds.extend({ lat, lng }));

    try {
      map.fitBounds(bounds, mapPaddingToGoogle(boundsPadding));
    } catch (error) {
      console.warn("[GoogleHeatmapMap] Unable to fit bounds", error);
    }
  }, [fitToBounds, boundsPadding, initialZoom, isLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) {
      return;
    }

    const literal = toLatLngLiteral(center);
    if (!literal) {
      return;
    }

    map.panTo(literal);
    map.setZoom(initialZoom);
  }, [center, initialZoom, isLoaded]);

  if (!googleMapsApiKey) {
    reportUnavailable("missing-api-key");
    return (
      <div className={mapContainerClassName}>
        <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          No se configuró la clave de Google Maps (`VITE_Maps_API_KEY`). Agregala en el backend para habilitar este mapa.
        </div>
      </div>
    );
  }

  if (loadError) {
    reportUnavailable("load-error", loadError);
    return (
      <div className={mapContainerClassName}>
        <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          No se pudo cargar Google Maps. Revisá la clave (`VITE_Maps_API_KEY`) o la conexión a Internet.
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={mapContainerClassName}>
        <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          Cargando mapa de Google Maps...
        </div>
      </div>
    );
  }

  if (!window.google?.maps?.Map) {
    reportUnavailable("load-error", new Error("google.maps.Map unavailable"));
    return (
      <div className={mapContainerClassName}>
        <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-border px-6 text-center text-sm text-muted-foreground">
          No se pudo inicializar Google Maps. Verificá la clave (`VITE_Maps_API_KEY`) y la configuración de facturación.
        </div>
      </div>
    );
  }

  const shouldRenderHeatmap =
    showHeatmap && heatmapPoints && heatmapLayerAvailable && aggregatedHeatmap.length > 0;

  return (
    <GoogleMap
      onLoad={handleMapLoad}
      onUnmount={handleMapUnmount}
      onClick={handleClick}
      onIdle={handleIdle}
      center={fallbackCenter}
      zoom={initialZoom}
      mapContainerClassName={mapContainerClassName}
      options={{
        clickableIcons: true,
        fullscreenControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        zoomControl: true,
        gestureHandling: "greedy",
      }}
    >
      {shouldRenderHeatmap ? (
        <HeatmapLayerF
          data={heatmapPoints}
          options={{ radius: heatmapRadius, opacity: 0.6 }}
        />
      ) : (
        aggregatedHeatmap
          .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
          .map((point) => {
            const clusterSize = Number.isFinite(point.clusterSize)
              ? Number(point.clusterSize)
              : 1;
            const scale = Math.max(6, Math.min(18, 4 + Math.sqrt(clusterSize) * 2));
            const labelText = clusterSize > 1 ? clusterSize.toLocaleString("es-AR") : undefined;
            const titleParts: string[] = [];
            if (clusterSize > 1) {
              titleParts.push(`Reportes: ${clusterSize}`);
            }
            if (Number.isFinite(point.totalWeight)) {
              titleParts.push(
                `Peso total: ${titleNumberFormatter.format(Number(point.totalWeight))}`,
              );
            }
            if (Number.isFinite(point.averageWeight) && clusterSize > 1) {
              titleParts.push(
                `Promedio: ${titleNumberFormatter.format(Number(point.averageWeight))}`,
              );
            }
            if (point.aggregatedCategorias?.length) {
              titleParts.push(`Categoría principal: ${point.aggregatedCategorias[0].label}`);
            }
            if (point.last_ticket_at) {
              const parsed = Date.parse(point.last_ticket_at);
              if (Number.isFinite(parsed)) {
                titleParts.push(`Último ticket: ${new Date(parsed).toLocaleString("es-AR")}`);
              }
            }

            return (
              <MarkerF
                key={`${point.clusterId ?? `${point.lat}-${point.lng}`}`}
                position={{ lat: point.lat, lng: point.lng }}
                label={
                  labelText
                    ? {
                        text: labelText,
                        color: "#1f2937",
                        fontSize: "12px",
                        fontWeight: "600",
                      }
                    : undefined
                }
                title={titleParts.join(" · ") || undefined}
                options={{
                  icon: {
                    path: circleSymbolPath,
                    scale,
                    fillColor: "#2563eb",
                    fillOpacity: 0.82,
                    strokeColor: "#1d4ed8",
                    strokeOpacity: 0.95,
                    strokeWeight: 1.6,
                  },
                }}
              />
            );
          })
      )}

      {marker ? (
        <MarkerF position={{ lat: marker[1], lng: marker[0] }} />
      ) : null}

      {adminLocation ? (
        <MarkerF
          position={{ lat: adminLocation[1], lng: adminLocation[0] }}
          options={{
            icon: {
              url: "https://maps.gstatic.com/mapfiles/ms2/micons/green-dot.png",
            },
          }}
        />
      ) : null}
    </GoogleMap>
  );
}

