import { describe, expect, it } from "vitest";
import {
  getRealtimeVoiceBadges,
  getRealtimeVoiceRequestModel,
  getRealtimeVoiceStarters,
  getRealtimeVoiceToolLabels,
  isRealtimeVideoRenderable,
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

  it("defaults session requests to gpt-realtime only when realtime capabilities exist", () => {
    expect(getRealtimeVoiceRequestModel(null, "")).toBeUndefined();
    expect(getRealtimeVoiceRequestModel({ enabled: true }, "")).toBe("gpt-realtime");
    expect(
      getRealtimeVoiceRequestModel(
        { enabled: true, recommended_model: "gpt-realtime-mini" },
        "legacy-model",
      ),
    ).toBe("gpt-realtime-mini");
  });

  it("does not expose video unless backend explicitly publishes live visual readiness", () => {
    const capabilities = {
      contract_version: "realtime.voice_capabilities.v1",
      features: { tool_calling: true },
    };

    expect(isRealtimeVideoRenderable(capabilities, { enabled: true })).toBe(false);
    expect(
      isRealtimeVideoRenderable(
        { ...capabilities, features: { tool_calling: true, live_video_analysis: true } },
        { enabled: true },
      ),
    ).toBe(true);
    expect(
      isRealtimeVideoRenderable(
        capabilities,
        { enabled: true, features: { analysis_ready: true } },
        { videoEnabled: true },
      ),
    ).toBe(true);
    expect(
      isRealtimeVideoRenderable(
        { ...capabilities, features: { tool_calling: true, live_video_analysis: true } },
        { enabled: true },
        { videoEnabled: false },
      ),
    ).toBe(false);
  });

  it("renders operational tool labels only from backend-published contracts", () => {
    expect(
      getRealtimeVoiceToolLabels({
        tools: [
          { id: "create_claim", label: "Crear reclamo" },
          { id: "create_claim_duplicate", label: "Crear reclamo" },
          { id: "hidden", label: "Oculto", enabled: false },
        ],
        tool_catalog: {
          check_status: { title: "Consultar estado" },
          raw_boolean_tool: true,
        },
      }),
    ).toEqual(["Crear reclamo", "Consultar estado"]);
    expect(getRealtimeVoiceToolLabels({ active_vertical: "municipio" })).toEqual([]);
  });
});
