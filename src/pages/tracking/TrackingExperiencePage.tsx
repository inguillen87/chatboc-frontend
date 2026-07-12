import React, { useMemo, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Clock3,
  Eye,
  EyeOff,
  Info,
  Loader2,
  MapPinned,
  MapPin,
  MessageCircle,
  Radio,
  RefreshCw,
  Route,
  Send,
  ShieldCheck,
  WifiOff,
} from "lucide-react";

import {
  fetchTrackingExperience,
  sendTrackingSupportMessage,
  type TrackingExperienceResponse,
  type TrackingKind,
} from "@/api/trackingExperience";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSocketUrl, SOCKET_PATH } from "@/config";
import { getErrorMessage } from "@/utils/api";
import { buildLiveChatJoinPayload } from "@/utils/liveChatRealtime";

const TrackingMap = React.lazy(() => import("@/components/ui/TrackingMap"));

type AnyRecord = Record<string, any>;

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
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
};

const humanizeTrackingLabel = (value: string) => {
  const normalized = value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
};

const formatTrackingDateTime = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return "";
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return normalized;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

const asArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) {
    const items = first(value, ["items", "events", "steps", "milestones", "timeline"]);
    if (Array.isArray(items)) return items;
  }
  return [];
};

const normalizeStatus = (payload: TrackingExperienceResponse | null) => {
  const status = payload?.status;
  if (isRecord(status)) {
    const key = readText(status, ["current_stage", "key", "id", "status", "state"], "recibido");
    const rawLabel = readText(status, ["label", "title", "name", "raw_status"], key);
    return {
      key,
      label: humanizeTrackingLabel(rawLabel),
      detail: readText(status, ["detail", "description", "summary"]),
    };
  }
  if (typeof status === "string" && status.trim()) {
    return { key: status, label: humanizeTrackingLabel(status), detail: "" };
  }
  return { key: "recibido", label: "Recibido", detail: "" };
};

const normalizeMilestones = (payload: TrackingExperienceResponse | null, kind: TrackingKind) => {
  const defaults =
    kind === "claim"
      ? ["recibido", "validando", "asignado", "en_proceso", "resuelto", "cerrado"]
      : ["recibido", "confirmado", "pendiente_pago", "pagado", "preparando", "en_camino", "entregado"];

  const statusRecord = isRecord(payload?.status) ? payload.status : null;
  const raw = asArray(payload?.milestones).length
    ? asArray(payload?.milestones)
    : asArray(statusRecord?.milestones);
  const items = raw
    .map((item) => {
      if (typeof item === "string") return { key: item, label: humanizeTrackingLabel(item) };
      if (isRecord(item)) {
        const key = readText(item, ["key", "id", "status", "state"]);
        return {
          key: key || readText(item, ["label", "title", "name"]),
          label: humanizeTrackingLabel(readText(item, ["label", "title", "name"], key)),
        };
      }
      return null;
    })
    .filter(Boolean) as Array<{ key: string; label: string }>;

  return items.length ? items : defaults.map((key) => ({ key, label: humanizeTrackingLabel(key) }));
};

const normalizeTimeline = (payload: TrackingExperienceResponse | null) =>
  asArray(payload?.timeline)
    .map((item, index) => {
      if (!isRecord(item)) return null;
      return {
        id: readText(item, ["id", "key"], `event_${index}`),
        label: humanizeTrackingLabel(
          readText(item, ["label", "title", "event", "status"], `Evento ${index + 1}`),
        ),
        detail: readText(item, ["detail", "description", "message", "summary"]),
        timestamp: formatTrackingDateTime(readText(item, ["timestamp", "created_at", "ts", "date"])),
      };
    })
    .filter(Boolean) as Array<{ id: string; label: string; detail: string; timestamp: string }>;

const normalizeResource = (payload: TrackingExperienceResponse | null, code: string) => {
  const resource = isRecord(payload?.resource) ? payload.resource : {};
  const tenant = isRecord(payload?.tenant) ? payload.tenant : {};
  const location = isRecord(payload?.location) ? payload.location : {};
  return {
    code: readText(resource, ["code"], code),
    subject: readText(resource, ["subject", "title", "name"], readText(resource, ["category"], "Seguimiento")),
    category: readText(resource, ["category", "rubro", "type"], "General"),
    channel: readText(resource, ["channel"], "whatsapp"),
    createdAt: formatTrackingDateTime(readText(resource, ["created_at", "createdAt", "fecha"])),
    updatedAt: formatTrackingDateTime(readText(resource, ["updated_at", "updatedAt", "ultima_actividad"])),
    tenantName: readText(tenant, ["nombre", "name"], "Chatboc"),
    tenantSlug: readText(tenant, ["slug"]),
    address: readText(location, ["address", "direccion"]),
    district: readText(location, ["district", "distrito"]),
  };
};

