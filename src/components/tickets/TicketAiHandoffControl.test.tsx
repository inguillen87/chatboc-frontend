import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TicketAiHandoffControl from './TicketAiHandoffControl';
import type { OmnichannelInboxActionV2, SaasAction } from '@/api/v2/saas';

const apiMocks = vi.hoisted(() => ({
  postAction: vi.fn(),
}));

vi.mock('@/api/v2/saas', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/api/v2/saas');
  return {
    ...actual,
    postOmnichannelInboxActionV2: apiMocks.postAction,
  };
});

const handoffAction: SaasAction = {
  id: 'handoff',
  label: 'Derivar al equipo',
  method: 'POST',
  endpoint: '/api/v2/inbox/omnichannel/42/actions',
  delivery_mode: 'internal_event',
  external_dispatch: false,
  requires: ['channel'],
  payload_defaults: { channel: 'operator' },
};

const buildResult = (overrides: Partial<OmnichannelInboxActionV2> = {}): OmnichannelInboxActionV2 => ({
  action: 'handoff',
  delivery: {
    status: 'saved_to_crm',
    operator_message: 'Derivación registrada en la cola operativa.',
  },
  ticket: {
    id: '42',
    title: 'Luminaria caída',
    status: 'en_proceso',
    lastMessageAt: '2026-07-28T10:00:00Z',
    unreadCount: 0,
    attachments: [],
    presence: [],
    timeline: [],
    actions: [],
    allowed_actions: [
      {
        id: 'accept_handoff',
        label: 'Tomar conversación',
        method: 'POST',
      },
    ],
    next_steps: [],
    agent_copilot_suggestions: [],
    handoff: { status: 'requested', requested_by: { name: 'Operador Uno' } },
  },
  raw: {},
  ...overrides,
});

const renderControl = (props?: Partial<React.ComponentProps<typeof TicketAiHandoffControl>>) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TicketAiHandoffControl
        ticketId="42"
        tenantSlug="junin"
        actions={[handoffAction]}
        {...props}
      />
    </QueryClientProvider>,
  );
};

describe('TicketAiHandoffControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ejecuta una sola transición con endpoint y payload publicados por backend', async () => {
    let resolveAction: (value: OmnichannelInboxActionV2) => void = () => {};
    apiMocks.postAction.mockImplementation(
      () => new Promise<OmnichannelInboxActionV2>((resolve) => {
        resolveAction = resolve;
      }),
    );
    const onActionComplete = vi.fn();
    renderControl({ onActionComplete });

    const button = screen.getByRole('button', { name: 'Derivar al equipo' });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(apiMocks.postAction).toHaveBeenCalledTimes(1));
    expect(apiMocks.postAction).toHaveBeenCalledWith(
      '42',
      {
        action: 'handoff',
        endpoint: '/api/v2/inbox/omnichannel/42/actions',
        payload: { channel: 'operator' },
      },
      'junin',
    );

    await act(async () => {
      resolveAction(buildResult());
    });

    await waitFor(() => expect(onActionComplete).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Esperando operador')).toBeInTheDocument();
    expect(screen.getByTestId('handoff-action-result')).toHaveTextContent(
      'Derivación registrada en la cola operativa.',
    );
  });

  it('explica requisitos faltantes y no realiza requests', () => {
    renderControl({
      actions: [
        {
          ...handoffAction,
          payload_defaults: undefined,
          payload: undefined,
        },
      ],
    });

    expect(screen.getByRole('button', { name: 'Derivar al equipo' })).toBeDisabled();
    expect(screen.getByText('Falta completar el contrato backend: channel.')).toBeInTheDocument();
    expect(apiMocks.postAction).not.toHaveBeenCalled();
  });

  it.each([
    ['despacho externo', { external_dispatch: true }],
    ['modo no publicado', { delivery_mode: undefined }],
    ['flag externo ausente', { external_dispatch: undefined }],
  ])('bloquea %s porque el handoff debe ser exclusivamente interno', (_label, overrides) => {
    renderControl({ actions: [{ ...handoffAction, ...overrides }] });

    expect(screen.getByRole('button', { name: 'Derivar al equipo' })).toBeDisabled();
    expect(screen.getByText('La transición no garantiza una acción interna sin despacho externo.')).toBeInTheDocument();
    expect(apiMocks.postAction).not.toHaveBeenCalled();
  });

  it('mantiene el estado previo y muestra el error si backend rechaza la transición', async () => {
    apiMocks.postAction.mockRejectedValue(new Error('Transición inválida para el estado actual'));
    renderControl();

    fireEvent.click(screen.getByRole('button', { name: 'Derivar al equipo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Transición inválida para el estado actual');
    expect(screen.getByText('IA atendiendo')).toBeInTheDocument();
  });
});
