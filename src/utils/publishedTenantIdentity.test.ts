import {describe,it,expect} from 'vitest';
import {readPublishedTenantIdentity,safeInstitutionLogo,exactInstitutionSlug} from './publishedTenantIdentity';
const response=(extra={})=>({tenant:{id:7,slug:'org-a',nombre:'Organización A',logo_url:'/logo.svg',...extra}});
describe('verified public identity metadata',()=>{
  it('takes the name and identity from the server rather than requested defaults',()=>{
    expect(readPublishedTenantIdentity(response(),'org-a')).toEqual({tenantId:7,tenantSlug:'org-a',name:'Organización A',logoUrl:'/logo.svg'});
    expect(readPublishedTenantIdentity({id:7},'org-a')).toBeNull();
  });
  it.each([0,-1,1.5,true,'not-an-id'])('rejects invalid explicit organization id %s',id=>expect(()=>readPublishedTenantIdentity(response({id}),'org-a')).toThrow());
  it('allows incomplete legacy data without claiming explicit identity',()=>{
    expect(readPublishedTenantIdentity(response({id:undefined}),'org-a')).toBeNull();
    expect(readPublishedTenantIdentity(response({nombre:undefined}),'org-a')).toBeNull();
  });
  it.each(['Other\u202eLabel','Line\nBreak',''])('does not display control characters or empty names',nombre=>{
    expect(readPublishedTenantIdentity(response({nombre}),'org-a')).toBeNull();
  });
  it('rejects a mismatch between nested and outer identity',()=>{
    expect(()=>readPublishedTenantIdentity({...response(),slug:'org-b'},'org-a')).toThrow();
    expect(()=>readPublishedTenantIdentity({...response(),id:8},'org-a')).toThrow();
  });
  it('keeps underscore and case normalization without changing slug separators',()=>{
    expect(exactInstitutionSlug('Local_comercial_general')).toBe('local_comercial_general');
    expect(exactInstitutionSlug('org/a')).toBeNull();
  });
  it.each(['javascript:alert(1)','data:image/svg+xml,<svg/>','//other.example.com/a','http://cdn.example.com/a','https://u:p@cdn.example.com/a','https://127.0.0.1/a','https://local.internal/a','https://cdn.example.com/a?token=private'])('does not expose an unsafe logo URL %s',url=>{
    expect(safeInstitutionLogo(url)).toBeNull();
  });
  it('preserves public image transformations and a root-relative image',()=>{
    expect(safeInstitutionLogo('https://cdn.example.com/a?w=128&format=webp')).toContain('w=128');
    expect(safeInstitutionLogo('/brand/logo.png')).toBe('/brand/logo.png');
  });
});
