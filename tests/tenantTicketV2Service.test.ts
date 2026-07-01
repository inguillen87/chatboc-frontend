import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/utils/api';
import {
  getTenantTicketAiEnrichment,
  getTicketById,
  getTicketMessages,
  getTicketTimeline,
  isTenantTicketV2,
} from '../src/services/ticketService';
import type { Ticket } from '../src/types/tickets';

vi.mock('@/utils/api', () => ({
  apiFetch: vi.fn(),
}));

const tenantTicket = {
  id: 378430,
  tipo: 'municipio',
  nro_ticket: 'M-378430',
  asunto: 'Arreglo de calle',
  estado: 'nuevo',
  fecha: '2026-06-06T03:04:00Z',
  source_model: 'TenantTicket',
  ticket_type: 'tenant_ticket',
  tenant_slug: 'junin',
  detail_endpoint: '/api/v2/tickets/378430',
  messages_endpoint: '/api/v2/tickets/378430/messages',
  timeline_endpoint: '/api/v2/tickets/378430/timeline',
  ai_enrichment_endpoint: '/api/v2/tickets/378430/ai-enrichment',
} as Ticket;

const calledUrls = () => vi.mocked(apiFetch).mock.calls.map((call) => String(call[0]));

describe('TenantTicket v2 service routing', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('identifies TenantTicket v2 by source model, type, contract or endpoints', () => {
    expect(isTenantTicketV2({ source_model: 'TenantTicket' })).toBe(true);
    expect(isTenantTicketV2({ ticket_type: 'tenant_ticket' })).toBe(true);
    expect(isTenantTicketV2({ contract_version: 'tickets.v2.detail' })).toBe(true);
    expect(isTenantTicketV2({ detail_endpoint: '/api/v2/tickets/1' })).toBe(true);
    expect(isTenantTicketV2({ tipo: 'municipio', id: 1 })).toBe(false);
  });

  it('loads TenantTicket detail from v2 without falling back to municipio legacy detail', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      contract_version: 'tickets.v2.detail',
      source_model: 'TenantTicket',
      ticket_type: 'tenant_ticket',
      ticket: {
        id: 378430,
        tipo: 'municipio',
        nro_ticket: 'M-378430',
        asunto: 'Arreglo de calle',
        estado: 'nuevo',
        fecha: '2026-06-06T03:04:00Z',
        messages: [
          {
            id: 'c1',
            body: 'Hola',
            actor_type: 'citizen',
            timestamp: '2026-06-06T03:05:00Z',
          },
        ],
      },
    } as any);

    const result = await getTicketById('378430', { ticket: tenantTicket, tenantSlug: 'junin' });

    expect(result.id).toBe(378430);
    expect(result.messages).toHaveLength(1);
    expect(calledUrls()).toEqual(['/api/v2/tickets/378430']);
    expect(calledUrls().some((url) => url.includes('/api/tickets/municipio'))).toBe(false);
  });

  it('loads TenantTicket messages from v2 without chat legacy endpoints', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      contract_version: 'tickets.v2.messages',
      messages: [
        {
          id: 'c2',
          body: 'Lo revisa obras publicas',
          actor_type: 'agent',
          timestamp: '2026-06-06T03:11:00Z',
        },
      ],
    } as any);

    const result = await getTicketMessages(378430, 'municipio', {
      ticket: tenantTicket,
      tenantSlug: 'junin',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ author: 'agent', content: 'Lo revisa obras publicas' });
    expect(calledUrls()).toEqual(['/api/v2/tickets/378430/messages']);
    expect(calledUrls().some((url) => url.includes('/api/tickets/chat'))).toBe(false);
  });

  it('loads TenantTicket timeline from v2 without municipio legacy timeline', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      contract_version: 'tickets.v2.timeline',
      estado_chat: 'nuevo',
      timeline: [
        {
          id: 'ticket-created-378430',
          tipo: 'ticket_creado',
          fecha: '2026-06-06T03:04:00Z',
          estado: 'nuevo',
          texto: 'Ticket creado',
        },
      ],
      historial_chat: [],
      unified_conversation_stream: [
        {
          id: 'ticket-created-378430',
          actor_type: 'system',
          preview_text: 'Ticket creado',
          timestamp: '2026-06-06T03:04:00Z',
        },
      ],
    } as any);

    const result = await getTicketTimeline(378430, 'municipio', {
      ticket: tenantTicket,
      tenantSlug: 'junin',
    });

    expect(result.unified_conversation_stream).toHaveLength(1);
    expect(calledUrls()).toEqual(['/api/v2/tickets/378430/timeline']);
    expect(calledUrls().some((url) => url.includes('/api/tickets/municipio/378430/timeline'))).toBe(false);
  });

  it('loads TenantTicket AI enrichment from v2 advisory endpoint', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      contract_version: 'ticket.ai_enrichment.v1',
      ticket_type: 'tenant',
      advisory_policy: { advisory_only: true },
    } as any);

    await getTenantTicketAiEnrichment(
      378430,
      { scope: 'tenant', ticket_type: 'tenant_ticket' },
      'junin',
      tenantTicket,
    );

    expect(calledUrls()).toEqual(['/api/v2/tickets/378430/ai-enrichment']);
    expect(calledUrls().some((url) => url.includes('/admin/tickets'))).toBe(false);
  });
});
