import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MessageSquareText, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tenantService } from "@/services/tenantService";
import { getErrorMessage } from "@/utils/api";

type TechProviderContract = {
  contract_version?: string | null;
  provider?: string | null;
  automation?: {
    mode?: string | null;
    manual_twilio_console_allowed?: boolean | null;
    customer_sees_twilio_console?: boolean | null;
    env?: {
      ready?: boolean | null;
      missing?: string[] | null;
    } | null;
  } | null;
  embedded_signup?: {
    enabled?: boolean | null;
    required_customer_action?: string | null;
    completion_endpoint?: string | null;
    url?: string | null;
    start_url?: string | null;
  } | null;
  api_workflow?: Array<Record<string, unknown>> | null;
  frontend_contract?: {
    render_as?: string | null;
    show_twilio_brand?: boolean | null;
    show_manual_console_steps?: boolean | null;
    primary_action?: string | null;
    show_phone_choice?: boolean | null;
    show_progress_steps?: boolean | null;
  } | null;
  limitations?: Array<string | Record<string, unknown>> | null;
  next_action?: string | null;
  status?: string | null;
};

const readText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
};

const readBoolean = (value: unknown, fallback = false) =>
  typeof value === "boolean" ? value : fallback;

const workflowLabel = (item: Record<string, unknown>, index: number) =>
  readText(item.label, item.title, item.name, item.id, item.key) ?? `Paso ${index + 1}`;

const workflowDetail = (item: Record<string, unknown>) =>
  readText(item.description, item.detail, item.status_label, item.status, item.next_action);

const limitationLabel = (item: string | Record<string, unknown>) =>
  typeof item === "string" ? item.trim() : readText(item.label, item.title, item.message, item.detail, item.description);

export default function WhatsappTechProviderOnboarding({ tenantSlug }: { tenantSlug?: string | null }) {
  const [contract, setContract] = useState<TechProviderContract | null>(null);
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true);
    setError(null);
    try {
      const response = await tenantService.getWhatsappTechProvider(tenantSlug);
      setContract(response);
    } catch (err) {
      setContract(null);
      setError(getErrorMessage(err, "No se pudo cargar el onboarding de WhatsApp."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [tenantSlug]);

  const envReady = contract?.automation?.env?.ready !== false;
  const missingEnv = Array.isArray(contract?.automation?.env?.missing)
    ? contract.automation.env.missing.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const workflow = Array.isArray(contract?.api_workflow) ? contract.api_workflow : [];
  const limitations = Array.isArray(contract?.limitations)
    ? contract.limitations.map(limitationLabel).filter((item): item is string => Boolean(item))
    : [];
  const embeddedSignup = contract?.embedded_signup ?? null;
  const signupUrl = readText(embeddedSignup?.url, embeddedSignup?.start_url);
  const canStartSignup = envReady && readBoolean(embeddedSignup?.enabled, false) && Boolean(signupUrl);
  const showProgressSteps = contract?.frontend_contract?.show_progress_steps !== false;

  const statusLabel = useMemo(() => {
    const status = readText(contract?.status, contract?.next_action);
    if (status === "register_whatsapp_sender_via_senders_api") return "Activacion en proceso";
    return status;
  }, [contract?.next_action, contract?.status]);

  const handleProvision = async () => {
    if (!tenantSlug) return;
    setProvisioning(true);
    setError(null);
    try {
      const response = await tenantService.provisionWhatsappTechProvider(tenantSlug, {
        source: "tenant_panel",
      });
      setContract(response);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo preparar la activacion."));
    } finally {
      setProvisioning(false);
    }
  };

  if (!tenantSlug) return null;

  return (
    <section className="rounded-xl border bg-card/70 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MessageSquareText className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">WhatsApp productivo</p>
            <h3 className="mt-1 text-lg font-semibold text-foreground">Activacion guiada por Chatboc</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              El tenant ve un flujo guiado; la plataforma automatiza subcuenta, servicio, registro embebido y sender.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Actualizar
        </Button>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !contract ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Cargando contrato de activacion...
        </div>
      ) : null}

      {contract ? (
        <div className="mt-4 space-y-4">
          {!envReady ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                <div>
                  <p className="font-medium text-foreground">Configuracion pendiente de plataforma</p>
                  {missingEnv?.length ? (
                    <p className="mt-1 text-xs text-muted-foreground">{missingEnv.join(", ")}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {showProgressSteps && workflow.length ? (
            <div className="grid gap-2 md:grid-cols-2">
              {workflow.map((item, index) => {
                const status = readText(item.status, item.state);
                const isReady = ["ready", "done", "completed", "ok", "active"].includes(String(status ?? "").toLowerCase());
                return (
                  <div key={readText(item.id, item.key, item.label) ?? index} className="rounded-lg border bg-background/70 p-3">
                    <div className="flex items-start gap-2">
                      {isReady ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                      ) : (
                        <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{workflowLabel(item, index)}</p>
                        {workflowDetail(item) ? (
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{workflowDetail(item)}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {statusLabel ? (
            <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">{statusLabel}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={handleProvision} disabled={!envReady || provisioning}>
              {provisioning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Preparar activacion
            </Button>
            {readBoolean(embeddedSignup?.enabled, false) ? (
              <Button
                type="button"
                variant="outline"
                disabled={!canStartSignup}
                onClick={() => {
                  if (signupUrl) window.open(signupUrl, "_blank", "noopener,noreferrer");
                }}
              >
                Iniciar registro embebido
              </Button>
            ) : null}
          </div>

          {limitations.length ? (
            <div className="rounded-lg border bg-background/70 p-3">
              <p className="text-sm font-medium text-foreground">Acciones que dependen del cliente o Meta</p>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                {limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
