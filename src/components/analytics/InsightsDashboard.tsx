import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import { analyticsService } from '@/services/analyticsService';
import { useTenant } from '@/context/TenantContext';
import { captureChatbocSessionRevision, isChatbocSessionRevisionCurrent } from '@/utils/chatbocSessionRevision';

interface Props {
  tenantId?: number;
  tenantProfileId?: number;
  tenantSlug?: string;
  scope?: string;
  recommendations?: string[];
  recommendationsLoading?: boolean;
  onRefreshRecommendations?: () => void;
}

const InsightsDashboard: React.FC<Props> = ({ tenantId, tenantProfileId, tenantSlug, scope, recommendations, recommendationsLoading = false, onRefreshRecommendations }) => {
  const { currentSlug } = useTenant();
  const verifiedSlug = tenantSlug || currentSlug || undefined;
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const revision = captureChatbocSessionRevision();
    const isCurrent = () => active && isChatbocSessionRevisionCurrent(revision);
    const loadInsights = async () => {
        if(!tenantId && !tenantProfileId) { setInsights([]); setLoading(false); return; }
        setLoading(true);
        setInsights([]);
        try {
            const selector = tenantProfileId ? { tenant_profile_id: tenantProfileId, tenantSlug: verifiedSlug, scope } : tenantId!;
            const data = await analyticsService.getInsights(selector, verifiedSlug);
            if (isCurrent()) setInsights(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        } finally {
            if (isCurrent()) setLoading(false);
        }
    };
    loadInsights();
    return () => { active = false; };
  }, [tenantId, tenantProfileId, verifiedSlug, scope]);

  const backendRecommendations = Array.isArray(recommendations)
    ? recommendations.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {loading || insights.length ? <Card>
          <CardHeader>
              <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" aria-hidden="true" /> Hallazgos para revisar
              </CardTitle>
              <CardDescription>Señales detectadas en la actividad de la organización seleccionada.</CardDescription>
          </CardHeader>
          <CardContent>
              {loading ? (
                  <p className="text-sm text-muted-foreground" role="status">Revisando la actividad...</p>
              ) : (
                  <ul className="space-y-4">
                      {insights.map((insight, i) => (
                          <li key={i} className="flex gap-3 items-start p-3 bg-card rounded-lg shadow-sm border">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary" aria-hidden="true">
                                  {i + 1}
                              </span>
                              <div>
                                  <p className="text-sm font-medium">{insight.text}</p>
                                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    {insight.severity === 'high' ? <span className="font-medium text-destructive">Prioridad alta</span> : null}
                                    {insight.category ? <span>{insight.category}</span> : null}
                                  </div>
                              </div>
                          </li>
                      ))}
                  </ul>
              )}
          </CardContent>
      </Card> : null}

      <Card className={!loading && insights.length === 0 ? 'md:col-span-2' : undefined}>
          <CardHeader>
              <CardTitle>Qué conviene revisar ahora</CardTitle>
              <CardDescription>Acciones sugeridas a partir de los datos disponibles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
              {recommendationsLoading ? (
                  <p className="text-sm text-muted-foreground" role="status">Consultando recomendaciones…</p>
              ) : backendRecommendations.length ? (
                  <ul className="space-y-3">
                      {backendRecommendations.map((recommendation, index) => (
                          <li key={index} className="rounded-lg border p-4 text-sm">{recommendation}</li>
                      ))}
                  </ul>
              ) : (
                  <p className="text-sm text-muted-foreground">Todavía no hay recomendaciones. Actualizá para volver a consultar la actividad disponible.</p>
              )}
              {onRefreshRecommendations ? <Button variant="outline" size="sm" className="min-h-11" onClick={onRefreshRecommendations} disabled={recommendationsLoading}>Actualizar recomendaciones</Button> : null}
          </CardContent>
      </Card>
    </div>
  );
};

export default InsightsDashboard;
