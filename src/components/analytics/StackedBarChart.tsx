import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { BreakdownResponse } from '@/services/analyticsService';
import { WidgetFrame } from './WidgetFrame';
import ChartTooltip from './ChartTooltip';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';

interface StackedBarChartProps {
  title: string;
  description?: string;
  data?: BreakdownResponse;
  loading?: boolean;
  exportName: string;
}

const palette = ['#2563eb', '#16a34a', '#f97316', '#9333ea', '#facc15', '#0ea5e9'];

export function StackedBarChart({ title, description, data, loading, exportName }: StackedBarChartProps) {
  const formatted = useMemo(() => {
    if (!data?.items?.length) return [];
    return data.items.map((item) => ({ label: item.label, value: item.value }));
  }, [data]);

  const csv = useMemo(() => formatted.map((item) => ({ ...item })), [formatted]);

  const hasData = formatted.length > 0;

  return (
    <WidgetFrame title={title} description={description} csvData={csv} exportFilename={exportName}>
      <div className="h-72 w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Generando gráfico...
          </div>
        ) : !hasData ? (
          <AnalyticsEmptyState />
        ) : (
          <ResponsiveContainer>
            <BarChart data={formatted} margin={{ left: 16, right: 16, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} interval={0} angle={-25} dy={10} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip content={<ChartTooltip />} />
              <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="value" fill={palette[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </WidgetFrame>
  );
}
