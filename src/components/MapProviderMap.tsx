import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MapLibreMapProps } from "@/components/MapLibreMap";
import { buildMapEvidence } from "@/components/maps/MapEvidenceBadge";
import { cn } from "@/lib/utils";
import type { HeatPoint } from "@/services/statsService";
import type { MapProvider, MapProviderUnavailableReason } from "@/hooks/useMapProvider";
import { clusterHeatmapPoints } from "@/utils/heatmap";

type GoogleHeatmapComponent = typeof import("@/components/GoogleHeatmapMap")["GoogleHeatmapMap"];
type MapLibreComponent = typeof import("@/components/MapLibreMap")["default"];

const FALLBACK_MESSAGES: Record<MapProviderUnavailableReason, string> = {
  "missing-api-key": "Mostramos la vista de mapa disponible para esta cuenta.",
  "load-error": "Mostramos la vista de mapa disponible para esta cuenta.",
  "heatmap-unavailable": "Mostramos la vista de mapa disponible para esta cuenta.",
};

const GOOGLE_KEY_ROTATION_ERROR =
  "Google Maps requiere actualizar la página antes de aplicar una clave distinta.";

const normalizeHeatmap = (points: HeatPoint[] | undefined) =>
  (points ?? []).filter(
    (point): point is HeatPoint & { lat: number; lng: number } =>
      Boolean(point) && Number.isFinite(point.lat) && Number.isFinite(point.lng),
  );

const hasBackendAggregation = (points: HeatPoint[]) =>
  points.some(
    (point) =>
      (typeof point.clusterSize === "number" && point.clusterSize > 1) ||
      Boolean(point.clusterId) ||
      (Array.isArray(point.sampleTickets) && point.sampleTickets.length > 0) ||
      (Array.isArray(point.aggregatedCategorias) && point.aggregatedCategorias.length > 0) ||
      (Array.isArray(point.aggregatedEstados) && point.aggregatedEstados.length > 0) ||
      (Array.isArray(point.aggregatedTipos) && point.aggregatedTipos.length > 0) ||
      (Array.isArray(point.aggregatedBarrios) && point.aggregatedBarrios.length > 0) ||
      (Array.isArray(point.aggregatedSeveridades) && point.aggregatedSeveridades.length > 0),
  );

