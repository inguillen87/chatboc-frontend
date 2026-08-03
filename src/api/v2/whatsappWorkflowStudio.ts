import { panelApi } from "@/api/v2/client";

export const WHATSAPP_WORKFLOW_STUDIO_CONTRACT_VERSION = "whatsapp.workflow_studio.v1" as const;
export const WHATSAPP_WORKFLOW_CONTROL_PLANE_CONTRACT_VERSION =
  "whatsapp.workflow_control_plane.v1" as const;
export const WHATSAPP_WORKFLOW_REVIEW_CONTRACT_VERSION =
  "whatsapp.workflow_review.v1" as const;
export const WHATSAPP_WORKFLOW_PUBLICATION_CONTRACT_VERSION =
  "whatsapp.workflow_publication.v1" as const;
export const WHATSAPP_WORKFLOW_CONTROL_PLANE_ACK = "CONTROL_PLANE_ONLY" as const;

type UnknownRecord = Record<string, unknown>;

export interface WhatsappWorkflowStudioCapability extends UnknownRecord {
  label: string;
  available: boolean;
  status: string;
}

export interface WhatsappWorkflowStudioBlocker extends UnknownRecord {
  code: string;
  path: string;
  message: string;
}

interface WhatsappWorkflowStudioContractBase extends UnknownRecord {
  contract_version: typeof WHATSAPP_WORKFLOW_STUDIO_CONTRACT_VERSION;
  tenant: { id: number; slug: string };
  capabilities: Record<string, WhatsappWorkflowStudioCapability>;
  publication_readiness: UnknownRecord & {
    ready: boolean;
    status: string;
    blockers: WhatsappWorkflowStudioBlocker[];
  };
  side_effect_policy: UnknownRecord;
  frontend_contract: UnknownRecord;
}

export interface WhatsappWorkflowStudioPrepublicationContract
  extends WhatsappWorkflowStudioContractBase {
  mode: "prepublication_read_only";
}

export interface WhatsappWorkflowStudioDurableContract
  extends WhatsappWorkflowStudioContractBase {
  mode: "durable_control_plane";
  durable_control_plane_gate: UnknownRecord & {
    contract_version: "whatsapp.workflow_control_plane_gate.v1";
    available: true;
    enabled: true;
    plan_allowed: true;
    tenant_allowlisted: true;
    reason_codes: [];
  };
}

export type WhatsappWorkflowStudioContract =
  | WhatsappWorkflowStudioPrepublicationContract
  | WhatsappWorkflowStudioDurableContract;

export interface WhatsappWorkflowSummary {
  workflow_id: string;
  name: string;
  latest_draft_revision: number;
  published_version_count: number;
  active_version_id: string | null;
}

export interface WhatsappWorkflowDraftRevision {
  draft_revision_id: string;
  workflow_id: string;
  revision: number;
  schema_version: string;
  draft_digest: string;
  authored_by_user_id: number;
  created_at: string;
  immutable: true;
  draft?: UnknownRecord;
}

export interface WhatsappWorkflowReview {
  contract_version: typeof WHATSAPP_WORKFLOW_REVIEW_CONTRACT_VERSION;
  review_id: string;
  workflow_id: string;
  operation: "publish" | "rollback";
  subject_type: "draft_revision" | "published_version";
  subject_id: string;
  subject_digest: string;
  subject_sequence: number;
  decision: "approved" | "rejected";
  review_note: string;
  reviewed_by_user_id: number;
  reviewed_at: string;
  immutable: true;
}

export interface WhatsappWorkflowVersion {
  version_id: string;
  workflow_id: string;
  version: number;
  version_kind: "publish" | "rollback";
  source_draft_revision_id: string;
  restored_from_version_id: string | null;
  review_id: string;
  schema_version: string;
  content_digest: string;
  published_by_user_id: number;
  published_at: string;
  immutable: true;
  document: UnknownRecord;
}

export interface WhatsappWorkflowActivation {
  activation_id: string;
  workflow_id: string;
  sequence: number;
  workflow_version_id: string;
  previous_activation_id: string | null;
  activation_kind: "publish" | "rollback";
  activated_by_user_id: number;
  activated_at: string;
  immutable: true;
  runtime_consumed: false;
}

export interface WhatsappWorkflowLedgerList {
  contract_version: typeof WHATSAPP_WORKFLOW_CONTROL_PLANE_CONTRACT_VERSION;
  status: "ready";
  tenant_id: number;
  workflows: WhatsappWorkflowSummary[];
  limit: number;
  truncated: boolean;
  runtime_binding: { available: false; consumes_active_version: false; reason_code: string };
}

