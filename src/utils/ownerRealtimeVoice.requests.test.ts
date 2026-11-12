import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { safeLocalStorage } from './safeLocalStorage';
import { usePanelSessionStore, useWidgetSessionStore, useTenantStore } from '@/stores';
import { resetBackendBootstrapGateForTests } from './backendBootstrapGate';

vi.mock('@/config', async importOriginal => ({ ...await importOriginal<typeof import('@/config')>(),
  API_BASE_CANDIDATES:['/api','https://other.example.invalid'], BASE_API_URL:'/api', SAME_ORIGIN_PROXY_BASE:'/api' }));
let apiFetch:typeof import('./api').apiFetch;
const originalFetch=global.fetch;
const base='/api/admin/tenants/a/realtime/browser';
const options={ tenantSlug:'a', singleAttempt:true, isWidgetRequest:false, persistTenantSlug:false,
  omitEntityToken:true, omitChatSessionId:true, suppressPanel401Redirect:true,
  preserveAuthOn401:true, allowSafeBaseFallback:false };
beforeAll(async()=>{ apiFetch=(await vi.importActual<typeof import('./api')>('./api')).apiFetch; });
beforeEach(()=>{
  safeLocalStorage.clear();useTenantStore.getState().clearTenant();
  usePanelSessionStore.setState({authToken:'synthetic-owner-token',user:null});
  useWidgetSessionStore.setState({chatAuthToken:'synthetic-public-widget-token',entityToken:'synthetic-entity'});
  safeLocalStorage.setItem('tenantSlug','foreign-public');
  (window as any).CHATBOC_CONFIG={entityToken:'synthetic-public-entity'};
});
afterEach(()=>{
  global.fetch=originalFetch;vi.restoreAllMocks();resetBackendBootstrapGateForTests();
  safeLocalStorage.clear();useTenantStore.getState().clearTenant();
  usePanelSessionStore.setState({authToken:null,user:null});
  useWidgetSessionStore.setState({chatAuthToken:null,entityToken:null});
  delete (window as any).CHATBOC_CONFIG;window.history.replaceState({},'','/');
});
it.each(['/widget/a','/perfil'])('uses exact owner and tenant on %s without public-token fallback',async location=>{
  window.history.replaceState({},'',location);
  global.fetch=vi.fn().mockResolvedValue(new Response('{"enabled":false}',{headers:{'Content-Type':'application/json'}}));
  await apiFetch(base+'/capabilities',options);
  expect(global.fetch).toHaveBeenCalledOnce();
  const request=vi.mocked(global.fetch).mock.calls[0][1]!;
  const headers=new Headers(request.headers);
  expect(headers.get('Authorization')).toBe('Bearer synthetic-owner-token');
  expect(headers.get('X-Tenant')).toBe('a');
  expect(headers.has('X-Token')).toBe(false);expect(headers.has('X-Entity-Token')).toBe(false);
  expect(headers.has('X-Chat-Session-Id')).toBe(false);
  expect(request.credentials).toBe('include');expect(request.redirect).toBe('error');
  expect(safeLocalStorage.getItem('tenantSlug')).toBe('foreign-public');
});
it.each(['/sessions','/sessions/'+ 'a'.repeat(32)+'/stop'])('never retries an ambiguous POST %s on any base',async suffix=>{
  global.fetch=vi.fn().mockRejectedValue(new TypeError('synthetic response lost'));
  await expect(apiFetch(base+suffix,{...options,method:'POST',body:{}})).rejects.toThrow();
  expect(global.fetch).toHaveBeenCalledOnce();
  expect(vi.mocked(global.fetch).mock.calls[0][1]).toMatchObject({method:'POST',redirect:'error'});
});
