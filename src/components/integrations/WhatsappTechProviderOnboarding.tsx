import React, { useEffect, useMemo, useState } from "react";
import {
  getTenantOpsQaPlaybookV2,
  runTenantOpsQaCheckV2,
  type TenantOpsQaCheckV2,
  type TenantOpsQaExecutionV2,
  type TenantOpsQaPlaybookV2,
} from "@/api/v2/saas";
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
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { tenantService } from "@/services/tenantService";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/api";
import { buildTenantPath } from "@/utils/tenantPaths";

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
  setup_health?: {
    contract_version?: string | null;
    status?: string | null;
    activation_score?: number | null;
    completed?: number | null;
    total?: number | null;
    recommended_next_action?: string | null;
    blockers?: Array<Record<string, unknown>> | null;
  } | null;
  operator_checklist?: Array<Record<string, unknown>> | null;
  smoke_tests?: Record<string, string | null | undefined> | null;
  smoke_playbook?: {
    contract_version?: string | null;
    safe_by_default?: boolean | null;
    summary?: {
      total?: number | null;
      executable_now?: number | null;
      real_message_tests?: number | null;
    } | null;
    recommended_order?: string[] | null;
    tests?: Array<Record<string, unknown>> | null;
  } | null;
  api_workflow?: Array<Record<string, unknown>> | null;
  frontend_contract?: {
    render_as?: string | null;
    show_twilio_brand?: boolean | null;
    show_manual_console_steps?: boolean | null;
    primary_action?: string | null;
    show_phone_choice?: boolean | null;
    show_progress_steps?: boolean | null;
    sections?: string[] | null;
  } | null;
  limitations?: Array<string | Record<string, unknown>> | null;
  next_action?: string | null;
  status?: string | null;
};

type IntegrationPlanLockPayload = {
  error?: string | null;
  message?: string | null;
  feature_id?: string | null;
  feature?: Record<string, unknown> | null;
  access?: Record<string, unknown> | null;
  upgrade?: Record<string, unknown> | null;
  frontend_contract?: Record<string, unknown> | null;
};

const readText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
};

const asPlainRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const readBoolean = (value: unknown, fallback = false) =>
  typeof value === "boolean" ? value : fallback;

const readNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
};

const extractIntegrationPlanLock = (error: unknown): IntegrationPlanLockPayload | null => {
  const errorRecord = asPlainRecord(error);
  const payload = asPlainRecord(errorRecord?.body) ?? asPlainRecord(error);
  if (!payload) return null;
  const frontendContract = asPlainRecord(payload.frontend_contract);
  const errorCode = readText(payload.error);
  const renderAs = readText(frontendContract?.render_as);
  if (errorCode !== "plan_required" && renderAs !== "integration_locked") return null;
  return {
    error: errorCode,
    message: readText(payload.message),
    feature_id: readText(payload.feature_id),
    feature: asPlainRecord(payload.feature),
    access: asPlainRecord(payload.access),
    upgrade: asPlainRecord(payload.upgrade),
    frontend_contract: frontendContract,
  };
};

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

const actionLabel = (value?: string | null) => {
  const normalized = normalizeStatus(value).replace(/_/g, " ");
  if (!normalized) return "revisar activacion";
  const labels: Record<string, string> = {
    "complete platform config": "Completar configuracion de plataforma",
    "prepare activation": "Preparar activacion",
    "start embedded signup": "Iniciar registro embebido",
    "register sender": "Registrar sender",
    "poll sender status": "Actualizar estado del sender",
    "prepare voice": "Preparar voz inclusiva",
    "review templates and webviews": "Revisar plantillas y webviews",
    "send whatsapp smoke test": "Enviar prueba WhatsApp",
    "verify webhooks": "Verificar webhooks",
    "submit or sync templates": "Enviar o sincronizar plantillas",
    "complete template copy and samples": "Completar textos y ejemplos de plantillas",
    "review operations hub": "Revisar hub operativo",
    "fix whatsapp experience contract": "Corregir contrato WhatsApp",
    "wait for meta approval or poll again": "Esperar Meta o actualizar estado",
  };
  return labels[normalized] ?? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const limitationLabel = (item: string | Record<string, unknown>) =>
  typeof item === "string" ? item.trim() : readText(item.label, item.title, item.message, item.detail, item.description);

const formatQaScore = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "sin score";
  const normalized = value > 1 ? value : value * 100;
  return `${Math.round(normalized)}%`;
};

const qaTone = (status?: string | null, ok?: boolean) => {
  const normalized = normalizeStatus(status);
  if (ok || normalized === "pass" || normalized === "ready" || normalized === "ok") {
    return "border-emerald-500/35 bg-emerald-500/10 text-emerald-700";
  }
  if (["fail", "failed", "critical", "blocked", "danger"].includes(normalized)) {
    return "border-red-500/35 bg-red-500/10 text-red-700";
  }
  if (["warning", "degraded", "review_required"].includes(normalized)) {
    return "border-amber-500/35 bg-amber-500/10 text-amber-700";
  }
  return "border-border bg-muted/35 text-muted-foreground";
};

