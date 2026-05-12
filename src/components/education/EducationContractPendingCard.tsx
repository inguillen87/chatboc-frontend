import React from 'react';
import { CheckCircle2, ListChecks } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface EducationContractPendingCardProps {
  title: string;
  description: string;
  endpoints: string[];
  blockers?: string[];
}

export default function EducationContractPendingCard({
  title,
  description,
  endpoints,
  blockers = [],
}: EducationContractPendingCardProps) {
  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Badge variant="secondary">
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
          Pantalla lista
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <ListChecks className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Configuracion pendiente</h3>
              <p className="text-sm text-muted-foreground">
                La pantalla esta preparada para mostrar informacion cuando la institucion publique estos datos.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datos previstos</p>
            <p className="text-sm text-muted-foreground">
              {endpoints.length > 0
                ? "Cuando se active, esta seccion mostrara informacion y acciones en el mismo lugar."
                : "Esta seccion se completara cuando haya informacion disponible."}
            </p>
          </div>

          {blockers.length ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Para completar</p>
              <div className="space-y-2 text-sm text-muted-foreground">
                {blockers.map((blocker) => (
                  <p key={blocker}>{blocker}</p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
