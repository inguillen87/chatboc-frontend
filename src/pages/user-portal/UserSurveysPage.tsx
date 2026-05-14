import React, { useMemo } from 'react';
import { ClipboardList, MessageSquareQuote } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useTenant } from '@/context/TenantContext';
import { usePortalContent } from '@/hooks/usePortalContent';
import { buildTenantPath } from '@/utils/tenantPaths';

const UserSurveysPage = () => {
  const { currentSlug } = useTenant();
  const { content, bundle, isLoading, error } = usePortalContent();
  const loginPath = useMemo(() => buildTenantPath('/login', currentSlug ?? undefined), [currentSlug]);
  const surveys = content.surveys ?? [];
  const suggestions = Array.isArray(bundle?.suggestions?.items) ? bundle.suggestions.items : [];
  const summary = content.loyaltySummary;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Encuestas y participacion</h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-3xl">
            Respuestas, sugerencias y reclamos vinculados al tenant actual.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={loginPath}>Iniciar sesion</a>
        </Button>
      </div>

      {summary?.hasParticipationMetrics ? (
        <Card className="border border-muted/70 shadow-sm">
          <CardHeader>
            <CardTitle>Resumen de participacion</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="p-3 rounded-lg bg-muted/40 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Encuestas completadas</span>
              <span className="text-2xl font-semibold">{summary.surveysCompleted}</span>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Sugerencias enviadas</span>
              <span className="text-2xl font-semibold">{summary.suggestionsShared}</span>
            </div>
            <div className="p-3 rounded-lg bg-muted/40 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Reclamos registrados</span>
              <span className="text-2xl font-semibold">{summary.claimsFiled}</span>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            {error ? 'No se pudieron cargar todos los datos de participacion.' : 'Datos entregados por el portal del tenant.'}
          </CardFooter>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card/80 border border-muted/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareQuote className="h-5 w-5 text-primary" />
              Encuestas pendientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Cargando encuestas...</p>
            ) : surveys.length > 0 ? (
              surveys.map((survey) => (
                <div key={survey.id} className="p-3 rounded-lg border border-muted/70 bg-muted/40">
                  <p className="text-sm font-semibold text-foreground">{survey.title}</p>
                  {survey.link ? (
                    <Button asChild size="sm" className="mt-2">
                      <a href={buildTenantPath(survey.link, currentSlug)}>Responder</a>
                    </Button>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No hay encuestas pendientes publicadas para este usuario.</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/80 border border-muted/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Sugerencias y reclamos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestions.length > 0 ? (
              suggestions.map((item, index) => {
                const record = item as Record<string, unknown>;
                const rawTitle = record.title || record.label || record.name;
                if (!rawTitle) return null;
                const title = String(rawTitle);
                const status = record.status ? String(record.status) : null;
                const impact = record.impact ? String(record.impact) : null;
                return (
                  <div key={String(record.id || title || index)} className="p-3 rounded-lg border border-muted/70 bg-muted/40">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">{title}</p>
                      {status ? <span className="text-xs text-muted-foreground">{status}</span> : null}
                    </div>
                    {impact ? <p className="text-xs text-muted-foreground">Impacto: {impact}</p> : null}
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No hay sugerencias o reclamos recientes publicados para este usuario.</p>
            )}
          </CardContent>
          <Separator />
          <CardFooter className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>Inicia sesion para vincular tus respuestas.</span>
            <Button asChild size="sm">
              <a href={loginPath}>Ir a iniciar sesion</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default UserSurveysPage;
