import React from 'react';
import { Clock3, ListChecks } from 'lucide-react';

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
          <Clock3 className="mr-1 h-3.5 w-3.5" />
          Integración pendiente
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <ListChecks className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Funcionalidad no habilitada</h3>
              <p className="text-sm text-muted-foreground">
                Todavía no hay un contrato operativo completo para esta sección. No mostramos datos simulados ni
                acciones que el backend no pueda ejecutar.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Datos previstos</p>
            <p className="text-sm text-muted-foreground">
              {endpoints.length > 0
                ? "Se habilitará cuando estos contratos estén desplegados, autorizados y verificados."
                : "Se habilitará cuando exista información operativa verificada."}
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
