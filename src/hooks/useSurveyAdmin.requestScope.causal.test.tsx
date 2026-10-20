import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { resetBackendBootstrapGateForTests } from '@/utils/backendBootstrapGate';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import type { SurveyDraftPayload } from '@/types/encuestas';

const runtime = vi.hoisted(() => ({ slug: 'junin', actor: '449', verified: true, profileVerified: true }));
vi.mock('@/context/TenantContext', () => ({ useTenant: () => ({ currentSlug: runtime.slug }) }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: { id: runtime.actor, rol: 'superadmin', tenant_slug: 'tierra-del-fuego' },
  hasVerifiedSession: runtime.verified, organizationProfileVerified: runtime.profileVerified }) }));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/utils/api', async () => await vi.importActual<typeof import('@/utils/api')>('@/utils/api'));
import { useSurveyAdmin } from './useSurveyAdmin';

const clients: QueryClient[] = [];
const wrapper = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
const deferred = () => { let resolve!: (value: Response) => void; const promise = new Promise<Response>(done => { resolve = done; }); return { resolve, promise }; };
const version = () => new Response('{"backend":"synthetic","frontend":"synthetic"}', { headers: { 'Content-Type': 'application/json' } });
const page = (id = 631, slug = runtime.slug) => new Response(JSON.stringify({
  contract_version: 'surveys.admin_list.v2', tenant: { id: slug === 'junin' ? 22 : 46, slug },
  freshness: { generated_at: '2026-10-06T12:00:00Z', source: 'unit_test_fixture', synthetic: false },
  encuestas: [{ id, tenant_id: slug === 'junin' ? 22 : 46, titulo: 'Synthetic survey', estado: 'cerrada', preguntas: [],
    esta_activa: false,
    admin_scope: { contract_version: 'surveys.admin_scope.v1', jurisdiction: {
      contract_version: 'surveys.admin_jurisdiction_scope.v1', status: 'compatible', compatible: true,
      reason_code: 'survey_jurisdiction_compatible', action_hint: null, tenant_verified_ref: 'ar:ba:junin',
      survey_ref: 'ar:ba:junin', authoritative_source: 'server_owned_persisted_refs', content_review_included: false,
    }, separation: { required: false, reason_code: null } },
    metricas: { total_respuestas: 0, respuestas_ultimas_24h: 0, respuestas_con_coordenadas: 0, participantes_unicos: 0 },
    admin_lifecycle: { contract_version: 'surveys.admin_lifecycle.v1', instrument_kind: 'survey', phase: 'closed',
      persisted_state: 'cerrada', accepts_responses: false, operational_block: null,
      jurisdiction: { status: 'compatible', reason_code: 'survey_jurisdiction_compatible', content_review_included: false },
      schedule: { opens_at: null, closes_at: null, evaluated_at: '2026-10-06T12:00:00Z' },
      participation: { responses: 0, unique_participants: 0, responses_last_24h: 0, last_response_at: null,
        eligible_population: null, participation_rate: null, abstentions: null,
        denominator_status: { available: false, reason_code: 'survey_eligible_population_not_configured' } },
      capabilities: { can_publish: false, can_close: false, can_delete: false, can_share: false, can_view_results: true },
      actions: { publish: { method: 'POST', endpoint: `/api/v2/surveys/${id}/publish`, enabled: false, disabled_reason_code: 'survey_not_draft' },
        close: { method: 'POST', endpoint: `/api/v2/surveys/${id}/close`, enabled: false, disabled_reason_code: 'survey_already_closed',
          confirmation_required: true, irreversible: true, required_capabilities: ['survey.close'] } },
    },
  }],
  resumen: { total: 1, por_estado: { cerrada: 1 }, activas: 0, con_respuestas: 0, total_respuestas: 0,
    respuestas_con_coordenadas: 0, respuestas_ultimas_24h: 0, accepting_responses: 0,
    por_tipo_instrumento: { survey: 1, voting: 0 },
    participation_denominator: { available: false, reason_code: 'survey_eligible_population_not_configured' } },
  pagination: { contract_version: 'surveys.pagination.v1', limit: 50, page: 1, cursor: null, next_cursor: null,
    next_page: null, has_more: false, returned: 1, total_items: 1, ordering: 'id_desc' },
}), { headers: { 'Content-Type': 'application/json' } });
const setActor = () => {
  const user = { id: runtime.actor, email: 'actor@example.invalid', rol: 'superadmin', tenant_slug: 'tierra-del-fuego' };
  usePanelSessionStore.setState({ authToken: null, user });
  safeLocalStorage.setItem('user', JSON.stringify(user));
};
const businessCalls = () => vi.mocked(global.fetch).mock.calls.filter(([url]) => String(url).includes('/admin/encuestas'));
beforeEach(() => {
  runtime.slug = 'junin'; runtime.actor = '449'; runtime.verified = true; runtime.profileVerified = true;
  safeLocalStorage.clear(); resetBackendBootstrapGateForTests();
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null }); setActor();
  safeLocalStorage.setItem('authProvider', 'clerk'); safeLocalStorage.setItem('clerkSessionTransport', 'cookie');
  safeLocalStorage.setItem('clerkUserId', 'synthetic-clerk-actor'); safeLocalStorage.setItem('tenantSlug', 'tierra-del-fuego');
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
});
afterEach(() => {
  cleanup(); clients.forEach(client => client.clear()); clients.length = 0;
  vi.unstubAllGlobals(); vi.unstubAllEnvs(); resetBackendBootstrapGateForTests(); safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null }); useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
});

