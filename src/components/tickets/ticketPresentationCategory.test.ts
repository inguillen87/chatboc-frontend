import { describe, expect, it } from 'vitest';

import type { Ticket } from '@/types/tickets';
import type { TicketRoutingAuthorityResolution } from './ticketRoutingAuthority';
import { resolveTicketPresentationCategory } from './ticketPresentationCategory';

const ticket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 419,
  source_model: 'MunicipioTicket',
  tipo: 'municipio',
  nro_ticket: 'M-419',
  asunto: 'Poste sin luz en plaza',
  estado: 'nuevo',
  fecha: '2026-08-31T10:00:00Z',
  categoria: 'General',
  ...overrides,
});

const authority = (overrides: Partial<Extract<TicketRoutingAuthorityResolution, { ok: true }>['authority']> = {}): TicketRoutingAuthorityResolution => ({
  ok: true,
  authority: {
    identity: 'municipioticket:419',
    sourceModel: 'MunicipioTicket',
    ticketId: '419',
    ticket: {},
    recommendation: null,
    eligibleEmployees: [],
    suggestedEmployee: null,
    currentAssigneeId: null,
    category: 'luminarias',
    zone: null,
    channel: null,
    ...overrides,
  },
});

describe('resolveTicketPresentationCategory', () => {
  it('muestra luminarias verificadas para M-419 aunque la categoría persistida sea General', () => {
    expect(resolveTicketPresentationCategory({
      ticket: ticket(),
      routingResolution: authority(),
    })).toMatchObject({ label: 'Luminarias', state: 'verified' });
  });

  it('rechaza una categoría autoritativa cuya identidad no coincide con M-419', () => {
    expect(resolveTicketPresentationCategory({
      ticket: ticket(),
      routingResolution: authority({ identity: 'municipioticket:420', ticketId: '420' }),
    })).toMatchObject({ label: 'Categoría por verificar', state: 'conflict' });
  });

  it('conserva General como dato registrado cuando no existe autoridad y nunca infiere desde el asunto', () => {
    expect(resolveTicketPresentationCategory({
      ticket: ticket(),
      routingResolution: { ok: false, reason: 'ticket_not_published' },
    })).toMatchObject({ label: 'General', state: 'persisted' });

    expect(resolveTicketPresentationCategory({
      ticket: ticket({ categoria: undefined }),
      routingResolution: { ok: false, reason: 'ticket_not_published' },
    })).toMatchObject({ label: 'Categoría no informada', state: 'missing' });
  });

  it('acepta authoritative_category directo porque pertenece al mismo registro tipado del ticket', () => {
    expect(resolveTicketPresentationCategory({
      ticket: ticket({ authoritative_category: 'luminarias' } as Partial<Ticket>),
      routingResolution: null,
    })).toMatchObject({ label: 'Luminarias', state: 'verified' });
  });

  it('bloquea aliases autoritativos contradictorios dentro del mismo ticket', () => {
    expect(resolveTicketPresentationCategory({
      ticket: ticket({ authoritative_category: 'luminarias', authoritativeCategory: 'bacheo' }),
      routingResolution: null,
    })).toMatchObject({ label: 'Categoría por verificar', state: 'conflict' });
  });
});
