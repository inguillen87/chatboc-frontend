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
  getInboxTicketById,
  getTenantTicketAiEnrichment,
  getTickets,
  getTicketById,
  getTicketByNumber,
  getTicketTimeline,
  isTicketAiEnrichmentUnavailable,
  normalizeTicketReplyDelivery,
  sendMessage,
  updateTicketStatus,
} from '@/services/ticketService';
import { ApiError } from '@/utils/api';

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

  it('routes only explicitly internal TenantTicket notes to the v2 comments contract', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'tickets.v2.comment',
      ok: true,
      comment: {
        id: 1,
        body: 'Estamos revisando tu reclamo.',
        visibility: 'internal',
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
        visibility: 'internal',
      },
    );

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith('/api/v2/tickets/378430/comments', {
      method: 'POST',
      body: {
        body: 'Estamos revisando tu reclamo.',
        visibility: 'internal',
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

  it('never treats TenantTicket comments as a fallback for an external reply', async () => {
    await expect(sendMessage(
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
          channel: 'whatsapp',
          source_model: 'TenantTicket',
          comments_endpoint: '/api/v2/tickets/378430/comments',
        } as any,
      },
    )).rejects.toMatchObject({
      status: 409,
      data: { code: 'tenant_ticket_external_reply_requires_v2_action' },
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
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

  it('resolves an inbox deep-link target through the canonical v2 detail endpoint', async () => {
    apiFetchMock.mockResolvedValueOnce({
      tickets: [
        {
          id: 99,
          tipo: 'municipio',
          nro_ticket: 'M-99',
          asunto: 'Objetivo focal',
          estado: 'nuevo',
          fecha: '2026-07-11T10:00:00.000Z',
          source_model: 'TenantTicket',
          ticket_type: 'tenant_ticket',
          detail_endpoint: '/api/v2/tickets/99',
        },
      ],
      pagination: {
        page: 1,
        per_page: 50,
        total_items: 1,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    });
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'tickets.v2.detail',
      source_model: 'TenantTicket',
      ticket_type: 'tenant_ticket',
      ticket: {
        id: 99,
        tipo: 'municipio',
        nro_ticket: 'M-99',
        asunto: 'Objetivo focal',
        estado: 'nuevo',
        fecha: '2026-07-11T10:00:00.000Z',
        messages: [{ id: 1, body: 'Mensaje', actor_type: 'citizen' }],
      },
    });

    const ticket = await getInboxTicketById(99, {
      tenantSlug: 'junin',
    });

    expect(ticket.id).toBe(99);
    expect(apiFetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/tickets?page=1&per_page=50&include=compact&q=99',
      '/api/v2/tickets/99',
    ]);
  });

  it.each([
    {
      sourceModel: 'TenantTicket' as const,
      endpoint: '/api/v2/tickets/99',
      response: {
        contract_version: 'tickets.v2.detail',
        source_model: 'TenantTicket',
        ticket: {
          id: 99,
          tipo: 'municipio',
          nro_ticket: 'T-99',
          estado: 'nuevo',
          fecha: '2026-07-11T10:00:00.000Z',
          messages: [{ id: 1, body: 'Detalle tenant', actor_type: 'citizen' }],
        },
      },
    },
    {
      sourceModel: 'MunicipioTicket' as const,
      endpoint: '/api/tickets/municipio/99',
      response: {
        id: 99,
        tipo: 'municipio',
        nro_ticket: 'M-99',
        asunto: 'Detalle municipal',
        estado: 'nuevo',
        fecha: '2026-07-11T10:00:00.000Z',
        mensajes: [{ id: 2, mensaje: 'Detalle municipal', es_admin: false }],
      },
    },
    {
      sourceModel: 'PymeTicket' as const,
      endpoint: '/api/tickets/pyme/99',
      response: {
        id: 99,
        tipo: 'pyme',
        nro_ticket: 'P-99',
        asunto: 'Detalle empresa',
        estado: 'nuevo',
        fecha: '2026-07-11T10:00:00.000Z',
        mensajes: [{ id: 3, mensaje: 'Detalle empresa', es_admin: false }],
      },
    },
  ])('resuelve $sourceModel por su endpoint exacto sin escanear IDs colisionados', async ({
    sourceModel,
    endpoint,
    response,
  }) => {
    apiFetchMock.mockResolvedValueOnce(response);

    const ticket = await getInboxTicketById(99, {
      tenantSlug: 'junin',
      sourceModel,
    });

    expect(ticket).toMatchObject({ id: 99, source_model: sourceModel });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock).toHaveBeenCalledWith(endpoint, { tenantSlug: 'junin' });
  });

  it.each([
    {
      ticketId: '0000419',
      sourceModel: 'TenantTicket' as const,
      endpoint: '/api/v2/tickets/0000419',
      response: {
        contract_version: 'tickets.v2.detail',
        source_model: 'TenantTicket',
        ticket: {
          id: '0000419',
          ticket_id: '0000419',
          tipo: 'municipio',
          nro_ticket: 'T-0000419',
          estado: 'nuevo',
          fecha: '2026-08-30T10:00:00.000Z',
          messages: [{ id: 1, body: 'Detalle exacto', actor_type: 'citizen' }],
        },
      },
    },
    {
      ticketId: '9007199254740993123',
      sourceModel: 'MunicipioTicket' as const,
      endpoint: '/api/tickets/municipio/9007199254740993123',
      response: {
        id: '9007199254740993123',
        ticket_id: '9007199254740993123',
        tipo: 'municipio',
        nro_ticket: 'M-9007199254740993123',
        asunto: 'Identidad fuera del rango seguro de JavaScript',
        estado: 'nuevo',
        fecha: '2026-08-30T10:00:00.000Z',
        mensajes: [{ id: 2, mensaje: 'Detalle exacto', es_admin: false }],
      },
    },
    {
      ticketId: 'case:2026/08/30-A',
      sourceModel: 'PymeTicket' as const,
      endpoint: '/api/tickets/pyme/case%3A2026%2F08%2F30-A',
      response: {
        id: 'case:2026/08/30-A',
        ticket_id: 'case:2026/08/30-A',
        tipo: 'pyme',
        nro_ticket: 'P-CASE-A',
        asunto: 'Identidad opaca con separadores',
        estado: 'nuevo',
        fecha: '2026-08-30T10:00:00.000Z',
        mensajes: [{ id: 3, mensaje: 'Detalle exacto', es_admin: false }],
      },
    },
  ])(
    'conserva el ID opaco $ticketId y el tenant al resolver $sourceModel',
    async ({ ticketId, sourceModel, endpoint, response }) => {
      apiFetchMock.mockResolvedValueOnce(response);

      const ticket = await getInboxTicketById(ticketId, {
        tenantSlug: 'junin',
        sourceModel,
      });

      expect(String(ticket.id)).toBe(ticketId);
      expect(ticket.source_model).toBe(sourceModel);
      expect(apiFetchMock).toHaveBeenCalledTimes(1);
      expect(apiFetchMock).toHaveBeenCalledWith(endpoint, { tenantSlug: 'junin' });
    },
  );

  it('rechaza un source_model ajeno al contrato antes de consultar la API', async () => {
    await expect(getInboxTicketById(99, {
      tenantSlug: 'junin',
      sourceModel: 'Order' as any,
    })).rejects.toMatchObject({ status: 400 });
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('paginates the scoped inbox until it finds the exact legacy target', async () => {
    apiFetchMock.mockResolvedValueOnce({
      tickets: [
        {
          id: 1,
          tipo: 'pyme',
          nro_ticket: 'P-1',
          asunto: 'Otro ticket',
          estado: 'nuevo',
          fecha: '2026-07-11T09:00:00.000Z',
        },
      ],
      pagination: {
        page: 1,
        per_page: 50,
        total_items: 2,
        total_pages: 2,
        has_next: true,
        has_prev: false,
      },
    });
    apiFetchMock.mockResolvedValueOnce({
      tickets: [
        {
          id: 99,
          tipo: 'pyme',
          nro_ticket: 'P-99',
          asunto: 'Objetivo legacy',
          estado: 'nuevo',
          fecha: '2026-07-11T10:00:00.000Z',
        },
      ],
      pagination: {
        page: 2,
        per_page: 50,
        total_items: 2,
        total_pages: 2,
        has_next: false,
        has_prev: true,
      },
    });
    apiFetchMock.mockResolvedValueOnce({
      id: 99,
      tipo: 'pyme',
      nro_ticket: 'P-99',
      asunto: 'Objetivo legacy',
      estado: 'nuevo',
      fecha: '2026-07-11T10:00:00.000Z',
      mensajes: [{ id: 2, mensaje: 'Mensaje legacy', es_admin: false }],
    });

    const ticket = await getInboxTicketById(99, {
      tenantSlug: 'bodega',
    });

    expect(ticket.tipo).toBe('pyme');
    expect(apiFetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/tickets?page=1&per_page=50&include=compact&q=99',
      '/api/tickets?page=2&per_page=50&include=compact&q=99',
      '/api/tickets/pyme/99',
    ]);
  });

  it('does not continue to another detail contract after an inbox authorization error', async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError('Prohibido', 403));

    await expect(
      getInboxTicketById(99, { tenantSlug: 'junin' }),
    ).rejects.toMatchObject({ status: 403 });
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock.mock.calls[0][0]).toBe('/api/tickets?page=1&per_page=50&include=compact&q=99');
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

  it('preserves backend inbox facets for global filter options', async () => {
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
      facets: {
        contract_version: 'tickets.facets.v1',
        total_scoped: 2,
        channels: [
          { value: 'whatsapp', label: 'WhatsApp', count: 1 },
          { value: 'web', label: 'Web', count: 1 },
        ],
      },
    });

    const result = await getTickets('junin', { page: 1, perPage: 25 });

    expect(result.facets).toMatchObject({
      contract_version: 'tickets.facets.v1',
      total_scoped: 2,
      channels: [
        { value: 'whatsapp', label: 'WhatsApp', count: 1 },
        { value: 'web', label: 'Web', count: 1 },
      ],
    });
  });

  it('normalizes the authoritative legacy assignee so assigned tickets cannot be claimed again', async () => {
    apiFetchMock.mockResolvedValueOnce({
      tickets: [
        {
          id: 419,
          tipo: 'municipio',
          source_model: 'MunicipioTicket',
          nro_ticket: 'M-419',
          asunto: 'Demo reclamo - Alumbrado público',
          estado: 'en_proceso',
          fecha: '2026-08-29T12:00:00.000Z',
          asignado_a: {
            id: 10,
            nombre: 'Marcelo',
            email: 'operador@junin.example',
          },
        },
      ],
      pagination: {
        page: 1,
        per_page: 12,
        total_items: 1,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    });

    const result = await getTickets('junin');

    expect(result.tickets[0]).toMatchObject({
      assignedAgentId: 10,
      assigned_agent_id: 10,
      assigned_user_id: 10,
      assignedAgent: {
        id: 10,
        nombre_usuario: 'Marcelo',
        email: 'operador@junin.example',
      },
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

  it('sends the bounded history cursor and preserves pagination metadata', async () => {
    apiFetchMock.mockResolvedValueOnce({
      estado_chat: 'activo',
      timeline: [],
      historial_chat: [
        {
          id: 25,
          comentario: 'Mensaje histórico 25',
          fecha: '2026-08-20T11:25:00.000Z',
          es_admin: false,
        },
      ],
      unified_conversation_stream: [],
      pagination: {
        contract_version: 'conversation.history.cursor.v1',
        direction: 'older',
        order: 'chronological_asc',
        limit: 25,
        returned_count: 25,
        has_more: true,
        next_cursor: 'cursor-page-2',
      },
    });

    const result = await getTicketTimeline(77, 'municipio', {
      ticket: {
        id: 77,
        source_model: 'TenantTicket',
        tenant_slug: 'junin',
      } as any,
      tenantSlug: 'junin',
      cursor: 'cursor-page-1',
      limit: 25,
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/v2/tickets/77/timeline?limit=25&cursor=cursor-page-1',
      { tenantSlug: 'junin' },
    );
    expect(result.messages).toEqual([
      expect.objectContaining({ id: 25, content: 'Mensaje histórico 25' }),
    ]);
    expect(result.pagination).toMatchObject({
      contract_version: 'conversation.history.cursor.v1',
      limit: 25,
      returned_count: 25,
      has_more: true,
      next_cursor: 'cursor-page-2',
    });
    expect(result.has_more).toBe(true);
    expect(result.next_cursor).toBe('cursor-page-2');
  });

  it('classifies advisory AI enrichment gateway and network failures as unavailable', () => {
    const gatewayError = new Error('Bad Gateway') as Error & { status?: number };
    gatewayError.status = 502;

    expect(isTicketAiEnrichmentUnavailable(gatewayError)).toBe(true);
    expect(isTicketAiEnrichmentUnavailable(new TypeError('Failed to fetch'))).toBe(true);
    expect(isTicketAiEnrichmentUnavailable(new Error('validation failed'))).toBe(false);
  });

  it('updates a tenant ticket through v2 with optimistic concurrency and returns published transitions', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'tickets.v2.detail',
      ticket: {
        id: 77,
        status: 'en_vivo',
        next_states: ['en_proceso', 'cerrado'],
        workflow: {
          contract_version: 'ticket.workflow.instance.v2',
          current_state: 'en_vivo',
          canonical_state: 'en_vivo',
          next_states: ['en_proceso', 'cerrado'],
          can_transition: true,
          final_state: false,
        },
      },
    });

    const updated = await updateTicketStatus(77, 'municipio', 'en_vivo', {
      ticket: {
        id: 77,
        tipo: 'municipio',
        estado: 'en_proceso',
        source_model: 'TenantTicket',
        detail_endpoint: '/api/v2/tickets/77',
      },
      expectedStatus: 'en_proceso',
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/v2/tickets/77', {
      method: 'PATCH',
      body: { status: 'en_vivo', expected_status: 'en_proceso' },
    });
    expect(updated).toMatchObject({
      id: 77,
      estado: 'en_vivo',
      next_states: ['en_proceso', 'cerrado'],
    });
  });

  it('keeps the legacy endpoint compatible while sending the expected state', async () => {
    apiFetchMock.mockResolvedValueOnce({
      id: 41,
      tipo: 'municipio',
      nro_ticket: 'M-41',
      asunto: 'Alumbrado',
      estado: 'en_proceso',
      fecha: '2026-08-29T12:00:00Z',
      next_states: ['en_vivo', 'resuelto'],
    });

    await updateTicketStatus(41, 'municipio', 'en_proceso', {
      expectedStatus: 'nuevo',
    });

    expect(apiFetchMock).toHaveBeenCalledWith('/api/tickets/municipio/41/estado', {
      method: 'PUT',
      body: { estado: 'en_proceso', expected_estado: 'nuevo' },
    });
  });
});
