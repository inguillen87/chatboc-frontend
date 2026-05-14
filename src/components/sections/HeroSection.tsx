import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import ChatbocBrandLockup from "@/components/brand/ChatbocBrandLockup";
import {
  ArrowRight,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  GraduationCap,
  Image as ImageIcon,
  Landmark,
  MapPin,
  Mic,
  PackageCheck,
  Paperclip,
  Send,
  ShoppingCart,
  Store,
  TicketCheck,
  UsersRound,
  Zap,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import type { LandingExperience, LandingRecord } from "@/api/landingExperience";
import { cleanLandingCopy } from "@/utils/landingCopy";

type AnyRecord = Record<string, any>;

interface HeroSectionProps {
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

const asDemoArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    const items = first(value, [
      "flows",
      "items",
      "examples",
      "conversations",
      "sample_conversations",
      "scenarios",
      "steps",
    ]);
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
  return asArray(source)
    .map((item) => readItemLabel(item))
    .filter(Boolean);
};

const normalizeMetrics = (source: unknown) => {
  const tones = ["bg-emerald-500", "bg-amber-500", "bg-sky-500", "bg-violet-500"];
  const items = asArray(source)
    .map((item, index) => {
      if (!isRecord(item)) return null;
      const label = readText(item, ["label", "title", "name"]);
      const value = readText(item, ["value", "metric", "count", "score"]);
      if (!label || !value) return null;
      return {
        label,
        value,
        detail: readText(item, ["detail", "description", "subtitle"]),
        tone: readText(item, ["tone", "color_class"], tones[index % tones.length]),
      };
    })
    .filter(Boolean) as Array<{ label: string; value: string; detail: string; tone: string }>;
  return items.slice(0, 3);
};

const normalizeWorkflowSteps = (source: unknown) =>
  asArray(source)
    .map((item) => readItemLabel(item))
    .filter(Boolean)
    .slice(0, 4);

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

const DEFAULT_HEADLINE = "Converti conversaciones en operaciones reales";
const DEFAULT_DESCRIPTION =
  "Chatboc atiende por web o WhatsApp, pide los datos justos y deja casos, pedidos o leads listos para operar.";
const DEFAULT_CONVERSATION_TITLE = "WhatsApp operativo";
const DEFAULT_CONVERSATION_SUBTITLE = "Un caso entra, el agente pide datos y deja una accion trazable.";
const DEFAULT_PRIMARY_CTA = { label: "Probar una conversacion real", target: "/demo" };
const DEFAULT_SECONDARY_CTA = { label: "Hablar con ventas", target: "/demo?intent=ventas" };

const normalizeHeroMediaUrl = (raw: string) => {
  const value = raw.trim();
  if (!value) return "";
  if (/^(https?:|data:|blob:)/i.test(value)) return value;

  // Backend can publish static demo hints before the asset exists on the
  // frontend host. Avoid showing broken images in the first viewport.
  if (value.startsWith("/static/")) {
    return "";
  }

  return value.startsWith("/") ? value : `/${value}`;
};

const isBrandOnlyHeadline = (value: string) => {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return !normalized || normalized === "chatboc" || normalized === "chatbocar";
};

const inferInputKind = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized.includes("foto") || normalized.includes("image") || normalized.includes("imagen")) return "image";
  if (normalized.includes("ubic") || normalized.includes("gps") || normalized.includes("map")) return "location";
  if (normalized.includes("audio") || normalized.includes("voz") || normalized.includes("voice")) return "audio";
  if (
    normalized.includes("turno") ||
    normalized.includes("agenda") ||
    normalized.includes("fecha") ||
    normalized.includes("calendar") ||
    normalized.includes("calendario")
  ) {
    return "calendar";
  }
  if (
    normalized.includes("pago") ||
    normalized.includes("cuota") ||
    normalized.includes("deuda") ||
    normalized.includes("cobro") ||
    normalized.includes("payment")
  ) {
    return "payment";
  }
  if (
    normalized.includes("catalog") ||
    normalized.includes("producto") ||
    normalized.includes("lista") ||
    normalized.includes("precio")
  ) {
    return "catalog";
  }
  if (
    normalized.includes("pedido") ||
    normalized.includes("carrito") ||
    normalized.includes("orden") ||
    normalized.includes("order") ||
    normalized.includes("checkout") ||
    normalized.includes("cotiz")
  ) {
    return "cart";
  }
  if (normalized.includes("archivo") || normalized.includes("adjunto") || normalized.includes("pdf") || normalized.includes("file")) return "file";
  return "text";
};

type ConversationInput = {
  kind: string;
  label: string;
  detail: string;
  previewUrl: string;
  address: string;
  lat: string;
  lng: string;
};

type ConversationAction = {
  label: string;
  detail: string;
  status: string;
  ctaLabel: string;
  ctaTarget: string;
  fields: Array<{ label: string; value: string }>;
};

type ConversationFlow = {
  id: string;
  label: string;
  sector: string;
  message: string;
  response: string;
  inputs: ConversationInput[];
  action?: ConversationAction;
  resultTraceable: boolean;
  highlights: string[];
  workflowSteps: string[];
  tone: string;
};

const svgPreview = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

