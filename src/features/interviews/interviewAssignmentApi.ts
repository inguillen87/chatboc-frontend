import { panelApi } from '@/api/v2/client';
import { ApiError } from '@/utils/api';
import {
  INTERVIEW_API_CONTRACT,
  INTERVIEW_ASSIGNMENT_CANDIDATES_CONTRACT,
  INTERVIEW_ASSIGNMENT_ENVELOPE_CONTRACT,
  INTERVIEW_ASSIGNMENT_RECEIPT_CONTRACT,
  type InterviewAssignmentCandidatesEnvelope,
  type InterviewAssignmentEnvelope,
  type InterviewAssignmentRequest,
  type InterviewAssignmentReasonCode,
} from './interviewsTypes';

type UnknownRecord = Record<string, unknown>;

export interface InterviewAssignmentCandidatesSource {
  method: 'GET';
  endpoint: string;
}

export interface InterviewAssignmentMutationSource {
  method: 'POST';
  endpoint: string;
}

export interface InterviewAssignmentExpectation {
  tenantId: number;
  tenantSlug: string;
  sessionId: number;
  currentAssignmentId: number | null;
  currentAssigneeUserId: number | null;
}

const ASSIGNMENT_REASONS = new Set<InterviewAssignmentReasonCode>([
  'initial_assignment',
  'workload_balance',
  'availability',
  'specialty_match',
  'continuity',
  'supervisor_override',
]);
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const assignmentContractError = (field: string, received?: unknown) =>
  new ApiError('El backend devolvió un contrato de asignación incompatible.', 502, {
    reason_code: 'interview_assignment_contract_invalid',
    field,
    ...(typeof received === 'string' || typeof received === 'number'
      ? { received }
      : {}),
  });

const record = (value: unknown, field: string): UnknownRecord => {
  if (!isRecord(value)) throw assignmentContractError(field);
  return value;
};

const exactKeys = (
  value: UnknownRecord,
  allowed: readonly string[],
  field: string,
) => {
  const allowedKeys = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !allowedKeys.has(key));
  if (unexpected) {
    throw assignmentContractError(`${field}.${unexpected}`);
  }
};

const nonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw assignmentContractError(field, value);
  }
  return value;
};

const integer = (value: unknown, field: string, minimum = 0): number => {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw assignmentContractError(field, value);
  }
  return value as number;
};

const isoTimestamp = (value: unknown, field: string): string => {
  if (
    typeof value !== 'string' ||
    !value ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw assignmentContractError(field, value);
  }
  return value;
};

const normalizeTenant = (tenantSlug: string): string => {
  const normalized = tenantSlug.trim();
  if (!normalized) {
    throw new ApiError('La asignación requiere un tenant explícito.', 400, {
      reason_code: 'missing_tenant',
    });
  }
  return normalized;
};

const validateCandidatesSource = (source: InterviewAssignmentCandidatesSource) => {
  if (
    source.method !== 'GET' ||
    source.endpoint !== '/api/v2/interviews/assignment-candidates'
  ) {
    throw assignmentContractError('assignment_candidates_source');
  }
};

const validateMutationSource = (
  source: InterviewAssignmentMutationSource,
  sessionId: number,
) => {
  if (
    source.method !== 'POST' ||
    source.endpoint !== `/api/v2/interviews/sessions/${sessionId}/assignment`
  ) {
    throw assignmentContractError('assignment_mutation_source');
  }
};

