import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Calendar, Newspaper, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';

import { TenantShell } from '@/components/tenant/TenantShell';
import { listTenantEvents, listTenantNews } from '@/api/tenant';
import { listPublicSurveys, type PublicSurveyListResult } from '@/api/encuestas';
import { useTenant } from '@/context/TenantContext';
import { useUser } from '@/hooks/useUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { getErrorMessage } from '@/utils/api';
import type { TenantEventItem, TenantNewsItem } from '@/types/tenant';
import BusinessMetrics from '@/pages/BusinessMetrics';
import EstadisticasPage from '@/pages/EstadisticasPage';

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

const TenantPublicLanding = () => {
  const params = useParams<{ tenant: string }>();
  const { tenant, currentSlug } = useTenant();

  const slug = useMemo(() => {
    const fromContext = tenant?.slug ?? currentSlug;
    if (fromContext && fromContext.trim()) return fromContext.trim();
    if (params.tenant && params.tenant.trim()) return params.tenant.trim();
    return '';
  }, [currentSlug, params.tenant, tenant?.slug]);

  const basePath = slug ? `/${encodeURIComponent(slug)}` : null;

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

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemAnim = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <TenantShell>
      {!slug ? (
        <Card className="border-2 border-dashed">
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
        <motion.div
          className="grid gap-8"
          variants={container}
          initial="hidden"
          animate="show"
        >
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Newspaper className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Noticias recientes</h2>
              </div>
              {basePath ? (
                <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary">
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
                  <motion.article
                    key={String(item.id)}
                    variants={itemAnim}
                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md"
                  >
                    {item.cover_url && (
                        <div className="aspect-video w-full overflow-hidden">
                          <img
                            src={item.cover_url}
                            alt={item.titulo}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                    )}
                    <div className="flex flex-1 flex-col p-4">
                      <div className="space-y-2">
                        {formatDate(item.publicado_at) ? (
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {formatDate(item.publicado_at)}
                          </p>
                        ) : null}
                        <h3 className="text-lg font-bold leading-tight tracking-tight">
                          {item.titulo}
                        </h3>
                        {item.resumen ? (
                          <p className="line-clamp-3 text-sm text-muted-foreground">{item.resumen}</p>
                        ) : null}
                      </div>
                    </div>
                  </motion.article>
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
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Próximos eventos</h2>
              </div>
              {basePath ? (
                <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary">
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
                  <motion.article
                    key={String(event.id)}
                    variants={itemAnim}
                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md"
                  >
                    {event.cover_url && (
                        <div className="aspect-video w-full overflow-hidden">
                          <img
                            src={event.cover_url}
                            alt={event.titulo}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                    )}
                    <div className="flex flex-1 flex-col p-4">
                      <div className="space-y-3">
                        {formatDate(event.starts_at) ? (
                          <Badge variant="secondary" className="w-fit">{formatDate(event.starts_at)}</Badge>
                        ) : null}
                        <div className="space-y-1">
                          <h3 className="text-lg font-bold leading-tight tracking-tight">
                            {event.titulo}
                          </h3>
                          {event.descripcion ? (
                            <p className="line-clamp-2 text-sm text-muted-foreground">{event.descripcion}</p>
                          ) : null}
                        </div>
                        {formatDateTime(event.starts_at) ? (
                          <p className="text-xs text-muted-foreground font-medium">
                            {formatDateTime(event.starts_at)}
                            {event.lugar ? ` · ${event.lugar}` : ''}
                          </p>
                        ) : event.lugar ? (
                          <p className="text-xs text-muted-foreground font-medium">{event.lugar}</p>
                        ) : null}
                      </div>
                    </div>
                  </motion.article>
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
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold">Encuestas abiertas</h2>
              </div>
              {basePath ? (
                <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary">
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
                  <motion.article
                    key={survey.slug}
                    variants={itemAnim}
                    whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                    className="flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="space-y-3">
                      <h3 className="text-lg font-bold leading-tight">
                        {survey.titulo}
                      </h3>
                      {survey.descripcion ? (
                        <p className="line-clamp-3 text-sm text-muted-foreground">{survey.descripcion}</p>
                      ) : null}
                    </div>
                    <div className="mt-4">
                      <Button asChild className="w-full" size="sm">
                        <Link to={`${basePath}/encuestas/${survey.slug}`}>Participar</Link>
                      </Button>
                    </div>
                  </motion.article>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
                No hay encuestas disponibles en este momento.
              </p>
            )}
          </section>
        </motion.div>
      )}
    </TenantShell>
  );
};

const TenantHomePage = () => {
  const { user } = useUser();
  const { tenant } = useTenant();

  // Determine if user has admin access to this tenant
  const hasAdminAccess = useMemo(() => {
    if (!user) return false;
    // Super admin can access everything
    if (user.rol === 'super_admin') return true;

    // Admin/Empleado check
    // In a real scenario, we should check if the user belongs to THIS tenant.
    // Assuming backend validates access, we just check role presence for now.
    // If the backend prevents cross-tenant access, any 'admin' role is fine for the UI switch
    // because the API would fail if they are in the wrong tenant.
    const allowedRoles = ['admin', 'empleado'];
    return allowedRoles.includes(user.rol || '');
  }, [user]);

  if (hasAdminAccess) {
    // Render appropriate dashboard based on tenant type
    if (tenant?.tipo === 'municipio') {
      return (
        <TenantShell>
          <EstadisticasPage />
        </TenantShell>
      );
    }
    // Default to Business Dashboard (Pyme)
    return (
      <TenantShell>
        <BusinessMetrics />
      </TenantShell>
    );
  }

  // Fallback to public landing for guests / portal users
  return <TenantPublicLanding />;
};

export default TenantHomePage;
