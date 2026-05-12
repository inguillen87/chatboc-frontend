import type { RealtimeVoiceCapabilities } from "@/types/realtimeVoice";

export interface RealtimeVoiceSupportConfig {
  enabled?: boolean | null;
  capabilities?: RealtimeVoiceCapabilities | null;
  [key: string]: unknown;
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
