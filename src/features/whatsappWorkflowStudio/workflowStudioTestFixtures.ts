export const WORKFLOW_ID = "00000000-0000-4000-8000-000000000001";
export const DRAFT_ID = "00000000-0000-4000-8000-000000000002";
export const REVIEW_ID = "00000000-0000-4000-8000-000000000003";
export const VERSION_ID = "00000000-0000-4000-8000-000000000004";
export const ACTIVATION_ID = "00000000-0000-4000-8000-000000000005";

export const makeDurableWorkflowStudioContract = (slug = "demo", tenantId = 7) => {
  const base = `/api/v2/tenants/${encodeURIComponent(slug)}/whatsapp/workflow-studio`;
  return {
    contract_version: "whatsapp.workflow_studio.v1",
    tenant: { id: tenantId, slug },
    mode: "durable_control_plane",
    durable_control_plane_gate: {
      contract_version: "whatsapp.workflow_control_plane_gate.v1",
      available: true,
      enabled: true,
      plan_allowed: true,
      tenant_allowlisted: true,
      reason_codes: [],
      runtime_binding: {
        available: false,
        reason_code: "workflow_runtime_binding_missing",
      },
    },
    capabilities: {
      draft: {
        label: "Borrador durable",
        available: true,
        status: "ready",
        persistent: true,
        endpoint: `${base}/drafts`,
        revision_endpoint_template: `${base}/workflows/{workflow_id}/drafts`,
      },
      validate: {
        label: "Validar",
        available: true,
        status: "ready",
        endpoint: `${base}/validate`,
        method: "POST",
        external_effects: false,
      },
      simulate: {
        label: "Simular",
        available: true,
        status: "ready",
        endpoint: `${base}/simulate`,
        method: "POST",
        external_effects: false,
        database_writes: false,
      },
      versioning: {
        label: "Versionado",
        available: true,
        status: "ready",
        history_policy: "append_only",
        list_endpoint: `${base}/workflows`,
        detail_endpoint_template: `${base}/workflows/{workflow_id}`,
      },
      review: {
        label: "Revisión",
        available: true,
        status: "ready",
        endpoint_template: `${base}/workflows/{workflow_id}/reviews`,
        decision_contract: ["approved", "rejected"],
        ordering: "monotonic_sequence_per_exact_subject",
        latest_decision_required: true,
        later_review_supersedes_prior_approval: true,
        same_actor_publish_forbidden: true,
        publish_reviewer_must_differ_from: ["draft_author", "publisher"],
        rollback_reviewer_must_differ_from: ["publisher"],
      },
      runtime: {
        label: "Runtime",
        available: false,
        status: "blocked",
        blocker: "workflow_runtime_binding_missing",
      },
      publish: {
        label: "Publicación",
        available: true,
        status: "control_plane_only",
        review_required: true,
        separation_of_duties: true,
        transactional_serialization: "immutable_first_draft_anchor",
        revalidates_after_lock: [
          "idempotency",
          "latest_draft",
          "latest_review",
          "active_content_digest",
        ],
        runtime_effect: false,
        endpoint_template: `${base}/workflows/{workflow_id}/publish`,
        method: "POST",
      },
      rollback: {
        label: "Rollback",
        available: true,
        status: "control_plane_only",
        creates_new_version: true,
        mutates_history: false,
        review_required: true,
        transactional_serialization: "immutable_first_draft_anchor",
        revalidates_after_lock: [
          "idempotency",
          "latest_review",
          "active_content_digest",
        ],
        endpoint_template: `${base}/workflows/{workflow_id}/rollback`,
        method: "POST",
      },
    },
    draft_contract: {
      schema_version: "whatsapp.workflow_draft.v1",
      max_bytes: 262144,
      max_steps: 100,
      tenant_scope_policy: "authenticated_tenant_only",
    },
    publication_readiness: {
      ready: true,
      status: "control_plane_ready",
      scope: "control_plane_only",
      blockers: [],
      runtime_blockers: [
        {
          code: "workflow_runtime_binding_missing",
          path: "publication",
          message: "El runtime sigue desconectado.",
        },
      ],
    },
    side_effect_policy: {
      validate: "none",
      simulate: "proposed_effects_only",
      publish: "database_control_plane_only",
      rollback: "append_only_database_control_plane_only",
      provider_calls: false,
      messages_sent: false,
      tickets_created: false,
      handoffs_created: false,
    },
    frontend_contract: {
      render_as: "workflow_studio_readiness",
      title: "Workflow Studio",
      description: "Plano de control gobernado.",
      status_label: "Plano de control durable",
      blockers_title: "Bloqueos reales",
      safety_note: "No ejecuta efectos externos.",
      capability_order: ["draft", "validate", "simulate", "versioning", "review", "runtime", "publish", "rollback"],
      status_labels: {
        ready: "Listo",
        blocked: "Bloqueado",
        control_plane_only: "Sólo plano de control",
      },
    },
  };
};

