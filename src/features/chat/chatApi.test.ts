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

import { normalizeLeadCaptureResponse, sendChatBootstrapMessage } from './chatApi';

describe('sendChatBootstrapMessage', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    panelPostMock.mockReset();
    apiFetchMock.mockResolvedValue({ respuesta_usuario: 'ok' });
  });

  it('uses the same-origin backend root for /ask endpoints from chat_bootstrap', async () => {
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
      '/ask/municipio?tenant_slug=municipio',
      expect.objectContaining({
        method: 'POST',
        baseUrlOverride: window.location.origin,
        omitTenant: true,
        omitChatSessionId: true,
        isWidgetRequest: true,
        skipAuth: true,
      }),
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
      '/api/ask/municipio?tenant_slug=municipio',
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
      '/api/ask/municipio?tenant_slug=municipio',
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
    expect(apiFetchMock.mock.calls[0][0]).toBe('/api/ask/municipio?tenant_slug=municipio');
  });
});

describe('normalizeLeadCaptureResponse operational results', () => {
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
});
