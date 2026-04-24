import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTenant } from '@/context/TenantContext';
import { buildTenantPath } from '@/utils/tenantPaths';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Calendar, Clock4, MapPin, Sparkles, Ticket, RefreshCw, MonitorPlay } from 'lucide-react';
import { usePortalContent } from '@/hooks/usePortalContent';
import { cn } from '@/lib/utils';
import { HeroSkeleton, ListSkeleton } from '@/components/user-portal/shared/PortalContentSkeleton';

const statusLabel = {
  inscripcion: 'Inscripción abierta',
  proximo: 'Próximo',
  finalizado: 'Finalizado',
} as const;

const statusStyle = {
  inscripcion: 'bg-primary/10 text-primary border-primary/20',
  proximo: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  finalizado: 'bg-muted text-muted-foreground border-border',
} as const;

const UserEventsPage = () => {
  const { currentSlug } = useTenant();
  const loginPath = useMemo(() => buildTenantPath('/login', currentSlug ?? undefined), [currentSlug]);
  const { content, isDemo, isLoading, refetch } = usePortalContent();
  const events = content.events ?? [];
  const heroEvent = events[0];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>{isDemo ? 'Agenda demo sincronizada en este dispositivo' : 'Agenda conectada a tu cuenta'}</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Eventos y recordatorios</h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-3xl">
            Mantente al día con sesiones informativas, capacitaciones y actividades de participación.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Actualizar" onClick={() => refetch()}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button asChild variant="outline">
            <a href={loginPath}>Iniciar sesión</a>
          </Button>
        </div>
      </div>

      {isLoading && events.length === 0 && <HeroSkeleton />}

      {heroEvent && !isLoading && (
        <Card className="overflow-hidden border border-muted/70 shadow-sm">
          <div className="relative h-52 md:h-64 w-full overflow-hidden">
            {heroEvent.coverUrl && (
              <img
                src={heroEvent.coverUrl}
                alt={heroEvent.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 space-y-2">
              <Badge variant="outline" className={`rounded-full ${statusStyle[heroEvent.status]}`}>
                {statusLabel[heroEvent.status]}
              </Badge>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> {heroEvent.date}
              </p>
              <h2 className="text-xl md:text-2xl font-semibold text-foreground drop-shadow">
                {heroEvent.title}
              </h2>
              <p className="text-sm text-muted-foreground max-w-3xl">
                {heroEvent.description}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {isLoading && events.length === 0 && <ListSkeleton items={3} />}

        {events.map((event) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="bg-card shadow-sm border border-muted/70">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className={`rounded-full ${statusStyle[event.status]}`}>
                      {statusLabel[event.status]}
                    </Badge>
                    <Separator orientation="vertical" className="h-4" />
                    <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" />{event.date}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{event.location}</span>
                  </div>
                  <CardTitle className="text-xl leading-tight">{event.title}</CardTitle>
                  <p className="text-sm text-muted-foreground max-w-3xl">{event.description}</p>
                </div>
                <div className="flex flex-col gap-2 min-w-[200px]">
                  {event.status !== 'finalizado' ? (
                    <Button variant={event.status === 'inscripcion' ? 'default' : 'secondary'} className="w-full">
                      {event.status === 'inscripcion' ? (
                        <Ticket className="h-4 w-4 mr-2" />
                      ) : (
                        <MonitorPlay className="h-4 w-4 mr-2" />
                      )}
                      {event.status === 'inscripcion' ? 'Inscribirme' : 'Agregar recordatorio'}
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      <Clock4 className="h-4 w-4 mr-2" />
                      Finalizado
                    </Button>
                  )}
                  {event.spots && (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Cupos</span>
                        <span>{event.registered}/{event.spots}</span>
                      </div>
                      <Progress value={(event.registered ?? 0) / event.spots * 100} />
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="bg-muted/40">
        <CardHeader>
          <CardTitle>Preferencias de agenda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 mt-0.5 text-primary" />
            <p>Recibe avisos de nuevas fechas y actualizaciones cuando inicies sesión.</p>
          </div>
          <div className="flex items-start gap-3">
            <Clock4 className="h-4 w-4 mt-0.5 text-primary" />
            <p>Configura recordatorios vía correo o push desde tu perfil.</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>Sincroniza tu cuenta para asociar tus inscripciones.</span>
          <Button asChild size="sm">
            <a href={loginPath}>Ir a iniciar sesión</a>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default UserEventsPage;
