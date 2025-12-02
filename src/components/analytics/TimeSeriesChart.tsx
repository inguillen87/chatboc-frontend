import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TimeseriesResponse } from '@/services/analyticsService';
import { WidgetFrame } from './WidgetFrame';
import ChartTooltip from './ChartTooltip';
import { AnalyticsEmptyState } from './AnalyticsEmptyState';

interface TimeSeriesChartProps {
  title: string;
  description?: string;
  data?: TimeseriesResponse;
  loading?: boolean;
  valueFormatter?: (value: number) => string;
  exportName: string;
}

const palette = ['#2563eb', '#f97316', '#16a34a', '#9333ea', '#0ea5e9', '#f43f5e'];

export function TimeSeriesChart({ title, description, data, loading, valueFormatter, exportName }: TimeSeriesChartProps) {
  const formatted = useMemo(() => {
    if (!data) return [];
    return data.series.map((item) => ({
      date: item.date,
      total: Number(item.value.toFixed(2)),
      ...item.breakdown,
    }));
  }, [data]);

  const csv = useMemo(() => {
    if (!formatted.length) return [];
    return formatted.map((row) => ({ ...row }));
  }, [formatted]);

  const breakdownKeys = useMemo(() => {
    if (!data?.series?.length) return [];
    const keys = new Set<string>();
    data.series.forEach((item) => {
      if (item.breakdown) {
        Object.keys(item.breakdown).forEach((key) => keys.add(key));
      }
    });
    return Array.from(keys);
  }, [data]);

  const hasData = formatted.length > 0;

  return (
    <WidgetFrame title={title} description={description} csvData={csv} exportFilename={exportName}>
      <div className="h-72 w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Cargando serie...
          </div>
        ) : !hasData ? (
          <AnalyticsEmptyState />
        ) : (
          <ResponsiveContainer>
            <AreaChart data={formatted} margin={{ left: 16, right: 16, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={12}
                tickFormatter={(value) => (valueFormatter ? valueFormatter(value) : value.toLocaleString())}
              />
              <Tooltip content={<ChartTooltip />} />
              {breakdownKeys.length ? (
                breakdownKeys.map((key, index) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stackId="total"
                    stroke={palette[index % palette.length]}
                    fill={palette[index % palette.length]}
                    fillOpacity={0.2}
                  />
                ))
              ) : (
                <Area type="monotone" dataKey="total" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} />
              )}
              <Legend verticalAlign="top" height={24} wrapperStyle={{ fontSize: 12 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </WidgetFrame>
  );
}
