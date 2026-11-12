import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import { resetBackendBootstrapGateForTests } from '@/utils/backendBootstrapGate';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { clearLocalChatbocSession } from '@/utils/sessionLogout';

vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api', 'https://retired.example.invalid'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api',
}));
vi.mock('@/utils/api', async () => await vi.importActual<typeof import('@/utils/api')>('@/utils/api'));
import { getTicketTimeline, getTicketMessages, updateTicketReadState } from './ticketService';

const originalFetch = global.fetch;
const privateScope = { tenantSlug: 'panel-tenant', sourceModel: 'MunicipioTicket' };
const establishSession = () => usePanelSessionStore.setState({
  authToken: 'synthetic-panel-session',
  user: { id: 'synthetic-actor', rol: 'admin', email: 'actor@example.invalid' },
});
const version = () => new Response('{"backend":"synthetic-sha","frontend":"web"}');
const success = () => new Response('{"realtime_state":null}', { headers: { 'Content-Type': 'application/json' } });
const cold = () => new Response(JSON.stringify({ contract_version: 'chatboc.bootstrap.v1',
  ok: false, status_code: 503, request_dispatched: false, reason_code: 'application_initializing',
  retryable: true, action_hint: 'retry_after',
}), { status: 503, headers: { 'Content-Type': 'application/json', 'X-Chatboc-Bootstrap': 'initializing', 'Retry-After': '0' } });

beforeEach(() => {
  safeLocalStorage.clear();
  resetBackendBootstrapGateForTests();
  establishSession();
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  resetBackendBootstrapGateForTests();
  safeLocalStorage.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
});

