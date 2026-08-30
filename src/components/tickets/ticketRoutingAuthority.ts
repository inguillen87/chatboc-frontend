import type {
  EmployeeRoutingEmployee,
  EmployeeRoutingRecommendation,
  EmployeeRoutingV2,
} from '@/api/v2/saas';
import type { Ticket } from '@/types/tickets';

type UnknownRecord = Record<string, unknown>;

export type TicketRoutingAuthorityFailure =
  | 'missing_ticket_identity'
  | 'invalid_contract'
  | 'ticket_not_published';

export interface TicketRoutingAuthority {
  identity: string;
  sourceModel: string;
  ticketId: string;
  ticket: UnknownRecord;
  recommendation: EmployeeRoutingRecommendation | null;
  eligibleEmployees: EmployeeRoutingEmployee[];
  suggestedEmployee: EmployeeRoutingEmployee | null;
  currentAssigneeId: string | null;
  category: string | null;
  zone: string | null;
  channel: string | null;
}

export type TicketRoutingAuthorityResolution =
  | { ok: true; authority: TicketRoutingAuthority }
  | { ok: false; reason: TicketRoutingAuthorityFailure };

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};

const first = (record: UnknownRecord, keys: string[]): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const asIdentifier = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value.trim();
  return '';
};

export const normalizeRoutingDimension = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();

const normalizeSourceModel = (value: unknown): string =>
  String(value ?? '').trim().toLowerCase();

const consistentRecordValue = (
  record: UnknownRecord,
  keys: string[],
  normalize: (value: unknown) => string,
): string | null => {
  const values = keys
    .filter((key) => Object.prototype.hasOwnProperty.call(record, key))
    .map((key) => normalize(record[key]))
    .filter(Boolean);
  if (!values.length || new Set(values).size !== 1) return null;
  return values[0];
};

export const buildRoutingTicketIdentity = (
  sourceModel: unknown,
  ticketId: unknown,
): string | null => {
  const normalizedSource = normalizeSourceModel(sourceModel);
  const normalizedId = asIdentifier(ticketId);
  if (!normalizedSource || !normalizedId) return null;
  return `${normalizedSource}:${normalizedId}`;
};

export const getTicketRoutingIdentity = (ticket: Ticket | null): string | null =>
  ticket ? buildRoutingTicketIdentity(ticket.source_model, ticket.id) : null;

const getRecordRoutingIdentity = (record: UnknownRecord): string | null => {
  const sourceModel = consistentRecordValue(
    record,
    ['source_model', 'sourceModel', 'model'],
    normalizeSourceModel,
  );
  const ticketId = consistentRecordValue(
    record,
    ['id', 'ticket_id', 'ticketId'],
    asIdentifier,
  );
  return buildRoutingTicketIdentity(sourceModel, ticketId);
};

interface RecommendationCandidateContract {
  published: boolean;
  records: UnknownRecord[];
}

const recommendationCandidateContract = (
  recommendation: EmployeeRoutingRecommendation | null,
): RecommendationCandidateContract => {
  if (!recommendation) return { published: false, records: [] };
  const raw = asRecord(recommendation.raw);
  const candidateKeys = [
    'eligible_assignees',
    'eligible_employees',
    'candidates',
    'candidate_assignees',
  ];
  const publishedKey = candidateKeys.find((key) => Object.prototype.hasOwnProperty.call(raw, key));
  if (!publishedKey) return { published: false, records: [] };
  const values = raw[publishedKey];
  return {
    published: true,
    records: Array.isArray(values)
      ? values.map(asRecord).filter((value) => Object.keys(value).length > 0)
      : [],
  };
};

const employeeMatchesTicketCategory = (
  employee: EmployeeRoutingEmployee,
  ticket: UnknownRecord,
): boolean => {
  const category = normalizeRoutingDimension(
    first(ticket, ['category', 'categoria', 'category_name', 'categoria_principal']),
  );
  if (!category || category === 'sin categoria') return false;
  return employee.scope.categorias.some(
    (employeeCategory) => normalizeRoutingDimension(employeeCategory) === category,
  );
};

const resolveEligibleEmployees = (
  routing: EmployeeRoutingV2,
  ticket: UnknownRecord,
  candidateContract: RecommendationCandidateContract,
): EmployeeRoutingEmployee[] => {
  if (candidateContract.published) {
    const candidateIds = new Set(
      candidateContract.records
        .map((candidate) => asIdentifier(first(candidate, ['id', 'employee_id', 'user_id'])))
        .filter(Boolean),
    );
    return routing.employees.filter((employee) => candidateIds.has(String(employee.id)));
  }

  return routing.employees.filter((employee) => employeeMatchesTicketCategory(employee, ticket));
};

