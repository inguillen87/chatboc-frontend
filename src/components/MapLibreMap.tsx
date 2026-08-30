import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import "maplibre-gl/dist/maplibre-gl.css";
import type { HeatPoint } from "@/services/statsService";
import type { Map, LngLatLike, StyleSpecification } from "maplibre-gl";
import type { MapProvider, MapProviderUnavailableReason } from "@/hooks/useMapProvider";
import { MapEvidenceBadge, buildMapEvidence, type MapEvidenceInput } from "@/components/maps/MapEvidenceBadge";
import { clusterHeatmapPoints } from "@/utils/heatmap";
import { trackFrontendEvent } from "@/utils/frontendTelemetry";
import { runtimeDiagnostics } from "@/utils/runtimeDiagnostics";

const normalizeExternalMapLibreAsset = (value: unknown): string => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (url.hostname.toLowerCase() === "maps.chatboc.ar") {
      return "";
    }
  } catch {
    return "";
  }

  return trimmed;
};

const normalizeMapLibreStyleUrl = (value: unknown): string => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";

  try {
    const url = new URL(
      trimmed,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    if (url.hostname.toLowerCase() === "maps.chatboc.ar") {
      return "";
    }
  } catch {
    return "";
  }

  return trimmed;
};

const MAPLIBRE_EXTERNAL_JS_URL = normalizeExternalMapLibreAsset(
  import.meta.env.VITE_MAPLIBRE_JS_URL ?? import.meta.env.NEXT_PUBLIC_MAPLIBRE_JS_URL,
);

const MAPLIBRE_EXTERNAL_CSS_URL = normalizeExternalMapLibreAsset(
  import.meta.env.VITE_MAPLIBRE_CSS_URL ?? import.meta.env.NEXT_PUBLIC_MAPLIBRE_CSS_URL,
);

export type MapLibreMapProps = {
  center?: [number, number]; // [lon, lat]
  initialZoom?: number;
  onSelect?: (lat: number, lon: number, address?: string) => void;
  onFeatureSelect?: (point: HeatPoint | null) => void;
  heatmapData?: HeatPoint[];
  polygons?: { type: "FeatureCollection"; features: any[] };
  showHeatmap?: boolean;
  showPoints?: boolean;
  showPointLabels?: boolean;
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
  fitBoundsRequestKey?: string | number;
  boundsPadding?: number | { top?: number; bottom?: number; left?: number; right?: number };
  onBoundingBoxChange?: (bbox: [number, number, number, number] | null) => void;
  onProviderUnavailable?: (
    provider: MapProvider,
    reason: MapProviderUnavailableReason,
    details?: unknown,
  ) => void;
  disableClientClustering?: boolean;
  evidence?: MapEvidenceInput | null;
  showEvidenceBadge?: boolean;
  providerFallbackMessage?: string | null;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  popupContext?: "tickets" | "survey" | "territory";
  pointMinZoom?: number;
  pointLabelMinZoom?: number;
  pointLabelMode?: "count" | "barrio" | "categoria" | "none";
  heatmapRadiusScale?: number;
  heatmapPalette?: "default" | "faro";
  /** Fade density as the operator zooms in so concrete points become the primary evidence. */
  adaptiveZoomMode?: boolean;
};

const isRenderableCoordinatePair = (lat: unknown, lng: unknown): lat is number =>
  typeof lat === "number" &&
  typeof lng === "number" &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180 &&
  !(lat === 0 && lng === 0);

const addLayer = (map: Map, layer: any) => {
  if (!map.getLayer(layer.id)) {
    map.addLayer(layer);
  }
};

const MAP_HEAT_SOURCE_ID = "chatboc-runtime-heatmap";
const MAP_POINT_SOURCE_ID = "chatboc-runtime-points";
const FILTERED_VIEW_MAX_ZOOM = 14;
const COMPACT_FILTERED_VIEW_MAX_ZOOM = 13;
const COMPACT_FILTERED_VIEW_SPAN_DEGREES = 0.0025;
const EMPTY_MAP_FEATURE_COLLECTION: { type: "FeatureCollection"; features: unknown[] } = {
  type: "FeatureCollection" as const,
  features: [],
};

const heatmapRadiusExpression = (scale: number) => [
  "*",
  scale,
  [
    "interpolate",
    ["linear"],
    ["zoom"],
    0,
    [
      "max",
      4,
      [
        "*",
        ["sqrt", ["coalesce", ["get", "clusterSize"], ["get", "point_count"], 1]],
        2.6,
      ],
    ],
    9,
    [
      "max",
      14,
      [
        "*",
        ["sqrt", ["coalesce", ["get", "clusterSize"], ["get", "point_count"], 1]],
        4.8,
      ],
    ],
    13,
    [
      "max",
      18,
      [
        "*",
        ["sqrt", ["coalesce", ["get", "clusterSize"], ["get", "point_count"], 1]],
        6.4,
      ],
    ],
  ],
];

const sourceDataForLayer = (
  source: { type: "FeatureCollection"; features: unknown[] },
  visible: boolean,
) => (visible ? source : EMPTY_MAP_FEATURE_COLLECTION);

type MapLibreModule = typeof import("maplibre-gl");

declare global {
  interface Window {
    maplibregl?: MapLibreModule;
  }
}

let cachedMapLibre: MapLibreModule | null = null;
let maplibrePromise: Promise<MapLibreModule> | null = null;
let externalMapLibrePromise: Promise<void> | null = null;
let didWarnExternalAssetsFallback = false;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const BOUNDING_BOX_DEBOUNCE_MS = 80;

const readReducedMotionPreference = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(REDUCED_MOTION_QUERY).matches
    : false;

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(readReducedMotionPreference);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener?.("change", updatePreference);

    return () => mediaQuery.removeEventListener?.("change", updatePreference);
  }, []);

  return prefersReducedMotion;
};

