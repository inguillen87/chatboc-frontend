export const ALLOWED_TICKET_STATUSES = [
  'nuevo',
  'esperando_agente_en_vivo',
  'en_vivo',
  'en_proceso',
  'resuelto',
] as const;

export type AllowedTicketStatus = typeof ALLOWED_TICKET_STATUSES[number];

const STATUS_ALIASES: Record<string, AllowedTicketStatus> = {
  open: 'nuevo',
  abierto: 'en_proceso',
  'en espera': 'en_proceso',
  'en-espera': 'en_proceso',
  en_espera: 'en_proceso',
  enespera: 'en_proceso',
  esperando_agente: 'esperando_agente_en_vivo',
  esperando_agente_en_vivo: 'esperando_agente_en_vivo',
  'esperando agente en vivo': 'esperando_agente_en_vivo',
  'en vivo': 'en_vivo',
  'en-vivo': 'en_vivo',
  en_camino: 'en_proceso',
  llegando: 'en_proceso',
  'en camino': 'en_proceso',
  derivado: 'en_proceso',
  'en proceso': 'en_proceso',
  in_progress: 'en_proceso',
  waiting_customer: 'en_proceso',
  completado: 'resuelto',
  cerrado: 'resuelto',
  closed: 'resuelto',
  finalizado: 'resuelto',
  resolved: 'resuelto',
  solucionado: 'resuelto',
  resuelto: 'resuelto',
};

const HUMAN_LABELS: Record<AllowedTicketStatus, string> = {
  nuevo: 'Nuevo',
  esperando_agente_en_vivo: 'Esperando agente',
  en_vivo: 'En vivo',
  en_proceso: 'En proceso',
  resuelto: 'Resuelto',
};

const normalizeRawStatus = (value?: string | null) => {
  if (!value) {
    return '';
  }

  return value.toString().trim().toLowerCase().replace(/[\s-]+/g, '_');
};

export const normalizeTicketStatus = (
  value?: string | null,
): AllowedTicketStatus | null => {
  const normalized = normalizeRawStatus(value);

  if (!normalized) {
    return null;
  }

  if (
    ALLOWED_TICKET_STATUSES.includes(
      normalized as AllowedTicketStatus,
    )
  ) {
    return normalized as AllowedTicketStatus;
  }

  return STATUS_ALIASES[normalized] ?? null;
};

export const formatTicketStatusLabel = (
  value?: string | null,
) => {
  const normalized = normalizeTicketStatus(value);

  if (normalized) {
    return HUMAN_LABELS[normalized];
  }

  if (!value) {
    return 'Sin estado';
  }

  return value
    .toString()
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const buildStatusFlow = (
  values: Array<string | null | undefined>,
): AllowedTicketStatus[] => {
  const set = new Set<AllowedTicketStatus>(ALLOWED_TICKET_STATUSES);

  values.forEach((value) => {
    const normalized = normalizeTicketStatus(value);
    if (normalized) {
      set.add(normalized);
    }
  });

  return ALLOWED_TICKET_STATUSES.filter((status) => set.has(status));
};

export const pickLastKnownStatus = (
  values: Array<string | null | undefined>,
) => {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    const normalized = normalizeTicketStatus(value);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

interface TicketWorkflowStateSource {
  estado?: string | null;
  next_states?: unknown;
  workflow?: {
    next_states?: unknown;
  } | null;
}

/**
 * Returns only transitions explicitly published for this ticket by the API.
 * Missing/malformed contracts fail closed instead of recreating business rules
 * in the browser.
 */
export const getPublishedTicketTransitions = (
  ticket?: TicketWorkflowStateSource | null,
): AllowedTicketStatus[] => {
  if (!ticket) return [];

  const rawNextStates = Array.isArray(ticket.workflow?.next_states)
    ? ticket.workflow.next_states
    : Array.isArray(ticket.next_states)
      ? ticket.next_states
      : [];
  const currentState = normalizeTicketStatus(ticket.estado);
  const transitions = new Set<AllowedTicketStatus>();

  rawNextStates.forEach((value) => {
    if (typeof value !== 'string') return;
    const normalized = normalizeTicketStatus(value);
    if (normalized && normalized !== currentState) transitions.add(normalized);
  });

  return ALLOWED_TICKET_STATUSES.filter((status) => transitions.has(status));
};
