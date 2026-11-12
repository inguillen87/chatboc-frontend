import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const simulationMocks = vi.hoisted(() => ({ simulate: vi.fn() }));
vi.mock("@/api/v2/whatsappWorkflowSimulation", () => ({ simulateWhatsappWorkflow: simulationMocks.simulate }));

import WorkflowStudioSimulator from "./WorkflowStudioSimulator";
import { parseWhatsappWorkflowStudioContract, type WhatsappWorkflowStudioDurableContract } from "@/api/v2/whatsappWorkflowStudio";
import {
  draftDocument,
  makeBlockedWorkflowSimulation,
  makeDurableWorkflowStudioContract,
  makeWorkflowSimulation,
} from "./workflowStudioTestFixtures";

const props = () => ({
  contract: parseWhatsappWorkflowStudioContract(makeDurableWorkflowStudioContract()) as WhatsappWorkflowStudioDurableContract,
  expectedTenantSlug: "demo",
  draftJson: JSON.stringify(draftDocument),
});
const enterMessage = (message = "Necesito asistencia") => fireEvent.change(screen.getByLabelText("Mensaje de prueba"), { target: { value: message } });
const run = () => fireEvent.click(screen.getByRole("button", { name: "Probar mensaje" }));
const deferred = () => {
  let resolve!: (value: ReturnType<typeof makeWorkflowSimulation>) => void;
  const promise = new Promise<ReturnType<typeof makeWorkflowSimulation>>((accept) => { resolve = accept; });
  return { promise, resolve };
};

