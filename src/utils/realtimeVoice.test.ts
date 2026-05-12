import { describe, expect, it } from "vitest";
import {
  getRealtimeVoiceBadges,
  getRealtimeVoiceStarters,
  isRealtimeVoiceRenderable,
} from "./realtimeVoice";

describe("realtime voice contract helpers", () => {
  it("requires backend capabilities and enabled voice_call for the public CTA", () => {
    const capabilities = {
      contract_version: "realtime.voice_capabilities.v1",
      features: { tool_calling: true },
    };

    expect(isRealtimeVoiceRenderable(capabilities, null)).toBe(false);
    expect(isRealtimeVoiceRenderable(capabilities, { enabled: false })).toBe(false);
    expect(isRealtimeVoiceRenderable(capabilities, { enabled: true })).toBe(true);
  });

  it("does not render voice when backend explicitly disables it", () => {
    expect(
      isRealtimeVoiceRenderable(
        {
          enabled: false,
          features: { tool_calling: true },
          reason_code: "voice_not_enabled",
        },
        { enabled: true },
      ),
    ).toBe(false);
  });

  it("does not render voice when tool calling is unavailable", () => {
    expect(
      isRealtimeVoiceRenderable(
        {
          enabled: true,
          features: { tool_calling: false },
        },
        { enabled: true },
      ),
    ).toBe(false);
  });

  it("keeps badges and starters backend-first", () => {
    expect(
      getRealtimeVoiceBadges({
        badge_labels: ["Voz nativa", "Resumen operativo"],
        native_speech_to_speech: true,
        features: { human_handoff: true },
      }),
    ).toEqual(["Voz nativa", "Resumen operativo"]);

    expect(
      getRealtimeVoiceStarters({
        starter_messages: ["Consultar disponibilidad", "Hablar con ventas"],
      }),
    ).toEqual(["Consultar disponibilidad", "Hablar con ventas"]);

    expect(getRealtimeVoiceStarters({ active_vertical: "pyme" })).toEqual([]);
  });
});
