import React, { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
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
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/utils/api";

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

const normalizeSupport = (payload: TrackingExperienceResponse | null) => {
  const support = isRecord(payload?.support) ? payload.support : null;
  const liveChat = isRecord(support?.live_chat) ? support.live_chat : {};
  const availability = isRecord(support?.availability) ? support.availability : {};
  const ticket = isRecord(support?.ticket) ? support.ticket : {};
  const endpoints = isRecord(support?.endpoints) ? support.endpoints : {};
  const conversation = isRecord(support?.conversation) ? support.conversation : {};
  const serviceWindow = isRecord(support?.service_window) ? support.service_window : {};
  const webviewPolicy = isRecord(support?.webview_policy) ? support.webview_policy : {};
  const adminSurface = isRecord(support?.admin_response_surface) ? support.admin_response_surface : {};
  const polling = isRecord(support?.polling) ? support.polling : {};
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

  return {
    enabled: support?.enabled !== false && Boolean(support),
    mode: normalizedMode,
    label: readText(availability, ["label"], "Mesa de ayuda"),
    description: readText(availability, ["description"], "Deja un mensaje asociado a este seguimiento."),
    liveAvailable,
    acceptsMessages: serviceWindow.accepts_messages !== false,
    offlineQueue: Boolean(serviceWindow.offline_queue_enabled),
    stayInsideTracking: webviewPolicy.stay_inside_tracking !== false,
    adminSurfaceLabel: readText(adminSurface, ["label"], "Inbox de reclamos"),
    nextAction: readText(serviceWindow, ["next_action"], primaryCtaAction),
    primaryCtaLabel: readText(
      primaryCta,
      ["label", "title", "text"],
      liveAvailable ? "Chatear con un agente" : "Dejar mensaje para el equipo",
    ),
    primaryCtaAction,
    pollingInterval: readText(polling, ["interval_ms"]),
    schedule: readText(serviceWindow, ["schedule_label"]) || readText(liveChat, ["description"]) || (
      readText(liveChat, ["start_time"]) && readText(liveChat, ["end_time"])
        ? `${readText(liveChat, ["start_time"])} a ${readText(liveChat, ["end_time"])}`
        : ""
    ),
    endpoint: readText(endpoints, ["send_message"]),
    ticketId: readText(ticket, ["id"]),
    requiresPin: ticket.requires_pin !== false,
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

export default function TrackingExperiencePage({ kind }: { kind: TrackingKind }) {
  const params = useParams<{ code?: string; nro_ticket?: string; nro_pedido?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const code = params.code || params.nro_ticket || params.nro_pedido || searchParams.get("code") || "";
  const tenantSlug = searchParams.get("tenant_slug") || searchParams.get("tenant") || null;
  const [pin, setPin] = useState(searchParams.get("pin") || "");
  const [payload, setPayload] = useState<TrackingExperienceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSending, setSupportSending] = useState(false);
  const [supportNotice, setSupportNotice] = useState<string | null>(null);

  const status = normalizeStatus(payload);
  const resource = normalizeResource(payload, code);
  const milestones = normalizeMilestones(payload, kind);
  const timeline = normalizeTimeline(payload);
  const mapState = normalizeMapLocations(payload);
  const support = normalizeSupport(payload);
  const currentIndex = Math.max(
    0,
    milestones.findIndex((item) => item.key.toLowerCase() === status.key.toLowerCase()),
  );
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
        tenantSlug,
      });
      setPayload(nextPayload);
      if (pin.trim()) {
        const next = new URLSearchParams(searchParams);
        next.set("pin", pin.trim());
        setSearchParams(next, { replace: true });
      }
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

  React.useEffect(() => {
    if (!code || requiresPinForLoad) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, kind]);

  React.useEffect(() => {
    if (!payload || !supportPollingMs || !support.endpoint || requiresPinForSupport) return;
    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      if (supportSending) return;
      void load();
    }, supportPollingMs);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, supportPollingMs, support.endpoint, requiresPinForSupport, supportSending]);

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
            <div className="rounded-[20px] border border-border/70 bg-card/90 p-5 shadow-sm">
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
              <div className="rounded-[20px] border border-border/70 bg-card/95 p-5 shadow-sm">
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
