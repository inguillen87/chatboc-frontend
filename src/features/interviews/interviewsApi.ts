import { panelApi } from '@/api/v2/client';
import { ApiError } from '@/utils/api';
import {
  INTERVIEW_API_CONTRACT,
  INTERVIEW_EVIDENCE_CONTRACT,
  INTERVIEW_INBOX_CONTRACT_V1,
  INTERVIEW_INBOX_CONTRACT_V2,
  INTERVIEW_PROGRESS_CONTRACT,
  INTERVIEW_RESUME_CONTRACT,
  type InterviewAssignmentReasonCode,
  type InterviewChannel,
  type InterviewEvidenceType,
  type InterviewInboxEnvelope,
  type InterviewInboxItem,
  type InterviewResumeEnvelope,
  type InterviewResumeStep,
  type InterviewSessionStatus,
} from './interviewsTypes';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const contractError = (field: string, received?: unknown) =>
  new ApiError('El backend devolvio un contrato de reanudacion incompatible.', 502, {
    reason_code: 'interview_resume_contract_invalid',
    field,
    ...(typeof received === 'string' || typeof received === 'number'
      ? { received }
      : {}),
  });

const requireRecord = (value: unknown, field: string): UnknownRecord => {
  if (!isRecord(value)) throw contractError(field);
  return value;
};

const requireString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw contractError(field);
  return value;
};

const requireNumber = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw contractError(field);
  return value;
};

const requireBoolean = (value: unknown, field: string): boolean => {
  if (typeof value !== 'boolean') throw contractError(field);
  return value;
};

const requireStringList = (value: unknown, field: string): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw contractError(field);
  }
  return value;
};

const validateStep = (value: unknown, field: string): InterviewResumeStep => {
  const step = requireRecord(value, field);
  requireString(step.step_ref, `${field}.step_ref`);
  requireString(step.section_id, `${field}.section_id`);
  requireString(step.question_id, `${field}.question_id`);
  requireString(step.prompt, `${field}.prompt`);
  requireBoolean(step.required, `${field}.required`);
  requireStringList(step.evidence_types, `${field}.evidence_types`);
  requireNumber(step.ordinal, `${field}.ordinal`);
  return step as unknown as InterviewResumeStep;
};

export const normalizeInterviewSessionId = (
  value: string | number | null | undefined,
): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = typeof value === 'number' ? value : Number(value.trim());
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : null;
};

