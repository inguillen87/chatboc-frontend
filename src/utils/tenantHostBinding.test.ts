import { afterEach, describe, expect, it, vi } from 'vitest';
import { tenantHostFixture, tenantHostPayload } from '@/test/fixtures/tenantHost';
import { normalizeTenantHostname, publishTenantHostRuntime, readActiveTenantHostRuntime, readTenantHostBinding, requiresTenantHostBinding, tenantHostNavigationTarget, tenantHostRouteMatches, tenantHostRequestMatches } from './tenantHostBinding';

afterEach(() => { publishTenantHostRuntime(null); vi.useRealTimers(); });
describe('complete hostname contract', () => {
  it.each(['chatboc.ar','www.chatboc.ar','app.chatboc.ar','panel.chatboc.ar','api.chatboc.ar','preview.chatboc.ar','release-team.vercel.app','localhost','127.0.0.1','::1'])('keeps shared/deployment/local host %s independent', host => expect(requiresTenantHostBinding(host)).toBe(false));
  it.each(['atencion.example.test','junin.chatboc.ar','otra.example.test'])('requires a published binding for the complete host %s', host => expect(requiresTenantHostBinding(host)).toBe(true));
  it('normalizes IDNA and trailing dot, without reading a first label as the organization', () => {
    expect(normalizeTenantHostname(' ATENCIÓN.example.test. ')).toBe('xn--atencin-q0a.example.test');
    const result = readTenantHostBinding(tenantHostPayload(), 'ATENCION.EXAMPLE.TEST.');
    expect(result.tenant.slug).toBe('government-east');
    expect(result.tenant.slug).not.toBe('atencion');
  });
  it.each(['https://example.test','example.test:443','example.test/a','example.test@evil.test','example.test?host=else','*.example.test','127.0.0.1','..example.test','x'.repeat(64)+'.test'])('rejects non-DNS or malformed host %s', host => expect(normalizeTenantHostname(host)).toBeNull());
  it.each([
    { contract_version: 'legacy' }, { host: 'foreign.example.test' }, { origin: 'https://foreign.example.test' },
    { binding: { status: 'pending_dns', verified: true, valid_until: 9999999999 } },
    { binding: { status: 'active', verified: false, valid_until: 9999999999 } },
    { binding: { status: 'active', verified: true, valid_until: 1 } },
    { paths: { home: 'https://evil.test', login: '/login', workspace: '/perfil' } },
    { tenant: { id: 0, slug: 'government-east', nombre: 'Incomplete' } },
  ])('withdraws invalid/inactive/foreign contracts rather than using an ambient tenant', patch => expect(() => readTenantHostBinding({ ...tenantHostPayload(), ...patch }, 'atencion.example.test')).toThrow());
  it('rejects conflicting identities and unsafe logos are absent', () => {
    expect(() => readTenantHostBinding({ ...tenantHostPayload(), tenant: { ...tenantHostPayload().tenant, tenant_id: 18 } }, 'atencion.example.test')).toThrow();
    expect(readTenantHostBinding({ ...tenantHostPayload(), tenant: { ...tenantHostPayload().tenant, logo_url: 'javascript:alert(1)' } }, 'atencion.example.test').identity.logoUrl).toBeNull();
  });
  it('does not retain a runtime binding across host changes or expiration', () => {
    const binding = tenantHostFixture(); publishTenantHostRuntime(binding);
    expect(readActiveTenantHostRuntime(binding.host)?.tenant.slug).toBe('government-east');
    expect(readActiveTenantHostRuntime('other.example.test')).toBeNull();
    vi.useFakeTimers(); vi.setSystemTime(binding.binding.valid_until * 1000);
    expect(readActiveTenantHostRuntime(binding.host)).toBeNull();
  });
  it('limits canonical and query scopes to the bound organization, including repeated parameters', () => {
    const binding = tenantHostFixture();
    expect(tenantHostRouteMatches(binding,'/','')).toBe(true);
    expect(tenantHostRouteMatches(binding,'/login','')).toBe(true);
    expect(tenantHostRouteMatches(binding,'/t/government-east/noticias','?tenant_slug=government-east')).toBe(true);
    expect(tenantHostRouteMatches(binding,'/t/old-workspace','')).toBe(false);
    expect(tenantHostRouteMatches(binding,'/','?tenant_slug=government-east&tenant_slug=old-workspace')).toBe(false);
    expect(tenantHostRouteMatches(binding,'/perfil','?tenant=old-workspace')).toBe(false);
  });
  it('keeps home and published navigation on this host without exporting an external target', () => {
    const binding = tenantHostFixture();
    expect(tenantHostNavigationTarget(binding,'/t/government-east')).toBe('/');
    expect(tenantHostNavigationTarget(binding,'/t/government-east?tab=help')).toBe('/?tab=help');
    expect(tenantHostNavigationTarget(binding,'/t/government-east/noticias')).toBe('/t/government-east/noticias');
    expect(tenantHostNavigationTarget(binding,'/t/old-workspace/noticias')).toBeNull();
    expect(tenantHostNavigationTarget(binding,'https://evil.test')).toBeNull();
  });
  it.each(['/api/public/tenants%2Fold-workspace', '/api/public%2Ftenants%2Fold-workspace',
    '/api/public/tenants%252Fold-workspace', '/api/public/tenants%5Cold-workspace',
    '/api/p%75blic/tenants/old-workspace', '/t%2Fold-workspace', '/%74/old-workspace'])
    ('rejects an encoded foreign or ambiguous namespace %s', path => {
      const binding = tenantHostFixture(); expect(tenantHostRequestMatches(binding, path)).toBe(false);
    });
  it('retains the normal exact namespace and global identity route', () => {
    const binding = tenantHostFixture();
    expect(tenantHostRequestMatches(binding, '/api/public/tenants/government-east/public-navigation')).toBe(true);
    expect(tenantHostRequestMatches(binding, '/api/me')).toBe(true);
    expect(tenantHostRequestMatches(binding, '/auth/admin/login')).toBe(true);
  });
});