const resolveSuggestedEmployee = (
  routing: EmployeeRoutingV2,
  recommendation: EmployeeRoutingRecommendation | null,
  candidateContract: RecommendationCandidateContract,
): EmployeeRoutingEmployee | null => {
  if (!recommendation) return null;
  const suggestedId = asIdentifier(
    first(asRecord(recommendation.suggested_assignee), ['id', 'employee_id', 'user_id']),
  );
  if (!suggestedId) return null;
  if (
    candidateContract.published &&
    !candidateContract.records.some(
      (candidate) => asIdentifier(first(candidate, ['id', 'employee_id', 'user_id'])) === suggestedId,
    )
  ) {
    return null;
  }
  return routing.employees.find((employee) => String(employee.id) === suggestedId) ?? null;
};

export const resolveTicketRoutingAuthority = (
  routing: EmployeeRoutingV2 | null,
  ticket: Ticket | null,
): TicketRoutingAuthorityResolution => {
  const identity = getTicketRoutingIdentity(ticket);
  if (!identity || !ticket) return { ok: false, reason: 'missing_ticket_identity' };
  if (!routing || routing.contract_version !== 'employee.routing.v1') {
    return { ok: false, reason: 'invalid_contract' };
  }

  const recommendation = routing.recommendations.find(
    (item) => getRecordRoutingIdentity(asRecord(item.ticket)) === identity,
  ) ?? null;
  const publishedTickets = [
    ...routing.queues.open,
    ...routing.queues.unassigned,
    ...(recommendation ? [recommendation.ticket] : []),
  ].map(asRecord);
  const authoritativeTicket = publishedTickets.find(
    (item) => getRecordRoutingIdentity(item) === identity,
  );
  if (!authoritativeTicket) return { ok: false, reason: 'ticket_not_published' };

  const sourceModel = asIdentifier(first(authoritativeTicket, ['source_model', 'sourceModel', 'model']));
  const ticketId = asIdentifier(first(authoritativeTicket, ['id', 'ticket_id', 'ticketId']));
  const candidateContract = recommendationCandidateContract(recommendation);
  const eligibleEmployees = resolveEligibleEmployees(routing, authoritativeTicket, candidateContract);
  const suggestedEmployee = resolveSuggestedEmployee(routing, recommendation, candidateContract);
  if (
    suggestedEmployee &&
    !eligibleEmployees.some((employee) => String(employee.id) === String(suggestedEmployee.id))
  ) {
    eligibleEmployees.unshift(suggestedEmployee);
  }

  const currentAssignee = asIdentifier(
    first(authoritativeTicket, ['assignee_id', 'assigned_user_id', 'assigned_agent_id']),
  );
  const dimension = (keys: string[]) => {
    const value = asIdentifier(first(authoritativeTicket, keys));
    return value && normalizeRoutingDimension(value) !== 'sin zona' ? value : null;
  };

  return {
    ok: true,
    authority: {
      identity,
      sourceModel,
      ticketId,
      ticket: authoritativeTicket,
      recommendation,
      eligibleEmployees,
      suggestedEmployee,
      currentAssigneeId: currentAssignee || null,
      category: dimension(['category', 'categoria', 'category_name', 'categoria_principal']),
      zone: dimension(['zone', 'zona', 'district', 'distrito']),
      channel: dimension(['channel', 'canal', 'canal_ingreso']),
    },
  };
};

export const employeeIsEligibleForRoutingTicket = (
  authority: TicketRoutingAuthority | null,
  employeeId: unknown,
): boolean => {
  const normalizedEmployeeId = asIdentifier(employeeId);
  return Boolean(
    authority &&
      normalizedEmployeeId &&
      authority.eligibleEmployees.some(
        (employee) => String(employee.id) === normalizedEmployeeId,
      ),
  );
};

export const canSuperviseTicketAssignments = (
  role: unknown,
  hasAssignCapability: boolean,
): boolean => {
  if (hasAssignCapability) return true;
  const normalizedRole = normalizeRoutingDimension(role).replace(/\s+/g, '_');
  return ['admin', 'super_admin', 'supervisor'].includes(normalizedRole);
};

const REASON_LABELS: Record<string, string> = {
  category_match: 'Categoría compatible',
  zone_match: 'Cobertura de zona',
  channel_match: 'Canal habilitado',
  assignment_permission: 'Permiso operativo',
  generalist: 'Cobertura general',
  no_employee_available: 'Sin personal compatible',
};

export const describeRoutingReason = (reason: string): string => {
  const normalized = reason.trim().toLowerCase();
  if (REASON_LABELS[normalized]) return REASON_LABELS[normalized];
  const workloadMatch = normalized.match(/^workload_penalty_(\d+(?:\.\d+)?)$/);
  if (workloadMatch) return `Ajuste por carga · ${workloadMatch[1]}`;
  return reason.replace(/[_-]+/g, ' ').replace(/^./, (value) => value.toUpperCase());
};
