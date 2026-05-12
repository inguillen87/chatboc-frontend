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
  getTenantAdminExperienceV2,
  type TenantAdminExperienceV2,
} from "@/api/v2/saas";
import CatalogQualityCommandCenter from "@/components/admin/CatalogQualityCommandCenter";
import EmployeeRoutingMatrix from "@/components/admin/EmployeeRoutingMatrix";
import WhatsappOperationsHub from "@/components/admin/WhatsappOperationsHub";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTenant } from "@/context/TenantContext";
import { getErrorMessage } from "@/utils/api";

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

const isRecord = (value: unknown): value is AnyRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asArray = (value: unknown): AnyRecord[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

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

const renderRecordValue = (value: unknown) => {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export default function TenantAdminOperatingSystem({ tenantSlug }: { tenantSlug?: string | null }) {
  const { currentSlug } = useTenant();
  const effectiveSlug = tenantSlug || currentSlug;
  const [bundle, setBundle] = useState<TenantAdminExperienceV2 | null>(null);
  const [activeModule, setActiveModule] = useState<string>("summary");
  const [selectedLead, setSelectedLead] = useState<AnyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBundle = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getTenantAdminExperienceV2(effectiveSlug);
      setBundle(response);
      const firstModule = response.modules[0]?.id;
      setActiveModule(typeof firstModule === "string" ? firstModule : "summary");
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo cargar el perfil operativo del tenant."));
      setBundle(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBundle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSlug]);

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
    const backendModules = bundle?.modules ?? [];
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

  const readinessChecks = isRecord(readiness.checks) ? readiness.checks : {};
  const freshnessStatus = String(freshness.status || first(freshness, ["state", "reason_code"]) || "ready");
  const healthScore = first(bundle?.health, ["score", "health_score"]) ?? first(profile, ["health_score", "score"]);
  const readinessScore = first(readiness, ["score", "readiness_score"]);

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
            <CardContent className="grid gap-4 lg:grid-cols-2">
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
                    <span>{first(freshness, ["summary", "can_render_heatmap"]) === false ? "Sin datos" : "Listo"}</span>
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

          {educationProfile.is_education || asArray(first(education, ["admin_menu", "panel_sections"])).length ? (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Educacion</CardTitle>
                <CardDescription>Secciones escolares configuradas para este tenant.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {asArray(first(education, ["admin_menu", "panel_sections"])).map((section, index) => (
                  <div key={String(section.id || index)} className="rounded-2xl border p-4">
                    <div className="font-semibold">{String(section.label || section.title || section.id || "Seccion")}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{String(section.route || section.status || "Disponible en el panel")}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <Sheet open={Boolean(selectedLead)} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-[420px]">
          <SheetHeader className="border-b bg-muted/20 p-5 text-left">
            <SheetTitle>Lead 360</SheetTitle>
            <SheetDescription>
              Vista compacta para soporte, ventas o mesa de entrada.
            </SheetDescription>
          </SheetHeader>
          {selectedLead ? (
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
