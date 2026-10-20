import { describe, expect, it } from 'vitest';

import {
  buildTerritorialTicketHref,
  resolveTerritorialTicketIdentity,
} from './territorialTicketIdentity';

describe('territorial ticket identity', () => {
  it('normalizes an opaque backend identity without losing its ticket model', () => {
    const result = resolveTerritorialTicketIdentity({
      id: 'municipio_ticket:419',
      record_source: 'municipio_ticket',
    });

    expect(result).toEqual({
      status: 'valid',
      identity: {
        sourceModel: 'MunicipioTicket',
        ticketId: '419',
        tenantSlug: null,
        opaqueKey: 'MunicipioTicket:419',
      },
    });
    expect(buildTerritorialTicketHref(result.identity)).toBe(
      '/perfil?tab=tickets&source_model=MunicipioTicket&ticket_id=419',
    );
  });

  it('accepts a canonical source_model plus record_id pair', () => {
    expect(resolveTerritorialTicketIdentity({
      source_model: 'TenantTicket',
      record_id: 77,
      id: 'territorial-point-77',
    })).toMatchObject({
      status: 'valid',
      identity: { sourceModel: 'TenantTicket', ticketId: '77' },
    });
  });

  it('keeps large opaque record ids as strings without numeric precision loss', () => {
    const result = resolveTerritorialTicketIdentity({
      source_model: 'PymeTicket',
      record_id: '9007199254740993123',
    });
    expect(result).toMatchObject({
      status: 'valid',
      identity: { ticketId: '9007199254740993123' },
    });
    expect(buildTerritorialTicketHref(
      result.status === 'valid' ? result.identity : null,
      'junin',
    )).toBe(
      '/perfil?tab=tickets&source_model=PymeTicket&ticket_id=9007199254740993123&tenant_slug=junin&tenant=junin',
    );
  });

  it('scopes identity and links to the expected tenant and rejects cross-tenant points', () => {
    const scoped = resolveTerritorialTicketIdentity({
      source_model: 'TenantTicket',
      ticket_id: '419',
      tenant_slug: 'junin',
    }, 'junin');
    expect(scoped).toMatchObject({
      status: 'valid',
      identity: {
        tenantSlug: 'junin',
        opaqueKey: 'junin:TenantTicket:419',
      },
    });
    expect(buildTerritorialTicketHref(
      scoped.status === 'valid' ? scoped.identity : null,
      'junin',
    )).toBe(
      '/perfil?tab=tickets&source_model=TenantTicket&ticket_id=419&tenant_slug=junin&tenant=junin',
    );

    expect(resolveTerritorialTicketIdentity({
      source_model: 'TenantTicket',
      ticket_id: '419',
      tenant_slug: 'otro-municipio',
    }, 'junin')).toEqual({ status: 'ambiguous', identity: null });
    expect(buildTerritorialTicketHref(
      scoped.status === 'valid' ? scoped.identity : null,
      'otro-municipio',
    )).toBeNull();
  });

  it('preserves leading zeroes and arbitrary opaque ids exactly', () => {
    const leadingZeroes = resolveTerritorialTicketIdentity({
      source_model: 'TenantTicket',
      ticket_id: '0000419',
    });
    expect(leadingZeroes).toMatchObject({
      status: 'valid',
      identity: { ticketId: '0000419', opaqueKey: 'TenantTicket:0000419' },
    });

    const arbitrary = resolveTerritorialTicketIdentity({
      id: 'pyme_ticket:case:2026/08/30-A',
      record_source: 'pyme_ticket',
    });
    expect(arbitrary).toMatchObject({
      status: 'valid',
      identity: { ticketId: 'case:2026/08/30-A' },
    });
    expect(buildTerritorialTicketHref(arbitrary.status === 'valid' ? arbitrary.identity : null)).toBe(
      '/perfil?tab=tickets&source_model=PymeTicket&ticket_id=case%3A2026%2F08%2F30-A',
    );
  });

  it('rejects already-lossy or malformed scalar ids', () => {
    expect(resolveTerritorialTicketIdentity({
      source_model: 'TenantTicket',
      ticket_id: Number.MAX_SAFE_INTEGER + 1,
    }).status).toBe('unsupported');
    expect(resolveTerritorialTicketIdentity({
      source_model: 'TenantTicket',
      ticket_id: ' 419 ',
    }).status).toBe('unsupported');
    expect(resolveTerritorialTicketIdentity({
      id: ' TenantTicket:419 ',
    }).status).toBe('missing');
  });

  it.each([
    {
      source_model: 'MunicipioTicket',
      record_source: 'tenant_ticket',
      ticket_id: 419,
    },
    {
      source_model: 'MunicipioTicket',
      ticket_id: 419,
      record_id: 420,
    },
    {
      id: 419,
    },
    {
      source_model: 'Order',
      ticket_id: 419,
    },
  ])('fails closed for partial, unsupported, or conflicting identity %#', (point) => {
    const result = resolveTerritorialTicketIdentity(point);
    expect(result.status).not.toBe('valid');
    expect(result.identity).toBeNull();
    expect(buildTerritorialTicketHref(result.identity)).toBeNull();
  });
});
