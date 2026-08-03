import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const workflowApiMocks = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  save: vi.fn(),
  review: vi.fn(),
  publish: vi.fn(),
  rollback: vi.fn(),
  createKey: vi.fn(),
}));

vi.mock("@/api/v2/whatsappWorkflowStudio", async () => {
  const actual = await vi.importActual<typeof import("@/api/v2/whatsappWorkflowStudio")>(
    "@/api/v2/whatsappWorkflowStudio",
  );
  return {
    ...actual,
    listWhatsappWorkflowLedgers: workflowApiMocks.list,
    getWhatsappWorkflowLedger: workflowApiMocks.get,
    saveWhatsappWorkflowDraft: workflowApiMocks.save,
    reviewWhatsappWorkflow: workflowApiMocks.review,
    publishWhatsappWorkflow: workflowApiMocks.publish,
    rollbackWhatsappWorkflow: workflowApiMocks.rollback,
    createWhatsappWorkflowIdempotencyKey: workflowApiMocks.createKey,
  };
});

import WorkflowStudioControlPlanePanel from "./WorkflowStudioControlPlanePanel";
import {
  ACTIVATION_ID,
  DRAFT_ID,
  VERSION_ID,
  WORKFLOW_ID,
  approvedPublishReview,
  makeDraftReceipt,
  makeDurableWorkflowStudioContract,
  makeLedger,
  makeLedgerList,
  makePublicationReceipt,
} from "./workflowStudioTestFixtures";

const ROLLBACK_REVIEW_ID = "00000000-0000-4000-8000-000000000006";
const WORKFLOW_B_ID = "00000000-0000-4000-8000-000000000011";
const DRAFT_B_ID = "00000000-0000-4000-8000-000000000012";
const NEW_WORKFLOW_VALUE_FOR_TEST = "__new_workflow__";

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

const makeLedgerFor = (workflowId: string, draftId: string, name: string) => {
  const base = makeLedger();
  return {
    ...base,
    workflow_id: workflowId,
    latest_draft_revision: {
      ...base.latest_draft_revision,
      workflow_id: workflowId,
      draft_revision_id: draftId,
      draft: { ...base.latest_draft_revision.draft, name },
    },
    draft_revisions: base.draft_revisions.map((draft) => ({
      ...draft,
      workflow_id: workflowId,
      draft_revision_id: draftId,
    })),
    reviews: [],
  };
};

const makePublishedLedger = () => {
  const publication = makePublicationReceipt();
  return {
    ...makeLedger(),
    reviews: [
      approvedPublishReview,
      {
        ...approvedPublishReview,
        review_id: ROLLBACK_REVIEW_ID,
        operation: "rollback",
        subject_type: "published_version",
        subject_id: VERSION_ID,
        reviewed_at: "2026-08-02T12:12:00+00:00",
      },
    ],
    published_versions: [publication.version],
    activations: [publication.activation],
    active_version_id: VERSION_ID,
  };
};

