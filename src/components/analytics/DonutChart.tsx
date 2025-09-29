import { useMemo } from 'react';
import { Pie, PieChart, ResponsiveContainer, Tooltip, Cell, Legend } from 'recharts';
import type { BreakdownResponse } from '@/services/analyticsService';
import { WidgetFrame } from './WidgetFrame';
import ChartTooltip from './ChartTooltip';

interface DonutChartProps {
  title: string;
  description?: string;
  data?: BreakdownResponse;
  exportName: string;
  loading?: boolean;
}

const palette = ['#2563eb', '#f97316', '#22d3ee', '#16a34a', '#f43f5e', '#9333ea', '#facc15', '#0ea5e9'];

export function DonutChart({ title, description, data, exportName, loading }: DonutChartProps) {
  const formatted = useMemo(() => {
    if (!data?.items?.length) return [];
    return data.items
      .map((item) => ({ name: item.label, value: item.value }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  return (
    <WidgetFrame title={title} description={description} csvData={formatted} exportFilename={exportName}>
      <div className="h-72 w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Preparando datos...</div>
        ) : (
          <ResponsiveContainer>
            <PieChart>
              <Pie data={formatted} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={4}>
                {formatted.map((entry, index) => (
                  <Cell key={entry.name} fill={palette[index % palette.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend verticalAlign="bottom" height={32} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </WidgetFrame>
  );
}
