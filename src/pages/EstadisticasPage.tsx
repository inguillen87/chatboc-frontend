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
  PieChart,
  Pie,
  Legend
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  getAiReportLatest,
  generateAiReport,
  getSurveySummary,
  getSurveySentiment,
  getBenchmarks,
  getGeoPolygons,
  AiReportResponse,
  SurveySummaryResponse,
  SurveySentimentResponse,
  BenchmarksResponse
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
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Filter,
  BrainCircuit,
  Sparkles,
  FileText,
  Vote,
  MessageSquare,
  Users,
  Target,
  CalendarCheck2,
  Map as MapIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- PROFESSIONAL THEME CONSTANTS ---
const THEME = {
  colors: {
    primary: '#4f46e5',    // Indigo 600
    secondary: '#10b981',  // Emerald 500
    tertiary: '#f59e0b',   // Amber 500
    quaternary: '#ec4899', // Pink 500
    background: '#ffffff',
    surface: '#f9fafb',
    text: '#111827',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    grid: '#f3f4f6',
  },
  palette: [
    '#4f46e5', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ec4899', // Pink
    '#3b82f6', // Blue
    '#8b5cf6', // Violet
    '#ef4444', // Red
    '#14b8a6', // Teal
  ]
};

// --- TYPES ---
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
type TabView = 'operativo' | 'participacion';

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
  { label: 'Gobierno / Municipio', value: 'municipio' },
  { label: 'Empresa / Comercio', value: 'pyme' },
];

const STATUS_KEYWORDS = ['estado', 'status', 'situacion', 'situación'];
const CATEGORY_KEYWORDS = ['categoria', 'categoría', 'category', 'rubro', 'tipo'];
const CHANNEL_KEYWORDS = ['canal', 'channel', 'origen', 'entrada'];
const TIMELINE_KEYWORDS = ['tiempo', 'evolución', 'timeline', 'tendencia', 'mes', 'meses', 'día', 'historico'];

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