describe('actual survey list panel request authority', () => {
  it('completes the first selected Junin read when public bootstrap changes presentation before dispatch', async () => {
    const ready = deferred();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => url === '/api/version' ? ready.promise : Promise.resolve(page())));
    const view = renderHook(() => useSurveyAdmin(), { wrapper: wrapper() });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    act(() => {
      safeLocalStorage.setItem('tenantSlug', 'unrelated-public-tenant');
      useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-widget-context', entityToken: 'synthetic-widget-entity' });
      ready.resolve(version());
    });
    await waitFor(() => expect(view.result.current.surveys?.data[0].id).toBe(631));
    expect(view.result.current.listError).toBeNull(); expect(businessCalls()).toHaveLength(1);
    const [url, init] = businessCalls()[0], headers = new Headers(init?.headers);
    expect(new URL(String(url), 'https://example.invalid').searchParams.get('tenant_slug')).toBe('junin');
    expect(headers.get('X-Tenant')).toBe('junin'); expect(headers.has('Authorization')).toBe(false);
    expect(headers.has('X-Entity-Token')).toBe(false); expect(headers.has('X-Token')).toBe(false);
    expect(init?.credentials).toBe('include'); expect(safeLocalStorage.getItem('tenantSlug')).toBe('unrelated-public-tenant');
    expect(usePanelSessionStore.getState().user?.rol).toBe('superadmin');
  });

  it('does not dispatch the old actor during readiness and starts only the freshly verified actor automatically', async () => {
    const ready = deferred();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => url === '/api/version' ? ready.promise : Promise.resolve(page(632))));
    const view = renderHook(() => useSurveyAdmin(), { wrapper: wrapper() });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    act(() => { runtime.verified = false; runtime.profileVerified = false; advanceChatbocSessionRevision(); });
    await act(async () => ready.resolve(version()));
    expect(businessCalls()).toHaveLength(0); expect(view.result.current.surveys).toBeUndefined();
    act(() => { runtime.actor = '450'; runtime.verified = true; runtime.profileVerified = true; setActor(); view.rerender(); });
    await waitFor(() => expect(view.result.current.surveys?.data[0].id).toBe(632));
    expect(businessCalls()).toHaveLength(1); expect(view.result.current.listError).toBeNull();
  });

  it('discards a late old-actor HTTP200 while the new actor reads the same tenant', async () => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    const old = deferred(); let count = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => ++count === 1 ? old.promise : Promise.resolve(page(632))));
    const view = renderHook(() => useSurveyAdmin(), { wrapper: wrapper() });
    await waitFor(() => expect(businessCalls()).toHaveLength(1));
    act(() => { runtime.actor = '450'; setActor(); view.rerender(); });
    await waitFor(() => expect(view.result.current.surveys?.data[0].id).toBe(632));
    await act(async () => old.resolve(page(631)));
    expect(view.result.current.surveys?.data[0].id).toBe(632); expect(view.result.current.listError).toBeNull();
    expect(businessCalls()).toHaveLength(2);
  });

  it('starts one fresh read for a true tenant generation change while retiring the undispatched previous tenant', async () => {
    const ready = deferred();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => url === '/api/version' ? ready.promise : Promise.resolve(page(634))));
    const view = renderHook(() => useSurveyAdmin(), { wrapper: wrapper() });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    act(() => { runtime.slug = 'tierra-del-fuego'; view.rerender(); });
    await act(async () => ready.resolve(version()));
    await waitFor(() => expect(view.result.current.surveys?.tenant?.slug).toBe('tierra-del-fuego'));
    expect(businessCalls()).toHaveLength(1); expect(String(businessCalls()[0][0])).not.toContain('junin');
    expect(view.result.current.listError).toBeNull();
  });

  it.each(['session', 'profile'] as const)('keeps the first read closed until %s verification completes', async missing => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    runtime.verified = missing !== 'session'; runtime.profileVerified = missing !== 'profile';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(page()));
    const view = renderHook(() => useSurveyAdmin(), { wrapper: wrapper() });
    expect(global.fetch).not.toHaveBeenCalled(); expect(view.result.current.surveys).toBeUndefined();
    act(() => { runtime.verified = true; runtime.profileVerified = true; view.rerender(); });
    await waitFor(() => expect(view.result.current.surveys?.data).toHaveLength(1));
    expect(businessCalls()).toHaveLength(1);
  });

  it('keeps real denial terminal without automatic retry or alternate route', async () => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"reason_code":"permission_denied"}', { status: 403, headers: { 'Content-Type': 'application/json' } })));
    const view = renderHook(() => useSurveyAdmin(), { wrapper: wrapper() });
    await waitFor(() => expect(view.result.current.listError).toBeTruthy());
    expect(global.fetch).toHaveBeenCalledOnce(); expect(view.result.current.surveys).toBeUndefined();
  });

  it('isolates detail cache and ignores a late response from the previous actor for the same survey', async () => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    const old = deferred(); let details = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => String(url).includes('/encuestas/631')
      ? ++details === 1 ? old.promise : Promise.resolve(new Response(JSON.stringify({ id: 631, titulo: 'Current actor detail', preguntas: [] })))
      : Promise.resolve(page())));
    const view = renderHook(() => useSurveyAdmin({ id: 631 }), { wrapper: wrapper() });
    await waitFor(() => expect(details).toBe(1));
    act(() => { runtime.actor = '450'; setActor(); view.rerender(); });
    await waitFor(() => expect(view.result.current.survey?.titulo).toBe('Current actor detail'));
    await act(async () => old.resolve(new Response(JSON.stringify({ id: 631, titulo: 'Retired actor detail', preguntas: [] }))));
    expect(view.result.current.survey?.titulo).toBe('Current actor detail'); expect(details).toBe(2);
    await act(async () => { await view.result.current.refetchSurvey(); });
    expect(view.result.current.survey?.titulo).toBe('Current actor detail'); expect(details).toBe(3);
  });

  it.each(['network', 'undispatched_startup'] as const)('keeps a survey write single-attempt after %s failure', async failure => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method !== 'POST') return Promise.resolve(page());
      if (failure === 'network') return Promise.reject(new TypeError('synthetic transport failure'));
      return Promise.resolve(new Response(JSON.stringify({ contract_version: 'chatboc.bootstrap.v1', status_code: 503,
        ok: false, reason_code: 'application_initializing', retryable: true, request_dispatched: false, action_hint: 'retry_after' }),
      { status: 503, headers: { 'Content-Type': 'application/json', 'X-Chatboc-Bootstrap': 'initializing', 'Retry-After': '0' } }));
    }));
    const view = renderHook(() => useSurveyAdmin(), { wrapper: wrapper() });
    await waitFor(() => expect(view.result.current.surveys?.data).toHaveLength(1));
    let error: unknown;
    await act(async () => { try { await view.result.current.createSurvey({ titulo: 'Synthetic draft', preguntas: [] } as SurveyDraftPayload); }
      catch (caught) { error = caught; } });
    expect(error).toBeTruthy();
    const writes = vi.mocked(global.fetch).mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(writes).toHaveLength(1); expect(String(writes[0][0])).toContain('/api/admin/encuestas');
    expect(new Headers(writes[0][1]?.headers).get('X-Tenant')).toBe('junin');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
