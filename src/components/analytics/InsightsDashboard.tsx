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
      <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                  <Zap className="h-5 w-5" /> Hallazgos Automáticos
              </CardTitle>
              <CardDescription>Hallazgos del servicio para la organización seleccionada.</CardDescription>
          </CardHeader>
          <CardContent>
              <ul className="space-y-4">
                  {loading ? (
                      <li className="text-sm text-muted-foreground">Analizando datos...</li>
                  ) : insights.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay hallazgos disponibles para este alcance.</p>
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
              <CardTitle>Recomendaciones en tiempo real</CardTitle>
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
                  <p className="text-sm text-muted-foreground">No hay recomendaciones disponibles para este alcance. Actualizá los datos para volver a consultar.</p>
              )}
              {onRefreshRecommendations ? <Button variant="outline" size="sm" onClick={onRefreshRecommendations} disabled={recommendationsLoading}>Actualizar recomendaciones</Button> : null}
          </CardContent>
      </Card>
    </div>
  );
};

export default InsightsDashboard;
