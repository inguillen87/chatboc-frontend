import type { RealtimeVoiceCapabilities } from "@/types/realtimeVoice";

export interface RealtimeVoiceSupportConfig {
  enabled?: boolean | null;
  capabilities?: RealtimeVoiceCapabilities | null;
  [key: string]: unknown;
}

export interface RealtimeVideoSupportConfig extends RealtimeVoiceSupportConfig {
  features?: {
    live_video_analysis?: string | number | boolean | null;
    video_analysis_ready?: string | number | boolean | null;
    analysis_ready?: string | number | boolean | null;
    multimodal_capture?: string | number | boolean | null;
    visual_capture?: string | number | boolean | null;
    [key: string]: string | number | boolean | null | undefined;
  } | null;
}

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

export const isRealtimeVoiceRenderable = (
  capabilities?: RealtimeVoiceCapabilities | null,
  voiceCall?: RealtimeVoiceSupportConfig | null,
  options: { allowCapabilitiesOnly?: boolean; voiceEnabled?: unknown } = {},
) => {
  if (capabilities?.enabled === false) return false;
  if (options.voiceEnabled !== undefined && !boolish(options.voiceEnabled)) return false;

  const publishedVoiceCall = voiceCall ?? capabilities?.support_channels?.voice_call ?? null;
  const voiceCallEnabled = boolish(publishedVoiceCall?.enabled);

  if (publishedVoiceCall) {
    return voiceCallEnabled;
  }

  return Boolean(options.allowCapabilitiesOnly && boolish(capabilities?.features?.tool_calling));
};

const firstText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

export const getRealtimeVoiceRequestModel = (
  capabilities?: RealtimeVoiceCapabilities | null,
  ...fallbacks: unknown[]
) => {
  return (
    firstText(capabilities?.recommended_model, ...fallbacks) ||
    (capabilities ? "gpt-realtime" : undefined)
  );
};

export const isRealtimeVideoRenderable = (
  capabilities?: RealtimeVoiceCapabilities | null,
  videoCall?: RealtimeVideoSupportConfig | null,
  realtimeConfig?: { videoEnabled?: unknown; liveVideoAnalysis?: unknown } | null,
) => {
  if (!videoCall || !boolish(videoCall.enabled)) return false;
  if (realtimeConfig && !boolish(realtimeConfig.videoEnabled ?? true)) return false;
  if (capabilities?.enabled === false) return false;
  return true;
};

export const getRealtimeVoiceBadges = (capabilities?: RealtimeVoiceCapabilities | null) => {
  const backendBadges = [
    capabilities?.trust_badges,
    capabilities?.badges,
    capabilities?.badge_labels,
  ];

  for (const candidate of backendBadges) {
    if (!Array.isArray(candidate)) continue;
    const normalized = candidate
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (!item || typeof item !== "object") return "";
        return (item.label || item.text || "").trim();
      })
      .filter((item) => item.length > 0);
    if (normalized.length) return normalized;
  }

  return [];
};

const collectToolLabels = (
  source:
    | RealtimeVoiceCapabilities["tools"]
    | RealtimeVoiceCapabilities["tool_catalog"]
    | RealtimeVoiceCapabilities["actions"]
    | undefined,
) => {
  const entries = Array.isArray(source)
    ? source.map((item) => [undefined, item] as const)
    : source && typeof source === "object"
      ? Object.entries(source)
      : [];

  return entries
    .map(([fallbackKey, value]) => {
      if (value === false || value === null || value === undefined) return "";
      if (typeof value === "string") return value.trim();
      if (value === true) return "";
      if (typeof value !== "object") return "";
      if (value.enabled === false) return "";
      return firstText(value.label, value.title, value.name, value.id, fallbackKey);
    })
    .filter((item) => item.length > 0);
};

const collectVerticalToolLabels = (verticals: RealtimeVoiceCapabilities["verticals"]) => {
  if (!verticals || typeof verticals !== "object") return [];

  return Object.values(verticals).flatMap((vertical) => {
    if (!vertical || typeof vertical !== "object") return [];
    return [
      ...collectToolLabels(vertical.actions),
      ...collectToolLabels(vertical.tools),
      ...collectToolLabels(vertical.tool_catalog),
    ];
  });
};

export const getRealtimeVoiceToolLabels = (
  capabilities?: RealtimeVoiceCapabilities | null,
) => {
  const seen = new Set<string>();
  const labels = [
    ...collectToolLabels(capabilities?.tools),
    ...collectToolLabels(capabilities?.tool_catalog),
    ...collectToolLabels(capabilities?.actions),
    ...collectVerticalToolLabels(capabilities?.verticals),
  ];

  return labels.filter((label) => {
    const normalized = label.toLowerCase();
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

export const getRealtimeVoiceStarters = (capabilities?: RealtimeVoiceCapabilities | null) => {
  const candidates = [
    capabilities?.starter_messages,
    capabilities?.voice_starters,
    capabilities?.starters,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const normalized = candidate
        .map((item) => (typeof item === "string" && item.trim() ? item.trim() : null))
        .filter((item): item is string => Boolean(item));
      if (normalized.length) return normalized;
    }
  }

  return [];
};

export type RealtimeSessionState = "idle" | "connecting" | "live" | "reconnecting" | "ended";
export type RealtimeNetworkLatency = "good" | "unstable";

export const getRealtimeModeLabel = (mode: "voice" | "video") =>
  mode === "video" ? "Canal visual" : "Llamada";

export const getRealtimeNetworkLabel = (latency?: RealtimeNetworkLatency | null) =>
  latency === "unstable" ? "Conexion inestable" : "Conexion estable";

export const getRealtimeMicLabel = (options: {
  isMicMuted?: boolean | null;
  isUserSpeaking?: boolean | null;
}) => {
  if (options.isMicMuted) return "Silenciado";
  if (options.isUserSpeaking) return "Escuchando";
  return "Listo";
};

export const getRealtimeSessionStatusLabel = (
  state?: RealtimeSessionState | null,
  options: {
    isMicMuted?: boolean | null;
    isUserSpeaking?: boolean | null;
    assistantSpeaking?: boolean | null;
  } = {},
) => {
  if (options.isMicMuted && state === "live") return "Pausada";
  if (options.isUserSpeaking && state === "live") return "Escuchando";
  if (options.assistantSpeaking && state === "live") return "Procesando";

  switch (state) {
    case "connecting":
      return "Conectando";
    case "live":
      return "Escuchando";
    case "reconnecting":
      return "Reconectando";
    case "ended":
      return "Finalizada";
    case "idle":
    default:
      return "Lista";
  }
};

export const getRealtimeTimelineLabel = (message?: string | null) => {
  const raw = typeof message === "string" ? message.trim() : "";
  if (!raw) return "";
  const normalized = raw.toLowerCase();

  if (normalized.startsWith("registrando:")) return "Registrando";
  if (normalized.startsWith("confirmado:")) return "Registro confirmado";
  if (normalized.startsWith("pendiente:")) return "Confirmacion pendiente";
  if (normalized.includes("comprobante")) return "Comprobante enviado";
  if (normalized.includes("voice_not_enabled")) return "Llamada no disponible";
  if (normalized.includes("video_unavailable") || normalized.includes("video_fallback")) {
    return "Cambiando a llamada";
  }
  if (normalized.includes("failed") || normalized.includes("error") || normalized.includes("400")) {
    return "No se pudo iniciar la llamada";
  }
  if (normalized.includes("->")) return "Cambio de canal";
  if (/^(rt_|req_|sess_|session_|client_secret)/.test(normalized)) return "Escuchando";

  return raw;
};