export const parseInterviewResumeEnvelope = (
  value: unknown,
  expectedSessionId?: number | null,
): InterviewResumeEnvelope => {
  const envelope = requireRecord(value, 'response');
  if (envelope.ok !== true) throw contractError('response.ok', envelope.ok);
  if (envelope.contract_version !== INTERVIEW_API_CONTRACT) {
    throw contractError('response.contract_version', envelope.contract_version);
  }

  const resume = requireRecord(envelope.resume, 'response.resume');
  if (resume.contract_version !== INTERVIEW_RESUME_CONTRACT) {
    throw contractError('response.resume.contract_version', resume.contract_version);
  }
  requireNumber(resume.tenant_id, 'response.resume.tenant_id');
  requireBoolean(resume.resumable, 'response.resume.resumable');
  requireString(resume.next_action, 'response.resume.next_action');
  requireStringList(resume.available_actions, 'response.resume.available_actions');
  requireStringList(
    resume.supported_evidence_types,
    'response.resume.supported_evidence_types',
  );

  const session = requireRecord(resume.session, 'response.resume.session');
  const sessionId = requireNumber(session.id, 'response.resume.session.id');
  if (expectedSessionId && sessionId !== expectedSessionId) {
    throw contractError('response.resume.session.id', sessionId);
  }
  requireNumber(session.tenant_id, 'response.resume.session.tenant_id');
  requireString(session.status, 'response.resume.session.status');
  requireString(session.channel, 'response.resume.session.channel');
  requireNumber(session.evidence_count, 'response.resume.session.evidence_count');
  const consent = requireRecord(session.consent, 'response.resume.session.consent');
  requireBoolean(consent.granted, 'response.resume.session.consent.granted');
  requireString(consent.proof_status, 'response.resume.session.consent.proof_status');

  const program = requireRecord(
    resume.program_snapshot,
    'response.resume.program_snapshot',
  );
  if (program.immutable !== true) {
    throw contractError('response.resume.program_snapshot.immutable', program.immutable);
  }
  requireNumber(program.id, 'response.resume.program_snapshot.id');
  requireNumber(program.program_id, 'response.resume.program_snapshot.program_id');
  requireNumber(
    program.version_number,
    'response.resume.program_snapshot.version_number',
  );
  requireString(
    program.definition_hash,
    'response.resume.program_snapshot.definition_hash',
  );
  requireRecord(program.definition, 'response.resume.program_snapshot.definition');

  if (!Array.isArray(resume.steps)) throw contractError('response.resume.steps');
  resume.steps.forEach((step, index) =>
    validateStep(step, `response.resume.steps[${index}]`),
  );

  const progress = requireRecord(resume.progress, 'response.resume.progress');
  if (progress.contract_version !== INTERVIEW_PROGRESS_CONTRACT) {
    throw contractError(
      'response.resume.progress.contract_version',
      progress.contract_version,
    );
  }
  requireString(progress.mode, 'response.resume.progress.mode');
  requireBoolean(
    progress.completion_gate_enforced,
    'response.resume.progress.completion_gate_enforced',
  );
  [
    'total_steps',
    'required_steps',
    'completed_steps',
    'completed_required_steps',
    'pending_required_steps',
    'evidence_count',
  ].forEach((field) => requireNumber(progress[field], `response.resume.progress.${field}`));
  if (progress.percent !== null) {
    requireNumber(progress.percent, 'response.resume.progress.percent');
  }
  requireBoolean(progress.can_complete, 'response.resume.progress.can_complete');
  requireStringList(
    progress.completed_step_refs,
    'response.resume.progress.completed_step_refs',
  );
  requireStringList(
    progress.pending_required_step_refs,
    'response.resume.progress.pending_required_step_refs',
  );
  requireRecord(
    progress.step_evidence_counts,
    'response.resume.progress.step_evidence_counts',
  );
  requireRecord(progress.evidence_by_type, 'response.resume.progress.evidence_by_type');
  if (progress.current_step !== null) {
    validateStep(progress.current_step, 'response.resume.progress.current_step');
  }

  if (!Array.isArray(resume.evidence)) throw contractError('response.resume.evidence');
  resume.evidence.forEach((item, index) => {
    const evidence = requireRecord(item, `response.resume.evidence[${index}]`);
    if (evidence.contract_version !== INTERVIEW_EVIDENCE_CONTRACT) {
      throw contractError(
        `response.resume.evidence[${index}].contract_version`,
        evidence.contract_version,
      );
    }
    requireNumber(evidence.id, `response.resume.evidence[${index}].id`);
    requireNumber(
      evidence.interview_session_id,
      `response.resume.evidence[${index}].interview_session_id`,
    );
    requireString(
      evidence.evidence_type,
      `response.resume.evidence[${index}].evidence_type`,
    );
    requireString(
      evidence.source_channel,
      `response.resume.evidence[${index}].source_channel`,
    );
    requireString(
      evidence.storage_ref,
      `response.resume.evidence[${index}].storage_ref`,
    );
    requireString(
      evidence.content_sha256,
      `response.resume.evidence[${index}].content_sha256`,
    );
    requireRecord(
      evidence.provenance,
      `response.resume.evidence[${index}].provenance`,
    );
  });

  return envelope as unknown as InterviewResumeEnvelope;
};

export const getInterviewResumeV2 = async (
  sessionId: string | number,
  tenantSlug: string,
): Promise<InterviewResumeEnvelope> => {
  const normalizedSessionId = normalizeInterviewSessionId(sessionId);
  if (!normalizedSessionId) {
    throw new ApiError('La sesion de entrevista no es valida.', 400, {
      reason_code: 'interview_session_id_invalid',
    });
  }
  const normalizedTenantSlug = tenantSlug.trim();
  if (!normalizedTenantSlug) {
    throw new ApiError('La reanudacion requiere un tenant explicito.', 400, {
      reason_code: 'missing_tenant',
    });
  }

  const response = await panelApi.get<unknown>(
    `/api/v2/interviews/sessions/${normalizedSessionId}`,
    {
      tenantSlug: normalizedTenantSlug,
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    },
  );
  return parseInterviewResumeEnvelope(response, normalizedSessionId);
};