describe("WorkflowStudioControlPlanePanel", () => {
  beforeEach(() => {
    Object.values(workflowApiMocks).forEach((mock) => mock.mockReset());
    workflowApiMocks.list.mockResolvedValue(makeLedgerList());
    workflowApiMocks.get.mockResolvedValue(makeLedger());
    workflowApiMocks.createKey.mockReturnValue("wf:00000000-0000-4000-8000-000000000099");
  });

  it("renders only after the durable capability and tenant scope both reconcile", async () => {
    const contract = makeDurableWorkflowStudioContract();
    const { container, rerender } = render(
      <WorkflowStudioControlPlanePanel contract={contract} expectedTenantSlug="foreign" />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(workflowApiMocks.list).not.toHaveBeenCalled();

    rerender(<WorkflowStudioControlPlanePanel contract={contract} expectedTenantSlug="demo" />);

    expect(await screen.findByTestId("workflow-control-plane")).toBeInTheDocument();
    expect(screen.getByText(/Plano de control gobernado/)).toHaveTextContent("demo");
    expect(workflowApiMocks.list).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the durable gate is disabled", () => {
    const contract = makeDurableWorkflowStudioContract();
    const { container } = render(
      <WorkflowStudioControlPlanePanel
        expectedTenantSlug="demo"
        contract={{
          ...contract,
          durable_control_plane_gate: {
            ...contract.durable_control_plane_gate,
            available: false,
            enabled: false,
            reason_codes: ["workflow_durable_control_plane_disabled"],
          },
        }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(workflowApiMocks.list).not.toHaveBeenCalled();
  });

  it("states the append-only, control-plane-only and disconnected-runtime truth", async () => {
    render(
      <WorkflowStudioControlPlanePanel
        contract={makeDurableWorkflowStudioContract()}
        expectedTenantSlug="demo"
      />,
    );

    const panel = await screen.findByTestId("workflow-control-plane");
    expect(within(panel).getAllByText("Plano de control durable").length).toBeGreaterThan(0);
    expect(within(panel).getByText(/El runtime sigue desconectado/)).toBeInTheDocument();
    expect(within(panel).getByText(/provider_calls: false/)).toBeInTheDocument();
    expect(within(panel).queryByText(/workflow live/i)).not.toBeInTheDocument();
  });

  it("reuses one in-memory idempotency key after an ambiguous draft failure", async () => {
    workflowApiMocks.save
      .mockRejectedValueOnce(new Error("Respuesta incierta"))
      .mockResolvedValueOnce(makeDraftReceipt(false));

    render(
      <WorkflowStudioControlPlanePanel
        contract={makeDurableWorkflowStudioContract()}
        expectedTenantSlug="demo"
      />,
    );
    await screen.findByTestId("workflow-control-plane");

    fireEvent.click(screen.getByRole("button", { name: "Borrador durable" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("misma clave");

    fireEvent.click(screen.getByRole("button", { name: "Borrador durable" }));
    await waitFor(() => expect(workflowApiMocks.save).toHaveBeenCalledTimes(2));

    expect(workflowApiMocks.createKey).toHaveBeenCalledTimes(1);
    expect(workflowApiMocks.save.mock.calls[0]?.[0].idempotencyKey).toBe(
      workflowApiMocks.save.mock.calls[1]?.[0].idempotencyKey,
    );
  });

  it("ignores a same-tenant workflow A response that arrives after workflow B", async () => {
    const requestA = deferred<ReturnType<typeof makeLedger>>();
    const requestB = deferred<ReturnType<typeof makeLedger>>();
    const ledgerA = makeLedgerFor(WORKFLOW_ID, DRAFT_ID, "Workflow A");
    const ledgerB = makeLedgerFor(WORKFLOW_B_ID, DRAFT_B_ID, "Workflow B");
    workflowApiMocks.list.mockResolvedValue({
      ...makeLedgerList(),
      workflows: [
        makeLedgerList().workflows[0],
        {
          workflow_id: WORKFLOW_B_ID,
          name: "Workflow B",
          latest_draft_revision: 1,
          published_version_count: 0,
          active_version_id: null,
        },
      ],
    });
    workflowApiMocks.get.mockImplementation(
      (_contract, _slug, workflowId: string) =>
        workflowId === WORKFLOW_ID ? requestA.promise : requestB.promise,
    );

    render(
      <WorkflowStudioControlPlanePanel
        contract={makeDurableWorkflowStudioContract()}
        expectedTenantSlug="demo"
      />,
    );
    await waitFor(() => expect(workflowApiMocks.list).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Workflow del tenant"), {
      target: { value: WORKFLOW_ID },
    });
    fireEvent.change(screen.getByLabelText("Workflow del tenant"), {
      target: { value: WORKFLOW_B_ID },
    });
    await act(async () => requestB.resolve(ledgerB));
    await waitFor(() =>
      expect((screen.getByLabelText("Borrador JSON") as HTMLTextAreaElement).value).toContain("Workflow B"),
    );

    await act(async () => requestA.resolve(ledgerA));
    expect(screen.getByLabelText("Workflow del tenant")).toHaveValue(WORKFLOW_B_ID);
    expect((screen.getByLabelText("Borrador JSON") as HTMLTextAreaElement).value).toContain("Workflow B");
  });

  it("keeps mutation controls blocked when stale workflow A resolves while B is pending", async () => {
    const requestA = deferred<ReturnType<typeof makeLedger>>();
    const requestB = deferred<ReturnType<typeof makeLedger>>();
    const ledgerA = makeLedgerFor(WORKFLOW_ID, DRAFT_ID, "Workflow A");
    const ledgerB = makeLedgerFor(WORKFLOW_B_ID, DRAFT_B_ID, "Workflow B");
    workflowApiMocks.list.mockResolvedValue({
      ...makeLedgerList(),
      workflows: [
        makeLedgerList().workflows[0],
        {
          workflow_id: WORKFLOW_B_ID,
          name: "Workflow B",
          latest_draft_revision: 1,
          published_version_count: 0,
          active_version_id: null,
        },
      ],
    });
    workflowApiMocks.get.mockImplementation(
      (_contract, _slug, workflowId: string) =>
        workflowId === WORKFLOW_ID ? requestA.promise : requestB.promise,
    );

    render(
      <WorkflowStudioControlPlanePanel
        contract={makeDurableWorkflowStudioContract()}
        expectedTenantSlug="demo"
      />,
    );
    await waitFor(() => expect(workflowApiMocks.list).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Workflow del tenant"), {
      target: { value: WORKFLOW_ID },
    });
    fireEvent.change(screen.getByLabelText("Workflow del tenant"), {
      target: { value: WORKFLOW_B_ID },
    });

    await act(async () => requestA.resolve(ledgerA));
    expect(screen.getByRole("button", { name: "Borrador durable" })).toBeDisabled();

    await act(async () => requestB.resolve(ledgerB));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Borrador durable" })).toBeEnabled(),
    );
    expect((screen.getByLabelText("Borrador JSON") as HTMLTextAreaElement).value).toContain("Workflow B");
  });

  it("requires the exact ACK and reports a database control-plane activation, never runtime activation", async () => {
    workflowApiMocks.publish.mockResolvedValue(makePublicationReceipt());
    render(
      <WorkflowStudioControlPlanePanel
        contract={makeDurableWorkflowStudioContract()}
        expectedTenantSlug="demo"
      />,
    );
    await screen.findByTestId("workflow-control-plane");

    fireEvent.change(screen.getByLabelText("Workflow del tenant"), {
      target: { value: WORKFLOW_ID },
    });
    await waitFor(() => expect(workflowApiMocks.get).toHaveBeenCalledWith(expect.anything(), "demo", WORKFLOW_ID));

    const publishButton = await screen.findByRole("button", {
      name: "Publicación",
    });
    expect(publishButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Confirmación de plano de control"), {
      target: { value: "PUBLICAR" },
    });
    expect(publishButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Confirmación de plano de control"), {
      target: { value: "CONTROL_PLANE_ONLY" },
    });
    await waitFor(() => expect(publishButton).toBeEnabled());
    fireEvent.click(publishButton);

    await waitFor(() => expect(workflowApiMocks.publish).toHaveBeenCalledTimes(1));
    expect(workflowApiMocks.publish.mock.calls[0]?.[0]).toMatchObject({
      expectedTenantSlug: "demo",
      workflowId: WORKFLOW_ID,
      acknowledgement: "CONTROL_PLANE_ONLY",
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "activa sólo en el plano de control",
    );
    expect(screen.getByRole("status")).toHaveTextContent("runtime sigue desconectado");
  });

  it("preserves publication idempotency when only the local ACK changes after an ambiguous outcome", async () => {
    workflowApiMocks.publish
      .mockRejectedValueOnce(new Error("Resultado remoto incierto"))
      .mockResolvedValueOnce(makePublicationReceipt());
    render(
      <WorkflowStudioControlPlanePanel
        contract={makeDurableWorkflowStudioContract()}
        expectedTenantSlug="demo"
      />,
    );
    await screen.findByTestId("workflow-control-plane");
    fireEvent.change(screen.getByLabelText("Workflow del tenant"), {
      target: { value: WORKFLOW_ID },
    });
    await waitFor(() => expect(workflowApiMocks.get).toHaveBeenCalled());

    const ack = screen.getByLabelText("Confirmación de plano de control");
    fireEvent.change(ack, { target: { value: "CONTROL_PLANE_ONLY" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicación" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("misma clave idempotente");

    fireEvent.change(ack, { target: { value: "NO" } });
    fireEvent.change(ack, { target: { value: "CONTROL_PLANE_ONLY" } });
    fireEvent.click(screen.getByRole("button", { name: "Publicación" }));
    await waitFor(() => expect(workflowApiMocks.publish).toHaveBeenCalledTimes(2));

    expect(workflowApiMocks.createKey).toHaveBeenCalledTimes(1);
    expect(workflowApiMocks.publish.mock.calls[0]?.[0].idempotencyKey).toBe(
      workflowApiMocks.publish.mock.calls[1]?.[0].idempotencyKey,
    );
  });

  it("quarantines a tenant A mutation after switching to B without clearing B feedback or idempotency", async () => {
    const tenantAMutation = deferred<ReturnType<typeof makeDraftReceipt>>();
    const tenantBListing = {
      ...makeLedgerList(8),
      workflows: [
        {
          workflow_id: WORKFLOW_B_ID,
          name: "Workflow tenant B",
          latest_draft_revision: 1,
          published_version_count: 0,
          active_version_id: null,
        },
      ],
    };
    workflowApiMocks.list.mockImplementation(
      (_contract, tenantSlug: string) =>
        Promise.resolve(tenantSlug === "tenant-b" ? tenantBListing : makeLedgerList()),
    );
    workflowApiMocks.createKey
      .mockReturnValueOnce("wf:00000000-0000-4000-8000-000000000091")
      .mockReturnValueOnce("wf:00000000-0000-4000-8000-000000000092")
      .mockReturnValue("wf:00000000-0000-4000-8000-000000000093");
    let tenantBAttempts = 0;
    workflowApiMocks.save.mockImplementation((request) => {
      if (request.expectedTenantSlug === "tenant-a") return tenantAMutation.promise;
      tenantBAttempts += 1;
      return tenantBAttempts === 1
        ? Promise.reject(new Error("Resultado incierto del tenant B"))
        : Promise.resolve(makeDraftReceipt(false));
    });

    const { rerender } = render(
      <WorkflowStudioControlPlanePanel
        contract={makeDurableWorkflowStudioContract("tenant-a", 7)}
        expectedTenantSlug="tenant-a"
      />,
    );
    await waitFor(() => expect(workflowApiMocks.list).toHaveBeenCalledWith(expect.anything(), "tenant-a"));
    fireEvent.click(screen.getByRole("button", { name: "Borrador durable" }));
    await waitFor(() => expect(workflowApiMocks.save).toHaveBeenCalledTimes(1));

    rerender(
      <WorkflowStudioControlPlanePanel
        contract={makeDurableWorkflowStudioContract("tenant-b", 8)}
        expectedTenantSlug="tenant-b"
      />,
    );
    await waitFor(() => expect(workflowApiMocks.list).toHaveBeenCalledWith(expect.anything(), "tenant-b"));
    expect(await screen.findByRole("option", { name: /Workflow tenant B/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Workflow del tenant")).toHaveValue(NEW_WORKFLOW_VALUE_FOR_TEST);

    fireEvent.click(screen.getByRole("button", { name: "Borrador durable" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Resultado incierto del tenant B");
    expect(workflowApiMocks.createKey).toHaveBeenCalledTimes(2);

    await act(async () => tenantAMutation.resolve(makeDraftReceipt(false)));
    expect(screen.getByRole("alert")).toHaveTextContent("Resultado incierto del tenant B");
    expect(screen.getByRole("option", { name: /Workflow tenant B/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Workflow del tenant")).toHaveValue(NEW_WORKFLOW_VALUE_FOR_TEST);
    expect(screen.getByRole("button", { name: "Borrador durable" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Borrador durable" }));
    await waitFor(() => expect(workflowApiMocks.save).toHaveBeenCalledTimes(3));
    const tenantBCalls = workflowApiMocks.save.mock.calls
      .map((call) => call[0])
      .filter((request) => request.expectedTenantSlug === "tenant-b");
    expect(tenantBCalls).toHaveLength(2);
    expect(tenantBCalls[0]?.idempotencyKey).toBe(tenantBCalls[1]?.idempotencyKey);
    expect(workflowApiMocks.createKey).toHaveBeenCalledTimes(2);
  });

  it("sends an exact approved/rejected review subject and rollback target from the verified ledger", async () => {
    const publishedLedger = makePublishedLedger();
    workflowApiMocks.get.mockResolvedValue(publishedLedger);
    workflowApiMocks.review.mockResolvedValue({
      contract_version: "whatsapp.workflow_review.v1",
      status: "review_recorded",
      idempotent_replay: false,
      review: {
        ...approvedPublishReview,
        review_id: "00000000-0000-4000-8000-000000000007",
        decision: "rejected",
        review_note: "Falta evidencia independiente.",
      },
    });
    workflowApiMocks.rollback.mockResolvedValue({
      ...makePublicationReceipt(),
      version: {
        ...makePublicationReceipt().version,
        version_id: "00000000-0000-4000-8000-000000000008",
        version: 2,
        version_kind: "rollback",
        restored_from_version_id: VERSION_ID,
        review_id: ROLLBACK_REVIEW_ID,
      },
      activation: {
        ...makePublicationReceipt().activation,
        activation_id: "00000000-0000-4000-8000-000000000009",
        sequence: 2,
        workflow_version_id: "00000000-0000-4000-8000-000000000008",
        previous_activation_id: ACTIVATION_ID,
        activation_kind: "rollback",
      },
    });

    render(
      <WorkflowStudioControlPlanePanel
        contract={makeDurableWorkflowStudioContract()}
        expectedTenantSlug="demo"
      />,
    );
    await screen.findByTestId("workflow-control-plane");
    fireEvent.change(screen.getByLabelText("Workflow del tenant"), {
      target: { value: WORKFLOW_ID },
    });
    await waitFor(() => expect(workflowApiMocks.get).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Decisión de revisión"), {
      target: { value: "rejected" },
    });
    fireEvent.change(screen.getByLabelText("Fundamento de revisión"), {
      target: { value: "Falta evidencia independiente." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisión" }));
    await waitFor(() => expect(workflowApiMocks.review).toHaveBeenCalledTimes(1));
    expect(workflowApiMocks.review.mock.calls[0]?.[0]).toMatchObject({
      workflowId: WORKFLOW_ID,
      operation: "publish",
      subjectId: DRAFT_ID,
      decision: "rejected",
    });

    fireEvent.change(screen.getByLabelText("Versión objetivo de rollback"), {
      target: { value: VERSION_ID },
    });
    fireEvent.change(screen.getByLabelText("Confirmación de plano de control"), {
      target: { value: "CONTROL_PLANE_ONLY" },
    });
    const rollbackButton = screen.getByRole("button", { name: "Rollback" });
    await waitFor(() => expect(rollbackButton).toBeEnabled());
    fireEvent.click(rollbackButton);

    await waitFor(() => expect(workflowApiMocks.rollback).toHaveBeenCalledTimes(1));
    expect(workflowApiMocks.rollback.mock.calls[0]?.[0]).toMatchObject({
      workflowId: WORKFLOW_ID,
      targetVersionId: VERSION_ID,
      reviewId: ROLLBACK_REVIEW_ID,
      acknowledgement: "CONTROL_PLANE_ONLY",
    });
  });
});
