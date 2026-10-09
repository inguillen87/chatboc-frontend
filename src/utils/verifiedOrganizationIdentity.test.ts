import { describe, expect, it } from 'vitest';
import { hasOrganizationIdentityContracts, readVerifiedOrganizationIdentity } from './verifiedOrganizationIdentity';

const authority = { hasVerifiedSession: true, profileVerified: true, loading: false };
const fixture = () => ({
  id: 10449,
  name: 'Operador de prueba',
  avatar_url: 'https://cdn.example.test/personal.png',
  rol: 'admin_municipio',
  capabilities: ['knowledge.read', 'settings.tenant.write'],
  tipo_chat: 'pyme',
  rubro: 'medico',
  nombre_empresa: 'Nombre heredado del actor',
  tenant_slug: 'qa-civic',
  tenantSlug: 'qa-civic',
  organization_profile: {
    contract_version: 'organization.profile_settings.v1',
    tenant: { id: 7046, slug: 'qa-civic' },
    revision: 'a'.repeat(64),
    can_edit: true,
    values: { nombre_empresa: 'Gobierno de prueba', logo_url: 'https://cdn.example.test/institution.png' },
    ui: { organization_type_label_contract: 'organization.type_label.v1', organization_type_label: 'Gobierno' },
  },
  organization_workspace: {
    contract_version: 'organization.profile_workspace.v1',
    tenant: { id: 7046, slug: 'qa-civic' },
    organization_type: 'municipio',
  },
});
const identity = (user: unknown) => readVerifiedOrganizationIdentity(user, authority);
const freezeDeep = (value: unknown): void => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
};

