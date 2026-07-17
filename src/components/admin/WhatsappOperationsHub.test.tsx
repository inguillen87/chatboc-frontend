import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WhatsappOperationsHub from "./WhatsappOperationsHub";
import { apiFetch } from "@/utils/api";

vi.mock("@/api/v2/saas", async () => {
  const actual = await vi.importActual<typeof import("@/api/v2/saas")>("@/api/v2/saas");
  return {
    ...actual,
    getWhatsappExperienceV2: vi.fn(),
  };
});

vi.mock("@/utils/api", async () => {
  const actual = await vi.importActual<typeof import("@/utils/api")>("@/utils/api");
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

const baseExperience = {
  contract_version: "whatsapp.experience.v1",
  access: { enabled: true },
  channel: { enabled: true },
  enterprise_rules: {},
  contact_window: {},
  conversation_intelligence: {
    inputs: {},
    audio_cache: {},
    accessibility: {},
    voice_calls: {},
  },
  content_modules: {},
  tracking: {},
  commerce: {},
  template_blueprint: {},
  webview_blueprint: {},
  flow_runtime: {
    contract_version: "whatsapp.flow_runtime.v1",
    enabled: true,
    runtime_policy: {
      pause_conversation_while_webview_open: true,
      no_sensitive_data_in_chat: true,
    },
    public_endpoints: {
      checkout: "/api/checkout/crear-preferencia",
      claim_messages: "/api/public/tracking/claims/{ticket_id}/messages",
    },
    summary: {
      flows_total: 3,
      ready_flows: 2,
      contract_ready_adapters: 1,
      adapter_pending: 1,
      families: { claims: 1, commerce: 1, surveys: 1 },
    },
    flows: [
      {
        id: "order_checkout",
        label: "Checkout seguro de pedido",
        family: "commerce",
        ready: true,
        status: "ready",
        surface: "whatsapp_cta_webview",
        url_template: "/api/checkout/crear-preferencia",
        actions: [
          {
            id: "public_checkout",
            label: "Checkout publico seguro",
            endpoint: "/api/checkout/crear-preferencia",
            implementation_status: "ready",
          },
        ],
      },
    ],
  },
  meta_platform: {},
  finance_transactional: {},
  qa_playbook: {},
  message_ux_policy: {},
  admin_panel: {},
  education: {},
  frontend_contract: { render_as: "whatsapp_operations_hub" },
};

const apiFetchMock = vi.mocked(apiFetch);

const templateExperience = (access: Record<string, unknown>) => ({
  ...baseExperience,
  access,
  template_blueprint: {
    enabled: true,
    provider: "twilio_content_api",
    registry_summary: { total_registered: 0 },
    creation_manifest: {
      templates_total: 1,
      actionable_total: 1,
      items: [
        {
          id: "order_checkout",
          friendly_name: "order_checkout",
          twilio_type: "twilio/call-to-action",
          content_family: "cta_webview",
          readiness: { state: "ready", next_action: "create_template", severity: "warning" },
          action_capabilities: { webview_ready: true, requires_signed_url: true },
          meta_business: { recommended_surface: "whatsapp_flow", outside_24h_requires_approval: true },
          create_request: {
            friendly_name: "order_checkout",
            types: { "twilio/text": { body: "Hola {{1}}, completa tu pedido." } },
          },
          approval_request: { category: "UTILITY" },
        },
      ],
    },
  },
});

const metaFlowExperience = (flowId: string, metaFlowId = "") => ({
  ...baseExperience,
  meta_platform: {
    contract_version: "whatsapp.meta_platform.v1",
    configured: true,
    active: false,
    status: "sender_pending",
    native_flows: {
      supported_by_provider: true,
      configured: Boolean(metaFlowId),
      active: false,
      candidate_count: 1,
      configured_count: metaFlowId ? 1 : 0,
      active_count: 0,
      flow_json_profile: {
        version: "7.3",
        data_api_version: "3.0",
        max_asset_bytes: 10 * 1024 * 1024,
        null_values_allowed: false,
      },
      data_exchange: {
        ready: true,
        endpoint_url: "https://api.chatboc.ar/api/public/whatsapp/flows/data-exchange",
        blockers: [],
      },
      management: {
        ready: true,
        status: "ready",
        sync_endpoint: "/api/admin/whatsapp/flows/meta/sync",
        irreversible_publish: true,
        blockers: [],
        graph: { ready: true, blockers: [] },
      },
      sync_endpoint: "/api/admin/whatsapp/flows/twilio-content/sync",
      flow_json_download_endpoint_template: "/api/admin/whatsapp/flows/{flow_id}/flow-json",
      send_endpoint: "/api/admin/whatsapp/flows/send",
      security: {
        dedicated_token_key_ready: true,
        durable_single_use_invocation: true,
      },
      flows: [
        {
          id: flowId,
          flow_name: flowId === "claim_intake" ? "Reclamo ciudadano" : "Pedido comercial",
          meta_flow_id: metaFlowId || undefined,
          registry_status: metaFlowId ? "pending_approval" : "not_configured",
          activation_state: metaFlowId ? "awaiting_meta_approval" : "meta_flow_id_required",
          endpoint_mode: "data_exchange",
          first_screen_id: "START",
          screens_count: 2,
          screen_ids: ["START", "CONFIRM"],
          flow_json_version: "7.3",
          data_api_version: "3.0",
          flow_json_sha256: "a".repeat(64),
          flow_json_byte_size: 4096,
          artifact_identity_verified: false,
          meta_flow_publication_verified: false,
          blockers: metaFlowId
            ? ["twilio_content_sid_required", "meta_publication_not_verified"]
            : ["meta_flow_id_required", "twilio_content_sid_required"],
          configured: Boolean(metaFlowId),
          active: false,
        },
      ],
    },
    business_calling: { supported_by_provider: true, configured: false, active: false },
    catalog: { configured: false, active: false, chatboc_catalog_items: 0 },
    embedded_signup: { platform_configured: true, tenant_completed: false, active: false },
    integration_access: { enabled: true, required_plan: "full" },
  },
});

describe("WhatsappOperationsHub", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("renders the transactional flow runtime contract", () => {
    render(<WhatsappOperationsHub initialExperience={baseExperience} />);

    expect(screen.getByText("Runtime de webviews transaccionales")).toBeInTheDocument();
    expect(screen.getByText("pausa y resume chat")).toBeInTheDocument();
    expect(screen.getByText("sin datos sensibles en chat")).toBeInTheDocument();
    expect(screen.getAllByText("/api/checkout/crear-preferencia").length).toBeGreaterThan(0);
    expect(screen.getByText("Checkout seguro de pedido")).toBeInTheDocument();
    expect(screen.getByText("Checkout publico seguro")).toBeInTheDocument();
  });

  it("surfaces CDN publication status for inclusive WhatsApp audio menus", () => {
    const experience = {
      ...baseExperience,
      conversation_intelligence: {
        ...baseExperience.conversation_intelligence,
        audio_cache: {
          enabled: true,
          ready: true,
          status: "ready",
          storage: {
            public_path: "/static/audio_cache",
            public_url_mode: "cdn",
            cdn_configured: true,
            cdn_host: "cdn.chatboc.ar",
            edge_ready: true,
            cache_control: "public, max-age=31536000, immutable",
            file_format: "mp3",
            next_action: "monitor_hit_rate",
            privacy: {
              content_text_exposed: false,
              pii_in_url: false,
            },
          },
          summary: {
            requests: 12,
            cache_hits: 10,
            hit_rate: 0.833,
            failures: 0,
          },
          metrics: {
            requests: 12,
            cache_hits: 10,
          },
        },
      },
      message_ux_policy: {
        accessibility: {
          fixed_menu_audio_cache: {
            enabled: true,
            scope: ["main_menu", "claim_categories"],
          },
        },
      },
    };

    render(<WhatsappOperationsHub initialExperience={experience} />);

    const publication = screen.getByTestId("whatsapp-audio-cache-publication");
    const metrics = screen.getByTestId("whatsapp-audio-cache-metrics");
    expect(metrics).toHaveClass("grid-cols-2", "2xl:grid-cols-3");
    expect(metrics).not.toHaveClass("xl:grid-cols-6");
    expect(publication).toHaveTextContent("CDN activo");
    expect(publication).toHaveTextContent("Cloudflare ready");
    expect(publication).toHaveTextContent("Sin PII");
    expect(publication).toHaveTextContent("Cdn");
    expect(publication).toHaveTextContent("MP3");
    expect(publication).toHaveTextContent("cdn.chatboc.ar");
    expect(publication).toHaveTextContent("/static/audio_cache");
    expect(publication).toHaveTextContent("public, max-age=31536000, immutable");
    expect(publication).toHaveTextContent("Monitor hit rate");
    expect(screen.getByText("Audio cache")).toBeInTheDocument();
  });

  it("locks Twilio template execution when integration access requires upgrade", async () => {
    apiFetchMock.mockResolvedValueOnce({
      dry_run: true,
      blocked: true,
      ready_to_create: false,
      integration_access: {
        enabled: false,
        message: "Requiere plan Full.",
      },
    });

    render(
      <WhatsappOperationsHub
        canManageFlows
        initialExperience={templateExperience({
          enabled: false,
          required_plan: "full",
          reason_code: "plan_full_required",
          lock_reason_code: "plan_full_required",
          message: "Las integraciones productivas requieren plan Full activo.",
        })}
      />,
    );

    expect(screen.getByText("Creacion real bloqueada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Crear en Twilio/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Refrescar estado/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Validar payload/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/api/admin/templates/twilio-content/sync",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            template_id: "order_checkout",
            dry_run: true,
            submit_for_approval: true,
          }),
        }),
      );
    });
    expect(await screen.findByText(/ejecucion bloqueada/i)).toBeInTheDocument();
  });

  it("uses the dry-run execute confirmation when creating Twilio content", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        dry_run: true,
        blocked: false,
        execute_confirmation: "sync_twilio_content:order_checkout",
      })
      .mockResolvedValueOnce({
        content_sid: "HXcreatedtemplate",
        registry: { status: "pending_approval" },
      });

    render(
      <WhatsappOperationsHub
        canManageFlows
        initialExperience={templateExperience({ enabled: true })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Validar payload/i }));
    expect(await screen.findByText(/Confirmacion lista para crear/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Crear en Twilio/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledTimes(2);
    });
    expect(apiFetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          template_id: "order_checkout",
          dry_run: false,
          submit_for_approval: true,
          execute_confirmation: "sync_twilio_content:order_checkout",
        }),
      }),
    );
    expect(await screen.findByText(/ContentSid registrado: HXcreatedtemplate/i)).toBeInTheDocument();
  });

  it("validates and creates a native Meta Flow without claiming it active first", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        dry_run: true,
        blocked: false,
        ready_to_create: true,
        execute_confirmation: "sync_twilio_flow:claim_intake:1232445823264765",
      })
      .mockResolvedValueOnce({
        created: true,
        content_sid: "HXnativeflowcreated",
        approval_status: "pending",
      });

    const experience = {
      ...baseExperience,
      meta_platform: {
        contract_version: "whatsapp.meta_platform.v1",
        configured: true,
        active: false,
        status: "sender_pending",
        native_flows: {
          supported_by_provider: true,
          configured: false,
          active: false,
          candidate_count: 1,
          configured_count: 0,
          active_count: 0,
          sync_endpoint: "/api/admin/whatsapp/flows/twilio-content/sync",
          flows: [
            {
              id: "claim_intake",
              flow_name: "Reclamo ciudadano",
              activation_state: "meta_flow_id_required",
              configured: false,
              active: false,
            },
          ],
        },
        business_calling: {
          supported_by_provider: true,
          configured: false,
          active: false,
          user_initiated_enabled: false,
          business_initiated_enabled: false,
        },
        catalog: {
          configured: true,
          active: false,
          catalog_id_present: true,
          chatboc_catalog_items: 42,
        },
        embedded_signup: {
          platform_configured: true,
          tenant_completed: true,
          active: false,
          status: "sender_pending",
        },
        integration_access: { enabled: true, required_plan: "full" },
      },
    };

    render(<WhatsappOperationsHub canManageFlows initialExperience={experience} />);

    const panel = screen.getByTestId("meta-platform-operations");
    expect(panel).toHaveTextContent("Meta Business Platform");
    expect(panel).toHaveTextContent("WhatsApp Flows nativos");
    expect(panel).toHaveTextContent("WhatsApp Business Calling");
    expect(panel).toHaveTextContent("42 articulos Chatboc");
    expect(panel).not.toHaveTextContent("Entrantes habilitadas");

    const validateButton = screen.getByRole("button", { name: /Validar wrapper/i });
    const executeButton = screen.getByRole("button", { name: /Crear wrapper en Twilio/i });
    expect(validateButton).toBeDisabled();
    expect(executeButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Meta Flow ID publicado/i), {
      target: { value: "1232445823264765" },
    });
    expect(validateButton).toBeEnabled();
    fireEvent.click(validateButton);

    expect(await screen.findByText(/Wrapper validado/i)).toBeInTheDocument();
    expect(apiFetchMock.mock.calls[0]).toEqual([
      "/api/admin/whatsapp/flows/twilio-content/sync",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          flow_id: "claim_intake",
          meta_flow_id: "1232445823264765",
          dry_run: true,
          submit_for_approval: true,
        }),
      }),
    ]);

    expect(executeButton).toBeEnabled();
    fireEvent.click(executeButton);
    expect(await screen.findByText(/HXnativeflowcreated/i)).toBeInTheDocument();
    expect(apiFetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          flow_id: "claim_intake",
          meta_flow_id: "1232445823264765",
          dry_run: false,
          submit_for_approval: true,
          execute_confirmation: "sync_twilio_flow:claim_intake:1232445823264765",
        }),
      }),
    );
  });

  it("publishes and verifies the Meta artifact before creating its Twilio wrapper", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        dry_run: true,
        ready_to_sync: true,
        blockers: [],
        execute_confirmation: "signed-meta-publication-preview",
      })
      .mockResolvedValueOnce({
        published: true,
        meta_flow_id: "1232445823264765",
        meta_publication_attestation: "signed-meta-publication-attestation",
      })
      .mockResolvedValueOnce({
        dry_run: true,
        blocked: false,
        ready_to_create: true,
        execute_confirmation: "signed-twilio-wrapper-preview",
      })
      .mockResolvedValueOnce({
        created: true,
        content_sid: "HXverifiedflowwrapper",
        approval_status: "pending",
      });

    render(
      <WhatsappOperationsHub
        canManageFlows
        initialExperience={metaFlowExperience("claim_intake")}
      />,
    );

    const lifecycle = screen.getByTestId("native-flow-lifecycle");
    expect(lifecycle).toHaveTextContent("Flow JSON 7.3");
    expect(lifecycle).toHaveTextContent("API 3.0");
    expect(lifecycle).toHaveTextContent("SHA-256");
    expect(screen.getByRole("button", { name: /Descargar Flow JSON/i })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /Preparar publicacion/i }));
    expect(
      await screen.findByText(/Contrato listo.*inmutabilidad/i),
    ).toBeInTheDocument();

    const acknowledgement = screen.getByRole("checkbox", {
      name: /Confirmo que Meta vuelve inmutable/i,
    });
    const publishButton = screen.getByRole("button", {
      name: /Publicar o verificar en Meta/i,
    });
    expect(acknowledgement).toBeEnabled();
    expect(publishButton).toBeDisabled();
    fireEvent.click(acknowledgement);
    expect(publishButton).toBeEnabled();
    fireEvent.click(publishButton);

    expect(
      await screen.findByText(/Meta publico y verifico el Flow 1232445823264765/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Meta Flow ID publicado/i)).toHaveValue(
      "1232445823264765",
    );

    const metaPreviewBody = JSON.parse(String(apiFetchMock.mock.calls[0][1]?.body));
    const metaExecuteBody = JSON.parse(String(apiFetchMock.mock.calls[1][1]?.body));
    expect(apiFetchMock.mock.calls[0][0]).toBe("/api/admin/whatsapp/flows/meta/sync");
    expect(metaPreviewBody).toEqual({
      flow_id: "claim_intake",
      dry_run: true,
      publish: true,
    });
    expect(metaExecuteBody).toEqual({
      flow_id: "claim_intake",
      dry_run: false,
      publish: true,
      execute_confirmation: "signed-meta-publication-preview",
    });

    fireEvent.click(screen.getByRole("button", { name: /Validar wrapper/i }));
    expect(await screen.findByText(/Wrapper validado/i)).toBeInTheDocument();
    const wrapperPreviewBody = JSON.parse(String(apiFetchMock.mock.calls[2][1]?.body));
    expect(wrapperPreviewBody).toEqual({
      flow_id: "claim_intake",
      meta_flow_id: "1232445823264765",
      dry_run: true,
      submit_for_approval: true,
      meta_publication_attestation: "signed-meta-publication-attestation",
    });

    fireEvent.click(screen.getByRole("button", { name: /Crear wrapper en Twilio/i }));
    expect(await screen.findByText(/HXverifiedflowwrapper/i)).toBeInTheDocument();
    const wrapperExecuteBody = JSON.parse(String(apiFetchMock.mock.calls[3][1]?.body));
    expect(wrapperExecuteBody).toEqual({
      flow_id: "claim_intake",
      meta_flow_id: "1232445823264765",
      dry_run: false,
      submit_for_approval: true,
      meta_publication_attestation: "signed-meta-publication-attestation",
      execute_confirmation: "signed-twilio-wrapper-preview",
    });
    expect(lifecycle).not.toHaveTextContent("signed-meta-publication-attestation");
  });

  it("prevalidates and sends a native Flow without exposing its one-time token", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        dry_run: true,
        ready_to_send: true,
        blocked: false,
        blockers: [],
        recipient_hint: "***6789",
        execute_confirmation: "signed-short-lived-send-confirmation",
        security: { token_exposed: false },
      })
      .mockResolvedValueOnce({
        sent: true,
        idempotent_replay: false,
        interaction: {
          status: "sent",
          recipient_hint: "***6789",
          external_message_sid: "SMNATIVEFLOW001",
        },
      });

    render(
      <WhatsappOperationsHub
        canManageFlows
        initialExperience={metaFlowExperience("catalog_order_builder", "1232445823264765")}
      />,
    );

    const testPanel = screen.getByTestId("native-flow-test-send");
    expect(testPanel).toHaveTextContent("Seguridad lista");
    const validateSend = screen.getByRole("button", { name: /Validar envio/i });
    const executeSend = screen.getByRole("button", { name: /Enviar Flow de prueba/i });
    expect(validateSend).toBeDisabled();
    expect(executeSend).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Numero destino/i), {
      target: { value: "+54 9 11 2345-6789" },
    });
    const recipientInput = screen.getByLabelText(/Numero destino/i);
    const recipientHelp = screen.getByText(/Todavia no fue validada por el backend/i);
    expect(recipientInput).not.toHaveAttribute("aria-invalid");
    expect(recipientHelp).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId("native-flow-test-controls")).not.toContainElement(recipientHelp);
    expect(validateSend).toBeEnabled();
    fireEvent.click(validateSend);

    expect(await screen.findByText(/backend habilito el envio para \*\*\*6789/i)).toBeInTheDocument();
    expect(recipientInput).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByText(/Dry-run aprobado por el backend/i)).toBeInTheDocument();
    const previewBody = JSON.parse(String(apiFetchMock.mock.calls[0][1]?.body));
    expect(apiFetchMock.mock.calls[0][0]).toBe("/api/admin/whatsapp/flows/send");
    expect(previewBody).toEqual(
      expect.objectContaining({
        flow_id: "catalog_order_builder",
        recipient: "+5491123456789",
        dry_run: true,
      }),
    );
    expect(previewBody.idempotency_key).toMatch(/^flow-test-/);
    expect(JSON.stringify(apiFetchMock.mock.calls[0])).not.toContain("flow_token");

    expect(executeSend).toBeEnabled();
    fireEvent.click(executeSend);
    expect(await screen.findByText(/SMNATIVEFLOW001/i)).toBeInTheDocument();
    const executeBody = JSON.parse(String(apiFetchMock.mock.calls[1][1]?.body));
    expect(executeBody).toEqual({
      flow_id: "catalog_order_builder",
      recipient: "+5491123456789",
      idempotency_key: previewBody.idempotency_key,
      dry_run: false,
      execute_confirmation: "signed-short-lived-send-confirmation",
    });
    expect(testPanel).not.toHaveTextContent("signed-short-lived-send-confirmation");
    expect(testPanel).not.toHaveTextContent("flow_token");
  });

  it("authorizes a survey slug before sending survey_vote and preserves it in both payloads", async () => {
    const surveySlug = "presupuesto-participativo-2026";
    apiFetchMock
      .mockResolvedValueOnce({
        dry_run: true,
        ready_to_send: true,
        blocked: false,
        blockers: [],
        recipient_hint: "***6789",
        execute_confirmation: "signed-survey-send-confirmation",
        survey_context: {
          required: true,
          ready: true,
          id: "survey-42",
          slug: surveySlug,
        },
      })
      .mockResolvedValueOnce({
        sent: true,
        idempotent_replay: false,
        interaction: {
          status: "sent",
          recipient_hint: "***6789",
          external_message_sid: "SMSURVEYVOTE001",
        },
      });

    render(
      <WhatsappOperationsHub
        canManageFlows
        initialExperience={metaFlowExperience("survey_vote", "1232445823264765")}
      />,
    );

    const recipientInput = screen.getByLabelText(/Numero destino/i);
    const surveyInput = screen.getByLabelText(/Slug o token publico de encuesta/i);
    const validateSend = screen.getByRole("button", { name: /Validar envio/i });
    const executeSend = screen.getByRole("button", { name: /Enviar Flow de prueba/i });
    expect(surveyInput).toBeRequired();

    fireEvent.change(recipientInput, { target: { value: "+54 9 11 2345-6789" } });
    expect(validateSend).toBeDisabled();
    fireEvent.change(surveyInput, { target: { value: `  ${surveySlug}  ` } });
    expect(validateSend).toBeEnabled();
    fireEvent.click(validateSend);

    expect(
      await screen.findByText(/Contexto listo\. Encuesta autorizada: presupuesto-participativo-2026/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/ID survey-42/i)).toBeInTheDocument();
    expect(surveyInput).toHaveAttribute("aria-invalid", "false");

    const previewBody = JSON.parse(String(apiFetchMock.mock.calls[0][1]?.body));
    expect(previewBody).toEqual({
      flow_id: "survey_vote",
      recipient: "+5491123456789",
      idempotency_key: expect.stringMatching(/^flow-test-/),
      dry_run: true,
      survey_context: { slug: surveySlug },
    });

    expect(executeSend).toBeEnabled();
    fireEvent.click(executeSend);
    expect(await screen.findByText(/SMSURVEYVOTE001/i)).toBeInTheDocument();
    const executeBody = JSON.parse(String(apiFetchMock.mock.calls[1][1]?.body));
    expect(executeBody).toEqual({
      flow_id: "survey_vote",
      recipient: "+5491123456789",
      idempotency_key: previewBody.idempotency_key,
      dry_run: false,
      survey_context: { slug: surveySlug },
      execute_confirmation: "signed-survey-send-confirmation",
    });
  });

  it("fails closed when survey_vote dry-run returns an incompatible survey context", async () => {
    apiFetchMock.mockResolvedValueOnce({
      dry_run: true,
      ready_to_send: true,
      blocked: false,
      blockers: [],
      recipient_hint: "***6789",
      execute_confirmation: "must-not-be-used",
      survey_context: {
        required: true,
        ready: true,
        id: "survey-99",
        slug: "otra-encuesta",
      },
    });

    render(
      <WhatsappOperationsHub
        canManageFlows
        initialExperience={metaFlowExperience("survey_vote", "1232445823264765")}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Numero destino/i), {
      target: { value: "+54 9 11 2345-6789" },
    });
    const surveyInput = screen.getByLabelText(/Slug o token publico de encuesta/i);
    fireEvent.change(surveyInput, {
      target: { value: "presupuesto-participativo-2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Validar envio/i }));

    expect(
      await screen.findByText(/Envio bloqueado: el backend devolvio un contexto de encuesta incompatible/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/backend no autorizo este contexto de encuesta/i)).toBeInTheDocument();
    expect(surveyInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: /Enviar Flow de prueba/i })).toBeDisabled();
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("resets Flow controls and ignores a stale response when the tenant contract changes", async () => {
    let resolveRequest: (value: unknown) => void = () => undefined;
    apiFetchMock.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    const { rerender } = render(
      <WhatsappOperationsHub
        canManageFlows
        initialExperience={metaFlowExperience("claim_intake")}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Meta Flow ID publicado/i), {
      target: { value: "1232445823264765" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Validar wrapper/i }));

    rerender(
      <WhatsappOperationsHub
        canManageFlows
        initialExperience={metaFlowExperience("order_checkout", "987654321012345")}
      />,
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/Meta Flow ID publicado/i)).toHaveValue("987654321012345");
    });

    await act(async () => {
      resolveRequest({
        dry_run: true,
        blocked: false,
        execute_confirmation: "stale-confirmation-from-previous-tenant",
      });
      await Promise.resolve();
    });

    expect(screen.queryByText(/Wrapper validado/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Crear wrapper en Twilio/i })).toBeDisabled();
    expect(screen.getByLabelText(/Flow de Chatboc/i)).toHaveValue("order_checkout");
    expect(screen.getByLabelText(/Numero destino/i)).toHaveValue("");
    expect(screen.getByRole("button", { name: /Enviar Flow de prueba/i })).toBeDisabled();
  });

  it("removes stale Twilio execution confirmation when backend returns a runtime plan lock", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        dry_run: true,
        blocked: false,
        execute_confirmation: "sync_twilio_content:order_checkout",
        frontend_contract: { render_locked_state: false, hide_execute_controls: false },
        operator_guardrails: { requires_full_plan: false },
      })
      .mockResolvedValueOnce({
        dry_run: true,
        blocked: true,
        ready_to_create: false,
        integration_access: {
          enabled: false,
          message: "Las integraciones productivas requieren plan Full activo.",
        },
        frontend_contract: {
          render_as: "whatsapp_template_creation_lock",
          render_locked_state: true,
          hide_execute_controls: true,
        },
        operator_guardrails: {
          requires_full_plan: true,
          twilio_call_allowed: false,
          next_action: "upgrade_to_full",
        },
      });

    render(
      <WhatsappOperationsHub
        canManageFlows
        initialExperience={templateExperience({ enabled: true })}
      />,
    );

    const validateButton = screen.getByRole("button", { name: /Validar payload/i });
    const createButton = screen.getByRole("button", { name: /Crear en Twilio/i });

    fireEvent.click(validateButton);
    expect(await screen.findByText(/Confirmacion lista para crear/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(createButton).toBeEnabled();
    });

    fireEvent.click(validateButton);
    expect(await screen.findByText(/ejecucion bloqueada/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(createButton).toBeDisabled();
    });
    expect(screen.getByText("Las integraciones productivas requieren plan Full activo.")).toBeInTheDocument();
  });

  it("marks a recipient as rejected only after the backend dry-run blocks it", async () => {
    apiFetchMock.mockResolvedValueOnce({
      dry_run: true,
      ready_to_send: false,
      blocked: true,
      blockers: ["recipient_not_allowed"],
    });

    render(
      <WhatsappOperationsHub
        canManageFlows
        initialExperience={metaFlowExperience("claim_intake", "1232445823264765")}
      />,
    );

    const recipientInput = screen.getByLabelText(/Numero destino/i);
    fireEvent.change(recipientInput, { target: { value: "+54 9 11 2345 6789" } });
    expect(recipientInput).not.toHaveAttribute("aria-invalid");

    fireEvent.click(screen.getByRole("button", { name: /Validar envio/i }));

    const backendError = await screen.findByText(/Envio bloqueado: Recipient Not Allowed/i);
    expect(backendError).toHaveAttribute("aria-live", "polite");
    expect(recipientInput).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/backend no autorizo el envio/i)).toHaveAttribute("aria-live", "polite");
  });

  it("does not mark the recipient as invalid when the dry-run cannot reach the backend", async () => {
    apiFetchMock.mockRejectedValueOnce(new Error("network unavailable"));

    render(
      <WhatsappOperationsHub
        canManageFlows
        initialExperience={metaFlowExperience("claim_intake", "1232445823264765")}
      />,
    );

    const recipientInput = screen.getByLabelText(/Numero destino/i);
    fireEvent.change(recipientInput, { target: { value: "+54 9 11 2345 6789" } });
    fireEvent.click(screen.getByRole("button", { name: /Validar envio/i }));

    const transportError = await screen.findByText(/network unavailable/i);
    expect(transportError).toHaveAttribute("aria-live", "polite");
    expect(recipientInput).not.toHaveAttribute("aria-invalid");
    expect(screen.getByText(/Todavia no fue validada por el backend/i)).toBeInTheDocument();
  });

  it("requires explicit E.164 and hides administrative controls from operators", () => {
    const experience = {
      ...metaFlowExperience("claim_intake"),
      channel: {
        enabled: true,
        test_endpoint: "/api/admin/whatsapp/channel/test",
      },
    };
    const { rerender } = render(
      <WhatsappOperationsHub
        canManageFlows
        initialExperience={experience}
      />,
    );

    expect(screen.getByRole("button", { name: /Probar canal/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Numero destino/i), {
      target: { value: "5491123456789" },
    });
    expect(screen.getByLabelText(/Numero destino/i)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Revisa la estructura E\.164/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Validar envio/i })).toBeDisabled();

    rerender(
      <WhatsappOperationsHub
        initialExperience={experience}
        canManageFlows={false}
      />,
    );
    expect(screen.getAllByText(/Administracion protegida/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Validar envio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Crear wrapper en Twilio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Validar payload/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Crear en Twilio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Refrescar estado/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Probar canal/i })).not.toBeInTheDocument();
  });
});
