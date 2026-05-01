import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/context/TenantContext';
import { getAnalyticsOverviewV2 } from './analyticsApi';
import { ViewState } from '@/components/app-shell/ViewState';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getErrorMessage } from '@/utils/api';

const formatMetric = (value: number | undefined, suffix = '') => {
  if (value === undefined || Number.isNaN(value)) return '--';
  return `${value.toLocaleString('es-AR')}${suffix}`;
};

export default function AnalyticsHubPage() {
  const { currentSlug } = useTenant();
  const { isOnline } = useNetworkStatus();
  const overviewQuery = useQuery({
    queryKey: ['v2-analytics-overview', currentSlug],
    queryFn: () => getAnalyticsOverviewV2(currentSlug),
    retry: 0,
  });
  const data = overviewQuery.data;
  const metricCards = data
    ? [
        { key: 'conversations', label: 'Conversaciones', value: formatMetric(data.conversations) },
        { key: 'open_tickets', label: 'Tickets abiertos', value: formatMetric(data.open_tickets) },
        { key: 'overdue_tickets', label: 'Tickets vencidos', value: formatMetric(data.overdue_tickets) },
        { key: 'response_time', label: 'Tiempo respuesta', value: formatMetric(data.response_time, ' min') },
        { key: 'survey_responses', label: 'Respuestas encuestas', value: formatMetric(data.survey_responses) },
        { key: 'nps', label: 'NPS', value: formatMetric(data.nps) },
        { key: 'csat', label: 'CSAT', value: formatMetric(data.csat, '%') },
        { key: 'handoff_rate', label: 'Handoff rate', value: formatMetric(data.handoff_rate, '%') },
      ]
    : [];
  const hasAnyMetric = metricCards.some((card) => card.value !== '--');

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
            <button className="rounded-md border px-3 py-2 text-sm" type="button" onClick={() => void overviewQuery.refetch()}>
              Reintentar
            </button>
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
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">KPIs normalizados por tenant y contrato v2.</p>
        </div>
        {overviewQuery.isFetching ? <span className="text-xs text-muted-foreground">Actualizando...</span> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {metricCards.map((card) => (
          <section key={card.key} className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
