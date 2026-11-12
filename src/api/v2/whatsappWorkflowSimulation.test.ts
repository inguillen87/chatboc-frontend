import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/api/v2/client", () => ({ panelApi: apiMocks }));

import { ApiError } from "@/utils/api";
import { parseWhatsappWorkflowSimulation, simulateWhatsappWorkflow } from "./whatsappWorkflowSimulation";
import {
  draftDocument,
  makeBlockedWorkflowSimulation,
  makeDurableWorkflowStudioContract,
  makeWorkflowSimulation,
} from "@/features/whatsappWorkflowStudio/workflowStudioTestFixtures";

const request = () => ({
  contract: makeDurableWorkflowStudioContract(),
  expectedTenantSlug: "demo",
  draft: draftDocument,
  event: { message: { type: "text", text: "Necesito asistencia" }, contact: { language: "es" } },
  isCurrent: () => true,
});

describe("WhatsApp Workflow Studio simulation client", () => {
  beforeEach(() => apiMocks.post.mockReset());

  it("posts only draft/event to the scoped simulator with no-store and the lifecycle guard", async () => {
    const input = request();
    apiMocks.post.mockResolvedValue(makeWorkflowSimulation());
    const result = await simulateWhatsappWorkflow(input);

    expect(apiMocks.post).toHaveBeenCalledExactlyOnceWith(
      "/api/v2/tenants/demo/whatsapp/workflow-studio/simulate",
      { draft: draftDocument, event: input.event },
      {
        tenantSlug: "demo",
        cache: "no-store",
        headers: { Accept: "application/json", "Cache-Control": "no-store" },
        isCurrent: input.isCurrent,
      },
    );
    expect(result.proposed_effects[0]).toMatchObject({ execution: "proposed_only" });
    expect(result.side_effects).toMatchObject({ database_writes: 0, messages_sent: 0, tickets_created: 0 });
  });

  it("rejects a mismatched or revoked contract before calling any endpoint", async () => {
    await expect(simulateWhatsappWorkflow({ ...request(), expectedTenantSlug: "other" }))
      .rejects.toMatchObject({ code: "workflow_contract_scope_mismatch" });
    const contract = makeDurableWorkflowStudioContract();
    contract.capabilities.simulate.available = false;
    await expect(simulateWhatsappWorkflow({ ...request(), contract }))
      .rejects.toMatchObject({ code: "workflow_contract_scope_mismatch" });
    expect(apiMocks.post).not.toHaveBeenCalled();
  });

  it.each([
    ["foreign tenant ID", { tenant: { id: 99, slug: "demo" } }],
    ["foreign tenant slug", { tenant: { id: 7, slug: "other" } }],
    ["unknown version", { contract_version: "whatsapp.workflow_simulation.v2" }],
    ["real write", { side_effects: { ...makeWorkflowSimulation().side_effects, database_writes: 1 } }],
    ["real send", { side_effects: { ...makeWorkflowSimulation().side_effects, messages_sent: 1 } }],
    ["executed effect", { proposed_effects: [{ type: "create_ticket", category: "a", execution: "executed" }] }],
    ["malformed trace", { trace: [{ step_id: "branch", type: "branch", matched: "yes", next_step_id: "stop" }] }],
    ["invalid completed result", { validation: { valid: false, blockers: [], warnings: [] } }],
    ["runtime publication", { publication: { scope: "runtime" } }],
  ])("does not expose a result with %s", (_label, override) => {
    expect(() => parseWhatsappWorkflowSimulation(
      { ...makeWorkflowSimulation(), ...override }, { id: 7, slug: "demo" },
    )).toThrow(expect.objectContaining({ code: "workflow_simulation_response_invalid" }));
  });

  it("returns structured blockers from a valid HTTP 422 and preserves normal HTTP errors", async () => {
    apiMocks.post.mockRejectedValueOnce(new ApiError("Blocked", 422, makeBlockedWorkflowSimulation()));
    await expect(simulateWhatsappWorkflow(request())).resolves.toMatchObject({
      status: "blocked", blockers: [expect.objectContaining({ path: "draft.name" })], trace: [],
    });

    const forbidden = new ApiError("Sin permiso", 403, makeBlockedWorkflowSimulation());
    apiMocks.post.mockRejectedValueOnce(forbidden);
    await expect(simulateWhatsappWorkflow(request())).rejects.toBe(forbidden);
  });

  it("rejects a malformed or cross-tenant blocked payload and a success body carried by 422", async () => {
    for (const body of [
      { error: "invalid input" },
      { ...makeBlockedWorkflowSimulation(), tenant: { id: 99, slug: "other" } },
      makeWorkflowSimulation(),
    ]) {
      apiMocks.post.mockRejectedValueOnce(new ApiError("Blocked", 422, body));
      await expect(simulateWhatsappWorkflow(request())).rejects.toMatchObject({ code: "workflow_simulation_response_invalid" });
    }
  });

  it("accepts a non-matching broadcast without inventing trace or effects", () => {
    const result = parseWhatsappWorkflowSimulation({
      ...makeWorkflowSimulation(),
      status: "not_triggered", outcome: undefined,
      trigger: { matched: false, reason: "broadcast_reply_not_matched" },
      trace: [], proposed_effects: [],
    }, { id: 7, slug: "demo" });
    expect(result.status).toBe("not_triggered");
  });

  it("checks lifecycle both before dispatch and after a response", async () => {
    await expect(simulateWhatsappWorkflow({ ...request(), isCurrent: () => false }))
      .rejects.toMatchObject({ code: "workflow_simulation_obsolete" });
    expect(apiMocks.post).not.toHaveBeenCalled();
    let current = true;
    apiMocks.post.mockImplementationOnce(async () => { current = false; return makeWorkflowSimulation(); });
    await expect(simulateWhatsappWorkflow({ ...request(), isCurrent: () => current }))
      .rejects.toMatchObject({ code: "workflow_simulation_obsolete" });
  });
});
