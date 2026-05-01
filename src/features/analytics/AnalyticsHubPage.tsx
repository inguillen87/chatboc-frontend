import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, Clock3, RefreshCw, Smile, Ticket } from 'lucide-react';

import { ViewState } from '@/components/app-shell/ViewState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/context/TenantContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getErrorMessage } from '@/utils/api';

import { getAnalyticsOverviewV2 } from './analyticsApi';
import type { AnalyticsOverview } from './analyticsTypes';

const formatMetric = (value: number | undefined, suffix = '') => {
  if (value === undefined || Number.isNaN(value)) return '--';
  return `${value.toLocaleString('es-AR')}${suffix}`;
};

const METRICS: Array<{
  key: keyof AnalyticsOverview;
  label: string;
  suffix?: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'conversations', label: 'Conversaciones', icon: Activity },
  { key: 'open_tickets', label: 'Tickets abiertos', icon: Ticket },
  { key: 'overdue_tickets', label: 'Tickets vencidos', icon: Ticket },
  { key: 'response_time', label: 'Tiempo respuesta', suffix: ' min', icon: Clock3 },
  { key: 'survey_responses', label: 'Respuestas encuestas', icon: BarChart3 },
  { key: 'nps', label: 'NPS', icon: Smile },
  { key: 'csat', label: 'CSAT', suffix: '%', icon: Smile },
  { key: 'handoff_rate', label: 'Handoff rate', suffix: '%', icon: Activity },
];

export default function AnalyticsHubPage() {
  const { currentSlug } = useTenant();
  const { isOnline } = useNetworkStatus();
  const overviewQuery = useQuery({
    queryKey: ['v2-analytics-overview', currentSlug],
    queryFn: () => getAnalyticsOverviewV2(currentSlug),
    retry: 0,
    staleTime: 30_000,
  });
  const data = overviewQuery.data;
  const metricCards = data
    ? METRICS.map((metric) => ({
        ...metric,
        rawValue: data[metric.key],
        value: formatMetric(data[metric.key], metric.suffix),
      }))
    : [];
  const availableMetrics = metricCards.filter((card) => card.rawValue !== undefined).length;
  const missingMetrics = metricCards.length - availableMetrics;
  const hasAnyMetric = availableMetrics > 0;

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
      <div className="p-4">
        <ViewState
          status="error"
          description={getErrorMessage(overviewQuery.error, 'No se pudo cargar analytics.')}
          action={
            <Button type="button" variant="outline" onClick={() => void overviewQuery.refetch()}>
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          }
        />
      </div>
    );
  }

  if (!data || !hasAnyMetric) {
    return (
      <div className="p-4">
        <ViewState status="empty" description="Todavia no hay suficientes datos para mostrar metricas." />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Analytics v2</p>
          <h1 className="text-2xl font-semibold tracking-tight">Hub ejecutivo</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">KPIs normalizados por tenant, listos para contratos top-level o summary.</p>
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
          title="Metricas parciales"
          description="Frontend ya tolera campos ausentes. Backend puede completar el summary para activar el panel completo."
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
            <MetricRow label="Tiempo de respuesta" value={formatMetric(data.response_time, ' min')} />
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
            <MetricRow label="CSAT" value={formatMetric(data.csat, '%')} />
            <MetricRow label="NPS" value={formatMetric(data.nps)} />
            <MetricRow label="Handoff rate" value={formatMetric(data.handoff_rate, '%')} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
