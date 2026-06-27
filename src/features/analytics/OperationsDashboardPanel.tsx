import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  CheckCircle2,
  DatabaseZap,
  Gauge,
  Layers,
  MapPin,
  RefreshCw,
  Ticket,
  Users,
} from 'lucide-react';

import { ViewState } from '@/components/app-shell/ViewState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/context/TenantContext';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/api';
import { safeLocalStorage } from '@/utils/safeLocalStorage';

import {
  getOperationsAIBriefV2,
  getOperationsActionCenterV2,
  getOperationsDashboardV2,
  getOperationsFreshnessV2,
  getOperationsHeatmapV2,
  getPublicMapConfigV1,
} from './analyticsApi';
import { PremiumTerritoryHeatmap } from './PremiumTerritoryMap';
import type {
  OperationsActionItem,
  OperationsAIBriefV1,
  OperationsAlert,
  OperationsBucketItem,
  OperationsDashboardV1,
  OperationsFreshnessSource,
  OperationsFreshnessV1,
  OperationsHeatmapPoint,
  OperationsHeatmapV1,
  PublicMapConfigV1,
} from './analyticsTypes';

const numberFormatter = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const asString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const readStoredTenantSlug = () =>
  asString(safeLocalStorage.getItem('tenantSlug')) ??
  asString(safeLocalStorage.getItem('tenant_slug')) ??
  asString(safeLocalStorage.getItem('currentTenantSlug'));

const formatNumber = (value: unknown, suffix = '') => {
  const parsed = asNumber(value);
  if (parsed === undefined) return '--';
  return `${numberFormatter.format(parsed)}${suffix}`;
};

const readNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = asNumber(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
};

const itemValue = (item: OperationsBucketItem) =>
  readNumber(item.value, item.count, item.total, item.current);

const itemLabel = (item: OperationsBucketItem) =>
  asString(item.label) ?? asString(item.title) ?? asString(item.key) ?? asString(item.id) ?? '--';

const bucketItemKey = (item: OperationsBucketItem, index: number) =>
  [
    asString(item.id),
    asString(item.key),
    asString(item.label),
    asString(item.title),
    asString((item as Record<string, unknown>).categoria),
    asString((item as Record<string, unknown>).category),
    asString((item as Record<string, unknown>).coordinates),
    asString((item as Record<string, unknown>).lat),
    asString((item as Record<string, unknown>).lng),
    String(index),
  ]
    .filter(Boolean)
    .join(':');

const hasItems = (items?: OperationsBucketItem[]) => Array.isArray(items) && items.length > 0;

const mergeByIdentity = <T extends { id?: string; title?: string; reason_code?: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item, index) => {
    const identity = item.id || item.reason_code || item.title || String(index);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

const priorityVariant = (priority?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const normalized = (priority || '').toLowerCase();
  if (normalized === 'high' || normalized === 'critical' || normalized === 'breached') return 'destructive';
  if (normalized === 'medium' || normalized === 'warning') return 'secondary';
  return 'outline';
};

const statusVariant = (status?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'fresh' || normalized === 'ready') return 'default';
  if (normalized === 'degraded' || normalized === 'stale') return 'secondary';
  if (normalized === 'empty' || normalized === 'error') return 'destructive';
  return 'outline';
};

const statusLabel = (status?: string) => {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'fresh' || normalized === 'ready') return 'al dia';
  if (normalized === 'degraded' || normalized === 'stale') return 'requiere revision';
  if (normalized === 'empty') return 'sin actividad';
  if (normalized === 'error') return 'con error';
  return status || 'sin estado';
};

const priorityLabel = (priority?: string) => {
  const normalized = (priority || '').toLowerCase();
  if (normalized === 'critical') return 'critico';
  if (normalized === 'high') return 'alta';
  if (normalized === 'medium' || normalized === 'warning') return 'media';
  if (normalized === 'low') return 'baja';
  return priority || 'prioridad';
};

const resolveLabel = (data: OperationsDashboardV1 | undefined, key: string, fallback: string) => {
  const labels = data?.frontend_contract?.labels;
  const backendLabel = labels && typeof labels[key] === 'string' ? labels[key].trim() : '';
  return backendLabel || fallback;
};

const getRefreshSeconds = (...values: Array<number | undefined>) => {
  const parsed = values.find((value) => typeof value === 'number' && Number.isFinite(value) && value > 0);
  if (!parsed) return undefined;
  return parsed;
};

type OperationsFocusCard = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'default' | 'warning' | 'success';
};

const focusCardToneClass: Record<OperationsFocusCard['tone'], string> = {
  default: 'border-primary/20 bg-primary/5 text-primary',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
};

type HeatmapFilterKey = 'categoria' | 'rango_edad' | 'genero' | 'canal' | 'source' | 'barrio' | 'estado' | 'distrito';
type HeatmapQueryKey = HeatmapFilterKey | 'range' | 'scope' | 'days';
type HeatmapFilterState = Partial<Record<HeatmapQueryKey, string>>;

type HeatmapFilterConfig = {
  key: HeatmapFilterKey;
  queryParam: keyof HeatmapFilterState;
  labelKey: string;
  fallbackLabel: string;
  pointFields: string[];
};

type HeatmapFilterOption = {
  value: string;
  label: string;
  count?: number;
};

const HEATMAP_FILTERS: HeatmapFilterConfig[] = [
  {
    key: 'categoria',
    queryParam: 'categoria',
    labelKey: 'filter_categoria',
    fallbackLabel: 'Categoria',
    pointFields: ['categoria', 'category'],
  },
  {
    key: 'rango_edad',
    queryParam: 'rango_edad',
    labelKey: 'filter_rango_edad',
    fallbackLabel: 'Edad',
    pointFields: ['rango_edad', 'age_range', 'ageRange', 'edad', 'age'],
  },
  {
    key: 'genero',
    queryParam: 'genero',
    labelKey: 'filter_genero',
    fallbackLabel: 'Genero',
    pointFields: ['genero', 'gender', 'sexo'],
  },
  {
    key: 'canal',
    queryParam: 'canal',
    labelKey: 'filter_canal',
    fallbackLabel: 'Canal',
    pointFields: ['canal', 'channel'],
  },
  {
    key: 'source',
    queryParam: 'source',
    labelKey: 'filter_source',
    fallbackLabel: 'Fuente',
    pointFields: ['source', 'type', 'layer'],
  },
  {
    key: 'barrio',
    queryParam: 'barrio',
    labelKey: 'filter_barrio',
    fallbackLabel: 'Barrio',
    pointFields: ['barrio', 'neighborhood'],
  },
  {
    key: 'distrito',
    queryParam: 'distrito',
    labelKey: 'filter_distrito',
    fallbackLabel: 'Distrito',
    pointFields: ['distrito', 'district'],
  },
  {
    key: 'estado',
    queryParam: 'estado',
    labelKey: 'filter_estado',
    fallbackLabel: 'Estado',
    pointFields: ['estado', 'status'],
  },
];

