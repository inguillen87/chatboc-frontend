import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiFetchMock, panelPostMock } = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  panelPostMock: vi.fn(),
}));

vi.mock('@/api/v2/client', () => ({
  panelApi: {
    post: panelPostMock,
  },
}));

vi.mock('@/utils/leadCapture', () => ({
  createLeadCaptureIdempotencyKey: vi.fn(() => 'lead_capture_key'),
}));

vi.mock('@/utils/api', () => {
  class ApiError extends Error {
    status: number;
    body: unknown;
    requestId?: string;

    constructor(message: string, status: number, body: unknown = null, requestId?: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.body = body;
      this.requestId = requestId;
    }
  }

  return {
    ApiError,
    apiFetch: apiFetchMock,
  };
});

import {
  extractChatBootstrapReplyText,
  normalizeLeadCaptureResponse,
  sendChatBootstrapMessage,
  submitWidgetAssistedOrder,
  submitLeadCapture,
} from './chatApi';
import { MUNICIPAL_CHAT_IDEMPOTENCY_KEY_PATTERN } from '@/utils/municipalChatIdempotency';

describe('extractChatBootstrapReplyText', () => {
  it('reads modern agent message fields before falling back to generic keys', () => {
    expect(extractChatBootstrapReplyText({ message_body: 'Respuesta operativa' })).toBe('Respuesta operativa');
    expect(extractChatBootstrapReplyText({ agent: { message_body: 'Respuesta del agente' } })).toBe('Respuesta del agente');
    expect(extractChatBootstrapReplyText({ output: { assistant_message: 'Respuesta final' } })).toBe('Respuesta final');
  });
});