describe('verified organization identity from bound authenticated contracts', () => {
  it('uses institutional identity and type despite contradictory legacy actor fields and absent top-level tenant', () => {
    const user = fixture();
    expect(identity(user)).toEqual({
      tenantId: 7046, tenantSlug: 'qa-civic', name: 'Gobierno de prueba',
      logoUrl: 'https://cdn.example.test/institution.png', organizationType: 'municipio',
      organizationTypeLabel: 'Gobierno', isMunicipal: true,
    });
  });

  it('ignores actor and owner IDs when verifying tenant identity', () => {
    expect(identity({ ...fixture(), id: 9, owner_id: 10448 })?.tenantId).toBe(7046);
  });

  it.each([
    ['municipio', 'Gobierno', true], ['gobierno', 'Gobierno', true],
    ['colegio', 'Educación', false], ['empresa', 'Empresa', false],
    ['pyme', 'Empresa', false], ['organizacion', 'Organización', false],
  ] as const)('uses the published type %s independently of roles and legacy rubro', (type, label, municipal) => {
    const user = fixture();
    user.organization_workspace.organization_type = type;
    user.organization_profile.ui.organization_type_label = label;
    user.rol = 'admin_municipio';
    expect(identity(user)).toMatchObject({ organizationType: type, organizationTypeLabel: label, isMunicipal: municipal });
  });

  it('uses canonical type when a recognized presentation label contradicts it', () => {
    const user = fixture();
    user.organization_profile.ui.organization_type_label = 'Empresa';
    expect(identity(user)).toMatchObject({ organizationTypeLabel: 'Gobierno', isMunicipal: true });
  });

  it('does not turn a presentation label into municipal classification', () => {
    const user = fixture();
    user.organization_workspace.organization_type = 'organizacion';
    expect(identity(user)).toMatchObject({ organizationType: 'organizacion', organizationTypeLabel: 'Gobierno', isMunicipal: false });
  });

  it.each([
    { hasVerifiedSession: false }, { profileVerified: false }, { loading: true },
  ])('withholds stale, revoked or refreshing contracts for %j', change => {
    expect(readVerifiedOrganizationIdentity(fixture(), { ...authority, ...change })).toBeNull();
  });

  it('keeps read-only profile identity without deriving edit permission', () => {
    const user = fixture();
    user.organization_profile.can_edit = false;
    expect(identity(user)?.name).toBe('Gobierno de prueba');
    expect(identity(user)).not.toHaveProperty('can_edit');
  });

  it('does not mutate actor identity, personal avatar, permissions, contracts or authority', () => {
    const user = { ...fixture(), permissions: ['private.read'], scopes: ['tenant:7046'], owner_id: 10448 };
    const before = structuredClone(user);
    freezeDeep(user);
    freezeDeep(authority);
    expect(identity(user)?.tenantId).toBe(7046);
    expect(user).toEqual(before);
    expect(identity(user)).not.toHaveProperty('rol');
    expect(identity(user)).not.toHaveProperty('capabilities');
    expect(identity(user)).not.toHaveProperty('avatar_url');
  });

  it.each(['organization_profile', 'organization_workspace'] as const)('rejects unknown %s contract versions', field => {
    const user = fixture();
    user[field].contract_version = 'organization.future.v2';
    expect(identity(user)).toBeNull();
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, '7046', true, null])('rejects invalid contract tenant ID %s', value => {
    const user = fixture();
    (user.organization_profile.tenant as { id: unknown }).id = value;
    (user.organization_workspace.tenant as { id: unknown }).id = value;
    expect(identity(user)).toBeNull();
  });

  it('rejects profile and workspace tenant ID disagreement even when slugs match', () => {
    const user = fixture();
    user.organization_workspace.tenant.id += 1;
    expect(identity(user)).toBeNull();
  });

  it.each(['organization_profile', 'organization_workspace'] as const)('rejects foreign tenant slug on %s', field => {
    const user = fixture();
    user[field].tenant.slug = 'another-org';
    expect(identity(user)).toBeNull();
  });

  it('rejects contradictory session slug aliases', () => {
    expect(identity({ ...fixture(), tenantSlug: 'another-org' })).toBeNull();
    expect(identity({ ...fixture(), tenant: { id: 7046, slug: 'another-org' } })).toBeNull();
  });

  it.each(['default', 'localhost', 'municipal', 'municipio', 'tenant', 'tenant/foreign', 'org\\foreign', '', 'qa\u202e-civic'])('rejects invalid or placeholder slug %s', slug => {
    const user = fixture();
    user.tenant_slug = user.tenantSlug = user.organization_profile.tenant.slug = user.organization_workspace.tenant.slug = slug;
    expect(identity(user)).toBeNull();
  });

  it('requires session slug fields and never infers authority from contracts or public URLs', () => {
    const { tenant_slug, tenantSlug, ...user } = fixture();
    expect(identity({ ...user, public_catalog_url: 'https://example.test/t/qa-civic', endpoint: 'qa-civic' })).toBeNull();
    expect(identity({ ...user, tenant: { id: 7046 } })).toBeNull();
  });

  it('preserves valid legacy underscores without rewriting separators', () => {
    const user = fixture();
    user.tenant_slug = 'QA_CIVIC'; user.tenantSlug = 'qa_civic';
    user.organization_profile.tenant.slug = user.organization_workspace.tenant.slug = 'qa_civic';
    expect(identity(user)?.tenantSlug).toBe('qa_civic');
    user.organization_workspace.tenant.slug = 'qa-civic';
    expect(identity(user)).toBeNull();
  });

  it.each([7046, '7046'])('accepts an optional matching session tenant ID %s', id => {
    expect(identity({ ...fixture(), tenant: { id, slug: 'qa-civic' }, tenant_id: id })?.tenantId).toBe(7046);
  });

  it.each([7047, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '7e3', '07046', '', true, null])('rejects invalid or foreign optional session tenant ID %s', id => {
    expect(identity({ ...fixture(), tenant_id: id })).toBeNull();
    expect(identity({ ...fixture(), tenant: { id, slug: 'qa-civic' } })).toBeNull();
  });

  it.each(['', '   ', 'a'.repeat(241), 'Bad\u202e name', 'Bad\nname'])('rejects absent, unbounded or controlled institutional name %j', name => {
    const user = fixture();
    user.organization_profile.values.nombre_empresa = name;
    expect(identity(user)).toBeNull();
  });

  it.each(['javascript:alert(1)', '//foreign.example.test/image', 'https://cdn.example.test/image?token=secret', 'x'.repeat(2049)])('uses a neutral logo for unsafe or unbounded URL %s', logo => {
    const user = fixture();
    user.organization_profile.values.logo_url = logo;
    expect(identity(user)).toMatchObject({ name: 'Gobierno de prueba', logoUrl: null });
  });

  it.each(['government', 'future-type', 'medico', '', '__proto__'])('rejects unsupported organization type %s', type => {
    const user = fixture();
    user.organization_workspace.organization_type = type;
    expect(identity(user)).toBeNull();
  });

  it.each([null, [], 'invalid', {}, { organization_profile: null }, { organization_workspace: undefined }])('handles missing or malformed user/contracts without throwing: %j', user => {
    expect(identity(user)).toBeNull();
  });

  it('distinguishes absent contracts from explicitly invalid contracts for legacy fallback', () => {
    expect(hasOrganizationIdentityContracts({ id: 9, nombre_empresa: 'Legacy' })).toBe(false);
    expect(hasOrganizationIdentityContracts(fixture())).toBe(true);
    expect(hasOrganizationIdentityContracts({ organization_profile: null })).toBe(true);
    expect(hasOrganizationIdentityContracts({ organization_workspace: undefined })).toBe(false);
    expect(hasOrganizationIdentityContracts({ organization_workspace: undefined, organization_profile: undefined })).toBe(false);
    expect(hasOrganizationIdentityContracts({ ...fixture(), organization_profile: [] })).toBe(true);
    expect(hasOrganizationIdentityContracts(Object.create({ organization_profile: {} }))).toBe(false);
    expect(identity({ ...fixture(), organization_profile: null })).toBeNull();
  });
});
