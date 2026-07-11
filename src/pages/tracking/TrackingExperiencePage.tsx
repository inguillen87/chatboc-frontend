import React, { useMemo, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clipboard,
  Clock3,
  FileText,
  Loader2,
  MapPinned,
  MapPin,
  MessageCircle,
  MessagesSquare,
  PackageCheck,
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
import OperationalContinuityBar from "@/components/operations/OperationalContinuityBar";
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
    return {
      key,
      label: readText(status, ["label", "title", "name", "raw_status"], key.replace(/_/g, " ")),
      detail: readText(status, ["detail", "description", "summary"]),
    };
  }
  if (typeof status === "string" && status.trim()) {
    return { key: status, label: status.replace(/_/g, " "), detail: "" };
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
      if (typeof item === "string") return { key: item, label: item.replace(/_/g, " ") };
      if (isRecord(item)) {
        const key = readText(item, ["key", "id", "status", "state"]);
        return {
          key: key || readText(item, ["label", "title", "name"]),
          label: readText(item, ["label", "title", "name"], key.replace(/_/g, " ")),
        };
      }
      return null;
    })
    .filter(Boolean) as Array<{ key: string; label: string }>;

  return items.length ? items : defaults.map((key) => ({ key, label: key.replace(/_/g, " ") }));
};

