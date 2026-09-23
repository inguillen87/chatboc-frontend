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
  | 'ticket_not_published'
  | 'conflicting_authority';

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
    .map((key) => normalize(record[key]) || '__empty__');
  if (!values.length || new Set(values).size !== 1 || values[0] === '__empty__') return null;
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
  signature: string | null;
  conflict: boolean;
}

interface PublishedAliasValue {
  published: boolean;
  value: string | null;
  signature: string | null;
  conflict: boolean;
}

const publishedAliasValue = (
  record: UnknownRecord,
  keys: string[],
  normalize: (value: unknown) => string,
): PublishedAliasValue => {
  const values = keys
    .filter((key) => Object.prototype.hasOwnProperty.call(record, key))
    .map((key) => normalize(record[key]) || '__empty__');
  if (!values.length) {
    return { published: false, value: null, signature: null, conflict: false };
  }
  const uniqueValues = [...new Set(values)];
  return {
    published: true,
    value: uniqueValues.length === 1 && uniqueValues[0] !== '__empty__' ? uniqueValues[0] : null,
    signature: uniqueValues.length === 1 ? uniqueValues[0] : null,
    conflict: uniqueValues.length !== 1,
  };
};

const candidateIdentifier = (candidate: UnknownRecord): PublishedAliasValue =>
  publishedAliasValue(candidate, ['id', 'employee_id', 'user_id'], asIdentifier);

const candidateValueIdentifier = (value: unknown): PublishedAliasValue => {
  if (typeof value === 'string' || typeof value === 'number') {
    const identifier = asIdentifier(value);
    return {
      published: true,
      value: identifier || null,
      signature: identifier || null,
      conflict: !identifier,
    };
  }

  const record = asRecord(value);
  if (!Object.keys(record).length) {
    return { published: false, value: null, signature: null, conflict: true };
  }
  const identifiers = [candidateIdentifier(record)];
  for (const key of ['employee', 'assignee', 'user']) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const nested = asRecord(record[key]);
    if (!Object.keys(nested).length) {
      return { published: true, value: null, signature: null, conflict: true };
    }
    identifiers.push(candidateIdentifier(nested));
  }
  const published = identifiers.filter((identifier) => identifier.published);
  const values = published.map((identifier) => identifier.value).filter(Boolean) as string[];
  const conflict = published.some((identifier) => identifier.conflict || !identifier.value) ||
    values.length === 0 || new Set(values).size !== 1;
  const identifier = conflict ? null : values[0];
  return {
    published: true,
    value: identifier,
    signature: identifier,
    conflict,
  };
};

const recordTouchesRoutingIdentity = (
  record: UnknownRecord,
  targetSourceModel: string,
  targetTicketId: string,
): boolean => {
  const sourceValues = ['source_model', 'sourceModel', 'model']
    .filter((key) => Object.prototype.hasOwnProperty.call(record, key))
    .map((key) => normalizeSourceModel(record[key]))
    .filter(Boolean);
  const ticketIdValues = ['id', 'ticket_id', 'ticketId']
    .filter((key) => Object.prototype.hasOwnProperty.call(record, key))
    .map((key) => asIdentifier(record[key]))
    .filter(Boolean);
  return sourceValues.includes(targetSourceModel) && ticketIdValues.includes(targetTicketId);
};

const normalizeCandidateList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return { records: [] as UnknownRecord[], signature: null, conflict: true };
  }
  const identifiers = value.map(candidateValueIdentifier);
  const records = identifiers.map((identifier) => identifier.value ? { id: identifier.value } : {});
  const conflict = identifiers.some(
    (identifier) => !identifier.published || identifier.conflict || !identifier.value,
  );
  const signature = conflict
    ? null
    : JSON.stringify([...new Set(identifiers.map((identifier) => identifier.value as string))].sort());
  return { records, signature, conflict };
};