const DEMO_ATTACHMENT_PREVIEWS: Record<string, string> = {
  gobierno: svgPreview(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 260">
      <defs>
        <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#dbeafe"/>
          <stop offset="1" stop-color="#f8fafc"/>
        </linearGradient>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values=".35"/>
          <feBlend mode="multiply" in2="SourceGraphic"/>
        </filter>
      </defs>
      <rect width="420" height="260" rx="22" fill="url(#sky)"/>
      <path d="M0 138h420v122H0z" fill="#64748b"/>
      <path d="M0 160c58-18 112-16 162 5s102 19 156 0c38-13 72-18 102-12v107H0z" fill="#334155"/>
      <path d="M0 142h420" stroke="#cbd5e1" stroke-width="10"/>
      <path d="M48 185c44-12 75-11 92 4 15 14 44 17 75 7 22-8 47-4 72 11" fill="none" stroke="#94a3b8" stroke-width="9" stroke-linecap="round"/>
      <ellipse cx="132" cy="205" rx="48" ry="20" fill="#0f172a" opacity=".52"/>
      <ellipse cx="132" cy="198" rx="29" ry="11" fill="#64748b"/>
      <path d="M308 56v104" stroke="#475569" stroke-width="8" stroke-linecap="round"/>
      <path d="M282 52h68" stroke="#475569" stroke-width="9" stroke-linecap="round"/>
      <circle cx="354" cy="56" r="17" fill="#fde68a"/>
      <circle cx="354" cy="56" r="30" fill="#fde68a" opacity=".26"/>
      <rect x="16" y="18" width="142" height="38" rx="19" fill="#ffffff" opacity=".88"/>
      <circle cx="40" cy="37" r="9" fill="#2563eb"/>
      <rect x="58" y="30" width="76" height="5" rx="2.5" fill="#94a3b8"/>
      <rect x="58" y="41" width="52" height="5" rx="2.5" fill="#cbd5e1"/>
      <rect width="420" height="260" rx="22" fill="#000000" opacity=".08" filter="url(#grain)"/>
    </svg>
  `),
  pyme: svgPreview(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 260">
      <defs>
        <linearGradient id="desk" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#fef3c7"/>
          <stop offset="1" stop-color="#d97706"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="14" stdDeviation="10" flood-color="#7c2d12" flood-opacity=".26"/>
        </filter>
      </defs>
      <rect width="420" height="260" rx="22" fill="url(#desk)"/>
      <rect x="88" y="24" width="232" height="210" rx="12" fill="#fffaf0" filter="url(#shadow)" transform="rotate(-3 204 129)"/>
      <rect x="116" y="50" width="84" height="10" rx="5" fill="#0f172a" opacity=".72" transform="rotate(-3 158 55)"/>
      <rect x="115" y="75" width="166" height="4" rx="2" fill="#94a3b8" transform="rotate(-3 198 77)"/>
      <rect x="115" y="94" width="184" height="4" rx="2" fill="#cbd5e1" transform="rotate(-3 207 96)"/>
      <rect x="116" y="113" width="152" height="4" rx="2" fill="#cbd5e1" transform="rotate(-3 192 115)"/>
      <path d="M124 142c25-9 42 8 66 2 22-6 38-20 62-13" fill="none" stroke="#1d4ed8" stroke-width="5" stroke-linecap="round" transform="rotate(-3 188 138)"/>
      <path d="M125 165c18-7 30 5 46 0 22-7 36-14 58-9" fill="none" stroke="#1d4ed8" stroke-width="4" stroke-linecap="round" transform="rotate(-3 177 161)"/>
      <rect x="230" y="178" width="58" height="22" rx="6" fill="#16a34a" opacity=".88" transform="rotate(-3 259 189)"/>
      <circle cx="72" cy="204" r="32" fill="#78350f" opacity=".16"/>
      <rect x="302" y="30" width="58" height="96" rx="12" fill="#0f172a" opacity=".82" transform="rotate(9 331 78)"/>
      <rect x="314" y="46" width="35" height="58" rx="7" fill="#e0f2fe" transform="rotate(9 331 75)"/>
    </svg>
  `),
  educacion: svgPreview(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 260">
      <defs>
        <linearGradient id="paper" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#eef2ff"/>
          <stop offset="1" stop-color="#ffffff"/>
        </linearGradient>
        <filter id="docshadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="14" stdDeviation="12" flood-color="#312e81" flood-opacity=".2"/>
        </filter>
      </defs>
      <rect width="420" height="260" rx="22" fill="#dbeafe"/>
      <rect x="64" y="22" width="240" height="210" rx="14" fill="url(#paper)" filter="url(#docshadow)" transform="rotate(2 184 127)"/>
      <circle cx="98" cy="61" r="18" fill="#6366f1" opacity=".9"/>
      <rect x="128" y="50" width="112" height="8" rx="4" fill="#1e293b" opacity=".74"/>
      <rect x="128" y="66" width="84" height="5" rx="2.5" fill="#94a3b8"/>
      <rect x="94" y="98" width="176" height="5" rx="2.5" fill="#cbd5e1"/>
      <rect x="94" y="119" width="190" height="5" rx="2.5" fill="#cbd5e1"/>
      <rect x="94" y="140" width="156" height="5" rx="2.5" fill="#cbd5e1"/>
      <rect x="94" y="166" width="78" height="24" rx="7" fill="#22c55e" opacity=".84"/>
      <circle cx="250" cy="177" r="30" fill="none" stroke="#6366f1" stroke-width="8" opacity=".62"/>
      <path d="M232 177l12 12 27-30" fill="none" stroke="#6366f1" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="286" y="58" width="72" height="120" rx="13" fill="#ffffff" opacity=".88" transform="rotate(-10 322 118)"/>
      <rect x="302" y="86" width="40" height="6" rx="3" fill="#94a3b8" transform="rotate(-10 322 89)"/>
      <rect x="301" y="108" width="42" height="42" rx="8" fill="#bfdbfe" transform="rotate(-10 322 129)"/>
    </svg>
  `),
  platform: svgPreview(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 260">
      <rect width="420" height="260" rx="22" fill="#e2e8f0"/>
      <rect x="34" y="36" width="154" height="92" rx="18" fill="#ffffff"/>
      <rect x="208" y="36" width="178" height="92" rx="18" fill="#ffffff"/>
      <rect x="34" y="146" width="214" height="78" rx="18" fill="#ffffff"/>
      <circle cx="82" cy="82" r="24" fill="#2563eb" opacity=".82"/>
      <rect x="116" y="70" width="46" height="7" rx="3.5" fill="#94a3b8"/>
      <rect x="116" y="86" width="34" height="7" rx="3.5" fill="#cbd5e1"/>
      <path d="M232 90c35-32 77-30 122 6" fill="none" stroke="#16a34a" stroke-width="11" stroke-linecap="round"/>
      <rect x="64" y="172" width="148" height="7" rx="3.5" fill="#94a3b8"/>
      <rect x="64" y="190" width="108" height="7" rx="3.5" fill="#cbd5e1"/>
    </svg>
  `),
};