export interface WhatsappWorkflowLedger {
  contract_version: typeof WHATSAPP_WORKFLOW_CONTROL_PLANE_CONTRACT_VERSION;
  status: "ready";
  tenant_id: number;
  workflow_id: string;
  latest_draft_revision: WhatsappWorkflowDraftRevision & { draft: UnknownRecord };
  draft_revisions: WhatsappWorkflowDraftRevision[];
  reviews: WhatsappWorkflowReview[];
  published_versions: WhatsappWorkflowVersion[];
  activations: WhatsappWorkflowActivation[];
  active_version_id: string | null;
  runtime_binding: { available: false; consumes_active_version: false; reason_code: string };
}

export interface WhatsappWorkflowDraftReceipt {
  contract_version: typeof WHATSAPP_WORKFLOW_CONTROL_PLANE_CONTRACT_VERSION;
  status: "draft_saved";
  idempotent_replay: boolean;
  draft_revision: WhatsappWorkflowDraftRevision & { draft: UnknownRecord };
  runtime_binding: { available: false; reason_code: string };
}

export interface WhatsappWorkflowReviewReceipt {
  contract_version: typeof WHATSAPP_WORKFLOW_REVIEW_CONTRACT_VERSION;
  status: "review_recorded";
  idempotent_replay: boolean;
  review: WhatsappWorkflowReview;
}

export interface WhatsappWorkflowPublicationReceipt {
  contract_version: typeof WHATSAPP_WORKFLOW_PUBLICATION_CONTRACT_VERSION;
  status: "control_plane_activation_recorded";
  idempotent_replay: boolean;
  currently_active: boolean;
  version: WhatsappWorkflowVersion;
  activation: WhatsappWorkflowActivation;
  runtime_binding: { available: false; consumes_active_version: false; reason_code: string };
  external_effects: {
    provider_calls: 0;
    messages_sent: 0;
    tickets_created: 0;
    handoffs_created: 0;
  };
}

export class WhatsappWorkflowContractError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "WhatsappWorkflowContractError";
    this.code = code;
  }
}

const REQUIRED_CAPABILITIES = [
  "draft",
  "validate",
  "simulate",
  "versioning",
  "runtime",
  "publish",
  "rollback",
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,127}$/;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isNonEmptyText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_PATTERN.test(value);

const isSha256 = (value: unknown): value is string =>
  typeof value === "string" && SHA256_PATTERN.test(value);

const isIsoDate = (value: unknown): value is string =>
  isNonEmptyText(value) && Number.isFinite(Date.parse(value));

const isCapability = (value: unknown): value is WhatsappWorkflowStudioCapability =>
  isRecord(value) &&
  isNonEmptyText(value.label) &&
  typeof value.available === "boolean" &&
  isNonEmptyText(value.status);

const isExactTextArray = (value: unknown, expected: readonly string[]) =>
  Array.isArray(value) &&
  value.length === expected.length &&
  value.every((item, index) => item === expected[index]);

const isRuntimeDisconnected = (value: unknown): boolean =>
  isRecord(value) &&
  value.available === false &&
  (value.consumes_active_version === undefined || value.consumes_active_version === false) &&
  value.reason_code === "workflow_runtime_binding_missing";

const hasNoExternalSideEffects = (value: unknown): boolean =>
  isRecord(value) &&
  value.provider_calls === false &&
  value.messages_sent === false &&
  value.tickets_created === false &&
  value.handoffs_created === false;

const encodedBasePath = (tenantSlug: string) =>
  `/api/v2/tenants/${encodeURIComponent(tenantSlug)}/whatsapp/workflow-studio`;

const isEndpoint = (value: unknown, expected: string) => value === expected;

const parseBlockers = (value: unknown): WhatsappWorkflowStudioBlocker[] | null => {
  if (!Array.isArray(value)) return null;
  if (
    value.some(
      (blocker) =>
        !isRecord(blocker) ||
        !isNonEmptyText(blocker.code) ||
        !isNonEmptyText(blocker.path) ||
        !isNonEmptyText(blocker.message),
    )
  ) {
    return null;
  }
  return value as WhatsappWorkflowStudioBlocker[];
};

const parseContractBase = (value: UnknownRecord) => {
  const tenant = value.tenant;
  if (
    !isRecord(tenant) ||
    !isPositiveInteger(tenant.id) ||
    !isNonEmptyText(tenant.slug)
  ) {
    return null;
  }

  const capabilities = value.capabilities;
  if (!isRecord(capabilities)) return null;
  if (REQUIRED_CAPABILITIES.some((key) => !isCapability(capabilities[key]))) return null;

  const readiness = value.publication_readiness;
  if (!isRecord(readiness) || parseBlockers(readiness.blockers) === null) return null;

  const frontend = value.frontend_contract;
  if (
    !isRecord(frontend) ||
    frontend.render_as !== "workflow_studio_readiness" ||
    !isNonEmptyText(frontend.title) ||
    !isNonEmptyText(frontend.description) ||
    !isNonEmptyText(frontend.status_label) ||
    !isNonEmptyText(frontend.blockers_title) ||
    !isNonEmptyText(frontend.safety_note) ||
    !Array.isArray(frontend.capability_order) ||
    frontend.capability_order.some((key) => !isNonEmptyText(key)) ||
    !isRecord(frontend.status_labels)
  ) {
    return null;
  }

  if (!hasNoExternalSideEffects(value.side_effect_policy)) return null;

  return {
    tenant: tenant as { id: number; slug: string },
    capabilities: capabilities as Record<string, WhatsappWorkflowStudioCapability>,
    readiness,
  };
};