const isExecutableSmokeTest = (item: Record<string, unknown>) =>
  readBoolean(item.can_execute, false) && !normalizeStatus(readText(item.danger_level)).includes("real_message");

const isWhatsappFinalQaCheck = (check: TenantOpsQaCheckV2) => {
  const searchable = [
    check.id,
    check.label,
    check.endpoint,
    check.next_action,
    check.status,
    JSON.stringify(check.details ?? {}),
  ].join(" ").toLowerCase();
  return (
    searchable.includes("whatsapp") ||
    searchable.includes("template") ||
    searchable.includes("plantilla") ||
    searchable.includes("webview") ||
    searchable.includes("web view")
  );
};

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

type WhatsappTechProviderOnboardingProps = {
  tenantSlug?: string | null;
  focusAction?: string | null;
};

export default function WhatsappTechProviderOnboarding({ tenantSlug, focusAction }: WhatsappTechProviderOnboardingProps) {
  const [contract, setContract] = useState<TechProviderContract | null>(null);
  const [loading, setLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [registeringSender, setRegisteringSender] = useState(false);
  const [pollingSender, setPollingSender] = useState(false);
  const [provisioningVoice, setProvisioningVoice] = useState(false);
  const [runningSmokeTest, setRunningSmokeTest] = useState<string | null>(null);
  const [smokeResults, setSmokeResults] = useState<Record<string, any>>({});
  const [opsQa, setOpsQa] = useState<TenantOpsQaPlaybookV2 | null>(null);
  const [opsQaError, setOpsQaError] = useState<string | null>(null);
  const [runningOpsQaCheck, setRunningOpsQaCheck] = useState<string | null>(null);
  const [opsQaResults, setOpsQaResults] = useState<Record<string, TenantOpsQaExecutionV2>>({});
  const [error, setError] = useState<string | null>(null);
  const [planLock, setPlanLock] = useState<IntegrationPlanLockPayload | null>(null);

  const load = async () => {
    if (!tenantSlug) return;
    setLoading(true);
    setError(null);
    setPlanLock(null);
    try {
      const [contractResult, qaResult] = await Promise.allSettled([
        tenantService.getWhatsappTechProvider(tenantSlug),
        getTenantOpsQaPlaybookV2(tenantSlug),
      ]);
      if (contractResult.status === "rejected") {
        throw contractResult.reason;
      }
      setContract(extractContract(contractResult.value));
      if (qaResult.status === "fulfilled") {
        setOpsQa(qaResult.value);
        setOpsQaError(null);
      } else {
        setOpsQa(null);
        setOpsQaError(getErrorMessage(qaResult.reason, "No se pudo cargar el QA final del tenant."));
      }
    } catch (err) {
      const lock = extractIntegrationPlanLock(err);
      setContract(null);
      if (lock) {
        setPlanLock(lock);
        setOpsQa(null);
        setOpsQaError(null);
        setError(null);
      } else {
        setError(getErrorMessage(err, "No se pudo cargar el onboarding de WhatsApp."));
      }
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
  const setupHealth = contract?.setup_health ?? null;
  const operatorChecklist = Array.isArray(contract?.operator_checklist) ? contract.operator_checklist : [];
  const smokeTests = contract?.smoke_tests && typeof contract.smoke_tests === "object" ? contract.smoke_tests : {};
  const smokeTestEntries = Object.entries(smokeTests).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0);
  const smokePlaybook = contract?.smoke_playbook ?? null;
  const smokePlaybookTests = Array.isArray(smokePlaybook?.tests) ? smokePlaybook.tests : [];
  const opsQaChecks = opsQa?.checks ?? [];
  const whatsappFinalQaChecks = opsQaChecks.filter(isWhatsappFinalQaCheck);
  const finalQaChecks = whatsappFinalQaChecks.length ? whatsappFinalQaChecks : opsQaChecks.slice(0, 3);
  const primaryFinalQaCheck =
    finalQaChecks.find((check) => normalizeStatus(check.id).includes("template") || normalizeStatus(check.id).includes("webview")) ??
    finalQaChecks.find((check) => !check.ok) ??
    finalQaChecks[0] ??
    null;
  const finalQaResult = primaryFinalQaCheck ? opsQaResults[primaryFinalQaCheck.id] : null;
  const finalQaStatus = finalQaResult?.playbook_status || finalQaResult?.status || opsQa?.status || primaryFinalQaCheck?.status || "pendiente";
  const finalQaScore = finalQaResult?.playbook_score ?? opsQa?.score ?? null;
  const finalQaNextAction =
    finalQaResult?.next_action ||
    primaryFinalQaCheck?.next_action ||
    opsQa?.recommended_next_actions?.[0]?.next_action ||
    opsQa?.recommended_next_actions?.[0]?.label ||
    null;
  const finalQaDetails = finalQaResult?.details ?? {};
  const finalQaMatrix = finalQaDetails.executable_matrix && typeof finalQaDetails.executable_matrix === "object"
    ? (finalQaDetails.executable_matrix as Record<string, unknown>)
    : null;
  const finalQaMatrixSummary = finalQaMatrix?.summary && typeof finalQaMatrix.summary === "object"
    ? (finalQaMatrix.summary as Record<string, unknown>)
    : {};
  const finalQaScenarioCount = readNumber(finalQaMatrixSummary.scenarios);
  const finalQaCaseCount = readNumber(finalQaMatrixSummary.cases);
  const finalQaCommand = readText(finalQaMatrix?.local_command, (finalQaDetails.runner as Record<string, unknown> | undefined)?.local_command);
  const setupScore = typeof setupHealth?.activation_score === "number" ? setupHealth.activation_score : null;
  const setupCompleted = typeof setupHealth?.completed === "number" ? setupHealth.completed : null;
  const setupTotal = typeof setupHealth?.total === "number" ? setupHealth.total : null;
  const setupBlockers = Array.isArray(setupHealth?.blockers) ? setupHealth.blockers : [];
  const signupUrl = readText(embeddedSignup?.url, embeddedSignup?.start_url);
  const embeddedSignupEnabled = readBoolean(embeddedSignup?.enabled, false);
  const canStartSignup = envReady && embeddedSignupEnabled && Boolean(signupUrl);
  const canRegisterSender = envReady && Boolean(state?.waba_id && state?.phone_number_id);
  const canPollSender = envReady && Boolean(state?.sender_sid);
  const showProgressSteps = contract?.frontend_contract?.show_progress_steps !== false;
  const templatesPath = useMemo(() => {
    const basePath = buildTenantPath("/perfil/plantillas-respuesta", tenantSlug);
    const params = new URLSearchParams({
      section: "whatsapp-operations",
      action: "twilio-content",
    });
    if (tenantSlug?.trim()) params.set("tenant", tenantSlug.trim());
    return `${basePath}?${params.toString()}`;
  }, [tenantSlug]);
  const catalogAdminPath = useMemo(() => buildTenantPath("/admin/catalog", tenantSlug), [tenantSlug]);
  const marketplacePath = useMemo(() => {
    const safeSlug = tenantSlug?.trim();
    return safeSlug ? `/t/${encodeURIComponent(safeSlug)}/market` : "/market";
  }, [tenantSlug]);
  const integrationSandboxPath = useMemo(() => {
    const basePath = buildTenantPath("/integracion", tenantSlug);
    const params = new URLSearchParams({
      channel: "whatsapp",
      mode: "sandbox",
    });
    return `${basePath}?${params.toString()}`;
  }, [tenantSlug]);
  const planLockFeatureLabel = readText(
    planLock?.feature?.label,
    planLock?.frontend_contract?.feature_label,
    planLock?.feature_id,
    "WhatsApp Business productivo",
  )!;
  const planLockMessage = readText(
    planLock?.message,
    planLock?.access?.message,
    "WhatsApp productivo, plantillas oficiales, sender y webhooks requieren plan Full activo.",
  )!;
  const planLockCurrentPlan = readText(planLock?.frontend_contract?.current_plan, planLock?.access?.current_plan, "free")!;
  const planLockRequiredPlan = readText(
    planLock?.frontend_contract?.required_plan,
    planLock?.feature?.required_plan,
    planLock?.access?.required_plan,
    "full",
  )!;
  const planLockUpgradeUrl = readText(planLock?.upgrade?.url, planLock?.upgrade?.upgrade_url, "https://www.chatboc.ar/#precios")!;
  const signupUnavailableMessage = embeddedSignupEnabled && !canStartSignup
    ? !envReady
      ? missingEnv.length
        ? `Completa la configuracion de plataforma antes de abrir Meta: ${missingEnv.join(", ")}.`
        : "Completa la configuracion de plataforma antes de abrir Meta."
      : "Meta Embedded Signup esta habilitado, pero el backend no envio una URL de inicio. Prepara la activacion o actualiza el contrato."
    : null;

  const statusLabel = useMemo(() => {
    const status = readText(contract?.status, contract?.next_action);
    if (status === "register_whatsapp_sender_via_senders_api") return "Activación en proceso";
    return status;
  }, [contract?.next_action, contract?.status]);

  const hasMetaAccount = Boolean(state?.waba_id && state?.phone_number_id);
  const hasSender = Boolean(state?.sender_id || state?.sender_sid);
  const senderReady = isReadyStatus(state?.sender_status);
  const operationalReady = senderReady || normalizeStatus(contract?.status).includes("active");
  const normalizedFocusAction = normalizeStatus(focusAction).replace(/_/g, "-");
  const normalizedNextAction = normalizeStatus(contract?.next_action || setupHealth?.recommended_next_action || contract?.status);
  const registerSenderIsPrimary =
    normalizedFocusAction === "register-sender" ||
    normalizedFocusAction === "register-whatsapp-sender" ||
    normalizedNextAction === "register_whatsapp_sender_via_senders_api" ||
    normalizedNextAction === "register sender" ||
    normalizedNextAction === "register-sender";
  const templatesArePrimary =
    normalizedFocusAction === "twilio-content" ||
    normalizedFocusAction === "templates" ||
    normalizedFocusAction === "plantillas" ||
    normalizedNextAction.includes("template") ||
    normalizedNextAction.includes("plantilla");
  const catalogIsPrimary =
    normalizedFocusAction === "catalog" ||
    normalizedFocusAction === "catalogo" ||
    normalizedFocusAction === "marketplace" ||
    normalizedNextAction.includes("catalog") ||
    normalizedNextAction.includes("catalogo") ||
    normalizedNextAction.includes("marketplace");
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
  const primarySmokeTest =
    smokePlaybookTests.find(isExecutableSmokeTest) ??
    smokePlaybookTests.find((item) => readBoolean(item.can_execute, false)) ??
    null;
  const primarySmokeTestId = readText(primarySmokeTest?.id);
  const primarySmokeResult = primarySmokeTestId ? smokeResults[primarySmokeTestId] : null;
  const canRunPrimarySmokeTest = Boolean(primarySmokeTest && primarySmokeTestId && isExecutableSmokeTest(primarySmokeTest));
  const missingConfigurationItems = Array.from(
    new Set(
      [
        !envReady
          ? missingEnv.length
            ? `Completar variables: ${missingEnv.join(", ")}`
            : "Completar configuracion de plataforma"
          : null,
        !hasMetaAccount ? "Autorizar cuenta WhatsApp Business en Meta" : null,
        hasMetaAccount && !hasSender ? "Registrar el numero como sender productivo" : null,
        hasSender && !senderReady ? `Actualizar aprobacion del sender (${state?.sender_status || "pendiente"})` : null,
        !hasTemplateConfig ? "Configurar plantillas, menu y webviews del tenant" : null,
        !voiceReady ? "Preparar voz y rutas de asistencia" : null,
        senderReady && !operationalReady ? "Verificar webhooks de entrega, lectura y actividad" : null,
        ...setupBlockers.map((blocker) => readText(blocker.label, blocker.code, blocker.detail)),
      ].filter((item): item is string => Boolean(item?.trim())),
    ),
  ).slice(0, 6);
  const readinessLabel = !envReady
    ? "Bloqueado por plataforma"
    : !hasMetaAccount
      ? "Falta autorizar Meta"
      : !hasSender
        ? "Falta registrar sender"
        : !senderReady
          ? "Sender en revision"
          : missingConfigurationItems.length
            ? "Listo con pendientes"
            : "Listo para operar";
  const readinessTone = !envReady
    ? "border-red-500/35 bg-red-500/10 text-red-700"
    : !hasMetaAccount || !hasSender || !senderReady || missingConfigurationItems.length
      ? "border-amber-500/35 bg-amber-500/10 text-amber-700"
      : "border-emerald-500/35 bg-emerald-500/10 text-emerald-700";
  const readinessDetail = !envReady
    ? "No abras Meta hasta completar la configuracion base."
    : !hasMetaAccount
      ? "Primero el cliente autoriza su cuenta desde el registro embebido."
      : !hasSender
        ? "La WABA existe; falta asociar el numero productivo."
        : !senderReady
          ? "El numero esta registrado, pero todavia no esta listo para operar."
          : missingConfigurationItems.length
            ? "El canal base responde, pero quedan controles antes de produccion completa."
            : "El canal tiene cuenta, sender y controles operativos listos.";
  const recommendedNextActionRaw = readText(setupHealth?.recommended_next_action, finalQaNextAction, contract?.next_action, currentStep.label);
  const recommendedNextActionLabel =
    recommendedNextActionRaw === currentStep.label ? currentStep.label : actionLabel(recommendedNextActionRaw);
  const recommendedNextActionDetail = missingConfigurationItems[0]
    ? `Cerrar pendiente: ${missingConfigurationItems[0]}`
    : "Mantener QA final y monitoreo antes de abrir mas trafico.";
  const connectionTestLabel = readText(primarySmokeTest?.label, primarySmokeTest?.id) ?? "Sin prueba ejecutable";
  const connectionTestMode = readText(primarySmokeTest?.execution_mode, primarySmokeTest?.method) ?? "dry_run";
  const connectionResultStatus = primarySmokeResult
    ? readText(primarySmokeResult.status) ?? (readBoolean(primarySmokeResult.ok, false) ? "pass" : "warning")
    : null;
  const summaryProgressLabel = missingConfigurationItems.length
    ? `${completedSteps}/${activationSteps.length} pasos tecnicos`
    : `${progressPercent}% de ruta completada`;

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

  const handleRunSmokeTest = async (testId?: string | null) => {
    const id = readText(testId);
    if (!tenantSlug || !id) return;
    setRunningSmokeTest(id);
    setError(null);
    try {
      const response = await tenantService.runWhatsappTechProviderSmokeTest(tenantSlug, id, {
        source: "tenant_panel",
        dry_run: true,
      });
      setSmokeResults((current) => ({ ...current, [id]: response }));
    } catch (err: any) {
      const body = err?.body && typeof err.body === "object" ? err.body : null;
      if (body?.contract_version === "twilio.tech_provider.smoke_execution.v1") {
        setSmokeResults((current) => ({ ...current, [id]: body }));
      } else {
        setError(getErrorMessage(err, "No se pudo ejecutar la prueba operativa."));
      }
    } finally {
      setRunningSmokeTest(null);
    }
  };

  const handleRunFinalQaCheck = async () => {
    if (!tenantSlug || !primaryFinalQaCheck) return;
    setRunningOpsQaCheck(primaryFinalQaCheck.id);
    setOpsQaError(null);
    try {
      const result = await runTenantOpsQaCheckV2(tenantSlug, primaryFinalQaCheck.id);
      setOpsQaResults((current) => ({ ...current, [primaryFinalQaCheck.id]: result }));
    } catch (err) {
      setOpsQaError(getErrorMessage(err, "No se pudo ejecutar el QA final del tenant."));
    } finally {
      setRunningOpsQaCheck(null);
    }
  };

  if (!tenantSlug) {
    return (
      <section
        data-testid="whatsapp-onboarding-missing-tenant"
        className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-foreground shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Tenant no resuelto</p>
              <h3 className="mt-1 text-base font-semibold text-foreground">No pude cargar la activacion de WhatsApp</h3>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                La pantalla necesita un tenant activo para revisar sender, plantillas, webviews y pruebas reales. Volve al panel o abri integracion con
                contexto de WhatsApp.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <a href="/perfil">Volver al panel</a>
            </Button>
            <Button type="button" size="sm" asChild>
              <a href="/integracion?channel=whatsapp">
                Abrir integracion
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (planLock) {
    return (
      <section
        data-testid="whatsapp-plan-lock-panel"
        className="overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-slate-950 via-slate-900 to-primary/25 text-white shadow-sm"
      >
        <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-300/30 bg-amber-300/15 px-3 py-1 text-xs font-semibold text-amber-100">
                Plan requerido
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                Actual: {planLockCurrentPlan}
              </span>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                Requiere: {planLockRequiredPlan}
              </span>
            </div>
            <div className="mt-5 flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/35 bg-primary/20 text-primary-foreground">
                <KeyRound className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-foreground/70">WhatsApp Business Platform</p>
                <h3 className="mt-2 text-2xl font-semibold leading-tight text-white">{planLockFeatureLabel}</h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">{planLockMessage}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <MessageSquareText className="h-4 w-4 text-sky-200" />
                <p className="mt-3 text-sm font-semibold text-white">Sender y plantillas</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">Bloquea envio productivo, no la preparacion del flujo.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <ShoppingBag className="h-4 w-4 text-emerald-200" />
                <p className="mt-3 text-sm font-semibold text-white">Catalogo conectado</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">Usa marketplace y pedido asistido mientras se habilita Full.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <ShieldCheck className="h-4 w-4 text-amber-200" />
                <p className="mt-3 text-sm font-semibold text-white">Seguro por defecto</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">Sin Twilio Console expuesta ni acciones reales sin plan activo.</p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-black/20 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <p className="text-sm font-semibold text-white">Que puede hacer el equipo ahora</p>
            <div className="mt-4 space-y-3">
              <Button type="button" className="w-full justify-between bg-white text-slate-950 hover:bg-slate-100" asChild>
                <a href={planLockUpgradeUrl} target="_blank" rel="noreferrer">
                  Solicitar plan Full
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
              <Button type="button" variant="outline" className="w-full justify-between border-white/20 bg-white/10 text-white hover:bg-white/15" asChild>
                <a href={integrationSandboxPath}>
                  Probar sandbox WhatsApp
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button type="button" variant="outline" className="w-full justify-between border-white/20 bg-white/10 text-white hover:bg-white/15" asChild>
                <a href={templatesPath}>
                  Preparar plantillas y webviews
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button type="button" variant="outline" className="w-full justify-between border-white/20 bg-white/10 text-white hover:bg-white/15" asChild>
                <a href={marketplacePath} target="_blank" rel="noreferrer">
                  Ver marketplace publico
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-4 text-xs leading-5 text-slate-300">
              <p className="font-semibold text-white">Contrato recibido</p>
              <p className="mt-2">Feature: {planLock.feature_id || "whatsapp_sender_management"}</p>
              <p>Estado: {readText(planLock.frontend_contract?.render_as, "integration_locked")}</p>
              <p>Accion: {readText(planLock.frontend_contract?.primary_action, "upgrade_to_full")}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" className="mt-4 text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Reintentar contrato
            </Button>
          </div>
        </div>
      </section>
    );
  }

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
          <div className="rounded-2xl border bg-background/85 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Resumen de activacion</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Estado, proximo paso, prueba de conexion y faltantes visibles antes de operar.
                </p>
              </div>
              <span className="w-fit rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {summaryProgressLabel}
              </span>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-4">
              <div className="rounded-xl border bg-card/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Estado</p>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${readinessTone}`}>
                    {readinessLabel}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-foreground">{currentStep.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{readinessDetail}</p>
              </div>

              <div className="rounded-xl border bg-card/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Proximo paso</p>
                <p className="mt-3 text-sm font-semibold text-foreground">{recommendedNextActionLabel}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{recommendedNextActionDetail}</p>
              </div>

              <div className="rounded-xl border bg-card/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Prueba de conexion</p>
                <p className="mt-3 text-sm font-semibold text-foreground">{connectionTestLabel}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {canRunPrimarySmokeTest
                    ? `Ejecutable ahora en modo ${connectionTestMode}; no envia mensajes reales.`
                    : "El backend todavia no informo una prueba segura ejecutable."}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full justify-center"
                  disabled={!canRunPrimarySmokeTest || Boolean(runningSmokeTest)}
                  onClick={() => void handleRunSmokeTest(primarySmokeTestId)}
                >
                  {runningSmokeTest === primarySmokeTestId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Ejecutar prueba de conexion
                </Button>
                {connectionResultStatus ? (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Ultimo resultado: <span className="font-medium text-foreground">{connectionResultStatus}</span>
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl border bg-card/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Falta configurar</p>
                {missingConfigurationItems.length ? (
                  <ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                    {missingConfigurationItems.map((item) => (
                      <li key={item} className="flex gap-2">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    No hay faltantes criticos informados por el contrato actual.
                  </p>
                )}
              </div>
            </div>
          </div>

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

          {opsQa || opsQaError ? (
            <div className="rounded-2xl border bg-background/80 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">QA final del tenant</p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Check seguro/read-only de plantillas, webviews y contrato WhatsApp antes de continuar la activacion.
                  </p>
                </div>
                {opsQa ? (
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${qaTone(finalQaStatus, finalQaResult?.ok)}`}>
                      {finalQaStatus}
                    </span>
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      Score {formatQaScore(finalQaScore)}
                    </span>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${opsQa.safe_by_default ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700" : "border-amber-500/35 bg-amber-500/10 text-amber-700"}`}>
                      {opsQa.safe_by_default ? "read-only" : "revisar modo"}
                    </span>
                  </div>
                ) : null}
              </div>

              {opsQaError ? (
                <div className="mt-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-xs leading-5 text-muted-foreground">
                  {opsQaError}
                </div>
              ) : null}

              {opsQa ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.8fr]">
                  <div className="rounded-xl border bg-card/50 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {primaryFinalQaCheck?.label ?? "Plantillas y webviews"}
                        </p>
                        <p className="mt-1 break-all text-xs leading-5 text-muted-foreground">
                          {primaryFinalQaCheck?.endpoint ?? primaryFinalQaCheck?.id ?? "ops-qa/playbook"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!primaryFinalQaCheck || Boolean(runningOpsQaCheck)}
                        onClick={() => void handleRunFinalQaCheck()}
                      >
                        {runningOpsQaCheck ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Ejecutar QA read-only
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-lg border bg-background/70 p-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Estado</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{finalQaStatus}</p>
                      </div>
                      <div className="rounded-lg border bg-background/70 p-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Score</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{formatQaScore(finalQaScore)}</p>
                      </div>
                      <div className="rounded-lg border bg-background/70 p-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Next action</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{actionLabel(finalQaNextAction)}</p>
                      </div>
                    </div>
                    {finalQaResult ? (
                      <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
                        <div>
                          Resultado ejecutado:{" "}
                          <span className="font-medium text-foreground">{finalQaResult.label || primaryFinalQaCheck?.label || "QA final"}</span>
                          {finalQaResult.execution_mode ? (
                            <span> - modo {finalQaResult.execution_mode}</span>
                          ) : null}
                          {finalQaResult.sends_real_message === false ? <span> - sin mensajes reales</span> : null}
                        </div>
                        {finalQaMatrix ? (
                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            <div className="rounded-lg border bg-background/70 p-2">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Escenarios</p>
                              <p className="mt-1 text-sm font-semibold text-foreground">{finalQaScenarioCount ?? "-"}</p>
                            </div>
                            <div className="rounded-lg border bg-background/70 p-2">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Casos</p>
                              <p className="mt-1 text-sm font-semibold text-foreground">{finalQaCaseCount ?? "-"}</p>
                            </div>
                            <div className="rounded-lg border bg-background/70 p-2">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Runner</p>
                              <p className="mt-1 break-all text-[11px] font-medium text-foreground">{finalQaCommand ?? "sin comando"}</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Checks relevantes</p>
                    <div className="mt-3 space-y-2">
                      {finalQaChecks.slice(0, 4).map((check) => (
                        <div key={check.id} className="flex items-start justify-between gap-2 rounded-lg border bg-background/70 p-2">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-foreground">{check.label}</p>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{check.next_action || check.endpoint || check.id}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${qaTone(check.status, check.ok)}`}>
                            {check.status || (check.ok ? "pass" : "review")}
                          </span>
                        </div>
                      ))}
                      {!finalQaChecks.length ? (
                        <p className="text-xs leading-5 text-muted-foreground">
                          El playbook no envio checks especificos para WhatsApp. Revisar contrato ops-qa.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {setupHealth || operatorChecklist.length || smokeTestEntries.length ? (
            <div className="rounded-2xl border bg-background/80 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Checklist operativo</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Diagnostico de produccion para registrar, probar y operar WhatsApp sin salir de Chatboc.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {setupScore !== null ? (
                    <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                      {setupScore}% listo
                    </span>
                  ) : null}
                  {setupCompleted !== null && setupTotal !== null ? (
                    <span className="rounded-full border bg-muted/35 px-3 py-1 text-xs text-muted-foreground">
                      {setupCompleted}/{setupTotal} controles
                    </span>
                  ) : null}
                  <StatusPill value={setupHealth?.status || contract?.frontend_contract?.primary_action} />
                </div>
              </div>

              {setupHealth?.recommended_next_action ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl border bg-primary/5 px-3 py-2 text-sm">
                  <ArrowRight className="h-4 w-4 text-primary" />
                  <span className="text-muted-foreground">
                    Proximo paso recomendado:{" "}
                    <span className="font-medium text-foreground">{actionLabel(setupHealth.recommended_next_action)}</span>
                  </span>
                </div>
              ) : null}

              {setupBlockers.length ? (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {setupBlockers.map((blocker, index) => (
                    <div key={readText(blocker.code, blocker.label) ?? index} className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <div>
                          <p className="text-xs font-semibold text-foreground">{readText(blocker.label, blocker.code) ?? "Bloqueo pendiente"}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{readText(blocker.detail, blocker.description) ?? "Revisar configuracion."}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {operatorChecklist.length ? (
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {operatorChecklist.map((item, index) => {
                    const done = readBoolean(item.done, false) || isReadyStatus(readText(item.status));
                    const critical = item.critical !== false;
                    return (
                      <div
                        key={readText(item.id, item.label) ?? index}
                        className={cn(
                          "rounded-xl border p-3",
                          done
                            ? "border-emerald-500/30 bg-emerald-500/10"
                            : critical
                              ? "border-primary/25 bg-primary/5"
                              : "bg-card/50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-foreground">{readText(item.label, item.id) ?? `Control ${index + 1}`}</p>
                          <StatusPill value={done ? "listo" : readText(item.status, item.action) ?? "pendiente"} />
                        </div>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{readText(item.description, item.detail) ?? "Control operativo del canal."}</p>
                        {readText(item.action) ? (
                          <p className="mt-2 text-[11px] font-medium text-primary">{actionLabel(readText(item.action))}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {smokeTestEntries.length ? (
                <div className="mt-4 rounded-xl border bg-muted/20 p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Smoke tests</p>
                      <p className="mt-1 text-xs text-muted-foreground">Pruebas rapidas para WhatsApp, webviews, plantillas y telemetria.</p>
                    </div>
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      QA accionable
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {smokeTestEntries.map(([key, value]) => (
                      <div key={key} className="rounded-lg border bg-background/70 p-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{key.replace(/_/g, " ")}</p>
                        <p className="mt-1 break-all font-mono text-xs text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {smokePlaybookTests.length ? (
                <div className="mt-4 rounded-xl border bg-background/75 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Plan de pruebas guiado</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Orden recomendado para validar canal, plantillas, webviews y mensajes reales sin romper produccion.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {smokePlaybook?.safe_by_default ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          seguro por defecto
                        </span>
                      ) : null}
                      {typeof smokePlaybook?.summary?.executable_now === "number" ? (
                        <span className="rounded-full border bg-muted/35 px-2 py-0.5 text-xs text-muted-foreground">
                          {smokePlaybook.summary.executable_now} ejecutables ahora
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 lg:grid-cols-2">
                    {smokePlaybookTests.map((item, index) => {
                      const testId = readText(item.id);
                      const canExecute = readBoolean(item.can_execute, false);
                      const danger = readText(item.danger_level);
                      const realMessage = danger === "real_message";
                      const result = testId ? smokeResults[testId] : null;
                      const resultOk = result ? readBoolean(result.ok, false) : false;
                      const isRunning = Boolean(testId && runningSmokeTest === testId);
                      const validations = Array.isArray(item.validates)
                        ? item.validates.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
                        : [];
                      return (
                        <div
                          key={readText(item.id, item.label) ?? index}
                          className={cn(
                            "rounded-xl border p-3",
                            canExecute
                              ? "border-emerald-500/25 bg-emerald-500/5"
                              : realMessage
                                ? "border-amber-500/30 bg-amber-500/10"
                                : "bg-card/50",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{readText(item.label, item.id) ?? `Prueba ${index + 1}`}</p>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">{readText(item.description) ?? "Validacion operativa del canal."}</p>
                            </div>
                            <StatusPill value={canExecute ? "ejecutable" : realMessage ? "confirmar" : "pendiente"} />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                            <span className="rounded-full border bg-background px-2 py-0.5 font-mono text-foreground">{readText(item.method) ?? "GET"}</span>
                            <span className="rounded-full border bg-background px-2 py-0.5 text-muted-foreground">{readText(item.execution_mode) ?? "read_only"}</span>
                            {danger ? <span className="rounded-full border bg-background px-2 py-0.5 text-muted-foreground">{danger}</span> : null}
                          </div>
                          {readText(item.endpoint) ? (
                            <p className="mt-2 break-all font-mono text-xs text-foreground">{readText(item.endpoint)}</p>
                          ) : null}
                          {validations.length ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {validations.map((validation) => (
                                <span key={validation} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                                  {validation.replace(/_/g, " ")}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <Button
                              type="button"
                              size="sm"
                              variant={canExecute && !realMessage ? "outline" : "ghost"}
                              disabled={!testId || !canExecute || realMessage || isRunning}
                              onClick={() => void handleRunSmokeTest(testId)}
                            >
                              {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                              {realMessage ? "Requiere confirmacion" : "Ejecutar prueba"}
                            </Button>
                            {result ? (
                              <span
                                className={cn(
                                  "rounded-full border px-2 py-0.5 text-xs font-medium",
                                  resultOk
                                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-700"
                                    : "border-amber-500/35 bg-amber-500/10 text-amber-700",
                                )}
                              >
                                {readText(result.status) ?? (resultOk ? "pass" : "warning")}
                              </span>
                            ) : null}
                          </div>
                          {result ? (
                            <div className="mt-2 rounded-lg border bg-background/70 p-2 text-xs leading-5 text-muted-foreground">
                              <p>
                                Resultado:{" "}
                                <span className="font-medium text-foreground">{readText(result.label, item.label) ?? "Prueba operativa"}</span>
                              </p>
                              {readText(result.next_action) ? (
                                <p>
                                  Siguiente accion: <span className="font-medium text-foreground">{actionLabel(readText(result.next_action))}</span>
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

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
              <p>3. Crear o revisar plantillas oficiales desde el hub WhatsApp/Twilio Content.</p>
              <p>4. Enviar y recibir un mensaje de prueba por WhatsApp.</p>
              <p>5. Mostrar estado de entrega, lectura o actividad en el panel.</p>
              <p>6. Mostrar que el cliente nunca entra a Twilio Console.</p>
            </div>
          </div>

          <div className="rounded-2xl border bg-background/70 p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                  <ShoppingBag className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Catalogo para WhatsApp</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Conecta productos, promos, stock, webviews de pedido y checkout para que el cliente compre o pida asistencia sin salir del canal.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-muted-foreground">
                    <span className="rounded-full border px-2 py-0.5">productos visibles</span>
                    <span className="rounded-full border px-2 py-0.5">promos y combos</span>
                    <span className="rounded-full border px-2 py-0.5">pedido asistido</span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  type="button"
                  variant={catalogIsPrimary ? "default" : "outline"}
                  onClick={() => window.open(catalogAdminPath, "_self")}
                >
                  Administrar catalogo
                </Button>
                <Button type="button" variant="ghost" onClick={() => window.open(marketplacePath, "_blank", "noopener,noreferrer")}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ver marketplace
                </Button>
              </div>
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
              {embeddedSignupEnabled ? (
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
              <Button
                type="button"
                variant={registerSenderIsPrimary ? "default" : "outline"}
                onClick={handleRegisterSender}
                disabled={!canRegisterSender || registeringSender}
              >
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
              <Button type="button" variant={templatesArePrimary ? "default" : "outline"} onClick={() => window.open(templatesPath, "_self")}>
                Plantillas WhatsApp
              </Button>
              {signupUnavailableMessage ? (
                <div className="basis-full rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  {signupUnavailableMessage}
                </div>
              ) : null}
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
