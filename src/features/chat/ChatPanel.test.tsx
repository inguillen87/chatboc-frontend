import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ChatPanel from './ChatPanel';

const { sendChatBootstrapMessageMock, submitWidgetAssistedOrderMock } = vi.hoisted(() => ({
  sendChatBootstrapMessageMock: vi.fn(),
  submitWidgetAssistedOrderMock: vi.fn(),
}));

vi.mock('./chatApi', async () => {
  const actual = await vi.importActual<typeof import('./chatApi')>('./chatApi');
  return {
    ...actual,
    sendChatBootstrapMessage: sendChatBootstrapMessageMock,
    submitWidgetAssistedOrder: submitWidgetAssistedOrderMock,
  };
});

vi.mock('@/hooks/useAudioRecorder', () => ({
  default: () => ({
    isRecording: false,
    startRecording: vi.fn(),
    stopRecording: vi.fn(),
  }),
}));

describe('ChatPanel widget assisted orders', () => {
  beforeEach(() => {
    sendChatBootstrapMessageMock.mockReset();
    submitWidgetAssistedOrderMock.mockReset();
  });

  it('uses the assisted widget intake for order-like messages before falling back to runtime chat', async () => {
    submitWidgetAssistedOrderMock.mockResolvedValue({
      lead_id: 77,
      order: { nro_pedido: '77', detalles: [] },
      raw: {
        pedido_id: 77,
        customer_message: 'Recibimos tu nota de pedido desde el widget.',
      },
    });

    const onRuntimeResult = vi.fn();
    render(
      <ChatPanel
        context={{
          tipoChat: 'pyme',
          sector: 'empresas',
          tenantSlug: 'ferreteria-demo',
          chatBootstrap: {
            contract_version: 'demo.chat_bootstrap.v1',
            endpoint: '/api/ask/pyme',
            method: 'POST',
            headers: { 'X-Tenant-Slug': 'ferreteria-demo' },
            payload: { tipo_chat: 'pyme', tenant_slug: 'ferreteria-demo' },
            session: { chat_session_id: 'sid_widget_order' },
          },
        }}
        onRuntimeResult={onRuntimeResult}
      />,
    );

    fireEvent.change(screen.getByLabelText('Mensaje'), {
      target: { value: 'Necesito comprar 2 chapas galvanizadas' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => {
      expect(submitWidgetAssistedOrderMock).toHaveBeenCalledTimes(1);
    });

    expect(submitWidgetAssistedOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/api/ask/pyme' }),
      expect.objectContaining({
        text: 'Necesito comprar 2 chapas galvanizadas',
        contactNotes: 'Necesito comprar 2 chapas galvanizadas',
      }),
      'ferreteria-demo',
      expect.objectContaining({ text: 'Necesito comprar 2 chapas galvanizadas' }),
    );
    expect(sendChatBootstrapMessageMock).not.toHaveBeenCalled();
    expect(await screen.findByText('Recibimos tu nota de pedido desde el widget.')).toBeInTheDocument();
    expect(onRuntimeResult).toHaveBeenCalledWith(
      expect.objectContaining({ pedido_id: 77 }),
      expect.objectContaining({ lead_id: 77 }),
    );
  });

  it('shows a safe retry message when the demo runtime fails', async () => {
    sendChatBootstrapMessageMock.mockRejectedValue(new Error('Error 404: Not found'));

    render(
      <ChatPanel
        context={{
          tipoChat: 'pyme',
          sector: 'educacion',
          tenantSlug: 'colegio-demo',
          chatBootstrap: {
            contract_version: 'demo.chat_bootstrap.v1',
            endpoint: '/api/ask/pyme',
            method: 'POST',
            payload: {
              tipo_chat: 'pyme',
              tenant_slug: 'colegio-demo',
              demo_mode: true,
            },
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText('Mensaje'), {
      target: { value: 'Necesito justificar una inasistencia' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(
      await screen.findByText(
        'No pudimos enviar la consulta a la demo real. Intenta nuevamente en unos segundos.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Error 404/i)).not.toBeInTheDocument();
  });
});