const getDemoAttachmentPreview = (inputKind: string, family: string) => {
  if (["text", "audio", "location"].includes(inputKind)) return "";
  return DEMO_ATTACHMENT_PREVIEWS[family] ?? DEMO_ATTACHMENT_PREVIEWS.platform;
};

const normalizeFieldRows = (source: unknown) => {
  const recordToRows = (record: AnyRecord) =>
    Object.entries(record)
      .map(([key, value]) => {
        if (value === undefined || value === null || value === "") return null;
        if (isRecord(value)) {
          const label = readText(value, ["label", "title", "name", "key"], key);
          const rowValue = readText(value, ["value", "text", "description", "status"]);
          return label && rowValue ? { label, value: rowValue } : null;
        }
        const rowValue = typeof value === "number" && Number.isFinite(value) ? String(value) : String(value).trim();
        return rowValue ? { label: cleanLandingCopy(key), value: cleanLandingCopy(rowValue) } : null;
      })
      .filter(Boolean) as Array<{ label: string; value: string }>;

  const rows = asArray(source)
    .flatMap((item) => {
      if (typeof item === "string" && item.trim()) return [];
      if (!isRecord(item)) return [];
      const label = readText(item, ["label", "title", "name", "key"]);
      const value = readText(item, ["value", "text", "description", "status"]);
      if (label && value) return [{ label, value }];
      return recordToRows(item);
    })
    .filter(Boolean) as Array<{ label: string; value: string }>;

  if (rows.length) return rows.slice(0, 6);
  if (isRecord(source)) return recordToRows(source).slice(0, 6);
  return [];
};

const normalizeDemoInputs = (source: unknown, fallback: ConversationInput[] = []) => {
  const items = asDemoArray(source);
  if (!items.length) return fallback;

  const inputs = items
    .map((item) => {
      if (typeof item === "string" && item.trim()) {
        const label = cleanLandingCopy(item.trim());
        return { kind: inferInputKind(label), label, detail: "", previewUrl: "", address: "", lat: "", lng: "" };
      }
      if (!isRecord(item)) return null;
      const label = readText(item, ["label", "title", "name", "text", "mode"]);
      if (!label) return null;
      const rawKind = readRawText(item, ["kind", "type", "mode", "id"], label);
      return {
        kind: inferInputKind(rawKind),
        label,
        detail: readText(item, ["detail", "description", "subtitle", "transcript", "summary"]),
        previewUrl: normalizeHeroMediaUrl(
          readRawText(item, ["preview_url", "thumbnail_url", "image_url", "file_url", "url", "src", "href"]),
        ),
        address: readText(item, ["address", "direccion", "formatted_address"]),
        lat: readRawText(item, ["lat", "latitude"]),
        lng: readRawText(item, ["lng", "lon", "longitude"]),
      };
    })
    .filter(Boolean) as ConversationInput[];

  return inputs.length ? inputs.slice(0, 4) : fallback;
};

const normalizeAction = (source: unknown, ctaSource?: unknown): ConversationAction | undefined => {
  const action = isRecord(source) ? source : {};
  const cta = isRecord(ctaSource) ? ctaSource : {};
  const label = readText(action, ["label", "title", "name", "status_label"]);
  const detail = readText(action, ["detail", "description", "summary", "copy"]);
  const status = readText(action, ["status_label", "display_status", "badge_label", "state_label", "badge"]);

  if (!label && !detail && !status) return undefined;

  return {
    label,
    detail,
    status,
    ctaLabel: readText(cta, ["label", "title", "text"]),
    ctaTarget: readRawText(cta, ["href", "to", "route", "url"]),
    fields: normalizeFieldRows(
      first(action, ["fields", "metadata", "summary_items", "facts", "details", "attributes"]),
    ),
  };
};

