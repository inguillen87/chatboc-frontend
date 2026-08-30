import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
  Filler,
} from 'chart.js';
import type { ChartOptions } from 'chart.js';
import React from 'react';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title, Filler);

export interface ChartBlock {
  title: string;
  data: Record<string, number>;
}

interface Props {
  charts?: ChartBlock[];
}

export const TICKET_CHART_THEME = {
  bar: 'rgba(59, 130, 246, 0.72)',
  barHover: 'rgba(37, 99, 235, 0.92)',
  tooltip: 'rgba(15, 23, 42, 0.96)',
  tooltipText: '#f8fafc',
  tooltipBorder: 'rgba(148, 163, 184, 0.35)',
  axisText: '#94a3b8',
  grid: 'rgba(148, 163, 184, 0.18)',
} as const;

function SingleChart({ title, data }: ChartBlock) {
  const labels = Object.keys(data);
  const values = labels.map((key) => {
    const value = data[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: title,
        data: values,
        backgroundColor: TICKET_CHART_THEME.bar,
        hoverBackgroundColor: TICKET_CHART_THEME.barHover,
        borderRadius: 6,
        maxBarThickness: 48,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        backgroundColor: TICKET_CHART_THEME.tooltip,
        titleColor: TICKET_CHART_THEME.tooltipText,
        bodyColor: TICKET_CHART_THEME.tooltipText,
        borderColor: TICKET_CHART_THEME.tooltipBorder,
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: {
          color: TICKET_CHART_THEME.axisText,
          maxRotation: 40,
          minRotation: 0,
          autoSkip: true,
        },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: TICKET_CHART_THEME.axisText,
          precision: 0,
        },
        grid: {
          color: TICKET_CHART_THEME.grid,
        },
      },
    },
    layout: {
      padding: {
        top: 8,
        bottom: 8,
        left: 0,
        right: 0,
      },
    },
  };

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card/80 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-4 h-64">
        <Bar data={chartData} options={options} updateMode="resize" />
      </div>
    </div>
  );
}

export default function TicketStatsCharts({ charts }: Props) {
  if (!charts || charts.length === 0) return null;
  return (
    <div className="grid auto-rows-[minmax(0,1fr)] gap-6 md:grid-cols-2 xl:grid-cols-3">
      {charts.map((c, idx) => (
        <SingleChart key={`${c.title}-${idx}`} {...c} />
      ))}
    </div>
  );
}

