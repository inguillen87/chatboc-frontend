import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, Clock3, RefreshCw, Smile, Ticket } from 'lucide-react';

import { ViewState } from '@/components/app-shell/ViewState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePrivateAnalyticsScope } from './usePrivateAnalyticsScope';
import { visibleOperationsQuery } from './operationsReadState';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from '@/utils/chatbocSessionRevision';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getErrorMessage } from '@/utils/api';

import { getAnalyticsOverviewV2 } from './analyticsApi';
import type { AnalyticsOverview } from './analyticsTypes';
import { OperationsDashboardPanel } from './OperationsDashboardPanel';

const UNMEASURED = 'Sin medición';

const formatMetric = (value: number | undefined, suffix = '', fallback = '--') => {
  if (value === undefined || Number.isNaN(value)) return fallback;
  return `${value.toLocaleString('es-AR')}${suffix}`;
};

const METRICS: Array<{
  key: keyof Omit<AnalyticsOverview, 'ticket_satisfaction' | 'inbox_first_public_reply' | 'municipal_inbox_handoff'>;
  label: string;
  suffix?: string;
  fallback?: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'conversations', label: 'Conversaciones', icon: Activity },
  { key: 'open_tickets', label: 'Tickets abiertos', icon: Ticket },
  { key: 'overdue_tickets', label: 'Tickets vencidos', icon: Ticket },
  { key: 'response_time', label: 'Primera respuesta', suffix: ' min', fallback: UNMEASURED, icon: Clock3 },
  { key: 'survey_responses', label: 'Respuestas encuestas', icon: BarChart3 },
  { key: 'nps', label: 'NPS', icon: Smile },
  { key: 'handoff_rate', label: 'Derivación humana', suffix: '%', fallback: UNMEASURED, icon: Activity },
];

