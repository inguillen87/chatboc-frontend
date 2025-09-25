import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch, ApiError, getErrorMessage } from '@/utils/api';
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
  getMunicipalTicketStates,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertCircle, FileDown } from 'lucide-react';
import {
  exportMunicipalAnalyticsExcel,
  exportMunicipalAnalyticsPdf,
} from '@/services/exportService';

interface Municipality {
  name: string;
  totalTickets: number;
  categories: Record<string, number>;
  averageResponseHours?: number | null;
  statuses?: Record<string, number>;
  genderBreakdown?: Record<string, number>;
  ageRanges?: Record<string, number>;
}

interface AnalyticsResponse {
  municipalities: Municipality[];
  genderTotals?: Record<string, number>;
  ageRanges?: Record<string, number>;
  statusTotals?: Record<string, number>;
  charts?: TicketStatsResponse['charts'];
  heatmap?: HeatPoint[];
}

type SortOption = 'tickets_desc' | 'response_asc' | 'response_desc';

const STATUS_COLOR_PALETTE = Array.from({ length: 12 }, (_, idx) => `var(--chart-${idx + 1})`);
const MUNICIPAL_ANALYTICS_PATH = '/municipal/analytics';

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

const getResponseHours = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

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
  const [allowedStatuses, setAllowedStatuses] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    getMunicipalTicketStates()
      .then((states) => {
        if (!active) return;
        setAllowedStatuses(states);
      })
      .catch((err) => {
        if (!active) return;
        setAllowedStatuses([]);
        console.error('Error fetching allowed municipal states:', err);
      });
    return () => {
      active = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);

    const qs = new URLSearchParams();
    if (categoryFilter !== 'all') qs.append('categoria', categoryFilter);
    if (genderFilter) qs.append('genero', genderFilter);
    if (ageMin) qs.append('edad_min', ageMin);
    if (ageMax) qs.append('edad_max', ageMax);
    statusFilters
      .filter((status) => status)
      .forEach((status) => qs.append('estado', status));

    try {
      const response = await apiFetch<AnalyticsResponse>(
        `${MUNICIPAL_ANALYTICS_PATH}${qs.toString() ? `?${qs.toString()}` : ''}`,
      );
      setData(response);
    } catch (err: any) {
      const message = getErrorMessage(err, 'No se pudieron cargar las analíticas.');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, genderFilter, ageMin, ageMax, statusFilters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const statusTotals = useMemo(
    () => data?.statusTotals ?? {},
    [data?.statusTotals],
  );

  const statusKeys = useMemo(() => {
    const set = new Set<string>(allowedStatuses.filter(Boolean));
    Object.keys(statusTotals).forEach((status) => {
      if (status) set.add(status);
    });
    data?.municipalities?.forEach((m) => {
      Object.keys(m.statuses || {}).forEach((status) => {
        if (status) set.add(status);
      });
    });
    return Array.from(set);
  }, [allowedStatuses, data?.municipalities, statusTotals]);

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
          data?.municipalities?.flatMap((m) => Object.keys(m.categories || {})) || [],
        ),
      ),
    [data?.municipalities],
  );

  const filteredMunicipalities = useMemo(() => {
    if (!data?.municipalities) return [] as Municipality[];
    if (statusFilters.length === 0) return data.municipalities;
    return data.municipalities.filter((m) => {
      if (!m.statuses) return true;
      return statusFilters.some((status) => safeNumber(m.statuses?.[status]) > 0);
    });
  }, [data?.municipalities, statusFilters]);

  const hasResponseMetrics = useMemo(
    () => filteredMunicipalities.some((m) => getResponseHours(m.averageResponseHours) !== null),
    [filteredMunicipalities],
  );

  useEffect(() => {
    if (!hasResponseMetrics && sortOption !== 'tickets_desc') {
      setSortOption('tickets_desc');
    }
  }, [hasResponseMetrics, sortOption]);

  const sortOptionsList = useMemo<{ value: SortOption; label: string }[]>(() => {
    const base: { value: SortOption; label: string }[] = [
      { value: 'tickets_desc', label: 'Mayor cantidad de tickets' },
    ];
    if (hasResponseMetrics) {
      base.push(
        { value: 'response_asc', label: 'Menor tiempo de respuesta' },
        { value: 'response_desc', label: 'Mayor tiempo de respuesta' },
      );
    }
    return base;
  }, [hasResponseMetrics]);

  const effectiveSortOption = hasResponseMetrics ? sortOption : 'tickets_desc';

  const sortedMunicipalities = useMemo(() => {
    const entries = [...filteredMunicipalities];
    switch (effectiveSortOption) {
      case 'response_asc':
        return entries.sort((a, b) => {
          const aValue = getResponseHours(a.averageResponseHours);
          const bValue = getResponseHours(b.averageResponseHours);
          if (aValue === null && bValue === null) return 0;
          if (aValue === null) return 1;
          if (bValue === null) return -1;
          return aValue - bValue;
        });
      case 'response_desc':
        return entries.sort((a, b) => {
          const aValue = getResponseHours(a.averageResponseHours);
          const bValue = getResponseHours(b.averageResponseHours);
          if (aValue === null && bValue === null) return 0;
          if (aValue === null) return 1;
          if (bValue === null) return -1;
          return bValue - aValue;
        });
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
  }, [filteredMunicipalities, effectiveSortOption, categoryFilter]);

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
      allCategories.map((category) => {
        const value = filteredMunicipalities.reduce(
          (sum, m) => sum + safeNumber(m.categories?.[category]),
          0,
        );
        return { name: category, value };
      }),
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

  const hasTicketsChartData = useMemo(
    () => chartData.some((item) => safeNumber(item.value) > 0),
    [chartData],
  );

  const hasCategoryTotals = useMemo(
    () => categoryTotals.some((item) => safeNumber(item.value) > 0),
    [categoryTotals],
  );

  const genderData = useMemo(
    () =>
      data?.genderTotals
        ? Object.entries(data.genderTotals).map(([name, value]) => ({
            name,
            value: safeNumber(value),
          }))
        : [],
    [data?.genderTotals],
  );

  const ageData = useMemo(
    () =>
      data?.ageRanges
        ? Object.entries(data.ageRanges).map(([name, value]) => ({
            name,
            value: safeNumber(value),
          }))
        : [],
    [data?.ageRanges],
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
      statusKeys.map((status) => ({
        status,
        value: safeNumber(statusTotals[status]),
      })),
    [statusKeys, statusTotals],
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

  const hasStackedStatusChartData = useMemo(
    () =>
      stackedStatusData.some((row) =>
        statusKeys.some((status) => safeNumber((row as Record<string, number>)[status]) > 0),
      ),
    [stackedStatusData, statusKeys],
  );

  const hasStatusData = useMemo(
    () => statusSummary.some((item) => safeNumber(item.value) > 0),
    [statusSummary],
  );

  const hasGenderData = useMemo(() => genderData.some((item) => item.value > 0), [genderData]);
  const hasAgeData = useMemo(() => ageData.some((item) => item.value > 0), [ageData]);

  const chartCards = useMemo(() => {
    const cards: React.ReactNode[] = [];

    if (hasTicketsChartData) {
      cards.push(
        <Card key="tickets" className="flex h-full flex-col shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Tickets por Municipio</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pt-6">
            <div className="h-full min-h-[260px]">
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
        </Card>,
      );
    }

    if (hasCategoryTotals) {
      cards.push(
        <Card key="categories" className="flex h-full flex-col shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Distribución por Categoría</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pt-6">
            <div className="h-full min-h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryTotals}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
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
        </Card>,
      );
    }

    if (hasStatusData && hasStackedStatusChartData) {
      cards.push(
        <Card key="status" className="flex h-full flex-col shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Estados por Municipio</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pt-6">
            <div className="h-full min-h-[260px]">
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
        </Card>,
      );
    }

    if (hasGenderData) {
      cards.push(
        <Card key="gender" className="flex h-full flex-col shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Distribución por Género</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pt-6">
            <div className="h-full min-h-[260px]">
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
        </Card>,
      );
    }

    if (hasAgeData) {
      cards.push(
        <Card key="age" className="flex h-full flex-col shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Distribución por Rango Etario</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pt-6">
            <div className="h-full min-h-[260px]">
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
        </Card>,
      );
    }

    return cards;
  }, [
    hasTicketsChartData,
    chartData,
    hasCategoryTotals,
    categoryTotals,
    hasStatusData,
    hasStackedStatusChartData,
    stackedStatusData,
    statusKeys,
    statusColors,
    hasGenderData,
    genderData,
    hasAgeData,
    ageData,
  ]);

  const heatmapData = useMemo(() => data?.heatmap ?? [], [data?.heatmap]);

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

  const analyticsExportConfig = useMemo(() => {
    if (!data) return null;
    const genderLabels: Record<string, string> = {
      '': 'Todos',
      F: 'Femenino',
      M: 'Masculino',
      X: 'Otro',
    };
    return {
      municipalities: sortedMunicipalities,
      statusKeys,
      statusTotals,
      categoryTotals,
      totals: {
        totalTickets,
        averageResponseHours,
        ticketsLabel:
          categoryFilter === 'all'
            ? 'Tickets Totales'
            : `Tickets (${formatLabel(categoryFilter)})`,
      },
      filters: {
        category: categoryFilter === 'all' ? 'Todas' : formatLabel(categoryFilter),
        gender: genderLabels[genderFilter] ?? (genderFilter || 'Todos'),
        ageMin: ageMin || '—',
        ageMax: ageMax || '—',
        statuses:
          statusFilters.length > 0
            ? statusFilters.map((status) => formatLabel(status))
            : ['Todos'],
      },
      genderTotals: data.genderTotals,
      ageRanges: data.ageRanges,
      charts: data.charts ?? [],
      heatmap: heatmapData,
      categoryKey: categoryFilter,
    };
  }, [
    data,
    sortedMunicipalities,
    statusKeys,
    statusTotals,
    categoryTotals,
    totalTickets,
    averageResponseHours,
    categoryFilter,
    genderFilter,
    ageMin,
    ageMax,
    statusFilters,
    heatmapData,
  ]);

  const canExportAnalytics = Boolean(analyticsExportConfig);

  const handleExportAnalyticsPdf = useCallback(() => {
    if (!analyticsExportConfig) return;
    exportMunicipalAnalyticsPdf(analyticsExportConfig);
  }, [analyticsExportConfig]);

  const handleExportAnalyticsExcel = useCallback(() => {
    if (!analyticsExportConfig) return;
    exportMunicipalAnalyticsExcel(analyticsExportConfig);
  }, [analyticsExportConfig]);

  const updateStatusFilter = useCallback((status: string, checked: boolean) => {
    setStatusFilters((prev) => {
      if (checked) {
        if (prev.includes(status)) return prev;
        return [...prev, status];
      }
      return prev.filter((item) => item !== status);
    });
  }, []);

  const hasMunicipalityRows = useMemo(
    () => filteredMunicipalities.length > 0,
    [filteredMunicipalities],
  );
  const hasChartsData = useMemo(() => (data?.charts ?? []).length > 0, [data?.charts]);
  const hasHeatmapPoints = useMemo(() => heatmapData.length > 0, [heatmapData]);

  if (loading) return <p className="p-4 text-center">Cargando analíticas...</p>;

  if (error)
    return (
      <div className="p-4 max-w-6xl mx-auto space-y-4">
        <h1 className="text-3xl font-extrabold text-primary">Analíticas Profesionales</h1>
        <p className="p-4 text-destructive bg-destructive/10 rounded-md text-center">
          {error}
        </p>
        <Button onClick={fetchData} className="w-full">
          Reintentar
        </Button>
      </div>
    );

  if (
    !hasMunicipalityRows &&
    !hasStatusData &&
    !hasGenderData &&
    !hasAgeData &&
    !hasChartsData &&
    !hasHeatmapPoints
  )
    return (
      <p className="p-4 text-center text-muted-foreground">
        No hay datos disponibles con los filtros actuales.
      </p>
    );

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-extrabold text-primary">Analíticas Profesionales</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              disabled={!canExportAnalytics}
            >
              <FileDown className="h-4 w-4" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportAnalyticsPdf} disabled={!canExportAnalytics}>
              Exportar PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportAnalyticsExcel} disabled={!canExportAnalytics}>
              Exportar Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>


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
                {sortOptionsList.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
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

      {chartCards.length > 0 && (
        <section className="grid auto-rows-[minmax(0,1fr)] gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {chartCards}
        </section>
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

      {hasChartsData && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Indicadores adicionales</CardTitle>
          </CardHeader>
          <CardContent>
            <TicketStatsCharts charts={data?.charts ?? []} />
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
