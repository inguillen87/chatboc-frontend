import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import WhatsappOperationsHub from "./WhatsappOperationsHub";

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

describe("WhatsappOperationsHub", () => {
  it("renders the transactional flow runtime contract", () => {
    render(<WhatsappOperationsHub initialExperience={baseExperience} />);

    expect(screen.getByText("Runtime de webviews transaccionales")).toBeInTheDocument();
    expect(screen.getByText("pausa y resume chat")).toBeInTheDocument();
    expect(screen.getByText("sin datos sensibles en chat")).toBeInTheDocument();
    expect(screen.getAllByText("/api/checkout/crear-preferencia").length).toBeGreaterThan(0);
    expect(screen.getByText("Checkout seguro de pedido")).toBeInTheDocument();
    expect(screen.getByText("Checkout publico seguro")).toBeInTheDocument();
  });
});
