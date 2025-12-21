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
        return 'bg-green-500/15 text-green-700 hover:bg-green-500/25 border-green-200';
      case 'warning':
      case 'en revisión':
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

  const loyaltySummary = useMemo(
    () => content.loyaltySummary ?? getDemoLoyaltySummary(),
    [content],
  );

  // Safe fallbacks in case API returns nulls
  const activities = content.activities ?? [];
  const featuredNews = content.news ?? [];
  const activeBenefits = (content.catalog ?? []).filter((item) => item.category === 'beneficios');
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
      className="flex flex-col gap-6 md:gap-8 max-w-7xl mx-auto p-4"
      initial="hidden"
      animate="show"
      variants={containerVariants}
    >
      <motion.div className="mb-2" variants={itemVariants}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
              {user?.name ? `¡Hola, ${user.name}!` : '¡Hola, bienvenido!'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {isMunicipio
                ? 'Gestioná tus trámites, reclamos y participá en tu comunidad.'
                : 'Tu panel de cliente: seguí tus pedidos y descubrí beneficios.'}
            </p>
            {isDemo && (
              <div className="mt-3 inline-flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                <Sparkles className="h-3.5 w-3.5" /> Estás viendo datos de demostración
              </div>
            )}
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

      {/* Primary Actions Grid */}
      <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-4" variants={itemVariants}>
        {isPyme && (
            <Button
              size="lg"
              className="w-full py-8 text-lg shadow-sm hover:shadow-md transition-all h-auto flex flex-col items-center gap-2"
              onClick={() => navigate(buildTenantPath('/portal/catalogo', currentSlug))}
            >
              <ShoppingBag className="h-6 w-6" />
              <span>Ver Catálogo</span>
            </Button>
        )}
        {isMunicipio && (
            <Button
              size="lg"
              className="w-full py-8 text-lg shadow-sm hover:shadow-md transition-all h-auto flex flex-col items-center gap-2"
              onClick={() => navigate(buildTenantPath('/portal/tramites', currentSlug))}
            >
              <ClipboardList className="h-6 w-6" />
              <span>Iniciar Trámite</span>
            </Button>
        )}

        <Button
          size="lg"
          variant="outline"
          className="w-full py-8 text-lg shadow-sm hover:shadow-md transition-all h-auto flex flex-col items-center gap-2 border-dashed border-2"
          onClick={() => navigate(buildTenantPath('/reclamos/nuevo', currentSlug))}
        >
          <PlusCircle className="h-6 w-6" />
          <span>{isMunicipio ? 'Nuevo Reclamo' : 'Nueva Consulta'}</span>
        </Button>
      </motion.div>

      <motion.div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" variants={containerVariants}>

        {/* Recent Activity Card - Spans 2 cols on large screens */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
            <SummaryCard
              title={isMunicipio ? "Tus Reclamos y Solicitudes" : "Actividad Reciente"}
              icon={<History className="h-5 w-5" />}
              ctaText={isMunicipio ? "Ver historial completo" : "Ver todos mis pedidos"}
              onCtaClick={() => navigate(buildTenantPath(isMunicipio ? '/portal/reclamos' : '/portal/pedidos', currentSlug))}
              className="h-full"
            >
              {activities.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {activities.slice(0, 4).map((activity) => (
                      <motion.li
                        key={activity.id}
                        className="py-3 px-1 hover:bg-muted/50 transition-colors -mx-1 rounded-sm"
                      >
                        <Link to={buildTenantPath(activity.link ?? '/portal/pedidos', currentSlug)} className="flex justify-between items-center group">
                          <div className="flex items-center gap-3">
                             <div className={cn("w-2 h-2 rounded-full flex-shrink-0",
                                activity.statusType === 'success' ? 'bg-green-500' :
                                activity.statusType === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                             )} />
                             <div>
                                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                    {activity.description}
                                </p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  {activity.type} · {activity.date}
                                </p>
                             </div>
                          </div>
                          {activity.status && (
                            <Badge variant="outline" className={cn('text-xs capitalize', getBadgeClasses(activity.statusType))}>
                              {activity.status}
                            </Badge>
                          )}
                        </Link>
                      </motion.li>
                    ))}
                  </ul>
              ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-center text-muted-foreground p-4 bg-muted/20 rounded-lg border border-dashed">
                      <p className="text-sm">No tienes actividad reciente.</p>
                      {isDemo && <p className="text-xs mt-2 max-w-xs">Interactuá con el Chatbot o creá un pedido para ver actividad aquí.</p>}
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
                                {notification.actionLabel || "Ver más"} &rarr;
                            </Link>
                        )}
                    </div>
                    ))}
                </div>
                </SummaryCard>
            )}

            {/* Participation / Points Stats */}
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
                                    Ver catálogo de premios
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
                            <p className="text-xs text-muted-foreground mb-4">Tu opinión nos ayuda a mejorar. Participá y sumá puntos.</p>
                            <Button size="sm" className="w-full" onClick={() => navigate(buildTenantPath(pendingSurveys[0].link || '/portal/encuestas', currentSlug))}>
                                Responder Encuesta
                            </Button>
                        </div>
                    </SummaryCard>
                </motion.div>
            )}

            {/* News Teaser */}
            {featuredNews.length > 0 && (
                <motion.div variants={itemVariants} className="lg:col-span-2">
                    <SummaryCard
                        title="Novedades Destacadas"
                        icon={<Newspaper className="h-5 w-5" />}
                        ctaText="Leer todas las noticias"
                        onCtaClick={() => navigate(buildTenantPath('/portal/noticias', currentSlug))}
                    >
                         <div className="grid sm:grid-cols-2 gap-4">
                            {featuredNews.slice(0, 2).map((news) => (
                                <Link key={news.id} to={buildTenantPath(news.link ?? '/portal/noticias', currentSlug)} className="group block relative overflow-hidden rounded-lg border hover:border-primary/50 transition-colors">
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
                                            <span className="text-xs opacity-80 mt-1 block">{news.date}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                         </div>
                    </SummaryCard>
                </motion.div>
            )}
      </motion.div>
    </motion.div>
  );
};

export default UserDashboardPage;
