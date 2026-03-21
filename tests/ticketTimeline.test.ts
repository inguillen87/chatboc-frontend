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

  it('normalizes unified conversation stream from backend when available', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      estado_chat: 'abierto',
      timeline: [],
      unified_conversation_stream: [
        {
          id: 10,
          stream_type: 'status',
          actor_type: 'system',
          preview_text: 'Asignado a cuadrilla',
          timestamp: '2024-01-05T10:00:00Z',
          badge: 'status_changed',
          is_unread: true,
        },
      ],
    } as any);

    const result = await getTicketTimeline(1, 'municipio');

    expect(result.unified_conversation_stream).toEqual([
      expect.objectContaining({
        id: '10',
        actor_type: 'system',
        preview_text: 'Asignado a cuadrilla',
        badge: 'status_changed',
        is_unread: true,
        is_read: false,
      }),
    ]);
  });

  it('builds a fallback unified stream from timeline events', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      estado_chat: 'abierto',
      timeline: [
        { tipo: 'estado', fecha: '2024-01-05T10:00:00Z', estado: 'pendiente' },
        { tipo: 'comentario', fecha: '2024-01-05T11:00:00Z', comentario: 'Necesito más datos', es_admin: 1 },
      ],
    } as any);

    const result = await getTicketTimeline(1, 'municipio');

    expect(result.unified_conversation_stream).toHaveLength(2);
    expect(result.unified_conversation_stream[0]).toMatchObject({
      actor_type: 'system',
      preview_text: 'pendiente',
      badge: 'status_changed',
    });
    expect(result.unified_conversation_stream[1]).toMatchObject({
      actor_type: 'agent',
      preview_text: 'Necesito más datos',
      source: 'timeline_comment',
    });
  });
});
