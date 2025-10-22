import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { TenantShell } from '@/components/tenant/TenantShell';
import { listTenantEvents, listTenantNews } from '@/api/tenant';
import { listPublicSurveys, type PublicSurveyListResult } from '@/api/encuestas';
import { useTenant } from '@/context/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { getErrorMessage } from '@/utils/api';
import type { TenantEventItem, TenantNewsItem } from '@/types/tenant';

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "d 'de' MMMM", { locale: es });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "EEEE d 'de' MMMM HH:mm", { locale: es });
};

const limitItems = <T,>(items: T[] | undefined, size: number): T[] => {
  if (!items || !items.length) return [];
  return items.slice(0, size);
};

const TenantHomePage = () => {
  const params = useParams<{ tenant: string }>();
  const { tenant, currentSlug } = useTenant();

  const slug = useMemo(() => {
    const fromContext = tenant?.slug ?? currentSlug;
    if (fromContext && fromContext.trim()) return fromContext.trim();
    if (params.tenant && params.tenant.trim()) return params.tenant.trim();
    return '';
  }, [currentSlug, params.tenant, tenant?.slug]);

  const basePath = slug ? `/t/${encodeURIComponent(slug)}` : null;

  const newsQuery = useQuery<TenantNewsItem[]>({
    queryKey: ['tenant-news', slug],
    enabled: Boolean(slug),
    queryFn: () => listTenantNews(slug),
    staleTime: 1000 * 60 * 5,
  });

  const eventsQuery = useQuery<TenantEventItem[]>({
    queryKey: ['tenant-events', slug],
    enabled: Boolean(slug),
    queryFn: () => listTenantEvents(slug),
    staleTime: 1000 * 60 * 5,
  });

  const surveysQuery = useQuery<PublicSurveyListResult>({
    queryKey: ['tenant-surveys', slug],
    enabled: Boolean(slug),
    queryFn: () => listPublicSurveys(slug),
    staleTime: 1000 * 60 * 2,
  });

  const newsItems = useMemo(() => limitItems(newsQuery.data, 3), [newsQuery.data]);
  const eventItems = useMemo(() => limitItems(eventsQuery.data, 3), [eventsQuery.data]);
  const surveyItems = useMemo(() => {
    if (!Array.isArray(surveysQuery.data)) return [];
    return limitItems(surveysQuery.data, 3);
  }, [surveysQuery.data]);

  return (
    <TenantShell>
      {!slug ? (
        <Card>
          <CardHeader>
            <CardTitle>Seleccioná un espacio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Elegí un espacio desde el selector superior para ver novedades públicas, eventos, encuestas y enviar reclamos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-8">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Noticias recientes</h2>
              {basePath ? (
                <Button asChild variant="ghost" size="sm">
                  <Link to={`${basePath}/noticias`}>Ver todas</Link>
                </Button>
              ) : null}
            </div>
            {newsQuery.isLoading ? (
              <div className="flex min-h-[120px] items-center justify-center rounded-xl border bg-muted/30">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : newsQuery.error ? (
              <Alert variant="destructive">
                <AlertTitle>No pudimos cargar las noticias</AlertTitle>
                <AlertDescription>{getErrorMessage(newsQuery.error)}</AlertDescription>
              </Alert>
            ) : newsItems.length ? (
              <div className="grid gap-4 md:grid-cols-3">
                {newsItems.map((item) => (
                  <article key={String(item.id)} className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                    <div className="space-y-2">
                      {formatDate(item.publicado_at) ? (
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {formatDate(item.publicado_at)}
                        </p>
                      ) : null}
                      <h3 className="text-base font-semibold leading-snug text-foreground">
                        {item.titulo}
                      </h3>
                      {item.resumen ? (
                        <p className="text-sm text-muted-foreground">{item.resumen}</p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
                Todavía no hay novedades publicadas.
              </p>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Próximos eventos</h2>
              {basePath ? (
                <Button asChild variant="ghost" size="sm">
                  <Link to={`${basePath}/eventos`}>Ver calendario</Link>
                </Button>
              ) : null}
            </div>
            {eventsQuery.isLoading ? (
              <div className="flex min-h-[120px] items-center justify-center rounded-xl border bg-muted/30">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : eventsQuery.error ? (
              <Alert variant="destructive">
                <AlertTitle>No pudimos cargar los eventos</AlertTitle>
                <AlertDescription>{getErrorMessage(eventsQuery.error)}</AlertDescription>
              </Alert>
            ) : eventItems.length ? (
              <div className="grid gap-4 md:grid-cols-3">
                {eventItems.map((event) => (
                  <article key={String(event.id)} className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                    <div className="space-y-3">
                      {formatDate(event.starts_at) ? (
                        <Badge variant="secondary">{formatDate(event.starts_at)}</Badge>
                      ) : null}
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold leading-snug text-foreground">
                          {event.titulo}
                        </h3>
                        {event.descripcion ? (
                          <p className="text-sm text-muted-foreground line-clamp-3">{event.descripcion}</p>
                        ) : null}
                      </div>
                      {formatDateTime(event.starts_at) ? (
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(event.starts_at)}
                          {event.lugar ? ` · ${event.lugar}` : ''}
                        </p>
                      ) : event.lugar ? (
                        <p className="text-xs text-muted-foreground">{event.lugar}</p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
                No hay actividades próximas programadas.
              </p>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Encuestas abiertas</h2>
              {basePath ? (
                <Button asChild variant="ghost" size="sm">
                  <Link to={`${basePath}/encuestas`}>Ver listado</Link>
                </Button>
              ) : null}
            </div>
            {surveysQuery.isLoading ? (
              <div className="flex min-h-[120px] items-center justify-center rounded-xl border bg-muted/30">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : surveysQuery.error ? (
              <Alert variant="destructive">
                <AlertTitle>No pudimos cargar las encuestas</AlertTitle>
                <AlertDescription>{getErrorMessage(surveysQuery.error)}</AlertDescription>
              </Alert>
            ) : surveyItems.length ? (
              <div className="grid gap-4 md:grid-cols-3">
                {surveyItems.map((survey) => (
                  <article key={survey.slug} className="rounded-2xl border bg-background/80 p-4 shadow-sm">
                    <div className="space-y-2">
                      <h3 className="text-base font-semibold leading-snug text-foreground">
                        {survey.titulo}
                      </h3>
                      {survey.descripcion ? (
                        <p className="text-sm text-muted-foreground line-clamp-3">{survey.descripcion}</p>
                      ) : null}
                      <Button asChild variant="outline" size="sm">
                        <Link to={`${basePath}/encuestas/${survey.slug}`}>Participar</Link>
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
                No hay encuestas disponibles en este momento.
              </p>
            )}
          </section>
        </div>
      )}
    </TenantShell>
  );
};

export default TenantHomePage;
