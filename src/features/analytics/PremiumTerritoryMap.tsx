import { useEffect, useId, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  Compass,
  DatabaseZap,
  Eye,
  Gauge,
  Globe2,
  Layers,
  ListChecks,
  MapPin,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import LazyMapLibreMap from '@/components/LazyMapLibreMap';
import { cn } from '@/lib/utils';

import type { OperationsHeatmapPoint, OperationsHeatmapV1, PublicMapConfigV1 } from './analyticsTypes';
import type { MapLibreMapProps } from '@/components/MapLibreMap';
import type { HeatPoint } from '@/services/statsService';
import {
  aggregateTerritoryHeatmap,
  DEFAULT_TERRITORY_ZONES,
  getDemoTerritoryHeatmapPoints,
  PREMIUM_HEATMAP_MIN_SAMPLE_SIZE,
  resolveTerritoryLayerDescriptors,
  resolveTerritoryMapReadiness,
  territoryCentroid,
  territoryPolygonToPath,
  type TerritoryLayerDescriptor,
  type TerritoryZoneMetric,
} from './premiumTerritoryHeatmap';

type DemoProfile = 'gobierno' | 'empresa' | 'colegio' | 'general';

type ActiveFilterSummary = {
  key: string;
  label: string;
  value: string;
  onClear?: () => void;
};

type MapFocusMode = 'territory' | 'quality' | 'telemetry';

type BackendActionSummary = {
  label: string;
  detail?: string;
  priority?: string;
  uiHint?: string;
  actionType?: string;
  writesEnabled?: boolean;
  href?: string;
};

type OperationsGeoLayerConfig = NonNullable<MapLibreMapProps['geoLayerConfig']>;

type PremiumTerritoryHeatmapProps = {
  points: OperationsHeatmapPoint[];
  heatmap?: OperationsHeatmapV1;
  labels?: Record<string, string>;
  activeFilters?: ActiveFilterSummary[];
  mapConfig?: PublicMapConfigV1;
  minSampleSize?: number;
  allowDemoFallback?: boolean;
  demoProfile?: DemoProfile;
  className?: string;
};

const numberFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

const labelFor = (labels: Record<string, string> | undefined, key: string, fallback: string) => {
  const candidate = labels?.[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate : fallback;
};

const formatNumber = (value: number | undefined, fallback = '--') =>
  value === undefined || Number.isNaN(value) ? fallback : numberFormatter.format(value);

const formatVariation = (value: number | undefined) => {
  if (value === undefined) return 'sin comparacion';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${numberFormatter.format(value)}%`;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const asRecordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)))
    : [];

const readString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};

const readNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const safeCssColor = (value: string | undefined) => {
  if (!value) return undefined;
  const color = value.trim();
  if (
    /^#[0-9a-f]{3,8}$/i.test(color) ||
    /^rgba?\([\d\s.,%+-]+\)$/i.test(color) ||
    /^hsla?\([\d\s.,%+-]+\)$/i.test(color) ||
    /^var\(--[a-z0-9-_]+\)$/i.test(color)
  ) {
    return color;
  }
  return undefined;
};

const toLiveHeatPoint = (point: OperationsHeatmapPoint): HeatPoint | null => {
  const location = asRecord(point.location);
  const lat = readNumber(point.lat, location?.lat, point.latitude);
  const lng = readNumber(point.lng, location?.lng, location?.lon, point.lon, point.longitude);
  if (lat === undefined || lng === undefined) return null;

  const id = readNumber(point.id, point.ticket_id, point.record_id);
  return {
    lat,
    lng,
    ...(id !== undefined ? { id } : {}),
    weight: readNumber(point.weight, point.total, point.count, point.value) ?? 1,
    total: readNumber(point.total, point.count, point.value),
    ticket: readString(point.ticket, point.ticket_id, point.record_id),
    categoria: readString(point.categoria, point.category, point.type, point.layer),
    canal: readString(point.canal, point.channel),
    barrio: readString(point.barrio, point.district, point.distrito),
    estado: readString(point.estado, point.status),
    severidad: readString(point.severidad, point.severity),
    fuente: readString(point.fuente, point.source),
    direccion: readString(point.direccion, point.address, point.label),
    last_ticket_at: readString(point.last_ticket_at, point.updated_at, point.created_at) ?? null,
    feature: { raw: point },
  };
};

const formatPercent = (value: number | undefined) =>
  value === undefined || Number.isNaN(value) ? '--' : `${numberFormatter.format(value)}%`;

const humanizeContractValue = (value: string | undefined, fallback: string) =>
  value ? value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() : fallback;

const operationalRankLabel = (reason: string | undefined) => {
  const labels: Record<string, string> = {
    sla_breached: 'SLA vencido',
    overdue_cases: 'Casos vencidos',
    unassigned_cases: 'Sin responsable',
    recent_activity: 'Actividad reciente',
    ticket_density: 'Densidad de tickets',
    activity_density: 'Densidad operativa',
  };
  return labels[reason ?? ''] ?? humanizeContractValue(reason, 'Prioridad operativa');
};

const layerToneClass: Record<TerritoryLayerDescriptor['tone'], string> = {
  heat: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200',
  ai: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-200',
  quality: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
  realtime: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200',
  neutral: 'border-border bg-background/80 text-foreground',
};

const readinessToneClass = {
  ready: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
  degraded: 'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-200',
  low: 'border-orange-500/35 bg-orange-500/10 text-orange-700 dark:text-orange-200',
  empty: 'border-destructive/35 bg-destructive/10 text-destructive',
};

const badgeVariantForReadiness = (state: ReturnType<typeof resolveTerritoryMapReadiness>['state']) => {
  if (state === 'ready') return 'default';
  if (state === 'empty') return 'destructive';
  return 'secondary';
};

const readinessCopy = (
  state: ReturnType<typeof resolveTerritoryMapReadiness>['state'],
  labels: Record<string, string> | undefined,
) => {
  if (state === 'ready') {
    return labelFor(labels, 'premium_map_quality_ready', 'Mapa listo para operar con cobertura suficiente.');
  }
  if (state === 'degraded') {
    return labelFor(labels, 'premium_map_quality_degraded', 'La lectura es util, pero conviene resolver coordenadas pendientes.');
  }
  if (state === 'low') {
    return labelFor(labels, 'premium_map_quality_low', 'Muestra territorial baja: usar como senal, no como decision final.');
  }
  return labelFor(labels, 'premium_map_quality_empty', 'Faltan coordenadas para construir inteligencia territorial confiable.');
};

const extractTicketIdFromEndpoint = (value: string | undefined) => {
  if (!value) return undefined;
  const match = value.match(/\/tickets\/([^/?#]+)/i);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
};

const readStringOrNumber = (...values: unknown[]) => {
  const text = readString(...values);
  if (text) return text;
  const numeric = readNumber(...values);
  return numeric !== undefined ? String(numeric) : undefined;
};

const buildTicketDeskHref = (record: Record<string, unknown>) => {
  const frontendPath = readString(record.frontend_path, record.route, record.href);
  if (frontendPath?.startsWith('/')) return frontendPath;

  const endpoint = readString(record.endpoint, record.endpoint_template);
  const target = asRecord(record.target);
  const filters = asRecord(record.filters);
  const params = new URLSearchParams();
  params.set('tab', 'tickets');

  const uiHint = readString(record.ui_hint);
  const actionType = readString(record.action_type);
  const ticketId =
    readStringOrNumber(record.ticket_id, record.record_id, target?.ticket_id, target?.record_id) ??
    extractTicketIdFromEndpoint(endpoint);
  const category = readString(record.categoria, record.category, target?.categoria, target?.category, filters?.category, filters?.categoria);
  const status = readString(record.estado, record.status, target?.estado, target?.status);
  const channel = readString(record.canal, record.channel, target?.canal, target?.channel, filters?.channel, filters?.canal);
  const cellId = readString(record.cell_id, target?.cell_id, filters?.cell_id);

  if (uiHint) params.set('focus', uiHint);
  else if (actionType) params.set('focus', actionType);
  if (ticketId) params.set('ticket_id', ticketId);
  if (category) params.set('categoria', category);
  if (status) params.set('estado', status);
  if (channel) params.set('canal', channel);
  if (cellId) params.set('heatmap_cell', cellId);
  if (uiHint === 'open_geocoding_queue') params.set('sla', 'risk');

  return params.toString() === 'tab=tickets' ? undefined : `/perfil?${params.toString()}`;
};

const summarizeBackendAction = (action: unknown): BackendActionSummary | undefined => {
  const record = asRecord(action);
  if (!record) return undefined;
  const label = readString(record.title, record.label, record.name);
  const contextLabel = readString(record.context_label, record.contextLabel);
  const method = readString(record.method);
  const endpoint = readString(record.endpoint, record.endpoint_template);
  const target = asRecord(record.target);
  const targetType = readString(target?.type, target?.kind);
  const numericTargetId = readNumber(target?.record_id, target?.ticket_id, target?.lat, target?.lng);
  const targetId = readString(target?.cell_id, target?.record_id, target?.ticket_id) ?? (numericTargetId !== undefined ? String(numericTargetId) : undefined);
  const targetLabel = targetType || targetId ? [targetType, targetId].filter(Boolean).join(' ') : undefined;
  const endpointDetail = [method, endpoint].filter(Boolean).join(' ') || undefined;
  const detail = contextLabel ?? endpointDetail ?? targetLabel;
  if (!label && !detail) return undefined;
  return {
    label: label ?? 'Accion disponible',
    detail: detail || readString(record.description, record.reason_code),
    priority: readString(record.priority),
    uiHint: readString(record.ui_hint),
    actionType: readString(record.action_type),
    writesEnabled: record.writes_enabled === true,
    href: buildTicketDeskHref(record),
  };
};

const uniqueActionSummaries = (actions: unknown[]) => {
  const seen = new Set<string>();
  return actions.reduce<BackendActionSummary[]>((acc, action) => {
    const summary = summarizeBackendAction(action);
    if (!summary) return acc;
    const key = `${summary.label}|${summary.detail ?? ''}`;
    if (seen.has(key)) return acc;
    seen.add(key);
    acc.push(summary);
    return acc;
  }, []);
};

const actionWithContext = (action: unknown, contextLabel: string | undefined) => {
  const record = asRecord(action);
  if (!record || !contextLabel) return action;
  return { ...record, context_label: contextLabel };
};

const layerIsEnabled = (enabledLayerIds: string[], fragments: string[]) =>
  enabledLayerIds.some((layerId) => fragments.some((fragment) => layerId.includes(fragment)));

const readStringArray = (...values: unknown[]) => {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
    }
  }
  return [];
};

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const buildOperationsGeoLayerConfig = ({
  heatmap,
  points,
  enabledLayerIds,
  mapStyleUrl,
  showHeatLayer,
  showAiLayer,
  showQualityLayer,
  showRealtimeLayer,
}: {
  heatmap?: OperationsHeatmapV1;
  points: HeatPoint[];
  enabledLayerIds: string[];
  mapStyleUrl?: string | null;
  showHeatLayer: boolean;
  showAiLayer: boolean;
  showQualityLayer: boolean;
  showRealtimeLayer: boolean;
}): OperationsGeoLayerConfig | null => {
  if (!heatmap || points.length === 0) return null;

  const mapLayers = asRecord(heatmap.map_layers);
  const provider = asRecord(mapLayers?.provider);
  const categoryHeatmap = asRecord(mapLayers?.category_heatmap);
  const hotspots = asRecord(mapLayers?.hotspots);
  const telemetry = asRecord(mapLayers?.telemetry);
  const layerStyle = asRecord(heatmap.layer_style_contract);
  const styleTokens = asRecord(layerStyle?.style_tokens);
  const layerIds = asRecord(styleTokens?.layer_ids);
  const viewportPresets = asRecord(heatmap.viewport_presets);
  const legend = asRecord(heatmap.legend);
  const realtimeEvents = heatmap.realtime?.socket_events ?? [];
  const telemetryEvents = uniqueStrings([
    ...readStringArray(telemetry?.events),
    ...realtimeEvents,
    'map_loaded',
    'cluster_click',
    'layer_toggle',
    'time_slider_changed',
  ]).slice(0, 12);

  const features = points
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    .map((point, index) => {
      const featureRecord = asRecord(point.feature);
      const rawPoint = asRecord(featureRecord?.raw) ?? featureRecord;
      const pointId =
        readStringOrNumber(point.id, point.ticket, rawPoint?.id, rawPoint?.ticket_id, rawPoint?.record_id, rawPoint?.cell_id) ??
        `operations-point-${index}`;
      const category = readString(point.categoria, rawPoint?.categoria, rawPoint?.category, rawPoint?.type, rawPoint?.layer);
      const channel = readString(point.canal, rawPoint?.canal, rawPoint?.channel);
      const status = readString(point.estado, rawPoint?.estado, rawPoint?.status);
      const latestEventAt = readString(point.last_ticket_at, rawPoint?.latest_event_at, rawPoint?.updated_at, rawPoint?.created_at);
      const weight = readNumber(point.totalWeight, point.weight, rawPoint?.weight, rawPoint?.count, rawPoint?.total) ?? 1;

      return {
        type: 'Feature' as const,
        id: pointId,
        geometry: { type: 'Point' as const, coordinates: [point.lng, point.lat] as [number, number] },
        properties: {
          id: pointId,
          ticket: readString(point.ticket, rawPoint?.ticket, rawPoint?.ticket_id, rawPoint?.record_id),
          categoria: category,
          category,
          canal: channel,
          channel,
          estado: status,
          status,
          weight,
          intensity: readNumber(point.intensity, rawPoint?.intensity, weight) ?? weight,
          totalWeight: readNumber(point.totalWeight, rawPoint?.total_weight, weight) ?? weight,
          direccion: readString(point.direccion, rawPoint?.direccion, rawPoint?.address, rawPoint?.label),
          barrio: readString(point.barrio, rawPoint?.barrio, rawPoint?.district, rawPoint?.distrito),
          cell_id: readString(point.cellId, rawPoint?.cell_id),
          fuente: readString(point.fuente, point.source, rawPoint?.fuente, rawPoint?.source) ?? 'operations',
          latest_event_at: latestEventAt,
          operational_score: readNumber(rawPoint?.operational_score),
          operational_rank: readString(rawPoint?.rank_reason),
          quality_state: readString(heatmap.quality?.state),
          ai_layer_active: showAiLayer,
          quality_layer_active: showQualityLayer,
          realtime_layer_active: showRealtimeLayer,
        },
      };
    });

  if (features.length === 0) return null;

  return {
    contract_version: 'operations.heatmap.geo_layers.v1',
    style_url: readString(mapStyleUrl, provider?.style_url, provider?.styleUrl),
    source: {
      type: 'FeatureCollection',
      features,
      metadata: {
        backend_contract_version: heatmap.contract_version,
        map_layer_contract_version: readString(mapLayers?.contract_version),
        layer_style_contract_version: readString(layerStyle?.contract_version),
        viewport_contract_version: readString(viewportPresets?.contract_version),
        legend_contract_version: readString(legend?.contract_version),
        enabled_layers: enabledLayerIds,
        operational_hotspots: heatmap.operational_hotspots?.length ?? 0,
      },
    },
    source_options: {
      cluster: false,
      clusterMaxZoom: 14,
      clusterRadius: 54,
      backend_contract_version: heatmap.contract_version,
      map_layer_contract_version: readString(mapLayers?.contract_version),
      layer_style_contract_version: readString(layerStyle?.contract_version),
      default_viewport_id: readString(viewportPresets?.default_preset_id),
      enabled_layers: enabledLayerIds,
      active_layers: {
        heatmap: showHeatLayer,
        ai: showAiLayer,
        quality: showQualityLayer,
        realtime: showRealtimeLayer,
      },
    },
    interactions: {
      hover: true,
      time_slider: {
        enabled: showRealtimeLayer && Boolean(readString(heatmap.realtime?.latest_event_at) || realtimeEvents.length),
        field: 'latest_event_at',
      },
    },
    layers: {
      heatmap: {
        id: readString(layerIds?.heatmap, categoryHeatmap?.layer_id, categoryHeatmap?.id) ?? 'operations-heatmap-layer',
      },
      clusters: {
        id: readString(layerIds?.clusters, hotspots?.cluster_layer_id, hotspots?.cluster_id) ?? 'operations-hotspot-clusters',
      },
      points: {
        id: readString(layerIds?.points, hotspots?.point_layer_id, hotspots?.point_id) ?? 'operations-hotspot-points',
      },
    },
    telemetry: {
      event_endpoint: readString(telemetry?.event_endpoint, telemetry?.endpoint),
      events: telemetryEvents,
    },
  };
};

const coverageArc = (coveragePercent: number | undefined) => {
  const coverage = Math.max(0, Math.min(100, coveragePercent ?? 0));
  return `${coverage}, ${100 - coverage}`;
};

const fillForIntensity = (metric: TerritoryZoneMetric, selected: boolean) => {
  if (!metric.records) return 'rgba(148, 163, 184, 0.12)';
  if (metric.suppressed) return 'rgba(148, 163, 184, 0.24)';
  if (metric.intensity > 0.78) return `rgba(245, 158, 11, ${selected ? 0.82 : 0.58})`;
  if (metric.intensity > 0.48) return `rgba(20, 184, 166, ${selected ? 0.8 : 0.54})`;
  return `rgba(59, 130, 246, ${selected ? 0.72 : 0.42})`;
};

const strokeForIntensity = (metric: TerritoryZoneMetric, selected: boolean) => {
  if (selected) return 'rgba(255, 255, 255, 0.94)';
  if (!metric.records) return 'rgba(148, 163, 184, 0.28)';
  if (metric.suppressed) return 'rgba(148, 163, 184, 0.48)';
  if (metric.intensity > 0.78) return 'rgba(245, 158, 11, 0.92)';
  if (metric.intensity > 0.48) return 'rgba(20, 184, 166, 0.9)';
  return 'rgba(59, 130, 246, 0.86)';
};

const confidenceLabel = (value: string) => {
  if (value === 'high') return 'alta';
  if (value === 'medium') return 'media';
  if (value === 'low') return 'baja';
  if (value === 'empty') return 'sin datos';
  return 'muestra insuficiente';
};

const MetricLine = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold text-foreground">{value}</span>
  </div>
);

export function PremiumTerritoryHeatmap({
  points,
  heatmap,
  labels,
  activeFilters = [],
  mapConfig,
  minSampleSize = PREMIUM_HEATMAP_MIN_SAMPLE_SIZE,
  allowDemoFallback = false,
  demoProfile = 'general',
  className,
}: PremiumTerritoryHeatmapProps) {
  const svgId = useId().replace(/:/g, '');
  const shouldReduceMotion = useReducedMotion();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [comparisonEnabled, setComparisonEnabled] = useState(false);
  const [focusMode, setFocusMode] = useState<MapFocusMode>('territory');
  const [layerSelection, setLayerSelection] = useState<string[] | null>(null);

  const backendCellPoints = useMemo<OperationsHeatmapPoint[]>(
    () =>
      (heatmap?.cells ?? [])
        .map<OperationsHeatmapPoint | null>((cell, index) => {
          const record = asRecord(cell);
          if (!record) return null;
          const lat = readNumber(record.centroid_lat, record.lat, record.latitude);
          const lng = readNumber(record.centroid_lon, record.lng, record.lon, record.longitude);
          if (lat === undefined || lng === undefined) return null;
          const risk = asRecord(record.risk);
          const id =
            readString(record.cell_id, record.id) ??
            (readNumber(record.id) !== undefined ? String(readNumber(record.id)) : undefined) ??
            `cell-${index}`;
          return {
            id,
            lat,
            lng,
            weight: readNumber(record.count, record.weight, record.total) ?? 1,
            total: readNumber(record.count, record.total),
            categoria: readString(record.dominant_category, record.categoria, record.category),
            estado: readString(risk?.level, record.estado, record.status),
            severidad: readString(risk?.label, risk?.level, record.severidad, record.severity),
            fuente: 'heatmap_cell',
            cell_id: record.cell_id,
          };
        })
        .filter((point): point is OperationsHeatmapPoint => Boolean(point)),
    [heatmap?.cells],
  );
  const usesBackendCellPoints = points.length === 0 && backendCellPoints.length > 0;
  const usesDemoData = allowDemoFallback && points.length === 0 && !usesBackendCellPoints;
  const sourcePoints = useMemo(
    () => (usesDemoData ? getDemoTerritoryHeatmapPoints(demoProfile) : usesBackendCellPoints ? backendCellPoints : points),
    [backendCellPoints, demoProfile, points, usesBackendCellPoints, usesDemoData],
  );
  const liveMapPoints = useMemo(
    () => sourcePoints.map(toLiveHeatPoint).filter((point): point is HeatPoint => Boolean(point)),
    [sourcePoints],
  );
  const liveMapBounds = useMemo(
    () => liveMapPoints.map((point) => [point.lng, point.lat] as [number, number]),
    [liveMapPoints],
  );
  const liveMapProvider = mapConfig?.provider === 'google' ? 'google' : 'maplibre';
  const showLiveMap = liveMapPoints.length > 0 && !usesDemoData;

  const aggregate = useMemo(
    () =>
      aggregateTerritoryHeatmap({
        points: sourcePoints,
        zones: DEFAULT_TERRITORY_ZONES,
        minSampleSize,
      }),
    [minSampleSize, sourcePoints],
  );

  const readiness = useMemo(
    () => resolveTerritoryMapReadiness(heatmap, aggregate.totalRecords),
    [aggregate.totalRecords, heatmap],
  );
  const displayLayers = useMemo(() => resolveTerritoryLayerDescriptors(heatmap), [heatmap]);
  const displayLayerKey = displayLayers.map((layer) => layer.id).join('|');
  const defaultEnabledLayerIds = useMemo(
    () =>
      displayLayers
        .filter((layer) => layer.tone !== 'neutral' || layer.source === 'backend')
        .slice(0, 5)
        .map((layer) => layer.id),
    [displayLayerKey, displayLayers],
  );
  const enabledLayerIds = layerSelection ?? defaultEnabledLayerIds;

  useEffect(() => {
    setLayerSelection(null);
  }, [displayLayerKey]);

  const selectedZone =
    aggregate.zones.find((metric) => metric.zone.id === selectedZoneId) ??
    aggregate.zones.find((metric) => metric.records > 0 && !metric.suppressed) ??
    aggregate.zones[0];

  const topZones = aggregate.zones
    .filter((metric) => metric.records > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);
  const animatedZones = topZones.slice(0, 3);

  const title = labelFor(labels, 'premium_heatmap_title', 'Inteligencia territorial');
  const description = labelFor(
    labels,
    'premium_heatmap_description',
    'Volumen, demanda y riesgo por zona con privacidad por muestra minima.',
  );
  const hasWarning = Boolean(mapConfig?.style_url_warning);
  const preferredVisualization = humanizeContractValue(
    readString(heatmap?.map_experience?.preferred_visualization),
    'Globo territorial interactivo',
  );
  const emptyStateBehavior = humanizeContractValue(readString(heatmap?.map_experience?.empty_state_behavior), '');
  const geocodingStatus = readString(heatmap?.geocoding?.status, heatmap?.geocoding?.reason_code);
  const geocodingCandidates = heatmap?.geocoding?.candidates?.slice(0, 3) ?? [];
  const qualityAction = summarizeBackendAction(heatmap?.quality?.empty_state_action);
  const geocodingAction = summarizeBackendAction(heatmap?.geocoding?.recommended_action);
  const activeAction = readiness.state === 'empty' || readiness.state === 'low' ? qualityAction ?? geocodingAction : geocodingAction;
  const realtimeSources = heatmap?.realtime?.sources ?? [];
  const realtimeEvents = heatmap?.realtime?.socket_events ?? [];
  const latestRealtime = readString(heatmap?.realtime?.latest_event_at);
  const narrativeTitle = readString(
    heatmap?.map_narrative?.headline,
    heatmap?.map_narrative?.title,
    readiness.state === 'empty' ? heatmap?.map_narrative?.empty_state_title : undefined,
  );
  const narrativeBody = readString(
    heatmap?.map_narrative?.operator_summary,
    heatmap?.map_narrative?.body,
    heatmap?.map_narrative?.description,
    readiness.state === 'empty' ? heatmap?.map_narrative?.empty_state_description : undefined,
  );
  const narrativeAction = summarizeBackendAction(heatmap?.map_narrative?.primary_cta);
  const viewportPresets = heatmap?.viewport_presets?.presets?.slice(0, 3) ?? [];
  const defaultViewportId = heatmap?.viewport_presets?.default_preset_id;
  const defaultViewport = viewportPresets.find((preset) => preset.id === defaultViewportId) ?? viewportPresets[0];
  const defaultViewportZoom = readNumber(defaultViewport?.zoom);
  const defaultViewportRadius = readNumber(defaultViewport?.radius_km);
  const defaultViewportDetail = defaultViewport
    ? [
        humanizeContractValue(readString(defaultViewport.mode), ''),
        defaultViewportZoom !== undefined ? `zoom ${formatNumber(defaultViewportZoom)}` : undefined,
        defaultViewportRadius !== undefined ? `${formatNumber(defaultViewportRadius)} km` : undefined,
      ]
        .filter(Boolean)
        .join(' - ')
    : undefined;
  const aiStatus = heatmap?.ai_status;
  const aiStatusLabel = humanizeContractValue(readString(aiStatus?.status, heatmap?.ai_layers?.status), 'sin estado IA');
  const aiModeLabel = humanizeContractValue(readString(aiStatus?.mode, heatmap?.ai_layers?.mode), 'capas operativas');
  const aiHintLabels = (aiStatus?.map_layer_hints ?? []).map((hint) => humanizeContractValue(hint, hint)).slice(0, 3);
  const mapLayers = asRecord(heatmap?.map_layers);
  const mapLayerHotspots = asRecord(mapLayers?.hotspots);
  const mapLayerFocus = asRecord(mapLayerHotspots?.focus);
  const mapLayerFocusRisk = asRecord(mapLayerFocus?.risk);
  const mapLayerIntensity = asRecord(mapLayers?.intensity);
  const mapLayerVisualSystem = asRecord(mapLayers?.visual_system);
  const mapLayerAnimations = asRecord(mapLayerVisualSystem?.animations);
  const mapLayerOperatorMetrics = asRecord(mapLayers?.operator_metrics);
  const heatmapSummary = asRecord(heatmap?.summary);
  const operationalHotspots = heatmap?.operational_hotspots?.slice(0, 4) ?? [];
  const topOperationalHotspot = operationalHotspots[0];
  const topOperationalSignals = asRecord(topOperationalHotspot?.signals);
  const operationalHotspotCount = readNumber(heatmapSummary?.operational_hotspots) ?? operationalHotspots.length;
  const backendTotalCases = readNumber(mapLayerOperatorMetrics?.total_cases, mapLayerIntensity?.total_cases);
  const backendVisibleLayers = readNumber(mapLayerOperatorMetrics?.visible_layers, mapLayerIntensity?.total_items);
  const backendCriticalHotspots = readNumber(mapLayerOperatorMetrics?.critical_hotspots, operationalHotspotCount);
  const backendTopCategory = readString(mapLayerOperatorMetrics?.top_category, mapLayerFocus?.category, topOperationalHotspot?.top_category);
  const backendFocusCount = readNumber(mapLayerFocus?.count);
  const backendFocusRiskLabel = humanizeContractValue(
    readString(mapLayerFocusRisk?.label, mapLayerFocusRisk?.level),
    'sin severidad',
  );
  const backendRenderer = humanizeContractValue(readString(mapLayerVisualSystem?.renderer), 'mapa operativo');
  const backendRadarEnabled = mapLayerAnimations?.radar_sweep === true;
  const hasBackendMapContract = Boolean(
    mapLayers?.contract_version || backendTopCategory || backendTotalCases !== undefined || backendVisibleLayers !== undefined,
  );
  const hotspotActionSummaries = uniqueActionSummaries([
    ...(heatmap?.hotspot_actions?.actions ?? []),
    ...(heatmap?.hotspot_actions?.playbook ?? []),
    ...(heatmap?.hotspot_playbook ?? []),
    ...(heatmap?.operator_playbook ?? []),
  ]).slice(0, 4);
  const geocodingCandidateActions = geocodingCandidates.flatMap((candidate) => {
    const contextLabel = readString(candidate.address, candidate.label, candidate.category);
    return (candidate.actions ?? []).map((action) => actionWithContext(action, contextLabel));
  });
  const pointActions = sourcePoints.flatMap((point) => {
    const contextLabel = readString(point.label, point.categoria, point.category, point.barrio, point.distrito);
    return (point.actions ?? []).map((action) => actionWithContext(action, contextLabel));
  });
  const cellActions = (heatmap?.cells ?? []).flatMap((cell) => {
    const contextLabel = readString(cell.label, cell.title, cell.key, cell.id);
    return (cell.actions ?? []).map((action) => actionWithContext(action, contextLabel));
  });
  const operationalHotspotActions = operationalHotspots
    .map((hotspot) => actionWithContext(hotspot.recommended_action, readString(hotspot.top_category, hotspot.id)))
    .filter(Boolean);
  const operationalActionSummaries = uniqueActionSummaries([
    heatmap?.map_narrative?.primary_cta,
    ...operationalHotspotActions,
    ...(heatmap?.hotspot_actions?.actions ?? []),
    ...(heatmap?.hotspot_actions?.playbook ?? []),
    ...(heatmap?.hotspot_playbook ?? []),
    ...(heatmap?.operator_playbook ?? []),
    ...(heatmap?.geocoding?.guidance?.recommended_actions ?? []),
    heatmap?.geocoding?.recommended_action,
    ...(heatmap?.ai_layers?.recommendations ?? []),
    ...geocodingCandidateActions,
    ...pointActions,
    ...cellActions,
  ]).slice(0, 8);
  const hasOperationalBrief = Boolean(
    narrativeTitle ||
      narrativeBody ||
      narrativeAction ||
      viewportPresets.length ||
      operationalActionSummaries.length ||
      aiStatus ||
      heatmap?.ai_layers ||
      hasBackendMapContract,
  );
  const showHeatLayer = layerIsEnabled(enabledLayerIds, ['heat', 'hotspot', 'base']) || !displayLayers.length;
  const showAiLayer = layerIsEnabled(enabledLayerIds, ['ai', 'risk', 'prior']);
  const showQualityLayer = layerIsEnabled(enabledLayerIds, ['quality', 'coverage', 'geo']);
  const showRealtimeLayer = layerIsEnabled(enabledLayerIds, ['realtime', 'live', 'whatsapp', 'socket']);
  const geoLayerConfig = useMemo(
    () =>
      buildOperationsGeoLayerConfig({
        heatmap,
        points: liveMapPoints,
        enabledLayerIds,
        mapStyleUrl: mapConfig?.style_url,
        showHeatLayer,
        showAiLayer,
        showQualityLayer,
        showRealtimeLayer,
      }),
    [
      heatmap,
      liveMapPoints,
      enabledLayerIds,
      mapConfig?.style_url,
      showAiLayer,
      showHeatLayer,
      showQualityLayer,
      showRealtimeLayer,
    ],
  );
  const liveMapEvidence = useMemo(
    () => {
      const heatmapRecord = asRecord(heatmap);
      return {
        source: usesDemoData ? 'demo_fallback' : usesBackendCellPoints ? 'backend_cells' : 'operations_heatmap',
        provider: liveMapProvider,
        contractVersion: readString(heatmap?.contract_version, geoLayerConfig?.contract_version),
        usingSyntheticPoints: usesDemoData,
        pointCount: liveMapPoints.length,
        featureCount:
          geoLayerConfig?.source && Array.isArray((geoLayerConfig.source as { features?: unknown[] }).features)
            ? (geoLayerConfig.source as { features?: unknown[] }).features?.length ?? 0
            : 0,
        coveragePct: readNumber(
          heatmap?.quality?.coverage_pct,
          heatmap?.quality?.coverage,
          heatmap?.summary?.coverage_pct,
        ),
        updatedAt: readString(
          heatmap?.realtime?.latest_event_at,
          heatmapRecord?.generated_at,
          heatmapRecord?.updated_at,
        ),
      };
    },
    [
      geoLayerConfig?.contract_version,
      geoLayerConfig?.source,
      heatmap,
      heatmap?.contract_version,
      heatmap?.quality?.coverage,
      heatmap?.quality?.coverage_pct,
      heatmap?.realtime?.latest_event_at,
      heatmap?.summary?.coverage_pct,
      liveMapPoints.length,
      liveMapProvider,
      usesBackendCellPoints,
      usesDemoData,
    ],
  );
  const hasLowQualityOverlay = readiness.state === 'empty' || readiness.state === 'low' || readiness.state === 'degraded';
  const visiblePointCount = readiness.visiblePoints ?? aggregate.totalRecords;
  const decisionZone = selectedZone.records > 0 ? selectedZone : topZones[0] ?? selectedZone;
  const decisionAction = narrativeAction ?? operationalActionSummaries[0] ?? hotspotActionSummaries[0] ?? activeAction;
  const decisionActionLabel =
    decisionAction?.label ??
    (readiness.pendingGeocode > 0
      ? 'Resolver geocoding pendiente'
      : readiness.state === 'ready'
        ? 'Monitorear territorio'
        : 'Completar datos territoriales');
  const decisionActionDetail = decisionAction?.detail ?? decisionZone.recommendation;
  const commandLoopHref = decisionAction?.href ?? operationalActionSummaries.find((action) => action.href)?.href;
  const commandPrimaryCategory = backendTopCategory
    ? humanizeContractValue(backendTopCategory, backendTopCategory)
    : decisionZone.topCategories[0]?.label ?? aggregate.topCategories[0]?.label ?? 'sin categoria dominante';
  const commandRealtimeDetail =
    realtimeEvents.length > 0
      ? humanizeContractValue(realtimeEvents[0], realtimeEvents[0])
      : realtimeSources.length > 0
        ? humanizeContractValue(realtimeSources[0], realtimeSources[0])
        : latestRealtime
          ? `ultimo evento ${latestRealtime}`
          : 'sin socket visible';
  const [decisionCx, decisionCy] = territoryCentroid(decisionZone.zone.polygon);
  const [selectedCx, selectedCy] = territoryCentroid(selectedZone.zone.polygon);
  const decisionRadarRadius = Math.min(14, Math.max(7, 8 + decisionZone.intensity * 6));
  const telemetryRouteZones = topZones.length >= 2 ? topZones : aggregate.zones.slice(0, 4);
  const telemetryRoutes = telemetryRouteZones.slice(0, -1).map((metric, index) => {
    const nextMetric = telemetryRouteZones[index + 1];
    const [startX, startY] = territoryCentroid(metric.zone.polygon);
    const [endX, endY] = territoryCentroid(nextMetric.zone.polygon);
    const controlX = (startX + endX) / 2;
    const controlY = (startY + endY) / 2 + (index % 2 === 0 ? -5.5 : 4.5);
    const routeId = `${svgId}-telemetry-route-${metric.zone.id}-${nextMetric.zone.id}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    return {
      id: routeId,
      d: `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`,
      delay: `${index * 0.9}s`,
      duration: `${5.4 + index * 0.8}s`,
      tone:
        index === 0
          ? 'rgba(34,211,238,0.9)'
          : index === 1
            ? 'rgba(168,85,247,0.82)'
            : 'rgba(245,158,11,0.86)',
    };
  });
  const hudBars = [
    { id: 'visible', label: 'visibles', value: visiblePointCount || 0, tone: 'rgba(34,211,238,0.86)' },
    { id: 'hotspots', label: 'hotspots', value: backendCriticalHotspots ?? aggregate.alerts ?? 0, tone: 'rgba(168,85,247,0.78)' },
    { id: 'pend', label: 'pend.', value: readiness.pendingGeocode ?? 0, tone: 'rgba(245,158,11,0.86)' },
  ];
  const hudMax = Math.max(1, ...hudBars.map((bar) => bar.value));
  const executiveSummaryCards: Array<{ label: string; value: string; detail: string; icon: typeof Globe2 }> = [
    {
      label: 'Puntos visibles',
      value: formatNumber(visiblePointCount, '0'),
      detail: `${formatPercent(readiness.coveragePercent)} de cobertura territorial`,
      icon: Eye,
    },
    {
      label: 'Pendientes',
      value: formatNumber(readiness.pendingGeocode, '0'),
      detail: geocodingStatus ? humanizeContractValue(geocodingStatus, geocodingStatus) : 'sin cola de geocoding',
      icon: DatabaseZap,
    },
    {
      label: 'Foco territorial',
      value: commandPrimaryCategory,
      detail:
        backendFocusCount !== undefined
          ? `${formatNumber(backendFocusCount, '0')} casos - ${backendFocusRiskLabel}`
          : decisionZone.suppressed
            ? 'muestra insuficiente'
            : decisionZone.zone.label,
      icon: Compass,
    },
    {
      label: 'Proxima accion',
      value: decisionActionLabel,
      detail: decisionActionDetail || 'sin accion automatica pendiente',
      icon: ListChecks,
    },
  ];
  const commandLoopCards: Array<{ label: string; value: string; detail: string; icon: typeof Globe2 }> = [
    {
      label: 'Foco critico',
      value:
        backendCriticalHotspots !== undefined
          ? `${formatNumber(backendCriticalHotspots, '0')} hotspots`
          : `${formatNumber(aggregate.alerts, '0')} alertas`,
      detail: commandPrimaryCategory,
      icon: ShieldAlert,
    },
    {
      label: 'Accion siguiente',
      value: decisionActionLabel,
      detail: decisionActionDetail || 'sin accion automatica pendiente',
      icon: ListChecks,
    },
    {
      label: 'Cobertura GPS',
      value: formatPercent(readiness.coveragePercent),
      detail: `${formatNumber(visiblePointCount, '0')} puntos visibles`,
      icon: Gauge,
    },
    {
      label: 'Tiempo real',
      value: heatmap?.realtime?.poll_seconds ? `${formatNumber(heatmap.realtime.poll_seconds)}s` : 'manual',
      detail: commandRealtimeDetail,
      icon: Activity,
    },
  ];
  const commandSignals = [
    {
      label: backendTopCategory ? 'Foco backend' : 'Zona foco',
      value: backendTopCategory ? humanizeContractValue(backendTopCategory, backendTopCategory) : decisionZone.zone.label,
      detail:
        backendFocusCount !== undefined
          ? `${formatNumber(backendFocusCount)} casos - ${backendFocusRiskLabel}`
          : decisionZone.suppressed
            ? 'muestra insuficiente'
            : `${formatNumber(decisionZone.total)} eventos`,
      icon: MapPin,
    },
    {
      label: 'Cobertura',
      value: formatPercent(readiness.coveragePercent),
      detail: readiness.label,
      icon: Gauge,
    },
    {
      label: 'Capas activas',
      value:
        backendVisibleLayers !== undefined
          ? formatNumber(backendVisibleLayers)
          : `${formatNumber(enabledLayerIds.length)}/${formatNumber(displayLayers.length || enabledLayerIds.length)}`,
      detail: hasBackendMapContract ? backendRenderer : aiModeLabel,
      icon: Layers,
    },
    {
      label: 'Datos pendientes',
      value: formatNumber(readiness.pendingGeocode, '0'),
      detail: geocodingStatus ? humanizeContractValue(geocodingStatus, geocodingStatus) : 'sin cola visible',
      icon: DatabaseZap,
    },
  ];
  const legendContract = asRecord(heatmap?.legend);
  const layerStyleContract = asRecord(heatmap?.layer_style_contract);
  const legendPalette = readStringArray(layerStyleContract?.palette, legendContract?.palette);
  const fallbackLegendColors = ['#3b82f6', '#14b8a6', '#f59e0b', '#94a3b8'];
  const liveLegendItems = [
    ...asRecordArray(legendContract?.legend_items),
    ...asRecordArray(layerStyleContract?.legend_items),
    ...asRecordArray(layerStyleContract?.styles),
    ...asRecordArray(layerStyleContract?.layers),
  ]
    .map((item, index) => ({
      label: humanizeContractValue(
        readString(item.label, item.name, item.title, item.key, item.id),
        `Capa ${index + 1}`,
      ),
      detail: humanizeContractValue(readString(item.description, item.metric, item.source, item.bucket), ''),
      color:
        safeCssColor(readString(item.color, item.hex, item.fill, item.stroke, item.token)) ||
        safeCssColor(legendPalette[index]) ||
        fallbackLegendColors[index % fallbackLegendColors.length],
    }))
    .slice(0, 4);
  const visibleLegendItems = liveLegendItems.length
    ? liveLegendItems
    : [
        { label: 'Bajo', detail: 'demanda inicial', color: fallbackLegendColors[0] },
        { label: 'Medio', detail: 'actividad sostenida', color: fallbackLegendColors[1] },
        { label: 'Alto', detail: 'prioridad operativa', color: fallbackLegendColors[2] },
        { label: 'Muestra insuficiente', detail: 'privacidad activa', color: fallbackLegendColors[3] },
      ];
  const liveSignalValue = latestRealtime
    ? 'online'
    : showRealtimeLayer || realtimeEvents.length || realtimeSources.length
      ? 'escuchando'
      : 'sin pulso';
  const liveSignalDetail =
    latestRealtime ||
    realtimeEvents.map((event) => humanizeContractValue(event, event)).join(' / ') ||
    realtimeSources.map((source) => humanizeContractValue(source, source)).join(' / ') ||
    'sin evento realtime';
  const focusDetail =
    backendFocusCount !== undefined
      ? `${formatNumber(backendFocusCount, '0')} casos - ${backendFocusRiskLabel}`
      : operationalHotspotCount
        ? `${formatNumber(operationalHotspotCount, '0')} hotspots`
        : `${formatNumber(visiblePointCount, '0')} puntos`;
  const visualSystemDetail = [
    backendRadarEnabled ? 'radar activo' : null,
    showHeatLayer ? 'calor' : null,
    showAiLayer ? 'IA' : null,
    showRealtimeLayer ? 'realtime' : null,
  ].filter(Boolean).join(' - ');
  const liveLegendCards = [
    { label: 'Señal viva', value: liveSignalValue, detail: liveSignalDetail, icon: Activity },
    { label: 'Foco', value: commandPrimaryCategory, detail: focusDetail, icon: Compass },
    { label: 'Accion siguiente', value: decisionActionLabel, detail: decisionActionDetail || 'sin accion pendiente', icon: ListChecks },
    { label: 'Sistema visual', value: backendRenderer, detail: visualSystemDetail || preferredVisualization, icon: Radar },
  ];
  const focusModes: Array<{ id: MapFocusMode; label: string; icon: typeof Globe2 }> = [
    { id: 'territory', label: labelFor(labels, 'premium_map_mode_territory', 'Territorio'), icon: Globe2 },
    { id: 'quality', label: labelFor(labels, 'premium_map_mode_quality', 'Calidad'), icon: Gauge },
    { id: 'telemetry', label: labelFor(labels, 'premium_map_mode_telemetry', 'Telemetria'), icon: Activity },
  ];

  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Layers className="h-3.5 w-3.5" />
              {usesDemoData
                ? 'modo demo local'
                : usesBackendCellPoints
                  ? 'heatmap backend'
                  : heatmap?.contract_version ?? 'operations.heatmap.v1'}
            </Badge>
            <Badge variant="outline" className="gap-1 capitalize">
              <Globe2 className="h-3.5 w-3.5" />
              {preferredVisualization}
            </Badge>
            <Badge variant={badgeVariantForReadiness(readiness.state)} className="gap-1">
              {readiness.state === 'ready' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
              {readiness.label}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              minimo {minSampleSize}
            </Badge>
            {hasWarning ? (
              <Badge variant="outline" className="gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                fallback mapa
              </Badge>
            ) : null}
          </div>
          <div>
            <h3 className="text-xl font-semibold tracking-normal text-foreground">{title}</h3>
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right sm:min-w-[430px] sm:grid-cols-4">
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Eventos</p>
            <p className="text-lg font-semibold">{formatNumber(aggregate.totalEvents)}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Cobertura</p>
            <p className="text-lg font-semibold">{formatPercent(readiness.coveragePercent)}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Geocoding</p>
            <p className="text-lg font-semibold">{formatNumber(readiness.pendingGeocode, '0')}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Telemetria</p>
            <p className="text-lg font-semibold">{heatmap?.realtime?.poll_seconds ? `${formatNumber(heatmap.realtime.poll_seconds)}s` : '--'}</p>
          </div>
        </div>
      </div>

      {activeFilters.length ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Segmentos activos:</span>
          {activeFilters.map((filter) => (
            <Button
              key={`${filter.key}-${filter.value}`}
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 px-2 text-xs"
              onClick={filter.onClear}
            >
              <span>{filter.label}</span>
              <span className="font-semibold text-foreground">{filter.value}</span>
            </Button>
          ))}
        </div>
      ) : null}

      <div
        data-testid="territory-executive-strip"
        className="overflow-hidden rounded-xl border border-border/70 bg-background/80 shadow-sm"
      >
        <div className="flex flex-col gap-2 border-b border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Radar className="h-3.5 w-3.5" />
                Lectura ejecutiva
              </Badge>
              <Badge variant="outline" className="capitalize">
                {readiness.label}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Resumen operativo para leer demanda, calidad de datos y accion siguiente sin abrir paneles internos.
            </p>
          </div>
          <Badge variant="outline" className="w-fit gap-1">
            <Activity className="h-3.5 w-3.5" />
            {hasBackendMapContract ? 'contrato backend activo' : 'atlas operativo'}
          </Badge>
        </div>
        <div className="grid divide-y divide-border/70 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          {executiveSummaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="min-w-0 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{card.label}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-lg font-semibold leading-snug">{card.value}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{card.detail}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div
        data-testid="territory-command-loop"
        className="overflow-hidden rounded-xl border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--background)),rgba(59,130,246,0.08),rgba(20,184,166,0.08))] shadow-sm"
      >
        <div className="flex flex-col gap-4 border-b border-border/70 p-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Radar className="h-3.5 w-3.5" />
                Command loop IA
              </Badge>
              <Badge variant={readiness.state === 'ready' ? 'outline' : 'secondary'} className="capitalize">
                {readiness.label}
              </Badge>
            </div>
            <h4 className="mt-2 text-lg font-semibold leading-tight">Pulso operativo territorial</h4>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
              Priorizacion del mapa para convertir heatmaps, encuestas, tickets y WhatsApp en una cola de trabajo clara para el equipo.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Activity className="h-3.5 w-3.5" />
              {realtimeSources.length || realtimeEvents.length ? 'senal viva' : 'modo operativo'}
            </Badge>
            {commandLoopHref ? (
              <a
                href={commandLoopHref}
                className="inline-flex min-h-9 items-center justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              >
                Abrir cola CRM
              </a>
            ) : null}
          </div>
        </div>
        <div className="grid gap-0 divide-y divide-border/70 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
          {commandLoopCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} data-testid="territory-command-card" className="min-w-0 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{card.label}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-base font-semibold leading-snug">{card.value}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{card.detail}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div
        data-testid="territory-decision-radar"
        className="overflow-hidden rounded-xl border border-border/70 bg-[linear-gradient(135deg,rgba(15,23,42,0.04),hsl(var(--background)),rgba(20,184,166,0.06))] shadow-sm"
      >
        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
          <div className="border-b border-border/70 p-4 lg:border-b-0 lg:border-r">
            <div className="flex items-start gap-3">
              <span className="relative mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                <Radar className="h-5 w-5" />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-teal-400 shadow-[0_0_0_4px_rgba(45,212,191,0.18)]" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Radar de decision</p>
                <h4 className="mt-1 text-base font-semibold leading-snug">{decisionActionLabel}</h4>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{decisionActionDetail}</p>
              </div>
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-2 divide-x divide-y divide-border/60 sm:grid-cols-4 sm:divide-y-0">
            {commandSignals.map((signal) => {
              const Icon = signal.icon;
              return (
                <div key={signal.label} className="min-w-0 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="truncate">{signal.label}</span>
                  </div>
                  <p className="mt-2 truncate text-lg font-semibold">{signal.value}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{signal.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Modo de lectura del mapa">
          {focusModes.map((mode) => {
            const Icon = mode.icon;
            const active = focusMode === mode.id;
            return (
              <Button
                key={mode.id}
                type="button"
                size="sm"
                variant={active ? 'default' : 'outline'}
                onClick={() => setFocusMode(mode.id)}
                aria-pressed={active}
              >
                <Icon className="h-4 w-4" />
                {mode.label}
              </Button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label="Capas visibles">
          {displayLayers.map((layer) => {
            const active = enabledLayerIds.includes(layer.id);
            return (
              <Button
                key={layer.id}
                type="button"
                size="sm"
                variant={active ? 'secondary' : 'outline'}
                className={cn('h-auto min-h-9 max-w-full justify-start px-3 py-2 text-left', active && layerToneClass[layer.tone])}
                onClick={() =>
                  setLayerSelection((current) => {
                    const base = current ?? defaultEnabledLayerIds;
                    return base.includes(layer.id) ? base.filter((item) => item !== layer.id) : [...base, layer.id];
                  })
                }
                aria-pressed={active}
                title={layer.description}
              >
                <span className="truncate">{layer.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div
          className="relative min-h-[500px] overflow-hidden rounded-xl border border-border bg-[radial-gradient(circle_at_20%_16%,rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_76%_24%,rgba(20,184,166,0.14),transparent_30%),linear-gradient(145deg,hsl(var(--background)),rgba(15,23,42,0.055))] shadow-[0_24px_80px_rgba(15,23,42,0.16)]"
          style={{ perspective: '1200px' }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(59,130,246,0.18),transparent_30%),radial-gradient(circle_at_78%_30%,rgba(20,184,166,0.16),transparent_34%),radial-gradient(circle_at_48%_86%,rgba(245,158,11,0.12),transparent_36%),linear-gradient(135deg,rgba(15,23,42,0.06),rgba(15,23,42,0))]" />
          <div className="absolute inset-x-8 top-6 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-70 dark:via-white/20" />
          <div className="absolute -bottom-16 left-1/2 h-36 w-[72%] -translate-x-1/2 rounded-[999px] bg-slate-950/10 blur-3xl dark:bg-black/35" />
          {showLiveMap ? (
            <div data-testid="live-territory-map" className="relative z-10 h-[450px] w-full overflow-hidden sm:h-[540px]">
              <LazyMapLibreMap
                className="h-full min-h-0 w-full rounded-none border-0"
                heatmapData={liveMapPoints}
                showHeatmap={showHeatLayer}
                provider={liveMapProvider}
                mapStyleUrl={mapConfig?.style_url}
                maptilerKey={mapConfig?.maptiler_key}
                googleMapsKey={mapConfig?.google_maps_key}
                geoLayerConfig={geoLayerConfig}
                fitToBounds={liveMapBounds}
                boundsPadding={{ top: 96, right: 48, bottom: 112, left: 48 }}
                disableClientClustering
                evidence={liveMapEvidence}
              />
            </div>
          ) : (
          <svg
            role="img"
            aria-label={title}
            viewBox="0 0 100 68"
            className="relative z-10 h-[450px] w-full touch-pan-y select-none sm:h-[540px]"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id={`${svgId}-territory-hotspot`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(96, 165, 250, 0.75)" />
                <stop offset="48%" stopColor="rgba(45, 212, 191, 0.22)" />
                <stop offset="100%" stopColor="rgba(45, 212, 191, 0)" />
              </radialGradient>
              <linearGradient id={`${svgId}-surface-shine`} x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.72)" />
                <stop offset="42%" stopColor="rgba(255,255,255,0.08)" />
                <stop offset="100%" stopColor="rgba(15,23,42,0.02)" />
              </linearGradient>
              <linearGradient id={`${svgId}-scan`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="48%" stopColor="rgba(255,255,255,0.42)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
              <radialGradient id={`${svgId}-radar-wedge`} cx="0%" cy="0%" r="100%">
                <stop offset="0%" stopColor="rgba(34,211,238,0.5)" />
                <stop offset="46%" stopColor="rgba(59,130,246,0.2)" />
                <stop offset="100%" stopColor="rgba(34,211,238,0)" />
              </radialGradient>
              <linearGradient id={`${svgId}-telemetry-line`} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="rgba(34,211,238,0.06)" />
                <stop offset="52%" stopColor="rgba(255,255,255,0.62)" />
                <stop offset="100%" stopColor="rgba(168,85,247,0.12)" />
              </linearGradient>
              <filter id={`${svgId}-zone-shadow`} x="-20%" y="-20%" width="140%" height="150%">
                <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" floodColor="rgba(15,23,42,0.32)" />
              </filter>
              <filter id={`${svgId}-selected-glow`} x="-35%" y="-35%" width="170%" height="170%">
                <feDropShadow dx="0" dy="0" stdDeviation="1.8" floodColor="rgba(255,255,255,0.7)" />
                <feDropShadow dx="0" dy="1.6" stdDeviation="1.6" floodColor="rgba(15,23,42,0.28)" />
              </filter>
              <pattern id={`${svgId}-territory-grid`} width="6" height="6" patternUnits="userSpaceOnUse">
                <path d="M 6 0 L 0 0 0 6" fill="none" stroke="rgba(148, 163, 184, 0.16)" strokeWidth="0.18" />
              </pattern>
              <clipPath id={`${svgId}-globe-clip`}>
                <ellipse cx="50" cy="34" rx="43" ry="30" />
              </clipPath>
              <radialGradient id={`${svgId}-globe-base`} cx="42%" cy="24%" r="70%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.72)" />
                <stop offset="34%" stopColor="rgba(125,211,252,0.18)" />
                <stop offset="70%" stopColor="rgba(15,23,42,0.06)" />
                <stop offset="100%" stopColor="rgba(15,23,42,0.18)" />
              </radialGradient>
            </defs>
            <rect width="100" height="68" fill={`url(#${svgId}-territory-grid)`} />
            <ellipse cx="50" cy="35" rx="44" ry="30.5" fill={`url(#${svgId}-globe-base)`} stroke="rgba(255,255,255,0.48)" strokeWidth="0.28" />
            <g opacity="0.32" clipPath={`url(#${svgId}-globe-clip)`}>
              {[20, 35, 50, 65, 80].map((x) => (
                <path
                  key={`meridian-${x}`}
                  d={`M${x} 6 C${x - 8} 22 ${x - 8} 46 ${x} 65`}
                  fill="none"
                  stroke="rgba(255,255,255,0.32)"
                  strokeWidth="0.16"
                />
              ))}
              {[14, 24, 34, 44, 54].map((y) => (
                <ellipse
                  key={`parallel-${y}`}
                  cx="50"
                  cy={y}
                  rx={42 - Math.abs(34 - y) * 0.42}
                  ry="2.35"
                  fill="none"
                  stroke="rgba(59,130,246,0.2)"
                  strokeWidth="0.16"
                />
              ))}
            </g>
            <path
              d="M8 59 C24 52 34 58 50 51 C66 44 72 50 94 41"
              fill="none"
              stroke="rgba(255,255,255,0.38)"
              strokeWidth="0.28"
              strokeDasharray="1.4 2.2"
            />
            <path
              d="M6 15 C23 22 38 13 51 21 C65 30 77 20 95 28"
              fill="none"
              stroke="rgba(20,184,166,0.22)"
              strokeWidth="0.24"
              strokeDasharray="1 2"
            />
            <g data-testid="territory-hud-overlay" aria-hidden="true" opacity="0.94">
              <rect x="5.5" y="6" width="27.5" height="13.6" rx="2.2" fill="rgba(15,23,42,0.58)" stroke="rgba(148,163,184,0.36)" strokeWidth="0.18" />
              <text x="8" y="10.2" className="fill-white text-[2.05px] font-semibold tracking-[0.18em]">
                HEATMAP OPERATIVO
              </text>
              <text x="8" y="13.7" className="fill-cyan-100 text-[1.85px] font-medium">
                {preferredVisualization.slice(0, 27)}
              </text>
              <text x="8" y="17" className="fill-slate-200 text-[1.75px]">
                foco: {decisionZone.zone.label.slice(0, 20)}
              </text>
              {hudBars.map((bar, index) => {
                const y = 22.8 + index * 2.9;
                const width = 4 + (bar.value / hudMax) * 16;
                return (
                  <g key={bar.id}>
                    <text x="7" y={y + 0.7} className="fill-slate-200 text-[1.45px] uppercase">
                      {bar.label}
                    </text>
                    <rect x="15.8" y={y - 0.85} width="17.6" height="1.25" rx="0.62" fill="rgba(148,163,184,0.2)" />
                    <rect x="15.8" y={y - 0.85} width={width} height="1.25" rx="0.62" fill={bar.tone}>
                      {!shouldReduceMotion ? (
                        <animate attributeName="opacity" values="0.72;1;0.72" dur={`${3.4 + index * 0.45}s`} repeatCount="indefinite" />
                      ) : null}
                    </rect>
                  </g>
                );
              })}
            </g>
            <g data-testid="territory-radar-sweep" aria-hidden="true" transform={`translate(${decisionCx} ${decisionCy})`} opacity="0.78">
              <circle r={decisionRadarRadius} fill="none" stroke="rgba(34,211,238,0.28)" strokeWidth="0.24" strokeDasharray="1.4 1.6" />
              <circle r={decisionRadarRadius * 0.58} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.18" />
              <path
                d={`M 0 0 L ${decisionRadarRadius} 0 A ${decisionRadarRadius} ${decisionRadarRadius} 0 0 1 ${decisionRadarRadius * 0.42} ${decisionRadarRadius * 0.91} Z`}
                fill={`url(#${svgId}-radar-wedge)`}
              >
                {!shouldReduceMotion ? (
                  <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="9s" repeatCount="indefinite" />
                ) : null}
              </path>
              <line x1={-decisionRadarRadius} x2={decisionRadarRadius} y1="0" y2="0" stroke="rgba(255,255,255,0.22)" strokeWidth="0.12" />
              <line x1="0" x2="0" y1={-decisionRadarRadius} y2={decisionRadarRadius} stroke="rgba(255,255,255,0.22)" strokeWidth="0.12" />
            </g>
            <g data-testid="territory-comet-network" aria-hidden="true" opacity={showRealtimeLayer || focusMode === 'telemetry' ? 0.82 : 0.5}>
              {telemetryRoutes.map((route, index) => (
                <g key={route.id} data-testid="territory-comet-route">
                  <path id={route.id} d={route.d} fill="none" stroke={`url(#${svgId}-telemetry-line)`} strokeWidth="0.34" strokeLinecap="round" strokeDasharray="0.8 1.4" />
                  {!shouldReduceMotion ? (
                    <circle r={index === 0 ? 0.74 : 0.58} fill={route.tone} stroke="rgba(255,255,255,0.76)" strokeWidth="0.12">
                      <animateMotion dur={route.duration} begin={route.delay} repeatCount="indefinite" rotate="auto">
                        <mpath href={`#${route.id}`} />
                      </animateMotion>
                      <animate attributeName="opacity" values="0;1;0" dur={route.duration} begin={route.delay} repeatCount="indefinite" />
                    </circle>
                  ) : null}
                </g>
              ))}
            </g>
            {aggregate.zones.map((metric) => {
              const [cx, cy] = territoryCentroid(metric.zone.polygon);
              if (!showHeatLayer || !metric.records || metric.suppressed) return null;
              const radius = 5 + metric.intensity * 13;
              return (
                <circle
                  key={`${metric.zone.id}-halo`}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={`url(#${svgId}-territory-hotspot)`}
                  opacity={comparisonEnabled ? 0.28 : 0.56}
                >
                  {!shouldReduceMotion ? (
                    <animate attributeName="opacity" values="0.28;0.62;0.34" dur="4.8s" repeatCount="indefinite" />
                  ) : null}
                </circle>
              );
            })}
            <g opacity={showRealtimeLayer || focusMode === 'telemetry' ? 0.52 : 0.18}>
              {animatedZones.map((metric, index) => {
                const [cx, cy] = territoryCentroid(metric.zone.polygon);
                return (
                  <g key={`${metric.zone.id}-activity`}>
                    <circle cx={cx - 2.4} cy={cy - 2.2} r="0.42" fill="rgba(255,255,255,0.9)" />
                    <circle cx={cx + 2.8} cy={cy + 1.6} r="0.34" fill="rgba(45,212,191,0.95)" />
                    {!shouldReduceMotion ? (
                      <circle cx={cx} cy={cy} r={2.8 + metric.intensity * 2.2} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.18">
                        <animate
                          attributeName="r"
                          values={`${2.6 + index};${5.8 + metric.intensity * 4};${2.6 + index}`}
                          dur={`${5.2 + index * 0.7}s`}
                          repeatCount="indefinite"
                        />
                        <animate attributeName="opacity" values="0.05;0.45;0.05" dur={`${5.2 + index * 0.7}s`} repeatCount="indefinite" />
                      </circle>
                    ) : null}
                  </g>
                );
              })}
            </g>
            {showAiLayer || focusMode === 'territory' ? (
              <g opacity={showAiLayer ? 0.86 : 0.28}>
                {aggregate.zones
                  .filter((metric) => metric.records > 0 && !metric.suppressed)
                  .slice()
                  .sort((a, b) => b.intensity - a.intensity)
                  .slice(0, 4)
                  .map((metric, index) => {
                    const [cx, cy] = territoryCentroid(metric.zone.polygon);
                    const radius = 3.2 + metric.intensity * 4.8;
                    return (
                      <g key={`${metric.zone.id}-ai-layer`}>
                        <path
                          d={`M ${cx - radius} ${cy - radius * 0.18} C ${cx - radius * 0.2} ${cy - radius} ${cx + radius * 0.78} ${cy - radius * 0.34} ${cx + radius} ${cy + radius * 0.5}`}
                          fill="none"
                          stroke={index === 0 ? 'rgba(168,85,247,0.78)' : 'rgba(99,102,241,0.52)'}
                          strokeWidth={index === 0 ? 0.52 : 0.34}
                          strokeDasharray="1.2 1.3"
                        />
                        <circle cx={cx + radius * 0.9} cy={cy + radius * 0.48} r="0.72" fill="rgba(168,85,247,0.92)" />
                      </g>
                    );
                  })}
              </g>
            ) : null}
            <g opacity="0.34" transform="translate(0 1.35)">
              {aggregate.zones.map((metric) => (
                <path
                  key={`${metric.zone.id}-extrusion`}
                  d={territoryPolygonToPath(metric.zone.polygon)}
                  fill="rgba(15,23,42,0.34)"
                  stroke="rgba(15,23,42,0.08)"
                  strokeWidth="0.2"
                />
              ))}
            </g>
            {aggregate.zones.map((metric) => {
              const selected = selectedZone.zone.id === metric.zone.id;
              const [cx, cy] = territoryCentroid(metric.zone.polygon);
              return (
                <g
                  key={metric.zone.id}
                  style={{
                    transform: selected ? 'translateY(-0.65px)' : undefined,
                    transformOrigin: `${cx}px ${cy}px`,
                    transition: shouldReduceMotion ? undefined : 'transform 220ms ease, filter 220ms ease',
                  }}
                >
                  <path
                    d={territoryPolygonToPath(metric.zone.polygon)}
                    fill={
                      showHeatLayer || focusMode === 'territory'
                        ? fillForIntensity(metric, selected)
                        : metric.records
                          ? 'rgba(148, 163, 184, 0.2)'
                          : 'rgba(148, 163, 184, 0.08)'
                    }
                    stroke={strokeForIntensity(metric, selected)}
                    strokeWidth={selected ? 0.72 : 0.38}
                    filter={selected ? `url(#${svgId}-selected-glow)` : `url(#${svgId}-zone-shadow)`}
                    tabIndex={0}
                    role="button"
                    aria-label={`${metric.zone.label}: ${metric.suppressed ? 'muestra insuficiente' : `${formatNumber(metric.total)} eventos`}`}
                    className="cursor-pointer outline-none transition duration-200 hover:brightness-110 focus-visible:brightness-125"
                    onMouseEnter={() => setSelectedZoneId(metric.zone.id)}
                    onFocus={() => setSelectedZoneId(metric.zone.id)}
                    onClick={() => setSelectedZoneId(metric.zone.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedZoneId(metric.zone.id);
                      }
                    }}
                  >
                    <title>{metric.zone.label}</title>
                  </path>
                  <path
                    d={territoryPolygonToPath(metric.zone.polygon)}
                    fill={`url(#${svgId}-surface-shine)`}
                    opacity={selected ? 0.38 : focusMode === 'quality' ? 0.25 : 0.16}
                    className="pointer-events-none"
                  />
                  {showQualityLayer || focusMode === 'quality' ? (
                    <path
                      d={territoryPolygonToPath(metric.zone.polygon)}
                      fill="none"
                      stroke={
                        !metric.records
                          ? 'rgba(148,163,184,0.34)'
                          : metric.suppressed
                            ? 'rgba(248,113,113,0.58)'
                            : metric.confidence === 'high'
                              ? 'rgba(34,197,94,0.62)'
                              : 'rgba(245,158,11,0.62)'
                      }
                      strokeWidth={selected ? 0.56 : 0.28}
                      strokeDasharray={metric.suppressed || !metric.records ? '0.9 0.8' : undefined}
                      className="pointer-events-none"
                    />
                  ) : null}
                  {metric.records ? (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={selected ? 1.45 : 1.05}
                      fill={metric.suppressed ? 'rgba(148, 163, 184, 0.95)' : 'rgba(255, 255, 255, 0.96)'}
                      stroke={strokeForIntensity(metric, selected)}
                      strokeWidth="0.35"
                    >
                      {!shouldReduceMotion && selected ? (
                        <animate attributeName="r" values="1.25;1.85;1.25" dur="1.8s" repeatCount="indefinite" />
                      ) : null}
                    </circle>
                  ) : null}
                  <text
                    x={cx}
                    y={cy + 4.6}
                    textAnchor="middle"
                    className="pointer-events-none fill-slate-950 text-[2.5px] font-semibold dark:fill-white"
                  >
                    {metric.zone.label}
                  </text>
                </g>
              );
            })}
            <g data-testid="territory-selected-crosshair" aria-hidden="true" transform={`translate(${selectedCx} ${selectedCy})`} className="pointer-events-none">
              <circle r="4.8" fill="none" stroke="rgba(255,255,255,0.58)" strokeWidth="0.24" strokeDasharray="0.9 0.8">
                {!shouldReduceMotion ? <animate attributeName="r" values="4.2;6.4;4.2" dur="3.2s" repeatCount="indefinite" /> : null}
              </circle>
              <circle r="1.9" fill="none" stroke="rgba(34,211,238,0.82)" strokeWidth="0.22" />
              <line x1="-7" x2="-2.4" y1="0" y2="0" stroke="rgba(255,255,255,0.62)" strokeWidth="0.18" />
              <line x1="2.4" x2="7" y1="0" y2="0" stroke="rgba(255,255,255,0.62)" strokeWidth="0.18" />
              <line x1="0" x2="0" y1="-7" y2="-2.4" stroke="rgba(255,255,255,0.62)" strokeWidth="0.18" />
              <line x1="0" x2="0" y1="2.4" y2="7" stroke="rgba(255,255,255,0.62)" strokeWidth="0.18" />
            </g>
            {!shouldReduceMotion ? (
              <rect
                x="-22"
                y="0"
                width="16"
                height="68"
                fill={`url(#${svgId}-scan)`}
                opacity="0.22"
                transform="skewX(-16)"
              >
                <animate attributeName="x" values="-24;112" dur="8.5s" repeatCount="indefinite" />
              </rect>
            ) : null}
            {showQualityLayer || focusMode === 'quality' ? (
              <g aria-hidden="true">
                <circle cx="84" cy="12" r="5.6" fill="rgba(15,23,42,0.1)" stroke="rgba(148,163,184,0.28)" strokeWidth="0.6" />
                <circle
                  cx="84"
                  cy="12"
                  r="5.6"
                  fill="none"
                  stroke={readiness.state === 'ready' ? 'rgba(34,197,94,0.86)' : 'rgba(245,158,11,0.86)'}
                  strokeWidth="1"
                  strokeLinecap="round"
                  pathLength="100"
                  strokeDasharray={coverageArc(readiness.coveragePercent)}
                  transform="rotate(-90 84 12)"
                />
                <text x="84" y="12.8" textAnchor="middle" className="fill-slate-950 text-[2.8px] font-semibold dark:fill-white">
                  {readiness.coveragePercent !== undefined ? Math.round(readiness.coveragePercent) : 0}%
                </text>
                {geocodingCandidates.map((candidate, index) => {
                  const x = 12 + index * 4.2;
                  const y = 58 - index * 1.6;
                  const key = String(candidate.record_id ?? candidate.ticket_id ?? candidate.address ?? index);
                  return (
                    <g key={`${key}-geocode-dot`}>
                      <circle cx={x} cy={y} r="1.15" fill="rgba(245,158,11,0.92)" stroke="rgba(255,255,255,0.8)" strokeWidth="0.32" />
                      <path d={`M ${x} ${y + 1.2} L ${x - 0.9} ${y + 3.2} L ${x + 0.9} ${y + 3.2} Z`} fill="rgba(245,158,11,0.4)" />
                    </g>
                  );
                })}
              </g>
            ) : null}
            {showRealtimeLayer || focusMode === 'telemetry' ? (
              <g aria-hidden="true" opacity="0.72">
                <ellipse
                  cx="50"
                  cy="35"
                  rx="45"
                  ry="31"
                  fill="none"
                  stroke="rgba(6,182,212,0.54)"
                  strokeWidth="0.24"
                  strokeDasharray="2 2.8"
                >
                  {!shouldReduceMotion ? (
                    <animate attributeName="stroke-dashoffset" values="0;-18" dur="4.6s" repeatCount="indefinite" />
                  ) : null}
                </ellipse>
                <path
                  d="M11 38 C28 26 41 48 57 33 C70 20 82 30 90 21"
                  fill="none"
                  stroke="rgba(34,211,238,0.46)"
                  strokeWidth="0.42"
                  strokeLinecap="round"
                />
              </g>
            ) : null}
          </svg>
          )}

          <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div className={cn('pointer-events-auto max-w-md rounded-lg border px-3 py-2 shadow-sm backdrop-blur', readinessToneClass[readiness.state])}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {readiness.state === 'ready' ? <CheckCircle2 className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                <span>{readiness.label}</span>
              </div>
              {hasLowQualityOverlay ? (
                <p className="mt-1 text-xs leading-5 text-current/80">
                  {readinessCopy(readiness.state, labels)}
                  {emptyStateBehavior ? ` ${emptyStateBehavior}.` : ''}
                </p>
              ) : null}
              {activeAction ? (
                <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-md border border-current/20 bg-background/50 px-2 py-1 text-xs">
                  <DatabaseZap className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{activeAction.label}</span>
                  {activeAction.detail ? <span className="hidden text-current/70 sm:inline">{activeAction.detail}</span> : null}
                </div>
              ) : null}
            </div>
            <div className="pointer-events-auto flex flex-wrap gap-2 lg:max-w-[360px] lg:justify-end">
              <Badge variant="outline" className="gap-1 bg-background/80 backdrop-blur">
                <MapPin className="h-3.5 w-3.5" />
                {formatNumber(visiblePointCount)} visibles
              </Badge>
              {geocodingStatus ? (
                <Badge variant="outline" className="gap-1 bg-background/80 capitalize backdrop-blur">
                  <DatabaseZap className="h-3.5 w-3.5" />
                  {humanizeContractValue(geocodingStatus, geocodingStatus)}
                </Badge>
              ) : null}
              {latestRealtime ? (
                <Badge variant="outline" className="gap-1 bg-background/80 backdrop-blur">
                  <Activity className="h-3.5 w-3.5" />
                  {latestRealtime}
                </Badge>
              ) : null}
            </div>
          </div>

          <div
            data-testid="territory-live-legend"
            className="absolute bottom-3 left-3 right-3 z-20 rounded-lg border border-border/80 bg-background/95 p-3 shadow-sm backdrop-blur xl:pr-32"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {liveLegendCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.label} className="min-w-0 rounded-lg border border-border/60 bg-muted/25 px-2.5 py-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                        <span className="truncate">{card.label}</span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">{card.value}</p>
                      <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">{card.detail}</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex shrink-0 flex-col gap-2 xl:max-w-[280px]">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {visibleLegendItems.map((item) => (
                    <span key={`${item.label}-${item.color}`} className="inline-flex max-w-[12rem] items-center gap-1">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                  ))}
                </div>
                {visibleLegendItems.some((item) => item.detail) ? (
                  <p className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                    {visibleLegendItems
                      .filter((item) => item.detail)
                      .map((item) => `${item.label}: ${item.detail}`)
                      .join(' - ')}
                  </p>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant={comparisonEnabled ? 'default' : 'outline'}
              className="mt-3 w-full justify-center gap-2 rounded-lg xl:absolute xl:right-3 xl:top-3 xl:mt-0 xl:w-auto"
              onClick={() => setComparisonEnabled((value) => !value)}
            >
              <TrendingUp className="h-4 w-4" />
              Comparar
            </Button>
          </div>
        </div>

        <aside className="space-y-4 2xl:sticky 2xl:top-24 2xl:self-start">
          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Estado del mapa</p>
                <h4 className="mt-1 text-lg font-semibold">{readiness.label}</h4>
              </div>
              <Badge variant={badgeVariantForReadiness(readiness.state)}>{confidenceLabel(aggregate.confidence)}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Gauge className="h-3.5 w-3.5" />
                  Cobertura
                </div>
                <p className="mt-1 text-lg font-semibold">{formatPercent(readiness.coveragePercent)}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <DatabaseZap className="h-3.5 w-3.5" />
                  Geocoding
                </div>
                <p className="mt-1 text-lg font-semibold">{formatNumber(readiness.pendingGeocode, '0')}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Radar className="h-3.5 w-3.5" />
                  Alertas
                </div>
                <p className="mt-1 text-lg font-semibold">{formatNumber(aggregate.alerts)}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" />
                  Polling
                </div>
                <p className="mt-1 text-lg font-semibold">{heatmap?.realtime?.poll_seconds ? `${formatNumber(heatmap.realtime.poll_seconds)}s` : '--'}</p>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{readinessCopy(readiness.state, labels)}</p>
            {realtimeSources.length || realtimeEvents.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {[...realtimeSources, ...realtimeEvents].slice(0, 4).map((item) => (
                  <Badge key={item} variant="outline" className="capitalize">
                    {humanizeContractValue(item, item)}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          {hasBackendMapContract ? (
            <div data-testid="backend-map-contract-card" className="rounded-xl border border-cyan-500/20 bg-[linear-gradient(135deg,rgba(8,47,73,0.08),hsl(var(--background)),rgba(124,58,237,0.07))] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Mapa operativo</p>
                  <h4 className="mt-1 truncate text-lg font-semibold">{backendRenderer}</h4>
                </div>
                <Badge variant="outline" className="shrink-0 gap-1">
                  <Radar className="h-3.5 w-3.5" />
                  {backendRadarEnabled ? 'radar activo' : 'capa estatica'}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg border bg-background/65 p-3">
                  <p className="text-xs text-muted-foreground">Casos</p>
                  <p className="mt-1 text-lg font-semibold">{formatNumber(backendTotalCases)}</p>
                </div>
                <div className="rounded-lg border bg-background/65 p-3">
                  <p className="text-xs text-muted-foreground">Hotspots criticos</p>
                  <p className="mt-1 text-lg font-semibold">{formatNumber(backendCriticalHotspots, '0')}</p>
                </div>
              </div>
              {backendTopCategory ? (
                <div className="mt-3 rounded-lg border bg-background/65 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Foco principal</p>
                      <p className="mt-1 truncate text-sm font-medium">{humanizeContractValue(backendTopCategory, backendTopCategory)}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 capitalize">
                      {backendFocusRiskLabel}
                    </Badge>
                  </div>
                  {backendFocusCount !== undefined ? (
                    <p className="mt-2 text-xs text-muted-foreground">{formatNumber(backendFocusCount)} casos agrupados en el foco operativo.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {operationalHotspots.length ? (
            <div
              data-testid="operational-hotspots-panel"
              className="rounded-xl border border-amber-500/25 bg-[linear-gradient(135deg,rgba(245,158,11,0.10),hsl(var(--background)),rgba(59,130,246,0.07))] p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">
                    Hotspots operativos
                  </p>
                  <h4 className="mt-1 text-lg font-semibold leading-tight">Zonas para actuar primero</h4>
                </div>
                <Badge variant="outline" className="shrink-0 gap-1">
                  <Radar className="h-3.5 w-3.5" />
                  {formatNumber(operationalHotspotCount, '0')}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-lg border bg-background/70 p-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">SLA</p>
                  <p className="mt-1 text-base font-semibold">{formatNumber(readNumber(topOperationalSignals?.breached_sla), '0')}</p>
                </div>
                <div className="rounded-lg border bg-background/70 p-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Sin resp.</p>
                  <p className="mt-1 text-base font-semibold">{formatNumber(readNumber(topOperationalSignals?.unassigned), '0')}</p>
                </div>
                <div className="rounded-lg border bg-background/70 p-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">24h</p>
                  <p className="mt-1 text-base font-semibold">{formatNumber(readNumber(topOperationalSignals?.recent_24h), '0')}</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {operationalHotspots.slice(0, 3).map((hotspot, index) => {
                  const signals = asRecord(hotspot.signals);
                  const category = humanizeContractValue(readString(hotspot.top_category, hotspot.key, hotspot.label), 'sin categoria');
                  const channel = humanizeContractValue(readString(hotspot.top_channel), 'sin canal');
                  const signalChips = [
                    { label: 'SLA', value: readNumber(signals?.breached_sla) },
                    { label: 'sin responsable', value: readNumber(signals?.unassigned) },
                    { label: '24h', value: readNumber(signals?.recent_24h) },
                    { label: 'tickets', value: readNumber(signals?.tickets) },
                  ].filter((chip) => (chip.value ?? 0) > 0);
                  return (
                    <div
                      key={hotspot.id ?? `${category}-${index}`}
                      data-testid="operational-hotspot-item"
                      className="rounded-lg border bg-background/75 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                              {index + 1}
                            </span>
                            <p className="truncate text-sm font-semibold">{category}</p>
                          </div>
                          <div className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {channel} - {hotspot.id}
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          {formatNumber(readNumber(hotspot.operational_score), '0')}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {operationalRankLabel(readString(hotspot.rank_reason))}
                        </Badge>
                        {signalChips.map((chip) => (
                          <Badge key={chip.label} variant="secondary" className="text-[10px]">
                            {chip.label}: {formatNumber(chip.value, '0')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Brain className="h-4 w-4 text-primary" />
              Capas del contrato
            </div>
            <div className="mt-3 space-y-2">
              {displayLayers.slice(0, 5).map((layer) => (
                <div key={`${layer.id}-summary`} className="rounded-lg border bg-muted/20 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{layer.label}</span>
                    <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full border', layerToneClass[layer.tone])} />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{layer.description}</p>
                </div>
              ))}
            </div>
          </div>

          {hasOperationalBrief ? (
            <div className="rounded-xl border border-primary/15 bg-[linear-gradient(135deg,hsl(var(--background)),rgba(59,130,246,0.08),rgba(20,184,166,0.06))] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Brief operativo IA
                  </div>
                  <h4 className="mt-2 text-base font-semibold leading-snug">
                    {narrativeTitle || 'Mapa territorial accionable'}
                  </h4>
                  {narrativeBody ? (
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{narrativeBody}</p>
                  ) : null}
                </div>
                <Badge variant={aiStatus?.requires_human_attention ? 'secondary' : 'outline'} className="shrink-0 capitalize">
                  {aiStatusLabel}
                </Badge>
              </div>

              <div className="mt-4 grid gap-2">
                <div className="rounded-lg border bg-background/65 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <Brain className="h-3.5 w-3.5" />
                    Motor cognitivo
                  </div>
                  <p className="mt-1 text-sm font-medium capitalize">{aiModeLabel}</p>
                  {aiHintLabels.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {aiHintLabels.map((hint) => (
                        <Badge key={hint} variant="secondary" className="text-[11px] capitalize">
                          {hint}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>

                {defaultViewport ? (
                  <div className="rounded-lg border bg-background/65 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        <Compass className="h-3.5 w-3.5" />
                        Vista sugerida
                      </div>
                      {defaultViewport.default ? <Badge variant="outline">default</Badge> : null}
                    </div>
                    <p className="mt-1 truncate text-sm font-medium">
                      {defaultViewport.label || defaultViewport.id || 'Foco territorial'}
                    </p>
                    {defaultViewportDetail ? (
                      <p className="mt-1 text-xs text-muted-foreground">{defaultViewportDetail}</p>
                    ) : null}
                  </div>
                ) : null}

                {operationalActionSummaries.length ? (
                  <div data-testid="heatmap-action-loop" className="rounded-lg border bg-background/65 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <ListChecks className="h-3.5 w-3.5" />
                      Proximas acciones
                    </div>
                    <div className="mt-2 space-y-2">
                      {operationalActionSummaries
                        .slice(0, 8)
                        .map((action) => (
                          <div
                            key={`${action.label}-${action.detail ?? action.uiHint ?? ''}`}
                            data-testid="heatmap-action-item"
                            className="rounded-md border border-border/60 bg-muted/25 px-2.5 py-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 text-sm font-medium">{action.label}</p>
                              {action.priority || action.actionType ? (
                                <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                                  {humanizeContractValue(action.priority ?? action.actionType, 'accion')}
                                </Badge>
                              ) : null}
                            </div>
                            {action.detail ? (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">{action.detail}</p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {action.uiHint ? (
                                <Badge variant="secondary" className="text-[10px] capitalize">
                                  {humanizeContractValue(action.uiHint, action.uiHint)}
                                </Badge>
                              ) : null}
                              <Badge variant={action.writesEnabled ? 'outline' : 'secondary'} className="text-[10px]">
                                {action.writesEnabled ? 'requiere confirmacion' : 'preparacion segura'}
                              </Badge>
                              {action.href ? (
                                <a
                                  href={action.href}
                                  className="inline-flex rounded-full border border-primary/30 px-2 py-0.5 text-[10px] font-semibold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                                >
                                  Abrir en CRM
                                </a>
                              ) : null}
                            </div>
                          </div>
                        ))}
                    </div>
                    {heatmap?.hotspot_actions ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {heatmap.hotspot_actions.safe_by_default ? 'Safe by default' : 'Revisar permisos'} -{' '}
                        {heatmap.hotspot_actions.writes_enabled ? 'acciones con escritura' : 'solo preparacion operativa'}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Zona seleccionada</p>
                <h4 className="mt-1 text-xl font-semibold">{selectedZone.zone.label}</h4>
              </div>
              <Badge variant={selectedZone.suppressed ? 'secondary' : 'outline'}>
                {selectedZone.suppressed ? 'muestra insuficiente' : confidenceLabel(selectedZone.confidence)}
              </Badge>
            </div>

            {selectedZone.suppressed ? (
              <div className="mt-4 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                Muestra insuficiente. Se ocultan totales y categorias para evitar reidentificacion por segmentos.
              </div>
            ) : (
              <div className="mt-4">
                <MetricLine label="Eventos ponderados" value={formatNumber(selectedZone.total)} />
                <MetricLine label="Registros agregados" value={formatNumber(selectedZone.records)} />
                <MetricLine
                  label="Tasa cada 1.000"
                  value={formatNumber(selectedZone.ratePerThousand, 'sin poblacion')}
                />
                <MetricLine label="Variacion" value={formatVariation(selectedZone.variationPercent)} />
              </div>
            )}

            <div className="mt-4 rounded-lg bg-muted/35 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Eye className="h-4 w-4 text-primary" />
                Recomendacion operativa
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{selectedZone.recommendation}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-primary" />
              Hotspots por zona
            </div>
            <div className="mt-3 space-y-3">
              {topZones.length ? (
                topZones.map((metric) => (
                  <button
                    key={metric.zone.id}
                    type="button"
                    className="w-full rounded-lg border border-border/70 p-3 text-left transition hover:border-primary/60 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    onClick={() => setSelectedZoneId(metric.zone.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{metric.zone.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {metric.suppressed ? 'muestra insuficiente' : formatNumber(metric.total)}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 via-teal-400 to-amber-400"
                        style={{ width: `${Math.max(8, metric.intensity * 100)}%` }}
                      />
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Sin zonas activas para los filtros actuales.</p>
              )}
            </div>
          </div>

          {aggregate.topCategories.length ? (
            <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
              <p className="text-sm font-semibold">Categorias dominantes</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {aggregate.topCategories.map((category) => (
                  <Badge key={category.key} variant="secondary">
                    {category.label}: {formatNumber(category.total)}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
