import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Bot, CheckCircle2, GraduationCap, Landmark, Store, Vote, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

import type { LandingExperience, LandingRecord } from "@/api/landingExperience";
import { cleanLandingCopy } from "@/utils/landingCopy";

type AnyRecord = Record<string, any>;

interface HeroSectionProps {
  experience?: LandingExperience | null;
}

const defaultProofItems = [
  "Web, WhatsApp y panel en una sola operacion",
  "Reclamos, pedidos, encuestas y leads con seguimiento",
  "Texto, voz, imagenes, archivos, ubicacion y llamadas cuando el canal lo permite",
];

const defaultDashboardRows = [
  { label: "Conversaciones", value: "Entendidas", detail: "web + WhatsApp", tone: "bg-emerald-500" },
  { label: "Casos", value: "Ordenados", detail: "prioridad y cola", tone: "bg-amber-500" },
  { label: "Ventas", value: "Seguibles", detail: "carrito + contacto", tone: "bg-sky-500" },
];

const signalRows = [
  { label: "Encuestas y comentarios", detail: "participacion visible", tone: "bg-primary" },
  { label: "Reclamos y ubicaciones", detail: "zonas accionables", tone: "bg-emerald-500" },
  { label: "Pedidos y leads", detail: "seguimiento comercial", tone: "bg-amber-500" },
];

const defaultHeroHeadline = "Converti cada mensaje en ventas, reclamos resueltos y decisiones claras.";
const defaultHeroDescription =
  "Chatboc entiende texto, audios, imagenes, archivos, ubicaciones y llamadas. Crea casos, pedidos, encuestas, mapas y seguimiento para que colegios, gobiernos y pymes operen mejor desde el primer dia.";

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

const readText = (record: AnyRecord | undefined | null, keys: string[], defaultValue = "") => {
  const value = first(record, keys);
  if (typeof value === "string" && value.trim()) return cleanLandingCopy(value.trim());
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return cleanLandingCopy(defaultValue);
};

const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    const items = first(value, ["items", "list", "values", "entries", "proof_items", "links", "ctas"]);
    if (Array.isArray(items)) return items;
  }
  return [];
};

const readItemLabel = (value: unknown, defaultValue = "") => {
  if (typeof value === "string" && value.trim()) return cleanLandingCopy(value.trim());
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (isRecord(value)) {
    return readText(value, ["label", "title", "name", "text", "copy", "headline"], defaultValue);
  }
  return cleanLandingCopy(defaultValue);
};

const normalizeProofItems = (source: unknown) => {
  const items = asArray(source)
    .map((item) => readItemLabel(item))
    .filter(Boolean);
  return items.length ? items : defaultProofItems;
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
    .filter(Boolean) as typeof defaultDashboardRows;
  return items.length ? items.slice(0, 3) : defaultDashboardRows;
};

