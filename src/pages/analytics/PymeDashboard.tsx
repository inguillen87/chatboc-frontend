import { useMemo } from 'react';
import { KpiTile } from '@/components/analytics/KpiTile';
import { TimeSeriesChart } from '@/components/analytics/TimeSeriesChart';
import { StackedBarChart } from '@/components/analytics/StackedBarChart';
import { DonutChart } from '@/components/analytics/DonutChart';
import { MapWidget } from '@/components/analytics/MapWidget';
import { WidgetFrame } from '@/components/analytics/WidgetFrame';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAnalyticsDashboard } from '@/hooks/useAnalyticsDashboard';
import { useAnalyticsFilters } from '@/context/AnalyticsFiltersContext';
import { AlertCircle } from 'lucide-react';

export function PymeDashboard() {
  const { data, loading, error, warning } = useAnalyticsDashboard('pyme');
  const { setBoundingBox } = useAnalyticsFilters();

  const summary = data.summary;
  const pymeMetrics = summary?.pyme;
  const cohorts = data.cohorts?.cohorts ?? [];
  const templates = data.templates?.templates ?? [];

  const horasPico = useMemo(() => pymeMetrics?.horasPico ?? [], [pymeMetrics]);
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
        <KpiTile title="Pedidos" value={pymeMetrics?.totalOrders ?? 0} loading={loading} />
        <KpiTile title="Ticket medio" value={pymeMetrics?.ticketMedio ?? 0} loading={loading} />
        <KpiTile title="Conversión" value={pymeMetrics?.conversion ?? 0} suffix="%" loading={loading} />
        <KpiTile
          title="Recompra 30 días"
          value={pymeMetrics?.recurrencia?.d30 ?? 0}
          loading={loading}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TimeSeriesChart
            title="Pedidos diarios"
            description="Incluye ingresos agregados"
            data={data.timeseries ?? undefined}
            loading={loading}
            exportName="pyme-timeseries"
          />
        </div>
        <WidgetFrame title="Horas pico" exportFilename="pyme-horaspico">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {horasPico.map((row) => (
                <TableRow key={row.hour}>
                  <TableCell className="text-sm font-medium">{row.hour}:00</TableCell>
                  <TableCell className="text-right text-sm">{row.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </WidgetFrame>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <StackedBarChart
          title="Pedidos por categoría"
          data={data.breakdownCategoria ?? undefined}
          loading={loading}
          exportName="pyme-categorias"
        />
        <DonutChart
          title="Conversión por canal"
          data={data.breakdownCanal ?? undefined}
          loading={loading}
          exportName="pyme-canales"
        />
        <StackedBarChart
          title="Estados de pedidos"
          data={data.breakdownEstado ?? undefined}
          loading={loading}
          exportName="pyme-estados"
        />
      </section>

      <MapWidget
        title="Mapa de pedidos"
        description="Calor de compras por zona"
        heatmap={data.heatmap ?? undefined}
        points={data.points ?? undefined}
        loading={loading}
        exportName="pyme-mapa"
        onBoundingBoxChange={setBoundingBox}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        <WidgetFrame title="Top productos" exportFilename="pyme-productos" csvData={pymeMetrics?.topProductos}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(pymeMetrics?.topProductos ?? []).map((item) => (
                <TableRow key={item.label}>
                  <TableCell className="text-sm font-medium">{item.label}</TableCell>
                  <TableCell className="text-right text-sm">{item.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </WidgetFrame>
        <WidgetFrame title="Plantillas WhatsApp" exportFilename="pyme-templates" csvData={templates}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plantilla</TableHead>
                <TableHead className="text-right">Envíos</TableHead>
                <TableHead className="text-right">Respuestas</TableHead>
                <TableHead className="text-right">CTR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((item) => (
                <TableRow key={item.plantilla}>
                  <TableCell className="text-sm font-medium">{item.plantilla}</TableCell>
                  <TableCell className="text-right text-sm">{item.envios}</TableCell>
                  <TableCell className="text-right text-sm">{item.respuestas}</TableCell>
                  <TableCell className="text-right text-sm">{item.ctr.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </WidgetFrame>
      </section>

      <WidgetFrame title="Cohortes" exportFilename="pyme-cohortes" csvData={cohorts}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cohorte</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead className="text-right">Ingresos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cohorts.map((cohort) => (
              <TableRow key={cohort.cohort}>
                <TableCell className="text-sm font-medium">{cohort.cohort}</TableCell>
                <TableCell className="text-right text-sm">{cohort.pedidos}</TableCell>
                <TableCell className="text-right text-sm">{cohort.ingresos.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </WidgetFrame>
    </div>
  );
}
