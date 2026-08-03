export const INTERVIEW_API_CONTRACT = 'assessment.interviews.api.v1' as const;
export const INTERVIEW_RESUME_CONTRACT = 'interview.session_resume.v1' as const;
export const INTERVIEW_PROGRESS_CONTRACT = 'interview.progress.v1' as const;
export const INTERVIEW_EVIDENCE_CONTRACT = 'interview.evidence.v1' as const;
export const INTERVIEW_INBOX_CONTRACT_V1 = 'assessment.interviews.inbox.v1' as const;
export const INTERVIEW_INBOX_CONTRACT_V2 = 'assessment.interviews.inbox.v2' as const;
export const INTERVIEW_INBOX_CONTRACT = INTERVIEW_INBOX_CONTRACT_V1;
export const INTERVIEW_ASSIGNMENT_ENVELOPE_CONTRACT =
  'assessment.interviews.assignment.v1' as const;
export const INTERVIEW_ASSIGNMENT_RECEIPT_CONTRACT = 'interview.assignment.v1' as const;
export const INTERVIEW_ASSIGNMENT_CANDIDATES_CONTRACT =
  'assessment.interviews.assignment_candidates.v1' as const;

export type InterviewSessionStatus =
  | 'scheduled'
  | 'active'
  | 'completed'
  | 'interrupted'
  | 'no_show'
  | 'void';

export type InterviewChannel =
  | 'api'
  | 'web'
  | 'widget'
  | 'whatsapp'
  | 'voice'
  | 'in_person';

export type InterviewEvidenceType =
  | 'audio'
  | 'image'
  | 'file'
  | 'transcript'
  | 'location'
  | 'structured';

export type InterviewNextAction =
  | 'issue_consent_challenge'
  | 'record_consent_and_start'
  | 'capture_step'
  | 'complete_interview'
  | 'human_review'
  | 'operator_reschedule_required'
  | 'none';

export type InterviewAvailableAction =
  | 'issue_consent_challenge'
  | 'start_session'
  | 'add_evidence'
  | 'complete_session';

export interface InterviewResumeStep {
  step_ref: string;
  section_id: string;
  question_id: string;
  prompt: string;
  required: boolean;
  evidence_types: InterviewEvidenceType[];
  ordinal: number;
}

export interface InterviewSessionConsent {
  granted: boolean;
  policy_version: string | null;
  text_sha256: string | null;
  recorded_at: string | null;
  source: string | null;
  attestation_kind: string | null;
  evidence_provider: string | null;
  evidence_ref: string | null;
  evidence_sha256: string | null;
  evidence_captured_at: string | null;
  attested_by_user_id: number | null;
  verified_against_program_version: boolean;
  text_snapshot_verified: boolean;
  participant_evidence_bound: boolean;
  participant_evidence_verified: boolean;
  channel_identity_evidence_verified: boolean;
  consent_text_delivery_evidence_verified: boolean;
  civil_identity_verified: false;
  proof_status: string;
}

export interface InterviewSessionSnapshot {
  id: number;
  tenant_id: number;
  assessment_case_id: number;
  program_version_id: number;
  status: InterviewSessionStatus;
  channel: InterviewChannel;
  interviewer_user_id: number | null;
  subject_channel_identity: {
    binding_id: number | null;
    identity_version: number | null;
    chat_session_id: string | null;
    channel_identity_pinned: boolean;
    civil_identity_verified: false;
  };
  scheduled_for: string | null;
  consent: InterviewSessionConsent;
  started_at: string | null;
  completed_at: string | null;
  evidence_count: number;
}

export interface InterviewEvidenceProvenance extends Record<string, unknown> {
  provider?: string;
  source_channel?: string;
  source_message_ref?: string;
  captured_at?: string;
  mime_type?: string;
  transformation?: string;
  model_version?: string;
  step_ref?: string;
}

export interface InterviewEvidenceSnapshot {
  contract_version: typeof INTERVIEW_EVIDENCE_CONTRACT;
  id: number;
  tenant_id: number;
  interview_session_id: number;
  evidence_type: InterviewEvidenceType;
  source_channel: InterviewChannel;
  storage_ref: string;
  content_sha256: string;
  provenance: InterviewEvidenceProvenance;
  size_bytes: number | null;
  created_at: string | null;
}

