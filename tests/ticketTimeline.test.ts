import { beforeEach, describe, it, expect, vi } from 'vitest';
import { getTicketTimeline } from '../src/services/ticketService';
import { apiFetch, ApiError } from '@/utils/api';

vi.mock('@/utils/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/api')>();
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

describe('getTicketTimeline', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

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

  it('prefers canonical chat history messages over timeline comments', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      estado_chat: 'abierto',
      historial_chat: [
        {
          id: 334,
          fecha: '2026-06-06T03:04:47.245Z',
          texto: 'hola que tal como va mi reclamo?',
          autor: 'vecino',
          es_admin: false,
        },
        {
          id: 335,
          fecha: '2026-06-06T03:11:29.168Z',
          texto: 'Ya lo derivamos al area correspondiente',
          autor: 'municipio',
          es_admin: true,
        },
      ],
      timeline: [
        { tipo: 'comentario', fecha: '2026-06-06T03:04:47.245Z', texto: 'hola que tal como va mi reclamo?', es_admin: false },
        { tipo: 'comentario', fecha: '2026-06-06T03:11:29.168Z', texto: 'Ya lo derivamos al area correspondiente', es_admin: true },
      ],
    } as any);

    const result = await getTicketTimeline(400, 'municipio');

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toMatchObject({ id: 334, author: 'user' });
    expect(result.messages[1]).toMatchObject({ id: 335, author: 'agent' });
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

  it('suppresses legacy HTML gateway errors without dumping the HTML response', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new ApiError(
      '<!DOCTYPE html><html><title>502</title></html>',
      502,
      '<!DOCTYPE html><html><title>502</title></html>',
      'req_timeline_502',
    );
    vi.mocked(apiFetch).mockRejectedValueOnce(error);

    await expect(getTicketTimeline(400, 'municipio')).rejects.toThrow(error);
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