const normalizeSupport = (payload: TrackingExperienceResponse | null, kind: TrackingKind) => {
  const support = isRecord(payload?.support) ? payload.support : null;
  const hasSupportContract = Boolean(support);
  const fallbackClaimSupport = Boolean(payload && kind === "claim" && !hasSupportContract);
  const liveChat = isRecord(support?.live_chat) ? support.live_chat : {};
  const availability = isRecord(support?.availability) ? support.availability : {};
  const ticket = isRecord(support?.ticket) ? support.ticket : {};
  const endpoints = isRecord(support?.endpoints) ? support.endpoints : {};
  const conversation = isRecord(support?.conversation) ? support.conversation : {};
  const serviceWindow = isRecord(support?.service_window) ? support.service_window : {};
  const webviewPolicy = isRecord(support?.webview_policy) ? support.webview_policy : {};
  const adminSurface = isRecord(support?.admin_response_surface) ? support.admin_response_surface : {};
  const operatorQueue = isRecord(support?.operator_queue) ? support.operator_queue : {};
  const polling = isRecord(support?.polling) ? support.polling : {};
  const socket = isRecord(support?.socket) ? support.socket : {};
  const ui = isRecord(support?.ui) ? support.ui : {};
  const cta = isRecord(support?.cta) ? support.cta : {};
  const primaryCta = isRecord(cta.primary) ? cta.primary : {};
  const messages = asArray(conversation.messages)
    .map((item, index) => {
      if (!isRecord(item)) return null;
      const author = readText(item, ["author", "actor", "origin"], "customer");
      return {
        id: readText(item, ["id", "key"], `support_${index}`),
        message: readText(item, ["message", "body", "text", "comentario"]),
        author,
        createdAt: formatTrackingDateTime(readText(item, ["created_at", "timestamp", "date"])),
        isTeam: ["team", "admin", "agent", "municipio", "pyme"].includes(author.toLowerCase()),
      };
    })
    .filter((item): item is { id: string; message: string; author: string; createdAt: string; isTeam: boolean } =>
      Boolean(item?.message),
    );
  const rawMode =
    readText(support, ["mode"]) ||
    readText(liveChat, ["mode"]) ||
    (liveChat.enabled && liveChat.available ? "live" : "offline");
  const normalizedMode = rawMode.toLowerCase() === "live" ? "live" : "offline";
  const liveAvailable = normalizedMode === "live";
  const primaryCtaAction = readText(
    primaryCta,
    ["action"],
    liveAvailable ? "socket_live_message" : "queue_ticket_comment",
  );
  const pendingCustomerMessagesRaw = Number(
    first(operatorQueue, ["pending_customer_messages", "pendingCustomerMessages", "unread_count"]) ?? 0,
  );
  const pendingCustomerMessages = Number.isFinite(pendingCustomerMessagesRaw)
    ? Math.max(0, Math.round(pendingCustomerMessagesRaw))
    : 0;
  const hasPendingCustomerMessage = Boolean(
    first(operatorQueue, ["has_pending_customer_message", "hasPendingCustomerMessage"]) ??
      pendingCustomerMessages > 0,
  );
  const slaTargetMinutesRaw = Number(first(operatorQueue, ["sla_target_minutes", "slaTargetMinutes"]) ?? 0);
  const slaTargetMinutes =
    Number.isFinite(slaTargetMinutesRaw) && slaTargetMinutesRaw > 0 ? Math.round(slaTargetMinutesRaw) : null;
  const pollingInterval = readText(polling, ["interval_ms"]);
  const pollingIntervalNumber = Number(pollingInterval);
  const pollingLabelFallback =
    pollingInterval && Number.isFinite(pollingIntervalNumber) && pollingIntervalNumber > 0
      ? `Actualizacion cada ${pollingIntervalNumber / 1000}s`
      : "";
  const responseExpectationFallback = liveAvailable
    ? slaTargetMinutes
      ? `Respuesta esperada en hasta ${slaTargetMinutes} min`
      : "Atencion inmediata"
    : slaTargetMinutes
      ? `El equipo lo ve en el CRM. SLA objetivo ${slaTargetMinutes} min`
      : "El equipo responde desde el CRM";

  return {
    enabled: support?.enabled !== false && (hasSupportContract || fallbackClaimSupport),
    mode: normalizedMode,
    label: readText(availability, ["label"], fallbackClaimSupport ? "Mesa de ayuda del reclamo" : "Mesa de ayuda"),
    description: readText(
      availability,
      ["description"],
      fallbackClaimSupport
        ? "Deja un mensaje asociado a este reclamo. El equipo lo vera en el CRM."
        : "Deja un mensaje asociado a este seguimiento.",
    ),
    liveAvailable,
    acceptsMessages: serviceWindow.accepts_messages !== false,
    offlineQueue: fallbackClaimSupport || Boolean(serviceWindow.offline_queue_enabled),
    stayInsideTracking: webviewPolicy.stay_inside_tracking !== false,
    adminSurfaceLabel: readText(adminSurface, ["label"], "Inbox de reclamos"),
    nextAction: readText(serviceWindow, ["next_action"], primaryCtaAction),
    primaryCtaLabel: readText(
      primaryCta,
      ["label", "title", "text"],
      liveAvailable ? "Chatear con un agente" : "Dejar mensaje para el equipo",
    ),
    primaryCtaAction,
    pollingInterval,
    pollingLabel: readText(ui, ["polling_label", "pollingLabel"], pollingLabelFallback),
    responseExpectationLabel: readText(
      ui,
      ["response_expectation_label", "responseExpectationLabel"],
      responseExpectationFallback,
    ),
    channelBindingLabel: readText(
      ui,
      ["channel_binding_label", "channelBindingLabel"],
      readText(serviceWindow, ["channel_binding_label", "channelBindingLabel"], "Canal interno del ticket"),
    ),
    noExternalRedirectLabel: readText(
      ui,
      ["no_external_redirect_label", "noExternalRedirectLabel"],
      support?.webview_policy?.external_redirect_required === false ? "Sin redireccion externa" : "Sin salir del seguimiento",
    ),
    operationalStateLabel: readText(
      ui,
      ["operational_state_label", "operationalStateLabel"],
      "Canal seguro asociado al reclamo",
    ),
    schedule: readText(serviceWindow, ["schedule_label"]) || readText(liveChat, ["description"]) || (
      readText(liveChat, ["start_time"]) && readText(liveChat, ["end_time"])
        ? `${readText(liveChat, ["start_time"])} a ${readText(liveChat, ["end_time"])}`
        : ""
    ),
    endpoint: readText(endpoints, ["send_message"], fallbackClaimSupport ? "/tracking/api/send-claim-message" : ""),
    ticketId: readText(ticket, ["id"]),
    requiresPin: ticket.requires_pin !== false,
    socketEnabled: socket.enabled === true,
    socketRoom: readText(socket, ["room", "socket_room", "socketRoom"]),
    socketAccessToken: readText(socket, ["access_token", "accessToken", "live_chat_access_token"]),
    socketEvent: readText(socket, ["event"], "new_chat_message"),
    queueState: readText(
      operatorQueue,
      ["state", "status"],
      hasPendingCustomerMessage
        ? liveAvailable
          ? "live_agent_attention_needed"
          : "offline_waiting_admin_response"
        : "up_to_date",
    ),
    queueLabel: readText(
      operatorQueue,
      ["customer_visible_label", "customerVisibleLabel"],
      hasPendingCustomerMessage
        ? "Tu mensaje quedo pendiente para el equipo"
        : "El equipo esta al dia con este reclamo",
    ),
    pendingCustomerMessages,
    hasPendingCustomerMessage,
    pendingSince: formatTrackingDateTime(readText(operatorQueue, ["pending_since", "pendingSince"])),
    slaTargetMinutes,
    nextTeamActionLabel: readText(
      operatorQueue,
      ["next_team_action_label", "nextTeamActionLabel"],
      hasPendingCustomerMessage ? "Responder desde la bandeja de reclamos" : "Sin respuesta pendiente",
    ),
    messages,
  };
};

