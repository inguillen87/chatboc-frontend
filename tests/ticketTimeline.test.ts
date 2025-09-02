import { describe, it, expect, vi } from 'vitest';
import { getTicketTimeline } from '../src/services/ticketService';
import { apiFetch } from '@/utils/api';

vi.mock('@/utils/api', () => ({
  apiFetch: vi.fn(),
}));

describe('getTicketTimeline', () => {
  it('identifies agent messages and extracts content', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      estado_chat: 'abierto',
      timeline: [
        { tipo: 'comentario', fecha: '2024-01-01', texto: 'Vecino', comentario: 'Hola', user_id: 5 },
        { tipo: 'comentario', fecha: '2024-01-02', texto: 'Agente', comentario: 'Chau', es_admin: '1' }
      ]
    } as any);
    const result = await getTicketTimeline(1, 'municipio');
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({ author: 'agent', content: 'Hola' });
    expect(result.messages[1]).toMatchObject({ author: 'agent', content: 'Chau' });
  });

  it('treats non-truthy es_admin values as user messages', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      estado_chat: 'abierto',
      timeline: [
        { tipo: 'comentario', fecha: '2024-01-03', texto: 'Vecino', comentario: 'Vecino', es_admin: '0' },
        { tipo: 'comentario', fecha: '2024-01-04', texto: 'Agente', comentario: 'Agente', es_admin: 1 }
      ]
    } as any);
    const result = await getTicketTimeline(1, 'municipio');
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({ author: 'user', content: 'Vecino' });
    expect(result.messages[1]).toMatchObject({ author: 'agent', content: 'Agente' });
  });
});