const isTraceableResult = (source: unknown) => {
  if (!isRecord(source)) return false;
  const traceable = source.traceable;
  if (traceable === true) return true;
  if (typeof traceable === "string") return traceable.toLowerCase() === "true";
  return Boolean(readText(source, ["target", "panel", "kind", "id"]));
};

const normalizeConversationFlows = (source: unknown): ConversationFlow[] => {
  const items = asDemoArray(source);
  if (!items.length) return [];

  const sourceRecord = isRecord(source) ? source : undefined;
  const threadMessages = items.filter(
    (item): item is AnyRecord =>
      isRecord(item) &&
      typeof first(item, ["text", "message", "content", "copy"]) === "string" &&
      typeof first(item, ["role", "author", "from"]) === "string",
  );

  if (threadMessages.length === items.length) {
    const firstUser = threadMessages.find((item) => {
      const role = readRawText(item, ["role", "author", "from"]).toLowerCase();
      return role.includes("user") || role.includes("cliente") || role.includes("vecino") || role.includes("familia");
    });
    const firstAssistant = threadMessages.find((item) => {
      const role = readRawText(item, ["role", "author", "from"]).toLowerCase();
      return role.includes("assistant") || role.includes("agent") || role.includes("bot") || role.includes("chatboc");
    });
    const action = normalizeAction(
      first(sourceRecord, ["action", "result", "outcome", "ticket", "order", "case"]),
      first(sourceRecord, ["cta", "primary_cta", "demo_cta"]),
    );
    const resultTraceable = isTraceableResult(first(sourceRecord, ["result", "outcome", "ticket", "order", "case"]));
    const highlights = asArray(first(sourceRecord, ["highlights", "chips", "outcomes", "tags"]))
      .map((chip) => readItemLabel(chip))
      .filter(Boolean)
      .slice(0, 3);

    return [
      {
        id: readRawText(sourceRecord, ["id", "key", "slug"], "conversation"),
        label: readText(sourceRecord, ["label", "title", "name", "tab_label"]),
        sector: readRawText(sourceRecord, ["sector", "vertical", "mode", "kind"], ""),
        message: readText(firstUser, ["text", "message", "content", "copy"]),
        response: readText(firstAssistant, ["text", "message", "content", "copy"]),
        inputs: normalizeDemoInputs(first(sourceRecord, ["inputs", "media", "input_modes", "attachments", "capabilities"])),
        action,
        resultTraceable,
        highlights,
        workflowSteps: normalizeWorkflowSteps(first(sourceRecord, ["workflow_steps", "agent_steps", "steps", "process_steps"])),
        tone: readText(sourceRecord, ["tone", "color_class"], "bg-primary"),
      },
    ];
  }

  const flows = items
    .map((item, index) => {
      if (!isRecord(item)) return null;
      const action = isRecord(first(item, ["action", "result", "outcome", "ticket", "order", "case"]))
        ? (first(item, ["action", "result", "outcome", "ticket", "order", "case"]) as AnyRecord)
        : {};
      const result = isRecord(first(item, ["result", "outcome", "ticket", "order", "case"]))
        ? (first(item, ["result", "outcome", "ticket", "order", "case"]) as AnyRecord)
        : {};
      const cta = isRecord(first(item, ["cta", "primary_cta", "demo_cta"]))
        ? (first(item, ["cta", "primary_cta", "demo_cta"]) as AnyRecord)
        : {};
      const label = readText(item, ["label", "title", "name", "sector_label", "tab_label"]);
      const sector = readRawText(item, ["sector", "vertical", "mode", "kind"], "");
      const id = readRawText(item, ["id", "key", "slug"], sector || label || `demo-${index + 1}`)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-");
      const message = readText(item, ["user_message", "message", "input", "prompt", "example", "question"]);
      const response = readText(item, ["agent_message", "assistant_message", "response", "reply", "bot_message", "answer"]);

      if (!message || !response) return null;

      return {
        id: id || `demo-${index + 1}`,
        label,
        sector,
        message,
        response,
        inputs: normalizeDemoInputs(first(item, ["inputs", "media", "input_modes", "attachments", "capabilities"])),
        action: normalizeAction(action, cta),
        resultTraceable: isTraceableResult(result),
        highlights: (() => {
          const chips = asArray(first(item, ["highlights", "chips", "outcomes", "tags"]))
            .map((chip) => readItemLabel(chip))
            .filter(Boolean)
            .slice(0, 3);
          return chips;
        })(),
        workflowSteps: normalizeWorkflowSteps(first(item, ["workflow_steps", "agent_steps", "steps", "process_steps"])),
        tone: readText(item, ["tone", "color_class"], "bg-primary"),
      };
    })
    .filter(Boolean) as ConversationFlow[];

  return flows.length ? flows.slice(0, 4) : [];
};

const mergeConversationFlows = (source: unknown) => {
  const backendFlows = normalizeConversationFlows(source);
  return backendFlows
    .filter((flow) => Boolean(flow.action || flow.resultTraceable))
    .slice(0, 6);
};

