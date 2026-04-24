import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Circle,
  Layers,
  Map,
  MonitorSmartphone,
} from 'lucide-react';

import {
  blueprintHighlights,
  marketplacePillars,
  readinessChecklist,
  rolloutMilestones,
  automationTracks,
} from '@/data/marketplaceBlueprint';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const statusBadgeMap: Record<string, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
  listo: { variant: 'default', label: 'Listo' },
  'en progreso': { variant: 'secondary', label: 'En progreso' },
  pendiente: { variant: 'outline', label: 'Pendiente' },
};

const checklistBadgeMap: Record<string, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
  completado: { variant: 'default', label: 'Completado' },
  'en curso': { variant: 'secondary', label: 'En curso' },
  pendiente: { variant: 'outline', label: 'Pendiente' },
};

const calculateProgress = () => {
  const total = rolloutMilestones.length;
  const done = rolloutMilestones.filter((item) => item.status === 'listo').length;
  const partial = rolloutMilestones.filter((item) => item.status === 'en progreso').length;
  return Math.round(((done + partial * 0.5) / Math.max(total, 1)) * 100);
};

const MarketplaceBlueprintPage: React.FC = () => {
  const progressValue = calculateProgress();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
          <CardHeader className="space-y-3 pb-2">
            <Badge variant="secondary" className="w-fit">Blueprint del marketplace multitenant</Badge>
            <CardTitle className="text-3xl font-semibold leading-tight">
              Playbook listo para desplegar el mejor marketplace multitenant
            </CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              Rutas públicas por tenant, carrito aislado y checkout express listos para compartir por QR o WhatsApp.
              Este blueprint resume lo que ya está en producción y lo que sigue en el roadmap inmediato.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Avance del rollout</p>
              <Progress value={progressValue} className="h-2" />
              <p className="text-sm font-medium text-foreground">{progressValue}% completado</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border bg-background/80 p-3">
                <MonitorSmartphone className="h-10 w-10 text-primary" />
                <div className="space-y-1 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Experiencia lista</p>
                  <p className="font-semibold leading-tight">Catálogo móvil, carrito y QR por slug</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-primary" /> Catálogo público
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-primary" /> Carrito aislado
                </span>
                <span className="flex items-center gap-1">
                  <Circle className="h-4 w-4 text-amber-500" /> Checkout express
                </span>
                <span className="flex items-center gap-1">
                  <Circle className="h-4 w-4 text-muted-foreground" /> Pagos y logística
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acciones rápidas</CardTitle>
            <CardDescription>Entradas clave para probar y operar el marketplace.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button variant="outline" asChild>
              <Link to="/integracion">Panel de integraciones</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/market/demo/cart">Catálogo demo compartible</Link>
            </Button>
            <Button variant="default" asChild>
              <Link to="/municipal/categorias">Categorías y mapeos</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {marketplacePillars.map((pillar) => (
          <Card key={pillar.title} className="h-full">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <pillar.icon className="h-5 w-5" />
                </div>
                <Badge variant="outline">{pillar.badge}</Badge>
              </div>
              <CardTitle className="text-lg leading-tight">{pillar.title}</CardTitle>
              <CardDescription>{pillar.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Roadmap operativo</CardTitle>
            <CardDescription>Estado real de cada bloque del flujo público y backoffice.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-2/5">Hito</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolloutMilestones.map((item) => {
                  const badge = statusBadgeMap[item.status];
                  return (
                    <TableRow key={item.label}>
                      <TableCell className="font-medium text-foreground">{item.label}</TableCell>
                      <TableCell className="text-muted-foreground">{item.detail}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.owner}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle>Highlights listos</CardTitle>
            <CardDescription>Lo esencial para vender desde el día cero.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {blueprintHighlights.map((item) => (
              <div key={item.title} className="flex gap-3 rounded-lg border bg-background/80 p-3">
                <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Checklist de despliegue por tenant</CardTitle>
          <CardDescription>Aseguramos el enfoque white label: nada hardcodeado por municipio o pyme.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-3">
          {readinessChecklist.map((section) => (
            <div key={section.title} className="space-y-4 rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">{section.title}</p>
              </div>
              <Separator />
              <div className="space-y-3">
                {section.items.map((item) => {
                  const badge = checklistBadgeMap[item.status];
                  return (
                    <div key={item.label} className="space-y-2 rounded-lg bg-background/80 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold leading-tight text-foreground">{item.label}</p>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.impact}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orquestación y automatización</CardTitle>
          <CardDescription>
            Pilares para operar múltiples tenants sin fricción: catálogos vivos, pagos, soporte y observabilidad.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {automationTracks.map((track) => (
            <div key={track.title} className="space-y-3 rounded-xl border bg-background/80 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Map className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">{track.title}</p>
                </div>
                <Badge variant="outline">{track.focus}</Badge>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {track.actions.map((action) => (
                  <li key={action} className="flex items-start gap-2">
                    <ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
                    <span className="leading-snug">{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Checklist de riesgos y soporte</CardTitle>
          <CardDescription>Anticipamos bloqueos antes del lanzamiento masivo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {[ 
            {
              title: 'Observabilidad',
              detail: 'Alertas por error rate y latencia por slug, con reintentos automáticos en webhooks.',
            },
            {
              title: 'Experiencia móvil',
              detail: 'Flujos optimizados para usuarios que llegan por WhatsApp o QR sin pasos redundantes.',
            },
            {
              title: 'Backoffice unificado',
              detail: 'Catálogos, categorías y pedidos gestionados desde un panel único sin personalizaciones por tenant.',
            },
            {
              title: 'Seguridad y datos',
              detail: 'Aislamiento por token, auditoría de acciones y políticas anti-fraude configurables.',
            },
            {
              title: 'Postventa',
              detail: 'Encuestas y reclamos consolidados para detectar caídas de NPS y frenar churn.',
            },
            {
              title: 'Demo perpetua',
              detail: 'Catálogo demo siempre disponible para pruebas y ventas sin esperar al backend definitivo.',
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-3 rounded-xl border bg-muted/30 p-4">
              <AlertCircle className="mt-1 h-5 w-5 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default MarketplaceBlueprintPage;
