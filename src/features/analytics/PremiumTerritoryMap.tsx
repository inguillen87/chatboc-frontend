import { useMemo, useState } from 'react';
import { AlertTriangle, Eye, Layers, MapPin, ShieldCheck, TrendingUp } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { OperationsHeatmapPoint, OperationsHeatmapV1, PublicMapConfigV1 } from './analyticsTypes';
import {
  aggregateTerritoryHeatmap,
  DEFAULT_TERRITORY_ZONES,
  getDemoTerritoryHeatmapPoints,
  PREMIUM_HEATMAP_MIN_SAMPLE_SIZE,
  territoryCentroid,
  territoryPolygonToPath,
  type TerritoryZoneMetric,
} from './premiumTerritoryHeatmap';

type DemoProfile = 'gobierno' | 'empresa' | 'colegio' | 'general';

type ActiveFilterSummary = {
  key: string;
  label: string;
  value: string;
  onClear?: () => void;
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
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [comparisonEnabled, setComparisonEnabled] = useState(false);

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

  const selectedZone =
    aggregate.zones.find((metric) => metric.zone.id === selectedZoneId) ??
    aggregate.zones.find((metric) => metric.records > 0 && !metric.suppressed) ??
    aggregate.zones[0];

  const topZones = aggregate.zones
    .filter((metric) => metric.records > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);

  const title = labelFor(labels, 'premium_heatmap_title', 'Inteligencia territorial');
  const description = labelFor(
    labels,
    'premium_heatmap_description',
    'Volumen, demanda y riesgo por zona con privacidad por muestra minima.',
  );
  const hasWarning = Boolean(mapConfig?.style_url_warning);

  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Layers className="h-3.5 w-3.5" />
              {usesDemoData ? 'modo demo local' : heatmap?.contract_version ?? 'operations.heatmap.v1'}
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
        <div className="grid grid-cols-3 gap-2 text-right sm:min-w-[360px]">
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Eventos</p>
            <p className="text-lg font-semibold">{formatNumber(aggregate.totalEvents)}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Zonas</p>
            <p className="text-lg font-semibold">{formatNumber(aggregate.activeZones)}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Confianza</p>
            <p className="text-lg font-semibold">{confidenceLabel(aggregate.confidence)}</p>
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

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative min-h-[430px] overflow-hidden rounded-xl border border-border bg-background">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.16),transparent_30%),radial-gradient(circle_at_78%_32%,rgba(20,184,166,0.14),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.04),rgba(15,23,42,0))]" />
          <svg
            role="img"
            aria-label={title}
            viewBox="0 0 100 68"
            className="relative z-10 h-[430px] w-full touch-pan-y select-none sm:h-[520px]"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <radialGradient id="territory-hotspot" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(96, 165, 250, 0.75)" />
                <stop offset="48%" stopColor="rgba(45, 212, 191, 0.22)" />
                <stop offset="100%" stopColor="rgba(45, 212, 191, 0)" />
              </radialGradient>
              <pattern id="territory-grid" width="6" height="6" patternUnits="userSpaceOnUse">
                <path d="M 6 0 L 0 0 0 6" fill="none" stroke="rgba(148, 163, 184, 0.16)" strokeWidth="0.18" />
              </pattern>
            </defs>
            <rect width="100" height="68" fill="url(#territory-grid)" />
            {aggregate.zones.map((metric) => {
              const [cx, cy] = territoryCentroid(metric.zone.polygon);
              if (!metric.records || metric.suppressed) return null;
              const radius = 5 + metric.intensity * 13;
              return (
                <circle
                  key={`${metric.zone.id}-halo`}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="url(#territory-hotspot)"
                  opacity={comparisonEnabled ? 0.34 : 0.58}
                />
              );
            })}
            {aggregate.zones.map((metric) => {
              const selected = selectedZone.zone.id === metric.zone.id;
              const [cx, cy] = territoryCentroid(metric.zone.polygon);
              return (
                <g key={metric.zone.id}>
                  <path
                    d={territoryPolygonToPath(metric.zone.polygon)}
                    fill={fillForIntensity(metric, selected)}
                    stroke={strokeForIntensity(metric, selected)}
                    strokeWidth={selected ? 0.72 : 0.38}
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
                  {metric.records ? (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={selected ? 1.45 : 1.05}
                      fill={metric.suppressed ? 'rgba(148, 163, 184, 0.95)' : 'rgba(255, 255, 255, 0.96)'}
                      stroke={strokeForIntensity(metric, selected)}
                      strokeWidth="0.35"
                    />
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
          </svg>

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
              <p className="flex items-center gap-2 text-sm font-medium">
                <Eye className="h-4 w-4 text-primary" />
                Recomendacion operativa
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{selectedZone.recommendation}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="h-4 w-4 text-primary" />
              Hotspots por zona
            </p>
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
