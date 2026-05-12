import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  FileText,
  MapPinned,
  MessageSquareText,
  Mic,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import type { LandingExperience, LandingRecord } from "@/api/landingExperience";
import { cleanLandingCopy } from "@/utils/landingCopy";

type AnyRecord = Record<string, any>;

interface HeroSectionProps {
  experience?: LandingExperience | null;
}

const fallbackProofItems = [
  "Web, WhatsApp y panel en una sola operación",
  "Respuestas guiadas para cada consulta",
  "Demo, tickets, pagos, encuestas y métricas listas para crecer",
];

const fallbackDashboardRows = [
  { label: "Conversaciones", value: "24/7", detail: "web + WhatsApp", tone: "bg-emerald-500" },
  { label: "Tickets activos", value: "Orden", detail: "prioridad y cola", tone: "bg-amber-500" },
  { label: "Leads y pedidos", value: "CRM", detail: "cobro + seguimiento", tone: "bg-sky-500" },
];

const fallbackChannelRows = [
  { icon: MessageSquareText, label: "Chat", value: "consulta entendida", tone: "text-sky-500" },
  { icon: Mic, label: "Voz", value: "llamadas con IA", tone: "text-emerald-500" },
  { icon: FileText, label: "Casos", value: "tickets y adjuntos", tone: "text-amber-500" },
  { icon: MapPinned, label: "Mapa", value: "ubicaciones claras", tone: "text-violet-500" },
];

const fallbackTimelineItems = [
  { label: "Mensaje recibido", meta: "canal web", state: "done" },
  { label: "Chatboc entiende la necesidad", meta: "opciones simples", state: "done" },
  { label: "El agente deja todo registrado", meta: "ticket o contacto", state: "active" },
  { label: "Seguimiento al usuario", meta: "WhatsApp / email", state: "next" },
];

const chartHeights = [42, 66, 54, 72, 61, 88, 73, 92, 68, 81, 76, 95];

const isRecord = (value: unknown): value is AnyRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const first = (record: AnyRecord | undefined | null, keys: string[]) => {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
};

const readText = (record: AnyRecord | undefined | null, keys: string[], fallback = "") => {
  const value = first(record, keys);
  if (typeof value === "string" && value.trim()) return cleanLandingCopy(value.trim());
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return cleanLandingCopy(fallback);
};

const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    const items = first(value, ["items", "list", "values", "entries", "proof_items", "links", "ctas"]);
    if (Array.isArray(items)) return items;
  }
  return [];
};

const readItemLabel = (value: unknown, fallback = "") => {
  if (typeof value === "string" && value.trim()) return cleanLandingCopy(value.trim());
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (isRecord(value)) {
    return readText(value, ["label", "title", "name", "text", "copy", "headline"], fallback);
  }
  return cleanLandingCopy(fallback);
};

const readItemMeta = (value: unknown, fallback = "") => {
  if (isRecord(value)) {
    return readText(value, ["detail", "description", "subtitle", "meta", "value", "status"], fallback);
  }
  return fallback;
};

const normalizeProofItems = (source: unknown) => {
  const items = asArray(source)
    .map((item) => readItemLabel(item))
    .filter(Boolean);
  return items.length ? items : fallbackProofItems;
};

const normalizeMetrics = (source: unknown) => {
  const tones = ["bg-emerald-500", "bg-amber-500", "bg-sky-500", "bg-violet-500"];
  const items = asArray(source)
    .map((item, index) => {
      if (!isRecord(item)) return null;
      const label = readText(item, ["label", "title", "name"]);
      const value = readText(item, ["value", "metric", "count", "score"]);
      if (!label && !value) return null;
      return {
        label: label || `Metric ${index + 1}`,
        value: value || "-",
        detail: readText(item, ["detail", "description", "subtitle"]),
        tone: readText(item, ["tone", "color_class"], tones[index % tones.length]),
      };
    })
    .filter(Boolean) as typeof fallbackDashboardRows;
  return items.length ? items.slice(0, 3) : fallbackDashboardRows;
};

const channelIconFor = (label: string) => {
  const normalized = label.toLowerCase();
  if (normalized.includes("voz") || normalized.includes("voice") || normalized.includes("audio")) return Mic;
  if (normalized.includes("map") || normalized.includes("ubic")) return MapPinned;
  if (normalized.includes("doc") || normalized.includes("file") || normalized.includes("caso")) return FileText;
  return MessageSquareText;
};

