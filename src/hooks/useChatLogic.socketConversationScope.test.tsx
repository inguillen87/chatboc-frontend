import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { workspace } from '../../tests/fixtures/institutional-assistant.synthetic';
import { usePanelSessionStore, useWidgetSessionStore } from '@/stores';
import { safeLocalStorage } from '@/utils/safeLocalStorage';
import { resetBackendBootstrapGateForTests } from '@/utils/backendBootstrapGate';

type FakeSocket = {
  options: Record<string, any>;
  handlers: Map<string, (...args: any[]) => void>;
  connected: boolean;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  io: { engine: { transport: { name: string } } };
};
const boundary = vi.hoisted(() => ({ sockets: [] as FakeSocket[], user: null as Record<string, any> | null }));
vi.mock('socket.io-client', () => ({ io: vi.fn((_url: string, options: Record<string, any>) => {
  const socket = { options, handlers: new Map(), connected: false,
    on: vi.fn(), off: vi.fn(), emit: vi.fn(), disconnect: vi.fn(),
    io: { engine: { transport: { name: 'synthetic-only' } } },
  } as FakeSocket;
  socket.on.mockImplementation((event: string, handler: (...args: any[]) => void) => { socket.handlers.set(event, handler); return socket; });
  socket.off.mockImplementation((event: string, handler: (...args: any[]) => void) => {
    if (socket.handlers.get(event) === handler) socket.handlers.delete(event); return socket;
  });
  socket.disconnect.mockImplementation(() => { socket.connected = false; return socket; });
  boundary.sockets.push(socket); return socket;
}) }));
vi.mock('@/config', async original => ({ ...await original<typeof import('@/config')>(),
  API_BASE_CANDIDATES: ['/api'], BASE_API_URL: '/api', SAME_ORIGIN_PROXY_BASE: '/api',
}));
vi.mock('@/utils/api', async () => await vi.importActual<typeof import('@/utils/api')>('@/utils/api'));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: boundary.user }) }));
vi.mock('@/utils/widgetTelemetry', () => ({ trackWidgetEvent: vi.fn() }));
import { useChatLogic } from './useChatLogic';

// The hook, session partition and HTTP adapter are real. HTTP, identities and
// Socket.IO callbacks are synthetic; this file never opens a network socket.
type Sent = { tenant: string; session: string; header: string | null; authorization: string | null; credentials: RequestCredentials | undefined; question: string };
const sent: Sent[] = [];
const seenActors = new Set<string>();
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
let delayed: { tenant: string; question: string; release?: () => void } | null;
const published = (slug: string) => { const value = structuredClone(workspace({ visibility: 'public', can_edit: false }));
  value.tenant.slug = slug; value.tenant.id = slug === 'qa-juni' ? 702 : 701; return value; };
const options = (slug: string, socketEnabled = true) => ({ tipoChat: 'municipio' as const,
  tenantSlug: slug, skipAuth: false, socketEnabled, autoInitEnabled: false });
