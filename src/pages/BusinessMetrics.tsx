import React, { useEffect, useState, useCallback } from "react"
import { apiFetch, ApiError } from '@/utils/api'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer } from '@/components/ui/chart'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  MessageSquare,
  ShoppingCart,
  TrendingUp,
  Star,
} from 'lucide-react'

interface Metric {
  label: string;
  value: number;
}

export default function BusinessMetrics() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    Consultas: MessageSquare,
    'Productos en carrito': ShoppingCart,
    'Producto más consultado': Star,
  }

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

  if (loading)
    return (
      <div className="p-4 max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-extrabold text-primary mb-4">
          Métricas del Negocio
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  if (error) return <p className="p-4 text-destructive text-center">Error: {error}</p>;
  if (metrics.length === 0) return <p className="p-4 text-center text-muted-foreground">No hay métricas disponibles.</p>;


  return (
    <div className="p-4 max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-extrabold text-primary mb-4">Métricas del Negocio</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {metrics.map((m) => {
          const Icon = ICONS[m.label] || TrendingUp
          return (
            <Card key={m.label} className="shadow-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{m.label}</CardTitle>
                <Icon className="w-5 h-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="text-2xl font-bold">{m.value}</CardContent>
            </Card>
          )
        })}
      </div>

      {/* Gráfico de Barras para las métricas */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Visualización de Métricas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ChartContainer config={{}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.map((m) => ({ name: m.label, value: m.value }))}>
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

      <div className="text-center">
        <Button onClick={fetchMetrics} className="mt-4">Actualizar Métricas</Button>
      </div>
    </div>
  );
}