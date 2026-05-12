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
        test_endpoint: "/api/v2/whatsapp/experience/test",
        test_method: "POST",
        test_label: "Enviar prueba",
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
          bulk_import_endpoint: "/api/admin/catalogo/importar",
        },
        surveys_votings: {
          enabled: true,
          endpoint: "/api/v2/surveys",
          draft_endpoint: "/api/v2/surveys/draft",
        },
      },
      tracking: {
        claims: {
          experience_endpoint:
            "/api/public/tracking/experience?kind=claim&code={code}&pin={pin}",
        },
        orders: {
          experience_endpoint:
            "/api/public/tracking/experience?kind=order&code={code}",
          payment_status_endpoint: "/api/v2/payments/status",
        },
        courier_style_map: {
          enabled: true,
          render_contract: {
            layers: ["origin", "current_status", "timeline_events"],
            animations: ["pulse_current_step", "route_progress"],
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
    expect(normalized.request_id).toBe("req_whatsapp");
    expect(normalized.channel.enabled).toBe(true);
    expect(normalized.channel.test_endpoint).toBe("/api/v2/whatsapp/experience/test");
    expect(normalized.channel.test_label).toBe("Enviar prueba");
    expect(normalized.conversation_intelligence.voice_calls?.enabled).toBe(true);
    expect(normalized.conversation_intelligence.voice_calls?.capabilities?.recommended_model).toBe("gpt-realtime");
    expect((normalized.conversation_intelligence.inputs as any).video.analysis_ready).toBe(false);
    expect(normalized.content_modules.catalog.image_coverage_rate).toBe(72);
    expect(normalized.content_modules.catalog.bulk_import_endpoint).toBe("/api/admin/catalogo/importar");
    expect(normalized.content_modules.surveys_votings.draft_endpoint).toBe("/api/v2/surveys/draft");
    expect((normalized.tracking.courier_style_map as any).render_contract.fallback_when_no_coordinates).toBe("timeline_only");
    expect((normalized.tracking.courier_style_map as any).render_contract.layers).toContain("timeline_events");
    expect((normalized.tracking.orders as any).payment_status_endpoint).toBe("/api/v2/payments/status");
    expect((normalized.tracking.milestones as any).claim).toEqual(["recibido", "validando"]);
    expect((normalized.tracking.claims as any).experience_endpoint).toContain("/api/public/tracking/experience");
  });
});
