import React, { useMemo } from 'react';
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
} from 'lucide-react';

import SummaryCard from '@/components/user-portal/dashboard/SummaryCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/hooks/useUser';
import { cn } from '@/lib/utils';
import { usePortalContent } from '@/hooks/usePortalContent';
import { getDemoLoyaltySummary } from '@/utils/demoLoyalty';
import { useTenant } from '@/context/TenantContext';
import { buildTenantPath } from '@/utils/tenantPaths';

const UserDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { currentSlug, tenant } = useTenant();
  const { content, isDemo, isLoading, refetch } = usePortalContent();

  const getBadgeClasses = (statusType?: string): string => {
    switch (statusType?.toLowerCase()) {
      case 'success':
      case 'confirmado':
      case 'entregado':
      case 'resuelto':
        return 'bg-success text-success-foreground border-transparent hover:bg-success/80';
      case 'warning':
      case 'en revisión':
        return 'bg-warning text-warning-foreground border-transparent hover:bg-warning/80';
      case 'info':
      case 'recibido':
      case 'en proceso':
        return 'bg-primary text-primary-foreground border-transparent hover:bg-primary/80';
      case 'error':
      case 'rechazado':
        return 'bg-destructive text-destructive-foreground border-transparent hover:bg-destructive/80';
      default:
        return 'bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80';
    }
  };

  const loyaltySummary = useMemo(
    () => content.loyaltySummary ?? getDemoLoyaltySummary(),
    [content],
  );
  const activities = content.activities ?? [];
  const featuredNews = content.news ?? [];
  const activeBenefits = content.catalog.filter((item) => item.category === 'beneficios');
  const pendingSurveys = content.surveys ?? [];
  const notifications = content.notifications ?? [];

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
  const isMunicipio = tenant?.tipo === 'municipio';
  const isPyme = !isMunicipio;

  return (
    <motion.div
      className="flex flex-col gap-6 md:gap-8"
      initial="hidden"
      animate="show"
      variants={containerVariants}
    >
      <motion.div className="mb-2" variants={itemVariants}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {user?.name ? `¡Hola, ${user.name}!` : '¡Hola!'}
            </h1>
            <p className="text-muted-foreground">
              {isMunicipio ? 'Tu portal ciudadano: gestión, noticias y servicios.' : 'Tu panel de cliente: pedidos, puntos y novedades.'}
            </p>
            {isDemo && (
              <div className="mt-2 inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 px-3 py-1 rounded-full">
                <BellRing className="h-3.5 w-3.5" /> Vista demo sincronizada localmente
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Actualizar
          </Button>
        </div>
      </motion.div>

      <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6" variants={itemVariants}>
        {isPyme && (
            <Button
              size="lg"
              className="w-full py-6 text-base shadow-md hover:shadow-lg font-medium transition-all hover:-translate-y-0.5"
              onClick={() => navigate(buildTenantPath('/portal/catalogo', currentSlug))}
            >
              <ShoppingBag className="mr-2 h-5 w-5" /> Ver Catálogo / Tienda
            </Button>
        )}
        {isMunicipio && (
            <Button
              size="lg"
              className="w-full py-6 text-base shadow-md hover:shadow-lg font-medium transition-all hover:-translate-y-0.5"
              onClick={() => navigate(buildTenantPath('/portal/tramites', currentSlug))} // Assuming /portal/tramites exists or maps to something
            >
              <ClipboardList className="mr-2 h-5 w-5" /> Iniciar Trámite
            </Button>
        )}

        <Button
          size="lg"
          variant="secondary"
          className="w-full py-6 text-base shadow-md hover:shadow-lg font-medium transition-all hover:-translate-y-0.5"
          onClick={() => navigate(buildTenantPath('/reclamos/nuevo', currentSlug))}
        >
          <PlusCircle className="mr-2 h-5 w-5" /> {isMunicipio ? 'Nuevo Reclamo' : 'Nueva Consulta'}
        </Button>
      </motion.div>

      <motion.div className="grid gap-6 md:gap-8 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3" variants={containerVariants}>
        {/* Recent Activity / Orders / Claims */}
        <motion.div variants={itemVariants} className="lg:col-span-2 xl:col-span-2">
            <SummaryCard
              title={isMunicipio ? "Tus Reclamos y Solicitudes" : "Tus Pedidos Recientes"}
              icon={<History className="h-6 w-6" />}
              ctaText={isMunicipio ? "Ver historial de reclamos" : "Ver todos mis pedidos"}
              onCtaClick={() => navigate(buildTenantPath(isMunicipio ? '/portal/reclamos' : '/portal/pedidos', currentSlug))}
            >
              {activities.length > 0 ? (
                  <ul className="space-y-0.5 -mx-2">
                    {activities.slice(0, 3).map((activity) => (
                      <motion.li
                        key={activity.id}
                        className="px-2 py-2 hover:bg-muted/50 rounded-md transition-colors"
                      >
                        <Link to={buildTenantPath(activity.link ?? '/portal/pedidos', currentSlug)} className="flex justify-between items-center w-full">
                          <div>
                            <p className="text-sm font-medium text-foreground truncate pr-2 leading-snug">{activity.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {activity.type}
                              {activity.date ? ` · ${activity.date}` : ''}
                            </p>
                          </div>
                          {activity.status && (
                            <Badge className={cn('text-xs whitespace-nowrap ml-2', getBadgeClasses(activity.statusType))}>
                              {activity.status}
                            </Badge>
                          )}
                        </Link>
                      </motion.li>
                    ))}
                  </ul>
              ) : (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                      <p>No tienes {isMunicipio ? 'reclamos' : 'pedidos'} recientes.</p>
                      {isDemo && <p className="text-xs mt-1">(En modo demo, realiza una acción en el chat para verla aquí)</p>}
                  </div>
              )}
            </SummaryCard>
        </motion.div>

        {notifications.length > 0 && (
          <motion.div variants={itemVariants}>
            <SummaryCard
              title="Notificaciones"
              icon={<BellRing className="h-6 w-6" />}
              ctaText="Centro de avisos"
              onCtaClick={() => navigate(buildTenantPath('/portal/noticias', currentSlug))}
            >
              <ul className="space-y-3 -mx-2">
                {notifications.slice(0, 3).map((notification) => (
                  <li key={notification.id} className="px-2 py-2 rounded-md bg-muted/60 dark:bg-muted/40 border border-muted/70">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground">{notification.title}</p>
                      {notification.severity && (
                        <Badge variant="secondary" className="text-[11px] capitalize">
                          {notification.severity}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-snug">{notification.message}</p>
                    {notification.actionHref && notification.actionLabel && (
                      <Button asChild size="sm" variant="link" className="px-0 h-7 text-primary">
                        <Link to={buildTenantPath(notification.actionHref, currentSlug)}>{notification.actionLabel}</Link>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </SummaryCard>
          </motion.div>
        )}

        {featuredNews.length > 0 && (
          <motion.div variants={itemVariants} className="xl:col-span-1">
            <SummaryCard
              title="Novedades y Eventos"
              icon={<Newspaper className="h-6 w-6" />}
              ctaText="Ver todas las novedades"
              onCtaClick={() => navigate(buildTenantPath('/portal/noticias', currentSlug))}
            >
              <ul className="space-y-3 -mx-2">
                {featuredNews.slice(0, 2).map((news) => (
                  <li key={news.id} className="px-2 py-2 hover:bg-muted/50 rounded-md transition-colors">
                    <Link to={buildTenantPath(news.link ?? '/portal/noticias', currentSlug)} className="group block">
                      {!news.coverUrl ? (
                        <div className="w-full h-24 bg-muted rounded-md mb-2 flex items-center justify-center group-hover:opacity-90 transition-opacity">
                          <ImageOff className="h-10 w-10 text-muted-foreground/70" />
                        </div>
                      ) : (
                        <img
                          src={news.coverUrl}
                          alt={news.title}
                          className="w-full h-24 object-cover rounded-md mb-2 group-hover:opacity-90 transition-opacity shadow-sm"
                        />
                      )}
                      <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors mb-0.5 leading-snug">
                        {news.title}
                      </h4>
                      <p className="text-xs text-muted-foreground">{news.date} - {news.category}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </SummaryCard>
          </motion.div>
        )}

        {/* Benefits Section - Primarily for Pyme/Retail */}
        {isPyme && (
            <motion.div variants={itemVariants}>
                <SummaryCard
                title="Beneficios para ti"
                icon={<TicketPercent className="h-6 w-6" />}
                ctaText="Ver todos los beneficios"
                onCtaClick={() => navigate(buildTenantPath('/portal/beneficios', currentSlug))}
                >
                {activeBenefits.length > 0 ? (
                    <ul className="space-y-3">
                        {activeBenefits.slice(0, 1).map((benefit) => (
                        <li key={benefit.id} className="p-3 bg-primary/10 border border-primary/20 rounded-md hover:shadow-md transition-shadow">
                            <Link to={buildTenantPath(benefit.id ? `/portal/beneficios/${benefit.id}` : '/portal/beneficios', currentSlug)} className="group block">
                            <h4 className="text-sm font-semibold text-primary group-hover:underline mb-0.5 leading-snug">{benefit.title}</h4>
                            <p className="text-xs text-muted-foreground">{benefit.description}</p>
                            </Link>
                        </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">No tienes beneficios activos por el momento.</p>
                )}
                </SummaryCard>
            </motion.div>
        )}

        {/* Surveys Section - Relevant for both but critical for Muni */}
        <motion.div variants={itemVariants}>
            <SummaryCard
              title="Tu opinión importa"
              icon={<MessageSquareQuote className="h-6 w-6" />}
            >
              {pendingSurveys.length > 0 ? (
                  <div className="flex flex-col items-center text-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      {pendingSurveys.length === 1
                        ? `Tienes una encuesta pendiente: "${pendingSurveys[0].title}"`
                        : `Tienes ${pendingSurveys.length} encuestas pendientes.`}
                    </p>
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => navigate(buildTenantPath(pendingSurveys[0].link ?? '/portal/encuestas', currentSlug))}
                    >
                      <ClipboardList className="mr-2 h-4 w-4" /> Responder ahora
                    </Button>
                  </div>
              ) : (
                  <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">No hay encuestas activas.</p>
                  </div>
              )}
            </SummaryCard>
        </motion.div>

        {/* Participation Stats - Adaptive columns */}
        <motion.div variants={itemVariants} className="lg:col-span-2 xl:col-span-1">
          <SummaryCard
            title="Tu participación"
            icon={<Sparkles className="h-6 w-6" />}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-2 gap-4">
              {isPyme && (
                  <div>
                    <p className="text-sm text-muted-foreground">Puntos</p>
                    <p className="text-2xl font-semibold">{loyaltySummary.points.toLocaleString()} pts</p>
                  </div>
              )}
              {isMunicipio && (
                  <div>
                    <p className="text-sm text-muted-foreground">Reclamos</p>
                    <p className="text-2xl font-semibold">{loyaltySummary.claimsFiled}</p>
                  </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Encuestas</p>
                <p className="text-2xl font-semibold">{loyaltySummary.surveysCompleted}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sugerencias</p>
                <p className="text-2xl font-semibold">{loyaltySummary.suggestionsShared}</p>
              </div>
            </div>
          </SummaryCard>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default UserDashboardPage;
