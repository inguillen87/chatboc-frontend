import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError } from '@/utils/api';
import { domainPayload, domainScope } from '@/test/fixtures/tenantDomain';
import { getTenantDomain, readTenantDomain, saveTenantDomain, tenantDomainErrorMessage } from './tenantDomain';
vi.mock('@/utils/api',async original=>({...await original<typeof import('@/utils/api')>(),apiFetch:vi.fn()}));
beforeEach(()=>vi.mocked(apiFetch).mockReset());
describe('domain lifecycle contract',()=>{
  it('keeps DNS pending distinct from platform publication and never treats it as active',()=>{
    expect(readTenantDomain(domainPayload(),domainScope)).toMatchObject({status:'pending_dns',active:false,provider_changes_performed:false});
    expect(readTenantDomain(domainPayload({status:'pending_platform',dns_proof:null}),domainScope)).toMatchObject({status:'pending_platform',active:false,valid_until:null});
  });
  it.each([
    {tenant:{id:18,slug:domainScope.slug}}, {tenant:{id:17,slug:'old-workspace'}}, {revision:'legacy'},
    {active:true}, {status:'active',active:true,dns_proof:null,valid_until:1}, {status:'live'},
    {host:'https://evil.test/'}, {save_endpoint:'/api/admin/tenants/old-workspace/domain'},
    {provider_changes_performed:true}, {dns_proof:{type:'TXT',name:'_chatboc-verify.other.test',value:'anything',expires_at:1}},
  ])('rejects malformed, foreign or falsely active state %j',patch=>expect(()=>readTenantDomain(domainPayload(patch),domainScope)).toThrow());
  it('reads exact private scope with a single attempt and no widget credentials',async()=>{
    vi.mocked(apiFetch).mockResolvedValue(domainPayload());
    await getTenantDomain(domainScope,()=>true);
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/tenants/government-east/domain',expect.objectContaining({tenantSlug:domainScope.slug,persistTenantSlug:false,isWidgetRequest:false,omitEntityToken:true,omitChatSessionId:true,singleAttempt:true}));
  });
  it.each(['request','verify_dns','revoke'] as const)('writes only the supported %s operation with exact revision',async operation=>{
    const current=readTenantDomain(domainPayload(),domainScope);
    vi.mocked(apiFetch).mockResolvedValue({contract_version:'organization.domain_save.v1',saved:true,domain:domainPayload({revision:'c'.repeat(64)})});
    await saveTenantDomain(domainScope,current,operation,operation==='request'?' ATENCION.example.test. ':undefined,()=>true);
    expect(vi.mocked(apiFetch).mock.calls[0][1]?.body).toEqual({expected_revision:'a'.repeat(64),operation,...(operation==='request'?{host:'atencion.example.test'}:{})});
    expect(JSON.stringify(vi.mocked(apiFetch).mock.calls[0][1]?.body)).not.toMatch(/activate|verified|active|provider/);
  });
  it('rejects stale readback and a save that does not confirm the exact organization',async()=>{
    vi.mocked(apiFetch).mockResolvedValue(domainPayload());
    await expect(getTenantDomain(domainScope,()=>false)).rejects.toMatchObject({name:'AbortError'});
    vi.mocked(apiFetch).mockResolvedValue({contract_version:'organization.domain_save.v1',saved:true,domain:domainPayload({tenant:{id:18,slug:domainScope.slug}})});
    await expect(saveTenantDomain(domainScope,readTenantDomain(domainPayload(),domainScope),'verify_dns',undefined,()=>true)).rejects.toThrow();
  });
  it('uses fixed reasons rather than revealing provider diagnostics',()=>{
    const error=new ApiError('provider diagnostic',503,{reason_code:'domain_dns_unavailable',error:'private token diagnostic'});
    expect(tenantDomainErrorMessage(error)).toBe('No pudimos consultar el DNS. Podés reintentar sin perder la dirección.');
    expect(tenantDomainErrorMessage(new Error('private token diagnostic'))).not.toContain('private');
  });
});