const normalizeChannels = (source: unknown) => {
  const tones = ["text-sky-500", "text-emerald-500", "text-amber-500", "text-violet-500"];

  const rawItems = (() => {
    if (Array.isArray(source)) return source;
    if (isRecord(source)) {
      const nested = first(source, ["items", "channels", "input_modes", "support_channels"]);
      if (Array.isArray(nested)) return nested;
      if (isRecord(nested)) return Object.entries(nested).map(([key, value]) => ({ id: key, ...(isRecord(value) ? value : {}) }));
      return Object.entries(source).map(([key, value]) => ({ id: key, ...(isRecord(value) ? value : {}) }));
    }
    return [];
  })();

  const items = rawItems
    .map((item, index) => {
      if (!isRecord(item)) return null;
      const label = readText(item, ["label", "title", "name", "id"], `Canal ${index + 1}`);
      const enabled = item.enabled;
      const value =
        readText(item, ["value", "status", "description", "detail"]) ||
        (typeof enabled === "boolean" ? (enabled ? "habilitado" : "deshabilitado") : "");
      return {
        icon: channelIconFor(label),
        label,
        value,
        tone: tones[index % tones.length],
      };
    })
    .filter(Boolean) as typeof fallbackChannelRows;

  return items.length ? items.slice(0, 4) : fallbackChannelRows;
};

const normalizeTimeline = (source: unknown) => {
  const items = asArray(source)
    .map((item, index) => {
      if (!isRecord(item) && typeof item !== "string") return null;
      const label = readItemLabel(item, `Paso ${index + 1}`);
      return {
        label,
        meta: readItemMeta(item),
        state: isRecord(item) ? readText(item, ["state", "status"], index < 2 ? "done" : index === 2 ? "active" : "next") : "next",
      };
    })
    .filter(Boolean) as typeof fallbackTimelineItems;
  return items.length ? items.slice(0, 5) : fallbackTimelineItems;
};

const normalizeCta = (
  source: unknown,
  fallback: { label: string; target: string },
) => {
  if (isRecord(source)) {
    return {
      label: readText(source, ["label", "title", "text"], fallback.label),
      target: readRawText(source, ["href", "to", "route", "url", "endpoint"], fallback.target),
    };
  }

  if (typeof source === "string" && source.trim()) {
    return { ...fallback, label: cleanLandingCopy(source.trim()) };
  }

  return fallback;
};

const resolveHeroSource = (experience?: LandingExperience | null): LandingRecord => {
  if (isRecord(experience?.hero)) return experience.hero;
  const heroSection = asArray(experience?.sections).find((section) => {
    if (!isRecord(section)) return false;
    const id = readText(section, ["id", "key", "type", "render_as"]).toLowerCase();
    return id.includes("hero");
  });
  return isRecord(heroSection) ? heroSection : {};
};

