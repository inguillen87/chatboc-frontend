import React, { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/utils/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  TooltipProps,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';
import ChartTooltip from '@/components/analytics/ChartTooltip';

interface Municipality {
  name: string;
  totalTickets: number;
  categories: Record<string, number>;
  averageResponseHours: number;
}

interface AnalyticsResponse {
  municipalities: Municipality[];
}

export default function MunicipalAnalytics() {
  useRequireRole(['admin', 'super_admin'] as Role[]);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    apiFetch<AnalyticsResponse>('/municipal/analytics')
      .then((resp) => {
        setData(resp);
        setLoading(false);
      })
      .catch((err: any) => {
        const message = err instanceof ApiError ? err.message : 'Error al cargar analíticas.';
        setError(message);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-4 text-center">Cargando analíticas...</p>;
  if (error) return <p className="p-4 text-destructive text-center">Error: {error}</p>;
  if (!data || !Array.isArray(data.municipalities) || data.municipalities.length === 0)
    return <p className="p-4 text-center text-muted-foreground">No hay datos disponibles.</p>;

  const allCategories = Array.from(
    new Set(
      data.municipalities.flatMap((m) => Object.keys(m.categories || {}))
    )
  );

  const chartData = data.municipalities.map((m) => ({
    name: m.name,
    value:
      categoryFilter === 'all'
        ? m.totalTickets
        : m.categories[categoryFilter] || 0,
  }));

  const categoryTotals = allCategories.map((c) => ({
    name: c,
    value: data.municipalities.reduce(
      (sum, m) => sum + (m.categories[c] || 0),
      0,
    ),
  }));
  const totalTickets = data.municipalities.reduce((acc, m) => acc + m.totalTickets, 0);
  const totalResponseHours = data.municipalities.reduce((acc, m) => acc + m.averageResponseHours, 0);
  const averageResponseHours = totalResponseHours / data.municipalities.length;

  const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload || payload.length === 0) return null;
    const item = payload[0];
    return (
      <div className="bg-background p-2 shadow-lg rounded-lg">
        <p className="text-sm text-muted-foreground">{item.payload.name}</p>
        <p className="text-sm font-bold">{item.value}</p>
      </div>
    );
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-extrabold text-primary mb-4">Analíticas Profesionales</h1>

      <div className="flex flex-wrap gap-4 items-center">
        <label className="text-sm">
          Categoría:
          <select
            className="ml-2 border rounded p-1 bg-background"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">Todas</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTickets}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Promedio de Respuesta (h)</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageResponseHours.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Tickets por Municipio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip cursor={false} content={<ChartTooltip />} />
                <Legend />
                <Bar dataKey="value" fill="var(--color-value)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Distribución por Categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryTotals}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {categoryTotals.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={`var(--chart-${(index % 12) + 1})`}
                    />
                  ))}
                </Pie>
                <Tooltip cursor={false} content={<ChartTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.municipalities.map((m) => (
          <Card key={m.name}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{m.name}</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{m.totalTickets}</div>
              <p className="text-xs text-muted-foreground">
                Promedio de respuesta: {m.averageResponseHours} h
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