export interface InterviewProgressSnapshot {
  contract_version: typeof INTERVIEW_PROGRESS_CONTRACT;
  mode: 'step_evidence_v1' | 'legacy_advisory';
  completion_gate_enforced: boolean;
  total_steps: number;
  required_steps: number;
  completed_steps: number;
  completed_required_steps: number;
  pending_required_steps: number;
  percent: number | null;
  required_steps_satisfied: boolean | null;
  completed_step_refs: string[];
  pending_required_step_refs: string[];
  step_evidence_counts: Record<string, number>;
  evidence_count: number;
  evidence_by_type: Record<string, number>;
  last_checkpoint_at: string | null;
  last_checkpoint_source: string;
  current_step: InterviewResumeStep | null;
  session_status: InterviewSessionStatus;
  can_complete: boolean;
}

export interface InterviewSessionResume {
  contract_version: typeof INTERVIEW_RESUME_CONTRACT;
  tenant_id: number;
  session: InterviewSessionSnapshot;
  case: {
    id: number;
    status: string;
    program_id: number;
    program_version_id: number;
    source_channel: string;
  };
  program_snapshot: {
    id: number;
    program_id: number;
    version_number: number;
    definition_hash: string;
    definition: Record<string, unknown>;
    runtime_contract: 'interview.definition.v1' | null;
    immutable: true;
  };
  steps: InterviewResumeStep[];
  progress: InterviewProgressSnapshot;
  evidence: InterviewEvidenceSnapshot[];
  supported_evidence_types: InterviewEvidenceType[];
  next_action: InterviewNextAction;
  available_actions: InterviewAvailableAction[];
  resumable: boolean;
  updated_at: string | null;
}

export interface InterviewResumeEnvelope {
  ok: true;
  contract_version: typeof INTERVIEW_API_CONTRACT;
  resume: InterviewSessionResume;
}

export type InterviewInboxActionId =
  | 'view_resume'
  | 'assign'
  | 'review'
  | 'follow_up';

export interface InterviewInboxAction {
  action_id: InterviewInboxActionId;
  label: string;
  enabled: boolean;
  method: 'GET' | 'POST' | null;
  endpoint: string | null;
  disabled_reason_code: string | null;
  candidates?: {
    method: 'GET';
    endpoint: string;
  };
}

export interface InterviewAssignmentDialogPresentation {
  title: string;
  description: string;
  assignee_label: string;
  assignee_placeholder: string;
  reason_label: string;
  submit_label: string;
  retry_label: string;
  cancel_label: string;
  loading_candidates_label: string;
  candidates_error_label: string;
  submit_error_label: string;
  reasons: Array<{
    reason_code: InterviewAssignmentReasonCode;
    label: string;
  }>;
}

export interface InterviewInboxItem {
  id: number;
  tenant_id: number;
  session: {
    id: number;
    status: InterviewSessionStatus;
    status_label: string;
    channel: InterviewChannel;
    channel_label: string;
    interviewer_user_id: number | null;
    scheduled_for: string | null;
    started_at: string | null;
    completed_at: string | null;
    updated_at: string;
    consent_granted: boolean;
  };
  case: {
    id: number;
    status: string;
    subject_type: string;
    subject_reference_exposed: false;
    source_channel: InterviewChannel;
  };
  program: {
    id: number;
    name: string;
    program_type: string;
    version_id: number;
    version_number: number;
    immutable: true;
  };
  progress: {
    contract_version: typeof INTERVIEW_PROGRESS_CONTRACT;
    mode: 'step_evidence_v1' | 'legacy_advisory';
    completion_gate_enforced: boolean;
    total_steps: number;
    required_steps: number;
    completed_steps: number;
    completed_required_steps: number;
    pending_required_steps: number;
    percent: number | null;
    evidence_count: number;
    last_checkpoint_at: string | null;
    current_step_ref: string | null;
    can_complete: boolean;
  };
  evidence: {
    total: number;
    by_type: Record<InterviewEvidenceType, number>;
    last_captured_at: string | null;
    content_hashes_present: number;
    references_exposed: false;
  };
  review: {
    required: boolean;
    state: 'pending' | 'not_ready';
    decision_available: false;
  };
  assignment:
    | {
        interviewer_user_id: number | null;
        managed_assignment_available: false;
      }
    | {
        interviewer_user_id: number | null;
        assignment_id: number | null;
        version: number;
        managed_assignment_available: true;
        assigned_user_label: string | null;
      };
  audit: {
    source: 'audit_event';
    events_recorded: number;
    last_event: {
      event_type: string;
      actor_user_id: number | null;
      created_at: string;
    } | null;
    sensitive_details_exposed: false;
  };
  next_action: InterviewNextAction;
  next_action_label: string;
  actions: Record<InterviewInboxActionId, InterviewInboxAction>;
}

