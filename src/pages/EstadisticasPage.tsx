import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import AnalyticsHeatmap from '@/components/analytics/Heatmap';
import ChartTooltip from '@/components/analytics/ChartTooltip';
import { useUser } from '@/hooks/useUser';
import {
  getHeatmapPoints,
  getTicketStats,
  HeatPoint,
  HeatmapDataset,
  TicketStatsParams,
  TicketStatsResponse,
} from '@/services/statsService';
import { getTickets } from '@/services/ticketService';
import { getErrorMessage } from '@/utils/api';
import type { Ticket } from '@/types/tickets';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Flame,
  Layers,
  MapPin,
  RefreshCcw,
  TrendingUp,
} from 'lucide-react';

interface TicketCounts {
  abiertos: number;
  enProceso: number;
  resueltos: number;
}

interface CountItem {
  label: string;
  value: number;
}

interface TimelinePoint {
  label: string;
  value: number;
}

interface RangeOption {
  label: string;
  value: number | 'all';
}

type Segment = 'municipio' | 'pyme';

type TimelineCandidate = { label: string; sort: number; value: number };

const TIME_RANGE_OPTIONS: RangeOption[] = [
  { label: 'Últimos 7 días', value: 7 },
  { label: 'Últimos 30 días', value: 30 },
  { label: 'Últimos 90 días', value: 90 },
  { label: 'Últimos 180 días', value: 180 },
  { label: 'Último año', value: 365 },
  { label: 'Histórico', value: 'all' },
];

const SEGMENT_OPTIONS: { label: string; value: Segment }[] = [
  { label: 'Gobiernos', value: 'municipio' },
  { label: 'PyMEs', value: 'pyme' },
];

const STATUS_KEYWORDS = ['estado', 'status', 'situacion', 'situación'];
const CATEGORY_KEYWORDS = ['categoria', 'categoría', 'category', 'rubro', 'tipo'];
const CHANNEL_KEYWORDS = ['canal', 'channel', 'origen', 'entrada'];
const TIMELINE_KEYWORDS = ['tiempo', 'evolución', 'timeline', 'tendencia', 'mes', 'meses', 'día', 'historico'];

const COLOR_PALETTE = [
  '#2563eb',
  '#22d3ee',
  '#38bdf8',
  '#f97316',
  '#facc15',
  '#16a34a',
  '#a855f7',
  '#ec4899',
  '#0ea5e9',
  '#f43f5e',
];

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const formatLabel = (value: string): string =>
  value
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const safeNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toCountItems = (record: Record<string, number> | null | undefined): CountItem[] =>
  Object.entries(record ?? {})
    .map(([label, value]) => ({ label: formatLabel(label), value: safeNumber(value) }))
    .filter((item) => item.label.length > 0 && item.value > 0);

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
    const normalizedValue = safeNumber(value);
    if (normalizedKey.length > 0 && normalizedValue > 0) {
      acc[normalizedKey] = normalizedValue;
    }
    return acc;
  }, {} as Record<string, number>);
};

const aggregateHeatmap = (points: HeatPoint[]): {
  statuses: CountItem[];
  categories: CountItem[];
} => {
  const statusMap = new Map<string, CountItem>();
  const categoryMap = new Map<string, CountItem>();
  points.forEach((point) => {
    if (typeof point.estado === 'string' && point.estado.trim().length > 0) {
      const normalized = point.estado.trim();
      const key = normalized.toLowerCase();
      const existing = statusMap.get(key);
      statusMap.set(key, {
        label: existing?.label ?? formatLabel(normalized),
        value: (existing?.value ?? 0) + 1,
      });
    }
    if (typeof point.categoria === 'string' && point.categoria.trim().length > 0) {
      const normalized = point.categoria.trim();
      const key = normalized.toLowerCase();
      const existing = categoryMap.get(key);
      categoryMap.set(key, {
        label: existing?.label ?? formatLabel(normalized),
        value: (existing?.value ?? 0) + 1,
      });
    }
  });
  return {
    statuses: Array.from(statusMap.values()),
    categories: Array.from(categoryMap.values()),
  };
};

