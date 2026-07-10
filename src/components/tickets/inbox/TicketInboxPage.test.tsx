import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TicketInboxPage } from './TicketInboxPage';

const getOmnichannelInboxV2Mock = vi.fn();

vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({ currentSlug: 'junin' }),
}));

vi.mock('@/api/v2/saas', async () => {
  const actual = await vi.importActual<typeof import('@/api/v2/saas')>('@/api/v2/saas');
  return {
    ...actual,
    getOmnichannelInboxV2: (...args: unknown[]) => getOmnichannelInboxV2Mock(...args),
  };
});

vi.mock('@/services/ticketService', () => ({
  getTickets: vi.fn(),
}));

vi.mock('./TicketListPane', () => ({
  TicketListPane: ({
    tickets,
    selectedTicketId,
  }: {
    tickets: Array<{ id: string; title: string }>;
    selectedTicketId?: string;
  }) => (
    <aside data-testid="inbox-list" data-selected-ticket-id={selectedTicketId || ''}>
      {tickets.map((ticket) => (
        <div key={ticket.id}>{ticket.title}</div>
      ))}
    </aside>
  ),
}));

vi.mock('./TicketConversationPane', () => ({
  TicketConversationPane: ({
    ticket,
    ticketId,
  }: {
    ticket?: { id: string; title: string };
    ticketId?: string;
  }) => (
    <section data-testid="inbox-conversation" data-ticket-id={ticketId || ''}>
      {ticket ? `Conversacion ${ticket.title}` : 'Sin conversacion'}
    </section>
  ),
}));

const renderInbox = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TicketInboxPage />
    </QueryClientProvider>,
  );
};

describe('TicketInboxPage', () => {
  beforeEach(() => {
    getOmnichannelInboxV2Mock.mockReset();
  });

  it('selects the first visible omnichannel ticket so the conversation pane is actionable', async () => {
    getOmnichannelInboxV2Mock.mockResolvedValueOnce({
      items: [
        {
          id: 'municipio:378430',
          title: 'Arreglo de calle',
          status: 'nuevo',
          category: 'Arreglo De Calle',
          sensitivity: 'alta',
          channel: 'whatsapp',
          lastMessageAt: '2026-06-01T10:00:00.000Z',
          unreadCount: 1,
          attachments: [],
          presence: [],
          timeline: [],
          actions: [],
          allowed_actions: [],
          next_steps: [],
          agent_copilot_suggestions: [],
        },
      ],
      summary: {},
      raw: null,
    });

    renderInbox();

    await waitFor(() => {
      expect(screen.getByTestId('inbox-list')).toHaveAttribute('data-selected-ticket-id', 'municipio:378430');
    });

    expect(screen.getByTestId('inbox-conversation')).toHaveAttribute('data-ticket-id', 'municipio:378430');
    expect(screen.getByTestId('inbox-conversation')).toHaveTextContent('Conversacion Arreglo de calle');
    expect(getOmnichannelInboxV2Mock).toHaveBeenCalledWith('junin');
  });
});
