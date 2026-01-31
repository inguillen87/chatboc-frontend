import React, { useState, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AnalyticsSummary } from '@/types/analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Funnel, FunnelChart, LabelList } from 'recharts';
import { Loader2, Map as MapIcon, BarChart3, Zap, ArrowUpRight, ArrowDownRight, AlertTriangle, Users, Filter } from 'lucide-react';
import MapLibreMap from '@/components/MapLibreMap';
import { analyticsService } from '@/services/analyticsService';

// --- Sub-components ---

const OverviewDashboard: React.FC<{ data: AnalyticsSummary }> = ({ data }) => {
  // Safe default for funnel data if not present (backend compat)
  const funnelData = (data as any).funnel_data || [
    { value: 1000, name: 'Ingresos', fill: '#8884d8' },
    { value: 800, name: 'Conversaciones', fill: '#83a6ed' },
    { value: 500, name: 'Leads', fill: '#8dd1e1' },
    { value: 200, name: 'Ventas', fill: '#82ca9d' }
  ];

  return (
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
            <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.kpis.active_users}</div>
            <p className="text-xs text-muted-foreground mt-1">En el periodo seleccionado</p>
          </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Backlog & SLA</CardTitle>
                <AlertTriangle className={`h-4 w-4 ${(data.kpis.sla_breaches || 0) > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{data.kpis.backlog_open ?? 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                    {data.kpis.sla_breaches ? `${data.kpis.sla_breaches} tickets vencidos` : 'SLA Saludable'}
                </p>
            </CardContent>
        </Card>
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

      {/* Dynamic Right Column: Funnel for Sales, Categories for Support */}
      <Card className="col-span-3">
        <Tabs defaultValue="categories" className="w-full">
            <div className="px-6 pt-6 flex items-center justify-between">
                <CardTitle className="text-lg">Distribución</CardTitle>
                <TabsList className="grid w-[180px] grid-cols-2">
                    <TabsTrigger value="categories">Temas</TabsTrigger>
                    <TabsTrigger value="funnel">Funnel</TabsTrigger>
                </TabsList>
            </div>

            <CardContent className="pt-4">
                <TabsContent value="categories" className="h-[300px] mt-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.top_categories} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="category" type="category" width={100} tick={{ fontSize: 12 }} />
                        <Tooltip cursor={{ fill: 'transparent' }} />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={32} />
                        </BarChart>
                    </ResponsiveContainer>
                </TabsContent>

                <TabsContent value="funnel" className="h-[300px] mt-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <FunnelChart>
                            <Tooltip />
                            <Funnel
                                data={funnelData}
                                dataKey="value"
                                nameKey="name"
                                isAnimationActive
                            >
                                <LabelList position="right" fill="#888" stroke="none" dataKey="name" />
                            </Funnel>
                        </FunnelChart>
                    </ResponsiveContainer>
                </TabsContent>
            </CardContent>
        </Tabs>
      </Card>
    </div>
  </div>
  );
};

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

import { FileText, Bell, TrendingUp } from 'lucide-react';

const InsightsDashboard: React.FC<{ data: AnalyticsSummary }> = ({ data }) => {
  const alerts = data.insights.filter(i => i.severity === 'high');
  const trends = data.insights.filter(i => i.severity !== 'high');

  return (
  <div className="space-y-6">
    {/* High Priority Alerts Section */}
    {alerts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {alerts.map((alert, i) => (
                <Card key={i} className="border-red-200 bg-red-50/50">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" /> Alerta Crítica
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-red-700 mb-2">{alert.text}</p>
                        {alert.tags && (
                            <div className="flex flex-wrap gap-1">
                                {alert.tags.map(tag => (
                                    <span key={tag} className="px-1.5 py-0.5 rounded-full bg-red-100 text-[10px] font-semibold text-red-800 uppercase tracking-wider">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    )}

    <div className="grid gap-4 md:grid-cols-3">
        {/* Main Insights Feed */}
        <Card className="md:col-span-2 bg-gradient-to-br from-indigo-50/50 to-purple-50/30 border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-primary">
                    <Zap className="h-5 w-5" /> Tendencias y Patrones
                </CardTitle>
                <CardDescription>Análisis automático de conversaciones recientes.</CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="space-y-4">
                    {trends.map((insight, i) => (
                        <li key={i} className="flex gap-4 items-start p-4 bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-indigo-100 transition-all hover:shadow-md">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                                <TrendingUp className="h-4 w-4" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-slate-800">{insight.text}</p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {insight.tags?.map(tag => (
                                        <span key={tag} className="text-[10px] bg-slate-100 px-2 py-1 rounded-md text-slate-600 border border-slate-200 uppercase font-medium tracking-wide">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </li>
                    ))}
                    {trends.length === 0 && (
                        <p className="text-center text-muted-foreground py-8 italic">No se detectaron nuevas tendencias hoy.</p>
                    )}
                </ul>
            </CardContent>
        </Card>

        {/* Executive Summary & Actions */}
        <div className="space-y-4">
            <Card className="bg-slate-900 text-slate-50 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-400" /> Resumen Ejecutivo
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-slate-300">
                    <p>
                        La actividad aumentó un <strong>15%</strong> esta semana.
                        El tema más consultado fue <strong>"Pagos"</strong>.
                        La satisfacción estimada se mantiene estable.
                    </p>
                    <Button variant="secondary" size="sm" className="w-full gap-2">
                        <FileText className="h-3 w-3" /> Descargar PDF Semanal
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Bell className="h-4 w-4" /> Acciones Sugeridas
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
                        <h4 className="font-semibold text-xs text-amber-900 mb-1">Reponer Stock</h4>
                        <p className="text-xs text-amber-700">3 productos con alta demanda y bajo stock.</p>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <h4 className="font-semibold text-xs text-blue-900 mb-1">Capacitar Bot</h4>
                        <p className="text-xs text-blue-700">Nueva pregunta frecuente detectada sobre "Envíos a Tierra del Fuego".</p>
                        <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 text-xs mt-1">
                            Agregar a FAQ →
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  </div>
  );
};

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
          <p className="text-muted-foreground mt-1">
             Tablero de control inteligente para {currentSlug || 'tu organización'}.
          </p>
        </div>

        <div className="flex gap-2">
            <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" /> Filtros
            </Button>
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
