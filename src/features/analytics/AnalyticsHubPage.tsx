import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTenant } from '@/context/TenantContext';
import { getAnalyticsOverviewV2 } from './analyticsApi';

export default function AnalyticsHubPage() {
  const { currentSlug } = useTenant();
  const overviewQuery = useQuery({
    queryKey: ['v2-analytics-overview', currentSlug],
    queryFn: () => getAnalyticsOverviewV2(currentSlug),
    retry: 0,
  });
  const data = overviewQuery.data;

  if (!data) return <div className="p-4 text-sm text-muted-foreground">Sin datos de analytics todavía.</div>;

  return (
    <div className="grid gap-3 p-4 md:grid-cols-3">
      <div className="rounded border p-3">Conversaciones: {data.conversations}</div>
      <div className="rounded border p-3">Tickets abiertos: {data.open_tickets}</div>
      <div className="rounded border p-3">Tickets vencidos: {data.overdue_tickets}</div>
      <div className="rounded border p-3">Tiempo respuesta: {data.response_time}</div>
      <div className="rounded border p-3">Respuestas encuestas: {data.survey_responses}</div>
      <div className="rounded border p-3">NPS: {data.nps}</div>
    </div>
  );
}
