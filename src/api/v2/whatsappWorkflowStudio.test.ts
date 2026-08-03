import { beforeEach, describe, expect, it, vi } from "vitest";

const panelApiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/api/v2/client", () => ({ panelApi: panelApiMocks }));

import {
  WHATSAPP_WORKFLOW_CONTROL_PLANE_ACK,
  WhatsappWorkflowContractError,
  listWhatsappWorkflowLedgers,
  parseWhatsappWorkflowLedger,
  parseWhatsappWorkflowLedgerList,
  parseWhatsappWorkflowStudioContract,
  publishWhatsappWorkflow,
  reconcileWhatsappWorkflowDurableScope,
  saveWhatsappWorkflowDraft,
} from "./whatsappWorkflowStudio";
import {
  DRAFT_ID,
  REVIEW_ID,
  WORKFLOW_ID,
  draftDocument,
  makeDraftReceipt,
  makeDurableWorkflowStudioContract,
  makeLedger,
  makeLedgerList,
  makePublicationReceipt,
} from "@/features/whatsappWorkflowStudio/workflowStudioTestFixtures";

describe("WhatsApp Workflow Studio durable contract", () => {
  beforeEach(() => {
    panelApiMocks.get.mockReset();
    panelApiMocks.post.mockReset();
  });

  it("accepts the exact durable control-plane contract while preserving runtime=false", () => {
    const parsed = parseWhatsappWorkflowStudioContract(makeDurableWorkflowStudioContract());

    expect(parsed?.mode).toBe("durable_control_plane");
    expect(parsed?.capabilities.publish.status).toBe("control_plane_only");
    expect(parsed?.capabilities.runtime.available).toBe(false);
    expect(parsed?.publication_readiness.scope).toBe("control_plane_only");
  });

  it("fails closed when gate, endpoint, tenant scope, or capability truth does not reconcile", () => {
    const contract = makeDurableWorkflowStudioContract();
    expect(
      parseWhatsappWorkflowStudioContract({
        ...contract,
        durable_control_plane_gate: {
          ...contract.durable_control_plane_gate,
          enabled: false,
        },
      }),
    ).toBeNull();

    expect(
      parseWhatsappWorkflowStudioContract({
        ...contract,
        capabilities: {
          ...contract.capabilities,
          publish: {
            ...contract.capabilities.publish,
            endpoint_template: "/api/v2/tenants/foreign/whatsapp/workflow-studio/workflows/{workflow_id}/publish",
          },
        },
      }),
    ).toBeNull();

    expect(reconcileWhatsappWorkflowDurableScope(contract, "foreign")).toBeNull();
    expect(
      parseWhatsappWorkflowStudioContract({
        ...contract,
        capabilities: {
          ...contract.capabilities,
          runtime: { ...contract.capabilities.runtime, available: true },
        },
      }),
    ).toBeNull();
  });

  it("rejects durable contracts missing review ordering or exact post-lock revalidation", () => {
    const contract = makeDurableWorkflowStudioContract();
    const { ordering: _ordering, ...legacyReview } = contract.capabilities.review;
    expect(
      parseWhatsappWorkflowStudioContract({
        ...contract,
        capabilities: { ...contract.capabilities, review: legacyReview },
      }),
    ).toBeNull();

    expect(
      parseWhatsappWorkflowStudioContract({
        ...contract,
        capabilities: {
          ...contract.capabilities,
          review: {
            ...contract.capabilities.review,
            later_review_supersedes_prior_approval: false,
          },
        },
      }),
    ).toBeNull();

    expect(
      parseWhatsappWorkflowStudioContract({
        ...contract,
        capabilities: {
          ...contract.capabilities,
          publish: {
            ...contract.capabilities.publish,
            revalidates_after_lock: ["idempotency", "latest_review"],
          },
        },
      }),
    ).toBeNull();

    expect(
      parseWhatsappWorkflowStudioContract({
        ...contract,
        capabilities: {
          ...contract.capabilities,
          rollback: {
            ...contract.capabilities.rollback,
            transactional_serialization: "best_effort",
          },
        },
      }),
    ).toBeNull();
  });

  it("rejects mixed-tenant list/detail payloads before exposing them to the UI", () => {
    expect(() => parseWhatsappWorkflowLedgerList(makeLedgerList(99), 7)).toThrow(
      WhatsappWorkflowContractError,
    );
    expect(() => parseWhatsappWorkflowLedger(makeLedger(99), 7, WORKFLOW_ID)).toThrow(
      WhatsappWorkflowContractError,
    );

    const crossWorkflow = { ...makeLedger(), workflow_id: "00000000-0000-4000-8000-000000000099" };
    expect(() => parseWhatsappWorkflowLedger(crossWorkflow, 7, WORKFLOW_ID)).toThrow(
      WhatsappWorkflowContractError,
    );
  });

  it("accepts a coherent append-only publication chain and rejects a forged activation link", () => {
    const publication = makePublicationReceipt();
    const coherent = {
      ...makeLedger(),
      published_versions: [publication.version],
      activations: [publication.activation],
      active_version_id: publication.version.version_id,
    };

    expect(parseWhatsappWorkflowLedger(coherent, 7, WORKFLOW_ID).active_version_id).toBe(
      publication.version.version_id,
    );
    expect(() =>
      parseWhatsappWorkflowLedger(
        {
          ...coherent,
          activations: [{ ...publication.activation, activation_kind: "rollback" }],
        },
        7,
        WORKFLOW_ID,
      ),
    ).toThrow(WhatsappWorkflowContractError);
  });

  it("rejects duplicate or gapped review sequences for the same exact subject", () => {
    const ledger = makeLedger();
    const duplicate = {
      ...ledger,
      reviews: [
        ledger.reviews[0],
        {
          ...ledger.reviews[0],
          review_id: "00000000-0000-4000-8000-000000000099",
          decision: "rejected",
          reviewed_at: "2026-08-02T12:06:00+00:00",
        },
      ],
    };
    const gap = {
      ...ledger,
      reviews: [{ ...ledger.reviews[0], subject_sequence: 2 }],
    };

    expect(() => parseWhatsappWorkflowLedger(duplicate, 7, WORKFLOW_ID)).toThrow(
      WhatsappWorkflowContractError,
    );
    expect(() => parseWhatsappWorkflowLedger(gap, 7, WORKFLOW_ID)).toThrow(
      WhatsappWorkflowContractError,
    );
  });

  it("uses tenant-scoped no-store requests and rejects a server scope mismatch", async () => {
    const contract = makeDurableWorkflowStudioContract();
    panelApiMocks.get.mockResolvedValueOnce(makeLedgerList(99));

    await expect(listWhatsappWorkflowLedgers(contract, "demo")).rejects.toMatchObject({
      code: "workflow_response_contract_invalid",
    });
    expect(panelApiMocks.get).toHaveBeenCalledWith(
      "/api/v2/tenants/demo/whatsapp/workflow-studio/workflows",
      expect.objectContaining({
        tenantSlug: "demo",
        cache: "no-store",
        headers: expect.objectContaining({ "Cache-Control": "no-store" }),
      }),
    );
  });

  it("passes the caller-owned idempotency key unchanged on exact retries", async () => {
    const contract = makeDurableWorkflowStudioContract();
    const key = "wf:00000000-0000-4000-8000-000000000099";
    panelApiMocks.post.mockResolvedValue(makeDraftReceipt(true));

    await saveWhatsappWorkflowDraft({
      contract,
      expectedTenantSlug: "demo",
      draft: draftDocument,
      idempotencyKey: key,
    });
    await saveWhatsappWorkflowDraft({
      contract,
      expectedTenantSlug: "demo",
      draft: draftDocument,
      idempotencyKey: key,
    });

    expect(panelApiMocks.post).toHaveBeenCalledTimes(2);
    expect(panelApiMocks.post.mock.calls.map((call) => call[1]?.idempotency_key)).toEqual([key, key]);
  });

  it("requires the explicit control-plane ACK before publication and verifies zero effects", async () => {
    const contract = makeDurableWorkflowStudioContract();
    const base = {
      contract,
      expectedTenantSlug: "demo",
      workflowId: WORKFLOW_ID,
      draftRevisionId: DRAFT_ID,
      reviewId: REVIEW_ID,
      idempotencyKey: "wf:00000000-0000-4000-8000-000000000099",
    };

    await expect(
      publishWhatsappWorkflow({ ...base, acknowledgement: "PUBLICAR" }),
    ).rejects.toMatchObject({ code: "workflow_control_plane_ack_required" });
    expect(panelApiMocks.post).not.toHaveBeenCalled();

    panelApiMocks.post.mockResolvedValueOnce(makePublicationReceipt());
    const receipt = await publishWhatsappWorkflow({
      ...base,
      acknowledgement: WHATSAPP_WORKFLOW_CONTROL_PLANE_ACK,
    });

    expect(receipt.status).toBe("control_plane_activation_recorded");
    expect(receipt.runtime_binding.consumes_active_version).toBe(false);
    expect(receipt.external_effects).toEqual({
      provider_calls: 0,
      messages_sent: 0,
      tickets_created: 0,
      handoffs_created: 0,
    });
  });
});
