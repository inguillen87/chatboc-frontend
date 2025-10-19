import { useCallback, useEffect, useMemo, useRef } from "react";
import { GoogleMap, HeatmapLayerF, MarkerF, useJsApiLoader } from "@react-google-maps/api";
import { cn } from "@/lib/utils";
import type { HeatPoint } from "@/services/statsService";
import type { MapProviderUnavailableReason } from "@/hooks/useMapProvider";

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
    const totalWeight = heatmapData.reduce((sum, point) => sum + (point.weight ?? 1), 0);
    const divisor = totalWeight > 0 ? totalWeight : heatmapData.length;
    const avgLat = heatmapData.reduce((sum, point) => sum + point.lat * (point.weight ?? 1), 0) / divisor;
    const avgLng = heatmapData.reduce((sum, point) => sum + point.lng * (point.weight ?? 1), 0) / divisor;

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
}: GoogleHeatmapMapProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const unavailableReportedRef = useRef(false);

  const { isLoaded, loadError } = useJsApiLoader({
    id: "chatboc-google-maps",
    googleMapsApiKey,
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
      return;
    }

    const visualization = window.google?.maps?.visualization;
    if (!visualization?.HeatmapLayer) {
      reportUnavailable("heatmap-unavailable");
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
    () => computeFallbackCenter(center, marker, adminLocation, heatmapData, fitToBounds),
    [center, marker, adminLocation, heatmapData, fitToBounds],
  );

  const heatmapPoints = useMemo(() => {
    if (!isLoaded || !window.google?.maps) {
      return undefined;
    }

    const googleMaps = window.google.maps;
    const points = heatmapData
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
      .map((point) => ({
        location: new googleMaps.LatLng(point.lat, point.lng),
        weight: point.weight ?? 1,
      }));

    if (!points.length) {
      return undefined;
    }

    return new googleMaps.MVCArray(points);
  }, [heatmapData, isLoaded]);

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
      {showHeatmap && heatmapPoints ? (
        <HeatmapLayerF
          data={heatmapPoints}
          options={{ radius: 24, opacity: 0.6 }}
        />
      ) : (
        heatmapData
          .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
          .map((point) => (
            <MarkerF
              key={`${point.lat}-${point.lng}-${point.id ?? point.ticket ?? "point"}`}
              position={{ lat: point.lat, lng: point.lng }}
              options={{
                icon: {
                  path: circleSymbolPath,
                  scale: 6,
                  fillColor: "#2563eb",
                  fillOpacity: 0.85,
                  strokeColor: "#1d4ed8",
                  strokeOpacity: 0.9,
                  strokeWeight: 1,
                },
              }}
            />
          ))
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

