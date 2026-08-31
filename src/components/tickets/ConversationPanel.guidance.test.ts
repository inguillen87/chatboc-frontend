import { describe, expect, it } from 'vitest';

import {
  applyPublicRecipientReadConfirmation,
  formatReplyDeliveryChannel,
  getConversationScrollBehavior,
  getComposerActionDeliveryView,
  getComposerChannelView,
  getReplyDeliveryView,
  hasPublicRecipientPresence,
  shouldShowOperationalTimelineInChat,
} from './ConversationPanel';
import { buildOperationalReplyDraft } from './ticketOperationalGuidance';
import type { Ticket } from '@/types/tickets';
import {
  normalizeTicketReplyDelivery,
  type TicketReplyDeliveryStatus,
} from '@/services/ticketService';

const baseTicket: Ticket = {
  id: 378430,
  tipo: 'municipio',
  nro_ticket: 'M-378430',
  asunto: 'Arreglo de calle',
  estado: 'nuevo',
  fecha: '2026-06-06T00:03:00Z',
  categoria: 'Arreglo de calle',
};

const deliveryStatus = (
  overrides: Partial<TicketReplyDeliveryStatus> = {},
): TicketReplyDeliveryStatus => ({
  contract_version: 'tickets.agent_reply_delivery.v2',
  legacy_contract_version: 'tickets.agent_reply_delivery.v1',
  mode: 'timeline_only',
  channel: 'crm',
  status: 'queued',
  reason: 'recipient_presence_not_confirmed',
  external_dispatch: false,
  socket_emitted: false,
  recipient_room_emitted: false,
  recipient_presence_confirmed: false,
  recipient_read_confirmed: false,
  reply_comment_ids: [41],
  latest_reply_comment_id: 41,
  timeline_updated: true,
  reply_status: 'saved_to_timeline',
  delivery_results: {
    email: false,
    sms: false,
    whatsapp: false,
    socket: false,
  },
  ...overrides,
});

describe('buildOperationalReplyDraft', () => {
  it('asks for exact location when guidance requires it', () => {
    const draft = buildOperationalReplyDraft(baseTicket, {
      label: 'Solicitar ubicacion exacta',
      source: 'ui',
      tags: ['ubicacion'],
    });

    expect(draft).toContain('M-378430');
    expect(draft).toMatch(/confirmes la ubicacion exacta/i);
  });

  it('keeps unread conversations focused on a same-channel response', () => {
    const draft = buildOperationalReplyDraft(baseTicket, {
      label: 'Responder ultima consulta',
      source: 'ui',
      tags: ['respuesta pendiente'],
    });

    expect(draft).toMatch(/por este mismo chat/i);
  });

  it('uses a safe generic draft for regular follow-up', () => {
    const draft = buildOperationalReplyDraft(baseTicket, {
      label: 'Revisar conversacion',
      source: 'ui',
      tags: ['seguimiento'],
    });

    expect(draft).toMatch(/Registramos tu consulta/i);
    expect(draft).toMatch(/por Arreglo de calle/i);
  });
});

describe('shouldShowOperationalTimelineInChat', () => {
  it('keeps operational activity out of the desktop chat when details are visible', () => {
    expect(
      shouldShowOperationalTimelineInChat({
        eventCount: 3,
        isMobile: false,
        isDetailsVisible: true,
      }),
    ).toBe(false);
  });

  it('shows operational activity when the chat is the only visible pane', () => {
    expect(
      shouldShowOperationalTimelineInChat({
        eventCount: 3,
        isMobile: false,
        isDetailsVisible: false,
      }),
    ).toBe(true);
    expect(
      shouldShowOperationalTimelineInChat({
        eventCount: 3,
        isMobile: true,
        isDetailsVisible: true,
      }),
    ).toBe(true);
  });
});

describe('conversation motion accessibility', () => {
  it('uses instant scrolling when reduced motion is requested', () => {
    expect(getConversationScrollBehavior(true)).toBe('auto');
    expect(getConversationScrollBehavior(false)).toBe('smooth');
    expect(getConversationScrollBehavior(null)).toBe('smooth');
  });
});

