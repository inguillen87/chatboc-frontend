import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { workspace, reply } from '../../../tests/fixtures/institutional-assistant.synthetic';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { usePanelSessionStore, useTenantStore, useWidgetSessionStore } from '@/stores';
import { panelReadOptions } from '@/utils/panelReadOptions';

// Actual component, contract parser and apiFetch; only local Response fixtures.
vi.mock('@/utils/api', async () => await vi.importActual('@/utils/api'));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(), API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api' }));
vi.mock('@/utils/backendBootstrapGate', () => ({ ensureBackendRuntimeReady: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/utils/anonId', () => ({ ensureRemoteAnonId: vi.fn().mockResolvedValue('synthetic-visitor') }));

import InstitutionalAssistant from './InstitutionalAssistant';
import { loadWorkspace, askWorkspace } from './institutionalAssistantContract';
import { apiFetch } from '@/utils/api';

const originalFetch = global.fetch;
const deferred = <T,>() => { let resolve!: (value: T) => void; return { promise: new Promise<T>(r => { resolve = r; }), resolve: (value: T) => resolve(value) }; };
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const publicWorkspace = (slug = 'qa-knowledge') => workspace({ visibility: 'public', can_edit: false, tenant: { id: slug === 'qa-knowledge' ? 701 : 702, slug, name: `Institución pública ${slug}` } });
const refreshPrivateSession = () => {
  usePanelSessionStore.setState({ authToken: 'synthetic-refreshed-private-session' });
  safeLocalStorage.setItem('authToken', 'synthetic-refreshed-private-session');
  safeLocalStorage.setItem('tenantSlug', 'junin');
};
function PrivateRefreshParent({ tenantSlug }: { tenantSlug: string }) {
  usePanelSessionStore(state => state.authToken);
  return <InstitutionalAssistant tenantSlug={tenantSlug} mode="public" />;
}
const expectAnonymousKnowledgeRead = (init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  expect(headers.has('Authorization')).toBe(false);
  expect(headers.has('X-Entity-Token')).toBe(false);
  expect(headers.has('X-Chat-Session-Id')).toBe(false);
  expect(headers.get('X-Tenant-Slug')).toBe('qa-knowledge');
  expect(init?.credentials).toBe('omit');
  expect(init?.method).toBe('GET');
};

beforeEach(() => {
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: 'synthetic-private-session', user: { id: 4, rol: 'admin_municipio', tenant_slug: 'junin' } as any });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  useTenantStore.getState().setTenant('junin');
  safeLocalStorage.setItem('authToken', 'synthetic-private-session');
  safeLocalStorage.setItem('user', JSON.stringify({ id: 4, rol: 'admin_municipio', tenant_slug: 'junin', permissions: ['knowledge.read'] }));
  window.history.replaceState({}, '', '/t/qa-knowledge');
});
afterEach(() => {
  cleanup(); global.fetch = originalFetch; vi.restoreAllMocks();
  safeLocalStorage.clear(); usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  useTenantStore.getState().clearTenant(); window.history.replaceState({}, '', '/');
});

describe('published knowledge GET independent of private panel refresh', () => {
  it('renders the actual public assistant after the private /me read refreshes its independent session', async () => {
    const pending = deferred<Response>();
    global.fetch = vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input), window.location.origin);
      return url.pathname.endsWith('/institutional-assistant') ? pending.promise : Promise.resolve(json({ id: 4, rol: 'admin_municipio', tenant_slug: 'junin' }));
    }) as typeof fetch;
    const previousUser = safeLocalStorage.getItem('user');
    render(<PrivateRefreshParent tenantSlug="qa-knowledge" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    const me = await apiFetch<{ id: number; tenant_slug: string }>('/api/me', panelReadOptions('junin'));
    expect(me).toMatchObject({ id: 4, tenant_slug: 'junin' });
    act(refreshPrivateSession);
    await act(async () => { pending.resolve(json(publicWorkspace())); });
    expect(await screen.findByRole('heading', { name: 'Información y orientación' })).toBeVisible();
    expect(screen.getByText('Institución pública qa-knowledge')).toBeVisible();
    expect(screen.getByText('Elegí un tema o escribí una pregunta.')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Habilitar en el agente' })).not.toBeInTheDocument();
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('junin');
    expect(useTenantStore.getState().slug).toBe('junin');
    expect(safeLocalStorage.getItem('user')).toBe(previousUser);
    expect(usePanelSessionStore.getState().user?.id).toBe(4);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(global.fetch).mock.calls;
    expectAnonymousKnowledgeRead(calls[0][1]);
    expect(new URL(String(calls[0][0]), window.location.origin).searchParams.get('tenant')).toBe('qa-knowledge');
    expect(new Headers(calls[1][1]?.headers).get('Authorization')).toBe('Bearer synthetic-private-session');
    expect(calls[1][1]?.credentials).toBe('include');
  });

  it('renders the actual public assistant across private /me refresh while its JSON body is pending', async () => {
    const pending = deferred<string>(); const response = json(publicWorkspace());
    const body = vi.spyOn(response, 'text').mockReturnValue(pending.promise);
    global.fetch = vi.fn((input: RequestInfo | URL) => Promise.resolve(String(input).includes('/institutional-assistant')
      ? response : json({ id: 4, rol: 'admin_municipio', tenant_slug: 'junin' }))) as typeof fetch;
    render(<PrivateRefreshParent tenantSlug="qa-knowledge" />);
    await vi.waitFor(() => expect(body).toHaveBeenCalledOnce());
    const me = await apiFetch<{ id: number; tenant_slug: string }>('/api/me', panelReadOptions('junin'));
    expect(me).toMatchObject({ id: 4, tenant_slug: 'junin' });
    act(refreshPrivateSession);
    await act(async () => { pending.resolve(JSON.stringify(publicWorkspace())); });
    expect(await screen.findByRole('heading', { name: 'Información y orientación' })).toBeVisible();
    expect(screen.getByText('Institución pública qa-knowledge')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(usePanelSessionStore.getState().user?.id).toBe(4);
    expect(useTenantStore.getState().slug).toBe('junin');
    expectAnonymousKnowledgeRead(vi.mocked(global.fetch).mock.calls[0][1]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps public node GETs independent while retaining exact tenant, revision and source parsing', async () => {
    const pending = deferred<Response>(); global.fetch = vi.fn().mockReturnValue(pending.promise);
    const model = publicWorkspace(); const read = askWorkspace(model, 'public', { node_id: 'requirements' });
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    refreshPrivateSession(); pending.resolve(json(reply('requirements', model)));
    await expect(read).resolves.toMatchObject({ tenant: { id: 701, slug: 'qa-knowledge' }, revision: model.revision });
    expectAnonymousKnowledgeRead(vi.mocked(global.fetch).mock.calls[0][1]);
    expect(new URL(String(vi.mocked(global.fetch).mock.calls[0][0]), window.location.origin).searchParams.get('revision')).toBe(model.revision);
  });

  it('does not display a late public A workspace after changing to B', async () => {
    const pending = deferred<Response>();
    global.fetch = vi.fn((input: RequestInfo | URL) => String(input).includes('/qa-knowledge/') ? pending.promise : Promise.resolve(json(publicWorkspace('qa-other')))) as typeof fetch;
    const view = render(<InstitutionalAssistant tenantSlug="qa-knowledge" mode="public" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    view.rerender(<InstitutionalAssistant tenantSlug="qa-other" mode="public" />);
    expect(await screen.findByText('Institución pública qa-other')).toBeVisible();
    await act(async () => { pending.resolve(json(publicWorkspace())); });
    expect(screen.queryByText('Institución pública qa-knowledge')).not.toBeInTheDocument();
    expect(screen.getByText('Institución pública qa-other')).toBeVisible();
    expect(safeLocalStorage.getItem('tenantSlug')).toBe('junin');
  });

  it('keeps a retired public caller terminal before reading its body', async () => {
    const pending = deferred<Response>(); global.fetch = vi.fn().mockReturnValue(pending.promise);
    let current = true; const read = loadWorkspace('qa-knowledge', 'public', { isCurrent: () => current });
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledOnce()); current = false;
    const response = json(publicWorkspace()); const body = vi.spyOn(response, 'text'); pending.resolve(response);
    await expect(read).rejects.toMatchObject({ name: 'AbortError' }); expect(body).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('preserves the caller AbortSignal for the real public transport', async () => {
    const controller = new AbortController(); global.fetch = vi.fn().mockImplementation((_url, init) => {
      expect(init?.signal).toBe(controller.signal);
      return new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Request retired', 'AbortError')), { once: true }));
    });
    const read = loadWorkspace('qa-knowledge', 'public', { signal: controller.signal });
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledOnce()); controller.abort();
    await expect(read).rejects.toMatchObject({ name: 'AbortError' }); expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('keeps private knowledge GETs bound to the selected authenticated session', async () => {
    const pending = deferred<Response>(); global.fetch = vi.fn().mockReturnValue(pending.promise);
    const read = loadWorkspace('junin', 'admin'); await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledOnce());
    refreshPrivateSession(); const response = json(workspace({ tenant: { id: 22, slug: 'junin', name: 'Institución privada' } }));
    const body = vi.spyOn(response, 'text'); pending.resolve(response);
    await expect(read).rejects.toMatchObject({ name: 'AbortError' }); expect(body).not.toHaveBeenCalled();
    expect(new Headers(vi.mocked(global.fetch).mock.calls[0][1]?.headers).get('Authorization')).toBe('Bearer synthetic-private-session');
    expect(vi.mocked(global.fetch).mock.calls[0][1]?.credentials).toBe('include');
  });

  it('keeps a public answer POST on its original identity and never replays it after refresh', async () => {
    const pending = deferred<Response>(); global.fetch = vi.fn().mockReturnValue(pending.promise);
    const model = publicWorkspace(); const write = askWorkspace(model, 'public', { node_id: 'start', question: 'Consulta de prueba' });
    await vi.waitFor(() => expect(global.fetch).toHaveBeenCalledOnce()); refreshPrivateSession();
    const response = json(reply('requirements', model)); const body = vi.spyOn(response, 'text'); pending.resolve(response);
    await expect(write).rejects.toMatchObject({ name: 'AbortError' }); expect(body).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledOnce(); expect(vi.mocked(global.fetch).mock.calls[0][1]?.method).toBe('POST');
  });

  it('rejects a public workspace for a different tenant after transport succeeds', async () => {
    global.fetch = vi.fn().mockResolvedValue(json(publicWorkspace('qa-other')));
    await expect(loadWorkspace('qa-knowledge', 'public')).rejects.toThrow('knowledge_response_invalid');
    expect(global.fetch).toHaveBeenCalledOnce();
  });
});
