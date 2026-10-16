import { describe, expect, it } from 'vitest';
import { resolvePrivateAnalyticsScope } from './privateAnalyticsScope';
const base = () => ({ verified: true, profileVerified: true, pathname: '/perfil', search: '',
  user: { id: 4, rol: 'admin_municipio', tipo_chat: 'municipio', tenant_slug: 'junin', tenantSlug: 'junin', organization_profile: { tenant: { id: 22, slug: 'junin' } } },
  tenant: { id: 46, slug: 'tierra-del-fuego', tipo: 'pyme' } });
describe('verified private analytics scope', () => {
  it('uses the nonmunicipal contract for a verified backend school profile', () => {
    const input = base(); input.user.rol = 'admin_colegio'; input.user.tipo_chat = 'colegio';
    expect(resolvePrivateAnalyticsScope(input)).toMatchObject({ tenantSlug: 'junin', tenantId: 22, kind: 'pyme' });
    expect(resolvePrivateAnalyticsScope({ ...input, verified: false })).toBeNull();
    expect(resolvePrivateAnalyticsScope({ ...input, search: '?tenant_slug=tierra-del-fuego' })).toBeNull();
  });

  it('uses school analytics only after an explicit matching SuperAdmin selection', () => {
    const input = { ...base(), user: { id: 5, rol: 'super_admin' }, search: '?tenant_slug=colegio-demo',
      tenant: { id: 71, slug: 'colegio-demo', tipo: 'colegio' } };
    expect(resolvePrivateAnalyticsScope(input)).toMatchObject({ tenantSlug: 'colegio-demo', tenantId: 71, kind: 'pyme' });
    expect(resolvePrivateAnalyticsScope({ ...input, search: '' })).toBeNull();
  });
  it('uses private profile after a public tenant visit, including its numeric id and type', () => {
    expect(resolvePrivateAnalyticsScope(base())).toMatchObject({ tenantSlug: 'junin', tenantId: 22, kind: 'municipio', platformAdmin: false });
  });
  it.each(['admin_pyme','school_admin','government_admin','employee','analytics_viewer'])('supports existing backoffice role %s using verified type', rol => {
    const input = base(); input.user.rol = rol; input.user.tipo_chat = 'pyme';
    expect(resolvePrivateAnalyticsScope(input)).toMatchObject({ tenantSlug: 'junin', kind: 'pyme' });
  });
  it.each([{verified:false},{profileVerified:false},{user:null}])('blocks missing identity or verification %j', extra => {
    expect(resolvePrivateAnalyticsScope({...base(),...extra})).toBeNull();
  });
  it.each(['/t/tierra-del-fuego/analytics','/t/preview/analytics'])('rejects foreign or reserved explicit path %s', pathname => {
    expect(resolvePrivateAnalyticsScope({...base(),pathname})).toBeNull();
  });
  it.each(['?tenant_slug=tierra-del-fuego','?tenant=junin&tenant=tierra-del-fuego','?tenant_slug=','?tenant_id=46','?tenant_id=22&tenant_id=46','?tenant_profile_id=46','?tenant_profile_id=22&tenant_profile_id=46','?tenant=junin&tenantSlug=tierra-del-fuego'])('rejects foreign or contradictory selection %s', search => {
    expect(resolvePrivateAnalyticsScope({...base(),search})).toBeNull();
  });
  it('accepts matching repeated declarations', () => {
    expect(resolvePrivateAnalyticsScope({...base(),search:'?tenant=junin&tenant_slug=junin&tenant_id=22'})).toMatchObject({tenantSlug:'junin',tenantId:22});
  });
  it('rejects contradictory private aliases and numeric ids', () => {
    const input = base(); input.user.tenantSlug='tierra-del-fuego'; expect(resolvePrivateAnalyticsScope(input)).toBeNull();
    input.user.tenantSlug='junin'; expect(resolvePrivateAnalyticsScope({...input,user:{...input.user,tenant_id:46}})).toBeNull();
  });
  it('never treats a public current tenant as a platform selection', () => {
    expect(resolvePrivateAnalyticsScope({...base(),user:{id:5,rol:'super_admin'}})).toBeNull();
  });
  it('requires matching explicit platform metadata and a verified actor', () => {
    const input={...base(),user:{id:5,rol:'super_admin'},search:'?tenant_slug=tierra-del-fuego'};
    expect(resolvePrivateAnalyticsScope(input)).toMatchObject({tenantSlug:'tierra-del-fuego',tenantId:46,kind:'pyme',platformAdmin:true});
    expect(resolvePrivateAnalyticsScope({...input,tenantPending:true})).toBeNull();
    expect(resolvePrivateAnalyticsScope({...input,tenant:{slug:'junin'}})).toBeNull();
  });
});
