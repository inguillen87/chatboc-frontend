import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ConversationalFlowReadinessPanel,
  OpsQaCommandCenter,
  TransactionsModulePanel,
} from "./TenantAdminOperatingSystem";

const financeExperience = {
  commerce: {
    checkout_experience: {
      ready: false,
    },
  },
  template_blueprint: {
    operational_template_groups: {
      financial_services: {
        items: [
          { id: "finance_collection_due", status: { approved: true } },
          { id: "finance_secure_payment", status: { approved: true } },
          { id: "finance_document_signature", status: { approved: false } },
        ],
      },
    },
  },
  webview_blueprint: {
    flows: [
      {
        id: "finance_credit_collection_signature",
        label: "Pago y firma",
        status: "ready",
        surface: "signed_webview",
        url_template: "/api/public/finance/payment/{operation_id}",
        server_confirmation: ["payment_webhook", "signature_completed"],
        meta_flow_blueprint: {
          data_contract: ["payment_state", "signature_state"],
          screens: [{ id: "summary", title: "Resumen" }],
        },
      },
    ],
  },
  qa_playbook: {
    scenarios: [
      {
        id: "finance_onboarding_collection_signature",
        label: "Alta, cobranza y firma",
        status: "ready",
      },
    ],
  },
  finance_transactional: {
    enabled: true,
    summary: {
      journeys: 1,
      webview_flows: 1,
      ready_flows: 1,
      qa_scenarios: 1,
      activation_blockers: 2,
      activation_ready_tracks: 1,
    },
    activation_plan: {
      contract_version: "finance.activation_plan.v1",
      go_live_state: "blocked",
      ready_tracks: 1,
      blocking_count: 2,
      required_capabilities: [
        {
          id: "identity_or_kyc_provider",
          label: "Proveedor de identidad/KYC",
          ready: false,
        },
        {
          id: "secure_checkout_or_payment_gateway",
          label: "Checkout o gateway seguro",
          ready: false,
        },
      ],
      launch_tracks: [
        {
          id: "collections_payments_signature",
          label: "Cobranzas, pagos y firma",
          webview_flow: "finance_credit_collection_signature",
          surfaces: ["whatsapp_template", "payment_webview", "signature_flow"],
          required_templates: [
            "finance_collection_due",
            "finance_secure_payment",
            "finance_document_signature",
          ],
          ready: false,
        },
      ],
      next_actions: [
        {
          id: "activate_identity_or_kyc_provider",
          label: "Proveedor de identidad/KYC",
          severity: "blocking",
          owner: "tenant_admin",
          action: "Definir proveedor KYC o modo de revision manual auditada.",
        },
      ],
      setup_questions: [
        { id: "finance_segment", label: "Rubro financiero" },
        { id: "provider_stack", label: "Stack de proveedores" },
      ],
    },
    journeys: [
      {
        id: "collections_payment_plan_signature",
        label: "Cobranza, plan de pago, checkout y firma",
        templates: [
          "finance_collection_due",
          "finance_secure_payment",
          "finance_document_signature",
        ],
        webview_flow: "finance_credit_collection_signature",
        crm_stage: "operacion_transaccional",
        success_event: "crm_operation_updated",
        segments: ["finanzas", "colegios", "municipios"],
        analytics_events: ["collection_opened", "payment_started"],
        ready: false,
      },
    ],
    crm_operating_model: {
      queues: [{ id: "collections", label: "Cobranzas y planes de pago", sla_minutes: 120 }],
    },
    analytics_model: {
      funnels: ["collection_to_payment"],
      risk_signals: ["payment_failed"],
    },
    security_policy: {
      card_data_in_chat_allowed: false,
      identity_data_in_chat_allowed: false,
      requires_server_to_server_confirmation: true,
    },
  },
};

