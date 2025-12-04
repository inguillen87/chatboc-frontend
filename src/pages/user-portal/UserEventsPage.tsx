import React, { useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import { buildTenantPath } from '@/utils/tenantPaths';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Calendar, Clock4, MapPin, Sparkles, Ticket } from 'lucide-react';

interface EventItem {
  id: string;
  title: string;
  date: string;
  location: string;
  status: 'inscripcion' | 'proximo' | 'finalizado';
  description: string;
  spots?: number;
  registered?: number;
}

const demoEvents: EventItem[] = [
  {
    id: 'event-001',
    title: 'Jornada de servicios y trámites en línea',
    date: '15/05/2024 · 18:00',
    location: 'Auditorio principal (online y presencial)',
    status: 'inscripcion',
    description: 'Conoce cómo seguir tus pedidos, reclamos y encuestas desde el portal ciudadano.',
    spots: 120,
    registered: 86,
  },
  {
    id: 'event-002',
    title: 'Sesión informativa: nuevas funcionalidades del portal',
    date: '28/05/2024 · 10:00',
    location: 'Transmisión en vivo',
    status: 'proximo',
    description: 'Repaso de notificaciones, historial y cupones de beneficios disponibles.',
  },
  {
    id: 'event-003',
    title: 'Foro de innovación y participación ciudadana',
    date: '02/05/2024 · 17:00',
    location: 'Centro cívico - Sala 2',
    status: 'finalizado',
    description: 'Espacio colaborativo para priorizar mejoras en atención y logística de pedidos.',
  },
];

const statusLabel: Record<EventItem['status'], string> = {
  inscripcion: 'Inscripción abierta',
  proximo: 'Próximo',
  finalizado: 'Finalizado',
};

const statusStyle: Record<EventItem['status'], string> = {
  inscripcion: 'bg-primary/10 text-primary border-primary/20',
  proximo: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  finalizado: 'bg-muted text-muted-foreground border-border',
};

const UserEventsPage = () => {
  const { currentSlug } = useTenant();
  const loginPath = useMemo(() => buildTenantPath('/login', currentSlug ?? undefined), [currentSlug]);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <span>Agenda demo sincronizada en este dispositivo</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Eventos y recordatorios</h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-3xl">
            Mantente al día con sesiones informativas, capacitaciones y actividades de participación.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={loginPath}>Iniciar sesión</a>
        </Button>
      </div>

      <div className="space-y-4">
        {demoEvents.map((event) => (
          <Card key={event.id} className="bg-card shadow-sm border border-muted/70">
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
              <div className="flex flex-col gap-2 min-w-[180px]">
                {event.status !== 'finalizado' ? (
                  <Button variant={event.status === 'inscripcion' ? 'default' : 'secondary'} className="w-full">
                    <Ticket className="h-4 w-4 mr-2" />
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
