import React, { useMemo } from 'react';
import { ClipboardList, MessageSquareQuote } from 'lucide-react';

import { useTenant } from '@/context/TenantContext';
import { buildTenantPath } from '@/utils/tenantPaths';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { getDemoLoyaltySummary } from '@/utils/demoLoyalty';

const pendingSurveys = [
  {
    id: 'survey-01',
    title: 'Satisfacción con la atención al vecino',
    description: 'Ayúdanos a priorizar mejoras en tiempos de respuesta y claridad de la información.',
    estimatedMinutes: 3,
  },
  {
    id: 'survey-02',
    title: 'Calificación de la experiencia de compras',
    description: 'Comparte tu opinión sobre el flujo de catálogo, carrito y seguimiento de pedidos.',
    estimatedMinutes: 4,
  },
];

const suggestions = [
  {
    id: 'sug-01',
    title: 'Canal de notificaciones unificado',
    status: 'Revisión',
    impact: 'Alto',
  },
  {
    id: 'sug-02',
    title: 'Recordatorios de vencimientos',
    status: 'En implementación',
    impact: 'Medio',
  },
];

const UserSurveysPage = () => {
  const { currentSlug } = useTenant();
  const loginPath = useMemo(() => buildTenantPath('/login', currentSlug ?? undefined), [currentSlug]);
  const summary = useMemo(() => getDemoLoyaltySummary(), []);

  const progressValue = Math.min(100, Math.round((summary.surveysCompleted / 10) * 100));

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Vista demo guardada localmente</p>
          <h1 className="text-3xl font-bold text-foreground">Encuestas y participación</h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-3xl">
            Completa encuestas, comparte sugerencias y sigue el estado de tus aportes.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={loginPath}>Iniciar sesión</a>
        </Button>
      </div>

      <Card className="border border-muted/70 shadow-sm">
        <CardHeader>
          <CardTitle>Progreso de participación</CardTitle>
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
        <CardFooter className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Objetivo: 10 encuestas</span>
            <span>{progressValue}%</span>
          </div>
          <Progress value={progressValue} />
          <p className="text-xs text-muted-foreground">Completa encuestas para sumar puntos y mejorar las notificaciones personalizadas.</p>
        </CardFooter>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card/80 border border-muted/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareQuote className="h-5 w-5 text-primary" />
              Encuestas pendientes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingSurveys.map((survey) => (
              <div key={survey.id} className="p-3 rounded-lg border border-muted/70 bg-muted/40">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{survey.title}</p>
                  <span className="text-xs text-muted-foreground">{survey.estimatedMinutes} min</span>
                </div>
                <p className="text-sm text-muted-foreground leading-snug">{survey.description}</p>
                <Button size="sm" className="mt-2">Responder</Button>
              </div>
            ))}
            {pendingSurveys.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay encuestas pendientes en este dispositivo.</p>
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
            {suggestions.map((item) => (
              <div key={item.id} className="p-3 rounded-lg border border-muted/70 bg-muted/40">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <span className="text-xs text-muted-foreground">{item.status}</span>
                </div>
                <p className="text-xs text-muted-foreground">Impacto: {item.impact}</p>
              </div>
            ))}
          </CardContent>
          <Separator />
          <CardFooter className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>Inicia sesión para vincular tus respuestas reales.</span>
            <Button asChild size="sm">
              <a href={loginPath}>Ir a iniciar sesión</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default UserSurveysPage;
