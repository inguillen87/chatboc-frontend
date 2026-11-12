import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tenantHostFixture } from '@/test/fixtures/tenantHost';
import { publishTenantHostRuntime } from './tenantHostBinding';
import { apiFetch, resolveTenantSlug } from './api';
vi.mock('@/utils/api',async()=>await vi.importActual('@/utils/api'));
vi.mock('@/utils/backendBootstrapGate',()=>({ensureBackendRuntimeReady:vi.fn().mockResolvedValue(undefined)}));
vi.mock('@/config',async original=>({...await original<typeof import('@/config')>(),API_BASE_CANDIDATES:['https://api.chatboc.ar/api'],BASE_API_URL:'https://api.chatboc.ar/api',SAME_ORIGIN_PROXY_BASE:'/api'}));
beforeEach(()=>{
  localStorage.clear();localStorage.setItem('tenantSlug','old-workspace');localStorage.setItem('user',JSON.stringify({tenant_slug:'old-workspace'}));
  const original=window;vi.stubGlobal('window',new Proxy(original,{get(target,key){return key==='location'?{hostname:'atencion.example.test',origin:'https://atencion.example.test',pathname:'/',search:'?tenant_slug=old-workspace',hash:''}:Reflect.get(target,key);}}));
});
afterEach(()=>{publishTenantHostRuntime(null);vi.unstubAllGlobals();localStorage.clear();});
describe('API tenant binding on custom hosts',()=>{
  it('cannot infer from user/storage/query or the first DNS label before binding',()=>{
    expect(()=>resolveTenantSlug(null,'/public/news')).toThrow();expect(()=>resolveTenantSlug('old-workspace','/public/news')).toThrow();
  });
  it('uses the exact active hostname tenant without overwriting an old platform selection',()=>{
    publishTenantHostRuntime(tenantHostFixture());
    expect(resolveTenantSlug(null,'/public/news')).toBe('government-east');
    expect(localStorage.getItem('tenantSlug')).toBe('old-workspace');
  });
  it('rejects mismatched explicit tenant or canonical API path',()=>{
    publishTenantHostRuntime(tenantHostFixture());
    expect(()=>resolveTenantSlug('old-workspace','/public/news')).toThrow();
    expect(()=>resolveTenantSlug(null,'/api/public/tenants/old-workspace/public-navigation')).toThrow();
    expect(()=>resolveTenantSlug(null,'/api/admin/tenants/old-workspace/domain')).toThrow();
    expect(()=>resolveTenantSlug(null,'/api/public/news?tenant=government-east&tenant=old-workspace')).toThrow();
    expect(()=>resolveTenantSlug(null,'https://api.chatboc.ar/api/public/news')).toThrow();
    expect(resolveTenantSlug('government-east','/api/public/tenants/government-east/public-navigation')).toBe('government-east');
    expect(resolveTenantSlug('government-east','/api/ask/municipio')).toBe('government-east');
  });
  it('keeps a bound public read on the same-origin proxy without widening CORS or changing stored selection',async()=>{
    publishTenantHostRuntime(tenantHostFixture());
    const fetchMock=vi.fn().mockResolvedValue(new Response('{}',{headers:{'Content-Type':'application/json'}}));vi.stubGlobal('fetch',fetchMock);
    await apiFetch('/api/public/news',{skipAuth:true,omitCredentials:true,omitEntityToken:true,omitChatSessionId:true,persistTenantSlug:false,isWidgetRequest:false});
    expect(fetchMock).toHaveBeenCalledOnce();
    const [path,options]=fetchMock.mock.calls[0];
    expect(String(path).startsWith('/api/public/news?')).toBe(true);
    expect(new URL(String(path),'https://atencion.example.test').searchParams.get('tenant_slug')).toBe('government-east');
    expect(new Headers(options.headers).get('X-Tenant')).toBe('government-east');
    expect(options.credentials).toBe('omit');expect(localStorage.getItem('tenantSlug')).toBe('old-workspace');
  });
  it('does not allow omitTenant to bypass a foreign route or repeated query while keeping global identity available',async()=>{
    publishTenantHostRuntime(tenantHostFixture());
    const fetchMock=vi.fn().mockResolvedValue(new Response('{}',{headers:{'Content-Type':'application/json'}}));vi.stubGlobal('fetch',fetchMock);
    const isolated={omitTenant:true,omitEntityToken:true,omitChatSessionId:true,isWidgetRequest:false,singleAttempt:true};
    await expect(apiFetch('/api/admin/tenants/old-workspace/domain',isolated)).rejects.toThrow();
    await expect(apiFetch('/api/me?tenant=government-east&tenant=old-workspace',isolated)).rejects.toThrow();
    await expect(apiFetch('/api/public%2Ftenants%2Fold-workspace',isolated)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    await apiFetch('/api/me',isolated);expect(fetchMock).toHaveBeenCalledOnce();
  });
});
