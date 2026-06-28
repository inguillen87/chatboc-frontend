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
        webhook: "/webhook/whatsapp",
        status_webhook: "/twilio/whatsapp/status",
        waba_id: "123456789",
        phone_number_id: "987654321",
        test_endpoint: "/api/v2/whatsapp/experience/test",
        test_method: "POST",
        test_label: "Enviar prueba",
      },
      conversation_intelligence: {
        accessibility: {
          enabled: true,
          features: ["audio_transcription", "screen_reader_labels"],
        },
        audio_cache: {
          enabled: true,
          ttl_seconds: 900,
        },
        inputs: {
          text: { enabled: true },
          audio_note: { enabled: true, cache_enabled: true },
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
      template_blueprint: {
        registry_summary: {
          operational_approved: 18,
          operational_pending: 2,
          operational_blocking: 0,
        },
        fallback_templates: ["fallback_status_update"],
        creation_manifest: {
          contract_version: "twilio.content.creation_manifest.v1",
          templates_total: 24,
          actionable_total: 3,
          by_twilio_type: {
            "twilio/call-to-action": 8,
            "twilio/quick-reply": 4,
          },
          items: [
            {
              id: "order_checkout",
              friendly_name: "chatboc_order_checkout_v1",
              create_request: {
                friendly_name: "chatboc_order_checkout_v1",
                types: {
                  "twilio/text": { body: "Tu pedido {{1}} esta listo." },
                },
              },
            },
          ],
        },
        next_actions: [
          {
            id: "gov_survey_invite",
            severity: "warning",
            next_action: "refresh_twilio_status_or_wait_for_meta_approval",
          },
        ],
      },
      webview_blueprint: {
        flows: [
          {
            id: "claim_tracking_helpdesk",
            status: "ready",
            url_template: "/api/public/tracking/experience?kind=claim&code={code}&pin={pin}",
          },
        ],
        summary: {
          flows_total: 4,
          ready_flows: 2,
        },
        security: {
          signed_session_required: true,
        },
      },
      qa_playbook: {
        contract_version: "whatsapp.qa_playbook.v1",
        scenario_count: 5,
        ready_count: 2,
        recommended_order: ["gov_claim_text_to_tracking", "pyme_order_checkout"],
        local_command: "python scripts/qa_whatsapp_flows.py",
        scenarios: [
          {
            id: "gov_claim_text_to_tracking",
            status: "ready",
            script_cases: ["junin_texto_reclamo"],
          },
        ],
      },
      message_ux_policy: {
        interactive_limits: {
          reply_buttons_max: 3,
        },
      },
      frontend_contract: {
        render_as: "whatsapp_operations_hub",
      },
    });

    expect(normalized.contract_version).toBe("whatsapp.experience.v1");
    expect(normalized.request_id).toBe("req_whatsapp");
    expect(normalized.channel.enabled).toBe(true);
    expect(normalized.channel.webhook).toBe("/webhook/whatsapp");
    expect(normalized.channel.status_webhook).toBe("/twilio/whatsapp/status");
    expect(normalized.channel.waba_id).toBe("123456789");
    expect(normalized.channel.phone_number_id).toBe("987654321");
    expect(normalized.channel.test_endpoint).toBe("/api/v2/whatsapp/experience/test");
    expect(normalized.channel.test_label).toBe("Enviar prueba");
    expect((normalized.conversation_intelligence.accessibility as any).features).toContain("audio_transcription");
    expect((normalized.conversation_intelligence.audio_cache as any).ttl_seconds).toBe(900);
    expect((normalized.conversation_intelligence.inputs as any).audio_note.cache_enabled).toBe(true);
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
    expect((normalized.template_blueprint.registry_summary as any).operational_approved).toBe(18);
    expect((normalized.template_blueprint.registry_summary as any).operational_blocking).toBe(0);
    expect((normalized.template_blueprint.fallback_templates as any)).toContain("fallback_status_update");
    expect((normalized.template_blueprint.next_actions as any)[0].id).toBe("gov_survey_invite");
    expect((normalized.template_blueprint.creation_manifest as any).contract_version).toBe("twilio.content.creation_manifest.v1");
    expect((normalized.template_blueprint.creation_manifest as any).items[0].id).toBe("order_checkout");
    expect((normalized.webview_blueprint.security as any).signed_session_required).toBe(true);
    expect((normalized.webview_blueprint.summary as any).flows_total).toBe(4);
    expect((normalized.webview_blueprint.flows as any)[0].id).toBe("claim_tracking_helpdesk");
    expect((normalized.qa_playbook as any).contract_version).toBe("whatsapp.qa_playbook.v1");
    expect((normalized.qa_playbook as any).recommended_order).toContain("pyme_order_checkout");
    expect((normalized.qa_playbook as any).scenarios[0].id).toBe("gov_claim_text_to_tracking");
    expect((normalized.message_ux_policy.interactive_limits as any).reply_buttons_max).toBe(3);
  });
});
