import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import { analyticsService } from '@/services/analyticsService';
import { useTenant } from '@/context/TenantContext';

interface Props {
  tenantId: number;
}

const InsightsDashboard: React.FC<Props> = ({ tenantId }) => {
  const { currentSlug } = useTenant();
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInsights = async () => {
        if(!tenantId) return;
        setLoading(true);
        try {
            const data = await analyticsService.getInsights(tenantId, currentSlug || undefined);
            setInsights(data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };
    loadInsights();
  }, [tenantId, currentSlug]);

  if (loading) return <div className="p-4 text-center text-muted-foreground">Analizando datos...</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                  <Zap className="h-5 w-5" /> Hallazgos Automáticos
              </CardTitle>
              <CardDescription>Patrones detectados por IA en la última semana.</CardDescription>
          </CardHeader>
          <CardContent>
              <ul className="space-y-4">
                  {insights.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No se detectaron patrones inusuales.</p>
                  ) : (
                      insights.map((insight, i) => (
                          <li key={i} className="flex gap-3 items-start p-3 bg-card rounded-lg shadow-sm border">
                              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-xs ${insight.severity === 'high' ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'}`}>
                                  {i + 1}
                              </span>
                              <div>
                                  <p className="text-sm font-medium">{insight.text}</p>
                                  {insight.category && <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded mt-1 inline-block">{insight.category}</span>}
                              </div>
                          </li>
                      ))
                  )}
              </ul>
          </CardContent>
      </Card>

      <Card>
          <CardHeader>
              <CardTitle>Recomendaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
              {/* Mock recommendations based on typical patterns if API returns specific actions */}
              <div className="p-4 border rounded-lg hover:bg-accent/5 transition-colors cursor-pointer group">
                  <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-sm mb-1 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          Optimizar Horarios
                      </h4>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-sm text-muted-foreground">Se detectó alto volumen de consultas no atendidas los Lunes entre 8am y 10am.</p>
              </div>

              <div className="p-4 border rounded-lg hover:bg-accent/5 transition-colors cursor-pointer group">
                   <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-sm mb-1 flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Actualizar FAQ: Envíos
                      </h4>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-sm text-muted-foreground">El 15% de las consultas son sobre "Costo de envío". Agregar esto al menú podría reducir la carga.</p>
              </div>
          </CardContent>
      </Card>
    </div>
  );
};

export default InsightsDashboard;
