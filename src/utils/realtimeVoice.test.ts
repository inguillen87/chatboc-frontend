import { describe, expect, it } from "vitest";
import {
  getRealtimeVoiceBadges,
  getRealtimeMicLabel,
  getRealtimeModeLabel,
  getRealtimeNetworkLabel,
  getRealtimeVoiceRequestModel,
  getRealtimeVoiceStarters,
  getRealtimeVoiceToolLabels,
  getRealtimeSessionStatusLabel,
  getRealtimeTimelineLabel,
  hasConnectedRealtimeVoiceTransport,
  isRealtimeVideoRenderable,
  isRealtimeVoiceRenderable,
} from "./realtimeVoice";

describe("realtime voice contract helpers", () => {
  it("requires backend capabilities and enabled voice_call for the public CTA", () => {
    const capabilities = {
      contract_version: "realtime.voice_capabilities.v1",
      features: { tool_calling: false },
    };

    expect(isRealtimeVoiceRenderable(capabilities, null)).toBe(false);
    expect(isRealtimeVoiceRenderable(capabilities, { enabled: false })).toBe(false);
    expect(isRealtimeVoiceRenderable(capabilities, { enabled: true })).toBe(true);
    expect(
      isRealtimeVoiceRenderable(capabilities, { enabled: true }, { voiceEnabled: false }),
    ).toBe(false);
  });

  it("accepts voice_call gating from the standalone voice-capabilities contract", () => {
    expect(
      isRealtimeVoiceRenderable({
        contract_version: "realtime.voice_capabilities.v1",
        features: { tool_calling: true },
        support_channels: {
          voice_call: {
            enabled: true,
            channel: "voice_call",
            provider: "openai_realtime",
            session_endpoint: "/api/public/realtime/session",
          },
        },
      }),
    ).toBe(true);

    expect(
      isRealtimeVoiceRenderable({
        contract_version: "realtime.voice_capabilities.v1",
        features: { tool_calling: true },
        support_channels: { voice_call: { enabled: false } },
      }),
    ).toBe(false);
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

  it("renders voice from support_channels even when tool labels are unavailable", () => {
    expect(
      isRealtimeVoiceRenderable(
        {
          enabled: true,
          features: { tool_calling: false },
        },
        { enabled: true },
      ),
    ).toBe(true);
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
      getRealtimeVoiceBadges({
        native_speech_to_speech: true,
        features: { human_handoff: true, post_call_receipt: true },
      }),
    ).toEqual([]);

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

  it("exposes video when backend publishes video_call as enabled", () => {
    const capabilities = {
      contract_version: "realtime.voice_capabilities.v1",
      features: { tool_calling: true },
    };

    expect(isRealtimeVideoRenderable(capabilities, { enabled: true })).toBe(true);
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

  it("reads realtime actions published by vertical contracts", () => {
    expect(
      getRealtimeVoiceToolLabels({
        verticals: {
          general: {
            actions: [
              {
                id: "registrar_solicitud_operativa",
                label: "Registrar solicitud",
              },
              {
                id: "capturar_lead_comercial",
                label: "Solicitud comercial",
              },
            ],
          },
          pyme: {
            actions: {
              crear_pedido: { label: "Crear pedido", enabled: true },
              hidden: { label: "Oculto", enabled: false },
            },
          },
        },
      }),
    ).toEqual(["Registrar solicitud", "Solicitud comercial", "Crear pedido"]);
  });

  it("keeps realtime call UI states human and non-technical", () => {
    expect(getRealtimeModeLabel("voice")).toBe("Llamada");
    expect(getRealtimeModeLabel("video")).toBe("Canal visual");
    expect(getRealtimeNetworkLabel("good")).toBe("Conexion estable");
    expect(getRealtimeMicLabel({ isUserSpeaking: true })).toBe("Escuchando");
    expect(getRealtimeSessionStatusLabel("live", { assistantSpeaking: true })).toBe("Procesando");
    expect(getRealtimeTimelineLabel("registrando:create_claim")).toBe("Registrando");
    expect(getRealtimeTimelineLabel("confirmado:create_claim")).toBe("Registro confirmado");
    expect(getRealtimeTimelineLabel("rt_123456")).toBe("Escuchando");
    expect(getRealtimeTimelineLabel("video_fallback_voice")).toBe("Cambiando a llamada");
    expect(getRealtimeTimelineLabel("realtime_trial_limit_reached")).toBe("Limite de demo alcanzado");
    expect(getRealtimeTimelineLabel("realtime_transport_not_connected")).toBe(
      "La llamada no se conectó. Podés seguir por chat.",
    );
  });

  it("does not treat a provisioned session or a partial peer as a live voice call", () => {
    const liveAudio = { kind: "audio", readyState: "live" };

    expect(hasConnectedRealtimeVoiceTransport(null)).toBe(false);
    expect(hasConnectedRealtimeVoiceTransport({ connectionState: "connected" })).toBe(false);
    expect(
      hasConnectedRealtimeVoiceTransport({
        connectionState: "connecting",
        getSenders: () => [{ track: liveAudio }],
        getReceivers: () => [{ track: liveAudio }],
      }),
    ).toBe(false);
    expect(
      hasConnectedRealtimeVoiceTransport({
        connectionState: "connected",
        getSenders: () => [{ track: liveAudio }],
        getReceivers: () => [],
      }),
    ).toBe(false);
  });

  it("allows live state only for a connected peer with duplex live audio", () => {
    expect(
      hasConnectedRealtimeVoiceTransport({
        connectionState: "connected",
        getSenders: () => [{ track: { kind: "audio", readyState: "live" } }],
        getReceivers: () => [{ track: { kind: "audio", readyState: "live" } }],
      }),
    ).toBe(true);
  });
});
