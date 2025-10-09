import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import MapLibreMap from '@/components/MapLibreMap';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { SurveyHeatmapPoint, SurveySummary, SurveyTimeseriesPoint } from '@/types/encuestas';

interface SurveyAnalyticsProps {
  summary?: SurveySummary;
  timeseries?: SurveyTimeseriesPoint[];
  heatmap?: SurveyHeatmapPoint[];
  onExport: () => Promise<void>;
  isExporting?: boolean;
}

const palette = ['#2563eb', '#7c3aed', '#059669', '#ea580c', '#f59e0b', '#db2777'];

const buildTimeseriesData = (points?: SurveyTimeseriesPoint[]) =>
  (points ?? []).map((point) => ({
    fecha: new Date(point.fecha).toLocaleDateString(),
    respuestas: point.respuestas,
  }));

const buildOptionBreakdown = (summary?: SurveySummary) =>
  summary?.preguntas.flatMap((pregunta) =>
    pregunta.opciones.map((opcion) => ({
      pregunta: pregunta.texto,
      opcion: opcion.texto,
      respuestas: opcion.respuestas,
      porcentaje: opcion.porcentaje,
    })),
  ) ?? [];

export const SurveyAnalytics = ({ summary, timeseries, heatmap, onExport, isExporting }: SurveyAnalyticsProps) => {
  const timeseriesData = useMemo(() => buildTimeseriesData(timeseries), [timeseries]);
  const optionData = useMemo(() => buildOptionBreakdown(summary), [summary]);
  const heatmapData = useMemo(
    () =>
      (heatmap ?? [])
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
        .map((point) => ({
          lat: point.lat,
          lng: point.lng,
          weight: point.respuestas,
        })),
    [heatmap],
  );
  const heatmapCenter = useMemo(() => {
    if (!heatmapData.length) return undefined;
    const totalWeight = heatmapData.reduce((sum, point) => sum + (point.weight ?? 1), 0);
    const divisor = totalWeight > 0 ? totalWeight : heatmapData.length;
    const avgLat = heatmapData.reduce((sum, point) => sum + point.lat * (point.weight ?? 1), 0) / divisor;
    const avgLng = heatmapData.reduce((sum, point) => sum + point.lng * (point.weight ?? 1), 0) / divisor;
    if (!Number.isFinite(avgLat) || !Number.isFinite(avgLng)) {
      return undefined;
    }
    return [avgLng, avgLat] as [number, number];
  }, [heatmapData]);
  const heatmapBounds = useMemo(
    () =>
      heatmapData
        .map((point) => [point.lng, point.lat] as [number, number])
        .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat)),
    [heatmapData],
  );

  const completionRateLabel = useMemo(() => {
    if (typeof summary?.tasa_completitud !== 'number') {
      return '—';
    }
    const normalized = Number.isFinite(summary.tasa_completitud)
      ? summary.tasa_completitud
      : Number(summary.tasa_completitud);
    if (!Number.isFinite(normalized)) {
      return '—';
    }
    return `${(normalized * 100).toFixed(1)}%`;
  }, [summary?.tasa_completitud]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Analítica de participación</h2>
          <p className="text-sm text-muted-foreground">Seguimiento de respuestas, canales y preferencias de la comunidad.</p>
        </div>
        <Button onClick={onExport} disabled={isExporting}>
          {isExporting ? 'Generando CSV…' : 'Exportar CSV'}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total de respuestas</CardTitle>
            <CardDescription>Incluye formularios completos recibidos.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {summary?.total_respuestas ?? '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Participantes únicos</CardTitle>
            <CardDescription>Personas distintas, según la política de unicidad.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {summary?.participantes_unicos ?? '—'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tasa de completitud</CardTitle>
            <CardDescription>Porcentaje de formularios finalizados.</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {completionRateLabel}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Evolución diaria</CardTitle>
          <CardDescription>Visualizá el ritmo de participación a lo largo del tiempo.</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {timeseriesData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeseriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="respuestas" stroke="#2563eb" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Aún no hay datos de series temporales.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferencias por opción</CardTitle>
          <CardDescription>Resultados acumulados por pregunta y opción.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="h-72">
            {optionData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={optionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="opcion" interval={0} angle={-25} textAnchor="end" height={90} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="respuestas" fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No hay respuestas registradas para mostrar.
              </div>
            )}
          </div>
          <div className="h-72">
            {optionData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={optionData}
                    dataKey="porcentaje"
                    nameKey="opcion"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    innerRadius={60}
                  >
                    {optionData.map((entry, index) => (
                      <Cell key={`${entry.opcion}-${index}`} fill={palette[index % palette.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Sin datos para graficar.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Canales y campañas</CardTitle>
          <CardDescription>Analizá desde dónde llegan las respuestas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Por canal</h3>
            <Separator className="my-2" />
            <ul className="space-y-2 text-sm">
              {(summary?.canales ?? []).map((item, index) => (
                <li key={`${item.canal}-${index}`} className="flex items-center justify-between">
                  <span className="font-medium capitalize">{item.canal}</span>
                  <span>{item.respuestas}</span>
                </li>
              ))}
              {!summary?.canales?.length && (
                <li className="text-muted-foreground">Sin datos de canales todavía.</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Por UTM</h3>
            <Separator className="my-2" />
            <ul className="space-y-2 text-sm">
              {(summary?.utms ?? []).map((item, index) => (
                <li key={`${item.fuente}-${item.campania ?? 'n/a'}-${index}`} className="flex items-center justify-between">
                  <span>
                    <span className="font-medium">{item.fuente}</span>
                    {item.campania ? <span className="text-muted-foreground"> · {item.campania}</span> : null}
                  </span>
                  <span>{item.respuestas}</span>
                </li>
              ))}
              {!summary?.utms?.length && (
                <li className="text-muted-foreground">Aún no se registraron campañas etiquetadas.</li>
              )}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mapa de calor</CardTitle>
          <CardDescription>Ubicaciones aproximadas de participación (si están disponibles).</CardDescription>
        </CardHeader>
        <CardContent>
          {heatmap?.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2 pr-4">Latitud</th>
                    <th className="py-2 pr-4">Longitud</th>
                    <th className="py-2 pr-4">Respuestas</th>
                  </tr>
                </thead>
                <tbody>
                  {heatmap.map((point, index) => (
                    <tr key={`${point.lat}-${point.lng}-${index}`} className="border-b border-border/40">
                      <td className="py-2 pr-4">{point.lat.toFixed(4)}</td>
                      <td className="py-2 pr-4">{point.lng.toFixed(4)}</td>
                      <td className="py-2 pr-4">{point.respuestas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Todavía no hay datos georreferenciados.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mapa de participación</CardTitle>
          <CardDescription>Ubicaciones aproximadas de las respuestas recibidas.</CardDescription>
        </CardHeader>
        <CardContent className="h-[420px]">
          {heatmapData.length ? (
            <MapLibreMap
              className="h-full rounded-lg"
              center={heatmapCenter}
              heatmapData={heatmapData}
              fitToBounds={heatmapBounds.length ? heatmapBounds : undefined}
              initialZoom={heatmapBounds.length ? 12 : 4}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No hay datos georreferenciados para esta encuesta todavía.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
