import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  ImageIcon,
  Link2,
  MapPinned,
  MessageCircle,
  Mic,
  PackageCheck,
  PhoneCall,
  RefreshCw,
  Route,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";

import {
  getWhatsappExperienceV2,
  normalizeWhatsappExperienceV2,
  type WhatsappExperienceV2,
} from "@/api/v2/saas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { apiFetch, getErrorMessage } from "@/utils/api";

type AnyRecord = Record<string, any>;

const INPUT_ICONS: Record<string, React.ElementType> = {
  text: MessageCircle,
  emoji: Sparkles,
  location: MapPinned,
  image: ImageIcon,
  audio_note: Mic,
  audio: Mic,
  file_pdf_doc: FileText,
  file: FileText,
  video: Video,
};

const MODULE_ICONS: Record<string, React.ElementType> = {
  catalog: PackageCheck,
  surveys_votings: MessageCircle,
  news_events: FileText,
  promotions: Sparkles,
  links: Link2,
};

const isRecord = (value: unknown): value is AnyRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asRecord = (value: unknown): AnyRecord => (isRecord(value) ? value : {});

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const first = (record: AnyRecord | undefined | null, keys: string[]) => {
  if (!record) return undefined;
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const boolish = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "si", "on", "enabled"].includes(normalized)) return true;
    if (["false", "0", "no", "off", "disabled"].includes(normalized)) return false;
  }
  return false;
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
  return numeric === null ? "-" : numeric.toLocaleString("es-AR");
};

const formatKey = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());

const labelFrom = (record: AnyRecord, fallback: string) =>
  String(first(record, ["label", "title", "name", "nombre", "display_name"]) || formatKey(fallback));

const readText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

