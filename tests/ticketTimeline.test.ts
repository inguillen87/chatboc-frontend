import { describe, it, expect, vi } from 'vitest';
import { getTicketTimeline } from '../src/services/ticketService';
import { apiFetch } from '@/utils/api';

describe('getTicketTimeline', () => {
  it('marks events with user_id as agent when es_admin is missing', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      estado_chat: 'abierto',
      timeline: [
        { tipo: 'comentario', fecha: '2024-01-01', texto: 'Hola', user_id: 5 }
      ]
    } as any);
    const result = await getTicketTimeline(1, 'municipio');
    expect(result.messages[0].author).toBe('agent');
  });
});
