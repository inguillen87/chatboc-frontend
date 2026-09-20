import {describe,it,expect} from 'vitest';
import fixture from '../../tests/fixtures/organization-modules.json';
import {readOrganizationModules} from './organizationModules';
describe('module selection contract',()=>{
  it('accepts the backend fixture and rejects a foreign scope',()=>{
    expect(readOrganizationModules(fixture,'tenant-a')?.version).toBe(0);
    expect(readOrganizationModules(fixture,'other')).toBeNull();
  });
  it.each([true,-1,1.2])('rejects invalid version %s',version=>{
    expect(readOrganizationModules({...fixture,version},'tenant-a')).toBeNull();
  });
  it('rejects broken dependency and unsupported identifiers',()=>{
    for(const selected of [['payments'],['unknown'],['catalog','catalog']])
      expect(readOrganizationModules({...fixture,selected},'tenant-a')).toBeNull();
  });
  it('rejects misleading permission and provider flags',()=>{
    expect(readOrganizationModules({...fixture,can_edit:false},'tenant-a')).toBeNull();
    expect(readOrganizationModules({...fixture,provider_calls_performed:true},'tenant-a')).toBeNull();
  });
  it('rejects Unicode control characters and unsafe endpoint',()=>{
    expect(readOrganizationModules({...fixture,ui:{...fixture.ui,heading:'Visible\u0085hidden'}},'tenant-a')).toBeNull();
    expect(readOrganizationModules({...fixture,save_endpoint:'/api/admin/tenants/other/config'},'tenant-a')).toBeNull();
  });
});