export const parseInterviewAssignmentCandidatesEnvelope = (
  value: unknown,
  expectedTenantId: number,
  expectedTenantSlug: string,
): InterviewAssignmentCandidatesEnvelope => {
  const envelope = record(value, 'response');
  exactKeys(
    envelope,
    ['ok', 'contract_version', 'assignment_candidates', 'request_id'],
    'response',
  );
  nonEmptyString(envelope.request_id, 'response.request_id');
  if (envelope.ok !== true || envelope.contract_version !== INTERVIEW_API_CONTRACT) {
    throw assignmentContractError('response.contract_version', envelope.contract_version);
  }
  const payload = record(
    envelope.assignment_candidates,
    'response.assignment_candidates',
  );
  exactKeys(
    payload,
    ['contract_version', 'tenant', 'candidates', 'presentation'],
    'response.assignment_candidates',
  );
  if (payload.contract_version !== INTERVIEW_ASSIGNMENT_CANDIDATES_CONTRACT) {
    throw assignmentContractError(
      'response.assignment_candidates.contract_version',
      payload.contract_version,
    );
  }
  const tenant = record(payload.tenant, 'response.assignment_candidates.tenant');
  exactKeys(tenant, ['id', 'slug'], 'response.assignment_candidates.tenant');
  const tenantId = integer(tenant.id, 'response.assignment_candidates.tenant.id', 1);
  const tenantSlug = nonEmptyString(
    tenant.slug,
    'response.assignment_candidates.tenant.slug',
  );
  if (
    tenantId !== expectedTenantId ||
    tenantSlug.trim().toLowerCase() !== expectedTenantSlug.trim().toLowerCase()
  ) {
    throw assignmentContractError('response.assignment_candidates.tenant');
  }
  if (!Array.isArray(payload.candidates)) {
    throw assignmentContractError('response.assignment_candidates.candidates');
  }
  const ids = payload.candidates.map((candidateValue, index) => {
    const candidate = record(
      candidateValue,
      `response.assignment_candidates.candidates[${index}]`,
    );
    exactKeys(
      candidate,
      ['user_id', 'display_name', 'role_label', 'can_conduct'],
      `response.assignment_candidates.candidates[${index}]`,
    );
    const userId = integer(
      candidate.user_id,
      `response.assignment_candidates.candidates[${index}].user_id`,
      1,
    );
    nonEmptyString(
      candidate.display_name,
      `response.assignment_candidates.candidates[${index}].display_name`,
    );
    nonEmptyString(
      candidate.role_label,
      `response.assignment_candidates.candidates[${index}].role_label`,
    );
    if (candidate.can_conduct !== true) {
      throw assignmentContractError(
        `response.assignment_candidates.candidates[${index}].can_conduct`,
      );
    }
    return userId;
  });
  if (new Set(ids).size !== ids.length) {
    throw assignmentContractError('response.assignment_candidates.candidates.user_id');
  }
  const presentation = record(
    payload.presentation,
    'response.assignment_candidates.presentation',
  );
  exactKeys(
    presentation,
    ['empty_title', 'empty_description'],
    'response.assignment_candidates.presentation',
  );
  nonEmptyString(
    presentation.empty_title,
    'response.assignment_candidates.presentation.empty_title',
  );
  nonEmptyString(
    presentation.empty_description,
    'response.assignment_candidates.presentation.empty_description',
  );
  return envelope as unknown as InterviewAssignmentCandidatesEnvelope;
};

export const parseInterviewAssignmentEnvelope = (
  value: unknown,
  expectation: InterviewAssignmentExpectation,
  request: InterviewAssignmentRequest,
): InterviewAssignmentEnvelope => {
  const envelope = record(value, 'response');
  exactKeys(
    envelope,
    ['ok', 'contract_version', 'assignment', 'idempotency_replayed', 'request_id'],
    'response',
  );
  nonEmptyString(envelope.request_id, 'response.request_id');
  if (
    envelope.ok !== true ||
    envelope.contract_version !== INTERVIEW_ASSIGNMENT_ENVELOPE_CONTRACT ||
    typeof envelope.idempotency_replayed !== 'boolean'
  ) {
    throw assignmentContractError('response.contract_version', envelope.contract_version);
  }
  const assignment = record(envelope.assignment, 'response.assignment');
  exactKeys(
    assignment,
    [
      'contract_version',
      'id',
      'tenant_id',
      'interview_session_id',
      'version',
      'assignee_user_id',
      'previous_assignee_user_id',
      'assigned_by_user_id',
      'reason_code',
      'supersedes_assignment_id',
      'created_at',
      'history_immutable',
    ],
    'response.assignment',
  );
  if (assignment.contract_version !== INTERVIEW_ASSIGNMENT_RECEIPT_CONTRACT) {
    throw assignmentContractError(
      'response.assignment.contract_version',
      assignment.contract_version,
    );
  }
  integer(assignment.id, 'response.assignment.id', 1);
  const tenantId = integer(assignment.tenant_id, 'response.assignment.tenant_id', 1);
  const sessionId = integer(
    assignment.interview_session_id,
    'response.assignment.interview_session_id',
    1,
  );
  const version = integer(assignment.version, 'response.assignment.version', 1);
  const assigneeUserId = integer(
    assignment.assignee_user_id,
    'response.assignment.assignee_user_id',
    1,
  );
  const previousAssigneeUserId = assignment.previous_assignee_user_id === null
    ? null
    : integer(
        assignment.previous_assignee_user_id,
        'response.assignment.previous_assignee_user_id',
        1,
      );
  integer(
    assignment.assigned_by_user_id,
    'response.assignment.assigned_by_user_id',
    1,
  );
  const reasonCode = nonEmptyString(
    assignment.reason_code,
    'response.assignment.reason_code',
  );
  if (!ASSIGNMENT_REASONS.has(reasonCode as InterviewAssignmentReasonCode)) {
    throw assignmentContractError('response.assignment.reason_code', reasonCode);
  }
  const supersedesAssignmentId = assignment.supersedes_assignment_id === null
    ? null
    : integer(
        assignment.supersedes_assignment_id,
        'response.assignment.supersedes_assignment_id',
        1,
      );
  isoTimestamp(assignment.created_at, 'response.assignment.created_at');
  if (assignment.history_immutable !== true) {
    throw assignmentContractError('response.assignment.history_immutable');
  }
  if (
    tenantId !== expectation.tenantId ||
    sessionId !== expectation.sessionId ||
    version !== request.expected_assignment_version + 1 ||
    assigneeUserId !== request.assignee_user_id ||
    previousAssigneeUserId !== expectation.currentAssigneeUserId ||
    reasonCode !== request.reason_code ||
    supersedesAssignmentId !== expectation.currentAssignmentId
  ) {
    throw assignmentContractError('response.assignment.reconciliation');
  }
  return envelope as unknown as InterviewAssignmentEnvelope;
};