const normalizeTimeline = (payload: TrackingExperienceResponse | null) =>
  asArray(payload?.timeline)
    .map((item, index) => {
      if (!isRecord(item)) return null;
      return {
        id: readText(item, ["id", "key"], `event_${index}`),
        label: readText(item, ["label", "title", "event", "status"], `Evento ${index + 1}`),
        detail: readText(item, ["detail", "description", "message", "summary"]),
        timestamp: readText(item, ["timestamp", "created_at", "ts", "date"]),
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
    createdAt: readText(resource, ["created_at", "createdAt", "fecha"]),
    updatedAt: readText(resource, ["updated_at", "updatedAt", "ultima_actividad"]),
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
        createdAt: readText(item, ["created_at", "timestamp", "date"]),
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
    pendingSince: readText(operatorQueue, ["pending_since", "pendingSince"]),
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

export default function TrackingExperiencePage({ kind }: { kind: TrackingKind }) {
  const params = useParams<{ code?: string; nro_ticket?: string; nro_pedido?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const initialFragmentRef = React.useRef(readTrackingFragment(location.hash));
  const credentialsScrubbedRef = React.useRef(false);
  const code = params.code || params.nro_ticket || params.nro_pedido || searchParams.get("code") || "";
  const tenantSlug = searchParams.get("tenant_slug") || searchParams.get("tenant") || null;
  const [accessToken] = useState(
    initialFragmentRef.current.token || searchParams.get("token") || searchParams.get("access_token") || null,
  );
  const [pin, setPin] = useState(initialFragmentRef.current.pin || searchParams.get("pin") || "");
  const [payload, setPayload] = useState<TrackingExperienceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSending, setSupportSending] = useState(false);
  const [supportNotice, setSupportNotice] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] = useState<"idle" | "connecting" | "connected" | "fallback">("idle");
  const [socketAttempt, setSocketAttempt] = useState(0);
  const supportComposerRef = React.useRef<HTMLTextAreaElement | null>(null);
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
    if (hasQueryCredential) {
      setSearchParams(sanitizedParams, { replace: true });
    }
    if (typeof window !== "undefined") {
      const query = sanitizedParams.toString();
      window.history.replaceState(
        window.history.state,
        "",
        `${location.pathname}${query ? `?${query}` : ""}${focusHash}`,
      );
    }
  }, [location.pathname, searchParams, setSearchParams]);

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
  const nextMilestone = milestones[Math.min(currentIndex + 1, Math.max(milestones.length - 1, 0))] ?? null;
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
      setSupportNotice(`Codigo ${trackingCodeLabel} copiado.`);
    } catch {
      setSupportNotice(`No se pudo copiar el codigo. Referencia: ${trackingCodeLabel}`);
    }
  };

  const load = async () => {
    if (!code) return;
    if (requiresPinForLoad) {
      setError("Ingresa el PIN para consultar el estado del reclamo.");
      return;
    }

    setLoading(true);
    setError(null);
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
      setSupportNotice(
        readText(reply, ["message"]) ||
        (support.liveAvailable
          ? "Mensaje enviado al canal en vivo del reclamo."
          : "Mensaje guardado en el reclamo para la mesa de entrada."),
      );
      if (crmWriteback?.unread_for_team || crmWriteback?.inbox_increment) {
        setSupportNotice(
          `${readText(reply, ["message"], "Mensaje guardado en el reclamo.")} El equipo lo ve como pendiente en el CRM.`,
        );
      }
      if (!updatedTracking) await load();
    } catch (err) {
      setSupportNotice(getErrorMessage(err, "No se pudo enviar el mensaje."));
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.12),transparent_34%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.35))] px-4 py-6 text-foreground md:py-10">
      <section className="mx-auto max-w-6xl">
        <div className="mb-6 overflow-hidden rounded-[20px] border border-border/70 bg-card/95 shadow-sm">
          <div className="flex flex-col gap-5 border-b border-border/70 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-normal text-primary">
                {resource.tenantName}
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">{titleFor(kind)}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {kind === "claim" ? "Codigo de reclamo" : "Codigo de pedido"}: <span className="font-semibold text-foreground">{resource.code || code || "-"}</span>
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {kind === "claim" ? (
                <Input
                  value={pin}
                  onChange={(event) => setPin(event.target.value)}
                  placeholder="PIN"
                  className="h-11 rounded-[8px] bg-background/90 text-center font-mono tracking-[0.18em] sm:w-40"
                />
              ) : null}
              <Button onClick={load} disabled={loading || !code} className="h-11 rounded-[8px] font-semibold">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Actualizar
              </Button>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Estado", value: status.label, icon: PackageCheck },
              { label: "Categoria", value: resource.category, icon: FileText },
              { label: "Canal", value: resource.channel, icon: MessagesSquare },
              { label: "Acceso", value: kind === "claim" ? "PIN seguro" : "Link seguro", icon: ShieldCheck },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-[14px] border border-border/70 bg-background/70 p-4">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">{item.label}</p>
                  <p className="mt-1 truncate text-sm font-bold capitalize text-foreground">{item.value || "-"}</p>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border/70 bg-background/70 p-4">
            <OperationalContinuityBar
              testId="tracking-operational-continuity"
              icon={kind === "claim" ? MessageCircle : PackageCheck}
              tone={support.liveAvailable ? "live" : support.enabled ? "warning" : "default"}
              title={kind === "claim" ? "Seguimiento ciudadano activo" : "Pedido con trazabilidad activa"}
              subtitle={
                kind === "claim"
                  ? "El estado, la mesa de ayuda y el historial quedan vinculados al mismo reclamo publico."
                  : "El pedido conserva referencia, estado y proxima accion para continuar sin perder contexto."
              }
              reference={trackingCodeLabel}
              statusLabel={status.label}
              channelLabel={resource.channel || "web"}
              liveLabel={support.enabled ? (support.liveAvailable ? "Atencion en vivo" : "Mesa offline") : "Seguimiento web"}
              slaLabel={support.schedule || (resource.updatedAt ? `Actualizado ${resource.updatedAt}` : "Actualizado")}
              nextActionLabel={
                kind === "claim" && support.enabled
                  ? support.liveAvailable
                    ? "Escribir a mesa de ayuda"
                    : "Dejar mensaje offline"
                  : nextMilestone
                    ? `Siguiente: ${nextMilestone.label}`
                    : "Consultar estado"
              }
              primaryActionLabel={kind === "claim" && support.enabled ? "Ir a mesa de ayuda" : "Actualizar estado"}
              onPrimaryAction={kind === "claim" && support.enabled ? focusSupportComposer : load}
              secondaryActionLabel="Copiar codigo"
              onSecondaryAction={copyTrackingCode}
              metrics={[
                { label: "Estado", value: status.label, tone: "default" },
                { label: "Avance", value: `${progress}%`, tone: progress >= 80 ? "success" : "muted" },
                { label: "Eventos", value: visibleTimeline.length, tone: "muted" },
                { label: "Acceso", value: kind === "claim" ? "PIN" : "Link", tone: "success" },
              ]}
            />
          </div>

          <div
            data-testid="tracking-delivery-rail"
            className="border-t border-border/70 bg-muted/20 p-4"
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    Estado tipo delivery
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">
                    Actual: <span className="capitalize text-foreground">{status.label}</span>
                  </span>
                  {nextMilestone ? (
                    <span className="text-xs font-semibold text-muted-foreground">
                      Siguiente: <span className="capitalize text-foreground">{nextMilestone.label}</span>
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {milestones.slice(0, 6).map((item, index) => {
                    const done = index <= currentIndex;
                    const active = index === currentIndex;
                    return (
                      <div
                        key={`${item.key}-rail`}
                        className={`min-w-0 rounded-[12px] border px-3 py-2 ${
                          active
                            ? "border-primary/35 bg-primary/10 text-primary"
                            : done
                              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
                              : "border-border/70 bg-background/70 text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                              done ? "bg-current/10" : "bg-muted"
                            }`}
                          >
                            {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                          </span>
                          <span className="truncate text-xs font-bold capitalize">{item.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 lg:w-[420px]">
                <Button type="button" variant="outline" className="h-10 rounded-[8px]" onClick={copyTrackingCode}>
                  <Clipboard className="mr-2 h-4 w-4" />
                  Copiar codigo
                </Button>
                {kind === "claim" && support.enabled ? (
                  <Button type="button" className="h-10 rounded-[8px]" onClick={focusSupportComposer}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Escribir mensaje
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-[8px]"
                  onClick={focusMap}
                  disabled={!canShowMap}
                >
                  <MapPinned className="mr-2 h-4 w-4" />
                  Ver mapa
                </Button>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-[12px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="space-y-5">
            <div ref={mapSectionRef} className="rounded-[20px] border border-border/70 bg-card/90 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Estado actual</p>
                  <h2 className="mt-2 text-2xl font-black capitalize tracking-tight">{status.label}</h2>
                  {status.detail ? <p className="mt-2 text-sm text-muted-foreground">{status.detail}</p> : null}
                </div>
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
                  <PackageCheck className="h-6 w-6" />
                </span>
              </div>

              <div className="mt-6 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>Inicio</span>
                <span>{progress}%</span>
                <span>Final</span>
              </div>
            </div>

            <div className="rounded-[20px] border border-border/70 bg-card/90 p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Clipboard className="h-4 w-4 text-primary" />
                <h2 className="font-bold">Resumen</h2>
              </div>
              <div className="space-y-3 text-sm">
                <div className="rounded-[12px] bg-muted/30 p-3">
                  <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Motivo</p>
                  <p className="mt-1 font-semibold text-foreground">{resource.subject || status.label}</p>
                </div>
                {(resource.address || resource.district) ? (
                  <div className="rounded-[12px] bg-muted/30 p-3">
                    <div className="flex items-center gap-1 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      Ubicacion
                    </div>
                    <p className="mt-1 font-semibold text-foreground">{resource.address || "Sin direccion"}</p>
                    {resource.district ? <p className="mt-1 text-xs text-muted-foreground">{resource.district}</p> : null}
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[12px] bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Creado</p>
                    <p className="mt-1 font-semibold text-foreground">{resource.createdAt || "-"}</p>
                  </div>
                  <div className="rounded-[12px] bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Actualizado</p>
                    <p className="mt-1 font-semibold text-foreground">{resource.updatedAt || "Hace instantes"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[20px] border border-border/70 bg-card/90 p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <Route className="h-4 w-4 text-primary" />
                <h2 className="font-bold">Hitos</h2>
              </div>
              <div className="space-y-3">
                {milestones.map((item, index) => {
                  const done = index <= currentIndex;
                  const active = index === currentIndex;
                  return (
                    <div key={item.key} className="grid grid-cols-[28px_1fr] gap-3">
                      <span
                        className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border ${
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_6px_hsl(var(--primary)/0.12)]"
                            : done
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-border bg-muted text-muted-foreground"
                        }`}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 pb-2">
                        <p className="truncate text-sm font-semibold capitalize">{item.label}</p>
                        {active ? <p className="text-xs text-muted-foreground">Paso actual</p> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[20px] border border-border/70 bg-card/90 p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MapPinned className="h-4 w-4 text-primary" />
                  <h2 className="font-bold">Mapa y recorrido</h2>
                </div>
                <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground">
                  {canShowMap ? "mapa activo" : "timeline"}
                </span>
              </div>

              {canShowMap ? (
                <div className="relative overflow-hidden rounded-[16px] border border-border/70 bg-slate-950 p-1">
                  <React.Suspense fallback={<div className="flex h-[340px] items-center justify-center rounded-[14px] bg-muted/30 text-sm text-muted-foreground">Cargando mapa...</div>}>
                    <TrackingMap
                      className="h-[340px] border-0"
                      status={status.key}
                      storeLocation={mapState.origin}
                      customerLocation={mapState.destination}
                      driverLocation={mapState.current || undefined}
                    />
                  </React.Suspense>
                  <div className="pointer-events-none absolute inset-1 rounded-[14px] bg-[linear-gradient(90deg,rgba(59,130,246,0.12)_1px,transparent_1px),linear-gradient(180deg,rgba(59,130,246,0.12)_1px,transparent_1px)] bg-[size:32px_32px]" />
                  <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/25 bg-slate-950/70 px-3 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur">
                    Trazabilidad activa
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[14px] border border-dashed border-border/70 bg-muted/30 p-6 text-center">
                  <ShieldCheck className="mb-3 h-8 w-8 text-primary" />
                  <p className="font-semibold">Seguimiento por timeline</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    No hay coordenadas renderizables para este caso.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-[20px] border border-border/70 bg-card/90 p-5 shadow-sm">
              <h2 className="mb-4 font-bold">Timeline</h2>
              <div className="space-y-4">
                {visibleTimeline.map((event) => (
                  <div key={event.id} className="grid grid-cols-[20px_1fr] gap-3">
                    <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_0_5px_hsl(var(--primary)/0.12)]" />
                    <div className="min-w-0 border-b border-border/60 pb-3 last:border-b-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{event.label}</p>
                        {event.timestamp ? <span className="text-xs text-muted-foreground">{event.timestamp}</span> : null}
                      </div>
                      {event.detail ? <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {kind === "claim" && support.enabled ? (
              <div id="mesa-ayuda" className="rounded-[20px] border border-border/70 bg-card/95 p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-10 w-10 items-center justify-center rounded-[12px] ${
                          support.liveAvailable ? "bg-emerald-500/12 text-emerald-600" : "bg-amber-500/12 text-amber-600"
                        }`}
                      >
                        {support.liveAvailable ? <Radio className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Mesa de ayuda
                        </p>
                        <h2 className="text-xl font-black tracking-tight">{support.label}</h2>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{support.description}</p>
                    {support.schedule ? (
                      <p className="mt-2 text-xs font-semibold text-foreground/75">Horario: {support.schedule}</p>
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

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-[14px] border border-border/70 bg-muted/30 p-4">
                    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-bold">Sin salir del seguimiento</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {support.stayInsideTracking
                        ? "La conversacion queda dentro de este reclamo y mantiene el PIN seguro."
                        : "Puede requerir una accion externa configurada por el tenant."}
                    </p>
                  </div>
                  <div className="rounded-[14px] border border-border/70 bg-muted/30 p-4">
                    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                      {support.liveAvailable ? <Radio className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                    </div>
                    <p className="text-sm font-bold">{support.liveAvailable ? "Atencion inmediata" : "Cola offline activa"}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {support.offlineQueue
                        ? "El mensaje queda en la bandeja del reclamo para respuesta administrativa."
                        : "Un operador puede tomar esta conversacion en tiempo real."}
                    </p>
                  </div>
                  <div className="rounded-[14px] border border-border/70 bg-muted/30 p-4">
                    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                      <MessageCircle className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-bold">{support.adminSurfaceLabel}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      El equipo responde desde el CRM del municipio, asociado a este ticket.
                    </p>
                  </div>
                </div>

                <div
                  data-testid="tracking-helpdesk-operational-state"
                  className="mt-5 flex flex-wrap items-center gap-2 rounded-[14px] border border-border/70 bg-background/70 p-3 text-xs font-semibold text-muted-foreground"
                >
                  <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                    {support.noExternalRedirectLabel}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-foreground">
                    <MessageCircle className="h-3.5 w-3.5 text-primary" />
                    {support.channelBindingLabel}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-foreground">
                    {support.liveAvailable ? <Radio className="h-3.5 w-3.5 text-primary" /> : <Clock3 className="h-3.5 w-3.5 text-amber-500" />}
                    {support.responseExpectationLabel}
                  </span>
                  {support.pollingLabel ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-foreground">
                      <RefreshCw className="h-3.5 w-3.5 text-sky-500" />
                      {support.pollingLabel}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1.5">
                    {realtimeState === "connected"
                      ? "Canal en vivo conectado"
                      : realtimeState === "connecting"
                        ? "Conectando canal en vivo"
                        : realtimeState === "fallback"
                          ? "Actualizacion automatica de respaldo"
                          : support.operationalStateLabel}
                  </span>
                </div>

                <div
                  data-testid="tracking-helpdesk-queue"
                  className={`mt-5 rounded-[16px] border p-4 ${
                    support.hasPendingCustomerMessage
                      ? "border-amber-500/30 bg-amber-500/10"
                      : "border-emerald-500/25 bg-emerald-500/10"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${
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

                <div className="mt-5 space-y-3">
                  {support.messages.length ? (
                    support.messages.map((item) => (
                      <div
                        key={item.id}
                        className={`max-w-[86%] rounded-[14px] px-4 py-3 text-sm shadow-sm ${
                          item.isTeam
                            ? "mr-auto border border-border/70 bg-muted/50 text-foreground"
                            : "ml-auto bg-primary text-primary-foreground"
                        }`}
                      >
                        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] opacity-75">
                          <MessageCircle className="h-3.5 w-3.5" />
                          <span>{item.isTeam ? "Equipo" : "Tu mensaje"}</span>
                        </div>
                        <p className="leading-6">{item.message}</p>
                        {item.createdAt ? <p className="mt-2 text-xs opacity-70">{item.createdAt}</p> : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[14px] border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                      Todavia no hay mensajes publicos en este reclamo.
                    </div>
                  )}
                </div>

                <div className="mt-5 rounded-[16px] border border-border/70 bg-background/80 p-3">
                  <textarea
                    ref={supportComposerRef}
                    value={supportMessage}
                    onChange={(event) => setSupportMessage(event.target.value)}
                    placeholder={support.liveAvailable ? "Escribi para hablar con la mesa de ayuda..." : "Deja tu mensaje offline para este reclamo..."}
                    className="min-h-[96px] w-full resize-none bg-transparent p-2 text-sm outline-none placeholder:text-muted-foreground"
                    disabled={supportSending || !support.endpoint}
                  />
                  <div className="flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      {support.requiresPin ? "El PIN mantiene la conversacion asociada a este reclamo." : "Mensaje asociado al seguimiento."}
                      {support.pollingInterval ? ` Actualizacion cada ${Number(support.pollingInterval) / 1000 || support.pollingInterval}s.` : ""}
                    </p>
                    <Button
                      onClick={handleSendSupportMessage}
                      disabled={supportSending || !supportMessage.trim() || !support.endpoint || requiresPinForSupport}
                      className="h-10 rounded-[8px] font-semibold"
                    >
                      {supportSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {support.primaryCtaLabel}
                    </Button>
                  </div>
                </div>
                {supportNotice ? (
                  <div className="mt-3 rounded-[12px] border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    {supportNotice}
                  </div>
                ) : null}
              </div>
            ) : null}

            {requestId ? (
              <div className="rounded-[12px] border border-border/70 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                Request ID: <span className="font-mono text-foreground">{requestId}</span>
              </div>
            ) : null}
          </section>
        </div>

        <div className="mt-8 flex justify-center">
          <Button variant="outline" className="rounded-[8px]" onClick={() => window.history.back()}>
            <ArrowRight className="mr-2 h-4 w-4 rotate-180" />
            Volver
          </Button>
        </div>
      </section>
    </main>
  );
}