// --- UTILITIES ---
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
    normalized.includes('complet') ||
    normalized.includes('entregado')
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
    normalized.includes('asign') ||
    normalized.includes('preparacion')
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
  variant = 'default',
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'success' | 'warning' | 'info';
}) => {
  const styles = {
    default: {
      gradient: 'from-blue-50 to-white dark:from-blue-900/20 dark:to-background',
      iconBg: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    success: {
      gradient: 'from-emerald-50 to-white dark:from-emerald-900/20 dark:to-background',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    warning: {
      gradient: 'from-amber-50 to-white dark:from-amber-900/20 dark:to-background',
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
    info: {
      gradient: 'from-indigo-50 to-white dark:from-indigo-900/20 dark:to-background',
      iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
      iconColor: 'text-indigo-600 dark:text-indigo-400',
    },
  };

  const style = styles[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`relative overflow-hidden border border-border/50 bg-gradient-to-br ${style.gradient} shadow-sm transition-all hover:shadow-md`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
            <div className="flex items-baseline gap-2 mt-1">
              <CardDescription className="text-3xl font-bold text-foreground tracking-tight">{value}</CardDescription>
            </div>
          </div>
          <div className={`rounded-xl p-2.5 ${style.iconBg} shadow-sm`}>
            <Icon className={`h-6 w-6 ${style.iconColor}`} />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            {subtitle}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
};

const AnalyticsChartCard = ({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.4 }}
    className="h-full"
  >
    <Card className="h-full border-border/60 shadow-sm transition-shadow hover:shadow-md bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-semibold text-foreground tracking-tight">{title}</CardTitle>
            {description ? (
              <CardDescription className="text-sm text-muted-foreground mt-1">
                {description}
              </CardDescription>
            ) : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="h-[350px] pt-4">{children}</CardContent>
    </Card>
  </motion.div>
);

// --- COMPONENT: PARTICIPATION & SURVEYS DASHBOARD ---
const ParticipationDashboard = ({ segment, tenantId }: { segment: Segment, tenantId: number }) => {
  const isPyme = segment === 'pyme';
  const [loading, setLoading] = useState(true);
  const [surveyData, setSurveyData] = useState<SurveySummaryResponse | null>(null);
  const [sentimentData, setSentimentData] = useState<SurveySentimentResponse | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!tenantId) return;
      try {
        setLoading(true);
        const [summary, sentiment] = await Promise.allSettled([
          getSurveySummary(tenantId),
          getSurveySentiment(tenantId),
        ]);

        if (summary.status === 'fulfilled') setSurveyData(summary.value);
        if (sentiment.status === 'fulfilled') setSentimentData(sentiment.value);
      } catch (e) {
        console.warn("Failed to load participation data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tenantId]);

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-96 w-full" /></div>;
  }

  // Transform Data for Charts
  const pollChartData = surveyData?.stats.results_by_option.map(opt => ({
    name: opt.option,
    value: opt.count
  })) || [];

  const sentimentChartData = sentimentData ? [
    { name: 'Positivo', value: Math.round((sentimentData.sentiment_score + 1) * 50), fill: '#10b981' },
    { name: 'Negativo', value: Math.round((1 - sentimentData.sentiment_score) * 50), fill: '#ef4444' },
  ] : [];

  return (
    <div className="space-y-6">
       <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title={isPyme ? "Encuestas Respondidas" : "Votos Totales"}
          value={formatNumber(surveyData?.stats.total_votes ?? 0)}
          subtitle="En el último mes"
          icon={Vote}
          variant="info"
        />
        <SummaryCard
          title="Participación"
          value={`${surveyData?.stats.participation_rate.toFixed(1) ?? 0}%`}
          subtitle="Sobre usuarios activos"
          icon={Users}
          variant="success"
        />
        <SummaryCard
          title="Sentimiento IA"
          value={sentimentData?.sentiment_score ? (sentimentData.sentiment_score > 0 ? "Positivo" : "Negativo") : "-"}
          subtitle={`Score: ${sentimentData?.sentiment_score.toFixed(2) ?? 0}`}
          icon={BrainCircuit}
          variant="warning"
        />
        <SummaryCard
          title="Leads / Interesados"
          value="-" // TODO: Integrate getFunnel
          subtitle="Contactos calificados"
          icon={Target}
          variant="default"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
         <AnalyticsChartCard
            title="Resultados de Sondeos"
            description={isPyme ? "Aspectos más valorados por clientes" : "Prioridades votadas por vecinos"}
         >
            {pollChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={pollChartData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={THEME.colors.border} />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                      <Tooltip cursor={{fill: 'transparent'}} content={<ChartTooltip />} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                         {pollChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={THEME.palette[index % THEME.palette.length]} />
                         ))}
                      </Bar>
                   </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Sin datos de encuestas</div>
            )}
         </AnalyticsChartCard>

         <AnalyticsChartCard
            title="Análisis de Sentimiento IA"
            description="Tono detectado en respuestas abiertas y chats"
         >
            {sentimentChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                      <Pie
                         data={sentimentChartData}
                         cx="50%"
                         cy="50%"
                         innerRadius={60}
                         outerRadius={100}
                         paddingAngle={5}
                         dataKey="value"
                      >
                         {sentimentChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                         ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36}/>
                   </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Sin datos de sentimiento</div>
            )}
            {sentimentData && (
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                   <span className="text-3xl font-bold text-gray-800 dark:text-white">{(sentimentData.sentiment_score * 100).toFixed(0)}%</span>
                   <p className="text-xs text-muted-foreground">Score</p>
                </div>
            )}
         </AnalyticsChartCard>
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---
export default function EstadisticasPage() {
  const { user } = useUser();
  const [segment, setSegment] = useState<Segment>('municipio');
  const [activeTab, setActiveTab] = useState<TabView>('operativo');
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
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // New States
  const [cachedReport, setCachedReport] = useState<AiReportResponse | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarksResponse | null>(null);
  const [showPolygons, setShowPolygons] = useState(false); // Toggle for heatmap vs polygons

  const timelineGradientId = useId();

  useEffect(() => {
    if (user?.tipo_chat === 'pyme') {
      setSegment('pyme');
    } else if (user?.tipo_chat === 'municipio') {
      setSegment('municipio');
    }
  }, [user]);

  // Initial Data Load (Benchmarks, AI Report Check)
  useEffect(() => {
     if (!user?.id) return;
     // Check for latest cached report
     getAiReportLatest({ tenant_id: user.id, segment }).then(report => {
         if (report) setCachedReport(report);
     }).catch(e => console.debug("No cached report found or error", e));
  }, [user?.id, segment]);

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
      const [statsResult, heatmapResult, ticketsResult, benchmarksResult] = await Promise.allSettled([
        getTicketStats(params),
        getHeatmapPoints({
          tipo: segment,
          fecha_inicio: start,
          fecha_fin: end,
          estado: statusFilter !== 'all' ? statusFilter : undefined,
          categoria: categoryFilter !== 'all' ? categoryFilter : undefined,
        }),
        getTickets(),
        getBenchmarks({ tenant_id: user?.id, from: start, to: end }) // Attempt to get real benchmarks
      ]);

      if (benchmarksResult.status === 'fulfilled') {
          setBenchmarks(benchmarksResult.value);
      }

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

      // Improved Error Handling: Don't log noisy errors if we have at least partial data
      if (statsResult.status === 'rejected') {
        console.warn('Backend aggregated stats unavailable, relying on raw ticket data if available.');
      }

      // Only warn about fallback failure if we also failed to get aggregated stats
      if (ticketsResult.status === 'rejected' && statsResult.status === 'rejected') {
         console.warn('Both aggregated and raw ticket data failed to load.');
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

      // SMART ALERT LOGIC: Only show alert if CRITICAL data is missing.
      const hasAggregatedData = statsResult.status === 'fulfilled' && (statsData?.length ?? 0) > 0;
      const hasRawData = ticketsResult.status === 'fulfilled' && tickets.length > 0;

      const notices: string[] = [];
      if (!hasAggregatedData && !hasRawData) {
         if (statsResult.status === 'rejected' || ticketsResult.status === 'rejected') {
             notices.push('No se pudieron cargar datos completos. Verificá tu conexión.');
         }
      }

      setDataNotice(notices.length > 0 ? notices.join(' ') : null);

    } catch (err) {
      console.error('Error loading analytics dashboard:', err);
      setError(getErrorMessage(err, 'No se pudieron cargar las estadísticas avanzadas.'));
      // Reset state on critical error
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
  }, [segment, range, statusFilter, categoryFilter, user?.id]);

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
    // If we have real benchmarks, use them
    if (benchmarks?.tickets?.growth_percentage !== undefined) return benchmarks.tickets.growth_percentage;

    // Fallback to timeline calculation
    if (timeline.length < 2) return null;
    const last = timeline[timeline.length - 1];
    const previous = timeline[timeline.length - 2];
    if (!previous || previous.value === 0) return null;
    const delta = ((last.value - previous.value) / previous.value) * 100;
    if (!Number.isFinite(delta)) return null;
    return Math.round(delta);
  }, [timeline, benchmarks]);

  const insights = useMemo(() => {
    const list: { title: string; description: string; icon: any; color: string }[] = [];
    if (topCategory) {
      list.push({
        title: segment === 'pyme' ? 'Producto/Servicio Top' : 'Categoría Crítica',
        description: `${topCategory.label} lidera con ${formatNumber(topCategory.value)} ${segment === 'pyme' ? 'ventas/consultas' : 'casos'}.`,
        icon: Flame,
        color: 'text-orange-500'
      });
    }
    if (topLocations[0]) {
      list.push({
        title: 'Zona Caliente',
        description: `Mayor actividad registrada en ${topLocations[0].label}.`,
        icon: MapPin,
        color: 'text-red-500'
      });
    }
    if (trendDelta !== null) {
      list.push({
        title: 'Tendencia Periodo',
        description:
          trendDelta > 0
            ? `Crecimiento del ${trendDelta}% vs periodo anterior.`
            : `Descenso del ${Math.abs(trendDelta)}% vs periodo anterior.`,
        icon: TrendingUp,
        color: trendDelta > 0 ? 'text-emerald-500' : 'text-blue-500'
      });
    }
    return list;
  }, [topCategory, topLocations, trendDelta, resolutionRate, segment]);

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

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    const { start, end } = getRangeDates(range);
    try {
        const report = await generateAiReport({
            tenant_id: user?.id,
            segment,
            from: start,
            to: end,
            force: true // Force refresh when user explicitly clicks "Generate/Update"
        });
        setCachedReport(report);
    } catch (e) {
        console.error("Failed to generate AI Report", e);
        // Fallback to mock for now if backend endpoint is 404/500 during dev
        setCachedReport({
            summary: "Informe generado (Simulación). El backend no respondió.",
            opportunities: ["Oportunidad A", "Oportunidad B"],
            threats: [],
            tone: "Neutral",
            _cached: false
        });
    } finally {
        setIsGeneratingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-4 md:p-8 animate-pulse">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-40 w-full rounded-2xl bg-muted/20" />
          ))}
        </div>
        <Skeleton className="h-[400px] w-full rounded-2xl bg-muted/20" />
        <Skeleton className="h-[520px] w-full rounded-2xl bg-muted/20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex justify-center">
        <Alert variant="destructive" className="max-w-2xl shadow-lg border-red-200 bg-red-50 dark:bg-red-950/20">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <div className="ml-4">
            <AlertTitle className="text-lg font-semibold text-red-700 dark:text-red-400">Error al cargar datos</AlertTitle>
            <AlertDescription className="text-red-600/90 dark:text-red-400/90">{error}</AlertDescription>
            <Button variant="outline" onClick={handleRefresh} className="mt-4 border-red-200 text-red-700 hover:bg-red-100">
              Intentar nuevamente
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  const isPyme = segment === 'pyme';
  const labels = {
      total: isPyme ? 'Total Pedidos/Consultas' : 'Total Tickets',
      inProgress: isPyme ? 'En Preparación/Gestión' : 'En Gestión',
      solved: isPyme ? 'Entregados/Cerrados' : 'Resueltos',
      category: isPyme ? 'Categoría' : 'Categoría',
      timeline: isPyme ? 'Evolución de Ventas' : 'Evolución de Tickets',
      status: isPyme ? 'Estado de Pedidos' : 'Estado del Flujo',
      origin: isPyme ? 'Canal de Venta' : 'Origen',
      heatmap: isPyme ? 'Mapa de Clientes' : 'Mapa de Calor',
  };

  return (
    <div className="space-y-8 p-4 md:p-8 bg-gray-50/50 dark:bg-zinc-950 min-h-screen">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <BarChart3 className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Analytics Intelligence</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            {isPyme ? 'Panel de Ventas y Métricas' : 'Tablero de Control Ciudadano'}
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl">
            {isPyme
                ? 'Monitoreo de rendimiento comercial, canales de venta y zonas de entrega.'
                : 'Visión integral del rendimiento operativo y tendencias de servicio público.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="default" size="sm" onClick={handleRefresh} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all">
                <RefreshCcw className="mr-2 h-4 w-4" /> Actualizar
            </Button>
        </div>
      </div>

      <Card className="border-border/60 shadow-md bg-white/80 backdrop-blur-xl dark:bg-card/40 sticky top-0 z-10">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
             <div className="flex items-center gap-2 mr-auto">
                 <Filter className="w-4 h-4 text-muted-foreground" />
                 <span className="text-sm font-medium">Filtros Activos</span>
             </div>

            <Select value={segment} onValueChange={(value) => setSegment(value as Segment)}>
              <SelectTrigger className="w-[200px] h-9 text-sm">
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
              <SelectTrigger className="w-[160px] h-9 text-sm">
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

            {/* Conditional filters only for operational view */}
            {activeTab === 'operativo' && (
              <>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] h-9 text-sm">
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
                  <SelectTrigger className="w-[200px] h-9 text-sm">
                    <SelectValue placeholder={isPyme ? "Producto/Rubro" : "Categoría"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {dataNotice ? (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-400 font-medium">Información parcial</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300/80 text-sm">{dataNotice}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabView)} className="space-y-8">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="operativo" className="px-8">{isPyme ? 'Ventas y Operaciones' : 'Gestión Operativa'}</TabsTrigger>
          <TabsTrigger value="participacion" className="px-8">{isPyme ? 'Clientes y Encuestas' : 'Participación Ciudadana'}</TabsTrigger>
        </TabsList>

        <TabsContent value="operativo" className="space-y-8 focus-visible:outline-none">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title={labels.total}
              value={formatNumber(totalTickets)}
              subtitle="Volumen del periodo"
              icon={BarChart3}
              variant="info"
            />
            <SummaryCard
              title={labels.inProgress}
              value={formatNumber(ticketCounts?.enProceso ?? 0)}
              subtitle="Requieren atención"
              icon={Activity}
              variant="warning"
            />
            <SummaryCard
              title={labels.solved}
              value={formatNumber(ticketCounts?.resueltos ?? 0)}
              subtitle={`Tasa de éxito: ${resolutionRate}%`}
              icon={CheckCircle2}
              variant="success"
            />
            <SummaryCard
              title={isPyme ? "Top Producto" : "Top Categoría"}
              value={topCategory ? formatNumber(topCategory.value) : '-'}
              subtitle={topCategory ? topCategory.label : 'Sin datos'}
              icon={Flame}
              variant="default"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <AnalyticsChartCard
              title={labels.timeline}
              description={isPyme ? "Volumen de actividad comercial" : "Evolución de tickets creados"}
            >
              {timeline.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id={timelineGradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={THEME.colors.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={THEME.colors.primary} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={THEME.colors.border} />
                    <XAxis
                        dataKey="label"
                        tick={{ fill: THEME.colors.textSecondary, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickMargin={10}
                    />
                    <YAxis
                        allowDecimals={false}
                        tick={{ fill: THEME.colors.textSecondary, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: THEME.colors.primary, strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={THEME.colors.primary}
                      strokeWidth={3}
                      fill={`url(#${timelineGradientId})`}
                      activeDot={{ r: 6, strokeWidth: 0, fill: THEME.colors.primary }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-muted-foreground gap-2">
                  <Clock className="w-8 h-8 opacity-20" />
                  <p className="text-sm">Sin datos suficientes</p>
                </div>
              )}
            </AnalyticsChartCard>

            <AnalyticsChartCard
              title={labels.status}
              description="Distribución actual"
            >
              {statusBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <RadialBarChart
                    data={statusBreakdown.map((item, index) => ({
                      name: item.label,
                      value: item.value,
                      fill: THEME.palette[index % THEME.palette.length],
                    }))}
                    innerRadius="40%"
                    outerRadius="100%"
                    barSize={20}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <RadialBar
                      dataKey="value"
                      cornerRadius={10}
                      background={{ fill: THEME.colors.grid }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                  </RadialBarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-muted-foreground gap-2">
                  <Layers className="w-8 h-8 opacity-20" />
                  <p className="text-sm">Sin datos de estado</p>
                </div>
              )}
            </AnalyticsChartCard>

            <AnalyticsChartCard
              title={labels.origin}
              description="Canales de ingreso principales"
            >
              {channelBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={channelBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={THEME.colors.border} />
                    <XAxis dataKey="label" tick={{ fill: THEME.colors.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: THEME.colors.textSecondary, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: THEME.colors.surface }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {channelBreakdown.map((_, idx) => (
                        <Cell key={idx} fill={THEME.palette[idx % THEME.palette.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-muted-foreground gap-2">
                   <ArrowUpRight className="w-8 h-8 opacity-20" />
                  <p className="text-sm">Sin datos de canales</p>
                </div>
              )}
            </AnalyticsChartCard>
          </div>
        </TabsContent>

        <TabsContent value="participacion" className="focus-visible:outline-none">
          <ParticipationDashboard segment={segment} tenantId={user?.id as number} />
        </TabsContent>
      </Tabs>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="border-border/60 shadow-md bg-white dark:bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">{labels.heatmap}</CardTitle>
                <CardDescription>
                  Zonas con mayor densidad de actividad (Hotspots)
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                      <Label htmlFor="polygon-mode" className="text-xs text-muted-foreground">Polígonos</Label>
                      <Switch id="polygon-mode" checked={showPolygons} onCheckedChange={setShowPolygons} />
                  </div>
                  <Badge variant="secondary" className="px-3 py-1 text-xs font-mono">
                    <MapPin className="h-3 w-3 mr-1" />
                    {displayedHeatmapCount.toLocaleString('es-AR')} PUNTOS
                  </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-hidden rounded-b-xl">
            {heatmap.length > 0 ? (
              <div className="h-[550px] w-full">
                <AnalyticsHeatmap
                  initialHeatmapData={heatmap}
                  availableCategories={availableCategories}
                  availableBarrios={availableBarrios}
                  availableTipos={availableTipos}
                  metadata={heatmapDetails?.metadata?.map?.heatmap}
                  mapConfig={heatmapDetails?.mapConfig}
                  mapLayers={heatmapDetails?.mapLayers}
                />
              </div>
            ) : (
              <div className="flex h-[550px] items-center justify-center bg-muted/10 text-muted-foreground">
                <div className="text-center">
                    <MapPin className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p>No hay datos geográficos disponibles</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
           <Card className="border-indigo-100 shadow-lg bg-gradient-to-br from-indigo-50 via-purple-50 to-white dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-black">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                 <div className="bg-indigo-600 p-2 rounded-lg">
                    <BrainCircuit className="w-5 h-5 text-white" />
                 </div>
                 <div>
                    <CardTitle className="text-base text-indigo-900 dark:text-indigo-300">Consultor IA</CardTitle>
                    <CardDescription className="text-xs">
                        {cachedReport && cachedReport._cached ? 'Informe Reciente (Cache)' : 'Análisis bajo demanda'}
                    </CardDescription>
                 </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isGeneratingReport ? (
                 <div className="space-y-3 py-4">
                    <Skeleton className="h-4 w-3/4 bg-indigo-200/50" />
                    <Skeleton className="h-4 w-full bg-indigo-200/50" />
                    <Skeleton className="h-4 w-5/6 bg-indigo-200/50" />
                    <p className="text-xs text-center text-indigo-600 animate-pulse mt-2">Analizando datos con GPT-4...</p>
                 </div>
              ) : (
                <>
                  {cachedReport ? (
                      <div className="p-3 bg-white/70 dark:bg-black/40 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                          <div className="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-400">
                              <CalendarCheck2 className="w-4 h-4" />
                              <span className="text-xs font-semibold">Informe Disponible</span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                              {cachedReport.summary}
                          </p>
                          {cachedReport.opportunities.length > 0 && (
                              <div className="mt-2">
                                  <p className="text-[10px] font-bold uppercase text-emerald-600">Oportunidades</p>
                                  <ul className="list-disc pl-3 text-[10px] text-muted-foreground">
                                      {cachedReport.opportunities.slice(0, 2).map((op, i) => <li key={i}>{op}</li>)}
                                  </ul>
                              </div>
                          )}
                      </div>
                  ) : (
                    <p className="text-sm text-center py-4 text-muted-foreground">
                      Genera un informe estratégico basado en tus datos.
                    </p>
                  )}

                  {insights.length > 0 && !cachedReport && (
                    insights.map((insight) => (
                      <div key={insight.title} className="flex gap-3 items-start p-3 bg-white/70 dark:bg-black/40 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm transition-transform hover:scale-[1.02]">
                        <insight.icon className={`w-5 h-5 mt-0.5 ${insight.color}`} />
                        <div>
                            <h4 className="text-sm font-semibold">{insight.title}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{insight.description}</p>
                        </div>
                      </div>
                    ))
                  )}

                  <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/30">
                     <Button
                        variant={cachedReport ? "ghost" : "outline"}
                        size="sm"
                        className={`w-full group ${cachedReport ? 'text-indigo-600 hover:bg-indigo-50' : 'border-indigo-200 text-indigo-700 hover:bg-indigo-50'}`}
                        onClick={handleGenerateReport}
                     >
                        <Sparkles className="w-4 h-4 mr-2 text-indigo-500 group-hover:text-indigo-600" />
                        {cachedReport ? 'Actualizar Análisis (Ad-hoc)' : 'Generar Informe Detallado'}
                     </Button>
                     {cachedReport && (
                         <p className="text-[10px] text-center text-muted-foreground mt-2">
                             La actualización ad-hoc puede generar costos adicionales.
                         </p>
                     )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-md h-full">
             <CardHeader>
              <CardTitle className="text-lg">Zonas Críticas</CardTitle>
              <CardDescription>Top barrios/zonas con más {isPyme ? 'ventas' : 'tickets'}</CardDescription>
            </CardHeader>
            <CardContent>
              {topLocations.length > 0 ? (
                <div className="space-y-4">
                    {topLocations.map((location, index) => (
                      <div key={location.label} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                                  index === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                  {index + 1}
                              </div>
                              <span className="text-sm font-medium">{location.label}</span>
                          </div>
                          <Badge variant="outline" className="font-mono">{formatNumber(location.value)}</Badge>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  Sin datos de ubicación
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
