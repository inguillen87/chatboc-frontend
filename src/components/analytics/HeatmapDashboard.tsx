import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTenant } from '@/context/TenantContext';
import { analyticsService } from '@/services/analyticsService';
import { Loader2 } from 'lucide-react';
// Assuming MapLibreMap component exists as per prompt trace
// If not, a placeholder or simple div will be used to avoid breaking
import MapLibreMap from '@/components/MapLibreMap';

interface Props {
  tenantId: number;
  dateRange: { from: string; to: string };
}

const HeatmapDashboard: React.FC<Props> = ({ tenantId, dateRange }) => {
  const { currentSlug } = useTenant();
  const [points, setPoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHeatmap = async () => {
      setLoading(true);
      try {
        const data = await analyticsService.getHeatmap({
          tenant_id: tenantId,
          tenantSlug: currentSlug || undefined,
          from: dateRange.from,
          to: dateRange.to
        });
        setPoints(data || []);
      } catch (e) {
        console.error("Failed to load heatmap", e);
      } finally {
        setLoading(false);
      }
    };
    if (tenantId) loadHeatmap();
  }, [tenantId, dateRange, currentSlug]);

  if (loading) return <div className="h-[320px] sm:h-[420px] flex items-center justify-center rounded-2xl border border-border/50 bg-background/60"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <Card className="border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
      <CardHeader>
        <CardTitle>Mapa de Calor</CardTitle>
        <CardDescription>Distribución geográfica de incidentes y pedidos.</CardDescription>
      </CardHeader>
      <CardContent className="h-[320px] sm:h-[420px] lg:h-[520px] p-0 relative overflow-hidden rounded-b-2xl">
         {points.length > 0 ? (
             <MapLibreMap
                heatmapData={points}
                // Default center/zoom, map component should ideally auto-fit or take props
                center={[-58.38, -34.60]}
                initialZoom={12}
             />
         ) : (
             <div className="flex h-full items-center justify-center text-muted-foreground">
                 No hay datos geográficos para este periodo.
             </div>
         )}
      </CardContent>
    </Card>
  );
};

export default HeatmapDashboard;
