import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getTicketByNumber,
  getTicketTimeline,
  getTicketMessages,
  getLiveChatScheduleStatus,
  sendMessage,
  updateTicketPresence,
  updateTicketReadState,
} from "@/services/ticketService";
import type { LiveChatScheduleStatus } from "@/services/ticketService";
import {
  Ticket,
  Message,
  TicketHistoryEvent,
  TicketRealtimeState,
  UnifiedConversationStreamItem,
} from "@/types/tickets";
import { getErrorMessage, ApiError } from "@/utils/api";
import {
  CheckCircle2,
  Clock,
  MapPin,
  XCircle,
  Copy,
  MessageCircle,
  Search,
  FileText,
  AlertCircle,
  Camera,
  Calendar,
  User,
  ExternalLink,
  Loader2,
  ShieldCheck,
  RefreshCw,
  Hash,
  MessagesSquare,
  Sparkles,
  CheckCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import Confetti from "@/components/ui/Confetti";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import getOrCreateAnonId from "@/utils/anonIdGenerator";
import { trackFrontendEvent } from "@/utils/frontendTelemetry";
import { normalizeTicketLocation } from "@/utils/location";

const TrackingMap = React.lazy(() => import("@/components/ui/TrackingMap"));
const PUBLIC_TICKET_SIGNALING_ENABLED =
  import.meta.env.VITE_PUBLIC_TICKET_SIGNALING_ENABLED === "true";

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    accent: string;
    icon: any;
    step: number;
    description: string;
  }
> = {
  pendiente: {
    label: "Recibido",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    accent: "from-blue-500/10 via-white to-amber-50",
    icon: Clock,
    step: 1,
    description: "Tu reclamo ha sido recibido y está pendiente de asignación.",
  },
  abierto: {
    label: "Recibido",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    accent: "from-blue-500/10 via-white to-amber-50",
    icon: Clock,
    step: 1,
    description: "Tu reclamo ha sido registrado en el sistema.",
  },
  en_proceso: {
    label: "En Proceso",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    accent: "from-blue-500/15 via-blue-100/70 to-white",
    icon: AlertCircle,
    step: 2,
    description: "Estamos trabajando en la solución de tu reclamo.",
  },
  esperando_agente_en_vivo: {
    label: "Esperando agente",
    color: "bg-violet-100 text-violet-700 border-violet-200",
    accent: "from-violet-500/15 via-violet-100/70 to-white",
    icon: MessageCircle,
    step: 2,
    description: "Tu reclamo ya está derivado para atención en vivo.",
  },
  en_vivo: {
    label: "En vivo",
    color: "bg-violet-100 text-violet-700 border-violet-200",
    accent: "from-violet-500/15 via-violet-100/70 to-white",
    icon: MessageCircle,
    step: 2,
    description: "Ya hay una conversación en vivo activa sobre tu reclamo.",
  },
  asignado: {
    label: "En Proceso",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    accent: "from-blue-500/15 via-blue-100/70 to-white",
    icon: User,
    step: 2,
    description: "Un agente ha sido asignado a tu caso.",
  },
  resuelto: {
    label: "Resuelto",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    accent: "from-emerald-500/15 via-emerald-100/70 to-white",
    icon: CheckCircle2,
    step: 3,
    description: "El reclamo ha sido solucionado exitosamente.",
  },
  cerrado: {
    label: "Cerrado",
    color: "bg-gray-100 text-gray-700 border-gray-200",
    accent: "from-slate-500/10 via-slate-100/70 to-white",
    icon: CheckCircle2,
    step: 3,
    description: "El caso ha sido cerrado.",
  },
  cancelado: {
    label: "Cancelado",
    color: "bg-red-100 text-red-700 border-red-200",
    accent: "from-red-500/15 via-red-100/70 to-white",
    icon: XCircle,
    step: 0,
    description: "El reclamo fue cancelado.",
  },
  rechazado: {
    label: "Rechazado",
    color: "bg-red-100 text-red-700 border-red-200",
    accent: "from-red-500/15 via-red-100/70 to-white",
    icon: XCircle,
    step: 0,
    description: "El reclamo no pudo ser procesado.",
  },
};

const TICKET_STEPS = [
  { id: "pendiente", label: "Recibido" },
  { id: "en_proceso", label: "En Proceso" },
  { id: "resuelto", label: "Resuelto" },
];

const formatEventDate = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return format(parsed, "d 'de' MMMM, HH:mm", { locale: es });
};

const formatMessageDate = (value?: string | null) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return format(parsed, "d MMM · HH:mm", { locale: es });
};

const formatShortDate = (value?: string | null) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return format(parsed, "d MMM yyyy", { locale: es });
};

const formatLastSync = (value?: Date | null) => {
  if (!value) return "Actualizando estado";
  const seconds = Math.max(
    0,
    Math.round((Date.now() - value.getTime()) / 1000),
  );
  if (seconds < 15) return "Actualizado hace instantes";
  if (seconds < 60) return `Actualizado hace ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Actualizado hace ${minutes} min`;
  return `Actualizado ${format(value, "d MMM · HH:mm", { locale: es })}`;
};

type TicketNumberFallbackFields = Ticket & {
  ticket_number?: string | number | null;
  numero_ticket?: string | number | null;
  numero?: string | number | null;
  ticket_id?: string | number | null;
};

const resolvePublicTicketNumber = (
  ticket?: Ticket | null,
  fallback?: string | number | null,
) => {
  if (!ticket) return fallback ? String(fallback).trim() : "";
  const source = ticket as TicketNumberFallbackFields;
  const candidate =
    source.nro_ticket ||
    source.ticket_number ||
    source.numero_ticket ||
    source.numero ||
    fallback ||
    source.ticket_id ||
    source.id;
  return candidate ? String(candidate).trim() : "";
};

const coerceNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const pickCoordinate = (...values: unknown[]): number | null => {
  for (const value of values) {
    const parsed = coerceNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const readStoredPublicAccess = () => {
  try {
    const raw = safeLocalStorage.getItem("ticket_public_access");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const InfoMetric = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) => (
  <div className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur">
    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
      <Icon className="h-4 w-4" />
    </div>
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      {label}
    </p>
    <p className="mt-1 text-sm font-semibold text-slate-900 break-words">
      {value}
    </p>
  </div>
);

const normalizeOperationalKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const PUBLIC_OPERATIONAL_LABELS: Record<string, string> = {
  age_hours: "Antigüedad",
  inactivity_hours: "Sin novedades",
  response_hours: "Tiempo de respuesta",
  first_response_hours: "Primera respuesta",
  sla_sin_asignar: "Plazo pendiente",
  sin_asignar: "Pendiente de asignación",
  on_track: "En plazo",
  nearing_sla: "Por vencer",
  por_vencer: "Por vencer",
  breached: "Vencido",
  warning: "En riesgo",
  unread: "Pendiente de revisión",
  status_change: "Cambio de estado",
};

const INTERNAL_OPERATIONAL_METRIC_KEYS = new Set([
  "active_viewers_count",
  "idle_viewers_count",
  "idle_viewer_count",
  "read_count",
  "read_state",
  "last_read_comment_id",
  "latest_comment_id",
  "unread_viewer_count",
  "viewer_count",
]);

const INTERNAL_OPERATIONAL_BADGE_KEYS = new Set([
  ...INTERNAL_OPERATIONAL_METRIC_KEYS,
  "priority_breakdown",
  "priority_score",
  "recommended_next_action",
]);

const formatOperationalLabel = (value: string) => {
  const key = normalizeOperationalKey(value);
  if (PUBLIC_OPERATIONAL_LABELS[key]) {
    return PUBLIC_OPERATIONAL_LABELS[key];
  }
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatOperationalMetricValue = (key: string, value: string) => {
  if (key.endsWith("_hours")) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return `${parsed.toFixed(parsed >= 10 ? 0 : 1)} h`;
    }
  }
  return value;
};

type PublicOperationalMetric = {
  key: string;
  label: string;
  value: string;
};

const normalizeOperationalBadges = (value: Ticket["operational_badges"]) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const candidate = [item.label, item.text, item.value].find(
          (entry) => typeof entry === "string" && entry.trim(),
        );
        return typeof candidate === "string" ? candidate.trim() : "";
      }
      return "";
    })
    .filter(Boolean);
};

