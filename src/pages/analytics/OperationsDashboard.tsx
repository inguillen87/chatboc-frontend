import { useMemo } from 'react';
import { KpiTile } from '@/components/analytics/KpiTile';
import { TimeSeriesChart } from '@/components/analytics/TimeSeriesChart';
import { StackedBarChart } from '@/components/analytics/StackedBarChart';
import { MapWidget } from '@/components/analytics/MapWidget';
import { OperationsTable } from '@/components/analytics/OperationsTable';
import { WidgetFrame } from '@/components/analytics/WidgetFrame';
import { useAnalyticsDashboard } from '@/hooks/useAnalyticsDashboard';
import { useAnalyticsFilters } from '@/context/AnalyticsFiltersContext';

export function OperationsDashboard() {
  const { data, loading } = useAnalyticsDashboard('operaciones');
  const { setBoundingBox } = useAnalyticsFilters();

  const operations = data.operations;
  const agingBreakdown = useMemo(() => {
    if (!operations) return { dimension: 'aging', items: [] };
    return {
      dimension: 'aging',
      items: Object.entries(operations.agingBuckets).map(([label, value]) => ({ label, value })),
    };
  }, [operations]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile title="Tickets abiertos" value={operations?.abiertos ?? 0} loading={loading} />
        <KpiTile title="SLA vencidos" value={operations?.slaBreaches ?? 0} loading={loading} />
        <KpiTile title="Automatizados" value={operations?.automated ?? 0} loading={loading} />
        <KpiTile title="Tickets" value={data.summary?.totals.tickets ?? 0} loading={loading} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TimeSeriesChart
            title="Volumen diario"
            description="Evolución de tickets"
            data={data.timeseries ?? undefined}
            loading={loading}
            exportName="operaciones-timeseries"
          />
        </div>
        <StackedBarChart
          title="Aging"
          data={agingBreakdown}
          loading={loading}
          exportName="operaciones-aging"
        />
      </section>

      <MapWidget
        title="Tickets en mapa"
        description="Heatmap de tickets activos"
        heatmap={data.heatmap ?? undefined}
        points={data.points ?? undefined}
        loading={loading}
        exportName="operaciones-mapa"
        onBoundingBoxChange={setBoundingBox}
      />

      <OperationsTable
        title="Carga por agente"
        data={operations ?? undefined}
        loading={loading}
        exportName="operaciones-agentes"
      />

      <WidgetFrame title="Estados" exportFilename="operaciones-estados" csvData={data.breakdownEstado?.items}>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {(data.breakdownEstado?.items ?? []).map((item) => (
            <div key={item.label} className="rounded border p-3">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-lg font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
      </WidgetFrame>
    </div>
  );
}
