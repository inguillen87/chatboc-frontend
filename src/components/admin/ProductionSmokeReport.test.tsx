import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getProductionSmokeV2, normalizeProductionSmokeV2, type ProductionSmokeV2 } from "@/api/v2/saas";
import ProductionSmokeReport from "./ProductionSmokeReport";

vi.mock("@/api/v2/saas", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/v2/saas")>();
  return { ...actual, getProductionSmokeV2: vi.fn() };
});
const getSmoke = vi.mocked(getProductionSmokeV2);

const producerFixture = () => ({
  contract_version: "platform.production_smoke.v1",
  status: "pass",
  generated_at: "2026-10-13T12:00:00+00:00",
  tenant: { id: 42, slug: "demo-org", nombre: "Organización de prueba", tipo: "pyme", is_active: true },
  summary: { total: 7, passed: 7, failed: 0, critical_failed: 0, e2e_flows_total: 8, e2e_flows_ready: 8 },
  checks: [
    { id: "routes_registered", label: "Rutas criticas registradas", details: { routes: { "/private-route": true } } },
    { id: "widget_platform_onboarding", label: "Widget landing selector plataforma", details: { tenant: { secret: "private-widget-details" } } },
    { id: "socket_disabled_for_landing", label: "Socket.IO no se abre sin contrato valido", details: { realtime: { socket_url: "https://private.invalid" } } },
    { id: "tenant_admin_experience", label: "Tenant Admin OS listo", details: { modules: ["private-module"] } },
    { id: "catalog_quality", label: "Marketplace quality e imagenes", details: { summary: { private: "private-catalog-details" } } },
    { id: "whatsapp_operations", label: "WhatsApp Operations Hub", details: { channel_enabled: false, voice_enabled: false } },
    { id: "inbox_360", label: "Inbox 360 drawer contract", details: { has_ticket: false, ticket_id: null } },
  ].map((check) => ({ ...check, ok: true, status: "pass", severity: "critical", endpoint: "/internal/contract" })),
  e2e_flow_readiness: {
    contract_version: "platform.e2e_flow_readiness.v1",
    status: "ready",
    summary: { total: 8, ready: 8, needs_attention: 0, meta_flow_ready: 7 },
    flows: [
      { id: "gov_claim_text_to_tracking", label: "Municipio: reclamo por WhatsApp hasta seguimiento publico", surface: "municipios_gobiernos", evidence: { tickets_recent: 0, open_tickets: 0, tracking_contract: "private-tracking-contract" }, next_action: "run_whatsapp_claim_text_to_tracking_and_open_public_status" },
      { id: "claim_live_or_offline_helpdesk", label: "Mesa de ayuda: chat en vivo u offline del reclamo", surface: "municipios_gobiernos", evidence: { pin_required: true, working_hours_configurable: true }, next_action: "validate_public_claim_message_reaches_admin_inbox" },
      { id: "pyme_catalog_order_checkout", label: "Pyme: catalogo, carrito, pedido y checkout", surface: "pymes_empresas", evidence: { products: 2, ready_to_sell: 1, checkout_ready: false }, next_action: "run_catalog_order_checkout_smoke_with_demo_tenant" },
      { id: "survey_vote_realtime", label: "Encuestas y votaciones con resultado en vivo", surface: "gobiernos_empresas_colegios", evidence: { surveys: 0, active: 0, responses: 0 }, next_action: "publish_demo_survey_and_verify_live_results_heatmap" },
      { id: "school_family_case", label: "Colegios: familia, cuota, comprobante y caso administrativo", surface: "colegios_educacion", evidence: { education_profile: { private_name: "private-family", phone: "private-phone" } }, next_action: "run_school_payment_receipt_and_family_case_demo" },
      { id: "finance_in_chat_transactional", label: "Finance in-chat: alta, KYC, cobranza, pago y firma", surface: "finanzas_pymes_gobiernos_colegios", evidence: { checkout_ready: false, ready_journeys: 2, finance_runtime: "private-runtime" }, next_action: "run_finance_onboarding_collection_signature_smoke" },
      { id: "finance_servicing_transfer_insurance", label: "Finance avanzado: estado de cuenta, remesas, seguros y financiacion", surface: "finanzas_banca_seguros", evidence: { journeys: 6, ready_journeys: 4, webview_flows: ["private-flow"] }, next_action: "run_finance_servicing_transfer_insurance_smoke" },
      { id: "analytics_heatmap", label: "Analitica: mapa de calor, territorios y frescura operacional", surface: "analytics_maps", evidence: { can_render_heatmap: false, freshness_status: "empty", realtime_sources: ["private-source"] }, next_action: "collect_geocoded_claims_orders_and_render_heatmap_layers" },
    ].map((flow) => ({
      ...flow,
      ready: true,
      status: "ready",
      meta_flow_ready: flow.id === "analytics_heatmap" ? null : true,
      endpoint: "/api/public/tracking/claims/{ticket_id}/messages",
      frontend_entry: "/t/{tenant_slug}/tracking?pin={pin}",
      manual_test_steps: ["Paso recibido del backend: ejecutar la prueba manual."],
      acceptance_criteria: ["Criterio recibido del backend: verificar evidencia externa."],
      automation: { safe_by_default: true, live_side_effects: false, uses_real_whatsapp: false },
    })),
    frontend_contract: { render_as: "e2e_flow_readiness_grid" },
  },
  frontend_contract: { render_as: "production_smoke_report" },
});

