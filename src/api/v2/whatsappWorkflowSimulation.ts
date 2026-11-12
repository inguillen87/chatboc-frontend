import { panelApi } from "@/api/v2/client";
import {
  reconcileWhatsappWorkflowDurableScope,
  WhatsappWorkflowContractError,
  type WhatsappWorkflowStudioBlocker,
  type WhatsappWorkflowStudioDurableContract,
} from "@/api/v2/whatsappWorkflowStudio";
import { ApiError } from "@/utils/api";

export const WHATSAPP_WORKFLOW_SIMULATION_CONTRACT_VERSION = "whatsapp.workflow_simulation.v1" as const;

export interface WhatsappWorkflowSimulationEvent {
  message: { type: string; text?: string };
  contact?: { language: string };
  broadcast_id?: string;
}

export type WhatsappWorkflowSimulationStep =
  | { step_id: string; type: "branch"; matched: boolean; next_step_id: string }
  | { step_id: string; type: "reply_template" | "create_ticket" | "handoff"; next_step_id: string | null }
  | { step_id: string; type: "stop"; outcome: string };

export type WhatsappWorkflowProposedEffect =
  | { type: "reply_template"; template_key: string; execution: "proposed_only" }
  | { type: "create_ticket"; category: string; execution: "proposed_only" }
  | { type: "handoff"; queue: string; execution: "proposed_only" };

