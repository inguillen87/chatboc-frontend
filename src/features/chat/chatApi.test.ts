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

import { sendChatBootstrapMessage } from './chatApi';

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
});