export interface InterviewInboxEnvelope {
  ok: true;
  contract_version: typeof INTERVIEW_API_CONTRACT;
  inbox: {
    contract_version:
      | typeof INTERVIEW_INBOX_CONTRACT_V1
      | typeof INTERVIEW_INBOX_CONTRACT_V2;
    tenant: { id: number; slug: string; name: string };
    presentation: {
      title: string;
      description: string;
      empty_title: string;
      empty_description: string;
      assignment_dialog?: InterviewAssignmentDialogPresentation;
    };
    freshness: {
      generated_at: string;
      source:
        | 'assessment_case_interview_session_evidence_audit_event'
        | 'assessment_case_interview_session_evidence_assignment_audit_event';
      synthetic: false;
    };
    summary: {
      scope: 'current_page';
      sessions: number;
      scheduled: number;
      active: number;
      awaiting_human_review: number;
      with_evidence: number;
      evidence_records: number;
      audit_events: number;
    };
    capabilities: {
      read_only: boolean;
      can_view_inbox: true;
      can_view_resume: boolean;
      can_assign: boolean;
      can_review: false;
      can_mark_follow_up: false;
    };
    governance: {
      assignment_workflow_persisted: boolean;
      human_review_workflow_persisted: false;
      follow_up_workflow_persisted: false;
      automated_decisions_allowed: false;
      disabled_reason_codes: {
        assign:
          | 'interview_assignment_domain_not_implemented'
          | 'interview_assignment_capability_required'
          | null;
        review: 'interview_human_review_domain_not_implemented';
        follow_up: 'interview_follow_up_domain_not_implemented';
      };
    };
    filters: { status: InterviewSessionStatus | null };
    page: {
      limit: number;
      returned: number;
      has_more: boolean;
      continuation_available: false;
      continuation_disabled_reason_code: 'interview_inbox_cursor_not_implemented' | null;
    };
    items: InterviewInboxItem[];
  };
}

export type InterviewAssignmentReasonCode =
  | 'initial_assignment'
  | 'workload_balance'
  | 'availability'
  | 'specialty_match'
  | 'continuity'
  | 'supervisor_override';

export interface InterviewAssignmentCandidate {
  user_id: number;
  display_name: string;
  role_label: string;
  can_conduct: true;
}

export interface InterviewAssignmentCandidatesEnvelope {
  ok: true;
  contract_version: typeof INTERVIEW_API_CONTRACT;
  request_id: string;
  assignment_candidates: {
    contract_version: typeof INTERVIEW_ASSIGNMENT_CANDIDATES_CONTRACT;
    tenant: { id: number; slug: string };
    candidates: InterviewAssignmentCandidate[];
    presentation: {
      empty_title: string;
      empty_description: string;
    };
  };
}

export interface InterviewAssignmentRequest {
  assignee_user_id: number;
  reason_code: InterviewAssignmentReasonCode;
  expected_assignment_version: number;
}

export interface InterviewAssignmentReceipt {
  contract_version: typeof INTERVIEW_ASSIGNMENT_RECEIPT_CONTRACT;
  id: number;
  tenant_id: number;
  interview_session_id: number;
  version: number;
  assignee_user_id: number;
  previous_assignee_user_id: number | null;
  assigned_by_user_id: number;
  reason_code: InterviewAssignmentReasonCode;
  supersedes_assignment_id: number | null;
  created_at: string;
  history_immutable: true;
}

export interface InterviewAssignmentEnvelope {
  ok: true;
  contract_version: typeof INTERVIEW_ASSIGNMENT_ENVELOPE_CONTRACT;
  request_id: string;
  assignment: InterviewAssignmentReceipt;
  idempotency_replayed: boolean;
}
