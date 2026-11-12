import { describe, expect, it } from 'vitest';
import routes from '@/routesConfig';
import { resolveSessionBootstrapDecision } from '@/components/access/SessionBootstrapGuard';
describe('rehearsal product route access', () => {
  it('allows public reads through the existing guard while administrative creation remains private', () => {
    const path = '/pruebas/encuestas/organization-a/rehearsal_' + '4'.repeat(32);
    expect(routes.find(route => route.path === '/pruebas/encuestas/:tenantSlug/:runId')?.allowGuest).toBe(true);
    expect(resolveSessionBootstrapDecision({ pathname: path, hasBearerSession: false, bearerRequiresClerkVerification: false, clerkStatus: 'signed_out' })).toEqual({ kind: 'allow' });
    expect(resolveSessionBootstrapDecision({ pathname: '/admin/encuestas', hasBearerSession: false, bearerRequiresClerkVerification: false, clerkStatus: 'signed_out' }).kind).toBe('redirect');
  });
});
