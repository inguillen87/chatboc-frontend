import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelSessionStore, useWidgetSessionStore, useTenantStore } from '@/stores';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { resetBackendBootstrapGateForTests } from '@/utils/backendBootstrapGate';
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/utils/api', async () => await vi.importActual<typeof import('@/utils/api')>('@/utils/api'));
import { captureWidgetConversationScope, type WidgetConversationHandle } from '@/utils/widgetConversationScope';
import { getWidgetCommerceSession, getWidgetTenantHistory, getWidgetCartSnapshot, registerWidgetUser } from '@/api/widgetCommerce';
import { submitLeadCapture } from '@/features/chat/chatApi';

const originalFetch = global.fetch;
const tenant = 'qa-commerce-lead';
const widgetToken = 'synthetic-commerce-widget-capability';
const entityToken = 'synthetic-bound-entity';
const reply = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const options = (handle: WidgetConversationHandle) => ({ tenantSlug: tenant, widgetToken,
  chatSessionId: handle.sessionId, anonId: handle.anonId, isCurrent: handle.isCurrent });
const leadOptions = (handle: WidgetConversationHandle) => ({ chatSessionId: handle.sessionId,
  anonId: handle.anonId, isCurrent: handle.isCurrent, persistTenantSlug: false,
  idempotencyKey: 'synthetic-original-lead-operation' });
const leadBody = (handle: WidgetConversationHandle) => ({ tenant_slug: tenant,
  chat_session_id: handle.sessionId, anon_id: handle.anonId, channel: 'web',
  source: 'synthetic-widget', trigger: 'show-demo' });
const capture = (skipAuth: boolean) => captureWidgetConversationScope({ tenantSlug: tenant, entityToken, skipAuth });