const normalizeOperationalMetrics = (value: Ticket["operational_metrics"]) => {
  const normalizeMetric = (
    label: string,
    metricValue: string | number,
  ): PublicOperationalMetric | null => {
    const key = normalizeOperationalKey(label);
    if (!key || INTERNAL_OPERATIONAL_METRIC_KEYS.has(key)) {
      return null;
    }
    return {
      key,
      label: formatOperationalLabel(label),
      value: formatOperationalMetricValue(key, String(metricValue)),
    };
  };

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const label = typeof item.label === "string" ? item.label : null;
        const metricValue =
          typeof item.value === "string" || typeof item.value === "number"
            ? String(item.value)
            : null;
        return label && metricValue ? normalizeMetric(label, metricValue) : null;
      })
      .filter((item): item is PublicOperationalMetric => Boolean(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([label, metricValue]) => {
        if (
          metricValue === null ||
          metricValue === undefined ||
          metricValue === ""
        )
          return null;
        if (typeof metricValue !== "string" && typeof metricValue !== "number") {
          return null;
        }
        return normalizeMetric(label, metricValue);
      })
      .filter((item): item is PublicOperationalMetric => Boolean(item));
  }

  return [];
};

const getUnifiedStreamAppearance = (item: UnifiedConversationStreamItem) => {
  if (item.actor_type === "agent") {
    return {
      dotClassName: "bg-emerald-500",
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
      label: "Atención",
    };
  }

  if (item.actor_type === "citizen") {
    return {
      dotClassName: "bg-blue-500",
      badgeClassName: "border-blue-200 bg-blue-50 text-blue-700",
      label: "Tu actividad",
    };
  }

  return {
    dotClassName: "bg-violet-500",
    badgeClassName: "border-violet-200 bg-violet-50 text-violet-700",
    label: "Sistema",
  };
};

