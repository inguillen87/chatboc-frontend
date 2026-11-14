import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/utils/api';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
import {
  activateTenantAddress, planTenantAddressActivation, readAddressActivationPlan,
  readTenantAddresses, TenantAddressesContractError,
} from '@/api/tenantAddresses';

// The full canonical setup remains loaded. Restore the actual API and router;
// only HTTP, startup readiness and telemetry are synthetic boundaries here.
const runtime = vi.hoisted(() => ({ ready: vi.fn() }));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/utils/backendBootstrapGate', async original => ({
  ...await original<typeof import('@/utils/backendBootstrapGate')>(),
  ensureBackendRuntimeReady: runtime.ready,
}));
vi.mock('@/utils/frontendTelemetry', () => ({ trackFrontendEvent: vi.fn() }));

const scope = { id: 17, slug: 'synthetic-address' };
const token = 'synthetic-address-operator-session';
const endpoint = '/api/admin/tenants/synthetic-address/addresses';
const revision = 'd'.repeat(64);
const approvedHash = 'c'.repeat(64);
const candidate = {
  frontend_deployment: 'dpl_SyntheticAddress01',
  frontend_source: 'a'.repeat(40), routes_sha256: 'b'.repeat(64),
};
const now = () => Math.floor(Date.now() / 1000);
const descriptor = (active = false) => ({
  contract_version: 'organization.addresses.v2', tenant: { ...scope },
  revision: active ? 'e'.repeat(64) : revision, version: active ? 1 : 0,
  base: { url: 'https://chatboc.ar/t/synthetic-address', available: true },
  canonical_url: active ? 'https://synthetic-address.chatboc.ar/' : 'https://chatboc.ar/t/synthetic-address',
  platform: { kind: 'platform', source: 'v2', host: 'synthetic-address.chatboc.ar',
    status: active ? 'active' : 'pending_platform', active, valid_until: active ? now() + 600 : null,
    dns_proof: null, scope_note: 'Synthetic platform address.' },
  custom: { kind: 'custom', source: null, host: null, status: 'unconfigured', active: false,
    valid_until: null, dns_proof: null, scope_note: 'Synthetic custom address.' },
  capabilities: { can_manage: true, writes_blocked: false,
    platform: { eligible: true, can_request: false, can_verify_dns: false, can_revoke: true, reason_code: 'ready' },
    custom: { eligible: true, can_request: true, can_verify_dns: false, can_revoke: false, reason_code: 'ready' },
    activation: { mode: 'platform_operator', available: true, can_plan: true, can_activate: true,
      reason_code: 'ready', provider_changes_supported: false } },
  save_endpoint: endpoint, activation_plan_endpoint: endpoint + '/activation-plan',
  activation_endpoint: endpoint + '/activate', provider_changes_performed: false, auth_e2e_verified: false,
});
const planPayload = () => ({
  contract_version: 'organization.address_activation_plan.v2',
  plan: { host: 'synthetic-address.chatboc.ar', tenant_id: scope.id, tenant_slug: scope.slug,
    kind: 'platform', revision, valid_until: now() + 900, ...candidate,
    backend_source: 'f'.repeat(40), routes_sha256: candidate.routes_sha256,
    allowed_aliases: [], project_id: 'prj_SyntheticAddress01' },
  plan_sha256: approvedHash, observed_at: now(), valid_until: now() + 600,
  writes_performed: false, provider_changes_performed: false, auth_e2e_verified: false,
});
const activationPayload = () => ({
  contract_version: 'organization.addresses_save.v2', saved: true, committed: true,
  writes_performed: true, provider_changes_performed: false, auth_e2e_verified: false,
  approved_plan_sha256: approvedHash, addresses: descriptor(true),
});
const response = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200, headers: { 'Content-Type': 'application/json' },
});
type Call = { url: URL; method: string; headers: Headers; body: unknown };
let calls: Call[];
let fetchFixture: ReturnType<typeof vi.fn>;
let handle: (call: Call) => Response | Promise<Response>;

