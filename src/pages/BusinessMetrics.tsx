import React, { useEffect, useState, useCallback, FC, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  MapPin,
  BrainCircuit,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiFetch, getErrorMessage } from "@/utils/api";
import ChartTooltip from "@/components/analytics/ChartTooltip";
import TicketStatsCharts from "@/components/TicketStatsCharts";
import { getTicketStats, TicketStatsResponse } from "@/services/statsService";
import { enterpriseService } from "@/services/enterpriseService";
import { useTenant } from "@/context/TenantContext";
import { useParams } from "react-router-dom";
import MapLibreMap from "@/components/MapLibreMap";
import { isRecord, pickCollection, pickText } from "@/utils/responseShape";

// --- MOCK DATA & TYPES (as per backend spec) ---

interface Kpi {
  value: number;
  trend: number;
}

interface KpiData {
  total_sales: Kpi;
  total_orders: Kpi;
  new_customers: Kpi;
  avg_order_value: Kpi;
}

interface SalesDataPoint {
  date: string;
  sales: number;
}

interface TopProduct {
  rank: number;
  name: string;
  units_sold: number;
  revenue: number;
}

interface RegionSale {
  region_code: string;
  region_name: string;
  sales: number;
}

interface TenantDashboardBundle {
  tenant?: Record<string, any>;
  summary?: Record<string, any>;
  leads?: Record<string, any>;
  surveys?: Record<string, any>;
  unread?: Record<string, any>;
  team?: Record<string, any>;
  recommended_actions?: Array<Record<string, any>>;
  meta?: Record<string, any>;
}

interface TenantHeatmapSummary {
  top_categories?: Array<Record<string, any>>;
  top_zones?: Array<Record<string, any>>;
  hotspot_pairs?: Array<Record<string, any>>;
  heatmap_points?: Array<Record<string, any>>;
  meta?: Record<string, any>;
}

interface TenantEmployeeCoverage {
  categorias?: Array<Record<string, any>>;
  zonas?: Array<Record<string, any>>;
  permisos?: Array<Record<string, any>>;
  items?: Array<Record<string, any>>;
  meta?: Record<string, any>;
}

const formatStatusLabel = (value: string) =>
  value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');