describe("WorkflowStudioSimulator", () => {
  beforeEach(() => simulationMocks.simulate.mockReset());

  it("runs the editor draft and renders backend trace/effects as predictions", async () => {
    simulationMocks.simulate.mockResolvedValue(makeWorkflowSimulation());
    render(<WorkflowStudioSimulator {...props()} />);
    expect(screen.getByText(/No envía mensajes ni crea casos reales/)).toBeInTheDocument();
    enterMessage();
    fireEvent.change(screen.getByLabelText("Tipo de mensaje"), { target: { value: "image" } });
    fireEvent.change(screen.getByLabelText("Idioma del contacto"), { target: { value: "es" } });
    fireEvent.change(screen.getByLabelText("Identificador del broadcast"), { target: { value: "campaign-7" } });
    run();

    expect(await screen.findByRole("status")).toHaveTextContent("Prueba completada");
    expect(simulationMocks.simulate).toHaveBeenCalledWith(expect.objectContaining({
      draft: draftDocument, expectedTenantSlug: "demo",
      event: { message: { type: "image", text: "Necesito asistencia" }, contact: { language: "es" }, broadcast_id: "campaign-7" },
      isCurrent: expect.any(Function),
    }));
    expect(within(screen.getByRole("list", { name: "Traza de la prueba" })).getAllByRole("listitem")).toHaveLength(2);
    expect(within(screen.getByRole("list", { name: "Efectos previstos" })).getByText(/categoría: arbolado/)).toBeInTheDocument();
  });

  it("shows backend validation blockers and distinguishes a non-matching trigger", async () => {
    simulationMocks.simulate.mockResolvedValueOnce(makeBlockedWorkflowSimulation()).mockResolvedValueOnce({
      ...makeWorkflowSimulation(), status: "not_triggered", trace: [], proposed_effects: [],
      trigger: { matched: false, reason: "broadcast_reply_not_matched" },
    });
    render(<WorkflowStudioSimulator {...props()} />);
    enterMessage(); run();
    expect(await screen.findByRole("status")).toHaveTextContent("Prueba bloqueada");
    expect(screen.getByRole("list", { name: "Bloqueos de la prueba" })).toHaveTextContent("Este campo es obligatorio. (draft.name)");
    run();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("El mensaje no activó el flujo"));
    expect(screen.queryByRole("list", { name: "Bloqueos de la prueba" })).not.toBeInTheDocument();
    expect(screen.getByText("Sin efectos previstos.")).toBeInTheDocument();
  });

  it("validates draft JSON locally and allows retry after a transport failure", async () => {
    const input = props();
    const { rerender } = render(<WorkflowStudioSimulator {...input} draftJson="{" />);
    enterMessage(); run();
    expect(await screen.findByRole("alert")).toHaveTextContent("El borrador debe ser un objeto JSON valido.");
    expect(simulationMocks.simulate).not.toHaveBeenCalled();
    rerender(<WorkflowStudioSimulator {...input} />);
    simulationMocks.simulate.mockRejectedValueOnce(new Error("Sin conexión")).mockResolvedValueOnce(makeWorkflowSimulation());
    run();
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión");
    run();
    expect(await screen.findByRole("status")).toHaveTextContent("Prueba completada");
  });

  it("invalidates pending and visible results when the draft changes, including A→B→A", async () => {
    const old = deferred();
    simulationMocks.simulate.mockReturnValueOnce(old.promise);
    const input = props();
    const { rerender } = render(<WorkflowStudioSimulator {...input} />);
    enterMessage(); run();
    const guard = simulationMocks.simulate.mock.calls[0][0].isCurrent;
    rerender(<WorkflowStudioSimulator {...input} draftJson={JSON.stringify({ ...draftDocument, name: "Otro borrador" })} />);
    rerender(<WorkflowStudioSimulator {...input} />);
    expect(guard()).toBe(false);
    await act(async () => old.resolve(makeWorkflowSimulation()));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    simulationMocks.simulate.mockResolvedValueOnce(makeWorkflowSimulation());
    run();
    expect(await screen.findByRole("status")).toHaveTextContent("Prueba completada");
    rerender(<WorkflowStudioSimulator {...input} draftJson={JSON.stringify({ ...draftDocument, name: "Nuevo" })} />);
    expect(screen.queryByRole("list", { name: "Efectos previstos" })).not.toBeInTheDocument();
  });

  it("reset clears only the test and suppresses a pending response even after identical input", async () => {
    const old = deferred();
    simulationMocks.simulate.mockReturnValueOnce(old.promise).mockResolvedValueOnce({
      ...makeWorkflowSimulation(), proposed_effects: [{ type: "handoff", queue: "nueva-cola", execution: "proposed_only" }],
    });
    render(<WorkflowStudioSimulator {...props()} />);
    enterMessage(); run();
    const guard = simulationMocks.simulate.mock.calls[0][0].isCurrent;
    fireEvent.click(screen.getByRole("button", { name: "Reiniciar prueba" }));
    expect(screen.getByLabelText("Mensaje de prueba")).toHaveValue("");
    expect(guard()).toBe(false);
    enterMessage(); run();
    expect(await screen.findByText(/nueva-cola/)).toBeInTheDocument();
    await act(async () => old.resolve(makeWorkflowSimulation()));
    expect(screen.queryByText(/categoría: arbolado/)).not.toBeInTheDocument();
    expect(screen.getByText(/nueva-cola/)).toBeInTheDocument();
  });

  it("revokes the in-flight guard on unmount or disabled state", async () => {
    const first = deferred();
    const second = deferred();
    simulationMocks.simulate.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const input = props();
    const { rerender, unmount } = render(<WorkflowStudioSimulator {...input} />);
    enterMessage(); run();
    const firstGuard = simulationMocks.simulate.mock.calls[0][0].isCurrent;
    rerender(<WorkflowStudioSimulator {...input} disabled />);
    expect(firstGuard()).toBe(false);
    expect(screen.getByRole("button", { name: "Probar mensaje" })).toBeDisabled();
    rerender(<WorkflowStudioSimulator {...input} />);
    run();
    const secondGuard = simulationMocks.simulate.mock.calls[1][0].isCurrent;
    unmount();
    expect(secondGuard()).toBe(false);
    await act(async () => { first.resolve(makeWorkflowSimulation()); second.resolve(makeWorkflowSimulation()); });
  });
});
