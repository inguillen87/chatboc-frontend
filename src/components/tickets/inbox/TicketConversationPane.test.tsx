import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/utils/api';

const getInboxDetailMock = vi.fn();
const postInboxActionMock = vi.fn();
const createClientMessageIdMock = vi.fn();

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

vi.mock('@/api/v2/saas', async () => {
  const actual = await vi.importActual<typeof import('@/api/v2/saas')>('@/api/v2/saas');
  return {
    ...actual,
    createOmnichannelReplyClientMessageId: () => createClientMessageIdMock(),
    getOmnichannelInboxDetailV2: (...args: unknown[]) => getInboxDetailMock(...args),
    postOmnichannelInboxActionV2: (...args: unknown[]) => postInboxActionMock(...args),
  };
});

import { TicketConversationPane } from './TicketConversationPane';

const ticket = {
  id: 'municipio:42',
  legacy_id: '42',
  ticket_id: '42',
  source_model: 'MunicipioTicket',
  title: 'Luminaria apagada',
  description: 'La luminaria no funciona.',
  status: 'en_proceso',
  channel: 'whatsapp',
  lastMessageAt: '2026-07-30T10:00:00.000Z',
  unreadCount: 0,
  attachments: [],
  presence: [],
  timeline: [],
  actions: [],
  allowed_actions: [
    {
      id: 'reply',
      label: 'Responder',
      endpoint: '/api/v2/inbox/omnichannel/actions',
      requires: ['body', 'client_message_id_or_idempotency_key'],
      payload: { source_model: 'MunicipioTicket', legacy_id: 42 },
    },
  ],
  next_steps: [],
  agent_copilot_suggestions: [],
};

const secondTicket = {
  ...ticket,
  id: 'municipio:84',
  legacy_id: '84',
  ticket_id: '84',
  title: 'Arbol caido',
  description: 'Hay un arbol sobre la calle.',
  allowed_actions: [
    {
      ...ticket.allowed_actions[0],
      payload: { source_model: 'MunicipioTicket', legacy_id: 84 },
    },
  ],
};

const responseWithDelivery = (delivery: Record<string, unknown>) => ({
  contract_version: 'inbox.omnichannel.action.v1',
  action: 'reply',
  delivery,
  ticket,
  raw: null,
});

const renderPane = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TicketConversationPane ticketId={ticket.id} ticket={ticket} tenantSlug="junin" />
    </QueryClientProvider>,
  );
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const typeAndSend = (message: string) => {
  fireEvent.change(screen.getByPlaceholderText('Escribe una respuesta...'), { target: { value: message } });
  fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/i }));
};

const replyClientMessageIdAt = (callIndex: number) => {
  const request = postInboxActionMock.mock.calls[callIndex][1] as {
    payload: { client_message_id: string };
  };
  return request.payload.client_message_id;
};

