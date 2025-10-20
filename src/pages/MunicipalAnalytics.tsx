import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  getMunicipalTicketStates,
  HeatPoint,
  HeatmapDataset,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, FileDown } from 'lucide-react';
import { generateJuninDemoHeatmap, JUNIN_DEMO_NOTICE } from '@/utils/demoHeatmap';
import {
  clearEndpointUnavailable,
  isEndpointMarkedUnavailable,
  markEndpointUnavailable,
} from '@/utils/endpointAvailability';
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
}

type SortOption = 'tickets_desc' | 'response_asc' | 'response_desc';

const STATUS_COLOR_PALETTE = Array.from({ length: 12 }, (_, idx) => `var(--chart-${idx + 1})`);
const MUNICIPAL_ANALYTICS_PATH = '/municipal/analytics';
const ANALYTICS_WARNING_MESSAGE =
  'Las métricas profesionales no están disponibles en este momento. Mostramos los indicadores básicos con las estadísticas generales.';

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

const STATUS_KEYWORDS = ['estado', 'status', 'situacion', 'situación'];
const GENDER_KEYWORDS = ['género', 'genero', 'gender'];
const AGE_KEYWORDS = ['edad', 'age'];

const extractChartData = (
  charts: TicketStatsResponse['charts'],
  keywords: string[],
): Record<string, number> => {
  if (!Array.isArray(charts)) return {};
  const chart = charts.find((item) => {
    const title = (item?.title ?? '').toString().toLowerCase();
    return keywords.some((keyword) => title.includes(keyword));
  });
  if (!chart || !chart.data) return {};
  return Object.entries(chart.data).reduce((acc, [key, value]) => {
    const normalizedKey = typeof key === 'string' ? key.trim() : '';
    const normalizedValue = typeof value === 'number' ? value : Number(value);
    if (normalizedKey.length > 0 && Number.isFinite(normalizedValue)) {
      acc[normalizedKey] = normalizedValue;
    }
    return acc;
  }, {} as Record<string, number>);
};

const buildMunicipalityFallback = (points: HeatPoint[]): Municipality[] => {
  const map = new Map<string, Municipality>();
  points.forEach((point) => {
    const rawName =
      (typeof point.distrito === 'string' && point.distrito.trim()) ||
      (typeof point.barrio === 'string' && point.barrio.trim()) ||
      (typeof point.tipo_ticket === 'string' && point.tipo_ticket.trim()) ||
      '';
    const name = rawName.length > 0 ? rawName : 'General';
    const existing = map.get(name) ?? {
      name,
      totalTickets: 0,
      categories: {},
      averageResponseHours: null,
      statuses: {},
    };

    existing.totalTickets += 1;
    if (typeof point.categoria === 'string' && point.categoria.trim().length > 0) {
      const category = point.categoria.trim();
      existing.categories[category] = (existing.categories[category] ?? 0) + 1;
    }
    if (typeof point.estado === 'string' && point.estado.trim().length > 0) {
      const status = point.estado.trim();
      if (!existing.statuses) existing.statuses = {};
      existing.statuses[status] = (existing.statuses[status] ?? 0) + 1;
    }

    map.set(name, existing);
  });
  return Array.from(map.values());
};

