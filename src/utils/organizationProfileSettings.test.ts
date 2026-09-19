import { describe,expect,it } from 'vitest';
import source from '../../tests/fixtures/organization-profile-settings.json';
import { readOrganizationProfile,profileChanges,readProfileSaveReceipt } from './organizationProfileSettings';
const fresh=()=>structuredClone(source);
describe('organization profile settings contract',()=>{
  it('accepts the contract produced by the backend',()=>{
    expect(readOrganizationProfile(fresh(),'tenant-a')?.revision).toMatch(/^[0-9a-f]{64}$/);
  });
  it.each([
    ['version',{contract_version:'future'}],['endpoint',{save_endpoint:'https://other.test/save'}],
    ['relative endpoint',{save_endpoint:'/api/admin/tenants/tenant-b/config'}],['revision',{revision:''}],
    ['provider side effect',{provider_calls_performed:true}],['permission',{can_edit:'true'}],
    ['scope',{tenant:{id:11,slug:'tenant-b'}}],['tenant id',{tenant:{id:true,slug:'tenant-a'}}],
    ['incomplete values',{values:{nombre_empresa:'only'}}],
  ])('rejects malformed %s',(name,patch)=>expect(readOrganizationProfile({...fresh(),...patch},'tenant-a')).toBeNull());
  it('does not include personal attributes or unknown values in a write',()=>{
    const candidate=fresh() as any;candidate.values.password='no';candidate.values.plan='full';
    const parsed=readOrganizationProfile(candidate,'tenant-a')!;
    expect(parsed.values).not.toHaveProperty('password');expect(parsed.values).not.toHaveProperty('plan');
    expect(profileChanges({...parsed.values,telefono:'123'},parsed.values)).toEqual({telefono:'123'});
  });
  it('rejects a success response that did not save the requested name',()=>{
    const profile=readOrganizationProfile(fresh(),'tenant-a')!;
    const receipt={contract_version:'organization.profile_save.v1',ok:true,saved:true,provider_calls_performed:false,tenant:profile.tenant,profile};
    expect(readProfileSaveReceipt(receipt,profile,{nombre_empresa:'Never saved'})).toBeNull();
  });
});
