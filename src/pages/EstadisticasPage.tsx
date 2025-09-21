import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getTicketStats, HeatPoint } from "@/services/statsService";
import { getErrorMessage } from "@/utils/api";
import {
  AlertCircle,
  CheckCircle2,
  Loader,
} from 'lucide-react';

interface TicketCounts {
  abiertos: number;
  en_proceso: number;
  resueltos: number;
}

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
  <Card className="shadow-lg" style={{ borderLeft: `4px solid ${color}`}}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

export default function EstadisticasPage() {
  const [ticketCounts, setTicketCounts] = useState<TicketCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const stats = await getTicketStats({ tipo: 'municipio' });
        const heatmapData = stats.heatmap || [];

        const counts = heatmapData.reduce((acc, point) => {
            const status = point.estado?.toLowerCase() || 'abierto';
            if (status.includes('resuelto') || status.includes('finalizado')) {
                acc.resueltos++;
            } else if (status.includes('proceso')) {
                acc.en_proceso++;
            } else {
                acc.abiertos++;
            }
            return acc;
        }, { abiertos: 0, en_proceso: 0, resueltos: 0 });

        setTicketCounts(counts);

      } catch (err) {
        setError(getErrorMessage(err, 'No se pudieron cargar las estadísticas.'));
        console.error('Error loading ticket stats:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <div className="p-4 text-center">Cargando estadísticas...</div>;
  }

  if (error) {
    return <div className="p-4 text-destructive bg-destructive/10 p-3 rounded-md text-center">{error}</div>;
  }

  if (!ticketCounts) {
    return <div className="p-4 text-center text-muted-foreground">No hay datos de estadísticas disponibles.</div>;
  }

  return (
    <div className="p-4 md:p-8 space-y-8">
      <h1 className="text-3xl font-extrabold text-primary">Estadísticas de Reclamos</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Reclamos Abiertos" value={ticketCounts.abiertos} icon={<AlertCircle className="h-4 w-4 text-muted-foreground" />} color="hsl(var(--destructive))" />
        <StatCard title="Reclamos en Proceso" value={ticketCounts.en_proceso} icon={<Loader className="h-4 w-4 text-muted-foreground" />} color="hsl(var(--primary))" />
        <StatCard title="Reclamos Resueltos" value={ticketCounts.resueltos} icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />} color="hsl(var(--success))" />
      </div>

       <Card className="bg-card shadow-lg rounded-xl border border-border backdrop-blur-sm">
        <CardHeader>
            <CardTitle>Nota sobre Estadísticas</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">
                Estas estadísticas se derivan de los datos de ubicación de los reclamos. Para obtener analíticas más detalladas, como tendencias por fecha o métricas de satisfacción del usuario, se requieren actualizaciones en el backend.
            </p>
        </CardContent>
       </Card>
    </div>
  );
}
