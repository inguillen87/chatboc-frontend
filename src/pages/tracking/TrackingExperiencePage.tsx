import React, { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPinned,
  MessageCircle,
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

const normalizeSupport = (payload: TrackingExperienceResponse | null) => {
  const support = isRecord(payload?.support) ? payload.support : null;
  const liveChat = isRecord(support?.live_chat) ? support.live_chat : {};
  const availability = isRecord(support?.availability) ? support.availability : {};
  const ticket = isRecord(support?.ticket) ? support.ticket : {};
  const endpoints = isRecord(support?.endpoints) ? support.endpoints : {};
  const conversation = isRecord(support?.conversation) ? support.conversation : {};
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

  return {
    enabled: support?.enabled !== false && Boolean(support),
    mode: readText(support, ["mode"], "offline"),
    label: readText(availability, ["label"], "Mesa de ayuda"),
    description: readText(availability, ["description"], "Deja un mensaje asociado a este seguimiento."),
    liveAvailable: Boolean(liveChat.enabled && liveChat.available),
    schedule: readText(liveChat, ["description"]) || (
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
    if (!message || !support.endpoint || !pin.trim()) return;
    setSupportSending(true);
    setSupportNotice(null);
    try {
      await sendTrackingSupportMessage({
        endpoint: support.endpoint,
        pin: pin.trim(),
        message,
        code,
      });
      setSupportMessage("");
      setSupportNotice(
        support.liveAvailable
          ? "Mensaje enviado al canal en vivo del reclamo."
          : "Mensaje guardado en el reclamo para la mesa de entrada.",
      );
      await load();
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
    <main className="min-h-screen bg-background px-4 py-10 text-foreground md:py-16">
      <section className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 rounded-[20px] border border-border/70 bg-card/90 p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              {payload?.contract_version || "tracking.experience.v1"}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">{titleFor(kind)}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {kind === "claim" ? "Codigo de reclamo" : "Codigo de pedido"}: <span className="font-semibold text-foreground">{code || "-"}</span>
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {kind === "claim" ? (
              <Input
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                placeholder="PIN"
                className="h-11 rounded-[8px] sm:w-36"
              />
            ) : null}
            <Button onClick={load} disabled={loading || !code} className="h-11 rounded-[8px] font-semibold">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Actualizar
            </Button>
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
                <React.Suspense fallback={<div className="flex h-[340px] items-center justify-center rounded-[14px] bg-muted/30 text-sm text-muted-foreground">Cargando mapa...</div>}>
                  <TrackingMap
                    className="h-[340px]"
                    status={status.key}
                    storeLocation={mapState.origin}
                    customerLocation={mapState.destination}
                    driverLocation={mapState.current || undefined}
                  />
                </React.Suspense>
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
                  <span className="inline-flex items-center rounded-full border border-border/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
                    Ticket #{support.ticketId || code}
                  </span>
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
                    placeholder={support.liveAvailable ? "Escribi para hablar con la mesa de ayuda..." : "Deja una observacion para el equipo..."}
                    className="min-h-[96px] w-full resize-none bg-transparent p-2 text-sm outline-none placeholder:text-muted-foreground"
                    disabled={supportSending || !support.endpoint}
                  />
                  <div className="flex flex-col gap-2 border-t border-border/70 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      {support.requiresPin ? "El PIN mantiene la conversacion asociada a este reclamo." : "Mensaje asociado al seguimiento."}
                    </p>
                    <Button
                      onClick={handleSendSupportMessage}
                      disabled={supportSending || !supportMessage.trim() || !support.endpoint || requiresPinForSupport}
                      className="h-10 rounded-[8px] font-semibold"
                    >
                      {supportSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                      {support.liveAvailable ? "Enviar al vivo" : "Guardar mensaje"}
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
