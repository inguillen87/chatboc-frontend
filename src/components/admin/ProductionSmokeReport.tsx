import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  MapPinned,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

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
  if (normalized === "warning" || normalized === "degraded" || normalized === "needs_attention") return "warning";
  if (normalized === "fail" || normalized === "error") return "fail";
  return "unknown";
};

const toneClasses: Record<Tone, string> = {
  pass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  fail: "border-red-200 bg-red-50 text-red-700",
  unknown: "border-slate-200 bg-slate-50 text-slate-700",
};

const readyToneClasses: Record<"ready" | "needs_attention", string> = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  needs_attention: "border-amber-200 bg-amber-50 text-amber-800",
};

const formatKey = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatValue = (value: unknown): string => {
  if (typeof value === "boolean") return value ? "Si" : "No";
  if (typeof value === "number" || typeof value === "string") return String(value);
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return "sin dato";
};

const flowIconFor = (id: string) => {
  if (id.includes("claim") || id.includes("chat")) return MessageCircle;
  if (id.includes("survey")) return ClipboardCheck;
  if (id.includes("heatmap") || id.includes("map")) return MapPinned;
  return Bot;
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
  const e2e = data?.e2e_flow_readiness;
  const e2eSummary = e2e?.summary ?? {};
  const e2eTotal = asNumber(e2eSummary.total) ?? e2e?.flows.length ?? 0;
  const e2eReady = asNumber(e2eSummary.ready) ?? e2e?.flows.filter((flow) => flow.ready).length ?? 0;
  const e2eProgress = e2eTotal > 0 ? Math.round((e2eReady / e2eTotal) * 100) : 0;

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="gap-3 border-b bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-blue-200" />
            Production smoke operativo
          </CardTitle>
          <CardDescription className="text-blue-100/80">
            Verifica WhatsApp, widget, reclamos, pedidos, encuestas, colegios, mapas y live chat antes de vender o desplegar.
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
          <SmokeMetric label="Criticos" value={asNumber(summary.critical_failed) ?? criticalChecks.length} />
        </div>

        <div className="grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[8px] border bg-background p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cobertura runtime</span>
              <span className="font-semibold">{progressValue}%</span>
            </div>
            <Progress value={progressValue} className="h-2" />
          </div>
          <div className="rounded-[8px] border bg-background p-3">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">Experiencias end-to-end</span>
              <span className="font-semibold">
                {e2eReady}/{e2eTotal} listas
              </span>
            </div>
            <Progress value={e2eProgress} className="h-2" />
          </div>
        </div>

        {e2e?.flows.length ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold">Flujos criticos de producto</h3>
                <p className="text-xs text-muted-foreground">Cada tarjeta cruza contrato, webview/Meta Flow, QA y evidencia operativa.</p>
              </div>
              <StatusPill status={e2e.status} />
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {e2e.flows.map((flow) => {
                const FlowIcon = flowIconFor(flow.id);
                const status = flow.ready ? "ready" : "needs_attention";
                const evidence = Object.entries(flow.evidence ?? {}).filter(([, value]) => value !== undefined && value !== null).slice(0, 4);
                return (
                  <div key={flow.id} className="rounded-[8px] border bg-background p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-blue-50 text-blue-700">
                          <FlowIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold leading-snug">{flow.label}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{flow.surface ? formatKey(flow.surface) : flow.id}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${readyToneClasses[status]}`}>
                        {flow.ready ? "Listo" : "Atencion"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {flow.qa_scenario_id ? <span className="rounded-full bg-muted px-2.5 py-1 font-medium">QA: {flow.qa_scenario_id}</span> : null}
                      <span className="rounded-full bg-muted px-2.5 py-1 font-medium">Meta Flow: {flow.meta_flow_ready ? "listo" : "pendiente"}</span>
                      {flow.endpoint ? <span className="max-w-full truncate rounded-full bg-muted px-2.5 py-1 font-medium">{flow.endpoint}</span> : null}
                    </div>
                    {evidence.length ? (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {evidence.map(([key, value]) => (
                          <div key={key} className="rounded-[8px] border bg-muted/20 p-2">
                            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{formatKey(key)}</p>
                            <p className="mt-1 truncate text-sm font-semibold">{formatValue(value)}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {flow.next_action ? (
                      <p className="mt-3 rounded-[8px] border border-blue-100 bg-blue-50 p-2 text-xs font-medium text-blue-800">
                        Proxima prueba: {formatKey(flow.next_action)}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

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
              No hay checks publicados.
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
