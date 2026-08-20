import { useMemo, type ElementType, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BellRing,
  Calendar,
  ClipboardCheck,
  Loader2,
  Newspaper,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { motion } from 'framer-motion';

import { listPublicSurveys, type PublicSurveyListResult } from '@/api/encuestas';
import { getTenantPublicNavigation, listTenantEvents, listTenantNews } from '@/api/tenant';
import { TenantShell } from '@/components/tenant/TenantShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTenant } from '@/context/TenantContext';
import { queryKeys } from '@/lib/queryKeys';
import { getErrorMessage } from '@/utils/api';
import { resolveTenantPublicNavigationTarget } from '@/utils/tenantPaths';
import type { TenantEventItem, TenantNewsItem, TenantPublicNavigationItem } from '@/types/tenant';

const normalizeText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const navSearchText = (item: TenantPublicNavigationItem) =>
  normalizeText([item.id, item.label, item.route, item.href, item.endpoint].filter(Boolean).join(' '));

const isUsableNavItem = (item: TenantPublicNavigationItem) =>
  item.visible !== false && item.enabled !== false;

const findNavItem = (items: TenantPublicNavigationItem[], tokens: string[]) => {
  const normalizedTokens = tokens.map(normalizeText);
  return items.find((item) => {
    const text = navSearchText(item);
    return normalizedTokens.some((token) => text.includes(token));
  });
};

const hasEndpoint = (item?: TenantPublicNavigationItem | null) =>
  typeof item?.endpoint === 'string' && item.endpoint.trim().length > 0;

const resolveNavTarget = (
  item: TenantPublicNavigationItem | null | undefined,
  basePath: string | null,
) => {
  if (!basePath) return null;
  return resolveTenantPublicNavigationTarget(item, basePath);
};

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
  if (!items?.length) return [];
  return items.slice(0, size);
};

const publicErrorMessage = (error: unknown) => {
  const message = getErrorMessage(error);
  if (/<[a-z][\s\S]*>/i.test(message)) {
    return 'La informacion no esta disponible en este momento.';
  }
  return message;
};