const buildFallbackAnalytics = (
  stats: TicketStatsResponse | null,
  heatmap: HeatPoint[],
): AnalyticsResponse => {
  const charts = stats?.charts;
  const statusFromCharts = extractChartData(charts, STATUS_KEYWORDS);
  const statusFromHeatmap = heatmap.reduce((acc, point) => {
    const status = typeof point.estado === 'string' ? point.estado.trim() : '';
    if (status.length > 0) {
      acc[status] = (acc[status] ?? 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const genderTotals = extractChartData(charts, GENDER_KEYWORDS);
  const ageRanges = extractChartData(charts, AGE_KEYWORDS);

  const municipalities = buildMunicipalityFallback(heatmap);

  return {
    municipalities,
    statusTotals:
      Object.keys(statusFromCharts).length > 0 ? statusFromCharts : statusFromHeatmap,
    genderTotals: Object.keys(genderTotals).length > 0 ? genderTotals : undefined,
    ageRanges: Object.keys(ageRanges).length > 0 ? ageRanges : undefined,
  };
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
  const [heatmapDetails, setHeatmapDetails] = useState<HeatmapDataset | null>(null);
  const [charts, setCharts] = useState<TicketStatsResponse['charts']>([]);
  const [allowedStatuses, setAllowedStatuses] = useState<string[]>([]);
  const analyticsInitialDisabled = useMemo(
    () => isEndpointMarkedUnavailable(MUNICIPAL_ANALYTICS_PATH),
    [],
  );
  const [analyticsWarning, setAnalyticsWarning] = useState<string | null>(
    analyticsInitialDisabled ? ANALYTICS_WARNING_MESSAGE : null,
  );
  const [analyticsDisabled, setAnalyticsDisabled] = useState<boolean>(analyticsInitialDisabled);
  const analyticsDisabledRef = useRef<boolean>(analyticsDisabled);

  useEffect(() => {
    analyticsDisabledRef.current = analyticsDisabled;
  }, [analyticsDisabled]);

  const markAnalyticsDisabled = useCallback(() => {
    if (analyticsDisabledRef.current) return;
    analyticsDisabledRef.current = true;
    setAnalyticsDisabled(true);
    setAnalyticsWarning(ANALYTICS_WARNING_MESSAGE);
    markEndpointUnavailable(MUNICIPAL_ANALYTICS_PATH);
  }, []);

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

    const disableAnalytics = analyticsDisabledRef.current;
    if (disableAnalytics) {
      setAnalyticsWarning((prev) => prev ?? ANALYTICS_WARNING_MESSAGE);
    } else {
      setAnalyticsWarning(null);
    }

    const qs = new URLSearchParams();
    if (categoryFilter !== 'all') qs.append('categoria', categoryFilter);
    if (genderFilter) qs.append('genero', genderFilter);
    if (ageMin) qs.append('edad_min', ageMin);
    if (ageMax) qs.append('edad_max', ageMax);
    statusFilters
      .filter((status) => status)
      .forEach((status) => qs.append('estado', status));

    const statsParams = {
      tipo: 'municipio',
      categoria: categoryFilter !== 'all' ? categoryFilter : undefined,
      genero: genderFilter || undefined,
      edad_min: ageMin || undefined,
      edad_max: ageMax || undefined,
      estado: statusFilters.length > 0 ? statusFilters : undefined,
    };

    try {
      const analyticsPromise = disableAnalytics
        ? Promise.resolve<AnalyticsResponse | null>(null)
        : apiFetch<AnalyticsResponse>(
            `${MUNICIPAL_ANALYTICS_PATH}${qs.toString() ? `?${qs.toString()}` : ''}`,
          );

      const [analyticsResult, statsResult, heatmapResult] = await Promise.allSettled([
        analyticsPromise,
        getTicketStats(statsParams),
        getHeatmapPoints({
          tipo_ticket: 'municipio',
          tipo: 'municipio',
          categoria: categoryFilter !== 'all' ? categoryFilter : undefined,
          genero: genderFilter || undefined,
          edad_min: ageMin || undefined,
          edad_max: ageMax || undefined,
          estado: statusFilters.length > 0 ? statusFilters : undefined,
        }),
      ]);

      const analyticsValue =
        analyticsResult.status === 'fulfilled' ? analyticsResult.value : null;
      if (analyticsResult.status === 'rejected') {
        console.warn('Municipal analytics endpoint unavailable:', analyticsResult.reason);
        setAnalyticsWarning(ANALYTICS_WARNING_MESSAGE);
        const reason = analyticsResult.reason;
        if (
          reason instanceof ApiError &&
          (reason.status === 404 || reason.status === 403 || reason.status === 401 || reason.status >= 500)
        ) {
          markAnalyticsDisabled();
        }
      }

      const statsValue =
        statsResult.status === 'fulfilled' ? statsResult.value : null;
      if (statsResult.status === 'rejected') {
        console.error('Error fetching ticket stats:', statsResult.reason);
      }

      const heatmapDataset: HeatmapDataset =
        heatmapResult.status === 'fulfilled' ? heatmapResult.value : { points: [] };
      const heatmapValue = heatmapDataset.points ?? [];
      if (heatmapResult.status === 'rejected') {
        console.error('Error fetching heatmap data:', heatmapResult.reason);
      }

      const fallbackAnalytics = buildFallbackAnalytics(statsValue, heatmapValue);
      const resolvedAnalytics = analyticsValue && Array.isArray(analyticsValue.municipalities)
        ? {
            ...analyticsValue,
            statusTotals:
              analyticsValue.statusTotals ?? fallbackAnalytics.statusTotals,
            genderTotals:
              analyticsValue.genderTotals ?? fallbackAnalytics.genderTotals,
            ageRanges: analyticsValue.ageRanges ?? fallbackAnalytics.ageRanges,
          }
        : fallbackAnalytics;

      setData(resolvedAnalytics);
      setCharts(statsValue?.charts || []);
      setHeatmapData(heatmapValue);
      setHeatmapDetails(heatmapDataset);

      const hasAnyData =
        resolvedAnalytics.municipalities.length > 0 ||
        (resolvedAnalytics.statusTotals &&
          Object.keys(resolvedAnalytics.statusTotals).length > 0) ||
        (resolvedAnalytics.genderTotals &&
          Object.keys(resolvedAnalytics.genderTotals).length > 0) ||
        (resolvedAnalytics.ageRanges &&
          Object.keys(resolvedAnalytics.ageRanges).length > 0) ||
        (statsValue?.charts && statsValue.charts.length > 0) ||
        heatmapValue.length > 0;

      if (!hasAnyData) {
        setError('No hay datos disponibles con los filtros actuales.');
      }
    } catch (err: any) {
      console.error('Error fetching municipal analytics data:', err);
      const demoHeatmap = generateJuninDemoHeatmap(120);
      const fallback = buildFallbackAnalytics(null, demoHeatmap);
      setData(fallback);
      setHeatmapData(demoHeatmap);
      setHeatmapDetails({ points: demoHeatmap });
      setCharts([]);
      setAnalyticsDisabled(true);
      analyticsDisabledRef.current = true;
      setAnalyticsWarning((prev) => {
        const combined = `${ANALYTICS_WARNING_MESSAGE} ${JUNIN_DEMO_NOTICE}`;
        if (!prev) return combined;
        return prev.includes(JUNIN_DEMO_NOTICE) ? prev : `${prev} ${JUNIN_DEMO_NOTICE}`;
      });
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, genderFilter, ageMin, ageMax, statusFilters, markAnalyticsDisabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRetryAnalytics = useCallback(() => {
    analyticsDisabledRef.current = false;
    setAnalyticsDisabled(false);
    clearEndpointUnavailable(MUNICIPAL_ANALYTICS_PATH);
    setAnalyticsWarning(null);
    fetchData();
  }, [fetchData]);

  const statusTotals = useMemo(() => {
    if (data?.statusTotals && Object.keys(data.statusTotals).length > 0) {
      return data.statusTotals;
    }
    const aggregated: Record<string, number> = {};
    data?.municipalities.forEach((m) => {
      Object.entries(m.statuses || {}).forEach(([status, value]) => {
        if (!status) return;
        aggregated[status] = (aggregated[status] ?? 0) + safeNumber(value);
      });
    });
    return aggregated;
  }, [data]);

  const statusKeys = useMemo(() => {
    const set = new Set<string>(allowedStatuses.filter(Boolean));
    Object.keys(statusTotals || {}).forEach((status) => {
      if (status) set.add(status);
    });
    data?.municipalities.forEach((m) => {
      Object.keys(m.statuses || {}).forEach((status) => {
        if (status) set.add(status);
      });
    });
    return Array.from(set);
  }, [allowedStatuses, data, statusTotals]);

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

  const hasGenderData = genderData.length > 0;
  const hasAgeData = ageData.length > 0;

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
      charts,
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
    charts,
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

  const hasMunicipalityRows = filteredMunicipalities.length > 0;
  const hasChartsData = charts && charts.length > 0;
  const hasHeatmapPoints = heatmapData.length > 0;

  if (loading) return <p className="p-4 text-center">Cargando analíticas...</p>;
  if (error) return <p className="p-4 text-destructive text-center">Error: {error}</p>;
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

      {analyticsWarning && (
        <Alert variant="destructive" className="bg-destructive/10 text-destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Analíticas limitadas</AlertTitle>
          <AlertDescription className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{analyticsWarning}</span>
            {analyticsDisabled && (
              <Button
                variant="outline"
                className="w-full sm:w-auto border-destructive text-destructive hover:bg-destructive/10"
                onClick={handleRetryAnalytics}
              >
                Reintentar analíticas
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

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
          metadata={heatmapDetails?.metadata?.map?.heatmap}
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