const INBOX_SESSION_STATUSES = new Set<InterviewSessionStatus>([
  'scheduled',
  'active',
  'completed',
  'interrupted',
  'no_show',
  'void',
]);
const INBOX_CHANNELS = new Set<InterviewChannel>([
  'api',
  'web',
  'widget',
  'whatsapp',
  'voice',
  'in_person',
]);
const INBOX_EVIDENCE_TYPES: InterviewEvidenceType[] = [
  'audio',
  'image',
  'file',
  'transcript',
  'location',
  'structured',
];
const INBOX_NEXT_ACTIONS = new Set([
  'issue_consent_challenge',
  'record_consent_and_start',
  'capture_step',
  'complete_interview',
  'human_review',
  'operator_reschedule_required',
  'none',
]);
const INTERVIEW_ASSIGNMENT_REASON_CODES = new Set<InterviewAssignmentReasonCode>([
  'initial_assignment',
  'workload_balance',
  'availability',
  'specialty_match',
  'continuity',
  'supervisor_override',
]);

const inboxContractError = (field: string, received?: unknown) =>
  new ApiError('El backend devolvio un contrato de bandeja incompatible.', 502, {
    reason_code: 'interview_inbox_contract_invalid',
    field,
    ...(typeof received === 'string' || typeof received === 'number'
      ? { received }
      : {}),
  });

const inboxRecord = (value: unknown, field: string): UnknownRecord => {
  if (!isRecord(value)) throw inboxContractError(field);
  return value;
};
const inboxExactKeys = (
  value: UnknownRecord,
  allowed: readonly string[],
  field: string,
) => {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !allowedKeys.has(key));
  if (unexpected) throw inboxContractError(`${field}.${unexpected}`);
};
const inboxString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw inboxContractError(field, value);
  return value;
};
const inboxBoolean = (value: unknown, field: string): boolean => {
  if (typeof value !== 'boolean') throw inboxContractError(field, value);
  return value;
};
const inboxInteger = (value: unknown, field: string, positive = false): number => {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < (positive ? 1 : 0)
  ) {
    throw inboxContractError(field, value);
  }
  return value;
};
const inboxIso = (value: unknown, field: string, nullable = false): string | null => {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !value || !Number.isFinite(Date.parse(value))) {
    throw inboxContractError(field, value);
  }
  return value;
};

