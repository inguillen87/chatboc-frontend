import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WhatsappTechProviderOnboarding from "@/components/integrations/WhatsappTechProviderOnboarding";
import { tenantService } from "@/services/tenantService";

vi.mock("@/services/tenantService", () => ({
  tenantService: {
    getWhatsappTechProvider: vi.fn(),
    provisionWhatsappTechProvider: vi.fn(),
    provisionWhatsappVoiceApp: vi.fn(),
    registerWhatsappSender: vi.fn(),
    refreshWhatsappSenderStatus: vi.fn(),
    runWhatsappTechProviderSmokeTest: vi.fn(),
  },
}));

vi.mock("@/utils/api", async () => {
  const actual = await vi.importActual<typeof import("@/utils/api")>("@/utils/api");
  return {
    ...actual,
    getErrorMessage: (_error: unknown, fallback: string) => fallback,
  };
});

const mockedTenantService = vi.mocked(tenantService);

const baseContract = {
  contract_version: "twilio.tech_provider.v1",
  status: "pending_meta_signup",
  state: {
    waba_id: "123456789",
    phone_number_id: "987654321",
    sender_id: "whatsapp:+18564858589",
    sender_sid: "XESENDER123",
    sender_status: "online",
  },
  automation: {
    env: {
      ready: true,
      missing: [],
    },
  },
  embedded_signup: {
    enabled: true,
    start_url: "https://connect.example.test/signup",
  },
  voice: {
    status: "ready",
    voice_url: "/twilio/voice?tenant=junin-1",
  },
  setup_health: {
    contract_version: "twilio.tech_provider.setup_health.v1",
    status: "in_progress",
    activation_score: 78,
    completed: 7,
    total: 9,
    recommended_next_action: "review_templates_and_webviews",
    blockers: [
      {
        code: "templates_pending",
        label: "Falta revisar plantillas",
        detail: "Validar menus, CTAs y webviews productivos.",
        action: "review_templates_and_webviews",
      },
    ],
  },
  operator_checklist: [
    {
      id: "sender_online",
      label: "Canal online",
      description: "El sender ya puede enviar y recibir mensajes reales.",
      status: "online",
      done: true,
      action: "poll_sender_status",
    },
    {
      id: "templates_webviews",
      label: "Plantillas y webviews",
      description: "Menus, CTAs, pagos, pedidos, reclamos y seguimientos listos para WhatsApp.",
      status: "review_required",
      done: false,
      action: "review_templates_and_webviews",
      critical: false,
    },
  ],
  smoke_tests: {
    provider_status: "/api/v2/tenants/junin-1/integrations/whatsapp/status",
    whatsapp_experience: "/api/v2/tenants/junin-1/whatsapp/experience",
    template_registry: "/api/admin/templates/twilio-content/sync",
    production_channel: "/api/v2/tenants/junin-1/whatsapp/tech-provider/sender-status",
  },
  smoke_playbook: {
    contract_version: "twilio.tech_provider.smoke_playbook.v1",
    safe_by_default: true,
    summary: {
      total: 6,
      executable_now: 4,
      real_message_tests: 1,
    },
    tests: [
      {
        id: "template_registry",
        label: "Plantillas y webviews",
        description: "Revisa CTAs, quick replies, menus y webviews firmados.",
        method: "POST",
        endpoint: "/api/admin/templates/twilio-content/sync",
        execution_mode: "dry_run_first",
        danger_level: "safe_when_dry_run",
        can_execute: true,
        validates: ["cta_webview", "quick_reply"],
      },
      {
        id: "live_whatsapp_message",
        label: "Prueba real WhatsApp",
        description: "Debe pedir confirmacion explicita antes de enviar.",
        method: "POST",
        endpoint: "/api/v2/tenants/junin-1/whatsapp/live-message-test",
        execution_mode: "manual_confirmation_required",
        danger_level: "real_message",
        can_execute: false,
        validates: ["envio_real", "delivery_status"],
      },
    ],
  },
  api_workflow: [
    { id: "meta", label: "Meta signup", status: "ready" },
    { id: "sender", label: "Sender API", status: "pending" },
  ],
  limitations: ["El cliente debe autorizar su WABA desde Meta."],
};

