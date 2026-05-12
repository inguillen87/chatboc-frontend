import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";

import { getProductionSmokeV2, type ProductionSmokeV2 } from "@/api/v2/saas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getErrorMessage } from "@/utils/api";

type Tone = "pass" | "warning" | "fail" | "unknown";

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const readTone = (status?: string | null): Tone => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "pass" || normalized === "ok" || normalized === "ready") return "pass";
  if (normalized === "warning" || normalized === "degraded") return "warning";
  if (normalized === "fail" || normalized === "error") return "fail";
  return "unknown";
};

const toneClasses: Record<Tone, string> = {
  pass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  fail: "border-red-200 bg-red-50 text-red-700",
  unknown: "border-slate-200 bg-slate-50 text-slate-700",
};

const StatusPill = ({ status }: { status?: string }) => {
  const tone = readTone(status);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>
      {status || "unknown"}
    </span>
  );
};

interface ProductionSmokeReportProps {
  tenantSlug?: string | null;
}

export default function ProductionSmokeReport({ tenantSlug }: ProductionSmokeReportProps) {
  const [data, setData] = useState<ProductionSmokeV2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getProductionSmokeV2(tenantSlug));
    } catch (err) {
      setData(null);
      setError(getErrorMessage(err, "No se pudo cargar production smoke."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  const summary = data?.summary ?? {};
  const total = asNumber(summary.total) ?? data?.checks.length ?? 0;
  const passed = asNumber(summary.passed) ?? data?.checks.filter((check) => check.ok).length ?? 0;
  const failed = asNumber(summary.failed) ?? data?.checks.filter((check) => !check.ok).length ?? 0;
  const progressValue = total > 0 ? Math.round((passed / total) * 100) : 0;
  const statusTone = readTone(data?.status);
  const Icon = statusTone === "fail" ? ShieldAlert : statusTone === "warning" ? AlertTriangle : ShieldCheck;

  const criticalChecks = useMemo(
    () => (data?.checks ?? []).filter((check) => !check.ok || readTone(check.status) !== "pass"),
    [data?.checks],
  );

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="gap-3 border-b bg-muted/20 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-primary" />
            Production smoke
          </CardTitle>
          <CardDescription>
            Reporte interno desde platform.production_smoke.v1 para soporte y monitoreo.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={data?.status || (loading ? "loading" : "unknown")} />
          <Button type="button" size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {error ? (
          <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-4">
          <SmokeMetric label="Total" value={total} />
          <SmokeMetric label="Pass" value={passed} />
          <SmokeMetric label="Fail" value={failed} />
          <SmokeMetric label="Críticos" value={asNumber(summary.critical_failed) ?? criticalChecks.length} />
        </div>

        <div className="rounded-[8px] border bg-background p-3">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cobertura runtime</span>
            <span className="font-semibold">{progressValue}%</span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        <div className="grid gap-2">
          {(criticalChecks.length ? criticalChecks : data?.checks ?? []).slice(0, 8).map((check) => (
            <div key={check.id} className="grid gap-2 rounded-[8px] border bg-background p-3 text-sm md:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  {check.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                  <span className="truncate font-semibold">{check.id}</span>
                </div>
                {check.endpoint ? <p className="mt-1 truncate text-xs text-muted-foreground">{check.endpoint}</p> : null}
              </div>
              <StatusPill status={check.status || (check.ok ? "pass" : "fail")} />
            </div>
          ))}
          {!loading && !data?.checks.length ? (
            <div className="rounded-[8px] border border-dashed p-4 text-sm text-muted-foreground">
              No hay checks publicados por backend.
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

const SmokeMetric = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-[8px] border bg-background p-3">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-black tracking-tight">{value}</p>
  </div>
);