export interface WhatsappWorkflowSimulation {
  contract_version: typeof WHATSAPP_WORKFLOW_SIMULATION_CONTRACT_VERSION;
  tenant: { id: number; slug: string };
  simulation_id: string;
  draft_id: string;
  deterministic: true;
  status: "completed" | "not_triggered" | "blocked";
  outcome?: string;
  trigger: { matched: boolean; reason: string };
  blockers: WhatsappWorkflowStudioBlocker[];
  validation: {
    valid: boolean;
    blockers: WhatsappWorkflowStudioBlocker[];
    warnings: WhatsappWorkflowStudioBlocker[];
  };
  trace: WhatsappWorkflowSimulationStep[];
  proposed_effects: WhatsappWorkflowProposedEffect[];
  side_effects: {
    mode: "proposed_only";
    database_writes: 0;
    provider_calls: 0;
    messages_sent: 0;
    tickets_created: 0;
    handoffs_created: 0;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const areIssues = (value: unknown): value is WhatsappWorkflowStudioBlocker[] =>
  Array.isArray(value) && value.every((item) =>
    isRecord(item) && isText(item.code) && isText(item.path) && isText(item.message));

const isTraceStep = (value: unknown): value is WhatsappWorkflowSimulationStep => {
  if (!isRecord(value) || !isText(value.step_id)) return false;
  if (value.type === "branch") return typeof value.matched === "boolean" && isText(value.next_step_id);
  if (value.type === "stop") return isText(value.outcome);
  return ["reply_template", "create_ticket", "handoff"].includes(String(value.type)) &&
    (value.next_step_id === null || isText(value.next_step_id));
};

const isProposedEffect = (value: unknown): value is WhatsappWorkflowProposedEffect => {
  if (!isRecord(value) || value.execution !== "proposed_only") return false;
  if (value.type === "reply_template") return isText(value.template_key);
  if (value.type === "create_ticket") return isText(value.category);
  return value.type === "handoff" && isText(value.queue);
};

const invalidResponse = (): never => {
  throw new WhatsappWorkflowContractError(
    "workflow_simulation_response_invalid",
    "El resultado de la prueba no coincide con el contrato o el ámbito activo.",
  );
};

export const parseWhatsappWorkflowSimulation = (
  value: unknown,
  tenant: WhatsappWorkflowStudioDurableContract["tenant"],
): WhatsappWorkflowSimulation => {
  if (
    !isRecord(value) ||
    value.contract_version !== WHATSAPP_WORKFLOW_SIMULATION_CONTRACT_VERSION ||
    !isRecord(value.tenant) || value.tenant.id !== tenant.id || value.tenant.slug !== tenant.slug ||
    !isText(value.simulation_id) || !/^sim_[0-9a-f]{24}$/.test(value.simulation_id) ||
    !isText(value.draft_id) || !/^draft_[0-9a-f]{24}$/.test(value.draft_id) ||
    value.deterministic !== true ||
    value.determinism_scope !== "authenticated_tenant_plus_normalized_draft_plus_normalized_event" ||
    value.request_id_excluded_from_determinism !== true ||
    !["completed", "not_triggered", "blocked"].includes(String(value.status)) ||
    !isRecord(value.trigger) || typeof value.trigger.matched !== "boolean" || !isText(value.trigger.reason) ||
    !areIssues(value.blockers) ||
    !isRecord(value.validation) || typeof value.validation.valid !== "boolean" ||
    !areIssues(value.validation.blockers) || !areIssues(value.validation.warnings) ||
    !isRecord(value.publication) || value.publication.scope !== "control_plane_only" ||
    !Array.isArray(value.trace) || !value.trace.every(isTraceStep) ||
    !Array.isArray(value.proposed_effects) || !value.proposed_effects.every(isProposedEffect) ||
    !isRecord(value.side_effects) || value.side_effects.mode !== "proposed_only" ||
    ["database_writes", "provider_calls", "messages_sent", "tickets_created", "handoffs_created"]
      .some((key) => (value.side_effects as Record<string, unknown>)[key] !== 0)
  ) return invalidResponse();

  if (value.status === "blocked") {
    if (!value.blockers.length || value.trigger.matched || value.trace.length || value.proposed_effects.length) {
      return invalidResponse();
    }
  } else {
    if (!value.validation.valid || value.validation.blockers.length || value.blockers.length) return invalidResponse();
    if (value.status === "not_triggered" &&
      (value.trigger.matched || value.trace.length || value.proposed_effects.length)) return invalidResponse();
    if (value.status === "completed" &&
      (!value.trigger.matched || !value.trace.length || !isText(value.outcome))) return invalidResponse();
  }
  return value as unknown as WhatsappWorkflowSimulation;
};

export const simulateWhatsappWorkflow = async ({
  contract,
  expectedTenantSlug,
  draft,
  event,
  isCurrent,
}: {
  contract: unknown;
  expectedTenantSlug: string;
  draft: Record<string, unknown>;
  event: WhatsappWorkflowSimulationEvent;
  isCurrent: () => boolean;
}): Promise<WhatsappWorkflowSimulation> => {
  const scoped = reconcileWhatsappWorkflowDurableScope(contract, expectedTenantSlug);
  if (!scoped) {
    throw new WhatsappWorkflowContractError(
      "workflow_contract_scope_mismatch",
      "El contrato durable no coincide con el tenant activo.",
    );
  }
  const ensureCurrent = () => {
    if (!isCurrent()) throw new WhatsappWorkflowContractError(
      "workflow_simulation_obsolete", "Los datos de la prueba cambiaron. Volvé a probar.",
    );
  };
  ensureCurrent();
  let response: unknown;
  try {
    response = await panelApi.post<unknown>(
      `/api/v2/tenants/${encodeURIComponent(scoped.tenant.slug)}/whatsapp/workflow-studio/simulate`,
      { draft, event },
      {
        tenantSlug: scoped.tenant.slug,
        cache: "no-store",
        headers: { Accept: "application/json", "Cache-Control": "no-store" },
        isCurrent,
      },
    );
  } catch (error) {
    ensureCurrent();
    if (!(error instanceof ApiError) || error.status !== 422) throw error;
    const blocked = parseWhatsappWorkflowSimulation(error.body, scoped.tenant);
    if (blocked.status !== "blocked") return invalidResponse();
    return blocked;
  }
  ensureCurrent();
  return parseWhatsappWorkflowSimulation(response, scoped.tenant);
};
