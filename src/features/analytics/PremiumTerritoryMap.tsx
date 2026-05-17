import { useId, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
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
  const svgId = useId().replace(/:/g, '');
  const shouldReduceMotion = useReducedMotion();
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
  const animatedZones = topZones.slice(0, 3);

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
        <div
          className="relative min-h-[450px] overflow-hidden rounded-xl border border-border bg-[linear-gradient(145deg,hsl(var(--background)),rgba(15,23,42,0.045))] shadow-[0_24px_80px_rgba(15,23,42,0.16)]"
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
            </defs>
            <rect width="100" height="68" fill={`url(#${svgId}-territory-grid)`} />
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
              if (!metric.records || metric.suppressed) return null;
              const radius = 5 + metric.intensity * 13;
              return (
                <circle
                  key={`${metric.zone.id}-halo`}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill={`url(#${svgId}-territory-hotspot)`}
                  opacity={comparisonEnabled ? 0.34 : 0.58}
                >
                  {!shouldReduceMotion ? (
                    <animate attributeName="opacity" values="0.28;0.62;0.34" dur="4.8s" repeatCount="indefinite" />
                  ) : null}
                </circle>
              );
            })}
            <g opacity="0.38">
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
                    fill={fillForIntensity(metric, selected)}
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
                    opacity={selected ? 0.34 : 0.18}
                    className="pointer-events-none"
                  />
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