const HEATMAP_FILTER_ALIASES: Record<string, HeatmapFilterKey> = {
  category: 'categoria',
  categories: 'categoria',
  categoria: 'categoria',
  categorias: 'categoria',
  age: 'rango_edad',
  edad: 'rango_edad',
  age_range: 'rango_edad',
  agerange: 'rango_edad',
  rango_edad: 'rango_edad',
  gender: 'genero',
  genero: 'genero',
  sexo: 'genero',
  channel: 'canal',
  canal: 'canal',
  source: 'source',
  fuente: 'source',
  layer: 'source',
  type: 'source',
  barrio: 'barrio',
  neighborhood: 'barrio',
  distrito: 'distrito',
  district: 'distrito',
  status: 'estado',
  estado: 'estado',
};

const normalizeHeatmapFilterKey = (value: unknown): HeatmapFilterKey | null => {
  const normalized = asString(value)?.toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return null;
  return HEATMAP_FILTER_ALIASES[normalized] ?? null;
};

const readItemOptionValue = (item: OperationsBucketItem): string | undefined =>
  asString(item.value) ??
  asString(item.key) ??
  asString(item.id) ??
  asString(item.label) ??
  asString(item.title) ??
  asString(item.name);

const readPointField = (point: OperationsHeatmapPoint, config: HeatmapFilterConfig): string | undefined => {
  for (const field of config.pointFields) {
    const value = (point as Record<string, unknown>)[field];
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    const parsed = asString(value);
    if (parsed) return parsed;
  }
  return undefined;
};

const heatmapDisplayLabel = (value: unknown, fallback?: unknown): string => {
  const parsed = asString(value) ?? asString(fallback) ?? '';
  const normalized = parsed.toLowerCase().replace(/[\s-]+/g, '_');
  if (['unknown', 'sin_dato', 'sin_datos', 'no_informado', 'no_informada', 'null', 'undefined'].includes(normalized)) {
    return 'Sin dato';
  }
  return parsed || 'Sin dato';
};

const cleanHeatmapFilters = (filters: HeatmapFilterState): HeatmapFilterState =>
  Object.fromEntries(
    Object.entries(filters)
      .map(([key, value]) => [key, asString(value)] as const)
      .filter(([, value]) => Boolean(value)),
  ) as HeatmapFilterState;

const DEFAULT_HEATMAP_FILTERS: HeatmapFilterState = {
  range: 'all',
  scope: 'historical',
};

const HEATMAP_PERIOD_KEYS = new Set<HeatmapQueryKey>(['range', 'scope', 'days']);

const keepHeatmapPeriodFilters = (filters: HeatmapFilterState): HeatmapFilterState => {
  const next = Object.fromEntries(
    Object.entries(filters).filter(([key]) => HEATMAP_PERIOD_KEYS.has(key as HeatmapQueryKey)),
  ) as HeatmapFilterState;
  return Object.keys(next).length ? next : DEFAULT_HEATMAP_FILTERS;
};

interface OperationsDashboardPanelProps {
  className?: string;
}

