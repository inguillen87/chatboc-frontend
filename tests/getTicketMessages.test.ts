import { describe, it, expect, vi } from 'vitest';
import { getTicketMessages } from '../src/services/ticketService';
import { apiFetch } from '@/utils/api';

vi.mock('@/utils/api', () => ({
  apiFetch: vi.fn(),
}));

describe('getTicketMessages', () => {
  it('maps admin flag to author field', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      mensajes: [
        { id: 1, mensaje: 'Hola', es_admin: 0, timestamp: '2024-01-01T00:00:00Z' },
        { id: 2, mensaje: 'Chau', es_admin: 1, timestamp: '2024-01-02T00:00:00Z' },
      ],
    } as any);

    const result = await getTicketMessages(1, 'municipio');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ author: 'user', content: 'Hola' });
    expect(result[1]).toMatchObject({ author: 'agent', content: 'Chau' });
  });
});
