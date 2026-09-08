import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import WhatsappTechProviderOnboarding from "@/components/integrations/WhatsappTechProviderOnboarding";
import { tenantService } from "@/services/tenantService";
import { getTenantOpsQaPlaybookV2, runTenantOpsQaCheckV2 } from "@/api/v2/saas";

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

vi.mock("@/api/v2/saas", () => ({
  getTenantOpsQaPlaybookV2: vi.fn(),
  runTenantOpsQaCheckV2: vi.fn(),
}));

vi.mock("@/utils/api", async () => {
  const actual = await vi.importActual<typeof import("@/utils/api")>("@/utils/api");
  return {
    ...actual,
    getErrorMessage: (_error: unknown, fallback: string) => fallback,
  };
});

const mockedTenantService = vi.mocked(tenantService);
const mockedGetTenantOpsQaPlaybookV2 = vi.mocked(getTenantOpsQaPlaybookV2);
const mockedRunTenantOpsQaCheckV2 = vi.mocked(runTenantOpsQaCheckV2);

const findEnabledAction = (name: RegExp) => waitFor(() => {
  const button = screen.getByRole("button", { name });
  // The contract can render before its saved phone has populated the input.
  // Wait for actionable state, then perform one click outside the retry loop.
  expect(button).toBeEnabled();
  return button;
});

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
        endpoint: "/api/v2/tenants/junin-1/whatsapp/tech-provider/smoke-test/live_whatsapp_message",
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