const aggregateTickets = (tickets: Ticket[]): {
  statuses: CountItem[];
  categories: CountItem[];
} => {
  const statusMap = new Map<string, CountItem>();
  const categoryMap = new Map<string, CountItem>();

  tickets.forEach((ticket) => {
    const statusRaw =
      (typeof ticket.estado === 'string' && ticket.estado) ||
      (typeof (ticket as Record<string, unknown>).estado_cliente === 'string'
        ? ((ticket as Record<string, unknown>).estado_cliente as string)
        : '') ||
      '';
    if (statusRaw.trim().length > 0) {
      const normalized = statusRaw.trim();
      const key = normalized.toLowerCase();
      const existing = statusMap.get(key);
      statusMap.set(key, {
        label: existing?.label ?? formatLabel(normalized),
        value: (existing?.value ?? 0) + 1,
      });
    }

    const categoryCandidates = new Set<string>();
    const pushCategory = (value: unknown) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed.length > 0) categoryCandidates.add(trimmed);
      }
    };
    pushCategory(ticket.categoria);
    pushCategory(ticket.categoria_principal);
    pushCategory(ticket.categoria_secundaria);
    pushCategory(ticket.categoria_simple);
    if (Array.isArray(ticket.categories)) {
      ticket.categories.forEach(pushCategory);
    }

    if (categoryCandidates.size === 0) {
      categoryCandidates.add('Sin categoría');
    }

    categoryCandidates.forEach((category) => {
      const key = category.toLowerCase();
      const existing = categoryMap.get(key);
      categoryMap.set(key, {
        label: existing?.label ?? formatLabel(category),
        value: (existing?.value ?? 0) + 1,
      });
    });
  });

  return {
    statuses: Array.from(statusMap.values()),
    categories: Array.from(categoryMap.values()),
  };
};

const mergeCountSources = (sources: CountItem[][]): CountItem[] => {
  const map = new Map<string, CountItem>();
  sources.forEach((source) => {
    if (!Array.isArray(source) || source.length === 0) return;
    source.forEach((item) => {
      const key = item.label.toLowerCase();
      const existing = map.get(key);
      if (!existing || item.value > existing.value) {
        map.set(key, { label: item.label, value: item.value });
      }
    });
  });
  return Array.from(map.values());
};

const classifyStatusSummary = (label: string): keyof TicketCounts => {
  const normalized = label.toLowerCase();
  if (
    normalized.includes('resuelt') ||
    normalized.includes('finaliz') ||
    normalized.includes('cerrad') ||
    normalized.includes('complet')
  ) {
    return 'resueltos';
  }
  if (
    normalized.includes('proceso') ||
    normalized.includes('curso') ||
    normalized.includes('trabaj') ||
    normalized.includes('pend') ||
    normalized.includes('espera') ||
    normalized.includes('deriv') ||
    normalized.includes('asign')
  ) {
    return 'enProceso';
  }
  return 'abiertos';
};

const formatNumber = (value: number): string =>
  Number.isFinite(value) ? value.toLocaleString('es-AR') : '0';

const deriveUnique = (items: CountItem[]): string[] =>
  Array.from(new Set(items.map((item) => item.label))).sort((a, b) =>
    a.localeCompare(b, 'es'),
  );

