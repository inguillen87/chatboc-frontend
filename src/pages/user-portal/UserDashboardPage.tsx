import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  PlusCircle,
  History,
  Newspaper,
  TicketPercent,
  MessageSquareQuote,
  ClipboardList,
  ImageOff,
  BellRing,
  RefreshCw,
  Sparkles,
  UserRound,
} from 'lucide-react';

import SummaryCard from '@/components/user-portal/dashboard/SummaryCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/hooks/useUser';
import { cn } from '@/lib/utils';
import { usePortalContent } from '@/hooks/usePortalContent';
import { useTenant } from '@/context/TenantContext';
import { buildTenantPath } from '@/utils/tenantPaths';

const UserDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { currentSlug, tenant } = useTenant();
  const {
    content,
    bundle,
    isLoading,
    refetch,
    publicProfile,
    publicClaims,
    publicOrders,
    commerceSession,
    registrationResult,
    registrationError,
    registerWidgetProfile,
  } = usePortalContent();
  const [registrationForm, setRegistrationForm] = useState({ name: '', phone: '', email: '' });
  const [registrationStatus, setRegistrationStatus] = useState<'idle' | 'saving' | 'saved' | 'verification_required'>('idle');
  const [localRegistrationError, setLocalRegistrationError] = useState<string | null>(null);

  const getBadgeClasses = (statusType?: string): string => {
    switch (statusType?.toLowerCase()) {
      case 'success':
      case 'confirmado':
      case 'entregado':
      case 'resuelto':
        return 'bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-200';
      case 'warning':
      case 'en revision':
        return 'bg-yellow-500/15 text-yellow-700 hover:bg-yellow-500/25 border-yellow-200';
      case 'info':
      case 'recibido':
      case 'en proceso':
        return 'bg-blue-500/15 text-blue-700 hover:bg-blue-500/25 border-blue-200';
      case 'error':
      case 'rechazado':
        return 'bg-red-500/15 text-red-700 hover:bg-red-500/25 border-red-200';
      default:
        return 'bg-secondary text-secondary-foreground hover:bg-secondary/80';
    }
  };

  const loyaltySummary = useMemo(() => content.loyaltySummary ?? null, [content]);
  const hasParticipationMetrics = Boolean(loyaltySummary?.hasParticipationMetrics);

  // Normalize optional arrays from the tenant portal contract.
  const activities = content.activities ?? [];
  const featuredNews = content.news ?? [];
  const pendingSurveys = content.surveys ?? [];
  const notifications = content.notifications ?? [];
  const bundleHighlights = Array.isArray(bundle?.highlights) ? bundle.highlights : [];
  const bundleQuickActions = Array.isArray(bundle?.quick_actions) ? bundle.quick_actions : [];
  const bundleModules = Array.isArray(bundle?.modules) ? bundle.modules : [];
  const bundleOrders = Array.isArray(bundle?.orders?.items) ? bundle.orders.items : [];
  const bundleClaims = Array.isArray(bundle?.claims?.items) ? bundle.claims.items : [];
  const bundlePromotions = Array.isArray(bundle?.promotions?.items) ? bundle.promotions.items : [];
  const actionLabels = commerceSession?.frontend_contract?.action_labels ?? {};
  const catalogEnabled = commerceSession?.catalog?.enabled === true || content.catalog.length > 0;
  const historyEnabled =
    publicClaims.length > 0 ||
    publicOrders.length > 0 ||
    activities.length > 0 ||
    Boolean(commerceSession?.history || commerceSession?.portal);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  // Determine Tenant Type for Conditional UI
  const isMunicipio = (commerceSession?.tenant?.tipo || tenant?.tipo) === 'municipio';
  const isPyme = !isMunicipio;
  const registrationFieldErrors =
    registrationResult?.field_errors ??
    ((registrationError as any)?.body?.field_errors as Record<string, string | string[]> | undefined) ??
    null;

  const getRegistrationFieldError = (field: string) => {
    const value = registrationFieldErrors?.[field];
    if (Array.isArray(value)) return value.join(', ');
    return typeof value === 'string' ? value : null;
  };

  const submitProgressiveRegistration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalRegistrationError(null);
    const name = registrationForm.name.trim();
    const phone = registrationForm.phone.trim();
    const email = registrationForm.email.trim();
    if (!name || (!phone && !email)) {
      setLocalRegistrationError('Completa nombre y al menos un telefono o email.');
      return;
    }
    setRegistrationStatus('saving');
    try {
      const result = await registerWidgetProfile({ name, phone: phone || null, email: email || null });
      if (result?.status === 'verification_required') {
        setRegistrationStatus('verification_required');
      } else {
        setRegistrationStatus('saved');
      }
    } catch {
      setRegistrationStatus('idle');
    }
  };

  return (
    <motion.div
      className="flex flex-col gap-6 md:gap-8 max-w-7xl mx-auto p-4"
      initial="hidden"
      animate="show"
      variants={containerVariants}
    >
      <motion.div className="mb-2" variants={itemVariants}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              {user?.name ? `Hola, ${user.name}` : 'Hola, bienvenido'}
            </h1>
            <p className="text-muted-foreground mt-1">
              Historial y acciones publicadas para esta sesion.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="text-muted-foreground hover:text-primary"
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Actualizar
          </Button>
        </div>
      </motion.div>

      {publicProfile.canRegister && !user ? (
        <motion.div variants={itemVariants}>
          <SummaryCard
            title="Guardar seguimiento"
            icon={<UserRound className="h-5 w-5 text-primary" />}
            className="border-primary/20 bg-primary/5"
          >
            <form className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={submitProgressiveRegistration}>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Nombre</span>
                <input
                  value={registrationForm.name}
                  onChange={(event) => setRegistrationForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  autoComplete="name"
                />
                {getRegistrationFieldError('name') ? (
                  <span className="text-xs text-destructive">{getRegistrationFieldError('name')}</span>
                ) : null}
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Telefono</span>
                <input
                  value={registrationForm.phone}
                  onChange={(event) => setRegistrationForm((current) => ({ ...current, phone: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  autoComplete="tel"
                />
                {getRegistrationFieldError('phone') ? (
                  <span className="text-xs text-destructive">{getRegistrationFieldError('phone')}</span>
                ) : null}
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Email</span>
                <input
                  value={registrationForm.email}
                  onChange={(event) => setRegistrationForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  autoComplete="email"
                  type="email"
                />
                {getRegistrationFieldError('email') || getRegistrationFieldError('email_or_phone') ? (
                  <span className="text-xs text-destructive">
                    {getRegistrationFieldError('email') || getRegistrationFieldError('email_or_phone')}
                  </span>
                ) : null}
              </label>
              <div className="flex items-end">
                <Button type="submit" disabled={registrationStatus === 'saving'} className="w-full">
                  {registrationStatus === 'saving' ? 'Guardando' : 'Vincular'}
                </Button>
              </div>
            </form>
            {localRegistrationError ? <p className="mt-3 text-sm text-destructive">{localRegistrationError}</p> : null}
            {registrationStatus === 'saved' ? (
              <p className="mt-3 text-sm text-green-700">Listo. Refrescamos tu historial y tus datos quedan vinculados.</p>
            ) : null}
            {registrationStatus === 'verification_required' ? (
              <p className="mt-3 text-sm text-amber-700">Ese email necesita verificacion antes de vincular la cuenta.</p>
            ) : null}
          </SummaryCard>
        </motion.div>
      ) : null}

      {(catalogEnabled || historyEnabled) ? (
        <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-4" variants={itemVariants}>
          {catalogEnabled ? (
            <Button
              size="lg"
              className="w-full py-8 text-lg shadow-sm hover:shadow-md transition-all h-auto flex flex-col items-center gap-2"
              onClick={() => navigate(buildTenantPath('/portal/catalogo', currentSlug))}
            >
              {isMunicipio ? <ClipboardList className="h-6 w-6" /> : <ShoppingBag className="h-6 w-6" />}
              <span>{actionLabels.catalog || commerceSession?.catalog?.cta_label || commerceSession?.catalog?.label || (isMunicipio ? 'Ver tramites' : 'Ver catalogo')}</span>
            </Button>
          ) : null}
          {historyEnabled ? (
            <Button
              size="lg"
              variant="outline"
              className="w-full py-8 text-lg shadow-sm hover:shadow-md transition-all h-auto flex flex-col items-center gap-2 border-dashed border-2"
              onClick={() => navigate(buildTenantPath(isMunicipio ? '/portal/reclamos' : '/portal/pedidos', currentSlug))}
            >
              <PlusCircle className="h-6 w-6" />
              <span>{actionLabels.history || commerceSession?.history?.cta_label || commerceSession?.history?.label || 'Ver seguimiento'}</span>
            </Button>
          ) : null}
        </motion.div>
      ) : null}


      {(bundleHighlights.length > 0 || bundleQuickActions.length > 0 || bundleModules.length > 0) && (
        <motion.div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]" variants={itemVariants}>
          <SummaryCard
            title="Resumen premium"
            icon={<Sparkles className="h-5 w-5 text-primary" />}
            className="h-full"
          >
            <div className="space-y-4">
                  {bundleHighlights.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {bundleHighlights.slice(0, 4).map((item, index) => (
                    item.title || item.label || item.name ? (
                      <div key={`${item.title || item.label || 'highlight'}-${index}`} className="rounded-xl border border-border bg-muted/20 p-3">
                        <p className="text-sm font-semibold text-foreground">{String(item.title || item.label || item.name)}</p>
                        {(item.description || item.summary) ? <p className="mt-1 text-xs text-muted-foreground">{String(item.description || item.summary)}</p> : null}
                      </div>
                    ) : null
                  ))}
                </div>
              ) : null}
              {bundleModules.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {bundleModules.slice(0, 6).map((item, index) => (
                    item.title || item.label || item.name ? (
                      <div key={`${item.id || item.title || 'module'}-${index}`} className="rounded-xl border border-border bg-background/80 p-3">
                        <p className="text-sm font-semibold text-foreground">{String(item.title || item.label || item.name)}</p>
                        {(item.description || item.summary) ? <p className="mt-1 text-xs text-muted-foreground">{String(item.description || item.summary)}</p> : null}
                      </div>
                    ) : null
                  ))}
                </div>
              ) : null}
            </div>
          </SummaryCard>
          {bundleQuickActions.length > 0 ? (
            <SummaryCard
              title="Acciones rapidas"
              icon={<PlusCircle className="h-5 w-5 text-primary" />}
            >
              <div className="space-y-3">
                {bundleQuickActions.slice(0, 5).map((item, index) => (
                  item.label || item.title || item.name ? (
                    <button
                      key={`${item.id || item.label || 'action'}-${index}`}
                      type="button"
                      onClick={() => {
                        const href = typeof item.href === 'string' ? item.href : typeof item.path === 'string' ? item.path : null;
                        if (href) navigate(buildTenantPath(href, currentSlug));
                      }}
                      className="w-full rounded-xl border border-border bg-background/80 p-3 text-left transition hover:border-primary/30 hover:bg-primary/5"
                    >
                      <p className="text-sm font-semibold text-foreground">{String(item.label || item.title || item.name)}</p>
                      {(item.description || item.summary) ? <p className="mt-1 text-xs text-muted-foreground">{String(item.description || item.summary)}</p> : null}
                    </button>
                  ) : null
                ))}
              </div>
            </SummaryCard>
          ) : null}
        </motion.div>
      )}

      {(bundleOrders.length > 0 || bundleClaims.length > 0 || bundlePromotions.length > 0) && (
        <motion.div className="grid gap-6 md:grid-cols-3" variants={itemVariants}>
          <SummaryCard title="Compras" icon={<ShoppingBag className="h-5 w-5" />} className="h-full">
            <div className="text-3xl font-bold text-foreground">{bundle?.orders?.active_count ?? bundleOrders.length}</div>
            <p className="mt-1 text-sm text-muted-foreground">activas</p>
            {bundle?.orders?.total_spent !== undefined ? <p className="mt-3 text-xs text-muted-foreground">Total gastado: {String(bundle.orders.total_spent)}</p> : null}
          </SummaryCard>
          <SummaryCard title="Reclamos" icon={<ClipboardList className="h-5 w-5" />} className="h-full">
            <div className="text-3xl font-bold text-foreground">{bundle?.claims?.open_count ?? bundleClaims.length}</div>
            <p className="mt-1 text-sm text-muted-foreground">abiertos</p>
          </SummaryCard>
          <SummaryCard title="Promociones" icon={<TicketPercent className="h-5 w-5" />} className="h-full">
            <div className="text-3xl font-bold text-foreground">{bundlePromotions.length}</div>
            <p className="mt-1 text-sm text-muted-foreground">disponibles</p>
          </SummaryCard>
        </motion.div>
      )}

      <motion.div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" variants={containerVariants}>

        {/* Recent Activity Card - Spans 2 cols on large screens */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
            <SummaryCard
              title={isMunicipio ? "Tus reclamos y solicitudes" : "Actividad reciente"}
              icon={<History className="h-5 w-5" />}
              ctaText={activities.length > 0 ? (isMunicipio ? "Ver historial completo" : "Ver todos mis pedidos") : undefined}
              onCtaClick={() => navigate(buildTenantPath(isMunicipio ? '/portal/reclamos' : '/portal/pedidos', currentSlug))}
              className="h-full"
            >
              {activities.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {activities.slice(0, 4).map((activity) => {
                      const activityBody = (
                        <>
                          <div className="flex items-center gap-3">
                             <div className={cn("w-2 h-2 rounded-full flex-shrink-0",
                                activity.statusType === 'success' ? 'bg-green-500' :
                                activity.statusType === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                             )} />
                             <div>
                                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                    {activity.description}
                                </p>
                                {(activity.type || activity.date) ? (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    {[activity.type, activity.date].filter(Boolean).join(' - ')}
                                  </p>
                                ) : null}
                             </div>
                          </div>
                          {activity.status && (
                            <Badge variant="outline" className={cn('text-xs capitalize', getBadgeClasses(activity.statusType))}>
                              {activity.status}
                            </Badge>
                          )}
                        </>
                      );
                      return (
                        <motion.li
                          key={activity.id}
                          className="py-3 px-1 hover:bg-muted/50 transition-colors -mx-1 rounded-sm"
                        >
                          {activity.link ? (
                            <Link to={buildTenantPath(activity.link, currentSlug)} className="flex justify-between items-center group">
                              {activityBody}
                            </Link>
                          ) : (
                            <div className="flex justify-between items-center group">
                              {activityBody}
                            </div>
                          )}
                        </motion.li>
                      );
                    })}
                  </ul>
              ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground p-4 bg-muted/20 rounded-lg border border-dashed">
                      <p className="text-sm">Todavia no hay actividad registrada para esta cuenta.</p>
                  </div>
              )}
            </SummaryCard>
        </motion.div>

        {/* Notifications / News Column */}
        <motion.div variants={itemVariants} className="flex flex-col gap-6">

            {/* Notifications Widget */}
            {notifications.length > 0 && (
                <SummaryCard
                title="Avisos"
                icon={<BellRing className="h-5 w-5 text-primary" />}
                ctaText="Ver todo"
                onCtaClick={() => navigate(buildTenantPath('/portal/noticias', currentSlug))}
                >
                <div className="space-y-3">
                    {notifications.slice(0, 3).map((notification) => (
                    <div key={notification.id} className="p-3 rounded-lg bg-accent/50 border border-border">
                        <div className="flex justify-between items-start mb-1">
                            <h5 className="text-sm font-semibold">{notification.title}</h5>
                            {notification.severity === 'warning' && <span className="h-2 w-2 rounded-full bg-yellow-500" />}
                            {notification.severity === 'error' && <span className="h-2 w-2 rounded-full bg-red-500" />}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{notification.message}</p>
                        {notification.actionHref && (
                            <Link to={buildTenantPath(notification.actionHref, currentSlug)} className="text-xs font-medium text-primary hover:underline">
                                {notification.actionLabel || "Ver mas"} &rarr;
                            </Link>
                        )}
                    </div>
                    ))}
                </div>
                </SummaryCard>
            )}

            {/* Participation / Points Stats */}
            {loyaltySummary && (isPyme || hasParticipationMetrics) ? (
            <SummaryCard
                title={isPyme ? "Tu Nivel" : "Tu Impacto"}
                icon={<Sparkles className="h-5 w-5 text-yellow-500" />}
                className="flex-1"
            >
                 <div className="text-center py-4">
                    {isPyme ? (
                        <>
                            <div className="text-4xl font-bold text-primary mb-1">{loyaltySummary.points}</div>
                            <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Puntos Acumulados</div>
                            <div className="mt-4 pt-4 border-t w-full">
                                <Link to={buildTenantPath('/portal/beneficios', currentSlug)} className="text-sm text-primary hover:underline">
                                    Ver catalogo de premios
                                </Link>
                            </div>
                        </>
                    ) : (
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="p-2 bg-muted/30 rounded-lg">
                                <div className="text-2xl font-bold">{loyaltySummary.surveysCompleted}</div>
                                <div className="text-xs text-muted-foreground">Encuestas</div>
                            </div>
                            <div className="p-2 bg-muted/30 rounded-lg">
                                <div className="text-2xl font-bold">{loyaltySummary.suggestionsShared}</div>
                                <div className="text-xs text-muted-foreground">Ideas</div>
                            </div>
                        </div>
                    )}
                 </div>
            </SummaryCard>
            ) : null}

        </motion.div>
      </motion.div>

      {/* Featured News / Benefits Row */}
      <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" variants={containerVariants}>
            {/* Surveys Teaser */}
            {pendingSurveys.length > 0 && (
                <motion.div variants={itemVariants}>
                    <SummaryCard title="Encuestas Pendientes" icon={<MessageSquareQuote className="h-5 w-5" />}>
                        <div className="bg-primary/5 p-4 rounded-lg border border-primary/10">
                            <h4 className="font-semibold text-primary mb-2">{pendingSurveys[0].title}</h4>
                            <p className="text-xs text-muted-foreground mb-4">Tu opinion ayuda a mejorar. Participa cuando la organizacion tenga encuestas activas.</p>
                            {pendingSurveys[0].link ? (
                              <Button size="sm" className="w-full" onClick={() => navigate(buildTenantPath(pendingSurveys[0].link!, currentSlug))}>
                                  Responder encuesta
                              </Button>
                            ) : null}
                        </div>
                    </SummaryCard>
                </motion.div>
            )}

            {/* News Teaser */}
            {featuredNews.length > 0 && (
                <motion.div variants={itemVariants} className="lg:col-span-2">
                    <SummaryCard
                        title="Novedades destacadas"
                        icon={<Newspaper className="h-5 w-5" />}
                        ctaText="Leer todas las noticias"
                        onCtaClick={() => navigate(buildTenantPath('/portal/noticias', currentSlug))}
                    >
                         <div className="grid sm:grid-cols-2 gap-4">
                            {featuredNews.slice(0, 2).map((news) => {
                              const newsCard = (
                                    <div className="aspect-video w-full bg-muted relative">
                                        {news.coverUrl ? (
                                            <img src={news.coverUrl} alt={news.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                <ImageOff className="h-8 w-8 opacity-20" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                        <div className="absolute bottom-0 left-0 p-3 text-white">
                                            <h4 className="font-semibold text-sm line-clamp-2 leading-snug text-shadow-sm">{news.title}</h4>
                                            {news.date ? <span className="text-xs opacity-80 mt-1 block">{news.date}</span> : null}
                                        </div>
                                    </div>
                              );
                              return news.link ? (
                                <Link key={news.id} to={buildTenantPath(news.link, currentSlug)} className="group block relative overflow-hidden rounded-lg border hover:border-primary/50 transition-colors">
                                  {newsCard}
                                </Link>
                              ) : (
                                <div key={news.id} className="group block relative overflow-hidden rounded-lg border">
                                  {newsCard}
                                </div>
                              );
                            })}
                         </div>
                    </SummaryCard>
                </motion.div>
            )}
      </motion.div>
    </motion.div>
  );
};

export default UserDashboardPage;
