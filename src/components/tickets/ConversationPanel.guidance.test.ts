import { describe, expect, it } from 'vitest';

import {
  formatReplyDeliveryChannel,
  getReplyDeliveryView,
  shouldShowOperationalTimelineInChat,
} from './ConversationPanel';
import { buildOperationalReplyDraft } from './ticketOperationalGuidance';
import type { Ticket } from '@/types/tickets';

const baseTicket: Ticket = {
  id: 378430,
  tipo: 'municipio',
  nro_ticket: 'M-378430',
  asunto: 'Arreglo de calle',
  estado: 'nuevo',
  fecha: '2026-06-06T00:03:00Z',
  categoria: 'Arreglo de calle',
};

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

describe('reply delivery evidence', () => {
  it('labels confirmed WhatsApp delivery as an external message', () => {
    const view = getReplyDeliveryView({
      contract_version: 'tickets.agent_reply_delivery.v1',
      mode: 'real_message',
      channel: 'whatsapp',
      status: 'sent',
      reason: 'external_dispatch_confirmed',
      external_dispatch: true,
      socket_emitted: true,
      timeline_updated: true,
      reply_status: 'sent_to_contact',
      delivery_results: {
        email: false,
        sms: false,
        whatsapp: true,
        socket: true,
      },
    });

    expect(formatReplyDeliveryChannel('whatsapp')).toBe('WhatsApp');
    expect(view.tone).toBe('success');
    expect(view.title).toBe('Mensaje enviado');
    expect(view.detail).toContain('WhatsApp');
  });

  it('distinguishes live chat socket delivery from timeline-only CRM saves', () => {
    const liveView = getReplyDeliveryView({
      contract_version: 'tickets.agent_reply_delivery.v1',
      mode: 'real_message',
      channel: 'live_socket',
      status: 'sent',
      reason: 'socket_dispatch_confirmed',
      external_dispatch: false,
      socket_emitted: true,
      timeline_updated: true,
      reply_status: 'sent_to_live_chat',
      delivery_results: {
        email: false,
        sms: false,
        whatsapp: false,
        socket: true,
      },
    });

    const crmView = getReplyDeliveryView({
      contract_version: 'tickets.agent_reply_delivery.v1',
      mode: 'timeline_only',
      channel: 'crm',
      status: 'saved_to_crm',
      reason: 'external_dispatch_no_channel_confirmed',
      external_dispatch: false,
      socket_emitted: false,
      timeline_updated: true,
      reply_status: 'saved_to_timeline',
      delivery_results: {
        email: false,
        sms: false,
        whatsapp: false,
        socket: false,
      },
      operator_message: 'Guardado en CRM sin canal externo confirmado.',
    });

    expect(liveView.title).toBe('Entregado en chat en vivo');
    expect(liveView.tone).toBe('success');
    expect(crmView.title).toBe('Guardado en CRM');
    expect(crmView.tone).toBe('muted');
  });

  it('warns operators when delivery failed after saving the CRM timeline', () => {
    const view = getReplyDeliveryView({
      contract_version: 'tickets.agent_reply_delivery.v1',
      mode: 'timeline_only',
      channel: 'crm',
      status: 'saved_to_crm',
      reason: 'notification_dispatch_failed',
      external_dispatch: false,
      socket_emitted: false,
      timeline_updated: true,
      reply_status: 'saved_to_timeline',
      delivery_results: {
        email: false,
        sms: false,
        whatsapp: false,
        socket: false,
      },
      operator_message: 'El mensaje quedo guardado, pero fallo la entrega externa.',
    });

    expect(view.tone).toBe('warning');
    expect(view.title).toBe('Guardado, entrega sin confirmar');
    expect(view.detail).toContain('fallo la entrega externa');
  });
});
