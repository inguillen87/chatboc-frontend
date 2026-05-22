import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MessageSquareText, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tenantService } from "@/services/tenantService";
import { getErrorMessage } from "@/utils/api";

type TechProviderContract = {
  contract_version?: string | null;
  provider?: string | null;
  state?: {
    twilio_account_sid?: string | null;
    messaging_service_sid?: string | null;
    sender_sid?: string | null;
    sender_id?: string | null;
    sender_status?: string | null;
    waba_id?: string | null;
    phone_number_id?: string | null;
    last_step?: string | null;
    updated_at?: string | null;
  } | null;
  automation?: {
    mode?: string | null;
    live_enabled?: boolean | null;
    render_env_sync_enabled?: boolean | null;
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
  voice?: {
    status?: string | null;
    twiml_app_sid?: string | null;
    voice_url?: string | null;
    fallback_url?: string | null;
    status_callback_url?: string | null;
    completion_endpoint?: string | null;
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

const extractContract = (response: any): TechProviderContract | null => {
  if (response?.contract?.contract_version) return response.contract as TechProviderContract;
  if (response?.contract_version === "twilio.tech_provider.v1") return response as TechProviderContract;
  return null;
};

const StatusPill = ({ value }: { value?: string | null }) => {
  const label = readText(value) ?? "pendiente";
  const normalized = label.toLowerCase();
  const ready = ["online", "ready", "done", "completed", "ok", "active", "sender_attached"].includes(normalized);
  const pending = ["pending", "pending_sender_registration", "pending_meta_signup"].some((item) => normalized.includes(item));
  const tone = ready
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
    : pending
      ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
      : "border-border bg-muted/30 text-muted-foreground";
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>{label}</span>;
};

export default function WhatsappTechProviderOnboarding({ tenantSlug }: { tenantSlug?: string | null }) {
  const [contract, setContract] = useState<TechProviderContract | null>(null);
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [registeringSender, setRegisteringSender] = useState(false);
  const [pollingSender, setPollingSender] = useState(false);
  const [provisioningVoice, setProvisioningVoice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true);
    setError(null);
    try {
      const response = await tenantService.getWhatsappTechProvider(tenantSlug);
      setContract(extractContract(response));
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
  const state = contract?.state ?? null;
  const voice = contract?.voice ?? null;
  const signupUrl = readText(embeddedSignup?.url, embeddedSignup?.start_url);
  const canStartSignup = envReady && readBoolean(embeddedSignup?.enabled, false) && Boolean(signupUrl);
  const canRegisterSender = envReady && Boolean(state?.waba_id && state?.phone_number_id);
  const canPollSender = envReady && Boolean(state?.sender_sid);
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
      setContract(extractContract(response));
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo preparar la activacion."));
    } finally {
      setProvisioning(false);
    }
  };

  const handleRegisterSender = async () => {
    if (!tenantSlug) return;
    setRegisteringSender(true);
    setError(null);
    try {
      const response = await tenantService.registerWhatsappSender(tenantSlug, {
        source: "tenant_panel",
      });
      setContract(extractContract(response));
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo registrar el sender de WhatsApp."));
    } finally {
      setRegisteringSender(false);
    }
  };

  const handleProvisionVoice = async () => {
    if (!tenantSlug) return;
    setProvisioningVoice(true);
    setError(null);
    try {
      const response = await tenantService.provisionWhatsappVoiceApp(tenantSlug, {
        source: "tenant_panel",
      });
      setContract(extractContract(response));
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo preparar la app de voz."));
    } finally {
      setProvisioningVoice(false);
    }
  };

  const handlePollSender = async () => {
    if (!tenantSlug) return;
    setPollingSender(true);
    setError(null);
    try {
      const response = await tenantService.refreshWhatsappSenderStatus(tenantSlug);
      setContract(extractContract(response));
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo actualizar el estado del sender."));
    } finally {
      setPollingSender(false);
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
              El cliente ve un flujo guiado en Chatboc; la plataforma prepara los pasos tecnicos y deja cada estado trazable.
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

          <div className="grid gap-3 rounded-lg border bg-background/70 p-3 text-sm md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Cuenta WhatsApp Business</p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p>WABA: <span className="font-mono text-foreground">{state?.waba_id || "pendiente"}</span></p>
                <p>Phone number ID: <span className="font-mono text-foreground">{state?.phone_number_id || "pendiente"}</span></p>
                <p>Sender: <span className="font-mono text-foreground">{state?.sender_id || "pendiente"}</span></p>
                <p>Sender SID: <span className="font-mono text-foreground">{state?.sender_sid || "pendiente"}</span></p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Estado operativo</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusPill value={state?.sender_status || contract.status} />
                <StatusPill value={voice?.status} />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Esta informacion es la que conviene mostrar en el video de Meta: cuenta conectada, sender, estado y rutas de webhook.
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-sm font-medium text-foreground">Checklist para revision de Meta</p>
            <div className="mt-2 grid gap-2 text-xs leading-5 text-muted-foreground md:grid-cols-2">
              <p>1. Iniciar registro embebido y conectar una WABA autorizada.</p>
              <p>2. Registrar sender productivo con Twilio Senders API desde Chatboc.</p>
              <p>3. Crear o revisar plantillas desde el perfil del tenant.</p>
              <p>4. Enviar y recibir un mensaje de prueba por WhatsApp.</p>
              <p>5. Mostrar estado de entrega, lectura o actividad en el panel.</p>
              <p>6. Mostrar que el cliente nunca entra a Twilio Console.</p>
            </div>
          </div>

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
            <Button type="button" variant="outline" onClick={handleRegisterSender} disabled={!canRegisterSender || registeringSender}>
              {registeringSender ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Registrar sender
            </Button>
            <Button type="button" variant="outline" onClick={handlePollSender} disabled={!canPollSender || pollingSender}>
              {pollingSender ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Actualizar estado
            </Button>
            <Button type="button" variant="outline" onClick={handleProvisionVoice} disabled={!envReady || provisioningVoice}>
              {provisioningVoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Preparar voz
            </Button>
            <Button type="button" variant="ghost" onClick={() => window.open("/perfil/plantillas-respuesta", "_self")}>
              Plantillas
            </Button>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
            <p className="font-medium text-foreground">Rutas conectadas</p>
            <p>Inbound: <span className="font-mono">/webhook/whatsapp</span></p>
            <p>Status: <span className="font-mono">/twilio/whatsapp/status</span></p>
            <p>Voz: <span className="font-mono">{voice?.voice_url || "/twilio/voice?tenant=..."}</span></p>
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