describe('reply delivery evidence', () => {
  it('uses public presence instead of the admin socket to describe the web composer', () => {
    expect(
      getComposerChannelView({
        channel: 'whatsapp',
        recipientPresenceConfirmed: false,
      }),
    ).toEqual(
      expect.objectContaining({
        tone: 'success',
        label: 'Salida WhatsApp',
      }),
    );

    expect(
      getComposerChannelView({
        channel: 'web_demo_widget',
        recipientPresenceConfirmed: true,
      }),
    ).toEqual(
      expect.objectContaining({
        tone: 'success',
        label: 'Ciudadano activo en el ticket',
      }),
    );

    expect(
      getComposerChannelView({
        channel: 'web_demo_widget',
        recipientPresenceConfirmed: false,
      }),
    ).toEqual(
      expect.objectContaining({
        tone: 'muted',
        label: 'Entrega web por confirmar',
      }),
    );
  });

  it('does not count admin presence as recipient presence', () => {
    expect(hasPublicRecipientPresence(null)).toBe(false);
    expect(
      hasPublicRecipientPresence({
        viewers: [],
        read_states: [],
        active_viewers: [
          {
            viewer_key: 'user:10',
            viewer_role: 'admin',
            presence_status: 'active',
          },
        ],
      }),
    ).toBe(false);
    expect(
      hasPublicRecipientPresence({
        viewers: [],
        read_states: [],
        active_viewers: [
          {
            viewer_key: 'user:22',
            viewer_role: 'usuario',
            presence_status: 'active',
          },
        ],
      }),
    ).toBe(true);
  });

  it('prioritizes failed delivery evidence over the nominal channel', () => {
    const view = getComposerChannelView({
      channel: 'whatsapp',
      recipientPresenceConfirmed: true,
      lastReplyDelivery: deliveryStatus({
        mode: 'timeline_only',
        channel: 'crm',
        status: 'error',
        reason: 'notification_dispatch_failed',
      }),
    });

    expect(view.tone).toBe('warning');
    expect(view.label).toBe('Entrega externa a revisar');
  });

  it('labels confirmed WhatsApp delivery as an external message', () => {
    const view = getReplyDeliveryView(deliveryStatus({
      mode: 'real_message',
      channel: 'whatsapp',
      status: 'sent',
      reason: 'external_dispatch_confirmed',
      external_dispatch: true,
      socket_emitted: true,
      reply_status: 'sent_to_contact',
      delivery_results: {
        email: false,
        sms: false,
        whatsapp: true,
        socket: true,
      },
    }));

    expect(formatReplyDeliveryChannel('whatsapp')).toBe('WhatsApp');
    expect(view.tone).toBe('success');
    expect(view.title).toBe('Mensaje enviado');
    expect(view.detail).toContain('WhatsApp');
  });

  it('labels durable queue evidence without claiming provider delivery', () => {
    const replyView = getReplyDeliveryView(deliveryStatus({
      mode: 'durable_queue',
      channel: 'whatsapp',
      status: 'durably_staged',
      reason: 'domain_effects_durably_staged',
      reply_status: 'queued_for_delivery',
      operator_message: 'La respuesta quedó en cola durable.',
    }));
    const actionView = getComposerActionDeliveryView({
      mode: 'durable_queue',
      delivery_mode: 'durable_queue',
      channel: 'whatsapp',
      outbox: { durably_staged: true },
      final_delivery: {
        status: 'pending_provider_callback',
        authoritative_source: 'provider_status_callback',
      },
    });

    expect(replyView.title).toBe('En cola para WhatsApp');
    expect(replyView.detail).toContain('cola durable');
    expect(actionView).toMatchObject({
      tone: 'queued',
      title: 'En cola para WhatsApp',
    });
  });

  it('distinguishes socket emission, recipient presence and recipient read', () => {
    const emittedView = getReplyDeliveryView(deliveryStatus({
      socket_emitted: true,
      delivery_results: {
        email: false,
        sms: false,
        whatsapp: false,
        socket: true,
      },
      operator_message: 'Emitido por socket y guardado, sin presencia publica confirmada.',
    }));
    const deliveredView = getReplyDeliveryView(deliveryStatus({
      mode: 'real_message',
      channel: 'live_socket',
      status: 'sent',
      reason: 'recipient_presence_confirmed',
      socket_emitted: true,
      recipient_room_emitted: true,
      recipient_presence_confirmed: true,
      reply_status: 'sent_to_live_chat',
      delivery_results: {
        email: false,
        sms: false,
        whatsapp: false,
        socket: true,
      },
    }));
    const readView = getReplyDeliveryView(deliveryStatus({
      mode: 'real_message',
      channel: 'live_socket',
      status: 'sent',
      reason: 'recipient_read_confirmed',
      socket_emitted: true,
      recipient_room_emitted: true,
      recipient_presence_confirmed: true,
      recipient_read_confirmed: true,
      reply_status: 'sent_to_live_chat',
    }));

    const crmView = getReplyDeliveryView(deliveryStatus({
      operator_message: 'Guardado en CRM sin canal externo confirmado.',
    }));

    expect(emittedView.title).toBe('Emitido y guardado');
    expect(emittedView.tone).toBe('muted');
    expect(deliveredView.title).toBe('Entregado en chat en vivo');
    expect(deliveredView.tone).toBe('success');
    expect(readView.title).toBe('Leido por el ciudadano');
    expect(readView.tone).toBe('success');
    expect(crmView.title).toBe('Guardado en CRM');
    expect(crmView.tone).toBe('muted');
  });

  it('normalizes socket emission without inferring recipient presence or read', () => {
    const normalized = normalizeTicketReplyDelivery({
      contract_version: 'tickets.agent_reply_delivery.v2',
      status: 'queued',
      socket_emitted: true,
      recipient_room_emitted: true,
      recipient_presence_confirmed: 'false',
      recipient_read_confirmed: false,
      reply_comment_ids: ['40', 41],
      latest_reply_comment_id: '41',
      delivery_results: { socket: true },
    });

    expect(normalized).toMatchObject({
      socket_emitted: true,
      recipient_room_emitted: true,
      recipient_presence_confirmed: false,
      recipient_read_confirmed: false,
      reply_comment_ids: [40, 41],
      latest_reply_comment_id: 41,
      reply_status: 'saved_to_timeline',
    });
  });

  it('accepts only a public ACK that covers the latest reply comment', () => {
    const queued = deliveryStatus({
      socket_emitted: true,
      recipient_room_emitted: true,
    });
    const adminAck = applyPublicRecipientReadConfirmation(
      queued,
      { viewer_role: 'admin', viewer_key: 'user:10' },
      41,
    );
    const staleCitizenAck = applyPublicRecipientReadConfirmation(
      queued,
      { viewer_role: 'usuario', viewer_key: 'user:22' },
      40,
    );
    const currentCitizenAck = applyPublicRecipientReadConfirmation(
      queued,
      { viewer_role: 'usuario', viewer_key: 'user:22' },
      41,
    );

    expect(adminAck).toBe(queued);
    expect(staleCitizenAck).toBe(queued);
    expect(currentCitizenAck).toMatchObject({
      status: 'sent',
      reply_status: 'sent_to_live_chat',
      recipient_presence_confirmed: true,
      recipient_read_confirmed: true,
    });
  });

  it('warns operators when delivery failed after saving the CRM timeline', () => {
    const view = getReplyDeliveryView(deliveryStatus({
      reason: 'notification_dispatch_failed',
      operator_message: 'El mensaje quedo guardado, pero fallo la entrega externa.',
    }));

    expect(view.tone).toBe('warning');
    expect(view.title).toBe('Guardado, entrega sin confirmar');
    expect(view.detail).toContain('fallo la entrega externa');
  });
});
