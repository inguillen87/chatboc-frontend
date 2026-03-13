import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useTenant } from '@/context/TenantContext';
import { analyticsService, type AnalyticsHeatmapResponse } from '@/services/analyticsService';
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
  const [heatmapResponse, setHeatmapResponse] = useState<AnalyticsHeatmapResponse>({ points: [] });
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
        setHeatmapResponse(data || { points: [] });
      } catch (e) {
        console.error("Failed to load heatmap", e);
      } finally {
        setLoading(false);
      }
    };
    if (tenantId) loadHeatmap();
  }, [tenantId, dateRange, currentSlug]);


  const points = useMemo(() => (Array.isArray(heatmapResponse?.points) ? heatmapResponse.points : []), [heatmapResponse]);
  const geoCategories = useMemo(() => (Array.isArray(heatmapResponse?.geo_layers?.categories) ? heatmapResponse.geo_layers.categories : []), [heatmapResponse]);
  const segmentCategories = useMemo(() => (Array.isArray(heatmapResponse?.segments?.categoria) ? heatmapResponse.segments.categoria : []), [heatmapResponse]);
  const segmentSexo = useMemo(() => (Array.isArray(heatmapResponse?.segments?.sexo) ? heatmapResponse.segments.sexo : []), [heatmapResponse]);
  const segmentEdad = useMemo(() => (Array.isArray(heatmapResponse?.segments?.rango_edad) ? heatmapResponse.segments.rango_edad : []), [heatmapResponse]);

  if (loading) return <div className="h-[320px] sm:h-[420px] flex items-center justify-center rounded-2xl border border-border/50 bg-background/60"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <Card className="border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm">
      <CardHeader>
        <CardTitle>Mapa de Calor</CardTitle>
        <CardDescription>Distribución geográfica de incidentes y pedidos.</CardDescription>
      </CardHeader>
      <CardContent className="p-3 sm:p-4 space-y-3">
        {(geoCategories.length || segmentCategories.length || segmentSexo.length || segmentEdad.length) ? (
          <div className="space-y-2">
            {geoCategories.length ? (
              <div className="flex flex-wrap gap-2 text-xs">
                {geoCategories.slice(0, 10).map((item, idx) => (
                  <span key={`${item.categoria || 'cat'}-${idx}`} className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color || '#94a3b8' }} />
                    {item.categoria || '—'} · {item.event_count || item.total_weight || 0}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-3 text-xs">
              <div className="rounded-md border p-2">
                <p className="mb-1 text-muted-foreground">Categorías</p>
                <p>{segmentCategories.slice(0, 3).map((item: any) => `${item.label || '—'} (${item.count || 0})`).join(' · ') || '—'}</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="mb-1 text-muted-foreground">Sexo</p>
                <p>{segmentSexo.slice(0, 3).map((item: any) => `${item.label || '—'} (${item.count || 0})`).join(' · ') || '—'}</p>
              </div>
              <div className="rounded-md border p-2">
                <p className="mb-1 text-muted-foreground">Rango edad</p>
                <p>{segmentEdad.slice(0, 3).map((item: any) => `${item.label || '—'} (${item.count || 0})`).join(' · ') || '—'}</p>
              </div>
            </div>
          </div>
        ) : null}
        <div className="h-[300px] sm:h-[420px] lg:h-[520px] relative overflow-hidden rounded-xl border">
          {points.length > 0 ? (
              <MapLibreMap
                  heatmapData={points as any}
                  center={[-58.38, -34.60]}
                  initialZoom={12}
              />
          ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                  No hay datos geográficos para este periodo.
              </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default HeatmapDashboard;
