import type { Ticket } from '@/types/tickets';
import { normalizeTicketStatus } from '@/utils/ticketStatus';
import { normalizeTicketLocation, pickFirstCoordinate } from '@/utils/location';

export type OperationalGuidance = {
  label: string;
  source: 'backend' | 'ui';
  tags: string[];
};

const normalizeTextValue = (value: unknown): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string') return value.trim();
  return '';
};

const hasAssignedOperator = (ticket: Ticket): boolean =>
  Boolean(
    normalizeTextValue(
      ticket.assignedAgent?.nombre_usuario ||
        ticket.user?.nombre_usuario ||
        ticket.assignedAgentId ||
        ticket.assigned_agent_id ||
        ticket.assigned_user_id,
    ),
  );

const hasTicketLocationSignal = (ticket: Ticket): boolean => {
  if (ticket.has_location) return true;

  const normalizedLocation = normalizeTicketLocation(ticket);
  const address =
    normalizeTextValue(normalizedLocation.direccion) ||
    normalizeTextValue(ticket.direccion) ||
    normalizeTextValue(ticket.informacion_personal_vecino?.direccion);

  if (address) return true;

  const lat = pickFirstCoordinate(
    normalizedLocation.latitud,
    normalizedLocation.lat_destino,
    ticket.latitud,
    ticket.lat_destino,
  );
  const lon = pickFirstCoordinate(
    normalizedLocation.longitud,
    normalizedLocation.lon_destino,
    ticket.longitud,
    ticket.lon_destino,
  );

  return typeof lat === 'number' && typeof lon === 'number';
};

const hasAttachmentSignal = (ticket: Ticket): boolean =>
  Boolean(
    ticket.foto_url_directa ||
      ticket.archivo_url ||
      ticket.imagen_url ||
      ticket.attachment_info ||
      ticket.attachments?.length ||
      ticket.archivos_adjuntos?.length ||
      ticket.messages?.some((message) => message.attachments?.length || message.archivos_adjuntos?.length),
  );

const isRiskSignal = (value: unknown): boolean => {
  const normalized = normalizeTextValue(value).toLowerCase();
  return ['risk', 'riesgo', 'alto', 'alta', 'high', 'urgente', 'critical', 'critico', 'vencido', 'breached'].some((token) =>
    normalized.includes(token),
  );
};

export const deriveTicketOperationalGuidance = (ticket: Ticket): OperationalGuidance => {
  const backendAction = normalizeTextValue(ticket.recommended_next_action);
  if (backendAction) {
    return { label: backendAction, source: 'backend', tags: ['backend'] };
  }

  const status = normalizeTicketStatus(ticket.estado);
  const unreadCount = Number(ticket.collaboration_state?.unread_count ?? 0);
  const hasUnread =
    ticket.hasUnreadMessages === true ||
    ticket.collaboration_state?.has_unread === true ||
    unreadCount > 0;
  const hasLocation = hasTicketLocationSignal(ticket);
  const hasAttachments = hasAttachmentSignal(ticket);
  const isMunicipalTicket = ticket.tipo === 'municipio';
  const priorityRisk = isRiskSignal(ticket.priority) || isRiskSignal(ticket.sla_status);

  if (status === 'resuelto') {
    return {
      label: 'Verificar cierre, enviar historial y dejar el seguimiento listo para auditoria.',
      source: 'ui',
      tags: ['cierre', 'historial'],
    };
  }

  if (hasUnread) {
    return {
      label: 'Responder la ultima consulta del vecino o cliente desde la conversacion del caso.',
      source: 'ui',
      tags: ['respuesta pendiente'],
    };
  }

  if (priorityRisk) {
    return {
      label: 'Priorizar este caso, revisar SLA y dejar una respuesta operativa antes de derivarlo.',
      source: 'ui',
      tags: ['riesgo', 'SLA'],
    };
  }

  if (!hasAssignedOperator(ticket)) {
    return {
      label: 'Asignar responsable del area y confirmar el primer contacto desde el chat.',
      source: 'ui',
      tags: ['asignacion'],
    };
  }

  if (isMunicipalTicket && !hasLocation) {
    return {
      label: 'Solicitar ubicacion exacta o validar el punto en mapa antes de pasar a cuadrilla.',
      source: 'ui',
      tags: ['ubicacion'],
    };
  }

  if (hasAttachments) {
    return {
      label: 'Revisar la evidencia adjunta y responder con el proximo paso claro para el vecino.',
      source: 'ui',
      tags: ['evidencia'],
    };
  }

  return {
    label: 'Revisar conversacion, confirmar datos clave y responder desde la mesa operativa.',
    source: 'ui',
    tags: ['seguimiento'],
  };
};

export const buildOperationalReplyDraft = (ticket: Ticket, guidance: OperationalGuidance): string => {
  const ticketLabel = ticket.nro_ticket ? ` ${ticket.nro_ticket}` : '';
  const category = ticket.categoria ? ` por ${ticket.categoria}` : '';
  const tags = new Set(guidance.tags.map((tag) => tag.toLowerCase()));

  if (tags.has('ubicacion')) {
    return `Gracias por el aviso${ticketLabel}. Para derivar el caso${category}, necesitamos que nos confirmes la ubicacion exacta o una referencia cercana.`;
  }

  if (tags.has('respuesta pendiente')) {
    return `Gracias por escribirnos${ticketLabel}. Estamos revisando tu consulta y te respondemos el proximo paso por este mismo chat.`;
  }

  if (tags.has('riesgo') || tags.has('sla')) {
    return `Gracias por la informacion${ticketLabel}. Estamos priorizando el caso${category} y vamos a dejar actualizaciones por este mismo canal.`;
  }

  if (tags.has('asignacion')) {
    return `Reclamo recibido${ticketLabel}. Lo estamos asignando al area correspondiente y te avisamos el avance por este chat.`;
  }

  if (tags.has('cierre')) {
    return `El reclamo${ticketLabel} figura con seguimiento de cierre. Si todavia ves el problema, respondeme por aca y lo reabrimos para revision.`;
  }

  if (tags.has('evidencia')) {
    return `Gracias por la evidencia enviada${ticketLabel}. La vamos a revisar y te respondemos con el proximo paso operativo.`;
  }

  return `Gracias por contactarnos${ticketLabel}. Registramos tu consulta${category} y te respondemos el proximo paso por este mismo canal.`;
};
