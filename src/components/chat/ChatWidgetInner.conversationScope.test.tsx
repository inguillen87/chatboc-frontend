import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tenantService } from '@/services/tenantService';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
import { captureWidgetConversationScope } from '@/utils/widgetConversationScope';
import type { WidgetCommerceSession } from '@/types/widgetCommerce';

vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/utils/backendBootstrapGate', () => ({ ensureBackendRuntimeReady: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: vi.fn().mockResolvedValue('synthetic-visitor') }));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(), API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ tenant: null, currentSlug: null }) }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: null }) }));
vi.mock('@/hooks/useCartCount', () => ({ useCartCount: () => 0 }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('./ChatPanel', () => ({ default: ({commerceSession}:{commerceSession?:WidgetCommerceSession|null}) =>
  <div data-testid="commerce-owner">{commerceSession?.tenant?.slug||'sin sesión comercial'}</div> }));
vi.mock('./AccessibilityToggle', () => ({ default: () => null, ACCESSIBILITY_EVENT: 'test-accessibility-change', readAccessibilityPrefs: () => ({}) }));
vi.mock('./ChatbocLogoAnimated', () => ({ default: () => <span aria-hidden="true">logo</span> }));
import ChatWidgetInner from './ChatWidgetInner';

const originalFetch = global.fetch;
const tenant = 'qa-commerce';
const adopted = 'a1111111-1111-4111-8111-111111111111';
const another = 'b2222222-2222-4222-8222-222222222222';
const requests: Array<{ session: string; header: string | null }> = [];
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const element = (slug=tenant) => <React.Suspense fallback={null}><MemoryRouter initialEntries={['/t/'+slug]}>
  <ChatWidgetInner mode="standalone" defaultOpen tenantSlug={slug}/>
</MemoryRouter></React.Suspense>;
const mount = () => render(element());
const flush = () => act(async () => { for (let i=0; i<30; i++) await Promise.resolve(); });

beforeEach(() => {
  localStorage.clear(); requests.length=0;
  window.history.replaceState({}, '', '/t/'+tenant);
  usePanelSessionStore.setState({ authToken:null, user:null });
  useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ status:'ready', entityToken:null, chatAuthToken:null });
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((media:string) => ({ matches:false, media, onchange:null,
    addEventListener:vi.fn(), removeEventListener:vi.fn(), addListener:vi.fn(), removeListener:vi.fn(), dispatchEvent:vi.fn() })));
  vi.spyOn(tenantService,'getPlatformWidgetConfig').mockResolvedValue(null);
  vi.spyOn(tenantService,'getPublicWidgetConfig').mockResolvedValue({ contract_version:'public.widget_config.v1', slug:tenant,
    tenant_name:'Comercio de prueba', tipo_chat:'pyme', welcome_title:'Consulta pública', welcome_subtitle:'Asistente de prueba' });
});
afterEach(() => { cleanup(); global.fetch=originalFetch; vi.restoreAllMocks(); vi.unstubAllGlobals();
  localStorage.clear(); useTenantStore.getState().clearTenant(); window.history.replaceState({}, '', '/'); });

describe('mounted widget cart session adoption with real scope and HTTP adapter', () => {
  it('retires the prior tenant DTO before composing new history and cart requests while its replacement session is pending', async () => {
    vi.mocked(tenantService.getPublicWidgetConfig).mockImplementation(async slug=>({contract_version:'public.widget_config.v1',
      slug,tenant_name:'Comercio de prueba',tipo_chat:'pyme',owner_token:'synthetic-owner-'+slug}));
    const sent:Array<{path:string;tenant:string|null;sessionToken:string|null}>=[];
    global.fetch=vi.fn(async (input:RequestInfo|URL) => {
      const url=new URL(String(input),window.location.origin),slug=url.searchParams.get('tenant_slug');
      sent.push({path:url.pathname,tenant:slug,sessionToken:url.searchParams.get('widget_session_token')});
      if(url.pathname.includes('/widget-commerce-session')){
        if(slug==='qa-replacement')return new Promise<Response>(()=>{});
        return json({tenant:{slug:tenant},session:{chat_session_id:url.searchParams.get('chat_session_id'),widget_session_token:'synthetic-session-A'},
          portal:{history_endpoint:'/api/old-owner-history'},cart:{summary_endpoint:'/api/old-owner-cart'}});
      }
      return json({tenant:{slug:slug||tenant},items_count:0});
    });
    const view=mount();
    await waitFor(()=>expect(view.getByTestId('commerce-owner')).toHaveTextContent(tenant));
    await waitFor(()=>expect(sent.some(value=>value.path==='/api/old-owner-history')).toBe(true));
    const boundary=sent.length;
    view.rerender(element('qa-replacement'));
    await waitFor(()=>expect(sent.some(value=>value.path.includes('/widget-commerce-session')&&value.tenant==='qa-replacement')).toBe(true));
    await flush();
    expect(view.getByTestId('commerce-owner')).not.toHaveTextContent(tenant);
    expect(sent.slice(boundary).some(value=>value.path.startsWith('/api/old-owner-')||value.sessionToken==='synthetic-session-A'||value.tenant===tenant)).toBe(false);
  });

  it.each(['missing','wrong'] as const)('does not adopt a different session without the current declared tenant: %s', async kind => {
    global.fetch=vi.fn(async (input:RequestInfo|URL, init?:RequestInit) => {
      const url=new URL(String(input),window.location.origin);
      if(url.pathname.includes('/cart/summary')){
        requests.push({session:url.searchParams.get('chat_session_id')!,header:new Headers(init?.headers).get('X-Chat-Session-Id')});
        return json({...(kind==='wrong'?{tenant:{slug:'qa-foreign'}}:{}),session:{chat_session_id:adopted},items_count:1});
      }
      return json({});
    });
    mount(); await waitFor(()=>expect(requests).toHaveLength(1)); await flush();
    const owner=await captureWidgetConversationScope({tenantSlug:tenant,skipAuth:true});
    expect(owner.sessionId).toBe(requests[0].session); expect(owner.sessionId).not.toBe(adopted);
    expect(requests[0].header).toBe(requests[0].session);
    expect(localStorage.getItem('chat_session_id')).toBeNull();
  });

  it.each(['echo','another'] as const)('refreshes after one confirmed adoption and stops at a stable owner: %s', async next => {
    global.fetch=vi.fn(async (input:RequestInfo|URL, init?:RequestInit) => {
      const url=new URL(String(input),window.location.origin);
      if(url.pathname.includes('/cart/summary')){
        requests.push({session:url.searchParams.get('chat_session_id')!,header:new Headers(init?.headers).get('X-Chat-Session-Id')});
        return json({tenant:{slug:tenant},session:{chat_session_id:requests.length===1||next==='echo'?adopted:another},items_count:1});
      }
      return json({});
    });
    mount(); await waitFor(()=>expect(requests).toHaveLength(2)); await flush();
    const owner=await captureWidgetConversationScope({tenantSlug:tenant,skipAuth:true});
    expect(requests[0].session).not.toBe(adopted); expect(requests[1].session).toBe(adopted);
    expect(requests.every(value=>value.header===value.session)).toBe(true);
    expect(owner.sessionId).toBe(adopted); expect(owner.isCurrent()).toBe(true);
    expect(requests).toHaveLength(2); expect(localStorage.getItem('chat_session_id')).toBeNull();
  });
});