const computeTopLocations = (points: HeatPoint[]): CountItem[] => {
  const map = new Map<string, number>();
  points.forEach((point) => {
    const key =
      (typeof point.barrio === 'string' && point.barrio.trim()) ||
      (typeof point.distrito === 'string' && point.distrito.trim()) ||
      (typeof point.categoria === 'string' && point.categoria.trim()) ||
      'Sin ubicación';
    const normalized = formatLabel(key);
    map.set(normalized, (map.get(normalized) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
};

const getRangeDates = (
  range: number | 'all',
): { start?: string; end: string } => {
  const now = new Date();
  const end = now.toISOString();
  if (range === 'all') {
    return { end };
  }
  const start = new Date(now);
  start.setDate(start.getDate() - range + 1);
  return { start: start.toISOString(), end };
};

const parseTemporalKey = (label: string): TimelineCandidate | null => {
  const trimmed = label.trim();
  if (!trimmed) return null;

  const direct = Date.parse(trimmed);
  if (!Number.isNaN(direct)) {
    const date = new Date(direct);
    return {
      label: date.toLocaleDateString('es-AR', {
        month: 'short',
        year: 'numeric',
      }),
      sort: date.getTime(),
      value: 0,
    };
  }

  const normalized = trimmed
    .toLowerCase()
    .replace(/de/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const yearMatch = normalized.match(/(19|20)\d{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();

  const monthIndex = MONTHS.findIndex((month) => normalized.includes(month));
  if (monthIndex >= 0) {
    const date = new Date(year, monthIndex, 1);
    return {
      label: `${MONTHS[monthIndex].slice(0, 3).toUpperCase()} ${year}`,
      sort: date.getTime(),
      value: 0,
    };
  }

  const ymMatch = normalized.match(/(\d{4})[-/](\d{1,2})/);
  if (ymMatch) {
    const [_, y, m] = ymMatch;
    const month = Number(m) - 1;
    const date = new Date(Number(y), month, 1);
    return {
      label: `${MONTHS[month].slice(0, 3).toUpperCase()} ${y}`,
      sort: date.getTime(),
      value: 0,
    };
  }

  const myMatch = normalized.match(/(\d{1,2})[-/](\d{4})/);
  if (myMatch) {
    const [_, m, y] = myMatch;
    const month = Number(m) - 1;
    const date = new Date(Number(y), month, 1);
    return {
      label: `${MONTHS[month].slice(0, 3).toUpperCase()} ${y}`,
      sort: date.getTime(),
      value: 0,
    };
  }

  return null;
};

const buildTimelineFromCharts = (
  charts: TicketStatsResponse['charts'],
): TimelinePoint[] => {
  if (!Array.isArray(charts)) return [];
  const chart = charts.find((item) => {
    const title = (item?.title ?? '').toString().toLowerCase();
    return TIMELINE_KEYWORDS.some((keyword) => title.includes(keyword));
  });
  if (!chart || !chart.data) return [];

  const candidates: TimelineCandidate[] = [];
  Object.entries(chart.data).forEach(([key, value]) => {
    const parsed = parseTemporalKey(key);
    if (parsed) {
      candidates.push({ ...parsed, value: safeNumber(value) });
    }
  });

  return candidates
    .sort((a, b) => a.sort - b.sort)
    .map(({ label, value }) => ({ label, value }));
};

const buildTimelineFromTickets = (tickets: Ticket[]): TimelinePoint[] => {
  const map = new Map<string, number>();
  tickets.forEach((ticket) => {
    if (!ticket.fecha) return;
    const date = new Date(ticket.fecha);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  });

  return Array.from(map.entries())
    .map(([key, value]) => {
      const [yearStr, monthStr] = key.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr) - 1;
      return {
        label: `${MONTHS[month].slice(0, 3).toUpperCase()} ${year}`,
        value,
        sort: new Date(year, month, 1).getTime(),
      };
    })
    .sort((a, b) => a.sort - b.sort)
    .map(({ label, value }) => ({ label, value }));
};

const filterTickets = (
  tickets: Ticket[],
  segment: Segment,
  range: number | 'all',
  statusFilter: string,
  categoryFilter: string,
): Ticket[] => {
  const { start, end } = getRangeDates(range);
  const endTime = new Date(end).getTime();
  const startTime = start ? new Date(start).getTime() : null;

  return tickets.filter((ticket) => {
    if (ticket.tipo !== segment) return false;
    if (statusFilter !== 'all') {
      const status =
        (typeof ticket.estado === 'string' && ticket.estado.trim()) ||
        (typeof (ticket as Record<string, unknown>).estado_cliente === 'string'
          ? ((ticket as Record<string, unknown>).estado_cliente as string)
          : '');
      if (!status || status.toLowerCase() !== statusFilter.toLowerCase()) {
        return false;
      }
    }

    if (categoryFilter !== 'all') {
      const categories = new Set<string>();
      const push = (value: unknown) => {
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed.length > 0) categories.add(trimmed.toLowerCase());
        }
      };
      push(ticket.categoria);
      push(ticket.categoria_principal);
      push(ticket.categoria_secundaria);
      push(ticket.categoria_simple);
      if (Array.isArray(ticket.categories)) {
        ticket.categories.forEach(push);
      }
      if (!categories.has(categoryFilter.toLowerCase())) {
        return false;
      }
    }

    if (!ticket.fecha) return true;
    const timestamp = new Date(ticket.fecha).getTime();
    if (Number.isNaN(timestamp)) return true;
    if (startTime !== null && timestamp < startTime) return false;
    if (timestamp > endTime) return false;
    return true;
  });
};

const SummaryCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) => (
  <Card className="relative overflow-hidden border-none bg-gradient-to-br from-background to-background/60 shadow-xl">
    <div
      className="absolute inset-0 opacity-10"
      style={{ background: `radial-gradient(circle at top right, ${accent}, transparent)` }}
    />
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <div>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <CardDescription className="text-2xl font-semibold text-foreground">{value}</CardDescription>
      </div>
      <div
        className="rounded-xl bg-primary/10 p-2 text-primary shadow-inner"
        style={{
          background:
            'linear-gradient(135deg, hsla(var(--primary),0.15), hsla(var(--primary),0.05))',
        }}
      >
        <Icon className="h-6 w-6 text-primary" />
      </div>
    </CardHeader>
    <CardContent>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </CardContent>
  </Card>
);

const AnalyticsChartCard = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <Card className="h-full border-border/60 shadow-lg">
    <CardHeader>
      <div className="flex items-start justify-between gap-2">
        <div>
          <CardTitle className="text-lg font-semibold text-foreground">{title}</CardTitle>
          {description ? (
            <CardDescription className="text-sm text-muted-foreground">
              {description}
            </CardDescription>
          ) : null}
        </div>
      </div>
    </CardHeader>
    <CardContent className="h-[320px]">{children}</CardContent>
  </Card>
);

export default function EstadisticasPage() {
  const { user } = useUser();
  const [segment, setSegment] = useState<Segment>('municipio');
  const [range, setRange] = useState<number | 'all'>(30);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [ticketCounts, setTicketCounts] = useState<TicketCounts | null>(null);
  const [statusBreakdown, setStatusBreakdown] = useState<CountItem[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CountItem[]>([]);
  const [channelBreakdown, setChannelBreakdown] = useState<CountItem[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [heatmap, setHeatmap] = useState<HeatPoint[]>([]);
  const [heatmapDetails, setHeatmapDetails] = useState<HeatmapDataset | null>(null);
  const [topLocations, setTopLocations] = useState<CountItem[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataNotice, setDataNotice] = useState<string | null>(null);

  const timelineGradientId = useId();

  useEffect(() => {
    if (user?.tipo_chat === 'pyme') {
      setSegment('pyme');
    } else if (user?.tipo_chat === 'municipio') {
      setSegment('municipio');
    }
  }, [user]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { start, end } = getRangeDates(range);

    const params: TicketStatsParams = {
      tipo: segment,
      fecha_inicio: start,
      fecha_fin: end,
    };

    if (statusFilter !== 'all') params.estado = statusFilter;
    if (categoryFilter !== 'all') params.categoria = categoryFilter;

    try {
      const [statsResult, heatmapResult, ticketsResult] = await Promise.allSettled([
        getTicketStats(params),
        getHeatmapPoints({
          tipo: segment,
          fecha_inicio: start,
          fecha_fin: end,
          estado: statusFilter !== 'all' ? statusFilter : undefined,
          categoria: categoryFilter !== 'all' ? categoryFilter : undefined,
        }),
        getTickets(),
      ]);

      const statsData: TicketStatsResponse['charts'] =
        statsResult.status === 'fulfilled' ? statsResult.value.charts ?? [] : [];
      const statsHeatmapDataset =
        statsResult.status === 'fulfilled' ? statsResult.value.heatmapDataset : undefined;
      const statsHeatmap: HeatPoint[] =
        statsHeatmapDataset?.points ??
        (statsResult.status === 'fulfilled' ? statsResult.value.heatmap ?? [] : []);
      const heatmapDataset: HeatmapDataset =
        heatmapResult.status === 'fulfilled' ? heatmapResult.value : { points: [] };
      const heatmapData: HeatPoint[] = heatmapDataset.points ?? [];

      const tickets: Ticket[] =
        ticketsResult.status === 'fulfilled'
          ? filterTickets(
              ticketsResult.value.tickets ?? [],
              segment,
              range,
              statusFilter,
              categoryFilter,
            )
          : [];

      if (statsResult.status === 'rejected') {
        console.warn('Error loading ticket stats:', statsResult.reason);
      }
      if (heatmapResult.status === 'rejected') {
        console.warn('Error loading heatmap data:', heatmapResult.reason);
      }
      if (ticketsResult.status === 'rejected') {
        console.warn('Error loading ticket fallback data:', ticketsResult.reason);
      }

      const heatmapAggregates = aggregateHeatmap([...(statsHeatmap ?? []), ...heatmapData]);
      const ticketAggregates = aggregateTickets(tickets);

      const chartStatuses = toCountItems(extractChartData(statsData, STATUS_KEYWORDS));
      const chartCategories = toCountItems(extractChartData(statsData, CATEGORY_KEYWORDS));
      const chartChannels = toCountItems(extractChartData(statsData, CHANNEL_KEYWORDS));
      const chartTimeline = buildTimelineFromCharts(statsData);

      const mergedStatuses = mergeCountSources([
        ticketAggregates.statuses,
        chartStatuses,
        heatmapAggregates.statuses,
      ]).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

      const mergedCategories = mergeCountSources([
        ticketAggregates.categories,
        chartCategories,
        heatmapAggregates.categories,
      ]).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

      const summary = mergedStatuses.reduce(
        (acc, item) => {
          const bucket = classifyStatusSummary(item.label);
          acc[bucket] += item.value;
          return acc;
        },
        { abiertos: 0, enProceso: 0, resueltos: 0 } as TicketCounts,
      );

      const totalSummary = summary.abiertos + summary.enProceso + summary.resueltos;
      if (totalSummary === 0 && tickets.length > 0) {
        summary.abiertos = tickets.length;
      }

      const timelineFromTickets = chartTimeline.length > 0 ? chartTimeline : buildTimelineFromTickets(tickets);

      setTicketCounts(totalSummary > 0 ? summary : null);
      setStatusBreakdown(mergedStatuses);
      setCategoryBreakdown(mergedCategories);
      setChannelBreakdown(
        chartChannels.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
      );
      setTimeline(timelineFromTickets);
      const combinedDataset: HeatmapDataset =
        heatmapData.length > 0
          ? heatmapDataset
          : statsHeatmapDataset ?? { points: statsHeatmap ?? [] };
      setHeatmapDetails(combinedDataset);
      const combinedPoints = combinedDataset.points ?? [];
      setHeatmap(combinedPoints);
      setTopLocations(computeTopLocations(combinedPoints));
      setStatusOptions(deriveUnique(mergedStatuses));
      setCategoryOptions(deriveUnique(mergedCategories));

      const notices: string[] = [];
      if (statsResult.status === 'rejected' || (statsData?.length ?? 0) === 0) {
        notices.push(
          'Mostramos los indicadores a partir de la actividad registrada porque el backend no devolvió métricas agregadas completas.',
        );
      }
      if (ticketsResult.status === 'rejected') {
        notices.push(
          'No pudimos acceder al listado completo de tickets para usarlo como respaldo. Los gráficos utilizan únicamente la información consolidada disponible.',
        );
      }
      setDataNotice(notices.length > 0 ? notices.join(' ') : null);
    } catch (err) {
      console.error('Error loading analytics dashboard:', err);
      setError(getErrorMessage(err, 'No se pudieron cargar las estadísticas avanzadas.'));
      setTicketCounts(null);
      setStatusBreakdown([]);
      setCategoryBreakdown([]);
      setChannelBreakdown([]);
      setTimeline([]);
      setHeatmap([]);
      setHeatmapDetails(null);
      setTopLocations([]);
      setStatusOptions([]);
      setCategoryOptions([]);
      setDataNotice(null);
    } finally {
      setLoading(false);
    }
  }, [segment, range, statusFilter, categoryFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalTickets = useMemo(() => {
    if (!ticketCounts) return 0;
    return ticketCounts.abiertos + ticketCounts.enProceso + ticketCounts.resueltos;
  }, [ticketCounts]);

  const resolutionRate = useMemo(() => {
    if (!ticketCounts) return 0;
    const total = ticketCounts.abiertos + ticketCounts.enProceso + ticketCounts.resueltos;
    if (total === 0) return 0;
    return Math.round((ticketCounts.resueltos / total) * 100);
  }, [ticketCounts]);

  const displayedHeatmapCount = useMemo(() => {
    const metadataCount = heatmapDetails?.metadata?.map?.heatmap?.pointCount;
    return metadataCount !== undefined ? metadataCount : heatmap.length;
  }, [heatmapDetails, heatmap.length]);

  const topCategory = categoryBreakdown[0];
  const trendDelta = useMemo(() => {
    if (timeline.length < 2) return null;
    const last = timeline[timeline.length - 1];
    const previous = timeline[timeline.length - 2];
    if (!previous || previous.value === 0) return null;
    const delta = ((last.value - previous.value) / previous.value) * 100;
    if (!Number.isFinite(delta)) return null;
    return Math.round(delta);
  }, [timeline]);

  const insights = useMemo(() => {
    const list: { title: string; description: string }[] = [];
    if (topCategory) {
      list.push({
        title: 'Categoría dominante',
        description: `${topCategory.label} concentra ${formatNumber(topCategory.value)} casos en el período seleccionado.`,
      });
    }
    if (topLocations[0]) {
      list.push({
        title: 'Zona crítica',
        description: `${topLocations[0].label} lidera las solicitudes registradas. Refuerza la presencia operativa en la zona.`,
      });
    }
    if (trendDelta !== null) {
      list.push({
        title: 'Tendencia intermensual',
        description:
          trendDelta > 0
            ? `Los tickets crecieron ${trendDelta}% respecto del período previo.`
            : `Los tickets disminuyeron ${Math.abs(trendDelta)}% respecto del período previo.`,
      });
    }
    if (resolutionRate > 0) {
      list.push({
        title: 'Efectividad de resolución',
        description: `El ${resolutionRate}% de los tickets se resuelve dentro del rango elegido.`,
      });
    }
    return list;
  }, [topCategory, topLocations, trendDelta, resolutionRate]);

  const availableCategories = useMemo(
    () =>
      Array.from(
        new Set(
          heatmap
            .map((point) => (typeof point.categoria === 'string' ? formatLabel(point.categoria) : null))
            .filter((item): item is string => Boolean(item)),
        ),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [heatmap],
  );

  const availableBarrios = useMemo(
    () =>
      Array.from(
        new Set(
          heatmap
            .map((point) => (typeof point.barrio === 'string' ? formatLabel(point.barrio) : null))
            .filter((item): item is string => Boolean(item)),
        ),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [heatmap],
  );

  const availableTipos = useMemo(
    () =>
      Array.from(
        new Set(
          heatmap
            .map((point) => (typeof point.tipo_ticket === 'string' ? formatLabel(point.tipo_ticket) : null))
            .filter((item): item is string => Boolean(item)),
        ),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [heatmap],
  );

  const handleRefresh = () => {
    loadData();
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full rounded-2xl" />
        <Skeleton className="h-[520px] w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-4 md:p-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 text-primary">
          <TrendingUp className="h-6 w-6" />
          <p className="text-sm font-semibold uppercase tracking-widest text-primary/80">
            Panel Inteligente de Analíticas
          </p>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight text-foreground md:text-5xl">
            Insights accionables en tiempo real
          </h1>
          <p className="mt-2 max-w-3xl text-base text-muted-foreground">
            Combina métricas operativas, evolución temporal y mapas de calor para entender cómo se mueven los reclamos, las ventas o los tickets de servicio en tu organización. Ajusta filtros y visualiza información lista para presentar en comités ejecutivos.
          </p>
        </div>
      </div>

      <Card className="border-border/60 shadow-lg">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg">Configurá la vista</CardTitle>
            <CardDescription>
              Seleccioná horizonte temporal, segmento y filtros para actualizar los análisis.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={segment} onValueChange={(value) => setSegment(value as Segment)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Segmento" />
              </SelectTrigger>
              <SelectContent>
                {SEGMENT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(range)}
              onValueChange={(value) =>
                setRange(value === 'all' ? 'all' : Number(value))
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Horizonte" />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.label} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={handleRefresh} className="gap-2">
              <RefreshCcw className="h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </CardHeader>
      </Card>

      {dataNotice ? (
        <Alert>
          <AlertCircle className="h-5 w-5" />
          <AlertTitle>Información complementada automáticamente</AlertTitle>
          <AlertDescription>{dataNotice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Tickets totales"
          value={formatNumber(totalTickets)}
          subtitle="Volumen consolidado para el período seleccionado"
          icon={BarChart3}
          accent="rgba(37,99,235,0.35)"
        />
        <SummaryCard
          title="En curso"
          value={formatNumber(ticketCounts?.enProceso ?? 0)}
          subtitle="Casos que requieren seguimiento activo"
          icon={Activity}
          accent="rgba(14,184,184,0.4)"
        />
        <SummaryCard
          title="Resueltos"
          value={formatNumber(ticketCounts?.resueltos ?? 0)}
          subtitle={`Tasa de resolución ${resolutionRate}%`}
          icon={Layers}
          accent="rgba(16,185,129,0.35)"
        />
        <SummaryCard
          title="Categoría destacada"
          value={topCategory ? topCategory.label : 'Sin datos'}
          subtitle={topCategory ? `${formatNumber(topCategory.value)} casos registrados` : 'Aguardando actividad'}
          icon={Flame}
          accent="rgba(249,115,22,0.35)"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <AnalyticsChartCard
          title="Evolución de tickets"
          description="Tendencia mensual de creación de casos"
        >
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={timeline}>
                <defs>
                  <linearGradient id={timelineGradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.35)" />
                <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fill={`url(#${timelineGradientId})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Aún no hay suficientes datos temporales para mostrar una tendencia.
            </div>
          )}
        </AnalyticsChartCard>

        <AnalyticsChartCard
          title="Distribución por estado"
          description="Proporción de tickets por etapa del flujo"
        >
          {statusBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <RadialBarChart
                data={statusBreakdown.map((item, index) => ({
                  name: item.label,
                  value: item.value,
                  fill: COLOR_PALETTE[index % COLOR_PALETTE.length],
                }))}
                innerRadius="30%"
                outerRadius="90%"
                barSize={16}
              >
                <PolarAngleAxis type="number" domain={[0, Math.max(...statusBreakdown.map((item) => item.value))]} tick={false} />
                <RadialBar
                  dataKey="value"
                  cornerRadius={10}
                  background
                  label={{ position: 'inside', fill: '#fff', fontSize: 11 }}
                />
                <Tooltip content={<ChartTooltip />} />
              </RadialBarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No hay datos suficientes para segmentar los estados.
            </div>
          )}
        </AnalyticsChartCard>

        <AnalyticsChartCard
          title="Canales de ingreso"
          description="Conoce qué canales concentran las interacciones"
        >
          {channelBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={channelBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.35)" />
                <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                  {channelBreakdown.map((_, idx) => (
                    <Cell key={idx} fill={COLOR_PALETTE[idx % COLOR_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Aún no se detectaron canales diferenciados para el rango seleccionado.
            </div>
          )}
        </AnalyticsChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="border-border/60 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Mapa de calor interactivo</CardTitle>
                <CardDescription>
                  Localiza hotspots geográficos para planificar operativos o campañas.
                </CardDescription>
              </div>
              <Badge variant="outline" className="flex items-center gap-1 text-xs">
                <MapPin className="h-3.5 w-3.5" />
                {displayedHeatmapCount.toLocaleString('es-AR')} puntos
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {heatmap.length > 0 ? (
              <AnalyticsHeatmap
                initialHeatmapData={heatmap}
                availableCategories={availableCategories}
                availableBarrios={availableBarrios}
                availableTipos={availableTipos}
                metadata={heatmapDetails?.metadata?.map?.heatmap}
                mapConfig={heatmapDetails?.mapConfig}
                mapLayers={heatmapDetails?.mapLayers}
              />
            ) : (
              <div className="flex h-[520px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
                No hay datos georreferenciados disponibles para los filtros aplicados.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/60 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Zonas con mayor actividad</CardTitle>
              <CardDescription>
                Priorizá inspecciones o equipos de respuesta donde más se necesita.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topLocations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ubicación</TableHead>
                      <TableHead className="text-right">Tickets</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topLocations.map((location, index) => (
                      <TableRow key={location.label}>
                        <TableCell className="flex items-center gap-2">
                          <Badge variant={index === 0 ? 'default' : 'secondary'}>{index + 1}</Badge>
                          {location.label}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatNumber(location.value)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aún no hay actividad territorial suficiente para construir el ranking.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Insights clave</CardTitle>
              <CardDescription>
                Recomendaciones generadas automáticamente según tus datos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {insights.length > 0 ? (
                insights.map((insight) => (
                  <div key={insight.title} className="rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm">
                    <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aplica filtros o amplía el rango temporal para descubrir hallazgos automáticos.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
