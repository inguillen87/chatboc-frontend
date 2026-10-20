import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelSessionStore, useWidgetSessionStore, useTenantStore } from '@/stores';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { resetBackendBootstrapGateForTests } from '@/utils/backendBootstrapGate';

vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/utils/api', async () => await vi.importActual<typeof import('@/utils/api')>('@/utils/api'));
import { getLandingExperience } from '@/api/landingExperience';
import { publicApi } from '@/api/v2/client';
import { apiFetch } from '@/utils/api';

const originalFetch = global.fetch;
const payload = { contract_version: 'synthetic.landing.v1', hero: { title: 'Synthetic brand',
  illustration: { type: 'synthetic-service-journey' } }, sections: [] };
const reply = (body: unknown = payload, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});

describe('read-only landing public global request scope', () => {
  beforeEach(() => {
    safeLocalStorage.clear(); window.sessionStorage.clear();
    usePanelSessionStore.setState({ authToken: null, user: null });
    useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
    useTenantStore.getState().clearTenant();
    window.history.replaceState({}, '', '/');
    delete (window as any).CHATBOC_CONFIG;
    safeLocalStorage.setItem('tenantSlug', 'synthetic-tdf');
    safeLocalStorage.setItem('chatboc_anon_id', 'synthetic-public-anonymous');
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  });
  afterEach(() => {
    global.fetch = originalFetch; vi.restoreAllMocks(); vi.unstubAllEnvs();
    safeLocalStorage.clear(); window.sessionStorage.clear();
    usePanelSessionStore.setState({ authToken: null, user: null });
    useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
    useTenantStore.getState().clearTenant(); resetBackendBootstrapGateForTests();
  });

  const deferred = async <T,>(request: () => Promise<T>) => {
    let resolve!: (response: Response) => void;
    global.fetch = vi.fn().mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
    const settled = request().then(value => ({ status: 'fulfilled' as const, value }),
      error => ({ status: 'rejected' as const, name: error?.name, message: error?.message }));
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    return { resolve, settled };
  };
  const finish = async <T,>(pending: Awaited<ReturnType<typeof deferred<T>>>) => {
    pending.resolve(reply()); const result = await pending.settled;
    expect(global.fetch).toHaveBeenCalledTimes(1); return result;
  };

  it('returns a declared global public landing on an unchanged request without panel/widget bearer or cookies', async () => {
    usePanelSessionStore.setState({ authToken: 'synthetic-panel-token' });
    useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-widget-token' });
    const pending = await deferred(() => getLandingExperience());
    const [url, init] = vi.mocked(global.fetch).mock.calls[0];
    const parsed = new URL(String(url), 'https://synthetic.example.invalid');
    const headers = new Headers(init?.headers);
    expect(parsed.pathname).toBe('/api/public/landing-experience');
    expect(parsed.searchParams.has('tenant_slug')).toBe(false);
    expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('X-Token')).toBe(false);
    expect(headers.has('X-Entity-Token')).toBe(false);
    expect(init?.method).toBe('GET'); expect(init?.credentials).toBe('omit');
    expect(await finish(pending)).toEqual({ status: 'fulfilled', value: payload });
  });

  it('keeps the global landing contract when only unrelated tenant presentation changes during HTTP', async () => {
    const pending = await deferred(() => getLandingExperience());
    safeLocalStorage.setItem('tenantSlug', 'synthetic-junin');
    expect(await finish(pending)).toEqual({ status: 'fulfilled', value: payload });
  });

  it('keeps the global landing contract when only the unrelated widget bearer changes during HTTP', async () => {
    const pending = await deferred(() => getLandingExperience());
    useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-widget-new-token' });
    expect(await finish(pending)).toEqual({ status: 'fulfilled', value: payload });
  });

  it('keeps an explicitly requested brand contract pinned rather than retiring for a later global tenant write', async () => {
    const pending = await deferred(() => getLandingExperience({ tenantSlug: 'synthetic-brand' }));
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('synthetic-tdf');
    const [url] = vi.mocked(global.fetch).mock.calls[0];
    expect(new URL(String(url), 'https://synthetic.example.invalid').searchParams.get('tenant_slug')).toBe('synthetic-brand');
    safeLocalStorage.setItem('tenantSlug', 'synthetic-junin');
    expect(await finish(pending)).toEqual({ status: 'fulfilled', value: payload });
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('synthetic-junin');
  });

  it('exposes the actual AbortError before the landing helper converts it to null', async () => {
    const pending = await deferred(() => publicApi.get('/api/public/landing-experience', {
      tenantSlug: null, isWidgetRequest: true, omitCredentials: true,
    }));
    safeLocalStorage.setItem('tenantSlug', 'synthetic-junin');
    expect(await finish(pending)).toEqual({ status: 'rejected', name: 'AbortError', message: 'Request context retired' });
  });

  it('preserves the existing fully explicit public tenant-read isolation control', async () => {
    const pending = await deferred(() => apiFetch('/api/public/landing-experience?tenant_slug=synthetic-brand', {
      method: 'GET', tenantSlug: 'synthetic-brand', skipAuth: true, omitCredentials: true,
      omitEntityToken: true, omitChatSessionId: true, persistTenantSlug: false,
    }));
    safeLocalStorage.setItem('tenantSlug', 'synthetic-junin');
    useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-widget-new-token' });
    expect(await finish(pending)).toEqual({ status: 'fulfilled', value: payload });
  });

  it('still retires an explicitly isolated public read when its initiating scope ends', async () => {
    let current = true;
    const pending = await deferred(() => apiFetch('/api/public/landing-experience?tenant_slug=synthetic-brand', {
      method: 'GET', tenantSlug: 'synthetic-brand', skipAuth: true, omitCredentials: true,
      omitEntityToken: true, omitChatSessionId: true, persistTenantSlug: false,
      isCurrent: () => current,
    }));
    current = false;
    expect(await finish(pending)).toEqual({ status: 'rejected', name: 'AbortError', message: 'Request context retired' });
  });

  it('still retires an implicit contextual request after tenant selection changes', async () => {
    const pending = await deferred(() => apiFetch('/api/public/synthetic-contextual', { skipAuth: true, omitCredentials: true }));
    safeLocalStorage.setItem('tenantSlug', 'synthetic-junin');
    expect(await finish(pending)).toEqual({ status: 'rejected', name: 'AbortError', message: 'Request context retired' });
  });

  it('forwards a declared public caller lifetime rather than accepting its retired response', async () => {
    let current = true;
    const pending = await deferred(() => publicApi.get('/api/public/landing-experience', {
      tenantSlug: null, isWidgetRequest: true, omitCredentials: true, isCurrent: () => current,
    }));
    current = false;
    expect(await finish(pending)).toEqual({ status: 'rejected', name: 'AbortError', message: 'Request context retired' });
  });

  it('retains the intentional unavailable-endpoint null fallback without an automatic second request', async () => {
    global.fetch = vi.fn().mockImplementation(async () => reply({ error: 'synthetic-unavailable' }, 404));
    await expect(getLandingExperience()).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch a landing read that its caller already retired', async () => {
    global.fetch = vi.fn().mockImplementation(async () => reply());
    await expect(getLandingExperience({}, { isCurrent: () => false })).resolves.toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('retires a late landing response by its own caller without retry or context adoption', async () => {
    let current = true;
    const pending = await deferred(() => getLandingExperience({}, { isCurrent: () => current }));
    current = false;
    expect(await finish(pending)).toEqual({ status: 'fulfilled', value: null });
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('synthetic-tdf');
  });

  it('keeps an anonymous global landing independent from a panel login that sends no credentials on this read', async () => {
    const pending = await deferred(() => getLandingExperience());
    usePanelSessionStore.setState({ authToken: 'synthetic-new-panel-identity' });
    safeLocalStorage.setItem('authToken', 'synthetic-new-panel-identity');
    expect(await finish(pending)).toEqual({ status: 'fulfilled', value: payload });
  });

  it('preserves explicit entity credentials on a different public/widget V2 consumer', async () => {
    (window as any).CHATBOC_CONFIG = { entityToken: 'synthetic-legitimate-entity' };
    const pending = await deferred(() => publicApi.get('/api/widget/synthetic-catalog', {
      tenantSlug: 'synthetic-brand', isWidgetRequest: true,
    }));
    const headers = new Headers(vi.mocked(global.fetch).mock.calls[0][1]?.headers);
    expect(headers.get('X-Entity-Token')).toBe('synthetic-legitimate-entity');
    expect(headers.get('X-Token')).toBe('synthetic-legitimate-entity');
    expect(await finish(pending)).toEqual({ status: 'fulfilled', value: payload });
  });

  it.each<[string, string, Record<string, unknown>]>([
    ['other public route', '/api/public/synthetic-other', {}],
    ['non-GET write', '/api/public/landing-experience', { method: 'POST' }],
    ['implicit global scope', '/api/public/landing-experience', { tenantSlug: undefined }],
    ['tenant omission disabled', '/api/public/landing-experience', { omitTenant: false }],
    ['cookies included', '/api/public/landing-experience', { omitCredentials: false }],
    ['entity omission disabled', '/api/public/landing-experience', { omitEntityToken: false }],
    ['chat omission disabled', '/api/public/landing-experience', { omitChatSessionId: false }],
    ['tenant persistence allowed', '/api/public/landing-experience', { persistTenantSlug: true }],
    ['caller lifetime missing', '/api/public/landing-experience', { isCurrent: undefined }],
    ['explicit bearer', '/api/public/landing-experience', { headers: { Authorization: 'Bearer synthetic-explicit' } }],
    ['explicit entity header', '/api/public/landing-experience', { headers: { 'X-Entity-Token': 'synthetic-explicit' } }],
  ])('does not extend global landing isolation to %s', async (_label, path, overrides) => {
    const pending = await deferred(() => apiFetch(path, {
      method: 'GET', tenantSlug: null, omitTenant: true, skipAuth: true, omitCredentials: true,
      omitEntityToken: true, omitChatSessionId: true, persistTenantSlug: false,
      isCurrent: () => true, ...overrides,
    }));
    safeLocalStorage.setItem('tenantSlug', 'synthetic-junin');
    expect(await finish(pending)).toEqual({ status: 'rejected', name: 'AbortError', message: 'Request context retired' });
  });
});
