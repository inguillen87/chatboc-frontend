import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { AnalyticsSummary } from '@/services/analyticsService';
import { MeasuredContainer } from '@/components/analytics/MeasuredContainer';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface Props {
  data: AnalyticsSummary;
}

const formatOptionalCount = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 'No disponible';

const MunicipioDashboard: React.FC<Props> = ({ data }) => {
  const kpis = data?.kpis ?? {
    total_interactions: 0,
    active_users: 0,
    avg_response_time_s: 0,
    conversion_rate: undefined,
    backlog_open: undefined,
    sla_breaches: undefined,
  };
  const topCategories = Array.isArray(data?.top_categories) ? data.top_categories : [];
  const hasClassifiedCases = topCategories.some((item) => typeof item?.count === 'number' && item.count > 0);
  const hasActivity = [kpis.backlog_open, kpis.sla_breaches, kpis.active_users]
    .some((value) => typeof value === 'number' && value > 0)
    || topCategories.some((item) => typeof item?.count === 'number' && item.count > 0);

  if (!hasActivity) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <div>
            <h2 className="text-lg font-semibold">Todavía no hay actividad para mostrar</h2>
            <p className="mt-1 text-sm text-muted-foreground">Los indicadores aparecerán cuando se registre el primer caso o una participación.</p>
          </div>
          <Button asChild className="min-h-11"><Link to="/perfil?tab=tickets">Abrir reclamos</Link></Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reclamos abiertos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatOptionalCount(kpis.backlog_open)}</div>
            <p className="text-xs text-muted-foreground mt-1">Pendientes de resolución</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Plazo vencido</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatOptionalCount(kpis.sla_breaches)}</div>
            <p className="text-xs text-muted-foreground mt-1">Casos que superaron el plazo previsto</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Personas que participaron</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.active_users}</div>
            <p className="text-xs text-muted-foreground mt-1">Participación ciudadana</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Casos por tema</CardTitle>
        </CardHeader>
        <CardContent>
          {hasClassifiedCases ? <MeasuredContainer className="h-[300px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
            <BarChart data={topCategories} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="category" type="category" width={120} tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ fill: 'transparent' }} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
          </MeasuredContainer> : (
            <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Todavía no hay casos clasificados.</p>
              <Button asChild variant="outline" className="min-h-11"><Link to="/perfil?tab=tickets">Abrir reclamos</Link></Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MunicipioDashboard;
