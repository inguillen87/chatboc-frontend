import {describe,expect,it} from 'vitest';
import {assertPresenceIdentity,parseOrganizationPresence,safePresenceUrl,sharedPublicPresence,centralPresenceEntry} from './organizationPresence';
const identity={id:7,slug:'org-a'};
const config=()=>({tenant:{slug:'org-a',nombre:'Organización A',logo_url:'/logo.png',theme_json:{light:{primary:'#123abc'}}},configs:{private:{secret:'not-for-the-interface'}}});
const published=()=>({tenant:{id:7,slug:'org-a',nombre:'Organización A',logo_url:'/logo.png',theme_config:{light:{primary:'#123abc'}},dominio:'marca.example.com'},widget_token:'not-for-the-interface'});
describe('organization presence contracts',()=>{
  it('selects only the identity and safe public fields',()=>{
    const result=parseOrganizationPresence(config(),published(),identity);
    expect(result.differences).toEqual([]);expect(result.domain).toBe('https://marca.example.com');
    expect(result.configured.name).toBe('Organización A');expect(JSON.stringify(result)).not.toContain('not-for-the-interface');
    expect(result.identity).toEqual(identity);
  });
  it.each(['../another','space here','org/a','','org?x=y'])('rejects ambiguous organization identity %s',slug=>{
    expect(()=>assertPresenceIdentity({id:7,slug})).toThrow();
  });
  it.each([0,-1,1.5,NaN])('requires a positive integer organization id %s',id=>expect(()=>assertPresenceIdentity({id,slug:'org-a'})).toThrow());
  it('rejects a foreign configuration before presenting its values',()=>{
    expect(()=>parseOrganizationPresence({tenant:{...config().tenant,slug:'org-b'}},published(),identity)).toThrow();
  });
  it('requires the public organization id, rather than assuming its list identity',()=>{
    expect(()=>parseOrganizationPresence(config(),{tenant:{slug:'org-a',nombre:'A'}},identity)).toThrow();
    expect(()=>parseOrganizationPresence(config(),{tenant:{...published().tenant,id:8}},identity)).toThrow();
  });
  it('reports differences without inventing which response is newer',()=>{
    const value=published();value.tenant.nombre='Otra marca';value.tenant.logo_url='/other.png';value.tenant.theme_config.light.primary='#ffffff';
    expect(parseOrganizationPresence(config(),value,identity).differences).toEqual(['name','logo','color']);
  });
  it('leaves an absent domain missing rather than deriving it from the slug',()=>{
    const value=published();value.tenant.dominio='';const model=parseOrganizationPresence(config(),value,identity);
    expect(model.domainState).toBe('missing');expect(model.domain).toBeNull();
  });
  it.each(['javascript:alert(1)','http://marca.example.com','https://user:pass@marca.example.com','https://127.0.0.1','https://[::1]','https://intranet.local','https://marca.example.com/login','https://marca.example.com?token=secret','//evil.example.com'])('does not offer an unsafe domain %s',url=>{
    expect(safePresenceUrl(url,'domain')).toBeNull();
  });
  it('allows public image transforms but never signed or credential-bearing image links',()=>{
    expect(safePresenceUrl('https://cdn.example.com/logo.png?w=128&format=webp','logo')).toContain('w=128');
    expect(safePresenceUrl('https://cdn.example.com/logo.png?token=secret','logo')).toBeNull();
    expect(safePresenceUrl('data:image/svg+xml,<svg/>','logo')).toBeNull();
  });
  it('does not reuse an API or preview origin for share links',()=>{
    expect(centralPresenceEntry()).toBe('https://www.chatboc.ar/login');
    expect(sharedPublicPresence(identity)).toBe('https://www.chatboc.ar/t/org-a');
  });
  it('shows no invalid primary CSS and no hidden text controls',()=>{
    const value=config();value.tenant.theme_json.light.primary='url(https://other.example.com)';
    expect(parseOrganizationPresence(value,published(),identity).configured.primary).toBeNull();
    value.tenant.nombre='Private\u202econtrol';expect(()=>parseOrganizationPresence(value,published(),identity)).toThrow();
  });
});
