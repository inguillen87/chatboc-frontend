import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch, getErrorMessage } from '@/utils/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart';
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
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import { FileDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  exportMunicipalStatsExcel,
  exportMunicipalStatsPdf,
} from '@/services/exportService';

interface StatItem {
  label: string;
  value: number;
  unit?: string;
}

type CountMetric = {
  name: string;
  count: number;
};

type ValueMetric = {
  name: string;
  value: number;
};

interface MonthlyTrendMetric {
  month: string;
  label: string;
  nuevos: number;
  resueltos: number;
  vencidos: number;
  reabiertos: number;
}

interface SatisfactionTrendMetric {
  month: string;
  label: string;
  average: number;
}

interface BacklogMetric {
  range: string;
  count: number;
}

interface CategoryResolutionMetric {
  category: string;
  avgHours: number;
}

interface HeatmapCell {
  timeSlot: string;
  count: number;
}

interface HeatmapRow {
  day: string;
  slots: HeatmapCell[];
}

interface AgentPerformanceMetric {
  agent: string;
  tickets: number;
  resolved: number;
  sla: number;
  satisfaction: number;
  firstResponse: number;
}

interface StatsResponse {
  stats: StatItem[];
  categoryBreakdown?: CountMetric[];
  statusBreakdown?: ValueMetric[];
  priorityBreakdown?: CountMetric[];
  channelBreakdown?: CountMetric[];
  barrioBreakdown?: CountMetric[];
  monthlyTrend?: MonthlyTrendMetric[];
  satisfactionTrend?: SatisfactionTrendMetric[];
  satisfactionSummary?: {
    average: number;
    nps: number;
    promoters: number;
    passives: number;
    detractors: number;
    responseRate: number;
  };
  satisfactionDistribution?: ValueMetric[];
  heatmap?: HeatmapRow[];
  backlogAging?: BacklogMetric[];
  categoryResolution?: CategoryResolutionMetric[];
  agentPerformance?: AgentPerformanceMetric[];
}

interface Filters {
  rubros: string[];
  barrios: string[];
  tipos: string[];
  rangos: string[];
}

type FiltersApiResponse = Partial<Filters>;

const FALLBACK_TIME_SLOTS = ['Mañana', 'Mediodía', 'Tarde', 'Noche'];

const FALLBACK_PIE_COLORS = [
  '#2563eb',
  '#16a34a',
  '#f97316',
  '#a855f7',
  '#0ea5e9',
  '#f43f5e',
  '#facc15',
  '#10b981',
];

function formatValue(value: number) {
  if (Number.isNaN(value)) return '0';
  if (Number.isInteger(value)) return value.toLocaleString('es-AR');
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
  });
}