export default function AnalyticsHubPage() {
  const { scope, pending, key } = usePrivateAnalyticsScope();
  if (pending) return <ViewState status="loading" title="Validando acceso" />;
  if (!scope) return <ViewState status="empty" title="Seleccioná una organización" description="Los indicadores requieren un perfil y una organización verificados." />;
  return <ScopedAnalyticsHub key={key} tenantSlug={scope.tenantSlug} sessionScopeKey={scope.scopeKey} />;
}
function ScopedAnalyticsHub({ tenantSlug, sessionScopeKey }: { tenantSlug: string; sessionScopeKey: string }) {
  const { isOnline } = useNetworkStatus();
  const sessionRevision = captureChatbocSessionRevision();
  const overviewQuery = visibleOperationsQuery(useQuery({
    queryKey: ['v2-analytics-overview', tenantSlug, sessionScopeKey, sessionRevision],
    queryFn: ({ signal }) => getAnalyticsOverviewV2(tenantSlug, () => !signal.aborted && isChatbocSessionRevisionCurrent(sessionRevision)),
    retry: 0,
    staleTime: 30_000,
  }));
  const data = overviewQuery.data;
  const metricCards = data
    ? METRICS.map((metric) => ({
        ...metric,
        rawValue: data[metric.key],
        value: formatMetric(data[metric.key], metric.suffix, metric.fallback),
      }))
    : [];
  const availableMetrics = metricCards.filter((card) => card.rawValue !== undefined).length;
  const missingMetrics = metricCards.length - availableMetrics;
  const ticketSatisfaction = data?.ticket_satisfaction;
  const inboxReply = data?.inbox_first_public_reply;
  const municipalHandoff = data?.municipal_inbox_handoff;
  const hasAnyMetric = availableMetrics > 0 || ticketSatisfaction !== undefined || inboxReply !== undefined
    || municipalHandoff?.state === 'observed';

  if (!isOnline && !data) {
    return (
      <div className="p-4">
        <ViewState status="offline" description="Los indicadores se van a refrescar cuando vuelva la conexion." />
      </div>
    );
  }

  if (overviewQuery.isLoading) {
    return (
      <div className="p-4">
        <ViewState status="loading" description="Cargando resumen ejecutivo y KPIs operativos." />
      </div>
    );
  }

  if (overviewQuery.isError) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
        <ViewState
          status="partial"
          title="Analytics overview no disponible"
          description={getErrorMessage(overviewQuery.error, 'No se pudo cargar analytics.')}
          action={
            <Button type="button" variant="outline" onClick={() => void overviewQuery.refetch()}>
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          }
        />
        <OperationsDashboardPanel />
      </div>
    );
  }

  if (!data || !hasAnyMetric) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
        <ViewState status="empty" description="Todavía no hay suficientes datos para mostrar metricas." />
        <OperationsDashboardPanel />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Analytics v2</p>
          <h1 className="text-2xl font-semibold tracking-tight">Hub ejecutivo</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">Actividad y resultados de la organización para decidir con datos disponibles.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isOnline ? <Badge variant="destructive">Offline</Badge> : null}
          {overviewQuery.isFetching ? <Badge variant="secondary">Actualizando</Badge> : null}
          <Badge variant="outline">{availableMetrics}/{METRICS.length} metricas</Badge>
        </div>
      </header>

      {missingMetrics > 0 ? (
        <ViewState
          status="partial"
          title="Métricas parciales"
          description="Algunos indicadores todavía no tienen datos verificables y se muestran sin valor."
          className="min-h-[120px]"
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.key}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Icon className="h-4 w-4" />
                  {card.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{card.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Operaciones</CardTitle>
            <CardDescription>Lectura de tickets y tiempos sin agregar supuestos de negocio.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <MetricRow label="Tickets abiertos" value={formatMetric(data.open_tickets)} />
            <MetricRow label="Tickets vencidos" value={formatMetric(data.overdue_tickets)} />
            <MetricRow label="Tiempo de primera respuesta" value={formatMetric(data.response_time, ' min', UNMEASURED)} />
            {inboxReply ? (
              <MetricRow
                label="Primera respuesta pública en bandeja"
                value={inboxReply.state === 'observed' ? formatMetric(inboxReply.average_minutes, ' min') : UNMEASURED}
                detail={inboxReply.cohort_cases === null
                  ? 'Este filtro no tiene una población verificable de expedientes.'
                  : `Respuesta pública registrada en bandeja para ${inboxReply.sample_cases} de ${inboxReply.cohort_cases} expedientes creados en el período.`}
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Experiencia</CardTitle>
            <CardDescription>Indicadores que dependen de encuestas, handoff y conversacion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <MetricRow label="Conversaciones" value={formatMetric(data.conversations)} />
            <MetricRow label="Respuestas encuestas" value={formatMetric(data.survey_responses)} />
            <MetricRow
              label={ticketSatisfaction?.label ?? 'Casos calificados'}
              value={ticketSatisfaction?.state === 'observed' ? formatMetric(ticketSatisfaction.rated_ticket_count) : 'Sin datos'}
              detail={ticketSatisfaction?.detail}
            />
            <MetricRow label="NPS" value={formatMetric(data.nps)} />
            <MetricRow label="Tasa de derivación humana" value={formatMetric(data.handoff_rate, '%', UNMEASURED)} />
            {municipalHandoff ? (
              <MetricRow
                label="Derivaciones municipales en bandeja"
                value={municipalHandoff.state === 'observed'
                  ? `${formatMetric(municipalHandoff.accepted_count)} de ${formatMetric(municipalHandoff.request_count)}`
                  : UNMEASURED}
                detail={municipalHandoff.state === 'observed'
                  ? 'Aceptaciones registradas al cierre del período para las solicitudes con seguimiento.'
                  : 'El período y los filtros seleccionados no tienen solicitudes con seguimiento verificable.'}
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <OperationsDashboardPanel />
    </div>
  );
}

function MetricRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
      <div className="min-w-0 text-muted-foreground">
        <span>{label}</span>
        {detail ? <p className="mt-1 text-xs">{detail}</p> : null}
      </div>
      <span className="shrink-0 font-semibold">{value}</span>
    </div>
  );
}
