import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ExternalLink, MapPin, RefreshCw } from 'lucide-react';

import { useTenant } from '@/context/TenantContext';
import { usePortalContent } from '@/hooks/usePortalContent';
import { buildTenantPath } from '@/utils/tenantPaths';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { HeroSkeleton, ListSkeleton } from '@/components/user-portal/shared/PortalContentSkeleton';

const statusLabel: Record<string, string> = {
  inscripcion: 'Inscripcion abierta',
  proximo: 'Proximo',
  finalizado: 'Finalizado',
};

const statusStyle: Record<string, string> = {
  inscripcion: 'bg-primary/10 text-primary border-primary/20',
  proximo: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  finalizado: 'bg-muted text-muted-foreground border-border',
};

const UserEventsPage = () => {
  const { currentSlug } = useTenant();
  const loginPath = useMemo(() => buildTenantPath('/user/login', currentSlug ?? undefined), [currentSlug]);
  const { content, isLoading, refetch } = usePortalContent();
  const events = content.events ?? [];
  const heroEvent = events[0];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Eventos y recordatorios</h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-3xl">
            Actividades publicadas para este portal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Actualizar" onClick={() => refetch()}>
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
          <Button asChild variant="outline">
            <a href={loginPath}>Iniciar sesion</a>
          </Button>
        </div>
      </div>

      {isLoading && events.length === 0 ? <HeroSkeleton /> : null}

      {heroEvent && !isLoading ? (
        <Card className="overflow-hidden border border-muted/70 shadow-sm">
          <div className="relative h-52 md:h-64 w-full overflow-hidden">
            {heroEvent.coverUrl ? (
              <img
                src={heroEvent.coverUrl}
                alt={heroEvent.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 space-y-2">
              {heroEvent.status ? (
                <Badge variant="outline" className={`rounded-full ${statusStyle[heroEvent.status] ?? 'bg-muted text-muted-foreground'}`}>
                  {statusLabel[heroEvent.status] ?? heroEvent.status}
                </Badge>
              ) : null}
              {heroEvent.date ? (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> {heroEvent.date}
                </p>
              ) : null}
              <h2 className="text-xl md:text-2xl font-semibold text-foreground drop-shadow">
                {heroEvent.title}
              </h2>
              {heroEvent.description ? (
                <p className="text-sm text-muted-foreground max-w-3xl">{heroEvent.description}</p>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="space-y-4">
        {isLoading && events.length === 0 ? <ListSkeleton items={3} /> : null}

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
                    {event.status ? (
                      <Badge variant="outline" className={`rounded-full ${statusStyle[event.status] ?? 'bg-muted text-muted-foreground'}`}>
                        {statusLabel[event.status] ?? event.status}
                      </Badge>
                    ) : null}
                    {event.date ? (
                      <>
                        <Separator orientation="vertical" className="h-4" />
                        <span className="inline-flex items-center gap-1"><Calendar className="h-4 w-4" />{event.date}</span>
                      </>
                    ) : null}
                    {event.location ? (
                      <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{event.location}</span>
                    ) : null}
                  </div>
                  <CardTitle className="text-xl leading-tight">{event.title}</CardTitle>
                  {event.description ? (
                    <p className="text-sm text-muted-foreground max-w-3xl">{event.description}</p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 min-w-[200px]">
                  {event.link ? (
                    <Button variant="secondary" className="w-full" asChild>
                      <a href={event.link}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Ver evento
                      </a>
                    </Button>
                  ) : null}
                  {event.spots && event.registered !== undefined ? (
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Cupos</span>
                        <span>{event.registered}/{event.spots}</span>
                      </div>
                      <Progress value={(event.registered / event.spots) * 100} />
                    </div>
                  ) : null}
                </div>
              </CardHeader>
            </Card>
          </motion.div>
        ))}
      </div>

      {!isLoading && events.length === 0 ? (
        <Card className="bg-muted/40">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay eventos publicados para esta sesion.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default UserEventsPage;
