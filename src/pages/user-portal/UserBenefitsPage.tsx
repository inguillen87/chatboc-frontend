import React, { useMemo } from 'react';
import { Gift, Medal, Star, Wallet } from 'lucide-react';

import { useTenant } from '@/context/TenantContext';
import { buildTenantPath } from '@/utils/tenantPaths';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { getDemoLoyaltySummary } from '@/utils/demoLoyalty';
import { usePortalContent } from '@/hooks/usePortalContent';

const rewards = [
  { id: 'reward-01', title: 'Envío prioritario', cost: 1200, type: 'Servicio' },
  { id: 'reward-02', title: 'Bonificación del 10% en tu próximo pedido', cost: 900, type: 'Descuento' },
  { id: 'reward-03', title: 'Atención personalizada para reclamos', cost: 650, type: 'Soporte' },
];

const perks = [
  {
    id: 'perk-01',
    title: 'Beneficios activos',
    description: 'Consulta cupones, códigos de descuento y acceso prioritario a eventos.',
    icon: <Gift className="h-5 w-5 text-primary" />,
  },
  {
    id: 'perk-02',
    title: 'Historial de canjes',
    description: 'Revisa los beneficios que ya utilizaste en este dispositivo.',
    icon: <Star className="h-5 w-5 text-primary" />,
  },
  {
    id: 'perk-03',
    title: 'Progreso de nivel',
    description: 'Suma puntos con compras, encuestas y sugerencias.',
    icon: <Medal className="h-5 w-5 text-primary" />,
  },
];

const UserBenefitsPage = () => {
  const { content } = usePortalContent();
  const summary = useMemo(() => content.loyaltySummary ?? getDemoLoyaltySummary(), [content]);
  const { currentSlug } = useTenant();
  const loginPath = useMemo(() => buildTenantPath('/login', currentSlug ?? undefined), [currentSlug]);

  const progressToNext = Math.min(100, Math.round((summary.points / 1500) * 100));

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Vista demo con puntos locales</p>
          <h1 className="text-3xl font-bold text-foreground">Beneficios y puntos</h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-3xl">
            Consulta tu saldo, canjes disponibles y próximos objetivos de participación.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href={loginPath}>Iniciar sesión</a>
        </Button>
      </div>

      <Card className="border border-muted/70 shadow-sm">
        <CardHeader>
          <CardTitle>Resumen de puntos</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Saldo actual</span>
            </div>
            <p className="text-3xl font-semibold">{summary.points.toLocaleString()} pts</p>
            <p className="text-sm text-muted-foreground">
              Incluye encuestas ({summary.surveysCompleted}), sugerencias ({summary.suggestionsShared}) y reclamos ({summary.claimsFiled}).
            </p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Objetivo próximo</span>
              <span>1500 pts</span>
            </div>
            <Progress value={progressToNext} />
            <p className="text-xs text-muted-foreground">Acumula gestiones y encuestas para desbloquear más beneficios.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card/80 border border-muted/70 shadow-sm">
          <CardHeader>
            <CardTitle>Canjes disponibles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rewards.map((reward) => (
              <div key={reward.id} className="p-3 rounded-lg border border-muted/70 bg-muted/40 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{reward.title}</p>
                  <p className="text-xs text-muted-foreground">{reward.type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-primary">{reward.cost} pts</p>
                  <Button size="sm" variant="secondary" className="mt-1">Canjear</Button>
                </div>
              </div>
            ))}
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Estos canjes son de ejemplo y se guardan solo en este navegador.
          </CardFooter>
        </Card>

        <Card className="bg-card/80 border border-muted/70 shadow-sm">
          <CardHeader>
            <CardTitle>Accesos rápidos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {perks.map((perk) => (
              <div key={perk.id} className="flex items-start gap-3">
                {perk.icon}
                <div>
                  <p className="text-sm font-semibold text-foreground">{perk.title}</p>
                  <p className="text-sm text-muted-foreground leading-snug">{perk.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
          <Separator />
          <CardFooter className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>Inicia sesión para ver tus beneficios reales.</span>
            <Button asChild size="sm">
              <a href={loginPath}>Ir a iniciar sesión</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default UserBenefitsPage;
