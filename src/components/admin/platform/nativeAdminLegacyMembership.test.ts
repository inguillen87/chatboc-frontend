import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { resetBackendBootstrapGateForTests } from '@/utils/backendBootstrapGate';
import { syntheticMembership, syntheticMembershipApplied, syntheticMembershipList,
  syntheticMembershipRequestId, syntheticMembershipTenant as tenant } from '../../../../tests/fixtures/native-admin-membership.synthetic';

vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api', 'https://retired.example.invalid'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api',
}));
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
import { applyNativeAdminLegacyMembership, getNativeAdminLegacyMembership, listNativeAdminLegacyMemberships,
  readNativeAdminLegacyMembership } from './nativeAdminLegacyMembership';

const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const cold = () => new Response(JSON.stringify({ contract_version: 'chatboc.bootstrap.v1', status_code: 503,
  ok: false, reason_code: 'application_initializing', retryable: true, request_dispatched: false, action_hint: 'retry_after' }),
{ status: 503, headers: { 'Content-Type': 'application/json', 'X-Chatboc-Bootstrap': 'initializing', 'Retry-After': '0' } });
const current = () => true;

beforeEach(() => {
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: 'synthetic-panel-session', user: { id: 'synthetic-sa', rol: 'superadmin' } });
  useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-widget-session', entityToken: 'synthetic-entity-token' });
  safeLocalStorage.setItem('tenantSlug', 'unrelated-public-tenant');
  safeLocalStorage.setItem('entityToken', 'synthetic-entity-token');
  safeLocalStorage.setItem('chatAuthToken', 'synthetic-widget-session');
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(syntheticMembership())));
});
afterEach(() => {
  vi.unstubAllGlobals(); vi.unstubAllEnvs(); resetBackendBootstrapGateForTests(); safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
});