const normalizeCta = (
  source: unknown,
  defaultCta: { label: string; target: string },
) => {
  if (isRecord(source)) {
    return {
      label: readText(source, ["label", "title", "text"], defaultCta.label),
      target: readRawText(source, ["href", "to", "route", "url", "endpoint"], defaultCta.target),
    };
  }

  if (typeof source === "string" && source.trim()) {
    return { ...defaultCta, label: cleanLandingCopy(source.trim()) };
  }

  return defaultCta;
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

const readRawText = (record: AnyRecord | undefined | null, keys: string[], defaultValue = "") => {
  const value = first(record, keys);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return defaultValue;
};

const isBrandOnlyHeadline = (value: string) => {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return !normalized || normalized === "chatboc" || normalized === "chatbocar";
};

const HeroSection = ({ experience }: HeroSectionProps) => {
  const navigate = useNavigate();

  const hero = useMemo(() => resolveHeroSource(experience), [experience]);
  const tokens = isRecord(experience?.tokens) ? experience.tokens : {};
  const colors = isRecord(first(tokens, ["colors", "palette"])) ? (first(tokens, ["colors", "palette"]) as AnyRecord) : {};

  const heroHeadline = readText(
    hero,
    ["headline", "title", "heading", "h1"],
    defaultHeroHeadline,
  );
  const headline = isBrandOnlyHeadline(heroHeadline) ? defaultHeroHeadline : heroHeadline;
  const description = readText(
    hero,
    ["subheadline", "subtitle", "description", "copy", "body"],
    defaultHeroDescription,
  );

  const proofItems = normalizeProofItems(
    first(hero, ["proof_items", "trust_signals", "proof", "badges"]) ?? experience?.proof_bar,
  );
  const dashboardRows = normalizeMetrics(
    first(hero, ["metrics", "stats", "dashboard_rows"]) ?? first(hero, ["preview", "metrics"]),
  );
  const primaryCta = normalizeCta(first(hero, ["primary_cta", "primaryCta"]) ?? asArray(experience?.ctas)[0], {
    label: "Ver demo por rubro",
    target: "/demo",
  });
  const secondaryCta = normalizeCta(first(hero, ["secondary_cta", "secondaryCta"]) ?? asArray(experience?.ctas)[1], {
    label: "Quiero verlo para mi organizacion",
    target: "/register",
  });
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
    <section className="chatboc-hero-grid overflow-hidden pt-20 pb-12 text-foreground md:pt-28 md:pb-16" style={accentStyle}>
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-10 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold leading-[1.03] tracking-normal text-foreground sm:text-5xl md:text-6xl xl:text-7xl">
              {headline}
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
              {description}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
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

          <div className="relative">
            <div className="chatboc-hero-aura" aria-hidden="true" />
            <div className="chatboc-command-shell chatboc-dashboard-scan overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-muted/40 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{previewTitle}</p>
                  <p className="text-xs text-muted-foreground">{previewCopy}</p>
                </div>
                <div className="chatboc-live-chip rounded-[8px] bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
                  {readText(hero, ["status_label", "preview_status"], "Operando")}
                </div>
              </div>

              <div className="grid gap-5 p-4 md:p-5 xl:grid-cols-[0.92fr_1.08fr]">
                <div className="relative min-h-[360px] overflow-hidden rounded-[16px] border border-border/70 bg-[radial-gradient(circle_at_50%_22%,rgba(42,105,255,0.28),transparent_34%),linear-gradient(180deg,rgba(13,53,195,0.12),rgba(16,185,129,0.08))] p-4">
                  <div className="absolute left-4 top-4 rounded-[8px] border border-border/70 bg-background/80 px-3 py-2 text-xs font-semibold text-foreground shadow-sm">
                    Mensaje entra
                  </div>
                  <div className="absolute right-4 top-16 rounded-[8px] border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary shadow-sm">
                    IA entiende
                  </div>
                  <div className="absolute bottom-5 left-4 rounded-[8px] border border-success/30 bg-success/10 px-3 py-2 text-xs font-semibold text-success shadow-sm">
                    Accion lista
                  </div>
                  <img
                    src="/chatboc_frontend_pack/branding/chatboc/avatar/chatboc-orbit-avatar.svg"
                    alt=""
                    aria-hidden="true"
                    className="chatboc-hero-avatar absolute left-1/2 top-1/2 h-[250px] w-[250px] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_28px_55px_rgba(13,53,195,0.28)] md:h-[300px] md:w-[300px]"
                  />
                </div>

                <div className="space-y-3">
                  <div className="rounded-[14px] border border-border/70 bg-background/80 p-4">
                    <div className="mb-3 flex items-center gap-3 border-b border-border/70 pb-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{readText(hero, ["agent_title"], "Agente IA operativo")}</p>
                        <p className="text-xs text-muted-foreground">
                          {readText(hero, ["agent_subtitle"], "Responde, deriva y registra contexto")}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3 text-sm">
                      <div className="max-w-[88%] rounded-[8px] bg-muted px-3 py-2 text-muted-foreground">
                        {readText(hero, ["sample_user_message"], "Necesito resolver una consulta y adjuntar documentacion.")}
                      </div>
                      <div className="chatboc-message-glow ml-auto max-w-[90%] rounded-[8px] bg-primary px-3 py-2 text-primary-foreground">
                        {readText(hero, ["sample_agent_message"], "Entendido. Lo convierto en accion, aviso al equipo y dejo seguimiento para la persona.")}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { icon: Store, label: "Pymes", text: "catalogo, carrito y pedidos" },
                      { icon: Landmark, label: "Gobiernos", text: "reclamos, mapas y participacion" },
                      { icon: GraduationCap, label: "Colegios", text: "familias, certificados y casos" },
                      { icon: Vote, label: "Encuestas", text: "sondeos, votos y comentarios" },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div key={item.label} className="rounded-[12px] border border-border/70 bg-background/80 p-3">
                          <Icon className="mb-2 h-4 w-4 text-primary" />
                          <p className="text-sm font-semibold text-foreground">{item.label}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid gap-0 border-t border-border/70 md:grid-cols-3">
                {dashboardRows.map((row) => (
                  <div key={row.label} className="border-b border-border/70 p-4 md:border-b-0 md:border-r last:md:border-r-0">
                    <div className={`mb-3 h-1.5 w-10 rounded-full ${row.tone}`} />
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="mt-1 text-xl font-bold text-foreground">{row.value}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{row.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {signalRows.map((row) => (
                <div key={row.label} className="rounded-[8px] border border-border/70 bg-background/70 px-3 py-3 backdrop-blur">
                  <span className={`mb-2 block h-1.5 w-8 rounded-full ${row.tone}`} />
                  <p className="text-xs font-semibold text-foreground">{row.label}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{row.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