const ensureExternalMapLibreAssets = async (): Promise<void> => {
  if (typeof window === "undefined") return;
  if (!MAPLIBRE_EXTERNAL_JS_URL) return;

  if (MAPLIBRE_EXTERNAL_CSS_URL && !document.querySelector(`link[data-maplibre-css="${MAPLIBRE_EXTERNAL_CSS_URL}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = MAPLIBRE_EXTERNAL_CSS_URL;
    link.setAttribute("data-maplibre-css", MAPLIBRE_EXTERNAL_CSS_URL);
    document.head.appendChild(link);
  }

  if (window.maplibregl?.Map) return;
  if (externalMapLibrePromise) return externalMapLibrePromise;

  externalMapLibrePromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector(`script[data-maplibre-js="${MAPLIBRE_EXTERNAL_JS_URL}"]`) as HTMLScriptElement | null;

    if (existingScript) {
      if (window.maplibregl?.Map) {
        resolve();
        return;
      }
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("MapLibre script failed to load")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = MAPLIBRE_EXTERNAL_JS_URL;
    script.async = true;
    script.setAttribute("data-maplibre-js", MAPLIBRE_EXTERNAL_JS_URL);
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("MapLibre script failed to load")), { once: true });
    document.head.appendChild(script);
  }).catch((error) => {
    externalMapLibrePromise = null;
    throw error;
  });

  return externalMapLibrePromise;
};

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

  try {
    await ensureExternalMapLibreAssets();
  } catch (error) {
    if (!didWarnExternalAssetsFallback) {
      didWarnExternalAssetsFallback = true;
      runtimeDiagnostics.warn("[MapLibreMap] External MapLibre assets failed to load, using bundled module fallback", error);
    }
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
      canal: p.canal,
      fuente: p.fuente,
      source: p.source,
      total: p.total,
      categoryColor: p.categoryColor,
      direccion: p.direccion,
      addressCellLabel: p.addressCellLabel,
      distrito: p.distrito,
      barrio: p.barrio,
      ciudad: p.ciudad,
      provincia: p.provincia,
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

const popupNumberFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
});

const appendPopupText = (
  parent: HTMLElement,
  tagName: "p" | "span" | "strong",
  text: string,
  className?: string,
) => {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  parent.appendChild(element);
  return element;
};

const appendPopupBreakdown = (
  parent: HTMLElement,
  title: string,
  items: HeatPoint["aggregatedCategorias"] | undefined,
  numberFormatter = popupNumberFormatter,
) => {
  if (!items?.length) return;

  const section = document.createElement("div");
  section.className = "mt-3 text-xs leading-relaxed";
  appendPopupText(
    section,
    "p",
    title,
    "font-semibold uppercase tracking-wide text-slate-500",
  );

  const list = document.createElement("ul");
  list.className = "mt-1 space-y-0.5";
  items.slice(0, 3).forEach((item) => {
    const row = document.createElement("li");
    const label = document.createElement("span");
    label.className = "font-medium text-slate-700";
    label.textContent = String(item.label ?? "");
    row.appendChild(label);
    row.append(
      ` · ${numberFormatter.format(Number(item.weight ?? 0))} (${Number(item.percentage ?? 0).toFixed(1)}%)`,
    );
    list.appendChild(row);
  });

  section.appendChild(list);
  parent.appendChild(section);
};

const TERRITORY_PLACEHOLDER_LABELS = new Set([
  "sin zona",
  "sin barrio",
  "sin distrito",
  "sin localidad",
  "no informado",
  "no informada",
  "desconocido",
  "desconocida",
  "unknown",
  "none",
  "null",
  "n/a",
]);

const presentTerritoryLabel = (value: unknown) => {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const label = String(value).trim();
  if (!label) return undefined;
  const normalized = label
    .toLocaleLowerCase("es-AR")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  return TERRITORY_PLACEHOLDER_LABELS.has(normalized) ? undefined : label;
};

const appendPopupTicketLink = (
  parent: HTMLElement,
  ticketId: unknown,
  label: string,
  className = "text-blue-600 underline hover:text-blue-500",
) => {
  const safeId = String(ticketId ?? "").trim();
  if (!safeId) return null;

  const link = document.createElement("a");
  link.href = `/chat/${encodeURIComponent(safeId)}`;
  link.className = className;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  parent.appendChild(link);
  return link;
};

export const buildMapClusterPopupContent = ({
  cluster,
  properties,
  numberFormatter = popupNumberFormatter,
  popupContext = "tickets",
}: {
  cluster?: HeatPoint;
  properties?: Record<string, unknown>;
  numberFormatter?: Intl.NumberFormat;
  popupContext?: "tickets" | "survey" | "territory";
}) => {
  const root = document.createElement("div");
  root.className = "max-w-xs space-y-1";

  if (cluster) {
    const clusterSize = Number.isFinite(cluster.clusterSize)
      ? Number(cluster.clusterSize)
      : 1;
    const totalWeight = Number.isFinite(cluster.totalWeight)
      ? Number(cluster.totalWeight)
      : Number(cluster.weight ?? 0);

    if (popupContext === "territory") {
      const zone = presentTerritoryLabel(cluster.barrio) ?? presentTerritoryLabel(cluster.distrito);
      const locality = [zone, presentTerritoryLabel(cluster.ciudad)].filter(Boolean).join(" · ");
      appendPopupText(
        root,
        "p",
        locality || "Ubicación pendiente de verificar",
        "text-sm font-semibold text-slate-800",
      );
      if (cluster.categoria) {
        appendPopupText(root, "p", `Categoría: ${cluster.categoria}`, "text-xs text-slate-600");
      }
      if (cluster.direccion) {
        appendPopupText(root, "p", `Área agrupada: ${cluster.direccion}`, "text-xs text-slate-600");
      }
      if (cluster.tipo_ticket) {
        appendPopupText(root, "p", `Tipo: ${cluster.tipo_ticket}`, "text-xs text-slate-600");
      }
      if (cluster.estado) {
        appendPopupText(root, "p", `Estado: ${cluster.estado}`, "text-xs text-slate-600");
      }
      if (cluster.canal) {
        appendPopupText(root, "p", `Canal: ${cluster.canal}`, "text-xs text-slate-600");
      }
      if (totalWeight > 0) {
        appendPopupText(
          root,
          "p",
          `Volumen representativo: ${numberFormatter.format(totalWeight)}`,
          "mt-1 text-xs font-semibold text-slate-700",
        );
      }
      return root;
    }

    if (popupContext === "survey") {
      const representedResponses = totalWeight > 0 ? totalWeight : clusterSize;
      appendPopupText(
        root,
        "p",
        `Respuestas representadas: ${numberFormatter.format(representedResponses)}`,
        "text-sm font-semibold text-slate-800",
      );

      const zone = presentTerritoryLabel(cluster.barrio) ?? presentTerritoryLabel(cluster.distrito);
      if (zone) {
        appendPopupText(root, "p", `Zona: ${zone}`, "text-xs text-slate-600");
      }
      if (cluster.canal) {
        appendPopupText(root, "p", `Canal: ${cluster.canal}`, "text-xs text-slate-600");
      }
      return root;
    }

    appendPopupText(
      root,
      "p",
      `Reportes en la zona: ${clusterSize.toLocaleString("es-AR")}`,
      "text-sm font-semibold text-slate-800",
    );

    if (totalWeight > 0) {
      appendPopupText(
        root,
        "p",
        `Peso agregado: ${numberFormatter.format(totalWeight)}`,
        "text-xs text-slate-600",
      );
    }

    if (Number.isFinite(cluster.averageWeight) && clusterSize > 1) {
      appendPopupText(
        root,
        "p",
        `Peso promedio por reporte: ${numberFormatter.format(Number(cluster.averageWeight))}`,
        "text-xs text-slate-600",
      );
    }

    const topBarrio = cluster.aggregatedBarrios?.find((item) => presentTerritoryLabel(item.label));
    if (topBarrio) {
      appendPopupText(
        root,
        "p",
        `Zona destacada: ${presentTerritoryLabel(topBarrio.label)} (${Number(topBarrio.percentage ?? 0).toFixed(1)}%)`,
        "text-xs text-slate-600",
      );
    } else if (presentTerritoryLabel(cluster.barrio) || presentTerritoryLabel(cluster.distrito)) {
      appendPopupText(
        root,
        "p",
        `Zona: ${presentTerritoryLabel(cluster.barrio) ?? presentTerritoryLabel(cluster.distrito)}`,
        "text-xs text-slate-600",
      );
    }

    if (cluster.last_ticket_at) {
      const parsed = Date.parse(cluster.last_ticket_at);
      if (Number.isFinite(parsed)) {
        appendPopupText(
          root,
          "p",
          `Ultimo ticket: ${new Date(parsed).toLocaleString("es-AR")}`,
          "text-xs text-slate-600",
        );
      }
    }

    appendPopupBreakdown(root, "Categorias principales", cluster.aggregatedCategorias, numberFormatter);
    appendPopupBreakdown(root, "Estados", cluster.aggregatedEstados, numberFormatter);
    appendPopupBreakdown(root, "Severidad", cluster.aggregatedSeveridades, numberFormatter);
    appendPopupBreakdown(root, "Tipos de ticket", cluster.aggregatedTipos, numberFormatter);

    const samples = cluster.sampleTickets ?? [];
    if (samples.length) {
      const paragraph = document.createElement("p");
      paragraph.className = "mt-3 text-xs text-slate-600";
      paragraph.append("Tickets relacionados: ");
      samples.slice(0, 3).forEach((ticketId, index) => {
        if (index > 0) paragraph.append(" · ");
        appendPopupTicketLink(paragraph, ticketId, `#${String(ticketId)}`);
      });
      root.appendChild(paragraph);
    } else if (cluster.ticket || cluster.id) {
      const paragraph = document.createElement("p");
      paragraph.className = "mt-3 text-xs";
      appendPopupTicketLink(paragraph, cluster.ticket ?? cluster.id, "Ver ticket de referencia");
      root.appendChild(paragraph);
    }

    return root;
  }

  const safeProperties = properties ?? {};
  const id = safeProperties.id;
  const ticket = safeProperties.ticket;
  const categoria = safeProperties.categoria;
  const direccion = safeProperties.direccion;
  const distrito = presentTerritoryLabel(safeProperties.distrito);

  if (popupContext === "territory") {
    const barrio = presentTerritoryLabel(safeProperties.barrio) ?? distrito;
    const ciudad = presentTerritoryLabel(safeProperties.ciudad);
    const locality = [barrio, ciudad].filter(Boolean).map(String).join(" · ");
    appendPopupText(
      root,
      "p",
      locality || "Ubicación pendiente de verificar",
      "text-sm font-semibold text-slate-800",
    );
    if (categoria) {
      appendPopupText(root, "p", `Categoría: ${String(categoria)}`, "text-xs text-slate-600");
    }
    if (direccion) {
      appendPopupText(root, "p", `Área agrupada: ${String(direccion)}`, "text-xs text-slate-600");
    }
    if (safeProperties.tipo_ticket) {
      appendPopupText(root, "p", `Tipo: ${String(safeProperties.tipo_ticket)}`, "text-xs text-slate-600");
    }
    if (safeProperties.estado) {
      appendPopupText(root, "p", `Estado: ${String(safeProperties.estado)}`, "text-xs text-slate-600");
    }
    if (safeProperties.canal) {
      appendPopupText(root, "p", `Canal: ${String(safeProperties.canal)}`, "text-xs text-slate-600");
    }
    const volume = Number(safeProperties.totalWeight ?? safeProperties.weight ?? 0);
    if (Number.isFinite(volume) && volume > 0) {
      appendPopupText(
        root,
        "p",
        `Volumen representativo: ${numberFormatter.format(volume)}`,
        "mt-1 text-xs font-semibold text-slate-700",
      );
    }
    return root;
  }

  if (popupContext === "survey") {
    const responseCandidates = [
      safeProperties.totalWeight,
      safeProperties.total,
      safeProperties.clusterSize,
      safeProperties.weight,
    ];
    const representedResponses = responseCandidates
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value) && value >= 0);
    appendPopupText(
      root,
      "p",
      Number.isFinite(representedResponses)
        ? `Respuestas representadas: ${numberFormatter.format(representedResponses as number)}`
        : "Participación territorial",
      "text-sm font-semibold text-slate-800",
    );
    const zone = presentTerritoryLabel(safeProperties.barrio) ?? distrito;
    if (zone) {
      appendPopupText(root, "p", `Zona: ${String(zone)}`, "text-xs text-slate-600");
    }
    if (safeProperties.canal) {
      appendPopupText(root, "p", `Canal: ${String(safeProperties.canal)}`, "text-xs text-slate-600");
    }
    return root;
  }

  if (ticket || id) {
    appendPopupText(root, "p", `Ticket #${String(ticket ?? id)}`, "text-sm font-semibold");
  }
  if (categoria) {
    appendPopupText(root, "p", `Categoria: ${String(categoria)}`, "text-xs text-slate-600");
  }
  if (distrito) {
    appendPopupText(root, "p", `Distrito: ${String(distrito)}`, "text-xs text-slate-600");
  }
  if (direccion) {
    appendPopupText(root, "p", `Direccion: ${String(direccion)}`, "text-xs text-slate-600");
  }
  if (id) {
    const paragraph = document.createElement("p");
    paragraph.className = "mt-3 text-xs";
    appendPopupTicketLink(paragraph, id, "Ver ticket");
    root.appendChild(paragraph);
  }

  return root;
};

