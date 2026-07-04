import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
            file_format: "mp3",
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
    expect(publication).toHaveTextContent("CDN activo");
    expect(publication).toHaveTextContent("Cdn");
    expect(publication).toHaveTextContent("MP3");
    expect(publication).toHaveTextContent("cdn.chatboc.ar");
    expect(publication).toHaveTextContent("/static/audio_cache");
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

    render(<WhatsappOperationsHub initialExperience={templateExperience({ enabled: true })} />);

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

    render(<WhatsappOperationsHub initialExperience={templateExperience({ enabled: true })} />);

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
});
