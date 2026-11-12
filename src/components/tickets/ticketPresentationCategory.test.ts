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

  it('muestra el dato registrado sin verificar en el contrato real con autoridad nula', () => {
    const result = resolveTicketPresentationCategory({
      ticket: ticket({
        id: 409,
        categoria: 'Sugerencia',
        authoritative_category: null,
        category_authority: {
          contract_version: 'ticket.category_authority.v1',
          conflict: false,
          verified: false,
          reason_code: 'category_id_missing_and_alias_unverified',
          persisted_category: 'Sugerencia',
        },
      } as Partial<Ticket>),
      routingResolution: { ok: false, reason: 'conflicting_authority' },
    });

    expect(result).toEqual({
      label: 'Sugerencia',
      state: 'persisted',
      detail: 'Categoría registrada en el ticket, sin autoridad correlacionada disponible.',
    });
  });

  it.each([
    { authoritative_category: null },
    { authoritative_category: null, authoritativeCategory: 'luminarias' },
    {
      authoritative_category: 'luminarias',
      category_authority: { contract_version: 'ticket.category_authority.v1', verified: false, conflict: false },
    },
  ])('no promueve aliases ni routing a categoría verificada con autoridad explícitamente ausente: %j', (published) => {
    expect(resolveTicketPresentationCategory({
      ticket: ticket(published as Partial<Ticket>),
      routingResolution: authority(),
    })).toMatchObject({ label: 'General', state: 'persisted' });
  });

  it('no inventa una categoría desde el asunto cuando la autoridad nula no tiene dato registrado', () => {
    expect(resolveTicketPresentationCategory({
      ticket: ticket({ categoria: undefined, authoritative_category: null } as Partial<Ticket>),
      routingResolution: authority(),
    })).toMatchObject({ label: 'Categoría no informada', state: 'missing' });
  });

  it('conserva conflicto para autoridades no vacías distintas aunque el descriptor diga sin verificar', () => {
    expect(resolveTicketPresentationCategory({
      ticket: ticket({
        authoritative_category: 'luminarias',
        authoritativeCategory: 'bacheo',
        category_authority: { contract_version: 'ticket.category_authority.v1', verified: false, conflict: false },
      } as Partial<Ticket>),
      routingResolution: authority(),
    })).toMatchObject({ label: 'Categoría por verificar', state: 'conflict' });
  });

  it('respeta un conflicto publicado por backend aunque las categorías top y anidada coincidan', () => {
    expect(resolveTicketPresentationCategory({
      ticket: ticket({
        authoritative_category: 'luminarias',
        category_authority: { contract_version: 'ticket.category_authority.v1', verified: true, conflict: true, authoritative_category: 'luminarias' },
      } as Partial<Ticket>),
      routingResolution: null,
    })).toMatchObject({ label: 'Categoría por verificar', state: 'conflict' });
  });
});