const isReadyPostCapability = (value: WhatsappWorkflowStudioCapability, endpoint: string) =>
  value.available === true &&
  value.status === "ready" &&
  value.method === "POST" &&
  value.external_effects === false &&
  isEndpoint(value.endpoint, endpoint);

const parsePrepublicationContract = (
  value: UnknownRecord,
  base: NonNullable<ReturnType<typeof parseContractBase>>,
): WhatsappWorkflowStudioPrepublicationContract | null => {
  const { capabilities, readiness } = base;
  const basePath = encodedBasePath(base.tenant.slug);
  if (
    capabilities.draft.available !== true ||
    capabilities.draft.status !== "request_only" ||
    capabilities.draft.persistent !== false ||
    !isReadyPostCapability(capabilities.validate, `${basePath}/validate`) ||
    !isReadyPostCapability(capabilities.simulate, `${basePath}/simulate`) ||
    capabilities.simulate.database_writes !== false ||
    ["versioning", "runtime", "publish", "rollback"].some(
      (key) => capabilities[key].available !== false || capabilities[key].status !== "blocked",
    )
  ) {
    return null;
  }
  const blockers = parseBlockers(readiness.blockers);
  if (
    readiness.ready !== false ||
    readiness.status !== "blocked" ||
    !blockers?.length
  ) {
    return null;
  }
  const blockerCodes = new Set(blockers.map((blocker) => blocker.code));
  if (
    [
      "workflow_durable_storage_missing",
      "workflow_version_ledger_missing",
      "workflow_runtime_binding_missing",
      "workflow_publish_rollback_missing",
    ].some((code) => !blockerCodes.has(code))
  ) {
    return null;
  }
  return value as WhatsappWorkflowStudioPrepublicationContract;
};

const parseDurableContract = (
  value: UnknownRecord,
  base: NonNullable<ReturnType<typeof parseContractBase>>,
): WhatsappWorkflowStudioDurableContract | null => {
  const { tenant, capabilities, readiness } = base;
  const basePath = encodedBasePath(tenant.slug);
  const gate = value.durable_control_plane_gate;
  const runtimeBlockers = parseBlockers(readiness.runtime_blockers);
  const review = capabilities.review;
  const draftContract = value.draft_contract;
  if (
    !isRecord(gate) ||
    gate.contract_version !== "whatsapp.workflow_control_plane_gate.v1" ||
    gate.available !== true ||
    gate.enabled !== true ||
    gate.plan_allowed !== true ||
    gate.tenant_allowlisted !== true ||
    !Array.isArray(gate.reason_codes) ||
    gate.reason_codes.length !== 0 ||
    !isRuntimeDisconnected(gate.runtime_binding) ||
    capabilities.draft.available !== true ||
    capabilities.draft.status !== "ready" ||
    capabilities.draft.persistent !== true ||
    !isEndpoint(capabilities.draft.endpoint, `${basePath}/drafts`) ||
    !isEndpoint(
      capabilities.draft.revision_endpoint_template,
      `${basePath}/workflows/{workflow_id}/drafts`,
    ) ||
    !isReadyPostCapability(capabilities.validate, `${basePath}/validate`) ||
    !isReadyPostCapability(capabilities.simulate, `${basePath}/simulate`) ||
    capabilities.simulate.database_writes !== false ||
    capabilities.versioning.available !== true ||
    capabilities.versioning.status !== "ready" ||
    capabilities.versioning.history_policy !== "append_only" ||
    !isEndpoint(capabilities.versioning.list_endpoint, `${basePath}/workflows`) ||
    !isEndpoint(
      capabilities.versioning.detail_endpoint_template,
      `${basePath}/workflows/{workflow_id}`,
    ) ||
    !isCapability(review) ||
    review.available !== true ||
    review.status !== "ready" ||
    !isEndpoint(review.endpoint_template, `${basePath}/workflows/{workflow_id}/reviews`) ||
    !isExactTextArray(review.decision_contract, ["approved", "rejected"]) ||
    review.ordering !== "monotonic_sequence_per_exact_subject" ||
    review.latest_decision_required !== true ||
    review.later_review_supersedes_prior_approval !== true ||
    review.same_actor_publish_forbidden !== true ||
    !isExactTextArray(review.publish_reviewer_must_differ_from, ["draft_author", "publisher"]) ||
    !isExactTextArray(review.rollback_reviewer_must_differ_from, ["publisher"]) ||
    capabilities.runtime.available !== false ||
    capabilities.runtime.status !== "blocked" ||
    capabilities.runtime.blocker !== "workflow_runtime_binding_missing" ||
    capabilities.publish.available !== true ||
    capabilities.publish.status !== "control_plane_only" ||
    capabilities.publish.review_required !== true ||
    capabilities.publish.separation_of_duties !== true ||
    capabilities.publish.transactional_serialization !== "immutable_first_draft_anchor" ||
    !isExactTextArray(capabilities.publish.revalidates_after_lock, [
      "idempotency",
      "latest_draft",
      "latest_review",
      "active_content_digest",
    ]) ||
    capabilities.publish.runtime_effect !== false ||
    capabilities.publish.method !== "POST" ||
    !isEndpoint(capabilities.publish.endpoint_template, `${basePath}/workflows/{workflow_id}/publish`) ||
    capabilities.rollback.available !== true ||
    capabilities.rollback.status !== "control_plane_only" ||
    capabilities.rollback.creates_new_version !== true ||
    capabilities.rollback.mutates_history !== false ||
    capabilities.rollback.review_required !== true ||
    capabilities.rollback.transactional_serialization !== "immutable_first_draft_anchor" ||
    !isExactTextArray(capabilities.rollback.revalidates_after_lock, [
      "idempotency",
      "latest_review",
      "active_content_digest",
    ]) ||
    capabilities.rollback.method !== "POST" ||
    !isEndpoint(capabilities.rollback.endpoint_template, `${basePath}/workflows/{workflow_id}/rollback`) ||
    readiness.ready !== true ||
    readiness.status !== "control_plane_ready" ||
    readiness.scope !== "control_plane_only" ||
    parseBlockers(readiness.blockers)?.length !== 0 ||
    !runtimeBlockers?.some((blocker) => blocker.code === "workflow_runtime_binding_missing") ||
    !isRecord(draftContract) ||
    draftContract.schema_version !== "whatsapp.workflow_draft.v1" ||
    !isPositiveInteger(draftContract.max_bytes) ||
    !isPositiveInteger(draftContract.max_steps) ||
    draftContract.tenant_scope_policy !== "authenticated_tenant_only" ||
    !isRecord(value.side_effect_policy) ||
    value.side_effect_policy.validate !== "none" ||
    value.side_effect_policy.simulate !== "proposed_effects_only" ||
    value.side_effect_policy.publish !== "database_control_plane_only" ||
    value.side_effect_policy.rollback !== "append_only_database_control_plane_only"
  ) {
    return null;
  }
  return value as WhatsappWorkflowStudioDurableContract;
};

