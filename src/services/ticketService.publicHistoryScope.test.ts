import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => vi.fn());
vi.mock('@/utils/api', () => ({
  apiFetch: api,
  isLikelyHtmlErrorBody: () => false,
  ApiError: class ApiError extends Error {},
}));
vi.mock('@/utils/anonIdGenerator', () => ({ default: () => 'isolated-public-history' }));

import { getTicketByNumber } from './ticketService';

beforeEach(() => {
  api.mockReset();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in public history scope tests'); }));
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('public detail history scope passthrough', () => {
  const response = { id: 400, tipo: 'municipio', nro_ticket: 'M-400', estado: 'en_proceso',
    mensajes: [{ id: 1, mensaje: 'Mensaje vinculado', es_admin: 0, timestamp: '2026-10-14T10:00:00Z' }] };
  it('preserves the optional backend descriptor through the existing actual detail normalizer', async () => {
    const scope = { contract_version: 'tickets.history_scope.v1', scope: 'ticket_comments_only',
      legacy_conversations_included: false, retryable: false, notice: 'Texto recibido del backend' };
    api.mockResolvedValue({ ...response, history_scope: scope });
    const detail = await getTicketByNumber('M-400', '9999');
    expect(detail.history_scope).toEqual(scope);
    expect(detail.messages?.[0].content).toBe('Mensaje vinculado');
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith('/api/tickets/municipio/por_numero/M-400?pin=9999',
      { skipAuth: true, sendAnonId: true, sendEntityToken: true, pin: '9999' });
  });
  it('keeps older responses without the descriptor compatible without extra reads', async () => {
    api.mockResolvedValue(response);
    const detail = await getTicketByNumber('M-400', '9999');
    expect(detail.history_scope).toBeUndefined();
    expect(detail.messages?.[0].content).toBe('Mensaje vinculado');
    expect(api).toHaveBeenCalledTimes(1);
  });
});