const validateInboxItem = (
  value: unknown,
  index: number,
  tenantId: number,
  canViewResume: boolean,
  assignmentFeatureEnabled: boolean,
  canAssign: boolean,
  governanceReasons: UnknownRecord,
): InterviewInboxItem => {
  const field = `response.inbox.items[${index}]`;
  const item = inboxRecord(value, field);
  const itemId = inboxInteger(item.id, `${field}.id`, true);
  if (inboxInteger(item.tenant_id, `${field}.tenant_id`, true) !== tenantId) {
    throw inboxContractError(`${field}.tenant_id`, item.tenant_id);
  }

  const session = inboxRecord(item.session, `${field}.session`);
  if (inboxInteger(session.id, `${field}.session.id`, true) !== itemId) {
    throw inboxContractError(`${field}.session.id`, session.id);
  }
  const status = inboxString(session.status, `${field}.session.status`);
  if (!INBOX_SESSION_STATUSES.has(status as InterviewSessionStatus)) {
    throw inboxContractError(`${field}.session.status`, status);
  }
  const channel = inboxString(session.channel, `${field}.session.channel`);
  if (!INBOX_CHANNELS.has(channel as InterviewChannel)) {
    throw inboxContractError(`${field}.session.channel`, channel);
  }
  inboxString(session.status_label, `${field}.session.status_label`);
  inboxString(session.channel_label, `${field}.session.channel_label`);
  const interviewerUserId = session.interviewer_user_id === null
    ? null
    : inboxInteger(
        session.interviewer_user_id,
        `${field}.session.interviewer_user_id`,
        true,
      );
  inboxIso(session.scheduled_for, `${field}.session.scheduled_for`, true);
  inboxIso(session.started_at, `${field}.session.started_at`, true);
  inboxIso(session.completed_at, `${field}.session.completed_at`, true);
  inboxIso(session.updated_at, `${field}.session.updated_at`);
  inboxBoolean(session.consent_granted, `${field}.session.consent_granted`);

  const assessmentCase = inboxRecord(item.case, `${field}.case`);
  inboxInteger(assessmentCase.id, `${field}.case.id`, true);
  const caseStatus = inboxString(assessmentCase.status, `${field}.case.status`);
  inboxString(assessmentCase.subject_type, `${field}.case.subject_type`);
  if (
    assessmentCase.subject_reference_exposed !== false ||
    Object.prototype.hasOwnProperty.call(assessmentCase, 'subject_ref')
  ) {
    throw inboxContractError(`${field}.case.subject_reference_exposed`);
  }
  const sourceChannel = inboxString(
    assessmentCase.source_channel,
    `${field}.case.source_channel`,
  );
  if (!INBOX_CHANNELS.has(sourceChannel as InterviewChannel)) {
    throw inboxContractError(`${field}.case.source_channel`, sourceChannel);
  }

  const program = inboxRecord(item.program, `${field}.program`);
  inboxInteger(program.id, `${field}.program.id`, true);
  inboxString(program.name, `${field}.program.name`);
  inboxString(program.program_type, `${field}.program.program_type`);
  inboxInteger(program.version_id, `${field}.program.version_id`, true);
  inboxInteger(program.version_number, `${field}.program.version_number`, true);
  if (
    Object.prototype.hasOwnProperty.call(program, 'definition_hash') ||
    program.immutable !== true
  ) {
    throw inboxContractError(`${field}.program.integrity`);
  }

  const progress = inboxRecord(item.progress, `${field}.progress`);
  if (progress.contract_version !== INTERVIEW_PROGRESS_CONTRACT) {
    throw inboxContractError(`${field}.progress.contract_version`, progress.contract_version);
  }
  if (!['step_evidence_v1', 'legacy_advisory'].includes(String(progress.mode))) {
    throw inboxContractError(`${field}.progress.mode`, progress.mode);
  }
  inboxBoolean(
    progress.completion_gate_enforced,
    `${field}.progress.completion_gate_enforced`,
  );
  const totalSteps = inboxInteger(progress.total_steps, `${field}.progress.total_steps`);
  const requiredSteps = inboxInteger(
    progress.required_steps,
    `${field}.progress.required_steps`,
  );
  const completedSteps = inboxInteger(
    progress.completed_steps,
    `${field}.progress.completed_steps`,
  );
  const completedRequired = inboxInteger(
    progress.completed_required_steps,
    `${field}.progress.completed_required_steps`,
  );
  const pendingRequired = inboxInteger(
    progress.pending_required_steps,
    `${field}.progress.pending_required_steps`,
  );
  const progressEvidence = inboxInteger(
    progress.evidence_count,
    `${field}.progress.evidence_count`,
  );
  if (
    requiredSteps > totalSteps ||
    completedSteps > totalSteps ||
    completedRequired > requiredSteps ||
    pendingRequired !== requiredSteps - completedRequired
  ) {
    throw inboxContractError(`${field}.progress.reconciliation`);
  }
  if (progress.percent !== null) {
    const percent = inboxInteger(progress.percent, `${field}.progress.percent`);
    if (percent > 100) throw inboxContractError(`${field}.progress.percent`, percent);
  }
  inboxIso(
    progress.last_checkpoint_at,
    `${field}.progress.last_checkpoint_at`,
    true,
  );
  if (progress.current_step_ref !== null) {
    inboxString(progress.current_step_ref, `${field}.progress.current_step_ref`);
  }
  inboxBoolean(progress.can_complete, `${field}.progress.can_complete`);

  const evidence = inboxRecord(item.evidence, `${field}.evidence`);
  const evidenceTotal = inboxInteger(evidence.total, `${field}.evidence.total`);
  const byType = inboxRecord(evidence.by_type, `${field}.evidence.by_type`);
  const typeTotal = INBOX_EVIDENCE_TYPES.reduce(
    (total, type) => total + inboxInteger(byType[type], `${field}.evidence.by_type.${type}`),
    0,
  );
  const contentHashes = inboxInteger(
    evidence.content_hashes_present,
    `${field}.evidence.content_hashes_present`,
  );
  if (
    evidenceTotal !== progressEvidence ||
    typeTotal !== evidenceTotal ||
    contentHashes !== evidenceTotal ||
    evidence.references_exposed !== false
  ) {
    throw inboxContractError(`${field}.evidence.reconciliation`);
  }
  inboxIso(evidence.last_captured_at, `${field}.evidence.last_captured_at`, true);

  const review = inboxRecord(item.review, `${field}.review`);
  const reviewRequired = inboxBoolean(review.required, `${field}.review.required`);
  if (
    reviewRequired !== (caseStatus === 'awaiting_human_review') ||
    review.state !== (reviewRequired ? 'pending' : 'not_ready') ||
    review.decision_available !== false
  ) {
    throw inboxContractError(`${field}.review`);
  }
  const assignment = inboxRecord(item.assignment, `${field}.assignment`);
  const assignmentInterviewerId = assignment.interviewer_user_id === null
    ? null
    : inboxInteger(
        assignment.interviewer_user_id,
        `${field}.assignment.interviewer_user_id`,
        true,
      );
  if (assignmentInterviewerId !== interviewerUserId) {
    throw inboxContractError(`${field}.assignment.interviewer_user_id`);
  }
  if (assignmentFeatureEnabled) {
    inboxExactKeys(
      assignment,
      [
        'interviewer_user_id',
        'assignment_id',
        'version',
        'managed_assignment_available',
        'assigned_user_label',
      ],
      `${field}.assignment`,
    );
    const assignmentId = assignment.assignment_id === null
      ? null
      : inboxInteger(assignment.assignment_id, `${field}.assignment.assignment_id`, true);
    const assignmentVersion = inboxInteger(
      assignment.version,
      `${field}.assignment.version`,
    );
    if (
      assignment.managed_assignment_available !== true ||
      (assignmentVersion === 0) !== (assignmentId === null)
    ) {
      throw inboxContractError(`${field}.assignment`);
    }
    if (assignment.assigned_user_label !== null) {
      inboxString(
        assignment.assigned_user_label,
        `${field}.assignment.assigned_user_label`,
      );
    }
  } else if (
    assignment.managed_assignment_available !== false ||
    Object.prototype.hasOwnProperty.call(assignment, 'assignment_id') ||
    Object.prototype.hasOwnProperty.call(assignment, 'version') ||
    Object.prototype.hasOwnProperty.call(assignment, 'assigned_user_label')
  ) {
    throw inboxContractError(`${field}.assignment`);
  } else {
    inboxExactKeys(
      assignment,
      ['interviewer_user_id', 'managed_assignment_available'],
      `${field}.assignment`,
    );
  }

  const audit = inboxRecord(item.audit, `${field}.audit`);
  if (audit.source !== 'audit_event' || audit.sensitive_details_exposed !== false) {
    throw inboxContractError(`${field}.audit`);
  }
  const auditCount = inboxInteger(audit.events_recorded, `${field}.audit.events_recorded`);
  if (audit.last_event === null) {
    if (auditCount !== 0) throw inboxContractError(`${field}.audit.last_event`);
  } else {
    if (auditCount === 0) throw inboxContractError(`${field}.audit.last_event`);
    const lastEvent = inboxRecord(audit.last_event, `${field}.audit.last_event`);
    inboxString(lastEvent.event_type, `${field}.audit.last_event.event_type`);
    if (lastEvent.actor_user_id !== null) {
      inboxInteger(lastEvent.actor_user_id, `${field}.audit.last_event.actor_user_id`, true);
    }
    inboxIso(lastEvent.created_at, `${field}.audit.last_event.created_at`);
  }

  const nextAction = inboxString(item.next_action, `${field}.next_action`);
  if (!INBOX_NEXT_ACTIONS.has(nextAction)) {
    throw inboxContractError(`${field}.next_action`, nextAction);
  }
  inboxString(item.next_action_label, `${field}.next_action_label`);
  const actions = inboxRecord(item.actions, `${field}.actions`);
  inboxExactKeys(
    actions,
    ['view_resume', 'assign', 'review', 'follow_up'],
    `${field}.actions`,
  );
  const viewResume = inboxRecord(actions.view_resume, `${field}.actions.view_resume`);
  inboxExactKeys(
    viewResume,
    ['action_id', 'label', 'enabled', 'method', 'endpoint', 'disabled_reason_code'],
    `${field}.actions.view_resume`,
  );
  if (
    viewResume.action_id !== 'view_resume' ||
    viewResume.enabled !== canViewResume ||
    viewResume.method !== 'GET' ||
    viewResume.endpoint !== `/api/v2/interviews/sessions/${itemId}` ||
    viewResume.disabled_reason_code !==
      (canViewResume ? null : 'interview_conduct_capability_required')
  ) {
    throw inboxContractError(`${field}.actions.view_resume`);
  }
  inboxString(viewResume.label, `${field}.actions.view_resume.label`);
  const assign = inboxRecord(actions.assign, `${field}.actions.assign`);
  if (assignmentFeatureEnabled) {
    const sessionClosedForAssignment =
      canAssign && (status === 'completed' || status === 'void');
    const assignEnabled = canAssign && !sessionClosedForAssignment;
    const assignDisabledReason = !canAssign
      ? 'interview_assignment_capability_required'
      : sessionClosedForAssignment
        ? 'interview_assignment_session_closed'
        : null;
    if (
      assign.action_id !== 'assign' ||
      assign.enabled !== assignEnabled ||
      assign.method !== (assignEnabled ? 'POST' : null) ||
      assign.endpoint !==
        (assignEnabled ? `/api/v2/interviews/sessions/${itemId}/assignment` : null) ||
      assign.disabled_reason_code !== assignDisabledReason
    ) {
      throw inboxContractError(`${field}.actions.assign`);
    }
    if (assignEnabled) {
      inboxExactKeys(
        assign,
        [
          'action_id',
          'label',
          'enabled',
          'method',
          'endpoint',
          'disabled_reason_code',
          'candidates',
        ],
        `${field}.actions.assign`,
      );
      const candidates = inboxRecord(
        assign.candidates,
        `${field}.actions.assign.candidates`,
      );
      inboxExactKeys(
        candidates,
        ['method', 'endpoint'],
        `${field}.actions.assign.candidates`,
      );
      if (
        candidates.method !== 'GET' ||
        candidates.endpoint !== '/api/v2/interviews/assignment-candidates'
      ) {
        throw inboxContractError(`${field}.actions.assign.candidates`);
      }
    } else {
      inboxExactKeys(
        assign,
        ['action_id', 'label', 'enabled', 'method', 'endpoint', 'disabled_reason_code'],
        `${field}.actions.assign`,
      );
    }
  } else {
    if (
      assign.action_id !== 'assign' ||
      assign.enabled !== false ||
      assign.method !== null ||
      assign.endpoint !== null ||
      assign.disabled_reason_code !== governanceReasons.assign
    ) {
      throw inboxContractError(`${field}.actions.assign`);
    }
    inboxExactKeys(
      assign,
      ['action_id', 'label', 'enabled', 'method', 'endpoint', 'disabled_reason_code'],
      `${field}.actions.assign`,
    );
  }
  inboxString(assign.label, `${field}.actions.assign.label`);
  const disabledActions = [
    ['review', governanceReasons.review],
    ['follow_up', governanceReasons.follow_up],
  ] as const;
  disabledActions.forEach(([actionId, reason]) => {
    const action = inboxRecord(actions[actionId], `${field}.actions.${actionId}`);
    inboxExactKeys(
      action,
      ['action_id', 'label', 'enabled', 'method', 'endpoint', 'disabled_reason_code'],
      `${field}.actions.${actionId}`,
    );
    if (
      action.action_id !== actionId ||
      action.enabled !== false ||
      action.method !== null ||
      action.endpoint !== null ||
      action.disabled_reason_code !== reason
    ) {
      throw inboxContractError(`${field}.actions.${actionId}`);
    }
    inboxString(action.label, `${field}.actions.${actionId}.label`);
  });

  return item as unknown as InterviewInboxItem;
};

