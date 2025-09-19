import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTicketMessages } from '../src/services/ticketService';
import { collectAttachmentsFromTicket } from '../src/components/tickets/DetailsPanel';
import type { Ticket } from '../src/types/tickets';
import { apiFetch } from '@/utils/api';

vi.mock('@/utils/api', () => ({
  apiFetch: vi.fn(),
}));

describe('getTicketMessages', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

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

  it('preserves archivos_adjuntos for collectAttachmentsFromTicket', async () => {
    const attachmentPayload = [
      { id: 99, filename: 'doc.pdf', url: 'https://example.com/doc.pdf' },
    ];

    vi.mocked(apiFetch).mockResolvedValueOnce({
      mensajes: [
        {
          id: 10,
          mensaje: 'Archivo enviado',
          es_admin: 0,
          timestamp: '2024-01-03T00:00:00Z',
          archivos_adjuntos: attachmentPayload,
        },
      ],
    } as any);

    const messages = await getTicketMessages(5, 'municipio');
    expect(messages).toHaveLength(1);
    expect(messages[0].attachments).toEqual(attachmentPayload);
    expect(messages[0].archivos_adjuntos).toBe(messages[0].attachments);

    const ticket: Ticket = {
      id: 123,
      tipo: 'municipio',
      nro_ticket: 'ABC-123',
      asunto: 'Test',
      estado: 'abierto',
      fecha: '2024-01-01T00:00:00Z',
      messages,
    };

    const collected = collectAttachmentsFromTicket(ticket);
    expect(collected).toHaveLength(1);
    expect(collected[0]).toMatchObject({ url: 'https://example.com/doc.pdf' });
  });
});