const toggleLayers = (
  map: Map,
  showHeatmap: boolean,
  showPoints: boolean,
  showPointLabels: boolean,
  showPolygons: boolean,
  layerIds: { heat: string; halo: string; circles: string; labels: string },
  haloFollowsHeat = false,
) => {
  if (map.getLayer(layerIds.heat)) {
    map.setLayoutProperty(
      layerIds.heat,
      "visibility",
      showHeatmap && !showPolygons ? "visible" : "none",
    );
  }
  if (map.getLayer(layerIds.halo)) {
    map.setLayoutProperty(
      layerIds.halo,
      "visibility",
      (haloFollowsHeat ? showHeatmap : showPoints) && !showPolygons ? "visible" : "none",
    );
  }
  if (map.getLayer(layerIds.circles)) {
    map.setLayoutProperty(
      layerIds.circles,
      "visibility",
      showPoints && !showPolygons ? "visible" : "none",
    );
  }
  if (map.getLayer(layerIds.labels)) {
    map.setLayoutProperty(
      layerIds.labels,
      "visibility",
      showPoints && showPointLabels && !showPolygons ? "visible" : "none",
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
  onFeatureSelect,
  heatmapData = [],
  polygons,
  showHeatmap = true,
  showPoints,
  showPointLabels = true,
  showPolygons = false,
  marker,
  className,
  mapStyleUrl,
  mapTileUrl,
  mapTileAttribution,
  maptilerKey,
  geoLayerConfig,
  adminLocation,
  fitToBounds,
  fitBoundsRequestKey,
  boundsPadding,
  onBoundingBoxChange,
  disableClientClustering = false,
  evidence,
  showEvidenceBadge = true,
  providerFallbackMessage,
  ariaLabel,
  ariaDescribedBy,
  popupContext = "tickets",
  pointMinZoom = 9,
  pointLabelMinZoom = 9,
  pointLabelMode = "count",
  heatmapRadiusScale = 1,
  heatmapPalette = "default",
  adaptiveZoomMode = false,
}: MapLibreMapProps) {
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapGeneration, setMapGeneration] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const normalizedHeatmap = useMemo(
    () =>
      (heatmapData ?? []).filter(
        (point): point is HeatPoint & { lat: number; lng: number } =>
          Boolean(point) && isRenderableCoordinatePair(point.lat, point.lng),
      ),
    [heatmapData],
  );
  const aggregatedHint = useMemo(
    () =>
      normalizedHeatmap.some(
        (point) =>
          (typeof point.clusterSize === "number" && point.clusterSize > 1) ||
          Boolean(point.clusterId),
      ),
    [normalizedHeatmap],
  );
  const shouldCluster = useMemo(
    () => normalizedHeatmap.length > 0 && !disableClientClustering && !aggregatedHint,
    [disableClientClustering, aggregatedHint, normalizedHeatmap.length],
  );
  const processedHeatmap = useMemo(
    () => (shouldCluster ? clusterHeatmapPoints(normalizedHeatmap) : normalizedHeatmap),
    [normalizedHeatmap, shouldCluster],
  );
  const resolvedShowPoints = showPoints ?? (!showHeatmap && !showPolygons);
  const resolvedShowPointLabels = showPointLabels && pointLabelMode !== "none";
  const resolvedPointMinZoom = Number.isFinite(pointMinZoom)
    ? Math.max(0, Math.min(24, pointMinZoom))
    : 9;
  const resolvedPointLabelMinZoom = Number.isFinite(pointLabelMinZoom)
    ? Math.max(0, Math.min(24, pointLabelMinZoom))
    : 9;
  const resolvedHeatmapRadiusScale = Number.isFinite(heatmapRadiusScale)
    ? Math.max(0.5, Math.min(4, heatmapRadiusScale))
    : 1;
  const configuredGeoSource = useMemo(
    () => (isFeatureCollection(geoLayerConfig?.source) ? geoLayerConfig.source : null),
    [geoLayerConfig?.source],
  );
  const renderedGeoSource = shouldCluster ? null : configuredGeoSource;
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
      halo: `${geoLayerConfig?.layers?.points?.id?.trim() || "tickets-circles"}-halo`,
      circles: geoLayerConfig?.layers?.points?.id?.trim() || "tickets-circles",
      labels: geoLayerConfig?.layers?.clusters?.id?.trim() || `${geoLayerConfig?.layers?.points?.id?.trim() || "tickets-circles"}-labels`,
    }),
    [geoLayerConfig?.layers?.clusters?.id, geoLayerConfig?.layers?.heatmap?.id, geoLayerConfig?.layers?.points?.id],
  );
  const configuredInteractions = useMemo(
    () => ({
      hover: geoLayerConfig?.interactions?.hover !== false,
      timeSliderEnabled: Boolean(geoLayerConfig?.interactions?.time_slider?.enabled),
      timeSliderField: geoLayerConfig?.interactions?.time_slider?.field,
    }),
    [geoLayerConfig?.interactions?.hover, geoLayerConfig?.interactions?.time_slider?.enabled, geoLayerConfig?.interactions?.time_slider?.field],
  );
  const telemetryEndpoint = typeof geoLayerConfig?.telemetry?.event_endpoint === "string"
    ? geoLayerConfig.telemetry.event_endpoint.trim()
    : "";
  const telemetryEventsKey = Array.isArray(geoLayerConfig?.telemetry?.events)
    ? geoLayerConfig.telemetry.events
      .filter((event): event is string => typeof event === "string" && event.trim().length > 0)
      .map((event) => event.trim())
      .join("\u001f")
    : "";
  const telemetryConfig = useMemo(() => {
    return {
      endpoint: telemetryEndpoint || null,
      events: telemetryEventsKey ? telemetryEventsKey.split("\u001f") : [],
    };
  }, [telemetryEndpoint, telemetryEventsKey]);

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
  const clusterCountMarkersRef = useRef<any[]>([]);
  const latestHeatmap = useRef<HeatPoint[]>(processedHeatmap);
  const configuredGeoSourceRef = useRef(renderedGeoSource);
  const configuredInteractionsRef = useRef(configuredInteractions);
  const contractVersionRef = useRef(geoLayerConfig?.contract_version ?? null);
  const popupContextRef = useRef<"tickets" | "survey" | "territory">(popupContext);
  const emitBackendMapEventRef = useRef(emitBackendMapEvent);
  const boundingBoxCallbackRef = useRef<MapLibreMapProps['onBoundingBoxChange']>(onBoundingBoxChange);
  const boundingBoxControllerRef = useRef<{ setEnabled: (enabled: boolean) => void } | null>(null);
  const hasBoundingBoxCallback = Boolean(onBoundingBoxChange);
  const mapEvidence = useMemo(
    () =>
      buildMapEvidence({
        evidence,
        points: normalizedHeatmap,
        features: configuredGeoSource?.features ?? null,
        source: "maplibre",
        provider: "maplibre",
        contractVersion: geoLayerConfig?.contract_version,
      }),
    [
      configuredGeoSource?.features,
      evidence,
      geoLayerConfig?.contract_version,
      normalizedHeatmap,
    ],
  );

  const resolvedMaptilerKey = (maptilerKey ?? import.meta.env.VITE_MAPTILER_KEY ?? "").trim();
  const apiKeyRef = useRef(resolvedMaptilerKey);
  const centerRef = useRef(center);
  const showHeatmapRef = useRef(showHeatmap);
  const showPointsRef = useRef(resolvedShowPoints);
  const showPointLabelsRef = useRef(resolvedShowPointLabels);
  const showPolygonsRef = useRef(showPolygons);
  const polygonsRef = useRef(polygons);
  const onSelectRef = useRef(onSelect);
  const onFeatureSelectRef = useRef(onFeatureSelect);
  const initialZoomRef = useRef(initialZoom);
  const prefersReducedMotionRef = useRef(prefersReducedMotion);
  const boundsPaddingRef = useRef(boundsPadding);
  const heatmapRadiusScaleRef = useRef(resolvedHeatmapRadiusScale);

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
    showPointsRef.current = resolvedShowPoints;
  }, [resolvedShowPoints]);

  useEffect(() => {
    showPointLabelsRef.current = resolvedShowPointLabels;
  }, [resolvedShowPointLabels]);

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
    onFeatureSelectRef.current = onFeatureSelect;
  }, [onFeatureSelect]);

  useEffect(() => {
    initialZoomRef.current = initialZoom;
  }, [initialZoom]);

  useEffect(() => {
    prefersReducedMotionRef.current = prefersReducedMotion;
  }, [prefersReducedMotion]);

  useEffect(() => {
    boundsPaddingRef.current = boundsPadding;
  }, [boundsPadding]);

  useEffect(() => {
    heatmapRadiusScaleRef.current = resolvedHeatmapRadiusScale;
  }, [resolvedHeatmapRadiusScale]);

  useEffect(() => {
    latestHeatmap.current = processedHeatmap;
  }, [processedHeatmap]);

  useEffect(() => {
    configuredGeoSourceRef.current = renderedGeoSource;
  }, [renderedGeoSource]);

  useEffect(() => {
    configuredInteractionsRef.current = configuredInteractions;
  }, [configuredInteractions]);

  useEffect(() => {
    contractVersionRef.current = geoLayerConfig?.contract_version ?? null;
  }, [geoLayerConfig?.contract_version]);

  useEffect(() => {
    popupContextRef.current = popupContext;
  }, [popupContext]);

  useEffect(() => {
    emitBackendMapEventRef.current = emitBackendMapEvent;
  }, [emitBackendMapEvent]);

  useEffect(() => {
    boundingBoxCallbackRef.current = onBoundingBoxChange;
  }, [onBoundingBoxChange]);

  useEffect(() => {
    boundingBoxControllerRef.current?.setEnabled(hasBoundingBoxCallback);
  }, [hasBoundingBoxCallback]);

  useEffect(() => {
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
        const contractStyleUrl = normalizeMapLibreStyleUrl(geoLayerConfig?.style_url);
        const envStyleUrl = normalizeMapLibreStyleUrl(
          import.meta.env.VITE_MAPLIBRE_STYLE_URL ?? import.meta.env.NEXT_PUBLIC_MAPLIBRE_STYLE_URL,
        );
        const customStyle = normalizeMapLibreStyleUrl(mapStyleUrl) || contractStyleUrl || envStyleUrl;
        const customTileUrl = (mapTileUrl ?? "").trim();
        const customTileAttribution =
          (mapTileAttribution ?? "").trim() || "© OpenStreetMap contributors";
        const tileStyle: StyleSpecification | null = customTileUrl
          ? {
              version: 8 as const,
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
        const defaultRasterStyle: StyleSpecification = {
          version: 8 as const,
          sources: {
            osm: {
              type: "raster",
              tiles: [
                "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        };
        const styleCandidates: Array<string | typeof defaultRasterStyle> = [
          customStyle || null,
          key ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${key}` : null,
          "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
          "https://tiles.stadiamaps.com/styles/alidade_smooth.json",
          "https://demotiles.maplibre.org/style.json",
          defaultRasterStyle,
        ].filter((value): value is string | typeof defaultRasterStyle =>
          typeof value === "string" ? value.length > 0 : Boolean(value),
        );

        let currentStyleIndex = 0;
        let exhaustedStyles = false;

        const initialStyle = tileStyle ?? styleCandidates[0] ?? "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

        const mapInstance = new maplibre.Map({
          container: mapContainerRef.current,
          style: initialStyle,
          center: centerRef.current ?? [0, 0],
          zoom: initialZoomRef.current,
          cooperativeGestures: true,
          maxPitch: 60,
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

          const currentSource =
            configuredGeoSourceRef.current ?? buildGeoJson(latestHeatmap.current);

          if (!map.getSource(MAP_HEAT_SOURCE_ID)) {
            map.addSource(MAP_HEAT_SOURCE_ID, {
              type: "geojson",
              data: sourceDataForLayer(
                currentSource,
                showHeatmapRef.current && !showPolygonsRef.current,
              ),
              ...configuredSourceOptions,
            });
          }

          if (!map.getSource(MAP_POINT_SOURCE_ID)) {
            map.addSource(MAP_POINT_SOURCE_ID, {
              type: "geojson",
              data: sourceDataForLayer(
                currentSource,
                showPointsRef.current && !showPolygonsRef.current,
              ),
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
            source: MAP_HEAT_SOURCE_ID,
            maxzoom: 15,
            paint: {
              "heatmap-weight": heatmapPalette === "faro"
                ? [
                    "interpolate",
                    ["linear"],
                    ["coalesce", ["get", "intensity"], ["get", "weight"], 1],
                    0,
                    0,
                    1,
                    0.42,
                    4,
                    0.58,
                    16,
                    0.78,
                    64,
                    1,
                  ]
                : ["coalesce", ["get", "intensity"], ["get", "weight"], ["get", "point_count"], 1],
              "heatmap-intensity": heatmapPalette === "faro"
                ? ["interpolate", ["linear"], ["zoom"], 0, 1.8, 15, 4.6]
                : ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3.5],
              "heatmap-radius": heatmapRadiusExpression(heatmapRadiusScaleRef.current),
              "heatmap-opacity": adaptiveZoomMode
                ? ["interpolate", ["linear"], ["zoom"], 4, 0.76, 9, 0.58, 12, 0.24, 14, 0]
                : heatmapPalette === "faro"
                  ? 0.76
                  : 0.65,
              "heatmap-color": heatmapPalette === "faro"
                ? [
                    "interpolate",
                    ["linear"],
                    ["heatmap-density"],
                    0,
                    "rgba(105, 213, 223, 0)",
                    0.03,
                    "rgba(105, 213, 223, 0.38)",
                    0.24,
                    "rgba(8, 124, 129, 0.68)",
                    0.58,
                    "rgba(242, 184, 75, 0.82)",
                    1,
                    "rgba(213, 93, 57, 0.96)",
                  ]
                : [
                    "interpolate",
                    ["linear"],
                    ["heatmap-density"],
                    0,
                    "rgba(68, 1, 84, 0)",
                    0.18,
                    "rgba(68, 1, 84, 0.62)",
                    0.38,
                    "rgba(59, 82, 139, 0.72)",
                    0.58,
                    "rgba(33, 145, 140, 0.78)",
                    0.78,
                    "rgba(94, 201, 98, 0.86)",
                    1,
                    "rgba(253, 231, 37, 0.96)",
                  ],
            },
          });

          addLayer(map, {
            id: configuredLayerIds.halo,
            type: "circle",
            source: heatmapPalette === "faro" ? MAP_HEAT_SOURCE_ID : MAP_POINT_SOURCE_ID,
            // Faro's heat layer always keeps a concrete location anchor on top
            // of the density field. At regional zooms the heat remains
            // interpretable instead of becoming an unlabeled colour cloud.
            minzoom: heatmapPalette === "faro" ? Math.min(resolvedPointMinZoom, 5) : resolvedPointMinZoom,
            paint: {
              "circle-radius": heatmapPalette === "faro"
                ? [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    4,
                    [
                      "+",
                      10,
                      ["min", 5, ["*", ["sqrt", ["coalesce", ["get", "totalWeight"], ["get", "weight"], 1]], 0.7]],
                    ],
                    14,
                    [
                      "+",
                      14,
                      ["min", 8, ["*", ["sqrt", ["coalesce", ["get", "totalWeight"], ["get", "weight"], 1]], 1]],
                    ],
                    16,
                    [
                      "+",
                      16,
                      ["min", 9, ["*", ["sqrt", ["coalesce", ["get", "totalWeight"], ["get", "weight"], 1]], 1.1]],
                    ],
                  ]
                : [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    8,
                    [
                      "max",
                      12,
                      ["*", ["sqrt", ["coalesce", ["get", "clusterSize"], ["get", "point_count"], 1]], 3.2],
                    ],
                    16,
                    [
                      "max",
                      24,
                      ["*", ["sqrt", ["coalesce", ["get", "clusterSize"], ["get", "point_count"], 1]], 5.2],
                    ],
                  ],
              "circle-color": heatmapPalette === "faro"
                ? [
                    "case",
                    ["has", "categoryColor"],
                    ["get", "categoryColor"],
                    "#2563eb",
                  ]
                : [
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
                      24,
                      "#a855f7",
                      42,
                      "#f43f5e",
                    ],
                  ],
              "circle-opacity": heatmapPalette === "faro"
                ? 0.96
                : ["interpolate", ["linear"], ["zoom"], 4, 0.18, 14, 0.28, 16, 0.2],
              "circle-blur": heatmapPalette === "faro" ? 0.06 : 0.86,
              ...(heatmapPalette === "faro"
                ? {
                    "circle-stroke-color": "rgba(255, 255, 255, 0.96)",
                    "circle-stroke-width": 3,
                    "circle-stroke-opacity": 0.98,
                  }
                : {}),
            },
          });

          addLayer(map, {
            id: configuredLayerIds.circles,
            type: "circle",
            source: MAP_POINT_SOURCE_ID,
            minzoom: resolvedPointMinZoom,
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
                      ["sqrt", ["coalesce", ["get", "clusterSize"], ["get", "point_count"], 1]],
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
                      ["sqrt", ["coalesce", ["get", "clusterSize"], ["get", "point_count"], 1]],
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
                [">", ["coalesce", ["get", "clusterSize"], ["get", "point_count"], 1], 12],
                "rgba(15, 23, 42, 0.35)",
                "rgba(255, 255, 255, 0.95)",
              ],
              "circle-stroke-width": 1.5,
              "circle-opacity": 0.88,
              "circle-blur": 0.12,
            },
          });

          addLayer(map, {
            id: configuredLayerIds.labels,
            type: "symbol",
            source: MAP_POINT_SOURCE_ID,
            minzoom: resolvedPointLabelMinZoom,
            layout: {
              "text-field": pointLabelMode === "barrio"
                ? ["coalesce", ["get", "barrio"], ["get", "distrito"], ""]
                : pointLabelMode === "categoria"
                  ? ["coalesce", ["get", "categoria"], ""]
                  : [
                      "case",
                      [">", ["coalesce", ["get", "clusterSize"], ["get", "point_count"], 1], 1],
                      [
                        "to-string",
                        [
                          "coalesce",
                          ["get", "totalWeight"],
                          ["get", "total"],
                          ["get", "point_count_abbreviated"],
                          ["get", "clusterSize"],
                        ],
                      ],
                      "",
                    ],
              "text-size": ["interpolate", ["linear"], ["zoom"], 9, 10, 15, 12],
              ...(pointLabelMode === "count"
                ? {}
                : {
                    "text-anchor": "top",
                    "text-offset": [0, 1.35],
                    "text-padding": 4,
                    "text-max-width": 12,
                  }),
              "text-allow-overlap": pointLabelMode === "count",
              "text-ignore-placement": pointLabelMode === "count",
            },
            paint: {
              "text-color": pointLabelMode === "count" ? "#ffffff" : "#0f172a",
              "text-halo-color": pointLabelMode === "count" ? "rgba(15, 23, 42, 0.72)" : "rgba(255, 255, 255, 0.96)",
              "text-halo-width": pointLabelMode === "count" ? 1 : 2,
              "text-opacity": 0.96,
            },
          });

          toggleLayers(
            map,
            showHeatmapRef.current,
            showPointsRef.current,
            showPointLabelsRef.current,
            showPolygonsRef.current,
            configuredLayerIds,
            heatmapPalette === "faro",
          );
          const currentInteractions = configuredInteractionsRef.current;
          trackFrontendEvent("map_loaded", {
            provider: "maplibre",
            contract_version: contractVersionRef.current,
            hover_enabled: currentInteractions.hover,
            time_slider_enabled: currentInteractions.timeSliderEnabled,
            time_slider_field: currentInteractions.timeSliderField ?? null,
          });
          emitBackendMapEventRef.current("map_loaded", {
            provider: "maplibre",
            contract_version: contractVersionRef.current,
            hover_enabled: currentInteractions.hover,
            time_slider_enabled: currentInteractions.timeSliderEnabled,
            time_slider_field: currentInteractions.timeSliderField ?? null,
          });
          const latestSource =
            configuredGeoSourceRef.current ?? buildGeoJson(latestHeatmap.current);
          const heatSource = map.getSource(MAP_HEAT_SOURCE_ID);
          if (heatSource && typeof (heatSource as any).setData === "function") {
            (heatSource as any).setData(
              sourceDataForLayer(
                latestSource,
                showHeatmapRef.current && !showPolygonsRef.current,
              ),
            );
          }
          const pointSource = map.getSource(MAP_POINT_SOURCE_ID);
          if (pointSource && typeof (pointSource as any).setData === "function") {
            (pointSource as any).setData(
              sourceDataForLayer(
                latestSource,
                showPointsRef.current && !showPolygonsRef.current,
              ),
            );
          }
        };

        const cycleStyle = (reason?: string) => {
          if (!isMounted || tileStyle || exhaustedStyles || styleCandidates.length === 0) {
            return;
          }

          if (currentStyleIndex < styleCandidates.length - 1) {
            currentStyleIndex += 1;
            const nextStyle = styleCandidates[currentStyleIndex];
            runtimeDiagnostics.warn("[MapLibreMap] Falling back to alternate style", {
              nextStyle: typeof nextStyle === "string" ? nextStyle : "inline-raster-style",
              reason,
            });
            mapInstance.setStyle(nextStyle);
          } else {
            exhaustedStyles = true;
            setMapError("No se pudo cargar el mapa. Revisa la conexion e intenta nuevamente.");
          }
        };

        const handleStyleError = (event: any) => {
          // MapLibre aborts in-flight style/tile requests as part of remove().
          // Teardown is expected and must never start a fallback style cycle on
          // an instance that is already being destroyed.
          if (!isMounted || exhaustedStyles) return;
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

        let boundingBoxTimer: number | null = null;
        let lastBoundingBoxKey: string | null = null;

        const flushBoundingBox = () => {
          boundingBoxTimer = null;
          const callback = boundingBoxCallbackRef.current;
          if (!callback || typeof mapInstance.getBounds !== "function") {
            lastBoundingBoxKey = null;
            return;
          }
          const bounds = mapInstance.getBounds();
          if (!bounds) {
            if (lastBoundingBoxKey !== "null") {
              lastBoundingBoxKey = "null";
              callback(null);
            }
            return;
          }
          const nextBoundingBox: [number, number, number, number] = [
            bounds.getWest(),
            bounds.getSouth(),
            bounds.getEast(),
            bounds.getNorth(),
          ];
          if (!nextBoundingBox.every(Number.isFinite)) {
            if (lastBoundingBoxKey !== "null") {
              lastBoundingBoxKey = "null";
              callback(null);
            }
            return;
          }
          const nextBoundingBoxKey = nextBoundingBox.join(":");
          if (nextBoundingBoxKey === lastBoundingBoxKey) return;
          lastBoundingBoxKey = nextBoundingBoxKey;
          callback(nextBoundingBox);
        };

        const scheduleBoundingBox = () => {
          if (!boundingBoxCallbackRef.current) {
            if (boundingBoxTimer !== null) {
              window.clearTimeout(boundingBoxTimer);
              boundingBoxTimer = null;
            }
            lastBoundingBoxKey = null;
            return;
          }
          if (boundingBoxTimer !== null) {
            window.clearTimeout(boundingBoxTimer);
          }
          boundingBoxTimer = window.setTimeout(flushBoundingBox, BOUNDING_BOX_DEBOUNCE_MS);
        };

        const boundingBoxController = {
          setEnabled: (enabled: boolean) => {
            if (boundingBoxTimer !== null) {
              window.clearTimeout(boundingBoxTimer);
              boundingBoxTimer = null;
            }
            lastBoundingBoxKey = null;
            if (enabled) scheduleBoundingBox();
          },
        };
        boundingBoxControllerRef.current = boundingBoxController;

        const handleCircleClick = (e: any) => {
          if (!e.features?.length) return;
          const feature = e.features[0];
          const coords = (feature.geometry as any).coordinates.slice();
          const properties = feature.properties ?? {};
          const clusterId = typeof properties.clusterId === "string" ? properties.clusterId : null;
          const cluster = clusterId
            ? latestHeatmap.current.find((point) => point.clusterId === clusterId)
            : undefined;
          const featureId = String(properties.id ?? properties.ticket ?? "").trim();
          const matchedPoint = cluster ?? latestHeatmap.current.find((point) => {
            const pointId = String(point.id ?? point.ticket ?? "").trim();
            if (featureId && pointId === featureId) return true;
            return Math.abs(point.lng - Number(coords[0])) < 0.0000001 && Math.abs(point.lat - Number(coords[1])) < 0.0000001;
          });
          const selectedPoint: HeatPoint = matchedPoint ?? {
            lat: Number(coords[1]),
            lng: Number(coords[0]),
            ...(featureId ? { ticket: featureId } : {}),
            ...(typeof properties.categoria === "string" ? { categoria: properties.categoria } : {}),
            ...(typeof properties.barrio === "string" ? { barrio: properties.barrio } : {}),
            ...(typeof properties.distrito === "string" ? { distrito: properties.distrito } : {}),
            ...(typeof properties.estado === "string" ? { estado: properties.estado } : {}),
            ...(typeof properties.canal === "string" ? { canal: properties.canal } : {}),
            ...(typeof properties.categoryColor === "string" ? { categoryColor: properties.categoryColor } : {}),
            ...(typeof properties.addressCellLabel === "string" ? { addressCellLabel: properties.addressCellLabel } : {}),
          };

          while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
            coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
          }

          trackFrontendEvent("map_cluster_click", {
            provider: "maplibre",
            cluster_id: clusterId,
            feature_id: properties?.id ?? null,
            contract_version: contractVersionRef.current,
          });
          emitBackendMapEventRef.current("cluster_click", {
            provider: "maplibre",
            cluster_id: clusterId,
            feature_id: properties?.id ?? null,
            contract_version: contractVersionRef.current,
          });
          onFeatureSelectRef.current?.(selectedPoint);

          const popup = new maplibre.Popup({
            offset: 16,
            closeButton: true,
            maxWidth: "320px",
          });
          popup
            .setLngLat(coords as LngLatLike)
            .setDOMContent(buildMapClusterPopupContent({
              cluster,
              properties,
              popupContext: popupContextRef.current,
            }))
            .addTo(mapInstance);
        };

        const handlePointMouseEnter = () => {
          if (!configuredInteractionsRef.current.hover) return;
          mapInstance.getCanvas().style.cursor = "pointer";
        };

        const handlePointMouseLeave = () => {
          mapInstance.getCanvas().style.cursor = "";
        };

        const handleHeatAnchorClick = (event: any) => {
          if (showPointsRef.current) return;
          handleCircleClick(event);
        };

        const handleHeatAnchorMouseEnter = () => {
          if (showPointsRef.current) return;
          handlePointMouseEnter();
        };

        const handleHeatAnchorMouseLeave = () => {
          if (showPointsRef.current) return;
          handlePointMouseLeave();
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
        mapInstance.on("mouseenter", configuredLayerIds.circles, handlePointMouseEnter);
        mapInstance.on("mouseleave", configuredLayerIds.circles, handlePointMouseLeave);
        if (heatmapPalette === "faro") {
          mapInstance.on("click", configuredLayerIds.halo, handleHeatAnchorClick);
          mapInstance.on("mouseenter", configuredLayerIds.halo, handleHeatAnchorMouseEnter);
          mapInstance.on("mouseleave", configuredLayerIds.halo, handleHeatAnchorMouseLeave);
        }
        mapInstance.on("styleimagemissing", handleMissingImage);
        const bboxEvents = [
          "boxzoomend",
          "moveend",
          "zoomend",
          "dragend",
          "rotateend",
          "pitchend",
        ] as const;
        bboxEvents.forEach((eventName) => mapInstance.on(eventName, scheduleBoundingBox));
        if (boundingBoxCallbackRef.current) {
          if (mapInstance.isStyleLoaded()) {
            scheduleBoundingBox();
          } else {
            mapInstance.once("load", scheduleBoundingBox);
          }
        }

        try {
          mapInstance.resize();
        } catch {
          // The observer below will retry when the container is measurable.
        }
        setMapGeneration((current) => current + 1);

        return () => {
          mapInstance.off("click", handleClick);
          mapInstance.off("click", configuredLayerIds.circles, handleCircleClick);
          mapInstance.off("mouseenter", configuredLayerIds.circles, handlePointMouseEnter);
          mapInstance.off("mouseleave", configuredLayerIds.circles, handlePointMouseLeave);
          if (heatmapPalette === "faro") {
            mapInstance.off("click", configuredLayerIds.halo, handleHeatAnchorClick);
            mapInstance.off("mouseenter", configuredLayerIds.halo, handleHeatAnchorMouseEnter);
            mapInstance.off("mouseleave", configuredLayerIds.halo, handleHeatAnchorMouseLeave);
          }
          mapInstance.off("styleimagemissing", handleMissingImage);
          bboxEvents.forEach((eventName) => mapInstance.off(eventName, scheduleBoundingBox));
          mapInstance.off("load", scheduleBoundingBox);
          if (boundingBoxTimer !== null) {
            window.clearTimeout(boundingBoxTimer);
            boundingBoxTimer = null;
          }
          if (boundingBoxControllerRef.current === boundingBoxController) {
            boundingBoxControllerRef.current = null;
          }
          mapInstance.off("load", ensureSourcesAndLayers);
          mapInstance.off("style.load", ensureSourcesAndLayers);
          mapInstance.off("error", handleStyleError);
        };
      } catch (error) {
        runtimeDiagnostics.error("Failed to initialize map:", error);
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
      clusterCountMarkersRef.current.forEach((clusterMarker) => clusterMarker.remove());
      clusterCountMarkersRef.current = [];
    };
  }, [
    configuredLayerIds.circles,
    configuredLayerIds.halo,
    configuredLayerIds.heat,
    configuredLayerIds.labels,
    configuredSourceOptions.cluster,
    configuredSourceOptions.clusterMaxZoom,
    configuredSourceOptions.clusterRadius,
    geoLayerConfig?.style_url,
    heatmapPalette,
    mapStyleUrl,
    mapTileAttribution,
    mapTileUrl,
    pointLabelMode,
    resolvedMaptilerKey,
    resolvedPointLabelMinZoom,
    resolvedPointMinZoom,
  ]);

  const centerLng = center?.[0];
  const centerLat = center?.[1];

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (Number.isFinite(centerLng) && Number.isFinite(centerLat)) {
      const nextCenter: [number, number] = [centerLng as number, centerLat as number];
      if (prefersReducedMotionRef.current) {
        map.jumpTo({ center: nextCenter, zoom: initialZoomRef.current });
      } else {
        map.flyTo({ center: nextCenter, zoom: initialZoomRef.current });
      }
    }
  }, [centerLat, centerLng, mapGeneration]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sourceData = renderedGeoSource ?? buildGeoJson(processedHeatmap);
    const applyData = () => {
      const heatSource = map.getSource(MAP_HEAT_SOURCE_ID);
      if (heatSource && typeof (heatSource as any).setData === "function") {
        (heatSource as any).setData(
          sourceDataForLayer(sourceData, showHeatmap && !showPolygons),
        );
      }

      const pointSource = map.getSource(MAP_POINT_SOURCE_ID);
      if (pointSource && typeof (pointSource as any).setData === "function") {
        (pointSource as any).setData(
          sourceDataForLayer(sourceData, resolvedShowPoints && !showPolygons),
        );
      }
    };
    const heatSource = map.getSource(MAP_HEAT_SOURCE_ID);
    const pointSource = map.getSource(MAP_POINT_SOURCE_ID);
    if (
      heatSource &&
      typeof (heatSource as any).setData === "function" &&
      pointSource &&
      typeof (pointSource as any).setData === "function"
    ) {
      applyData();
      return;
    }

    map.once("load", applyData);
    map.once("style.load", applyData);
    return () => {
      map.off("load", applyData);
      map.off("style.load", applyData);
    };
  }, [
    renderedGeoSource,
    mapGeneration,
    processedHeatmap,
    resolvedShowPoints,
    showHeatmap,
    showPolygons,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer(configuredLayerIds.heat)) return;

    map.setPaintProperty(
      configuredLayerIds.heat,
      "heatmap-opacity",
      adaptiveZoomMode
        ? ["interpolate", ["linear"], ["zoom"], 4, 0.76, 9, 0.58, 12, 0.24, 14, 0]
        : heatmapPalette === "faro"
          ? 0.76
          : 0.65,
    );
  }, [adaptiveZoomMode, configuredLayerIds.heat, heatmapPalette, mapGeneration]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyRadius = () => {
      if (!map.getLayer(configuredLayerIds.heat)) return;
      map.setPaintProperty(
        configuredLayerIds.heat,
        "heatmap-radius",
        heatmapRadiusExpression(resolvedHeatmapRadiusScale),
      );
    };

    if (map.isStyleLoaded()) {
      applyRadius();
      return;
    }

    map.once("load", applyRadius);
    map.once("style.load", applyRadius);
    return () => {
      map.off("load", applyRadius);
      map.off("style.load", applyRadius);
    };
  }, [configuredLayerIds.heat, mapGeneration, resolvedHeatmapRadiusScale]);

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
    if (!map) return;

    if (!map.getLayer(configuredLayerIds.heat) || !map.getLayer(configuredLayerIds.circles)) {
      const handler = () => toggleLayers(
        map,
        showHeatmap,
        resolvedShowPoints,
        resolvedShowPointLabels,
        showPolygons,
        configuredLayerIds,
        heatmapPalette === "faro",
      );
      map.once("load", handler);
      return () => {
        map.off("load", handler);
      };
    }

    toggleLayers(
      map,
      showHeatmap,
      resolvedShowPoints,
      resolvedShowPointLabels,
      showPolygons,
      configuredLayerIds,
      heatmapPalette === "faro",
    );
    trackFrontendEvent("map_layer_toggle", {
      provider: "maplibre",
      show_heatmap: showHeatmap,
      show_points: resolvedShowPoints,
      show_polygons: showPolygons,
      contract_version: geoLayerConfig?.contract_version ?? null,
    });
    emitBackendMapEvent("layer_toggle", {
      provider: "maplibre",
      show_heatmap: showHeatmap,
      show_points: resolvedShowPoints,
      show_polygons: showPolygons,
      contract_version: geoLayerConfig?.contract_version ?? null,
    });
  }, [
    configuredLayerIds.circles,
    configuredLayerIds.halo,
    configuredLayerIds.heat,
    configuredLayerIds.labels,
    emitBackendMapEvent,
    geoLayerConfig?.contract_version,
    heatmapPalette,
    mapGeneration,
    resolvedShowPointLabels,
    resolvedShowPoints,
    showHeatmap,
    showPolygons,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource("polygons");
    if (source && typeof (source as any).setData === "function") {
      (source as any).setData(polygons ?? { type: "FeatureCollection", features: [] });
    }
  }, [mapGeneration, polygons]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !showHeatmap || showPolygons) return;

    if (prefersReducedMotion) {
      if (map.getLayer(configuredLayerIds.heat)) {
        map.setPaintProperty(configuredLayerIds.heat, "heatmap-intensity", 1);
      }
      return;
    }
    let frame: number;

    const animate = () => {
      // A style can disappear between a fast layer toggle and the next frame
      // (or while the component is being torn down). Never ask MapLibre for a
      // layer after the active instance/style changed.
      if (mapRef.current !== map || !map.isStyleLoaded()) return;
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
  }, [configuredLayerIds.heat, mapGeneration, prefersReducedMotion, showHeatmap, showPolygons]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = libRef.current;

    clusterCountMarkersRef.current.forEach((clusterMarker) => clusterMarker.remove());
    clusterCountMarkersRef.current = [];

    if (
      !map ||
      !maplibre ||
      !resolvedShowPoints ||
      !resolvedShowPointLabels ||
      showPolygons ||
      pointLabelMode !== "count"
    ) {
      return;
    }

    clusterCountMarkersRef.current = processedHeatmap
      .filter((point) => Number(point.clusterSize ?? 1) > 1)
      .map((point) => {
        const count = Math.max(2, Math.round(Number(point.clusterSize ?? 1)));
        const element = document.createElement("span");
        element.textContent = count.toLocaleString("es-AR");
        element.setAttribute("role", "img");
        element.setAttribute("aria-label", `${count.toLocaleString("es-AR")} reclamos agrupados`);
        element.style.alignItems = "center";
        element.style.background = point.categoryColor || "#7c3aed";
        element.style.border = "2px solid rgba(255,255,255,0.96)";
        element.style.borderRadius = "999px";
        element.style.boxShadow = "0 5px 16px rgba(15,23,42,0.38)";
        element.style.color = "#ffffff";
        element.style.display = "flex";
        element.style.fontSize = "12px";
        element.style.fontWeight = "800";
        element.style.height = "28px";
        element.style.justifyContent = "center";
        element.style.lineHeight = "1";
        element.style.pointerEvents = "none";
        element.style.width = "28px";

        return new maplibre.Marker({ element, anchor: "center" })
          .setLngLat([point.lng, point.lat])
          .addTo(map);
      });

    return () => {
      clusterCountMarkersRef.current.forEach((clusterMarker) => clusterMarker.remove());
      clusterCountMarkersRef.current = [];
    };
  }, [
    mapGeneration,
    pointLabelMode,
    processedHeatmap,
    resolvedShowPointLabels,
    resolvedShowPoints,
    showPolygons,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = libRef.current;
    if (!map) return;
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
  }, [mapGeneration, marker]);

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = libRef.current;
    if (!map) {
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
        const popupContent = document.createElement("div");
        popupContent.className = "text-sm font-medium";
        popupContent.textContent = "Ubicacion del administrador";
        const popup =
          typeof maplibre.Popup === "function"
            ? new maplibre.Popup({ offset: 12 }).setDOMContent(popupContent)
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
  }, [adminLocation, mapGeneration]);

  const fitBoundsCoordinatesKey = JSON.stringify(
    Array.from(
      new globalThis.Map(
        (fitToBounds ?? [])
          .filter(
            (value): value is [number, number] =>
              Array.isArray(value) &&
              value.length === 2 &&
              isRenderableCoordinatePair(value[1], value[0]),
          )
          .map((coordinate) => [`${coordinate[0]}:${coordinate[1]}`, coordinate] as const),
      ).values(),
    ).sort(([leftLng, leftLat], [rightLng, rightLat]) =>
      leftLng - rightLng || leftLat - rightLat,
    ),
  );
  const stableFitBoundsCoordinates = useMemo(
    () => JSON.parse(fitBoundsCoordinatesKey) as [number, number][],
    [fitBoundsCoordinatesKey],
  );

  useEffect(() => {
    const map = mapRef.current;
    const maplibre = libRef.current;
    if (!map) return;

    const coords = stableFitBoundsCoordinates;

    if (!coords.length) {
      return;
    }

    const applyBounds = () => {
      let west = coords[0][0];
      let east = coords[0][0];
      let south = coords[0][1];
      let north = coords[0][1];
      for (let index = 1; index < coords.length; index += 1) {
        const [lng, lat] = coords[index];
        west = Math.min(west, lng);
        east = Math.max(east, lng);
        south = Math.min(south, lat);
        north = Math.max(north, lat);
      }
      const center: [number, number] = [(west + east) / 2, (south + north) / 2];
      const longitudeScale = Math.max(0.2, Math.cos((center[1] * Math.PI) / 180));
      const effectiveSpan = Math.max((east - west) * longitudeScale, north - south);
      const compactSet = effectiveSpan <= COMPACT_FILTERED_VIEW_SPAN_DEGREES;

      try {
        map.stop();
        map.resize();
      } catch {
        // A style transition can finish between the render and this camera request.
      }

      const moveTo = (nextCenter: [number, number], zoom = initialZoomRef.current) => {
        const options = { center: nextCenter, zoom };
        if (prefersReducedMotionRef.current) {
          map.jumpTo(options);
        } else {
          map.flyTo(options);
        }
      };

      if (coords.length === 1 || compactSet) {
        const compactZoom = Math.min(
          COMPACT_FILTERED_VIEW_MAX_ZOOM,
          Math.max(10, initialZoomRef.current),
        );
        moveTo(center, compactZoom);
        return;
      }

      if (maplibre?.LngLatBounds) {
        const bounds = coords.slice(1).reduce(
          (acc, coord) => acc.extend(coord),
          new maplibre.LngLatBounds(coords[0], coords[0]),
        );

        try {
          map.fitBounds(bounds, {
            padding: boundsPaddingRef.current ?? 48,
            maxZoom: FILTERED_VIEW_MAX_ZOOM,
            duration: prefersReducedMotionRef.current ? 0 : 700,
          });
          return;
        } catch (err) {
          runtimeDiagnostics.warn("No se pudo ajustar el mapa a los límites proporcionados", err);
        }
      }

      moveTo(coords[0]);
    };

    if (map.isStyleLoaded()) {
      applyBounds();
    } else {
      map.once("load", applyBounds);
      return () => {
        map.off("load", applyBounds);
      };
    }
  }, [fitBoundsCoordinatesKey, fitBoundsRequestKey, mapGeneration, stableFitBoundsCoordinates]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

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
  }, []);

  const containerClassName = cn(
    "relative w-full rounded-2xl overflow-hidden",
    className,
    !className && "h-[500px]",
  );
  const renderedFeatureCount = configuredGeoSource?.features.length ?? processedHeatmap.length;
  const showEmptyMapState =
    !showPolygons && (showHeatmap || resolvedShowPoints) && renderedFeatureCount === 0;

  return (
    <div
      className={containerClassName}
      role={ariaLabel ? "region" : undefined}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
    >
      <div ref={mapContainerRef} className="h-full w-full" />
      {showEvidenceBadge ? (
        <MapEvidenceBadge
          evidence={mapEvidence}
          className="absolute left-3 right-14 top-3 z-10 max-w-none sm:right-auto sm:max-w-[min(82vw,24rem)]"
        />
      ) : null}
      {providerFallbackMessage && (
        <div className="absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-md bg-background/90 px-3 py-2 text-xs text-foreground shadow">
          {providerFallbackMessage}
        </div>
      )}
      {showEmptyMapState && !mapError ? (
        <div
          className="pointer-events-none absolute bottom-4 left-1/2 z-10 w-[min(90%,22rem)] -translate-x-1/2 rounded-xl border border-slate-200/90 bg-white/95 px-4 py-3 text-center shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-950/95"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
            Sin puntos geolocalizados para esta vista
          </p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            El mapa permanece disponible; la selección actual no contiene ubicaciones representables.
          </p>
        </div>
      ) : null}
      {mapError && (
        <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-md bg-background/90 px-3 py-2 text-xs text-foreground shadow">
          No se pudo cargar el mapa: {mapError}
        </div>
      )}
    </div>
  );
}
