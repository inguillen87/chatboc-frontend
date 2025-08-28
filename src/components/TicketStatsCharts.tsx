import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';
import React from 'react';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend, Title);

export interface ChartBlock {
  title: string;
  data: Record<string, number>;
}

interface Props {
  charts?: ChartBlock[];
}

function SingleChart({ title, data }: ChartBlock) {
  const labels = Object.keys(data);
  const values = Object.values(data);
  const chartData = {
    labels,
    datasets: [
      {
        label: title,
        data: values,
        backgroundColor: 'rgba(59,130,246,0.5)',
      },
    ],
  };
  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: title },
    },
  } as const;
  return <Bar data={chartData} options={options} />;
}

export default function TicketStatsCharts({ charts }: Props) {
  if (!charts || charts.length === 0) return null;
  return (
    <div className="grid gap-8 md:grid-cols-2">
      {charts.map((c, idx) => (
        <SingleChart key={idx} {...c} />
      ))}
    </div>
  );
}