const recommendationCandidateContract = (
  recommendation: EmployeeRoutingRecommendation | null,
): RecommendationCandidateContract => {
  if (!recommendation) {
    return { published: false, records: [], signature: null, conflict: false };
  }
  const raw = asRecord(recommendation.raw);
  const candidateKeys = [
    'candidate_ids',
    'eligible_assignees',
    'eligible_employees',
    'candidates',
    'candidate_assignees',
  ];
  const publishedKeys = candidateKeys.filter((key) => Object.prototype.hasOwnProperty.call(raw, key));
  if (!publishedKeys.length) {
    return { published: false, records: [], signature: null, conflict: false };
  }
  const contracts = publishedKeys.map((key) => normalizeCandidateList(raw[key]));
  const signatures = contracts.map((contract) => contract.signature ?? '__invalid__');
  const selected = contracts[0];
  return {
    published: true,
    records: selected.records,
    signature: selected.signature,
    conflict: contracts.some((contract) => contract.conflict) || new Set(signatures).size !== 1,
  };
};

const recordsConflictOn = (
  records: UnknownRecord[],
  keys: string[],
  normalize: (value: unknown) => string,
): boolean => {
  const publishedValues = records.map((record) => publishedAliasValue(record, keys, normalize));
  if (publishedValues.some((value) => value.conflict)) return true;
  const publishedCount = publishedValues.filter((value) => value.published).length;
  const signatures = publishedValues
    .filter((value) => value.published)
    .map((value) => value.signature as string);
  if (
    publishedCount > 0 &&
    publishedCount !== publishedValues.length &&
    signatures.some((signature) => signature !== '__empty__')
  ) return true;
  return new Set(signatures).size > 1;
};

const candidateContractSignature = (
  recommendation: EmployeeRoutingRecommendation,
): string => {
  const contract = recommendationCandidateContract(recommendation);
  if (!contract.published) return '__unpublished__';
  return contract.conflict ? '__conflict__' : (contract.signature ?? '__invalid__');
};

const authoritativeCategoryKeys = ['authoritative_category', 'authoritativeCategory'];
const fallbackCategoryKeys = [
  'category',
  'categoria',
  'category_name',
  'categoria_principal',
];

interface CategoryAuthorityResolution {
  value: string | null;
  conflict: boolean;
}

const resolveCategoryAuthority = (records: UnknownRecord[]): CategoryAuthorityResolution => {
  const authoritative = records
    .map((record) => publishedAliasValue(
      record,
      authoritativeCategoryKeys,
      normalizeRoutingDimension,
    ))
    .filter((value) => value.published);

  if (authoritative.length) {
    const values = authoritative
      .map((value) => value.value)
      .filter((value): value is string => Boolean(value));
    const conflict = authoritative.some((value) => value.conflict || !value.value) ||
      new Set(values).size !== 1;
    return { value: conflict ? null : values[0], conflict };
  }

  if (recordsConflictOn(records, fallbackCategoryKeys, normalizeRoutingDimension)) {
    return { value: null, conflict: true };
  }

  const fallback = records
    .map((record) => publishedAliasValue(
      record,
      fallbackCategoryKeys,
      normalizeRoutingDimension,
    ))
    .find((value) => value.published && value.value);
  return { value: fallback?.value ?? null, conflict: false };
};

const resolveRecordCategory = (ticket: UnknownRecord): string | null =>
  resolveCategoryAuthority([ticket]).value;

const employeeMatchesTicketCategory = (
  employee: EmployeeRoutingEmployee,
  ticket: UnknownRecord,
  resolvedCategory?: string | null,
): boolean => {
  const category = resolvedCategory ?? resolveRecordCategory(ticket);
  if (!category || category === 'sin categoria') return false;
  return employee.scope.categorias.some(
    (employeeCategory) => normalizeRoutingDimension(employeeCategory) === category,
  );
};

const resolveEligibleEmployees = (
  routing: EmployeeRoutingV2,
  ticket: UnknownRecord,
  candidateContract: RecommendationCandidateContract,
  resolvedCategory: string | null,
): EmployeeRoutingEmployee[] => {
  if (candidateContract.published) {
    const candidateIds = new Set(
      candidateContract.records
        .map((candidate) => candidateIdentifier(candidate).value)
        .filter(Boolean),
    );
    return routing.employees.filter((employee) => candidateIds.has(String(employee.id)));
  }

  return routing.employees.filter(
    (employee) => employeeMatchesTicketCategory(employee, ticket, resolvedCategory),
  );
};

