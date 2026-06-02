import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  MessageSquareText,
  PhoneCall,
  RefreshCw,
  SendHorizontal,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { tenantService } from "@/services/tenantService";
import { cn } from "@/lib/utils";
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

const normalizeStatus = (value?: string | null) => String(value ?? "").trim().toLowerCase();

const isReadyStatus = (value?: string | null) => {
  const normalized = normalizeStatus(value);
  return (
    normalized === "ok" ||
    normalized === "ready" ||
    normalized === "done" ||
    normalized === "completed" ||
    normalized === "active" ||
    normalized === "online" ||
    normalized === "connected" ||
    normalized === "approved" ||
    normalized === "sender_attached" ||
    normalized.includes("ready") ||
    normalized.includes("connected") ||
    normalized.includes("active")
  );
};

const isPendingStatus = (value?: string | null) => {
  const normalized = normalizeStatus(value);
  return normalized.includes("pending") || normalized.includes("wait") || normalized.includes("review");
};

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
  const ready = isReadyStatus(label);
  const pending = isPendingStatus(label);
  const tone = ready
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
    : pending
      ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
      : "border-border bg-muted/30 text-muted-foreground";
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>{label}</span>;
};

const StepCard = ({
  active,
  detail,
  done,
  icon: Icon,
  label,
}: {
  active: boolean;
  detail: string;
  done: boolean;
  icon: React.ElementType;
  label: string;
}) => (
  <div
    className={cn(
      "rounded-xl border bg-background/75 p-3 transition-colors",
      done
        ? "border-emerald-500/30 bg-emerald-500/10"
        : active
          ? "border-primary/45 bg-primary/10"
          : "border-border/80",
    )}
  >
    <div className="flex items-start gap-2">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
          done
            ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-600"
            : active
              ? "border-primary/35 bg-primary/10 text-primary"
              : "border-border bg-muted/30 text-muted-foreground",
        )}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  </div>
);

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
    if (status === "register_whatsapp_sender_via_senders_api") return "Activación en proceso";
    return status;
  }, [contract?.next_action, contract?.status]);

  const hasMetaAccount = Boolean(state?.waba_id && state?.phone_number_id);
  const hasSender = Boolean(state?.sender_id || state?.sender_sid);
  const senderReady = isReadyStatus(state?.sender_status);
  const operationalReady = senderReady || normalizeStatus(contract?.status).includes("active");
  const activationSteps = [
    {
      id: "meta",
      label: "Autorizar con Meta",
      detail: "El cliente conecta su WABA desde un registro embebido y seguro.",
      done: hasMetaAccount,
      active: !hasMetaAccount,
      icon: ShieldCheck,
    },
    {
      id: "sender",
      label: "Registrar sender",
      detail: "Chatboc asocia el número aprobado a la infraestructura productiva.",
      done: hasSender,
      active: hasMetaAccount && !hasSender,
      icon: SendHorizontal,
    },
    {
      id: "test",
      label: "Probar WhatsApp",
      detail: "Se valida envío, lectura, webhook de estado y rutas de respuesta.",
      done: senderReady,
      active: hasSender && !senderReady,
      icon: MessageSquareText,
    },
    {
      id: "operate",
      label: "Operar y medir",
      detail: "El tenant queda listo para usar WhatsApp Business Platform desde Chatboc.",
      done: operationalReady,
      active: senderReady && !operationalReady,
      icon: Sparkles,
    },
  ];
  const completedSteps = activationSteps.filter((step) => step.done).length;
  const progressPercent = Math.round((completedSteps / activationSteps.length) * 100);
  const currentStep = activationSteps.find((step) => !step.done) ?? activationSteps[activationSteps.length - 1];
  const voiceReady = isReadyStatus(voice?.status);
  const hasTemplateConfig = Boolean(contract?.frontend_contract?.primary_action || workflow.length);
  const capabilityCards = [
    {
      key: "messaging",
      label: "whatsapp_business_messaging",
      detail: "Enviar, recibir y medir conversaciones operativas por WhatsApp.",
    },
    {
      key: "management",
      label: "whatsapp_business_management",
      detail: "Administrar WABA, sender, plantillas, webhooks y estados desde Chatboc.",
    },
    {
      key: "profile",
      label: "public_profile",
      detail: "Identificar la cuenta autorizada durante el registro seguro con Meta.",
    },
  ];
  const configurationCards = [
    {
      key: "sender",
      label: "Sender productivo",
      detail: "Número aprobado, asociado y listo para mensajes reales.",
      done: hasSender,
      active: hasMetaAccount && !hasSender,
    },
    {
      key: "templates",
      label: "Plantillas y menú",
      detail: "Mensajes iniciales, menú del rubro y respuestas configurables.",
      done: hasTemplateConfig,
      active: !hasTemplateConfig,
    },
    {
      key: "voice",
      label: "Voz y accesibilidad",
      detail: "Twilio Voice y rutas de asistencia para llamadas o notas de voz.",
      done: voiceReady,
      active: !voiceReady,
    },
    {
      key: "webhooks",
      label: "Webhooks y métricas",
      detail: "Entrega, lectura, actividad y eventos conectados al panel.",
      done: operationalReady,
      active: senderReady && !operationalReady,
    },
  ];

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
      setError(getErrorMessage(err, "No se pudo preparar la activación."));
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
    <section className="rounded-2xl border bg-gradient-to-br from-card via-card to-primary/5 p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <MessageSquareText className="h-4 w-4" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">WhatsApp productivo</p>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                Meta Tech Provider
              </span>
              <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                WhatsApp Business Platform
              </span>
            </div>
            <h3 className="mt-1 text-lg font-semibold text-foreground">Activación guiada por Chatboc</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              El cliente autoriza con Meta desde Chatboc. La plataforma registra sender, voz, webhooks y pruebas sin exponer Twilio Console.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2">
            <StatusPill value={state?.sender_status || contract?.status} />
            {statusLabel ? <StatusPill value={statusLabel} /> : null}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !contract ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Cargando contrato de activación...
        </div>
      ) : null}

      {contract ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border bg-background/80 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Ruta de activación</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Paso actual: <span className="font-medium text-foreground">{currentStep.label}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono text-foreground">{completedSteps}/{activationSteps.length}</span>
                <span>completados</span>
              </div>
            </div>
            <Progress value={progressPercent} className="mt-3 h-2" />
            <div className="mt-4 grid gap-2 lg:grid-cols-4">
              {activationSteps.map((step) => (
                <StepCard
                  key={step.id}
                  active={step.active}
                  detail={step.detail}
                  done={step.done}
                  icon={step.icon}
                  label={step.label}
                />
              ))}
            </div>
          </div>

          {!envReady ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                <div>
                  <p className="font-medium text-foreground">Configuración pendiente de plataforma</p>
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
            <div className="flex items-center gap-2 rounded-xl border bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
              <ArrowRight className="h-4 w-4 text-primary" />
              <span>Siguiente acción: <span className="font-medium text-foreground">{statusLabel}</span></span>
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-2xl border bg-background/70 p-3">
              <p className="text-sm font-semibold text-foreground">Permisos aprobados y uso permitido</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Chatboc opera como Meta Tech Provider y mantiene la autorización dentro del panel del tenant.
              </p>
              <div className="mt-3 space-y-2">
                {capabilityCards.map((item) => (
                  <div key={item.key} className="flex items-start gap-2 rounded-xl border bg-card/50 p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div>
                      <p className="text-xs font-semibold text-foreground">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border bg-background/70 p-3">
              <p className="text-sm font-semibold text-foreground">Configuración del tenant</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Estados visibles para que el usuario sepa qué falta antes de operar en producción.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {configurationCards.map((item) => (
                  <div
                    key={item.key}
                    className={cn(
                      "rounded-xl border p-3",
                      item.done
                        ? "border-emerald-500/30 bg-emerald-500/10"
                        : item.active
                          ? "border-primary/35 bg-primary/10"
                          : "bg-card/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">{item.label}</p>
                      <StatusPill value={item.done ? "listo" : item.active ? "en curso" : "pendiente"} />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border bg-background/70 p-3 text-sm lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Cuenta WhatsApp Business</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {[
                  ["WABA", state?.waba_id, KeyRound],
                  ["Phone number ID", state?.phone_number_id, PhoneCall],
                  ["Sender", state?.sender_id, SendHorizontal],
                  ["Sender SID", state?.sender_sid, Settings2],
                ].map(([label, value, Icon]) => (
                  <div key={String(label)} className="rounded-xl border bg-card/60 p-3">
                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      {React.createElement(Icon as React.ElementType, { className: "h-3.5 w-3.5 text-primary" })}
                      <span>{label}</span>
                    </div>
                    <p className="mt-2 break-all font-mono text-xs text-foreground">{readText(value) ?? "pendiente"}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border bg-card/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Estado operativo</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusPill value={state?.sender_status || contract.status} />
                <StatusPill value={voice?.status} />
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Para la revisión se puede mostrar cuenta conectada, sender productivo, estado del canal, voz y webhooks operativos desde el panel.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border bg-background/70 p-3">
            <p className="text-sm font-semibold text-foreground">Prueba productiva recomendada</p>
            <div className="mt-2 grid gap-2 text-xs leading-5 text-muted-foreground md:grid-cols-2">
              <p>1. Iniciar registro embebido y conectar una WABA autorizada.</p>
              <p>2. Registrar sender productivo con Twilio Senders API desde Chatboc.</p>
              <p>3. Crear o revisar plantillas desde el perfil del tenant.</p>
              <p>4. Enviar y recibir un mensaje de prueba por WhatsApp.</p>
              <p>5. Mostrar estado de entrega, lectura o actividad en el panel.</p>
              <p>6. Mostrar que el cliente nunca entra a Twilio Console.</p>
            </div>
          </div>

          <div className="rounded-2xl border bg-background/70 p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Acciones de activación</p>
                <p className="text-xs text-muted-foreground">El usuario avanza sin salir del panel del tenant.</p>
              </div>
              <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Paso actual: {currentStep.label}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={handleProvision} disabled={!envReady || provisioning}>
                {provisioning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Preparar activación
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
                  <ExternalLink className="mr-2 h-4 w-4" />
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
          </div>

          <div className="rounded-2xl border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
            <p className="font-medium text-foreground">Rutas conectadas</p>
            <p>Inbound: <span className="font-mono">/webhook/whatsapp</span></p>
            <p>Status: <span className="font-mono">/twilio/whatsapp/status</span></p>
            <p>Voz: <span className="font-mono">{voice?.voice_url || "/twilio/voice?tenant=..."}</span></p>
          </div>

          {limitations.length ? (
            <div className="rounded-2xl border bg-background/70 p-3">
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
