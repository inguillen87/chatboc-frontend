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
import { getErrorMessage } from "@/utils/api";

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

const ChannelHealth = ({ experience }: { experience: WhatsappExperienceV2 }) => {
  const channel = experience.channel;
  const enabled = boolish(channel.enabled);
  const tone = enabled ? "ready" : "warning";

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4 text-primary" />
              Estado del canal
            </CardTitle>
            <CardDescription>{String(first(channel, ["provider", "status", "reason_code"]) || "whatsapp.experience.v1")}</CardDescription>
          </div>
          <StatusPill tone={tone}>{enabled ? "Conectado" : "Configurar"}</StatusPill>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <EndpointLine label="Numero" value={first(channel, ["number", "phone_number", "sender_id"])} />
        <EndpointLine label="Webhook" value={channel.webhook} />
        <EndpointLine label="Status webhook" value={channel.status_webhook} />
        <EndpointLine label="Reason code" value={channel.reason_code} />
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
          <CardDescription>Limites y politica de salida desde backend.</CardDescription>
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
  const canRenderVoice =
    boolish(voiceCalls.enabled) &&
    boolish(voiceCapabilities.native_speech_to_speech);

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
            <Button type="button" size="sm" className="rounded-xl">
              <PhoneCall className="mr-2 h-4 w-4" />
              Voz realtime
            </Button>
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
              <div key={key} className="rounded-2xl border border-border/60 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <StatusPill tone={enabled ? "ready" : "neutral"}>{enabled ? "Activo" : "Oculto"}</StatusPill>
                </div>
                <p className="font-semibold text-foreground">{labelFrom(input, key)}</p>
                {videoNotReady ? <p className="mt-1 text-xs text-muted-foreground">Adjunto recibido, analisis pendiente.</p> : null}
              </div>
            );
          })}
        </div>

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

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageCheck className="h-4 w-4 text-primary" />
          Modulos de contenido
        </CardTitle>
        <CardDescription>Catalogo, encuestas, novedades, promociones y links desde backend.</CardDescription>
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
                <p className="mt-1 text-xs text-muted-foreground">{String(module.endpoint || module.bulk_import_endpoint || "Sin endpoint")}</p>
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
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <EndpointLine label="Imagenes" value={`${imageCoverage}%`} />
              <EndpointLine label="Editor catalogo" value={catalog.endpoint} />
              <EndpointLine label="Bulk import" value={catalog.bulk_import_endpoint} />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

const TrackingContract = ({ experience }: { experience: WhatsappExperienceV2 }) => {
  const tracking = experience.tracking;
  const claims = asRecord(tracking.claims);
  const orders = asRecord(tracking.orders);
  const courierMap = asRecord(tracking.courier_style_map);
  const renderContract = asRecord(courierMap.render_contract);
  const milestones = asRecord(tracking.milestones);
  const claimMilestones = asArray(milestones.claim).map(String);
  const orderMilestones = asArray(milestones.order).map(String);

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
          <EndpointLine label="Estado reclamo" value={claims.public_status_alias || claims.public_status_endpoint} />
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
          <MilestoneRail label="Claim" items={claimMilestones} />
          <MilestoneRail label="Order" items={orderMilestones} />
        </div>
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
          <CardDescription>{error || "Sin contrato whatsapp.experience.v1 disponible."}</CardDescription>
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

      {!channelEnabled ? <EmptyState reason={experience.channel.reason_code} /> : null}
      <ChannelHealth experience={experience} />
      <EnterpriseRules experience={experience} />
      <ConversationCapabilities experience={experience} />
      <ContentModules experience={experience} />
      <TrackingContract experience={experience} />
    </section>
  );
}
