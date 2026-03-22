import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Area,
  ComposedChart,
} from 'recharts';
import {
  BarChart3,
  Zap,
  Clock,
  Users,
  Mic,
  Video,
  Keyboard,
  Captions,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AnalyticsSummary } from '../../services/analyticsService';
import { MeasuredContainer } from '@/components/analytics/MeasuredContainer';
import { KpiTile } from '@/components/analytics/KpiTile';

interface Props {
  data: AnalyticsSummary;
  showSla?: boolean;
  showConversion?: boolean;
}

const formatMetric = (value: number | string, suffix = '') => `${value}${suffix}`;

const tooltipStyle = {
  borderRadius: 16,
  border: '1px solid rgba(148, 163, 184, 0.2)',
  background: 'rgba(15, 23, 42, 0.92)',
  color: '#fff',
  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.3)',
};

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
  const totalVolume = useMemo(() => volumeByDay.reduce((acc, item) => acc + Number(item?.count || 0), 0), [volumeByDay]);
  const peakDay = useMemo(() => volumeByDay.reduce((best, item) => Number(item?.count || 0) > Number(best?.count || 0) ? item : best, volumeByDay[0] || null as any), [volumeByDay]);
  const categoryLeader = topCategories[0];

  const overviewCards = [
    {
      title: 'Interacciones',
      value: kpis.total_interactions,
      icon: BarChart3,
      delta: { value: 12.4, label: 'Total del periodo', positive: true },
    },
    {
      title: 'Usuarios activos',
      value: kpis.active_users,
      icon: Users,
      delta: { value: 8.1, label: 'Usuarios únicos', positive: true },
    },
    {
      title: 'Tiempo respuesta',
      value: kpis.avg_response_time_s,
      suffix: 's',
      icon: Clock,
      delta: { value: 5.6, label: 'Promedio del periodo', positive: false },
    },
  ];

  if (showConversion) {
    overviewCards.push({
      title: 'Conversión',
      value: kpis.conversion_rate || 0,
      suffix: '%',
      icon: Zap,
      delta: { value: 4.2, label: 'De chat a venta', positive: true },
    });
  }

  if (showSla) {
    overviewCards.push({
      title: 'Tickets abiertos',
      value: kpis.backlog_open || 0,
      icon: Zap,
      delta: {
        value: kpis.sla_breaches || 0,
        label: `${kpis.sla_breaches || 0} fuera de SLA`,
        positive: (kpis.sla_breaches || 0) === 0,
      },
    });
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/60 bg-gradient-to-br from-background via-primary/5 to-sky-500/10 shadow-sm">
        <CardContent className="grid gap-4 p-5 md:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-background/75 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Volumen total</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-foreground">{totalVolume.toLocaleString('es-AR')}</p>
            <p className="mt-1 text-sm text-muted-foreground">Interacciones acumuladas durante el período seleccionado.</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/75 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pico diario</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-foreground">{Number(peakDay?.count || 0).toLocaleString('es-AR')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{peakDay?.date ? `Mejor jornada: ${peakDay.date}` : 'Sin día pico disponible todavía.'}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/75 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Categoría líder</p>
            <p className="mt-2 text-2xl font-black tracking-tight text-foreground">{categoryLeader?.category || '—'}</p>
            <p className="mt-1 text-sm text-muted-foreground">{categoryLeader ? `${Number(categoryLeader.count || 0).toLocaleString('es-AR')} tickets en la categoría más frecuente.` : 'Sin categorías destacadas para mostrar.'}</p>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <KpiTile
            key={card.title}
            title={card.title}
            value={card.value}
            suffix={card.suffix}
            delta={card.delta}
            icon={card.icon}
          />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile title="Interacciones por voz" value={kpis.voice_interactions_pct || 0} suffix="%" icon={Mic} />
        <KpiTile title="Video / avatar" value={kpis.video_avatar_interactions_pct || 0} suffix="%" icon={Video} />
        <KpiTile title="Finalización sin escribir" value={kpis.no_typing_completion_rate || 0} suffix="%" icon={Keyboard} />
        <KpiTile title="Uso de accesibilidad" value={kpis.accessibility_usage_rate || 0} suffix="%" icon={Captions} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <Card className="overflow-hidden border-border/60 bg-background/80 shadow-sm backdrop-blur">
          <CardHeader className="border-b border-border/50 bg-gradient-to-r from-primary/5 via-sky-500/5 to-violet-500/5">
            <CardTitle>Volumen diario</CardTitle>
            <CardDescription>Evolución del tráfico conversacional durante el período seleccionado.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <MeasuredContainer className="h-[320px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
                <ComposedChart data={volumeByDay} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="overviewVolumeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'rgba(99,102,241,0.2)', strokeWidth: 1 }} />
                  <Area type="monotone" dataKey="count" fill="url(#overviewVolumeFill)" stroke="none" />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: 'hsl(var(--primary))' }} />
                </ComposedChart>
              </ResponsiveContainer>
            </MeasuredContainer>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/60 bg-background/80 shadow-sm backdrop-blur">
          <CardHeader className="border-b border-border/50 bg-gradient-to-r from-emerald-500/5 via-primary/5 to-transparent">
            <CardTitle>Top categorías</CardTitle>
            <CardDescription>Temas más frecuentes en el período.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <MeasuredContainer className="h-[320px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={280} minHeight={220}>
                <BarChart data={topCategories} layout="vertical" margin={{ top: 0, right: 18, left: 24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="overviewBarFill" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.92} />
                      <stop offset="100%" stopColor="rgb(56 189 248)" stopOpacity={0.92} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="category" type="category" width={108} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(99,102,241,0.06)' }} formatter={(value: number) => [formatMetric(value), 'Tickets']} />
                  <Bar dataKey="count" fill="url(#overviewBarFill)" radius={[0, 10, 10, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </MeasuredContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OverviewDashboard;
