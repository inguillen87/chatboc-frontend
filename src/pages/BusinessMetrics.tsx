import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch, ApiError } from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'; // Importa componentes de Card
import { ChartContainer } from '@/components/ui/chart';

interface Metric {
  label: string;
  value: number;
}

export default function BusinessMetrics() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(() => {
    setLoading(true);
    setError(null); // Limpiar error al reintentar
    apiFetch<Metric[]>('/pyme/metrics') // Asume que este endpoint devuelve un array de Metric
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
  if (metrics.length === 0) return <p className="p-4 text-center text-muted-foreground">No hay métricas disponibles.</p>;


  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-extrabold text-primary mb-4">Métricas del Negocio</h1>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Resumen General</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 text-base">
            {metrics.map((m) => (
              <li key={m.label} className="flex justify-between border-b border-border pb-2 last:border-b-0 last:pb-0">
                <span className="text-muted-foreground">{m.label}:</span>
                <span className="font-semibold text-foreground">{m.value}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Gráfico de Barras para las métricas */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Visualización de Métricas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64"> {/* Altura fija para el gráfico */}
            {/* Asegúrate de que tu componente Chart pueda recibir este formato de datos */}
            <Chart 
              type="Bar" 
              data={metrics.map(m => ({ name: m.label, value: m.value }))} // Adapta los datos a {name: "label", value: 123}
              dataKey="value" // La clave numérica para el gráfico
              nameKey="name" // La clave de la etiqueta para el gráfico
            />
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button onClick={fetchMetrics} className="mt-4">Actualizar Métricas</Button>
      </div>
    </div>
  );
}