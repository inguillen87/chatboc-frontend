import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bell, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import EducationShell from "@/components/education/EducationShell";
import { useEducationShellData } from "@/hooks/useEducationShellData";

export default function EducationPublicPage() {
  const { data } = useEducationShellData("public");
  const quickActions = Array.isArray(data?.quick_actions) ? data.quick_actions : [];

  return (
    <EducationShell persona="public">
      <div className="grid gap-5 lg:grid-cols-[1fr_0.72fr]">
        <div className="space-y-5">
          {data?.subtitle ? (
            <Alert className="rounded-[8px] border-primary/20 bg-primary/5">
              <Bell className="h-4 w-4" />
              <AlertTitle>Comunicado institucional</AlertTitle>
              <AlertDescription>{data.subtitle}</AlertDescription>
            </Alert>
          ) : null}

          <Card className="rounded-[8px] border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl">Accesos disponibles</CardTitle>
            </CardHeader>
            <CardContent>
              {quickActions.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {quickActions.map((action) => (
                    <Button
                      asChild
                      key={action.id}
                      variant="outline"
                      className="h-auto justify-between rounded-[8px] border-border/80 px-4 py-3 text-left hover:border-primary/40 hover:bg-primary/5"
                    >
                      <Link to={action.path}>
                        <span>{action.label}</span>
                        <ArrowRight className="ml-3 h-4 w-4" />
                      </Link>
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="rounded-[8px] border border-dashed border-border p-6 text-sm text-muted-foreground">
                  El backend todavía no informó accesos rápidos para este portal.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[8px] border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-[8px] bg-success/10 text-success">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <CardTitle className="text-xl">Información protegida</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <p>
              El portal público muestra información institucional y deriva a verificación cuando la consulta requiere vínculo familiar o datos sensibles.
            </p>
            <p>
              Las acciones visibles provienen del contrato de educación, para mantener la experiencia white label y administrable desde backend.
            </p>
          </CardContent>
        </Card>
      </div>
    </EducationShell>
  );
}
