import React, { useEffect, useState, useCallback, FC, useMemo, useRef, useSyncExternalStore } from "react";
import {
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
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  BrainCircuit,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/utils/api";
import TicketStatsCharts from "@/components/TicketStatsCharts";
import type { TicketStatsResponse } from "@/services/statsService";
import { PremiumTerritoryHeatmap } from "@/features/analytics/PremiumTerritoryMap";
import type { OperationsHeatmapPoint, OperationsHeatmapV1, PublicMapConfigV1 } from "@/features/analytics/analyticsTypes";

import { readBusinessMetrics, metricNumber, metricCount, formatMetricCount, metricReason, formatBusinessAmount, type BusinessKpi, type BusinessKpis, type MetricSeries } from './BusinessMetrics.data';
import { usePrivateAnalyticsScope } from '@/features/analytics/usePrivateAnalyticsScope';
import type { PrivateAnalyticsScope } from '@/features/analytics/privateAnalyticsScope';
import { Link } from 'react-router-dom';
import { ViewState } from '@/components/app-shell/ViewState';
import { subscribeChatbocSessionRevision, captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from '@/utils/chatbocSessionRevision';

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

const normalizeBusinessHeatmapPoint = (point: Record<string, any>): OperationsHeatmapPoint | null => {
  const lat = metricNumber(point?.lat ?? point?.latitude);
  const lng = metricNumber(point?.lng ?? point?.lon ?? point?.longitude);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  const fallbackCategory = point?.ticket_type ?? point?.source ?? "actividad";
  return {
    ...point,
    id: point?.id ?? point?.ticket_id ?? point?.survey_id ?? point?.response_id,
    lat,
    lng,
    weight: metricNumber(point?.weight ?? point?.count ?? point?.total) ?? 1,
    category: String(point?.category ?? point?.categoria ?? fallbackCategory),
    categoria: String(point?.categoria ?? point?.category ?? fallbackCategory),
    barrio: point?.barrio ?? point?.zona,
    distrito: point?.distrito ?? point?.zona,
    label:
      point?.label ??
      point?.survey_title ??
      point?.survey_slug ??
      point?.ticket_id ??
      point?.response_id,
    source: point?.source,
    type: point?.ticket_type,
    estado: point?.estado ?? point?.status,
  };
};

const normalizeLegacyHeatmapPoints = (tenantHeatmap?: TenantHeatmapSummary | null): OperationsHeatmapPoint[] =>
  Array.isArray(tenantHeatmap?.heatmap_points)
    ? tenantHeatmap.heatmap_points
        .map(normalizeBusinessHeatmapPoint)
        .filter((point): point is OperationsHeatmapPoint => Boolean(point))
    : [];

const bucketFromRecord = (item: Record<string, any>, index: number, labelKeys: string[], fallbackPrefix: string) => {
  const label = labelKeys.map((key) => item?.[key]).find((value) => value !== undefined && value !== null);
  return {
    ...item,
    key: String(label ?? item?.id ?? `${fallbackPrefix}_${index + 1}`),
    label: String(label ?? `${fallbackPrefix} ${index + 1}`),
    count: metricCount(item?.count ?? item?.total ?? item?.weight),
  };
};

const mapLegacyHeatmapSummary = (
  tenantHeatmap: TenantHeatmapSummary | null,
  heatmapPoints: OperationsHeatmapPoint[],
): OperationsHeatmapV1 | undefined => {
  if (!tenantHeatmap && heatmapPoints.length === 0) return undefined;
  const topCategories = tenantHeatmap?.top_categories ?? [];
  const topZones = tenantHeatmap?.top_zones ?? [];
  const hotspotPairs = tenantHeatmap?.hotspot_pairs ?? [];

  return {
    contract_version: "operations.heatmap.v1",
    render_contract: {
      state: heatmapPoints.length ? "ready" : "empty",
      map_engine: "maplibre",
      layers: ["heatmap", "points", "categories"],
      can_render_heatmap: heatmapPoints.length > 0,
      recommended_views: ["territory", "hotspots", "coverage"],
      premium_metadata: {
        source: "tenant_heatmap_summary",
        compatibility_source: true,
      },
    },
    summary: {
      points: heatmapPoints.length,
      top_categories: topCategories.length,
      top_zones: topZones.length,
      hotspots: hotspotPairs.length,
      can_render_heatmap: heatmapPoints.length > 0,
    },
    points: heatmapPoints,
    cells: [],
    hotspots: hotspotPairs.map((item, index) => bucketFromRecord(item, index, ["label", "categoria", "category", "zona"], "hotspot")),
    facets: [
      {
        key: "categoria",
        field: "categoria",
        query_param: "categoria",
        label: "Categoria",
        items: topCategories.map((item, index) => bucketFromRecord(item, index, ["categoria", "category", "label", "name"], "categoria")),
      },
      {
        key: "zona",
        field: "zona",
        query_param: "zona",
        label: "Zona",
        items: topZones.map((item, index) => bucketFromRecord(item, index, ["zona", "label", "name"], "zona")),
      },
    ].filter((facet) => facet.items.length > 0),
    category_layers: topCategories.map((item, index) => bucketFromRecord(item, index, ["categoria", "category", "label", "name"], "categoria")),
    quality: {
      contract_version: "operations.heatmap_quality.v1",
      state: heatmapPoints.length ? "ready" : "empty",
      label: heatmapPoints.length ? "Mapa listo" : "Sin coordenadas",
      reason_code: heatmapPoints.length ? "legacy_summary_ready" : "legacy_summary_without_points",
      visible_points: heatmapPoints.length,
      can_render_heatmap: heatmapPoints.length > 0,
    },
    realtime: {
      contract_version: "operations.heatmap_realtime.v1",
      poll_seconds: 60,
      sources: ["tickets", "surveys", "legacy_summary"],
    },
    map_narrative: {
      contract_version: "operations.heatmap_narrative.v1",
      state: heatmapPoints.length ? "ready" : "empty",
      headline: heatmapPoints.length
        ? "Mapa operativo unificado"
        : "Todavia faltan coordenadas para activar el mapa",
      body: heatmapPoints.length
        ? "Lectura territorial de reclamos, encuestas y actividad comercial desde el resumen operativo del tenant."
        : "Cuando el tenant cargue direcciones geocodificadas o respuestas con zona, este modulo muestra hotspots y cobertura.",
    },
    map_experience: {
      contract_version: "operations.heatmap_experience.v1",
      preferred_visualization: "interactive_globe_heatmap",
      map_engines: ["maplibre", "svg"],
      layer_groups: ["base_heatmap", "category_layers", "survey_participation"],
      empty_state_behavior: "show_geocoding_guidance",
      supports_reduced_motion: true,
    },
  };
};

const formatStatusLabel = (value: string) =>
  value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');

const STATUS_TITLE_KEYWORDS = ['estado', 'status'];

// --- UI Components ---

const KpiCard: FC<{ title: string; data: BusinessKpi; icon: React.ReactNode; currency?: string | null; monetary?: boolean }> = ({ title, data, icon, currency = null, monetary = false }) => (
  <Card role="group" aria-label={title} className="relative overflow-hidden border-border/60 bg-background/80 shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div aria-hidden="true" className="rounded-xl bg-primary/5 p-2 text-primary">{icon}</div>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold tracking-tight">
        {data.value === null ? 'No disponible' : monetary ? formatBusinessAmount(data.value, currency) : data.value.toLocaleString('es-AR')}
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        {data.value === null ? metricReason(data.reasonCode) : title === 'Clientes con pedidos'
          ? 'Identidades registradas con pedidos. Cada identificador se cuenta una vez.' : monetary
            ? 'Importes registrados en pedidos.' : 'Pedidos registrados.'}
      </p>
    </CardContent>
  </Card>
);

type SeriesAvailability = MetricSeries<unknown>['availability'];
const EmptyMetricCard: FC<{ title: string; detail: string; availability?: SeriesAvailability }> = ({ title, detail, availability }) => (
  <Card className="col-span-1 border-border/60 bg-background/85 shadow-sm md:col-span-2">
    <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
    <CardContent className="space-y-2">
      <p className="font-medium">No disponible</p>
      <p className="text-sm text-muted-foreground">{availability?.reasonCode === 'request_failed'
        ? 'No pudimos consultar este detalle. Actualizá las métricas para reintentar.' : detail}</p>
    </CardContent>
  </Card>
);

const SalesChart: FC<{ data: SalesDataPoint[]; currency: string | null; availability?: SeriesAvailability }> = ({ data, currency, availability }) => {
  if (!data.length || availability?.state === 'unavailable') return <EmptyMetricCard title="Evolución de importes" availability={availability}
    detail="La serie temporal de pedidos no está disponible. Podés consultar los totales confirmados de esta vista." />;
  return (
    <Card className="col-span-1 border-border/60 md:col-span-2 lg:col-span-3">
      <CardHeader><CardTitle>Evolución de importes</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={(value) => Number(value).toLocaleString('es-AR')} />
            <Tooltip formatter={(value) => [formatBusinessAmount(Number(value), currency), 'Importe de pedidos']} />
            <Line type="monotone" dataKey="sales" name="Importe de pedidos" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
const TopProductsList: FC<{ products: TopProduct[]; currency: string | null; availability?: SeriesAvailability }> = ({ products, currency, availability }) => {
  if (!products.length || availability?.state === 'unavailable') return <EmptyMetricCard title="Productos por importe de pedidos" availability={availability}
    detail="El detalle por producto no está disponible. Los totales no permiten reconstruir este desglose." />;
  return (
    <Card className="col-span-1 border-border/60 md:col-span-2">
      <CardHeader><CardTitle>Productos por importe de pedidos</CardTitle></CardHeader>
      <CardContent><ul className="space-y-4">{products.map((product, index) => (
        <li key={product.rank ?? index} className="flex gap-3 rounded-xl border p-3">
          <span className="font-bold text-primary">{product.rank}</span>
          <div className="min-w-0 flex-1"><p className="font-semibold">{product.name}</p>
            <p className="text-sm text-muted-foreground">{product.units_sold} unidades registradas</p></div>
          <span className="font-semibold">{formatBusinessAmount(product.revenue, currency)}</span>
        </li>
      ))}</ul></CardContent>
    </Card>
  );
};
const RegionChart: FC<{ data: RegionSale[]; currency: string | null; availability?: SeriesAvailability }> = ({ data, currency, availability }) => {
  if (!data.length || availability?.state === 'unavailable') return <EmptyMetricCard title="Importes por región" availability={availability}
    detail="El detalle por región no está disponible. No se deducen ubicaciones a partir de los totales." />;
  const colors = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'];
  return (
    <Card className="col-span-1 border-border/60 md:col-span-2">
      <CardHeader><CardTitle>Importes por región</CardTitle></CardHeader>
      <CardContent><ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={data} dataKey="sales" nameKey="region_name" outerRadius={80} label>
            {data.map((entry, index) => <Cell key={entry.region_code ?? index} fill={colors[index % colors.length]} />)}
          </Pie>
          <Tooltip formatter={(value) => formatBusinessAmount(Number(value), currency)} /><Legend />
        </PieChart>
      </ResponsiveContainer></CardContent>
    </Card>
  );
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
  const { scope, pending, key } = usePrivateAnalyticsScope();
  const revision = useSyncExternalStore(subscribeChatbocSessionRevision, captureChatbocSessionRevision, captureChatbocSessionRevision);
  if (pending) return <ViewState status="loading" title="Validando acceso" />;
  if (!scope?.kind) return <ViewState status="empty" title="Seleccioná una organización"
    description="Las métricas requieren un perfil y una organización verificados." />;
  if (scope.tenantId === null || !Number.isSafeInteger(scope.tenantId) || scope.tenantId <= 0) return <ViewState status="empty"
    title="Falta confirmar la organización" description="Revisá el perfil de la organización antes de consultar sus métricas."
    action={<Button asChild><Link to="/perfil">Revisar perfil</Link></Button>} />;
  return <ScopedBusinessMetrics key={JSON.stringify([key, scope.tenantSlug, scope.tenantId, scope.kind, revision])} scope={scope} sessionRevision={revision} />;
}

function ScopedBusinessMetrics({ scope, sessionRevision }: { scope: PrivateAnalyticsScope; sessionRevision: number }) {
  const tenantSlug = scope.tenantSlug;
  const [kpis, setKpis] = useState<BusinessKpis | null>(null);
  const [sales, setSales] = useState<SalesDataPoint[] | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[] | null>(null);
  const [regions, setRegions] = useState<RegionSale[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [dashboardBundle, setDashboardBundle] =
    useState<TenantDashboardBundle | null>(null);
  const [tenantHeatmap, setTenantHeatmap] =
    useState<TenantHeatmapSummary | null>(null);
  const [operationsHeatmap, setOperationsHeatmap] =
    useState<OperationsHeatmapV1 | null>(null);
  const [heatmapPointsObserved, setHeatmapPointsObserved] = useState(false);
  const [mapConfig, setMapConfig] = useState<PublicMapConfigV1 | null>(null);
  const [employeeCoverage, setEmployeeCoverage] =
    useState<TenantEmployeeCoverage | null>(null);
  const [ticketCharts, setTicketCharts] = useState<TicketStatsResponse['charts']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [seriesAvailability, setSeriesAvailability] = useState<Record<string, SeriesAvailability>>({});
  const requestSequence = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const fetchAllMetrics = useCallback(async () => {
    if (!mounted.current || !isChatbocSessionRevisionCurrent(sessionRevision)) return;
    requestAbort.current?.abort();
    const controller = new AbortController();
    requestAbort.current = controller;
    const sequence = ++requestSequence.current;
    const isCurrent = () => mounted.current && sequence === requestSequence.current && !controller.signal.aborted
      && isChatbocSessionRevisionCurrent(sessionRevision);
    setLoading(true); setError(null);
    setKpis(null); setSales(null); setTopProducts(null); setRegions(null); setSummary(null);
    setDashboardBundle(null); setTenantHeatmap(null); setOperationsHeatmap(null); setHeatmapPointsObserved(false); setMapConfig(null);
    setEmployeeCoverage(null); setTicketCharts([]); setSeriesAvailability({});
    try {
      const result = await readBusinessMetrics(scope, controller.signal, isCurrent);
      if (!isCurrent()) return;
      setDashboardBundle(result.dashboardBundle);
      setTenantHeatmap(result.heatmap.legacy);
      setOperationsHeatmap(result.heatmap.operations);
      setHeatmapPointsObserved(result.heatmap.pointsObserved);
      setMapConfig(result.mapConfig);
      setEmployeeCoverage(result.employeeCoverage);
      setSummary(result.summary);
      setKpis(result.kpis);
      setSales(result.sales.items.filter(item => typeof item.date === 'string' && metricNumber(item.sales) !== null)
        .map(item => ({ date: item.date, sales: metricNumber(item.sales)! })));
      setTopProducts(result.products.items.filter(item => typeof item.name === 'string' && metricNumber(item.revenue) !== null && metricNumber(item.units_sold) !== null)
        .map((item, index) => ({ name: item.name, rank: metricNumber(item.rank) ?? index + 1, revenue: metricNumber(item.revenue)!, units_sold: metricNumber(item.units_sold)! })));
      setRegions(result.regions.items.filter(item => typeof item.region_name === 'string' && metricNumber(item.sales) !== null)
        .map(item => ({ region_name: item.region_name, region_code: item.region_code, sales: metricNumber(item.sales)! })));
      setSeriesAvailability({ sales: result.sales.availability, products: result.products.availability, regions: result.regions.availability });
      setTicketCharts(result.ticketCharts);
    } catch (error) {
      if (isCurrent()) setError(getErrorMessage(error, 'No pudimos cargar las métricas. Reintentá en unos minutos.'));
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [tenantSlug, scope.tenantId, scope.scopeKey, scope.kind, sessionRevision]);

  useEffect(() => {
    mounted.current = true;
    void fetchAllMetrics();
    return () => { mounted.current = false; requestSequence.current += 1; requestAbort.current?.abort(); };
  }, [fetchAllMetrics]);

  const statusSummary = useMemo(
    () => {
      if (!ticketCharts || ticketCharts.length === 0) return [] as { status: string; value: number | null }[];
      const statusChart = ticketCharts.find((chart) => {
        const title = (chart?.title ?? '').toString().toLowerCase();
        return STATUS_TITLE_KEYWORDS.some((keyword) => title.includes(keyword));
      });
      if (!statusChart) return [];
      return Object.entries(statusChart.data || {}).map(([status, value]) => ({
        status,
        value: metricCount(value),
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
  const teamItemCount = Array.isArray(dashboardBundle?.team?.items) ? bundleTeamItems.length : null;
  const recommendedActions = Array.isArray(dashboardBundle?.recommended_actions)
    ? dashboardBundle.recommended_actions
    : [];
  const leadItems = Array.isArray(bundleLeads.items) ? bundleLeads.items : [];
  const collaborationActiveViewers = metricCount(bundleSummary.active_viewers);
  const collaborationUnreadViewers = metricCount(bundleSummary.unread_viewers);
  const leadsWithCollaboration = leadItems.filter(
    (item) => item?.collaboration_state,
  );
  const legacyHeatmapPoints = useMemo(() => normalizeLegacyHeatmapPoints(tenantHeatmap), [tenantHeatmap]);
  const premiumHeatmap = useMemo(
    () => operationsHeatmap ?? mapLegacyHeatmapSummary(tenantHeatmap, legacyHeatmapPoints),
    [legacyHeatmapPoints, operationsHeatmap, tenantHeatmap],
  );
  const heatmapPoints = premiumHeatmap?.points?.length ? premiumHeatmap.points : legacyHeatmapPoints;
  const locatedPointCount = heatmapPointsObserved ? heatmapPoints.length : null;
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
                Leads {formatMetricCount(bundleSummary.open_leads ?? bundleLeads.total)}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Unread {formatMetricCount(bundleUnread.total_tickets_with_unread ?? bundleUnread.total)}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Equipo {formatMetricCount(teamItemCount)}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Viewers activos {formatMetricCount(collaborationActiveViewers)}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Viewers unread {formatMetricCount(collaborationUnreadViewers)}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Heatmap {formatMetricCount(locatedPointCount)} pts
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
                    {formatMetricCount(
                      bundleSummary.open_leads ??
                        bundleLeads.open ??
                        bundleLeads.backlog ??
                        bundleLeads.total,
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">SLA en riesgo</p>
                  <p className="mt-1 text-2xl font-bold">
                    {formatMetricCount(
                      bundleSummary.sla_at_risk ??
                        bundleLeads.sla_at_risk ??
                        bundleLeads.sla_breached,
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Tickets unread</p>
                  <p className="mt-1 text-2xl font-bold">
                    {formatMetricCount(
                      bundleSummary.unread_tickets ??
                        bundleUnread.total_tickets_with_unread ??
                        bundleUnread.total,
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Viewers activos</p>
                  <p className="mt-1 text-2xl font-bold">
                    {formatMetricCount(collaborationActiveViewers)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Viewers unread</p>
                  <p className="mt-1 text-2xl font-bold">
                    {formatMetricCount(collaborationUnreadViewers)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Encuestas activas</p>
                  <p className="mt-1 text-2xl font-bold">
                    {formatMetricCount(
                      bundleSummary.active_surveys ??
                        bundleSurveys.active ??
                        bundleSurveys.total,
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            {((collaborationActiveViewers !== null && collaborationActiveViewers > 0) ||
              (collaborationUnreadViewers !== null && collaborationUnreadViewers > 0) ||
              leadsWithCollaboration.length > 0) && (
              <Card className="col-span-1 md:col-span-2 lg:col-span-4 border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>Colaboración en vivo</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-[240px_240px_minmax(0,1fr)]">
                  <div className="rounded-lg border border-border bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">Active viewers</p>
                    <p className="mt-1 text-2xl font-bold">{formatMetricCount(collaborationActiveViewers)}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">Unread viewers</p>
                    <p className="mt-1 text-2xl font-bold">{formatMetricCount(collaborationUnreadViewers)}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Leads con colaboración</p>
                    <div className="space-y-2">
                      {leadsWithCollaboration.slice(0, 5).map((item, index) => {
                        const leadName =
                          item?.nombre || item?.name || `Lead ${index + 1}`;
                        const unreadViewers = metricCount(
                          item?.collaboration_state?.unread_viewer_count,
                        );
                        const activeViewers = metricCount(
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
                              <Badge variant="outline">{formatMetricCount(activeViewers)} activos</Badge>
                              <Badge variant="outline">{formatMetricCount(unreadViewers)} unread</Badge>
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
                              {formatMetricCount(
                                member?.workload_open_tickets ??
                                  member?.open_tickets ??
                                  member?.assigned_open_tickets,
                              )}
                            </Badge>
                          </div>
                          {(member?.active_ticket_views !== undefined ||
                            member?.idle_ticket_views !== undefined ||
                            member?.unread_ticket_views !== undefined) ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant="secondary">
                                activos {formatMetricCount(member?.active_ticket_views)}
                              </Badge>
                              <Badge variant="secondary">
                                idle {formatMetricCount(member?.idle_ticket_views)}
                              </Badge>
                              <Badge variant="secondary">
                                unread {formatMetricCount(member?.unread_ticket_views)}
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

        {(tenantHeatmap || premiumHeatmap || employeeCoverage) && (
          <Card className="col-span-1 md:col-span-2 lg:col-span-4 border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Mapa de calor y cobertura operativa</CardTitle>
              <p className="text-sm text-muted-foreground">
                Lectura rapida para operacion territorial, hotspots y distribucion del equipo.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <Badge variant="outline">Puntos con ubicación {formatMetricCount(locatedPointCount)}</Badge>
                    <Badge variant={operationsHeatmap ? "default" : "outline"}>
                      {operationsHeatmap ? "Contrato ops" : "Fuente tenant"}
                    </Badge>
                  </div>
                  <PremiumTerritoryHeatmap
                    points={heatmapPoints}
                    heatmap={premiumHeatmap}
                    mapConfig={mapConfig ?? undefined}
                    allowDemoFallback={false}
                    demoProfile={scope.kind === "municipio" ? "gobierno" : "general"}
                    className="min-h-[520px]"
                  />
                </div>

                <div className="grid gap-4">
                  <div className="rounded-xl border p-4">
                    <p className="text-sm font-medium">Top categorías</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(tenantHeatmap?.top_categories || []).slice(0, 8).map((item, index) => (
                        <Badge key={`top-category-${index}`} variant="outline">
                          {String(item?.categoria || item?.label || item?.name || `categoria_${index + 1}`)} · {formatMetricCount(item?.count ?? item?.total)}
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
                          {String(item?.zona || item?.label || item?.name || `zona_${index + 1}`)} · {formatMetricCount(item?.count ?? item?.total)}
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
                            {formatMetricCount(item?.count ?? item?.total ?? item?.weight)}
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
                        <Badge variant="outline">{formatMetricCount(item?.employees ?? item?.count ?? item?.total)}</Badge>
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
                        <Badge variant="outline">{formatMetricCount(item?.employees ?? item?.count ?? item?.total)}</Badge>
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
                        <Badge variant="outline">{formatMetricCount(item?.employees ?? item?.count ?? item?.total)}</Badge>
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
                  <p className="mt-1 text-2xl font-bold">{formatMetricCount(value)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {kpis && (
            <>
                <KpiCard title="Importe de pedidos" data={kpis.total_sales} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} monetary currency={kpis.currency} />
                <KpiCard title="Pedidos totales" data={kpis.total_orders} icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />} />
                <KpiCard title="Clientes con pedidos" data={kpis.unique_customers} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
                <KpiCard title="Importe promedio por pedido" data={kpis.avg_order_value} icon={<Package className="h-4 w-4 text-muted-foreground" />} monetary currency={kpis.currency} />
            </>
        )}

        <SalesChart data={sales ?? []} currency={kpis?.currency ?? null} availability={seriesAvailability.sales} />

        <TopProductsList products={topProducts ?? []} currency={kpis?.currency ?? null} availability={seriesAvailability.products} />

        <RegionChart data={regions ?? []} currency={kpis?.currency ?? null} availability={seriesAvailability.regions} />

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