export const parseWhatsappWorkflowStudioContract = (
  value: unknown,
): WhatsappWorkflowStudioContract | null => {
  if (!isRecord(value)) return null;
  if (value.contract_version !== WHATSAPP_WORKFLOW_STUDIO_CONTRACT_VERSION) return null;
  const base = parseContractBase(value);
  if (!base) return null;
  if (value.mode === "prepublication_read_only") {
    return parsePrepublicationContract(value, base);
  }
  if (value.mode === "durable_control_plane") {
    return parseDurableContract(value, base);
  }
  return null;
};

export const reconcileWhatsappWorkflowDurableScope = (
  contract: unknown,
  expectedTenantSlug: string | null | undefined,
): WhatsappWorkflowStudioDurableContract | null => {
  const parsed = parseWhatsappWorkflowStudioContract(contract);
  const normalizedExpected = expectedTenantSlug?.trim();
  if (!parsed || parsed.mode !== "durable_control_plane" || !normalizedExpected) return null;
  if (parsed.tenant.slug !== normalizedExpected) return null;
  return parsed;
};

const requireDurableScope = (
  contract: unknown,
  expectedTenantSlug: string | null | undefined,
): WhatsappWorkflowStudioDurableContract => {
  const parsed = reconcileWhatsappWorkflowDurableScope(contract, expectedTenantSlug);
  if (!parsed) {
    throw new WhatsappWorkflowContractError(
      "workflow_contract_scope_mismatch",
      "El contrato durable no coincide con el tenant activo.",
    );
  }
  return parsed;
};

const isWorkflowSummary = (value: unknown): value is WhatsappWorkflowSummary =>
  isRecord(value) &&
  isUuid(value.workflow_id) &&
  isNonEmptyText(value.name) &&
  isPositiveInteger(value.latest_draft_revision) &&
  typeof value.published_version_count === "number" &&
  Number.isInteger(value.published_version_count) &&
  value.published_version_count >= 0 &&
  (value.active_version_id === null || isUuid(value.active_version_id));

