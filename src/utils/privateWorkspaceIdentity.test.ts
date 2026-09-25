import {describe,expect,it} from 'vitest';
import {privateWorkspacePresentation} from './privateWorkspaceIdentity';
const input=()=>({pathname:'/perfil',search:'?tab=tickets',hasVerifiedSession:true,profileVerified:true,loading:false,currentSlug:'org-a',
  user:{id:12,rol:'admin',tenant_slug:'org-a',tenantSlug:'org-a',nombre_empresa:'Organización A',logo_url:'https://cdn.example.com/logo.png'}});
describe('private workspace presentation',()=>{
  it('uses the verified authenticated profile rather than public branding',()=>{
    expect(privateWorkspacePresentation(input())).toEqual({active:true,identity:{tenantSlug:'org-a',name:'Organización A',logoUrl:'https://cdn.example.com/logo.png'}});
  });
  it.each(['/perfil?tab=crm','/pedidos','/usuarios','/analytics/operations','/admin/encuestas/42/analytics','/t/org-a/perfil','/org-a/analytics'])('brands supported private routes without changing permissions: %s',path=>{
    const url=new URL(path,'https://qa.example.com');const model=privateWorkspacePresentation({...input(),pathname:url.pathname,search:url.search});
    if(path==='/org-a/analytics')expect(model.active).toBe(false);else expect(model.identity?.name).toBe('Organización A');
  });
  it.each(['/','/login','/t/org-a/login','/demo','/t/org-a','/cart','/checkout','/superadmin','/admin/tenants','/legal/privacy'])('does not apply private branding to %s',pathname=>{
    expect(privateWorkspacePresentation({...input(),pathname}).active).toBe(false);
  });
  it.each([{hasVerifiedSession:false},{profileVerified:false},{loading:true}])('never exposes an unverified or refreshing brand %j',change=>{
    expect(privateWorkspacePresentation({...input(),...change}).identity).toBeNull();
  });
  it.each(['super_admin','superadmin','chat_user','unknown'])('does not replace platform or public-user branding for %s',rol=>{
    const data=input();expect(privateWorkspacePresentation({...data,user:{...data.user,rol}}).active).toBe(false);
  });
  it.each(['/t/org-b/perfil','/t/org-a/perfil?tenant=org-b','/perfil?tenant=org-a&tenant=org-b','/perfil?endpoint=org-b'])('withholds branding for contradictory navigation scope %s',path=>{
    const url=new URL(path,'https://qa.example.com');expect(privateWorkspacePresentation({...input(),pathname:url.pathname,search:url.search}).identity).toBeNull();
  });
  it('does not keep the previous organization while its context is switching',()=>{
    expect(privateWorkspacePresentation({...input(),currentSlug:'org-b'})).toEqual({active:true,identity:null});
  });
  it('rejects contradictory aliases in authenticated profile data',()=>{
    const data=input();expect(privateWorkspacePresentation({...data,user:{...data.user,tenantSlug:'org-b'}}).identity).toBeNull();
  });
  it('rejects a disagreement with the explicit organization profile',()=>{
    const data=input();expect(privateWorkspacePresentation({...data,user:{...data.user,organization_profile:{tenant:{slug:'org-b'}}}}).identity).toBeNull();
  });
  it('does not infer an organization from account name or email',()=>{
    expect(privateWorkspacePresentation({...input(),user:{id:12,rol:'admin',name:'Personal name',email:'qa@example.com'}}).identity).toBeNull();
  });
  it('falls back to a neutral icon instead of loading a signed or unsafe logo URL',()=>{
    const data=input();expect(privateWorkspacePresentation({...data,user:{...data.user,logo_url:'https://cdn.example.com/image?token=private'}}).identity?.logoUrl).toBeNull();
  });
  it('does not display invisible controls in organization names',()=>{
    const data=input();expect(privateWorkspacePresentation({...data,user:{...data.user,nombre_empresa:'Name\u202einvalid'}}).identity).toBeNull();
  });
  it('preserves an organization with legacy underscores without renaming it',()=>{
    const data=input();expect(privateWorkspacePresentation({...data,currentSlug:'org_a',user:{...data.user,tenant_slug:'org_a',tenantSlug:'org_a'}}).identity?.tenantSlug).toBe('org_a');
  });
});
