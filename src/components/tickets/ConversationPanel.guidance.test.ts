import { describe, expect, it } from 'vitest';

import {
  applyPublicRecipientReadConfirmation,
  formatReplyDeliveryChannel,
  getConversationScrollBehavior,
  getComposerActionDeliveryView,
  getComposerChannelView,
  getApprovedWhatsAppTemplates,
  getPublishedReplyBlockReason,
  getReplyDeliveryStage,
  getReplyDeliveryView,
  getWhatsAppServiceWindowView,
  hasPublicRecipientPresence,
  isReplyDeliveryInvalidation,
  preserveReplyDeliveryProgress,
  renderApprovedWhatsAppTemplate,
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
  it.each([
    ['asignacion', /lo estamos asignando|ya.*asignad/i],
    ['riesgo', /estamos priorizando|prioridad confirmada/i],
    ['cierre', /lo reabrimos|reapertura confirmada/i],
  ])('does not promise an unperformed action for %s guidance', (tag, unsupportedClaim) => {
    const draft = buildOperationalReplyDraft(baseTicket, {
      label: 'Siguiente paso sugerido', source: 'ui', tags: [tag as string],
    });

    expect(draft).toContain('M-378430');
    expect(draft).not.toMatch(unsupportedClaim as RegExp);
  });

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
        tone: 'muted',
        label: 'Canal de origen: WhatsApp',
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
        label: 'Presencia ciudadana confirmada',
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
        label: 'Canal web sin presencia confirmada',
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

  it('does not turn external dispatch into confirmed WhatsApp delivery', () => {
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
    expect(view.tone).toBe('warning');
    expect(view.title).toBe('Estado de entrega por confirmar');
    expect(view.title).not.toMatch(/enviado/i);
  });

  it('uses reply_contract.v1 to explain CRM-only delivery without blocking a reply', () => {
    const view = getComposerChannelView({
      channel: 'whatsapp',
      recipientPresenceConfirmed: false,
      replyContract: {
        contract_version: 'inbox.reply_contract.v1',
        source_model: 'MunicipioTicket',
        ticket_id: '419',
        endpoint: '/api/v2/inbox/omnichannel/actions',
        method: 'POST',
        enabled: true,
        supported_message_types: { text: { enabled: true } },
        delivery_channels: [
          { id: 'crm', enabled: true },
          { id: 'whatsapp', enabled: false, reason_code: 'contact_phone_missing' },
        ],
      },
    });

    expect(view).toMatchObject({
      tone: 'warning',
      label: 'Sólo registro en CRM',
    });
    expect(view.detail).toMatch(/teléfono verificable/i);
  });

  it('fails closed on unknown reply contract versions and source mismatches', () => {
    expect(getPublishedReplyBlockReason({
      contract_version: 'inbox.reply_contract.v1',
      ticket_id: '419',
      endpoint: '/api/v2/inbox/omnichannel/actions',
      method: 'POST',
      enabled: true,
      supported_message_types: { text: { enabled: true } },
    }, 'MunicipioTicket', '419')).toMatch(/no coincide/i);

    expect(getPublishedReplyBlockReason({
      contract_version: 'inbox.reply_contract.v2',
      source_model: 'MunicipioTicket',
      enabled: true,
    }, 'MunicipioTicket')).toMatch(/versión de contrato/i);

    expect(getPublishedReplyBlockReason({
      contract_version: 'inbox.reply_contract.v1',
      source_model: 'TenantTicket',
      endpoint: '/api/v2/inbox/omnichannel/actions',
      method: 'POST',
      enabled: true,
      supported_message_types: { text: { enabled: true } },
    }, 'MunicipioTicket')).toMatch(/no coincide/i);

    expect(getPublishedReplyBlockReason({
      contract_version: 'inbox.reply_contract.v1',
      source_model: 'MunicipioTicket',
      ticket_id: '419',
      endpoint: '/api/v2/inbox/omnichannel/actions',
      method: 'POST',
      enabled: true,
      supported_message_types: { text: { enabled: true } },
    }, 'MunicipioTicket', '419')).toBeNull();

    expect(getPublishedReplyBlockReason({
      contract_version: 'inbox.reply_contract.v1',
      source_model: 'TenantTicket',
      endpoint: '/api/v2/inbox/omnichannel/77/actions',
      method: 'POST',
      enabled: true,
      supported_message_types: { text: { enabled: true } },
    }, 'TenantTicket', '77')).toMatch(/no coincide/i);
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

    expect(replyView.title).toBe('En cola para entregar');
    expect(replyView.detail).toContain('cola durable');
    expect(actionView).toMatchObject({
      tone: 'queued',
      title: 'En cola para WhatsApp',
    });
  });

  it('prioritizes reply delivery evidence and never equates provider acceptance with delivery', () => {
    const accepted = getComposerActionDeliveryView({
      contract_version: 'inbox.action_delivery.v2',
      evidence: {
        contract_version: 'inbox.reply_delivery_evidence.v1',
        saved_in_crm: true,
        dispatch_attempted: true,
        provider_accepted: true,
        delivered: false,
        failed: false,
        delivered_requires: 'provider_status_callback',
      },
    });
    const failed = getComposerActionDeliveryView({
      contract_version: 'inbox.action_delivery.v2',
      final_delivery: {
        status: 'delivered',
        authoritative_source: 'provider_status_callback',
      },
      evidence: {
        contract_version: 'inbox.reply_delivery_evidence.v1',
        saved_in_crm: true,
        dispatch_attempted: true,
        provider_accepted: true,
        delivered: false,
        failed: true,
        delivered_requires: 'provider_status_callback',
      },
    });

    expect(accepted).toMatchObject({ tone: 'pending', title: 'Aceptado por el proveedor' });
    expect(accepted.detail).toMatch(/no prueba la entrega/i);
    expect(failed).toMatchObject({ tone: 'warning', title: 'Entrega no realizada' });
  });

  it('labels CRM-only artifacts truthfully and recognizes idempotent replay', () => {
    const saved = getComposerActionDeliveryView({
      mode: 'crm_only', status: 'saved_to_crm', saved_in_crm: true,
      external_dispatch: false, dispatch_attempted: false, provider_accepted: false,
      delivered: false, failed: false, receipt_persisted: true,
    });
    const replay = getComposerActionDeliveryView({
      mode: 'crm_only', status: 'already_recorded', saved_in_crm: true,
      external_dispatch: false, dispatch_attempted: false, provider_accepted: false,
      delivered: false, failed: false, receipt_persisted: true, idempotent_replay: true,
    });
    expect(saved).toMatchObject({ tone: 'internal', title: 'Guardado sólo en CRM' });
    expect(saved.detail).toBe('Guardado en CRM, no enviado externamente.');
    expect(replay).toMatchObject({ tone: 'replay', title: 'Reintento reconocido' });
  });

  it('fails closed when CRM-only evidence claims an external dispatch', () => {
    expect(getComposerActionDeliveryView({
      mode: 'crm_only', saved_in_crm: true, receipt_persisted: true,
      external_dispatch: false, dispatch_attempted: true, provider_accepted: false,
      delivered: false, failed: false,
    })).toMatchObject({ tone: 'warning', title: 'Evidencia CRM-only inconsistente' });
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

    expect(emittedView.title).toBe('Guardado en CRM');
    expect(emittedView.tone).toBe('muted');
    expect(deliveredView.title).toBe('Entregado en chat en vivo');
    expect(deliveredView.tone).toBe('success');
    expect(readView.title).toBe('Leído');
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
    expect(view.title).toBe('Estado de entrega por confirmar');
    expect(view.detail).toContain('fallo la entrega externa');
  });

  it('does not regress delivery evidence during a stale detail refetch', () => {
    const queued = deliveryStatus({ event_id: 91, mode: 'durable_queue', channel: 'whatsapp', status: 'durably_staged', evidence_stage: 'durably_staged', external_dispatch: true });
    const accepted = deliveryStatus({
      ...queued,
      status: 'provider_accepted',
      evidence_stage: 'provider_accepted',
      final_delivery: { status: 'provider_accepted', authoritative_source: 'domain_effect_outbox' },
    });
    const staleSaved = deliveryStatus({ event_id: 91, channel: 'whatsapp', status: 'saved', reason: 'detail_reply_delivery' });

    expect(preserveReplyDeliveryProgress(queued, staleSaved)).toBe(queued);
    expect(preserveReplyDeliveryProgress(accepted, queued)).toBe(accepted);
  });

  it('advances provider acceptance to delivered and read only from provider callback', () => {
    const accepted = deliveryStatus({
      event_id: 91,
      mode: 'real_message',
      channel: 'whatsapp',
      status: 'provider_accepted',
      external_dispatch: true,
      final_delivery: { status: 'provider_accepted', authoritative_source: 'domain_effect_outbox' },
    });
    const delivered = deliveryStatus({
      ...accepted,
      final_delivery: { status: 'delivered', authoritative_source: 'provider_status_callback' },
    });
    const read = deliveryStatus({
      ...delivered,
      final_delivery: { status: 'read', authoritative_source: 'provider_status_callback' },
    });

    expect(getReplyDeliveryStage(accepted)).toBe('provider_accepted');
    expect(getReplyDeliveryStage(delivered)).toBe('delivered');
    expect(getReplyDeliveryStage(read)).toBe('read');
  });

  it('distinguishes the 24-hour window, recipient absence and approved templates', () => {
    const contract = {
      whatsapp: {
        recipient_available: true,
        service_window: { status: 'expired' },
        free_form_allowed: false,
        template_required: true,
        approved_templates: [{ id: 31, name: 'Seguimiento', body_preview: 'Reclamo {{1}}: {{2}}.' }],
      },
    };
    const templates = getApprovedWhatsAppTemplates(contract);
    expect(getWhatsAppServiceWindowView(contract)).toMatchObject({ blocksFreeForm: true, approvedTemplateCount: 1, title: 'Se requiere una plantilla aprobada' });
    expect(renderApprovedWhatsAppTemplate(templates[0], { 1: 'M-419', 2: 'cuadrilla asignada' })).toBe('Reclamo M-419: cuadrilla asignada.');
    expect(getWhatsAppServiceWindowView({ whatsapp: { ...contract.whatsapp, recipient_available: false } })).toMatchObject({ recipientAvailable: false, title: 'Sin número de WhatsApp' });
  });

  it('accepts only the PII-free delivery invalidation contract', () => {
    expect(isReplyDeliveryInvalidation({ contract_version: 'tenant_ticket.reply_delivery.realtime.v1', resource: 'reply_deliveries', reason: 'delivery_status_changed', refetch: true })).toBe(true);
    expect(isReplyDeliveryInvalidation({ contract_version: 'tenant_ticket.reply_delivery.realtime.v1', resource: 'reply_deliveries', reason: 'other', refetch: true })).toBe(false);
  });
});