const readLatLng = (value: unknown): { lat: number; lng: number; name?: string } | null => {
  if (!isRecord(value)) return null;
  const latRaw = first(value, ["lat", "latitude"]);
  const lngRaw = first(value, ["lng", "lon", "longitude"]);
  const lat = typeof latRaw === "number" ? latRaw : Number(latRaw);
  const lng = typeof lngRaw === "number" ? lngRaw : Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, name: readText(value, ["name", "label", "address"]) };
};

const normalizeMapLocations = (payload: TrackingExperienceResponse | null) => {
  const map = isRecord(payload?.map) ? payload.map : {};
  const location = isRecord(payload?.location) ? payload.location : {};
  const points = asArray(first(map, ["points", "markers", "locations"]));
  const byRole = (role: string) => {
    const match = points.find((point) => isRecord(point) && String(first(point, ["role", "type", "kind"]) || "").toLowerCase() === role);
    return readLatLng(match);
  };

  return {
    canRender: first(map, ["can_render", "enabled"]) !== false,
    origin: readLatLng(first(map, ["origin", "store", "start"])) || byRole("origin"),
    destination:
      readLatLng(first(map, ["destination", "claim_location", "customer", "end"])) ||
      byRole("destination") ||
      readLatLng(first(map, ["center"])) ||
      readLatLng(location),
    current:
      readLatLng(first(map, ["current", "current_status", "driver"])) ||
      byRole("current") ||
      readLatLng(first(map, ["center"])),
    fallback: readText(map, ["fallback_when_no_coordinates"], "timeline_only"),
  };
};

const titleFor = (kind: TrackingKind) =>
  kind === "claim" ? "Seguimiento de reclamo" : "Seguimiento de pedido";