const LandingStatCard = ({ label, value, icon: Icon }: { label: string; value: string; icon: ElementType }) => (
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
  icon: ElementType;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
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
    if (fromContext?.trim()) return fromContext.trim();
    if (params.tenant?.trim()) return params.tenant.trim();
    return '';
  }, [currentSlug, params.tenant, tenant?.slug]);

  const basePath = slug ? `/t/${encodeURIComponent(slug)}` : null;

  const navigationQuery = useQuery({
    queryKey: ['tenant-public-navigation-home', slug],
    enabled: Boolean(slug),
    queryFn: () => getTenantPublicNavigation(slug),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const navigationItems = useMemo(
    () => (navigationQuery.data?.items ?? []).filter(isUsableNavItem),
    [navigationQuery.data?.items],
  );

  const newsNavItem = useMemo(
    () => findNavItem(navigationItems, ['noticia', 'news']),
    [navigationItems],
  );
  const eventsNavItem = useMemo(
    () => findNavItem(navigationItems, ['evento', 'agenda', 'event']),
    [navigationItems],
  );
  const surveysNavItem = useMemo(
    () => findNavItem(navigationItems, ['encuesta', 'votacion', 'sondeo', 'survey', 'poll']),
    [navigationItems],
  );
  const ticketNavItem = useMemo(
    () => findNavItem(navigationItems, ['reclamo', 'solicitud', 'ticket', 'seguimiento']),
    [navigationItems],
  );

  const shouldLoadNews = Boolean(slug && newsNavItem);
  const shouldLoadEvents = Boolean(slug && eventsNavItem);
  const shouldLoadSurveys = Boolean(slug && surveysNavItem && hasEndpoint(surveysNavItem));

  const newsQuery = useQuery<TenantNewsItem[]>({
    queryKey: queryKeys.tenant.news(slug),
    enabled: shouldLoadNews,
    queryFn: () => listTenantNews(slug),
    staleTime: 1000 * 60 * 5,
  });

  const eventsQuery = useQuery<TenantEventItem[]>({
    queryKey: queryKeys.tenant.events(slug),
    enabled: shouldLoadEvents,
    queryFn: () => listTenantEvents(slug),
    staleTime: 1000 * 60 * 5,
  });

  const surveysQuery = useQuery<PublicSurveyListResult>({
    queryKey: queryKeys.tenant.surveys(slug),
    enabled: shouldLoadSurveys,
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
  const ticketTarget = ticketNavItem
    ? resolveNavTarget(ticketNavItem, basePath)
    : null;
  const surveysTarget = shouldLoadSurveys && surveysNavItem
    ? resolveNavTarget(surveysNavItem, basePath)
    : null;
  const newsTarget = newsNavItem ? resolveNavTarget(newsNavItem, basePath) : null;
  const eventsTarget = eventsNavItem ? resolveNavTarget(eventsNavItem, basePath) : null;

  const statCards = [
    newsNavItem ? { label: newsNavItem.label, value: String(newsItems.length), icon: Newspaper } : null,
    eventsNavItem ? { label: eventsNavItem.label, value: String(eventItems.length), icon: Calendar } : null,
    shouldLoadSurveys ? { label: surveysNavItem?.label ?? 'Encuestas', value: String(surveyItems.length), icon: ClipboardCheck } : null,
  ].filter((item): item is { label: string; value: string; icon: ElementType } => Boolean(item));

  const hasPublishedModules = Boolean(newsNavItem || eventsNavItem || shouldLoadSurveys || ticketNavItem);
  const navigationLoaded = navigationQuery.isSuccess || navigationQuery.isError;

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
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
            <CardTitle>Selecciona un espacio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Elegilo desde el selector superior para ver los canales publicos disponibles.</p>
          </CardContent>
        </Card>
      ) : (
        <motion.div className="grid gap-10" variants={container} initial="hidden" animate="show">
          <motion.section
            variants={itemAnim}
            className="relative overflow-hidden rounded-[32px] border border-border/60 bg-gradient-to-br from-background via-primary/5 to-sky-500/10 p-8 shadow-sm"
          >
            <div className="absolute -right-10 top-0 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
              <div className="space-y-5">
                <Badge variant="outline" className="border-primary/20 bg-background/80 px-3 py-1 text-primary">
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  Espacio publico
                </Badge>
                <div className="space-y-3">
                  <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                    {tenantName}
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                    Canales publicados por la organizacion para novedades, agenda, participacion y seguimiento.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {ticketTarget ? (
                    <Button asChild size="lg" className="rounded-2xl shadow-lg shadow-primary/15">
                      <Link to={ticketTarget}>
                        {ticketNavItem?.label ?? 'Iniciar gestion'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                  {surveysTarget ? (
                    <Button asChild variant="outline" size="lg" className="rounded-2xl bg-background/70">
                      <Link to={surveysTarget}>{surveysNavItem?.label ?? 'Participar'}</Link>
                    </Button>
                  ) : null}
                </div>
              </div>

              {statCards.length ? (
                <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
                  {statCards.map((card) => (
                    <LandingStatCard key={card.label} {...card} />
                  ))}
                </div>
              ) : null}
            </div>
          </motion.section>

          {!navigationLoaded ? (
            <div className="flex min-h-[160px] items-center justify-center rounded-3xl border bg-muted/30">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : null}

          {navigationLoaded && !hasPublishedModules ? (
            <Card className="border-border/60 bg-background/70 shadow-sm">
              <CardContent className="p-6 text-sm text-muted-foreground">
                Este espacio todavia no publico canales visibles.
              </CardContent>
            </Card>
          ) : null}

          {newsNavItem ? (
            <LandingSectionShell
              icon={Newspaper}
              title={newsNavItem.label}
              description="Actualizaciones y comunicados publicados por la organizacion."
              action={newsTarget ? (
                <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary">
                  <Link to={newsTarget}>Ver todo</Link>
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
                  <AlertDescription>{publicErrorMessage(newsQuery.error)}</AlertDescription>
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
                      ) : null}
                      <div className="space-y-3 p-5">
                        {formatDate(item.publicado_at) ? (
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {formatDate(item.publicado_at)}
                          </p>
                        ) : null}
                        <h3 className="text-lg font-bold leading-tight tracking-tight text-foreground">{item.titulo}</h3>
                        {item.resumen ? (
                          <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{item.resumen}</p>
                        ) : null}
                      </div>
                    </motion.article>
                  ))}
                </div>
              ) : (
                <p className="rounded-3xl border border-dashed bg-muted/20 p-8 text-sm text-muted-foreground">
                  No hay publicaciones disponibles.
                </p>
              )}
            </LandingSectionShell>
          ) : null}

          {eventsNavItem ? (
            <LandingSectionShell
              icon={Calendar}
              title={eventsNavItem.label}
              description="Agenda publica y actividades disponibles para este espacio."
              action={eventsTarget ? (
                <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary">
                  <Link to={eventsTarget}>Ver agenda</Link>
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
                  <AlertDescription>{publicErrorMessage(eventsQuery.error)}</AlertDescription>
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
                          {event.descripcion ? (
                            <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">{event.descripcion}</p>
                          ) : null}
                        </div>
                        {formatDateTime(event.starts_at) ? (
                          <p className="text-xs font-medium text-muted-foreground">
                            {formatDateTime(event.starts_at)}
                            {event.lugar ? ` - ${event.lugar}` : ''}
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
                  No hay actividades publicadas.
                </p>
              )}
            </LandingSectionShell>
          ) : null}

          {shouldLoadSurveys ? (
            <LandingSectionShell
              icon={ClipboardCheck}
              title={surveysNavItem?.label ?? 'Participacion'}
              description="Instancias activas para votar, opinar o responder desde este espacio."
              action={surveysTarget ? (
                <Button asChild variant="ghost" size="sm" className="hover:bg-primary/10 hover:text-primary">
                  <Link to={surveysTarget}>Ver listado</Link>
                </Button>
              ) : undefined}
            >
              {surveysQuery.isLoading ? (
                <div className="flex min-h-[160px] items-center justify-center rounded-3xl border bg-muted/30">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : surveysQuery.error ? (
                <Alert variant="destructive">
                  <AlertTitle>No pudimos cargar la participacion</AlertTitle>
                  <AlertDescription>{publicErrorMessage(surveysQuery.error)}</AlertDescription>
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
                          Activa
                        </div>
                        <h3 className="text-lg font-bold leading-tight tracking-tight text-foreground">{survey.titulo}</h3>
                        {survey.descripcion ? (
                          <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">{survey.descripcion}</p>
                        ) : null}
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
                  No hay instancias activas publicadas.
                </p>
              )}
            </LandingSectionShell>
          ) : null}
        </motion.div>
      )}
    </TenantShell>
  );
};

export default TenantPublicLanding;
