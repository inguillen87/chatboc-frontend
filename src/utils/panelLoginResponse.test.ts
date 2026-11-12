import {describe,expect,it} from 'vitest';
import {validatePanelLoginResponse} from './panelLoginResponse';
const email='operator@example.invalid';
const response=()=>({token:'synthetic-new-session',user:{id:7,email,rol:'admin',tenant_slug:'organization-a'}});
describe('verified credential login response',()=>{
  it('accepts the server identity without consulting browser history',()=>{
    expect(validatePanelLoginResponse(response(),email,null).user.tenant_slug).toBe('organization-a');
  });
  it('accepts the same identity through the matching organization entry',()=>{
    expect(validatePanelLoginResponse(response(),email,'organization-a').user.id).toBe(7);
  });
  it('rejects another organization even when the credentials authenticate',()=>{
    expect(()=>validatePanelLoginResponse(response(),email,'organization-b')).toThrow(/otra organización/);
  });
  it.each([null,{},[],{token:'new'},{token:'',user:response().user},{token:'white space',user:response().user}])('rejects an incomplete reply %j',value=>{
    expect(()=>validatePanelLoginResponse(value,email,null)).toThrow();
  });
  it.each([0,-1,1.5,'7',null])('does not invent a user id %j',id=>{
    expect(()=>validatePanelLoginResponse({...response(),user:{...response().user,id}},email,null)).toThrow();
  });
  it('rejects conflicting tenant and role aliases',()=>{
    expect(()=>validatePanelLoginResponse({...response(),user:{...response().user,tenantSlug:'organization-b'}},email,null)).toThrow();
    expect(()=>validatePanelLoginResponse({...response(),user:{...response().user,role:'superadmin'}},email,null)).toThrow();
  });
  it('requires an institutional tenant and a known administrative role',()=>{
    expect(()=>validatePanelLoginResponse({...response(),user:{...response().user,tenant_slug:null}},email,null)).toThrow();
    expect(()=>validatePanelLoginResponse({...response(),user:{...response().user,rol:'vecino'}},email,null)).toThrow();
  });
  it('rejects a response for a different submitted account',()=>{
    expect(()=>validatePanelLoginResponse(response(),'other@example.invalid',null)).toThrow();
  });
  it('normalizes casing but never derives an organization from email',()=>{
    const value={...response(),user:{...response().user,email:email.toUpperCase(),tenant_slug:'Organization-A'}};
    expect(validatePanelLoginResponse(value,email,null).user.tenant_slug).toBe('organization-a');
  });
});

describe('legacy organization identifiers',()=>{
  it('preserves an existing underscore rather than rewriting its organization id',()=>{
    const value={...response(),user:{...response().user,tenant_slug:'local_comercial_general'}};
    expect(validatePanelLoginResponse(value,email,'local_comercial_general').user.tenant_slug).toBe('local_comercial_general');
  });
});
