import { useMemo } from 'react';
import { KpiTile } from '@/components/analytics/KpiTile';
import { TimeSeriesChart } from '@/components/analytics/TimeSeriesChart';
import { StackedBarChart } from '@/components/analytics/StackedBarChart';
import { DonutChart } from '@/components/analytics/DonutChart';
import { TopTable } from '@/components/analytics/TopTable';
import { MapWidget } from '@/components/analytics/MapWidget';
import { WidgetFrame } from '@/components/analytics/WidgetFrame';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAnalyticsDashboard } from '@/hooks/useAnalyticsDashboard';
import { useAnalyticsFilters } from '@/context/AnalyticsFiltersContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

export function MunicipioDashboard() {
  const { data, loading, error, warning } = useAnalyticsDashboard('municipio');
  const { setBoundingBox } = useAnalyticsFilters();

  const summary = data.summary;
  const qualityRows = useMemo(() => {
    const quality = summary?.quality;
    if (!quality) return [];

    const byType = Array.isArray(quality.byType) ? quality.byType : [];
    const byAgent = Array.isArray(quality.byAgent) ? quality.byAgent : [];

    return [
      ...byType.map((item) => ({
        scope: item.label,
        average: item.average,
        responses: item.responses,
      })),
      ...byAgent.map((item) => ({
        scope: item.label,
        average: item.average,
        responses: item.responses,
      })),
    ];
  }, [summary]);

  const automationRate = summary?.efficiency?.automationRate ?? 0;
  const firstContact = summary?.efficiency?.firstContact ?? 0;
  const reopenRate = summary?.efficiency?.reopenRate ?? 0;
  const ack = summary?.sla?.ack;
  const resolve = summary?.sla?.resolve;
  const isSelectionError = error?.toLowerCase().includes('seleccioná');

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant={isSelectionError ? 'default' : 'destructive'}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {isSelectionError ? 'Seleccioná una entidad' : 'No se pudieron cargar los datos'}
          </AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {!error && warning ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Alerta de conexión</AlertTitle>
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ) : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile title="Tickets totales" value={summary?.totals.tickets ?? 0} loading={loading} />
        <KpiTile title="Tickets abiertos" value={summary?.totals.abiertos ?? 0} loading={loading} />
        <KpiTile title="Backlog" value={summary?.totals.backlog ?? 0} loading={loading} />
        <KpiTile
          title="% automatizados"
          value={automationRate}
          suffix="%"
          loading={loading}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TimeSeriesChart
            title="Tickets diarios"
            description="Incluye desagregación por categoría"
            data={data.timeseries ?? undefined}
            loading={loading}
            exportName="municipio-timeseries"
          />
        </div>
        <div className="grid gap-4">
          <WidgetFrame title="SLA - Horas" exportFilename="municipio-sla">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Time to acknowledge</p>
                <p className="text-lg font-semibold">P50: {ack?.p50 ?? 0}h</p>
                <p className="text-xs text-muted-foreground">P90: {ack?.p90 ?? 0}h</p>
                <p className="text-xs text-muted-foreground">P95: {ack?.p95 ?? 0}h</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Time to resolution</p>
                <p className="text-lg font-semibold">P50: {resolve?.p50 ?? 0}h</p>
                <p className="text-xs text-muted-foreground">P90: {resolve?.p90 ?? 0}h</p>
                <p className="text-xs text-muted-foreground">P95: {resolve?.p95 ?? 0}h</p>
              </div>
            </div>
          </WidgetFrame>
          <WidgetFrame title="Eficiencia" exportFilename="municipio-eficiencia">
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-semibold">Primer contacto:</span>{' '}
                {firstContact.toFixed(1)}%
              </p>
              <p>
                <span className="font-semibold">Re-aperturas:</span>{' '}
                {reopenRate.toFixed(1)}%
              </p>
            </div>
          </WidgetFrame>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <StackedBarChart
          title="Tickets por categoría"
          data={data.breakdownCategoria ?? undefined}
          loading={loading}
          exportName="municipio-categorias"
        />
        <DonutChart
          title="Distribución por canal"
          data={data.breakdownCanal ?? undefined}
          loading={loading}
          exportName="municipio-canales"
        />
        <StackedBarChart
          title="Estados"
          data={data.breakdownEstado ?? undefined}
          loading={loading}
          exportName="municipio-estados"
        />
      </section>

      <MapWidget
        title="Mapa de incidencias"
        description="Seleccioná un área para filtrar el resto de widgets"
        heatmap={data.heatmap ?? undefined}
        points={data.points ?? undefined}
        loading={loading}
        exportName="municipio-mapa"
        onBoundingBoxChange={setBoundingBox}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <TopTable
          title="Zonas prioritarias"
          data={data.topZonas ?? undefined}
          loading={loading}
          exportName="municipio-zonas"
        />
        <WidgetFrame title="Calidad" csvData={qualityRows} exportFilename="municipio-calidad">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ámbito</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Respuestas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {qualityRows.map((row) => (
                <TableRow key={row.scope}>
                  <TableCell className="text-sm font-medium">{row.scope}</TableCell>
                  <TableCell className="text-right text-sm">{row.average.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-sm">{row.responses}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </WidgetFrame>
      </section>
    </div>
  );
}
