import type {
  TicketSlaClock,
  TicketSlaClockState,
  TicketSlaContract,
} from '@/types/tickets';

type UnknownRecord = Record<string, unknown>;

export type TicketSlaClockKey = 'first_response' | 'next_update' | 'resolution';

export const TICKET_SLA_CLOCK_KEYS: TicketSlaClockKey[] = [
  'first_response',
  'next_update',
  'resolution',
];

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readText = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
};

const readBoolean = (...values: unknown[]): boolean | null => {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
  }
  return null;
};

const readFiniteNumber = (...values: unknown[]): number | null => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
};

const readValidTimestamp = (...values: unknown[]): string | null => {
  const value = readText(...values);
  if (!value) return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
};

const normalizeState = (value: unknown): TicketSlaClockState => {
  const normalized = readText(value)?.toLowerCase().replace(/[\s-]+/g, '_');
  if (!normalized) return 'unknown';
  if (['overdue', 'breached', 'breach', 'satisfied_late', 'vencido', 'vencida'].includes(normalized)) return 'overdue';
  if (['due', 'warning', 'at_risk', 'por_vencer'].includes(normalized)) return 'due';
  if (['healthy', 'ok', 'within_sla', 'en_plazo'].includes(normalized)) return 'healthy';
  if (['satisfied', 'fulfilled', 'completed', 'met', 'cumplido', 'cumplida'].includes(normalized)) return 'satisfied';
  if (['paused', 'on_hold', 'suspended', 'pausado', 'pausada'].includes(normalized)) return 'paused';
  if (['inactive', 'not_active', 'not_applicable', 'inactivo', 'inactiva'].includes(normalized)) return 'inactive';
  return 'unknown';
};

const normalizeStatus = (value: unknown, atRisk: boolean): TicketSlaClockState => {
  const normalized = normalizeState(value);
  // Backend status `due` means an obligation is open. Only an explicit warning/
  // at-risk signal may present it as "Por vencer".
  return normalized === 'due' && !atRisk ? 'unknown' : normalized;
};

const clockAliases: Record<TicketSlaClockKey, {
  dueAt: string[];
  state: string[];
  status: string[];
  fulfilledAt: string[];
  remainingSeconds: string[];
  atRisk: string[];
}> = {
  first_response: {
    dueAt: ['first_response_due_at'],
    state: ['first_response_state'],
    status: ['first_response_status'],
    fulfilledAt: ['first_response_satisfied_at', 'first_response_fulfilled_at', 'first_response_at'],
    remainingSeconds: ['first_response_remaining_seconds'],
    atRisk: ['first_response_at_risk'],
  },
  next_update: {
    dueAt: ['next_update_due_at'],
    state: ['next_update_state'],
    status: ['next_update_status'],
    fulfilledAt: ['next_update_satisfied_at', 'next_update_fulfilled_at', 'last_update_at'],
    remainingSeconds: ['next_update_remaining_seconds'],
    atRisk: ['next_update_at_risk'],
  },
  resolution: {
    dueAt: ['resolution_due_at'],
    state: ['resolution_state'],
    status: ['resolution_status'],
    fulfilledAt: ['resolution_satisfied_at', 'resolution_fulfilled_at', 'resolved_at'],
    remainingSeconds: ['resolution_remaining_seconds'],
    atRisk: ['resolution_at_risk'],
  },
};

const firstDefined = (record: UnknownRecord, keys: string[]): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const unknownClock = (): TicketSlaClock => ({
  state: 'unknown',
  due_at: null,
  fulfilled_at: null,
  remaining_seconds: null,
  known: false,
  overdue: false,
});