export const parseInterviewInboxEnvelope = (
  value: unknown,
  expectedTenantSlug?: string,
): InterviewInboxEnvelope => {
  const envelope = inboxRecord(value, 'response');
  if (envelope.ok !== true || envelope.contract_version !== INTERVIEW_API_CONTRACT) {
    throw inboxContractError('response.contract_version', envelope.contract_version);
  }
  const inbox = inboxRecord(envelope.inbox, 'response.inbox');
  const assignmentFeatureEnabled =
    inbox.contract_version === INTERVIEW_INBOX_CONTRACT_V2;
  if (
    inbox.contract_version !== INTERVIEW_INBOX_CONTRACT_V1 &&
    !assignmentFeatureEnabled
  ) {
    throw inboxContractError('response.inbox.contract_version', inbox.contract_version);
  }
  const tenant = inboxRecord(inbox.tenant, 'response.inbox.tenant');
  const tenantId = inboxInteger(tenant.id, 'response.inbox.tenant.id', true);
  const tenantSlug = inboxString(tenant.slug, 'response.inbox.tenant.slug').trim();
  inboxString(tenant.name, 'response.inbox.tenant.name');
  if (expectedTenantSlug && tenantSlug.toLowerCase() !== expectedTenantSlug.trim().toLowerCase()) {
    throw inboxContractError('response.inbox.tenant.slug', tenantSlug);
  }
  const presentation = inboxRecord(inbox.presentation, 'response.inbox.presentation');
  inboxExactKeys(
    presentation,
    assignmentFeatureEnabled
      ? ['title', 'description', 'empty_title', 'empty_description', 'assignment_dialog']
      : ['title', 'description', 'empty_title', 'empty_description'],
    'response.inbox.presentation',
  );
  ['title', 'description', 'empty_title', 'empty_description'].forEach((field) =>
    inboxString(presentation[field], `response.inbox.presentation.${field}`),
  );
  if (assignmentFeatureEnabled) {
    const dialog = inboxRecord(
      presentation.assignment_dialog,
      'response.inbox.presentation.assignment_dialog',
    );
    inboxExactKeys(
      dialog,
      [
        'title',
        'description',
        'assignee_label',
        'assignee_placeholder',
        'reason_label',
        'submit_label',
        'retry_label',
        'cancel_label',
        'loading_candidates_label',
        'candidates_error_label',
        'submit_error_label',
        'reasons',
      ],
      'response.inbox.presentation.assignment_dialog',
    );
    [
      'title',
      'description',
      'assignee_label',
      'assignee_placeholder',
      'reason_label',
      'submit_label',
      'retry_label',
      'cancel_label',
      'loading_candidates_label',
      'candidates_error_label',
      'submit_error_label',
    ].forEach((field) =>
      inboxString(
        dialog[field],
        `response.inbox.presentation.assignment_dialog.${field}`,
      ),
    );
    if (!Array.isArray(dialog.reasons)) {
      throw inboxContractError('response.inbox.presentation.assignment_dialog.reasons');
    }
    const reasonCodes = dialog.reasons.map((value, index) => {
      const reason = inboxRecord(
        value,
        `response.inbox.presentation.assignment_dialog.reasons[${index}]`,
      );
      inboxExactKeys(
        reason,
        ['reason_code', 'label'],
        `response.inbox.presentation.assignment_dialog.reasons[${index}]`,
      );
      const reasonCode = inboxString(
        reason.reason_code,
        `response.inbox.presentation.assignment_dialog.reasons[${index}].reason_code`,
      );
      if (!INTERVIEW_ASSIGNMENT_REASON_CODES.has(reasonCode as InterviewAssignmentReasonCode)) {
        throw inboxContractError(
          `response.inbox.presentation.assignment_dialog.reasons[${index}].reason_code`,
          reasonCode,
        );
      }
      inboxString(
        reason.label,
        `response.inbox.presentation.assignment_dialog.reasons[${index}].label`,
      );
      return reasonCode;
    });
    if (
      reasonCodes.length !== INTERVIEW_ASSIGNMENT_REASON_CODES.size ||
      new Set(reasonCodes).size !== INTERVIEW_ASSIGNMENT_REASON_CODES.size
    ) {
      throw inboxContractError('response.inbox.presentation.assignment_dialog.reasons');
    }
  } else if (Object.prototype.hasOwnProperty.call(presentation, 'assignment_dialog')) {
    throw inboxContractError('response.inbox.presentation.assignment_dialog');
  }
  const freshness = inboxRecord(inbox.freshness, 'response.inbox.freshness');
  inboxIso(freshness.generated_at, 'response.inbox.freshness.generated_at');
  if (
    freshness.source !==
      (assignmentFeatureEnabled
        ? 'assessment_case_interview_session_evidence_assignment_audit_event'
        : 'assessment_case_interview_session_evidence_audit_event') ||
    freshness.synthetic !== false
  ) {
    throw inboxContractError('response.inbox.freshness');
  }

  const capabilities = inboxRecord(inbox.capabilities, 'response.inbox.capabilities');
  const canAssign = capabilities.can_assign;
  if (
    capabilities.can_view_inbox !== true ||
    typeof capabilities.can_view_resume !== 'boolean' ||
    typeof canAssign !== 'boolean' ||
    (!assignmentFeatureEnabled && canAssign !== false) ||
    capabilities.read_only !== !canAssign ||
    capabilities.can_review !== false ||
    capabilities.can_mark_follow_up !== false
  ) {
    throw inboxContractError('response.inbox.capabilities');
  }
  const governance = inboxRecord(inbox.governance, 'response.inbox.governance');
  if (
    governance.assignment_workflow_persisted !== assignmentFeatureEnabled ||
    governance.human_review_workflow_persisted !== false ||
    governance.follow_up_workflow_persisted !== false ||
    governance.automated_decisions_allowed !== false
  ) {
    throw inboxContractError('response.inbox.governance');
  }
  const governanceReasons = inboxRecord(
    governance.disabled_reason_codes,
    'response.inbox.governance.disabled_reason_codes',
  );
  if (
    governanceReasons.assign !==
      (assignmentFeatureEnabled
        ? canAssign
          ? null
          : 'interview_assignment_capability_required'
        : 'interview_assignment_domain_not_implemented') ||
    governanceReasons.review !== 'interview_human_review_domain_not_implemented' ||
    governanceReasons.follow_up !== 'interview_follow_up_domain_not_implemented'
  ) {
    throw inboxContractError('response.inbox.governance.disabled_reason_codes');
  }

  if (!Array.isArray(inbox.items)) throw inboxContractError('response.inbox.items');
  const items = inbox.items.map((item, index) =>
    validateInboxItem(
      item,
      index,
      tenantId,
      capabilities.can_view_resume as boolean,
      assignmentFeatureEnabled,
      canAssign as boolean,
      governanceReasons,
    ),
  );
  const page = inboxRecord(inbox.page, 'response.inbox.page');
  const pageLimit = inboxInteger(page.limit, 'response.inbox.page.limit', true);
  const returned = inboxInteger(page.returned, 'response.inbox.page.returned');
  const hasMore = page.has_more;
  if (
    pageLimit > 100 ||
    returned !== items.length ||
    typeof hasMore !== 'boolean' ||
    page.continuation_available !== false ||
    page.continuation_disabled_reason_code !==
      (hasMore ? 'interview_inbox_cursor_not_implemented' : null)
  ) {
    throw inboxContractError('response.inbox.page');
  }
  const filters = inboxRecord(inbox.filters, 'response.inbox.filters');
  if (
    filters.status !== null &&
    !INBOX_SESSION_STATUSES.has(filters.status as InterviewSessionStatus)
  ) {
    throw inboxContractError('response.inbox.filters.status', filters.status);
  }

  const summary = inboxRecord(inbox.summary, 'response.inbox.summary');
  if (summary.scope !== 'current_page') throw inboxContractError('response.inbox.summary.scope');
  const summaryValues = {
    sessions: inboxInteger(summary.sessions, 'response.inbox.summary.sessions'),
    scheduled: inboxInteger(summary.scheduled, 'response.inbox.summary.scheduled'),
    active: inboxInteger(summary.active, 'response.inbox.summary.active'),
    awaiting: inboxInteger(
      summary.awaiting_human_review,
      'response.inbox.summary.awaiting_human_review',
    ),
    withEvidence: inboxInteger(
      summary.with_evidence,
      'response.inbox.summary.with_evidence',
    ),
    evidence: inboxInteger(
      summary.evidence_records,
      'response.inbox.summary.evidence_records',
    ),
    audit: inboxInteger(summary.audit_events, 'response.inbox.summary.audit_events'),
  };
  if (
    summaryValues.sessions !== items.length ||
    summaryValues.scheduled !== items.filter((item) => item.session.status === 'scheduled').length ||
    summaryValues.active !== items.filter((item) => item.session.status === 'active').length ||
    summaryValues.awaiting !== items.filter((item) => item.review.required).length ||
    summaryValues.withEvidence !== items.filter((item) => item.evidence.total > 0).length ||
    summaryValues.evidence !== items.reduce((total, item) => total + item.evidence.total, 0) ||
    summaryValues.audit !== items.reduce((total, item) => total + item.audit.events_recorded, 0)
  ) {
    throw inboxContractError('response.inbox.summary.reconciliation');
  }

  return envelope as unknown as InterviewInboxEnvelope;
};

export interface InterviewInboxQuery {
  status?: InterviewSessionStatus;
  limit?: number;
}

export const getInterviewInboxV2 = async (
  tenantSlug: string,
  query: InterviewInboxQuery = {},
): Promise<InterviewInboxEnvelope> => {
  const normalizedTenantSlug = tenantSlug.trim();
  if (!normalizedTenantSlug) {
    throw new ApiError('La bandeja requiere un tenant explícito.', 400, {
      reason_code: 'missing_tenant',
    });
  }
  if (query.status && !INBOX_SESSION_STATUSES.has(query.status)) {
    throw new ApiError('El estado de entrevista no es válido.', 400, {
      reason_code: 'interview_inbox_status_invalid',
    });
  }
  const limit = query.limit ?? 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError('El límite de la bandeja no es válido.', 400, {
      reason_code: 'interview_inbox_limit_invalid',
    });
  }
  const params = new URLSearchParams({ limit: String(limit) });
  if (query.status) params.set('status', query.status);
  const response = await panelApi.get<unknown>(
    `/api/v2/interviews/inbox?${params.toString()}`,
    {
      tenantSlug: normalizedTenantSlug,
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    },
  );
  return parseInterviewInboxEnvelope(response, normalizedTenantSlug);
};
