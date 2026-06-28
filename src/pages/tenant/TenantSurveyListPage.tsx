import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { listPublicSurveys, type PublicSurveyListResult } from '@/api/encuestas';
import { getTenantPublicNavigation } from '@/api/tenant';
import { ViewState } from '@/components/app-shell/ViewState';
import { TenantShell } from '@/components/tenant/TenantShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/context/TenantContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/utils/api';
import type { TenantPublicNavigationItem } from '@/types/tenant';

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
    return { label: 'Proximamente', variant: 'secondary' as const };
  }

  if (end && !Number.isNaN(end.getTime()) && now > end) {
    return { label: 'Finalizada', variant: 'outline' as const };
  }

  return { label: 'En curso', variant: 'default' as const };
};

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const isSurveyNavItem = (item: TenantPublicNavigationItem) => {
  const text = normalizeText([item.id, item.label, item.route, item.href, item.endpoint].filter(Boolean).join(' '));
  return ['encuesta', 'votacion', 'sondeo', 'survey', 'poll'].some((token) => text.includes(token));
};

const hasEndpoint = (item?: TenantPublicNavigationItem) =>
  typeof item?.endpoint === 'string' && item.endpoint.trim().length > 0;

const publicErrorMessage = (error: unknown) => {
  const message = getErrorMessage(error);
  if (/<[a-z][\s\S]*>/i.test(message)) {
    return 'La informacion no esta disponible en este momento.';
  }
  return message;
};

const TenantSurveyListPage = () => {
  const params = useParams<{ tenant: string }>();
  const { tenant, currentSlug } = useTenant();
  const { isOnline } = useNetworkStatus();

  const slug = useMemo(() => {
    const fromContext = tenant?.slug ?? currentSlug;
    if (fromContext?.trim()) return fromContext.trim();
    if (params.tenant?.trim()) return params.tenant.trim();
    return '';
  }, [currentSlug, params.tenant, tenant?.slug]);

  const basePath = slug ? `/t/${encodeURIComponent(slug)}` : null;

  const navigationQuery = useQuery({
    queryKey: ['tenant-public-navigation-surveys', slug],
    enabled: Boolean(slug),
    queryFn: () => getTenantPublicNavigation(slug),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const surveyNavItem = useMemo(
    () => navigationQuery.data?.items?.filter((item) => item.visible !== false && item.enabled !== false).find(isSurveyNavItem),
    [navigationQuery.data?.items],
  );

  const canLoadSurveys = Boolean(slug && surveyNavItem && hasEndpoint(surveyNavItem));

  const surveysQuery = useQuery<PublicSurveyListResult>({
    queryKey: queryKeys.tenant.surveys(slug, 'full'),
    enabled: canLoadSurveys,
    queryFn: () => listPublicSurveys(slug),
    staleTime: 1000 * 60 * 2,
  });

  const surveys = useMemo(() => (Array.isArray(surveysQuery.data) ? surveysQuery.data : []), [surveysQuery.data]);
  const isStale = surveysQuery.isSuccess && surveysQuery.isFetching;

  return (
    <TenantShell>
      {!slug ? (
        <Card>
          <CardHeader>
            <CardTitle>Selecciona un espacio</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Elegi un espacio para ver sus instancias publicas disponibles.
          </CardContent>
        </Card>
      ) : navigationQuery.isLoading ? (
        <ViewState status="loading" title="Cargando participacion" />
      ) : !surveyNavItem ? (
        <ViewState
          status="empty"
          title="Participacion no publicada"
          description="Este espacio no tiene una instancia publica de participacion habilitada."
        />
      ) : !hasEndpoint(surveyNavItem) ? (
        <ViewState
          status="empty"
          title="Participacion no disponible"
          description="La organizacion todavia no publico el listado para esta seccion."
        />
      ) : !isOnline && !surveysQuery.data ? (
        <ViewState
          status="offline"
          title="Sin conexion para consultar participacion"
          description="Revisa tu conexion y reintenta."
        />
      ) : surveysQuery.isLoading ? (
        <ViewState status="loading" title="Cargando participacion" />
      ) : surveysQuery.error ? (
        <ViewState
          status="error"
          title="No pudimos cargar la participacion"
          description={publicErrorMessage(surveysQuery.error)}
        />
      ) : surveys.length ? (
        <div className="space-y-5">
          {surveys.map((survey) => {
            const status = getSurveyStatus(survey.inicio_at, survey.fin_at);
            const isLiveExperience = Boolean(survey.es_votacion_envivo || survey.mostrar_resultados_envivo);
            const surveyHref = isLiveExperience
              ? `/e/${encodeURIComponent(survey.slug)}?tenant=${encodeURIComponent(slug)}`
              : `${basePath}/encuestas/${survey.slug}`;
            return (
              <article key={survey.slug} className="rounded-3xl border bg-background/80 shadow-sm">
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {survey.es_votacion_envivo ? <Badge variant="default">En vivo</Badge> : null}
                    {survey.mostrar_resultados_envivo ? <Badge variant="secondary">Resultados en tiempo real</Badge> : null}
                    {survey.permitir_comentarios ? <Badge variant="outline">Comentarios abiertos</Badge> : null}
                    {formatDate(survey.fin_at) ? <Badge variant="outline">Cierra: {formatDate(survey.fin_at)}</Badge> : null}
                  </div>
                  <CardTitle className="text-2xl leading-tight">{survey.titulo}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {survey.descripcion ? (
                    <p className="text-sm leading-relaxed text-muted-foreground">{survey.descripcion}</p>
                  ) : null}
                  {basePath ? (
                    <Button asChild>
                      <a href={surveyHref}>{isLiveExperience ? 'Abrir sala en vivo' : 'Responder encuesta'}</a>
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
          title={isStale ? 'Actualizando participacion' : 'No hay instancias activas'}
          description={isStale ? 'Se muestran datos previos mientras se actualizan.' : 'Este espacio todavia no publico instancias activas.'}
        />
      )}
    </TenantShell>
  );
};

export default TenantSurveyListPage;
