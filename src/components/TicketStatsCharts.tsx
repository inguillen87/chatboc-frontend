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
        backgroundColor: 'hsl(var(--primary) / 0.65)',
        hoverBackgroundColor: 'hsl(var(--primary) / 0.85)',
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
        backgroundColor: 'hsl(var(--popover))',
        titleColor: 'hsl(var(--popover-foreground))',
        bodyColor: 'hsl(var(--popover-foreground))',
        borderColor: 'hsl(var(--border))',
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: {
          color: 'hsl(var(--muted-foreground))',
          maxRotation: 40,
          minRotation: 0,
          autoSkip: true,
        },
        grid: { display: false },
      },
      y: {
        beginAtZero: true,
        ticks: {
          color: 'hsl(var(--muted-foreground))',
          precision: 0,
        },
        grid: {
          color: 'hsl(var(--border) / 0.3)',
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

