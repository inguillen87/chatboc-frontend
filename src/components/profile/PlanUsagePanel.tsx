import { CheckCircle2, CreditCard, Gauge, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const FULL_PLAN_CHECKOUT_URL =
  "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=2c9380849763daeb0197658791ee00b1";
const PRO_PLAN_CHECKOUT_URL =
  "https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=2c9380849764e81a01976585767f0040";
const PAID_PLANS = new Set([
  "pro",
  "full",
  "enterprise",
  "premium",
  "municipio_full",
  "colegio_full",
  "pyme_full",
]);
const FREE_PLANS = new Set(["free", "gratis", "inicial"]);

interface PlanUsagePanelProps {
  canManageBilling: boolean;
  limit: number;
  percentage: number;
  plan: string;
  used: number;
}

const labelForPlan = (plan: string) => {
  const normalized = plan.trim().toLowerCase();
  if (normalized === "full") return "Plan Full";
  if (normalized === "pro") return "Plan Pro";
  if (normalized === "gratis" || normalized === "free") return "Plan Inicial";
  if (!normalized) return "Plan sin identificar";
  const readableName = normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return `Plan ${readableName}`;
};

export default function PlanUsagePanel({
  canManageBilling,
  limit,
  percentage,
  plan,
  used,
}: PlanUsagePanelProps) {
  const normalizedPlan = plan.trim().toLowerCase();
  const isPaidPlan = PAID_PLANS.has(normalizedPlan);
  const canOfferUpgrade = FREE_PLANS.has(normalizedPlan);

  return (
    <Card
      id="profile-plan-and-usage"
      tabIndex={-1}
      className="scroll-mt-28 rounded-xl border-border/70 bg-card shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <CardHeader className="space-y-3 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Plan y facturación</p>
            <CardTitle className="mt-1 text-xl">Uso de la organización</CardTitle>
          </div>
          <Badge variant={isPaidPlan ? "secondary" : "outline"} className="gap-1.5 px-2.5 py-1">
            {isPaidPlan ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : null}
            {labelForPlan(plan)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Gauge className="h-4 w-4 text-primary" />
              Consultas del período
            </span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {used} / {limit === Infinity ? "Sin límite" : limit}
            </span>
          </div>
          <Progress
            value={percentage}
            className="h-2 bg-muted [&>div]:bg-primary"
            aria-label={`${percentage.toFixed(0)}% de consultas usadas`}
          />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            El uso se actualiza automáticamente con la actividad registrada por la organización.
          </p>
        </div>

        {isPaidPlan ? (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <p className="text-sm font-semibold text-foreground">Suscripción activa</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                La renovación y el estado de la cuenta se administran desde este espacio, separados de la operación diaria.
              </p>
            </div>
          </div>
        ) : canManageBilling && canOfferUpgrade ? (
          <div className="space-y-3 rounded-xl border border-border/70 p-4">
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Opciones de actualización</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Solo un administrador de la organización puede iniciar un cambio de plan.
                </p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={() => window.open(PRO_PLAN_CHECKOUT_URL, "_blank", "noopener,noreferrer") }>
                Ver Plan Pro
              </Button>
              <Button type="button" onClick={() => window.open(FULL_PLAN_CHECKOUT_URL, "_blank", "noopener,noreferrer") }>
                Ver Plan Full
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-border/70 bg-muted/25 p-4 text-xs leading-5 text-muted-foreground">
            {canOfferUpgrade
              ? "Consultá con un administrador de la organización para gestionar el plan y la facturación."
              : "El estado de este plan necesita validación de facturación antes de habilitar cambios."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
