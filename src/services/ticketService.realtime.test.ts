import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  isLikelyHtmlErrorBody: (value: unknown) => String(value ?? '').toLowerCase().includes('<html'),
  ApiError: class ApiError extends Error {
    status?: number;
    data?: unknown;
    constructor(message: string, status?: number, data?: unknown) {
      super(message);
      this.status = status;
      this.data = data;
    }
  },
}));

vi.mock('@/utils/anonIdGenerator', () => ({
  default: () => 'anon-test',
}));

import {
  getAssignableAgents,
  getTenantTicketAiEnrichment,
  getTickets,
  getTicketById,
  getTicketByNumber,
  isTicketAiEnrichmentUnavailable,
  normalizeTicketReplyDelivery,
  sendMessage,
} from '@/services/ticketService';

describe('ticketService realtime normalization', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('keeps derived presence state and idle counts in ticket realtime summaries', async () => {
    apiFetchMock.mockResolvedValueOnce({
      id: 77,
      tipo: 'municipio',
      nro_ticket: 'REC-77',
      asunto: 'Reclamo',
      estado: 'abierto',
      fecha: '2026-03-21T10:00:00.000Z',
      email: 'demo@example.com',
      mensajes: [{ id: 1, mensaje: 'Hola', es_admin: 0, timestamp: '2026-03-21T10:01:00.000Z' }],
      realtime_state: {
        viewers: [
          {
            viewer_id: 'agente-1',
            viewer_label: 'Agente 1',
            presence_status: 'active',
            effective_presence_status: 'idle',
          },
        ],
        summary: {
          active_count: 1,
          idle_count: 1,
          read_count: 0,
        },
      },
      collaboration_state: {
        idle_viewer_count: 1,
        idle_window_minutes: 5,
      },
    });

    const ticket = await getTicketByNumber('REC-77', '1234');

    expect(ticket.realtime_state?.viewers[0]).toMatchObject({
      viewer_id: 'agente-1',
      effective_presence_status: 'idle',
    });
    expect(ticket.realtime_state?.summary).toMatchObject({
      active_count: 1,
      idle_count: 1,
      read_count: 0,
    });
    expect(ticket.collaboration_state).toMatchObject({
      idle_viewer_count: 1,
      idle_window_minutes: 5,
    });
  });

  it('normalizes nested backend realtime state from ticket summaries', async () => {
    apiFetchMock.mockResolvedValueOnce({
      id: 78,
      tipo: 'municipio',
      nro_ticket: 'REC-78',
      asunto: 'Reclamo',
      estado: 'abierto',
      fecha: '2026-03-21T10:00:00.000Z',
      email: 'demo@example.com',
      mensajes: [{ id: 335, mensaje: 'Hola', es_admin: 0, timestamp: '2026-03-21T10:01:00.000Z' }],
      realtime_state: {
        presence: {
          active_count: 1,
          idle_count: 0,
          active_viewers: [
            {
              viewer_key: 'pin:900144',
              viewer_role: 'public_pin',
              presence_status: 'active',
              effective_presence_status: 'active',
              unread_count: 0,
            },
          ],
        },
        read_state: {
          latest_comment_id: 335,
          viewers: [
            {
              viewer_key: 'pin:900144',
              viewer_role: 'public_pin',
              last_read_comment_id: 335,
              unread_count: 0,
              has_unread: false,
            },
          ],
        },
      },
    });

    const ticket = await getTicketByNumber('REC-78', '900144');

    expect(ticket.realtime_state?.active_viewers).toHaveLength(1);
    expect(ticket.realtime_state?.active_viewers[0]).toMatchObject({
      viewer_id: 'pin:900144',
      unread_count: 0,
      has_unread: false,
    });
    expect(ticket.realtime_state?.read_states[0]).toMatchObject({
      last_read_comment_id: 335,
    });
    expect(ticket.realtime_state?.summary).toMatchObject({
      active_count: 1,
      idle_count: 0,
      last_read_comment_id: 335,
    });
  });

  it('uses public ticket comentarios as visible conversation messages', async () => {
    apiFetchMock.mockResolvedValueOnce({
      id: 400,
      tipo: 'municipio',
      nro_ticket: 'M-378430',
      asunto: 'Arreglo de calle',
      estado: 'en_proceso',
      fecha: '2026-06-06T03:03:47.626Z',
      email: 'demo@example.com',
      comentarios: [
        {
          id: 334,
          texto: 'hola que tal como va mi reclamo? puedo hablar con alguien en vivo ?',
          autor_nombre: 'Marcelo',
          es_admin: false,
          fecha: '2026-06-06T03:04:47.245Z',
        },
        {
          id: 335,
          comentario: 'como no hay mensajes si el vecino envio mensajes! ',
          autor_nombre: 'Atención Junín',
          es_admin: true,
          fecha: '2026-06-06T03:11:29.168Z',
        },
      ],
    });

    const ticket = await getTicketByNumber('M-378430', '900144');

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(ticket.messages).toHaveLength(2);
    expect(ticket.messages?.[0]).toMatchObject({
      id: 334,
      author: 'user',
      content: 'hola que tal como va mi reclamo? puedo hablar con alguien en vivo ?',
    });
    expect(ticket.messages?.[1]).toMatchObject({
      id: 335,
      author: 'agent',
      agentName: 'Atención Junín',
      content: 'como no hay mensajes si el vecino envio mensajes! ',
    });
  });

  it('does not synthesize fake contact avatars when the backend has no profile image', async () => {
    apiFetchMock.mockResolvedValueOnce({
      id: 501,
      tipo: 'municipio',
      nro_ticket: 'M-501',
      asunto: 'Reclamo',
      estado: 'nuevo',
      fecha: '2026-06-06T03:03:47.626Z',
      email: 'vecino@example.com',
      mensajes: [{ id: 1, mensaje: 'Consulta inicial', es_admin: false, timestamp: '2026-06-06T03:04:47.626Z' }],
    });

    const ticketWithoutAvatar = await getTicketByNumber('M-501', '900144');

    expect(ticketWithoutAvatar.avatarUrl).toBeUndefined();

    apiFetchMock.mockResolvedValueOnce({
      id: 502,
      tipo: 'municipio',
      nro_ticket: 'M-502',
      asunto: 'Reclamo',
      estado: 'nuevo',
      fecha: '2026-06-06T03:03:47.626Z',
      profile_picture_url: 'https://cdn.example.com/profile/marcelo.jpg',
      avatar_source: 'social',
      avatar_consent: true,
      mensajes: [{ id: 2, mensaje: 'Consulta inicial', es_admin: false, timestamp: '2026-06-06T03:04:47.626Z' }],
    });

    const ticketWithConsentedAvatar = await getTicketByNumber('M-502', '900144');

    expect(ticketWithConsentedAvatar.avatarUrl).toBe('https://cdn.example.com/profile/marcelo.jpg');
    expect(ticketWithConsentedAvatar.avatar_source).toBe('social');
    expect(ticketWithConsentedAvatar.avatar_consent).toBe(true);
  });

  it('ignores profile image urls without consent metadata', async () => {
    apiFetchMock.mockResolvedValueOnce({
      id: 503,
      tipo: 'municipio',
      nro_ticket: 'M-503',
      asunto: 'Reclamo',
      estado: 'nuevo',
      fecha: '2026-06-06T03:03:47.626Z',
      profile_picture_url: 'https://cdn.example.com/profile/untrusted.jpg',
      mensajes: [{ id: 3, mensaje: 'Consulta inicial', es_admin: false, timestamp: '2026-06-06T03:04:47.626Z' }],
    });

    const ticketWithUntrustedAvatar = await getTicketByNumber('M-503', '900144');

    expect(ticketWithUntrustedAvatar.avatarUrl).toBeUndefined();
    expect(ticketWithUntrustedAvatar.avatar_consent).toBeUndefined();
  });

  it('uses consented avatar metadata from nested contact contracts', async () => {
    apiFetchMock.mockResolvedValueOnce({
      id: 504,
      tipo: 'municipio',
      nro_ticket: 'M-504',
      asunto: 'Reclamo',
      estado: 'nuevo',
      fecha: '2026-06-06T03:03:47.626Z',
      nombre_y_avatar_whatsapp: {
        nombre: 'Marcelo',
        avatar_url: 'https://cdn.example.com/profile/marcelo-consented.jpg',
        avatar_source: 'profile_upload',
        avatar_consent: true,
      },
      mensajes: [{ id: 4, mensaje: 'Consulta inicial', es_admin: false, timestamp: '2026-06-06T03:04:47.626Z' }],
    });

    const ticketWithNestedAvatar = await getTicketByNumber('M-504', '900144');

    expect(ticketWithNestedAvatar.avatarUrl).toBe('https://cdn.example.com/profile/marcelo-consented.jpg');
    expect(ticketWithNestedAvatar.avatar_source).toBe('profile_upload');
    expect(ticketWithNestedAvatar.avatar_consent).toBe(true);
  });

  it('normalizes assignable agent avatars through the consent policy', async () => {
    apiFetchMock.mockResolvedValueOnce({
      employees: [
        {
          id: 10,
          nombre: 'Operador sin consentimiento',
          email: 'sin-consentimiento@junin.gob.ar',
          avatar_url: 'https://cdn.example.com/profile/raw-agent.webp',
          avatar_source: 'mock_avatar',
        },
        {
          id: 11,
          nombre: 'Operador autorizado',
          email: 'autorizado@junin.gob.ar',
          avatar_url: 'https://cdn.example.com/profile/agent.webp',
          avatar_source: 'agent_profile',
          avatar_consent: true,
        },
      ],
    });

    const agents = await getAssignableAgents('municipio');

    expect(agents).toHaveLength(2);
    expect(agents[0].avatarUrl).toBeUndefined();
    expect(agents[0].avatar_consent).toBeUndefined();
    expect(agents[1].avatarUrl).toBe('https://cdn.example.com/profile/agent.webp');
    expect(agents[1].avatar_source).toBe('agent_profile');
    expect(agents[1].avatar_consent).toBe(true);
  });

  it('routes public PyME replies to the cliente endpoint with anonymous widget access', async () => {
    apiFetchMock.mockResolvedValueOnce({
      success: true,
      mensaje_id: 77,
    });

    await sendMessage(123, 'pyme', 'Hola, quiero hablar con ventas', undefined, undefined, {
      public: true,
      pin: '900144',
    });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, options] = apiFetchMock.mock.calls[0];
    expect(endpoint).toContain('/api/tickets/chat/pyme/123/responder_cliente');
    expect(endpoint).toContain('pin=900144');
    expect(endpoint).toContain('consulta_pin=900144');
    expect(endpoint).toContain('anon_id=anon-test');
    expect(options).toMatchObject({
      method: 'POST',
      body: { comentario: 'Hola, quiero hablar con ventas' },
      skipAuth: true,
      omitCredentials: true,
      isWidgetRequest: true,
      sendAnonId: true,
      sendEntityToken: true,
      pin: '900144',
    });
  });

  it('routes authenticated TenantTicket v2 text replies to the v2 public comments contract', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'tickets.v2.comment',
      ok: true,
      comment: {
        id: 1,
        body: 'Estamos revisando tu reclamo.',
        visibility: 'public',
        created_at: '2026-07-04T12:00:00.000Z',
      },
    });

    const response = await sendMessage(
      378430,
      'municipio',
      'Estamos revisando tu reclamo.',
      undefined,
      undefined,
      {
        tenantSlug: 'junin',
        ticket: {
          id: 378430,
          tipo: 'municipio',
          tenant_slug: 'junin',
          source_model: 'TenantTicket',
          comments_endpoint: '/api/v2/tickets/378430/comments',
        } as any,
      },
    );

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/v2/tickets/378430/comments', {
      method: 'POST',
      body: {
        body: 'Estamos revisando tu reclamo.',
        visibility: 'public',
      },
      tenantSlug: 'junin',
    });
    expect(response.comment).toMatchObject({
      body: 'Estamos revisando tu reclamo.',
      author_type: 'agent',
      actor_type: 'agent',
      es_admin: true,
    });
  });

  it('uses the PyME legacy detail endpoint when the selected ticket is PyME', async () => {
    apiFetchMock.mockResolvedValueOnce({
      id: 88,
      tipo: 'pyme',
      nro_ticket: 'P-88',
      asunto: 'Pedido mayorista',
      estado: 'nuevo',
      fecha: '2026-07-03T12:00:00.000Z',
      mensajes: [{ id: 9, mensaje: 'Necesito presupuesto', es_admin: false }],
    });

    const ticket = await getTicketById('88', {
      ticket: {
        id: 88,
        tipo: 'pyme',
        tenant_slug: 'bodega',
      } as any,
      tenantSlug: 'bodega',
    });

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/tickets/pyme/88', {
      tenantSlug: 'bodega',
    });
    expect(ticket.tipo).toBe('pyme');
    expect(ticket.messages?.[0]).toMatchObject({
      id: 9,
      content: 'Necesito presupuesto',
    });
  });

  it('sends authenticated quick replies with comentario for the backend responder contract', async () => {
    apiFetchMock.mockResolvedValueOnce({
      success: true,
      mensaje_id: 90,
    });

    await sendMessage(
      321,
      'municipio',
      'Te dejo opciones para avanzar',
      undefined,
      [{ type: 'reply', reply: { id: 'confirmar', title: 'Confirmar' } }],
    );

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, options] = apiFetchMock.mock.calls[0];
    expect(endpoint).toBe('/api/tickets/municipio/321/responder');
    expect(options).toMatchObject({
      method: 'POST',
      body: {
        comentario: 'Te dejo opciones para avanzar',
        buttons: [{ type: 'reply', reply: { id: 'confirmar', title: 'Confirmar' } }],
        interactive: {
          type: 'button',
          body: { text: 'Te dejo opciones para avanzar' },
          action: {
            buttons: [{ type: 'reply', reply: { id: 'confirmar', title: 'Confirmar' } }],
          },
        },
      },
    });
  });

  it('passes inbox filters as backend query parameters', async () => {
    apiFetchMock.mockResolvedValueOnce({
      tickets: [],
      pagination: {
        page: 1,
        per_page: 25,
        total_items: 0,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    });

    await getTickets('junin', {
      page: 1,
      perPage: 25,
      q: 'Don Bosco',
      status: 'cerrado',
      category: 'Arreglo de calle',
      channel: 'whatsapp',
      agent: 42,
      priority: 'alta',
      sla: 'risk',
      unread: 'unread',
    });

    const [endpoint, options] = apiFetchMock.mock.calls[0];
    expect(endpoint).toContain('/api/tickets?');
    expect(endpoint).toContain('page=1');
    expect(endpoint).toContain('per_page=25');
    expect(endpoint).toContain('include=compact');
    expect(endpoint).toContain('q=Don+Bosco');
    expect(endpoint).toContain('estado=cerrado');
    expect(endpoint).toContain('categoria=Arreglo+de+calle');
    expect(endpoint).toContain('channel=whatsapp');
    expect(endpoint).toContain('assigned_agent=42');
    expect(endpoint).toContain('priority=alta');
    expect(endpoint).toContain('sla=risk');
    expect(endpoint).toContain('unread=unread');
    expect(options).toMatchObject({
      tenantSlug: 'junin',
      omitTenant: false,
      suppressPanel401Redirect: true,
      omitCredentials: true,
      omitChatSessionId: true,
    });
  });

  it('passes unassigned inbox filters as backend query parameters', async () => {
    apiFetchMock.mockResolvedValueOnce({
      tickets: [],
      pagination: {
        page: 1,
        per_page: 25,
        total_items: 0,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    });

    await getTickets('junin', {
      page: 1,
      perPage: 25,
      unassigned: true,
    });

    const [endpoint] = apiFetchMock.mock.calls[0];
    expect(endpoint).toContain('/api/tickets?');
    expect(endpoint).toContain('unassigned=true');
  });

  it('normalizes admin reply delivery evidence for the visible CRM composer', () => {
    const delivery = normalizeTicketReplyDelivery({
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

    expect(delivery).toMatchObject({
      mode: 'real_message',
      channel: 'whatsapp',
      status: 'sent',
      external_dispatch: true,
      socket_emitted: true,
      reply_status: 'sent_to_contact',
      delivery_results: {
        email: false,
        sms: false,
        whatsapp: true,
        socket: true,
      },
    });
  });

  it('requests tenant AI enrichment as an advisory silent fetch', async () => {
    apiFetchMock.mockResolvedValueOnce({ contract_version: 'ticket.ai_enrichment.v1' });

    await getTenantTicketAiEnrichment(378430, { scope: 'tenant' }, 'junin', {
      id: 378430,
      tenant_slug: 'junin',
      ai_enrichment_endpoint: '/api/v2/tickets/378430/ai-enrichment',
    } as any);

    expect(apiFetchMock).toHaveBeenCalledWith('/api/v2/tickets/378430/ai-enrichment', {
      method: 'POST',
      body: { scope: 'tenant' },
      tenantSlug: 'junin',
      suppressInvalidJsonWarning: true,
    });
  });

  it('classifies advisory AI enrichment gateway and network failures as unavailable', () => {
    const gatewayError = new Error('Bad Gateway') as Error & { status?: number };
    gatewayError.status = 502;

    expect(isTicketAiEnrichmentUnavailable(gatewayError)).toBe(true);
    expect(isTicketAiEnrichmentUnavailable(new TypeError('Failed to fetch'))).toBe(true);
    expect(isTicketAiEnrichmentUnavailable(new Error('validation failed'))).toBe(false);
  });
});