const appendTenantToEndpoint = (endpoint: string, tenantSlug?: string | null) => {
  if (!tenantSlug || endpoint.includes("tenant_slug=") || endpoint.includes("tenant=")) {
    return endpoint;
  }
  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}tenant_slug=${encodeURIComponent(tenantSlug)}`;
};

const readLatLng = (...sources: unknown[]) => {
  for (const source of sources) {
    const record = asRecord(source);
    const lat = asNumber(first(record, ["lat", "latitude"]));
    const lng = asNumber(first(record, ["lng", "lon", "longitude"]));
    if (lat !== null && lng !== null) return { lat, lng };
  }
  return null;
};

const buildTrackingExperienceEndpoint = ({
  template,
  kind,
  code,
  pin,
  tenantSlug,
}: {
  template?: unknown;
  kind: "claim" | "order";
  code: string;
  pin?: string;
  tenantSlug?: string | null;
}) => {
  const rawTemplate =
    readText(template) ||
    `/api/public/tracking/experience?kind=${kind}&code={code}${kind === "claim" ? "&pin={pin}" : ""}`;
  const endpoint = rawTemplate
    .replace(/\{kind\}/g, encodeURIComponent(kind))
    .replace(/\{code\}/g, encodeURIComponent(code))
    .replace(/\{nro_ticket\}/g, encodeURIComponent(code))
    .replace(/\{nro_pedido\}/g, encodeURIComponent(code))
    .replace(/\{pin\}/g, encodeURIComponent(pin || ""));
  return appendTenantToEndpoint(endpoint, tenantSlug);
};

const StatusPill = ({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
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
      {children}
    </span>
  );
};

const EndpointLine = ({ label, value }: { label: string; value?: unknown }) => {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 break-all font-mono text-xs text-foreground">{String(value)}</p>
    </div>
  );
};

const EmptyState = ({ reason }: { reason?: unknown }) => (
  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
    <div className="flex items-center gap-2 font-semibold text-foreground">
      <Settings2 className="h-4 w-4" />
      Setup pendiente
    </div>
    <p className="mt-2">
      {reason ? String(reason) : "El canal todavia no envio datos operativos completos."}
    </p>
  </div>
);

const CapabilityTile = ({
  icon: Icon,
  label,
  detail,
  enabled,
  endpoint,
}: {
  icon: React.ElementType;
  label: string;
  detail?: React.ReactNode;
  enabled: boolean;
  endpoint?: unknown;
}) => (
  <div className="rounded-2xl border border-border/60 bg-background/80 p-3 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-2">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <StatusPill tone={enabled ? "ready" : "neutral"}>{enabled ? "Activo" : "Oculto"}</StatusPill>
    </div>
    <p className="font-semibold text-foreground">{label}</p>
    {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    {endpoint ? <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">{String(endpoint)}</p> : null}
  </div>
);

const SetupChecklist = ({ experience }: { experience: WhatsappExperienceV2 }) => {
  const channel = experience.channel;
  const rules = experience.enterprise_rules;
  const modules = experience.content_modules;
  const tracking = experience.tracking;
  const claims = asRecord(tracking.claims);
  const orders = asRecord(tracking.orders);
  const intelligence = experience.conversation_intelligence;

  const checks = [
    {
      id: "number",
      label: "Numero del canal",
      ok: Boolean(first(channel, ["number", "phone_number", "sender_id"])),
      detail: first(channel, ["number", "phone_number", "sender_id"]) || channel.reason_code,
    },
    {
      id: "webhook",
      label: "Webhook publico",
      ok: Boolean(channel.webhook),
      detail: channel.webhook,
    },
    {
      id: "enterprise",
      label: "Reglas enterprise",
      ok: boolish(rules.configured),
      detail: first(rules, ["reason_code", "status", "window_policy"]) || "enterprise_rules.configured",
    },
    {
      id: "inputs",
      label: "Entradas multimodales",
      ok: Object.values(asRecord(intelligence.inputs)).some((value) => boolish(asRecord(value).enabled)),
      detail: "conversation_intelligence.inputs",
    },
    {
      id: "content",
      label: "Modulos de contenido",
      ok: Object.values(modules).some((value) => boolish(asRecord(value).enabled)),
      detail: "catalogo, encuestas, novedades o links",
    },
    {
      id: "tracking",
      label: "Tracking publico",
      ok: Boolean(claims.experience_endpoint || orders.experience_endpoint),
      detail: claims.experience_endpoint || orders.experience_endpoint,
    },
  ];
  const completed = checks.filter((check) => check.ok).length;

  return (
    <Card className="border-amber-200 bg-amber-50/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-amber-950">
          <AlertTriangle className="h-4 w-4" />
          Checklist de configuracion
        </CardTitle>
        <CardDescription className="text-amber-900/80">
          El canal no esta activo; se muestra una configuracion segura para completar la conexion.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-amber-900/80">
            <span>Readiness</span>
            <span>
              {completed}/{checks.length}
            </span>
          </div>
          <Progress value={(completed / checks.length) * 100} className="h-2 bg-amber-100" />
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {checks.map((check) => (
            <div key={check.id} className="rounded-2xl border border-amber-200 bg-background/80 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{check.label}</p>
                {check.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                )}
              </div>
              {check.detail ? <p className="break-all text-xs text-muted-foreground">{String(check.detail)}</p> : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const ChannelHealth = ({
  experience,
  tenantSlug,
}: {
  experience: WhatsappExperienceV2;
  tenantSlug?: string | null;
}) => {
  const channel = experience.channel;
  const enabled = boolish(channel.enabled);
  const tone = enabled ? "ready" : "warning";
  const testEndpoint = readText(first(channel, ["test_endpoint", "healthcheck_endpoint", "test_action_endpoint"]));
  const testMethod = readText(first(channel, ["test_method", "healthcheck_method"])) || "POST";
  const testLabel = readText(first(channel, ["test_label", "test_button_label", "healthcheck_label"]));
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTestChannel = async () => {
    if (!testEndpoint) return;
    setTesting(true);
    setTestResult(null);
    try {
      const response = await apiFetch<unknown>(appendTenantToEndpoint(testEndpoint, tenantSlug), {
        method: testMethod.toUpperCase() === "GET" ? "GET" : "POST",
        tenantSlug: tenantSlug || undefined,
      });
      const record = asRecord(response);
      setTestResult(String(first(record, ["message", "status", "reason_code", "request_id"]) || "ok"));
    } catch (err) {
      setTestResult(getErrorMessage(err, "No se pudo probar el canal."));
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4 text-primary" />
              Estado del canal
            </CardTitle>
            <CardDescription>{String(first(channel, ["provider", "status", "reason_code"]) || "Canal WhatsApp")}</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={tone}>{enabled ? "Conectado" : "Configurar"}</StatusPill>
            {testEndpoint ? (
              <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={handleTestChannel} disabled={testing}>
                {testing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                {testLabel || "Probar canal"}
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <EndpointLine label="Numero" value={first(channel, ["number", "phone_number", "sender_id"])} />
          <EndpointLine label="Webhook" value={channel.webhook} />
          <EndpointLine label="Status webhook" value={channel.status_webhook} />
          <EndpointLine label="Reason code" value={channel.reason_code} />
        </div>
        {testResult ? (
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {testResult}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

const EnterpriseRules = ({ experience }: { experience: WhatsappExperienceV2 }) => {
  const rules = experience.enterprise_rules;
  const window = experience.contact_window;
  const quietHours = asRecord(rules.quiet_hours);
  const blockedKeywords = asArray(rules.blocked_keywords);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Reglas enterprise
          </CardTitle>
          <CardDescription>Limites y politica de salida configurados para este canal.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <Metric label="Configured" value={boolish(rules.configured) ? "Si" : "No"} tone={boolish(rules.configured) ? "ready" : "warning"} />
          <Metric label="Templates 24h" value={boolish(rules.enforce_template_outside_24h) ? "Activo" : "Libre"} />
          <Metric label="Max outbound/h" value={formatNumber(rules.max_outbound_per_hour)} />
          <Metric label="Quiet hours" value={`${quietHours.start ?? "-"}-${quietHours.end ?? "-"}`} />
          <Metric label="Blocked keywords" value={formatNumber(blockedKeywords.length)} />
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock3 className="h-4 w-4 text-primary" />
            Ventana de contacto
          </CardTitle>
          <CardDescription>{String(window.window_policy || "Politica de conversacion")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <Metric label="Activas 24h" value={formatNumber(window.active_24h)} tone="ready" />
          <Metric label="Contactos conocidos" value={formatNumber(window.known_contacts)} />
        </CardContent>
      </Card>
    </div>
  );
};

const Metric = ({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "ready" | "warning" | "danger" | "neutral";
}) => (
  <div className="rounded-xl border border-border/60 bg-background/80 p-3">
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    <div className="mt-2">
      <StatusPill tone={tone}>{value}</StatusPill>
    </div>
  </div>
);

const ConversationCapabilities = ({ experience }: { experience: WhatsappExperienceV2 }) => {
  const intelligence = experience.conversation_intelligence;
  const inputs = asRecord(intelligence.inputs);
  const voiceCalls = asRecord(intelligence.voice_calls);
  const voiceCapabilities = asRecord(voiceCalls.capabilities);
  const modules = experience.content_modules;
  const tracking = experience.tracking;
  const claims = asRecord(tracking.claims);
  const orders = asRecord(tracking.orders);
  const canRenderVoice =
    boolish(voiceCalls.enabled) &&
    boolish(voiceCapabilities.native_speech_to_speech);
  const actionCapabilities = [
    modules.catalog
      ? {
          id: "catalog",
          icon: MODULE_ICONS.catalog || PackageCheck,
          label: labelFrom(asRecord(modules.catalog), "catalog"),
          detail: first(asRecord(modules.catalog), ["items", "image_coverage_rate"]) !== undefined
            ? `${formatNumber(first(asRecord(modules.catalog), ["items", "items_with_images"]))} items`
            : undefined,
          enabled: boolish(asRecord(modules.catalog).enabled),
          endpoint: asRecord(modules.catalog).endpoint,
        }
      : null,
    modules.surveys_votings
      ? {
          id: "surveys_votings",
          icon: MODULE_ICONS.surveys_votings || MessageCircle,
          label: labelFrom(asRecord(modules.surveys_votings), "surveys_votings"),
          detail: asRecord(modules.surveys_votings).draft_endpoint ? "draft_endpoint" : undefined,
          enabled: boolish(asRecord(modules.surveys_votings).enabled),
          endpoint: asRecord(modules.surveys_votings).endpoint,
        }
      : null,
    claims.experience_endpoint
      ? {
          id: "claims",
          icon: Route,
          label: labelFrom(claims, "claims"),
          detail: claims.public_status_alias || claims.public_status_endpoint || "tracking",
          enabled: true,
          endpoint: claims.experience_endpoint,
        }
      : null,
    orders.experience_endpoint
      ? {
          id: "orders",
          icon: PackageCheck,
          label: labelFrom(orders, "orders"),
          detail: orders.payment_status_endpoint || "tracking",
          enabled: true,
          endpoint: orders.experience_endpoint,
        }
      : null,
    canRenderVoice
      ? {
          id: "voice_calls",
          icon: PhoneCall,
          label: labelFrom(voiceCalls, "voice_calls"),
          detail: voiceCapabilities.recommended_model || voiceCapabilities.contract_version || "native_speech_to_speech",
          enabled: true,
          endpoint: first(voiceCalls, ["endpoint", "session_endpoint"]) || first(voiceCapabilities, ["session_endpoint"]),
        }
      : null,
  ].filter(Boolean) as Array<{
    id: string;
    icon: React.ElementType;
    label: string;
    detail?: React.ReactNode;
    enabled: boolean;
    endpoint?: unknown;
  }>;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              Inteligencia conversacional
            </CardTitle>
            <CardDescription>
              {String(first(asRecord(intelligence.llm_strategy), ["primary", "python_role"]) || "conversation_intelligence")}
            </CardDescription>
          </div>
          {canRenderVoice ? (
            <div className="inline-flex items-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm">
              <PhoneCall className="mr-2 h-4 w-4" />
              Voz realtime
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {Object.entries(inputs).map(([key, value]) => {
            const input = asRecord(value);
            const Icon = INPUT_ICONS[key] || MessageCircle;
            const enabled = boolish(input.enabled);
            const videoNotReady = key === "video" && input.analysis_ready === false;
            return (
              <CapabilityTile
                key={key}
                icon={Icon}
                label={labelFrom(input, key)}
                detail={videoNotReady ? "Adjunto recibido; analisis IA pendiente." : first(input, ["payload_key", "endpoint", "provider"])}
                enabled={enabled}
                endpoint={first(input, ["endpoint", "upload_endpoint"])}
              />
            );
          })}
        </div>

        {actionCapabilities.length ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Acciones operativas</p>
                <p className="text-xs text-muted-foreground">Capacidades que WhatsApp puede activar cuando esten disponibles.</p>
              </div>
              <StatusPill>{actionCapabilities.length}</StatusPill>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {actionCapabilities.map((item) => (
                <CapabilityTile
                  key={item.id}
                  icon={item.icon}
                  label={item.label}
                  detail={item.detail}
                  enabled={item.enabled}
                  endpoint={item.endpoint}
                />
              ))}
            </div>
          </div>
        ) : null}

        {canRenderVoice ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone="ready">{String(voiceCapabilities.recommended_model || "gpt-realtime")}</StatusPill>
              <StatusPill tone="ready">{String(voiceCapabilities.voice || "voice")}</StatusPill>
              <StatusPill tone="ready">Speech-to-speech</StatusPill>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

const ContentModules = ({ experience }: { experience: WhatsappExperienceV2 }) => {
  const modules = experience.content_modules;
  const catalog = asRecord(modules.catalog);
  const imageCoverage = asNumber(catalog.image_coverage_rate);
  const lowCoverage = imageCoverage !== null && imageCoverage < 80;
  const catalogTasks = [
    {
      id: "upload_image",
      label: "Subir imagen",
      detail: "Producto sin imagen",
      endpoint: catalog.endpoint,
      icon: ImageIcon,
    },
    {
      id: "replace_image",
      label: "Reemplazar imagen",
      detail: "Galeria o principal",
      endpoint: catalog.endpoint,
      icon: ImageIcon,
    },
    {
      id: "bulk_import",
      label: "Importar CSV/XLSX/PDF",
      detail: "Bulk import",
      endpoint: catalog.bulk_import_endpoint,
      icon: FileText,
    },
    {
      id: "pdf_catalog",
      label: "Generar catalogo PDF",
      detail: "Material comercial",
      endpoint: first(catalog, ["pdf_catalog_endpoint", "catalog_pdf_endpoint", "pdf_endpoint"]),
      icon: PackageCheck,
    },
  ].filter((task) => task.endpoint);

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageCheck className="h-4 w-4 text-primary" />
          Modulos de contenido
        </CardTitle>
        <CardDescription>Catalogo, encuestas, novedades, promociones y links configurables.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {Object.entries(modules).map(([key, value]) => {
            const module = asRecord(value);
            const Icon = MODULE_ICONS[key] || Link2;
            const enabled = boolish(module.enabled);
            return (
              <div key={key} className="rounded-2xl border border-border/60 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <StatusPill tone={enabled ? "ready" : "neutral"}>{enabled ? "Activo" : "Off"}</StatusPill>
                </div>
                <p className="font-semibold text-foreground">{labelFrom(module, key)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{String(first(module, ["description", "status", "state"]) || "Listo para configurar")}</p>
                {module.items !== undefined ? <p className="mt-2 text-xs text-muted-foreground">{formatNumber(module.items)} items</p> : null}
              </div>
            );
          })}
        </div>

        {lowCoverage ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Cobertura de imagen baja
            </div>
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-amber-900/80">
                <span>Image coverage</span>
                <span>{imageCoverage}%</span>
              </div>
              <Progress value={imageCoverage} className="h-2 bg-amber-100" />
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {catalogTasks.length ? (
                catalogTasks.map((task) => {
                  const Icon = task.icon;
                  return (
                    <a
                      key={task.id}
                      href={String(task.endpoint)}
                      className="rounded-2xl border border-amber-200 bg-background/85 p-3 text-foreground transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-sm"
                    >
                      <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="text-sm font-semibold">{task.label}</p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">{task.detail}</p>
                    </a>
                  );
                })
              ) : (
                <>
                  <EndpointLine label="Imagenes" value={`${imageCoverage}%`} />
                  <EndpointLine label="Editor catalogo" value={catalog.endpoint} />
                  <EndpointLine label="Bulk import" value={catalog.bulk_import_endpoint} />
                </>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

const toneForSeverity = (severity: unknown): "ready" | "warning" | "danger" | "neutral" => {
  const value = String(severity || "").toLowerCase();
  if (value === "blocking") return "danger";
  if (value === "warning" || value === "ready_with_dependency") return "warning";
  if (value === "ready") return "ready";
  return "neutral";
};

const toneForQaStatus = (status: unknown): "ready" | "warning" | "danger" | "neutral" => {
  const value = String(status || "").toLowerCase();
  if (value === "ready") return "ready";
  if (value.includes("blocked")) return "danger";
  if (value.includes("review") || value.includes("pending") || value.includes("needs")) return "warning";
  return "neutral";
};

const TemplateBlueprintPanel = ({
  experience,
  tenantSlug,
}: {
  experience: WhatsappExperienceV2;
  tenantSlug?: string | null;
}) => {
  const blueprint = experience.template_blueprint;
  const summary = asRecord(blueprint.registry_summary);
  const nextActions = asArray(blueprint.next_actions).map(asRecord);
  const groups: AnyRecord[] = Object.entries(asRecord(blueprint.operational_template_groups)).map(([id, value]) => ({
    id,
    ...asRecord(value),
  }));
  const metaStrategy = asRecord(blueprint.meta_business_strategy);
  const creationManifest = asRecord(blueprint.creation_manifest);
  const creationItems = asArray(creationManifest.items).map(asRecord);
  const creationTypes = asRecord(creationManifest.by_twilio_type);
  const creationFamilies = asRecord(creationManifest.by_content_family);
  const webview = experience.webview_blueprint;
  const webviewSecurity = asRecord(webview.security);
  const webviewSummary = asRecord(webview.summary);
  const webviewFlows = asArray(webview.flows).map(asRecord);
  const qaPlaybook = experience.qa_playbook;
  const qaScenarios = asArray(qaPlaybook.scenarios).map(asRecord);
  const [syncingTemplateId, setSyncingTemplateId] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, string>>({});

  const handleTemplateSync = async (templateId: string, mode: "dry" | "execute" | "refresh") => {
    if (!templateId) return;
    setSyncingTemplateId(`${templateId}:${mode}`);
    setSyncResults((current) => ({ ...current, [templateId]: "" }));
    try {
      const endpoint =
        mode === "refresh"
          ? "/api/admin/templates/twilio-content/refresh"
          : "/api/admin/templates/twilio-content/sync";
      const response = await apiFetch<unknown>(
        appendTenantToEndpoint(endpoint, tenantSlug),
        {
          method: "POST",
          tenantSlug: tenantSlug || undefined,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_id: templateId,
            dry_run: mode === "dry",
            submit_for_approval: true,
          }),
        },
      );
      const record = asRecord(response);
      const registry = asRecord(record.registry);
      const contentSid = readText(record.content_sid) || readText(registry.content_sid);
      const approvalStatus = readText(record.approval_status) || readText(registry.status);
      const message =
        mode === "dry"
          ? "Payload validado contra el manifiesto Twilio."
          : mode === "refresh"
            ? `Estado actualizado: ${approvalStatus || "sin estado"}${contentSid ? ` (${contentSid})` : ""}`
            : contentSid
              ? `ContentSid registrado: ${contentSid}`
              : "Plantilla sincronizada.";
      setSyncResults((current) => ({ ...current, [templateId]: message }));
    } catch (err) {
      setSyncResults((current) => ({
        ...current,
        [templateId]: getErrorMessage(err, "No se pudo sincronizar la plantilla."),
      }));
    } finally {
      setSyncingTemplateId(null);
    }
  };

  if (!Object.keys(blueprint).length) return null;

  return (
    <Card className="border-border/60">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" />
              Plantillas, webviews y Meta
            </CardTitle>
            <CardDescription>{String(blueprint.provider || "twilio_content_api")}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill tone={boolish(blueprint.enabled) ? "ready" : "warning"}>
              {boolish(blueprint.enabled) ? "Canal habilitado" : "Setup pendiente"}
            </StatusPill>
            {blueprint.channel ? <StatusPill>{String(blueprint.channel)}</StatusPill> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <Metric label="Registradas" value={formatNumber(summary.total_registered)} tone="ready" />
          <Metric label="Aprobadas" value={formatNumber(summary.operational_approved)} tone="ready" />
          <Metric label="Pendientes" value={formatNumber(summary.operational_pending)} tone={asNumber(summary.operational_pending) ? "warning" : "neutral"} />
          <Metric label="Bloqueantes" value={formatNumber(summary.operational_blocking)} tone={asNumber(summary.operational_blocking) ? "danger" : "ready"} />
          <Metric label="Webviews" value={formatNumber(summary.operational_webviews)} />
          <Metric label="Flows" value={formatNumber(summary.operational_whatsapp_flow_candidates)} />
        </div>

        {nextActions.length ? (
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Próximas acciones</p>
                <p className="text-xs text-muted-foreground">Ordenadas por severidad del contrato operativo.</p>
              </div>
              <StatusPill>{nextActions.length}</StatusPill>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              {nextActions.slice(0, 6).map((action, index) => (
                <div key={`${action.id || "template"}-${index}`} className="rounded-2xl border border-border/60 bg-background/85 p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusPill tone={toneForSeverity(action.severity)}>{String(action.severity || "action")}</StatusPill>
                    {action.twilio_type ? <StatusPill>{String(action.twilio_type)}</StatusPill> : null}
                  </div>
                  <p className="text-sm font-semibold text-foreground">{String(action.friendly_name || action.id || "template")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatKey(String(action.next_action || action.state || "review"))}</p>
                  {action.content_sid ? <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">{String(action.content_sid)}</p> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {Object.keys(creationManifest).length ? (
          <div className="rounded-2xl border border-border/60 bg-background/85 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Manifiesto Twilio Content API</p>
                <p className="text-xs text-muted-foreground">
                  Payloads listos para crear, aprobar y registrar ContentSid sin depender de copiar textos a mano.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill>{formatNumber(creationManifest.templates_total)} templates</StatusPill>
                <StatusPill tone={asNumber(creationManifest.actionable_total) ? "warning" : "ready"}>
                  {formatNumber(creationManifest.actionable_total)} accionables
                </StatusPill>
              </div>
            </div>
            {Object.keys(creationTypes).length ? (
              <div className="mb-3 flex flex-wrap gap-2">
                {Object.entries(creationTypes).map(([type, count]) => (
                  <StatusPill key={type}>
                    {type}: {formatNumber(count)}
                  </StatusPill>
                ))}
                {Object.entries(creationFamilies).map(([family, count]) => (
                  <StatusPill key={family} tone={family === "cta_webview" ? "ready" : "neutral"}>
                    {formatKey(family)}: {formatNumber(count)}
                  </StatusPill>
                ))}
                {creationManifest.webview_ready_total !== undefined ? (
                  <StatusPill tone={asNumber(creationManifest.webview_ready_total) ? "ready" : "warning"}>
                    Webview ready: {formatNumber(creationManifest.webview_ready_total)}
                  </StatusPill>
                ) : null}
              </div>
            ) : null}
            {creationItems.length ? (
              <div className="grid gap-2 lg:grid-cols-2">
                {creationItems.slice(0, 4).map((item, index) => {
                  const createRequest = asRecord(item.create_request);
                  const createTypes = asRecord(createRequest.types);
                  const textType = asRecord(createTypes["twilio/text"]);
                  const approvalRequest = asRecord(item.approval_request);
                  const readiness = asRecord(item.readiness);
                  const capabilities = asRecord(item.action_capabilities);
                  const templateId = String(item.id || "");
                  const dryKey = `${templateId}:dry`;
                  const executeKey = `${templateId}:execute`;
                  return (
                    <div key={`${item.id || "manifest"}-${index}`} className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <StatusPill tone={toneForSeverity(readiness.severity)}>{formatKey(String(readiness.state || "draft"))}</StatusPill>
                        <StatusPill>{String(item.twilio_type || "twilio/text")}</StatusPill>
                        {item.content_family ? <StatusPill>{formatKey(String(item.content_family))}</StatusPill> : null}
                        {approvalRequest.category ? <StatusPill>{String(approvalRequest.category)}</StatusPill> : null}
                        {boolish(capabilities.webview_ready) ? <StatusPill tone="ready">webview</StatusPill> : null}
                        {boolish(capabilities.requires_signed_url) ? <StatusPill tone="warning">URL firmada</StatusPill> : null}
                      </div>
                      <p className="text-sm font-semibold text-foreground">
                        {String(item.friendly_name || createRequest.friendly_name || item.id || "template")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {String(item.id || "template")} · {formatKey(String(readiness.next_action || "create_template"))}
                      </p>
                      <p className="mt-2 line-clamp-2 font-mono text-[11px] text-muted-foreground">
                        {String(textType.body || "body pendiente")}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          disabled={!templateId || Boolean(syncingTemplateId)}
                          onClick={() => handleTemplateSync(templateId, "dry")}
                        >
                          {syncingTemplateId === dryKey ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                          Validar payload
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl"
                          disabled={!templateId || Boolean(syncingTemplateId)}
                          onClick={() => handleTemplateSync(templateId, "execute")}
                        >
                          {syncingTemplateId === executeKey ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                          Crear en Twilio
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          disabled={!templateId || Boolean(syncingTemplateId)}
                          onClick={() => handleTemplateSync(templateId, "refresh")}
                        >
                          {syncingTemplateId === `${templateId}:refresh` ? (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-2 h-4 w-4" />
                          )}
                          Refrescar estado
                        </Button>
                      </div>
                      {syncResults[templateId] ? (
                        <p className="mt-2 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                          {syncResults[templateId]}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {groups.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {groups.slice(0, 6).map((group) => {
              const groupSummary = asRecord(group.summary);
              const blocking = asNumber(groupSummary.blocking) || 0;
              const pending = asNumber(groupSummary.pending) || 0;
              return (
                <div key={group.id} className="rounded-2xl border border-border/60 bg-background/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{String(group.label || formatKey(group.id))}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{String(group.purpose || "templates")}</p>
                    </div>
                    <StatusPill tone={blocking ? "danger" : pending ? "warning" : "ready"}>
                      {blocking ? "Bloqueos" : pending ? "Pendiente" : "Listo"}
                    </StatusPill>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Metric label="Total" value={formatNumber(groupSummary.total)} />
                    <Metric label="OK" value={formatNumber(groupSummary.approved)} tone="ready" />
                    <Metric label="Web" value={formatNumber(groupSummary.webviews)} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-3">
          {Object.entries(metaStrategy).map(([key, value]) => {
            const strategy = asRecord(value);
            return (
              <div key={key} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{formatKey(key)}</p>
                <p className="mt-2 text-sm font-semibold text-foreground">{String(strategy.use_when || strategy.backend_contract || "Disponible")}</p>
                {Array.isArray(strategy.recommended_for) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {strategy.recommended_for.slice(0, 4).map((item: unknown) => (
                      <StatusPill key={String(item)}>{formatKey(String(item))}</StatusPill>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Webviews seguros</p>
              <p className="mt-1 text-xs text-muted-foreground">{String(first(webview, ["entrypoints", "mode"]) || "whatsapp, widget, web")}</p>
            </div>
            <StatusPill tone={boolish(webview.enabled) ? "ready" : "warning"}>{boolish(webview.enabled) ? "Activo" : "Bloqueado"}</StatusPill>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Sesion firmada" value={boolish(webviewSecurity.signed_session_required) ? "Si" : "No"} tone={boolish(webviewSecurity.signed_session_required) ? "ready" : "warning"} />
            <Metric label="Webhook server" value={boolish(webviewSecurity.server_to_server_confirmation) ? "Si" : "No"} tone={boolish(webviewSecurity.server_to_server_confirmation) ? "ready" : "warning"} />
            <Metric label="Tarjeta en chat" value={boolish(webviewSecurity.card_data_in_chat_allowed) ? "Permitido" : "No"} tone={boolish(webviewSecurity.card_data_in_chat_allowed) ? "danger" : "ready"} />
            <Metric label="Plan full" value={boolish(webviewSecurity.requires_full_plan) ? "Requerido" : "No"} />
          </div>
          {webviewFlows.length ? (
            <div className="mt-4 rounded-2xl border border-border/60 bg-background/80 p-3">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">Flujos transaccionales desde WhatsApp</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(webviewSummary.ready_flows)} de {formatNumber(webviewSummary.flows_total)} listos con sesion firmada.
                  </p>
                </div>
                <StatusPill>{formatNumber(webviewSummary.flows_total)} flows</StatusPill>
              </div>
              <div className="grid gap-2 lg:grid-cols-2">
                {webviewFlows.slice(0, 4).map((flow) => {
                  const status = String(flow.status || "review");
                  const templateIds = asArray(flow.template_ids).map(String);
                  const confirmations = asArray(flow.server_confirmation).map(String);
                  return (
                    <div key={String(flow.id)} className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <StatusPill tone={status === "ready" ? "ready" : status.includes("blocked") ? "danger" : "warning"}>
                          {formatKey(status)}
                        </StatusPill>
                        <StatusPill>{String(flow.surface || "webview")}</StatusPill>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{String(flow.label || flow.id)}</p>
                      <p className="mt-1 break-all text-xs text-muted-foreground">{String(flow.url_template || "-")}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {templateIds.slice(0, 3).map((item) => (
                          <StatusPill key={item}>{formatKey(item)}</StatusPill>
                        ))}
                      </div>
                      {confirmations.length ? (
                        <p className="mt-3 text-[11px] text-muted-foreground">
                          Confirma: {confirmations.slice(0, 2).map(formatKey).join(" + ")}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {qaScenarios.length ? (
          <div className="rounded-2xl border border-border/60 bg-background/85 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Matriz QA de WhatsApp</p>
                <p className="text-xs text-muted-foreground">
                  Reclamos, pedidos, colegios, encuestas y webviews conectados a pruebas reproducibles.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone={asNumber(qaPlaybook.ready_count) ? "ready" : "warning"}>
                  {formatNumber(qaPlaybook.ready_count)} listos
                </StatusPill>
                <StatusPill>{formatNumber(qaPlaybook.scenario_count)} escenarios</StatusPill>
              </div>
            </div>
            <div className="grid gap-2 lg:grid-cols-2">
              {qaScenarios.slice(0, 6).map((scenario) => {
                const templateState = asRecord(scenario.template_state);
                const webviewState = asRecord(scenario.webview_state);
                const scriptCases = asArray(scenario.script_cases).map(String);
                return (
                  <div key={String(scenario.id)} className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusPill tone={toneForQaStatus(scenario.status)}>{formatKey(String(scenario.status || "review"))}</StatusPill>
                      <StatusPill>{formatKey(String(scenario.entrypoint || "whatsapp"))}</StatusPill>
                      {webviewState.status ? <StatusPill>{formatKey(String(webviewState.status))}</StatusPill> : null}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{String(scenario.label || scenario.id)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {asArray(scenario.covers).slice(0, 5).map(String).map(formatKey).join(" · ")}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Metric label="Templates OK" value={formatNumber(templateState.approved)} tone={asNumber(templateState.blocking) ? "danger" : "ready"} />
                      <Metric label="Bloqueos" value={formatNumber(templateState.blocking)} tone={asNumber(templateState.blocking) ? "danger" : "ready"} />
                      <Metric label="Casos QA" value={formatNumber(scriptCases.length)} />
                    </div>
                    {scriptCases.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {scriptCases.slice(0, 4).map((item) => (
                          <StatusPill key={item}>{formatKey(item)}</StatusPill>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {qaPlaybook.local_command ? (
              <p className="mt-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                {String(qaPlaybook.local_command)}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

const TrackingExperienceResult = ({ result }: { result: AnyRecord }) => {
  const source = asRecord(first(result, ["data", "experience", "tracking"]) || result);
  const current = asRecord(first(source, ["current_status", "current", "status_detail"]));
  const timelineSource = first(source, ["timeline", "events", "milestones", "items"]);
  const timeline = asArray(timelineSource);
  const renderContract = asRecord(
    first(source, ["render_contract", "map_contract", "tracking_contract"]),
  );
  const map = asRecord(first(source, ["map", "tracking_map", "geo", "location"]));
  const coordinates = readLatLng(
    first(map, ["current_status", "current", "point", "location"]),
    map,
    first(source, ["location", "current_location", "destination_or_claim_location"]),
    current,
  );
  const timelineLabels = timeline.map((item, index) => {
    const event = typeof item === "string" ? { label: item } : asRecord(item);
    return String(first(event, ["label", "title", "status", "event_name", "name"]) || `Evento ${index + 1}`);
  });
  const progressPercent = timeline.length
    ? Math.min(100, Math.max(12, Math.round(((timeline.length - 1) / Math.max(timeline.length, 1)) * 100)))
    : 0;
  const title =
    readText(first(source, ["title", "label", "headline", "message_body"])) ||
    readText(first(current, ["label", "status", "title"])) ||
    "Tracking experience";

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {String(first(source, ["contract_version", "kind", "type"]) || "api.public.tracking.experience")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {source.request_id ? <StatusPill>{String(source.request_id)}</StatusPill> : null}
          {first(source, ["status", "state"]) ? (
            <StatusPill tone="ready">{String(first(source, ["status", "state"]))}</StatusPill>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Metric label="Actual" value={String(first(current, ["label", "status", "title"]) || first(source, ["current_status", "status"]) || "-")} tone="ready" />
        <Metric label="Mapa" value={String(first(renderContract, ["fallback_when_no_coordinates"]) || first(map, ["state", "status"]) || "timeline_only")} />
        <Metric label="Eventos" value={formatNumber(timeline.length)} />
      </div>

      {timelineLabels.length > 1 ? (
        <div className="mt-4 rounded-2xl border border-border/60 bg-background/80 p-3">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-[0.14em]">Progreso</span>
            <span>{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="mt-3 flex flex-wrap gap-2">
            {timelineLabels.slice(0, 6).map((label, index) => (
              <span key={`${label}-${index}`} className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-semibold">
                {label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {coordinates ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border/60 bg-background">
          <div className="relative h-40 bg-[linear-gradient(90deg,hsl(var(--muted))_1px,transparent_1px),linear-gradient(0deg,hsl(var(--muted))_1px,transparent_1px)] bg-[size:28px_28px]">
            <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_10px_hsl(var(--primary)/0.16)]" />
            <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full border border-primary/30" />
            <div className="absolute bottom-3 left-3 rounded-xl border bg-background/90 px-3 py-2 text-xs font-semibold shadow-sm">
              {coordinates.lat.toFixed(5)}, {coordinates.lng.toFixed(5)}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-background/70 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MapPinned className="h-4 w-4 text-primary" />
            {String(first(renderContract, ["fallback_when_no_coordinates"]) || "timeline_only")}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            No hay coordenadas renderizables; se mantiene el seguimiento por timeline.
          </p>
        </div>
      )}

      {timeline.length > 0 ? (
        <div className="mt-4 rounded-2xl border border-border/60 bg-background/80 p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Timeline</p>
          <div className="space-y-2">
            {timeline.slice(0, 8).map((item, index) => {
              const event = typeof item === "string" ? { label: item } : asRecord(item);
              const label = String(first(event, ["label", "title", "status", "event_name", "name"]) || `Evento ${index + 1}`);
              const detail = first(event, ["description", "detail", "message", "timestamp", "created_at", "at"]);
              return (
                <div key={`${label}-${index}`} className="flex gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${index === 0 ? "animate-pulse bg-primary" : "bg-muted-foreground/40"}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{String(detail)}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const TrackingExperienceLookup = ({
  claims,
  orders,
  tenantSlug,
}: {
  claims: AnyRecord;
  orders: AnyRecord;
  tenantSlug?: string | null;
}) => {
  const [kind, setKind] = useState<"claim" | "order">("claim");
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnyRecord | null>(null);

  const endpoint = useMemo(
    () =>
      buildTrackingExperienceEndpoint({
        template: kind === "claim" ? claims.experience_endpoint : orders.experience_endpoint,
        kind,
        code: code.trim() || "{code}",
        pin: pin.trim() || "{pin}",
        tenantSlug,
      }),
    [claims.experience_endpoint, code, kind, orders.experience_endpoint, pin, tenantSlug],
  );

  const canSubmit = code.trim().length > 0 && !loading;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const path = buildTrackingExperienceEndpoint({
        template: kind === "claim" ? claims.experience_endpoint : orders.experience_endpoint,
        kind,
        code: code.trim(),
        pin: pin.trim(),
        tenantSlug,
      });
      const response = await apiFetch<unknown>(path, {
        method: "GET",
        skipAuth: true,
        omitCredentials: true,
        tenantSlug: tenantSlug || undefined,
        sendAnonId: true,
      });
      setResult(asRecord(response));
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo cargar el tracking publico."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Tracking experience</p>
          <p className="mt-1 text-xs text-muted-foreground">Usa la experiencia publica principal para reclamos y pedidos.</p>
        </div>
        <StatusPill>{kind}</StatusPill>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-2 md:grid-cols-[160px_1fr_120px_auto]">
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value === "order" ? "order" : "claim")}
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
        >
          <option value="claim">Claim</option>
          <option value="order">Order</option>
        </select>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Codigo"
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
        />
        <input
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="PIN"
          disabled={kind === "order"}
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-50"
        />
        <Button type="submit" disabled={!canSubmit} className="rounded-xl">
          {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Probar
        </Button>
      </form>

      <EndpointLine label="Endpoint efectivo" value={endpoint} />

      {error ? (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}
      {result ? (
        <div className="mt-3">
          <TrackingExperienceResult result={result} />
        </div>
      ) : null}
    </div>
  );
};

const TrackingContract = ({
  experience,
  tenantSlug,
}: {
  experience: WhatsappExperienceV2;
  tenantSlug?: string | null;
}) => {
  const tracking = experience.tracking;
  const claims = asRecord(tracking.claims);
  const orders = asRecord(tracking.orders);
  const courierMap = asRecord(tracking.courier_style_map);
  const renderContract = asRecord(courierMap.render_contract);
  const milestones = asRecord(tracking.milestones);
  const claimMilestones = asArray(milestones.claim).map(String);
  const orderMilestones = asArray(milestones.order).map(String);
  const layers = asArray(renderContract.layers).map(String);
  const animations = asArray(renderContract.animations).map(String);

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Route className="h-4 w-4 text-primary" />
          Tracking tipo courier
        </CardTitle>
        <CardDescription>{String(renderContract.type || "tracking_map_timeline")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <EndpointLine label="Experience reclamo" value={claims.experience_endpoint} />
          <EndpointLine label="Experience pedido" value={orders.experience_endpoint} />
          <EndpointLine label="Estado reclamo legacy" value={claims.public_status_alias || claims.public_status_endpoint} />
          <EndpointLine label="Estado pago/pedido" value={orders.payment_status_endpoint} />
          <EndpointLine label="Tracking reclamo" value={claims.tracking_page_template} />
          <EndpointLine label="Tracking pedido" value={orders.tracking_page_template} />
        </div>

        <div className="rounded-2xl border border-border/60 p-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <StatusPill tone={boolish(courierMap.enabled) ? "ready" : "neutral"}>
              {boolish(courierMap.enabled) ? "Mapa listo" : "Timeline only"}
            </StatusPill>
            <StatusPill>{String(renderContract.fallback_when_no_coordinates || "timeline_only")}</StatusPill>
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Layers</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(layers.length ? layers : ["timeline_events"]).map((layer) => (
                  <StatusPill key={layer}>{formatKey(layer)}</StatusPill>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Animaciones</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(animations.length ? animations : ["status_transition"]).map((animation) => (
                  <StatusPill key={animation}>{formatKey(animation)}</StatusPill>
                ))}
              </div>
            </div>
          </div>
          <MilestoneRail label="Claim" items={claimMilestones} />
          <MilestoneRail label="Order" items={orderMilestones} />
        </div>

        <TrackingExperienceLookup claims={claims} orders={orders} tenantSlug={tenantSlug || readText(experience.tenant.slug)} />
      </CardContent>
    </Card>
  );
};

const MilestoneRail = ({ label, items }: { label: string; items: string[] }) => {
  if (!items.length) return null;
  return (
    <div className="mb-4 last:mb-0">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item, index) => (
          <div key={`${label}-${item}`} className="flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1.5 text-xs">
            <span className={`h-2.5 w-2.5 rounded-full ${index === 0 ? "animate-pulse bg-primary" : "bg-muted-foreground/40"}`} />
            {formatKey(item)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function WhatsappOperationsHub({
  tenantSlug,
  initialExperience,
}: {
  tenantSlug?: string | null;
  initialExperience?: WhatsappExperienceV2 | AnyRecord | null;
}) {
  const initial = useMemo(
    () => (initialExperience ? normalizeWhatsappExperienceV2(initialExperience) : null),
    [initialExperience],
  );
  const [experience, setExperience] = useState<WhatsappExperienceV2 | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  const loadExperience = async () => {
    if (!tenantSlug && initial) return;
    setLoading(!experience);
    setError(null);
    try {
      const response = await getWhatsappExperienceV2(tenantSlug);
      setExperience(response);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo cargar WhatsApp Operations."));
      if (!initial) setExperience(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initial) {
      setExperience(initial);
      setLoading(false);
    }
    loadExperience();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, initialExperience]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-border/60 bg-background/80 p-6 text-sm text-muted-foreground">
        Cargando WhatsApp Operations...
      </div>
    );
  }

  if (!experience) {
    return (
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-primary" />
            WhatsApp Operations
          </CardTitle>
          <CardDescription>{error || "Sin experiencia de WhatsApp disponible."}</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState reason={error} />
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={loadExperience}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const channelEnabled = boolish(experience.channel.enabled);
  const refreshSeconds = first(experience.frontend_contract, ["primary_refresh_seconds"]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[28px] border border-border/60 bg-background/90 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">WhatsApp Operations</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight">Hub operativo del canal</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {String(experience.frontend_contract.render_as || experience.contract_version || "whatsapp.experience.v1")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill tone={channelEnabled ? "ready" : "warning"}>{channelEnabled ? "Ready" : "Setup"}</StatusPill>
          {refreshSeconds ? <StatusPill>{String(refreshSeconds)}s refresh</StatusPill> : null}
          {experience.request_id ? <StatusPill>{experience.request_id}</StatusPill> : null}
        </div>
      </div>

      {!channelEnabled ? <SetupChecklist experience={experience} /> : null}
      <ChannelHealth experience={experience} tenantSlug={tenantSlug} />
      <EnterpriseRules experience={experience} />
      <ConversationCapabilities experience={experience} />
      <ContentModules experience={experience} />
      <TemplateBlueprintPanel experience={experience} tenantSlug={tenantSlug} />
      <TrackingContract experience={experience} tenantSlug={tenantSlug} />
    </section>
  );
}
