import { useEffect, useState } from 'react';
import MapLibreMap from "@/components/MapLibreMap";
import TicketStatsCharts from "@/components/TicketStatsCharts";
import {
  getTicketStats,
  HeatPoint,
  TicketStatsResponse,
} from "@/services/statsService";

export default function EstadisticasPage() {
  const [charts, setCharts] = useState<TicketStatsResponse['charts']>([]);
  const [heatmap, setHeatmap] = useState<HeatPoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stats = await getTicketStats({ tipo: 'municipio' });
        setCharts(stats.charts || []);
        setHeatmap(stats.heatmap || []);
      } catch (err) {
        setError('No se pudieron cargar las estadísticas');
        setCharts([]);
        setHeatmap([]);
        console.error('Error loading ticket stats:', err);
      }
    })();
  }, []);

  return (
    <div className="p-4 space-y-8">
      <h1 className="text-2xl font-bold mb-4">Estadísticas y Mapas de Calor</h1>
      {error && (
        <p className="text-destructive bg-destructive/10 p-3 rounded-md text-center">{error}</p>
      )}
      <TicketStatsCharts charts={charts} />
      <MapLibreMap heatmapData={heatmap} />
    </div>
  );
}
