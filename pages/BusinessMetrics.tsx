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
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react'
import { cn } from "@/lib/utils"

interface Trend {
  change_absolute?: number;
  change_percentage?: number;
  direction: 'up' | 'down' | 'neutral';
  period_comparison?: string;
}
interface Metric {
  label: string;
  value: number;
  trend?: Trend;
}

export default function BusinessMetrics() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    Consultas: MessageSquare,
    'Productos en carrito': ShoppingCart,
    'Producto más consultado': Star,
    // Add more icons as needed for new metric labels
  }

  const TREND_ICONS: Record<Trend['direction'], React.ComponentType<{ className?: string }>> = {
    up: ArrowUp,
    down: ArrowDown,
    neutral: Minus,
  }

  const TREND_COLORS: Record<Trend['direction'], string> = {
    up: 'text-green-600 dark:text-green-400',
    down: 'text-red-600 dark:text-red-400',
    neutral: 'text-gray-600 dark:text-gray-400',
  }


  const fetchMetrics = useCallback(() => {
    setLoading(true);
    setError(null);
    apiFetch<Metric[]>('/pyme/metrics')
      .then((data) => {
        // Ensure trend data is at least an empty object if not provided
        const processedData = data.map(m => ({ ...m, trend: m.trend || undefined }));
        setMetrics(processedData);
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
      <div className="p-4 max-w-4xl mx-auto space-y-6"> {/* Increased max-width for better layout */}
        <h1 className="text-3xl font-extrabold text-primary mb-4">
          Métricas del Negocio
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"> {/* Adjusted grid for lg */}
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" /> /* Increased skeleton height */
          ))}
        </div>
      </div>
    )
  if (error) return <p className="p-4 text-destructive text-center">Error: {error}</p>;
  if (metrics.length === 0) return <p className="p-4 text-center text-muted-foreground">No hay métricas disponibles.</p>;


  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6"> {/* Increased max-width */}
      <h1 className="text-3xl font-extrabold text-primary mb-4">Métricas del Negocio</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"> {/* Adjusted grid for lg */}
        {metrics.map((m) => {
          const Icon = ICONS[m.label] || TrendingUp;
          const TrendIcon = m.trend ? TREND_ICONS[m.trend.direction] : Minus;
          const trendColor = m.trend ? TREND_COLORS[m.trend.direction] : TREND_COLORS.neutral;

          return (
            <Card key={m.label} className="shadow-md flex flex-col"> {/* Added flex flex-col for better spacing */}
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{m.label}</CardTitle>
                <Icon className="w-5 h-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="flex-grow"> {/* Added flex-grow to push trend to bottom if needed */}
                <div className="text-2xl font-bold">{m.value}</div>
                {m.trend && (
                  <div className={cn("text-xs flex items-center mt-1", trendColor)}>
                    <TrendIcon className="w-4 h-4 mr-1" />
                    {m.trend.change_percentage !== undefined
                      ? `${(m.trend.change_percentage * 100).toFixed(1)}%`
                      : m.trend.change_absolute !== undefined
                      ? `${m.trend.change_absolute > 0 ? '+' : ''}${m.trend.change_absolute}`
                      : ''
                    }
                    {m.trend.period_comparison && <span className="ml-1 text-muted-foreground">{m.trend.period_comparison}</span>}
                  </div>
                )}
              </CardContent>
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
          <div className="h-80"> {/* Increased chart height */}
            <ChartContainer config={{}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.map((m) => ({ name: m.label, value: m.value }))} margin={{ top: 5, right: 20, left: -20, bottom: 40 }}> {/* Adjusted margins */}
                  <XAxis
                    dataKey="name"
                    angle={-30} // Angle labels to prevent overlap
                    textAnchor="end"
                    height={60} // Increase height for angled labels
                    interval={0} // Show all labels
                    tick={{ fontSize: 10 }} // Smaller font for ticks
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /> {/* Use theme color and radius */}
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