const resolveSuggestedEmployee = (
  routing: EmployeeRoutingV2,
  recommendation: EmployeeRoutingRecommendation | null,
  candidateContract: RecommendationCandidateContract,
): EmployeeRoutingEmployee | null => {
  if (!recommendation) return null;
  const suggestedId = candidateValueIdentifier(recommendation.suggested_assignee).value;
  if (!suggestedId) return null;
  if (
    candidateContract.published &&
    !candidateContract.records.some(
      (candidate) => candidateIdentifier(candidate).value === suggestedId,
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

  const targetSourceModel = normalizeSourceModel(ticket.source_model);
  const targetTicketId = asIdentifier(ticket.id);
  const allRecommendationTickets = routing.recommendations.map((item) => asRecord(item.ticket));
  const allPublishedTickets = [
    ...routing.queues.open,
    ...routing.queues.unassigned,
    ...allRecommendationTickets,
  ].map(asRecord);
  if (allPublishedTickets.some((item) =>
    recordTouchesRoutingIdentity(item, targetSourceModel, targetTicketId) &&
    getRecordRoutingIdentity(item) !== identity
  )) {
    return { ok: false, reason: 'conflicting_authority' };
  }

  const matchingRecommendations = routing.recommendations.filter(
    (item) => getRecordRoutingIdentity(asRecord(item.ticket)) === identity,
  );
  const recommendation = matchingRecommendations[0] ?? null;
  const publishedTickets = [
    ...routing.queues.open,
    ...routing.queues.unassigned,
    ...allRecommendationTickets,
  ].map(asRecord);
  const matchingTickets = publishedTickets.filter(
    (item) => getRecordRoutingIdentity(item) === identity,
  );
  const authoritativeTicket = matchingTickets[0];
  if (!authoritativeTicket) return { ok: false, reason: 'ticket_not_published' };

  const assigneeKeys = ['assignee_id', 'assigned_user_id', 'assigned_agent_id'];
  const zoneKeys = ['zone', 'zona', 'district', 'distrito'];
  const channelKeys = ['channel', 'canal', 'canal_ingreso'];
  const candidateContracts = matchingRecommendations.map(recommendationCandidateContract);
  const suggestedAssignees = matchingRecommendations
    .map((item) => candidateValueIdentifier(item.suggested_assignee))
    .filter((value) => value.published);
  const candidateSignatures = matchingRecommendations.map(candidateContractSignature);
  const categoryAuthority = resolveCategoryAuthority(matchingTickets);
  if (
    categoryAuthority.conflict ||
    recordsConflictOn(matchingTickets, assigneeKeys, asIdentifier) ||
    recordsConflictOn(matchingTickets, zoneKeys, normalizeRoutingDimension) ||
    recordsConflictOn(matchingTickets, channelKeys, normalizeRoutingDimension) ||
    candidateContracts.some((contract) => contract.conflict) ||
    suggestedAssignees.some((suggested) => suggested.conflict) ||
    new Set(suggestedAssignees.map((suggested) => suggested.signature)).size > 1 ||
    new Set(candidateSignatures).size > 1
  ) {
    return { ok: false, reason: 'conflicting_authority' };
  }

  const sourceModel = asIdentifier(first(authoritativeTicket, ['source_model', 'sourceModel', 'model']));
  const ticketId = asIdentifier(first(authoritativeTicket, ['id', 'ticket_id', 'ticketId']));
  const candidateContract = recommendationCandidateContract(recommendation);
  const eligibleEmployees = resolveEligibleEmployees(
    routing,
    authoritativeTicket,
    candidateContract,
    categoryAuthority.value,
  );
  const suggestedCandidate = resolveSuggestedEmployee(routing, recommendation, candidateContract);
  const suggestedEmployee = suggestedCandidate &&
    eligibleEmployees.some((employee) => String(employee.id) === String(suggestedCandidate.id))
    ? suggestedCandidate
    : null;

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
      category: categoryAuthority.value,
      zone: dimension(zoneKeys),
      channel: dimension(channelKeys),
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
