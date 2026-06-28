import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Database,
  ImageOff,
  Inbox,
  MailCheck,
  Layers3,
  MapPinned,
  MessageSquare,
  RefreshCw,
  School,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";

import {
  getTenantOpsQaPlaybookV2,
  getTenantAdminExperienceV2,
  normalizeOmnichannelInboxItemV2,
  runTenantOpsQaCheckV2,
  type OmnichannelInboxItem,
  type TenantAdminExperienceV2,
  type TenantOpsQaExecutionV2,
  type TenantOpsQaPlaybookV2,
} from "@/api/v2/saas";
import CatalogQualityCommandCenter from "@/components/admin/CatalogQualityCommandCenter";
import EmployeeRoutingMatrix from "@/components/admin/EmployeeRoutingMatrix";
import WhatsappOperationsHub from "@/components/admin/WhatsappOperationsHub";
import { TicketConversationPane } from "@/components/tickets/inbox/TicketConversationPane";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTenant } from "@/context/TenantContext";
import { ApiError, getErrorMessage } from "@/utils/api";

type AnyRecord = Record<string, any>;

const MODULE_ICONS: Record<string, React.ElementType> = {
  profile: Building2,
  inbox: Inbox,
  analytics: Activity,
  surveys_votings: MessageSquare,
  employees: Users,
  marketplace: Store,
  widget_whatsapp: Layers3,
  education: School,
};

const USER_PORTAL_MODULE_IDS = new Set([
  "portal",
  "portal_user",
  "portal_usuario",
  "portal_cliente",
  "portal_vecino",
  "user-portal",
  "user_portal",
  "client-portal",
  "client_portal",
  "customer-portal",
  "customer_portal",
  "neighbor-portal",
  "neighbor_portal",
]);

const isRecord = (value: unknown): value is AnyRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asArray = (value: unknown): AnyRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const asString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
};

const asStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map(asString).map((item) => item.trim()).filter(Boolean);
  }
  if (isRecord(value)) {
    return Object.keys(value).filter(Boolean);
  }
  const single = asString(value).trim();
  return single ? [single] : [];
};

