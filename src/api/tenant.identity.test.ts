import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:mock.fetch,ApiError:class extends Error{constructor(message:string,public status=500){super(message);}}}));
import {getTenantPublicInfoFlexible} from './tenant';
const payload=(extra={})=>({contract_version:'public.tenant_profile.v1',tenant:{id:7,slug:'org-a',nombre:'Organización de prueba',logo_url:'/logo.png',...extra}});
beforeEach(()=>{mock.fetch.mockReset();});
describe('public organization identity normalization',()=>{
  it('rejects a returned organization that differs from the requested one',async()=>{
    mock.fetch.mockResolvedValue(payload({slug:'org-b',nombre:'Otra organización'}));
    await expect(getTenantPublicInfoFlexible('org-a')).rejects.toThrow();
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
  it('does not hide a scope mismatch by substituting a widget lookup',async()=>{
    mock.fetch.mockResolvedValue(payload({slug:'org-b'}));
    await expect(getTenantPublicInfoFlexible('org-a','test-widget-only')).rejects.toThrow();
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects conflicting tenant ids in the same public response',async()=>{
    mock.fetch.mockResolvedValue({...payload(),id:8,slug:'org-a'});
    await expect(getTenantPublicInfoFlexible('org-a')).rejects.toThrow();
  });
  it('preserves explicit public identity only when the response itself proves it',async()=>{
    mock.fetch.mockResolvedValue(payload());
    const info=await getTenantPublicInfoFlexible('org-a');
    expect(info.publishedIdentity).toEqual({tenantId:7,tenantSlug:'org-a',name:'Organización de prueba',logoUrl:'/logo.png'});
  });
  it('does not treat a requested slug or defaulted name as published identity',async()=>{
    mock.fetch.mockResolvedValue({tipo:'municipio'});
    const info=await getTenantPublicInfoFlexible('org-a');
    expect(info.slug).toBe('org-a');expect(info.publishedIdentity).toBeNull();
  });
  it('does not trust an identity object supplied directly by the server',async()=>{
    mock.fetch.mockResolvedValue({...payload({id:undefined}),publishedIdentity:{tenantId:7,tenantSlug:'org-a',name:'Forged proof'}});
    expect((await getTenantPublicInfoFlexible('org-a')).publishedIdentity).toBeNull();
  });
  it('keeps historical underscore identifiers unchanged',async()=>{
    mock.fetch.mockResolvedValue(payload({slug:'local_comercial_general'}));
    const info=await getTenantPublicInfoFlexible('local_comercial_general');
    expect(info.publishedIdentity?.tenantSlug).toBe('local_comercial_general');
  });
  it('keeps a rejected logo out of the verified brand metadata',async()=>{
    mock.fetch.mockResolvedValue(payload({logo_url:'https://cdn.example.com/logo?token=private'}));
    expect((await getTenantPublicInfoFlexible('org-a')).publishedIdentity?.logoUrl).toBeNull();
  });
});
