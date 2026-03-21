import type { Message } from '@/types/chat';

export type ConversationStreamEventName =
  | 'conversation.message.created'
  | 'conversation.message.read'
  | 'ticket.status.changed'
  | 'ticket.assignment.changed'
  | 'ticket.presence.changed'
  | 'ticket.unread.changed'
  | 'legacy.new_chat_message';

export interface ConversationStreamEnvelope {
  event: ConversationStreamEventName;
  schemaVersion: string;
  occurredAt: string;
  conversation: {
    id: string | null;
  };
  ticket: {
    id: string | null;
  };
  message?: {
    id: string;
    text: string;
    isBot: boolean;
    createdAt: string;
    origin?: string;
    audioUrl?: string;
  };
  statusChange?: {
    nextStatus: string;
    previousStatus?: string;
  };
  assignmentChange?: {
    assigneeName: string;
  };
  readStateChange?: {
    messageId?: string;
    readAt?: string;
    lastReadCommentId?: string;
    viewerName?: string;
  };
  presenceChange?: {
    presenceStatus: string;
    effectivePresenceStatus?: string;
    idleCount?: number;
    viewerName?: string;
    sessionId?: string;
  };
  unreadChange?: {
    unreadCount: number;
    unreadViewerCount?: number;
    activeViewerCount?: number;
    latestCommentId?: string;
    latestReadAt?: string;
  };
  raw: Record<string, unknown>;
}

const pickFirstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
};

