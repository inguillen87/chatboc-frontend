import React, { useState, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AnalyticsSummary } from '@/types/analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Loader2, Map as MapIcon, BarChart3, Zap, ArrowUpRight, ArrowDownRight, AlertTriangle } from 'lucide-react';
import MapLibreMap from '@/components/MapLibreMap';
import { analyticsService } from '@/services/analyticsService';

// --- Sub-components ---

const OverviewDashboard: React.FC<{ data: AnalyticsSummary }> = ({ data }) => (
  <div className="space-y-4">
    {/* KPI Grid */}
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interacciones Totales</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.kpis.total_interactions}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              +20.1% vs periodo anterior
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Respuesta</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.kpis.avg_response_time_s}s</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <ArrowDownRight className="h-3 w-3 text-green-500 mr-1" />
              -12% mejora
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversión (Est.)</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.kpis.conversion_rate ?? 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">Chat a Acción</p>
          </CardContent>
        </Card>
        {(data.kpis.backlog_open !== undefined) && (
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Backlog Abierto</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{data.kpis.backlog_open}</div>
                <p className="text-xs text-muted-foreground mt-1">
                    {data.kpis.sla_breaches ? `${data.kpis.sla_breaches} fuera de SLA` : 'Sin tickets vencidos'}
                </p>
            </CardContent>
            </Card>
        )}
    </div>

    {/* Charts Grid */}
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>Volumen de Interacciones</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data.volume_by_day}>
              <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}`} />
              <Tooltip />
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>Top Categorías</CardTitle>
          <CardDescription>Temas más frecuentes.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data.top_categories} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="category" type="category" width={100} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  </div>
);

const HeatmapDashboard: React.FC<{ data: AnalyticsSummary }> = ({ data }) => (
  <Card>
    <CardHeader>
      <CardTitle>Distribución Geográfica</CardTitle>
      <CardDescription>Mapa de calor de actividad.</CardDescription>
    </CardHeader>
    <CardContent className="h-[500px] relative rounded-md overflow-hidden">
        <MapLibreMap
            center={[-58.3816, -34.6037]}
            heatmapData={data.heatmap_points}
            initialZoom={11}
        />
    </CardContent>
  </Card>
);

const InsightsDashboard: React.FC<{ data: AnalyticsSummary }> = ({ data }) => (
  <div className="grid gap-4 md:grid-cols-2">
    <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
                <Zap className="h-5 w-5" /> Insights Automáticos
            </CardTitle>
            <CardDescription>Patrones detectados por IA.</CardDescription>
        </CardHeader>
        <CardContent>
            <ul className="space-y-4">
                {data.insights.map((insight, i) => (
                    <li key={i} className="flex gap-3 items-start p-3 bg-card rounded-lg shadow-sm border">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                            {i + 1}
                        </span>
                        <div>
                            <p className="text-sm font-medium">{insight.text}</p>
                            {insight.tags && (
                                <div className="flex gap-2 mt-2">
                                    {insight.tags.map(tag => (
                                        <span key={tag} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground uppercase">{tag}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </CardContent>
    </Card>

    <Card>
        <CardHeader>
            <CardTitle>Acciones Sugeridas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-sm mb-1">Optimizar Horarios</h4>
                <p className="text-sm text-muted-foreground">Considerar extender soporte los lunes debido al pico recurrente.</p>
                <Button size="sm" variant="outline" className="mt-3">Ver Configuración</Button>
            </div>
        </CardContent>
    </Card>
  </div>
);

// --- Main Page Component ---

const AnalyticsPage: React.FC = () => {
  const { currentSlug } = useTenant();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            if (!currentSlug) {
                // If no context, maybe wait or show global? For now, wait.
                return;
            }
            const result = await analyticsService.getSummary(currentSlug, timeRange);
            setData(result);
        } catch (err) {
            console.error("Analytics load failed", err);
            setError("No se pudieron cargar los datos.");
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [currentSlug, timeRange]);

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (error) {
      return (
          <div className="p-8 text-center text-red-500">
              <p>{error}</p>
              <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">Reintentar</Button>
          </div>
      );
  }

  if (!data) return null;

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics & Insights</h1>
          <p className="text-muted-foreground mt-1">Métricas clave y comportamiento en tiempo real.</p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Rango de tiempo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Últimas 24 horas</SelectItem>
            <SelectItem value="7d">Últimos 7 días</SelectItem>
            <SelectItem value="30d">Últimos 30 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visión General</TabsTrigger>
          <TabsTrigger value="geo">Mapa de Calor</TabsTrigger>
          <TabsTrigger value="insights">IA Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
            <OverviewDashboard data={data} />
        </TabsContent>

        <TabsContent value="geo">
            <HeatmapDashboard data={data} />
        </TabsContent>

        <TabsContent value="insights">
            <InsightsDashboard data={data} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsPage;
