import React, { useState, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AnalyticsSummary } from '@/types/analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Loader2, Map as MapIcon, BarChart3, Zap, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import MapLibreMap from '@/components/MapLibreMap';

// Mock data generator for frontend demo
const generateMockData = (): AnalyticsSummary => ({
  total_interactions: 1250,
  active_users: 320,
  avg_response_time: 45, // seconds
  conversion_rate: 12.5,
  top_categories: [
    { category: 'Consultas Generales', count: 450 },
    { category: 'Soporte Técnico', count: 320 },
    { category: 'Ventas', count: 210 },
    { category: 'Reclamos', count: 150 },
  ],
  volume_by_day: Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString('es-AR', { weekday: 'short' }),
    count: Math.floor(Math.random() * 200) + 50,
  })),
  heatmap_points: Array.from({ length: 20 }, () => ({
    lat: -34.6037 + (Math.random() - 0.5) * 0.1,
    lng: -58.3816 + (Math.random() - 0.5) * 0.1,
    weight: Math.floor(Math.random() * 10) + 1,
  })),
  ai_insights: [
    "Pico de consultas sobre 'Horarios' el lunes a las 10am.",
    "Aumento del 15% en conversión vía WhatsApp.",
    "Categoría 'Reclamos' redujo su tiempo de resolución un 20%."
  ]
});

const AnalyticsPage = () => {
  const { currentSlug } = useTenant();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    // Simulate API call
    setLoading(true);
    setTimeout(() => {
      setData(generateMockData());
      setLoading(false);
    }, 1000);
  }, [currentSlug, timeRange]);

  if (loading) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (!data) return null;

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics & Insights</h1>
          <p className="text-muted-foreground mt-1">Métricas clave y comportamiento de tu audiencia en tiempo real.</p>
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

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interacciones Totales</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.total_interactions}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              +20.1% respecto al periodo anterior
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.active_users}</div>
            <p className="text-xs text-muted-foreground mt-1">Usuarios únicos interactuando</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Respuesta Prom.</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.avg_response_time}s</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <ArrowDownRight className="h-3 w-3 text-green-500 mr-1" />
              -12% mejora en velocidad
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa Conversión (Est.)</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.conversion_rate}%</div>
            <p className="text-xs text-muted-foreground mt-1">De chat a acción completada</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visión General</TabsTrigger>
          <TabsTrigger value="geo">Mapa de Calor</TabsTrigger>
          <TabsTrigger value="insights">IA Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
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
                <CardDescription>Temas más frecuentes de conversación.</CardDescription>
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
        </TabsContent>

        <TabsContent value="geo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribución Geográfica</CardTitle>
              <CardDescription>Mapa de calor basado en la ubicación de los usuarios (donde esté disponible).</CardDescription>
            </CardHeader>
            <CardContent className="h-[500px] relative rounded-md overflow-hidden">
               <MapLibreMap
                  center={[-58.3816, -34.6037]}
                  heatmapData={data.heatmap_points}
                  initialZoom={11}
               />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
           <div className="grid gap-4 md:grid-cols-2">
              <Card className="bg-primary/5 border-primary/20">
                  <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-primary">
                          <Zap className="h-5 w-5" /> Insights Automáticos
                      </CardTitle>
                      <CardDescription>Generado por IA analizando patrones de conversación.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <ul className="space-y-4">
                          {data.ai_insights.map((insight, i) => (
                              <li key={i} className="flex gap-3 items-start p-3 bg-card rounded-lg shadow-sm border">
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                                      {i + 1}
                                  </span>
                                  <p className="text-sm">{insight}</p>
                              </li>
                          ))}
                      </ul>
                  </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                      <CardTitle>Recomendaciones de Acción</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="p-4 border rounded-lg">
                          <h4 className="font-semibold text-sm mb-1">Optimizar Horarios de Atención</h4>
                          <p className="text-sm text-muted-foreground">Considerar extender el soporte los lunes por la mañana debido al alto volumen de consultas.</p>
                          <Button size="sm" variant="outline" className="mt-3">Ver Configuración</Button>
                      </div>
                      <div className="p-4 border rounded-lg">
                          <h4 className="font-semibold text-sm mb-1">Actualizar FAQ: "Envíos"</h4>
                          <p className="text-sm text-muted-foreground">Muchas consultas sobre costos de envío no se resuelven automáticamente.</p>
                          <Button size="sm" variant="outline" className="mt-3">Editar Respuestas</Button>
                      </div>
                  </CardContent>
              </Card>
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AnalyticsPage;