describe('sendChatBootstrapMessage', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    panelPostMock.mockReset();
    apiFetchMock.mockResolvedValue({ respuesta_usuario: 'ok' });
  });

  it('normalizes backend root /ask endpoints to the public /api/ask alias', async () => {
    await sendChatBootstrapMessage(
      {
        contract_version: 'demo.chat_bootstrap.v1',
        endpoint: '/ask/municipio',
        method: 'POST',
        headers: { 'X-Chat-Session-Id': 'demo-session', 'X-Tenant-Slug': 'municipio' },
        query: { tenant_slug: 'municipio' },
        payload: { tipo_chat: 'municipio', tenant_slug: 'municipio', demo_mode: true },
      },
      { text: 'Hola' },
    );

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/ask/municipio?tenant_slug=municipio&tenant=municipio',
      expect.objectContaining({
        method: 'POST',
        baseUrlOverride: undefined,
        omitTenant: true,
        omitChatSessionId: true,
        isWidgetRequest: true,
        skipAuth: true,
      }),
    );
    const [, options] = apiFetchMock.mock.calls[0];
    expect(options.headers['Idempotency-Key']).toMatch(
      MUNICIPAL_CHAT_IDEMPOTENCY_KEY_PATTERN,
    );
  });

  it('keeps /api/ask aliases and injects demo headers from chat_bootstrap', async () => {
    await sendChatBootstrapMessage(
      {
        contract_version: 'demo.chat_bootstrap.v1',
        endpoint: '/api/ask/municipio',
        method: 'POST',
        headers: {},
        query: { tenant_slug: 'municipio' },
        payload: {
          pregunta: '',
          tipo_chat: 'municipio',
          tenant_slug: 'municipio',
          demo_session_id: 'demo-session-1',
          demo_mode: true,
        },
      },
      { text: 'Quiero iniciar un reclamo' },
    );

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/ask/municipio?tenant_slug=municipio&tenant=municipio',
      expect.objectContaining({
        method: 'POST',
        baseUrlOverride: undefined,
        omitTenant: true,
        omitChatSessionId: true,
        isWidgetRequest: true,
        skipAuth: true,
        headers: expect.objectContaining({
          'X-Demo-Session-Id': 'demo-session-1',
          'X-Demo-Session': 'demo-session-1',
          'X-Tenant-Slug': 'municipio',
        }),
      }),
    );
  });

  it('does not reuse a long demo JWT as the chat session id', async () => {
    const demoJwt = 'header.payload.signature.with.more.characters.than.allowed.for.chat.session';

    await sendChatBootstrapMessage(
      {
        contract_version: 'demo.chat_bootstrap.v1',
        endpoint: '/api/ask/municipio',
        method: 'POST',
        headers: { 'X-Chat-Session-Id': demoJwt },
        query: { tenant_slug: 'municipio' },
        payload: {
          tipo_chat: 'municipio',
          tenant_slug: 'municipio',
          demo_session_id: demoJwt,
          chat_session_id: demoJwt,
          demo_mode: true,
        },
      },
      { text: 'Quiero iniciar un reclamo' },
    );

    const [, options] = apiFetchMock.mock.calls[0];
    const [endpoint] = apiFetchMock.mock.calls[0];
    expect(endpoint).not.toContain('chat_session_id=');
    expect(options.headers).toEqual(
      expect.objectContaining({
        'X-Demo-Session-Id': demoJwt,
        'X-Demo-Session': demoJwt,
        'X-Tenant-Slug': 'municipio',
      }),
    );
    expect(options.headers).not.toHaveProperty('X-Chat-Session-Id');
    expect(options.body).not.toHaveProperty('chat_session_id');
  });

  it('prefers the same-origin endpoint published by chat_bootstrap', async () => {
    await sendChatBootstrapMessage(
      {
        contract_version: 'demo.chat_bootstrap.v1',
        endpoint: '/ask/municipio',
        same_origin_endpoint: '/api/ask/municipio',
        method: 'POST',
        headers: { 'X-Tenant-Slug': 'municipio' },
        query: { tenant_slug: 'municipio' },
        session: {
          chat_session_id: 'short-session-id',
          demo_session_id: 'demo-token',
        },
      },
      { text: 'Hola' },
    );

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/ask/municipio?tenant_slug=municipio&tenant=municipio',
      expect.objectContaining({
        method: 'POST',
        baseUrlOverride: undefined,
        headers: expect.objectContaining({
          'X-Chat-Session-Id': 'short-session-id',
          'X-Demo-Session-Id': 'demo-token',
          'X-Tenant-Slug': 'municipio',
        }),
      }),
    );
  });

  it('keeps backend sid chat sessions separate from the demo token', async () => {
    const chatSessionId = 'sid_0123456789abcdef0123456789abcdef0123456789abcdef';
    const demoSessionId = 'header.payload.signature';

    await sendChatBootstrapMessage(
      {
        contract_version: 'demo.chat_bootstrap.v1',
        endpoint: '/api/ask/municipio',
        method: 'POST',
        headers: { 'X-Tenant-Slug': 'municipio' },
        query: { tenant_slug: 'municipio' },
        session: {
          chat_session_id: chatSessionId,
          demo_session_id: demoSessionId,
        },
      },
      { text: 'Quiero iniciar un reclamo' },
    );

    const [, options] = apiFetchMock.mock.calls[0];
    expect(options.headers).toEqual(
      expect.objectContaining({
        'X-Chat-Session-Id': chatSessionId,
        'X-Demo-Session-Id': demoSessionId,
        'X-Tenant-Slug': 'municipio',
      }),
    );
    expect(options.body).toEqual(
      expect.objectContaining({
        chat_session_id: chatSessionId,
        demo_session_id: demoSessionId,
      }),
    );
  });

  it('sends education action ids and anon headers through the published chat_bootstrap', async () => {
    await sendChatBootstrapMessage(
      {
        contract_version: 'demo.chat_bootstrap.v1',
        endpoint: '/api/ask/pyme',
        method: 'POST',
        headers: { 'X-Tenant-Slug': 'qa-colegio-sandbox' },
        payload: {
          tipo_chat: 'pyme',
          tenant_slug: 'qa-colegio-sandbox',
          demo_mode: true,
          anon_id: 'anon-education-1',
        },
        session: {
          chat_session_id: 'sid_school_case',
          demo_session_id: 'demo-school-token',
        },
      },
      {
        text: '',
        intent: 'create_school_case',
        action_id: 'create_school_case',
        extraPayload: {
          action_id: 'create_school_case',
          education_context: { is_education: true },
        },
      },
    );

    const [, options] = apiFetchMock.mock.calls[0];
    expect(options.headers).toEqual(
      expect.objectContaining({
        'X-Chat-Session-Id': 'sid_school_case',
        'X-Demo-Session-Id': 'demo-school-token',
        'X-Tenant-Slug': 'qa-colegio-sandbox',
        'X-Anon-Id': 'anon-education-1',
      }),
    );
    expect(options.body).toEqual(
      expect.objectContaining({
        pregunta: '',
        tipo_chat: 'pyme',
        tenant_slug: 'qa-colegio-sandbox',
        demo_mode: true,
        action_id: 'create_school_case',
        education_context: { is_education: true },
      }),
    );
  });

  it('creates widget assisted orders with tenant, session and anon identity', async () => {
    apiFetchMock.mockResolvedValueOnce({
      contract_version: 'marketplace.assisted_request.v1',
      pedido_id: 42,
      lead_id: 42,
      customer_message: 'Recibimos tu nota de pedido.',
      source: {
        channel: 'widget',
        chat_session_id: 'sid_widget_order',
        anon_id: 'anon-widget-1',
      },
      items: [{ nombre: 'Chapa galvanizada', cantidad: 2 }],
    });

    const file = new File(['pedido'], 'pedido.txt', { type: 'text/plain' });
    const result = await submitWidgetAssistedOrder(
      {
        contract_version: 'demo.chat_bootstrap.v1',
        endpoint: '/api/ask/pyme',
        method: 'POST',
        headers: { 'X-Tenant-Slug': 'ferreteria-demo' },
        payload: {
          tipo_chat: 'pyme',
          tenant_slug: 'ferreteria-demo',
          anon_id: 'anon-widget-1',
        },
        session: {
          chat_session_id: 'sid_widget_order',
        },
      },
      {
        text: '2 chapas galvanizadas',
        attachmentFile: file,
        contactNotes: 'Pedido escrito desde widget',
      },
      'ferreteria-demo',
      { text: '2 chapas galvanizadas', intent: 'crear_pedido' },
    );

    const [endpoint, options] = apiFetchMock.mock.calls[0];
    expect(endpoint).toBe('/api/pedidos/from-file?origen=widget');
    expect(options.headers).toEqual(
      expect.objectContaining({
        'X-Checkout-Origin': 'widget',
        'X-Chat-Session-Id': 'sid_widget_order',
        'X-Tenant-Slug': 'ferreteria-demo',
        'X-Anon-Id': 'anon-widget-1',
      }),
    );
    expect(options.skipAuth).toBe(true);
    expect(options.isWidgetRequest).toBe(true);
    expect(options.sendAnonId).toBe(true);
    expect(options.omitChatSessionId).toBe(true);
    expect(options.tenantSlug).toBe('ferreteria-demo');

    const body = options.body as FormData;
    expect(body.get('document_type')).toBe('order_note');
    expect(body.get('pedido_text')).toBe('2 chapas galvanizadas');
    expect(body.get('tenant_slug')).toBe('ferreteria-demo');
    expect(body.get('chat_session_id')).toBe('sid_widget_order');
    expect(body.get('contact_notes')).toBe('Pedido escrito desde widget');
    expect((body.get('archivo') as File).name).toBe('pedido.txt');

    expect(result?.lead_id).toBe(42);
    expect(result?.order?.nro_pedido).toBe('42');
  });

  it('sends shared location with lng for demo municipio runtime', async () => {
    await sendChatBootstrapMessage(
      {
        contract_version: 'demo.chat_bootstrap.v1',
        endpoint: '/api/ask/municipio',
        method: 'POST',
        headers: { 'X-Tenant-Slug': 'municipio' },
        query: { tenant_slug: 'municipio' },
        session: {
          chat_session_id: 'sid_demo_municipio',
          demo_session_id: 'demo-token',
        },
      },
      {
        text: 'Te comparto ubicacion del bache',
        location: {
          lat: -34.61,
          lon: -58.44,
          address: 'Av. San Martin 123',
        },
      },
    );

    const [, options] = apiFetchMock.mock.calls[0];
    expect(options.body.location).toEqual({
      lat: -34.61,
      lng: -58.44,
      address: 'Av. San Martin 123',
    });
  });

  it('uses the caller municipal idempotency key instead of a stale bootstrap header', async () => {
    const idempotencyKey = '667f4278-beb8-4655-9515-e680a24aef45';

    await sendChatBootstrapMessage(
      {
        contract_version: 'demo.chat_bootstrap.v1',
        endpoint: '/api/ask/municipio',
        method: 'POST',
        headers: {
          'X-Tenant-Slug': 'municipio',
          'idempotency-key': 'stale-bootstrap-key',
        },
        payload: { tipo_chat: 'municipio', tenant_slug: 'municipio' },
      },
      {
        text: 'Confirmar reclamo',
        intent: 'confirmar_reclamo',
        idempotencyKey,
        extraPayload: { idempotency_key: idempotencyKey },
      },
    );

    const [, options] = apiFetchMock.mock.calls[0];
    expect(options.headers['Idempotency-Key']).toBe(idempotencyKey);
    expect(options.headers).not.toHaveProperty('idempotency-key');
    expect(options.body.idempotency_key).toBe(idempotencyKey);
  });

  it('propagates the same municipal idempotency header for audio multipart requests', async () => {
    const idempotencyKey = 'audio-municipio-request-0001';

    await sendChatBootstrapMessage(
      {
        contract_version: 'demo.chat_bootstrap.v1',
        endpoint: '/api/ask/municipio',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-Slug': 'municipio',
        },
        payload: { tipo_chat: 'municipio', tenant_slug: 'municipio' },
      },
      {
        text: 'Adjunto audio del reclamo',
        audioBlob: new Blob(['audio'], { type: 'audio/webm' }),
        audioFilename: 'reclamo.webm',
        idempotencyKey,
      },
    );

    const [, options] = apiFetchMock.mock.calls[0];
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers['Idempotency-Key']).toBe(idempotencyKey);
    expect(options.headers).not.toHaveProperty('Content-Type');
    expect(options.headers).not.toHaveProperty('content-type');
  });

  it('strips idempotency headers from PYME bootstrap requests', async () => {
    await sendChatBootstrapMessage(
      {
        contract_version: 'demo.chat_bootstrap.v1',
        endpoint: '/api/ask/pyme',
        method: 'POST',
        headers: {
          'X-Tenant-Slug': 'ferreteria-demo',
          'Idempotency-Key': 'stale-pyme-key',
        },
        payload: { tipo_chat: 'pyme', tenant_slug: 'ferreteria-demo' },
      },
      {
        text: 'Necesito un presupuesto',
        idempotencyKey: '667f4278-beb8-4655-9515-e680a24aef45',
      },
    );

    const [, options] = apiFetchMock.mock.calls[0];
    expect(options.headers).not.toHaveProperty('Idempotency-Key');
    expect(options.headers).not.toHaveProperty('idempotency-key');
  });

  it('does not retry legacy fallback endpoints when runtime rejects the request', async () => {
    apiFetchMock.mockRejectedValueOnce(new Error('missing'));

    await expect(
      sendChatBootstrapMessage(
        {
          contract_version: 'demo.chat_bootstrap.v1',
          endpoint: '/api/ask/municipio',
          fallback_endpoint: '/public/ask/municipio',
          method: 'POST',
          query: { tenant_slug: 'municipio' },
        },
        { text: 'Hola' },
      ),
    ).rejects.toThrow('missing');

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock.mock.calls[0][0]).toBe('/api/ask/municipio?tenant_slug=municipio&tenant=municipio');
  });
});

