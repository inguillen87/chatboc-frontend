import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch, ApiError } from '@/utils/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import ChartTooltip from '@/components/analytics/ChartTooltip';
import TicketStatsCharts from '@/components/TicketStatsCharts';
import { AnalyticsHeatmap } from '@/components/analytics/Heatmap';
import {
  getHeatmapPoints,
  getTicketStats,
  HeatPoint,
  TicketStatsResponse,
} from '@/services/statsService';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Municipality {
  name: string;
  totalTickets: number;
  categories: Record<string, number>;
  averageResponseHours: number;
  statuses?: Record<string, number>;
  genderBreakdown?: Record<string, number>;
  ageRanges?: Record<string, number>;
}

interface AnalyticsResponse {
  municipalities: Municipality[];
  genderTotals?: Record<string, number>;
  ageRanges?: Record<string, number>;
  statusTotals?: Record<string, number>;
}

type SortOption = 'tickets_desc' | 'response_asc' | 'response_desc';

const STATUS_COLOR_PALETTE = Array.from({ length: 12 }, (_, idx) => `var(--chart-${idx + 1})`);

const formatLabel = (value: string) =>
  value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');

const safeNumber = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

export default function MunicipalAnalytics() {
  useRequireRole(['admin', 'super_admin'] as Role[]);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<SortOption>('tickets_desc');
  const [heatmapData, setHeatmapData] = useState<HeatPoint[]>([]);
  const [charts, setCharts] = useState<TicketStatsResponse['charts']>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    if (categoryFilter !== 'all') qs.append('categoria', categoryFilter);
    if (genderFilter) qs.append('genero', genderFilter);
    if (ageMin) qs.append('edad_min', ageMin);
    if (ageMax) qs.append('edad_max', ageMax);
    statusFilters
      .filter((status) => status)
      .forEach((status) => qs.append('estado', status));

    try {
      const analyticsResponse = await apiFetch<AnalyticsResponse>(
        `/municipal/analytics${qs.toString() ? `?${qs.toString()}` : ''}`,
      );
      setData(analyticsResponse);

      const statsParams = {
        tipo: 'municipio',
        categoria: categoryFilter !== 'all' ? categoryFilter : undefined,
        genero: genderFilter || undefined,
        edad_min: ageMin || undefined,
        edad_max: ageMax || undefined,
        estado: statusFilters.length > 0 ? statusFilters : undefined,
      };

      const [statsResult, heatmapResult] = await Promise.allSettled([
        getTicketStats(statsParams),
        getHeatmapPoints({
          tipo_ticket: 'municipio',
          categoria: categoryFilter !== 'all' ? categoryFilter : undefined,
          genero: genderFilter || undefined,
          edad_min: ageMin || undefined,
          edad_max: ageMax || undefined,
          estado: statusFilters.length > 0 ? statusFilters : undefined,
        }),
      ]);

      if (statsResult.status === 'fulfilled') {
        setCharts(statsResult.value.charts || []);
      } else {
        setCharts([]);
        console.error('Error fetching ticket stats:', statsResult.reason);
      }

      if (heatmapResult.status === 'fulfilled') {
        setHeatmapData(heatmapResult.value);
      } else {
        setHeatmapData([]);
        console.error('Error fetching heatmap data:', heatmapResult.reason);
      }
    } catch (err: any) {
      const message =
        err instanceof ApiError ? err.message : 'Error al cargar analíticas.';
      setError(message);
      setData(null);
      setHeatmapData([]);
      setCharts([]);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, genderFilter, ageMin, ageMax, statusFilters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statusKeys = useMemo(() => {
    const set = new Set<string>();
    if (data?.statusTotals) {
      Object.keys(data.statusTotals).forEach((status) => {
        if (status) set.add(status);
      });
    }
    data?.municipalities.forEach((m) => {
      Object.keys(m.statuses || {}).forEach((status) => {
        if (status) set.add(status);
      });
    });
    return Array.from(set);
  }, [data]);

  useEffect(() => {
    setStatusFilters((prev) => {
      if (prev.length === 0) return prev;
      const filtered = prev.filter((status) => statusKeys.includes(status));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [statusKeys]);

  const allCategories = useMemo(
    () =>
      Array.from(
        new Set(
          data?.municipalities.flatMap((m) => Object.keys(m.categories || {})) || [],
        ),
      ),
    [data],
  );

  const filteredMunicipalities = useMemo(() => {
    if (!data) return [] as Municipality[];
    if (statusFilters.length === 0) return data.municipalities;
    return data.municipalities.filter((m) => {
      if (!m.statuses) return true;
      return statusFilters.some((status) => safeNumber(m.statuses?.[status]) > 0);
    });
  }, [data, statusFilters]);

  const sortedMunicipalities = useMemo(() => {
    const entries = [...filteredMunicipalities];
    switch (sortOption) {
      case 'response_asc':
        return entries.sort(
          (a, b) => safeNumber(a.averageResponseHours) - safeNumber(b.averageResponseHours),
        );
      case 'response_desc':
        return entries.sort(
          (a, b) => safeNumber(b.averageResponseHours) - safeNumber(a.averageResponseHours),
        );
      default:
        return entries.sort((a, b) => {
          const aValue =
            categoryFilter === 'all'
              ? safeNumber(a.totalTickets)
              : safeNumber(a.categories?.[categoryFilter]);
          const bValue =
            categoryFilter === 'all'
              ? safeNumber(b.totalTickets)
              : safeNumber(b.categories?.[categoryFilter]);
          return bValue - aValue;
        });
    }
  }, [filteredMunicipalities, sortOption, categoryFilter]);

  const totalTickets = useMemo(
    () =>
      filteredMunicipalities.reduce((acc, m) => {
        const value =
          categoryFilter === 'all'
            ? safeNumber(m.totalTickets)
            : safeNumber(m.categories?.[categoryFilter]);
        return acc + value;
      }, 0),
    [filteredMunicipalities, categoryFilter],
  );

  const responseValues = useMemo(
    () =>
      filteredMunicipalities
        .map((m) => m.averageResponseHours)
        .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value)),
    [filteredMunicipalities],
  );

  const averageResponseHours = responseValues.length
    ? responseValues.reduce((sum, value) => sum + value, 0) / responseValues.length
    : 0;

  const categoryTotals = useMemo(
    () =>
      allCategories.map((category) => ({
        name: category,
        value: filteredMunicipalities.reduce(
          (sum, m) => sum + safeNumber(m.categories?.[category]),
          0,
        ),
      })),
    [allCategories, filteredMunicipalities],
  );

  const chartData = useMemo(
    () =>
      sortedMunicipalities.map((m) => ({
        name: m.name,
        value:
          categoryFilter === 'all'
            ? safeNumber(m.totalTickets)
            : safeNumber(m.categories?.[categoryFilter]),
      })),
    [sortedMunicipalities, categoryFilter],
  );

  const genderData = useMemo(
    () =>
      data?.genderTotals
        ? Object.entries(data.genderTotals).map(([name, value]) => ({
            name,
            value: safeNumber(value),
          }))
        : [],
    [data],
  );

  const ageData = useMemo(
    () =>
      data?.ageRanges
        ? Object.entries(data.ageRanges).map(([name, value]) => ({
            name,
            value: safeNumber(value),
          }))
        : [],
    [data],
  );

  const statusColors = useMemo(
    () =>
      statusKeys.reduce((acc, status, index) => {
        acc[status] = STATUS_COLOR_PALETTE[index % STATUS_COLOR_PALETTE.length];
        return acc;
      }, {} as Record<string, string>),
    [statusKeys],
  );

  const statusSummary = useMemo(
    () =>
      statusKeys.map((status) => {
        const totalFromResponse = safeNumber(data?.statusTotals?.[status]);
        const aggregated = safeNumber(
          data?.municipalities.reduce(
            (sum, m) => sum + safeNumber(m.statuses?.[status]),
            0,
          ),
        );
        return { status, value: totalFromResponse || aggregated };
      }),
    [data, statusKeys],
  );

  const stackedStatusData = useMemo(
    () =>
      sortedMunicipalities.map((m) => ({
        name: m.name,
        ...statusKeys.reduce((acc, status) => {
          acc[status] = safeNumber(m.statuses?.[status]);
          return acc;
        }, {} as Record<string, number>),
      })),
    [sortedMunicipalities, statusKeys],
  );

  const heatmapCategories = useMemo(
    () =>
      Array.from(
        new Set(
          heatmapData
            .map((point) => point.categoria)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [heatmapData],
  );

  const heatmapBarrios = useMemo(
    () =>
      Array.from(
        new Set(
          heatmapData
            .map((point) => point.barrio)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [heatmapData],
  );

  const heatmapTipos = useMemo(
    () =>
      Array.from(
        new Set(
          heatmapData
            .map((point) => point.tipo_ticket)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [heatmapData],
  );

  const updateStatusFilter = useCallback((status: string, checked: boolean) => {
    setStatusFilters((prev) => {
      if (checked) {
        if (prev.includes(status)) return prev;
        return [...prev, status];
      }
      return prev.filter((item) => item !== status);
    });
  }, []);

  if (loading) return <p className="p-4 text-center">Cargando analíticas...</p>;
  if (error) return <p className="p-4 text-destructive text-center">Error: {error}</p>;
  if (!data || filteredMunicipalities.length === 0)
    return (
      <p className="p-4 text-center text-muted-foreground">
        No hay datos disponibles con los filtros actuales.
      </p>
    );

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-extrabold text-primary mb-4">Analíticas Profesionales</h1>

      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label className="text-sm">Categoría</Label>
            <select
              className="mt-1 border rounded p-2 bg-background"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">Todas</option>
              {allCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-sm">Género</Label>
            <select
              className="mt-1 border rounded p-2 bg-background"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
              <option value="X">Otro</option>
            </select>
          </div>
          <div>
            <Label className="text-sm">Edad mínima</Label>
            <input
              type="number"
              className="mt-1 border rounded p-2 w-24 bg-background"
              value={ageMin}
              onChange={(e) => setAgeMin(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-sm">Edad máxima</Label>
            <input
              type="number"
              className="mt-1 border rounded p-2 w-24 bg-background"
              value={ageMax}
              onChange={(e) => setAgeMax(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-sm">Ordenar por</Label>
            <Select value={sortOption} onValueChange={(value: SortOption) => setSortOption(value)}>
              <SelectTrigger className="mt-1 w-48">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tickets_desc">Mayor cantidad de tickets</SelectItem>
                <SelectItem value="response_asc">Menor tiempo de respuesta</SelectItem>
                <SelectItem value="response_desc">Mayor tiempo de respuesta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={fetchData}
          >
            Aplicar filtros
          </Button>
        </div>

        {statusKeys.length > 0 && (
          <div>
            <Label className="text-sm font-medium">Estados</Label>
            <div className="mt-2 flex flex-wrap gap-3">
              {statusKeys.map((status) => (
                <label key={status} className="flex items-center gap-2 text-sm text-foreground">
                  <Checkbox
                    checked={statusFilters.includes(status)}
                    onCheckedChange={(checked) => updateStatusFilter(status, checked === true)}
                  />
                  <span>{formatLabel(status)}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {statusSummary.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {statusSummary.map(({ status, value }) => (
            <Card key={status}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{formatLabel(status)}</CardTitle>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: statusColors[status] }}
                  aria-hidden
                />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{safeNumber(value).toLocaleString('es-AR')}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
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
            <div className="text-2xl font-bold">{totalTickets.toLocaleString('es-AR')}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio de Respuesta (h)</CardTitle>
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
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Number.isFinite(averageResponseHours)
                ? averageResponseHours.toFixed(2)
                : '0.00'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Tickets por Municipio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip cursor={false} content={<ChartTooltip />} />
                <Legend />
                <Bar dataKey="value" fill="var(--color-value)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Distribución por Categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryTotals}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                >
                  {categoryTotals.map((entry, index) => (
                    <Cell key={`cell-${entry.name}`} fill={`var(--chart-${(index % 12) + 1})`} />
                  ))}
                </Pie>
                <Tooltip cursor={false} content={<ChartTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {statusKeys.length > 0 && stackedStatusData.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Estados por Municipio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stackedStatusData}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip cursor={false} content={<ChartTooltip />} />
                  <Legend />
                  {statusKeys.map((status) => (
                    <Bar
                      key={status}
                      dataKey={status}
                      stackId="status"
                      fill={statusColors[status]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {genderData.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Distribución por Género</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={genderData}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip cursor={false} content={<ChartTooltip />} />
                  <Legend />
                  <Bar dataKey="value" fill="var(--color-gender)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {ageData.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Distribución por Rango Etario</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageData}>
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip cursor={false} content={<ChartTooltip />} />
                  <Legend />
                  <Bar dataKey="value" fill="var(--color-age)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Detalle por Municipio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Municipio</TableHead>
                <TableHead>
                  {categoryFilter === 'all'
                    ? 'Tickets Totales'
                    : `Tickets (${formatLabel(categoryFilter)})`}
                </TableHead>
                <TableHead>Prom. respuesta (h)</TableHead>
                {statusKeys.map((status) => (
                  <TableHead key={status}>{formatLabel(status)}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMunicipalities.map((m) => (
                <TableRow key={m.name}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>
                    {(
                      categoryFilter === 'all'
                        ? safeNumber(m.totalTickets)
                        : safeNumber(m.categories?.[categoryFilter])
                    ).toLocaleString('es-AR')}
                  </TableCell>
                  <TableCell>
                    {typeof m.averageResponseHours === 'number' && !Number.isNaN(m.averageResponseHours)
                      ? m.averageResponseHours.toFixed(2)
                      : '—'}
                  </TableCell>
                  {statusKeys.map((status) => (
                    <TableCell key={status}>
                      {safeNumber(m.statuses?.[status]).toLocaleString('es-AR')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {charts && charts.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Indicadores adicionales</CardTitle>
          </CardHeader>
          <CardContent>
            <TicketStatsCharts charts={charts} />
          </CardContent>
        </Card>
      )}

      {heatmapData.length > 0 ? (
        <AnalyticsHeatmap
          initialHeatmapData={heatmapData}
          availableCategories={heatmapCategories}
          availableBarrios={heatmapBarrios}
          availableTipos={heatmapTipos}
        />
      ) : (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Mapa de Calor</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No hay datos georreferenciados para mostrar con los filtros actuales.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
