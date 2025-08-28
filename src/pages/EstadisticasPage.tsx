import { useEffect, useState } from 'react';
import MapLibreMap from "@/components/MapLibreMap";
import TicketStatsCharts from "@/components/TicketStatsCharts";
import { getTicketStats, HeatPoint, TicketStatsResponse } from "@/services/statsService";

export default function EstadisticasPage() {
  const [charts, setCharts] = useState<TicketStatsResponse['charts']>([]);
  const [heatmap, setHeatmap] = useState<HeatPoint[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const stats = await getTicketStats();
        setCharts(stats.charts || []);
        setHeatmap(stats.heatmap || []);
      } catch (err) {
        console.error('Error loading ticket stats:', err);
      }
    })();
  }, []);

  return (
    <div className="p-4 space-y-8">
      <h1 className="text-2xl font-bold mb-4">Estadísticas y Mapas de Calor</h1>
      <TicketStatsCharts charts={charts} />
      {heatmap.length > 0 && <MapLibreMap heatmapData={heatmap} />}
    </div>
  );
}