export default function MunicipalStats() {
  useRequireRole(['admin', 'super_admin'] as Role[]);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
    rubros: [],
    barrios: [],
    tipos: [],
    rangos: [],
  });
  const [activeFilters, setActiveFilters] = useState({
    rubro: '',
    barrio: '',
    tipo: '',
    rango: '',
  });

  useEffect(() => {
    let active = true;
    apiFetch<FiltersApiResponse>('/municipal/stats/filters')
      .then((resp) => {
        if (!active) return;
        setFilters({
          rubros: resp.rubros || [],
          barrios: resp.barrios || [],
          tipos: resp.tipos || [],
          rangos: resp.rangos || [],
        });
      })
      .catch((err) => {
        console.error('Failed to fetch municipal stats filters:', err);
      });
    return () => {
      active = false;
    };
  }, []);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    const params = new URLSearchParams();
    if (activeFilters.rubro) params.append('rubro', activeFilters.rubro);
    if (activeFilters.barrio) params.append('barrio', activeFilters.barrio);
    if (activeFilters.tipo) params.append('tipo', activeFilters.tipo);
    if (activeFilters.rango) params.append('rango', activeFilters.rango);

    try {
      const resp = await apiFetch<StatsResponse>(
        `/municipal/stats?${params.toString()}`,
      );
      setData(resp);
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudieron cargar las estadísticas.'));
    } finally {
      setLoading(false);
    }
  }, [activeFilters]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const statsExportConfig = useMemo(() => {
    if (!data) return null;
    return {
      data,
      filters: {
        rubro: activeFilters.rubro || 'Todos',
        barrio: activeFilters.barrio || 'Todos',
        tipo: activeFilters.tipo || 'Todos',
        rango: activeFilters.rango || 'Todos',
      },
      usingFallback: false,
    };
  }, [data, activeFilters]);

  const canExportStats = Boolean(statsExportConfig);

  const handleExportStatsPdf = useCallback(() => {
    if (!statsExportConfig) return;
    exportMunicipalStatsPdf(statsExportConfig);
  }, [statsExportConfig]);

  const handleExportStatsExcel = useCallback(() => {
    if (!statsExportConfig) return;
    exportMunicipalStatsExcel(statsExportConfig);
  }, [statsExportConfig]);

  const heatmapMax = useMemo(() => {
    if (!data?.heatmap?.length) return 0;
    return data.heatmap.reduce((max, row) => {
      const rowMax = row.slots.reduce(
        (slotMax, slot) => Math.max(slotMax, slot.count),
        0,
      );
      return Math.max(max, rowMax);
    }, 0);
  }, [data]);

  const timeSlots =
    data?.heatmap?.[0]?.slots.map((slot) => slot.timeSlot) ||
    FALLBACK_TIME_SLOTS;

  const renderContent = () => {
    if (loading)
      return <p className="p-4 text-center">Cargando estadísticas...</p>;

    if (error)
      return (
        <>
          <p className="p-4 text-destructive bg-destructive/10 rounded-md text-center">
            Error: {error}
          </p>
          <Button onClick={fetchStats} className="w-full">
            Reintentar
          </Button>
        </>
      );

    if (!data || !Array.isArray(data.stats) || data.stats.length === 0)
      return (
        <p className="p-4 text-center text-muted-foreground">
          No hay estadísticas disponibles con los filtros actuales.
        </p>
      );

    return (
      <>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.stats.map((item) => (
            <Card key={item.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  className="h-4 w-4 text-muted-foreground"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatValue(item.value)}
                  {item.unit ? (
                    <span className="ml-1 text-sm font-semibold text-muted-foreground">
                      {item.unit}
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {data.categoryBreakdown?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Tickets por categoría</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ChartContainer
                    config={{ tickets: { label: 'Tickets', color: '#2563eb' } }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.categoryBreakdown.map((item) => ({
                          name: item.name,
                          tickets: item.count,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          tickFormatter={(value) => value.slice(0, 14)}
                        />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="tickets"
                          fill="var(--color-tickets)"
                          radius={4}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {data.statusBreakdown?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Tickets por estado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ChartContainer config={{ estados: { label: 'Estado' } }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.statusBreakdown}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={60}
                          outerRadius={110}
                          paddingAngle={3}
                          label
                        >
                          {data.statusBreakdown.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={
                                FALLBACK_PIE_COLORS[
                                  index % FALLBACK_PIE_COLORS.length
                                ]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {data.priorityBreakdown?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Prioridad de tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ChartContainer
                    config={{ tickets: { label: 'Tickets', color: '#0ea5e9' } }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.priorityBreakdown.map((item) => ({
                          name: item.name,
                          tickets: item.count,
                        }))}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis dataKey="name" type="category" width={90} />
                        <Tooltip />
                        <Bar
                          dataKey="tickets"
                          fill="var(--color-tickets)"
                          radius={4}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {data.channelBreakdown?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Canales de ingreso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ChartContainer
                    config={{ tickets: { label: 'Tickets', color: '#f97316' } }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.channelBreakdown.map((item) => ({
                          name: item.name,
                          tickets: item.count,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          tickFormatter={(value) => value.slice(0, 14)}
                        />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="tickets"
                          fill="var(--color-tickets)"
                          radius={4}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {data.monthlyTrend?.length ? (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">
                Evolución mensual de tickets
              </CardTitle>
              <CardDescription>
                Comparativo de tickets nuevos, resueltos, vencidos y reabiertos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ChartContainer
                  config={{
                    nuevos: { label: 'Nuevos', color: '#2563eb' },
                    resueltos: { label: 'Resueltos', color: '#16a34a' },
                    vencidos: { label: 'Vencidos', color: '#f97316' },
                    reabiertos: { label: 'Reabiertos', color: '#f59e0b' },
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="nuevos"
                        stroke="var(--color-nuevos)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="resueltos"
                        stroke="var(--color-resueltos)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="vencidos"
                        stroke="var(--color-vencidos)"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="reabiertos"
                        stroke="var(--color-reabiertos)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {data.satisfactionTrend?.length ||
        data.satisfactionDistribution?.length ? (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xl">
                Satisfacción de personas usuarias
              </CardTitle>
              <CardDescription>
                Seguimiento de encuestas, NPS y distribución de respuestas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.satisfactionSummary ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6 text-sm">
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Promedio general</p>
                    <p className="text-lg font-semibold">
                      {formatValue(data.satisfactionSummary.average)}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">NPS</p>
                    <p className="text-lg font-semibold">
                      {data.satisfactionSummary.nps}%
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Promotores</p>
                    <p className="text-lg font-semibold">
                      {data.satisfactionSummary.promoters}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Tasa de respuesta</p>
                    <p className="text-lg font-semibold">
                      {data.satisfactionSummary.responseRate}%
                    </p>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-6 lg:grid-cols-2">
                {data.satisfactionTrend?.length ? (
                  <div className="h-72">
                    <ChartContainer
                      config={{
                        average: { label: 'Promedio', color: '#0ea5e9' },
                      }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.satisfactionTrend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="label" />
                          <YAxis domain={[0, 5]} allowDecimals />
                          <Tooltip />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="average"
                            stroke="var(--color-average)"
                            strokeWidth={2}
                            dot
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                ) : null}

                {data.satisfactionDistribution?.length ? (
                  <div className="h-72">
                    <ChartContainer
                      config={{ distribucion: { label: 'Distribución' } }}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.satisfactionDistribution}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={50}
                            outerRadius={110}
                            paddingAngle={4}
                            label
                          >
                            {data.satisfactionDistribution.map(
                              (entry, index) => (
                                <Cell
                                  key={entry.name}
                                  fill={
                                    FALLBACK_PIE_COLORS[
                                      (index + 3) % FALLBACK_PIE_COLORS.length
                                    ]
                                  }
                                />
                              ),
                            )}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {data.heatmap?.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                Mapa de calor de ingresos
              </CardTitle>
              <CardDescription>
                Distribución de tickets por día de la semana y franja horaria
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div
                  className="grid gap-2 text-xs sm:text-sm"
                  style={{
                    gridTemplateColumns: `auto repeat(${timeSlots.length}, minmax(0, 1fr))`,
                  }}
                >
                  <div className="font-semibold text-muted-foreground" />
                  {timeSlots.map((slot) => (
                    <div
                      key={slot}
                      className="text-center font-medium text-muted-foreground"
                    >
                      {slot}
                    </div>
                  ))}
                  {data.heatmap.map((row) => (
                    <React.Fragment key={row.day}>
                      <div className="flex items-center font-medium text-muted-foreground">
                        {row.day}
                      </div>
                      {timeSlots.map((slot) => {
                        const cell = row.slots.find((s) => s.timeSlot === slot);
                        const value = cell?.count ?? 0;
                        const intensity = heatmapMax ? value / heatmapMax : 0;
                        const background = `rgba(37, 99, 235, ${
                          0.12 + intensity * 0.6
                        })`;
                        const color =
                          intensity > 0.55
                            ? 'var(--background)'
                            : 'var(--foreground)';
                        return (
                          <div
                            key={`${row.day}-${slot}`}
                            className="rounded-md p-2 text-center font-semibold"
                            style={{ backgroundColor: background, color }}
                          >
                            {value}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {data.barrioBreakdown?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Volumen por zona</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ChartContainer
                    config={{ tickets: { label: 'Tickets', color: '#9333ea' } }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.barrioBreakdown.map((item) => ({
                          name: item.name,
                          tickets: item.count,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          tickFormatter={(value) => value.slice(0, 14)}
                        />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar
                          dataKey="tickets"
                          fill="var(--color-tickets)"
                          radius={4}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {data.categoryResolution?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">
                  Tiempo de resolución por categoría
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ChartContainer
                    config={{ avgHours: { label: 'Horas', color: '#14b8a6' } }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.categoryResolution}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="category"
                          tickFormatter={(value) => value.slice(0, 14)}
                        />
                        <YAxis allowDecimals />
                        <Tooltip
                          formatter={(value: number) => `${formatValue(value)} h`}
                        />
                        <Legend />
                        <Bar
                          dataKey="avgHours"
                          fill="var(--color-avgHours)"
                          radius={4}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {data.backlogAging?.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">
                Antigüedad de tickets pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ChartContainer
                  config={{ tickets: { label: 'Tickets', color: '#facc15' } }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.backlogAging.map((item) => ({
                        range: item.range,
                        tickets: item.count,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="tickets"
                        fill="var(--color-tickets)"
                        radius={4}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {data.agentPerformance?.length ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Desempeño de equipos</CardTitle>
              <CardDescription>
                Resolución, SLA y tiempos de respuesta promedio por equipo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Tickets</TableHead>
                    <TableHead>Resueltos</TableHead>
                    <TableHead>Cumplimiento SLA</TableHead>
                    <TableHead>Satisfacción</TableHead>
                    <TableHead>1ª respuesta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.agentPerformance.map((agent) => (
                    <TableRow key={agent.agent}>
                      <TableCell className="font-medium">
                        {agent.agent}
                      </TableCell>
                      <TableCell>{agent.tickets}</TableCell>
                      <TableCell>{agent.resolved}</TableCell>
                      <TableCell>{agent.sla}%</TableCell>
                      <TableCell>{formatValue(agent.satisfaction)}</TableCell>
                      <TableCell>
                        {formatValue(agent.firstResponse)} h
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableCaption>
                  Información provista por la plataforma municipal.
                </TableCaption>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </>
    );
  };

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-primary">
            Estadísticas Municipales
          </h1>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              disabled={!canExportStats}
            >
              <FileDown className="h-4 w-4" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={handleExportStatsPdf}
              disabled={!canExportStats}
            >
              Exportar PDF
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleExportStatsExcel}
              disabled={!canExportStats}
            >
              Exportar Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Accordion type="single" collapsible className="w-full" defaultValue="filters">
        <AccordionItem value="filters">
          <AccordionTrigger>Filtros</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {filters.rubros.length > 0 && (
                <Select
                  value={activeFilters.rubro}
                  onValueChange={(value) =>
                    setActiveFilters((f) => ({ ...f, rubro: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Rubro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {filters.rubros.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {filters.barrios.length > 0 && (
                <Select
                  value={activeFilters.barrio}
                  onValueChange={(value) =>
                    setActiveFilters((f) => ({ ...f, barrio: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Barrio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {filters.barrios.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {filters.tipos.length > 0 && (
                <Select
                  value={activeFilters.tipo}
                  onValueChange={(value) =>
                    setActiveFilters((f) => ({ ...f, tipo: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {filters.tipos.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {filters.rangos.length > 0 && (
                <Select
                  value={activeFilters.rango}
                  onValueChange={(value) =>
                    setActiveFilters((f) => ({ ...f, rango: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {filters.rangos.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button onClick={fetchStats} className="w-full">
              Aplicar filtros
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {renderContent()}
    </div>
  );
}

