import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({post:vi.fn()}));
vi.mock('@/api/v2/client',()=>({panelApi:{post:mocks.post}}));
import { postOmnichannelInboxActionV2 } from './saas';
const request = {action:'claim',payload:{source_model:'MunicipioTicket',ticket_id:12}};
const receipt = {
  ok:true,contract_version:'inbox.omnichannel.action.v1',action:'claim',tenant_slug:'org-a',
  ticket:{id:'municipio:12',ticket_id:12,source_model:'MunicipioTicket',tenant_slug:'org-a'},
};
beforeEach(()=>mocks.post.mockReset());
describe('ownership receipt exact identity',()=>{
  it.each(['claim','assign'])('accepts the published composite receipt for a numeric %s route',async action=>{
    mocks.post.mockResolvedValue({...receipt,action});
    await expect(postOmnichannelInboxActionV2('12',{...request,action},'org-a')).resolves.toBeDefined();
    expect(mocks.post).toHaveBeenCalledOnce();
    expect(mocks.post.mock.calls[0][0]).toBe('/api/v2/inbox/omnichannel/12/actions');
    expect(mocks.post.mock.calls[0][1]).toMatchObject({ticket_id:12,source_model:'MunicipioTicket',action});
  });
  it.each(['12',12,'tenant:12'])('accepts coherent TenantTicket identity %j',async id=>{
    mocks.post.mockResolvedValue({...receipt,ticket:{...receipt.ticket,id,source_model:'TenantTicket'}});
    await expect(postOmnichannelInboxActionV2('12',{action:'claim',payload:{source_model:'TenantTicket',ticket_id:12}},'org-a')).resolves.toBeDefined();
  });
  it.each([
    {id:'municipio:13'},{ticket_id:13},{legacy_id:13},{id:'tenant:12'},
    {source_model:'TenantTicket'},{source_model:undefined},{id:''},{ticket_id:null},
    {id:'anything:12'},{id:'municipio:012'},{tenant_slug:'org-b'},
  ])('rejects inconsistent receipt fields %j without resending',async patch=>{
    mocks.post.mockResolvedValue({...receipt,ticket:{...receipt.ticket,...patch}});
    await expect(postOmnichannelInboxActionV2('12',request,'org-a')).rejects.toThrow();
    expect(mocks.post).toHaveBeenCalledOnce();
  });
  it.each([{action:'assign'},{ok:false},{source_model:'TenantTicket'},{ticket:{source_model:'MunicipioTicket'}},{ticket:{}}])('rejects incomplete or contradictory envelope %j',async patch=>{
    mocks.post.mockResolvedValue({...receipt,...patch});
    await expect(postOmnichannelInboxActionV2('12',request,'org-a')).rejects.toThrow();
    expect(mocks.post).toHaveBeenCalledOnce();
  });
  it('rejects request identity disagreement before making a write',async()=>{
    await expect(postOmnichannelInboxActionV2('12',{action:'claim',payload:{source_model:'MunicipioTicket',ticket_id:13}},'org-a')).rejects.toThrow();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