export default function MapProviderMap({
  provider = "maplibre",
  googleMapsKey,
  onProviderUnavailable,
  ...mapProps
}: MapLibreMapProps) {
  const resolvedGoogleMapsKey = (
    googleMapsKey ?? import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ""
  ).trim();
  const [providerOverride, setProviderOverride] = useState<MapProvider | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [MapLibreMap, setMapLibreMap] = useState<MapLibreComponent | null>(null);
  const [mapLibreLoadError, setMapLibreLoadError] = useState(false);
  const [GoogleHeatmapMap, setGoogleHeatmapMap] = useState<GoogleHeatmapComponent | null>(null);
  const [googleLoaderKey, setGoogleLoaderKey] = useState<string | null>(() =>
    provider === "google" && resolvedGoogleMapsKey ? resolvedGoogleMapsKey : null,
  );
  const onProviderUnavailableRef = useRef(onProviderUnavailable);
  const effectiveProvider = providerOverride ?? provider;
  const hasUnsafeGoogleKeyRotation = Boolean(
    googleLoaderKey &&
      resolvedGoogleMapsKey &&
      googleLoaderKey !== resolvedGoogleMapsKey,
  );
  const activeGoogleMapsKey = googleLoaderKey ?? resolvedGoogleMapsKey;
  const wantsGoogle = effectiveProvider === "google";
  const shouldUseGoogle =
    wantsGoogle && activeGoogleMapsKey.length > 0 && !hasUnsafeGoogleKeyRotation;
  const normalizedHeatmap = useMemo(
    () => normalizeHeatmap(mapProps.heatmapData),
    [mapProps.heatmapData],
  );
  const renderedGooglePoints = useMemo(() => {
    const shouldCluster =
      !mapProps.disableClientClustering && !hasBackendAggregation(normalizedHeatmap);
    return shouldCluster ? clusterHeatmapPoints(normalizedHeatmap) : normalizedHeatmap;
  }, [mapProps.disableClientClustering, normalizedHeatmap]);
  const googleEvidence = useMemo(
    () =>
      buildMapEvidence({
        evidence: {
          ...(mapProps.evidence ?? {}),
          provider: "google",
          pointCount: renderedGooglePoints.length,
          featureCount: 0,
          empty: renderedGooglePoints.length === 0,
        },
        points: renderedGooglePoints,
        features: [],
        source: "google",
        provider: "google",
        contractVersion: mapProps.geoLayerConfig?.contract_version,
      }),
    [
      mapProps.evidence,
      mapProps.geoLayerConfig?.contract_version,
      renderedGooglePoints,
    ],
  );

  useEffect(() => {
    setProviderOverride(null);
    setFallbackMessage(null);
  }, [provider, resolvedGoogleMapsKey]);

  useEffect(() => {
    if (provider === "google" && !googleLoaderKey && resolvedGoogleMapsKey) {
      setGoogleLoaderKey(resolvedGoogleMapsKey);
    }
  }, [googleLoaderKey, provider, resolvedGoogleMapsKey]);

  useEffect(() => {
    onProviderUnavailableRef.current = onProviderUnavailable;
  }, [onProviderUnavailable]);

  const handleProviderUnavailable = useCallback(
    (reason: MapProviderUnavailableReason, details?: unknown) => {
      setProviderOverride("maplibre");
      setFallbackMessage(FALLBACK_MESSAGES[reason] ?? FALLBACK_MESSAGES["load-error"]);
      onProviderUnavailableRef.current?.("google", reason, details);
    },
    [],
  );

  useEffect(() => {
    if (wantsGoogle && !resolvedGoogleMapsKey) {
      handleProviderUnavailable("missing-api-key");
    }
  }, [handleProviderUnavailable, resolvedGoogleMapsKey, wantsGoogle]);

  useEffect(() => {
    if (provider === "google" && hasUnsafeGoogleKeyRotation) {
      handleProviderUnavailable("load-error", new Error(GOOGLE_KEY_ROTATION_ERROR));
    }
  }, [handleProviderUnavailable, hasUnsafeGoogleKeyRotation, provider]);

  useEffect(() => {
    if (!shouldUseGoogle || GoogleHeatmapMap) return;

    let active = true;
    import("@/components/GoogleHeatmapMap")
      .then((module) => {
        if (active) setGoogleHeatmapMap(() => module.GoogleHeatmapMap);
      })
      .catch((error) => {
        if (active) handleProviderUnavailable("load-error", error);
      });

    return () => {
      active = false;
    };
  }, [GoogleHeatmapMap, handleProviderUnavailable, shouldUseGoogle]);

  const shouldUseMapLibre = !shouldUseGoogle;

  useEffect(() => {
    if (!shouldUseMapLibre || MapLibreMap) return;

    let active = true;
    setMapLibreLoadError(false);
    import("@/components/MapLibreMap")
      .then((module) => {
        if (active) setMapLibreMap(() => module.default);
      })
      .catch(() => {
        if (active) setMapLibreLoadError(true);
      });

    return () => {
      active = false;
    };
  }, [MapLibreMap, shouldUseMapLibre]);

  if (shouldUseGoogle) {
    if (!GoogleHeatmapMap) {
      return (
        <div
          className={cn(
            "flex min-h-80 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/30 text-sm text-muted-foreground",
            mapProps.className,
          )}
          role="status"
        >
          Cargando proveedor de mapa...
        </div>
      );
    }

    return (
      <GoogleHeatmapMap
        key={`google:${activeGoogleMapsKey}`}
        center={mapProps.center}
        initialZoom={mapProps.initialZoom ?? 12}
        onSelect={mapProps.onSelect}
        heatmapData={renderedGooglePoints}
        showHeatmap={mapProps.showHeatmap ?? true}
        showPoints={mapProps.showPoints}
        showPointLabels={mapProps.showPointLabels}
        marker={mapProps.marker}
        className={mapProps.className}
        adminLocation={mapProps.adminLocation}
        fitToBounds={mapProps.fitToBounds}
        boundsPadding={mapProps.boundsPadding}
        onBoundingBoxChange={mapProps.onBoundingBoxChange}
        onProviderUnavailable={handleProviderUnavailable}
        disableClustering
        googleMapsKey={activeGoogleMapsKey}
        evidence={googleEvidence}
        showEvidenceBadge={mapProps.showEvidenceBadge}
      />
    );
  }

  if (!MapLibreMap || mapLibreLoadError) {
    return (
      <div
        className={cn(
          "flex min-h-80 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/30 px-6 text-center text-sm text-muted-foreground",
          mapProps.className,
        )}
        role={mapLibreLoadError ? "alert" : "status"}
      >
        {mapLibreLoadError
          ? "No se pudo cargar el mapa disponible. Actualizá la página para reintentar."
          : "Cargando proveedor de mapa..."}
      </div>
    );
  }

  return (
    <MapLibreMap
      {...mapProps}
      provider="maplibre"
      providerFallbackMessage={fallbackMessage}
    />
  );
}
