import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { TenantShell } from '@/components/tenant/TenantShell';
import { listPublicSurveys, type PublicSurveyListResult } from '@/api/encuestas';
import { useTenant } from '@/context/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/utils/api';

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

  const basePath = slug ? `/t/${encodeURIComponent(slug)}` : null;

  const surveysQuery = useQuery<PublicSurveyListResult>({
    queryKey: ['tenant-surveys', slug, 'full'],
    enabled: Boolean(slug),
    queryFn: () => listPublicSurveys(slug),
    staleTime: 1000 * 60 * 2,
  });

  const surveys = useMemo(() => (Array.isArray(surveysQuery.data) ? surveysQuery.data : []), [
    surveysQuery.data,
  ]);

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
      ) : surveysQuery.isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-3xl border bg-muted/30">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : surveysQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>No pudimos cargar las encuestas</AlertTitle>
          <AlertDescription>{getErrorMessage(surveysQuery.error)}</AlertDescription>
        </Alert>
      ) : surveys.length ? (
        <div className="space-y-5">
          {surveys.map((survey) => {
            const status = getSurveyStatus(survey.inicio_at, survey.fin_at);
            return (
              <article key={survey.slug} className="rounded-3xl border bg-background/80 shadow-sm">
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={status.variant}>{status.label}</Badge>
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
        <Card>
          <CardHeader>
            <CardTitle>No hay encuestas disponibles</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Este espacio todavía no publicó encuestas públicas activas.
          </CardContent>
        </Card>
      )}
    </TenantShell>
  );
};

export default TenantSurveyListPage;