const resolveFixture = (fixture: unknown = producerFixture()) => getSmoke.mockResolvedValue(normalizeProductionSmokeV2(fixture));
const loaded = () => screen.findByText("Organización de prueba (demo-org)");

beforeEach(() => getSmoke.mockReset());

describe("ProductionSmokeReport producer contract presentation", () => {
  it("distinguishes pass contracts with disabled WhatsApp and an empty inbox from operating acceptance", async () => {
    resolveFixture();
    const { container } = render(<ProductionSmokeReport />);
    await loaded();

    expect(getSmoke).toHaveBeenCalledWith(null);
    expect(screen.getByRole("heading", { name: "Comprobaciones de contratos" })).toBeInTheDocument();
    expect(screen.getByText(/no acreditan entrega de WhatsApp, cobros ni aceptación operativa/)).toBeInTheDocument();
    expect(screen.getByText(/no representa una prueba de toda la plataforma/)).toBeInTheDocument();
    expect(container.querySelector("time")).toHaveAttribute("dateTime", "2026-10-13T12:00:00+00:00");
    expect(container.querySelector("time")).toHaveTextContent("13/10/2026, 09:00:00 (Argentina)");
    expect(screen.getByRole("status")).toHaveTextContent("Controles conformes");

    const controls = screen.getByRole("region", { name: "Controles de contratos" });
    expect(within(controls).getAllByRole("listitem")).toHaveLength(7);
    const whatsapp = screen.getByRole("heading", { name: "WhatsApp Operations Hub" }).closest("li")!;
    expect(within(whatsapp).getAllByText("Deshabilitado")).toHaveLength(2);
    expect(within(whatsapp).getByText("Controles conformes")).toBeInTheDocument();
    const inbox = screen.getByRole("heading", { name: "Inbox 360 drawer contract" }).closest("li")!;
    expect(within(inbox).getByText("No incluido")).toBeInTheDocument();
    expect(screen.queryByText(/^Listo$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Experiencias end-to-end/)).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(container.textContent).not.toMatch(/private-|\{ticket_id\}|\{tenant_slug\}|\{pin\}/);
    expect(screen.getByRole("progressbar", { name: "Proporción de controles conformes" })).toHaveAttribute("aria-valuetext", "7 de 7 (100%)");
  });

  it("preserves backend manual steps and criteria behind native disclosure, with typed evidence", async () => {
    resolveFixture();
    render(<ProductionSmokeReport tenantSlug="demo-org" />);
    await loaded();
    const survey = screen.getByRole("heading", { name: "Encuestas y votaciones con resultado en vivo" }).closest("li")!;
    const details = survey.querySelector("details")!;
    expect(details).not.toHaveAttribute("open");
    expect(within(survey).getByText(/Probar una encuesta de demostración y verificar sus resultados/)).toBeInTheDocument();
    details.setAttribute("open", "");
    expect(within(details).getAllByRole("list")).toHaveLength(2);
    expect(within(details).getByText("Paso recibido del backend: ejecutar la prueba manual.")).toBeInTheDocument();
    expect(within(details).getByText("Criterio recibido del backend: verificar evidencia externa.")).toBeInTheDocument();
    expect(within(details).getByText("Encuestas activas").nextElementSibling).toHaveTextContent("0");
    expect(within(details).getByText("Respuestas").nextElementSibling).toHaveTextContent("0");
    const catalog = screen.getByRole("heading", { name: "Pyme: catalogo, carrito, pedido y checkout" }).closest("li")!;
    expect(within(catalog).getByText("Productos con preparación registrada").nextElementSibling).toHaveTextContent("1");
    expect(screen.getByText(/Blueprint de Meta Flow: Sin dato informado/)).toBeInTheDocument();
  });

  it("keeps unknown codes and malformed evidence neutral without object dumps or fabricated counts", async () => {
    const fixture: any = producerFixture();
    fixture.status = "loading";
    fixture.generated_at = "not-a-timestamp";
    fixture.summary = { total: "7", passed: {}, failed: -1, critical_failed: null };
    fixture.checks = [null, 23, { id: "private-check-code", label: { secret: "private-label" }, ok: "false", status: "pass", severity: "constructor", details: { secret: "private-details" } }];
    fixture.e2e_flow_readiness.status = "constructor";
    fixture.e2e_flow_readiness.summary = {};
    fixture.e2e_flow_readiness.flows = [
      { id: "private-flow-code", label: null, surface: "constructor", ready: "true", status: "ready", meta_flow_ready: "false", next_action: "constructor", evidence: { active: 28, education_profile: { name: "private-person" } }, manual_test_steps: [null, { secret: "private-guidance" }], acceptance_criteria: [12, {}] },
      { id: "survey_vote_realtime", label: "Encuesta con evidencia inválida", ready: false, status: "needs_attention", meta_flow_ready: false, evidence: { surveys: "0", active: -1, responses: { private: "private-response" }, mystery: "private-evidence" } },
    ];
    resolveFixture(fixture);
    const { container } = render(<ProductionSmokeReport />);
    await loaded();
    expect(screen.getByRole("status")).toHaveTextContent("Sin resultado informado");
    expect(screen.getByText("Fecha no informada")).toBeInTheDocument();
    expect(screen.getByText("Control sin nombre informado")).toBeInTheDocument();
    expect(screen.getByText("Recorrido sin nombre informado")).toBeInTheDocument();
    expect(screen.getAllByText("Área no informada")).toHaveLength(2);
    expect(screen.getAllByText(/Siguiente paso no informado/)).toHaveLength(2);
    expect(screen.getAllByText("Guía manual no informada.")).toHaveLength(2);
    expect(screen.getAllByText("Criterios de aceptación no informados.")).toHaveLength(2);
    expect(screen.getAllByText("Proporción no informada")).toHaveLength(2);
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/private-|constructor|\[object Object\]|\{"/);
    const survey = screen.getByRole("heading", { name: "Encuesta con evidencia inválida" }).closest("li")!;
    expect(within(survey).getByText("Encuestas activas").nextElementSibling).toHaveTextContent("Sin dato informado");
    expect(within(survey).getByText(/Blueprint de Meta Flow: Por revisar/)).toBeInTheDocument();
  });

  it.each([undefined, "platform.production_smoke.v99"])("separates unrecognized smoke contract %s from failed controls", async (contractVersion) => {
    resolveFixture({ ...producerFixture(), contract_version: contractVersion });
    render(<ProductionSmokeReport />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Contrato de comprobación no reconocido");
    expect(screen.queryByText("Controles informados")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
  });

  it("only exposes controls that do not require an organization when scope is absent", async () => {
    resolveFixture({ ...producerFixture(), tenant: null, generated_at: null, summary: {} });
    render(<ProductionSmokeReport />);
    await screen.findByText("Organización no informada");
    expect(screen.getByText(/solo se muestran controles que no requieren una organización/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rutas criticas registradas" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "WhatsApp Operations Hub" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Encuestas y votaciones con resultado en vivo" })).not.toBeInTheDocument();
    expect(screen.getByText(/Se requiere una organización informada/)).toBeInTheDocument();
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
  });

  it("withholds aggregates containing tenant controls when tenant identity is missing", async () => {
    resolveFixture({ ...producerFixture(), tenant: null });
    render(<ProductionSmokeReport />);
    await screen.findByText("Organización no informada");
    expect(within(screen.getByRole("region", { name: "Controles de contratos" })).getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByRole("status")).toHaveTextContent("Sin resultado informado");
    expect(screen.getAllByText("Sin dato informado")).toHaveLength(4);
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^7$/)).not.toBeInTheDocument();
  });

  it("retains producer aggregates for a complete set of organization-independent controls", async () => {
    const fixture = producerFixture();
    resolveFixture({ ...fixture, tenant: null, checks: fixture.checks.slice(0, 3), summary: { total: 3, passed: 3, failed: 0, critical_failed: 0 } });
    render(<ProductionSmokeReport />);
    await screen.findByText("Organización no informada");
    expect(screen.getByRole("status")).toHaveTextContent("Controles conformes");
    expect(screen.getByRole("progressbar", { name: "Proporción de controles conformes" })).toHaveAttribute("aria-valuetext", "3 de 3 (100%)");
    expect(screen.queryByRole("progressbar", { name: "Proporción de flujos con preparación registrada" })).not.toBeInTheDocument();
  });

  it.each([
    { name: "a reported name without organization identity", tenant: { nombre: "Unidentified reported name" }, empty: false },
    { name: "no received checks", tenant: null, empty: true },
  ])("does not infer scoped aggregates from $name", async ({ tenant, empty }) => {
    const fixture = producerFixture();
    resolveFixture({ ...fixture, tenant, checks: empty ? [] : fixture.checks });
    render(<ProductionSmokeReport />);
    await screen.findByText("Organización no informada");
    expect(screen.getByRole("status")).toHaveTextContent("Sin resultado informado");
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^7$/)).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "WhatsApp Operations Hub" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Encuestas y votaciones con resultado en vivo" })).not.toBeInTheDocument();
  });

  it("does not attach a producer aggregate to an incomplete organization-independent list", async () => {
    const fixture = producerFixture();
    resolveFixture({ ...fixture, tenant: null, checks: fixture.checks.slice(0, 3) });
    render(<ProductionSmokeReport />);
    await screen.findByText("Organización no informada");
    expect(screen.getByRole("status")).toHaveTextContent("Sin resultado informado");
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(screen.queryByText(/^7$/)).not.toBeInTheDocument();
  });

  it("withholds results when the returned organization differs from the requested organization", async () => {
    resolveFixture();
    render(<ProductionSmokeReport tenantSlug="other-org" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("La respuesta corresponde a otra organización");
    expect(screen.queryByText("Controles informados")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "WhatsApp Operations Hub" })).not.toBeInTheDocument();
  });

  it("withholds scoped results when a named organization has no reported slug", async () => {
    resolveFixture({ ...producerFixture(), tenant: { nombre: "Organización de prueba" } });
    render(<ProductionSmokeReport tenantSlug="demo-org" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("La respuesta no informa la identidad de la organización solicitada");
    expect(screen.getByRole("alert")).not.toHaveTextContent("otra organización");
    expect(screen.queryByText("Controles informados")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "WhatsApp Operations Hub" })).not.toBeInTheDocument();
  });

  it("shows query failure without zero metrics and retries exactly the same read scope", async () => {
    getSmoke.mockRejectedValueOnce(new Error("Acceso denegado"));
    render(<ProductionSmokeReport tenantSlug="demo-org" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Consulta no disponible");
    expect(screen.getByRole("alert")).toHaveTextContent("Acceso denegado");
    expect(screen.queryByText("Controles informados")).not.toBeInTheDocument();
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
    resolveFixture();
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await loaded();
    expect(getSmoke.mock.calls).toEqual([["demo-org"], ["demo-org"]]);
  });

  it("retires the previous tenant request and removes previous metrics while a new tenant loads", async () => {
    let resolveOld!: (data: ProductionSmokeV2) => void;
    let resolveNew!: (data: ProductionSmokeV2) => void;
    getSmoke.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    getSmoke.mockImplementationOnce(() => new Promise((resolve) => { resolveNew = resolve; }));
    const { rerender } = render(<ProductionSmokeReport tenantSlug="demo-org" />);
    rerender(<ProductionSmokeReport tenantSlug="new-org" />);
    expect(screen.getByRole("status")).toHaveTextContent("Consultando");
    expect(screen.queryByText("Controles informados")).not.toBeInTheDocument();
    await act(async () => {
      resolveNew(normalizeProductionSmokeV2({ ...producerFixture(), tenant: { slug: "new-org", nombre: "Organización nueva" } }));
    });
    await screen.findByText("Organización nueva (new-org)");
    await act(async () => { resolveOld(normalizeProductionSmokeV2(producerFixture())); });
    expect(screen.getByText("Organización nueva (new-org)")).toBeInTheDocument();
    expect(screen.queryByText("Organización de prueba (demo-org)")).not.toBeInTheDocument();
    expect(getSmoke.mock.calls).toEqual([["demo-org"], ["new-org"]]);
  });

  it("removes loaded metrics immediately when the requested tenant changes", async () => {
    resolveFixture();
    const { rerender } = render(<ProductionSmokeReport tenantSlug="demo-org" />);
    await loaded();
    getSmoke.mockImplementationOnce(() => new Promise(() => undefined));
    rerender(<ProductionSmokeReport tenantSlug="new-org" />);
    expect(screen.getByRole("status")).toHaveTextContent("Consultando");
    expect(screen.queryByText("Organización de prueba (demo-org)")).not.toBeInTheDocument();
    expect(screen.queryByText("Controles informados")).not.toBeInTheDocument();
    await waitFor(() => expect(getSmoke).toHaveBeenLastCalledWith("new-org"));
  });

  it("preserves explicit zero counts without inventing a zero-denominator progress ratio", async () => {
    resolveFixture({ ...producerFixture(), summary: { total: 0, passed: 0, failed: 0, critical_failed: 0 }, checks: [], e2e_flow_readiness: null });
    render(<ProductionSmokeReport />);
    await loaded();
    expect(screen.getAllByText(/^0$/)).toHaveLength(4);
    expect(screen.getByText("Proporción no informada")).toBeInTheDocument();
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
    expect(screen.getByText("Preparación de flujos no informada.")).toBeInTheDocument();
    expect(screen.getByText("No hay controles informados para este alcance.")).toBeInTheDocument();
  });

  it("keeps an incompatible preparation contract distinct from absent readiness", async () => {
    const fixture = producerFixture();
    fixture.e2e_flow_readiness.contract_version = "platform.e2e_flow_readiness.v99";
    resolveFixture(fixture);
    render(<ProductionSmokeReport />);
    await loaded();
    expect(screen.getByText("Contrato de preparación de flujos no reconocido.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Encuestas y votaciones con resultado en vivo" })).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: "Proporción de flujos con preparación registrada" })).not.toBeInTheDocument();
  });
});
