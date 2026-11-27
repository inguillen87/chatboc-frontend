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
  esperando_agente_en_vivo: 'Esperando atención',
  en_vivo: 'Atención en curso',
  en_proceso: 'En proceso',
  resuelto: 'Resuelto',
};

const STATUS_LABEL_ALIASES: Record<string, string> = {
  pending_data: 'Esperando datos',
  pendiente_datos: 'Esperando datos',
  waiting_customer: 'Esperando datos',
  waiting_agent: 'Esperando atención',
  esperando_agente: 'Esperando atención',
};

const DISPLAY_CODE_LABELS: Record<string, string> = {
  accepted: 'Aceptado',
  active: 'Activo',
  agent: 'Equipo de atención',
  assigned: 'Con responsable',
  assign_owner: 'Asignar responsable',
  at_risk: 'En riesgo',
  backend: 'Sistema',
  breached: 'Vencido',
  cancelled: 'Cancelado',
  closed: 'Cerrado',
  critical: 'Crítica',
  crm: 'Registro interno',
  crm_only: 'Guardado en el caso',
  customer_waiting: 'Esperando respuesta',
  delivered: 'Entregado',
  email: 'Correo electrónico',
  failed: 'No entregado',
  expired: 'Vencido',
  high: 'Alta',
  human_active: 'Atención del equipo',
  in_progress: 'En proceso',
  internal_event: 'Registro interno',
  live_socket: 'Chat en vivo',
  low: 'Baja',
  medium: 'Media',
  monitor_ticket: 'Revisar el caso',
  negative: 'Negativo',
  neutral: 'Neutral',
  new: 'Nuevo',
  no_evidence: 'Sin plazo definido',
  normal: 'Normal',
  offline: 'Fuera de horario',
  online: 'Disponible',
  open: 'Abierto',
  open_ticket: 'Abrir caso',
  operational: 'Operativo',
  paused: 'Pausado',
  pending: 'Pendiente',
  pending_data: 'Esperando datos',
  pending_provider_callback: 'Esperando confirmación del canal',
  provider_accepted: 'Recibido por el canal',
  provider_status_callback: 'Confirmación del canal',
  positive: 'Positivo',
  queue_offline_message: 'Mensaje pendiente para el equipo',
  queued: 'En espera',
  read: 'Leído',
  ready: 'Listo para atender',
  reply_from_crm: 'Responder el caso',
  requested: 'Solicitado',
  resolved: 'Resuelto',
  review_sla_and_update: 'Revisar el plazo y actualizar',
  risk: 'En riesgo',
  resumed: 'Atención automática reanudada',
  resumed_ai: 'Atención automática reanudada',
  sent: 'Enviado',
  sms: 'SMS',
  socket: 'Chat en vivo',
  satisfied: 'Cumplido',
  sla_breached: 'Plazo vencido',
  timeline_comment: 'Actividad del caso',
  timeline_event: 'Actividad del caso',
  timeline_only: 'Guardado en el caso',
  undelivered: 'No entregado',
  unassigned: 'Sin responsable',
  unread: 'No leído',
  unknown: 'Sin información',
  urgent: 'Urgente',
  waiting_agent: 'Esperando atención',
  waiting_customer: 'Esperando datos',
  web: 'Sitio web',
  web_demo_widget: 'Sitio web',
  whatsapp: 'WhatsApp',
  whatsapp_business: 'WhatsApp',
  widget: 'Sitio web',
};

const INTERNAL_CODE_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/i;

export const replaceTicketVocabulary = (value?: unknown): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  const readable = raw
    .replace(/\btickets\b/gi, 'casos')
    .replace(/\bticket\b/gi, 'caso')
    .replace(/\bSLA\b/gi, 'plazo');

  if (/^[A-ZÁÉÍÓÚÜÑ]/u.test(raw) && /^[a-záéíóúüñ]/u.test(readable)) {
    return `${readable.charAt(0).toLocaleUpperCase('es-AR')}${readable.slice(1)}`;
  }

  return readable;
};

/**
 * Formats server-published enum values without leaking implementation tokens.
 * Human-authored labels are preserved (with the public vocabulary applied),
 * while unknown snake/kebab-case values fail closed to the supplied fallback.
 */
export const formatTicketDisplayLabel = (
  value?: unknown,
  fallback = 'En espera',
): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;

  const normalized = raw.toLowerCase().replace(/[\s-]+/g, '_');
  const mapped = DISPLAY_CODE_LABELS[normalized] || STATUS_LABEL_ALIASES[normalized];
  if (mapped) return mapped;
  if (INTERNAL_CODE_PATTERN.test(raw)) return fallback;

  return replaceTicketVocabulary(raw);
};

export const formatTicketOptionalLabel = (value?: unknown): string | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const label = formatTicketDisplayLabel(raw, '');
  return label || null;
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
  const raw = normalizeRawStatus(value);
  if (STATUS_LABEL_ALIASES[raw]) {
    return STATUS_LABEL_ALIASES[raw];
  }

  const normalized = normalizeTicketStatus(value);

  if (normalized) {
    return HUMAN_LABELS[normalized];
  }

  return value ? 'En espera' : 'Sin estado';
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
