import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrganizationAddressActivationPanel } from './OrganizationAddressActivationPanel';
import { usePanelSessionStore } from '@/stores';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';

// Real panel, address client, apiFetch, startup-continuity dispatch and Radix.
// Actor verification, startup readiness and HTTP responses are synthetic.
const authority = vi.hoisted(() => ({ verified: true, profile: true, ready: vi.fn() }));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({
  user: usePanelSessionStore(state => state.user), hasVerifiedSession: authority.verified,
  organizationProfileVerified: authority.profile, loading: !authority.profile,
}) }));
vi.mock('@/utils/backendBootstrapGate', async () => ({
  ...await vi.importActual<typeof import('@/utils/backendBootstrapGate')>('@/utils/backendBootstrapGate'),
  ensureBackendRuntimeReady: (...args: unknown[]) => authority.ready(...args),
}));
vi.mock('@/utils/frontendTelemetry', () => ({ trackFrontendEvent: vi.fn() }));

// Presentation copied from the backend literal producer, with synthetic identity.
const UI = {
  "contract_version": "organization.address_operator_ui.v1",
  "labels": {
    "title": "Publicación de la dirección",
    "description": "Revisá las referencias de la publicación actual antes de confirmar la vinculación.",
    "kind": "Tipo de dirección",
    "platform": "Subdominio de la plataforma",
    "custom": "Dominio propio",
    "advanced_title": "Referencias de la publicación",
    "advanced_description": "Usá las referencias ya revisadas de la publicación actual en Producción. El servidor vuelve a comprobarlas antes de activar la vinculación.",
    "deployment": "Identificador de la publicación",
    "source": "Revisión del frontend",
    "routes": "Huella de las rutas publicadas",
    "reviewed_version": "Versión revisada",
    "refresh": "Actualizar estado",
    "plan": "Preparar revisión",
    "review_title": "Revisar la vinculación",
    "tenant": "Organización",
    "host": "Dirección",
    "revision": "Revisión de la dirección",
    "digest": "Huella de la revisión",
    "observed": "Observada el",
    "expires": "Válida hasta",
    "backend_source": "Revisión del backend",
    "confirm_title": "Confirmar la activación",
    "confirm_description": "Confirmá la activación de esta vinculación existente. El servidor vuelve a validar la revisión y la evidencia de publicación; esta acción no cambia DNS ni configura al proveedor.",
    "confirm": "Activar vinculación",
    "cancel": "Cancelar",
    "loading": "Actualizando estado",
    "planning": "Preparando revisión",
    "activating": "Confirmando activación",
    "active": "Vinculación activa",
    "plan_ready": "Revisión preparada"
  },
  "messages": {
    "not_ready": "La solicitud necesita completar sus verificaciones antes de preparar la publicación.",
    "descriptor_error": "No se pudo consultar el estado de la dirección. Actualizá el estado antes de continuar.",
    "plan_error": "No se pudo preparar la revisión. Conservá las referencias y actualizá el estado antes de continuar.",
    "activation_error": "El servidor no confirmó la activación. Actualizá el estado y revisá el resultado antes de continuar.",
    "uncertain": "No se pudo confirmar el resultado de la activación. Actualizá el estado antes de volver a intentarlo.",
    "expired": "La revisión venció. Actualizá el estado y prepará una revisión nueva antes de confirmar.",
    "input_invalid": "Revisá los identificadores y huellas de la publicación antes de preparar la revisión.",
    "descriptor_changed": "El estado de la dirección cambió. Actualizalo y revisá nuevamente la vinculación antes de confirmar.",
    "platform_admin_required": "La publicación requiere autorización vigente de administración de la plataforma.",
    "operator_runtime_unavailable": "La verificación de publicación no está disponible. Conservá la solicitud y consultá el estado antes de continuar.",
    "maintenance": "La activación está temporalmente en modo consulta. Conservá las referencias y revisá el estado más adelante.",
    "not_pending": "Esta dirección no está pendiente de publicación. Actualizá su estado antes de continuar.",
    "success": "El servidor confirmó la vinculación activa."
  }
} as const;
const A = { id: 17, slug: 'synthetic-organization' };
const CANDIDATE = { frontend_deployment: 'dpl_syntheticExisting123', frontend_source: 'a'.repeat(40), routes_sha256: 'c'.repeat(64) };
const OLD_REVISION = '1'.repeat(64), NEW_REVISION = '2'.repeat(64), DIGEST = '3'.repeat(64);
type Scope = typeof A;
type Kind = 'platform' | 'custom';
type Call = { method: string; path: string; body: any; headers: Headers };
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let calls: Call[];
let target: Scope, activeKind: Kind | null, noCopy: boolean, noCapability: boolean;
let failedReads: number, readFailure: 'http' | 'throw', loseAck: boolean, deniedPlan: boolean, expiredPlan: boolean;
let planGate: ReturnType<typeof deferred<void>> | null;
const seconds = () => Math.floor(Date.now() / 1000);
const host = (kind: Kind) => kind === 'platform' ? 'synthetic-organization.chatboc.ar' : 'synthetic-organization.example.test';
function descriptor(scope = target) {
  const slot = (kind: Kind) => ({ kind, source: 'v2', host: host(kind),
    status: activeKind === kind ? 'active' : 'pending_platform', active: activeKind === kind,
    valid_until: activeKind === kind ? seconds() + 600 : null, dns_proof: null,
    scope_note: 'Synthetic server-owned address scope' });
  return { contract_version: 'organization.addresses.v2', tenant: clone(scope),
    revision: activeKind ? NEW_REVISION : OLD_REVISION, version: activeKind ? 2 : 1,
    base: { url: `https://platform.example.test/t/${scope.slug}`, available: true },
    canonical_url: activeKind ? `https://${host(activeKind)}/` : `https://platform.example.test/t/${scope.slug}`,
    platform: slot('platform'), custom: slot('custom'),
    capabilities: { can_manage: true, writes_blocked: false,
      platform: { eligible: true, can_request: false, can_verify_dns: false, can_revoke: true, reason_code: 'ready' },
      custom: { eligible: true, can_request: false, can_verify_dns: false, can_revoke: true, reason_code: 'ready' },
      ...(!noCapability ? { activation: { mode: 'platform_operator', available: true, can_plan: true,
        can_activate: true, reason_code: 'ready', provider_changes_supported: false } } : {}) },
    ...(!noCopy ? { operator_ui: clone(UI) } : {}),
    save_endpoint: `/api/admin/tenants/${scope.slug}/addresses`, provider_changes_performed: false };
}
function plan(scope: Scope, body: any) {
  return { contract_version: 'organization.address_activation_plan.v2',
    plan: { host: host(body.kind), tenant_id: scope.id, tenant_slug: scope.slug, kind: body.kind,
      revision: body.expected_revision, valid_until: seconds() + 600,
      frontend_deployment: body.frontend_deployment, frontend_source: body.frontend_source,
      routes_sha256: body.routes_sha256, backend_source: 'b'.repeat(40), allowed_aliases: [],
      project_id: 'prj_syntheticExisting123' }, plan_sha256: DIGEST,
    observed_at: seconds() - 1, valid_until: seconds() + (expiredPlan ? -1 : 300),
    writes_performed: false, provider_changes_performed: false, auth_e2e_verified: false };
}
const count = (method: string, suffix = '') => calls.filter(call => call.method === method && call.path.endsWith('/addresses' + suffix)).length;
const view = (scope: Scope = A) => <OrganizationAddressActivationPanel tenant={scope} />;
async function loaded() { await screen.findByRole('heading', { name: UI.labels.title }); await waitFor(() => expect(screen.getByRole('button', { name: UI.labels.refresh })).toBeEnabled()); }
async function fillVersion() {
  fireEvent.click(screen.getByText(UI.labels.advanced_title));
  fireEvent.change(screen.getByLabelText(UI.labels.deployment), { target: { value: CANDIDATE.frontend_deployment } });
  fireEvent.change(screen.getByLabelText(UI.labels.source), { target: { value: CANDIDATE.frontend_source } });
  fireEvent.change(screen.getByLabelText(UI.labels.routes), { target: { value: CANDIDATE.routes_sha256 } });
  await userEvent.click(screen.getByRole('checkbox', { name: UI.labels.reviewed_version }));
}
async function prepareReview() {
  await fillVersion(); await userEvent.click(screen.getByRole('button', { name: UI.labels.plan }));
  await screen.findByRole('heading', { name: UI.labels.review_title });
}
async function confirm() {
  await userEvent.click(screen.getByRole('button', { name: UI.labels.confirm_title }));
  await screen.findByRole('alertdialog');
  await userEvent.click(screen.getByRole('button', { name: UI.labels.confirm }));
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); usePanelSessionStore.getState().clearSession();
  usePanelSessionStore.getState().setAuthToken('synthetic-operator-session');
  usePanelSessionStore.getState().setUser({ id: 'synthetic-operator', rol: 'superadmin', email: 'operator@example.test', tenant_slug: 'synthetic-platform' });
  authority.verified = authority.profile = true; authority.ready.mockReset().mockResolvedValue(undefined);
  target = clone(A); activeKind = null; noCopy = noCapability = loseAck = deniedPlan = expiredPlan = false;
  failedReads = 0; readFailure = 'http'; planGate = null; calls = [];
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })));
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost');
    const method = init?.method ?? 'GET'; const path = url.pathname;
    if (url.search || !/\/(?:api\/)?admin\/tenants\/synthetic-organization\/addresses(?:\/activation-plan|\/activate)?$/.test(path)) throw new Error('unexpected synthetic HTTP destination');
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    calls.push({ method, path, body, headers: new Headers(init?.headers) });
    if (method === 'GET' && path.endsWith('/addresses')) {
      if (failedReads-- > 0) { if (readFailure === 'throw') throw new TypeError('synthetic read unavailable'); return reply({ reason_code: 'synthetic_unavailable' }, 500); }
      return reply(descriptor());
    }
    if (method === 'POST' && path.endsWith('/activation-plan')) {
      if (deniedPlan) return reply({ contract_version: 'organization.addresses_error.v2', reason_code: 'address_forbidden', writes_performed: false }, 403);
      const result = plan(clone(target), body); const gate = planGate; planGate = null;
      if (gate) await gate.promise;
      return reply(result);
    }
    if (method === 'POST' && path.endsWith('/activate')) {
      activeKind = body.kind;
      if (loseAck) throw new TypeError('synthetic ACK lost after server response became unknown');
      return reply({ contract_version: 'organization.addresses_save.v2', saved: true, committed: true,
        writes_performed: true, provider_changes_performed: false, approved_plan_sha256: DIGEST, addresses: descriptor() });
    }
    throw new Error('unexpected synthetic HTTP method');
  }));
});
afterEach(() => { cleanup(); usePanelSessionStore.getState().clearSession(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Organization address operator with real HTTP client and explicit review', () => {
  it.each(['http', 'throw'] as const)('shows a failed initial %s read and performs one manual GET to recover without a POST', async failure => {
    failedReads = 1; readFailure = failure; render(view());
    await screen.findByRole('heading', { name: 'No pudimos cargar los datos' });
    expect(count('GET')).toBe(1); expect(count('POST', '/activation-plan')).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar estado' })); await loaded();
    expect(count('GET')).toBe(2); expect(calls.filter(call => call.method === 'POST')).toHaveLength(0);
  });
  it.each(['platform', 'custom'] as const)('keeps %s planning separate from confirmation and accepts only the confirmed ACK', async kind => {
    render(view()); await loaded();
    if (kind === 'custom') fireEvent.change(screen.getByLabelText(UI.labels.kind), { target: { value: kind } });
    await fillVersion(); expect(count('POST', '/activation-plan')).toBe(0); expect(count('POST', '/activate')).toBe(0);
    const planButton = screen.getByRole('button', { name: UI.labels.plan });
    fireEvent.click(planButton); fireEvent.click(planButton);
    await screen.findByRole('heading', { name: UI.labels.review_title });
    expect(count('POST', '/activation-plan')).toBe(1); expect(count('POST', '/activate')).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: UI.labels.confirm_title })); await screen.findByRole('alertdialog');
    expect(count('POST', '/activate')).toBe(0);
    const button = screen.getByRole('button', { name: UI.labels.confirm }); fireEvent.click(button); fireEvent.click(button);
    await screen.findByText(UI.messages.success); expect(count('POST', '/activate')).toBe(1);
    const post = calls.find(call => call.path.endsWith('/activate'))!;
    expect(post.body).toEqual({ ...CANDIDATE, kind, expected_revision: OLD_REVISION, approved_plan_sha256: DIGEST });
    expect(post.headers.get('X-Tenant-Slug')).toBe(A.slug);
    await userEvent.click(screen.getByRole('button', { name: UI.labels.refresh })); await loaded();
    expect(count('GET')).toBe(2); expect(count('POST', '/activate')).toBe(1);
    expect(screen.getByText(UI.labels.active)).toBeInTheDocument();
  });
  it('blocks another activation after unknown ACK and reconciles with one explicit GET', async () => {
    loseAck = true; render(view()); await loaded(); await prepareReview(); await confirm();
    await screen.findByText(UI.messages.uncertain); expect(count('POST', '/activate')).toBe(1);
    expect(screen.getByRole('button', { name: UI.labels.plan })).toBeDisabled();
    expect(screen.queryByRole('button', { name: UI.labels.confirm })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: UI.labels.refresh })); await loaded();
    expect(screen.getByText(UI.labels.active)).toBeInTheDocument(); expect(count('POST', '/activate')).toBe(1);
  });
  it.each(['unverified', 'profile_loading', 'non_operator'] as const)('grants no HTTP work for %s authority', async state => {
    if (state === 'unverified') authority.verified = false;
    if (state === 'profile_loading') authority.profile = false;
    if (state === 'non_operator') usePanelSessionStore.getState().setUser({ id: 'synthetic-operator', rol: 'tenant_admin', email: 'operator@example.test' });
    render(view()); await act(async () => { await Promise.resolve(); }); expect(calls).toHaveLength(0);
  });
  it('keeps an older descriptor without operator copy non-actionable', async () => {
    noCopy = true; render(view()); await screen.findByRole('heading', { name: 'Contenido parcial disponible' });
    expect(screen.queryByRole('button', { name: UI.labels.plan })).toBeNull();
    expect(calls.filter(call => call.method === 'POST')).toHaveLength(0);
  });
  it('does not enable a plan when the activation capability is missing', async () => {
    noCapability = true; render(view()); await loaded(); await fillVersion();
    expect(screen.getByRole('button', { name: UI.labels.plan })).toBeDisabled();
    expect(calls.filter(call => call.method === 'POST')).toHaveLength(0);
  });
  it('rejects an expired plan before any activation POST', async () => {
    expiredPlan = true; render(view()); await loaded(); await fillVersion();
    await userEvent.click(screen.getByRole('button', { name: UI.labels.plan })); await screen.findByText(UI.messages.plan_error);
    expect(screen.queryByRole('button', { name: UI.labels.confirm_title })).toBeNull(); expect(count('POST', '/activate')).toBe(0);
  });
  it.each(['different_id', 'ABA'] as const)('retires a delayed plan on a committed target %s transition', async transition => {
    const pending = deferred<void>(); planGate = pending; const mounted = render(view()); await loaded(); await fillVersion();
    await userEvent.click(screen.getByRole('button', { name: UI.labels.plan })); await waitFor(() => expect(count('POST', '/activation-plan')).toBe(1));
    target = { ...A, id: 18 }; mounted.rerender(view(target)); await loaded();
    if (transition === 'ABA') { target = clone(A); mounted.rerender(view(target)); await loaded(); }
    await act(async () => { pending.resolve(); await Promise.resolve(); });
    expect(screen.queryByRole('heading', { name: UI.labels.review_title })).toBeNull(); expect(count('POST', '/activate')).toBe(0);
  });
  it('retires a prepared review on a session revision transition', async () => {
    render(view()); await loaded(); await prepareReview();
    await act(async () => { advanceChatbocSessionRevision(); }); await loaded();
    expect(screen.queryByRole('heading', { name: UI.labels.review_title })).toBeNull(); expect(count('POST', '/activate')).toBe(0);
  });
  it('retires a prepared review when an operator changes the publication inputs', async () => {
    render(view()); await loaded(); await prepareReview();
    fireEvent.change(screen.getByLabelText(UI.labels.routes), { target: { value: 'd'.repeat(64) } });
    expect(screen.queryByRole('heading', { name: UI.labels.review_title })).toBeNull();
    expect(screen.getByRole('checkbox', { name: UI.labels.reviewed_version })).not.toBeChecked(); expect(count('POST', '/activate')).toBe(0);
  });
  it('shows a mid-flow 403 and allows only an explicit descriptor GET to recover', async () => {
    deniedPlan = true; render(view()); await loaded(); await fillVersion();
    await userEvent.click(screen.getByRole('button', { name: UI.labels.plan }));
    await screen.findByRole('heading', { name: 'No pudimos cargar los datos' }); expect(count('POST', '/activation-plan')).toBe(1);
    expect(screen.queryByRole('heading', { name: UI.labels.review_title })).toBeNull();
    deniedPlan = false; await userEvent.click(screen.getByRole('button', { name: 'Actualizar estado' })); await loaded();
    expect(count('GET')).toBe(2); expect(count('POST', '/activation-plan')).toBe(1); expect(count('POST', '/activate')).toBe(0);
  });
});