const isDraftRevision = (
  value: unknown,
  workflowId: string,
  includeDraft: boolean,
): value is WhatsappWorkflowDraftRevision =>
  isRecord(value) &&
  isUuid(value.draft_revision_id) &&
  value.workflow_id === workflowId &&
  isPositiveInteger(value.revision) &&
  isNonEmptyText(value.schema_version) &&
  isSha256(value.draft_digest) &&
  isPositiveInteger(value.authored_by_user_id) &&
  isIsoDate(value.created_at) &&
  value.immutable === true &&
  (!includeDraft || isRecord(value.draft));

const isReview = (value: unknown, workflowId: string): value is WhatsappWorkflowReview =>
  isRecord(value) &&
  value.contract_version === WHATSAPP_WORKFLOW_REVIEW_CONTRACT_VERSION &&
  isUuid(value.review_id) &&
  value.workflow_id === workflowId &&
  (value.operation === "publish" || value.operation === "rollback") &&
  (value.subject_type === "draft_revision" || value.subject_type === "published_version") &&
  isUuid(value.subject_id) &&
  isSha256(value.subject_digest) &&
  isPositiveInteger(value.subject_sequence) &&
  (value.decision === "approved" || value.decision === "rejected") &&
  isNonEmptyText(value.review_note) &&
  isPositiveInteger(value.reviewed_by_user_id) &&
  isIsoDate(value.reviewed_at) &&
  value.immutable === true;

const isVersion = (value: unknown, workflowId: string): value is WhatsappWorkflowVersion =>
  isRecord(value) &&
  isUuid(value.version_id) &&
  value.workflow_id === workflowId &&
  isPositiveInteger(value.version) &&
  (value.version_kind === "publish" || value.version_kind === "rollback") &&
  isUuid(value.source_draft_revision_id) &&
  (value.restored_from_version_id === null || isUuid(value.restored_from_version_id)) &&
  isUuid(value.review_id) &&
  isNonEmptyText(value.schema_version) &&
  isSha256(value.content_digest) &&
  isPositiveInteger(value.published_by_user_id) &&
  isIsoDate(value.published_at) &&
  value.immutable === true &&
  isRecord(value.document);

const isActivation = (
  value: unknown,
  workflowId: string,
): value is WhatsappWorkflowActivation =>
  isRecord(value) &&
  isUuid(value.activation_id) &&
  value.workflow_id === workflowId &&
  isPositiveInteger(value.sequence) &&
  isUuid(value.workflow_version_id) &&
  (value.previous_activation_id === null || isUuid(value.previous_activation_id)) &&
  (value.activation_kind === "publish" || value.activation_kind === "rollback") &&
  isPositiveInteger(value.activated_by_user_id) &&
  isIsoDate(value.activated_at) &&
  value.immutable === true &&
  value.runtime_consumed === false;

const invalidResponse = (): never => {
  throw new WhatsappWorkflowContractError(
    "workflow_response_contract_invalid",
    "Workflow Studio devolvio un contrato inesperado; no se aplico ningun cambio local.",
  );
};

const invalidMutation = (): never => {
  throw new WhatsappWorkflowContractError(
    "workflow_request_contract_invalid",
    "La operacion no coincide con el contrato durable verificado.",
  );
};

export const parseWhatsappWorkflowLedgerList = (
  value: unknown,
  expectedTenantId: number,
): WhatsappWorkflowLedgerList => {
  if (
    !isRecord(value) ||
    value.contract_version !== WHATSAPP_WORKFLOW_CONTROL_PLANE_CONTRACT_VERSION ||
    value.status !== "ready" ||
    value.tenant_id !== expectedTenantId ||
    !Array.isArray(value.workflows) ||
    value.workflows.some((workflow) => !isWorkflowSummary(workflow)) ||
    !isPositiveInteger(value.limit) ||
    typeof value.truncated !== "boolean" ||
    !isRuntimeDisconnected(value.runtime_binding)
  ) {
    return invalidResponse();
  }
  return value as unknown as WhatsappWorkflowLedgerList;
};