describe('TicketConversationPane reply delivery contract', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getInboxDetailMock.mockReset();
    postInboxActionMock.mockReset();
    createClientMessageIdMock.mockReset();
    getInboxDetailMock.mockResolvedValue({ item: ticket, raw: null });
    createClientMessageIdMock
      .mockReturnValueOnce('crm-reply:attempt-0001')
      .mockReturnValueOnce('crm-reply:attempt-0002')
      .mockReturnValueOnce('crm-reply:attempt-0003');
  });

  it('reuses the same client_message_id after an ambiguous error and renders a durable queue honestly', async () => {
    postInboxActionMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(responseWithDelivery({
        contract_version: 'inbox.action_delivery.v2',
        mode: 'durable_queue',
        channel: 'whatsapp',
        status: 'durably_staged',
        evidence_stage: 'durably_staged',
        operator_message: 'Respuesta guardada y encolada de forma durable.',
        final_delivery: {
          status: 'pending_provider_callback',
          authoritative_source: 'provider_status_callback',
        },
        idempotency: { replayed: false, source: 'idempotency_key_header' },
        outbox: { durably_staged: true, effect_count: 4, worker_authoritative: true },
      }));

    renderPane();
    typeAndSend('La cuadrilla ya recibio el aviso.');
    await waitFor(() => expect(postInboxActionMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: /Enviar mensaje/i })).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/i }));
    await waitFor(() => expect(postInboxActionMock).toHaveBeenCalledTimes(2));

    expect(replyClientMessageIdAt(0)).toBe('crm-reply:attempt-0001');
    expect(replyClientMessageIdAt(1)).toBe(replyClientMessageIdAt(0));
    expect(createClientMessageIdMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Respuesta encolada')).toBeInTheDocument();
    expect(screen.getByText(/whatsapp · Encolado/i)).toBeInTheDocument();
    expect(screen.getByTestId('omnichannel-delivery-evidence')).toHaveTextContent(
      'Entrega final: pendiente de callback del proveedor',
    );
    expect(screen.getByTestId('omnichannel-delivery-evidence')).toHaveTextContent('Outbox: 4 efectos');
    expect(screen.queryByText(/Entregado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mensaje enviado/i)).not.toBeInTheDocument();
  });

  it('creates another identity when the operator changes the message after an ambiguous error', async () => {
    postInboxActionMock
      .mockRejectedValueOnce(new TypeError('connection reset'))
      .mockRejectedValueOnce(new TypeError('connection reset'));

    renderPane();
    typeAndSend('Primer texto');
    await waitFor(() => expect(postInboxActionMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: /Enviar mensaje/i })).not.toBeDisabled());

    typeAndSend('Texto corregido');
    await waitFor(() => expect(postInboxActionMock).toHaveBeenCalledTimes(2));

    expect(replyClientMessageIdAt(0)).toBe('crm-reply:attempt-0001');
    expect(replyClientMessageIdAt(1)).toBe('crm-reply:attempt-0002');
    expect(createClientMessageIdMock).toHaveBeenCalledTimes(2);
  });

  it('creates another identity after a definitive rejection even when the text is unchanged', async () => {
    postInboxActionMock
      .mockRejectedValueOnce(new ApiError('payload invalido', 400))
      .mockRejectedValueOnce(new TypeError('connection reset'));

    renderPane();
    typeAndSend('Mismo texto');
    await waitFor(() => expect(postInboxActionMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: /Enviar mensaje/i })).not.toBeDisabled());

    fireEvent.click(screen.getByRole('button', { name: /Enviar mensaje/i }));
    await waitFor(() => expect(postInboxActionMock).toHaveBeenCalledTimes(2));

    expect(replyClientMessageIdAt(0)).toBe('crm-reply:attempt-0001');
    expect(replyClientMessageIdAt(1)).toBe('crm-reply:attempt-0002');
  });

  it('shows provider acceptance as pending callback, never as delivered', async () => {
    postInboxActionMock.mockResolvedValueOnce(responseWithDelivery({
      contract_version: 'inbox.action_delivery.v2',
      mode: 'real_message',
      channel: 'whatsapp',
      status: 'provider_accepted',
      evidence_stage: 'provider_accepted',
      operator_message: 'El proveedor acepto el envio; la entrega final queda pendiente de callback.',
      final_delivery: {
        status: 'pending_provider_callback',
        authoritative_source: 'provider_status_callback',
      },
      idempotency: { replayed: false },
    }));

    renderPane();
    typeAndSend('Estamos revisando tu reclamo.');

    expect(await screen.findByText('Aceptado por el proveedor')).toBeInTheDocument();
    expect(screen.getByText(/whatsapp · Pendiente de callback/i)).toBeInTheDocument();
    expect(screen.queryByText(/Mensaje enviado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Entregado$/i)).not.toBeInTheDocument();
  });

  it('uses a provider callback as the only authority for delivered or read', async () => {
    postInboxActionMock.mockResolvedValueOnce(responseWithDelivery({
      contract_version: 'inbox.action_delivery.v2',
      mode: 'real_message',
      channel: 'whatsapp',
      status: 'provider_accepted',
      evidence_stage: 'provider_accepted',
      final_delivery: {
        status: 'read',
        authoritative_source: 'provider_status_callback',
      },
      idempotency: { replayed: false },
    }));

    renderPane();
    typeAndSend('Confirmamos la novedad.');

    expect(await screen.findByText('Entrega confirmada')).toBeInTheDocument();
    expect(screen.getByText(/whatsapp · Leído/i)).toBeInTheDocument();
    expect(screen.getByTestId('omnichannel-delivery-evidence')).toHaveTextContent(
      'Fuente: callback de estado del proveedor',
    );
  });

  it('does not call a non-authoritative read claim delivered', async () => {
    postInboxActionMock.mockResolvedValueOnce(responseWithDelivery({
      contract_version: 'inbox.action_delivery.v2',
      mode: 'real_message',
      channel: 'whatsapp',
      status: 'provider_accepted',
      evidence_stage: 'provider_accepted',
      final_delivery: {
        status: 'read',
        authoritative_source: 'local_projection',
      },
      idempotency: { replayed: false },
    }));

    renderPane();
    typeAndSend('Confirmamos la novedad.');

    expect(await screen.findByText('Aceptado por el proveedor')).toBeInTheDocument();
    expect(screen.getByTestId('omnichannel-delivery-status')).toHaveTextContent('Pendiente de callback');
    expect(screen.getByTestId('omnichannel-delivery-evidence')).toHaveTextContent('Estado preservado: leída');
    expect(screen.queryByText('Entrega confirmada')).not.toBeInTheDocument();
  });

  it.each([
    [
      'idempotent replay',
      {
        contract_version: 'inbox.action_delivery.v2',
        mode: 'idempotent_replay',
        channel: 'whatsapp',
        status: 'already_recorded',
        idempotency: { replayed: true },
        final_delivery: { status: 'preserved_from_original_attempt', authoritative_source: 'original_attempt_evidence' },
      },
      'Reintento reconocido',
      'Replay sin duplicado',
    ],
    [
      'CRM-only reply',
      {
        contract_version: 'inbox.action_delivery.v2',
        mode: 'timeline_only',
        channel: 'crm',
        status: 'saved_to_crm',
        evidence_stage: 'crm_only',
        final_delivery: { status: 'not_dispatched', authoritative_source: 'not_applicable' },
      },
      'Guardado solo en CRM',
      'CRM-only',
    ],
  ])('renders %s without inventing external delivery', async (_label, delivery, title, badge) => {
    postInboxActionMock.mockResolvedValueOnce(responseWithDelivery(delivery));

    renderPane();
    typeAndSend('Respuesta operativa.');

    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByTestId('omnichannel-delivery-status')).toHaveTextContent(badge);
    expect(screen.queryByText(/^Entregado$/i)).not.toBeInTheDocument();
  });

  it('does not leak a late reply result or clear the draft after switching tickets', async () => {
    const replyResponse = deferred<ReturnType<typeof responseWithDelivery>>();
    getInboxDetailMock.mockImplementation((ticketId: string) =>
      Promise.resolve({ item: ticketId === ticket.id ? ticket : secondTicket, raw: null }),
    );
    postInboxActionMock.mockReturnValueOnce(replyResponse.promise);
    const queryClient = createTestQueryClient();
    const view = render(
      <QueryClientProvider client={queryClient}>
        <TicketConversationPane ticketId={ticket.id} ticket={ticket} tenantSlug="junin" />
      </QueryClientProvider>,
    );

    typeAndSend('Respuesta para el ticket 42');
    await waitFor(() => expect(postInboxActionMock).toHaveBeenCalledTimes(1));
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <TicketConversationPane ticketId={secondTicket.id} ticket={secondTicket} tenantSlug="mendoza" />
      </QueryClientProvider>,
    );
    const editor = await screen.findByPlaceholderText('Escribe una respuesta...');
    fireEvent.change(editor, { target: { value: 'Borrador exclusivo del ticket 84' } });

    await act(async () => {
      replyResponse.resolve(responseWithDelivery({
        contract_version: 'inbox.action_delivery.v2',
        mode: 'durable_queue',
        channel: 'whatsapp',
        status: 'durably_staged',
      }));
      await replyResponse.promise;
    });

    expect(screen.queryByText('Respuesta encolada')).not.toBeInTheDocument();
    expect(editor).toHaveValue('Borrador exclusivo del ticket 84');
  });

  it('refreshes the scoped ticket detail after a confirmed action', async () => {
    postInboxActionMock.mockResolvedValueOnce(responseWithDelivery({
      contract_version: 'inbox.action_delivery.v2',
      mode: 'timeline_only',
      channel: 'crm',
      status: 'saved_to_crm',
    }));

    renderPane();
    typeAndSend('Actualizar el timeline.');

    expect(await screen.findByText('Guardado solo en CRM')).toBeInTheDocument();
    await waitFor(() => expect(getInboxDetailMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(getInboxDetailMock).toHaveBeenLastCalledWith(ticket.id, 'junin', undefined);
  });
});