describe("OpsQaCommandCenter", () => {
  it("renders backend E2E flow readiness with manual steps and criteria", () => {
    render(
      <OpsQaCommandCenter
        playbook={{
          contract_version: "tenant.ops_qa.playbook.v1",
          tenant: { slug: "junin" },
          safe_by_default: true,
          status: "warning",
          score: 0.86,
          summary: { checks_total: 1, passed: 1, warnings: 0, critical_failed: 0 },
          checks: [
            {
              id: "whatsapp_webhook",
              label: "Webhook WhatsApp",
              ok: true,
              status: "pass",
              endpoint: "/api/twilio/whatsapp",
              details: {},
            },
          ],
          e2e_flow_readiness: {
            contract_version: "platform.e2e_flow_readiness.v1",
            status: "ready",
            summary: { total: 1, ready: 1 },
            flows: [
              {
                id: "gov_claim_text_to_tracking",
                label: "Municipio: reclamo por WhatsApp",
                surface: "whatsapp",
                ready: true,
                status: "ready",
                endpoint: "/api/public/tracking/experience?kind=claim&code={code}&pin={pin}",
                frontend_entry: "/perfil?tab=tickets",
                qa_scenario_id: "gov_claim_text_to_tracking",
                meta_flow_ready: true,
                evidence: { tickets_recent: 3 },
                manual_test_steps: ["Crear un reclamo por WhatsApp", "Abrir el estado publico"],
                acceptance_criteria: ["El ticket aparece en CRM", "El link publico muestra el estado"],
                automation: { safe_by_default: true, runner: "tenant_ops_qa" },
                next_action: "run_whatsapp_claim_text_to_tracking_and_open_public_status",
                raw: {},
              },
            ],
            frontend_contract: { render_as: "e2e_flow_readiness_grid" },
            raw: {},
          },
          recommended_next_actions: [],
          execution: {},
          frontend_contract: {},
          raw: {},
        }}
        error={null}
        results={{}}
        runningCheckId={null}
        onRunCheck={() => undefined}
      />,
    );

    expect(screen.getByText("Flujos E2E listos para probar y vender")).toBeInTheDocument();
    expect(screen.getByText("Municipio: reclamo por WhatsApp")).toBeInTheDocument();
    expect(screen.getAllByText("/perfil?tab=tickets").length).toBeGreaterThan(0);
    expect(screen.getByText("Crear un reclamo por WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("El ticket aparece en CRM")).toBeInTheDocument();
    expect(screen.getByText("tenant_ops_qa")).toBeInTheDocument();
    expect(screen.getByText("Meta Flow listo")).toBeInTheDocument();
  });
});

describe("ConversationalFlowReadinessPanel", () => {
  it("renders transactional WhatsApp and webview readiness outside the QA playbook", () => {
    render(
      <ConversationalFlowReadinessPanel
        readiness={{
          contract_version: "platform.e2e_flow_readiness.v1",
          status: "needs_attention",
          summary: {
            total: 2,
            ready: 1,
            needs_attention: 1,
            meta_flow_ready: 1,
            qa_scenarios: 2,
            webview_flows: 4,
          },
          flows: [
            {
              id: "gov_claim_text_to_tracking",
              label: "Municipio: reclamo por WhatsApp hasta seguimiento publico",
              surface: "municipios_gobiernos",
              ready: true,
              status: "ready",
              endpoint: "/api/public/tracking/experience?kind=claim&code={code}&pin={pin}",
              frontend_entry: "/perfil?tab=tickets",
              qa_scenario_id: "gov_claim_text_to_tracking",
              meta_flow_ready: true,
              evidence: { tickets_recent: 3, open_tickets: 1 },
              manual_test_steps: [],
              acceptance_criteria: [],
              automation: { safe_by_default: true },
              next_action: "run_whatsapp_claim_text_to_tracking_and_open_public_status",
              raw: {},
            },
            {
              id: "pyme_catalog_order_checkout",
              label: "Pyme: catalogo, carrito, pedido y checkout",
              surface: "pymes_empresas",
              ready: false,
              status: "needs_attention",
              endpoint: "/api/v2/catalog/quality",
              frontend_entry: "/t/junin/market",
              qa_scenario_id: "pyme_catalog_order_checkout",
              meta_flow_ready: false,
              evidence: { products: 0, checkout_ready: false },
              manual_test_steps: [],
              acceptance_criteria: [],
              automation: { safe_by_default: true },
              next_action: "run_catalog_order_checkout_smoke_with_demo_tenant",
              raw: {},
            },
          ],
          frontend_contract: { render_as: "e2e_flow_readiness_grid" },
          raw: {},
        }}
      />,
    );

    expect(screen.getByText("Webviews y flujos conversacionales")).toBeInTheDocument();
    expect(screen.getByText("1/2 listos")).toBeInTheDocument();
    expect(screen.getByText("4 webviews")).toBeInTheDocument();
    expect(screen.getByText("Municipio: reclamo por WhatsApp hasta seguimiento publico")).toBeInTheDocument();
    expect(screen.getByText("Pyme: catalogo, carrito, pedido y checkout")).toBeInTheDocument();
    expect(screen.getByText("tickets recent: 3")).toBeInTheDocument();
    expect(screen.getByText("Flow pendiente")).toBeInTheDocument();
  });
});

describe("TransactionsModulePanel", () => {
  it("renders the finance activation plan from the backend contract", () => {
    render(<TransactionsModulePanel experience={financeExperience} />);

    expect(screen.getByText("Plan de salida a produccion finance")).toBeInTheDocument();
    expect(screen.getByText("Cobranzas, pagos y firma")).toBeInTheDocument();
    expect(screen.getAllByText("Proveedor de identidad/KYC").length).toBeGreaterThan(0);
    expect(screen.getByText("Checkout o gateway seguro")).toBeInTheDocument();
    expect(screen.getByText("Rubro financiero")).toBeInTheDocument();
  });
});
