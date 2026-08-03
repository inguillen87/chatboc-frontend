import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import WorkflowStudioReadinessCard from "./WorkflowStudioReadinessCard";


const contract = {
  contract_version: "whatsapp.workflow_studio.v1",
  tenant: { id: 7, slug: "demo" },
  mode: "prepublication_read_only",
  capabilities: {
    draft: {
      label: "Borrador del servidor",
      available: true,
      status: "request_only",
      persistent: false,
      description: "No se persiste.",
    },
    validate: {
      label: "Validar grafo",
      available: true,
      status: "ready",
      method: "POST",
      endpoint: "/api/v2/tenants/demo/whatsapp/workflow-studio/validate",
      external_effects: false,
    },
    simulate: {
      label: "Simular recorrido",
      available: true,
      status: "ready",
      method: "POST",
      endpoint: "/api/v2/tenants/demo/whatsapp/workflow-studio/simulate",
      external_effects: false,
      database_writes: false,
    },
    versioning: {
      label: "Versionar workflow",
      available: false,
      status: "blocked",
    },
    runtime: {
      label: "Runtime conversacional",
      available: false,
      status: "blocked",
    },
    publish: {
      label: "Publicar workflow",
      available: false,
      status: "blocked",
    },
    rollback: {
      label: "Volver a una version",
      available: false,
      status: "blocked",
    },
  },
  publication_readiness: {
    ready: false,
    status: "blocked",
    blockers: [
      {
        code: "workflow_durable_storage_missing",
        path: "publication",
        message: "Falta persistencia durable.",
      },
      {
        code: "workflow_version_ledger_missing",
        path: "publication",
        message: "Falta versionado.",
      },
      {
        code: "workflow_runtime_binding_missing",
        path: "publication",
        message: "Falta runtime.",
      },
      {
        code: "workflow_publish_rollback_missing",
        path: "publication",
        message: "Falta publicar y rollback.",
      },
    ],
  },
  side_effect_policy: {
    provider_calls: false,
    messages_sent: false,
    tickets_created: false,
    handoffs_created: false,
  },
  frontend_contract: {
    render_as: "workflow_studio_readiness",
    title: "Estudio de flujos",
    description: "Contrato gobernado por backend.",
    status_label: "Prepublicacion segura",
    blockers_title: "Bloqueos informados por backend",
    safety_note: "No ejecuta efectos.",
    capability_order: ["draft", "validate", "simulate", "versioning", "runtime", "publish", "rollback"],
    status_labels: {
      ready: "Listo para probar",
      request_only: "Solo request",
      blocked: "Bloqueado de verdad",
    },
  },
};


describe("WorkflowStudioReadinessCard", () => {
  it("renders backend-driven readiness and never exposes a publish action", () => {
    render(<WorkflowStudioReadinessCard contract={contract} />);

    const card = screen.getByTestId("whatsapp-workflow-studio-readiness");
    expect(within(card).getByRole("heading", { name: "Estudio de flujos" })).toBeInTheDocument();
    expect(within(card).getByText("Contrato gobernado por backend.")).toBeInTheDocument();
    expect(within(card).getByText("Validar grafo")).toBeInTheDocument();
    expect(within(card).getByText("Simular recorrido")).toBeInTheDocument();
    expect(within(card).getAllByText("Listo para probar")).toHaveLength(2);
    expect(within(card).getAllByText("Bloqueado de verdad")).toHaveLength(4);
    expect(within(card).getByText("Runtime conversacional")).toBeInTheDocument();
    expect(within(card).getByText("workflow_durable_storage_missing")).toBeInTheDocument();
    expect(within(card).getByText("workflow_runtime_binding_missing")).toBeInTheDocument();
    expect(within(card).getByText("No ejecuta efectos.")).toBeInTheDocument();
    expect(within(card).queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing when an older backend does not expose the contract", () => {
    const { container } = render(<WorkflowStudioReadinessCard contract={{}} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("fails closed when the envelope version or safety shape is invalid", () => {
    const { container, rerender } = render(
      <WorkflowStudioReadinessCard contract={{ ...contract, contract_version: "whatsapp.workflow_studio.v2" }} />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <WorkflowStudioReadinessCard
        contract={{ ...contract, side_effect_policy: { ...contract.side_effect_policy, provider_calls: true } }}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
