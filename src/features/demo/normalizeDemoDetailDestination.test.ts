import { describe, expect, it } from 'vitest';

import { normalizeDemoDetailDestination } from './normalizeDemoDetailDestination';

const ORIGIN = 'https://preview.chatboc.test';

describe('normalizeDemoDetailDestination', () => {
  it('classifies a relative API endpoint as fetchable JSON and preserves query and hash', () => {
    expect(normalizeDemoDetailDestination('/api/v2/tickets/42?source=demo#summary', ORIGIN)).toEqual({
      kind: 'api',
      href: '/api/v2/tickets/42?source=demo#summary',
    });
  });

  it('accepts an absolute API endpoint only when it has the exact same origin', () => {
    expect(
      normalizeDemoDetailDestination(
        'https://preview.chatboc.test/api/v2/inbox/omnichannel/42?source_model=MunicipioTicket',
        ORIGIN,
      ),
    ).toEqual({
      kind: 'api',
      href: '/api/v2/inbox/omnichannel/42?source_model=MunicipioTicket',
    });
  });

  it('classifies public claim tracking as navigable and preserves its PIN fragment', () => {
    expect(
      normalizeDemoDetailDestination('/tracking/claim/M-123456?tenant_slug=junin#pin=654321', ORIGIN),
    ).toEqual({
      kind: 'public_tracking',
      href: '/tracking/claim/M-123456?tenant_slug=junin#pin=654321',
    });
  });

  it('accepts the query-based public tracking route used by the tracking experience', () => {
    expect(
      normalizeDemoDetailDestination('/tracking/claim?code=M-123456&pin=654321&tenant_slug=junin', ORIGIN),
    ).toEqual({
      kind: 'public_tracking',
      href: '/tracking/claim?code=M-123456&pin=654321&tenant_slug=junin',
    });
  });

  it.each([
    'https://evil.example/api/v2/tickets/42',
    '//evil.example/tracking/claim/M-123456#pin=654321',
    'https://preview.chatboc.test.evil.example/api/v2/tickets/42',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '/admin/users',
    '/tracking/order/ORDER-42#token=secret',
    '/tracking/claims/M-123456#pin=654321',
    '/apiary/v2/tickets/42',
  ])('rejects unsupported or unsafe destination %s', (endpoint) => {
    expect(normalizeDemoDetailDestination(endpoint, ORIGIN)).toEqual({ kind: 'none', href: null });
  });

  it.each([
    '/tracking/claim/M-123456#next=https%3A%2F%2Fevil.example',
    '/tracking/claim/M-123456#pin=654321&next=https%3A%2F%2Fevil.example',
    '/tracking/claim/M-123456#pin=',
    '/tracking/claim/M-123456#pin=654321&pin=123456',
  ])('rejects an unknown or ambiguous tracking fragment %s', (endpoint) => {
    expect(normalizeDemoDetailDestination(endpoint, ORIGIN)).toEqual({ kind: 'none', href: null });
  });

  it('rejects credentials even when the URL resolves to the expected origin', () => {
    expect(
      normalizeDemoDetailDestination('https://user:password@preview.chatboc.test/api/v2/tickets/42', ORIGIN),
    ).toEqual({ kind: 'none', href: null });
  });

  it.each([null, undefined, '', '   ', 42, {}, []])('fails closed for a missing or non-string endpoint', (endpoint) => {
    expect(normalizeDemoDetailDestination(endpoint, ORIGIN)).toEqual({ kind: 'none', href: null });
  });

  it.each([null, '', 'file:///tmp/app', 'javascript:alert(1)', 'not an origin'])(
    'fails closed when no trustworthy HTTP origin is available',
    (origin) => {
      expect(normalizeDemoDetailDestination('/api/v2/tickets/42', origin)).toEqual({
        kind: 'none',
        href: null,
      });
    },
  );
});
