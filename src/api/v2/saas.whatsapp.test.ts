import { describe, expect, it } from "vitest";
import { normalizeWhatsappExperienceV2 } from "./saas";

describe("normalizeWhatsappExperienceV2", () => {
  it("keeps whatsapp operations contract fields available to the UI", () => {
    const normalized = normalizeWhatsappExperienceV2({
      contract_version: "whatsapp.experience.v1",
      request_id: "req_whatsapp",
      tenant: { slug: "colegio-demo", vertical: "educacion" },
      channel: {
        provider: "twilio_whatsapp",
        enabled: true,
        number: "whatsapp:+100",
      },
      conversation_intelligence: {
        inputs: {
          text: { enabled: true },
          video: { enabled: true, analysis_ready: false },
        },
        voice_calls: {
          enabled: true,
          capabilities: {
            contract_version: "realtime.voice_capabilities.v1",
            recommended_model: "gpt-realtime",
            native_speech_to_speech: true,
          },
        },
      },
      content_modules: {
        catalog: {
          enabled: true,
          image_coverage_rate: 72,
          endpoint: "/api/admin/tenants/colegio-demo/catalog/items",
        },
      },
      tracking: {
        courier_style_map: {
          enabled: true,
          render_contract: {
            fallback_when_no_coordinates: "timeline_only",
          },
        },
        milestones: {
          claim: ["recibido", "validando"],
        },
      },
      frontend_contract: {
        render_as: "whatsapp_operations_hub",
      },
    });

    expect(normalized.contract_version).toBe("whatsapp.experience.v1");
    expect(normalized.channel.enabled).toBe(true);
    expect(normalized.conversation_intelligence.voice_calls?.enabled).toBe(true);
    expect(normalized.conversation_intelligence.voice_calls?.capabilities?.recommended_model).toBe("gpt-realtime");
    expect(normalized.content_modules.catalog.image_coverage_rate).toBe(72);
    expect((normalized.tracking.milestones as any).claim).toEqual(["recibido", "validando"]);
  });
});
