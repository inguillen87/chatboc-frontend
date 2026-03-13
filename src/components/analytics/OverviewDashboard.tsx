import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { BarChart3, Zap, ArrowUpRight, ArrowDownRight, Clock, Users, Mic, Video, Keyboard, Captions } from 'lucide-react';
import { AnalyticsSummary } from '../../services/analyticsService';

interface Props {
  data: AnalyticsSummary;
  showSla?: boolean;
  showConversion?: boolean;
}

const OverviewDashboard: React.FC<Props> = ({ data, showSla, showConversion }) => {
  const kpis = data?.kpis ?? {
    total_interactions: 0,
    active_users: 0,
    avg_response_time_s: 0,
    conversion_rate: 0,
    backlog_open: 0,
    sla_breaches: 0,
  };
  const volumeByDay = Array.isArray(data?.volume_by_day) ? data.volume_by_day : [];
  const topCategories = Array.isArray(data?.top_categories) ? data.top_categories : [];


  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interacciones</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.total_interactions}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
              Total del periodo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.active_users}</div>
            <p className="text-xs text-muted-foreground mt-1">Usuarios únicos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Respuesta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.avg_response_time_s}s</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              <ArrowDownRight className="h-3 w-3 text-green-500 mr-1" />
              Promedio
            </p>
          </CardContent>
        </Card>

        {showConversion && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Conversión</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.conversion_rate || 0}%</div>
              <p className="text-xs text-muted-foreground mt-1">De chat a venta</p>
            </CardContent>
          </Card>
        )}

        {showSla && (
           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tickets Abiertos</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.backlog_open || 0}</div>
              <p className="text-xs text-muted-foreground mt-1 text-yellow-600">
                 {kpis.sla_breaches || 0} fuera de SLA
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">% interacciones por voz</CardTitle>
            <Mic className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.voice_interactions_pct || 0}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">% interacciones video/avatar</CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.video_avatar_interactions_pct || 0}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finalización sin escribir</CardTitle>
            <Keyboard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.no_typing_completion_rate || 0}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa accesibilidad</CardTitle>
            <Captions className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.accessibility_usage_rate || 0}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Volumen Diario</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={volumeByDay}>
                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top Categorías</CardTitle>
            <CardDescription>Temas más frecuentes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topCategories} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis dataKey="category" type="category" width={100} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'transparent' }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OverviewDashboard;