const normalizeClock = (
  key: TicketSlaClockKey,
  root: UnknownRecord,
  clocks: UnknownRecord,
  contractPaused: boolean,
): TicketSlaClock => {
  const candidate = isRecord(clocks[key]) ? clocks[key] : {};
  const aliases = clockAliases[key];
  const dueAt = readValidTimestamp(candidate.due_at, firstDefined(root, aliases.dueAt));
  const fulfilledAt = readValidTimestamp(
    candidate.fulfilled_at,
    candidate.satisfied_at,
    firstDefined(root, aliases.fulfilledAt),
  );
  const atRisk = readBoolean(candidate.at_risk, firstDefined(root, aliases.atRisk)) === true;
  const stateCandidate = normalizeState(candidate.state);
  const statusCandidate = normalizeStatus(candidate.status, atRisk);
  const flatStateCandidate = normalizeState(firstDefined(root, aliases.state));
  const flatStatusCandidate = normalizeStatus(firstDefined(root, aliases.status), atRisk);
  const explicitState = stateCandidate !== 'unknown'
    ? stateCandidate
    : statusCandidate !== 'unknown'
      ? statusCandidate
      : flatStateCandidate !== 'unknown'
        ? flatStateCandidate
        : flatStatusCandidate;
  const explicitlyKnown = readBoolean(candidate.known);
  const explicitlyPaused = explicitState === 'paused' || readBoolean(candidate.paused) === true || contractPaused;
  let state: TicketSlaClockState = 'unknown';

  if (dueAt && fulfilledAt && explicitlyKnown !== false && explicitState === 'satisfied') {
    state = new Date(fulfilledAt).getTime() <= new Date(dueAt).getTime() ? 'satisfied' : 'overdue';
  } else if (dueAt && explicitlyKnown !== false && explicitState === 'overdue') {
    state = 'overdue';
  } else if (explicitlyPaused) {
    state = 'paused';
  } else if (
    dueAt &&
    explicitlyKnown !== false &&
    (explicitState === 'due' || explicitState === 'healthy')
  ) {
    state = explicitState;
  } else if (explicitState === 'inactive' && explicitlyKnown !== false) {
    state = 'inactive';
  }

  return {
    state,
    due_at: dueAt,
    fulfilled_at: fulfilledAt,
    remaining_seconds: readFiniteNumber(
      candidate.remaining_seconds,
      firstDefined(root, aliases.remainingSeconds),
    ),
    known: state !== 'unknown',
    overdue: state === 'overdue',
  };
};

export const summarizeTicketSlaState = (
  clocks: TicketSlaContract['clocks'],
): TicketSlaClockState => {
  const states = TICKET_SLA_CLOCK_KEYS.map((key) => clocks[key].state);
  if (states.includes('overdue')) return 'overdue';
  if (states.includes('due')) return 'due';
  if (states.includes('paused')) return 'paused';
  if (states.includes('unknown')) return 'unknown';
  if (states.includes('healthy')) return 'healthy';
  if (states.includes('satisfied')) return 'satisfied';
  if (states.every((state) => state === 'inactive')) return 'inactive';
  return 'unknown';
};

export const normalizeTicketSla = (value: unknown): TicketSlaContract => {
  const root = isRecord(value) ? value : {};
  const clocks = isRecord(root.clocks) ? root.clocks : {};
  const paused = readBoolean(root.paused) === true || normalizeState(root.state ?? root.status) === 'paused';
  const normalizedClocks = {
    first_response: normalizeClock('first_response', root, clocks, paused),
    next_update: normalizeClock('next_update', root, clocks, paused),
    resolution: normalizeClock('resolution', root, clocks, paused),
  };
  const state = summarizeTicketSlaState(normalizedClocks);
  const known = TICKET_SLA_CLOCK_KEYS.every((key) => normalizedClocks[key].known);

  return {
    contract_version: readText(root.contract_version),
    evaluated_at: readValidTimestamp(root.evaluated_at),
    state,
    known,
    overdue: state === 'overdue',
    paused,
    clocks: normalizedClocks,
  };
};

export const resolveTicketSlaSource = (ticket: {
  sla?: unknown;
  sla_evaluation?: unknown;
  datos_extra?: Record<string, unknown> | null;
}): unknown | undefined => {
  if (isRecord(ticket.sla)) return ticket.sla;
  if (isRecord(ticket.sla_evaluation)) return ticket.sla_evaluation;
  if (isRecord(ticket.datos_extra?.sla)) return ticket.datos_extra?.sla;
  if (isRecord(ticket.datos_extra?.sla_evaluation)) return ticket.datos_extra?.sla_evaluation;
  return undefined;
};

export const isTicketSlaOverdue = (value: unknown): boolean =>
  normalizeTicketSla(value).state === 'overdue';
