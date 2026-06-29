import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TransactionsModulePanel } from "./TenantAdminOperatingSystem";

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