const getSlaBadgeClassName = (status?: string | null) => {
  switch ((status || "").toLowerCase()) {
    case "breached":
    case "vencido":
      return "bg-red-100 text-red-700 border-red-200";
    case "nearing_sla":
    case "warning":
    case "riesgo":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "on_track":
    case "ok":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

const TicketQuickActionCard = ({
  icon: Icon,
  title,
  description,
  onClick,
  href,
  disabled = false,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) => {
  const content = (
    <div
      className={`group rounded-[24px] border p-4 shadow-sm transition-all duration-300 ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-50/90 opacity-70"
          : "border-white/80 bg-white/95 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-100/70"
      }`}
    >
      <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 transition-colors group-hover:bg-blue-600 group-hover:text-white group-hover:ring-blue-600">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block">
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left"
      disabled={disabled}
      aria-disabled={disabled}
    >
      {content}
    </button>
  );
};

const LookupSidebarMetric = ({
  icon: Icon,
  label,
  value,
  tone = "slate",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: "slate" | "blue" | "emerald";
}) => {
  const toneMap = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    blue: "bg-blue-100 text-blue-700 ring-blue-200",
    emerald: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  } as const;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/75">
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl ring-1 ${toneMap[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900 break-words dark:text-slate-100">{value}</p>
    </div>
  );
};

const EmptyConversationState = () => (
  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center dark:border-slate-700 dark:bg-slate-900/65">
    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      <MessagesSquare className="h-6 w-6 text-slate-400 dark:text-slate-500" />
    </div>
    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
      Todavía no hay mensajes públicos
    </p>
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
      Cuando exista una respuesta o comentario sobre este reclamo, lo vas a ver
      en esta conversación.
    </p>
  </div>
);

export default function TicketLookup() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [inputTicketId, setInputTicketId] = useState(ticketId || "");
  const [inputPin, setInputPin] = useState(searchParams.get("pin") || "");
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [timelineHistory, setTimelineHistory] = useState<TicketHistoryEvent[]>(
    [],
  );
  const [unifiedConversationStream, setUnifiedConversationStream] = useState<
    UnifiedConversationStreamItem[]
  >([]);
  const [publicMessages, setPublicMessages] = useState<Message[]>([]);
  const [realtimeState, setRealtimeState] = useState<TicketRealtimeState | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [refreshingConversation, setRefreshingConversation] = useState(false);
  const [submittingPublicMessage, setSubmittingPublicMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportRequestId, setSupportRequestId] = useState<string | null>(null);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportMode, setSupportMode] = useState<"comment" | "live">("comment");
  const [liveChatStatus, setLiveChatStatus] = useState<LiveChatScheduleStatus | null>(null);
  const presenceFailureCountRef = useRef(0);
  const presenceCircuitUntilRef = useRef(0);
  const messageBoxRef = useRef<HTMLTextAreaElement | null>(null);
  const [message, setMessage] = useState("");
  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [publicAccessSource, setPublicAccessSource] = useState<
    "manual" | "url" | "restored"
  >("manual");

  const storedPublicAccess = useMemo(
    () => readStoredPublicAccess(),
    [ticketId],
  );
  const currentPin = useMemo(() => {
    const routePin = (searchParams.get("pin") || "").trim();
    if (inputPin.trim()) return inputPin.trim();
    if (routePin) return routePin;
    const storedTicketId = String(storedPublicAccess?.ticketId || "");
    const storedTicketNumber = String(storedPublicAccess?.ticketNumber || "");
    if (
      ticketId &&
      ((storedTicketId && storedTicketId === ticketId) ||
        (storedTicketNumber && storedTicketNumber === ticketId)) &&
      typeof storedPublicAccess?.pin === "string"
    ) {
      return storedPublicAccess.pin.trim();
    }
    return "";
  }, [inputPin, searchParams, storedPublicAccess, ticketId]);

  useEffect(() => {
    const routePin = (searchParams.get("pin") || "").trim();
    if (routePin) {
      setPublicAccessSource("url");
      return;
    }

    const storedTicketId = String(storedPublicAccess?.ticketId || "");
    const storedTicketNumber = String(storedPublicAccess?.ticketNumber || "");
    if (
      ticketId &&
      (storedTicketId === ticketId || storedTicketNumber === ticketId) &&
      typeof storedPublicAccess?.pin === "string" &&
      storedPublicAccess.pin.trim()
    ) {
      const restoredPin = storedPublicAccess.pin.trim();
      setInputPin((prev) => prev || restoredPin);
      setPublicAccessSource("restored");
      trackFrontendEvent("tracking_public_access_restored", {
        ticket_id: ticketId,
        ticket_number: storedPublicAccess?.ticketNumber || undefined,
        tenant_slug: storedPublicAccess?.tenantSlug || undefined,
      });
      return;
    }

    setPublicAccessSource("manual");
  }, [searchParams, storedPublicAccess, ticketId]);

  const syncPublicAccess = useCallback(
    (resolvedTicket: Ticket | null, pin: string) => {
      if (!resolvedTicket?.id || !pin) return;
      const anonId = getOrCreateAnonId();
      safeLocalStorage.setItem(
        "ticket_public_access",
        JSON.stringify({
          ticketId: resolvedTicket.id,
          ticketNumber: resolvePublicTicketNumber(resolvedTicket),
          pin,
          consulta_pin: pin,
          anon_id: anonId || null,
          tenantSlug: resolvedTicket.tenant_slug || null,
          tipo: resolvedTicket.tipo || "municipio",
          updatedAt: new Date().toISOString(),
        }),
      );
    },
    [],
  );

  const loadConversationData = useCallback(
    async (resolvedTicket: Ticket, pin: string, silent = false) => {
      if (!silent) {
        setRefreshingConversation(true);
      }
      try {
        const [timeline, messages] = await Promise.all([
          getTicketTimeline(
            resolvedTicket.id,
            resolvedTicket.tipo || "municipio",
            {
              public: true,
              pin,
            },
          ).catch((msgErr) => {
            console.warn("Error fetching timeline", msgErr);
            return {
              estado_chat: "",
              history: resolvedTicket.history || [],
              messages: [],
              unified_conversation_stream: [],
            };
          }),
          getTicketMessages(
            resolvedTicket.id,
            resolvedTicket.tipo || "municipio",
            {
              public: true,
              pin,
            },
          ).catch((msgErr) => {
            console.warn("Error fetching messages", msgErr);
            return {
              messages: resolvedTicket.messages || [],
              realtimeState: resolvedTicket.realtime_state || null,
              realtime_state: resolvedTicket.realtime_state || null,
            };
          }),
        ]);

        setTimelineHistory(timeline.history || []);
        setUnifiedConversationStream(
          Array.isArray(timeline.unified_conversation_stream)
            ? timeline.unified_conversation_stream
            : [],
        );
        const messageCollection = Array.isArray((messages as any).messages)
          ? (messages as any).messages
          : Array.isArray(messages)
            ? messages
            : [];
        const initialMessages = Array.isArray(resolvedTicket.messages)
          ? resolvedTicket.messages
          : [];
        const fallbackMessages =
          messageCollection.length > 0
            ? messageCollection
            : timeline.messages?.length
              ? timeline.messages
              : initialMessages;
        const nextRealtimeState =
          (messages as any)?.realtimeState ||
          (timeline as any)?.realtime_state ||
          resolvedTicket.realtime_state ||
          null;
        setPublicMessages(fallbackMessages);
        setRealtimeState(nextRealtimeState);
        setTicket((prev) =>
          prev
            ? {
                ...prev,
                history: timeline.history || prev.history || [],
                messages:
                  fallbackMessages.length > 0
                    ? fallbackMessages
                    : prev.messages || [],
                realtime_state: nextRealtimeState,
                priority_score:
                  resolvedTicket.priority_score ?? prev.priority_score ?? null,
                priority_breakdown:
                  resolvedTicket.priority_breakdown ?? prev.priority_breakdown ?? null,
                recommended_next_action:
                  resolvedTicket.recommended_next_action ??
                  prev.recommended_next_action ??
                  null,
              }
            : prev,
        );
        setLastSyncedAt(new Date());
      } finally {
        if (!silent) {
          setRefreshingConversation(false);
        }
      }
    },
    [],
  );

  const performSearch = useCallback(
    async (searchId?: string, searchPin?: string) => {
      const id = (searchId || "").trim();
      const pinVal = (searchPin || "").trim();

      if (!id) return;
      if (!pinVal) {
        setError("El PIN es obligatorio para consultar el reclamo");
        setTicket(null);
        return;
      }

      setLoading(true);
      setError(null);
      setSupportRequestId(null);
      setTimelineHistory([]);
      setUnifiedConversationStream([]);
      setPublicMessages([]);
      setRealtimeState(null);
      setPrimaryImageUrl(null);

      try {
        const data = await getTicketByNumber(id, pinVal);
        const normalizedTicket = {
          ...data,
          history: data.history || [],
          messages: data.messages || [],
        };
        setTicket(normalizedTicket);
        setPublicMessages(normalizedTicket.messages || []);
        syncPublicAccess(normalizedTicket, pinVal);
        trackFrontendEvent("tracking_public_lookup_succeeded", {
          ticket_id: normalizedTicket.id,
          ticket_number: resolvePublicTicketNumber(normalizedTicket, id),
          status: normalizedTicket.estado,
          access_source: publicAccessSource,
          tenant_slug: normalizedTicket.tenant_slug || undefined,
        });

        const img =
          data.archivo_url || data.imagen_url || data.attachment_info?.url;
        if (img) setPrimaryImageUrl(img);

        await loadConversationData(normalizedTicket, pinVal);
      } catch (err) {
        const apiErr = err as ApiError;
        const resolvedRequestId =
          typeof apiErr?.requestId === "string" && apiErr.requestId.trim()
            ? apiErr.requestId.trim()
            : null;
        setSupportRequestId(resolvedRequestId);
        trackFrontendEvent("tracking_public_lookup_failed", {
          ticket_lookup: id,
          status: apiErr?.status || "unknown",
          access_source: publicAccessSource,
          request_id: resolvedRequestId,
        });
        if (apiErr?.status === 404) {
          setError("No se encontró el reclamo. Verificá el número.");
        } else if (apiErr?.status === 403) {
          trackFrontendEvent("tracking_403_detected", {
            ticket_lookup: id,
            access_source: publicAccessSource,
          });
          setError("PIN incorrecto.");
        } else {
          setError(getErrorMessage(err, "Error al consultar el reclamo"));
        }
      } finally {
        setLoading(false);
      }
    },
    [loadConversationData, publicAccessSource, syncPublicAccess],
  );

  useEffect(() => {
    const paramPin = searchParams.get("pin") || "";
    if (ticketId && (paramPin || currentPin)) {
      performSearch(ticketId, paramPin || currentPin);
    }
  }, [ticketId, searchParams, performSearch, currentPin]);

  useEffect(() => {
    if (!ticket) {
      setLiveChatStatus(null);
      return;
    }

    let cancelled = false;
    const tenantSlug = ticket.tenant_slug || "municipio";
    getLiveChatScheduleStatus(tenantSlug)
      .then((status) => {
        if (!cancelled) {
          setLiveChatStatus(status);
        }
      })
      .catch((statusError) => {
        console.warn("No se pudo cargar el horario de chat en vivo", statusError);
        if (!cancelled) {
          setLiveChatStatus(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ticket?.id, ticket?.tenant_slug]);

  useEffect(() => {
    if (!isSupportOpen) return;
    const focusTimer = window.setTimeout(() => {
      messageBoxRef.current?.focus();
    }, 120);
    return () => window.clearTimeout(focusTimer);
  }, [isSupportOpen, supportMode]);

  const publicTicketNumber = resolvePublicTicketNumber(ticket, ticketId);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTicketId.trim() || !inputPin.trim()) return;

    if (inputTicketId === ticketId && inputPin === searchParams.get("pin")) {
      performSearch(inputTicketId, inputPin);
    } else {
      navigate(
        `/ticket/${encodeURIComponent(inputTicketId)}?pin=${encodeURIComponent(inputPin)}`,
      );
    }
  };

  const handleOpenChat = async () => {
    if (!ticket) return;
    const tenantSlug = ticket?.tenant_slug || "municipio";
    const chatContext = {
      ticketId: ticket?.id,
      ticketNumber: publicTicketNumber,
      action: "ticket_live_or_offline_message",
      consulta_pin: currentPin,
      pin: currentPin,
    };

    safeLocalStorage.setItem(
      "pending_widget_action",
      JSON.stringify({
        action: "ticket_public_tracking",
        payload: chatContext,
        text: publicTicketNumber
          ? `Seguimiento de reclamo #${publicTicketNumber}`
          : undefined,
      }),
    );

    let status = liveChatStatus;
    try {
      status = status || await getLiveChatScheduleStatus(tenantSlug);
      setLiveChatStatus(status);
      trackFrontendEvent("tracking_live_chat_status_checked", {
        ticket_id: ticket.id,
        ticket_number: publicTicketNumber,
        tenant_slug: tenantSlug,
        live_chat_available: Boolean(status?.enabled && status?.available),
      });
      toast.success(
        status?.enabled && status?.available
          ? "Canal del reclamo abierto."
          : "Podés dejar tu mensaje en el reclamo.",
      );
    } catch (statusError) {
      console.warn("[ticketLookup] No se pudo confirmar horario de chat en vivo", statusError);
    }

    setSupportMode("live");
    setIsSupportOpen(true);
  };

  const copySupportRequestId = useCallback(async () => {
    const requestId = supportRequestId?.trim();
    if (!requestId) return;

    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      toast.error("No pudimos copiar el request_id en este navegador.");
      return;
    }

    try {
      await navigator.clipboard.writeText(requestId);
      trackFrontendEvent("support_request_id_copied", {
        source: "ticket_lookup_error",
        request_id: requestId,
        ticket_lookup: inputTicketId || ticketId || null,
      });
      toast.success("request_id copiado");
    } catch {
      toast.error("No se pudo copiar el request_id.");
    }
  }, [inputTicketId, supportRequestId, ticketId]);

  const liveChatEnabled = Boolean(liveChatStatus?.enabled);
  const liveChatAvailable = Boolean(liveChatStatus?.enabled && liveChatStatus?.available);
  const liveChatScheduleLabel =
    liveChatStatus?.description ||
    (liveChatStatus?.start_time && liveChatStatus?.end_time
      ? `${liveChatStatus.start_time} a ${liveChatStatus.end_time}`
      : "Horario administrativo");

  const handleSendMessage = useCallback(async () => {
    if (!ticket || !currentPin || !message.trim()) return;
    setSubmittingPublicMessage(true);
    try {
      const response = await sendMessage(
        ticket.id,
        ticket.tipo || "municipio",
        message.trim(),
        undefined,
        undefined,
        {
          public: true,
          pin: currentPin,
        },
      );
      trackFrontendEvent("tracking_public_message_sent", {
        ticket_id: ticket.id,
        ticket_number: publicTicketNumber,
        message_length: message.trim().length,
        support_mode: supportMode,
        live_chat_mode: liveChatAvailable ? "live" : "offline",
      });
      const responseMessage =
        response &&
        typeof response === "object" &&
        typeof response.message === "string" &&
        response.message.trim()
          ? response.message.trim()
          : liveChatAvailable
            ? "Mensaje enviado al canal del reclamo."
            : "Mensaje guardado en este reclamo.";
      toast.success(responseMessage);
      setMessage("");
      await loadConversationData(ticket, currentPin, true);
      setIsSupportOpen(false);
    } catch (sendError) {
      toast.error(getErrorMessage(sendError, "No se pudo enviar el mensaje."));
    } finally {
      setSubmittingPublicMessage(false);
    }
  }, [currentPin, liveChatAvailable, loadConversationData, message, publicTicketNumber, supportMode, ticket]);

  const copyToClipboard = () => {
    if (ticket && publicTicketNumber) {
      navigator.clipboard.writeText(publicTicketNumber);
      toast.success("Número de reclamo copiado");
    }
  };

  const currentStatusKey = (ticket?.estado || "pendiente")
    .toLowerCase()
    .replace(/\s+/g, "_");
  const statusInfo = STATUS_CONFIG[currentStatusKey] || STATUS_CONFIG.pendiente;
  const currentStep = statusInfo.step;
  const isResolved =
    currentStatusKey === "resuelto" || currentStatusKey === "cerrado";

  const ticketLocation = useMemo(
    () => (ticket ? normalizeTicketLocation(ticket) : null),
    [ticket],
  );
  const ticketAddress = ticketLocation?.direccion || ticket?.direccion || "";
  const ticketLat = pickCoordinate(
    ticketLocation?.latitud,
    ticketLocation?.lat_destino,
    ticket?.latitud,
    ticket?.lat_destino,
    ticket?.lat_actual,
  );
  const ticketLng = pickCoordinate(
    ticketLocation?.longitud,
    ticketLocation?.lon_destino,
    ticket?.longitud,
    ticket?.lon_destino,
    ticket?.lon_actual,
  );
  const municipalityLat = pickCoordinate(
    ticket?.municipio_latitud,
    ticket?.origen_latitud,
    ticket?.lat_origen,
  );
  const municipalityLng = pickCoordinate(
    ticket?.municipio_longitud,
    ticket?.origen_longitud,
    ticket?.lon_origen,
  );
  const hasCoordinates = ticketLat !== null && ticketLng !== null;
  const hasStoreCoordinates =
    municipalityLat !== null && municipalityLng !== null;
  const hasAnyCoordinates = hasCoordinates || hasStoreCoordinates;
  const hasLocationData = hasAnyCoordinates || Boolean(ticketAddress);
  const mapLink = ticketLocation?.map_search_url || (hasCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${ticketLat},${ticketLng}`
    : ticketAddress
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ticketAddress)}`
      : null);
  const mapEmbedUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${ticketLat},${ticketLng}&z=15&output=embed`
    : ticketAddress
      ? `https://www.google.com/maps?q=${encodeURIComponent(ticketAddress)}&output=embed`
    : null;

  const mapStoreLocation = hasStoreCoordinates
    ? {
        lat: municipalityLat!,
        lng: municipalityLng!,
        name: ticket?.municipio_nombre || "Municipio",
      }
    : undefined;
  const mapCustomerLocation = hasCoordinates
    ? {
        lat: ticketLat,
        lng: ticketLng,
        name: ticketAddress || "Ubicación reportada",
      }
    : undefined;

  const publicMessagesCountLabel = `${publicMessages.length} ${publicMessages.length === 1 ? "mensaje" : "mensajes"}`;
  const supportModeTitle = supportMode === "live"
    ? liveChatAvailable
      ? "Chat del reclamo"
      : "Buzón del reclamo"
    : "Comentario del reclamo";
  const supportModeDescription = supportMode === "live"
    ? liveChatAvailable
      ? "La mesa está en horario. Tu mensaje entra directo al canal público de este ticket."
      : `Fuera del horario configurado (${liveChatScheduleLabel}). El mensaje queda guardado en este reclamo para respuesta administrativa.`
    : "Agregá una observación pública sin salir del seguimiento.";
  const supportStatusTitle = liveChatAvailable
    ? "Atención en vivo disponible"
    : liveChatEnabled
      ? "Atención fuera de horario"
      : "Seguimiento público";
  const supportStatusBadge = liveChatAvailable
    ? "En horario"
    : liveChatEnabled
      ? "Offline"
      : "Sin horario";
  const supportStatusDescription = liveChatAvailable
    ? "El equipo puede responder desde el CRM y la conversación queda registrada en este ticket."
    : liveChatEnabled
      ? `Horario configurado: ${liveChatScheduleLabel}. Si enviás ahora, queda como mensaje offline del mismo reclamo.`
      : "El municipio todavía no publicó un horario de chat; el mensaje se guarda como comentario público del reclamo.";
  const supportRoutingSummary = [
    {
      label: "Canal",
      value: "Este reclamo",
      icon: Hash,
    },
    {
      label: "Registro",
      value: liveChatAvailable ? "Chat en CRM" : "Mensaje offline en CRM",
      icon: MessagesSquare,
    },
    {
      label: "Horario",
      value: liveChatEnabled ? liveChatScheduleLabel : "Comentario publico",
      icon: Clock,
    },
  ];
  const supportPlaceholder = supportMode === "live"
    ? liveChatAvailable
      ? "Escribí tu mensaje para la mesa de atención de este reclamo..."
      : "Dejá tu mensaje offline para este reclamo..."
    : "Escribí una observación pública sobre este reclamo...";
  const supportSubmitLabel = supportMode === "live"
    ? liveChatAvailable
      ? "Enviar al chat"
      : "Guardar offline"
    : "Guardar comentario";
  const activityStream =
    unifiedConversationStream.length > 0
      ? unifiedConversationStream
      : timelineHistory.map((event, index) => ({
          id: `${event.date}-${event.status}-${index}`,
          timestamp: event.date,
          actor_type: "system" as const,
          preview_text: event.notes || event.status,
          status: event.status,
          stream_type: "timeline_event",
          badge: event.status,
        }));
  const timelineCountLabel = `${activityStream.length} ${activityStream.length === 1 ? "evento" : "eventos"}`;
  const ticketCreatedAt = ticket
    ? (
        ticket.fecha_creacion ||
        ticket.fecha ||
        (ticket as Ticket & { created_at?: string | null }).created_at ||
        (ticket as Ticket & { timestamp?: string | null }).timestamp ||
        ticket.history?.[0]?.date ||
        timelineHistory[0]?.date ||
        publicMessages[0]?.timestamp
      )
    : null;
  const activeViewers = realtimeState?.active_viewers || [];
  const readStates = realtimeState?.read_states || [];
  const latestReadState = readStates[0] || null;
  const collaborationState = ticket?.collaboration_state || null;
  const unreadViewersCount = Number(collaborationState?.unread_viewer_count || 0);
  const activeViewersCount = Number(collaborationState?.active_viewers_count || 0);
  const unreadMessagesCount = Number(collaborationState?.unread_count || 0);
  const hasTeamAttentionSignal =
    activeViewers.length > 0 ||
    activeViewersCount > 0 ||
    Boolean(latestReadState?.read_at) ||
    unreadMessagesCount > 0 ||
    unreadViewersCount > 0;
  const attentionStatusTitle =
    activeViewers.length > 0 || activeViewersCount > 0
      ? "El equipo está revisando este reclamo"
      : latestReadState?.read_at
        ? "El equipo ya vio la conversación"
        : unreadMessagesCount > 0 || unreadViewersCount > 0
          ? "Hay mensajes pendientes de revisión"
          : "Mensajes asociados al reclamo";
  const attentionStatusDetail =
    activeViewers.length > 0 || activeViewersCount > 0
      ? "Hay personal administrativo trabajando sobre esta gestión en el CRM municipal."
      : latestReadState?.read_at
        ? `Última lectura registrada: ${formatMessageDate(latestReadState.read_at)}.`
        : unreadMessagesCount > 0 || unreadViewersCount > 0
          ? "La mesa de ayuda recibió novedades y el área correspondiente puede responder desde el panel."
          : "Cada comentario que envíes queda unido al ticket para que lo responda el área correspondiente.";
  const operationalBadges = normalizeOperationalBadges(
    ticket?.operational_badges,
  );
  const operationalMetrics = normalizeOperationalMetrics(
    ticket?.operational_metrics,
  );
  const slaPublicLabel = ticket?.sla_status
    ? formatOperationalLabel(ticket.sla_status)
    : "";
  const visibleOperationalBadges = Array.from(
    new Set(
      operationalBadges
        .filter((badge) => {
          const key = normalizeOperationalKey(badge);
          return key && !INTERNAL_OPERATIONAL_BADGE_KEYS.has(key);
        })
        .map((badge) => formatOperationalLabel(badge)),
    ),
  ).filter((badge) => badge && badge !== slaPublicLabel);
  const priorityLabel =
    ticket?.priority !== null &&
    ticket?.priority !== undefined &&
    ticket?.priority !== ""
      ? String(ticket.priority)
      : null;

  useEffect(() => {
    if (!ticket || isResolved || !currentPin) return;
    const interval = setInterval(() => {
      const id = inputTicketId || ticketId || "";
      if (!id) return;
      getTicketByNumber(id, currentPin)
        .then(async (data) => {
          setTicket((prev) => {
            if (!prev) return data;
            if (
              prev.estado !== data.estado ||
              prev.history?.length !== data.history?.length
            ) {
              return {
                ...prev,
                ...data,
                history: data.history || prev.history || [],
              };
            }
            return prev;
          });
          syncPublicAccess(data, currentPin);
          await loadConversationData(data, currentPin, true);
        })
        .catch((pollError) => {
          const apiErr = pollError as ApiError;
          trackFrontendEvent("tracking_public_refresh_failed", {
            ticket_lookup: id,
            status: apiErr?.status || "unknown",
          });
          if (apiErr?.status === 403) {
            trackFrontendEvent("tracking_403_detected", {
              ticket_lookup: id,
              access_source: publicAccessSource,
            });
          }
          console.warn(pollError);
        });
    }, 10000);
    return () => clearInterval(interval);
  }, [
    ticket,
    isResolved,
    inputTicketId,
    ticketId,
    currentPin,
    loadConversationData,
    publicAccessSource,
    syncPublicAccess,
  ]);

  useEffect(() => {
    if (!PUBLIC_TICKET_SIGNALING_ENABLED) return;
    if (!ticket || !currentPin) return;

    let cancelled = false;
    const ticketType = ticket.tipo || "municipio";
    const CIRCUIT_BREAKER_LIMIT = 4;
    const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;

    const syncPresence = async (status: "active" | "inactive") => {
      if (Date.now() < presenceCircuitUntilRef.current) {
        return;
      }
      if (document.visibilityState === "hidden" && status === "active") {
        return;
      }
      try {
        const state = await updateTicketPresence(ticket.id, ticketType, status, {
          public: true,
          pin: currentPin,
        });
        presenceFailureCountRef.current = 0;
        if (!cancelled && state) {
          setRealtimeState(state);
        }
      } catch (error) {
        presenceFailureCountRef.current += 1;
        if (presenceFailureCountRef.current >= CIRCUIT_BREAKER_LIMIT) {
          presenceCircuitUntilRef.current = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
        }
        if (import.meta.env.DEV) {
          console.warn("No se pudo actualizar el presence público", error);
        }
      }
    };

    void syncPresence("active");

    const syncVisibilityPresence = () => {
      const nextStatus =
        document.visibilityState === "visible" ? "active" : "inactive";
      void syncPresence(nextStatus);
    };

    document.addEventListener("visibilitychange", syncVisibilityPresence);
    window.addEventListener("beforeunload", syncVisibilityPresence);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", syncVisibilityPresence);
      window.removeEventListener("beforeunload", syncVisibilityPresence);
      void syncPresence("inactive");
    };
  }, [ticket, currentPin]);

  useEffect(() => {
    if (!PUBLIC_TICKET_SIGNALING_ENABLED) return;
    if (!ticket || !currentPin || publicMessages.length === 0) return;

    const lastMessage = publicMessages[publicMessages.length - 1];
    if (lastMessage?.id === undefined || lastMessage?.id === null) return;

    updateTicketReadState(
      ticket.id,
      ticket.tipo || "municipio",
      lastMessage.id,
      {
        public: true,
        pin: currentPin,
      },
    )
      .then((state) => {
        if (state) {
          setRealtimeState(state);
        }
      })
      .catch((error) => {
        console.warn("No se pudo actualizar el read-state público", error);
      });
  }, [ticket, currentPin, publicMessages]);

  return (
    <div className="relative min-h-screen bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.10),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] pb-20 font-sans selection:bg-primary/10">
      {isResolved && <Confetti />}

      <div className="sticky top-0 z-40 border-b border-white/70 bg-white/80 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                Atención Ciudadana
              </p>
              <p className="truncate text-xs text-slate-500">
                Seguimiento seguro de reclamos
              </p>
            </div>
          </div>
          {ticket && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSupportOpen(true)}
              className="gap-2 rounded-xl text-blue-700 hover:bg-blue-50 hover:text-blue-800"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Mesa de ayuda</span>
            </Button>
          )}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-5xl space-y-8 px-4 py-8"
      >
        {!ticket && (
          <div className="mx-auto max-w-lg space-y-6 py-10">
            <div className="space-y-3 text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Seguimiento público en tiempo real del reclamo
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Estado de Reclamo
              </h1>
              <p className="mx-auto max-w-md text-sm leading-6 text-slate-500 sm:text-base">
                Ingresá el número de gestión y tu PIN de seguridad para ver el
                estado, la conversación y la ubicación reportada.
              </p>
            </div>

            <Card className="overflow-hidden border-0 bg-white/85 shadow-2xl shadow-slate-200/60 ring-1 ring-black/5 backdrop-blur">
              <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500" />
              <CardContent className="space-y-6 pt-6">
                <form onSubmit={handleSearchSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(180px,0.7fr)]">
                    <div className="space-y-2 text-left">
                      <label className="text-sm font-medium text-slate-700">
                        Número de Reclamo
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                          placeholder="Ej: REC-12345"
                          className="h-11 rounded-xl border-slate-200 bg-white pl-9 shadow-sm transition focus-visible:ring-2 focus-visible:ring-blue-200"
                          value={inputTicketId}
                          onChange={(e) => setInputTicketId(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2 text-left">
                      <label className="text-sm font-medium text-slate-700">
                        PIN de Seguridad
                      </label>
                      <Input
                        placeholder="••••"
                        type="password"
                        className="h-11 rounded-xl border-slate-200 bg-white text-center tracking-[0.35em] shadow-sm transition focus-visible:ring-2 focus-visible:ring-blue-200"
                        value={inputPin}
                        onChange={(e) => setInputPin(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="h-11 w-full gap-2 rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700"
                    disabled={loading || !inputTicketId || !inputPin}
                  >
                    <Search className="h-4 w-4" />
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {loading ? "Buscando..." : "Consultar Estado"}
                  </Button>
                </form>

                <div className="grid gap-3 sm:grid-cols-3">
                  <InfoMetric
                    icon={ShieldCheck}
                    label="Acceso"
                    value="Protegido con PIN"
                  />
                  <InfoMetric
                    icon={MessagesSquare}
                    label="Canales"
                    value="Estado y conversación"
                  />
                  <InfoMetric
                    icon={MapPin}
                    label="Ubicación"
                    value="Mapa y dirección"
                  />
                </div>
                {publicAccessSource === "restored" && currentPin ? (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    Recuperamos tu acceso seguro para este ticket desde tu
                    sesión actual.
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {error && (
              <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600 shadow-sm">
                <div className="flex items-center justify-center gap-2">
                  <XCircle className="h-4 w-4" />
                  {error}
                </div>
                {supportRequestId ? (
                  <div className="mt-2 flex items-center justify-center gap-2 text-xs font-normal text-red-700">
                    <span className="font-mono">request_id: {supportRequestId}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-lg border-red-200 bg-red-100 px-2 text-[11px] text-red-700 hover:bg-red-200"
                      onClick={() => {
                        void copySupportRequestId();
                      }}
                    >
                      Copiar request_id
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {ticket && (
          <>
            <Card className="overflow-hidden border-0 bg-white/85 shadow-2xl shadow-slate-200/60 ring-1 ring-black/5 backdrop-blur">
              <div
                className={`h-1.5 w-full ${statusInfo.color.replace("text-", "bg-").split(" ")[0]}`}
              />
              <CardContent
                className={`relative overflow-hidden bg-gradient-to-br ${statusInfo.accent} px-6 pb-8 pt-6 text-center`}
              >
                <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_transparent_70%)]" />
                <div className="relative">
                  <div
                    className={`mb-6 inline-flex rounded-3xl border px-4 py-3 shadow-sm ${statusInfo.color}`}
                  >
                    <statusInfo.icon className="h-8 w-8" />
                  </div>
                  <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200/80">
                      <Hash className="h-3.5 w-3.5" />
                      {publicTicketNumber}
                    </div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm ring-1 ring-slate-200/80">
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${refreshingConversation ? "animate-spin" : ""}`}
                      />
                      {formatLastSync(lastSyncedAt)}
                    </div>
                  </div>
                  <h1 className="text-3xl font-bold text-slate-950">
                    {statusInfo.label}
                  </h1>
                  <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                    {statusInfo.description}
                  </p>

                  <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoMetric
                      icon={Calendar}
                      label="Creado"
                      value={formatShortDate(ticketCreatedAt)}
                    />
                    <InfoMetric
                      icon={MessagesSquare}
                      label="Conversación"
                      value={publicMessagesCountLabel}
                    />
                    <InfoMetric
                      icon={Sparkles}
                      label="Actividad"
                      value={timelineCountLabel}
                    />
                    <InfoMetric
                      icon={ShieldCheck}
                      label="Acceso"
                      value={
                        publicAccessSource === "restored"
                          ? "Sesión restaurada"
                          : publicAccessSource === "url"
                            ? "Link seguro"
                            : "PIN validado"
                      }
                    />
                  </div>

                  <div className="mx-auto mt-6 grid max-w-4xl gap-3 md:grid-cols-3">
                    <TicketQuickActionCard
                      icon={Copy}
                      title="Copiar número"
                      description="Guardá el identificador del ticket para futuras consultas o seguimiento."
                      onClick={copyToClipboard}
                    />
                    <TicketQuickActionCard
                      icon={MessageCircle}
                      title="Agregar comentario"
                      description="Dejá una observación pública asociada directamente a este reclamo."
                      onClick={() => setIsSupportOpen(true)}
                    />
                    <TicketQuickActionCard
                      icon={MapPin}
                      title={mapLink ? "Abrir ubicación" : "Ubicación del caso"}
                      description={mapLink ? "Abrí la ubicación del ticket en tu app de mapas para revisar el contexto." : "La ubicación aparecerá aquí cuando el backend tenga dirección o coordenadas disponibles."}
                      disabled={!mapLink}
                      {...(mapLink ? { href: mapLink } : {})}
                    />
                  </div>

                  {ticket?.sla_status ||
                  priorityLabel ||
                  visibleOperationalBadges.length > 0 ||
                  operationalMetrics.length > 0 ? (
                    <div className="mx-auto mt-6 max-w-4xl rounded-3xl border border-white/80 bg-white/75 p-4 shadow-sm backdrop-blur">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {ticket?.sla_status ? (
                          <Badge
                            variant="outline"
                            className={getSlaBadgeClassName(ticket.sla_status)}
                          >
                            Plazo de respuesta: {slaPublicLabel}
                          </Badge>
                        ) : null}
                        {priorityLabel ? (
                          <Badge
                            variant="outline"
                            className="border-violet-200 bg-violet-100 text-violet-700"
                          >
                            Nivel de atención: {formatOperationalLabel(priorityLabel)}
                          </Badge>
                        ) : null}
                        {visibleOperationalBadges.map((badge) => (
                          <Badge
                            key={badge}
                            variant="outline"
                            className="border-slate-200 bg-slate-100 text-slate-700"
                          >
                            {badge}
                          </Badge>
                        ))}
                      </div>
                      {operationalMetrics.length ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {operationalMetrics.map((metric) => (
                            <InfoMetric
                              key={`${metric.key}-${metric.value}`}
                              icon={Sparkles}
                              label={metric.label}
                              value={metric.value}
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {currentStatusKey !== "cancelado" &&
                    currentStatusKey !== "rechazado" && (
                      <div className="relative mx-auto mt-10 max-w-xl px-2">
                        <div className="absolute left-6 right-6 top-[15px] h-1 rounded-full bg-white/70" />
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.max(0, ((currentStep - 1) / (TICKET_STEPS.length - 1)) * 100)}%`,
                          }}
                          className="absolute left-6 top-[15px] h-1 rounded-full bg-blue-600 transition-all duration-1000 ease-out"
                          style={{ maxWidth: "calc(100% - 3rem)" }}
                        />
                        <div className="flex justify-between">
                          {TICKET_STEPS.map((step, index) => {
                            const isCompleted = index + 1 <= currentStep;
                            const isCurrent = index + 1 === currentStep;

                            return (
                              <div
                                key={step.id}
                                className="flex flex-col items-center gap-3"
                              >
                                <div
                                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white transition-all duration-500 ${isCompleted ? "border-blue-600 text-blue-600 shadow-sm" : "border-slate-200 text-slate-300"} ${isCurrent ? "scale-110 ring-4 ring-blue-100" : ""}`}
                                >
                                  {isCompleted ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                  ) : (
                                    <div className="h-2 w-2 rounded-full bg-current" />
                                  )}
                                </div>
                                <span
                                  className={`max-w-[70px] text-center text-[10px] font-semibold uppercase tracking-wide sm:text-xs ${isCompleted ? "text-slate-900" : "text-slate-400"}`}
                                >
                                  {step.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
              <div className="space-y-6">
                <Card className="overflow-hidden border-0 bg-white/85 shadow-lg shadow-slate-200/50 ring-1 ring-black/5 backdrop-blur">
                  <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500" />
                  <CardHeader className="border-b border-slate-100 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
                          <FileText className="h-5 w-5 text-slate-400" />
                          Detalle del Reclamo
                        </CardTitle>
                        <CardDescription>
                          Información principal asociada a esta gestión.
                        </CardDescription>
                      </div>
                      <button
                        type="button"
                        onClick={copyToClipboard}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:-translate-y-0.5 hover:bg-slate-100"
                      >
                        #{publicTicketNumber}
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl"
                        onClick={copyToClipboard}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar ticket
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl"
                        onClick={() => setIsSupportOpen(true)}
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Escribir
                      </Button>
                      {mapLink ? (
                        <Button
                          asChild
                          variant="outline"
                          className="h-11 rounded-xl"
                        >
                          <a href={mapLink} target="_blank" rel="noreferrer">
                            <MapPin className="mr-2 h-4 w-4" />
                            Ver mapa
                          </a>
                        </Button>
                      ) : (
                        <div className="hidden sm:block" />
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <InfoMetric
                        icon={FileText}
                        label="Categoría"
                        value={ticket.categoria || "General"}
                      />
                      <InfoMetric
                        icon={ShieldCheck}
                        label="Estado"
                        value={statusInfo.label}
                      />
                      <InfoMetric
                        icon={Calendar}
                        label="Alta"
                        value={formatShortDate(ticketCreatedAt)}
                      />
                    </div>

                    {ticket.description && (
                      <div>
                        <h3 className="mb-2 text-sm font-medium text-slate-500">
                          Descripción
                        </h3>
                        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 text-sm leading-relaxed text-slate-700">
                          {ticket.description}
                        </div>
                      </div>
                    )}

                    {primaryImageUrl && (
                      <div>
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
                          <Camera className="h-4 w-4" />
                          Evidencia Adjunta
                        </h3>
                        <div
                          className="group relative aspect-video w-full cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
                          onClick={() => window.open(primaryImageUrl, "_blank")}
                        >
                          <img
                            src={primaryImageUrl}
                            alt="Evidencia"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                            <span className="rounded-full bg-black/60 px-3 py-1 text-sm font-medium text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                              Ver imagen completa
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-0 bg-white/85 shadow-lg shadow-slate-200/50 ring-1 ring-black/5 backdrop-blur">
                  <CardHeader className="border-b border-slate-100 pb-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <CardTitle className="text-lg text-slate-950">
                          Historial de Actividad
                        </CardTitle>
                        <CardDescription>
                          Movimientos y mensajes asociados al reclamo.
                        </CardDescription>
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                        {refreshingConversation ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        {formatLastSync(lastSyncedAt)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="relative space-y-6 pl-2">
                      <div className="absolute bottom-2 left-[11px] top-2 w-[2px] bg-slate-100" />
                      {activityStream.map((event, i) => {
                        const appearance = getUnifiedStreamAppearance(event);
                        return (
                        <div
                          key={`${event.id}-${i}`}
                          className="relative flex gap-4"
                        >
                          <div className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 bg-white">
                            <div className={`h-2 w-2 rounded-full ${appearance.dotClassName}`} />
                          </div>
                          <div className="flex-1 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3 shadow-sm">
                            <p className="text-sm font-medium text-slate-900">
                              {event.preview_text || event.status || "Actividad registrada"}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={appearance.badgeClassName}
                              >
                                {event.badge ? formatOperationalLabel(String(event.badge)) : appearance.label}
                              </Badge>
                              {event.is_unread ? (
                                <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                  Pendiente de revisión
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              {formatEventDate(event.timestamp)}
                            </p>
                          </div>
                        </div>
                        );
                      })}
                      {activityStream.length === 0 && (
                        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-10 text-center text-sm text-slate-500">
                          No hay actividad reciente registrada.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 bg-white/85 shadow-lg shadow-slate-200/50 ring-1 ring-black/5 backdrop-blur">
                  <CardHeader className="border-b border-slate-100 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg text-slate-950">
                          <MessageCircle className="h-5 w-5 text-slate-400" />
                          Conversación del reclamo
                        </CardTitle>
                        <CardDescription>
                          Mensajes públicos asociados a este ticket.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
                          {publicMessagesCountLabel}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={() => setIsSupportOpen(true)}
                        >
                          Escribir
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    {hasTeamAttentionSignal ? (
                      <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-cyan-50 px-5 py-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
                            <CheckCheck className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-950">
                              {attentionStatusTitle}
                            </p>
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {attentionStatusDetail}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {publicMessages.length === 0 ? (
                      <EmptyConversationState />
                    ) : (
                      publicMessages.map((publicMessage) => {
                        const isAgent = publicMessage.author === "agent";
                        return (
                          <div
                            key={publicMessage.id}
                            className={`flex ${isAgent ? "justify-start" : "justify-end"}`}
                          >
                            <div
                              className={`max-w-[90%] rounded-[24px] px-4 py-3 shadow-sm sm:max-w-[80%] ${isAgent ? "border border-slate-200 bg-white text-slate-900" : "bg-gradient-to-br from-blue-600 to-indigo-600 text-white"}`}
                            >
                              <div className="mb-2 flex items-center gap-2">
                                <div
                                  className={`h-2.5 w-2.5 rounded-full ${isAgent ? "bg-emerald-500" : "bg-blue-100"}`}
                                />
                                <span
                                  className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${isAgent ? "text-slate-500" : "text-blue-100"}`}
                                >
                                  {isAgent ? "Atención" : "Tu mensaje"}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                {publicMessage.content}
                              </p>
                              <p
                                className={`mt-2 text-[11px] ${isAgent ? "text-slate-400" : "text-blue-100"}`}
                              >
                                {formatMessageDate(publicMessage.timestamp)}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="overflow-hidden border-0 bg-white/85 shadow-lg shadow-slate-200/50 ring-1 ring-black/5 backdrop-blur dark:bg-slate-900/85 dark:shadow-black/30 dark:ring-white/10">
                  <div className="border-b border-slate-100 bg-gradient-to-r from-primary/5 via-sky-500/5 to-violet-500/5 px-6 py-4 dark:border-slate-800 dark:from-blue-900/30 dark:via-slate-900 dark:to-violet-900/30">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-950 dark:text-slate-100">Contexto geográfico</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Mapa, dirección y punto de referencia reportado en el ticket.</p>
                      </div>
                    </div>
                  </div>
                  <div className="relative h-56 w-full bg-slate-100 dark:bg-slate-950">
                    {hasAnyCoordinates ? (
                      <React.Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">Cargando mapa...</div>}>
                        <TrackingMap
                          status={currentStatusKey}
                          storeLocation={mapStoreLocation}
                          customerLocation={mapCustomerLocation}
                        />
                      </React.Suspense>
                    ) : mapEmbedUrl ? (
                      <iframe
                        title="Mapa de dirección reportada"
                        src={mapEmbedUrl}
                        className="h-full w-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
                          <MapPin className="h-6 w-6 opacity-60" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {hasLocationData
                              ? "Ubicación pendiente de geocodificación"
                              : "Sin ubicación reportada"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            La dirección y las coordenadas se mostrarán acá
                            cuando estén disponibles.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <CardHeader className="border-b border-slate-100 pb-4 dark:border-slate-800">
                    <CardTitle className="flex items-center gap-2 text-lg text-slate-950 dark:text-slate-100">
                      <MapPin className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                      Ubicación
                    </CardTitle>
                    <CardDescription className="dark:text-slate-400">
                      Fuente de verdad del ticket para el seguimiento público.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    <InfoMetric
                      icon={MapPin}
                      label="Dirección"
                      value={ticketAddress || "No especificada"}
                    />
                    {hasCoordinates ? (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                        Coordenadas confirmadas: {ticketLat}, {ticketLng}
                      </div>
                    ) : hasLocationData ? (
                      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                        Ubicación pendiente de geocodificación.
                      </div>
                    ) : null}
                    {mapLink && (
                      <Button
                        asChild
                        variant="outline"
                        className="h-11 w-full rounded-xl"
                      >
                        <a
                          href={mapLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() =>
                            trackFrontendEvent("tracking_public_maps_opened", {
                              ticket_id: ticket.id,
                              ticket_number: publicTicketNumber,
                              has_coordinates: hasCoordinates,
                            })
                          }
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Abrir en Maps
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-0 bg-slate-950 text-white shadow-xl shadow-slate-900/20 ring-1 ring-white/10 dark:bg-slate-900 dark:shadow-black/30">
                  <CardContent className="relative p-6">
                    <div className="relative space-y-4">
                      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                        <MessageCircle className="h-6 w-6" />
                      </div>
                      <div>
                        <Badge className="mb-3 border-white/20 bg-white/10 text-white hover:bg-white/10">
                          {supportStatusBadge}
                        </Badge>
                        <h3 className="text-xl font-bold">Canal del reclamo</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-200">
                          {liveChatAvailable
                            ? "La mesa de atención está disponible ahora. Abrí el chat sin salir de este seguimiento."
                            : liveChatEnabled
                              ? `Horario: ${liveChatScheduleLabel}. Fuera de horario, dejá el mensaje guardado en este ticket.`
                              : "Dejá una observación en este reclamo para que el equipo municipal la responda desde el panel."}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Button
                          className="h-11 w-full rounded-xl bg-white text-blue-700 shadow-sm hover:bg-blue-50"
                          onClick={() => {
                            setSupportMode("comment");
                            setIsSupportOpen(true);
                          }}
                        >
                          Escribir sobre este reclamo
                        </Button>
                        <Button
                          variant="outline"
                          className="h-11 w-full rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                          onClick={handleOpenChat}
                        >
                          {liveChatAvailable ? "Abrir chat del reclamo" : "Dejar mensaje en el reclamo"}
                        </Button>
                      </div>
                      <div
                        data-testid="ticket-support-routing"
                        className="grid gap-2 rounded-2xl border border-white/15 bg-white/10 p-3 text-sm text-white/90"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                          Atencion asociada al ticket
                        </p>
                        <p className="text-xs leading-5 text-slate-200">
                          Todo queda asociado al ticket #{publicTicketNumber}; el equipo responde desde el CRM municipal.
                        </p>
                        <div className="grid gap-1.5">
                          {supportRoutingSummary.map((item) => {
                            const Icon = item.icon;
                            return (
                              <div key={item.label} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-slate-950/35 px-3 py-2 ring-1 ring-white/10">
                                <div className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">
                                  <Icon className="h-3.5 w-3.5" />
                                  {item.label}
                                </div>
                                <p className="min-w-0 text-right text-xs font-semibold leading-5 text-white">{item.value}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-0 bg-white/85 shadow-lg shadow-slate-200/50 ring-1 ring-black/5 backdrop-blur dark:bg-slate-900/85 dark:shadow-black/30 dark:ring-white/10">
                  <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
                    <CardTitle className="text-base text-slate-950 dark:text-slate-100">Centro de seguimiento</CardTitle>
                    <CardDescription className="dark:text-slate-400">Estado operativo y datos de acceso de esta consulta pública.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 p-6">
                    <div className="grid gap-3">
                      <LookupSidebarMetric
                        icon={ShieldCheck}
                        label="Acceso"
                        tone="blue"
                        value={
                          publicAccessSource === "restored"
                            ? "Restaurado desde tu sesión"
                            : publicAccessSource === "url"
                              ? "Validado desde link seguro"
                              : "Validado con PIN"
                        }
                      />
                      <LookupSidebarMetric
                        icon={RefreshCw}
                        label="Sincronización"
                        tone="emerald"
                        value={formatLastSync(lastSyncedAt)}
                      />
                      <LookupSidebarMetric
                        icon={Hash}
                        label="Número"
                        value={publicTicketNumber}
                      />
                    </div>
                    <Button
                      variant="link"
                      className="h-auto justify-start px-0 text-xs text-slate-400"
                      onClick={() => {
                        setTicket(null);
                        setTimelineHistory([]);
                        setPublicMessages([]);
                        setInputTicketId("");
                        setInputPin("");
                        setLastSyncedAt(null);
                        navigate("/ticket");
                      }}
                    >
                      Consultar otro reclamo
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </motion.div>

      <Dialog open={isSupportOpen} onOpenChange={setIsSupportOpen}>
        <DialogContent className="overflow-hidden border-0 bg-white p-0 shadow-2xl sm:max-w-lg dark:bg-slate-900">
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 via-white to-blue-50 px-6 py-5 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-blue-950/30">
            <DialogHeader>
              <DialogTitle className="text-left text-xl text-slate-950 dark:text-slate-100">
                {supportModeTitle}
              </DialogTitle>
              <DialogDescription className="text-left dark:text-slate-400">
                Gestión <b>#{publicTicketNumber}</b>. {supportModeDescription}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-5 px-6 py-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {supportStatusTitle}
                    </p>
                    <Badge
                      variant="outline"
                      className={
                        liveChatAvailable
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                      }
                    >
                      {supportStatusBadge}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {supportStatusDescription}
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Mensaje para este reclamo
              </label>
              <Textarea
                ref={messageBoxRef}
                placeholder={supportPlaceholder}
                className="min-h-[120px] resize-none rounded-2xl border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {supportModeDescription}
                </p>
                <Button
                  className="rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300 disabled:text-blue-50 dark:disabled:bg-blue-900/60 dark:disabled:text-blue-200"
                  onClick={handleSendMessage}
                  disabled={!message.trim() || submittingPublicMessage}
                >
                  {submittingPublicMessage ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  {supportSubmitLabel}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {ticket ? (
        <div className="mx-auto w-full max-w-5xl px-4 pb-8 sm:hidden">
          <div className="mx-auto grid max-w-md grid-cols-3 gap-2 rounded-2xl border border-white/80 bg-white/90 p-2 shadow-xl shadow-slate-200/70 backdrop-blur">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              onClick={copyToClipboard}
              aria-label="Copiar número de reclamo"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              className="h-10 rounded-xl bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setSupportMode("comment");
                setIsSupportOpen(true);
              }}
              aria-label="Agregar comentario al reclamo"
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl"
              onClick={() => {
                if (ticketId && currentPin) {
                  performSearch(ticketId, currentPin);
                }
              }}
              aria-label="Actualizar estado del reclamo"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
