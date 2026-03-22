import { normalizeConversationStreamEvent, type ConversationStreamEnvelope, type ConversationStreamEventName } from '@/utils/conversationStream';

export type EnterpriseRealtimeEnvelope = {
  event_name: string;
  schema_version: string;
  occurred_at: string;
  room?: string | null;
  conversation: {
    id?: string | null;
    channel?: string | null;
    origin?: string | null;
    visibility?: string | null;
  };
  ticket: {
    id?: string | number | null;
    tenant_type?: string | null;
    tenant_id?: string | number | null;
    status?: string | null;
    priority?: string | null;
  };
  message: {
    id?: string | number | null;
    text?: string | null;
    author_type?: string | null;
  };
  payload: Record<string, unknown>;
};

const pickFirstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : null;

export const adaptRealtimeEnvelope = (
  eventName: string,
  payload: unknown,
): EnterpriseRealtimeEnvelope | null => {
  const raw = asRecord(payload);
  if (!raw) return null;

  const conversation = asRecord(raw.conversation);
  const ticket = asRecord(raw.ticket);
  const message = asRecord(raw.message);
  const normalizedEvent = normalizeConversationStreamEvent(
    eventName as ConversationStreamEventName,
    raw,
  );

  return {
    event_name: eventName,
    schema_version:
      pickFirstString(raw.schema_version, raw.schemaVersion, normalizedEvent?.schemaVersion) || 'legacy',
    occurred_at:
      pickFirstString(raw.occurred_at, raw.occurredAt, normalizedEvent?.occurredAt) || new Date().toISOString(),
    room: pickFirstString(raw.room, raw.room_id, raw.roomId),
    conversation: {
      id: pickFirstString(conversation?.id, raw.conversation_id, raw.conversationId, normalizedEvent?.conversation.id),
      channel: pickFirstString(conversation?.channel, raw.channel, raw.canal),
      origin: pickFirstString(conversation?.origin, raw.origin, raw.origen),
      visibility: pickFirstString(conversation?.visibility, raw.visibility, raw.visibilidad),
    },
    ticket: {
      id: pickFirstString(ticket?.id, raw.ticket_id, raw.ticketId, normalizedEvent?.ticket.id),
      tenant_type: pickFirstString(ticket?.tenant_type, ticket?.tenantType, raw.tenant_type, raw.tenantType),
      tenant_id: pickFirstString(ticket?.tenant_id, ticket?.tenantId, raw.tenant_id, raw.tenantId),
      status: pickFirstString(ticket?.status, raw.status, raw.estado, normalizedEvent?.statusChange?.nextStatus),
      priority: pickFirstString(ticket?.priority, raw.priority, raw.prioridad),
    },
    message: {
      id: pickFirstString(message?.id, raw.message_id, raw.messageId, normalizedEvent?.message?.id),
      text: pickFirstString(message?.text, raw.text, raw.comentario, normalizedEvent?.message?.text),
      author_type: pickFirstString(message?.author_type, message?.authorType, raw.author_type, raw.authorType),
    },
    payload: raw,
  };
};

export const buildRealtimeDedupKey = (envelope: EnterpriseRealtimeEnvelope): string => {
  return [
    envelope.event_name || 'unknown',
    envelope.ticket.id ?? 'no-ticket',
    envelope.message.id ?? 'no-message',
    envelope.occurred_at || 'no-date',
  ].join(':');
};

export const toConversationStreamEnvelope = (
  eventName: string,
  payload: unknown,
): ConversationStreamEnvelope | null => {
  return normalizeConversationStreamEvent(eventName as ConversationStreamEventName, payload);
};
