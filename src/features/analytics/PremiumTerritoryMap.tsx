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
import { cn } from '@/lib/utils';

import type { OperationsHeatmapPoint, OperationsHeatmapV1, PublicMapConfigV1 } from './analyticsTypes';
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
};

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

const formatPercent = (value: number | undefined) =>
  value === undefined || Number.isNaN(value) ? '--' : `${numberFormatter.format(value)}%`;

const humanizeContractValue = (value: string | undefined, fallback: string) =>
  value ? value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() : fallback;

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

const summarizeBackendAction = (action: unknown): BackendActionSummary | undefined => {
  const record = asRecord(action);
  if (!record) return undefined;
  const label = readString(record.title, record.label, record.name);
  const method = readString(record.method);
  const endpoint = readString(record.endpoint, record.endpoint_template);
  const detail = [method, endpoint].filter(Boolean).join(' ');
  if (!label && !detail) return undefined;
  return {
    label: label ?? 'Accion disponible',
    detail: detail || readString(record.description, record.reason_code),
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

const layerIsEnabled = (enabledLayerIds: string[], fragments: string[]) =>
  enabledLayerIds.some((layerId) => fragments.some((fragment) => layerId.includes(fragment)));

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

  const usesDemoData = allowDemoFallback && points.length === 0;
  const sourcePoints = useMemo(
    () => (usesDemoData ? getDemoTerritoryHeatmapPoints(demoProfile) : points),
    [demoProfile, points, usesDemoData],
  );

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
  const hotspotActionSummaries = uniqueActionSummaries([
    ...(heatmap?.hotspot_actions?.actions ?? []),
    ...(heatmap?.hotspot_actions?.playbook ?? []),
    ...(heatmap?.hotspot_playbook ?? []),
    ...(heatmap?.operator_playbook ?? []),
  ]).slice(0, 4);
  const hasOperationalBrief = Boolean(
    narrativeTitle ||
      narrativeBody ||
      narrativeAction ||
      viewportPresets.length ||
      hotspotActionSummaries.length ||
      aiStatus ||
      heatmap?.ai_layers,
  );
  const showHeatLayer = layerIsEnabled(enabledLayerIds, ['heat', 'hotspot', 'base']) || !displayLayers.length;
  const showAiLayer = layerIsEnabled(enabledLayerIds, ['ai', 'risk', 'prior']);
  const showQualityLayer = layerIsEnabled(enabledLayerIds, ['quality', 'coverage', 'geo']);
  const showRealtimeLayer = layerIsEnabled(enabledLayerIds, ['realtime', 'live', 'whatsapp', 'socket']);
  const hasLowQualityOverlay = readiness.state === 'empty' || readiness.state === 'low' || readiness.state === 'degraded';
  const visiblePointCount = readiness.visiblePoints ?? aggregate.totalRecords;
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
              {usesDemoData ? 'modo demo local' : heatmap?.contract_version ?? 'operations.heatmap.v1'}
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

          <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-col gap-2 rounded-lg border border-border/80 bg-background/90 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                bajo
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
                medio
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                alto
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                muestra insuficiente
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant={comparisonEnabled ? 'default' : 'outline'}
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

                {narrativeAction || hotspotActionSummaries.length ? (
                  <div className="rounded-lg border bg-background/65 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <ListChecks className="h-3.5 w-3.5" />
                      Acciones seguras
                    </div>
                    <div className="mt-2 space-y-2">
                      {[narrativeAction, ...hotspotActionSummaries]
                        .filter(Boolean)
                        .slice(0, 4)
                        .map((action) => (
                          <div
                            key={`${action?.label}-${action?.detail ?? ''}`}
                            className="rounded-md border border-border/60 bg-muted/25 px-2.5 py-2"
                          >
                            <p className="text-sm font-medium">{action?.label}</p>
                            {action?.detail ? (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">{action.detail}</p>
                            ) : null}
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