const first = (record: AnyRecord | undefined | null, keys: string[]) => {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const formatNumber = (value: unknown) => {
  const numeric = asNumber(value);
  return numeric === null ? "—" : numeric.toLocaleString("es-AR");
};

const formatScore = (value: unknown) => {
  const numeric = asNumber(value);
  if (numeric === null) return "—";
  const normalized = numeric > 1 ? numeric : numeric * 100;
  return `${Math.round(normalized)}%`;
};

const StatePill = ({
  value,
  tone = "neutral",
}: {
  value: React.ReactNode;
  tone?: "ready" | "warning" | "danger" | "neutral";
}) => {
  const classes = {
    ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>
      {value}
    </span>
  );
};

const MetricCard = ({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon: React.ElementType;
}) => (
  <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
    <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon className="h-4 w-4" />
    </div>
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    <p className="mt-2 text-2xl font-black tracking-tight text-foreground">{value}</p>
    {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
  </div>
);

const EmptyPanel = ({ label }: { label: string }) => (
  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
    {label}
  </div>
);

const readLeadLabel = (lead: AnyRecord, index: number) =>
  String(first(lead, ["contact", "contact_name", "name", "nombre", "intent", "ticket_id", "id"]) || `Lead ${index + 1}`);

const readLeadTicket = (lead: AnyRecord | null): OmnichannelInboxItem | null =>
  lead ? normalizeOmnichannelInboxItemV2(lead) : null;

const renderRecordValue = (value: unknown) => {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const cleanOperationalError = (error: unknown) => {
  const message = getErrorMessage(error, "No se pudo cargar el perfil operativo del tenant.");
  const cleanMessage = /<html|<body|internal server error/i.test(message)
    ? "El perfil operativo del tenant no pudo cargarse desde el servidor."
    : message;
  const requestId = error instanceof ApiError ? error.requestId : undefined;
  return requestId ? `${cleanMessage} Request ID: ${requestId}` : cleanMessage;
};

export default function TenantAdminOperatingSystem({ tenantSlug }: { tenantSlug?: string | null }) {
  const { currentSlug } = useTenant();
  const effectiveSlug = tenantSlug || currentSlug;
  const [bundle, setBundle] = useState<TenantAdminExperienceV2 | null>(null);
  const [opsQa, setOpsQa] = useState<TenantOpsQaPlaybookV2 | null>(null);
  const [opsQaError, setOpsQaError] = useState<string | null>(null);
  const [runningOpsQaCheck, setRunningOpsQaCheck] = useState<string | null>(null);
  const [opsQaResults, setOpsQaResults] = useState<Record<string, TenantOpsQaExecutionV2>>({});
  const [activeModule, setActiveModule] = useState<string>("summary");
  const [selectedLead, setSelectedLead] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBundle = async () => {
    setLoading(true);
    setError(null);
    try {
      const [adminResult, qaResult] = await Promise.allSettled([
        getTenantAdminExperienceV2(effectiveSlug),
        getTenantOpsQaPlaybookV2(effectiveSlug),
      ]);
      if (adminResult.status === "rejected") {
        throw adminResult.reason;
      }
      setBundle(adminResult.value);
      if (qaResult.status === "fulfilled") {
        setOpsQa(qaResult.value);
        setOpsQaError(null);
      } else {
        setOpsQa(null);
        setOpsQaError(cleanOperationalError(qaResult.reason));
      }
    } catch (err) {
      setError(cleanOperationalError(err));
      setBundle(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBundle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSlug]);

  const runOpsQaCheck = async (checkId: string) => {
    setRunningOpsQaCheck(checkId);
    try {
      const result = await runTenantOpsQaCheckV2(effectiveSlug, checkId);
      setOpsQaResults((current) => ({ ...current, [checkId]: result }));
      setOpsQaError(null);
    } catch (err) {
      setOpsQaError(cleanOperationalError(err));
    } finally {
      setRunningOpsQaCheck(null);
    }
  };

  const tenant = bundle?.tenant ?? {};
  const profile = bundle?.profile ?? {};
  const readiness = isRecord(profile.readiness) ? profile.readiness : {};
  const operations = bundle?.operations ?? {};
  const dashboard = isRecord(operations.dashboard) ? operations.dashboard : {};
  const freshness = isRecord(operations.freshness) ? operations.freshness : {};
  const dashboardSummary = isRecord(dashboard.summary) ? dashboard.summary : {};
  const marketplace = bundle?.marketplace ?? {};
  const marketplaceSummary = isRecord(first(marketplace, ["summary", "image_summary", "media_summary"]))
    ? (first(marketplace, ["summary", "image_summary", "media_summary"]) as AnyRecord)
    : {};
  const surveys = bundle?.surveys_votings ?? {};
  const surveySummary = isRecord(first(surveys, ["summary", "metrics"])) ? (first(surveys, ["summary", "metrics"]) as AnyRecord) : {};
  const education = bundle?.education ?? {};
  const educationProfile = isRecord(first(education, ["profile", "education_profile"])) ? (first(education, ["profile", "education_profile"]) as AnyRecord) : {};
  const leadCapture = bundle?.lead_capture ?? {};
  const leadItems = asArray(first(leadCapture, ["items", "leads", "tickets"]));
  const whatsappExperience = bundle?.whatsapp_experience ?? null;
  const hasWhatsappExperience = Boolean(
    whatsappExperience || (bundle?.whatsapp && Object.keys(bundle.whatsapp).length > 0),
  );

  const modules = useMemo(() => {
    const backendModules = (bundle?.modules ?? []).filter((module) => {
      const id = String(module.id || "").trim().toLowerCase();
      return !USER_PORTAL_MODULE_IDS.has(id);
    });
    if (backendModules.length) {
      const hasWhatsappModule = backendModules.some((module) =>
        ["widget_whatsapp", "whatsapp", "channels"].includes(String(module.id || "")),
      );
      return hasWhatsappExperience && !hasWhatsappModule
        ? [...backendModules, { id: "widget_whatsapp", label: "Widget/WhatsApp/Voz" }]
        : backendModules;
    }
    if (hasWhatsappExperience) return [{ id: "widget_whatsapp", label: "Widget/WhatsApp/Voz" }];
    return [{ id: "summary", label: "Resumen" }];
  }, [bundle, hasWhatsappExperience]);

  useEffect(() => {
    if (!modules.length) return;
    const selectedStillExists = modules.some((module) => String(module.id || "") === activeModule);
    if (!selectedStillExists) {
      const firstModule = modules[0]?.id;
      setActiveModule(typeof firstModule === "string" ? firstModule : "summary");
    }
  }, [activeModule, modules]);

  const activeModuleConfig = useMemo(
    () => modules.find((module) => String(module.id || "") === activeModule) ?? null,
    [activeModule, modules],
  );
  const selectedLeadTicket = useMemo(() => readLeadTicket(selectedLead), [selectedLead]);
  const selectedLeadTicketId = selectedLeadTicket?.ticket_id || selectedLeadTicket?.id;
  const readinessChecks = isRecord(readiness.checks) ? readiness.checks : {};
  const freshnessSummary = isRecord(freshness.summary) ? freshness.summary : {};
  const canRenderHeatmap = first(freshnessSummary, ["can_render_heatmap", "heatmap_enabled"]);
  const freshnessStatus = String(freshness.status || first(freshness, ["state", "reason_code"]) || "ready");
  const healthScore = first(bundle?.health, ["score", "health_score"]) ?? first(profile, ["health_score", "score"]);
  const readinessScore = first(readiness, ["score", "readiness_score"]);
  const educationAdminMenu = isRecord(education.admin_menu) ? education.admin_menu : {};
  const educationPanelSections = asArray(first(educationAdminMenu, ["panel_sections", "sections", "items"]));
  const educationMediaInputs = asStringList(
    first(educationProfile, ["media_inputs", "inputs", "supported_media"]) ??
      first(education, ["media_inputs", "supported_media"]),
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-border/60 bg-background/80 p-8 text-sm text-muted-foreground shadow-sm">
        Cargando sistema operativo del tenant...
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <div className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" />
          {error || "No hay bundle disponible."}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={loadBundle}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[28px] border border-border/60 bg-background/90 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">
                  {String(first(profile, ["display_name", "name", "nombre"]) || first(tenant, ["nombre", "name", "slug"]) || "Tenant")}
                </h1>
                <StatePill value={String(first(tenant, ["vertical", "tipo"]) || "tenant")} />
                <StatePill value={`Plan ${String(first(tenant, ["plan"]) || "—")}`} />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {String(first(bundle.frontend_contract, ["render_as"]) || "tenant_admin_operating_system")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatePill value={`Health ${formatScore(healthScore)}`} tone="ready" />
            <StatePill value={`Readiness ${formatScore(readinessScore)}`} tone="ready" />
            <StatePill
              value={freshnessStatus}
              tone={freshnessStatus === "fresh" || freshnessStatus === "ready" ? "ready" : freshnessStatus === "empty" ? "danger" : "warning"}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Tickets abiertos" value={formatNumber(first(dashboardSummary, ["open_tickets", "tickets_open", "open"]))} icon={Inbox} />
        <MetricCard label="Vencidos" value={formatNumber(first(dashboardSummary, ["overdue_tickets", "sla_breached", "breached"]))} icon={ShieldCheck} />
        <MetricCard label="Leads" value={formatNumber(first(leadCapture, ["open_leads", "total", "count"]) ?? leadItems.length)} icon={MessageSquare} />
        <MetricCard label="Sin imagen" value={formatNumber(first(marketplaceSummary, ["missing_images", "products_without_image", "missing"]))} icon={ImageOff} />
      </div>

      <OpsQaCommandCenter
        playbook={opsQa}
        error={opsQaError}
        results={opsQaResults}
        runningCheckId={runningOpsQaCheck}
        onRunCheck={runOpsQaCheck}
      />

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="h-fit border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Modulos</CardTitle>
            <CardDescription>Menu operativo del tenant.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {modules.map((module, index) => {
              const id = String(module.id || `module_${index + 1}`);
              const Icon = MODULE_ICONS[id] || Database;
              const selected = activeModule === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveModule(id)}
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                    selected ? "border-primary bg-primary/10 text-primary" : "border-border/60 hover:bg-muted/50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {String(module.label || module.title || id)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-5">
          {["widget_whatsapp", "whatsapp", "channels"].includes(activeModule) ? (
            <WhatsappOperationsHub
              tenantSlug={effectiveSlug}
              initialExperience={whatsappExperience ?? bundle.whatsapp}
            />
          ) : null}

          {activeModule === "marketplace" ? (
            <CatalogQualityCommandCenter tenantSlug={effectiveSlug} marketplace={marketplace} />
          ) : null}

          {activeModule === "employees" ? (
            <EmployeeRoutingMatrix tenantSlug={effectiveSlug} />
          ) : null}

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">
                {String(modules.find((item) => item.id === activeModule)?.label || "Resumen operativo")}
              </CardTitle>
              <CardDescription>
                Estados, vistas y acciones se actualizan desde la configuracion del tenant.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeModuleConfig ? (
                <ModuleContractSummary module={activeModuleConfig} />
              ) : null}
              <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-border/60 p-4">
                <div className="mb-3 flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Readiness
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(readinessChecks).length ? (
                    Object.entries(readinessChecks).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                        <span>{key.replace(/_/g, " ")}</span>
                        <StatePill value={value ? "OK" : "Pendiente"} tone={value ? "ready" : "warning"} />
                      </div>
                    ))
                  ) : (
                    <EmptyPanel label="Sin checks de readiness en el bundle." />
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 p-4">
                <div className="mb-3 flex items-center gap-2 font-semibold">
                  <MapPinned className="h-4 w-4 text-primary" />
                  Operaciones
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between rounded-lg border px-3 py-2">
                    <span>Freshness</span>
                    <StatePill value={freshnessStatus} tone={freshnessStatus === "empty" ? "danger" : freshnessStatus === "degraded" ? "warning" : "ready"} />
                  </div>
                  <div className="flex justify-between rounded-lg border px-3 py-2">
                    <span>Heatmap</span>
                    <span>{canRenderHeatmap === false ? "Sin datos" : "Listo"}</span>
                  </div>
                  <div className="flex justify-between rounded-lg border px-3 py-2">
                    <span>Refresh</span>
                    <span>{String(first(bundle.frontend_contract, ["primary_refresh_seconds"]) || 30)}s</span>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 p-4">
                <div className="mb-3 flex items-center gap-2 font-semibold">
                  <Store className="h-4 w-4 text-primary" />
                  Marketplace
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <MetricCard label="Con imagen" value={formatNumber(first(marketplaceSummary, ["with_images", "products_with_image"]))} icon={CheckCircle2} />
                  <MetricCard label="Sin imagen" value={formatNumber(first(marketplaceSummary, ["missing_images", "products_without_image"]))} icon={ImageOff} />
                  <MetricCard label="Bulk" value={first(marketplace, ["media_capabilities", "bulk_import"]) ? "Activo" : "—"} icon={Database} />
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 p-4">
                <div className="mb-3 flex items-center gap-2 font-semibold">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Encuestas y leads
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <MetricCard label="Respuestas" value={formatNumber(first(surveySummary, ["responses", "survey_responses"]))} icon={MessageSquare} />
                  <MetricCard label="Votos live" value={formatNumber(first(surveySummary, ["votaciones_live", "live_votes"]))} icon={Activity} />
                  <MetricCard label="Leads abiertos" value={formatNumber(first(leadCapture, ["open_leads", "open"]))} icon={Inbox} />
                </div>
              </div>
              </div>
            </CardContent>
          </Card>

          {leadItems.length ? (
            <Card className="border-border/60">
              <CardHeader className="gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MailCheck className="h-4 w-4 text-primary" />
                    Lead capture / Inbox 360
                  </CardTitle>
                  <CardDescription>
                    Drawer operativo con contacto, origen, intención y próximo paso desde lead_capture.items[].
                  </CardDescription>
                </div>
                <StatePill value={`${leadItems.length} items`} tone="ready" />
              </CardHeader>
              <CardContent className="grid gap-2">
                {leadItems.slice(0, 6).map((lead, index) => {
                  const contact = isRecord(lead.contact) ? lead.contact : {};
                  const label = readLeadLabel(lead, index);
                  return (
                    <button
                      key={String(first(lead, ["id", "ticket_id"]) || index)}
                      type="button"
                      onClick={() => setSelectedLead(lead)}
                      className="grid gap-3 rounded-[8px] border border-border/60 bg-background p-3 text-left transition hover:border-primary/40 hover:bg-primary/5 md:grid-cols-[1fr_auto]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-semibold">{label}</span>
                          <StatePill value={String(first(lead, ["status", "estado"]) || "nuevo")} />
                          {first(lead, ["channel", "canal"]) ? <StatePill value={String(first(lead, ["channel", "canal"]))} /> : null}
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {String(first(contact, ["name", "nombre", "email", "phone"]) || first(lead, ["intent", "next_action"]) || "Sin detalle adicional")}
                        </p>
                      </div>
                      <div className="text-xs font-medium text-primary">
                        Abrir 360
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          {educationProfile.is_education || educationPanelSections.length || educationMediaInputs.length ? (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Educacion</CardTitle>
                <CardDescription>Secciones escolares configuradas para este tenant.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {educationMediaInputs.length ? (
                  <div className="rounded-2xl border border-border/60 p-4">
                    <div className="mb-3 text-sm font-semibold">Media inputs</div>
                    <div className="flex flex-wrap gap-2">
                      {educationMediaInputs.map((input) => (
                        <StatePill key={input} value={input} />
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {educationPanelSections.map((section, index) => (
                    <div key={String(section.id || index)} className="rounded-2xl border p-4">
                      <div className="font-semibold">{String(section.label || section.title || section.id || "Seccion")}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{String(section.route || section.endpoint || section.status || "Disponible en el panel")}</div>
                      <ModuleContractSummary module={section} compact />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Sheet open={Boolean(selectedLead)} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-[720px]">
          <SheetHeader className="border-b bg-muted/20 p-5 text-left">
            <SheetTitle>Lead 360</SheetTitle>
            <SheetDescription>
              Vista compacta para soporte, ventas o mesa de entrada.
            </SheetDescription>
          </SheetHeader>
          {selectedLead && selectedLeadTicket && selectedLeadTicketId ? (
            <div className="h-[calc(100vh-92px)] min-h-[520px]">
              <TicketConversationPane
                ticketId={String(selectedLeadTicketId)}
                ticket={selectedLeadTicket}
                tenantSlug={effectiveSlug}
                onActionComplete={loadBundle}
              />
            </div>
          ) : selectedLead ? (
            <div className="space-y-4 p-5">
              <div className="rounded-[8px] border bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Resumen</p>
                <h3 className="mt-2 text-xl font-black tracking-tight">{readLeadLabel(selectedLead, 0)}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatePill value={String(first(selectedLead, ["status", "estado"]) || "nuevo")} />
                  <StatePill value={String(first(selectedLead, ["channel", "canal"]) || "canal")} />
                  <StatePill value={`Ticket ${String(first(selectedLead, ["ticket_id", "id"]) || "—")}`} />
                </div>
              </div>

              <LeadDetailBlock
                title="Contacto"
                record={isRecord(selectedLead.contact) ? selectedLead.contact : selectedLead}
                keys={["name", "nombre", "email", "phone", "telefono", "whatsapp"]}
              />
              <LeadDetailBlock
                title="Operación"
                record={selectedLead}
                keys={["intent", "next_action", "created_at", "source", "origin"]}
              />

              {isRecord(selectedLead.source_metadata) ? (
                <LeadDetailBlock
                  title="Metadata"
                  record={selectedLead.source_metadata}
                  keys={["origin", "channel", "demo_session_id", "widget_id", "contact_key"]}
                />
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </section>
  );
}

const LeadDetailBlock = ({
  title,
  record,
  keys,
}: {
  title: string;
  record: AnyRecord;
  keys: string[];
}) => (
  <div className="rounded-[8px] border bg-background p-4">
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</p>
    <div className="mt-3 space-y-2">
      {keys.map((key) => (
        <div key={key} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 text-sm">
          <span className="text-muted-foreground">{key.replace(/_/g, " ")}</span>
          <span className="min-w-0 truncate font-medium">{renderRecordValue(record[key])}</span>
        </div>
      ))}
    </div>
  </div>
);

const qaTone = (status?: string | null, ok?: boolean): "ready" | "warning" | "danger" | "neutral" => {
  const normalized = String(status || "").toLowerCase();
  if (ok || normalized === "pass" || normalized === "ready") return "ready";
  if (["fail", "critical", "blocked", "danger"].includes(normalized)) return "danger";
  if (["warning", "degraded"].includes(normalized)) return "warning";
  return "neutral";
};

const OpsQaCommandCenter = ({
  playbook,
  error,
  results,
  runningCheckId,
  onRunCheck,
}: {
  playbook: TenantOpsQaPlaybookV2 | null;
  error: string | null;
  results: Record<string, TenantOpsQaExecutionV2>;
  runningCheckId: string | null;
  onRunCheck: (checkId: string) => void;
}) => {
  if (!playbook && !error) return null;

  const summary = playbook?.summary ?? {};
  const checks = playbook?.checks ?? [];
  const critical = checks.filter((check) => !check.ok && String(check.severity || "").toLowerCase() === "critical");
  const visibleChecks = [...critical, ...checks.filter((check) => !critical.some((item) => item.id === check.id))].slice(0, 8);

  return (
    <section className="rounded-[28px] border border-border/60 bg-background/90 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-black tracking-tight">QA operativo del tenant</h2>
              <p className="text-sm text-muted-foreground">
                Validacion segura de WhatsApp, widget, reclamos, pedidos, encuestas, mapas y ruteo.
              </p>
            </div>
          </div>
        </div>
        {playbook ? (
          <div className="flex flex-wrap gap-2">
            <StatePill value={`Score ${formatScore(playbook.score)}`} tone={qaTone(playbook.status, playbook.status === "pass")} />
            <StatePill value={String(playbook.status || "sin estado")} tone={qaTone(playbook.status, playbook.status === "pass")} />
            <StatePill value={playbook.safe_by_default ? "Read-only" : "Revisar"} tone={playbook.safe_by_default ? "ready" : "warning"} />
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      {playbook ? (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <MetricCard label="Checks" value={formatNumber(first(summary, ["checks_total", "total"]))} icon={CheckCircle2} />
            <MetricCard label="Pasaron" value={formatNumber(first(summary, ["passed", "ok"]))} icon={ShieldCheck} />
            <MetricCard label="Warnings" value={formatNumber(first(summary, ["warnings"]))} icon={AlertTriangle} />
            <MetricCard label="Criticos" value={formatNumber(first(summary, ["critical_failed"]))} icon={AlertTriangle} />
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {visibleChecks.map((check) => {
              const result = results[check.id];
              const isRunning = runningCheckId === check.id;
              return (
                <div key={check.id} className="rounded-[8px] border border-border/60 bg-background p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-foreground">{check.label}</h3>
                        <StatePill value={check.status || (check.ok ? "pass" : "warning")} tone={qaTone(check.status, check.ok)} />
                      </div>
                      <p className="mt-1 break-all text-xs text-muted-foreground">
                        {check.endpoint || check.next_action || check.id}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={check.ok ? "outline" : "default"}
                      disabled={Boolean(runningCheckId)}
                      onClick={() => onRunCheck(check.id)}
                    >
                      {isRunning ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
                      Probar
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <ContractLine label="Accion" value={String(check.next_action || "continue")} />
                    <ContractLine label="Modo" value="read_only" />
                  </div>
                  {result ? (
                    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatePill value={result.status || (result.ok ? "pass" : "warning")} tone={qaTone(result.status, result.ok)} />
                        <span className="font-semibold text-foreground">Resultado ejecutado</span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {String(result.next_action || "Sin accion siguiente")} · Score {formatScore(result.playbook_score)}
                      </p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
};

const ModuleContractSummary = ({
  module,
  compact = false,
}: {
  module: AnyRecord;
  compact?: boolean;
}) => {
  const secondaryEndpoints = asArray(module.secondary_endpoints);
  const widgets = asArray(module.widgets);
  const endpoint = asString(module.endpoint).trim();
  const route = asString(module.route).trim();

  if (!endpoint && !route && !secondaryEndpoints.length && !widgets.length) {
    return null;
  }

  return (
    <div className={compact ? "mt-3 space-y-2 text-xs" : "rounded-2xl border border-border/60 bg-muted/10 p-4 text-sm"}>
      {!compact ? (
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Contrato del modulo
        </div>
      ) : null}
      <div className="grid gap-2 md:grid-cols-2">
        {route ? <ContractLine label="Route" value={route} /> : null}
        {endpoint ? <ContractLine label="Endpoint" value={endpoint} /> : null}
      </div>
      {secondaryEndpoints.length ? (
        <div className="mt-3">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">Secondary endpoints</div>
          <div className="flex flex-wrap gap-2">
            {secondaryEndpoints.map((item, index) => (
              <StatePill
                key={`${asString(first(item, ["id", "endpoint", "route", "label"])) || "endpoint"}-${index}`}
                value={asString(first(item, ["label", "endpoint", "route", "id"])) || `endpoint_${index + 1}`}
              />
            ))}
          </div>
        </div>
      ) : null}
      {widgets.length ? (
        <div className="mt-3">
          <div className="mb-2 text-xs font-semibold text-muted-foreground">Widgets</div>
          <div className="flex flex-wrap gap-2">
            {widgets.map((item, index) => (
              <StatePill
                key={`${asString(first(item, ["id", "label", "type"])) || "widget"}-${index}`}
                value={asString(first(item, ["label", "id", "type"])) || `widget_${index + 1}`}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const ContractLine = ({ label, value }: { label: string; value: string }) => (
  <div className="grid min-w-0 gap-1 rounded-[8px] border bg-background px-3 py-2">
    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
    <span className="truncate font-medium text-foreground">{value}</span>
  </div>
);
