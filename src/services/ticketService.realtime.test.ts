import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiFetchMock = vi.fn();

vi.mock('@/utils/api', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {
    status?: number;
    data?: unknown;
    constructor(message: string, status?: number, data?: unknown) {
      super(message);
      this.status = status;
      this.data = data;
    }
  },
}));

vi.mock('@/utils/anonIdGenerator', () => ({
  default: () => 'anon-test',
}));

import { getTicketByNumber } from '@/services/ticketService';

describe('ticketService realtime normalization', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it('keeps derived presence state and idle counts in ticket realtime summaries', async () => {
    apiFetchMock.mockResolvedValueOnce({
      id: 77,
      tipo: 'municipio',
      nro_ticket: 'REC-77',
      asunto: 'Reclamo',
      estado: 'abierto',
      fecha: '2026-03-21T10:00:00.000Z',
      email: 'demo@example.com',
      mensajes: [{ id: 1, mensaje: 'Hola', es_admin: 0, timestamp: '2026-03-21T10:01:00.000Z' }],
      realtime_state: {
        viewers: [
          {
            viewer_id: 'agente-1',
            viewer_label: 'Agente 1',
            presence_status: 'active',
            effective_presence_status: 'idle',
          },
        ],
        summary: {
          active_count: 1,
          idle_count: 1,
          read_count: 0,
        },
      },
      collaboration_state: {
        idle_viewer_count: 1,
        idle_window_minutes: 5,
      },
    });

    const ticket = await getTicketByNumber('REC-77', '1234');

    expect(ticket.realtime_state?.viewers[0]).toMatchObject({
      viewer_id: 'agente-1',
      effective_presence_status: 'idle',
    });
    expect(ticket.realtime_state?.summary).toMatchObject({
      active_count: 1,
      idle_count: 1,
      read_count: 0,
    });
    expect(ticket.collaboration_state).toMatchObject({
      idle_viewer_count: 1,
      idle_window_minutes: 5,
    });
  });
});
