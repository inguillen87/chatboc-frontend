import React, { useEffect, useState, useCallback, FC } from "react";
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
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch, ApiError } from "@/utils/api";

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
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">
        {formatAsCurrency ? `$${data.value.toLocaleString('es-AR')}` : data.value.toLocaleString('es-AR')}
      </div>
      <div className="text-xs text-muted-foreground flex items-center">
        <TrendIndicator trend={data.trend} />
        <span className="ml-2">vs. mes anterior</span>
      </div>
    </CardContent>
  </Card>
);

const SalesChart: FC<{ data: SalesDataPoint[] }> = ({ data }) => (
    <Card className="col-span-1 md:col-span-2 lg:col-span-3">
        <CardHeader>
            <CardTitle>Ventas en el Tiempo (Últimos 30 días)</CardTitle>
        </CardHeader>
        <CardContent>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                    <Tooltip formatter={(value) => [`$${Number(value).toLocaleString('es-AR')}`, "Ventas"]} />
                    <Legend />
                    <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </CardContent>
    </Card>
);

const TopProductsList: FC<{ products: TopProduct[] }> = ({ products }) => (
  <Card className="col-span-1 md:col-span-2 lg:col-span-2">
    <CardHeader>
      <CardTitle>Top 5 Productos por Ingresos</CardTitle>
    </CardHeader>
    <CardContent>
      <ul className="space-y-4">
        {products.map((p) => (
          <li key={p.rank} className="flex items-center">
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
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];
    return(
        <Card className="col-span-1 md:col-span-2 lg:col-span-1">
            <CardHeader>
                <CardTitle>Ventas por Región</CardTitle>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                        <Pie data={data} dataKey="sales" nameKey="region_name" cx="50%" cy="50%" outerRadius={80} label>
                            {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(value) => `$${Number(value).toLocaleString('es-AR')}`} />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
};

const MetricsSummary: FC<{ summary: string }> = ({ summary }) => (
    <Card className="col-span-1 md:col-span-2 lg:col-span-4 bg-primary/10 border-primary/30">
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
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [sales, setSales] = useState<SalesDataPoint[] | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[] | null>(null);
  const [regions, setRegions] = useState<RegionSale[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        summaryRes,
        kpisRes,
        salesRes,
        topProductsRes,
        regionSalesRes
      ] = await Promise.all([
        apiFetch<{ summary: string }>('/api/metrics/summary'),
        apiFetch<KpiData>('/api/metrics/kpis'),
        apiFetch<{ data: SalesDataPoint[] }>('/api/metrics/sales-over-time?period=30d'),
        apiFetch<{ products: TopProduct[] }>('/api/metrics/top-products?limit=5'),
        apiFetch<{ regions: RegionSale[] }>('/api/metrics/sales-by-region')
      ]);

      setSummary(summaryRes.summary);
      setKpis(kpisRes);
      setSales(salesRes.data);
      setTopProducts(topProductsRes.products);
      setRegions(regionSalesRes.regions);

    } catch (err) {
        setError(getErrorMessage(err, "No se pudieron cargar todas las métricas. El backend puede no estar completamente implementado."));
    } finally {
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllMetrics();
  }, [fetchAllMetrics]);

  if (loading) {
    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
             <h1 className="text-3xl font-extrabold text-primary mb-6">Métricas del Negocio</h1>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <Button onClick={fetchAllMetrics} className="mt-4">Reintentar</Button>
        </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 bg-background">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-extrabold text-primary">
          Métricas del Negocio
        </h1>
        <Button onClick={fetchAllMetrics} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar Métricas'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summary && <MetricsSummary summary={summary} />}

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

      </div>
    </div>
  );
}