const getInputIcon = (kind: string) => {
  switch (inferInputKind(kind)) {
    case "image":
      return ImageIcon;
    case "location":
      return MapPin;
    case "audio":
      return Mic;
    case "calendar":
      return CalendarDays;
    case "payment":
      return CreditCard;
    case "catalog":
      return Store;
    case "cart":
      return ShoppingCart;
    case "file":
      return Paperclip;
    default:
      return Bot;
  }
};

const inferFlowFamily = (flow: {
  sector: string;
  label: string;
  id: string;
  message?: string;
  response?: string;
  action?: ConversationAction;
  inputs?: ConversationInput[];
}) => {
  const key = [
    flow.sector,
    flow.label,
    flow.id,
    flow.message,
    flow.response,
    flow.action?.label,
    flow.action?.detail,
    ...(flow.inputs ?? []).flatMap((input) => [input.kind, input.label, input.detail]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (
    key.includes("educ") ||
    key.includes("coleg") ||
    key.includes("escuela") ||
    key.includes("familia") ||
    key.includes("cuota") ||
    key.includes("secretaria") ||
    key.includes("alumno") ||
    key.includes("certificado") ||
    key.includes("constancia") ||
    key.includes("inasistencia")
  ) {
    return "educacion";
  }
  if (
    key.includes("pyme") ||
    key.includes("empresa") ||
    key.includes("venta") ||
    key.includes("pedido") ||
    key.includes("catalog") ||
    key.includes("carrito") ||
    key.includes("bodega") ||
    key.includes("ferreter") ||
    key.includes("almacen")
  ) {
    return "pyme";
  }
  if (
    key.includes("gob") ||
    key.includes("muni") ||
    key.includes("reclamo") ||
    key.includes("ticket") ||
    key.includes("bache") ||
    key.includes("alumbrado") ||
    key.includes("calzada") ||
    key.includes("semaforo") ||
    key.includes("residuo")
  ) {
    return "gobierno";
  }
  return "platform";
};

const FLOW_FAMILY_CLASSNAMES: Record<string, string> = {
  gobierno: "chatboc-phone-demo--gobierno",
  pyme: "chatboc-phone-demo--pyme",
  educacion: "chatboc-phone-demo--educacion",
  platform: "chatboc-phone-demo--platform",
};

const getFlowFamilyClassName = (family: string) =>
  FLOW_FAMILY_CLASSNAMES[family] ?? FLOW_FAMILY_CLASSNAMES.platform;

const getFlowIcon = (flow: { sector: string; label: string; id: string }) => {
  const family = inferFlowFamily(flow);
  if (family === "gobierno") return Landmark;
  if (family === "educacion") return GraduationCap;
  if (family === "pyme") return Store;
  return Bot;
};

const getFlowTabLabel = (flow: { sector: string; label: string; id: string }) =>
  flow.label || cleanLandingCopy(flow.sector || flow.id);

const getActionIcon = (value: string) => {
  const key = value.toLowerCase();
  if (key.includes("pedido") || key.includes("order")) return PackageCheck;
  if (key.includes("carrito") || key.includes("venta")) return ShoppingCart;
  if (key.includes("reclamo") || key.includes("ticket")) return TicketCheck;
  if (key.includes("caso") || key.includes("familia")) return UsersRound;
  if (key.includes("turno") || key.includes("agenda") || key.includes("calendario")) return CalendarDays;
  if (key.includes("pago") || key.includes("cuota") || key.includes("deuda")) return CreditCard;
  return ClipboardCheck;
};

const HeroInputCard = ({ input, family }: { input: ConversationInput; family: string }) => {
  const [imageFailed, setImageFailed] = React.useState(false);
  const InputIcon = getInputIcon(input.kind);
  const inputKind = inferInputKind(input.kind);
  const backendPreviewUrl = input.previewUrl && !imageFailed ? input.previewUrl : "";
  const fallbackPreviewUrl = getDemoAttachmentPreview(inputKind, family);
  const imageSrc = backendPreviewUrl || fallbackPreviewUrl;
  const canShowPreview = Boolean(imageSrc);
  const hasLocation = inputKind === "location" && (input.address || input.lat || input.lng);

  React.useEffect(() => {
    setImageFailed(false);
  }, [input.previewUrl]);

  return (
    <div className={`chatboc-hero-attachment chatboc-hero-attachment--${inputKind}`}>
      <div className="flex items-center gap-2 font-semibold">
        <InputIcon className="h-4 w-4 text-primary" />
        <span>{input.label}</span>
      </div>
      {canShowPreview && (
        <img
          src={imageSrc}
          alt={input.label}
          className="chatboc-hero-attachment__photo"
          loading="eager"
          onError={() => {
            if (backendPreviewUrl) setImageFailed(true);
          }}
        />
      )}
      {hasLocation && (
        <div className="mt-2 rounded-[10px] border border-primary/15 bg-primary/5 px-2 py-2 text-[11px] leading-5 text-foreground">
          <div className="chatboc-hero-location-map" aria-hidden="true">
            <span />
            <i />
          </div>
          {input.address && <p>{input.address}</p>}
          {(input.lat || input.lng) && (
            <p className="text-muted-foreground">
              {[input.lat, input.lng].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      )}
      {inputKind === "audio" && (
        <div className="chatboc-hero-waveform mt-2" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={index} />
          ))}
        </div>
      )}
      {["catalog", "cart", "payment", "calendar", "file"].includes(inputKind) && !canShowPreview && (
        <div className={`chatboc-hero-mini-preview chatboc-hero-mini-preview--${inputKind} mt-2`} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
      {input.detail && <p className="mt-2 leading-5">{input.detail}</p>}
    </div>
  );
};

const HeroSection = ({ experience }: HeroSectionProps) => {
  const navigate = useNavigate();

  const hero = useMemo(() => resolveHeroSource(experience), [experience]);
  const tokens = isRecord(experience?.tokens) ? experience.tokens : {};
  const colors = isRecord(first(tokens, ["colors", "palette"])) ? (first(tokens, ["colors", "palette"]) as AnyRecord) : {};

  const heroHeadline = readText(hero, ["headline", "title", "heading", "h1"]);
  const headline =
    (isBrandOnlyHeadline(heroHeadline) ? readText(hero, ["value_prop", "main_copy"]) : heroHeadline) ||
    DEFAULT_HEADLINE;
  const description =
    readText(hero, ["subheadline", "subtitle", "description", "copy", "body"]) || DEFAULT_DESCRIPTION;
  const eyebrow = readText(hero, ["eyebrow", "kicker", "badge_label", "tagline"]);

  const proofItems = normalizeProofItems(
    first(hero, ["proof_items", "trust_signals", "proof", "badges"]) ?? experience?.proof_bar,
  );
  const dashboardRows = normalizeMetrics(
    first(hero, ["metrics", "stats", "dashboard_rows"]) ?? first(hero, ["preview", "metrics"]),
  );
  const workflowSteps = normalizeWorkflowSteps(first(hero, ["workflow_steps", "agent_steps", "steps", "process_steps"]));
  const primaryCta = normalizeCta(first(hero, ["primary_cta", "primaryCta"]) ?? asArray(experience?.ctas)[0], {
    label: DEFAULT_PRIMARY_CTA.label,
    target: DEFAULT_PRIMARY_CTA.target,
  });
  const secondaryCta = normalizeCta(first(hero, ["secondary_cta", "secondaryCta"]) ?? asArray(experience?.ctas)[1], {
    label: DEFAULT_SECONDARY_CTA.label,
    target: DEFAULT_SECONDARY_CTA.target,
  });
  const previewTitle = readText(hero, ["preview_title", "dashboard_title"]) || DEFAULT_CONVERSATION_TITLE;
  const previewCopy = readText(hero, ["preview_copy", "dashboard_description"]) || DEFAULT_CONVERSATION_SUBTITLE;
  const conversationFlows = useMemo(
    () => {
      const experienceRecord = isRecord(experience) ? (experience as AnyRecord) : undefined;
      const heroMedia = isRecord(first(hero, ["media"])) ? (first(hero, ["media"]) as AnyRecord) : undefined;
      return mergeConversationFlows(
        first(hero, ["conversation_demo", "demo_conversation", "live_demo", "workflow_demo", "sample_conversations"]) ??
          first(heroMedia, ["conversation_demo", "demo_conversation", "live_demo", "workflow_demo", "chat_preview", "sample_conversations"]) ??
          first(experienceRecord, ["conversation_demo", "demo_conversation", "live_demo", "sample_conversations"]) ??
          first(first(experienceRecord, ["chat_seed", "demo_seed"]), ["sample_conversations", "conversation_demo"]),
      );
    },
    [experience, hero],
  );
  const [activeFlowId, setActiveFlowId] = React.useState(conversationFlows[0]?.id ?? "");
  const [manualFlowSelection, setManualFlowSelection] = React.useState(false);
  const phoneScreenRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!conversationFlows.some((flow) => flow.id === activeFlowId)) {
      setActiveFlowId(conversationFlows[0]?.id ?? "");
    }
  }, [activeFlowId, conversationFlows]);

  React.useEffect(() => {
    if (manualFlowSelection || conversationFlows.length < 2) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      setActiveFlowId((current) => {
        const currentIndex = Math.max(
          conversationFlows.findIndex((flow) => flow.id === current),
          0,
        );
        return conversationFlows[(currentIndex + 1) % conversationFlows.length]?.id ?? current;
      });
    }, 14800);
    return () => window.clearInterval(timer);
  }, [conversationFlows, manualFlowSelection]);

  const activeFlow = conversationFlows.find((flow) => flow.id === activeFlowId) ?? conversationFlows[0];
  const activeFlowIndex = Math.max(
    conversationFlows.findIndex((flow) => flow.id === activeFlow?.id),
    0,
  );
  const activeAction = activeFlow?.action;
  const activeWorkflowSteps = activeFlow?.workflowSteps.length ? activeFlow.workflowSteps : workflowSteps;
  const activeInputKinds = activeFlow?.inputs.map((input) => inferInputKind(input.kind)) ?? [];
  const ActiveFlowIcon = activeFlow ? getFlowIcon(activeFlow) : Bot;
  const ActiveActionIcon = activeAction ? getActionIcon(activeAction.label) : ClipboardCheck;
  const activeFlowFamily = activeFlow ? inferFlowFamily(activeFlow) : "platform";
  const actionSectionLabel = readText(hero, ["action_section_label", "result_label"]);
  const agentTitle = readText(hero, ["agent_title"]);
  const agentSubtitle = readText(hero, ["agent_subtitle"]);

  React.useEffect(() => {
    if (!activeFlow?.id) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    const scrollScreen = () => {
      const screen = phoneScreenRef.current;
      if (!screen) return;
      const targetTop = Math.max(0, screen.scrollHeight - screen.clientHeight - 500);
      screen.scrollTo({ top: targetTop, behavior: "smooth" });
      window.setTimeout(() => {
        screen.scrollTop = targetTop;
      }, 460);
    };
    const timers = [6200, 7800, 9400, 10600].map((delay) => window.setTimeout(scrollScreen, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [activeFlow?.id]);

  const heroPrimaryCta = {
    label: activeAction?.ctaLabel || primaryCta.label,
    target: activeAction?.ctaTarget || primaryCta.target,
  };

  const accentStyle = {
    ["--chatboc-hero-accent" as string]: readText(colors, ["primary", "accent"], ""),
  } as React.CSSProperties;
  const showHeroPreview =
    Boolean(activeFlow?.message && activeFlow?.response && (activeAction || activeFlow.resultTraceable));
  const headlineWords = headline.split(/\s+/).filter(Boolean);
  const headlineLead = headlineWords.slice(0, Math.max(2, headlineWords.length - 3)).join(" ");
  const headlineAccent = headlineWords.slice(Math.max(2, headlineWords.length - 3)).join(" ");

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
        <div className={`grid items-center gap-10 ${showHeroPreview ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
          <div className="min-w-0 max-w-3xl">
            <ChatbocBrandLockup size="hero" tone="auto" showAgent className="mb-6" />

            {eyebrow && (
              <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span className="truncate">{eyebrow}</span>
              </div>
            )}

            {headline && (
              <h1 className="chatboc-hero-headline text-4xl font-bold leading-[1.02] tracking-normal text-foreground sm:text-5xl md:text-6xl 2xl:text-7xl">
                <span>{headlineLead}</span>{" "}
                {headlineAccent && <span className="chatboc-hero-headline__accent">{headlineAccent}</span>}
              </h1>
            )}

            {description && (
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
                {description}
              </p>
            )}

            {(heroPrimaryCta.label || secondaryCta.label) && (
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {heroPrimaryCta.label && (
                  <Button
                    size="lg"
                    className="chatboc-cta-primary h-12 w-full rounded-[8px] px-6 text-base font-semibold sm:w-auto"
                    onClick={() => navigateTo(heroPrimaryCta.target)}
                  >
                    <Zap className="mr-2 h-5 w-5" />
                    {heroPrimaryCta.label}
                  </Button>
                )}
                {secondaryCta.label && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 w-full rounded-[8px] border-border/80 bg-background/70 px-6 text-base font-semibold shadow-sm backdrop-blur hover:border-primary/40 hover:bg-primary/5 sm:w-auto"
                    onClick={() => navigateTo(secondaryCta.target)}
                  >
                    {secondaryCta.label}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                )}
              </div>
            )}

            {proofItems.length > 0 && (
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
            )}
          </div>

          {showHeroPreview && (
          <div className="relative min-w-0">
            <div className="chatboc-hero-aura" aria-hidden="true" />
            <div className="chatboc-hero-preview">
              <span className="chatboc-hero-preview__button chatboc-hero-preview__button--volume" aria-hidden="true" />
              <span className="chatboc-hero-preview__button chatboc-hero-preview__button--power" aria-hidden="true" />
              {activeFlow && (
                <div className={`chatboc-phone-demo ${getFlowFamilyClassName(activeFlowFamily)}`}>
                  <div className="chatboc-phone-demo__chrome" aria-hidden="true">
                    <span />
                    <div>
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>

                  <div className="chatboc-phone-demo__bar">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                        <ActiveFlowIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        {readText(hero, ["conversation_title", "demo_title"], previewTitle) && (
                          <p className="truncate text-sm font-bold text-foreground">
                            {readText(hero, ["conversation_title", "demo_title"], previewTitle)}
                          </p>
                        )}
                        {readText(hero, ["conversation_subtitle", "demo_subtitle"], previewCopy) && (
                          <p className="truncate text-xs text-muted-foreground">
                            {readText(hero, ["conversation_subtitle", "demo_subtitle"], previewCopy)}
                          </p>
                        )}
                      </div>
                    </div>
                    {readText(hero, ["status_label", "preview_status"]) && (
                      <div className="chatboc-live-chip shrink-0 rounded-[8px] bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">
                        {readText(hero, ["status_label", "preview_status"])}
                      </div>
                    )}
                  </div>

                  {conversationFlows.length > 1 && (
                    <div className="chatboc-phone-demo__tabs" role="tablist" aria-label="demo">
                      {conversationFlows.map((flow) => {
                        const FlowIcon = getFlowIcon(flow);
                        const isActive = flow.id === activeFlow?.id;
                        return (
                          <button
                            key={flow.id}
                            type="button"
                            className={`chatboc-phone-demo__tab ${isActive ? "chatboc-phone-demo__tab--active" : ""}`}
                            onClick={() => {
                              setManualFlowSelection(true);
                              setActiveFlowId(flow.id);
                            }}
                          >
                            <FlowIcon className="h-4 w-4" />
                            <span>{getFlowTabLabel(flow)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div key={activeFlow.id} ref={phoneScreenRef} className="chatboc-phone-demo__screen">
                    <div className="chatboc-phone-demo__progress" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="chatboc-phone-demo__thread">
                      <div className="chatboc-phone-demo__sequence chatboc-phone-demo__sequence--1 flex justify-end">
                        <div className="chatboc-phone-demo__bubble chatboc-phone-demo__bubble--user">
                          {activeFlow.message}
                        </div>
                      </div>

                      {activeFlow.inputs.length > 0 && (
                        <div className="chatboc-phone-demo__sequence chatboc-phone-demo__sequence--2 chatboc-phone-demo__attachments">
                          {activeFlow.inputs.map((input) => (
                            <HeroInputCard
                              key={`${activeFlow.id}-${input.kind}-${input.label}`}
                              input={input}
                              family={activeFlowFamily}
                            />
                          ))}
                        </div>
                      )}

                      <div className="chatboc-phone-demo__sequence chatboc-phone-demo__sequence--3 flex items-center gap-2 pl-1">
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div className="chatboc-phone-demo__typing" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>

                      <div className="chatboc-phone-demo__sequence chatboc-phone-demo__sequence--4 flex items-start gap-3">
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div className="chatboc-phone-demo__bubble chatboc-phone-demo__bubble--agent">
                          {activeFlow.response}
                        </div>
                      </div>
                    </div>

                    {activeAction && (
                      <div className="chatboc-phone-demo__sequence chatboc-phone-demo__sequence--5 chatboc-phone-demo__result">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                              <ActiveActionIcon className="h-5 w-5" />
                            </div>
                            <div>
                              {actionSectionLabel && (
                                <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                                  {actionSectionLabel}
                                </p>
                              )}
                              <p className="text-lg font-bold text-foreground">{activeAction.label}</p>
                            </div>
                          </div>
                          {activeAction.status && (
                            <span className="rounded-[8px] border border-success/20 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                              {activeAction.status}
                            </span>
                          )}
                        </div>

                        {activeAction.detail && (
                          <p className="mt-4 text-sm leading-6 text-muted-foreground">{activeAction.detail}</p>
                        )}

                        {activeAction.fields.length > 0 && (
                          <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            {activeAction.fields.map((field) => (
                              <div
                                key={`${activeFlow.id}-${field.label}-${field.value}`}
                                className="rounded-[8px] border border-border/70 bg-muted/40 px-3 py-2"
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
                                  {field.label}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-foreground">{field.value}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {activeFlow.highlights.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {activeFlow.highlights.map((chip) => (
                              <span
                                key={`${activeFlow.id}-${chip}`}
                                className="rounded-[8px] border border-border/70 bg-muted/60 px-2.5 py-1 text-[11px] font-semibold text-foreground"
                              >
                                {chip}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {activeWorkflowSteps.length > 0 && (
                      <div className="chatboc-phone-demo__sequence chatboc-phone-demo__sequence--6 chatboc-phone-demo__steps">
                        {(agentTitle || agentSubtitle) && (
                          <div className="mb-3">
                            {agentTitle && <p className="text-sm font-semibold text-foreground">{agentTitle}</p>}
                            {agentSubtitle && <p className="text-xs text-muted-foreground">{agentSubtitle}</p>}
                          </div>
                        )}
                        <div className="grid gap-2 sm:grid-cols-2">
                          {activeWorkflowSteps.map((step, index) => (
                            <div key={step} className="flex items-center gap-3 rounded-[8px] border border-border/70 bg-muted/40 px-3 py-2">
                              <span
                                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                                  index <= activeFlowIndex
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {index + 1}
                              </span>
                              <span className="text-xs font-semibold text-foreground">{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeInputKinds.length > 0 && (
                      <div className="chatboc-phone-demo__sequence chatboc-phone-demo__sequence--7 chatboc-phone-demo__composer">
                        {activeFlow.inputs.map((input) => {
                          const ComposerIcon = getInputIcon(input.kind);
                          return (
                            <span
                              key={`${activeFlow.id}-composer-${input.kind}-${input.label}`}
                              className="chatboc-phone-demo__composer-chip"
                            >
                              <ComposerIcon className="h-3.5 w-3.5" />
                              <span>{input.label}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <div className="chatboc-phone-demo__sequence chatboc-phone-demo__sequence--8 chatboc-phone-demo__inputbar" aria-hidden="true">
                      <span>Mensaje por WhatsApp</span>
                      <Send className="h-4 w-4" />
                    </div>
                  </div>

                  {dashboardRows.length > 0 && (
                    <div className="chatboc-phone-demo__metrics">
                      {dashboardRows.map((row) => (
                        <div key={row.label} className="min-w-0">
                          <div className={`mb-2 h-1.5 w-9 rounded-full ${row.tone}`} />
                          <p className="truncate text-xs text-muted-foreground">{row.label}</p>
                          <p className="mt-1 text-xl font-bold text-foreground">{row.value}</p>
                          {row.detail && <p className="mt-1 truncate text-[11px] text-muted-foreground">{row.detail}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
