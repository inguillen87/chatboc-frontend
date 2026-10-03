import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loginPanelWithCredentials } from './panelLogin';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { readPanelLoginScope } from '@/utils/panelLoginScope';
import { completePanelCredentialLogin } from '@/utils/completePanelCredentialLogin';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { resetBackendBootstrapGateForTests } from '@/utils/backendBootstrapGate';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';

vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));

describe('panel credential login transport', () => {
  beforeEach(() => {
    resetBackendBootstrapGateForTests();
    usePanelSessionStore.setState({authToken:null,user:null});
    useWidgetSessionStore.setState({chatAuthToken:null,entityToken:null});
    safeLocalStorage.clear();
    safeLocalStorage.setItem('tenantSlug', 'previous-public-space');
    safeLocalStorage.setItem('authToken', 'previous-session');
    safeLocalStorage.setItem('entityToken', 'previous-widget');
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ token: 'new-session', user: { id:7, email:'operator@example.test', rol:'admin', tenant_slug: 'organization-a' } }), { headers: { 'Content-Type': 'application/json' } })));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); safeLocalStorage.clear(); resetBackendBootstrapGateForTests(); });

  it('sends global credentials without a previously visited tenant, entity token or bearer', async () => {
    await loginPanelWithCredentials('operator@example.test', 'test-only-password', '/login');
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).not.toMatch(/tenant[=_]/);
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'operator@example.test', password: 'test-only-password' });
    const headers = new Headers(init?.headers);
    for (const key of ['X-Tenant', 'X-Tenant-Slug', 'X-Entity-Token', 'X-Token', 'Authorization', 'X-Chat-Session-Id']) expect(headers.has(key)).toBe(false);
    expect(init?.credentials).toBe('omit');
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('previous-public-space');
  });

  it.each(['/t/organization-a/login', '/municipio/organization-a/login', '/organization-a/login'])('uses the explicit organization in %s without persisting it before authentication', async path => {
    await loginPanelWithCredentials('operator@example.test', 'test-only-password', path);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(new URL(String(url), 'https://local.test').searchParams.get('tenant_slug')).toBe('organization-a');
    expect(JSON.parse(String(init?.body)).tenant_slug).toBe('organization-a');
    expect(new Headers(init?.headers).get('X-Tenant')).toBe('organization-a');
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('previous-public-space');
  });

  it.each(['/t/default/login', '/t/a%2Fb/login', '/t/%ZZ/login', '/t/org/login/extra'])('rejects an ambiguous login route %s before sending credentials', async path => {
    await expect(loginPanelWithCredentials('operator@example.test', 'test-only-password', path)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('normalizes route casing and accepts the global trailing slash', () => {
    expect(readPanelLoginScope('/login/')).toEqual({ valid: true, tenantSlug: null });
    expect(readPanelLoginScope('/t/Organization-A/login/')).toEqual({ valid: true, tenantSlug: 'organization-a' });
  });

  const startup = (changes={},status=503,header='initializing') => new Response(JSON.stringify({
    contract_version:'chatboc.bootstrap.v1',status_code:503,ok:false,reason_code:'application_initializing',
    retryable:true,request_dispatched:false,action_hint:'retry_after',...changes,
  }),{status,headers:{'Content-Type':'application/json','X-Chatboc-Bootstrap':header,'Retry-After':'0'}});
  const account = () => new Response(JSON.stringify({token:'synthetic-test-session',user:{
    id:7,email:'operator@example.test',rol:'admin',tenant_slug:'organization-a',
  }}),{headers:{'Content-Type':'application/json'}});

  it('continues five undispatched login receipts using the frozen attempt and commits only its verified success',async()=>{
    let sent=0;
    const request={email:'operator@example.test',password:'fixture-only-password',pathname:'/login',search:'',isCurrent:()=>true,setUser:vi.fn()};
    vi.mocked(fetch).mockImplementation(async url=>{
      if(String(url).endsWith('/version')){
        safeLocalStorage.setItem('tenantSlug','other-public-space');
        useWidgetSessionStore.setState({chatAuthToken:'synthetic-widget-only'});
        return new Response('{"backend":"fixture","frontend":"web"}');
      }
      expect(usePanelSessionStore.getState().authToken).toBeNull();
      request.email='other@example.test';request.password='changed-fixture';
      return ++sent<=5?startup():account();
    });
    await expect(completePanelCredentialLogin(request)).resolves.toMatchObject({destination:'/perfil',user:{id:7,tenant_slug:'organization-a'}});
    const calls=vi.mocked(fetch).mock.calls.filter(([url])=>!String(url).endsWith('/version'));
    expect(calls).toHaveLength(6);expect(calls.every(call=>JSON.stringify(call)===JSON.stringify(calls[0]))).toBe(true);
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({email:'operator@example.test',password:'fixture-only-password'});
    expect(calls[0][1]?.redirect).toBe('error');expect(request.setUser).toHaveBeenCalledOnce();
    expect(usePanelSessionStore.getState().authToken).toBe('synthetic-test-session');
  });

  it.each(['screen','session-revision'] as const)('retires recovery without committing a session when %s changes',async change=>{
    let current=true;
    const request={email:'operator@example.test',password:'fixture-only-password',pathname:'/login',search:'',isCurrent:()=>current,setUser:vi.fn()};
    vi.mocked(fetch).mockImplementation(async url=>{
      if(String(url).endsWith('/version')){
        if(change==='screen')current=false;else advanceChatbocSessionRevision();
        return new Response('{"backend":"fixture","frontend":"web"}');
      }
      return startup();
    });
    await expect(completePanelCredentialLogin(request)).rejects.toMatchObject({name:'ObsoletePanelLogin'});
    expect(vi.mocked(fetch).mock.calls.filter(([url])=>!String(url).endsWith('/version'))).toHaveLength(1);
    expect(request.setUser).not.toHaveBeenCalled();expect(safeLocalStorage.getItem('authToken')).toBe('previous-session');
  });

  it.each([
    [{request_dispatched:true},503,'initializing'],
    [{reason_code:'application_initialization_failed'},503,'initializing'],
    [{reason_code:'auth_service_unavailable'},503,'initializing'],
    [{},503,''],[{},401,'initializing'],[{},403,'initializing'],
  ] as const)('does not repeat rejected or ambiguous password login %j',async(changes,status,header)=>{
    vi.mocked(fetch).mockImplementation(async()=>startup(changes,status,header));
    await expect(loginPanelWithCredentials('operator@example.test','fixture-only-password','/login')).rejects.toMatchObject({status});
    expect(fetch).toHaveBeenCalledOnce();expect(safeLocalStorage.getItem('authToken')).toBe('previous-session');
  });

  it('never changes the destination or repeats credentials after a lost network response',async()=>{
    vi.mocked(fetch).mockRejectedValue(new TypeError('fixture network loss'));
    await expect(loginPanelWithCredentials('operator@example.test','fixture-only-password','/login')).rejects.toThrow('fixture network loss');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('rejects a late successful response from a retired session attempt before storing its token',async()=>{
    const request={email:'operator@example.test',password:'fixture-only-password',pathname:'/login',search:'',isCurrent:()=>true,setUser:vi.fn()};
    vi.mocked(fetch).mockImplementation(async()=>{advanceChatbocSessionRevision();return account();});
    await expect(completePanelCredentialLogin(request)).rejects.toMatchObject({name:'ObsoletePanelLogin'});
    expect(fetch).toHaveBeenCalledOnce();expect(request.setUser).not.toHaveBeenCalled();
    expect(safeLocalStorage.getItem('authToken')).toBe('previous-session');
    expect(usePanelSessionStore.getState().authToken).toBeNull();
  });
});

describe('legacy institutional route compatibility',()=>{
  it('does not change underscore identifiers into another organization slug',()=>{
    expect(readPanelLoginScope('/t/local_comercial_general/login')).toEqual({valid:true,tenantSlug:'local_comercial_general'});
  });
});