const readTrackingFragment = (hash: string) => {
  const raw = hash.replace(/^#/, "");
  if (!raw.includes("=")) return { pin: null, token: null, focus: null };
  const params = new URLSearchParams(raw);
  return {
    pin: params.get("pin"),
    token: params.get("token") || params.get("access_token"),
    focus: params.get("focus"),
  };
};

const TRACKING_CREDENTIAL_MEMORY_LIMIT = 24;
const trackingCredentialMemory = new Map<string, { pin: string; token: string | null }>();

const rememberTrackingCredential = (
  key: string,
  credential: { pin: string; token: string | null },
) => {
  if (!key || (!credential.pin && !credential.token)) return;
  trackingCredentialMemory.delete(key);
  trackingCredentialMemory.set(key, credential);
  while (trackingCredentialMemory.size > TRACKING_CREDENTIAL_MEMORY_LIMIT) {
    const oldestKey = trackingCredentialMemory.keys().next().value;
    if (!oldestKey) break;
    trackingCredentialMemory.delete(oldestKey);
  }
};

export default function TrackingExperiencePage({ kind }: { kind: TrackingKind }) {
  const params = useParams<{ code?: string; nro_ticket?: string; nro_pedido?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const initialFragmentRef = React.useRef(readTrackingFragment(location.hash));
  const credentialsScrubbedRef = React.useRef(false);
  const code = params.code || params.nro_ticket || params.nro_pedido || searchParams.get("code") || "";
  const tenantSlug = searchParams.get("tenant_slug") || searchParams.get("tenant") || null;
  const credentialMemoryKey = `${kind}:${code || "unknown"}`;
  const [initialCredential] = useState(() => {
    const remembered = trackingCredentialMemory.get(credentialMemoryKey);
    const credential = {
      pin: initialFragmentRef.current.pin || searchParams.get("pin") || remembered?.pin || "",
      token:
        initialFragmentRef.current.token ||
        searchParams.get("token") ||
        searchParams.get("access_token") ||
        remembered?.token ||
        null,
    };
    rememberTrackingCredential(credentialMemoryKey, credential);
    return credential;
  });
  const [accessToken] = useState(initialCredential.token);
  const [pin, setPin] = useState(initialCredential.pin);
  const [showPin, setShowPin] = useState(false);
  const [payload, setPayload] = useState<TrackingExperienceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorTarget, setErrorTarget] = useState<"pin" | "tracking" | null>(null);
  const [pageNotice, setPageNotice] = useState<{ message: string; tone: "status" | "error" } | null>(null);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSending, setSupportSending] = useState(false);
  const [supportNotice, setSupportNotice] = useState<{
    message: string;
    tone: "success" | "error";
  } | null>(null);
  const [realtimeState, setRealtimeState] = useState<"idle" | "connecting" | "connected" | "fallback">("idle");
  const [socketAttempt, setSocketAttempt] = useState(0);
  const pinInputRef = React.useRef<HTMLInputElement | null>(null);
  const trackingErrorRef = React.useRef<HTMLDivElement | null>(null);
  const supportComposerRef = React.useRef<HTMLTextAreaElement | null>(null);
  const supportNoticeRef = React.useRef<HTMLDivElement | null>(null);
  const mapSectionRef = React.useRef<HTMLDivElement | null>(null);
  const loadRef = React.useRef<(() => Promise<void>) | null>(null);
  const realtimeRefreshPendingRef = React.useRef(false);
  const realtimeRefreshQueuedRef = React.useRef(false);
  const joinRefreshPendingRef = React.useRef(false);
  const joinFailureCountRef = React.useRef(0);

  React.useEffect(() => {
    if (credentialsScrubbedRef.current) return;
    const hasQueryCredential =
      searchParams.has("pin") || searchParams.has("token") || searchParams.has("access_token");
    const hasFragmentCredential = Boolean(initialFragmentRef.current.pin || initialFragmentRef.current.token);
    if (!hasQueryCredential && !hasFragmentCredential) return;
    credentialsScrubbedRef.current = true;
    const sanitizedParams = new URLSearchParams(searchParams);
    sanitizedParams.delete("pin");
    sanitizedParams.delete("token");
    sanitizedParams.delete("access_token");
    const focusHash = initialFragmentRef.current.focus
      ? `#${encodeURIComponent(initialFragmentRef.current.focus)}`
      : "";
    if (typeof window !== "undefined") {
      const query = sanitizedParams.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${location.pathname}${query ? `?${query}` : ""}${focusHash}`,
      );
    }
  }, [location.pathname, searchParams]);

  const status = normalizeStatus(payload);
  const resource = normalizeResource(payload, code);
  const milestones = normalizeMilestones(payload, kind);
  const timeline = normalizeTimeline(payload);
  const mapState = normalizeMapLocations(payload);
  const support = normalizeSupport(payload, kind);
  const currentIndex = Math.max(
    0,
    milestones.findIndex((item) => item.key.toLowerCase() === status.key.toLowerCase()),
  );
  const nextMilestone = currentIndex < milestones.length - 1 ? milestones[currentIndex + 1] : null;
  const progress = milestones.length > 1 ? Math.round((currentIndex / (milestones.length - 1)) * 100) : 0;
  const requiresPinForLoad = kind === "claim" && !payload && !pin.trim();
  const requiresPinForSupport = kind === "claim" && support.requiresPin && !pin.trim();
  const supportPollingMs = useMemo(() => {
    if (kind !== "claim" || !support.enabled || !support.pollingInterval) return 0;
    const parsed = Number(support.pollingInterval);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.min(Math.max(parsed, 10_000), 60_000);
  }, [kind, support.enabled, support.pollingInterval]);

  const requestId = readText(payload, ["request_id"]);
  const canShowMap = Boolean(
    mapState.canRender &&
      (mapState.origin || mapState.destination || mapState.current),
  );
  const trackingCodeLabel = resource.code || code || "-";
  const focusAfterRender = (target: React.RefObject<HTMLElement>) => {
    window.setTimeout(() => target.current?.focus({ preventScroll: true }), 0);
  };
  const focusSupportComposer = () => {
    const target = supportComposerRef.current;
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => target.focus({ preventScroll: true }), 250);
  };
  const focusMap = () => {
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const copyTrackingCode = async () => {
    if (!trackingCodeLabel || trackingCodeLabel === "-" || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(trackingCodeLabel);
      setPageNotice({ message: `Codigo ${trackingCodeLabel} copiado.`, tone: "status" });
    } catch {
      setPageNotice({
        message: `No se pudo copiar el codigo. Referencia: ${trackingCodeLabel}`,
        tone: "error",
      });
    }
  };

  const load = async () => {
    if (!code) return;
    if (requiresPinForLoad) {
      setError("Ingresa el PIN para consultar el estado del reclamo.");
      setErrorTarget("pin");
      focusAfterRender(pinInputRef);
      return;
    }

    setLoading(true);
    setError(null);
    setErrorTarget(null);
    try {
      const nextPayload = await fetchTrackingExperience({
        kind,
        code,
        pin: pin.trim() || null,
        token: accessToken,
        tenantSlug,
      });
      setPayload(nextPayload);
    } catch (err) {
      setPayload(null);
      setError(getErrorMessage(err, "No se pudo cargar el seguimiento."));
      setErrorTarget("tracking");
      focusAfterRender(trackingErrorRef);
    } finally {
      setLoading(false);
    }
  };

  const handleSendSupportMessage = async () => {
    const message = supportMessage.trim();
    if (!message || !support.endpoint || (support.requiresPin && !pin.trim())) return;
    setSupportSending(true);
    setSupportNotice(null);
    try {
      const reply = await sendTrackingSupportMessage({
        endpoint: support.endpoint,
        pin: pin.trim() || null,
        message,
        code,
      });
      const updatedTracking = isRecord(reply?.tracking) ? reply.tracking : null;
      const crmWriteback = isRecord(reply?.crm_writeback) ? reply.crm_writeback : null;
      if (updatedTracking) {
        setPayload(updatedTracking as TrackingExperienceResponse);
      }
      setSupportMessage("");
      setSupportNotice({
        tone: "success",
        message:
          readText(reply, ["message"]) ||
          (support.liveAvailable
            ? "Mensaje enviado al canal en vivo del reclamo."
            : "Mensaje guardado en el reclamo para la mesa de entrada."),
      });
      if (crmWriteback?.unread_for_team || crmWriteback?.inbox_increment) {
        setSupportNotice({
          tone: "success",
          message: `${readText(reply, ["message"], "Mensaje guardado en el reclamo.")} El equipo lo ve como pendiente en el CRM.`,
        });
      }
      if (!updatedTracking) await load();
    } catch (err) {
      setSupportNotice({
        tone: "error",
        message: getErrorMessage(err, "No se pudo enviar el mensaje."),
      });
      focusAfterRender(supportNoticeRef);
    } finally {
      setSupportSending(false);
    }
  };

  loadRef.current = load;

  React.useEffect(() => {
    if (!code || requiresPinForLoad) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, kind, accessToken]);

  React.useEffect(() => {
    if (
      kind !== "claim" ||
      !payload ||
      !support.liveAvailable ||
      !support.socketEnabled ||
      !support.socketRoom ||
      !support.socketAccessToken
    ) {
      setRealtimeState("idle");
      return;
    }

    const socketUrl = getSocketUrl();
    if (!socketUrl) {
      setRealtimeState("fallback");
      return;
    }

    setRealtimeState("connecting");
    let effectActive = true;
    const socket = io(socketUrl, {
      path: SOCKET_PATH,
      transports: ["polling", "websocket"],
      reconnectionAttempts: 3,
      reconnectionDelay: 1500,
      timeout: 8000,
    });
    const room = support.socketRoom;
    const ticketId = String(support.ticketId || "");
    const joinRoom = () => {
      socket.emit("join", buildLiveChatJoinPayload(room, support.socketAccessToken));
    };
    const matchesTicket = (eventPayload: unknown) => {
      if (!isRecord(eventPayload) || !ticketId) return true;
      const nestedTicket = isRecord(eventPayload.ticket) ? eventPayload.ticket : {};
      const eventTicketId = first(eventPayload, ["ticket_id", "ticketId"]) ?? first(nestedTicket, ["id"]);
      return eventTicketId === undefined || eventTicketId === null || String(eventTicketId) === ticketId;
    };
    const runTrackingRefresh = () => {
      if (realtimeRefreshPendingRef.current) {
        realtimeRefreshQueuedRef.current = true;
        return;
      }
      realtimeRefreshPendingRef.current = true;
      const pendingLoad = loadRef.current?.();
      if (!pendingLoad) {
        realtimeRefreshPendingRef.current = false;
        return;
      }
      void pendingLoad.finally(() => {
        realtimeRefreshPendingRef.current = false;
        if (effectActive && realtimeRefreshQueuedRef.current) {
          realtimeRefreshQueuedRef.current = false;
          runTrackingRefresh();
        }
      });
    };
    const refreshTracking = (eventPayload: unknown) => {
      if (!matchesTicket(eventPayload)) return;
      runTrackingRefresh();
    };
    const handleJoinAck = (eventPayload: unknown) => {
      if (isRecord(eventPayload) && readText(eventPayload, ["room"]) !== room) return;
      joinFailureCountRef.current = 0;
      setRealtimeState("connected");
    };
    const handleRealtimeFailure = () => setRealtimeState("fallback");
    const handleJoinError = () => {
      setRealtimeState("fallback");
      if (joinFailureCountRef.current >= 2 || joinRefreshPendingRef.current) return;
      joinFailureCountRef.current += 1;
      joinRefreshPendingRef.current = true;
      const pendingLoad = loadRef.current?.();
      if (!pendingLoad) {
        joinRefreshPendingRef.current = false;
        return;
      }
      void pendingLoad.finally(() => {
        joinRefreshPendingRef.current = false;
        if (effectActive) setSocketAttempt((value) => value + 1);
      });
    };

    socket.on("connect", joinRoom);
    socket.on("join_ack", handleJoinAck);
    socket.on("join_error", handleJoinError);
    socket.on("connect_error", handleRealtimeFailure);
    socket.on("disconnect", handleRealtimeFailure);
    socket.on(support.socketEvent, refreshTracking);
    if (support.socketEvent !== "new_chat_message") {
      socket.on("new_chat_message", refreshTracking);
    }
    socket.on("conversation.message.created", refreshTracking);
    socket.on("ticket.status.changed", refreshTracking);
    socket.on("ticket.assignment.changed", refreshTracking);
    if (socket.connected) joinRoom();

    return () => {
      effectActive = false;
      socket.off("connect", joinRoom);
      socket.off("join_ack", handleJoinAck);
      socket.off("join_error", handleJoinError);
      socket.off("connect_error", handleRealtimeFailure);
      socket.off("disconnect", handleRealtimeFailure);
      socket.off(support.socketEvent, refreshTracking);
      if (support.socketEvent !== "new_chat_message") {
        socket.off("new_chat_message", refreshTracking);
      }
      socket.off("conversation.message.created", refreshTracking);
      socket.off("ticket.status.changed", refreshTracking);
      socket.off("ticket.assignment.changed", refreshTracking);
      socket.disconnect();
      realtimeRefreshPendingRef.current = false;
      realtimeRefreshQueuedRef.current = false;
    };
  }, [
    kind,
    Boolean(payload),
    support.liveAvailable,
    support.socketEnabled,
    support.socketRoom,
    support.socketEvent,
    support.ticketId,
    socketAttempt,
  ]);

  React.useEffect(() => {
    if (!payload || !supportPollingMs || !support.endpoint || requiresPinForSupport) return;
    const intervalMs = realtimeState === "connected"
      ? Math.max(60_000, supportPollingMs * 6)
      : supportPollingMs;
    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (supportSending) return;
      void load();
    }, intervalMs);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, supportPollingMs, support.endpoint, requiresPinForSupport, supportSending, realtimeState]);

  const visibleTimeline = useMemo(
    () =>
      timeline.length
        ? timeline
        : milestones.slice(0, Math.max(currentIndex + 1, 1)).map((item) => ({
            id: item.key,
            label: item.label,
            detail: "",
            timestamp: "",
          })),
    [currentIndex, milestones, timeline],
  );

  return (
    <div className="min-h-screen bg-muted/30 px-3 py-4 text-foreground sm:px-4 md:py-6">
      <section className="mx-auto max-w-6xl">
        <header
          data-testid="tracking-summary-header"
          className="mb-4 overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm"
        >
          <div className="flex items-start justify-between gap-3 p-4 md:px-5">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase text-primary">{resource.tenantName}</p>
              <h1 className="mt-1 text-xl font-black md:text-2xl">{titleFor(kind)}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {kind === "claim" ? "Reclamo" : "Pedido"}{" "}
                <span className="font-mono font-semibold text-foreground">#{trackingCodeLabel}</span>
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copyTrackingCode}
              disabled={trackingCodeLabel === "-"}
              aria-label="Copiar codigo de seguimiento"
              title="Copiar codigo de seguimiento"
            >
              <Clipboard />
            </Button>
          </div>

          <div className="border-t border-border/70 p-4 md:px-5">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
              <div className="col-span-2 border-l-2 border-primary pl-3 md:col-span-1">
                <p className="text-xs font-semibold text-muted-foreground">Estado actual</p>
                <p className="mt-1 text-lg font-black capitalize">{status.label}</p>
                {status.detail ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{status.detail}</p> : null}
              </div>
              <div className="border-l border-border pl-3">
                <p className="text-xs font-semibold text-muted-foreground">Proxima etapa</p>
                <p className="mt-1 text-sm font-bold capitalize">
                  {nextMilestone?.label || "Seguimiento finalizado"}
                </p>
              </div>
              <div className="border-l border-border pl-3">
                <p className="text-xs font-semibold text-muted-foreground">Ultima actualizacion</p>
                <p className="mt-1 text-sm font-bold">{resource.updatedAt || resource.createdAt || "Sin datos"}</p>
              </div>
            </div>

            <div data-testid="tracking-delivery-rail" className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Avance del seguimiento</span>
                <span className="font-semibold text-foreground">{progress}%</span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Avance del seguimiento"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          <div className="border-t border-border/70 bg-background/50 p-4 md:px-5">
            <form
              className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
              onSubmit={(event) => {
                event.preventDefault();
                void load();
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                {kind === "claim" ? (
                  <div className="w-full sm:w-56">
                    <label htmlFor="tracking-pin" className="mb-1.5 block text-sm font-semibold">
                      PIN del reclamo
                    </label>
                    <div className="relative">
                      <Input
                        id="tracking-pin"
                        ref={pinInputRef}
                        type={showPin ? "text" : "password"}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="one-time-code"
                        value={pin}
                        onChange={(event) => {
                          setPin(event.target.value);
                          if (errorTarget === "pin") {
                            setError(null);
                            setErrorTarget(null);
                          }
                        }}
                        aria-invalid={errorTarget === "pin"}
                        aria-describedby={`tracking-pin-help${errorTarget === "pin" ? " tracking-page-error" : ""}`}
                        className="h-10 bg-background pr-10 font-mono"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 shadow-none"
                        onClick={() => setShowPin((value) => !value)}
                        aria-label={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                        aria-controls="tracking-pin"
                        aria-pressed={showPin}
                        title={showPin ? "Ocultar PIN" : "Mostrar PIN"}
                      >
                        {showPin ? <EyeOff /> : <Eye />}
                      </Button>
                    </div>
                    <p id="tracking-pin-help" className="mt-1 text-xs text-muted-foreground">
                      Solo se usa para validar este seguimiento.
                    </p>
                  </div>
                ) : null}
                <Button type="submit" disabled={loading || !code} className="h-10 font-semibold">
                  {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                  Actualizar estado
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex">
                {kind === "claim" && support.enabled ? (
                  <Button type="button" variant="outline" onClick={focusSupportComposer}>
                    <MessageCircle />
                    Escribir mensaje
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={focusMap} disabled={!canShowMap}>
                  <MapPinned />
                  Ver mapa
                </Button>
              </div>
            </form>
          </div>
        </header>

        {pageNotice ? (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              pageNotice.tone === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-border bg-card text-muted-foreground"
            }`}
            role={pageNotice.tone === "error" ? "alert" : "status"}
            aria-live={pageNotice.tone === "error" ? "assertive" : "polite"}
          >
            {pageNotice.message}
          </div>
        ) : null}

        {error ? (
          <div
            id="tracking-page-error"
            ref={trackingErrorRef}
            className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            role="alert"
            aria-live="assertive"
            tabIndex={-1}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        <div
          data-testid="tracking-priority-content"
          className={`grid gap-4 ${kind === "claim" && support.enabled ? "lg:grid-cols-[0.9fr_1.1fr]" : "lg:grid-cols-1"}`}
        >
          <section
            aria-labelledby="tracking-timeline-title"
            className="rounded-lg border border-border/70 bg-card p-4 shadow-sm md:p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Actividad del caso</p>
                <h2 id="tracking-timeline-title" className="mt-1 text-lg font-black">Timeline</h2>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {visibleTimeline.length} {visibleTimeline.length === 1 ? "evento" : "eventos"}
              </span>
            </div>
            <ol className="max-h-[340px] space-y-3 overflow-y-auto pr-1">
              {visibleTimeline.map((event) => (
                <li key={event.id} className="grid grid-cols-[16px_1fr] gap-3">
                  <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-primary/10" />
                  <div className="min-w-0 border-b border-border/60 pb-3 last:border-b-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="font-semibold">{event.label}</p>
                      {event.timestamp ? <time className="text-xs text-muted-foreground">{event.timestamp}</time> : null}
                    </div>
                    {event.detail ? <p className="mt-1 text-sm leading-5 text-muted-foreground">{event.detail}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className={kind === "claim" && support.enabled ? "min-w-0" : "hidden"}>

            {kind === "claim" && support.enabled ? (
              <div
                id="mesa-ayuda"
                data-testid="tracking-helpdesk"
                className="rounded-lg border border-border/70 bg-card p-4 shadow-sm md:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                          support.liveAvailable ? "bg-emerald-500/12 text-emerald-600" : "bg-amber-500/12 text-amber-600"
                        }`}
                      >
                        {support.liveAvailable ? <Radio className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">Mesa de ayuda</p>
                        <h2 className="text-lg font-black">{support.label}</h2>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-5 text-muted-foreground">{support.description}</p>
                    {support.schedule ? (
                      <p className="mt-1 text-xs font-semibold text-foreground/75">Horario: {support.schedule}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="inline-flex items-center rounded-full border border-border/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
                      Ticket #{support.ticketId || code}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                        support.liveAvailable
                          ? "bg-emerald-500/12 text-emerald-700"
                          : "bg-amber-500/12 text-amber-700"
                      }`}
                    >
                      {support.liveAvailable ? "En vivo" : "Offline"}
                    </span>
                  </div>
                </div>

                <div
                  data-testid="tracking-helpdesk-queue"
                  className={`mt-4 border-y px-1 py-3 ${
                    support.hasPendingCustomerMessage
                      ? "border-amber-500/30"
                      : "border-emerald-500/25"
                  }`}
                  aria-live="polite"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                            support.hasPendingCustomerMessage
                              ? "bg-amber-500/15 text-amber-700"
                              : "bg-emerald-500/15 text-emerald-700"
                          }`}
                        >
                          {support.hasPendingCustomerMessage ? (
                            <Clock3 className="h-4 w-4" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-black text-foreground">{support.queueLabel}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {support.nextTeamActionLabel}
                            {support.slaTargetMinutes ? ` - SLA objetivo ${support.slaTargetMinutes} min` : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1">
                        Pendientes: {support.pendingCustomerMessages}
                      </span>
                      {support.pendingSince ? (
                        <span className="rounded-full border border-border/70 bg-background/70 px-3 py-1">
                          Desde {support.pendingSince}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-bold">Conversacion</h3>
                  <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
                  {support.messages.length ? (
                    support.messages.map((item) => (
                      <div
                        key={item.id}
                        className={`max-w-[92%] rounded-md px-3 py-2 text-sm ${
                          item.isTeam
                            ? "mr-auto border border-border/70 bg-muted/50 text-foreground"
                            : "ml-auto bg-primary text-primary-foreground"
                        }`}
                      >
                        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase opacity-75">
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>{item.isTeam ? "Equipo" : "Tu mensaje"}</span>
                        </div>
                        <p className="leading-5">{item.message}</p>
                        {item.createdAt ? <p className="mt-2 text-xs opacity-70">{item.createdAt}</p> : null}
                      </div>
                    ))
                  ) : (
                    <div className="border-l-2 border-border px-3 py-2 text-sm text-muted-foreground">
                      Todavia no hay mensajes publicos en este reclamo.
                    </div>
                  )}
                  </div>
                </div>

                <form
                  className="mt-4 border-t border-border/70 pt-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSendSupportMessage();
                  }}
                >
                  <label htmlFor="tracking-support-message" className="block text-sm font-semibold">
                    Mensaje para la mesa de ayuda
                  </label>
                  <textarea
                    id="tracking-support-message"
                    ref={supportComposerRef}
                    value={supportMessage}
                    onChange={(event) => setSupportMessage(event.target.value)}
                    placeholder={support.liveAvailable ? "Escribi para hablar con la mesa de ayuda..." : "Deja tu mensaje offline para este reclamo..."}
                    className="mt-1.5 min-h-20 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    disabled={supportSending || !support.endpoint}
                    aria-describedby={`tracking-support-message-help${supportNotice ? " tracking-support-message-notice" : ""}`}
                  />
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p id="tracking-support-message-help" className="text-xs text-muted-foreground">
                      {support.requiresPin ? "El PIN mantiene la conversacion asociada a este reclamo." : "Mensaje asociado al seguimiento."}
                    </p>
                    <Button
                      type="submit"
                      disabled={supportSending || !supportMessage.trim() || !support.endpoint || requiresPinForSupport}
                      className="h-10 font-semibold"
                    >
                      {supportSending ? <Loader2 className="animate-spin" /> : <Send />}
                      {support.primaryCtaLabel}
                    </Button>
                  </div>
                </form>
                {supportNotice ? (
                  <div
                    id="tracking-support-message-notice"
                    ref={supportNoticeRef}
                    className={`mt-3 rounded-lg border px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      supportNotice.tone === "error"
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : "border-emerald-500/25 bg-emerald-500/10 text-emerald-800"
                    }`}
                    role={supportNotice.tone === "error" ? "alert" : "status"}
                    aria-live={supportNotice.tone === "error" ? "assertive" : "polite"}
                    tabIndex={supportNotice.tone === "error" ? -1 : undefined}
                  >
                    {supportNotice.message}
                  </div>
                ) : null}
              </div>
            ) : null}

          </section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
          <section
            ref={mapSectionRef}
            aria-labelledby="tracking-map-title"
            className="rounded-lg border border-border/70 bg-card p-4 shadow-sm md:p-5"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MapPinned className="h-4 w-4 text-primary" />
                <h2 id="tracking-map-title" className="font-bold">Mapa y recorrido</h2>
              </div>
              <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground">
                {canShowMap ? "Mapa activo" : "Sin coordenadas"}
              </span>
            </div>

            {canShowMap ? (
              <div className="overflow-hidden rounded-md border border-border/70 bg-slate-950">
                <React.Suspense
                  fallback={(
                    <div className="flex h-[240px] items-center justify-center bg-muted/30 text-sm text-muted-foreground md:h-[300px]">
                      Cargando mapa...
                    </div>
                  )}
                >
                  <TrackingMap
                    className="h-[240px] border-0 md:h-[300px]"
                    status={status.key}
                    storeLocation={mapState.origin}
                    customerLocation={mapState.destination}
                    driverLocation={mapState.current || undefined}
                  />
                </React.Suspense>
              </div>
            ) : (
              <div className="flex min-h-40 flex-col items-center justify-center border-y border-dashed border-border/70 px-4 py-6 text-center">
                <ShieldCheck className="mb-2 h-7 w-7 text-primary" />
                <p className="font-semibold">Seguimiento por timeline</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  No hay coordenadas renderizables para este caso.
                </p>
              </div>
            )}
          </section>

          <section
            aria-labelledby="tracking-milestones-title"
            className="rounded-lg border border-border/70 bg-card p-4 shadow-sm md:p-5"
          >
            <div className="mb-3 flex items-center gap-2">
              <Route className="h-4 w-4 text-primary" />
              <h2 id="tracking-milestones-title" className="font-bold">Hitos</h2>
            </div>
            <ol className="grid grid-cols-2 gap-x-3 gap-y-1">
              {milestones.map((item, index) => {
                const done = index <= currentIndex;
                const active = index === currentIndex;
                return (
                  <li
                    key={item.key}
                    className={`min-w-0 border-l-2 py-2 pl-3 ${
                      active ? "border-primary" : done ? "border-emerald-500" : "border-border"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : done
                              ? "bg-emerald-500 text-white"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-xs font-semibold capitalize">{item.label}</p>
                        {active ? <p className="mt-0.5 text-[11px] text-muted-foreground">Actual</p> : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        <details
          data-testid="tracking-details-disclosure"
          className="group mt-4 overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-5">
            <span className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              Detalles y diagnostico
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>

          <div className="border-t border-border/70 p-4 md:p-5">
            <h2 className="text-sm font-bold">Datos del seguimiento</h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Motivo", resource.subject || status.label],
                ["Categoria", resource.category || "-"],
                ["Canal", resource.channel || "-"],
                ["Acceso", kind === "claim" ? "PIN seguro" : "Link seguro"],
                ["Creado", resource.createdAt || "-"],
                ["Actualizado", resource.updatedAt || "-"],
                ["Avance", `${progress}%`],
                ["Eventos", String(visibleTimeline.length)],
              ].map(([label, value]) => (
                <div key={label} className="border-b border-border/60 pb-2">
                  <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                  <dd className="mt-1 break-words font-semibold">{value}</dd>
                </div>
              ))}
            </dl>

            {resource.address || resource.district ? (
              <div className="mt-4 flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="font-semibold">Ubicacion</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {[resource.address, resource.district].filter(Boolean).join(" - ")}
                  </p>
                </div>
              </div>
            ) : null}

            {kind === "claim" && support.enabled ? (
              <div className="mt-5 border-t border-border/70 pt-4">
                <h2 className="text-sm font-bold">Diagnostico de la mesa de ayuda</h2>
                <div
                  data-testid="tracking-helpdesk-operational-state"
                  className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    {support.noExternalRedirectLabel}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
                    <MessageCircle className="h-3.5 w-3.5 text-primary" />
                    {support.channelBindingLabel}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
                    {support.liveAvailable ? <Radio className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                    {support.responseExpectationLabel}
                  </span>
                  {support.pollingLabel ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
                      <RefreshCw className="h-3.5 w-3.5" />
                      {support.pollingLabel}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
                    {realtimeState === "connected"
                      ? "Canal en vivo conectado"
                      : realtimeState === "connecting"
                        ? "Conectando canal en vivo"
                        : realtimeState === "fallback"
                          ? "Actualizacion automatica de respaldo"
                          : support.operationalStateLabel}
                  </span>
                </div>

                <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    ["Superficie del equipo", support.adminSurfaceLabel],
                    ["Modo", support.liveAvailable ? "En vivo" : "Offline"],
                    ["Mensajes offline", support.offlineQueue ? "Habilitados" : "No habilitados"],
                    ["Permanencia", support.stayInsideTracking ? "Dentro del seguimiento" : "Puede requerir salida"],
                    ["Estado de cola", support.queueState],
                    ["Mensajes pendientes", String(support.pendingCustomerMessages)],
                    ["Proxima accion", support.nextTeamActionLabel],
                    ["Accion del canal", support.nextAction || support.primaryCtaAction],
                  ].map(([label, value]) => (
                    <div key={label} className="border-b border-border/60 pb-2">
                      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                      <dd className="mt-1 break-words font-semibold">{value || "-"}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            {requestId ? (
              <p className="mt-4 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                Request ID: <span className="break-all font-mono text-foreground">{requestId}</span>
              </p>
            ) : null}
          </div>
        </details>

        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowRight className="rotate-180" />
            Volver
          </Button>
        </div>
      </section>
    </div>
  );
}