describe('independent real API commerce and lead scope transport', () => {
  beforeEach(() => {
    safeLocalStorage.clear(); window.sessionStorage.clear();
    usePanelSessionStore.setState({ authToken: null, user: null });
    useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
    useTenantStore.getState().clearTenant();
    safeLocalStorage.setItem('chatboc_anon_id', 'synthetic-current-anonymous');
    vi.stubGlobal('crypto', webcrypto);
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    global.fetch = vi.fn().mockImplementation(async () => reply({ ok: true }));
  });
  afterEach(() => {
    global.fetch = originalFetch; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
    safeLocalStorage.clear(); window.sessionStorage.clear();
    usePanelSessionStore.setState({ authToken: null, user: null });
    useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
    useTenantStore.getState().clearTenant(); resetBackendBootstrapGateForTests();
  });

  it('converges normal and explicit-public anonymous lanes without adopting a legacy browser ID', async () => {
    safeLocalStorage.setItem('chat_session_id', 'synthetic-unbound-legacy-session');
    const normal = await capture(false);
    const publicHandle = await capture(true);
    expect(normal.sessionId).toBe(publicHandle.sessionId);
    expect(normal.scopeKey).toBe(publicHandle.scopeKey);
    expect(normal.sessionId).not.toBe('synthetic-unbound-legacy-session');
    expect(normal.isCurrent()).toBe(true); expect(publicHandle.isCurrent()).toBe(true);
    expect(safeLocalStorage.getItem('chat_session_id')).toBe('synthetic-unbound-legacy-session');
  });

  it('keeps bearer-chat and anonymous public lanes separate and concurrently current', async () => {
    useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-effective-chat-bearer' });
    const bearer = await capture(false);
    const publicHandle = await capture(true);
    const again = await capture(false);
    expect(publicHandle.sessionId).not.toBe(bearer.sessionId);
    expect(again.sessionId).toBe(bearer.sessionId);
    expect(bearer.isCurrent()).toBe(true); expect(publicHandle.isCurrent()).toBe(true);
    await getWidgetCommerceSession(options(publicHandle));
    const init = vi.mocked(global.fetch).mock.calls[0][1];
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);
    expect(init?.credentials).toBe('omit');
    expect(bearer.isCurrent()).toBe(true); expect(publicHandle.isCurrent()).toBe(true);
  });

  it('uses captured session and anonymous IDs consistently in session, history and cart query/header', async () => {
    const handle = await capture(true);
    const request = options(handle);
    await getWidgetCommerceSession(request);
    await getWidgetTenantHistory(null, request);
    await getWidgetCartSnapshot(null, request);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    for (const [url, init] of vi.mocked(global.fetch).mock.calls) {
      const parsed = new URL(String(url), 'https://synthetic.example.invalid');
      const headers = new Headers(init?.headers);
      expect(parsed.searchParams.get('tenant_slug')).toBe(tenant);
      expect(parsed.searchParams.get('tenant')).toBe(tenant);
      expect(parsed.searchParams.get('chat_session_id')).toBe(handle.sessionId);
      expect(parsed.searchParams.get('anon_id')).toBe(handle.anonId);
      expect(headers.get('X-Chat-Session-Id')).toBe(handle.sessionId);
      expect(headers.get('X-Anon-Id')).toBe(handle.anonId);
      expect(headers.get('Anon-Id')).toBe(handle.anonId);
      expect(headers.has('Authorization')).toBe(false);
      expect(headers.has('X-Entity-Token')).toBe(false);
      expect(init?.credentials).toBe('omit');
    }
  });

  it('rejects a retired commerce read acknowledgement without adopting its returned session', async () => {
    const handle = await capture(true);
    let resolve!: (value: Response) => void;
    global.fetch = vi.fn().mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    const pending = getWidgetCommerceSession(options(handle));
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(handle.retire()).toBe(true);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    resolve(reply({ tenant: { slug: tenant }, session: { chat_session_id: '99999999-9999-4999-8999-999999999999' } }));
    await rejected;
    expect(window.localStorage.getItem(handle.scopeKey)).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retains the existing commerce credential boundary before any request', async () => {
    const handle = await capture(true);
    const request = { ...options(handle), widgetToken: null };
    await expect(getWidgetCommerceSession(request)).rejects.toThrow('missing_widget_commerce_credential');
    await expect(getWidgetTenantHistory(null, request)).rejects.toThrow('missing_widget_commerce_credential');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps explicit registration payload, query and transport binding without adding bearer credentials', async () => {
    const handle = await capture(true);
    const payload = { name: 'Synthetic fixture' };
    await registerWidgetUser(options(handle), payload);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    expect(init?.method).toBe('POST'); expect(JSON.parse(String(init?.body))).toEqual(payload);
    expect(new URL(String(url), 'https://synthetic.example.invalid').searchParams.get('chat_session_id')).toBe(handle.sessionId);
    expect(new Headers(init?.headers).get('X-Chat-Session-Id')).toBe(handle.sessionId);
    expect(new Headers(init?.headers).get('X-Anon-Id')).toBe(handle.anonId);
    expect(new Headers(init?.headers).has('Authorization')).toBe(false);
  });

  it('uses one captured public lead identity in body, headers and idempotency without using a stored bearer', async () => {
    useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-not-for-public-lead' });
    const handle = await capture(true);
    const body = leadBody(handle);
    await submitLeadCapture({ endpoint: '/api/public/lead-capture' }, body, tenant, leadOptions(handle));
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(init?.method).toBe('POST'); expect(JSON.parse(String(init?.body))).toEqual(body);
    expect(new URL(String(url), 'https://synthetic.example.invalid').searchParams.get('tenant_slug')).toBe(tenant);
    expect(headers.get('X-Chat-Session-Id')).toBe(body.chat_session_id);
    expect(headers.get('X-Anon-Id')).toBe(body.anon_id);
    expect(headers.get('Idempotency-Key')).toBe('synthetic-original-lead-operation');
    expect(headers.has('Authorization')).toBe(false); expect(init?.credentials).toBe('omit');
  });

  it('rejects a retired lead before dispatch and never starts a new POST', async () => {
    const handle = await capture(true); expect(handle.retire()).toBe(true);
    await expect(submitLeadCapture({}, leadBody(handle), tenant, leadOptions(handle)))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('retires a late lead ACK after the original POST without replaying or presenting that ACK', async () => {
    const handle = await capture(true);
    let resolve!: (value: Response) => void;
    global.fetch = vi.fn().mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    const pending = submitLeadCapture({}, leadBody(handle), tenant, leadOptions(handle));
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(handle.retire()).toBe(true);
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    resolve(reply({ ok: true, lead_id: 'synthetic-server-ack' })); await rejected;
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('preserves permissive legacy malformed-ACK normalization without inventing success or replay', async () => {
    const handle = await capture(true);
    const malformed = { ok: 'not-a-boolean', lead_id: {}, message_body: 17, next_actions: 'invalid' };
    global.fetch = vi.fn().mockImplementation(async () => reply(malformed));
    const result = await submitLeadCapture({}, leadBody(handle), tenant, leadOptions(handle));
    expect(result.ok).toBeUndefined(); expect(result.lead_id).toBeNull();
    expect(result.message_body).toBeNull(); expect(result.next_actions).toEqual([]);
    expect(result.raw).toEqual(malformed); expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(handle.scopeKey)).toBe(handle.sessionId);
  });
});