export const parseWhatsappWorkflowLedger = (
  value: unknown,
  expectedTenantId: number,
  expectedWorkflowId: string,
): WhatsappWorkflowLedger => {
  if (
    !isRecord(value) ||
    value.contract_version !== WHATSAPP_WORKFLOW_CONTROL_PLANE_CONTRACT_VERSION ||
    value.status !== "ready" ||
    value.tenant_id !== expectedTenantId ||
    value.workflow_id !== expectedWorkflowId ||
    !isDraftRevision(value.latest_draft_revision, expectedWorkflowId, true) ||
    !Array.isArray(value.draft_revisions) ||
    value.draft_revisions.some((item) => !isDraftRevision(item, expectedWorkflowId, false)) ||
    !Array.isArray(value.reviews) ||
    value.reviews.some((item) => !isReview(item, expectedWorkflowId)) ||
    !Array.isArray(value.published_versions) ||
    value.published_versions.some((item) => !isVersion(item, expectedWorkflowId)) ||
    !Array.isArray(value.activations) ||
    value.activations.some((item) => !isActivation(item, expectedWorkflowId)) ||
    (value.active_version_id !== null && !isUuid(value.active_version_id)) ||
    !isRuntimeDisconnected(value.runtime_binding)
  ) {
    return invalidResponse();
  }

  const versions = value.published_versions as WhatsappWorkflowVersion[];
  const activations = value.activations as WhatsappWorkflowActivation[];
  const drafts = value.draft_revisions as WhatsappWorkflowDraftRevision[];
  const latestDraft = value.latest_draft_revision as WhatsappWorkflowDraftRevision;
  const reviews = value.reviews as WhatsappWorkflowReview[];
  const draftById = new Map(drafts.map((draft) => [draft.draft_revision_id, draft]));
  const reviewById = new Map(reviews.map((review) => [review.review_id, review]));
  const versionById = new Map(versions.map((version) => [version.version_id, version]));
  const reviewSequencesBySubject = new Map<string, number[]>();
  reviews.forEach((review) => {
    const key = `${review.operation}:${review.subject_id}:${review.subject_digest}`;
    const sequences = reviewSequencesBySubject.get(key) ?? [];
    sequences.push(review.subject_sequence);
    reviewSequencesBySubject.set(key, sequences);
  });
  const reviewSequenceInvalid = Array.from(reviewSequencesBySubject.values()).some((sequences) => {
    const ordered = [...sequences].sort((left, right) => left - right);
    return ordered.some((sequence, index) => sequence !== index + 1);
  });
  if (
    drafts.length === 0 ||
    new Set(drafts.map((draft) => draft.draft_revision_id)).size !== drafts.length ||
    new Set(reviews.map((review) => review.review_id)).size !== reviews.length ||
    new Set(versions.map((version) => version.version_id)).size !== versions.length ||
    new Set(activations.map((activation) => activation.activation_id)).size !== activations.length ||
    drafts.some((draft, index) => draft.revision !== index + 1) ||
    drafts[drafts.length - 1]?.draft_revision_id !== latestDraft.draft_revision_id ||
    drafts[drafts.length - 1]?.revision !== latestDraft.revision ||
    reviews.some(
      (review) =>
        (review.operation === "publish" && review.subject_type !== "draft_revision") ||
        (review.operation === "rollback" && review.subject_type !== "published_version") ||
        (review.operation === "publish" &&
          draftById.get(review.subject_id)?.draft_digest !== review.subject_digest) ||
        (review.operation === "rollback" &&
          versionById.get(review.subject_id)?.content_digest !== review.subject_digest),
    ) ||
    reviewSequenceInvalid ||
    versions.length !== activations.length ||
    versions.some(
      (version, index) =>
        version.version !== index + 1 ||
        activations[index]?.sequence !== index + 1 ||
        activations[index]?.workflow_version_id !== version.version_id ||
        activations[index]?.activation_kind !== version.version_kind ||
        activations[index]?.previous_activation_id !==
          (index === 0 ? null : activations[index - 1]?.activation_id) ||
        reviewById.get(version.review_id)?.decision !== "approved" ||
        reviewById.get(version.review_id)?.operation !==
          (version.version_kind === "publish" ? "publish" : "rollback") ||
        (version.version_kind === "publish" &&
          (reviewById.get(version.review_id)?.subject_id !== version.source_draft_revision_id ||
            draftById.get(version.source_draft_revision_id)?.draft_digest !== version.content_digest)) ||
        (version.version_kind === "rollback" &&
          (reviewById.get(version.review_id)?.subject_id !== version.restored_from_version_id ||
            !version.restored_from_version_id ||
            versionById.get(version.restored_from_version_id)?.content_digest !== version.content_digest)),
    ) ||
    (activations.length
      ? value.active_version_id !== activations[activations.length - 1]?.workflow_version_id
      : value.active_version_id !== null)
  ) {
    return invalidResponse();
  }
  return value as unknown as WhatsappWorkflowLedger;
};

const parseDraftReceipt = (
  value: unknown,
  expectedWorkflowId?: string,
): WhatsappWorkflowDraftReceipt => {
  if (!isRecord(value) || !isRecord(value.draft_revision)) return invalidResponse();
  const workflowId = value.draft_revision.workflow_id;
  if (
    value.contract_version !== WHATSAPP_WORKFLOW_CONTROL_PLANE_CONTRACT_VERSION ||
    value.status !== "draft_saved" ||
    typeof value.idempotent_replay !== "boolean" ||
    !isUuid(workflowId) ||
    (expectedWorkflowId !== undefined && workflowId !== expectedWorkflowId) ||
    !isDraftRevision(value.draft_revision, workflowId, true) ||
    !isRuntimeDisconnected(value.runtime_binding)
  ) {
    return invalidResponse();
  }
  return value as unknown as WhatsappWorkflowDraftReceipt;
};

