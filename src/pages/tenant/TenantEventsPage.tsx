import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { TenantShell } from '@/components/tenant/TenantShell';
import { listTenantEvents } from '@/api/tenant';
import { useTenant } from '@/context/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { getErrorMessage } from '@/utils/api';
import type { TenantEventItem } from '@/types/tenant';

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "EEEE d 'de' MMMM HH:mm", { locale: es });
};

const TenantEventsPage = () => {
  const params = useParams<{ tenant: string }>();
  const { tenant, currentSlug } = useTenant();

  const slug = useMemo(() => {
    const fromContext = tenant?.slug ?? currentSlug;
    if (fromContext && fromContext.trim()) return fromContext.trim();
    if (params.tenant && params.tenant.trim()) return params.tenant.trim();
    return '';
  }, [currentSlug, params.tenant, tenant?.slug]);

  const eventsQuery = useQuery<TenantEventItem[]>({
    queryKey: ['tenant-events', slug, 'full'],
    enabled: Boolean(slug),
    queryFn: () => listTenantEvents(slug),
    staleTime: 1000 * 60 * 5,
  });

  return (
    <TenantShell>
      {!slug ? (
        <Card>
          <CardHeader>
            <CardTitle>Seleccioná un espacio</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Elegí un espacio para conocer la agenda pública de actividades y eventos.
          </CardContent>
        </Card>
      ) : eventsQuery.isLoading ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-3xl border bg-muted/30">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : eventsQuery.error ? (
        <Alert variant="destructive">
          <AlertTitle>No pudimos cargar los eventos</AlertTitle>
          <AlertDescription>{getErrorMessage(eventsQuery.error)}</AlertDescription>
        </Alert>
      ) : eventsQuery.data && eventsQuery.data.length ? (
        <div className="space-y-6">
          {eventsQuery.data.map((event) => (
            <article key={String(event.id)} className="rounded-3xl border bg-background/80 shadow-sm">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {formatDateTime(event.starts_at) ? (
                    <Badge variant="secondary">{formatDateTime(event.starts_at)}</Badge>
                  ) : null}
                  {event.ends_at && formatDateTime(event.ends_at) ? (
                    <Badge variant="outline">Termina: {formatDateTime(event.ends_at)}</Badge>
                  ) : null}
                </div>
                <CardTitle className="text-2xl leading-tight">{event.titulo}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {event.descripcion ? (
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                    {event.descripcion}
                  </p>
                ) : null}
                {event.lugar ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{event.lugar}</span>
                  </div>
                ) : null}
              </CardContent>
            </article>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No hay eventos programados</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Este espacio todavía no publicó actividades próximas.
          </CardContent>
        </Card>
      )}
    </TenantShell>
  );
};

export default TenantEventsPage;