describe("WhatsappTechProviderOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: baseContract });
    mockedTenantService.provisionWhatsappTechProvider.mockResolvedValue({
      contract: {
        ...baseContract,
        state: {
          ...baseContract.state,
          sender_sid: "XEUPDATED",
        },
      },
    });
    mockedTenantService.provisionWhatsappVoiceApp.mockResolvedValue({ contract: baseContract });
    mockedTenantService.registerWhatsappSender.mockResolvedValue({ contract: baseContract });
    mockedTenantService.refreshWhatsappSenderStatus.mockResolvedValue({ contract: baseContract });
    mockedTenantService.runWhatsappTechProviderSmokeTest.mockResolvedValue({
      contract_version: "twilio.tech_provider.smoke_execution.v1",
      test_id: "template_registry",
      ok: true,
      status: "pass",
      label: "Plantillas y webviews",
      next_action: "submit_or_sync_templates",
      details: { templates_total: 6 },
    });
    vi.stubGlobal("open", vi.fn());
  });

  it("renders the production WhatsApp activation contract for a tenant", async () => {
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    expect(await screen.findByText("WhatsApp productivo")).toBeInTheDocument();
    expect(screen.getByText("Activación guiada por Chatboc")).toBeInTheDocument();
    expect(screen.getByText("123456789")).toBeInTheDocument();
    expect(screen.getByText("987654321")).toBeInTheDocument();
    expect(screen.getByText("whatsapp:+18564858589")).toBeInTheDocument();
    expect(screen.getByText("XESENDER123")).toBeInTheDocument();
    expect(screen.getAllByText("online").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ready").length).toBeGreaterThan(0);
    expect(screen.getByText("Checklist operativo")).toBeInTheDocument();
    expect(screen.getByText("78% listo")).toBeInTheDocument();
    expect(screen.getByText("7/9 controles")).toBeInTheDocument();
    expect(screen.getAllByText("Plantillas y webviews").length).toBeGreaterThan(0);
    expect(screen.getByText("Falta revisar plantillas")).toBeInTheDocument();
    expect(screen.getAllByText("/api/admin/templates/twilio-content/sync").length).toBeGreaterThan(0);
    expect(screen.getByText("Plan de pruebas guiado")).toBeInTheDocument();
    expect(screen.getByText("seguro por defecto")).toBeInTheDocument();
    expect(screen.getByText("4 ejecutables ahora")).toBeInTheDocument();
    expect(screen.getByText("Prueba real WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("manual_confirmation_required")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /ejecutar prueba/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Registrar sender productivo con Twilio Senders API/i)).toBeInTheDocument();
    expect(screen.getByText("El cliente debe autorizar su WABA desde Meta.")).toBeInTheDocument();

    expect(mockedTenantService.getWhatsappTechProvider).toHaveBeenCalledWith("junin-1");
  });

  it("updates the visible contract after preparing activation", async () => {
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    fireEvent.click(await screen.findByRole("button", { name: /preparar activación/i }));

    await waitFor(() => {
      expect(mockedTenantService.provisionWhatsappTechProvider).toHaveBeenCalledWith("junin-1", {
        source: "tenant_panel",
      });
    });

    expect(await screen.findByText("XEUPDATED")).toBeInTheDocument();
  });

  it("runs a safe smoke test and renders the result inline", async () => {
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    const runButtons = await screen.findAllByRole("button", { name: /ejecutar prueba/i });
    fireEvent.click(runButtons[0]);

    await waitFor(() => {
      expect(mockedTenantService.runWhatsappTechProviderSmokeTest).toHaveBeenCalledWith("junin-1", "template_registry", {
        source: "tenant_panel",
        dry_run: true,
      });
    });

    expect(await screen.findByText("Resultado:")).toBeInTheDocument();
    expect(screen.getByText("Enviar o sincronizar plantillas")).toBeInTheDocument();
  });
});
