import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { OmnichannelInboxItem } from '@/api/v2/saas';

import { TicketListPane } from './TicketListPane';

const baseTicket: OmnichannelInboxItem = {
  id: 'municipio:378430',
  title: 'Arreglo de calle',
  description: 'Don Bosco 55',
  status: 'nuevo',
  channel: 'whatsapp',
  category: 'Arreglo De Calle',
  lastMessageAt: '2026-07-10T20:10:00.000Z',
  unreadCount: 1,
  attachments: [],
  presence: [],
  timeline: [],
  actions: [],
  allowed_actions: [],
  next_steps: [],
  agent_copilot_suggestions: [],
};

describe('TicketListPane', () => {
  it('surfaces queued live chat state in the ticket row', () => {
    render(
      <TicketListPane
        tickets={[
          {
            ...baseTicket,
            live_chat: {
              contract_version: 'inbox.live_chat_channel.v1',
              channel_state: 'queued',
              base_channel_state: 'offline',
              queue: { pending_customer_messages: 2 },
            },
          },
        ]}
        selectedTicketId="municipio:378430"
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByTestId('ticket-live-chat-state-municipio:378430')).toHaveTextContent('En cola');
  });
});
