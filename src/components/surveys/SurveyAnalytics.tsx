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
import type {
  SurveyDemographicBreakdownItem,
  SurveyHeatmapPoint,
  SurveySummary,
  SurveyTimeseriesPoint,
} from '@/types/encuestas';

interface SurveyAnalyticsProps {
  summary?: SurveySummary;
  timeseries?: SurveyTimeseriesPoint[];
  heatmap?: SurveyHeatmapPoint[];
  onExport: () => Promise<void>;
  isExporting?: boolean;
}

const palette = ['#2563eb', '#7c3aed', '#059669', '#ea580c', '#f59e0b', '#db2777'];
const DEMOGRAPHIC_LABELS: Record<string, string> = {
  genero: 'Género',
  generos: 'Género',
  rango_etario: 'Rango etario',
  rangos_etarios: 'Rangos etarios',
  rangoEtario: 'Rango etario',
  rangosEtarios: 'Rangos etarios',
  pais: 'País',
  paises: 'País',
  provincia: 'Provincia',
  provincias: 'Provincia',
  ciudad: 'Ciudad',
  ciudades: 'Ciudad',
  barrio: 'Barrio',
  barrios: 'Barrio',
};

const normalizeDemographicLabel = (key: string) =>
  DEMOGRAPHIC_LABELS[key] ?? key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase());

const buildDemographicData = (items: SurveyDemographicBreakdownItem[]) =>
  items
    .filter((item) => typeof item?.respuestas === 'number')
    .map((item, index) => {
      const label = item.etiqueta ?? item.clave ?? 'Sin dato';
      return {
        label,
        value: item.respuestas,
        percentage: typeof item.porcentaje === 'number' ? item.porcentaje : undefined,
        key: `${item.clave ?? label}-${index}`,
      };
    });

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getArray = <T = unknown>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (isRecord(value)) {
    const { data, items, results } = value as {
      data?: unknown;
      items?: unknown;
      results?: unknown;
    };
    if (Array.isArray(data)) return data as T[];
    if (Array.isArray(items)) return items as T[];
    if (Array.isArray(results)) return results as T[];
  }
  return [];
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const buildTimeseriesData = (points?: SurveyTimeseriesPoint[] | unknown) =>
  getArray<SurveyTimeseriesPoint>(points).map((point) => ({
    fecha: new Date(point.fecha).toLocaleDateString(),
    respuestas: point.respuestas,
  }));

const buildOptionBreakdown = (summary?: SurveySummary) => {
  if (!summary?.preguntas || !Array.isArray(summary.preguntas)) {
    return [];
  }

  return summary.preguntas.flatMap((pregunta) => {
    if (!pregunta || !Array.isArray(pregunta.opciones) || !pregunta.opciones.length) {
      return [];
    }

    return pregunta.opciones
      .filter((opcion): opcion is NonNullable<typeof opcion> => Boolean(opcion))
      .map((opcion) => ({
        pregunta: pregunta.texto ?? 'Pregunta',
        opcion: opcion.texto,
        respuestas: opcion.respuestas,
        porcentaje: opcion.porcentaje,
      }));
  });
};

const normalizeHeatmapPoints = (points?: SurveyHeatmapPoint[] | unknown): SurveyHeatmapPoint[] =>
  getArray(points)
    .map((rawPoint) => {
      if (!isRecord(rawPoint)) return null;
      const lat = toFiniteNumber(rawPoint.lat);
      const lng = toFiniteNumber(rawPoint.lng ?? rawPoint.lon ?? rawPoint.longitud ?? rawPoint.long);
      const respuestas =
        toFiniteNumber(rawPoint.respuestas ?? rawPoint.weight ?? rawPoint.total ?? rawPoint.count) ?? 0;
      if (lat === null || lng === null) return null;
      return {
        lat,
        lng,
        respuestas,
      } satisfies SurveyHeatmapPoint;
    })
    .filter((point): point is SurveyHeatmapPoint => Boolean(point));

type ChannelBreakdownItem = { canal: string; respuestas: number };

const extractChannelItem = (value: unknown, fallbackCanal?: string | null): ChannelBreakdownItem | null => {
  if (!value && !fallbackCanal) return null;
  const container = isRecord(value) ? value : {};
  const canal = toNonEmptyString(container.canal ?? fallbackCanal);
  const respuestas =
    toFiniteNumber(container.respuestas ?? container.total ?? container.count ?? value) ?? undefined;
  if (!canal || respuestas === undefined) return null;
  return { canal, respuestas };
};

const normalizeChannelBreakdown = (raw: unknown): ChannelBreakdownItem[] => {
  const normalized: ChannelBreakdownItem[] = [];
  for (const item of getArray(raw)) {
    const parsed = extractChannelItem(item);
    if (parsed) normalized.push(parsed);
  }
  if (!normalized.length && isRecord(raw)) {
    const singleItem = extractChannelItem(raw);
    if (singleItem) {
      normalized.push(singleItem);
    } else {
      for (const [key, value] of Object.entries(raw)) {
        const parsed = extractChannelItem(value, key);
        if (parsed) normalized.push(parsed);
      }
    }
  }
  return normalized;
};

