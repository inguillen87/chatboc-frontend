import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch, ApiError } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ChartContainer } from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';

interface Metrics {
  week: number;
  month: number;
  year: number;
}

export default function MunicipalMessageMetrics() {
  useRequireRole(['admin'] as Role[]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<Metrics>('/municipal/message-metrics')
      .then((data) => {
        setMetrics(data);
        setLoading(false);
      })
      .catch((err: any) => {
        const message = err instanceof ApiError ? err.message : 'Error al cargar métricas.';
        setError(message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (loading) return <p className="p-4 text-center">Cargando métricas...</p>;
  if (error) return <p className="p-4 text-destructive text-center">Error: {error}</p>;
  if (!metrics) return <p className="p-4 text-center text-muted-foreground">No hay métricas disponibles.</p>;

  const chartData = [
    { name: 'Semana', value: metrics.week },
    { name: 'Mes', value: metrics.month },
    { name: 'Año', value: metrics.year },
  ];

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-extrabold text-primary mb-4">Métricas de Mensajes</h1>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Resumen</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 text-base">
            <li className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Semana:</span>
              <span className="font-semibold text-foreground">{metrics.week}</span>
            </li>
            <li className="flex justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Mes:</span>
              <span className="font-semibold text-foreground">{metrics.month}</span>
            </li>
            <li className="flex justify-between pb-2">
              <span className="text-muted-foreground">Año:</span>
              <span className="font-semibold text-foreground">{metrics.year}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Visualización</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ChartContainer config={{}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#4682B4" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-center">
        <Button asChild variant="outline">
          <a href="/municipal/message-metrics.csv" download>
            Descargar CSV
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href="/municipal/message-metrics.pdf" download>
            Descargar PDF
          </a>
        </Button>
        <Button onClick={fetchMetrics}>Actualizar</Button>
      </div>
    </div>
  );
}
