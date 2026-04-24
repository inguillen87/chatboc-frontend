import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ShoppingBag, Zap, TrendingUp } from 'lucide-react';
import { AnalyticsSummary } from '@/services/analyticsService';
import { MeasuredContainer } from '@/components/analytics/MeasuredContainer';

interface Props {
  data: AnalyticsSummary;
}

const PymeDashboard: React.FC<Props> = ({ data }) => {
  const kpis = data?.kpis ?? {
    total_interactions: 0,
    active_users: 0,
    avg_response_time_s: 0,
    conversion_rate: 0,
    backlog_open: 0,
    sla_breaches: 0,
  };
  const topCategories = Array.isArray(data?.top_categories) ? data.top_categories : [];


  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversión</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.conversion_rate || 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">De chat a venta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interacciones</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.total_interactions}</div>
            <p className="text-xs text-muted-foreground mt-1">Consultas totales</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos Top</CardTitle>
            <ShoppingBag className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{topCategories.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Categorías activas</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ventas por Categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <MeasuredContainer className="h-[300px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
            <BarChart data={topCategories} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="category" type="category" width={120} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
          </MeasuredContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default PymeDashboard;