const readRawText = (record: AnyRecord | undefined | null, keys: string[], fallback = "") => {
  const value = first(record, keys);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const HeroSection = ({ experience }: HeroSectionProps) => {
  const navigate = useNavigate();

  const hero = useMemo(() => resolveHeroSource(experience), [experience]);
  const brand = isRecord(experience?.brand) ? experience.brand : {};
  const tokens = isRecord(experience?.tokens) ? experience.tokens : {};
  const colors = isRecord(first(tokens, ["colors", "palette"])) ? (first(tokens, ["colors", "palette"]) as AnyRecord) : {};

  const headline = readText(
    hero,
    ["headline", "title", "heading", "h1"],
    "Agentes IA para atender, vender y resolver desde un solo lugar",
  );
  const description = readText(
    hero,
    ["subheadline", "subtitle", "description", "copy", "body"],
    "Chatboc atiende consultas, toma pedidos, crea reclamos, acompaña trámites y mantiene a cada persona informada sin que tu equipo pierda el control.",
  );

  const proofItems = normalizeProofItems(
    first(hero, ["proof_items", "trust_signals", "proof", "badges"]) ?? experience?.proof_bar,
  );
  const dashboardRows = normalizeMetrics(
    first(hero, ["metrics", "stats", "dashboard_rows"]) ?? first(hero, ["preview", "metrics"]),
  );
  const channelRows = normalizeChannels(
    first(hero, ["channels", "support_channels", "input_modes", "capabilities"]) ?? first(experience, ["support_channels"]),
  );
  const timelineItems = normalizeTimeline(first(hero, ["timeline", "journey", "steps", "workflow"]));
  const primaryCta = normalizeCta(first(hero, ["primary_cta", "primaryCta"]) ?? asArray(experience?.ctas)[0], {
    label: "Probar demo",
    target: "/demo",
  });
  const secondaryCta = normalizeCta(first(hero, ["secondary_cta", "secondaryCta"]) ?? asArray(experience?.ctas)[1], {
    label: "Crear cuenta",
    target: "/register",
  });
  const brandName = readText(brand, ["name", "display_name", "title"], "Chatboc");
  const previewTitle = readText(hero, ["preview_title", "dashboard_title"], "Centro de operaciones");
  const previewCopy = readText(
    hero,
    ["preview_copy", "dashboard_description"],
    "Vista compacta para equipos que atienden, venden y resuelven.",
  );

  const accentStyle = {
    ["--chatboc-hero-accent" as string]: readText(colors, ["primary", "accent"], ""),
  } as React.CSSProperties;

  const navigateTo = (target: string) => {
    if (!target) return;
    if (/^https?:\/\//i.test(target)) {
      window.location.href = target;
      return;
    }
    navigate(target.startsWith("/") ? target : `/${target}`);
  };

  return (
    <section className="chatboc-hero-grid overflow-hidden pt-24 pb-14 text-foreground md:pt-32 md:pb-20" style={accentStyle}>
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl text-center">
          <h1 className="mx-auto max-w-4xl text-4xl font-bold leading-tight tracking-normal text-foreground sm:text-5xl md:text-6xl">
            {headline}
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-muted-foreground md:text-xl">
            {description}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="chatboc-cta-primary h-12 w-full rounded-[8px] px-6 text-base font-semibold sm:w-auto"
              onClick={() => navigateTo(primaryCta.target)}
            >
              <Zap className="mr-2 h-5 w-5" />
              {primaryCta.label}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 w-full rounded-[8px] border-border/80 bg-background/70 px-6 text-base font-semibold shadow-sm backdrop-blur hover:border-primary/40 hover:bg-primary/5 sm:w-auto"
              onClick={() => navigateTo(secondaryCta.target)}
            >
              {secondaryCta.label}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          <div className="mt-7 grid gap-3 text-left sm:grid-cols-3">
            {proofItems.slice(0, 3).map((item) => (
              <div
                key={item}
                className="flex items-start gap-2 rounded-[8px] border border-border/60 bg-background/70 px-3 py-3 text-sm text-muted-foreground backdrop-blur"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-12 max-w-6xl">
          <div className="chatboc-command-shell chatboc-dashboard-scan overflow-hidden">
            <div className="border-b border-border/70 bg-muted/40 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="flex items-center gap-2 rounded-[8px] border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-success" />
                  {readText(hero, ["contract_label", "preview_badge"], `${brandName} listo para operar`)}
                </div>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-[0.98fr_1.02fr]">
              <div className="border-b border-border/70 p-5 md:p-7 lg:border-b-0 lg:border-r">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{previewTitle}</p>
                    <p className="text-sm text-muted-foreground">{previewCopy}</p>
                  </div>
                  <div className="chatboc-live-chip rounded-[8px] bg-success/10 px-3 py-1 text-xs font-semibold text-success">
                    {readText(hero, ["status_label", "preview_status"], "Activo")}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {dashboardRows.map((row) => (
                    <div key={row.label} className="chatboc-metric-card rounded-[8px] border border-border/70 bg-background/80 p-4">
                      <div className={`mb-4 h-1.5 w-10 rounded-full ${row.tone}`} />
                      <p className="text-sm text-muted-foreground">{row.label}</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">{row.value}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{row.detail}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-[8px] border border-border/70 bg-background/80 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      {readText(hero, ["analytics_title"], "Métricas operativas")}
                    </div>
                    <span className="text-xs text-muted-foreground">{readText(hero, ["freshness_label"], "al día")}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="chatboc-meter h-2 rounded-full bg-primary/80" style={{ width: "84%" }} />
                    <div className="chatboc-meter h-2 rounded-full bg-emerald-500/70" style={{ width: "68%" }} />
                    <div className="chatboc-meter h-2 rounded-full bg-amber-500/70" style={{ width: "42%" }} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[8px] border border-border/70 bg-background/80 p-4">
                    <div className="mb-3 flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{readText(hero, ["channels_title"], "Canales")}</span>
                      <span className="text-muted-foreground">{readText(hero, ["channels_meta"], "en un lugar")}</span>
                    </div>
                    <div className="space-y-2">
                      {channelRows.map((item) => {
                        const Icon = item.icon;
                        return (
                          <div key={item.label} className="flex items-center justify-between gap-3 rounded-[8px] bg-muted/45 px-3 py-2">
                            <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
                              <Icon className={`h-4 w-4 ${item.tone}`} />
                              {item.label}
                            </span>
                            <span className="truncate text-[11px] text-muted-foreground">{item.value}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[8px] border border-border/70 bg-background/80 p-4">
                    <div className="mb-3 flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{readText(hero, ["freshness_title"], "Estado")}</span>
                      <span className="text-success">{readText(hero, ["freshness_status"], "listo")}</span>
                    </div>
                    <div className="grid h-[126px] grid-cols-12 items-end gap-1.5" aria-hidden="true">
                      {chartHeights.map((height, index) => (
                        <span
                          key={index}
                          className="chatboc-chart-column rounded-t bg-primary/75"
                          style={{ height: `${height}%`, animationDelay: `${index * 90}ms` }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 md:p-7">
                <div className="rounded-[8px] border border-border/70 bg-background/80 p-4">
                  <div className="mb-4 flex items-center gap-3 border-b border-border/70 pb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{readText(hero, ["agent_title"], "Agente IA")}</p>
                      <p className="text-xs text-muted-foreground">
                        {readText(hero, ["agent_subtitle"], "Responde, deriva y registra contexto")}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="max-w-[82%] rounded-[8px] bg-muted px-3 py-2 text-muted-foreground">
                      {readText(hero, ["sample_user_message"], "Necesito resolver una consulta y adjuntar documentacion.")}
                    </div>
                    <div className="chatboc-message-glow ml-auto max-w-[86%] rounded-[8px] bg-primary px-3 py-2 text-primary-foreground">
                      {readText(hero, ["sample_agent_message"], "Puedo ayudarte. Te muestro las opciones y dejo el caso listo para seguimiento.")}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-[8px] border border-border bg-card px-3 py-2 text-left text-xs font-medium text-foreground">
                        <MessageSquareText className="mb-1 h-4 w-4 text-primary" />
                        {readText(hero, ["sample_action_label"], "Crear caso")}
                      </div>
                      <div className="rounded-[8px] border border-border bg-card px-3 py-2 text-left text-xs font-medium text-foreground">
                        <MapPinned className="mb-1 h-4 w-4 text-success" />
                        {readText(hero, ["sample_location_label"], "Ubicacion requerida")}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-[8px] border border-border/70 bg-background/80 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      {readText(hero, ["timeline_title", "journey_title"], "Recorrido de resolucion")}
                    </p>
                    <span className="text-xs text-muted-foreground">{readText(hero, ["timeline_meta"], "vista en vivo")}</span>
                  </div>
                  <div className="space-y-3">
                    {timelineItems.map((item) => (
                      <div key={item.label} className="grid grid-cols-[18px_1fr] gap-3">
                        <div className="relative flex justify-center">
                          <span
                            className={`mt-1 h-2.5 w-2.5 rounded-full ${
                              item.state === "active"
                                ? "bg-primary shadow-[0_0_0_5px_rgba(37,99,235,0.14)]"
                                : item.state === "done"
                                  ? "bg-success"
                                  : "bg-muted-foreground/35"
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.meta}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[8px] border border-border/70 bg-background/80 p-4">
                    <Sparkles className="mb-3 h-5 w-5 text-amber-500" />
                    <p className="text-sm font-semibold">{readText(hero, ["conversion_title"], "Acciones que convierten")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {readText(hero, ["conversion_copy"], "Botones claros para vender, derivar o cerrar una consulta.")}
                    </p>
                  </div>
                  <div className="rounded-[8px] border border-border/70 bg-background/80 p-4">
                    <MapPinned className="mb-3 h-5 w-5 text-emerald-500" />
                    <p className="text-sm font-semibold">{readText(hero, ["maps_title"], "Mapas accionables")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {readText(hero, ["maps_copy"], "Ubicación y seguimiento cuando el caso lo necesita.")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
