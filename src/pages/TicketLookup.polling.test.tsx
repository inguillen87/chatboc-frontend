import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  ticketId: 'M-400', params: new URLSearchParams('pin=9999'),
  lookup: vi.fn(), timeline: vi.fn(), messages: vi.fn(), schedule: vi.fn(), send: vi.fn(), telemetry: vi.fn(),
}));
vi.mock('react-router-dom', async (original) => ({
  ...await original<typeof import('react-router-dom')>(),
  useParams: () => ({ ticketId: state.ticketId }), useSearchParams: () => [state.params, vi.fn()], useNavigate: () => vi.fn(),
}));
vi.mock('@/services/ticketService', () => ({
  getTicketByNumber: state.lookup, getTicketTimeline: state.timeline, getTicketMessages: state.messages,
  getLiveChatScheduleStatus: state.schedule, sendMessage: state.send,
  updateTicketPresence: vi.fn().mockResolvedValue(null), updateTicketReadState: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/utils/frontendTelemetry', () => ({ trackFrontendEvent: state.telemetry }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/ui/TrackingMap', () => ({ default: () => <div>isolated-map</div> }));
vi.mock('@/components/ui/Confetti', () => ({ default: () => null }));

let TicketLookup: React.ComponentType;
let hidden = false;
beforeAll(async () => { TicketLookup = (await import('./TicketLookup')).default; }, 30_000);
beforeEach(() => {
  vi.useFakeTimers();
  hidden = false; state.ticketId = 'M-400'; state.params = new URLSearchParams('pin=9999');
  for (const mock of [state.lookup, state.timeline, state.messages, state.schedule, state.send, state.telemetry]) mock.mockReset();
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => hidden ? 'hidden' : 'visible');
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in public tracking tests'); }));
  window.localStorage.clear(); window.sessionStorage.clear();
  state.lookup.mockResolvedValue(ticket());
  state.timeline.mockResolvedValue(timeline());
  state.messages.mockResolvedValue({ messages: [], realtimeState: null });
  state.schedule.mockResolvedValue({ enabled: true, available: true, socket_enabled: false });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function ticket(id = 400, estado = 'en_proceso') {
  return { id, tipo: 'municipio', tenant_slug: 'tenant-a', nro_ticket: `M-${id}`, asunto: 'Seguimiento aislado', estado,
    fecha: '2026-10-14T10:00:00Z', history: [],
    messages: [{ id: 1, author: 'user', content: 'Última lectura verificada', timestamp: '2026-10-14T10:00:00Z' }],
  };
}
function timeline(messages: unknown[] = []) { return { estado_chat: 'activo', history: [], messages, unified_conversation_stream: [] }; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
async function advance(ms: number) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
async function start() {
  const view = render(<TicketLookup />); await advance(1000);
  expect(screen.getByRole('heading', { name: 'En Proceso' })).toBeInTheDocument();
  expect(screen.getByText('Última lectura verificada')).toBeInTheDocument();
  return view;
}
function changeVisibility(value: boolean) { hidden = value; fireEvent(document, new Event('visibilitychange')); }
function counts() { return { lookup: state.lookup.mock.calls.length, timeline: state.timeline.mock.calls.length, messages: state.messages.mock.calls.length }; }

describe('public ticket refresh lifecycle', () => {
  it('pauses hidden reads and resumes once without clearing the draft or replaying a send', async () => {
    const view = await start();
    fireEvent.click(screen.getAllByRole('button', { name: /Agregar comentario/i })[0]);
    fireEvent.change(screen.getByPlaceholderText(/observación pública/i), { target: { value: 'Borrador conservado' } });
    const before = counts();
    changeVisibility(true); await advance(60_000);
    expect(counts()).toEqual(before);
    expect(screen.getByPlaceholderText(/observación pública/i)).toHaveValue('Borrador conservado');
    await act(async () => { changeVisibility(false); document.dispatchEvent(new Event('visibilitychange')); });
    expect(counts()).toEqual({ lookup: before.lookup + 1, timeline: before.timeline + 1, messages: before.messages + 1 });
    expect(state.lookup).toHaveBeenLastCalledWith('M-400', '9999');
    expect(screen.getByPlaceholderText(/observación pública/i)).toHaveValue('Borrador conservado');
    expect(state.send).not.toHaveBeenCalled();
    await advance(10_000);
    expect(state.lookup).toHaveBeenCalledTimes(before.lookup + 2);
    view.unmount(); await advance(60_000);
    expect(state.lookup).toHaveBeenCalledTimes(before.lookup + 2);
  });

  it('serializes the complete lookup and conversation read until both finish', async () => {
    await start(); const before = counts();
    const lookup = deferred<ReturnType<typeof ticket>>();
    const conversation = deferred<ReturnType<typeof timeline>>();
    state.lookup.mockReturnValueOnce(lookup.promise);
    state.timeline.mockReturnValueOnce(conversation.promise);
    await advance(10_000); await advance(60_000);
    expect(counts()).toEqual({ ...before, lookup: before.lookup + 1 });
    await act(async () => { lookup.resolve(ticket()); });
    await advance(60_000);
    expect(counts()).toEqual({ lookup: before.lookup + 1, timeline: before.timeline + 1, messages: before.messages + 1 });
    await act(async () => { conversation.resolve(timeline()); });
    await advance(10_000);
    expect(counts()).toEqual({ lookup: before.lookup + 2, timeline: before.timeline + 2, messages: before.messages + 2 });
  });

  it('does not start conversation reads or rearm polling after the tab hides during a lookup', async () => {
    await start(); const before = counts(); const pending = deferred<ReturnType<typeof ticket>>();
    state.lookup.mockReturnValueOnce(pending.promise); await advance(10_000);
    changeVisibility(true);
    await act(async () => { pending.resolve(ticket()); }); await advance(60_000);
    expect(counts()).toEqual({ ...before, lookup: before.lookup + 1 });
    await act(async () => { changeVisibility(false); });
    expect(counts()).toEqual({ lookup: before.lookup + 2, timeline: before.timeline + 1, messages: before.messages + 1 });
  });

  it('retires an old poll when a new PIN lookup starts and refreshes with the newly verified PIN', async () => {
    const view = await start(); const oldPoll = deferred<ReturnType<typeof ticket>>();
    state.lookup.mockReturnValueOnce(oldPoll.promise); await advance(10_000);
    const newLookup = deferred<ReturnType<typeof ticket>>();
    state.lookup.mockReturnValueOnce(newLookup.promise);
    state.params = new URLSearchParams('pin=8888');
    view.rerender(<TicketLookup />); await advance(0);
    const whileLoading = counts(); await advance(60_000);
    expect(counts()).toEqual(whileLoading);
    await act(async () => { newLookup.resolve({ ...ticket(), tenant_slug: 'tenant-b' }); });
    const afterVerification = counts();
    await act(async () => { oldPoll.resolve(ticket(400, 'cerrado')); });
    expect(counts()).toEqual(afterVerification);
    expect(screen.getByRole('heading', { name: 'En Proceso' })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('ticket_public_access') || '{}')).toMatchObject({ ticketId: 400, pin: '8888', tenantSlug: 'tenant-b' });
    await advance(10_000);
    expect(state.lookup).toHaveBeenLastCalledWith('M-400', '8888');
    expect(state.timeline).toHaveBeenLastCalledWith(400, 'municipio', { public: true, pin: '8888' });
  });

  it.each([
    { tipo: 'pyme', ticketNumber: 'P-400', tenantSlug: 'tenant-a' },
    { tipo: 'municipio', ticketNumber: 'M-999', tenantSlug: 'tenant-a' },
    { tipo: 'municipio', ticketNumber: 'M-400', tenantSlug: 'tenant-b' },
  ])('ignores a cached PIN from a different ticket context: %j', async (foreign) => {
    await start();
    window.localStorage.setItem('ticket_public_access', JSON.stringify({ ticketId: 400, pin: 'foreign-pin', ...foreign }));
    await advance(10_000);
    expect(state.lookup).toHaveBeenLastCalledWith('M-400', '9999');
    expect(state.timeline).toHaveBeenLastCalledWith(400, 'municipio', { public: true, pin: '9999' });
    expect(state.send).not.toHaveBeenCalled();
  });

  it('discards a pending old lookup when the selected ticket changes', async () => {
    const view = await start(); const pending = deferred<ReturnType<typeof ticket>>();
    state.lookup.mockReturnValueOnce(pending.promise); await advance(10_000);
    state.ticketId = 'M-501'; state.lookup.mockResolvedValue(ticket(501));
    view.rerender(<TicketLookup />); await advance(0);
    const afterSwitch = counts();
    await act(async () => { pending.resolve(ticket(400, 'cerrado')); });
    expect(counts()).toEqual(afterSwitch);
    expect(screen.getByRole('heading', { name: 'En Proceso' })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('ticket_public_access') || '{}')).toMatchObject({ ticketId: 501, pin: '9999' });
    await advance(10_000);
    expect(state.lookup).toHaveBeenLastCalledWith('M-501', '9999');
  });

  it('ignores late conversation data after switching scope and retires pending reads on unmount', async () => {
    const view = await start(); const pendingConversation = deferred<ReturnType<typeof timeline>>();
    state.timeline.mockReturnValueOnce(pendingConversation.promise); await advance(10_000);
    state.ticketId = 'M-501'; state.lookup.mockResolvedValue(ticket(501));
    view.rerender(<TicketLookup />); await advance(0);
    await act(async () => { pendingConversation.resolve(timeline([{ id: 99, author: 'admin', content: 'Respuesta retirada del contexto anterior', timestamp: '2026-10-14T10:01:00Z' }])); });
    expect(screen.queryByText('Respuesta retirada del contexto anterior')).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('ticket_public_access') || '{}')).toMatchObject({ ticketId: 501, pin: '9999' });
    const pendingLookup = deferred<ReturnType<typeof ticket>>();
    state.lookup.mockReturnValueOnce(pendingLookup.promise); await advance(10_000);
    const beforeUnmount = counts(); const access = window.localStorage.getItem('ticket_public_access');
    view.unmount();
    await act(async () => { pendingLookup.resolve(ticket(400)); }); await advance(60_000);
    expect(counts()).toEqual(beforeUnmount);
    expect(window.localStorage.getItem('ticket_public_access')).toEqual(access);
  });

  it.each([403, 404])('preserves the verified data and status-specific telemetry on a %s periodic read failure', async (status) => {
    await start(); const before = counts();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    state.lookup.mockRejectedValueOnce({ status }); await advance(10_000);
    expect(state.telemetry).toHaveBeenCalledWith('tracking_public_refresh_failed', { ticket_lookup: 'M-400', status });
    if (status === 403) expect(state.telemetry).toHaveBeenCalledWith('tracking_403_detected', expect.objectContaining({ ticket_lookup: 'M-400' }));
    expect(screen.getByText('Última lectura verificada')).toBeInTheDocument();
    expect(counts()).toEqual({ ...before, lookup: before.lookup + 1 });
    changeVisibility(true); await advance(60_000);
    expect(state.lookup).toHaveBeenCalledTimes(before.lookup + 1);
    expect(state.send).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledTimes(1);
  });
});