describe('existing native administrator legacy reference contract', () => {
  it('loads only server-listed IDs with explicit panel scope and no widget credentials', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(syntheticMembershipList()));
    const rows = await listNativeAdminLegacyMemberships(tenant, current);
    await getNativeAdminLegacyMembership(tenant, rows[0].target.id, current);
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls).toHaveLength(2);
    expect(new URL(String(calls[0][0]), window.location.origin).pathname)
      .toBe(`/api/admin/tenants/${tenant.slug}/native-admin-users/legacy-membership`);
    expect(new URL(String(calls[1][0]), window.location.origin).pathname)
      .toBe(`/api/admin/tenants/${tenant.slug}/native-admin-users/77/legacy-membership`);
    for (const [url, init] of calls) {
      expect(new URL(String(url), window.location.origin).searchParams.get('tenant_slug')).toBe(tenant.slug);
      const headers = new Headers(init?.headers);
      expect(headers.get('Authorization')).toBe('Bearer synthetic-panel-session');
      expect(headers.get('X-Tenant')).toBe(tenant.slug);
      expect(headers.has('X-Token')).toBe(false); expect(headers.has('X-Entity-Token')).toBe(false); expect(headers.has('X-Chat-Session')).toBe(false);
      expect(init?.credentials).toBe('include');
    }
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('unrelated-public-tenant');
  });

  it('recovers a receipt-backed GET on the same origin while public presentation changes', async () => {
    let reads = 0;
    vi.mocked(fetch).mockImplementation(async url => {
      if (url === '/api/version') {
        safeLocalStorage.setItem('tenantSlug', 'new-public-tenant');
        useWidgetSessionStore.setState({ chatAuthToken: 'different-widget-session' });
        return response({ backend: 'synthetic-sha', frontend: 'synthetic-web' });
      }
      return ++reads === 1 ? cold() : response(syntheticMembershipList());
    });
    await expect(listNativeAdminLegacyMemberships(tenant, current)).resolves.toHaveLength(1);
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls).toHaveLength(3); expect(calls[1][0]).toBe('/api/version');
    expect(calls[0][0]).toBe(calls[2][0]); expect(calls[0][1]).toEqual(calls[2][1]);
  });

  it('uses a verified panel cookie transport without falling back to widget bearer credentials', async () => {
    usePanelSessionStore.setState({ authToken: null });
    safeLocalStorage.setItem('authProvider', 'clerk');
    safeLocalStorage.setItem('clerkSessionTransport', 'cookie');
    safeLocalStorage.setItem('clerkUserId', 'synthetic-clerk-actor');
    vi.mocked(fetch).mockResolvedValueOnce(response(syntheticMembershipList()));
    await listNativeAdminLegacyMemberships(tenant, current);
    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.has('Authorization')).toBe(false); expect(headers.has('X-Entity-Token')).toBe(false);
    expect(init?.credentials).toBe('include');
  });

  it.each(['foreign tenant', 'foreign target', 'provider', 'owner', 'extra grants', 'revision', 'role', 'non-self reference', 'credential change', 'provider call'] as const)
    ('rejects a %s descriptor', kind => {
      const raw = structuredClone(syntheticMembership()) as any;
      if (kind === 'foreign tenant') raw.tenant.id = 23;
      if (kind === 'foreign target') raw.target.tenant_slug = 'foreign-tenant';
      if (kind === 'provider') raw.target.auth_provider = 'clerk';
      if (kind === 'owner') raw.relation.is_tenant_owner = true;
      if (kind === 'extra grants') raw.permissions.membership_change_allowed = true;
      if (kind === 'revision') raw.expected_revision = 'not-a-revision';
      if (kind === 'role') raw.target.role = 'empleado';
      if (kind === 'non-self reference') raw.relation.current_owner_reference = 99;
      if (kind === 'credential change') raw.credentials_changed = true;
      if (kind === 'provider call') raw.provider_calls_performed = true;
      expect(() => readNativeAdminLegacyMembership(raw, tenant, 77)).toThrow();
    });

  it.each(['owner', 'duplicate', 'foreign list tenant', 'unknown version', 'collection grants'] as const)('rejects a %s list without choosing another user', async kind => {
    const raw = structuredClone(syntheticMembershipList()) as any;
    if (kind === 'owner') { raw.items[0].can_apply = false; raw.items[0].permissions.can_normalize_legacy_reference = false; raw.items[0].relation.is_tenant_owner = true; }
    if (kind === 'duplicate') raw.items.push(raw.items[0]);
    if (kind === 'foreign list tenant') raw.tenant.slug = 'foreign-tenant';
    if (kind === 'unknown version') raw.contract_version = 'unknown.v1';
    if (kind === 'collection grants') raw.permissions.credentials_change_allowed = true;
    vi.mocked(fetch).mockResolvedValueOnce(response(raw));
    await expect(listNativeAdminLegacyMemberships(tenant, current)).rejects.toMatchObject({ status: 502 });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('validates target identity in an individual GET', async () => {
    await expect(getNativeAdminLegacyMembership(tenant, 78, current)).rejects.toMatchObject({ status: 502 });
  });

  it('sends exactly a revision and UUID once and verifies the returned action receipt', async () => {
    const review = syntheticMembership();
    vi.mocked(fetch).mockResolvedValueOnce(response(syntheticMembershipApplied(review)));
    const result = await applyNativeAdminLegacyMembership(review, syntheticMembershipRequestId, current);
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ expected_revision: review.expected_revision, request_id: syntheticMembershipRequestId });
    expect(result.can_apply).toBe(false); expect(result.relation.current_owner_reference).toBe(20);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each([412, 503] as const)('never replays a PUT after HTTP %s', async status => {
    vi.mocked(fetch).mockResolvedValueOnce(status === 503 ? cold() : response({ reason_code: 'revision_conflict' }, 412));
    await expect(applyNativeAdminLegacyMembership(syntheticMembership(), syntheticMembershipRequestId, current)).rejects.toMatchObject({ status });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it.each(['receipt tenant', 'receipt target', 'receipt old reference', 'receipt new reference', 'receipt revision', 'role change'] as const)
    ('rejects success with %s', async kind => {
      const raw = syntheticMembershipApplied() as any;
      if (kind === 'receipt tenant') raw.action_receipt.tenant_id = 23;
      if (kind === 'receipt target') raw.action_receipt.target_user_id = 78;
      if (kind === 'receipt old reference') raw.action_receipt.old_reference = 98;
      if (kind === 'receipt new reference') raw.action_receipt.new_reference = 21;
      if (kind === 'receipt revision') raw.action_receipt.revision = 'c'.repeat(64);
      if (kind === 'role change') raw.target = { ...raw.target, role: 'admin' };
      vi.mocked(fetch).mockResolvedValueOnce(response(raw));
      await expect(applyNativeAdminLegacyMembership(syntheticMembership(), syntheticMembershipRequestId, current)).rejects.toMatchObject({ status: 502 });
      expect(fetch).toHaveBeenCalledOnce();
    });

  it('blocks disabled reviews and invalid request IDs before dispatch', async () => {
    const review = syntheticMembership();
    await expect(applyNativeAdminLegacyMembership({ ...review, can_apply: false, permissions: { ...review.permissions, can_normalize_legacy_reference: false } }, syntheticMembershipRequestId, current)).rejects.toMatchObject({ status: 409 });
    await expect(applyNativeAdminLegacyMembership(syntheticMembership(), 'not-a-uuid', current)).rejects.toMatchObject({ status: 409 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retires a late PUT result after logout without a second dispatch', async () => {
    vi.mocked(fetch).mockImplementationOnce(async () => {
      advanceChatbocSessionRevision();
      return response(syntheticMembershipApplied());
    });
    await expect(applyNativeAdminLegacyMembership(syntheticMembership(), syntheticMembershipRequestId, current)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetch).toHaveBeenCalledOnce();
  });
});
