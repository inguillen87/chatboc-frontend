import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import { TenantShell } from '@/components/tenant/TenantShell';
import { listTenantNews } from '@/api/tenant';
import { useTenant } from '@/context/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getErrorMessage } from '@/utils/api';
import { ViewState } from '@/components/app-shell/ViewState';
import { queryKeys } from '@/lib/queryKeys';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Badge } from '@/components/ui/badge';
import type { TenantNewsItem } from '@/types/tenant';

const formatDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "EEEE d 'de' MMMM yyyy", { locale: es });
};

const TenantNewsPage = () => {
  const params = useParams<{ tenant: string }>();
  const { tenant, currentSlug } = useTenant();

  const slug = useMemo(() => {
    const fromContext = tenant?.slug ?? currentSlug;
    if (fromContext && fromContext.trim()) return fromContext.trim();
    if (params.tenant && params.tenant.trim()) return params.tenant.trim();
    return '';
  }, [currentSlug, params.tenant, tenant?.slug]);

  const newsQuery = useQuery<TenantNewsItem[]>({
    queryKey: queryKeys.tenant.news(slug, 'full'),
    enabled: Boolean(slug),
    queryFn: () => listTenantNews(slug),
    staleTime: 1000 * 60 * 5,
  });

  const { isOnline } = useNetworkStatus();
  const isStale = newsQuery.isSuccess && newsQuery.isFetching;

  return (
    <TenantShell>
      {!slug ? (
        <Card>
          <CardHeader>
            <CardTitle>Seleccioná un espacio</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Elegí un espacio desde el encabezado para ver todas las noticias públicas disponibles.
          </CardContent>
        </Card>
      ) : !isOnline && !newsQuery.data ? (
        <ViewState
          status="offline"
          title="Sin conexión para consultar noticias"
          description="Revisá tu conexión y reintentá."
        />
      ) : newsQuery.isLoading ? (
        <ViewState status="loading" title="Cargando noticias" />
      ) : newsQuery.error ? (
        <ViewState
          status="error"
          title="No pudimos cargar las noticias"
          description={getErrorMessage(newsQuery.error)}
        />
      ) : newsQuery.data && newsQuery.data.length ? (
        <div className="space-y-6">
          {newsQuery.data.map((item) => (
            <article key={String(item.id)} className="rounded-3xl border bg-background/80 shadow-sm">
              <CardHeader className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {formatDate(item.publicado_at) ? (
                    <Badge variant="secondary">{formatDate(item.publicado_at)}</Badge>
                  ) : null}
                </div>
                <CardTitle className="text-2xl leading-tight">{item.titulo}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {item.cover_url ? (
                  <div className="overflow-hidden rounded-2xl border bg-muted/30">
                    <img
                      src={item.cover_url}
                      alt={`Imagen ilustrativa de ${item.titulo}`}
                      className="h-64 w-full object-cover"
                    />
                  </div>
                ) : null}
                {item.resumen ? (
                  <p className="text-base text-muted-foreground">{item.resumen}</p>
                ) : null}
                {item.body ? (
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{item.body}</p>
                ) : null}
              </CardContent>
            </article>
          ))}
        </div>
      ) : (
        <ViewState
          status={isStale ? 'stale' : 'empty'}
          title={isStale ? 'Actualizando novedades' : 'No hay noticias publicadas'}
          description={isStale ? 'Se muestran datos previos mientras se actualiza la información.' : 'Este espacio todavía no compartió novedades públicas.'}
        />
      )}
    </TenantShell>
  );
};

export default TenantNewsPage;
