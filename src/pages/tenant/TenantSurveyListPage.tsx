import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { TenantShell } from '@/components/tenant/TenantShell';
import { listPublicSurveys, type PublicSurveyListResult } from '@/api/encuestas';
import { useTenant } from '@/context/TenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/utils/api';
import { getAutoSeedCantidad } from '@/utils/surveyDemoPriority';
import { ViewState } from '@/components/app-shell/ViewState';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "d 'de' MMMM yyyy", { locale: es });
};

const getSurveyStatus = (inicio?: string | null, fin?: string | null) => {
  const now = new Date();
  const start = inicio ? new Date(inicio) : null;
  const end = fin ? new Date(fin) : null;

  if (start && !Number.isNaN(start.getTime()) && now < start) {
    return { label: 'Próximamente', variant: 'secondary' as const };
  }

  if (end && !Number.isNaN(end.getTime()) && now > end) {
    return { label: 'Finalizada', variant: 'outline' as const };
  }

  return { label: 'En curso', variant: 'default' as const };
};

const TenantSurveyListPage = () => {
  const params = useParams<{ tenant: string }>();
  const { tenant, currentSlug } = useTenant();

  const slug = useMemo(() => {
    const fromContext = tenant?.slug ?? currentSlug;
    if (fromContext && fromContext.trim()) return fromContext.trim();
    if (params.tenant && params.tenant.trim()) return params.tenant.trim();
    return '';
  }, [currentSlug, params.tenant, tenant?.slug]);

  const basePath = slug ? `/${encodeURIComponent(slug)}` : null;

  const surveysQuery = useQuery<PublicSurveyListResult>({
    queryKey: queryKeys.tenant.surveys(slug, 'full'),
    enabled: Boolean(slug),
    queryFn: () => listPublicSurveys(slug),
    staleTime: 1000 * 60 * 2,
  });

  const surveys = useMemo(() => (Array.isArray(surveysQuery.data) ? surveysQuery.data : []), [surveysQuery.data]);
  const { isOnline } = useNetworkStatus();
  const isStale = surveysQuery.isSuccess && surveysQuery.isFetching;

  return (
    <TenantShell>
      {!slug ? (
        <Card>
          <CardHeader>
            <CardTitle>Seleccioná un espacio</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Elegí un espacio para ver todas las encuestas públicas disponibles.
          </CardContent>
        </Card>
      ) : !isOnline && !surveysQuery.data ? (
        <ViewState
          status="offline"
          title="Sin conexión para consultar encuestas"
          description="Revisá tu conexión y reintentá."
        />
      ) : surveysQuery.isLoading ? (
        <ViewState status="loading" title="Cargando encuestas" />
      ) : surveysQuery.error ? (
        <ViewState
          status="error"
          title="No pudimos cargar las encuestas"
          description={getErrorMessage(surveysQuery.error)}
        />
      ) : surveys.length ? (
        <div className="space-y-5">
          {surveys.map((survey) => {
            const status = getSurveyStatus(survey.inicio_at, survey.fin_at);
            return (
              <article key={survey.slug} className="rounded-3xl border bg-background/80 shadow-sm">
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {survey.es_votacion_envivo ? <Badge variant="default">En vivo</Badge> : null}
                    {survey.mostrar_resultados_envivo ? <Badge variant="secondary">Resultados en tiempo real</Badge> : null}
                    {survey.permitir_comentarios ? <Badge variant="outline">Comentarios abiertos</Badge> : null}
                    {formatDate(survey.fin_at) ? (
                      <Badge variant="outline">Cierra: {formatDate(survey.fin_at)}</Badge>
                    ) : null}
                  </div>
                  <CardTitle className="text-2xl leading-tight">{survey.titulo}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {survey.descripcion ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">{survey.descripcion}</p>
                  ) : null}
                  {(() => {
                    const cantidad = getAutoSeedCantidad(survey);
                    if (!cantidad) return null;
                    return (
                      <p className="text-xs text-muted-foreground">
                        Datos demo precargados: {cantidad} respuestas iniciales.
                      </p>
                    );
                  })()}
                  {basePath ? (
                    <Button asChild>
                      <a href={`${basePath}/encuestas/${survey.slug}`}>Responder encuesta</a>
                    </Button>
                  ) : null}
                </CardContent>
              </article>
            );
          })}
        </div>
      ) : (
        <ViewState
          status={isStale ? 'stale' : 'empty'}
          title={isStale ? 'Actualizando encuestas' : 'No hay encuestas disponibles'}
          description={isStale ? 'Se muestran datos previos mientras se actualizan las encuestas.' : 'Este espacio todavía no publicó encuestas públicas activas.'}
        />
      )}
    </TenantShell>
  );
};

export default TenantSurveyListPage;