beforeEach(() => {
  runtime.ready.mockReset().mockResolvedValue(undefined);
  window.localStorage.clear(); window.sessionStorage.clear();
  usePanelSessionStore.getState().clearSession();
  useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ entityToken: null, chatAuthToken: null });
  usePanelSessionStore.getState().setAuthToken(token);
  window.history.replaceState({}, '', '/admin/tenants/synthetic-address');
  calls = [];
  handle = call => {
    if (call.url.pathname === endpoint + '/activation-plan') return response(planPayload());
    if (call.url.pathname === endpoint + '/activate') return response(activationPayload());
    throw new Error('Unexpected synthetic activation fixture path');
  };
  fetchFixture = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      'http://localhost');
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    const call = { url, method: init?.method ?? 'GET', headers: new Headers(init?.headers), body };
    calls.push(call);
    return handle(call);
  });
  vi.stubGlobal('fetch', fetchFixture);
});
afterEach(() => {
  vi.unstubAllGlobals(); vi.restoreAllMocks();
  usePanelSessionStore.getState().clearSession();
  useTenantStore.getState().clearTenant();
  useWidgetSessionStore.setState({ entityToken: null, chatAuthToken: null });
  window.localStorage.clear(); window.sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

describe('address activation through the actual panel API transport', () => {
  it('plans then activates with one POST per exact endpoint and accepts only the validated acknowledgement', async () => {
    expect(vi.isMockFunction(apiFetch)).toBe(false);
    const current = readTenantAddresses(descriptor(), scope);
    const review = await planTenantAddressActivation(scope, current, 'platform', candidate, () => true);
    const active = await activateTenantAddress(scope, current, 'platform', candidate, review, () => true);
    expect(review.plan).toMatchObject({ tenant_id: scope.id, tenant_slug: scope.slug, revision });
    expect(active.platform).toMatchObject({ host: 'synthetic-address.chatboc.ar', status: 'active', active: true });
    expect(active.revision).toBe('e'.repeat(64));
    expect(calls.map(call => [call.url.pathname, call.method])).toEqual([
      [endpoint + '/activation-plan', 'POST'], [endpoint + '/activate', 'POST'],
    ]);
    expect(fetchFixture).toHaveBeenCalledTimes(2);
    const requested = { kind: 'platform', expected_revision: revision, ...candidate };
    expect(calls[0].body).toEqual(requested);
    expect(calls[1].body).toEqual({ ...requested, approved_plan_sha256: approvedHash });
    for (const call of calls) {
      expect(call.url.search).toBe(''); expect(call.url.hash).toBe('');
      expect(call.headers.get('Authorization')).toBe('Bearer ' + token);
      expect(call.headers.get('X-Tenant')).toBe(scope.slug);
      expect(call.headers.get('X-Tenant-Slug')).toBe(scope.slug);
      expect(call.headers.get('Content-Type')).toContain('application/json');
    }
  });

  it.each([
    { field: 'tenant_id', value: 18 },
    { field: 'tenant_slug', value: 'synthetic-foreign' },
    { field: 'revision', value: 'e'.repeat(64) },
  ])('rejects a plan response with a mismatched $field after its single real-transport request', async ({ field, value }) => {
    handle = () => {
      const payload = planPayload();
      return response({ ...payload, plan: { ...payload.plan, [field]: value } });
    };
    const current = readTenantAddresses(descriptor(), scope);
    await expect(planTenantAddressActivation(scope, current, 'platform', candidate, () => true))
      .rejects.toBeInstanceOf(TenantAddressesContractError);
    expect(calls.map(call => [call.url.pathname, call.method])).toEqual([[endpoint + '/activation-plan', 'POST']]);
    expect(fetchFixture).toHaveBeenCalledOnce();
  });

  it('surfaces a lost activation acknowledgement without repeating its POST at another URL', async () => {
    handle = call => {
      if (call.url.pathname === endpoint + '/activation-plan') return response(planPayload());
      if (call.url.pathname === endpoint + '/activate') throw new TypeError('Synthetic activation acknowledgement lost');
      throw new Error('Unexpected synthetic activation fixture path');
    };
    const current = readTenantAddresses(descriptor(), scope);
    const review = await planTenantAddressActivation(scope, current, 'platform', candidate, () => true);
    await expect(activateTenantAddress(scope, current, 'platform', candidate, review, () => true))
      .rejects.toBeInstanceOf(Error);
    expect(calls.map(call => [call.url.pathname, call.method])).toEqual([
      [endpoint + '/activation-plan', 'POST'], [endpoint + '/activate', 'POST'],
    ]);
    expect(new Set(calls.map(call => call.url.origin)).size).toBe(1);
    expect(calls.every(call => call.url.search === '')).toBe(true);
    expect(fetchFixture).toHaveBeenCalledTimes(2);
  });

  it('dispatches no HTTP when the caller has already retired before plan or activation', async () => {
    const current = readTenantAddresses(descriptor(), scope);
    const review = readAddressActivationPlan(planPayload(), scope, current,
      { kind: 'platform', expected_revision: revision, ...candidate });
    await expect(planTenantAddressActivation(scope, current, 'platform', candidate, () => false))
      .rejects.toBeInstanceOf(TenantAddressesContractError);
    await expect(activateTenantAddress(scope, current, 'platform', candidate, review, () => false))
      .rejects.toBeInstanceOf(TenantAddressesContractError);
    expect(calls).toEqual([]); expect(fetchFixture).not.toHaveBeenCalled();
    expect(runtime.ready).not.toHaveBeenCalled();
  });
});