const toNumber = (value: unknown): number => {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeKpi = (value: unknown): Kpi => {
  if (isRecord(value)) {
    return {
      value: toNumber(value.value ?? value.total ?? value.count),
      trend: toNumber(value.trend ?? value.delta ?? value.percent_change),
    };
  }

  return { value: toNumber(value), trend: 0 };
};

const normalizeKpiData = (payload: unknown): KpiData | null => {
  if (!isRecord(payload)) return null;
  const source = isRecord(payload.summary) ? payload.summary : payload;
  const keys = ['total_sales', 'total_orders', 'new_customers', 'avg_order_value'] as const;
  const hasAnyValue = keys.some((key) => source[key] !== undefined);
  if (!hasAnyValue) return null;

  return {
    total_sales: normalizeKpi(source.total_sales),
    total_orders: normalizeKpi(source.total_orders),
    new_customers: normalizeKpi(source.new_customers),
    avg_order_value: normalizeKpi(source.avg_order_value),
  };
};

const STATUS_TITLE_KEYWORDS = ['estado', 'status'];

// --- UI Components ---

const TrendIndicator: FC<{ trend: number }> = ({ trend }) => {
  const Icon = trend > 0 ? ArrowUp : trend < 0 ? ArrowDown : Minus;
  const color = trend > 0 ? "text-green-500" : trend < 0 ? "text-red-500" : "text-gray-500";
  return (
    <span className={cn("flex items-center text-sm font-semibold", color)}>
      <Icon className="h-4 w-4 mr-1" />
      {Math.abs(trend * 100).toFixed(0)}%
    </span>
  );
};

const KpiCard: FC<{ title: string; data: Kpi; icon: React.ReactNode; formatAsCurrency?: boolean }> = ({ title, data, icon, formatAsCurrency = false }) => (
  <Card className="group relative overflow-hidden border-border/60 bg-background/80 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5">
    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/70 via-sky-400/70 to-violet-400/70 opacity-80" />
    <div className="absolute -right-6 top-2 h-20 w-20 rounded-full bg-primary/5 blur-2xl transition-transform duration-500 group-hover:scale-125" />
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className="rounded-2xl border border-primary/10 bg-primary/5 p-2 text-primary shadow-sm">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold tracking-tight">
        {formatAsCurrency ? `$${data.value.toLocaleString('es-AR')}` : data.value.toLocaleString('es-AR')}
      </div>
      <div className="mt-3 inline-flex items-center rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
        <TrendIndicator trend={data.trend} />
        <span className="ml-2">vs. mes anterior</span>
      </div>
    </CardContent>
  </Card>
);

const SalesChart: FC<{ data: SalesDataPoint[] }> = ({ data }) => (
    <Card className="col-span-1 overflow-hidden border-border/60 bg-background/85 shadow-sm md:col-span-2 lg:col-span-3">
        <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/5 via-sky-500/5 to-violet-500/5">
            <CardTitle>Ventas en el Tiempo (Últimos 30 días)</CardTitle>
        </CardHeader>
        <CardContent>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                    <Tooltip formatter={(value) => [`$${Number(value).toLocaleString('es-AR')}`, "Ventas"]} contentStyle={{ borderRadius: 16, border: "1px solid rgba(148,163,184,0.2)", background: "rgba(15,23,42,0.92)", color: "#fff" }} />
                    <Legend />
                    <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </CardContent>
    </Card>
);

const TopProductsList: FC<{ products: TopProduct[] }> = ({ products }) => (
  <Card className="col-span-1 overflow-hidden border-border/60 bg-background/85 shadow-sm md:col-span-2 lg:col-span-2">
    <CardHeader className="border-b border-border/50 bg-gradient-to-r from-emerald-500/5 via-primary/5 to-transparent">
      <CardTitle>Top 5 Productos por Ingresos</CardTitle>
    </CardHeader>
    <CardContent>
      <ul className="space-y-4">
        {products.map((p) => (
          <li key={p.rank} className="flex items-center rounded-2xl border border-border/60 bg-muted/20 px-3 py-3">
            <div className="text-lg font-bold text-primary w-6">{p.rank}</div>
            <div className="flex-1 ml-4">
              <p className="font-semibold">{p.name}</p>
              <p className="text-sm text-muted-foreground">{p.units_sold} unidades vendidas</p>
            </div>
            <div className="text-right font-semibold">
              ${p.revenue.toLocaleString('es-AR')}
            </div>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);

const RegionChart: FC<{ data: RegionSale[] }> = ({ data }) => {
    const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'];
    return(
        <Card className="col-span-1 overflow-hidden border-border/60 bg-background/85 shadow-sm md:col-span-2 lg:col-span-1">
            <CardHeader className="border-b border-border/50 bg-gradient-to-r from-violet-500/5 via-primary/5 to-transparent">
                <CardTitle>Ventas por Región</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                        <Pie data={data} dataKey="sales" nameKey="region_name" cx="50%" cy="50%" outerRadius={80} label>
                            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip
                            cursor={false}
                            content={<ChartTooltip />}
                            formatter={(value) => `$${Number(value).toLocaleString('es-AR')}`}
                        />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
};

const MetricsSummary: FC<{ summary: string }> = ({ summary }) => (
    <Card className="col-span-1 overflow-hidden border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-background shadow-sm md:col-span-2 lg:col-span-4">
        <CardHeader className="flex flex-row items-center space-x-4 pb-2">
            <BrainCircuit className="w-8 h-8 text-primary"/>
            <CardTitle className="text-xl text-primary">Resumen Inteligente</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-primary/90">{summary}</p>
        </CardContent>
    </Card>
);

// --- Main Page Component ---

export default function BusinessMetrics() {
  const params = useParams<{ tenant: string }>();
  const { tenant } = useTenant();
  const tenantSlug = tenant?.slug || params.tenant || "";
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [sales, setSales] = useState<SalesDataPoint[] | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[] | null>(null);
  const [regions, setRegions] = useState<RegionSale[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [dashboardBundle, setDashboardBundle] =
    useState<TenantDashboardBundle | null>(null);
  const [tenantHeatmap, setTenantHeatmap] =
    useState<TenantHeatmapSummary | null>(null);
  const [employeeCoverage, setEmployeeCoverage] =
    useState<TenantEmployeeCoverage | null>(null);
  const [ticketCharts, setTicketCharts] = useState<TicketStatsResponse['charts']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ticketStatsPromise = getTicketStats({ tipo: 'pyme' }).catch((error) => {
        console.error('Error fetching ticket stats:', error);
        return { charts: [] } as TicketStatsResponse;
      });

      const [
        dashboardBundleRes,
        heatmapSummaryRes,
        employeeCoverageRes,
        summaryRes,
        kpisRes,
        salesRes,
        topProductsRes,
        regionSalesRes,
        ticketStatsRes
      ] = await Promise.all([
        tenantSlug
          ? enterpriseService.getTenantDashboardBundle(tenantSlug, {
              since_days: 30,
            })
          : Promise.resolve(null),
        tenantSlug
          ? enterpriseService.getTenantHeatmapSummary(tenantSlug, {
              since_days: 30,
              point_limit: 150,
            })
          : Promise.resolve(null),
        tenantSlug
          ? enterpriseService.getTenantEmployeeCoverage(tenantSlug)
          : Promise.resolve(null),
        apiFetch<unknown>('/api/metrics/summary'),
        apiFetch<unknown>('/api/metrics/kpis'),
        apiFetch<unknown>('/api/metrics/sales-over-time?period=30d'),
        apiFetch<unknown>('/api/metrics/top-products?limit=5'),
        apiFetch<unknown>('/api/metrics/sales-by-region'),
        ticketStatsPromise
      ]);

      setDashboardBundle(dashboardBundleRes);
      setTenantHeatmap(heatmapSummaryRes);
      setEmployeeCoverage(employeeCoverageRes);
      setSummary(pickText(summaryRes));
      setKpis(normalizeKpiData(kpisRes));
      setSales(pickCollection<SalesDataPoint>(salesRes, ['data', 'items', 'sales', 'points']));
      setTopProducts(pickCollection<TopProduct>(topProductsRes, ['products', 'items', 'data', 'results']));
      setRegions(pickCollection<RegionSale>(regionSalesRes, ['regions', 'items', 'data', 'results']));
      setTicketCharts(ticketStatsRes.charts || []);

    } catch (err) {
        setError(getErrorMessage(err, "No se pudieron cargar todas las métricas. El backend puede no estar completamente implementado."));
    } finally {
        setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    fetchAllMetrics();
  }, [fetchAllMetrics]);

  const statusSummary = useMemo(
    () => {
      if (!ticketCharts || ticketCharts.length === 0) return [] as { status: string; value: number }[];
      const statusChart = ticketCharts.find((chart) => {
        const title = (chart?.title ?? '').toString().toLowerCase();
        return STATUS_TITLE_KEYWORDS.some((keyword) => title.includes(keyword));
      });
      if (!statusChart) return [];
      return Object.entries(statusChart.data || {}).map(([status, value]) => ({
        status,
        value: toNumber(value),
      }));
    },
    [ticketCharts],
  );

  const additionalCharts = useMemo(
    () =>
      ticketCharts.filter((chart) => {
        const title = (chart?.title ?? '').toString().toLowerCase();
        return !STATUS_TITLE_KEYWORDS.some((keyword) => title.includes(keyword));
      }),
    [ticketCharts],
  );
  const bundleSummary = dashboardBundle?.summary || {};
  const bundleLeads = dashboardBundle?.leads || {};
  const bundleSurveys = dashboardBundle?.surveys || {};
  const bundleUnread = dashboardBundle?.unread || {};
  const bundleTeamItems = Array.isArray(dashboardBundle?.team?.items)
    ? dashboardBundle?.team?.items
    : [];
  const recommendedActions = Array.isArray(dashboardBundle?.recommended_actions)
    ? dashboardBundle.recommended_actions
    : [];
  const leadItems = Array.isArray(bundleLeads.items) ? bundleLeads.items : [];
  const collaborationActiveViewers = toNumber(bundleSummary.active_viewers);
  const collaborationUnreadViewers = toNumber(bundleSummary.unread_viewers);
  const leadsWithCollaboration = leadItems.filter(
    (item) => item?.collaboration_state,
  );
  const heatmapPoints = Array.isArray(tenantHeatmap?.heatmap_points)
    ? tenantHeatmap.heatmap_points
        .map((point) => ({
          lat: Number(point?.lat),
          lng: Number(point?.lng),
          weight: toNumber(point?.weight ?? point?.count ?? point?.total ?? 1),
          categoria: point?.categoria,
          zona: point?.zona,
          label: point?.label,
        }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
    : [];
  const coverageCategories = Array.isArray(employeeCoverage?.categorias)
    ? employeeCoverage.categorias
    : [];
  const coverageZones = Array.isArray(employeeCoverage?.zonas)
    ? employeeCoverage.zonas
    : [];
  const coveragePermissions = Array.isArray(employeeCoverage?.permisos)
    ? employeeCoverage.permisos
    : [];

  if (loading) {
    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
             <h1 className="text-3xl font-extrabold text-primary mb-6">Métricas del Negocio</h1>
             <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Skeleton className="h-32 col-span-full" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-80 col-span-full" />
             </div>
        </div>
    )
  }

  if (error) {
    return (
        <div className="p-4 text-center text-destructive">
            <AlertCircle className="mx-auto h-12 w-12" />
            <h2 className="mt-4 text-lg font-semibold">Error al cargar las métricas</h2>
            <p>{error}</p>
        <Button onClick={fetchAllMetrics} className="mt-4 gap-2 rounded-xl">
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
        </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 bg-background">
      <div className="relative flex flex-col gap-4 overflow-hidden rounded-[32px] border border-border/60 bg-gradient-to-br from-background via-primary/5 to-sky-500/10 p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Badge variant="outline" className="border-primary/20 bg-background/80 px-3 py-1 text-primary">
            <Sparkles className="mr-2 h-3.5 w-3.5" />
            Tenant command center
          </Badge>
          <div>
            <h1 className="text-4xl font-black tracking-tight text-foreground">
              Métricas del Negocio
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Panel operativo, cobertura, colaboración y analíticas comerciales en una vista unificada.
            </p>
          </div>
        </div>
        <Button onClick={fetchAllMetrics} disabled={loading} className="gap-2 rounded-2xl shadow-lg shadow-primary/15">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? 'Actualizando...' : 'Actualizar métricas'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardBundle && (
          <>
            <div className="col-span-1 md:col-span-2 lg:col-span-4 flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Leads {toNumber(bundleSummary.open_leads ?? bundleLeads.total).toLocaleString("es-AR")}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Unread {toNumber(bundleUnread.total_tickets_with_unread ?? bundleUnread.total).toLocaleString("es-AR")}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Equipo {bundleTeamItems.length.toLocaleString("es-AR")}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Viewers activos {collaborationActiveViewers.toLocaleString("es-AR")}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Viewers unread {collaborationUnreadViewers.toLocaleString("es-AR")}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Heatmap {heatmapPoints.length.toLocaleString("es-AR")} pts
              </Badge>
            </div>
            <Card className="col-span-1 md:col-span-2 lg:col-span-4 border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle>Panel operativo tenant</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Leads backlog</p>
                  <p className="mt-1 text-2xl font-bold">
                    {toNumber(
                      bundleSummary.open_leads ??
                        bundleLeads.open ??
                        bundleLeads.backlog ??
                        bundleLeads.total,
                    ).toLocaleString("es-AR")}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">SLA en riesgo</p>
                  <p className="mt-1 text-2xl font-bold">
                    {toNumber(
                      bundleSummary.sla_at_risk ??
                        bundleLeads.sla_at_risk ??
                        bundleLeads.sla_breached,
                    ).toLocaleString("es-AR")}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Tickets unread</p>
                  <p className="mt-1 text-2xl font-bold">
                    {toNumber(
                      bundleSummary.unread_tickets ??
                        bundleUnread.total_tickets_with_unread ??
                        bundleUnread.total,
                    ).toLocaleString("es-AR")}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Viewers activos</p>
                  <p className="mt-1 text-2xl font-bold">
                    {collaborationActiveViewers.toLocaleString("es-AR")}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Viewers unread</p>
                  <p className="mt-1 text-2xl font-bold">
                    {collaborationUnreadViewers.toLocaleString("es-AR")}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Encuestas activas</p>
                  <p className="mt-1 text-2xl font-bold">
                    {toNumber(
                      bundleSummary.active_surveys ??
                        bundleSurveys.active ??
                        bundleSurveys.total,
                    ).toLocaleString("es-AR")}
                  </p>
                </div>
              </CardContent>
            </Card>

            {(collaborationActiveViewers > 0 ||
              collaborationUnreadViewers > 0 ||
              leadsWithCollaboration.length > 0) && (
              <Card className="col-span-1 md:col-span-2 lg:col-span-4 border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>Colaboración en vivo</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-[240px_240px_minmax(0,1fr)]">
                  <div className="rounded-lg border border-border bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">Active viewers</p>
                    <p className="mt-1 text-2xl font-bold">{collaborationActiveViewers.toLocaleString("es-AR")}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">Unread viewers</p>
                    <p className="mt-1 text-2xl font-bold">{collaborationUnreadViewers.toLocaleString("es-AR")}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Leads con colaboración</p>
                    <div className="space-y-2">
                      {leadsWithCollaboration.slice(0, 5).map((item, index) => {
                        const leadName =
                          item?.nombre || item?.name || `Lead ${index + 1}`;
                        const unreadViewers = toNumber(
                          item?.collaboration_state?.unread_viewer_count,
                        );
                        const activeViewers = toNumber(
                          item?.collaboration_state?.active_viewers_count,
                        );
                        return (
                          <div
                            key={`bundle-collaboration-${item?.ticket_id || item?.nro_ticket || item?.id || index}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-medium">{leadName}</p>
                              <p className="text-xs text-muted-foreground">
                                #{item?.nro_ticket || item?.ticket_id || "—"}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{activeViewers} activos</Badge>
                              <Badge variant="outline">{unreadViewers} unread</Badge>
                            </div>
                          </div>
                        );
                      })}
                      {!leadsWithCollaboration.length ? (
                        <p className="text-sm text-muted-foreground">
                          Sin leads con colaboración activa en este rango.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {(recommendedActions.length > 0 || bundleTeamItems.length > 0) && (
              <Card className="col-span-1 md:col-span-2 lg:col-span-4 border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>Prioridades operativas</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_minmax(0,1fr)]">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Acciones sugeridas</p>
                    <div className="flex flex-wrap gap-2">
                      {recommendedActions.length ? (
                        recommendedActions.map((action, index) => (
                          <span
                            key={`tenant-dashboard-action-${index}`}
                            className="inline-flex items-center rounded-full border px-3 py-1 text-xs"
                          >
                            {String(
                              action?.label ||
                                action?.title ||
                                action?.action ||
                                action?.code ||
                                `action_${index + 1}`,
                            )}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">Sin acciones sugeridas.</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium">Carga del equipo</p>
                    <div className="space-y-2">
                      {bundleTeamItems.slice(0, 4).map((member, index) => (
                        <div
                          key={`team-workload-${index}`}
                          className="rounded-lg border border-border bg-muted/30 px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm">
                              {member?.employee_name ||
                                member?.nombre ||
                                member?.user_name ||
                                member?.email ||
                                `member_${index + 1}`}
                            </span>
                            <Badge variant="outline">
                              {toNumber(
                                member?.workload_open_tickets ??
                                  member?.open_tickets ??
                                  member?.assigned_open_tickets,
                              ).toLocaleString("es-AR")}
                            </Badge>
                          </div>
                          {(member?.active_ticket_views !== undefined ||
                            member?.idle_ticket_views !== undefined ||
                            member?.unread_ticket_views !== undefined) ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant="secondary">
                                activos {toNumber(member?.active_ticket_views).toLocaleString("es-AR")}
                              </Badge>
                              <Badge variant="secondary">
                                idle {toNumber(member?.idle_ticket_views).toLocaleString("es-AR")}
                              </Badge>
                              <Badge variant="secondary">
                                unread {toNumber(member?.unread_ticket_views).toLocaleString("es-AR")}
                              </Badge>
                            </div>
                          ) : null}
                        </div>
                      ))}
                      {!bundleTeamItems.length ? (
                        <p className="text-sm text-muted-foreground">
                          Sin carga de equipo en el bundle actual.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {(tenantHeatmap || employeeCoverage) && (
          <Card className="col-span-1 md:col-span-2 lg:col-span-4 border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Mapa de calor y cobertura operativa</CardTitle>
              <p className="text-sm text-muted-foreground">
                Lectura rápida para operación territorial, hotspots y distribución del equipo.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  {heatmapPoints.length ? (
                    <MapLibreMap
                      className="h-[360px] w-full rounded-lg"
                      heatmapData={heatmapPoints as any}
                      showHeatmap
                    />
                  ) : (
                    <div className="flex h-[360px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                      No hay puntos de heatmap disponibles en el rango actual.
                    </div>
                  )}
                </div>

                <div className="grid gap-4">
                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-medium">Top categorías</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(tenantHeatmap?.top_categories || []).slice(0, 8).map((item, index) => (
                        <Badge key={`top-category-${index}`} variant="outline">
                          {String(item?.categoria || item?.label || item?.name || `categoria_${index + 1}`)} · {toNumber(item?.count ?? item?.total)}
                        </Badge>
                      ))}
                      {!(tenantHeatmap?.top_categories || []).length ? (
                        <span className="text-sm text-muted-foreground">Sin categorías agregadas.</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-medium">Top zonas</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(tenantHeatmap?.top_zones || []).slice(0, 8).map((item, index) => (
                        <Badge key={`top-zone-${index}`} variant="secondary">
                          {String(item?.zona || item?.label || item?.name || `zona_${index + 1}`)} · {toNumber(item?.count ?? item?.total)}
                        </Badge>
                      ))}
                      {!(tenantHeatmap?.top_zones || []).length ? (
                        <span className="text-sm text-muted-foreground">Sin zonas agregadas.</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-medium">Hotspots</p>
                    <div className="mt-3 space-y-2 text-sm">
                      {(tenantHeatmap?.hotspot_pairs || []).slice(0, 4).map((item, index) => (
                        <div key={`hotspot-${index}`} className="flex items-center justify-between rounded-lg border px-3 py-2 transition-colors hover:bg-muted/30">
                          <span>
                            {String(
                              item?.categoria ||
                                item?.category ||
                                item?.label ||
                                item?.zona ||
                                `hotspot_${index + 1}`,
                            )}
                          </span>
                          <span className="text-muted-foreground">
                            {toNumber(item?.count ?? item?.total ?? item?.weight)}
                          </span>
                        </div>
                      ))}
                      {!(tenantHeatmap?.hotspot_pairs || []).length ? (
                        <span className="text-muted-foreground">Sin hotspots en el resumen actual.</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border p-4">
                  <p className="text-sm font-medium">Cobertura por categorías</p>
                  <div className="mt-3 space-y-2 text-sm">
                    {coverageCategories.slice(0, 5).map((item, index) => (
                      <div key={`coverage-category-${index}`} className="flex items-center justify-between">
                        <span>{String(item?.categoria || item?.label || item?.name || `categoria_${index + 1}`)}</span>
                        <Badge variant="outline">{toNumber(item?.employees ?? item?.count ?? item?.total)}</Badge>
                      </div>
                    ))}
                    {!coverageCategories.length ? (
                      <span className="text-muted-foreground">Sin cobertura cargada.</span>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-sm font-medium">Cobertura por zonas</p>
                  <div className="mt-3 space-y-2 text-sm">
                    {coverageZones.slice(0, 5).map((item, index) => (
                      <div key={`coverage-zone-${index}`} className="flex items-center justify-between">
                        <span>{String(item?.zona || item?.label || item?.name || `zona_${index + 1}`)}</span>
                        <Badge variant="outline">{toNumber(item?.employees ?? item?.count ?? item?.total)}</Badge>
                      </div>
                    ))}
                    {!coverageZones.length ? (
                      <span className="text-muted-foreground">Sin zonas configuradas.</span>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-sm font-medium">Cobertura por permisos</p>
                  <div className="mt-3 space-y-2 text-sm">
                    {coveragePermissions.slice(0, 5).map((item, index) => (
                      <div key={`coverage-permission-${index}`} className="flex items-center justify-between">
                        <span>{String(item?.permiso || item?.label || item?.name || `permiso_${index + 1}`)}</span>
                        <Badge variant="outline">{toNumber(item?.employees ?? item?.count ?? item?.total)}</Badge>
                      </div>
                    ))}
                    {!coveragePermissions.length ? (
                      <span className="text-muted-foreground">Sin permisos agregados.</span>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {summary && <MetricsSummary summary={summary} />}

        {statusSummary.length > 0 && (
          <Card className="col-span-1 md:col-span-2 lg:col-span-4 border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Estado de Tickets</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statusSummary.map(({ status, value }) => (
                <div
                  key={status}
                  className="rounded-lg border border-border bg-muted/40 p-4"
                >
                  <p className="text-sm text-muted-foreground">
                    {formatStatusLabel(status)}
                  </p>
                  <p className="mt-1 text-2xl font-bold">{value.toLocaleString('es-AR')}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {kpis && (
            <>
                <KpiCard title="Ventas Totales" data={kpis.total_sales} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} formatAsCurrency />
                <KpiCard title="Pedidos Totales" data={kpis.total_orders} icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />} />
                <KpiCard title="Nuevos Clientes" data={kpis.new_customers} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
                <KpiCard title="Ticket Promedio" data={kpis.avg_order_value} icon={<Package className="h-4 w-4 text-muted-foreground" />} formatAsCurrency />
            </>
        )}

        {sales && <SalesChart data={sales} />}

        {topProducts && <TopProductsList products={topProducts} />}

        {regions && <RegionChart data={regions} />}

        {additionalCharts.length > 0 && (
          <Card className="col-span-1 md:col-span-2 lg:col-span-4 border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Analíticas de Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <TicketStatsCharts charts={additionalCharts} />
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
