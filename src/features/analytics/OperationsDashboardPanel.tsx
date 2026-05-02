import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  DatabaseZap,
  Layers,
  MapPin,
  RefreshCw,
  Ticket,
  Users,
} from 'lucide-react';

import MapLibreMap from '@/components/MapLibreMap';
import { ViewState } from '@/components/app-shell/ViewState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/context/TenantContext';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/api';

import {
  getOperationsActionCenterV2,
  getOperationsDashboardV2,
  getOperationsFreshnessV2,
  getOperationsHeatmapV2,
} from './analyticsApi';
import type {
  OperationsActionItem,
  OperationsAlert,
  OperationsBucketItem,
  OperationsDashboardV1,
  OperationsFreshnessSource,
  OperationsFreshnessV1,
  OperationsHeatmapPoint,
  OperationsHeatmapV1,
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

interface OperationsDashboardPanelProps {
  className?: string;
}

export function OperationsDashboardPanel({ className }: OperationsDashboardPanelProps) {
  const { currentSlug } = useTenant();
  const tenantSlug = currentSlug || undefined;

  const dashboardQuery = useQuery({
    queryKey: ['v2-operations-dashboard', tenantSlug],
    queryFn: () => getOperationsDashboardV2({ tenantSlug }),
    retry: 0,
    staleTime: 30_000,
  });

  const heatmapQuery = useQuery({
    queryKey: ['v2-operations-heatmap', tenantSlug],
    queryFn: () => getOperationsHeatmapV2({ tenantSlug }),
    retry: 0,
    staleTime: 30_000,
  });

  const actionCenterQuery = useQuery({
    queryKey: ['v2-operations-action-center', tenantSlug],
    queryFn: () => getOperationsActionCenterV2({ tenantSlug }),
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
  const refetchFreshness = freshnessQuery.refetch;

  const refreshSeconds = getRefreshSeconds(
    dashboardQuery.data?.frontend_contract?.primary_refresh_seconds,
    actionCenterQuery.data?.frontend_contract?.primary_refresh_seconds,
    freshnessQuery.data?.frontend_contract?.primary_refresh_seconds,
  );

  useEffect(() => {
    if (!refreshSeconds) return undefined;
    const timer = window.setInterval(() => {
      void refetchDashboard();
      void refetchHeatmap();
      void refetchActionCenter();
      void refetchFreshness();
    }, refreshSeconds * 1000);

    return () => window.clearInterval(timer);
  }, [refetchActionCenter, refetchDashboard, refetchFreshness, refetchHeatmap, refreshSeconds]);

  const data = dashboardQuery.data;
  const actionCenter = actionCenterQuery.data;
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

  if (dashboardQuery.isLoading && !data) {
    return <ViewState status="loading" description="Cargando operaciones normalizadas." className={className} />;
  }

  if (dashboardQuery.isError && !data) {
    return (
      <ViewState
        status="partial"
        title="Operaciones no disponible"
        description={getErrorMessage(dashboardQuery.error, 'No se pudo cargar el contrato operations.dashboard.v1.')}
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
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {data.contract_version || 'operations.dashboard.v1'}
            </p>
            {data.request_id ? <Badge variant="outline">Req {data.request_id}</Badge> : null}
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Operaciones</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Tickets, encuestas, canales, empleados, mapa y acciones desde contratos v2 compartidos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {refreshSeconds ? <Badge variant="outline">{refreshSeconds}s refresh</Badge> : null}
          {dashboardQuery.isFetching || heatmapQuery.isFetching || actionCenterQuery.isFetching || freshnessQuery.isFetching ? (
            <Badge variant="secondary">Actualizando</Badge>
          ) : null}
          {freshness?.status ? <Badge variant={statusVariant(freshness.status)}>{freshness.status}</Badge> : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void refetchDashboard();
              void refetchHeatmap();
              void refetchActionCenter();
              void refetchFreshness();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      {freshness ? <FreshnessBanner freshness={freshness} /> : null}

      {canRenderDashboard === false ? (
        <ViewState
          status="partial"
          title="Datos operativos no disponibles"
          description={freshness?.reason_code || 'El contrato de frescura indica que no conviene renderizar el dashboard para este periodo.'}
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
              <p className="text-sm font-medium">{freshness.contract_version || 'operations.freshness.v1'}</p>
              {freshness.status ? <Badge variant={statusVariant(freshness.status)}>{freshness.status}</Badge> : null}
              {freshness.reason_code ? <Badge variant="outline">{freshness.reason_code}</Badge> : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{formatNumber(summary.fresh_sources)} fresh</span>
              <span>{formatNumber(summary.stale_sources)} stale</span>
              <span>{formatNumber(summary.empty_sources)} empty</span>
              {latestAt ? <span>latest_at {latestAt}</span> : null}
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
  const label = source.label || source.key || 'source';
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs">
      <span className="shrink-0 font-medium">{label}</span>
      {source.status ? <span className="text-muted-foreground">{source.status}</span> : null}
      {source.reason_code ? <span className="min-w-0 truncate text-muted-foreground">{source.reason_code}</span> : null}
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
      label: resolveLabel(data, 'open_tickets', 'Tickets abiertos'),
      value: readNumber(data.summary.open_tickets, ticketsSummary.open_tickets, ticketsSummary.open, ticketsSummary.abiertos),
      icon: Ticket,
    },
    {
      key: 'overdue_tickets',
      label: resolveLabel(data, 'overdue_tickets', 'Tickets vencidos'),
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
      label: resolveLabel(data, 'live_votes', 'Votos live'),
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
      label: resolveLabel(data, 'employees', 'Empleados'),
      value: readNumber(data.summary.employees, employeesSummary.employees, employeesSummary.total, data.employees?.items?.length),
      icon: Users,
    },
    {
      key: 'map_points',
      label: resolveLabel(data, 'map_points', 'Puntos mapa'),
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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
  );
}

function AlertsStrip({ alerts }: { alerts: OperationsAlert[] }) {
  return (
    <div className="grid gap-2">
      {alerts.slice(0, 4).map((alert, index) => {
        const title = asString(alert.title) ?? asString(alert.reason_code) ?? `alert-${index + 1}`;
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
            {alert.severity || alert.reason_code ? (
              <div className="flex shrink-0 flex-wrap gap-1">
                {alert.severity ? <Badge variant={priorityVariant(alert.severity)}>{alert.severity}</Badge> : null}
                {alert.reason_code ? <Badge variant="outline">{alert.reason_code}</Badge> : null}
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
        <CardDescription>Comparacion contra el periodo anterior del contrato.</CardDescription>
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
                <MetricMini label="current" value={formatNumber(trend.current)} />
                <MetricMini label="previous" value={formatNumber(trend.previous)} />
                <MetricMini label="change" value={formatNumber(trend.percent_change, '%')} />
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
    { key: 'by_status', title: resolveLabel(data, 'tickets_by_status', 'Tickets por estado'), items: data.tickets?.by_status },
    { key: 'by_channel', title: resolveLabel(data, 'tickets_by_channel', 'Tickets por canal'), items: data.tickets?.by_channel },
    { key: 'by_category', title: resolveLabel(data, 'tickets_by_category', 'Tickets por categoria'), items: data.tickets?.by_category },
    { key: 'by_priority', title: resolveLabel(data, 'tickets_by_priority', 'Tickets por prioridad'), items: data.tickets?.by_priority },
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
                ? `${formatNumber(data.live_chat.active_viewers)} active_viewers`
                : data.contract_version || 'operations.dashboard.v1'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {channelRows.length ? (
              channelRows.map((item, index) => (
                <BreakdownRow key={item.id || item.key || index} item={item} />
              ))
            ) : (
              <ViewState status="empty" description="Sin items de canales para este periodo." className="min-h-[120px]" />
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
        <CardTitle className="text-lg">{resolveLabel(data, 'employees', 'Cobertura de empleados')}</CardTitle>
        <CardDescription>
          {coverageRate !== undefined ? `${formatNumber(coverageRate, '%')} coverage_rate` : data.contract_version || 'employee coverage'}
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
  refetch,
}: {
  heatmap?: OperationsHeatmapV1;
  freshness?: OperationsFreshnessV1;
  loading: boolean;
  error: unknown;
  canRenderHeatmap?: boolean;
  refetch: () => void;
}) {
  const layers = heatmap?.render_contract?.layers ?? [];
  const layersKey = layers.join('|');
  const [enabledLayers, setEnabledLayers] = useState<string[]>(layers);

  useEffect(() => {
    setEnabledLayers(layers);
  }, [layersKey]);

  const filteredPoints = useMemo(() => {
    if (!heatmap?.points.length) return [] as OperationsHeatmapPoint[];
    if (!layers.length || enabledLayers.length === layers.length) return heatmap.points;

    const enabled = new Set(enabledLayers.map((layer) => layer.toLowerCase()));
    return heatmap.points.filter((point) => {
      const pointLayer = String(point.layer ?? point.source ?? point.type ?? '').trim().toLowerCase();
      return !pointLayer || enabled.has(pointLayer);
    });
  }, [enabledLayers, heatmap?.points, layers]);

  const bounds = useMemo(
    () =>
      filteredPoints
        .map((point) => [Number(point.lng), Number(point.lat)] as [number, number])
        .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat)),
    [filteredPoints],
  );

  const center = useMemo(() => {
    if (!bounds.length) return undefined;
    const lng = bounds.reduce((sum, point) => sum + point[0], 0) / bounds.length;
    const lat = bounds.reduce((sum, point) => sum + point[1], 0) / bounds.length;
    return [lng, lat] as [number, number];
  }, [bounds]);

  if (loading && !heatmap) {
    return <ViewState status="loading" description="Cargando heatmap operacional." />;
  }

  if (error && !heatmap) {
    return (
      <ViewState
        status="partial"
        title="Heatmap no disponible"
        description={getErrorMessage(error, 'No se pudo cargar operations.heatmap.v1.')}
        action={
          <Button type="button" variant="outline" onClick={refetch}>
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </Button>
        }
      />
    );
  }

  const renderState = heatmap?.render_contract?.state;
  const isFreshnessBlocked = canRenderHeatmap === false;
  const isEmpty = isFreshnessBlocked || renderState === 'empty' || !filteredPoints.length;
  const emptyDescription = isFreshnessBlocked
    ? freshness?.reason_code || 'El contrato de frescura indica que el heatmap no deberia renderizarse para este periodo.'
    : 'El contrato indica estado empty o no hay coordenadas para las capas activas.';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MapPin className="h-5 w-5" />
              Heatmap operacional
            </CardTitle>
            <CardDescription>{heatmap?.contract_version || 'operations.heatmap.v1'}</CardDescription>
          </div>
          {heatmap?.summary ? (
            <Badge variant="outline">{formatNumber(heatmap.summary.points)} puntos</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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
        {isEmpty ? (
          <ViewState
            status="empty"
            title="Mapa sin puntos"
            description={emptyDescription}
            className="min-h-[320px]"
          />
        ) : (
          <MapLibreMap
            heatmapData={filteredPoints as any}
            showHeatmap
            center={center}
            fitToBounds={bounds.length ? bounds : undefined}
            initialZoom={bounds.length ? 11 : 4}
            className="h-[360px] rounded-lg border sm:h-[460px]"
            disableClientClustering
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
              Action center
            </CardTitle>
            <CardDescription>Acciones priorizadas por backend; no se ejecutan automaticamente.</CardDescription>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={refetch} aria-label="Actualizar action center">
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
          <ViewState status="partial" description={getErrorMessage(error, 'No se pudo cargar operations.action_center.v1.')} className="min-h-[180px]" />
        ) : null}

        {!loading && !items.length && !error ? (
          <ViewState status="empty" title="Sin acciones pendientes" description="El backend no envio next_best_actions para este periodo." className="min-h-[180px]" />
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

  return <BreakdownCard title={resolveLabel(data, 'hotspots', 'Hotspots')} items={hotspots} />;
}

function BreakdownCard({ title, items }: { title: string; items: OperationsBucketItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.slice(0, 8).map((item, index) => (
          <BreakdownRow key={item.id || item.key || item.label || index} item={item} />
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
  const title = asString(item.title) ?? asString(item.id) ?? asString(item.reason_code) ?? 'action';
  const description = asString(item.description);
  const method = asString(item.method);
  const endpoint = asString(item.endpoint);

  return (
    <div className="rounded-lg border px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {item.priority ? <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-1 text-xs">
        {item.reason_code ? <Badge variant="outline">{item.reason_code}</Badge> : null}
        {item.ui_hint ? <Badge variant="secondary">{item.ui_hint}</Badge> : null}
        {method ? <Badge variant="outline">{method}</Badge> : null}
        {endpoint ? (
          <span className="max-w-full truncate rounded border bg-muted/40 px-2 py-0.5 font-mono text-muted-foreground">
            {endpoint}
          </span>
        ) : null}
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
      <p className="truncate text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

export default OperationsDashboardPanel;
