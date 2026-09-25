import {beforeEach,describe,expect,it,vi} from 'vitest';
const fetch=vi.hoisted(()=>vi.fn());
vi.mock('@/utils/api',()=>({apiFetch:fetch}));
import {readOrganizationPresence} from './organizationPresenceApi';
const identity={id:7,slug:'org-a'};
const config={tenant:{slug:'org-a',nombre:'Organización A'}};
const published={tenant:{id:7,slug:'org-a',nombre:'Organización A'}};
beforeEach(()=>{ fetch.mockReset(); });
describe('presence read protocol',()=>{
  it('checks authorized configuration before reading public identity without ambient credentials',async()=>{
    fetch.mockResolvedValueOnce(config).mockResolvedValueOnce(published);
    await expect(readOrganizationPresence(identity,()=>true)).resolves.toMatchObject({identity});
    expect(fetch).toHaveBeenNthCalledWith(1,'/api/admin/tenants/org-a/config',expect.objectContaining({tenantSlug:'org-a',persistTenantSlug:false}));
    expect(fetch).toHaveBeenNthCalledWith(2,'/public/tenant',expect.objectContaining({tenantSlug:'org-a',persistTenantSlug:false,skipAuth:true,omitCredentials:true,omitEntityToken:true,omitChatSessionId:true}));
    expect(fetch.mock.calls.every(([,options])=>!options.method)).toBe(true);
  });
  it.each([401,403,404,500])('stops on administrative failure %s',async status=>{
    fetch.mockRejectedValue({status});await expect(readOrganizationPresence(identity,()=>true)).rejects.toEqual({status});expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not read public data after the organization session is abandoned',async()=>{
    let active=true;fetch.mockImplementationOnce(async()=>{active=false;return config;});
    await expect(readOrganizationPresence(identity,()=>active)).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not continue from a mismatched administrative identity',async()=>{
    fetch.mockResolvedValueOnce({tenant:{slug:'org-b',nombre:'Other'}});
    await expect(readOrganizationPresence(identity,()=>true)).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('never treats public failure as a successful brand verification',async()=>{
    fetch.mockResolvedValueOnce(config).mockRejectedValueOnce({status:503});
    await expect(readOrganizationPresence(identity,()=>true)).rejects.toEqual({status:503});expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('starts no network request for a disposed session',async()=>{
    await expect(readOrganizationPresence(identity,()=>false)).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
  });
});
