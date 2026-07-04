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

    expect(screen.getByText(/Sistema cambio el estado a En proceso/i)).toBeInTheDocument();
    expect(container).not.toHaveTextContent('en_proceso');
  });
});
