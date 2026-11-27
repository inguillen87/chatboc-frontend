import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { TicketTimelineEvent } from '@/schemas/api';

import { TimelineMergeView } from './TimelineMergeView';

describe('TimelineMergeView', () => {
  it('renders backend status tokens as operator-friendly labels', () => {
    const events: TicketTimelineEvent[] = [
      {
        id: 'event-1',
        ticket_id: 'M-378430',
        type: 'status_changed',
        timestamp: '2026-07-03T21:00:00.000Z',
        actor: {
          id: 'system',
          type: 'system',
          name: 'Sistema',
        },
        payload: {
          new_status: 'en_proceso',
        },
      },
    ];

    const { container } = render(<TimelineMergeView events={events} />);

    expect(screen.getByText(/Sistema cambió el estado a En proceso/i)).toBeInTheDocument();
    expect(container).not.toHaveTextContent('en_proceso');
  });

  it('announces delivery with text and does not expose attachment identifiers', () => {
    const events: TicketTimelineEvent[] = [{
      id: 'event-2',
      ticket_id: 'M-378430',
      type: 'message_created',
      timestamp: '2026-07-03T21:00:00.000Z',
      actor: { id: 'agent-1', type: 'agent', name: 'Ana' },
      payload: { content: 'Respuesta enviada', read_state: 'delivered', attachment_id: 'internal_file_42' },
    }];

    const { container } = render(<TimelineMergeView events={events} />);

    expect(screen.getByRole('status', { name: 'Entregado' })).toHaveTextContent('Entregado');
    expect(screen.getByText('Archivo adjunto')).toBeVisible();
    expect(container).not.toHaveTextContent('internal_file_42');
  });
});