type UtmBreakdownItem = { fuente: string; campania?: string; respuestas: number };

const extractUtmItem = (value: unknown, fallbackFuente?: string | null): UtmBreakdownItem | null => {
  if (!value && !fallbackFuente) return null;
  const container = isRecord(value) ? value : {};
  const fuente = toNonEmptyString(container.fuente ?? container.source ?? fallbackFuente);
  const campania = toNonEmptyString(container.campania ?? container.campaign ?? container.nombre ?? container.name);
  const respuestas =
    toFiniteNumber(container.respuestas ?? container.total ?? container.count ?? value) ?? undefined;
  if (!fuente || respuestas === undefined) return null;
  return { fuente, campania: campania ?? undefined, respuestas };
};

const normalizeUtmBreakdown = (raw: unknown): UtmBreakdownItem[] => {
  const normalized: UtmBreakdownItem[] = [];
  for (const item of getArray(raw)) {
    const parsed = extractUtmItem(item);
    if (parsed) normalized.push(parsed);
  }
  if (!normalized.length && isRecord(raw)) {
    const singleItem = extractUtmItem(raw);
    if (singleItem) {
      normalized.push(singleItem);
    } else {
      for (const [key, value] of Object.entries(raw)) {
        const parsed = extractUtmItem(value, key);
        if (parsed) normalized.push(parsed);
      }
    }
  }
  return normalized;
};

export const SurveyAnalytics = ({ summary, timeseries, heatmap, onExport, isExporting }: SurveyAnalyticsProps) => {
  const timeseriesData = useMemo(() => buildTimeseriesData(timeseries), [timeseries]);
  const optionData = useMemo(() => buildOptionBreakdown(summary), [summary]);
  const heatmapPoints = useMemo(() => normalizeHeatmapPoints(heatmap), [heatmap]);
  const heatmapData = useMemo(
    () =>
      heatmapPoints.map((point) => ({
        lat: point.lat,
        lng: point.lng,
        weight: point.respuestas,
      })),
    [heatmapPoints],
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
  const channelBreakdown = useMemo(() => normalizeChannelBreakdown(summary?.canales), [summary?.canales]);
  const utmBreakdown = useMemo(() => normalizeUtmBreakdown(summary?.utms), [summary?.utms]);

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

  const demographicSections = useMemo(() => {
    if (!summary?.demografia) return [] as Array<{
      id: string;
      title: string;
      data: ReturnType<typeof buildDemographicData>;
    }>;

    return Object.entries(summary.demografia)
      .map(([id, items]) => {
        if (!Array.isArray(items) || !items.length) return null;
        const data = buildDemographicData(items);
        if (!data.length) return null;
        return {
          id,
          title: normalizeDemographicLabel(id),
          data,
        };
      })
      .filter((section): section is { id: string; title: string; data: ReturnType<typeof buildDemographicData> } => Boolean(section));
  }, [summary?.demografia]);

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
              {channelBreakdown.map((item, index) => (
                <li key={`${item.canal}-${index}`} className="flex items-center justify-between">
                  <span className="font-medium capitalize">{item.canal}</span>
                  <span>{item.respuestas}</span>
                </li>
              ))}
              {!channelBreakdown.length && (
                <li className="text-muted-foreground">Sin datos de canales todavía.</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Por UTM</h3>
            <Separator className="my-2" />
            <ul className="space-y-2 text-sm">
              {utmBreakdown.map((item, index) => (
                <li key={`${item.fuente}-${item.campania ?? 'n/a'}-${index}`} className="flex items-center justify-between">
                  <span>
                    <span className="font-medium">{item.fuente}</span>
                    {item.campania ? <span className="text-muted-foreground"> · {item.campania}</span> : null}
                  </span>
                  <span>{item.respuestas}</span>
                </li>
              ))}
              {!utmBreakdown.length && (
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
          {heatmapPoints.length ? (
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
                  {heatmapPoints.map((point, index) => (
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
      {demographicSections.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Segmentación demográfica</CardTitle>
            <CardDescription>Distribución de respuestas según género, edad y territorio declarado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {demographicSections.map((section, sectionIndex) => (
              <div key={section.id} className="space-y-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {section.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Participación segmentada para este atributo.
                  </p>
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={section.data}
                      layout="vertical"
                      margin={{ left: 0, right: 16, top: 16, bottom: 16 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={160}
                        tick={{ fontSize: 12 }}
                        interval={0}
                      />
                      <Tooltip
                        formatter={(value: number, _name, payload) => {
                          const percentage = payload?.payload?.percentage;
                          return percentage
                            ? [`${value} respuestas (${percentage.toFixed(1)}%)`, '']
                            : [`${value} respuestas`, ''];
                        }}
                      />
                      <Bar dataKey="value" fill={palette[sectionIndex % palette.length]}>
                        {section.data.map((item, index) => (
                          <Cell key={item.key} fill={palette[(sectionIndex + index) % palette.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