describe('private read acknowledgements with actual apiFetch', () => {
  it('preserves chat history while exposing only backend-provided native comment identities for acknowledgement', async () => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ timeline: [], historial_chat: [
      { texto: 'Historia sin comentario persistido', fecha: '2026-08-20T12:00:00Z' },
      { id: 'provider-uuid', texto: 'Mensaje con identidad externa', fecha: '2026-08-20T12:01:00Z' },
      { id: '123', texto: 'Comentario nativo persistido', fecha: '2026-08-20T12:02:00Z' },
    ] }), { headers: { 'Content-Type': 'application/json' } }));
    const result = await getTicketTimeline(407, 'municipio', { tenantSlug: 'panel-tenant', ticket: { source_model: 'MunicipioTicket' } });
    expect(result.messages).toHaveLength(3);
    expect(result.messages.map(message => message.readCommentId)).toEqual([undefined, undefined, 123]);
    expect(result.messages.map(message => message.content)).toEqual([
      'Historia sin comentario persistido', 'Mensaje con identidad externa', 'Comentario nativo persistido']);
  });

  it('never promotes fallback array indices to native comment identities', async () => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [
      { comentario: 'Primer mensaje sin id' }, { comentario: 'Segundo mensaje sin id' },
      { id: 456, comentario: 'Comentario nativo' },
    ] }), { headers: { 'Content-Type': 'application/json' } }));
    const messages = await getTicketMessages(407, 'municipio', { tenantSlug: 'panel-tenant', ticket: { source_model: 'MunicipioTicket' } });
    expect(messages.map(message => message.id)).toEqual([0, 1, 456]);
    expect(messages.map(message => message.readCommentId)).toEqual([undefined, undefined, 456]);
  });

  it.each(['chat_history:synthetic', 'provider-uuid', '', '0', 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648, '9007199254740993'])
    ('rejects invalid native comment identity %s before any HTTP request', async id => {
      vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
      global.fetch = vi.fn();
      const error = await updateTicketReadState(407, 'municipio', id, privateScope).catch(reason => reason);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(error).toMatchObject({ status: 400 });
    });

  it('accepts an explicit native numeric-string comment id and sends exactly one canonical integer', async () => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    global.fetch = vi.fn().mockResolvedValue(success());
    await expect(updateTicketReadState(407, 'municipio', '123', privateScope)).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(JSON.parse(String(vi.mocked(global.fetch).mock.calls[0][1]?.body))).toEqual({ last_read_comment_id: 123 });
  });

  it('issues no POST while readiness is pending and exactly one after readiness succeeds', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
    let finishStartup!: (value: Response) => void;
    global.fetch = vi.fn().mockImplementation(async url => url === '/api/version'
      ? new Promise<Response>(resolve => { finishStartup = resolve; }) : success());
    const result = updateTicketReadState(407, 'municipio', 123, privateScope);
    await vi.advanceTimersByTimeAsync(9_000);
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(vi.mocked(global.fetch).mock.calls[0][1]?.method).toBe('GET');

    safeLocalStorage.setItem('tenantSlug', 'unrelated-public-tenant');
    useWidgetSessionStore.setState({ chatAuthToken: 'synthetic-widget-token' });
    finishStartup(version());
    await expect(result).resolves.toBeNull();

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const [url, init] = vi.mocked(global.fetch).mock.calls[1];
    expect(String(url)).toContain('/api/tickets/municipio/407/read-state');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ last_read_comment_id: 123 });
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer synthetic-panel-session');
    expect(headers.get('X-Tenant')).toBe('panel-tenant');
    expect(headers.has('X-Entity-Token')).toBe(false);
    expect(headers.has('X-Chat-Session')).toBe(false);
    expect(init?.credentials).toBe('include');
  });

  it('never replays a POST after an undispatched bootstrap503 receipt', async () => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    global.fetch = vi.fn().mockResolvedValue(cold());
    await expect(updateTicketReadState(407, 'municipio', 123, privateScope)).rejects.toMatchObject({ status: 503 });
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(vi.mocked(global.fetch).mock.calls[0][1]?.method).toBe('POST');
  });

  it('uses the pyme legacy endpoint only for a verified PymeTicket source', async () => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    global.fetch = vi.fn().mockResolvedValue(success());
    await expect(updateTicketReadState(407, 'pyme', 123, {
      tenantSlug: 'panel-tenant', sourceModel: 'PymeTicket',
    })).resolves.toBeNull();
    expect(global.fetch).toHaveBeenCalledOnce();
    expect(String(vi.mocked(global.fetch).mock.calls[0][0])).toContain('/api/tickets/pyme/407/read-state');
  });

  it('never falls back to another origin after an ambiguous network error', async () => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    global.fetch = vi.fn().mockRejectedValue(new TypeError('response unavailable'));
    await expect(updateTicketReadState(407, 'municipio', 123, privateScope)).rejects.toThrow('response unavailable');
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it.each(['actor', 'same-actor-relogin', 'organization', 'unmount'] as const)
    ('retires the pending acknowledgement before POST when %s changes', async change => {
      vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
      let current = true;
      global.fetch = vi.fn().mockImplementation(async () => {
        if (change === 'actor') usePanelSessionStore.setState({ user: {
          id: 'other-actor', rol: 'admin', email: 'other@example.invalid',
        } });
        else if (change === 'same-actor-relogin') { clearLocalChatbocSession(); establishSession(); }
        else current = false;
        return version();
      });
      await expect(updateTicketReadState(407, 'municipio', 123, { ...privateScope, isCurrent: () => current }))
        .rejects.toMatchObject({ name: 'AbortError' });
      expect(global.fetch).toHaveBeenCalledOnce();
      expect(vi.mocked(global.fetch).mock.calls[0][1]?.method).toBe('GET');
    });

  it('does not accept a late response after the scope is retired', async () => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
    let current = true;
    global.fetch = vi.fn().mockImplementation(async () => { current = false; return success(); });
    await expect(updateTicketReadState(407, 'municipio', 123, { ...privateScope, isCurrent: () => current }))
      .rejects.toMatchObject({ name: 'AbortError' });
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it.each(['TenantTicket', 'PymeTicket', undefined])('never sends a municipal legacy acknowledgement for source %s', async sourceModel => {
    vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'true');
    global.fetch = vi.fn();
    await expect(updateTicketReadState(407, 'municipio', 123, { ...privateScope, sourceModel }))
      .rejects.toMatchObject({ status: 400 });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
