import React, { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/utils/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import useRequireRole from '@/hooks/useRequireRole';
import type { Role } from '@/utils/roles';

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
  useRequireRole(['admin'] as Role[]);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const chartData = data.municipalities.map((m) => ({ name: m.name, value: m.totalTickets }));

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-extrabold text-primary mb-4">Analíticas Profesionales</h1>

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
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#4682B4" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {data.municipalities.map((m) => (
        <Card key={m.name} className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">{m.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2">Total tickets: {m.totalTickets}</p>
            <p className="mb-2">Promedio de respuesta: {m.averageResponseHours} h</p>
            <ul className="grid gap-1 text-sm">
              {Object.entries(m.categories).map(([cat, count]) => (
                <li key={cat} className="flex justify-between">
                  <span className="text-muted-foreground">{cat}:</span>
                  <span className="font-semibold">{count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
