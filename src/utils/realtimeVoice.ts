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
  options: { allowCapabilitiesOnly?: boolean } = {},
) => {
  if (!capabilities || capabilities.enabled === false) return false;

  const toolCalling = boolish(capabilities.features?.tool_calling);
  const voiceCallEnabled = boolish(voiceCall?.enabled);

  if (voiceCall) {
    return voiceCallEnabled && toolCalling;
  }

  return Boolean(options.allowCapabilitiesOnly && toolCalling);
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

  const features = capabilities?.features ?? {};
  const videoFeatures = videoCall.features ?? {};

  return [
    features.live_video_analysis,
    features.video_analysis_ready,
    features.multimodal_capture,
    videoFeatures.live_video_analysis,
    videoFeatures.video_analysis_ready,
    videoFeatures.analysis_ready,
    videoFeatures.multimodal_capture,
    videoFeatures.visual_capture,
    realtimeConfig?.liveVideoAnalysis,
  ].some(boolish);
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

  const features = capabilities?.features ?? {};
  const badges: string[] = [];

  if (boolish(capabilities?.native_speech_to_speech)) {
    badges.push("Voz en tiempo real");
  }
  if (boolish(features.barge_in)) {
    badges.push("Interrupciones naturales");
  }
  if (boolish(features.post_call_receipt) || boolish(features.whatsapp_followup)) {
    badges.push("Resumen por WhatsApp");
  }
  if (boolish(features.human_handoff)) {
    badges.push("Derivacion humana");
  }

  return badges;
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

export const getRealtimeVoiceToolLabels = (
  capabilities?: RealtimeVoiceCapabilities | null,
) => {
  const seen = new Set<string>();
  const labels = [
    ...collectToolLabels(capabilities?.tools),
    ...collectToolLabels(capabilities?.tool_catalog),
    ...collectToolLabels(capabilities?.actions),
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