export function OperationsDashboardPanel({ className }: OperationsDashboardPanelProps) {
  const { currentSlug } = useTenant();
  const storedTenantSlug = useMemo(() => readStoredTenantSlug(), []);
  const tenantSlug = currentSlug || storedTenantSlug || undefined;
  const [heatmapFilters, setHeatmapFilters] = useState<HeatmapFilterState>(DEFAULT_HEATMAP_FILTERS);
  const activeHeatmapFilters = useMemo(() => cleanHeatmapFilters(heatmapFilters), [heatmapFilters]);

  const dashboardQuery = useQuery({
    queryKey: ['v2-operations-dashboard', tenantSlug],
    queryFn: () => getOperationsDashboardV2({ tenantSlug }),
    retry: 0,
    staleTime: 30_000,
  });

  const heatmapQuery = useQuery({
    queryKey: ['v2-operations-heatmap', tenantSlug, activeHeatmapFilters],
    queryFn: () => getOperationsHeatmapV2({ tenantSlug, ...activeHeatmapFilters }),
    retry: 0,
    staleTime: 30_000,
  });

  const mapConfigQuery = useQuery({
    queryKey: ['public-map-config-v1', tenantSlug],
    queryFn: () => getPublicMapConfigV1({ tenantSlug }),
    retry: 0,
    staleTime: 10 * 60_000,
  });

  const actionCenterQuery = useQuery({
    queryKey: ['v2-operations-action-center', tenantSlug],
    queryFn: () => getOperationsActionCenterV2({ tenantSlug }),
    retry: 0,
    staleTime: 30_000,
  });
  const aiBriefQuery = useQuery({
    queryKey: ['v2-operations-ai-brief', tenantSlug],
    queryFn: () => getOperationsAIBriefV2({ tenantSlug }),
    retry: 0,
    staleTime: 30_000,
  });
  const freshnessQuery = useQuery({
    queryKey: ['v2-operations-freshness', tenantSlug],
    queryFn: () => getOperationsFreshnessV2({ tenantSlug }),
    retry: 0,
    staleTime: 30_000,
  });
  const refetchDashboard = dashboardQuery.refetch;
  const refetchHeatmap = heatmapQuery.refetch;
  const refetchActionCenter = actionCenterQuery.refetch;
  const refetchAIBrief = aiBriefQuery.refetch;
  const refetchFreshness = freshnessQuery.refetch;

  const refreshSeconds = getRefreshSeconds(
    dashboardQuery.data?.frontend_contract?.primary_refresh_seconds,
    actionCenterQuery.data?.frontend_contract?.primary_refresh_seconds,
    aiBriefQuery.data?.frontend_contract?.primary_refresh_seconds,
    freshnessQuery.data?.frontend_contract?.primary_refresh_seconds,
  );

  useEffect(() => {
    if (!refreshSeconds) return undefined;
    const timer = window.setInterval(() => {
      void refetchDashboard();
      void refetchHeatmap();
      void refetchActionCenter();
      void refetchAIBrief();
      void refetchFreshness();
    }, refreshSeconds * 1000);

    return () => window.clearInterval(timer);
  }, [refetchAIBrief, refetchActionCenter, refetchDashboard, refetchFreshness, refetchHeatmap, refreshSeconds]);

  const data = dashboardQuery.data;
  const actionCenter = actionCenterQuery.data;
  const aiBrief = aiBriefQuery.data ?? (data?.ai_brief as OperationsAIBriefV1 | undefined);
  const freshness = freshnessQuery.data;
  const alerts = useMemo(
    () => mergeByIdentity([...(data?.alerts ?? []), ...(actionCenter?.alerts ?? [])]),
    [actionCenter?.alerts, data?.alerts],
  );
  const actions = useMemo(
    () => mergeByIdentity([...(data?.next_best_actions ?? []), ...(actionCenter?.items ?? [])]),
    [actionCenter?.items, data?.next_best_actions],
  );
  const canRenderHeatmap = freshness?.summary?.can_render_heatmap;
  const canRenderDashboard = freshness?.summary?.can_render_dashboard;
  const focusCards: OperationsFocusCard[] = [
    {
      id: 'health',
      title: freshness?.status ? statusLabel(freshness.status) : 'datos cargados',
      description: 'Estado general de las fuentes que alimentan el tablero.',
      icon: Gauge,
      tone: freshness?.status === 'fresh' || freshness?.status === 'ready' ? 'success' : 'default',
    },
    {
      id: 'actions',
      title: actions.length ? `${actions.length} acciones sugeridas` : 'sin acciones criticas',
      description: actions.length ? 'Revisar primero el centro de acciones.' : 'No hay acciones urgentes publicadas.',
      icon: CheckCircle2,
      tone: actions.length ? 'warning' : 'success',
    },
    {
      id: 'territory',
      title: canRenderHeatmap === false ? 'mapa sin datos' : 'mapa disponible',
      description: 'Zonas calientes y segmentos territoriales cuando backend publica puntos.',
      icon: MapPin,
      tone: canRenderHeatmap === false ? 'warning' : 'default',
    },
  ];

  if (dashboardQuery.isLoading && !data) {
    return <ViewState status="loading" description="Cargando actividad operativa." className={className} />;
  }

  if (dashboardQuery.isError && !data) {
    return (
      <ViewState
        status="partial"
        title="Estadisticas no disponibles"
        description={getErrorMessage(dashboardQuery.error, 'No se pudo cargar la actividad operativa.')}
        action={
          <Button type="button" variant="outline" onClick={() => void dashboardQuery.refetch()}>
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        }
        className={className}
      />
    );
  }

  if (!data) {
    return <ViewState status="empty" description="Todavia no hay datos operativos para mostrar." className={className} />;
  }

  return (
    <section className={cn('space-y-5', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tablero operativo</p>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Actividad y decisiones</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Reclamos, encuestas, canales, equipo, mapa y acciones recomendadas para resolver primero.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {refreshSeconds ? <Badge variant="outline">Actualizacion cada {refreshSeconds}s</Badge> : null}
          {dashboardQuery.isFetching || heatmapQuery.isFetching || actionCenterQuery.isFetching || aiBriefQuery.isFetching || freshnessQuery.isFetching ? (
            <Badge variant="secondary">Actualizando</Badge>
          ) : null}
          {freshness?.status ? <Badge variant={statusVariant(freshness.status)}>{statusLabel(freshness.status)}</Badge> : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void refetchDashboard();
              void refetchHeatmap();
              void refetchActionCenter();
              void refetchAIBrief();
              void refetchFreshness();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      {freshness ? <FreshnessBanner freshness={freshness} /> : null}
      {aiBrief ? <AIBriefBanner brief={aiBrief} /> : null}

      <div className="grid gap-3 lg:grid-cols-3">
        {focusCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.id} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', focusCardToneClass[card.tone])}>
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Prioridad</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{card.title}</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{card.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {canRenderDashboard === false ? (
        <ViewState
          status="partial"
          title="Datos operativos no disponibles"
          description="No hay datos suficientes para dibujar esta vista en el periodo seleccionado."
          className="min-h-[140px]"
        />
      ) : null}

      {alerts.length ? <AlertsStrip alerts={alerts} /> : null}

      <KpiGrid data={data} heatmap={heatmapQuery.data} alertsCount={alerts.length} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="space-y-5">
          <TrendsPanel data={data} />
          <TicketBreakdowns data={data} />
          <EngagementPanel data={data} />
          <EmployeePanel data={data} />
          <OperationsHeatmapPanel
            heatmap={heatmapQuery.data}
            freshness={freshness}
            loading={heatmapQuery.isLoading}
            error={heatmapQuery.error}
            canRenderHeatmap={canRenderHeatmap}
            filters={activeHeatmapFilters}
            onFiltersChange={setHeatmapFilters}
            mapConfig={mapConfigQuery.data}
            refetch={() => void refetchHeatmap()}
          />
        </div>
        <div className="space-y-5">
          <ActionCenterPanel
            items={actions}
            summary={actionCenter?.summary}
            loading={actionCenterQuery.isLoading}
            error={actionCenterQuery.error}
            refetch={() => void refetchActionCenter()}
          />
          <HotspotsPanel data={data} heatmap={heatmapQuery.data} />
        </div>
      </div>
    </section>
  );
}

function AIBriefBanner({ brief }: { brief: OperationsAIBriefV1 }) {
  const severity = brief.severity || brief.risk_level || 'low';
  const topAction = brief.top_action;
  const focusItems = brief.focus_items ?? [];
  const modelPolicy = brief.model_policy ?? {};
  const providerOrder = Array.isArray(modelPolicy.provider_order)
    ? modelPolicy.provider_order.map((item) => String(item || '').trim()).filter(Boolean).join(' -> ')
    : '';
  const primaryProvider = asString(modelPolicy.primary_provider);
  const hfMode = asString(brief.signals?.hf_mode);
  const hfConfigured = brief.signals?.hf_configured === true;

  return (
    <div className="overflow-hidden rounded-xl border border-primary/15 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20 text-primary-foreground">
              <Brain className="h-5 w-5" />
            </span>
            <Badge variant={priorityVariant(severity)}>{priorityLabel(severity)}</Badge>
            {brief.dominant_intent_label ? <Badge variant="outline" className="border-white/20 text-white">{brief.dominant_intent_label}</Badge> : null}
            {brief.sentiment ? <Badge variant="outline" className="border-white/20 text-white">sentimiento {brief.sentiment}</Badge> : null}
          </div>
          <div>
            <h3 className="text-xl font-semibold tracking-tight">{brief.headline || 'Brief operativo IA'}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-200">
              {brief.narrative || 'El sistema consolido tickets, encuestas, WhatsApp, equipo y mapa para sugerir la proxima accion.'}
            </p>
          </div>
          {topAction ? (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Siguiente accion</p>
              <p className="mt-1 text-sm font-semibold">{topAction.title || topAction.id || 'Revisar accion recomendada'}</p>
              {topAction.description ? <p className="mt-1 text-sm text-slate-300">{topAction.description}</p> : null}
            </div>
          ) : null}
        </div>
        <div className="border-t border-white/10 bg-white/5 p-5 lg:border-l lg:border-t-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Foco del momento</p>
          <div className="mt-3 grid gap-2">
            {focusItems.slice(0, 4).map((item, index) => (
              <div key={item.id || item.key || item.label || index} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2">
                <span className="min-w-0 truncate text-sm">{item.label || item.title || item.key || 'Foco operativo'}</span>
                <span className="shrink-0 text-sm font-semibold">{formatNumber(item.value ?? item.count ?? item.total)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
            {primaryProvider ? <span className="rounded-full border border-white/10 px-2 py-1">IA {primaryProvider}</span> : null}
            {providerOrder ? <span className="rounded-full border border-white/10 px-2 py-1">{providerOrder}</span> : null}
            {hfMode ? <span className="rounded-full border border-white/10 px-2 py-1">HF {hfMode}</span> : null}
            {hfConfigured ? <span className="rounded-full border border-emerald-400/30 px-2 py-1 text-emerald-200">HF activo</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function FreshnessBanner({ freshness }: { freshness: OperationsFreshnessV1 }) {
  const staleOrEmpty = freshness.sources.filter((source) => {
    const normalized = (source.status || '').toLowerCase();
    return normalized === 'stale' || normalized === 'empty' || normalized === 'degraded';
  });
  const summary = freshness.summary ?? {};
  const latestAt = asString(summary.latest_at);

  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <DatabaseZap className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">Estado de datos</p>
              {freshness.status ? <Badge variant={statusVariant(freshness.status)}>{statusLabel(freshness.status)}</Badge> : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{formatNumber(summary.fresh_sources)} fuentes al dia</span>
              <span>{formatNumber(summary.stale_sources)} por revisar</span>
              <span>{formatNumber(summary.empty_sources)} sin actividad</span>
              {latestAt ? <span>ultimo dato {latestAt}</span> : null}
            </div>
          </div>
        </div>
        {staleOrEmpty.length ? (
          <div className="flex max-w-full flex-wrap gap-2">
            {staleOrEmpty.slice(0, 5).map((source) => (
              <FreshnessSourceChip key={source.key || source.label || source.reason_code} source={source} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FreshnessSourceChip({ source }: { source: OperationsFreshnessSource }) {
  const label = source.label || source.key || 'fuente';
  const action = source.recommended_action;
  const actionLabel = action?.title;

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs">
      <span className="shrink-0 font-medium">{label}</span>
      {source.status ? <span className="text-muted-foreground">{statusLabel(source.status)}</span> : null}
      {actionLabel ? (
        <span className="shrink-0 text-muted-foreground">{actionLabel}</span>
      ) : null}
    </span>
  );
}

function KpiGrid({
  data,
  heatmap,
  alertsCount,
}: {
  data: OperationsDashboardV1;
  heatmap?: OperationsHeatmapV1;
  alertsCount: number;
}) {
  const ticketsSummary = data.tickets?.summary ?? {};
  const surveysSummary = data.surveys?.summary ?? {};
  const chatsSummary = data.chats?.summary ?? {};
  const employeesSummary = data.employees?.summary ?? {};
  const heatmapSummary = heatmap?.summary ?? {};

  const metrics = [
    {
      key: 'open_tickets',
      label: resolveLabel(data, 'open_tickets', 'Reclamos abiertos'),
      value: readNumber(data.summary.open_tickets, ticketsSummary.open_tickets, ticketsSummary.open, ticketsSummary.abiertos),
      icon: Ticket,
    },
    {
      key: 'overdue_tickets',
      label: resolveLabel(data, 'overdue_tickets', 'Reclamos vencidos'),
      value: readNumber(data.summary.overdue_tickets, ticketsSummary.overdue_tickets, ticketsSummary.overdue, ticketsSummary.vencidos),
      icon: AlertTriangle,
    },
    {
      key: 'survey_responses',
      label: resolveLabel(data, 'survey_responses', 'Respuestas'),
      value: readNumber(data.summary.survey_responses, surveysSummary.responses, surveysSummary.respuestas),
      icon: BarChart3,
    },
    {
      key: 'live_votes',
      label: resolveLabel(data, 'live_votes', 'Votos en vivo'),
      value: readNumber(data.summary.live_votes, surveysSummary.votaciones_live, surveysSummary.live_votes),
      icon: Activity,
    },
    {
      key: 'whatsapp_messages',
      label: resolveLabel(data, 'whatsapp_messages', 'WhatsApp'),
      value: readNumber(data.summary.whatsapp_messages, chatsSummary.whatsapp_messages),
      icon: Bell,
    },
    {
      key: 'employees',
      label: resolveLabel(data, 'employees', 'Equipo'),
      value: readNumber(data.summary.employees, employeesSummary.employees, employeesSummary.total, data.employees?.items?.length),
      icon: Users,
    },
    {
      key: 'map_points',
      label: resolveLabel(data, 'map_points', 'Puntos en mapa'),
      value: readNumber(data.summary.map_points, heatmapSummary.points, heatmap?.points.length),
      icon: MapPin,
    },
    {
      key: 'alerts',
      label: resolveLabel(data, 'alerts', 'Alertas'),
      value: readNumber(data.summary.alerts, alertsCount),
      icon: AlertTriangle,
    },
  ];

  return (
    <details className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        Ver indicadores detallados
      </summary>
      <p className="mt-1 text-sm text-muted-foreground">
        Metricas completas para revision. El resumen superior indica las prioridades principales.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card key={metric.key}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Icon className="h-4 w-4" />
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{formatNumber(metric.value)}</p>
            </CardContent>
          </Card>
        );
      })}
      </div>
    </details>
  );
}

function AlertsStrip({ alerts }: { alerts: OperationsAlert[] }) {
  return (
    <div className="grid gap-2">
      {alerts.slice(0, 4).map((alert, index) => {
        const title = asString(alert.title) ?? `Alerta ${index + 1}`;
        const message = asString(alert.message) ?? asString(alert.description);
        return (
          <div
            key={alert.id || alert.reason_code || title}
            className="flex flex-col gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="min-w-0">
                <p className="font-medium">{title}</p>
                {message ? <p className="text-muted-foreground">{message}</p> : null}
              </div>
            </div>
            {alert.severity ? (
              <div className="flex shrink-0 flex-wrap gap-1">
                {alert.severity ? <Badge variant={priorityVariant(alert.severity)}>{priorityLabel(alert.severity)}</Badge> : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function TrendsPanel({ data }: { data: OperationsDashboardV1 }) {
  const trends = data.trends?.items ?? [];
  if (!trends.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Tendencias</CardTitle>
        <CardDescription>Comparacion contra el periodo anterior.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {trends.slice(0, 8).map((trend, index) => {
          const direction = asString(trend.direction);
          return (
            <div key={trend.id || trend.key || index} className="rounded-lg border px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">{itemLabel(trend)}</p>
                {direction ? <Badge variant="outline">{direction}</Badge> : null}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <MetricMini label="Actual" value={formatNumber(trend.current)} />
                <MetricMini label="Anterior" value={formatNumber(trend.previous)} />
                <MetricMini label="Cambio" value={formatNumber(trend.percent_change, '%')} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function TicketBreakdowns({ data }: { data: OperationsDashboardV1 }) {
  const groups = [
    { key: 'by_status', title: resolveLabel(data, 'tickets_by_status', 'Reclamos por estado'), items: data.tickets?.by_status },
    { key: 'by_channel', title: resolveLabel(data, 'tickets_by_channel', 'Reclamos por canal'), items: data.tickets?.by_channel },
    { key: 'by_category', title: resolveLabel(data, 'tickets_by_category', 'Reclamos por categoria'), items: data.tickets?.by_category },
    { key: 'by_priority', title: resolveLabel(data, 'tickets_by_priority', 'Reclamos por prioridad'), items: data.tickets?.by_priority },
  ].filter((group) => hasItems(group.items));

  if (!groups.length) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((group) => (
        <BreakdownCard key={group.key} title={group.title} items={group.items ?? []} />
      ))}
    </div>
  );
}

function EngagementPanel({ data }: { data: OperationsDashboardV1 }) {
  const surveyItems = data.surveys?.items ?? [];
  const liveItems = Array.isArray(data.surveys?.live_items)
    ? (data.surveys?.live_items as OperationsBucketItem[])
    : [];
  const channelItems = data.chats?.by_channel ?? [];
  const liveChatItems = data.live_chat?.items ?? [];
  const surveyRows = [...liveItems, ...surveyItems].slice(0, 8);
  const channelRows = [...channelItems, ...liveChatItems].slice(0, 8);
  const hasSignal = surveyItems.length || liveItems.length || channelItems.length || liveChatItems.length || data.live_chat?.active_viewers !== undefined;

  if (!hasSignal) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {surveyRows.length ? (
        <BreakdownCard title={resolveLabel(data, 'surveys', 'Encuestas y votaciones')} items={surveyRows} />
      ) : null}
      {channelRows.length || data.live_chat?.active_viewers !== undefined ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{resolveLabel(data, 'channels', 'Canales y live chat')}</CardTitle>
            <CardDescription>
              {data.live_chat?.active_viewers !== undefined
                ? `${formatNumber(data.live_chat.active_viewers)} personas activas`
                : 'Conversaciones y participacion del periodo'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {channelRows.length ? (
              channelRows.map((item, index) => (
                <BreakdownRow key={item.id || item.key || index} item={item} />
              ))
            ) : (
              <ViewState status="empty" description="Sin actividad de canales para este periodo." className="min-h-[120px]" />
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function EmployeePanel({ data }: { data: OperationsDashboardV1 }) {
  const employees = data.employees?.items ?? [];
  const uncoveredCategories = data.employees?.coverage?.uncovered_categories ?? [];
  const uncoveredChannels = data.employees?.coverage?.uncovered_channels ?? [];
  const coverageRate = readNumber(data.employees?.summary?.coverage_rate);

  if (!employees.length && !uncoveredCategories.length && !uncoveredChannels.length && coverageRate === undefined) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{resolveLabel(data, 'employees', 'Cobertura del equipo')}</CardTitle>
        <CardDescription>
          {coverageRate !== undefined ? `${formatNumber(coverageRate, '%')} de cobertura` : 'Categorias y canales cubiertos por el equipo'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          {employees.slice(0, 6).map((item, index) => (
            <BreakdownRow key={item.id || item.key || index} item={item} />
          ))}
        </div>
        <div className="space-y-3">
          <MiniList title={resolveLabel(data, 'uncovered_categories', 'Categorias sin cubrir')} items={uncoveredCategories} />
          <MiniList title={resolveLabel(data, 'uncovered_channels', 'Canales sin cubrir')} items={uncoveredChannels} />
        </div>
      </CardContent>
    </Card>
  );
}

function OperationsHeatmapPanel({
  heatmap,
  freshness,
  loading,
  error,
  canRenderHeatmap,
  filters,
  onFiltersChange,
  mapConfig,
  refetch,
}: {
  heatmap?: OperationsHeatmapV1;
  freshness?: OperationsFreshnessV1;
  loading: boolean;
  error: unknown;
  canRenderHeatmap?: boolean;
  filters: HeatmapFilterState;
  onFiltersChange: React.Dispatch<React.SetStateAction<HeatmapFilterState>>;
  mapConfig?: PublicMapConfigV1;
  refetch: () => void;
}) {
  const layers = heatmap?.render_contract?.layers ?? [];
  const layersKey = layers.join('|');
  const [enabledLayers, setEnabledLayers] = useState<string[]>(layers);

  useEffect(() => {
    setEnabledLayers(layers);
  }, [layersKey]);

  const uiLabels = heatmap?.ui?.labels ?? heatmap?.frontend_contract?.labels ?? {};
  const filterControls = useMemo(() => {
    const byKey = new Map<HeatmapFilterKey, Map<string, HeatmapFilterOption>>();
    const ensureGroup = (key: HeatmapFilterKey) => {
      const existing = byKey.get(key);
      if (existing) return existing;
      const next = new Map<string, HeatmapFilterOption>();
      byKey.set(key, next);
      return next;
    };
    const addOption = (key: HeatmapFilterKey, value: unknown, labelCandidate?: unknown, countCandidate?: unknown) => {
      const parsedValue = typeof value === 'number' && Number.isFinite(value) ? String(value) : asString(value);
      if (!parsedValue) return;
      const rawLabel =
        (typeof labelCandidate === 'number' && Number.isFinite(labelCandidate) ? String(labelCandidate) : asString(labelCandidate)) ??
        parsedValue;
      const label = heatmapDisplayLabel(rawLabel, parsedValue);
      const group = ensureGroup(key);
      const previous = group.get(parsedValue);
      const count = readNumber(countCandidate);
      group.set(parsedValue, {
        value: parsedValue,
        label,
        count: count !== undefined ? count : previous?.count,
      });
    };

    (heatmap?.facets ?? []).forEach((facet) => {
      const key = normalizeHeatmapFilterKey(facet.key ?? facet.field ?? facet.query_param);
      if (!key) return;
      facet.items.forEach((item) => {
        addOption(key, readItemOptionValue(item), itemLabel(item), itemValue(item));
      });
    });

    Object.entries(heatmap?.segments ?? {}).forEach(([segmentKey, items]) => {
      const key = normalizeHeatmapFilterKey(segmentKey);
      if (!key) return;
      items.forEach((item) => {
        addOption(key, readItemOptionValue(item), itemLabel(item), itemValue(item));
      });
    });

    (heatmap?.points ?? []).forEach((point) => {
      HEATMAP_FILTERS.forEach((config) => {
        addOption(config.key, readPointField(point, config));
      });
    });

    return HEATMAP_FILTERS.map((config) => {
      const options = Array.from(byKey.get(config.key)?.values() ?? [])
        .sort((a, b) => {
          const countDelta = (b.count ?? 0) - (a.count ?? 0);
          if (countDelta) return countDelta;
          return a.label.localeCompare(b.label, 'es');
        })
        .slice(0, 60);

      return {
        ...config,
        label: uiLabels[config.labelKey] || config.fallbackLabel,
        options,
      };
    }).filter((config) => config.options.length > 0);
  }, [heatmap?.facets, heatmap?.points, heatmap?.segments, uiLabels]);

  const hasActiveSegmentFilters = Object.keys(filters).some((key) => !HEATMAP_PERIOD_KEYS.has(key as HeatmapQueryKey));
  const clearFiltersLabel = uiLabels.clear_filters || 'Limpiar filtros';
  const allLabel = uiLabels.filter_all || 'Todos';
  const periodLabel = uiLabels.period_filter || 'Periodo';
  const selectedPeriod =
    filters.range === 'all' || filters.scope === 'historical'
      ? 'historical'
      : asString(filters.days) ?? '365';

  const filteredPoints = useMemo(() => {
    if (!heatmap?.points.length) return [] as OperationsHeatmapPoint[];
    const layerFiltered = (() => {
      if (!layers.length || enabledLayers.length === layers.length) return heatmap.points;

      const enabled = new Set(enabledLayers.map((layer) => layer.toLowerCase()));
      return heatmap.points.filter((point) => {
        const pointLayer = String(point.layer ?? point.source ?? point.type ?? '').trim().toLowerCase();
        return !pointLayer || enabled.has(pointLayer);
      });
    })();

    const activeFilters = Object.entries(filters)
      .map(([key, value]) => {
        const config = HEATMAP_FILTERS.find((candidate) => candidate.key === key);
        const parsedValue = asString(value);
        return config && parsedValue ? { config, value: parsedValue } : null;
      })
      .filter((item): item is { config: HeatmapFilterConfig; value: string } => item !== null);

    if (!activeFilters.length) return layerFiltered;

    return layerFiltered.filter((point) =>
      activeFilters.every(({ config, value }) => {
        const pointValue = readPointField(point, config);
        if (!pointValue) return true;
        return pointValue === value;
      }),
    );
  }, [enabledLayers, filters, heatmap?.points, layers]);

  const segmentBreakdowns = useMemo(() => {
    if (!filteredPoints.length) return [] as Array<{ key: HeatmapFilterKey; label: string; items: OperationsBucketItem[] }>;

    return filterControls
      .map((config) => {
        const acc = new Map<string, { label: string; count: number; weight: number }>();
        filteredPoints.forEach((point) => {
          const value = readPointField(point, config);
          if (!value) return;
          const previous = acc.get(value) ?? { label: value, count: 0, weight: 0 };
          previous.count += 1;
          previous.weight += readNumber(point.weight) ?? 1;
          acc.set(value, previous);
        });
        const items = Array.from(acc.entries())
          .map(([value, item]) => ({
            key: value,
            label: heatmapDisplayLabel(item.label, value),
            count: item.count,
            value: Number(item.weight.toFixed(2)),
          }))
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
          .slice(0, 5);
        return { key: config.key, label: config.label, items };
      })
      .filter((group) => group.items.length > 0);
  }, [filterControls, filteredPoints]);

  const activeFilterSummaries = useMemo(
    () =>
      filterControls
        .map((config) => {
          const value = filters[config.queryParam];
          if (!value) return null;
          const option = config.options.find((candidate) => candidate.value === value);
          return {
            key: config.key,
            queryParam: config.queryParam,
            label: config.label,
            value,
            optionLabel: option?.label ?? value,
          };
        })
        .filter(
          (item): item is {
            key: HeatmapFilterKey;
            queryParam: keyof HeatmapFilterState;
            label: string;
            value: string;
            optionLabel: string;
          } => item !== null,
        ),
    [filterControls, filters],
  );

  const backendAppliedFilters = useMemo(() => {
    if (!heatmap?.filters_applied) return [] as Array<{ key: string; value: string }>;
    return Object.entries(heatmap.filters_applied)
      .map(([key, value]) => {
        const parsed = typeof value === 'number' && Number.isFinite(value) ? String(value) : asString(value);
        return parsed ? { key, value: parsed } : null;
      })
      .filter((item): item is { key: string; value: string } => item !== null);
  }, [heatmap?.filters_applied]);

  const demographicItems = useMemo(() => {
    const summary = heatmap?.summary ?? {};
    return [
      {
        key: 'known_gender_points',
        label: uiLabels.known_gender_points || 'Genero conocido',
        value: readNumber(heatmap?.demographics?.known_gender_points) ?? readNumber(summary.points_with_gender),
      },
      {
        key: 'unknown_gender_points',
        label: uiLabels.unknown_gender_points || 'Genero sin dato',
        value: readNumber(heatmap?.demographics?.unknown_gender_points) ?? readNumber(summary.unknown_gender_points),
      },
      {
        key: 'known_age_points',
        label: uiLabels.known_age_points || 'Edad conocida',
        value: readNumber(heatmap?.demographics?.known_age_points) ?? readNumber(summary.points_with_age),
      },
      {
        key: 'unknown_age_points',
        label: uiLabels.unknown_age_points || 'Edad sin dato',
        value: readNumber(heatmap?.demographics?.unknown_age_points) ?? readNumber(summary.unknown_age_points),
      },
    ].filter((item): item is { key: string; label: string; value: number } => item.value !== undefined);
  }, [heatmap?.demographics, heatmap?.summary, uiLabels]);

  const demographicBreakdowns = useMemo(() => {
    const groups = [
      {
        key: 'gender',
        label: uiLabels.demographic_gender || 'Genero',
        items: heatmap?.demographics?.gender ?? [],
      },
      {
        key: 'age_ranges',
        label: uiLabels.demographic_age_ranges || 'Rangos de edad',
        items: heatmap?.demographics?.age_ranges ?? [],
      },
    ];

    return groups
      .map((group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          label: heatmapDisplayLabel(itemLabel(item), readItemOptionValue(item)),
        })),
      }))
      .filter((group) => group.items.length > 0);
  }, [heatmap?.demographics, uiLabels]);

  const categoryLayerItems = useMemo(
    () =>
      (heatmap?.category_layers ?? [])
        .map((item) => ({
          ...item,
          label: heatmapDisplayLabel(itemLabel(item), readItemOptionValue(item)),
          key: readItemOptionValue(item) ?? item.key,
        }))
        .filter((item) => asString(item.key)),
    [heatmap?.category_layers],
  );

  const quality = heatmap?.quality;
  const realtime = heatmap?.realtime;
  const mapExperience = heatmap?.map_experience;
  const geocoding = heatmap?.geocoding;
  const qualityState = asString(quality?.state) ?? asString(heatmap?.summary?.quality_state);
  const qualityLabel =
    asString(quality?.label) ??
    (qualityState ? uiLabels[`quality_${qualityState}`] : undefined) ??
    'Calidad pendiente';
  const coveragePercent = readNumber(quality?.coverage_percent ?? heatmap?.summary?.coverage_percent ?? heatmap?.summary?.coordinate_coverage_pct);
  const pendingGeocode = readNumber(quality?.pending_geocode ?? heatmap?.summary?.pending_geocode);
  const visiblePoints = readNumber(quality?.visible_points ?? heatmap?.summary?.points ?? heatmap?.points.length);
  const latestRealtime = asString(realtime?.latest_event_at);
  const qualityMetrics = [
    {
      key: 'quality',
      label: uiLabels.map_quality || 'Calidad del mapa',
      value: qualityLabel,
      detail: quality?.reason_code ? String(quality.reason_code).replace(/_/g, ' ') : 'contrato operativo',
      icon: Gauge,
    },
    {
      key: 'coverage',
      label: uiLabels.coverage || 'Cobertura GPS',
      value: coveragePercent !== undefined ? `${formatNumber(coveragePercent, '%')}` : '--',
      detail: `${formatNumber(quality?.ticket_records_with_coordinates)} con coordenadas`,
      icon: MapPin,
    },
    {
      key: 'visible',
      label: uiLabels.visible_points || 'Puntos visibles',
      value: formatNumber(visiblePoints),
      detail: `${formatNumber(filteredPoints.length)} tras filtros activos`,
      icon: Layers,
    },
    {
      key: 'geocode',
      label: uiLabels.pending_geocode || 'Pendientes de geocodificar',
      value: formatNumber(pendingGeocode),
      detail: pendingGeocode ? 'requiere latitud y longitud' : 'sin cola pendiente',
      icon: DatabaseZap,
    },
    {
      key: 'realtime',
      label: uiLabels.realtime || 'Actualizacion en vivo',
      value: realtime?.poll_seconds ? `${formatNumber(realtime.poll_seconds)}s` : '--',
      detail: latestRealtime ? `ultimo evento ${latestRealtime}` : 'esperando nuevos eventos',
      icon: Activity,
    },
  ];
  const mapEngines = mapExperience?.map_engines ?? [];
  const layerGroups = mapExperience?.layer_groups ?? [];
  const preferredVisualization = asString(mapExperience?.preferred_visualization)?.replace(/_/g, ' ');
  const geocodingCandidates = (geocoding?.candidates ?? []).slice(0, 3);
  const geocodingStatus = asString(geocoding?.status);
  const geocodingAction = geocoding?.recommended_action;

  const renderState = heatmap?.render_contract?.state;
  const isFreshnessBlocked = canRenderHeatmap === false;
  const allowDemoFallback = import.meta.env.DEV && !isFreshnessBlocked && renderState !== 'empty';
  const isEmpty = isFreshnessBlocked || renderState === 'empty' || (!filteredPoints.length && !allowDemoFallback);
  const emptyDescription = isFreshnessBlocked
    ? 'No hay datos suficientes para dibujar el mapa en este periodo.'
    : 'Todavia no hay coordenadas para las capas activas.';
  const selectedFiltersLabel = uiLabels.selected_filters || 'Filtros activos';
  const visiblePointsLabel = uiLabels.visible_points || 'Puntos visibles';
  const backendFiltersLabel = uiLabels.backend_filters || 'Filtros aplicados por backend';
  const tenantVertical = asString(heatmap?.tenant?.vertical ?? heatmap?.tenant?.tipo ?? heatmap?.tenant?.sector);
  const demoProfile =
    tenantVertical === 'educacion' || tenantVertical === 'colegio'
      ? 'colegio'
      : tenantVertical === 'empresa' || tenantVertical === 'empresas' || tenantVertical === 'pyme'
        ? 'empresa'
        : tenantVertical === 'gobierno' || tenantVertical === 'municipio'
          ? 'gobierno'
          : 'general';

  if (loading && !heatmap) {
    return <ViewState status="loading" description="Cargando mapa operativo." />;
  }

  if (error && !heatmap) {
    return (
      <ViewState
        status="partial"
        title="Mapa no disponible"
        description={getErrorMessage(error, 'No se pudo cargar el mapa operativo.')}
        action={
          <Button type="button" variant="outline" onClick={refetch}>
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        }
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5" />
              Mapa operativo
            </CardTitle>
            <CardDescription>Reclamos, respuestas y eventos con ubicacion.</CardDescription>
          </div>
          {heatmap?.summary ? (
            <Badge variant="outline">{formatNumber(heatmap.summary.points)} puntos</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {quality || realtime ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {qualityMetrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.key} className="rounded-lg border bg-background/80 p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="rounded-md bg-primary/10 p-2 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    {metric.key === 'quality' && qualityState ? (
                      <Badge variant={statusVariant(qualityState)}>{statusLabel(qualityState)}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 text-lg font-semibold leading-tight">{metric.value}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{metric.detail}</p>
                </div>
              );
            })}
          </div>
        ) : null}
        {mapExperience || geocoding ? (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="rounded-xl border bg-[linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/0.42))] p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    {uiLabels.map_stack || 'Stack de inteligencia territorial'}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold tracking-normal">
                    {preferredVisualization || 'Mapa operativo interactivo'}
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {uiLabels.map_stack_description ||
                      'Capas listas para operar con calor territorial, riesgo IA, actividad de WhatsApp, encuestas y geocodificacion.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {mapEngines.map((engine) => (
                    <Badge key={engine} variant="secondary" className="capitalize">
                      {engine}
                    </Badge>
                  ))}
                  {mapExperience?.supports_reduced_motion ? (
                    <Badge variant="outline">{uiLabels.reduced_motion || 'motion seguro'}</Badge>
                  ) : null}
                </div>
              </div>
              {layerGroups.length ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {layerGroups.slice(0, 6).map((layer) => (
                    <div key={layer} className="rounded-lg border bg-background/70 px-3 py-2">
                      <p className="text-sm font-medium capitalize">{layer.replace(/_/g, ' ')}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {layer.includes('ai')
                          ? 'priorizacion y riesgo'
                          : layer.includes('whatsapp')
                            ? 'actividad conversacional'
                            : layer.includes('survey')
                              ? 'participacion y voto'
                              : 'capa territorial'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="rounded-xl border bg-background p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {uiLabels.geocoding_queue || 'Cola de ubicaciones'}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold">
                    {formatNumber(geocoding?.candidate_count)} pendientes
                  </h3>
                </div>
                {geocodingStatus ? <Badge variant={statusVariant(geocodingStatus)}>{statusLabel(geocodingStatus)}</Badge> : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {geocodingCandidates.length
                  ? 'Direcciones con texto util pero sin coordenadas. Resolverlas mejora mapa, SLA y asignacion de cuadrillas.'
                  : 'No hay direcciones pendientes para geocodificar en los filtros actuales.'}
              </p>
              {geocodingCandidates.length ? (
                <div className="mt-3 space-y-2">
                  {geocodingCandidates.map((candidate, index) => {
                    const key = String(candidate.record_id ?? candidate.ticket_id ?? candidate.address ?? index);
                    return (
                      <div key={key} className="rounded-lg border bg-muted/20 p-3">
                        <p className="line-clamp-1 text-sm font-medium">
                          {candidate.address || candidate.label || 'Direccion pendiente'}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1 text-xs text-muted-foreground">
                          {candidate.category ? <Badge variant="outline">{candidate.category}</Badge> : null}
                          {candidate.source ? <Badge variant="outline">{candidate.source}</Badge> : null}
                          {candidate.reason_code ? <span>{candidate.reason_code.replace(/_/g, ' ')}</span> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {geocodingAction ? (
                <div className="mt-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {asString(geocodingAction.title) ?? asString(geocodingAction.label) ?? 'Accion disponible'}
                  </p>
                  <p className="mt-1">
                    {asString(geocodingAction.method) ?? 'PATCH'}{' '}
                    {asString(geocodingAction.endpoint) ?? asString(geocodingAction.endpoint_template) ?? 'endpoint pendiente'}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        {layers.length ? (
          <div className="flex flex-wrap gap-2">
            {layers.map((layer) => {
              const active = enabledLayers.includes(layer);
              return (
                <Button
                  key={layer}
                  type="button"
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  onClick={() => {
                    setEnabledLayers((current) =>
                      current.includes(layer)
                        ? current.filter((item) => item !== layer)
                        : [...current, layer],
                    );
                  }}
                >
                  <Layers className="h-4 w-4" />
                  {layer}
                </Button>
              );
            })}
          </div>
        ) : null}
        {filterControls.length ? (
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">{uiLabels.segment_filters || 'Segmentos del mapa'}</p>
                <p className="text-xs text-muted-foreground">
                  {uiLabels.segment_filters_description || 'Cruza puntos reales por categoria, edad, genero, canal y zona cuando el backend los publica.'}
                </p>
              </div>
              {hasActiveSegmentFilters ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onFiltersChange((current) => keepHeatmapPeriodFilters(current))}
                >
                  {clearFiltersLabel}
                </Button>
              ) : null}
            </div>
            <div className="mt-3 max-w-xs space-y-1 text-xs font-medium text-muted-foreground">
              <span>{periodLabel}</span>
              <select
                value={selectedPeriod}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  onFiltersChange((current) => {
                    const next = { ...current };
                    delete next.range;
                    delete next.scope;
                    delete next.days;
                    if (nextValue === 'historical') {
                      next.range = 'all';
                      next.scope = 'historical';
                    } else {
                      next.days = nextValue;
                    }
                    return next;
                  });
                }}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="historical">{uiLabels.period_historical || 'Historico completo'}</option>
                <option value="365">{uiLabels.period_365 || 'Ultimos 365 dias'}</option>
                <option value="90">{uiLabels.period_90 || 'Ultimos 90 dias'}</option>
                <option value="30">{uiLabels.period_30 || 'Ultimos 30 dias'}</option>
              </select>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {filterControls.map((config) => (
                <label key={config.key} className="space-y-1 text-xs font-medium text-muted-foreground">
                  <span>{config.label}</span>
                  <select
                    value={filters[config.queryParam] ?? ''}
                    onChange={(event) => {
                      const nextValue = event.target.value.trim();
                      onFiltersChange((current) => {
                        const next = { ...current };
                        if (nextValue) {
                          next[config.queryParam] = nextValue;
                        } else {
                          delete next[config.queryParam];
                        }
                        return next;
                      });
                    }}
                    className="h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">{allLabel}</option>
                    {config.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.count !== undefined ? `${option.label} (${formatNumber(option.count)})` : option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">
                {visiblePointsLabel}: {formatNumber(filteredPoints.length)}
              </Badge>
              {activeFilterSummaries.length ? (
                <>
                  <span>{selectedFiltersLabel}:</span>
                  {activeFilterSummaries.map((filter) => (
                    <Button
                      key={`${filter.queryParam}-${filter.value}`}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={() =>
                        onFiltersChange((current) => {
                          const next = { ...current };
                          delete next[filter.queryParam];
                          return next;
                        })
                      }
                    >
                      <span className="font-medium">{filter.label}:</span>
                      <span>{filter.optionLabel}</span>
                    </Button>
                  ))}
                </>
              ) : null}
              {backendAppliedFilters.length ? (
                <span className="text-[11px]">
                  {backendFiltersLabel}: {backendAppliedFilters.map((filter) => `${filter.key}=${filter.value}`).join(', ')}
                </span>
              ) : null}
            </div>
            {segmentBreakdowns.length ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {segmentBreakdowns.slice(0, 6).map((group) => (
                  <MiniList key={group.key} title={group.label} items={group.items} />
                ))}
              </div>
            ) : null}
            {demographicItems.length || demographicBreakdowns.length ? (
              <div className="mt-3 rounded-md border bg-background/70 p-3">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">{uiLabels.demographics_title || 'Cobertura demografica'}</p>
                  <p className="text-xs text-muted-foreground">
                    {uiLabels.demographics_description || 'Solo se muestran rangos publicados por backend; los valores unknown se tratan como sin dato.'}
                  </p>
                </div>
                {demographicItems.length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {demographicItems.map((item) => (
                      <div key={item.key} className="rounded-md border bg-muted/20 p-2">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="text-lg font-semibold">{formatNumber(item.value)}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {demographicBreakdowns.length ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {demographicBreakdowns.map((group) => (
                      <MiniList key={group.key} title={group.label} items={group.items} />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            {categoryLayerItems.length ? (
              <div className="mt-3 rounded-md border bg-background/70 p-3">
                <p className="text-sm font-medium">{uiLabels.category_layers || 'Capas por categoria'}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {categoryLayerItems.map((item) => {
                    const value = asString(item.key) ?? '';
                    const active = filters.categoria === value;
                    return (
                      <Button
                        key={value}
                        type="button"
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        onClick={() =>
                          onFiltersChange((current) => {
                            const next = { ...current };
                            if (active) {
                              delete next.categoria;
                            } else {
                              next.categoria = value;
                            }
                            return next;
                          })
                        }
                      >
                        {item.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        {isEmpty ? (
          <ViewState
            status="empty"
            title="Mapa sin puntos"
            description={emptyDescription}
            className="min-h-[320px]"
          />
        ) : (
          <PremiumTerritoryHeatmap
            points={filteredPoints}
            heatmap={heatmap}
            labels={uiLabels}
            mapConfig={mapConfig}
            allowDemoFallback={allowDemoFallback}
            demoProfile={demoProfile}
            activeFilters={activeFilterSummaries.map((filter) => ({
              key: String(filter.queryParam),
              label: filter.label,
              value: filter.optionLabel,
              onClear: () =>
                onFiltersChange((current) => {
                  const next = { ...current };
                  delete next[filter.queryParam];
                  return next;
                }),
            }))}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ActionCenterPanel({
  items,
  summary,
  loading,
  error,
  refetch,
}: {
  items: OperationsActionItem[];
  summary?: Record<string, unknown>;
  loading: boolean;
  error: unknown;
  refetch: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5" />
              Acciones recomendadas
            </CardTitle>
            <CardDescription>Prioridades para resolver ahora y equilibrar el trabajo.</CardDescription>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={refetch} aria-label="Actualizar acciones">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(summary).slice(0, 4).map(([key, value]) => (
              <MetricMini key={key} label={key} value={formatNumber(value)} />
            ))}
          </div>
        ) : null}

        {error && !items.length ? (
          <ViewState status="partial" description={getErrorMessage(error, 'No se pudieron cargar las recomendaciones.')} className="min-h-[180px]" />
        ) : null}

        {!loading && !items.length && !error ? (
          <ViewState status="empty" title="Sin acciones pendientes" description="No hay recomendaciones para este periodo." className="min-h-[180px]" />
        ) : null}

        {items.slice(0, 8).map((item, index) => (
          <ActionItemRow key={item.id || item.reason_code || item.title || index} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}

function HotspotsPanel({ data, heatmap }: { data: OperationsDashboardV1; heatmap?: OperationsHeatmapV1 }) {
  const hotspots = [...(data.maps?.heatmap?.hotspots ?? []), ...(heatmap?.hotspots ?? [])].slice(0, 8);
  if (!hotspots.length) return null;

  return <BreakdownCard title={resolveLabel(data, 'hotspots', 'Zonas calientes')} items={hotspots} />;
}

function BreakdownCard({ title, items }: { title: string; items: OperationsBucketItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.slice(0, 8).map((item, index) => (
          <BreakdownRow key={bucketItemKey(item, index)} item={item} />
        ))}
      </CardContent>
    </Card>
  );
}

function BreakdownRow({ item }: { item: OperationsBucketItem }) {
  const value = itemValue(item);
  const percentage = readNumber(item.percentage, item.percent);
  const width = percentage !== undefined ? Math.max(0, Math.min(100, percentage)) : undefined;

  return (
    <div className="space-y-1 rounded-lg border px-3 py-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="min-w-0 truncate text-muted-foreground">{itemLabel(item)}</span>
        <span className="shrink-0 font-semibold">{formatNumber(value)}</span>
      </div>
      {width !== undefined ? (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function ActionItemRow({ item }: { item: OperationsActionItem }) {
  const title = asString(item.title) ?? 'Accion recomendada';
  const description = asString(item.description);
  const impact = asString(item.impact);

  return (
    <div className="rounded-lg border px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {item.priority ? <Badge variant={priorityVariant(item.priority)}>{priorityLabel(item.priority)}</Badge> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-1 text-xs">
        {impact ? <Badge variant="secondary">{impact}</Badge> : null}
      </div>
    </div>
  );
}

function MiniList({ title, items }: { title: string; items: OperationsBucketItem[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-2 space-y-1">
        {items.slice(0, 4).map((item, index) => (
          <div key={item.id || item.key || index} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{itemLabel(item)}</span>
            <span className="font-medium">{formatNumber(itemValue(item))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 px-2 py-1">
      <p className="truncate text-muted-foreground">{humanizeMetricLabel(label)}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function humanizeMetricLabel(label: string) {
  const normalized = label.replace(/[_-]+/g, ' ').trim();
  if (!normalized) return 'Indicador';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export default OperationsDashboardPanel;