describe('normalizeLeadCaptureResponse operational results', () => {
  it('does not classify survey menu resources as a created claim', () => {
    const normalized = normalizeLeadCaptureResponse({
      success: true,
      contract_version: 'chat.response.v1',
      fuente: 'demo_encuestas_menu_v1',
      accion_backend: 'demo_encuestas_menu',
      created_entity: null,
      ticket: null,
      adjuntos: [{ id: 'survey-share', url: 'https://example.test/e/prioridades' }],
      lead: { created: false, lead_id: null, ticket_id: null },
      data: {
        chat_id: 'demo-chat',
        sector: 'gobierno',
        tenant_slug: 'junin',
        surveys_votings: { items: [{ public_url: 'https://example.test/e/prioridades' }] },
      },
    });

    expect(normalized.ticket).toBeNull();
  });

  it('keeps real municipal ticket evidence and location fields', () => {
    const normalized = normalizeLeadCaptureResponse({
      ok: true,
      request_id: 'req-ticket',
      ticket: {
        nro_ticket: 'M-31735',
        categoria: 'Semaforo',
        direccion: 'Av. San Martin y Rivadavia',
        latitud: '-34.6083',
        longitud: '-58.3712',
        nombre_vecino: 'QA Vecino',
        telefono_vecino: '2610000000',
        canal_ingreso: 'whatsapp',
        foto_url_directa: 'https://cdn.example.com/foto.jpg',
        archivos: [{ archivo_adjunto_id: 7, url: 'https://cdn.example.com/foto.jpg', type: 'image/jpeg' }],
      },
      media_understanding: {
        received: ['image', 'location'],
        supports: ['text', 'image', 'audio', 'location'],
      },
    });

    expect(normalized.ticket).toMatchObject({
      nro_ticket: 'M-31735',
      categoria: 'Semaforo',
      direccion: 'Av. San Martin y Rivadavia',
      latitud: -34.6083,
      longitud: -58.3712,
      canal_ingreso: 'whatsapp',
      foto_url_directa: 'https://cdn.example.com/foto.jpg',
      archivos_count: 1,
    });
    expect(normalized.ticket?.archivos?.[0]).toMatchObject({
      archivo_adjunto_id: 7,
      url: 'https://cdn.example.com/foto.jpg',
    });
    expect(normalized.media_understanding?.received).toEqual(['image', 'location']);
  });

  it('keeps real PyME order lines, total and tracking URL', () => {
    const normalized = normalizeLeadCaptureResponse({
      ok: true,
      pedido: {
        nro_pedido: 'P-1001',
        nombre_cliente: 'QA Bodega',
        telefono_cliente: '2611111111',
        monto_total: 35000,
        detalles: [
          { nombre_producto: 'MALBEC', cantidad: 2, precio_unitario_original: 10000, subtotal_con_descuento: 20000, moneda: 'ARS' },
          { nombre_producto: 'CABERNET SAUVIGNON', cantidad: 1, precio_unitario_original: 15000, subtotal_con_descuento: 15000, moneda: 'ARS' },
        ],
      },
    });

    expect(normalized.order).toMatchObject({
      nro_pedido: 'P-1001',
      nombre_cliente: 'QA Bodega',
      telefono_cliente: '2611111111',
      monto_total: 35000,
      tracking_url: '/tracking/order/P-1001',
    });
    expect(normalized.order?.detalles).toHaveLength(2);
    expect(normalized.order?.detalles?.[0]).toMatchObject({
      nombre_producto: 'MALBEC',
      cantidad: 2,
    });
  });

  it('keeps compact education live handoff data as an operational school case', () => {
    const normalized = normalizeLeadCaptureResponse({
      success: true,
      request_id: 'req-school-live',
      fuente: 'education_widget_live_handoff',
      data: {
        ticket_id: 123,
        chat_id: 'P-123456',
        status: 'esperando_agente_en_vivo',
        live_chat: {},
        school_case: {},
      },
    });

    expect(normalized.ticket_id).toBe(123);
    expect(normalized.status).toBe('esperando_agente_en_vivo');
    expect(normalized.ticket).toMatchObject({
      ticket_id: '123',
      chat_id: 'P-123456',
      status: 'esperando_agente_en_vivo',
    });
  });
});

describe('submitLeadCapture', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    panelPostMock.mockReset();
    apiFetchMock.mockResolvedValue({ ok: true });
  });

  it('can submit demo leads without persisting the demo tenant as the browser tenant', async () => {
    await submitLeadCapture(
      { endpoint: '/api/public/lead-capture' },
      {
        demo_session_id: 'demo-token',
        chat_session_id: 'sid_demo',
        channel: 'web',
      },
      'municipio',
      { idempotencyKey: 'demo-lead-key', persistTenantSlug: false },
    );

    expect(apiFetchMock).toHaveBeenCalledWith(
      '/api/public/lead-capture',
      expect.objectContaining({
        tenantSlug: 'municipio',
        persistTenantSlug: false,
        skipAuth: true,
        isWidgetRequest: true,
      }),
    );
  });
});
