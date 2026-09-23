import { describe, expect, it } from 'vitest';
import profileFixture from '../../tests/fixtures/organization-profile-settings.json';
import workspaceFixtures from '../../tests/fixtures/organization-workspaces.json';
import { readAdminOrganizationIdentity } from './adminOrganizationIdentity';

const userFixture = () => ({
  id: 12, rol: 'tenant_admin', tenant_slug: 'tenant-a',
  organization_profile: structuredClone(profileFixture),
  organization_workspace: { ...structuredClone(workspaceFixtures.gobierno), tenant: { id: 11, slug: 'tenant-a' } },
});
const read = (user: unknown = userFixture(), path = '/perfil', slug = 'tenant-a', search = '', verified = true) =>
  readAdminOrganizationIdentity(user, slug, path, search, verified);

describe('authenticated organization identity in administrative chrome', () => {
  it('uses institutional values and government vocabulary rather than the operator avatar or account name', () => {
    const user = { ...userFixture(), name: 'Personal name', nombre_empresa: 'Legacy name', avatar_url: '/personal.png', logo_url: '/personal-logo.png' };
    user.organization_profile.values.logo_url = '/organization.svg';
    expect(read(user)).toEqual({ tenantId: 11, tenantSlug: 'tenant-a', name: profileFixture.values.nombre_empresa,
      label: workspaceFixtures.gobierno.organization_label, logoUrl: '/organization.svg' });
  });
  it.each(['/admin/encuestas/12/analytics', '/implementacion', '/t/tenant-a/pedidos', '/t/tenant-a/reclamos'])('keeps the same institution in %s', path => expect(read(undefined, path)).not.toBeNull());
  it.each(['/', '/login', '/t/tenant-a/login', '/t/tenant-a', '/t/tenant-a/productos', '/t/tenant-a/encuestas', '/t/tenant-a/reclamos/nuevo', '/superadmin', '/admin/tenants'])('preserves the platform/public brand on %s', path => expect(read(undefined, path)).toBeNull());
  it('rejects stale context, another route tenant, contradictory query scope and unverified sessions', () => {
    expect(read(undefined, '/perfil', 'tenant-b')).toBeNull();
    expect(read(undefined, '/t/tenant-b/pedidos')).toBeNull();
    expect(read(undefined, '/perfil', 'tenant-a', '?tenant_slug=tenant-b')).toBeNull();
    expect(read(undefined, '/perfil', 'tenant-a', '', false)).toBeNull();
  });
  it('requires both authoritative contracts and the same tenant ID', () => {
    const user = userFixture(); user.organization_workspace.tenant.id = 99;
    expect(read(user)).toBeNull();
    expect(read({ ...userFixture(), organization_profile: undefined })).toBeNull();
    expect(read({ ...userFixture(), rol: 'usuario' })).toBeNull();
  });
  it.each(['javascript:alert(1)', 'data:image/svg+xml,invalid', '//foreign.test/logo', 'https://operator:secret@foreign.test/logo', '/\\foreign.test/logo'])('does not render unsafe image URL %s', url => {
    const user = userFixture(); user.organization_profile.values.logo_url = url;
    expect(read(user)?.logoUrl).toBeNull();
  });
});
