import { describe, it, expect, vi } from 'vitest';
import { getTicketMessages } from '../src/services/ticketService';
import { collectAttachmentsFromTicket } from '../src/components/tickets/DetailsPanel';
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

  it('keeps archivos_adjuntos available for attachment collection', async () => {
    const attachment = {
      id: 7,
      filename: 'archivo.pdf',
      url: 'https://example.com/archivo.pdf',
    };

    vi.mocked(apiFetch).mockResolvedValueOnce({
      mensajes: [
        {
          id: 3,
          mensaje: 'Con adjunto',
          es_admin: 0,
          timestamp: '2024-01-03T00:00:00Z',
          archivos_adjuntos: [attachment],
        },
      ],
    } as any);

    const result = await getTicketMessages(2, 'municipio');

    expect(result[0].attachments).toEqual([attachment]);
    expect(result[0].archivos_adjuntos).toEqual([attachment]);

    const collected = collectAttachmentsFromTicket(undefined, result);

    expect(collected).toHaveLength(1);
    expect(collected[0]).toMatchObject({
      id: attachment.id,
      url: attachment.url,
      filename: attachment.filename,
    });
  });
});
