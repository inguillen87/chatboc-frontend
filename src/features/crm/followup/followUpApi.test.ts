import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('@/utils/api',()=>({apiFetch:mock.fetch}));
import {followUpApi,FollowUpConflict,FollowUpUnconfirmed} from './followUpApi';
import {parseFollowUpHistory} from './followUpModel';
const identity={tenantSlug:'org-a',contactId:'contact-42'};
const history=(notes='',date:string|null=null)=>({contact:{id:'contact-42',name:'QA',preferences:{owner_notes:notes,next_action_at:date}}});
const baseline=()=>parseFollowUpHistory(history(),identity);
const desired={notes:'Llamar por la propuesta',nextActionAt:'2026-09-25T15:00:00Z'};
beforeEach(()=>{mock.fetch.mockReset();});
describe('follow-up preflight, persistence and verification',()=>{
  it('scopes a read without altering browser tenant context',async()=>{
    mock.fetch.mockResolvedValue(history());await followUpApi.read(identity);
    expect(mock.fetch).toHaveBeenCalledExactlyOnceWith('/api/admin/tenants/org-a/contacts/contact-42/history',{tenantSlug:'org-a',persistTenantSlug:false});
  });
  it('does not inherit a tenant for the global agenda',async()=>{
    mock.fetch.mockResolvedValue({items:[]});await followUpApi.list();
    expect(mock.fetch).toHaveBeenCalledExactlyOnceWith('/api/admin/crm/leads?limit=100',{omitTenant:true,persistTenantSlug:false});
  });
  it('sends only notes and next action after preflight, then verifies persisted values',async()=>{
    mock.fetch.mockResolvedValueOnce(history()).mockResolvedValueOnce({ok:true,contact:{contact_id:'contact-42'}}).mockResolvedValueOnce(history(desired.notes,desired.nextActionAt));
    const stages:string[]=[];const saved=await followUpApi.save(baseline(),desired,phase=>stages.push(phase));
    expect(saved.notes).toBe(desired.notes);expect(stages).toEqual(['checking','saving','verifying']);
    expect(mock.fetch).toHaveBeenNthCalledWith(2,'/api/admin/tenants/org-a/contacts/contact-42/stage',{method:'PATCH',tenantSlug:'org-a',persistTenantSlug:false,body:{owner_notes:desired.notes,next_action_at:desired.nextActionAt}});
    expect(mock.fetch).toHaveBeenCalledTimes(3);
  });
  it('does not write when another editor changed the contact before preflight',async()=>{
    mock.fetch.mockResolvedValue(history('Cambio de otro operador'));
    await expect(followUpApi.save(baseline(),desired)).rejects.toBeInstanceOf(FollowUpConflict);
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([401,403,404,500])('never writes after a failed preflight %s',async status=>{
    mock.fetch.mockRejectedValue({status});await expect(followUpApi.save(baseline(),desired)).rejects.toEqual({status});expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
  it.each([{ok:true,contact:{contact_id:'other'}},{ok:false,contact:{contact_id:'contact-42'}},{ok:true,contact:{id:'contact:contact-42'}}])('rejects an incomplete write receipt without retry',async receipt=>{
    mock.fetch.mockResolvedValueOnce(history()).mockResolvedValueOnce(receipt);
    await expect(followUpApi.save(baseline(),desired)).rejects.toMatchObject({acknowledged:false});expect(mock.fetch).toHaveBeenCalledTimes(2);
  });
  it('distinguishes an accepted write from a failed verification',async()=>{
    mock.fetch.mockResolvedValueOnce(history()).mockResolvedValueOnce({ok:true,contact:{contact_id:'contact-42'}}).mockRejectedValueOnce({status:403});
    await expect(followUpApi.save(baseline(),desired)).rejects.toMatchObject({acknowledged:true,status:403});expect(mock.fetch).toHaveBeenCalledTimes(3);
  });
  it('does not announce success when the persisted notes differ',async()=>{
    mock.fetch.mockResolvedValueOnce(history()).mockResolvedValueOnce({ok:true,contact:{contact_id:'contact-42'}}).mockResolvedValueOnce(history('Otro contenido',desired.nextActionAt));
    await expect(followUpApi.save(baseline(),desired)).rejects.toBeInstanceOf(FollowUpUnconfirmed);expect(mock.fetch).toHaveBeenCalledTimes(3);
  });
  it.each([{notes:'x'.repeat(1201),nextActionAt:null},{notes:'nota',nextActionAt:'2026-09-25T12:00'}])('validates before any HTTP request',async draft=>{
    await expect(followUpApi.save(baseline(),draft)).rejects.toThrow();expect(mock.fetch).not.toHaveBeenCalled();
  });
  it('clears the date explicitly while preserving the notes',async()=>{
    const base=parseFollowUpHistory(history('Nota anterior',desired.nextActionAt),identity);
    mock.fetch.mockResolvedValueOnce(history('Nota anterior',desired.nextActionAt)).mockResolvedValueOnce({ok:true,contact:{contact_id:'contact-42'}}).mockResolvedValueOnce(history('Nota anterior'));
    expect((await followUpApi.save(base,{notes:'Nota anterior',nextActionAt:null})).nextActionAt).toBeNull();
  });
});
describe('follow-up session lifetime',()=>{
  it('never starts a request for an inactive editor',async()=>{
    await expect(followUpApi.save(baseline(),desired,undefined,()=>false)).rejects.toMatchObject({name:'FollowUpSessionEnded'});
    expect(mock.fetch).not.toHaveBeenCalled();
  });
  it('does not write after the editor is abandoned during preflight',async()=>{
    let resolve!:(value:ReturnType<typeof history>)=>void;
    mock.fetch.mockReturnValueOnce(new Promise(r=>{resolve=r;}));
    let active=true;const saving=followUpApi.save(baseline(),desired,undefined,()=>active);
    const rejected=expect(saving).rejects.toMatchObject({name:'FollowUpSessionEnded'});
    active=false;resolve(history());await rejected;
    expect(mock.fetch).toHaveBeenCalledTimes(1);
  });
  it('does not start verification requests from a disposed editor after an acknowledged write',async()=>{
    let active=true;
    mock.fetch.mockResolvedValueOnce(history()).mockImplementationOnce(async()=>{active=false;return {ok:true,contact:{contact_id:'contact-42'}};});
    await expect(followUpApi.save(baseline(),desired,undefined,()=>active)).rejects.toMatchObject({acknowledged:true});
    expect(mock.fetch).toHaveBeenCalledTimes(2);
  });
});