export const draftDocument = {
  schema_version: "whatsapp.workflow_draft.v1",
  name: "Atención municipal",
  trigger: { type: "inbound_message" },
  entry_step_id: "create_case",
  steps: [
    { id: "create_case", type: "create_ticket", category: "arbolado", next: "stop" },
    { id: "stop", type: "stop", outcome: "completed" },
  ],
};

export const makeDraftRevision = (includeDraft = true) => ({
  draft_revision_id: DRAFT_ID,
  workflow_id: WORKFLOW_ID,
  revision: 1,
  schema_version: "whatsapp.workflow_draft.v1",
  draft_digest: "a".repeat(64),
  authored_by_user_id: 11,
  created_at: "2026-08-02T12:00:00+00:00",
  immutable: true,
  ...(includeDraft ? { draft: draftDocument } : {}),
});

export const approvedPublishReview = {
  contract_version: "whatsapp.workflow_review.v1",
  review_id: REVIEW_ID,
  workflow_id: WORKFLOW_ID,
  operation: "publish",
  subject_type: "draft_revision",
  subject_id: DRAFT_ID,
  subject_digest: "a".repeat(64),
  subject_sequence: 1,
  decision: "approved",
  review_note: "Revisión independiente aprobada.",
  reviewed_by_user_id: 12,
  reviewed_at: "2026-08-02T12:05:00+00:00",
  immutable: true,
};

export const makeLedgerList = (tenantId = 7) => ({
  contract_version: "whatsapp.workflow_control_plane.v1",
  status: "ready",
  tenant_id: tenantId,
  workflows: [
    {
      workflow_id: WORKFLOW_ID,
      name: "Atención municipal",
      latest_draft_revision: 1,
      published_version_count: 0,
      active_version_id: null,
    },
  ],
  limit: 100,
  truncated: false,
  runtime_binding: {
    available: false,
    consumes_active_version: false,
    reason_code: "workflow_runtime_binding_missing",
  },
});

export const makeLedger = (tenantId = 7) => ({
  contract_version: "whatsapp.workflow_control_plane.v1",
  status: "ready",
  tenant_id: tenantId,
  workflow_id: WORKFLOW_ID,
  latest_draft_revision: makeDraftRevision(true),
  draft_revisions: [makeDraftRevision(false)],
  reviews: [approvedPublishReview],
  published_versions: [],
  activations: [],
  active_version_id: null,
  runtime_binding: {
    available: false,
    consumes_active_version: false,
    reason_code: "workflow_runtime_binding_missing",
  },
});

export const makeDraftReceipt = (idempotentReplay = false) => ({
  contract_version: "whatsapp.workflow_control_plane.v1",
  status: "draft_saved",
  idempotent_replay: idempotentReplay,
  draft_revision: makeDraftRevision(true),
  runtime_binding: {
    available: false,
    reason_code: "workflow_runtime_binding_missing",
  },
});

export const makePublicationReceipt = () => ({
  contract_version: "whatsapp.workflow_publication.v1",
  status: "control_plane_activation_recorded",
  idempotent_replay: false,
  currently_active: true,
  version: {
    version_id: VERSION_ID,
    workflow_id: WORKFLOW_ID,
    version: 1,
    version_kind: "publish",
    source_draft_revision_id: DRAFT_ID,
    restored_from_version_id: null,
    review_id: REVIEW_ID,
    schema_version: "whatsapp.workflow_draft.v1",
    content_digest: "a".repeat(64),
    published_by_user_id: 11,
    published_at: "2026-08-02T12:10:00+00:00",
    immutable: true,
    document: draftDocument,
  },
  activation: {
    activation_id: ACTIVATION_ID,
    workflow_id: WORKFLOW_ID,
    sequence: 1,
    workflow_version_id: VERSION_ID,
    previous_activation_id: null,
    activation_kind: "publish",
    activated_by_user_id: 11,
    activated_at: "2026-08-02T12:10:00+00:00",
    immutable: true,
    runtime_consumed: false,
  },
  runtime_binding: {
    available: false,
    consumes_active_version: false,
    reason_code: "workflow_runtime_binding_missing",
  },
  external_effects: {
    provider_calls: 0,
    messages_sent: 0,
    tickets_created: 0,
    handoffs_created: 0,
  },
});
