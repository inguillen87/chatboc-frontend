import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { AnalyticsSummary } from '@/services/analyticsService';
import { MeasuredContainer } from '@/components/analytics/MeasuredContainer';

interface Props {
  data: AnalyticsSummary;
}

const MunicipioDashboard: React.FC<Props> = ({ data }) => {
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
            <CardTitle className="text-sm font-medium">Reclamos Abiertos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.backlog_open || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Pendientes de resolución</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Vencido</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{kpis.sla_breaches || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Tickets fuera de tiempo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vecinos Activos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.active_users}</div>
            <p className="text-xs text-muted-foreground mt-1">Participación ciudadana</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Categorías de Reclamos</CardTitle>
        </CardHeader>
        <CardContent>
          <MeasuredContainer className="h-[300px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
            <BarChart data={topCategories} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="category" type="category" width={120} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
          </MeasuredContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default MunicipioDashboard;