const parseReviewReceipt = (
  value: unknown,
  expectedWorkflowId: string,
): WhatsappWorkflowReviewReceipt => {
  if (
    !isRecord(value) ||
    value.contract_version !== WHATSAPP_WORKFLOW_REVIEW_CONTRACT_VERSION ||
    value.status !== "review_recorded" ||
    typeof value.idempotent_replay !== "boolean" ||
    !isReview(value.review, expectedWorkflowId)
  ) {
    return invalidResponse();
  }
  return value as unknown as WhatsappWorkflowReviewReceipt;
};

const parsePublicationReceipt = (
  value: unknown,
  expectedWorkflowId: string,
): WhatsappWorkflowPublicationReceipt => {
  if (
    !isRecord(value) ||
    value.contract_version !== WHATSAPP_WORKFLOW_PUBLICATION_CONTRACT_VERSION ||
    value.status !== "control_plane_activation_recorded" ||
    typeof value.idempotent_replay !== "boolean" ||
    typeof value.currently_active !== "boolean" ||
    !isVersion(value.version, expectedWorkflowId) ||
    !isActivation(value.activation, expectedWorkflowId) ||
    value.activation.workflow_version_id !== value.version.version_id ||
    value.activation.activation_kind !== value.version.version_kind ||
    value.activation.sequence !== value.version.version ||
    !isRuntimeDisconnected(value.runtime_binding) ||
    !isRecord(value.external_effects) ||
    value.external_effects.provider_calls !== 0 ||
    value.external_effects.messages_sent !== 0 ||
    value.external_effects.tickets_created !== 0 ||
    value.external_effects.handoffs_created !== 0
  ) {
    return invalidResponse();
  }
  return value as unknown as WhatsappWorkflowPublicationReceipt;
};

const requestOptions = (contract: WhatsappWorkflowStudioDurableContract) => ({
  tenantSlug: contract.tenant.slug,
  cache: "no-store" as RequestCache,
  headers: { Accept: "application/json", "Cache-Control": "no-store" },
});

export const createWhatsappWorkflowIdempotencyKey = () => {
  if (!globalThis.crypto?.randomUUID) {
    throw new WhatsappWorkflowContractError(
      "workflow_secure_idempotency_unavailable",
      "El navegador no puede generar una clave de idempotencia segura.",
    );
  }
  return `wf:${globalThis.crypto.randomUUID()}`;
};

export const parseWhatsappWorkflowDraftJson = (
  source: string,
  contract: WhatsappWorkflowStudioDurableContract,
): UnknownRecord => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new WhatsappWorkflowContractError(
      "workflow_draft_json_invalid",
      "El borrador debe ser un objeto JSON valido.",
    );
  }
  if (!isRecord(parsed)) {
    throw new WhatsappWorkflowContractError(
      "workflow_draft_json_invalid",
      "El borrador debe ser un objeto JSON valido.",
    );
  }
  const draftContract = contract.draft_contract;
  if (
    !isRecord(draftContract) ||
    !isNonEmptyText(draftContract.schema_version) ||
    parsed.schema_version !== draftContract.schema_version ||
    !isPositiveInteger(draftContract.max_bytes) ||
    new TextEncoder().encode(source).byteLength > draftContract.max_bytes
  ) {
    throw new WhatsappWorkflowContractError(
      "workflow_draft_contract_invalid",
      "El JSON no respeta la version o el tamano del contrato de borrador.",
    );
  }
  return parsed;
};

export const listWhatsappWorkflowLedgers = async (
  contract: unknown,
  expectedTenantSlug: string,
) => {
  const scoped = requireDurableScope(contract, expectedTenantSlug);
  const response = await panelApi.get<unknown>(
    `${encodedBasePath(scoped.tenant.slug)}/workflows`,
    requestOptions(scoped),
  );
  return parseWhatsappWorkflowLedgerList(response, scoped.tenant.id);
};

export const getWhatsappWorkflowLedger = async (
  contract: unknown,
  expectedTenantSlug: string,
  workflowId: string,
) => {
  const scoped = requireDurableScope(contract, expectedTenantSlug);
  if (!isUuid(workflowId)) return invalidResponse();
  const response = await panelApi.get<unknown>(
    `${encodedBasePath(scoped.tenant.slug)}/workflows/${encodeURIComponent(workflowId)}`,
    requestOptions(scoped),
  );
  return parseWhatsappWorkflowLedger(response, scoped.tenant.id, workflowId);
};

