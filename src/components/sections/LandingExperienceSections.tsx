import React, { useMemo } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDot,
  FileText,
  Layers3,
  MessageSquareText,
  MousePointer2,
  Route,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import type { LandingExperience, LandingRecord } from "@/api/landingExperience";
import { Button } from "@/components/ui/button";
import { cleanLandingCopy } from "@/utils/landingCopy";

type AnyRecord = Record<string, any>;

interface LandingExperienceSectionsProps {
  experience?: LandingExperience | null;
}

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

const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    const nested = first(value, ["items", "list", "values", "entries", "sections", "pages", "faqs", "ctas"]);
    if (Array.isArray(nested)) return nested;
  }
  return [];
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const readText = (record: AnyRecord | undefined | null, keys: string[], fallback = "") => {
  const value = first(record, keys);
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const readCopyText = (record: AnyRecord | undefined | null, keys: string[], fallback = "") =>
  cleanLandingCopy(readText(record, keys, fallback));

const readItemLabel = (value: unknown, fallback = "") => {
  if (typeof value === "string" && value.trim()) return cleanLandingCopy(value.trim());
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (isRecord(value)) return readCopyText(value, ["label", "title", "name", "headline", "text"], fallback);
  return cleanLandingCopy(fallback);
};

const readItemDetail = (value: unknown, fallback = "") => {
  if (isRecord(value)) return readCopyText(value, ["description", "detail", "subtitle", "copy", "body"], fallback);
  return cleanLandingCopy(fallback);
};

const sectionKind = (section: LandingRecord, index: number) =>
  readText(section, ["render_as", "type", "layout", "kind", "id", "key"], `section_${index + 1}`).toLowerCase();

const isHeroSection = (section: LandingRecord) => sectionKind(section, 0).includes("hero");

const iconFor = (label: string) => {
  const normalized = label.toLowerCase();
  if (normalized.includes("map") || normalized.includes("ubic") || normalized.includes("track")) return Route;
  if (normalized.includes("analytics") || normalized.includes("metric") || normalized.includes("kpi")) return BarChart3;
  if (normalized.includes("doc") || normalized.includes("catalog") || normalized.includes("pdf")) return FileText;
  if (normalized.includes("chat") || normalized.includes("whatsapp") || normalized.includes("mensaje")) return MessageSquareText;
  return Sparkles;
};

const normalizeCards = (section: LandingRecord) =>
  asArray(first(section, ["cards", "items", "features", "value_cards", "modules", "points"]))
    .map((item, index) => {
      if (!isRecord(item) && typeof item !== "string") return null;
      const label = readItemLabel(item, `Item ${index + 1}`);
      return {
        id: isRecord(item) ? readText(item, ["id", "key", "slug"], `item_${index + 1}`) : `item_${index + 1}`,
        label,
        detail: readItemDetail(item),
        value: isRecord(item) ? readCopyText(item, ["value", "metric", "count", "status"]) : "",
        href: isRecord(item) ? readText(item, ["href", "url", "route", "to", "endpoint"]) : "",
        raw: item,
      };
    })
    .filter(Boolean) as Array<{
      id: string;
      label: string;
      detail: string;
      value: string;
      href: string;
      raw: unknown;
    }>;

const normalizeSteps = (section: LandingRecord) =>
  asArray(first(section, ["steps", "workflow", "timeline", "journey", "process"]))
    .map((item, index) => {
      if (!isRecord(item) && typeof item !== "string") return null;
      return {
        id: isRecord(item) ? readText(item, ["id", "key"], `step_${index + 1}`) : `step_${index + 1}`,
        label: readItemLabel(item, `Paso ${index + 1}`),
        detail: readItemDetail(item),
        status: isRecord(item) ? readCopyText(item, ["status", "state", "tone"]) : "",
      };
    })
    .filter(Boolean) as Array<{ id: string; label: string; detail: string; status: string }>;

const normalizeMetrics = (section: LandingRecord) =>
  asArray(first(section, ["metrics", "stats", "kpis", "summary"]))
    .map((item, index) => {
      if (!isRecord(item)) return null;
      const label = readCopyText(item, ["label", "title", "name"], `Metric ${index + 1}`);
      const rawValue = first(item, ["value", "metric", "count", "score", "rate"]);
      const numeric = asNumber(rawValue);
      return {
        id: readText(item, ["id", "key"], `metric_${index + 1}`),
        label,
        value: rawValue !== undefined && rawValue !== null ? String(rawValue) : "-",
        detail: readCopyText(item, ["detail", "description", "subtitle"]),
        percent: numeric === null ? 48 + ((index * 17) % 42) : Math.max(8, Math.min(100, numeric > 1 ? numeric : numeric * 100)),
      };
    })
    .filter(Boolean) as Array<{ id: string; label: string; value: string; detail: string; percent: number }>;

const useNavigateTarget = () => {
  const navigate = useNavigate();
  return (target: string) => {
    if (!target) return;
    if (/^https?:\/\//i.test(target)) {
      window.location.href = target;
      return;
    }
    navigate(target.startsWith("/") ? target : `/${target}`);
  };
};

const SectionHeader = ({ section }: { section: LandingRecord }) => {
  const title = readCopyText(section, ["title", "heading", "headline", "label", "name"]);
  const description = readCopyText(section, ["description", "subtitle", "copy", "body"]);
  if (!title && !description) return null;
  return (
    <div className="mx-auto mb-8 max-w-3xl text-center">
      {title ? <h2 className="chatboc-section-heading">{title}</h2> : null}
      {description ? <p className="chatboc-section-copy mt-4">{description}</p> : null}
    </div>
  );
};

const MetricsPanel = ({ metrics }: { metrics: ReturnType<typeof normalizeMetrics> }) => {
  if (!metrics.length) return null;
  return (
    <div className="chatboc-command-shell overflow-hidden p-5 md:p-6">
      <div className="relative grid gap-4 md:grid-cols-3">
        {metrics.slice(0, 6).map((metric, index) => (
          <div key={metric.id} className="rounded-[8px] border border-border/70 bg-background/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-foreground">{metric.value}</p>
            {metric.detail ? <p className="mt-1 text-sm text-muted-foreground">{metric.detail}</p> : null}
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
              <span
                className="chatboc-meter block h-full rounded-full bg-primary"
                style={{ width: `${metric.percent}%`, animationDelay: `${index * 90}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const WorkflowPanel = ({ steps }: { steps: ReturnType<typeof normalizeSteps> }) => {
  if (!steps.length) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {steps.slice(0, 8).map((step, index) => (
        <div key={step.id} className="relative rounded-[8px] border border-border/70 bg-card/90 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-primary/10 text-sm font-bold text-primary">
              {index + 1}
            </span>
            {step.status ? (
              <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                {step.status}
              </span>
            ) : null}
          </div>
          <h3 className="text-base font-semibold text-foreground">{step.label}</h3>
          {step.detail ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.detail}</p> : null}
          {index < steps.length - 1 ? <ArrowRight className="absolute -right-3 top-7 hidden h-4 w-4 text-primary/45 lg:block" /> : null}
        </div>
      ))}
    </div>
  );
};

const CardGrid = ({ cards }: { cards: ReturnType<typeof normalizeCards> }) => {
  const navigateTo = useNavigateTarget();
  if (!cards.length) return null;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.slice(0, 9).map((card, index) => {
        const Icon = iconFor(card.label);
        return (
          <article key={card.id} className="chatboc-landing-panel chatboc-hover-lift h-full p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              {card.value ? (
                <span className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  {card.value}
                </span>
              ) : (
                <span className="text-xs font-semibold text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-foreground">{card.label}</h3>
            {card.detail ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{card.detail}</p> : null}
            {card.href ? (
              <button
                type="button"
                className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary"
                onClick={() => navigateTo(card.href)}
              >
                <span>{readCopyText(isRecord(card.raw) ? card.raw : {}, ["cta_label", "button_label"], "Ver")}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
};

const ProofBar = ({ source }: { source: unknown }) => {
  const items = asArray(source)
    .map((item, index) => ({
      id: isRecord(item) ? readText(item, ["id", "key"], `proof_${index + 1}`) : `proof_${index + 1}`,
      label: readItemLabel(item),
      detail: readItemDetail(item),
    }))
    .filter((item) => item.label);

  if (!items.length) return null;
  return (
    <section className="bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="grid gap-3 rounded-[8px] border border-border/70 bg-card/80 p-3 shadow-sm md:grid-cols-3">
          {items.slice(0, 6).map((item) => (
            <div key={item.id} className="flex items-start gap-3 rounded-[8px] px-3 py-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div>
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                {item.detail ? <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

const PagesRail = ({ pages }: { pages: unknown }) => {
  const navigateTo = useNavigateTarget();
  const pagesRecord = isRecord(pages) ? pages : {};
  const items = asArray(pages)
    .map((page, index) => {
      if (!isRecord(page) && typeof page !== "string") return null;
      return {
        id: isRecord(page) ? readText(page, ["id", "key", "slug"], `page_${index + 1}`) : `page_${index + 1}`,
        label: readItemLabel(page, `Pagina ${index + 1}`),
        detail: readItemDetail(page),
        href: isRecord(page) ? readText(page, ["href", "route", "url", "path", "to"]) : "",
      };
    })
    .filter(Boolean) as Array<{ id: string; label: string; detail: string; href: string }>;

  if (!items.length) return null;
  return (
    <section className="chatboc-muted-band py-14">
      <div className="container mx-auto px-4">
        <div className="chatboc-landing-panel grid gap-0 overflow-hidden lg:grid-cols-[0.7fr_1.3fr]">
          <div className="border-b border-border/70 p-6 lg:border-b-0 lg:border-r">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[8px] bg-primary/10 text-primary">
              <Layers3 className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {readCopyText(pagesRecord, ["title", "heading", "label"], "Más formas de usar Chatboc")}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {readCopyText(
                pagesRecord,
                ["description", "subtitle", "copy"],
                "Explorá demos, sectores y casos de uso pensados para que cualquier equipo entienda el valor en minutos.",
              )}
            </p>
          </div>
          <div className="grid gap-3 p-4 md:grid-cols-2">
            {items.slice(0, 6).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => item.href && navigateTo(item.href)}
                className="rounded-[8px] border border-border/70 bg-background/75 p-4 text-left transition hover:border-primary/35 hover:bg-primary/5"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="font-semibold text-foreground">{item.label}</span>
                  {item.href ? <ArrowRight className="h-4 w-4 text-primary" /> : <CircleDot className="h-4 w-4 text-muted-foreground" />}
                </div>
                {item.detail ? <p className="text-sm leading-6 text-muted-foreground">{item.detail}</p> : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const CtaBand = ({ ctas }: { ctas: unknown }) => {
  const navigateTo = useNavigateTarget();
  const items = asArray(ctas)
    .map((cta, index) => {
      if (!isRecord(cta) && typeof cta !== "string") return null;
      return {
        id: isRecord(cta) ? readText(cta, ["id", "key"], `cta_${index + 1}`) : `cta_${index + 1}`,
        label: readItemLabel(cta),
        href: isRecord(cta) ? readText(cta, ["href", "url", "route", "to", "endpoint"]) : "",
        primary: isRecord(cta) ? cta.primary === true || readText(cta, ["variant"]) === "primary" : index === 0,
      };
    })
    .filter((item): item is { id: string; label: string; href: string; primary: boolean } => Boolean(item?.label));

  if (!items.length) return null;
  return (
    <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
      {items.slice(0, 2).map((item) => (
        <Button
          key={item.id}
          type="button"
          variant={item.primary ? "default" : "outline"}
          size="lg"
          className={`${item.primary ? "chatboc-cta-primary" : "border-border/80 bg-background/70"} rounded-[8px] font-semibold`}
          onClick={() => item.href && navigateTo(item.href)}
        >
          {item.primary ? <MousePointer2 className="mr-2 h-5 w-5" /> : null}
          {item.label}
          {!item.primary ? <ArrowRight className="ml-2 h-5 w-5" /> : null}
        </Button>
      ))}
    </div>
  );
};

const DynamicSection = ({ section, index }: { section: LandingRecord; index: number }) => {
  const cards = normalizeCards(section);
  const steps = normalizeSteps(section);
  const metrics = normalizeMetrics(section);
  const ctas = first(section, ["ctas", "actions", "buttons"]);
  const kind = sectionKind(section, index);
  const isMuted = index % 2 === 0 || kind.includes("problem") || kind.includes("proof");

  return (
    <section
      id={readText(section, ["anchor", "id", "key"], `landing-section-${index + 1}`)}
      data-landing-section={kind || `section_${index + 1}`}
      className={`${isMuted ? "chatboc-muted-band" : "bg-background"} py-16 text-foreground md:py-24`}
    >
      <div className="container mx-auto px-4">
        <SectionHeader section={section} />
        <div className="space-y-5">
          {metrics.length ? <MetricsPanel metrics={metrics} /> : null}
          {steps.length ? <WorkflowPanel steps={steps} /> : null}
          {cards.length ? <CardGrid cards={cards} /> : null}
          {!metrics.length && !steps.length && !cards.length ? (
            <div className="mx-auto max-w-3xl rounded-[8px] border border-dashed border-border/70 bg-card/70 p-6 text-center text-sm text-muted-foreground">
              {readCopyText(section, ["empty_state", "fallback", "state"], "Esta sección se está preparando para mostrar más ejemplos.")}
            </div>
          ) : null}
        </div>
        <CtaBand ctas={ctas} />
      </div>
    </section>
  );
};

export const hasRenderableLandingSections = (experience?: LandingExperience | null) => {
  const sections = asArray(experience?.sections).filter(isRecord).filter((section) => !isHeroSection(section));
  return sections.length > 0 || asArray(experience?.pages).length > 0 || asArray(experience?.proof_bar).length > 0;
};

export default function LandingExperienceSections({ experience }: LandingExperienceSectionsProps) {
  const sections = useMemo(
    () => asArray(experience?.sections).filter(isRecord).filter((section) => !isHeroSection(section)),
    [experience],
  );
  const hasTopLevelCtas = asArray(experience?.ctas).length > 0;

  if (!hasRenderableLandingSections(experience)) return null;

  return (
    <>
      <ProofBar source={experience?.proof_bar} />
      {sections.map((section, index) => (
        <DynamicSection key={readText(section, ["id", "key", "slug"], `landing-section-${index + 1}`)} section={section} index={index} />
      ))}
      <PagesRail pages={experience?.pages} />
      {hasTopLevelCtas ? (
        <section className="bg-background py-14">
          <div className="container mx-auto px-4">
            <div className="chatboc-landing-panel p-6 text-center md:p-8">
              <CtaBand ctas={experience?.ctas} />
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
