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

  it('renders the public claim tracking CTA without offering the admin panel', async () => {
    sendChatBootstrapMessageMock.mockResolvedValue({
      message_body: 'Listo: cree el reclamo demo. Ticket #123456, PIN 654321.',
      fuente: 'demo_municipio_runtime',
      accion_backend: 'demo_crear_reclamo',
      ticket_id: 42,
      ticket: {
        id: 42,
        consulta_pin: '654321',
        status: 'nuevo',
        category: 'Baches y calzada',
        detail_endpoint: '/api/v2/inbox/omnichannel/42',
        public_status_hint: { ticket: '123456', pin: '654321' },
      },
      lead: {
        created: true,
        ticket_id: 42,
        detail_endpoint: '/api/v2/inbox/omnichannel/42',
      },
      next_actions: [
        {
          id: 'track_claim',
          label: 'Ver seguimiento',
          endpoint: '/tracking/claim/123456#pin=654321',
          method: 'GET',
          ui_hint: 'link',
        },
      ],
    });

    render(
      <ChatPanel
        context={{
          tipoChat: 'municipio',
          sector: 'gobierno',
          tenantSlug: 'muni-demo',
          chatBootstrap: {
            contract_version: 'demo.chat_bootstrap.v1',
            endpoint: '/api/ask/municipio',
            method: 'POST',
            payload: {
              tipo_chat: 'municipio',
              tenant_slug: 'muni-demo',
              demo_mode: true,
            },
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText('Mensaje'), {
      target: { value: 'Hay un bache peligroso frente a la plaza' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    const trackingLink = await screen.findByRole('link', { name: /Ver seguimiento/i });
    expect(trackingLink).toHaveAttribute('href', '/tracking/claim/123456#pin=654321');
    expect(trackingLink.getAttribute('href')).not.toContain('/api/v2/inbox/omnichannel');
    expect(screen.getByText('123456', { exact: true })).toBeVisible();
    expect(screen.queryByText('42', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('Ver en panel')).not.toBeInTheDocument();
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

describe('ChatPanel structured CTA routing', () => {
  const chatBootstrap = {
    contract_version: 'demo.chat_bootstrap.v1',
    endpoint: '/api/ask/municipio',
    method: 'POST',
    payload: {
      tipo_chat: 'municipio',
      tenant_slug: 'junin',
      demo_mode: true,
    },
  };

  const leadCapture = {
    enabled: true,
    title: 'Datos para seguimiento',
    fields: [{ name: 'email', label: 'Correo electronico', type: 'email', required: true }],
    trigger_intents: [
      'crear_reclamo',
      'consultar_estado_reclamo',
      'derivar_humano',
      'capturar_lead_comercial',
    ],
  };

  beforeEach(() => {
    sendChatBootstrapMessageMock.mockReset();
    submitWidgetAssistedOrderMock.mockReset();
    sendChatBootstrapMessageMock.mockResolvedValue({ message_body: 'Accion recibida por el runtime.' });
  });

  it.each([
    ['Crear reclamo', 'crear_reclamo'],
    ['Consultar estado', 'consultar_estado_reclamo'],
    ['Hablar con una persona', 'derivar_humano'],
  ])('sends the operational CTA %s to the runtime before any contact capture', async (label, intent) => {
    render(
      <ChatPanel
        context={{
          tipoChat: 'municipio',
          sector: 'gobierno',
          tenantSlug: 'junin',
          chatBootstrap,
        }}
        leadCapture={leadCapture}
        conversionCtas={{
          actions: [{ id: intent, label, intent }],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: label }));

    await waitFor(() => expect(sendChatBootstrapMessageMock).toHaveBeenCalledTimes(1));
    expect(sendChatBootstrapMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/api/ask/municipio' }),
      expect.objectContaining({ text: label, intent, action_id: intent }),
      'junin',
    );
    expect(screen.queryByLabelText('Correo electronico')).not.toBeInTheDocument();
  });

  it('keeps an explicit lead CTA on the contact capture flow', () => {
    render(
      <ChatPanel
        context={{
          tipoChat: 'municipio',
          sector: 'gobierno',
          tenantSlug: 'junin',
          chatBootstrap,
        }}
        leadCapture={leadCapture}
        conversionCtas={{
          actions: [
            {
              id: 'capturar_lead_comercial',
              label: 'Solicitar una demo',
              intent: 'capturar_lead_comercial',
            },
          ],
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Solicitar una demo' }));

    expect(screen.getByLabelText('Correo electronico')).toBeInTheDocument();
    expect(sendChatBootstrapMessageMock).not.toHaveBeenCalled();
  });

  it('renders survey contracts as compact cards without raw URLs or duplicated actions', async () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
      slug: `consulta-${index + 1}`,
      titulo: `Consulta ciudadana ${index + 1}`,
      descripcion: `Tema territorial ${index + 1}`,
      tipo: index === 0 ? 'votacion' : 'encuesta',
      public_url: `https://preview.chatboc.ar/e/consulta-${index + 1}`,
      whatsapp_share_url: `https://wa.me/?text=consulta-${index + 1}`,
      demo_mode: true,
      seed: { responses: 100, real_people: false },
    }));
    sendChatBootstrapMessageMock.mockResolvedValueOnce({
      fuente: 'demo_encuestas_menu_v1',
      accion_backend: 'demo_encuestas_menu',
      message_body: items
        .map((item) => `*${item.titulo}*\nAbrir: ${item.public_url}\nCompartir por WhatsApp: ${item.whatsapp_share_url}`)
        .join('\n'),
      options_list: [
        ...items.flatMap((item) => [
          { texto: `Abrir ${item.titulo}`, url: item.public_url, type: 'url' },
          { texto: `Compartir ${item.titulo}`, url: item.whatsapp_share_url, type: 'url' },
        ]),
        { texto: 'Ver más', action_id: 'mostrar_menu_encuestas::2' },
        { texto: 'Volver', action_id: 'volver_menu_municipio' },
      ],
      data: {
        surveys_votings: {
          contract_version: 'demo.surveys_votings.v1',
          label: 'Encuestas y votaciones',
          description: 'Consultas vigentes para la demostración.',
          total_available: 6,
          items,
        },
      },
    });

    render(
      <ChatPanel
        context={{
          tipoChat: 'municipio',
          sector: 'gobierno',
          tenantSlug: 'junin',
          chatBootstrap,
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText('Mensaje'), { target: { value: 'Encuestas y votaciones' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('region', { name: 'Encuestas y votaciones disponibles' })).toBeInTheDocument();
    expect(screen.queryByText(/Abrir: https:\/\/preview\.chatboc\.ar/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Abrir Consulta ciudadana/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Compartir Consulta ciudadana/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar sugerencia: Ver más' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar sugerencia: Volver' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Enviar sugerencia:/ })).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Enviar sugerencia: Ver más' }));
    await waitFor(() => expect(sendChatBootstrapMessageMock).toHaveBeenCalledTimes(2));
    expect(sendChatBootstrapMessageMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ endpoint: '/api/ask/municipio' }),
      expect.objectContaining({ action_id: 'mostrar_menu_encuestas::2' }),
      'junin',
    );
  });
});
