import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import TicketStatsCharts from '@/components/TicketStatsCharts';
import { getTickets } from '@/services/ticketService';
import { getTicketStats, HeatPoint, TicketStatsResponse } from '@/services/statsService';
import { getErrorMessage } from '@/utils/api';
import type { Ticket } from '@/types/tickets';
import { AlertCircle, CheckCircle2, Loader } from 'lucide-react';

interface TicketCounts {
  abiertos: number;
  en_proceso: number;
  resueltos: number;
}

interface CountItem {
  label: string;
  value: number;
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

const STATUS_KEYWORDS = ['estado', 'status', 'situacion', 'situación'];
const CATEGORY_KEYWORDS = ['categoria', 'categoría', 'category', 'rubro', 'tipo'];

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

const aggregateHeatmap = (points: HeatPoint[]): { statuses: CountItem[]; categories: CountItem[] } => {
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

const aggregateTickets = (tickets: Ticket[]): { statuses: CountItem[]; categories: CountItem[] } => {
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
    return 'en_proceso';
  }
  return 'abiertos';
};

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
  <Card className="shadow-lg" style={{ borderLeft: `4px solid ${color}` }}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

export default function EstadisticasPage() {
  const [ticketCounts, setTicketCounts] = useState<TicketCounts | null>(null);
  const [statusBreakdown, setStatusBreakdown] = useState<CountItem[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CountItem[]>([]);
  const [charts, setCharts] = useState<TicketStatsResponse['charts']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataNotice, setDataNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [statsResult, ticketsResult] = await Promise.allSettled([
          getTicketStats({ tipo: 'municipio' }),
          getTickets(),
        ]);

        const chartsData: TicketStatsResponse['charts'] =
          statsResult.status === 'fulfilled' ? statsResult.value.charts ?? [] : [];
        const heatmapData: HeatPoint[] =
          statsResult.status === 'fulfilled' ? statsResult.value.heatmap ?? [] : [];
        if (statsResult.status === 'rejected') {
          console.error('Error loading ticket stats:', statsResult.reason);
        }

        const tickets: Ticket[] =
          ticketsResult.status === 'fulfilled' ? ticketsResult.value.tickets ?? [] : [];
        if (ticketsResult.status === 'rejected') {
          console.error('Error loading tickets for fallback statistics:', ticketsResult.reason);
        }

        const chartStatuses = toCountItems(extractChartData(chartsData, STATUS_KEYWORDS));
        const chartCategories = toCountItems(extractChartData(chartsData, CATEGORY_KEYWORDS));
        const heatmapAggregates = aggregateHeatmap(heatmapData);
        const ticketAggregates = aggregateTickets(tickets);

        const mergedStatuses = mergeCountSources([
          ticketAggregates.statuses,
          chartStatuses,
          heatmapAggregates.statuses,
        ]);
        const mergedCategories = mergeCountSources([
          ticketAggregates.categories,
          chartCategories,
          heatmapAggregates.categories,
        ]);

        const summary = mergedStatuses.reduce(
          (acc, item) => {
            const bucket = classifyStatusSummary(item.label);
            acc[bucket] += item.value;
            return acc;
          },
          { abiertos: 0, en_proceso: 0, resueltos: 0 } satisfies TicketCounts,
        );

        const totalSummary = summary.abiertos + summary.en_proceso + summary.resueltos;
        if (totalSummary === 0 && tickets.length > 0) {
          summary.abiertos = tickets.length;
        }

        setTicketCounts(totalSummary > 0 ? summary : null);
        setStatusBreakdown(
          mergedStatuses.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
        );
        setCategoryBreakdown(
          mergedCategories.sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
        );
        setCharts(chartsData);

        const notices: string[] = [];
        if (statsResult.status === 'rejected' || chartsData.length === 0) {
          notices.push(
            'Calculamos los indicadores principales a partir de los tickets registrados porque el backend no devolvió métricas agregadas completas.',
          );
        } else if (
          ticketAggregates.categories.length > chartCategories.length ||
          ticketAggregates.statuses.length > chartStatuses.length
        ) {
          notices.push(
            'Completamos la información con los tickets disponibles para asegurar que todas las categorías y estados estén representados.',
          );
        }
        setDataNotice(notices.length > 0 ? notices.join(' ') : null);
      } catch (err) {
        setError(getErrorMessage(err, 'No se pudieron cargar las estadísticas.'));
        console.error('Error loading statistics dashboard:', err);
        setTicketCounts(null);
        setStatusBreakdown([]);
        setCategoryBreakdown([]);
        setCharts([]);
        setDataNotice(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="p-4 text-center">Cargando estadísticas...</div>;
  }

  if (error) {
    return <div className="p-4 text-destructive bg-destructive/10 p-3 rounded-md text-center">{error}</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-8">
      <h1 className="text-3xl font-extrabold text-primary">Estadísticas de Reclamos</h1>

      {ticketCounts ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Reclamos Abiertos"
            value={ticketCounts.abiertos.toLocaleString('es-AR')}
            icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />}
            color="hsl(var(--destructive))"
          />
          <StatCard
            title="Reclamos en Proceso"
            value={ticketCounts.en_proceso.toLocaleString('es-AR')}
            icon={<Loader className="h-4 w-4 text-muted-foreground" />}
            color="hsl(var(--primary))"
          />
          <StatCard
            title="Reclamos Resueltos"
            value={ticketCounts.resueltos.toLocaleString('es-AR')}
            icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
            color="hsl(var(--success))"
          />
        </div>
      ) : null}

      <Card className="bg-card shadow-lg rounded-xl border border-border backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Nota sobre Estadísticas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground">
            Estas estadísticas se generan con toda la información disponible del backend. Cuando faltan métricas agregadas, el tablero completa los datos usando los tickets registrados para mantener los indicadores actualizados.
          </p>
          {dataNotice && <p className="text-sm text-muted-foreground">{dataNotice}</p>}
        </CardContent>
      </Card>

      {statusBreakdown.length > 0 || categoryBreakdown.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {statusBreakdown.length > 0 && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Estados de los reclamos</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statusBreakdown.map((item) => (
                      <TableRow key={item.label}>
                        <TableCell>{item.label}</TableCell>
                        <TableCell className="text-right">
                          {item.value.toLocaleString('es-AR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          {categoryBreakdown.length > 0 && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>Categorías más frecuentes</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryBreakdown.map((item) => (
                      <TableRow key={item.label}>
                        <TableCell>{item.label}</TableCell>
                        <TableCell className="text-right">
                          {item.value.toLocaleString('es-AR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {charts && charts.length > 0 ? (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Indicadores adicionales</CardTitle>
          </CardHeader>
          <CardContent>
            <TicketStatsCharts charts={charts} />
          </CardContent>
        </Card>
      ) : null}

      {!ticketCounts && statusBreakdown.length === 0 && categoryBreakdown.length === 0 && (!charts || charts.length === 0) ? (
        <p className="text-center text-muted-foreground">No hay datos de estadísticas disponibles.</p>
      ) : null}
    </div>
  );
}
