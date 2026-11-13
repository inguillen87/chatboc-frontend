import { describe, expect, it } from 'vitest';
import { tenantHostFixture, tenantHostPayload } from '@/test/fixtures/tenantHost';
import { readTenantHostBinding } from './tenantHostBinding';
import { tenantHostCanonicalDestination, tenantHostCanonicalLookup } from './tenantHostCanonical';

const source = () => readTenantHostBinding({ ...tenantHostPayload('public-alias.vercel.app'),
  canonical_origin: 'https://civic.example.test', canonical_redirect_required: true }, 'public-alias.vercel.app');
const destination = () => tenantHostFixture('civic.example.test');
const href = 'https://public-alias.vercel.app/';

describe('canonical public root boundary', () => {
  it('requires two live bindings with exactly the same tenant identity', () => {
    expect(tenantHostCanonicalLookup(source(), href)).toBe('civic.example.test');
    expect(tenantHostCanonicalDestination(source(), destination(), href)).toBe('https://civic.example.test/');
    const target = destination();
    target.tenant.id = 99;
    expect(tenantHostCanonicalDestination(source(), target, href)).toBeNull();
    expect(tenantHostCanonicalDestination(source(), tenantHostFixture('civic.example.test', 'other-tenant'), href)).toBeNull();
    expect(tenantHostCanonicalDestination(source(), tenantHostFixture('other.example.test'), href)).toBeNull();
  });
  it.each(['/login', '/auth/sso-callback', '/sso-callback', '/perfil', '/admin', '/t/government-east',
    '/?code=secret', '/?tenant_slug=government-east', '/?utm_source=campaign', '/#access_token=secret',
    '/?token=secret#state'])('does not move private, ambiguous or state-carrying URL %s', path => {
    expect(tenantHostCanonicalLookup(source(), `https://public-alias.vercel.app${path}`)).toBeNull();
  });
  it.each(['http://public-alias.vercel.app/', 'https://user:secret@public-alias.vercel.app/',
    'https://public-alias.vercel.app:444/', 'https://other.vercel.app/'])('requires the actual clean HTTPS origin %s', url => {
    expect(tenantHostCanonicalLookup(source(), url)).toBeNull();
  });
  it('rejects expiry during verification and canonical chains or loops', () => {
    const current = source(), target = destination();
    expect(tenantHostCanonicalDestination(current, target, href, current.binding.valid_until)).toBeNull();
    target.binding.valid_until = 1;
    expect(tenantHostCanonicalDestination(current, target, href)).toBeNull();
    const chained = { ...destination(), canonical_origin: current.origin, canonical_redirect_required: true };
    expect(tenantHostCanonicalDestination(current, chained, href)).toBeNull();
    expect(tenantHostCanonicalLookup({ ...current, canonical_origin: current.origin }, href)).toBeNull();
    expect(tenantHostCanonicalLookup({ ...current, canonical_redirect_required: false }, href)).toBeNull();
  });
});