const normalizeTimestamp = (...values: unknown[]): string => {
  const picked = pickFirstString(...values);
  if (!picked) return new Date().toISOString();
  const parsed = new Date(picked);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const normalizeTicketId = (payload: Record<string, unknown>, nested?: Record<string, unknown> | null): string | null =>
  pickFirstString(
    nested?.ticket_id,
    nested?.ticketId,
    payload.ticket_id,
    payload.ticketId,
    payload.nro_ticket,
    (payload.ticket as Record<string, unknown> | undefined)?.id,
    nested?.id,
  );

const normalizeConversationId = (payload: Record<string, unknown>): string | null =>
  pickFirstString(
    payload.conversation_id,
    payload.conversationId,
    (payload.conversation as Record<string, unknown> | undefined)?.id,
    payload.session_id,
  );

export const normalizeConversationStreamEvent = (
  eventName: ConversationStreamEventName,
  payload: unknown,
): ConversationStreamEnvelope | null => {
  if (!payload || typeof payload !== 'object') return null;

  const raw = payload as Record<string, unknown>;
  const messageNode = raw.message && typeof raw.message === 'object'
    ? (raw.message as Record<string, unknown>)
    : null;

  const baseEnvelope: ConversationStreamEnvelope = {
    event: eventName,
    schemaVersion: pickFirstString(raw.schema_version, raw.schemaVersion) || 'legacy',
    occurredAt: normalizeTimestamp(raw.occurred_at, raw.occurredAt, messageNode?.created_at, messageNode?.fecha, raw.created_at, raw.fecha),
    conversation: {
      id: normalizeConversationId(raw),
    },
    ticket: {
      id: normalizeTicketId(raw, messageNode),
    },
    raw,
  };

  if (eventName === 'conversation.message.created' || eventName === 'legacy.new_chat_message') {
    const messageId = pickFirstString(messageNode?.id, raw.id, raw.message_id);
    if (!messageId) return null;

    return {
      ...baseEnvelope,
      message: {
        id: messageId,
        text: pickFirstString(messageNode?.comentario, messageNode?.text, raw.comentario, raw.text) || '',
        isBot: Boolean(messageNode?.es_admin ?? messageNode?.is_admin ?? raw.es_admin ?? raw.is_admin),
        createdAt: normalizeTimestamp(messageNode?.fecha, messageNode?.created_at, raw.fecha, raw.created_at, raw.occurred_at),
        origin: pickFirstString(messageNode?.origen, raw.origen) || undefined,
        audioUrl: pickFirstString(messageNode?.audio_url, raw.audio_url) || undefined,
      },
    };
  }


  if (eventName === 'conversation.message.read') {
    return {
      ...baseEnvelope,
      readStateChange: {
        messageId: pickFirstString(raw.message_id, (raw.message as Record<string, unknown> | undefined)?.id) || undefined,
        readAt: pickFirstString(raw.read_at, (raw.message as Record<string, unknown> | undefined)?.read_at) || undefined,
        lastReadCommentId: pickFirstString(raw.last_read_comment_id, raw.lastReadCommentId) || undefined,
        viewerName: pickFirstString(raw.viewer_name, raw.viewer_label, raw.viewer_id) || undefined,
      },
    };
  }

  if (eventName === 'ticket.status.changed') {
    const nextStatus = pickFirstString(raw.estado, raw.status, raw.new_status, (raw.ticket as Record<string, unknown> | undefined)?.status);
    if (!nextStatus) return null;
    return {
      ...baseEnvelope,
      statusChange: {
        nextStatus,
        previousStatus: pickFirstString(raw.previous_status, raw.old_status, raw.estado_anterior) || undefined,
      },
    };
  }


  if (eventName === 'ticket.presence.changed') {
    const idleCountRaw = raw.idle_count ?? (raw.presence as Record<string, unknown> | undefined)?.idle_count;
    const idleCount = typeof idleCountRaw === 'number' ? idleCountRaw : Number(idleCountRaw ?? 0);
    return {
      ...baseEnvelope,
      presenceChange: {
        presenceStatus: pickFirstString(raw.presence_status, raw.presenceStatus, raw.status) || 'active',
        effectivePresenceStatus: pickFirstString(raw.effective_presence_status, raw.effectivePresenceStatus) || undefined,
        idleCount: Number.isFinite(idleCount) ? idleCount : 0,
        viewerName: pickFirstString(raw.viewer_name, raw.viewer_label, raw.viewer_id) || undefined,
        sessionId: pickFirstString(raw.session_id, raw.sessionId) || undefined,
      },
    };
  }

  if (eventName === 'ticket.unread.changed') {
    const unreadCountRaw = raw.unread_count ?? raw.unreadCount ?? (raw.summary as Record<string, unknown> | undefined)?.unread_count;
    const unreadViewerCountRaw = raw.unread_viewer_count ?? raw.unreadViewerCount ?? (raw.collaboration_state as Record<string, unknown> | undefined)?.unread_viewer_count;
    const activeViewerCountRaw = raw.active_viewers_count ?? raw.activeViewersCount ?? (raw.collaboration_state as Record<string, unknown> | undefined)?.active_viewers_count;
    const unreadCount = typeof unreadCountRaw === 'number' ? unreadCountRaw : Number(unreadCountRaw ?? 0);
    const unreadViewerCount = typeof unreadViewerCountRaw === 'number' ? unreadViewerCountRaw : Number(unreadViewerCountRaw ?? 0);
    const activeViewerCount = typeof activeViewerCountRaw === 'number' ? activeViewerCountRaw : Number(activeViewerCountRaw ?? 0);

    return {
      ...baseEnvelope,
      unreadChange: {
        unreadCount: Number.isFinite(unreadCount) ? unreadCount : 0,
        unreadViewerCount: Number.isFinite(unreadViewerCount) ? unreadViewerCount : 0,
        activeViewerCount: Number.isFinite(activeViewerCount) ? activeViewerCount : 0,
        latestCommentId: pickFirstString(raw.latest_comment_id, raw.latestCommentId, (raw.collaboration_state as Record<string, unknown> | undefined)?.latest_comment_id) || undefined,
        latestReadAt: pickFirstString(raw.latest_read_at, raw.latestReadAt, (raw.collaboration_state as Record<string, unknown> | undefined)?.latest_read_at) || undefined,
      },
    };
  }

  if (eventName === 'ticket.assignment.changed') {
    const assignedTo = raw.assigned_to && typeof raw.assigned_to === 'object'
      ? (raw.assigned_to as Record<string, unknown>)
      : null;
    const assigneeName =
      pickFirstString(
        assignedTo?.name,
        assignedTo?.nombre,
        raw.agent_name,
        raw.assignee_name,
        raw.assignee,
      ) || 'un responsable';

    return {
      ...baseEnvelope,
      assignmentChange: {
        assigneeName,
      },
    };
  }

  return null;
};

export const envelopeMatchesTicket = (
  envelope: ConversationStreamEnvelope,
  ticketId?: string | number | null,
): boolean => {
  if (!ticketId || !envelope.ticket.id) return true;
  return String(envelope.ticket.id) === String(ticketId);
};

export const toRealtimeMessage = (envelope: ConversationStreamEnvelope): Message | null => {
  if (!envelope.message) return null;
  return {
    id: envelope.message.id,
    text: envelope.message.text,
    isBot: envelope.message.isBot,
    timestamp: new Date(envelope.message.createdAt),
    origen: envelope.message.origin === 'email' ? 'email' : 'chat',
    audioUrl: envelope.message.audioUrl,
  };
};
