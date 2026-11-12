import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
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
const isAvailableMetric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const metricDisplay = (value: unknown, suffix?: string) => ({
  value: isAvailableMetric(value) ? value : 'No disponible',
  suffix: isAvailableMetric(value) ? suffix : undefined,
});

const tooltipStyle = {
  borderRadius: 16,
  border: '1px solid rgba(148, 163, 184, 0.2)',
  background: 'rgba(15, 23, 42, 0.92)',
  color: '#fff',
  boxShadow: '0 20px 45px rgba(15, 23, 42, 0.3)',
};

const OverviewDashboard: React.FC<Props> = ({ data, showSla, showConversion }) => {
  const kpis = data?.kpis;
  const volumeByDay = useMemo(() => Array.isArray(data?.volume_by_day) ? data.volume_by_day : [], [data?.volume_by_day]);
  const topCategories = useMemo(() => Array.isArray(data?.top_categories) ? data.top_categories : [], [data?.top_categories]);
  const hasVolumeData = volumeByDay.length > 0 && volumeByDay.every((item) => isAvailableMetric(item?.count));
  const hasCategoryData = topCategories.length > 0 && topCategories.every((item) => isAvailableMetric(item?.count));
  const totalVolume = hasVolumeData ? volumeByDay.reduce((acc, item) => acc + item.count, 0) : null;
  const peakDay = hasVolumeData ? volumeByDay.reduce((best, item) => item.count > best.count ? item : best) : null;
  const categoryLeader = hasCategoryData ? topCategories.reduce((best, item) => item.count > best.count ? item : best) : null;

  const overviewCards = [
    {
      title: 'Interacciones',
      ...metricDisplay(kpis?.total_interactions),
      icon: BarChart3,
    },
    {
      title: 'Usuarios activos',
      ...metricDisplay(kpis?.active_users),
      icon: Users,
    },
    {
      title: 'Tiempo respuesta',
      ...metricDisplay(kpis?.avg_response_time_s, 's'),
      icon: Clock,
    },
  ];

  if (showConversion) {
    overviewCards.push({
      title: 'Conversión',
      ...metricDisplay(kpis?.conversion_rate, '%'),
      icon: Zap,
    });
  }

  if (showSla) {
    overviewCards.push(
      {
        title: 'Tickets abiertos',
        ...metricDisplay(kpis?.backlog_open),
        icon: Zap,
      },
      {
        title: 'Fuera de SLA',
        ...metricDisplay(kpis?.sla_breaches),
        icon: Clock,
      },
    );
  }

  return (
    <div className="space-y-4">
      <section aria-label="Indicadores del período" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {overviewCards.map((card) => (
          <KpiTile
            key={card.title}
            title={card.title}
            value={card.value}
            suffix={card.suffix}
            icon={card.icon}
          />
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <Card className="overflow-hidden border-border/60 bg-background/80 shadow-sm backdrop-blur">
          <CardHeader className="border-b border-border/50 p-4">
            <CardTitle className="text-lg">Volumen diario</CardTitle>
            <CardDescription>Evolución del tráfico conversacional durante el período seleccionado.</CardDescription>
            <dl className="grid grid-cols-2 gap-3 pt-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Volumen de la serie</dt>
                <dd className="font-semibold">{totalVolume === null ? 'No disponible' : totalVolume.toLocaleString('es-AR')}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Pico diario</dt>
                <dd className="font-semibold">{peakDay ? `${peakDay.count.toLocaleString('es-AR')} · ${peakDay.date}` : 'No disponible'}</dd>
              </div>
            </dl>
          </CardHeader>
          <CardContent className="p-4">
            {hasVolumeData ? <MeasuredContainer className="h-[260px] min-w-0">
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
            : <p className="py-10 text-center text-sm text-muted-foreground">No hay datos de volumen disponibles para este período.</p>}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/60 bg-background/80 shadow-sm backdrop-blur">
          <CardHeader className="border-b border-border/50 p-4">
            <CardTitle className="text-lg">Top categorías</CardTitle>
            <CardDescription>Temas más frecuentes en el período.</CardDescription>
            <dl className="pt-2 text-sm">
              <dt className="text-muted-foreground">Categoría líder</dt>
              <dd className="font-semibold">{categoryLeader ? `${categoryLeader.category} · ${categoryLeader.count.toLocaleString('es-AR')} tickets` : 'No disponible'}</dd>
            </dl>
          </CardHeader>
          <CardContent className="p-4">
            {hasCategoryData ? <MeasuredContainer className="h-[260px] min-w-0">
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
            : <p className="py-10 text-center text-sm text-muted-foreground">No hay categorías disponibles para este período.</p>}
          </CardContent>
        </Card>
      </div>

      <details className="rounded-lg border border-border/60 bg-background/80">
        <summary className="cursor-pointer rounded-lg px-4 py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Canales y accesibilidad</summary>
        <div className="grid gap-3 border-t border-border/50 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile title="Interacciones por voz" {...metricDisplay(kpis?.voice_interactions_pct, '%')} icon={Mic} />
          <KpiTile title="Video / avatar" {...metricDisplay(kpis?.video_avatar_interactions_pct, '%')} icon={Video} />
          <KpiTile title="Finalización sin escribir" {...metricDisplay(kpis?.no_typing_completion_rate, '%')} icon={Keyboard} />
          <KpiTile title="Uso de accesibilidad" {...metricDisplay(kpis?.accessibility_usage_rate, '%')} icon={Captions} />
        </div>
      </details>
    </div>
  );
};

export default OverviewDashboard;
