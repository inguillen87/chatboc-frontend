import type { Ticket } from '@/types/tickets';
import { normalizeTicketStatus } from '@/utils/ticketStatus';

type QueueTicket = Partial<Ticket> & Record<string, any>;

export const isUnreadQueueTicket = (ticket: QueueTicket) =>
  Boolean(
    ticket.hasUnreadMessages ||
      ticket.collaboration_state?.has_unread ||
      Number(ticket.collaboration_state?.unread_count || 0) > 0 ||
      Number(ticket.collaboration_state?.unread_viewer_count || 0) > 0,
  );

export const isRiskQueueTicket = (ticket: QueueTicket) => {
  const sla = String(ticket.sla_status || '').toLowerCase();
  const priority = String(ticket.priority || '').toLowerCase();
  return (
    sla.includes('breach') ||
    sla.includes('venc') ||
    sla.includes('overdue') ||
    priority.includes('alta') ||
    priority.includes('urgent') ||
    priority.includes('urgente')
  );
};

export const isUnassignedQueueTicket = (ticket: QueueTicket) => {
  const assigned =
    ticket.assignedAgent?.id ||
    ticket.assignedAgentId ||
    ticket.assigned_agent_id ||
    ticket.assigned_user_id ||
    ticket.asigned_user_id ||
    ticket.user?.id;
  return assigned === undefined || assigned === null || String(assigned).trim() === '';
};

export const getQueueTimestamp = (ticket: QueueTicket) => {
  const raw =
    ticket.updated_at ||
    ticket.fecha_actualizacion ||
    ticket.last_message_at ||
    ticket.ultimo_mensaje_at ||
    ticket.created_at ||
    ticket.fecha_creacion ||
    ticket.fecha;
  const parsed = raw ? Date.parse(String(raw)) : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const getQueueScore = (ticket: QueueTicket) => {
  const status = normalizeTicketStatus(ticket.estado);
  const rawStatus = String(ticket.estado || '').toLowerCase();
  const isResolved = status === 'resuelto' || rawStatus === 'cerrado';
  return (
    (isUnreadQueueTicket(ticket) ? 100 : 0) +
    (isRiskQueueTicket(ticket) ? 50 : 0) +
    (!isResolved ? 10 : 0)
  );
};

export function sortTicketsByOperationalPriority(tickets: Ticket[]): Ticket[];
export function sortTicketsByOperationalPriority<T extends QueueTicket>(tickets: T[]): T[];
export function sortTicketsByOperationalPriority<T extends QueueTicket>(tickets: T[]): T[] {
  return [...tickets].sort((left, right) => {
    const scoreDelta = getQueueScore(right) - getQueueScore(left);
    if (scoreDelta !== 0) return scoreDelta;
    return getQueueTimestamp(right) - getQueueTimestamp(left);
  });
}

export function getNextOperationalTicket(tickets: Ticket[]): Ticket | null;
export function getNextOperationalTicket<T extends QueueTicket>(tickets: T[]): T | null;
export function getNextOperationalTicket<T extends QueueTicket>(tickets: T[]): T | null {
  return sortTicketsByOperationalPriority(tickets)[0] || null;
}