const baseOpsQaPlaybook = {
  contract_version: "tenant.ops_qa.playbook.v1",
  request_id: "req-qa",
  tenant: { slug: "junin-1" },
  safe_by_default: true,
  status: "warning",
  score: 0.82,
  summary: {
    checks_total: 3,
    passed: 2,
    warnings: 1,
    critical_failed: 0,
  },
  checks: [
    {
      id: "whatsapp_templates_webviews",
      label: "Templates y webviews WhatsApp",
      ok: false,
      status: "warning",
      severity: "warning",
      endpoint: "/api/v2/tenants/junin-1/ops-qa/check/whatsapp_templates_webviews",
      details: { templates: 12, webviews: 4 },
      next_action: "review_templates_and_webviews",
    },
    {
      id: "tenant_profile",
      label: "Perfil del tenant",
      ok: true,
      status: "pass",
      severity: "info",
      endpoint: "/api/v2/tenants/junin-1/admin-experience",
      details: {},
      next_action: "continue",
    },
  ],
  recommended_next_actions: [
    {
      id: "whatsapp_templates_webviews",
      label: "Revisar templates y webviews",
      ok: false,
      status: "warning",
      severity: "warning",
      endpoint: "/api/v2/tenants/junin-1/ops-qa/check/whatsapp_templates_webviews",
      details: {},
      next_action: "review_templates_and_webviews",
    },
  ],
  execution: { mode: "read_only" },
  frontend_contract: { render_as: "tenant_ops_qa" },
  raw: {},
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
    mockedGetTenantOpsQaPlaybookV2.mockResolvedValue(baseOpsQaPlaybook);
    mockedRunTenantOpsQaCheckV2.mockResolvedValue({
      contract_version: "tenant.ops_qa.execution.v1",
      request_id: "req-run",
      tenant: { slug: "junin-1" },
      check_id: "whatsapp_templates_webviews",
      label: "Templates y webviews WhatsApp",
      ok: true,
      status: "pass",
      severity: "info",
      execution_mode: "read_only",
      sends_real_message: false,
      details: {
        templates: 12,
        webviews: 4,
        executable_matrix: {
          contract_version: "whatsapp.qa_script_matrix.v1",
          loaded: true,
          local_command: "python scripts/qa_whatsapp_flows.py",
          sends_real_message: false,
          summary: { scenarios: 12, cases: 31 },
        },
      },
      next_action: "continue_activation",
      playbook_status: "pass",
      playbook_score: 0.91,
      raw: {},
    });
    vi.stubGlobal("open", vi.fn());
  });

  it("shows a recoverable state when tenant context is missing", () => {
    render(<WhatsappTechProviderOnboarding tenantSlug={null} />);

    expect(screen.getByTestId("whatsapp-onboarding-missing-tenant")).toBeInTheDocument();
    expect(screen.getByText("Tenant no resuelto")).toBeInTheDocument();
    expect(screen.getByText("No pude cargar la activacion de WhatsApp")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /volver al panel/i })).toHaveAttribute("href", "/perfil");
    expect(screen.getByRole("link", { name: /abrir integracion/i })).toHaveAttribute(
      "href",
      "/integracion?channel=whatsapp",
    );
    expect(mockedTenantService.getWhatsappTechProvider).not.toHaveBeenCalled();
    expect(mockedGetTenantOpsQaPlaybookV2).not.toHaveBeenCalled();
  });

  it("renders an actionable plan lock when WhatsApp production is not enabled", async () => {
    mockedTenantService.getWhatsappTechProvider.mockRejectedValueOnce({
      status: 403,
      body: {
        error: "plan_required",
        message: "WhatsApp productivo requiere plan Full activo.",
        feature_id: "whatsapp_sender_management",
        frontend_contract: {
          render_as: "integration_locked",
          feature_id: "whatsapp_sender_management",
          feature_label: "Gestion de sender y plantillas",
          current_plan: "free",
          required_plan: "full",
          primary_action: "upgrade_to_full",
        },
        upgrade: {
          url: "https://www.chatboc.ar/#precios",
        },
      },
    });

    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    expect(await screen.findByTestId("whatsapp-plan-lock-panel")).toBeInTheDocument();
    expect(screen.getByText("Plan requerido")).toBeInTheDocument();
    expect(screen.getByText("Gestion de sender y plantillas")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp productivo requiere plan Full activo.")).toBeInTheDocument();
    expect(screen.getByText("Feature: whatsapp_sender_management")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /solicitar plan full/i })).toHaveAttribute(
      "href",
      "https://www.chatboc.ar/#precios",
    );
    expect(screen.getByRole("link", { name: /probar sandbox whatsapp/i })).toHaveAttribute(
      "href",
      "/t/junin-1/integracion?channel=whatsapp&mode=sandbox",
    );
    expect(screen.getByRole("link", { name: /preparar plantillas y webviews/i })).toHaveAttribute(
      "href",
      "/t/junin-1/perfil/plantillas-respuesta?section=whatsapp-operations&action=twilio-content&tenant=junin-1",
    );
    expect(screen.getByRole("link", { name: /ver marketplace publico/i })).toHaveAttribute("href", "/t/junin-1/market");
  });

  it("renders the production WhatsApp activation contract for a tenant", async () => {
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    expect(await screen.findByText("WhatsApp productivo")).toBeInTheDocument();
    expect(screen.getByText("Resumen de activacion")).toBeInTheDocument();
    expect(screen.getByTestId("whatsapp-primary-action")).toHaveTextContent("Configurar plantillas");
    expect(screen.getByTestId("whatsapp-advanced-controls")).not.toHaveAttribute("open");
    expect(screen.getByText("Listo con pendientes")).toBeInTheDocument();
    expect(screen.getByText("Prueba de conexion")).toBeInTheDocument();
    expect(screen.getByText(/Cerrar pendiente: Falta revisar plantillas/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ejecutar prueba de conexion/i })).toBeEnabled();
    expect(screen.getByText("Activación guiada por Chatboc")).toBeInTheDocument();
    expect(screen.getByText("123456789")).toBeInTheDocument();
    expect(screen.getByText("987654321")).toBeInTheDocument();
    expect(screen.getByText("whatsapp:+18564858589")).toBeInTheDocument();
    expect(screen.getByText("XESENDER123")).toBeInTheDocument();
    expect(screen.getAllByText("En linea").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Listo").length).toBeGreaterThan(0);
    expect(screen.getByText("Checklist operativo")).toBeInTheDocument();
    expect(screen.getByText("QA final del tenant")).toBeInTheDocument();
    expect(screen.getAllByText("Templates y webviews WhatsApp").length).toBeGreaterThan(0);
    expect(screen.getByText("Score 82%")).toBeInTheDocument();
    expect(screen.getAllByText("read-only").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Revisar plantillas y webviews").length).toBeGreaterThan(0);
    expect(screen.getByText("78% listo")).toBeInTheDocument();
    expect(screen.getByText("7/9 controles")).toBeInTheDocument();
    expect(screen.getAllByText("Plantillas y webviews").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Falta revisar plantillas").length).toBeGreaterThan(0);
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
    expect(mockedGetTenantOpsQaPlaybookV2).toHaveBeenCalledWith("junin-1");
  });

  it("shows one human-readable primary status instead of duplicated provider codes", async () => {
    mockedTenantService.getWhatsappTechProvider.mockResolvedValueOnce({
      contract: {
        ...baseContract,
        status: "provisioning_plan_ready",
        state: {
          ...baseContract.state,
          sender_status: "provisioning_plan_ready",
        },
      },
    });

    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    const primaryStatus = await screen.findByTestId("whatsapp-onboarding-primary-status");
    expect(primaryStatus).toHaveTextContent("Plan de activacion listo");
    expect(primaryStatus).not.toHaveTextContent("provisioning_plan_ready");
    expect(primaryStatus.querySelectorAll("span")).toHaveLength(1);
  });

  it("updates the visible contract after preparing activation", async () => {
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    fireEvent.click(await findEnabledAction(/preparar activación/i));

    await waitFor(() => {
      expect(mockedTenantService.provisionWhatsappTechProvider).toHaveBeenCalledWith("junin-1", {
        source: "tenant_panel",
        phone_number: "+18564858589",
      });
    });

    expect(await screen.findByText("XEUPDATED")).toBeInTheDocument();
  });

  it("waits for the loaded phone before preparing and updates only after confirmation", async () => {
    let resolveContract!: (value: unknown) => void;
    let resolveProvision!: (value: unknown) => void;
    mockedTenantService.getWhatsappTechProvider.mockReturnValueOnce(
      new Promise((resolve) => { resolveContract = resolve; }) as any,
    );
    mockedTenantService.provisionWhatsappTechProvider.mockReturnValueOnce(
      new Promise((resolve) => { resolveProvision = resolve; }) as any,
    );

    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    expect(screen.queryByRole("button", { name: /preparar activación/i })).not.toBeInTheDocument();
    expect(mockedTenantService.provisionWhatsappTechProvider).not.toHaveBeenCalled();

    await act(async () => { resolveContract({ contract: baseContract }); });
    const prepareButton = await findEnabledAction(/preparar activación/i);
    expect(screen.getByRole("textbox", { name: /numero de whatsapp/i })).toHaveValue("+18564858589");
    fireEvent.click(prepareButton);
    expect(mockedTenantService.provisionWhatsappTechProvider).toHaveBeenCalledExactlyOnceWith("junin-1", {
      source: "tenant_panel", phone_number: "+18564858589",
    });
    expect(prepareButton).toBeDisabled();
    expect(screen.queryByText("XEUPDATED")).not.toBeInTheDocument();
    expect(screen.getByText("XESENDER123")).toBeInTheDocument();

    await act(async () => {
      resolveProvision({ contract: { ...baseContract, state: { ...baseContract.state, sender_sid: "XEUPDATED" } } });
    });
    expect(await screen.findByText("XEUPDATED")).toBeInTheDocument();
    expect(mockedTenantService.provisionWhatsappTechProvider).toHaveBeenCalledTimes(1);
    expect(await findEnabledAction(/preparar activación/i)).toBeEnabled();
  });

  it("runs a safe smoke test and renders the result inline", async () => {
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    fireEvent.click(await screen.findByRole("button", { name: /ejecutar prueba de conexion/i }));

    await waitFor(() => {
      expect(mockedTenantService.runWhatsappTechProviderSmokeTest).toHaveBeenCalledWith("junin-1", "template_registry", {
        source: "tenant_panel",
        dry_run: true,
      });
    });

    expect(await screen.findByText(/Ultimo resultado:/i)).toBeInTheDocument();
    expect(await screen.findByText("Resultado:")).toBeInTheDocument();
    expect(screen.getByText("Enviar o sincronizar plantillas")).toBeInTheDocument();
  });

  it("runs the final tenant QA check in read-only mode and renders score plus next action", async () => {
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    fireEvent.click(await screen.findByText(/controles avanzados y detalles técnicos/i));
    fireEvent.click(await screen.findByRole("button", { name: /ejecutar qa read-only/i }));

    await waitFor(() => {
      expect(mockedRunTenantOpsQaCheckV2).toHaveBeenCalledWith("junin-1", "whatsapp_templates_webviews");
    });

    expect(await screen.findByText(/Resultado ejecutado:/i)).toBeInTheDocument();
    expect(screen.getByText("Score 91%")).toBeInTheDocument();
    expect(screen.getByText("Continue Activation")).toBeInTheDocument();
    expect(screen.getByText(/sin mensajes reales/i)).toBeInTheDocument();
    expect(screen.getByText("Escenarios")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Casos")).toBeInTheDocument();
    expect(screen.getByText("31")).toBeInTheDocument();
    expect(screen.getByText("python scripts/qa_whatsapp_flows.py")).toBeInTheDocument();
  });

  it("opens official WhatsApp templates inside the current tenant route", async () => {
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    fireEvent.click(await screen.findByRole("button", { name: /^plantillas whatsapp$/i }));

    expect(window.open).toHaveBeenCalledWith(
      "/t/junin-1/perfil/plantillas-respuesta?section=whatsapp-operations&action=twilio-content&tenant=junin-1",
      "_self",
    );
  });

  it("links WhatsApp onboarding with catalog administration and public marketplace", async () => {
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" focusAction="catalog" />);

    expect(await screen.findByText("Catalogo para WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("productos visibles")).toBeInTheDocument();
    expect(screen.getByText("promos y combos")).toBeInTheDocument();
    expect(screen.getByText("pedido asistido")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^administrar catalogo$/i }));
    expect(window.open).toHaveBeenCalledWith("/t/junin-1/admin/catalog", "_self");

    fireEvent.click(screen.getByRole("button", { name: /^ver marketplace$/i }));
    expect(window.open).toHaveBeenCalledWith("/t/junin-1/market", "_blank", "noopener,noreferrer");
  });

  it("keeps register sender as the primary action when the embedded signup handoff requests it", async () => {
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" focusAction="register-sender" />);

    const registerSenderButton = await findEnabledAction(/^registrar sender$/i);
    expect(registerSenderButton).toBeEnabled();

    fireEvent.click(registerSenderButton);

    await waitFor(() => {
      expect(mockedTenantService.registerWhatsappSender).toHaveBeenCalledWith("junin-1", {
        source: "tenant_panel",
        sender_id: "+18564858589",
      });
    });
  });

  it("turns a pending sender into one clear approval action", async () => {
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({
      contract: {
        ...baseContract,
        state: {
          waba_id: "123456789",
          phone_number_id: "987654321",
          requested_phone_number: "+5492634123456",
          sender_sid: "XEPENDING",
          sender_status: "pending_review",
        },
      },
    });

    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    const primaryAction = await screen.findByRole("button", { name: /^actualizar aprobación$/i });
    fireEvent.click(primaryAction);

    await waitFor(() => {
      expect(mockedTenantService.refreshWhatsappSenderStatus).toHaveBeenCalledWith("junin-1");
    });
  });

  it("requires and normalizes an E.164 number before starting Meta signup", async () => {
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({
      contract: {
        ...baseContract,
        state: {
          sender_status: "pending",
        },
      },
    });

    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    const phoneInput = await screen.findByRole("textbox", { name: /numero de whatsapp/i });
    const prepareButton = screen.getByRole("button", { name: /preparar activaci/i });
    const signupButton = screen.getByRole("button", { name: /iniciar registro embebido/i });
    const enterPhoneButton = screen.getByRole("button", { name: /ingresar número de whatsapp/i });

    expect(prepareButton).toBeDisabled();
    expect(signupButton).toBeDisabled();
    expect(screen.getByText(/formato internacional E\.164/i)).toBeInTheDocument();
    expect(enterPhoneButton).toHaveClass("w-full", "sm:w-auto");
    fireEvent.click(enterPhoneButton);
    expect(phoneInput).toHaveFocus();

    fireEvent.change(phoneInput, { target: { value: "+54 9 263 412-3456" } });

    expect(prepareButton).toBeEnabled();
    expect(signupButton).toBeEnabled();
    expect(screen.getByText(/\+5492634123456/)).toBeInTheDocument();
    const metaPrimaryAction = screen.getByRole("button", { name: /^autorizar con meta$/i });
    fireEvent.click(metaPrimaryAction);
    expect(window.open).toHaveBeenCalledWith("https://connect.example.test/signup", "_self");

    fireEvent.click(prepareButton);
    await waitFor(() => {
      expect(mockedTenantService.provisionWhatsappTechProvider).toHaveBeenCalledWith("junin-1", {
        source: "tenant_panel",
        phone_number: "+5492634123456",
      });
    });
  });

  it("explains why Meta signup cannot start when platform setup is incomplete", async () => {
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({
      contract: {
        ...baseContract,
        automation: {
          env: {
            ready: false,
            missing: ["TWILIO_ACCOUNT_SID", "META_APP_ID"],
          },
        },
        embedded_signup: {
          enabled: true,
          start_url: null,
        },
      },
    });

    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    expect(await screen.findByRole("button", { name: /iniciar registro embebido/i })).toBeDisabled();
    expect(screen.getByText("Bloqueado por plataforma")).toBeInTheDocument();
    expect(screen.getByText("Completar variables: TWILIO_ACCOUNT_SID, META_APP_ID")).toBeInTheDocument();
    expect(screen.getByText(/Completa la configuracion de plataforma antes de abrir Meta/i)).toBeInTheDocument();
    expect(screen.getAllByText(/TWILIO_ACCOUNT_SID, META_APP_ID/i).length).toBeGreaterThan(0);
  });

  it("surfaces first-run WhatsApp setup gaps when Meta and sender are missing", async () => {
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({
      contract: {
        ...baseContract,
        status: "prepare_activation",
        state: {
          sender_status: "pending",
        },
        setup_health: {
          ...baseContract.setup_health,
          blockers: [],
        },
        api_workflow: [],
        smoke_playbook: {
          ...baseContract.smoke_playbook,
          tests: [],
        },
        voice: {
          status: "pending",
        },
      },
    });

    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    expect(await screen.findByText("Falta autorizar Meta")).toBeInTheDocument();
    expect(screen.getByText("Autorizar cuenta WhatsApp Business en Meta")).toBeInTheDocument();
    expect(screen.getByText("Configurar plantillas, menu y webviews del tenant")).toBeInTheDocument();
    expect(screen.getByText("Preparar voz y rutas de asistencia")).toBeInTheDocument();
    expect(screen.getByText("El backend todavia no informo una prueba segura ejecutable.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ejecutar prueba de conexion/i })).toBeDisabled();
  });
});
