import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Loader2,
  Calendar,
  Newspaper,
  ClipboardCheck,
  ArrowRight,
  Sparkles,
  BellRing,
  Landmark,
} from 'lucide-react';
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

const LandingStatCard = ({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) => (
  <div className="rounded-3xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
    <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
      <Icon className="h-4 w-4" />
    </div>
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
    <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
  </div>
);

const LandingSectionShell = ({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="space-y-5">
    <div className="flex flex-col gap-4 rounded-3xl border border-border/60 bg-background/70 p-6 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {action}
    </div>
    {children}
  </section>
);

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

  const tenantName = tenant?.nombre?.trim() || slug;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemAnim = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0 },
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
        <motion.div className="grid gap-10" variants={container} initial="hidden" animate="show">
          <motion.section variants={itemAnim} className="relative overflow-hidden rounded-[32px] border border-border/60 bg-gradient-to-br from-background via-primary/5 to-sky-500/10 p-8 shadow-sm">
            <div className="absolute -right-10 top-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
              <div className="space-y-5">
                <Badge variant="outline" className="border-primary/20 bg-background/80 px-3 py-1 text-primary">
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Experiencia pública del tenant
                </Badge>
                <div className="space-y-3">
                  <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                    Todo el contenido público de {tenantName} en un solo lugar.
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                    Novedades, agenda y participación abiertos al público con una experiencia más clara, visual y lista para múltiples tenants.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {basePath ? (
                    <Button asChild size="lg" className="rounded-2xl shadow-lg shadow-primary/15">
                      <Link to={`${basePath}/ticket`}>
                        Ir a seguimiento
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                  {basePath ? (
                    <Button asChild variant="outline" size="lg" className="rounded-2xl bg-background/70">
                      <Link to={`${basePath}/encuestas`}>Ver participación</Link>
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                <LandingStatCard label="Noticias" value={String(newsItems.length)} icon={Newspaper} />
                <LandingStatCard label="Eventos" value={String(eventItems.length)} icon={Calendar} />
                <LandingStatCard label="Encuestas" value={String(surveyItems.length)} icon={ClipboardCheck} />
              </div>
            </div>
          </motion.section>

          <LandingSectionShell
            icon={Newspaper}
            title="Noticias recientes"
            description="Actualizaciones públicas, comunicados y contenido editorial publicados por el tenant."
            action={basePath ? (
              <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary">
                <Link to={`${basePath}/noticias`}>Ver todas</Link>
              </Button>
            ) : undefined}
          >
            {newsQuery.isLoading ? (
              <div className="flex min-h-[160px] items-center justify-center rounded-3xl border bg-muted/30">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : newsQuery.error ? (
              <Alert variant="destructive">
                <AlertTitle>No pudimos cargar las noticias</AlertTitle>
                <AlertDescription>{getErrorMessage(newsQuery.error)}</AlertDescription>
              </Alert>
            ) : newsItems.length ? (
              <div className="grid gap-5 md:grid-cols-3">
                {newsItems.map((item) => (
                  <motion.article
                    key={String(item.id)}
                    variants={itemAnim}
                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                    className="group relative overflow-hidden rounded-[28px] border border-border/60 bg-card/90 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-primary/5"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-sky-400 to-violet-400 opacity-80" />
                    {item.cover_url ? (
                      <div className="aspect-[16/9] w-full overflow-hidden">
                        <img
                          src={item.cover_url}
                          alt={item.titulo}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-[16/9] items-center justify-center bg-gradient-to-br from-primary/10 via-sky-500/10 to-transparent text-primary">
                        <Newspaper className="h-8 w-8" />
                      </div>
                    )}
                    <div className="space-y-3 p-5">
                      {formatDate(item.publicado_at) ? (
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {formatDate(item.publicado_at)}
                        </p>
                      ) : null}
                      <h3 className="text-lg font-bold leading-tight tracking-tight text-foreground">{item.titulo}</h3>
                      {item.resumen ? <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{item.resumen}</p> : null}
                    </div>
                  </motion.article>
                ))}
              </div>
            ) : (
              <p className="rounded-3xl border border-dashed bg-muted/20 p-8 text-sm text-muted-foreground">
                Todavía no hay novedades publicadas.
              </p>
            )}
          </LandingSectionShell>

          <LandingSectionShell
            icon={Calendar}
            title="Próximos eventos"
            description="Agenda pública con actividades, encuentros y anuncios programados del tenant."
            action={basePath ? (
              <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary">
                <Link to={`${basePath}/eventos`}>Ver calendario</Link>
              </Button>
            ) : undefined}
          >
            {eventsQuery.isLoading ? (
              <div className="flex min-h-[160px] items-center justify-center rounded-3xl border bg-muted/30">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : eventsQuery.error ? (
              <Alert variant="destructive">
                <AlertTitle>No pudimos cargar los eventos</AlertTitle>
                <AlertDescription>{getErrorMessage(eventsQuery.error)}</AlertDescription>
              </Alert>
            ) : eventItems.length ? (
              <div className="grid gap-5 md:grid-cols-3">
                {eventItems.map((event) => (
                  <motion.article
                    key={String(event.id)}
                    variants={itemAnim}
                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                    className="group rounded-[28px] border border-border/60 bg-card/90 p-5 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-primary/5"
                  >
                    {event.cover_url ? (
                      <div className="-mx-5 -mt-5 mb-5 aspect-[16/9] overflow-hidden rounded-t-[28px]">
                        <img
                          src={event.cover_url}
                          alt={event.titulo}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    ) : null}
                    <div className="space-y-3">
                      {formatDate(event.starts_at) ? (
                        <Badge variant="secondary" className="w-fit rounded-full border border-primary/10 bg-primary/10 text-primary">
                          {formatDate(event.starts_at)}
                        </Badge>
                      ) : null}
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold leading-tight tracking-tight text-foreground">{event.titulo}</h3>
                        {event.descripcion ? <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{event.descripcion}</p> : null}
                      </div>
                      {formatDateTime(event.starts_at) ? (
                        <p className="text-xs font-medium text-muted-foreground">
                          {formatDateTime(event.starts_at)}
                          {event.lugar ? ` · ${event.lugar}` : ''}
                        </p>
                      ) : event.lugar ? (
                        <p className="text-xs font-medium text-muted-foreground">{event.lugar}</p>
                      ) : null}
                    </div>
                  </motion.article>
                ))}
              </div>
            ) : (
              <p className="rounded-3xl border border-dashed bg-muted/20 p-8 text-sm text-muted-foreground">
                No hay actividades próximas programadas.
              </p>
            )}
          </LandingSectionShell>

          <LandingSectionShell
            icon={ClipboardCheck}
            title="Encuestas abiertas"
            description="Instancias activas para participación y relevamiento con acceso directo desde el portal público."
            action={basePath ? (
              <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary">
                <Link to={`${basePath}/encuestas`}>Ver listado</Link>
              </Button>
            ) : undefined}
          >
            {surveysQuery.isLoading ? (
              <div className="flex min-h-[160px] items-center justify-center rounded-3xl border bg-muted/30">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : surveysQuery.error ? (
              <Alert variant="destructive">
                <AlertTitle>No pudimos cargar las encuestas</AlertTitle>
                <AlertDescription>{getErrorMessage(surveysQuery.error)}</AlertDescription>
              </Alert>
            ) : surveyItems.length ? (
              <div className="grid gap-5 md:grid-cols-3">
                {surveyItems.map((survey) => (
                  <motion.article
                    key={survey.slug}
                    variants={itemAnim}
                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                    className="flex h-full flex-col justify-between rounded-[28px] border border-border/60 bg-card/90 p-5 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-primary/5"
                  >
                    <div className="space-y-3">
                      <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                        <BellRing className="h-3.5 w-3.5" />
                        Participación activa
                      </div>
                      <h3 className="text-lg font-bold leading-tight tracking-tight text-foreground">{survey.titulo}</h3>
                      {survey.descripcion ? <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{survey.descripcion}</p> : null}
                    </div>
                    <div className="mt-6">
                      <Button asChild className="w-full rounded-2xl" size="sm">
                        <Link to={`${basePath}/encuestas/${survey.slug}`}>Participar</Link>
                      </Button>
                    </div>
                  </motion.article>
                ))}
              </div>
            ) : (
              <p className="rounded-3xl border border-dashed bg-muted/20 p-8 text-sm text-muted-foreground">
                No hay encuestas disponibles en este momento.
              </p>
            )}
          </LandingSectionShell>

          <motion.section variants={itemAnim} className="grid gap-4 xl:grid-cols-3">
            <Card className="border-border/60 bg-background/70 shadow-sm backdrop-blur xl:col-span-2">
              <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    <Landmark className="h-3.5 w-3.5" />
                    Portal listo para seguimiento
                  </div>
                  <h3 className="text-2xl font-bold tracking-tight text-foreground">Más claridad visual para el portal y la app.</h3>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Reordenamos el contenido público en bloques más legibles, con jerarquía visual más fuerte, métricas rápidas y tarjetas más limpias para noticias, agenda y participación.
                  </p>
                </div>
                {basePath ? (
                  <Button asChild variant="outline" className="w-fit rounded-2xl">
                    <Link to={`${basePath}/ticket`}>Abrir seguimiento público</Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
            <Card className="border-border/60 bg-gradient-to-br from-primary/10 via-background to-sky-500/10 shadow-sm">
              <CardContent className="space-y-3 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">UX/UI refresh</p>
                <h3 className="text-xl font-bold tracking-tight text-foreground">Más contraste, más aire y mejor lectura.</h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  Mejoramos sombras, radios, gradientes suaves, estados vacíos y tarjetas para que cada tenant se vea más premium sin personalizaciones locales hardcodeadas.
                </p>
              </CardContent>
            </Card>
          </motion.section>
        </motion.div>
      )}
    </TenantShell>
  );
};

const TenantHomePage = () => {
  const { user } = useUser();
  const { tenant } = useTenant();

  const hasAdminAccess = useMemo(() => {
    if (!user) return false;
    if (user.rol === 'super_admin') return true;
    const allowedRoles = ['admin', 'empleado'];
    return allowedRoles.includes(user.rol || '');
  }, [user]);

  if (hasAdminAccess) {
    if (tenant?.tipo === 'municipio') {
      return (
        <TenantShell>
          <EstadisticasPage />
        </TenantShell>
      );
    }

    return (
      <TenantShell>
        <BusinessMetrics />
      </TenantShell>
    );
  }

  return <TenantPublicLanding />;
};

export default TenantHomePage;