export const createInterviewAssignmentIdempotencyKey = (): string => {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new ApiError('No hay una fuente criptográfica disponible.', 503, {
      reason_code: 'secure_random_unavailable',
    });
  }
  return `interview-assignment:${globalThis.crypto.randomUUID()}`;
};

export const getInterviewAssignmentCandidatesV2 = async (
  tenantSlug: string,
  tenantId: number,
  source: InterviewAssignmentCandidatesSource,
): Promise<InterviewAssignmentCandidatesEnvelope> => {
  const normalizedTenant = normalizeTenant(tenantSlug);
  integer(tenantId, 'tenant_id', 1);
  validateCandidatesSource(source);
  const response = await panelApi.get<unknown>(source.endpoint, {
    tenantSlug: normalizedTenant,
    cache: 'no-store',
    headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
  });
  return parseInterviewAssignmentCandidatesEnvelope(
    response,
    tenantId,
    normalizedTenant,
  );
};

export const assignInterviewSessionV2 = async (
  expectation: InterviewAssignmentExpectation,
  source: InterviewAssignmentMutationSource,
  request: InterviewAssignmentRequest,
  idempotencyKey: string,
): Promise<InterviewAssignmentEnvelope> => {
  const normalizedTenant = normalizeTenant(expectation.tenantSlug);
  integer(expectation.tenantId, 'tenant_id', 1);
  integer(expectation.sessionId, 'session_id', 1);
  validateMutationSource(source, expectation.sessionId);
  integer(request.assignee_user_id, 'assignee_user_id', 1);
  integer(request.expected_assignment_version, 'expected_assignment_version');
  if (expectation.currentAssigneeUserId !== null) {
    integer(expectation.currentAssigneeUserId, 'current_assignee_user_id', 1);
  }
  if (expectation.currentAssignmentId !== null) {
    integer(expectation.currentAssignmentId, 'current_assignment_id', 1);
  }
  if (
    (request.expected_assignment_version === 0) !==
      (expectation.currentAssignmentId === null) ||
    (request.expected_assignment_version > 0 &&
      request.assignee_user_id === expectation.currentAssigneeUserId)
  ) {
    throw assignmentContractError('assignment_request_reconciliation');
  }
  if (!ASSIGNMENT_REASONS.has(request.reason_code)) {
    throw assignmentContractError('reason_code', request.reason_code);
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
    throw new ApiError('La asignación requiere una clave de idempotencia.', 400, {
      reason_code: 'interview_idempotency_key_required',
    });
  }
  const response = await panelApi.post<unknown>(source.endpoint, request, {
    tenantSlug: normalizedTenant,
    cache: 'no-store',
    headers: {
      'Idempotency-Key': idempotencyKey,
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  });
  return parseInterviewAssignmentEnvelope(response, expectation, request);
};