export const saveWhatsappWorkflowDraft = async ({
  contract,
  expectedTenantSlug,
  draft,
  idempotencyKey,
  workflowId,
  expectedRevision,
}: {
  contract: unknown;
  expectedTenantSlug: string;
  draft: UnknownRecord;
  idempotencyKey: string;
  workflowId?: string;
  expectedRevision?: number;
}) => {
  const scoped = requireDurableScope(contract, expectedTenantSlug);
  if (
    (workflowId !== undefined && !isUuid(workflowId)) ||
    (workflowId !== undefined && !isPositiveInteger(expectedRevision)) ||
    (workflowId === undefined && expectedRevision !== undefined) ||
    !IDEMPOTENCY_PATTERN.test(idempotencyKey)
  ) {
    return invalidMutation();
  }
  const path = workflowId
    ? `${encodedBasePath(scoped.tenant.slug)}/workflows/${encodeURIComponent(workflowId)}/drafts`
    : `${encodedBasePath(scoped.tenant.slug)}/drafts`;
  const body = workflowId
    ? { draft, expected_revision: expectedRevision, idempotency_key: idempotencyKey }
    : { draft, idempotency_key: idempotencyKey };
  const response = await panelApi.post<unknown>(path, body, requestOptions(scoped));
  return parseDraftReceipt(response, workflowId);
};

export const reviewWhatsappWorkflow = async ({
  contract,
  expectedTenantSlug,
  workflowId,
  operation,
  subjectId,
  decision,
  note,
  idempotencyKey,
}: {
  contract: unknown;
  expectedTenantSlug: string;
  workflowId: string;
  operation: "publish" | "rollback";
  subjectId: string;
  decision: "approved" | "rejected";
  note: string;
  idempotencyKey: string;
}) => {
  const scoped = requireDurableScope(contract, expectedTenantSlug);
  if (
    !isUuid(workflowId) ||
    !isUuid(subjectId) ||
    (operation !== "publish" && operation !== "rollback") ||
    (decision !== "approved" && decision !== "rejected") ||
    !isNonEmptyText(note) ||
    note.length > 1000 ||
    !IDEMPOTENCY_PATTERN.test(idempotencyKey)
  ) {
    return invalidMutation();
  }
  const response = await panelApi.post<unknown>(
    `${encodedBasePath(scoped.tenant.slug)}/workflows/${encodeURIComponent(workflowId)}/reviews`,
    {
      operation,
      subject_id: subjectId,
      decision,
      note,
      idempotency_key: idempotencyKey,
    },
    requestOptions(scoped),
  );
  return parseReviewReceipt(response, workflowId);
};

const requireControlPlaneAcknowledgement = (acknowledgement: string) => {
  if (acknowledgement !== WHATSAPP_WORKFLOW_CONTROL_PLANE_ACK) {
    throw new WhatsappWorkflowContractError(
      "workflow_control_plane_ack_required",
      `Escribi ${WHATSAPP_WORKFLOW_CONTROL_PLANE_ACK} para confirmar que no activa el runtime.`,
    );
  }
};

export const publishWhatsappWorkflow = async ({
  contract,
  expectedTenantSlug,
  workflowId,
  draftRevisionId,
  reviewId,
  idempotencyKey,
  acknowledgement,
}: {
  contract: unknown;
  expectedTenantSlug: string;
  workflowId: string;
  draftRevisionId: string;
  reviewId: string;
  idempotencyKey: string;
  acknowledgement: string;
}) => {
  const scoped = requireDurableScope(contract, expectedTenantSlug);
  requireControlPlaneAcknowledgement(acknowledgement);
  if (
    !isUuid(workflowId) ||
    !isUuid(draftRevisionId) ||
    !isUuid(reviewId) ||
    !IDEMPOTENCY_PATTERN.test(idempotencyKey)
  ) {
    return invalidMutation();
  }
  const response = await panelApi.post<unknown>(
    `${encodedBasePath(scoped.tenant.slug)}/workflows/${encodeURIComponent(workflowId)}/publish`,
    {
      draft_revision_id: draftRevisionId,
      review_id: reviewId,
      idempotency_key: idempotencyKey,
    },
    requestOptions(scoped),
  );
  return parsePublicationReceipt(response, workflowId);
};

export const rollbackWhatsappWorkflow = async ({
  contract,
  expectedTenantSlug,
  workflowId,
  targetVersionId,
  reviewId,
  idempotencyKey,
  acknowledgement,
}: {
  contract: unknown;
  expectedTenantSlug: string;
  workflowId: string;
  targetVersionId: string;
  reviewId: string;
  idempotencyKey: string;
  acknowledgement: string;
}) => {
  const scoped = requireDurableScope(contract, expectedTenantSlug);
  requireControlPlaneAcknowledgement(acknowledgement);
  if (
    !isUuid(workflowId) ||
    !isUuid(targetVersionId) ||
    !isUuid(reviewId) ||
    !IDEMPOTENCY_PATTERN.test(idempotencyKey)
  ) {
    return invalidMutation();
  }
  const response = await panelApi.post<unknown>(
    `${encodedBasePath(scoped.tenant.slug)}/workflows/${encodeURIComponent(workflowId)}/rollback`,
    {
      target_version_id: targetVersionId,
      review_id: reviewId,
      idempotency_key: idempotencyKey,
    },
    requestOptions(scoped),
  );
  return parsePublicationReceipt(response, workflowId);
};
