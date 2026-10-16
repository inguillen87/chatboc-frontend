import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

describe('WhatsApp activation readiness evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetTenantOpsQaPlaybookV2.mockResolvedValue({ tenant: { slug: 'junin-1' } } as any);
  });
  it.each([false, undefined])('does not operate providers when live_enabled is %s, while identifying a dry run honestly', async live => {
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: { ...baseContract, automation: { ...baseContract.automation, live_enabled: live } } });
    mockedTenantService.runWhatsappTechProviderSmokeTest.mockResolvedValue({ status: 'pass', ok: true });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    await screen.findByText('Preparación sin activar envío');
    expect(screen.queryByText('Listo para operar')).not.toBeInTheDocument();
    for (const label of ['Preparar activación', 'Registrar sender', 'Actualizar estado', 'Preparar voz', 'Iniciar registro embebido']) {
      expect(screen.getByRole('button', { name: label })).toBeDisabled();
    }
    expect(screen.getByText(/Comprobación de configuración sin envío \(dry run\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ejecutar prueba de conexion/i }));
    await waitFor(() => expect(mockedTenantService.runWhatsappTechProviderSmokeTest).toHaveBeenCalledWith('junin-1', 'template_registry', {
      source: 'tenant_panel', dry_run: true,
    }));
    expect(mockedTenantService.provisionWhatsappTechProvider).not.toHaveBeenCalled();
    expect(mockedTenantService.registerWhatsappSender).not.toHaveBeenCalled();
    expect(mockedTenantService.refreshWhatsappSenderStatus).not.toHaveBeenCalled();
    expect(mockedTenantService.provisionWhatsappVoiceApp).not.toHaveBeenCalled();
  });
  it('blocks configuration and provider actions when environment readiness is unknown', async () => {
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: { ...baseContract, automation: { live_enabled: true, env: {} } } });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    await screen.findByText('Bloqueado por plataforma');
    expect(screen.getByRole('button', { name: /ejecutar prueba de conexion/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Registrar sender' })).toBeDisabled();
    expect(mockedTenantService.runWhatsappTechProviderSmokeTest).not.toHaveBeenCalled();
  });
  it.each(['not_ready', 'disconnected', 'inactive', 'provisioning_plan_ready', 'ready', 'unknown'])
    ('keeps sender approval pending for the provider status %s', async senderStatus => {
      mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: {
        ...baseContract,
        status: 'inactive',
        state: { ...baseContract.state, sender_status: senderStatus },
      } });
      render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

      await screen.findByText('Sender en revision');
      expect(screen.getByTestId('whatsapp-primary-action')).toHaveTextContent('Actualizar aprobación');
      expect(screen.getByRole('textbox', { name: /numero de whatsapp/i })).toBeEnabled();
      const steps = within(screen.getByRole('list', { name: 'Pasos de activación de WhatsApp' }));
      expect(steps.getByText('Probar WhatsApp').closest('li')).toHaveTextContent('Pendiente: Probar WhatsApp');
      expect(steps.getByText('Operar y medir').closest('li')).toHaveTextContent('Pendiente: Operar y medir');
      expect(mockedTenantService.refreshWhatsappSenderStatus).not.toHaveBeenCalled();
      expect(mockedTenantService.runWhatsappTechProviderSmokeTest).not.toHaveBeenCalled();
    });
  it.each(['online', 'approved', 'connected', 'active'])
    ('does not count sender status %s or complete configuration as a verified real exchange', async senderStatus => {
      mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: {
        ...baseContract,
        status: 'active',
        state: { ...baseContract.state, sender_status: senderStatus },
        setup_health: { ...baseContract.setup_health, status: 'ready', activation_score: 100, completed: 9, blockers: [] },
        operator_checklist: [
          { id: 'sender_online', done: true, status: senderStatus },
          { id: 'webhooks', done: true, status: 'done' },
        ],
      } });
      render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

      await screen.findByText('Configuración con pendientes');
      const steps = within(screen.getByRole('list', { name: 'Pasos de activación de WhatsApp' }));
      expect(steps.getByText('Probar WhatsApp').closest('li')).toHaveTextContent('Paso actual: Probar WhatsApp');
      expect(steps.getByText('Operar y medir').closest('li')).toHaveTextContent('Pendiente: Operar y medir');
      expect(screen.getByText('2/4 pasos tecnicos')).toBeInTheDocument();
      expect(screen.getAllByText('Verificar envío, entrega y respuesta con una prueba real autorizada').length).toBeGreaterThan(0);
      expect(screen.getByText(/Rutas de callbacks configuradas; la entrega, lectura y los eventos reales siguen pendientes/)).toBeInTheDocument();
      expect(mockedTenantService.runWhatsappTechProviderSmokeTest).not.toHaveBeenCalled();
      expect(mockedTenantService.registerWhatsappSender).not.toHaveBeenCalled();
    });
  it.each(['not_ready', 'disconnected', 'inactive', 'provisioning_plan_ready'])
    ('does not give the misleading status %s a successful status pill', async senderStatus => {
      mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: {
        ...baseContract,
        state: { ...baseContract.state, sender_status: senderStatus },
      } });
      render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

      const primaryStatus = await screen.findByTestId('whatsapp-onboarding-primary-status');
      expect(primaryStatus.querySelector('span')).not.toHaveClass('text-emerald-700');
    });
  it.each([
    { ...baseContract, tenant: { id: 23, slug: 'foreign-organization' } },
    { ...baseContract, tenant: undefined },
    { ...baseContract, contract_version: 'future.provider.v2' },
  ])('does not expose or operate a foreign or unverified activation contract', async contract => {
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    await screen.findByText('No se pudo cargar el onboarding de WhatsApp.');
    expect(screen.queryByRole('button', { name: 'Registrar sender' })).not.toBeInTheDocument();
    expect(screen.queryByText('Listo para operar')).not.toBeInTheDocument();
    expect(mockedTenantService.registerWhatsappSender).not.toHaveBeenCalled();
  });
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
  tenant: { id: 22, slug: 'junin-1' },
  status: "pending_meta_signup",
  state: {
    waba_id: "123456789",
    phone_number_id: "987654321",
    sender_id: "whatsapp:+18564858589",
    sender_sid: "XESENDER123",
    sender_status: "online",
  },
  automation: {
    live_enabled: true,
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

const liveUnavailableMessage = "La prueba real todavía no está habilitada; la configuración registrada se conserva";
const vaultUnavailableMessage = "La preparación segura de esta organización requiere una activación de Chatboc.";
const r15Availability = (vaultOwned = false) => ({
  contract_version: "whatsapp.operation_availability.v1",
  operations: Object.fromEntries([
    "create_subaccount", "create_messaging_service", "register_sender", "poll_sender_status", "prepare_voice", "live_whatsapp_message",
  ].map((id) => [id, {
    implemented: id !== "live_whatsapp_message",
    can_execute: !vaultOwned && ["register_sender", "poll_sender_status", "prepare_voice"].includes(id),
    dry_run_available: true,
    reason_code: id === "live_whatsapp_message" ? "execution_not_implemented" : vaultOwned ? "twilio_vault_onboarding_integration_required" : null,
    message: id === "live_whatsapp_message" ? liveUnavailableMessage : vaultOwned ? vaultUnavailableMessage : null,
  }])),
});
const r15ConfiguredContract = (vaultOwned = false) => ({
  ...baseContract,
  status: vaultOwned ? "needs_secure_activation" : "configuration_complete",
  next_action: vaultOwned ? "wait_for_platform_activation" : "await_live_test_support",
  operation_availability: r15Availability(vaultOwned),
  setup_health: {
    ...baseContract.setup_health,
    status: vaultOwned ? "action_required" : "configuration_complete",
    recommended_next_action: vaultOwned ? "wait_for_platform_activation" : "await_live_test_support",
    blockers: vaultOwned ? [{ code: "twilio_vault_onboarding_integration_required", message: vaultUnavailableMessage, action: "wait_for_platform_activation" }] : [],
  },
  operator_checklist: [
    { id: "templates_webviews", done: true }, { id: "webhooks", done: true },
  ],
  smoke_playbook: {
    ...baseContract.smoke_playbook,
    tests: [
      baseContract.smoke_playbook.tests[0],
      { ...baseContract.smoke_playbook.tests[1], reason_code: "execution_not_implemented", description: liveUnavailableMessage },
    ],
  },
});

describe("R15 operation availability contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetTenantOpsQaPlaybookV2.mockResolvedValue({ tenant: { slug: "junin-1" } } as any);
  });

  it("preserves complete metadata but blocks vault onboarding operations and keeps contract refresh", async () => {
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: r15ConfiguredContract(true) });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    const primary = within(await screen.findByTestId("whatsapp-primary-action"));
    expect(primary.getByText(vaultUnavailableMessage)).toBeInTheDocument();
    expect(primary.getByRole("button", { name: /volver a comprobar habilitación/i })).toBeEnabled();
    expect(screen.getByTestId("whatsapp-onboarding-primary-status")).toHaveTextContent("Preparación segura pendiente");
    expect(screen.getByText("XESENDER123")).toBeInTheDocument();
    expect(screen.queryByText("Número aprobado, asociado y listo para mensajes reales.")).not.toBeInTheDocument();
    for (const name of ["Preparar activación", "Registrar sender", "Actualizar estado", "Preparar voz"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled(); fireEvent.click(button);
    }
    expect(mockedTenantService.provisionWhatsappTechProvider).not.toHaveBeenCalled();
    expect(mockedTenantService.registerWhatsappSender).not.toHaveBeenCalled();
    expect(mockedTenantService.refreshWhatsappSenderStatus).not.toHaveBeenCalled();
    expect(mockedTenantService.provisionWhatsappVoiceApp).not.toHaveBeenCalled();
    fireEvent.click(primary.getByRole("button", { name: /volver a comprobar habilitación/i }));
    await waitFor(() => expect(mockedTenantService.getWhatsappTechProvider).toHaveBeenCalledTimes(2));
  });

  it("shows complete configuration with real testing pending while supported env actions remain available", async () => {
    const configured = r15ConfiguredContract();
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: configured });
    mockedTenantService.refreshWhatsappSenderStatus.mockResolvedValue({ contract: configured });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    expect(await screen.findByTestId("whatsapp-onboarding-primary-status")).toHaveTextContent("Configuración completa; prueba real pendiente");
    const primary = within(screen.getByTestId("whatsapp-primary-action"));
    expect(primary.getByText(liveUnavailableMessage)).toBeInTheDocument();
    expect(primary.getByRole("button", { name: /volver a comprobar habilitación/i })).toBeEnabled();
    expect(screen.getAllByText("Esperar habilitación de la prueba real").length).toBeGreaterThan(0);
    for (const name of ["Registrar sender", "Actualizar estado", "Preparar voz"]) {
      expect(screen.getByRole("button", { name })).toBeEnabled();
    }
    expect(screen.getByRole("button", { name: "Preparar activación" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar estado" }));
    await waitFor(() => expect(mockedTenantService.refreshWhatsappSenderStatus).toHaveBeenCalledExactlyOnceWith("junin-1"));
    fireEvent.click(screen.getByText(/controles avanzados y detalles técnicos/i));
    const liveCard = screen.getByText("Prueba real WhatsApp").closest("div.rounded-xl")!;
    expect(within(liveCard as HTMLElement).getByRole("button", { name: "Prueba real no habilitada" })).toBeDisabled();
    expect(within(liveCard as HTMLElement).queryByText("Requiere confirmacion")).not.toBeInTheDocument();
  });

  it.each([
    ["register_sender", "Registrar sender", "registerWhatsappSender"],
    ["poll_sender_status", "Actualizar estado", "refreshWhatsappSenderStatus"],
    ["prepare_voice", "Preparar voz", "provisionWhatsappVoiceApp"],
  ] as const)("honors explicit unavailability for %s without blocking the safe configuration check", async (operation, label, method) => {
    const configured = r15ConfiguredContract();
    configured.operation_availability.operations[operation].can_execute = false;
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: configured });
    mockedTenantService.runWhatsappTechProviderSmokeTest.mockResolvedValue({ status: "pass", ok: true });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    await screen.findByTestId("whatsapp-primary-action");
    const button = screen.getByRole("button", { name: label });
    expect(button).toBeDisabled(); fireEvent.click(button);
    expect(mockedTenantService[method]).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /ejecutar prueba de conexion/i }));
    await waitFor(() => expect(mockedTenantService.runWhatsappTechProviderSmokeTest).toHaveBeenCalledExactlyOnceWith("junin-1", "template_registry", {
      source: "tenant_panel", dry_run: true,
    }));
  });

  it("honors the shared availability projection supplied only in setup health", async () => {
    const configured = r15ConfiguredContract(true);
    const { operation_availability, ...contract } = configured;
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: {
      ...contract, setup_health: { ...configured.setup_health, operation_availability },
    } });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    await screen.findByTestId("whatsapp-primary-action");
    expect(screen.getByRole("button", { name: "Actualizar estado" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Preparar voz" })).toBeDisabled();
  });

  it.each([
    { can_execute: "false", implemented: true }, { can_execute: true, implemented: false },
    { can_execute: true, implemented: null }, { can_execute: true, implemented: "true" }, { can_execute: true },
  ])(
    "requires exact availability booleans and an implemented operation: %j", async operation => {
      const configured = r15ConfiguredContract();
      mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: {
        ...configured, operation_availability: {
          ...configured.operation_availability,
          operations: { ...configured.operation_availability.operations, register_sender: operation },
        },
      } });
      render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
      await screen.findByTestId("whatsapp-primary-action");
      expect(screen.getByRole("button", { name: "Registrar sender" })).toBeDisabled();
    },
  );

  it.each([
    null, undefined,
    { contract_version: "future.operation_availability.v2", operations: r15Availability().operations },
    { contract_version: "whatsapp.operation_availability.v1", operations: null },
    { contract_version: "whatsapp.operation_availability.v1", operations: {} },
    { contract_version: "whatsapp.operation_availability.v1" },
  ])("fails closed for a present null, incomplete or unknown availability contract: %j", async operation_availability => {
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: {
      ...r15ConfiguredContract(), operation_availability,
    } });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    await screen.findByTestId("whatsapp-primary-action");
    for (const name of ["Preparar activación", "Registrar sender", "Actualizar estado", "Preparar voz"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeDisabled(); fireEvent.click(button);
    }
    expect(mockedTenantService.provisionWhatsappTechProvider).not.toHaveBeenCalled();
    expect(mockedTenantService.registerWhatsappSender).not.toHaveBeenCalled();
    expect(mockedTenantService.refreshWhatsappSenderStatus).not.toHaveBeenCalled();
    expect(mockedTenantService.provisionWhatsappVoiceApp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(mockedTenantService.getWhatsappTechProvider).toHaveBeenCalledTimes(2));
  });

  it("does not fall back to a valid setup projection when top-level availability is present but null", async () => {
    const configured = r15ConfiguredContract();
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: {
      ...configured, operation_availability: null,
      setup_health: { ...configured.setup_health, operation_availability: configured.operation_availability },
    } });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    await screen.findByTestId("whatsapp-primary-action");
    expect(screen.getByRole("button", { name: "Registrar sender" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Actualizar estado" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Preparar voz" })).toBeDisabled();
  });

  it("rejects a stale executable production channel when polling is unavailable", async () => {
    const configured = r15ConfiguredContract(true);
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: {
      ...configured, smoke_playbook: { ...configured.smoke_playbook, tests: [{
        id: "production_channel", label: "Consulta del canal registrado", can_execute: true, danger_level: "read_only",
      }] },
    } });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    await screen.findByTestId("whatsapp-primary-action");
    expect(screen.getByRole("button", { name: /ejecutar prueba de conexion/i })).toBeDisabled();
    fireEvent.click(screen.getByText(/controles avanzados y detalles técnicos/i));
    const check = screen.getByRole("button", { name: "Ejecutar prueba" });
    expect(check).toBeDisabled(); fireEvent.click(check);
    expect(mockedTenantService.runWhatsappTechProviderSmokeTest).not.toHaveBeenCalled();
  });

  it("does not offer live smoke when its unavailable executor lacks legacy danger metadata", async () => {
    const configured = r15ConfiguredContract();
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: {
      ...configured, smoke_playbook: { ...configured.smoke_playbook, tests: [{
        id: "live_whatsapp_message", label: "Prueba real WhatsApp", can_execute: true,
      }] },
    } });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    await screen.findByTestId("whatsapp-primary-action");
    expect(screen.getByRole("button", { name: /ejecutar prueba de conexion/i })).toBeDisabled();
    fireEvent.click(screen.getByText(/controles avanzados y detalles técnicos/i));
    expect(screen.getByRole("button", { name: "Prueba real no habilitada" })).toBeDisabled();
    expect(screen.getAllByText(liveUnavailableMessage).length).toBeGreaterThan(0);
    expect(mockedTenantService.runWhatsappTechProviderSmokeTest).not.toHaveBeenCalled();
  });
});

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

  it.each([false, true])("honors blocked provisioning operations when credential storage ready is %s", async (ready) => {
    const message = "Chatboc debe completar la preparación segura de esta organización.";
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: {
      ...baseContract,
      state: { requested_phone_number: "+5492634123456" },
      embedded_signup: { enabled: false },
      automation: {
        ...baseContract.automation,
        credential_storage: {
          ready,
          status: ready ? "ready" : "unavailable",
          reason_code: "twilio_tenant_credential_store_unavailable",
          blocked_operations: ["create_subaccount", "create_messaging_service"],
          message,
        },
      },
    } });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);

    await waitFor(() => expect(screen.getByRole("textbox", { name: /numero de whatsapp/i })).toHaveValue("+5492634123456"));
    fireEvent.click(screen.getByText(/controles avanzados y detalles técnicos/i));
    for (const prepareButton of screen.getAllByRole("button", { name: /^preparar activación$/i })) {
      expect(prepareButton).toBeDisabled();
      fireEvent.click(prepareButton);
    }
    expect(mockedTenantService.provisionWhatsappTechProvider).not.toHaveBeenCalled();
    expect(screen.getByTestId("whatsapp-credential-storage-status")).toHaveTextContent(message);
    const primary = within(screen.getByTestId("whatsapp-primary-action"));
    expect(primary.getByText(message)).toBeInTheDocument();
    fireEvent.click(primary.getByRole("button", { name: /volver a comprobar configuración/i }));
    await waitFor(() => expect(mockedTenantService.getWhatsappTechProvider).toHaveBeenCalledTimes(2));
    expect(mockedTenantService.provisionWhatsappTechProvider).not.toHaveBeenCalled();
  });

  it("does not enable live operations just because credential storage is ready", async () => {
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: {
      ...baseContract,
      automation: {
        ...baseContract.automation, live_enabled: false,
        credential_storage: { ready: true, blocked_operations: [] },
      },
    } });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    await screen.findByText("Preparación sin activar envío");
    for (const name of ["Preparar activación", "Registrar sender", "Actualizar estado", "Preparar voz"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(mockedTenantService.provisionWhatsappTechProvider).not.toHaveBeenCalled();
    expect(mockedTenantService.registerWhatsappSender).not.toHaveBeenCalled();
  });

  it("keeps provider status, registration and safe smoke actions available when only infrastructure creation is blocked", async () => {
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: {
      ...baseContract,
      automation: {
        ...baseContract.automation,
        credential_storage: {
          ready: false,
          blocked_operations: ["create_subaccount", "create_messaging_service"],
          message: "Las conexiones existentes conservan sus consultas de estado.",
        },
      },
    } });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    await screen.findByTestId("whatsapp-credential-storage-status");
    fireEvent.click(screen.getByText(/controles avanzados y detalles técnicos/i));
    expect(screen.getByRole("button", { name: /^preparar activación$/i })).toBeDisabled();
    expect(await findEnabledAction(/^registrar sender$/i)).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /^actualizar estado$/i }));
    await waitFor(() => expect(mockedTenantService.refreshWhatsappSenderStatus).toHaveBeenCalledExactlyOnceWith("junin-1"));
    fireEvent.click(screen.getByRole("button", { name: /ejecutar prueba de conexion/i }));
    await waitFor(() => expect(mockedTenantService.runWhatsappTechProviderSmokeTest).toHaveBeenCalledExactlyOnceWith("junin-1", "template_registry", {
      source: "tenant_panel", dry_run: true,
    }));
    expect(mockedTenantService.provisionWhatsappTechProvider).not.toHaveBeenCalled();
  });

  it.each([undefined, { ready: true, blocked_operations: [] }, { ready: false, blocked_operations: ["unrelated_operation"] }])(
    "preserves provisioning when the backend does not block its operations: %j", async (credentialStorage) => {
      mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: {
        ...baseContract,
        automation: { ...baseContract.automation, credential_storage: credentialStorage },
      } });
      render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
      fireEvent.click(await findEnabledAction(/^preparar activación$/i));
      await waitFor(() => expect(mockedTenantService.provisionWhatsappTechProvider).toHaveBeenCalledExactlyOnceWith("junin-1", {
        source: "tenant_panel", phone_number: "+18564858589",
      }));
    },
  );

  it("does not restore a late GET contract after switching organizations", async () => {
    let resolveFirst!: (value: unknown) => void;
    mockedTenantService.getWhatsappTechProvider.mockImplementation((slug) => slug === "junin-1"
      ? new Promise((resolve) => { resolveFirst = resolve; }) as any
      : Promise.resolve({ contract: { ...baseContract, tenant: { id: 23, slug }, state: { ...baseContract.state, sender_sid: "XECURRENTB" } } }));
    mockedGetTenantOpsQaPlaybookV2.mockImplementation(async (slug) => ({ ...baseOpsQaPlaybook, tenant: { slug } }));
    const { rerender } = render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    rerender(<WhatsappTechProviderOnboarding tenantSlug="tenant-b" />);
    expect(await screen.findByText("XECURRENTB")).toBeInTheDocument();
    await act(async () => { resolveFirst({ contract: { ...baseContract, state: { ...baseContract.state, sender_sid: "XESTALEA" } } }); });
    expect(screen.getByText("XECURRENTB")).toBeInTheDocument();
    expect(screen.queryByText("XESTALEA")).not.toBeInTheDocument();
  });

  it("does not restore an earlier GET when returning to the same organization", async () => {
    let resolveFirst!: (value: unknown) => void;
    let firstOrganizationRequests = 0;
    mockedTenantService.getWhatsappTechProvider.mockImplementation((slug) => {
      if (slug === "junin-1" && firstOrganizationRequests++ === 0) {
        return new Promise((resolve) => { resolveFirst = resolve; }) as any;
      }
      return Promise.resolve({ contract: {
        ...baseContract, tenant: { id: 23, slug }, state: { ...baseContract.state, sender_sid: `XECURRENT-${slug}` },
      } });
    });
    mockedGetTenantOpsQaPlaybookV2.mockImplementation(async (slug) => ({ ...baseOpsQaPlaybook, tenant: { slug } }));
    const { rerender } = render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    rerender(<WhatsappTechProviderOnboarding tenantSlug="tenant-b" />);
    await screen.findByText("XECURRENT-tenant-b");
    rerender(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    await screen.findByText("XECURRENT-junin-1");
    await act(async () => { resolveFirst({ contract: { ...baseContract, state: { ...baseContract.state, sender_sid: "XESTALEA" } } }); });
    expect(screen.getByText("XECURRENT-junin-1")).toBeInTheDocument();
    expect(screen.queryByText("XESTALEA")).not.toBeInTheDocument();
  });

  it.each([
    ["provisionWhatsappTechProvider", /^preparar activación$/i],
    ["registerWhatsappSender", /^registrar sender$/i],
    ["refreshWhatsappSenderStatus", /^actualizar estado$/i],
    ["provisionWhatsappVoiceApp", /^preparar voz$/i],
  ] as const)("ignores a late %s result after switching organizations", async (method, label) => {
    let resolveFirst!: (value: unknown) => void;
    mockedTenantService[method].mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }) as any);
    mockedTenantService.getWhatsappTechProvider.mockImplementation(async (slug) => ({ contract: {
      ...baseContract, tenant: { id: slug === "junin-1" ? 22 : 23, slug },
      state: { ...baseContract.state, sender_sid: slug === "junin-1" ? "XEFIRSTA" : "XECURRENTB" },
    } }));
    mockedGetTenantOpsQaPlaybookV2.mockImplementation(async (slug) => ({ ...baseOpsQaPlaybook, tenant: { slug } }));
    const { rerender } = render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    fireEvent.click(await findEnabledAction(label));
    expect(mockedTenantService[method]).toHaveBeenCalledTimes(1);
    rerender(<WhatsappTechProviderOnboarding tenantSlug="tenant-b" />);
    expect(await screen.findByText("XECURRENTB")).toBeInTheDocument();
    await act(async () => { resolveFirst({ contract: { ...baseContract, state: { ...baseContract.state, sender_sid: "XESTALEA" } } }); });
    expect(screen.getByText("XECURRENTB")).toBeInTheDocument();
    expect(screen.queryByText("XESTALEA")).not.toBeInTheDocument();
    expect(mockedTenantService[method]).toHaveBeenCalledTimes(1);
  });

  it("does not show a previous organization's late mutation error", async () => {
    let rejectFirst!: (reason: unknown) => void;
    mockedTenantService.provisionWhatsappTechProvider.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectFirst = reject; }) as any);
    mockedTenantService.getWhatsappTechProvider.mockImplementation(async (slug) => ({ contract: {
      ...baseContract, tenant: { id: 23, slug }, state: { ...baseContract.state, sender_sid: slug === "junin-1" ? "XEFIRSTA" : "XECURRENTB" },
    } }));
    mockedGetTenantOpsQaPlaybookV2.mockImplementation(async (slug) => ({ ...baseOpsQaPlaybook, tenant: { slug } }));
    const { rerender } = render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    fireEvent.click(await findEnabledAction(/^preparar activación$/i));
    rerender(<WhatsappTechProviderOnboarding tenantSlug="tenant-b" />);
    await screen.findByText("XECURRENTB");
    await act(async () => { rejectFirst(new Error("transport_failure")); });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("XECURRENTB")).toBeInTheDocument();
  });

  it.each(["smoke", "qa"] as const)("clears previous %s results and ignores a late result after switching organizations", async (operation) => {
    let resolveFirst!: (value: any) => void;
    const method = operation === "smoke" ? mockedTenantService.runWhatsappTechProviderSmokeTest : mockedRunTenantOpsQaCheckV2;
    method.mockResolvedValueOnce(operation === "smoke" ? { ok: true, status: "prior_tenant_result" } : {
      ...baseOpsQaPlaybook, status: "prior_tenant_result", playbook_status: "prior_tenant_result",
    } as any);
    method.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }) as any);
    mockedTenantService.getWhatsappTechProvider.mockImplementation(async (slug) => ({ contract: {
      ...baseContract, tenant: { id: 23, slug }, state: { ...baseContract.state, sender_sid: slug === "junin-1" ? "XEFIRSTA" : "XECURRENTB" },
    } }));
    mockedGetTenantOpsQaPlaybookV2.mockImplementation(async (slug) => ({ ...baseOpsQaPlaybook, tenant: { slug } }));
    const { rerender } = render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    await screen.findByText("XEFIRSTA");
    fireEvent.click(screen.getByText(/controles avanzados y detalles técnicos/i));
    const label = operation === "smoke" ? /ejecutar prueba de conexion/i : /ejecutar qa read-only/i;
    fireEvent.click(await findEnabledAction(label));
    expect((await screen.findAllByText("prior_tenant_result")).length).toBeGreaterThan(0);
    fireEvent.click(await findEnabledAction(label));
    rerender(<WhatsappTechProviderOnboarding tenantSlug="tenant-b" />);
    await screen.findByText("XECURRENTB");
    expect(screen.queryAllByText("prior_tenant_result")).toHaveLength(0);
    await act(async () => { resolveFirst({ ok: true, status: "late_tenant_result", playbook_status: "late_tenant_result" }); });
    expect(screen.queryAllByText("late_tenant_result")).toHaveLength(0);
    expect(screen.getByText("XECURRENTB")).toBeInTheDocument();
    expect(method).toHaveBeenCalledTimes(2);
  });

  it("reports an uncertain provisioning result without replaying the write", async () => {
    mockedTenantService.provisionWhatsappTechProvider.mockRejectedValueOnce(new Error("transport_failure"));
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    fireEvent.click(await findEnabledAction(/^preparar activación$/i));
    expect(await screen.findByText(/No pudimos confirmar la preparación de la activación\. Actualiza el estado/)).toBeInTheDocument();
    expect(screen.getByText("XESENDER123")).toBeInTheDocument();
    expect(mockedTenantService.provisionWhatsappTechProvider).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, false, "true"])("does not treat workflow, routing metadata or template status as explicit readiness when done is %s", async (done) => {
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: {
      ...baseContract,
      frontend_contract: { primary_action: "poll_sender_status" },
      api_workflow: [{ id: "templates_webviews", state: "ready", endpoint: "/api/admin/templates/twilio-content/sync" }],
      operator_checklist: [{ id: "templates_webviews", done, status: "ready" }],
    } });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    await screen.findByText("XESENDER123");
    fireEvent.click(screen.getByText(/controles avanzados y detalles técnicos/i));
    const templateCard = screen.getByText("Plantillas y menú").closest(".rounded-xl") as HTMLElement;
    expect(within(templateCard).queryByText("Listo")).not.toBeInTheDocument();
    expect(templateCard).not.toHaveClass("border-emerald-500/30");
    expect(screen.getByText("Configurar plantillas, menu y webviews del tenant")).toBeInTheDocument();
    expect(mockedTenantService.runWhatsappTechProviderSmokeTest).not.toHaveBeenCalled();
  });

  it("marks templates ready only when the backend checklist explicitly confirms them", async () => {
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: {
      ...baseContract,
      frontend_contract: { primary_action: "poll_sender_status" },
      api_workflow: [],
      operator_checklist: [{ id: "templates_webviews", done: true, status: "ready" }],
    } });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    await screen.findByText("XESENDER123");
    fireEvent.click(screen.getByText(/controles avanzados y detalles técnicos/i));
    const templateCard = screen.getByText("Plantillas y menú").closest(".rounded-xl") as HTMLElement;
    expect(within(templateCard).getByText("Listo")).toBeInTheDocument();
    expect(templateCard).toHaveClass("border-emerald-500/30");
    expect(screen.queryByText("Configurar plantillas, menu y webviews del tenant")).not.toBeInTheDocument();
  });

  it("explains secure activation with backend messages and human-readable status labels", async () => {
    const message = "La preparación segura de esta organización debe completarla Chatboc.";
    mockedTenantService.getWhatsappTechProvider.mockResolvedValue({ contract: {
      ...baseContract,
      status: "needs_secure_activation",
      state: { requested_phone_number: "+5492634123456" },
      embedded_signup: { enabled: false },
      automation: {
        ...baseContract.automation,
        credential_storage: { ready: true, blocked_operations: ["create_subaccount"], message },
      },
      setup_health: { ...baseContract.setup_health, recommended_next_action: "wait_for_platform_activation" },
    } });
    render(<WhatsappTechProviderOnboarding tenantSlug="junin-1" />);
    expect(await screen.findByTestId("whatsapp-onboarding-primary-status")).toHaveTextContent("Preparación segura pendiente");
    expect(screen.getAllByText("Esperar preparación de Chatboc").length).toBeGreaterThan(0);
    expect(within(screen.getByTestId("whatsapp-primary-action")).getByText(message)).toBeInTheDocument();
    expect(screen.queryByText("Wait For Platform Activation")).not.toBeInTheDocument();
    expect(mockedTenantService.provisionWhatsappTechProvider).not.toHaveBeenCalled();
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
    expect(screen.getByText("Configuración con pendientes")).toBeInTheDocument();
    expect(screen.getByText("Prueba de conexion")).toBeInTheDocument();
    expect(screen.getByText(/Cerrar pendiente: Configurar plantillas, menu y webviews del tenant/i)).toBeInTheDocument();
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
    expect(screen.getByText("78% configurado")).toBeInTheDocument();
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
