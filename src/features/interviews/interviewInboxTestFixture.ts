import {
  INTERVIEW_INBOX_CONTRACT_V2,
  type InterviewInboxEnvelope,
} from './interviewsTypes';

export const interviewInboxFixture: InterviewInboxEnvelope = {
  ok: true,
  contract_version: 'assessment.interviews.api.v1',
  inbox: {
    contract_version: 'assessment.interviews.inbox.v1',
    tenant: { id: 7, slug: 'escuela-demo', name: 'Institucion demo' },
    presentation: {
      title: 'Entrevistas y evaluaciones',
      description: 'Bandeja operativa con progreso, evidencia y trazabilidad verificables.',
      empty_title: 'No hay entrevistas en esta bandeja',
      empty_description: 'Las sesiones aparecerán cuando exista una entrevista programada.',
    },
    freshness: {
      generated_at: '2026-08-02T10:30:00Z',
      source: 'assessment_case_interview_session_evidence_audit_event',
      synthetic: false,
    },
    summary: {
      scope: 'current_page',
      sessions: 1,
      scheduled: 0,
      active: 1,
      awaiting_human_review: 0,
      with_evidence: 1,
      evidence_records: 1,
      audit_events: 3,
    },
    capabilities: {
      read_only: true,
      can_view_inbox: true,
      can_view_resume: true,
      can_assign: false,
      can_review: false,
      can_mark_follow_up: false,
    },
    governance: {
      assignment_workflow_persisted: false,
      human_review_workflow_persisted: false,
      follow_up_workflow_persisted: false,
      automated_decisions_allowed: false,
      disabled_reason_codes: {
        assign: 'interview_assignment_domain_not_implemented',
        review: 'interview_human_review_domain_not_implemented',
        follow_up: 'interview_follow_up_domain_not_implemented',
      },
    },
    filters: { status: null },
    page: {
      limit: 50,
      returned: 1,
      has_more: false,
      continuation_available: false,
      continuation_disabled_reason_code: null,
    },
    items: [
      {
        id: 42,
        tenant_id: 7,
        session: {
          id: 42,
          status: 'active',
          status_label: 'En curso',
          channel: 'whatsapp',
          channel_label: 'WhatsApp',
          interviewer_user_id: 9,
          scheduled_for: '2026-08-02T10:00:00Z',
          started_at: '2026-08-02T10:05:00Z',
          completed_at: null,
          updated_at: '2026-08-02T10:20:00Z',
          consent_granted: true,
        },
        case: {
          id: 12,
          status: 'in_progress',
          subject_type: 'student_applicant',
          subject_reference_exposed: false,
          source_channel: 'whatsapp',
        },
        program: {
          id: 2,
          name: 'Ingreso institucional',
          program_type: 'school_admission',
          version_id: 3,
          version_number: 1,
          immutable: true,
        },
        progress: {
          contract_version: 'interview.progress.v1',
          mode: 'step_evidence_v1',
          completion_gate_enforced: true,
          total_steps: 2,
          required_steps: 2,
          completed_steps: 1,
          completed_required_steps: 1,
          pending_required_steps: 1,
          percent: 50,
          evidence_count: 1,
          last_checkpoint_at: '2026-08-02T10:20:00Z',
          current_step_ref: 'perfil.documentacion',
          can_complete: false,
        },
        evidence: {
          total: 1,
          by_type: {
            audio: 1,
            image: 0,
            file: 0,
            transcript: 0,
            location: 0,
            structured: 0,
          },
          last_captured_at: '2026-08-02T10:20:00Z',
          content_hashes_present: 1,
          references_exposed: false,
        },
        review: {
          required: false,
          state: 'not_ready',
          decision_available: false,
        },
        assignment: {
          interviewer_user_id: 9,
          managed_assignment_available: false,
        },
        audit: {
          source: 'audit_event',
          events_recorded: 3,
          last_event: {
            event_type: 'interview.evidence.created',
            actor_user_id: 9,
            created_at: '2026-08-02T10:20:00Z',
          },
          sensitive_details_exposed: false,
        },
        next_action: 'capture_step',
        next_action_label: 'Continuar captura de evidencia',
        actions: {
          view_resume: {
            action_id: 'view_resume',
            label: 'Abrir checkpoint',
            enabled: true,
            method: 'GET',
            endpoint: '/api/v2/interviews/sessions/42',
            disabled_reason_code: null,
          },
          assign: {
            action_id: 'assign',
            label: 'Asignar responsable',
            enabled: false,
            method: null,
            endpoint: null,
            disabled_reason_code: 'interview_assignment_domain_not_implemented',
          },
          review: {
            action_id: 'review',
            label: 'Registrar revisión',
            enabled: false,
            method: null,
            endpoint: null,
            disabled_reason_code: 'interview_human_review_domain_not_implemented',
          },
          follow_up: {
            action_id: 'follow_up',
            label: 'Marcar seguimiento',
            enabled: false,
            method: null,
            endpoint: null,
            disabled_reason_code: 'interview_follow_up_domain_not_implemented',
          },
        },
      },
    ],
  },
};

export const managedInterviewInboxFixture = (): InterviewInboxEnvelope => {
  const fixture = structuredClone(interviewInboxFixture);
  fixture.inbox.contract_version = INTERVIEW_INBOX_CONTRACT_V2;
  fixture.inbox.presentation.assignment_dialog = {
    title: 'Asignar responsable',
    description: 'Seleccioná una persona autorizada para conducir esta entrevista.',
    assignee_label: 'Responsable',
    assignee_placeholder: 'Seleccionar responsable',
    reason_label: 'Motivo de la asignación',
    submit_label: 'Confirmar asignación',
    retry_label: 'Reintentar',
    cancel_label: 'Cancelar',
    loading_candidates_label: 'Cargando responsables autorizados',
    candidates_error_label: 'No pudimos cargar los responsables autorizados.',
    submit_error_label: 'No pudimos registrar la asignación.',
    reasons: [
      { reason_code: 'initial_assignment', label: 'Asignación inicial' },
      { reason_code: 'workload_balance', label: 'Balance de carga' },
      { reason_code: 'availability', label: 'Disponibilidad' },
      { reason_code: 'specialty_match', label: 'Especialidad requerida' },
      { reason_code: 'continuity', label: 'Continuidad del caso' },
      { reason_code: 'supervisor_override', label: 'Reasignación supervisada' },
    ],
  };
  fixture.inbox.freshness.source =
    'assessment_case_interview_session_evidence_assignment_audit_event';
  fixture.inbox.capabilities.read_only = false;
  fixture.inbox.capabilities.can_assign = true;
  fixture.inbox.governance.assignment_workflow_persisted = true;
  fixture.inbox.governance.disabled_reason_codes.assign = null;
  fixture.inbox.items[0].assignment = {
    interviewer_user_id: 9,
    assignment_id: 17,
    version: 2,
    managed_assignment_available: true,
    assigned_user_label: 'Responsable actual',
  };
  fixture.inbox.items[0].actions.assign = {
    action_id: 'assign',
    label: 'Asignar responsable',
    enabled: true,
    method: 'POST',
    endpoint: '/api/v2/interviews/sessions/42/assignment',
    disabled_reason_code: null,
    candidates: {
      method: 'GET',
      endpoint: '/api/v2/interviews/assignment-candidates',
    },
  };
  return fixture;
};