const token = (userId: number, rol: string) => {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ user_id: userId, rol, exp: Math.floor(Date.now() / 1000) + 3600 })}.synthetic-signature`;
};
const installPanelActor = (id: number, rol: string) => {
  const value = token(id, rol);
  boundary.user = { id, rol, name: 'Synthetic ' + rol, email: rol + '@example.invalid' };
  safeLocalStorage.setItem('user', JSON.stringify(boundary.user)); safeLocalStorage.setItem('authToken', value);
  usePanelSessionStore.setState({ authToken: value, user: boundary.user as never });
  return value;
};
const connect = async (socket: FakeSocket) => {
  await act(async () => { socket.connected = true; socket.handlers.get('connect')?.(); });
};
const joins = (socket: FakeSocket) => socket.emit.mock.calls.filter(([event]) => event === 'join');
const waitHandle = async (hook: { current: ReturnType<typeof useChatLogic> }) => {
  await waitFor(() => expect(hook.current.conversationHandle?.isCurrent()).toBe(true));
  return hook.current.conversationHandle!;
};
const send = async (hook: { current: ReturnType<typeof useChatLogic> }, text: string) => {
  await act(async () => { await hook.current.handleSend(text); });
};

beforeEach(() => {
  cleanup(); safeLocalStorage.clear(); window.sessionStorage.clear(); sent.length = 0;
  boundary.sockets.length = 0; boundary.user = null; delayed = null; seenActors.clear();
  usePanelSessionStore.setState({ authToken: null, user: null });
  useWidgetSessionStore.setState({ chatAuthToken: null, entityToken: null });
  vi.stubEnv('VITE_BACKEND_BOOTSTRAP_GATE_ENABLED', 'false');
  vi.stubGlobal('fetch', vi.fn((url: RequestInfo | URL, request: RequestInit = {}) => {
    const path = new URL(String(url), 'https://synthetic.example');
    if (request.method === 'GET') {
      const match = path.pathname.match(/tenants\/([^/]+)\/institutional-assistant$/);
      if (!match) throw new Error('Unexpected synthetic GET ' + path.pathname);
      return Promise.resolve(json(published(match[1])));
    }
    if (request.method !== 'POST' || typeof request.body !== 'string') throw new Error('Unexpected synthetic mutation');
    const body = JSON.parse(request.body), headers = new Headers(request.headers);
    const value = { tenant: String(body.tenant_slug), session: String(body.session_id),
      header: headers.get('X-Chat-Session-Id'), authorization: headers.get('Authorization'),
      credentials: request.credentials, question: String(body.pregunta) };
    sent.push(value);
    const actorKey = JSON.stringify([value.tenant, value.authorization]);
    const first = !seenActors.has(actorKey); seenActors.add(actorKey);
    const response = json({ message_body: 'Respuesta sintética de ' + value.tenant,
      ...(first ? { ux_context: { visibility_rules: { allow_websocket: true, allow_realtime_live_chat: true } } } : {}) });
    if (delayed?.tenant === value.tenant && delayed.question === value.question) {
      return new Promise<Response>(resolve => { delayed!.release = () => resolve(response); });
    }
    return Promise.resolve(response);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); resetBackendBootstrapGateForTests(); vi.restoreAllMocks(); });

describe('normal widget HTTP and socket conversation ownership', () => {
  it('keeps the anonymous HTTP actor/cookie policy on the socket and rejoins its exact UUID after HTTP200', async () => {
    installPanelActor(900, 'super_admin');
    const hook = renderHook(() => useChatLogic(options('qa-juni')));
    await waitHandle(hook.result); await send(hook.result, 'Primera consulta');
    await waitFor(() => expect(boundary.sockets).toHaveLength(1));
    const socket = boundary.sockets[0];
    expect(sent[0]).toMatchObject({ authorization: null, credentials: 'omit' });
    expect(socket.options.withCredentials).toBe(false);
    expect(socket.options.auth.token).toBeUndefined();
    expect(socket.options.auth).not.toHaveProperty('anon_id');
    await connect(socket);
    expect(sent[0].session).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(sent[0].header).toBe(sent[0].session);
    expect(joins(socket)).toEqual([['join', { room: sent[0].session, channel: 'web' }]]);
    await send(hook.result, 'Segunda consulta');
    expect(sent).toHaveLength(2); expect(sent[1].session).toBe(sent[0].session); expect(sent[1].header).toBe(sent[1].session);
    expect(joins(socket)).toEqual([['join', { room: sent[0].session, channel: 'web' }], ['join', { room: sent[0].session, channel: 'web' }]]);
  });

  it('ignores retired tenant socket callbacks and a late HTTP ACK instead of joining or rendering into the new tenant', async () => {
    const hook = renderHook(({ slug }) => useChatLogic(options(slug)), { initialProps: { slug: 'qa-tdf' } });
    await waitHandle(hook.result); await send(hook.result, 'Primera A');
    await waitFor(() => expect(boundary.sockets).toHaveLength(1));
    const old = boundary.sockets[0]; await connect(old);
    const oldConnect = old.handlers.get('connect')!, oldMessage = old.handlers.get('message')!;
    delayed = { tenant: 'qa-tdf', question: 'A tardía' };
    let pending!: Promise<void>; act(() => { pending = hook.result.current.handleSend('A tardía'); });
    await waitFor(() => expect(delayed?.release).toBeTypeOf('function'));
    hook.rerender({ slug: 'qa-juni' }); await waitHandle(hook.result); await send(hook.result, 'Primera B');
    await waitFor(() => expect(boundary.sockets).toHaveLength(2));
    const current = boundary.sockets[1]; await connect(current);
    const currentId = hook.result.current.conversationHandle!.sessionId;
    const oldJoinCount = joins(old).length, currentJoinCount = joins(current).length;
    await act(async () => { oldConnect(); oldMessage({ message_body: 'Respuesta WS A retirada' }); delayed!.release!(); await pending; });
    expect(old.disconnect).toHaveBeenCalled(); expect(joins(old)).toHaveLength(oldJoinCount); expect(joins(current)).toHaveLength(currentJoinCount);
    expect(hook.result.current.conversationHandle?.sessionId).toBe(currentId);
    expect(hook.result.current.messages.some(message => message.text.includes('WS A retirada'))).toBe(false);
    expect(sent.filter(value => value.tenant === 'qa-juni')).toHaveLength(1);
  });

  it('uses an admitted widget actor for HTTP and handshake, and retires that socket on actor change', async () => {
    const firstToken = token(901, 'ciudadano'), nextToken = token(902, 'ciudadano');
    useWidgetSessionStore.setState({ chatAuthToken: firstToken, entityToken: null });
    const hook = renderHook(() => useChatLogic(options('qa-juni')));
    const previous = await waitHandle(hook.result); await send(hook.result, 'Actor A');
    await waitFor(() => expect(boundary.sockets).toHaveLength(1));
    const old = boundary.sockets[0]; await connect(old);
    expect(sent[0].authorization).toBe('Bearer ' + firstToken); expect(old.options.auth.token).toBe(firstToken);
    expect(old.options.withCredentials).toBe(false);
    const oldConnect = old.handlers.get('connect')!, oldMessage = old.handlers.get('bot_response')!;
    act(() => { useWidgetSessionStore.setState({ chatAuthToken: nextToken }); });
    await waitFor(() => expect(hook.result.current.conversationHandle?.authority.token).toBe(nextToken));
    await send(hook.result, 'Actor B'); await waitFor(() => expect(boundary.sockets).toHaveLength(2));
    const current = boundary.sockets[1]; await connect(current);
    expect(previous.isCurrent()).toBe(false); expect(sent[1].session).not.toBe(sent[0].session);
    expect(sent[1].authorization).toBe('Bearer ' + nextToken); expect(current.options.auth.token).toBe(nextToken);
    const before = joins(current).length;
    await act(async () => { oldConnect(); oldMessage({ message_body: 'Actor A retirado' }); });
    expect(joins(current)).toHaveLength(before); expect(old.disconnect).toHaveBeenCalled();
    expect(hook.result.current.messages.some(message => message.text.includes('Actor A retirado'))).toBe(false);
  });

  it('does not prefill an anonymous claim from a SuperAdmin panel profile even with a syntactically valid panel JWT', async () => {
    installPanelActor(900, 'super_admin');
    const hook = renderHook(() => useChatLogic(options('qa-juni', false)));
    const handle = await waitHandle(hook.result); expect(handle.authority.token).toBeNull();
    await act(async () => { await hook.result.current.handleSend({ action: 'iniciar_creacion_reclamo' }); });
    expect(sent).toHaveLength(0);
    expect(hook.result.current.contexto).toMatchObject({ estado_conversacion: 'recolectando_datos_personales',
      datos_reclamo: { nombre_ciudadano: null, email_ciudadano: null } });
    expect(JSON.stringify(hook.result.current.messages)).not.toContain(boundary.user!.email);
    expect(JSON.stringify(hook.result.current.messages)).not.toContain(boundary.user!.name);
  });

  it('preserves current citizen profile confirmation when that panel actor is actually admitted to the widget', async () => {
    const admitted = installPanelActor(903, 'ciudadano');
    const hook = renderHook(() => useChatLogic(options('qa-juni', false)));
    const handle = await waitHandle(hook.result); expect(handle.authority.token).toBe(admitted);
    await act(async () => { await hook.result.current.handleSend({ action: 'iniciar_creacion_reclamo' }); });
    expect(sent).toHaveLength(0);
    expect(hook.result.current.contexto).toMatchObject({ estado_conversacion: 'confirmando_reclamo',
      datos_reclamo: { nombre_ciudadano: boundary.user!.name, email_ciudadano: boundary.user!.email } });
  });
});
