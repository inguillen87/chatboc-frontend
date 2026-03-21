import { describe, expect, it } from 'vitest';
import {
  envelopeMatchesTicket,
  normalizeConversationStreamEvent,
  toRealtimeMessage,
} from './conversationStream';

describe('conversationStream', () => {
  it('normalizes conversation.message.created envelopes', () => {
    const envelope = normalizeConversationStreamEvent('conversation.message.created', {
      schema_version: '2026-03-01',
      occurred_at: '2026-03-21T12:00:00.000Z',
      conversation: { id: 'conv_123' },
      ticket: { id: 77 },
      message: {
        id: 'msg_1',
        text: 'Hola',
        is_admin: true,
        created_at: '2026-03-21T12:00:01.000Z',
        origen: 'admin_panel',
      },
    });

    expect(envelope).toMatchObject({
      event: 'conversation.message.created',
      schemaVersion: '2026-03-01',
      conversation: { id: 'conv_123' },
      ticket: { id: '77' },
      message: {
        id: 'msg_1',
        text: 'Hola',
        isBot: true,
      },
    });

    expect(toRealtimeMessage(envelope!)).toMatchObject({
      id: 'msg_1',
      text: 'Hola',
      isBot: true,
      origen: 'chat',
    });
  });

  it('normalizes legacy new_chat_message payloads', () => {
    const envelope = normalizeConversationStreamEvent('legacy.new_chat_message', {
      id: 9,
      comentario: 'Mensaje legacy',
      es_admin: false,
      fecha: '2026-03-21T13:00:00.000Z',
      nro_ticket: 90,
      origen: 'whatsapp',
    });

    expect(envelope).toMatchObject({
      event: 'legacy.new_chat_message',
      schemaVersion: 'legacy',
      ticket: { id: '90' },
      message: {
        id: '9',
        text: 'Mensaje legacy',
        isBot: false,
      },
    });
  });

  it('normalizes ticket.unread.changed envelopes', () => {
    const envelope = normalizeConversationStreamEvent('ticket.unread.changed', {
      schema_version: '2026-03-21',
      ticket_id: 44,
      unread_count: '5',
      collaboration_state: {
        unread_viewer_count: '2',
        active_viewers_count: 1,
        latest_comment_id: 321,
        latest_read_at: '2026-03-21T13:01:00.000Z',
      },
    });

    expect(envelope).toMatchObject({
      event: 'ticket.unread.changed',
      ticket: { id: '44' },
      unreadChange: {
        unreadCount: 5,
        unreadViewerCount: 2,
        activeViewerCount: 1,
        latestCommentId: '321',
        latestReadAt: '2026-03-21T13:01:00.000Z',
      },
    });
  });

  it('normalizes presence envelopes with effective presence data', () => {
    const envelope = normalizeConversationStreamEvent('ticket.presence.changed', {
      ticket_id: 88,
      presence_status: 'active',
      effective_presence_status: 'idle',
      viewer_name: 'Operador 1',
      presence: {
        idle_count: '3',
      },
    });

    expect(envelope).toMatchObject({
      event: 'ticket.presence.changed',
      ticket: { id: '88' },
      presenceChange: {
        presenceStatus: 'active',
        effectivePresenceStatus: 'idle',
        idleCount: 3,
        viewerName: 'Operador 1',
      },
    });
  });

  it('matches tickets defensively', () => {
    const envelope = normalizeConversationStreamEvent('ticket.status.changed', {
      ticket_id: 55,
      status: 'en_proceso',
    });

    expect(envelopeMatchesTicket(envelope!, 55)).toBe(true);
    expect(envelopeMatchesTicket(envelope!, 99)).toBe(false);
  });
});
