import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  ticketId: 'M-400', params: new URLSearchParams('pin=9999'),
  lookup: vi.fn(), timeline: vi.fn(), messages: vi.fn(), schedule: vi.fn(), send: vi.fn(),
  telemetry: vi.fn(), success: vi.fn(), error: vi.fn(), navigate: vi.fn(),
}));
vi.mock('react-router-dom', async (original) => ({
  ...await original<typeof import('react-router-dom')>(),
  useParams: () => ({ ticketId: state.ticketId }), useSearchParams: () => [state.params, vi.fn()], useNavigate: () => state.navigate,
}));
vi.mock('@/services/ticketService', () => ({
  getTicketByNumber: state.lookup, getTicketTimeline: state.timeline, getTicketMessages: state.messages,
  getLiveChatScheduleStatus: state.schedule, sendMessage: state.send,
  updateTicketPresence: vi.fn().mockResolvedValue(null), updateTicketReadState: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/utils/frontendTelemetry', () => ({ trackFrontendEvent: state.telemetry }));
vi.mock('sonner', () => ({ toast: { success: state.success, error: state.error } }));
vi.mock('@/components/ui/TrackingMap', () => ({ default: () => <div>isolated-map</div> }));
vi.mock('@/components/ui/Confetti', () => ({ default: () => null }));

let TicketLookup: React.ComponentType;
beforeAll(async () => { TicketLookup = (await import('./TicketLookup')).default; }, 30_000);
beforeEach(() => {
  vi.useFakeTimers(); state.ticketId = 'M-400'; state.params = new URLSearchParams('pin=9999');
  for (const mock of [state.lookup, state.timeline, state.messages, state.schedule, state.send, state.telemetry, state.success, state.error, state.navigate]) mock.mockReset();
  // This suite isolates manual/initial work; no periodic reads are permitted.
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden in ticket context tests'); }));
  window.localStorage.clear(); window.sessionStorage.clear();
  state.lookup.mockImplementation((number: string) => Promise.resolve(ticket(Number(number.slice(2)))));
  state.timeline.mockResolvedValue(timeline());
  state.messages.mockResolvedValue({ messages: [], realtimeState: null });
  state.schedule.mockResolvedValue({ enabled: true, available: true, socket_enabled: false });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function ticket(id = 400) {
  return { id, tipo: 'municipio', tenant_slug: `tenant-${id}`, nro_ticket: `M-${id}`, asunto: `Reclamo ${id}`, estado: 'en_proceso',
    fecha: '2026-10-14T10:00:00Z', history: [],
    messages: [{ id, author: 'user', content: `Mensaje del reclamo ${id}`, timestamp: '2026-10-14T10:00:00Z' }],
  };
}
function timeline(messages: unknown[] = []) { return { estado_chat: 'activo', history: [], messages, unified_conversation_stream: [] }; }
function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
async function flush() { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); }
function access() { return JSON.parse(window.localStorage.getItem('ticket_public_access') || '{}'); }
function historyScope(notice = 'Aviso recibido del servidor para este reclamo') {
  return { contract_version: 'tickets.history_scope.v1', scope: 'ticket_comments_only', legacy_conversations_included: false, retryable: false, notice };
}
async function switchTicket(view: ReturnType<typeof render>, id = 'M-501', pin = '8888') {
  state.ticketId = id; state.params = new URLSearchParams(`pin=${pin}`);
  view.rerender(<TicketLookup />); await flush();
}

describe('manual public ticket context ownership', () => {
  it('does not auto-query B without a route PIN using the secret retained by the verified A form', async () => {
    state.params = new URLSearchParams('pin=1111');
    const view = render(<TicketLookup />); await flush();
    expect(access()).toMatchObject({ ticketId: 400, pin: '1111' });
    state.ticketId = 'M-501'; state.params = new URLSearchParams();
    view.rerender(<TicketLookup />); await flush();
    expect(state.lookup.mock.calls.filter(([number]) => number === 'M-501')).toEqual([]);
    expect(screen.getByLabelText('Número de Reclamo')).toHaveValue('M-501');
    expect(screen.getByLabelText('PIN de Seguridad')).toHaveValue('');
    expect(access()).toMatchObject({ ticketId: 400, pin: '1111' });
  });

  it('does not auto-query a manual PIN per character before Submit on a route without a URL or matching cached PIN', async () => {
    state.ticketId = 'M-501'; state.params = new URLSearchParams();
    const pending = deferred<ReturnType<typeof ticket>>(); state.lookup.mockReturnValue(pending.promise);
    const view = render(<TicketLookup />); await flush();
    const field = screen.getByLabelText('PIN de Seguridad');
    for (const value of ['1', '12', '1234']) {
      fireEvent.change(field, { target: { value } }); await flush();
    }
    expect(state.lookup).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Consultar Estado' }));
    expect(state.navigate).toHaveBeenCalledWith('/ticket/M-501?pin=1234');
    expect(state.lookup).not.toHaveBeenCalled();
    state.params = new URLSearchParams('pin=1234'); view.rerender(<TicketLookup />); await flush();
    expect(state.lookup).toHaveBeenLastCalledWith('M-501', '1234');
    expect(state.lookup.mock.calls.every(([, pin]) => pin === '1234')).toBe(true);
    await act(async () => { pending.resolve(ticket(501)); });
    expect(access()).toMatchObject({ ticketId: 501, pin: '1234' });
  });

  it('keeps automatic restoration from a cache matching the current public ticket number', async () => {
    state.ticketId = 'M-501'; state.params = new URLSearchParams();
    window.localStorage.setItem('ticket_public_access', JSON.stringify({ ticketId: 501, ticketNumber: 'M-501', pin: '5555', tipo: 'municipio', tenantSlug: 'tenant-501' }));
    render(<TicketLookup />); await flush();
    expect(state.lookup).toHaveBeenLastCalledWith('M-501', '5555');
    expect(state.telemetry).toHaveBeenCalledWith('tracking_public_access_restored', expect.objectContaining({ ticket_id: 'M-501' }));
    expect(screen.getByText('Mensaje del reclamo 501')).toBeInTheDocument();
  });

  it('keeps the comment draft while retiring A access on entry to B without a PIN', async () => {
    const view = render(<TicketLookup />); await flush();
    fireEvent.click(screen.getAllByRole('button', { name: /Agregar comentario/i })[0]);
    fireEvent.change(screen.getByPlaceholderText(/observación pública/i), { target: { value: 'Borrador sin enviar' } });
    state.ticketId = 'M-501'; state.params = new URLSearchParams(); view.rerender(<TicketLookup />); await flush();
    expect(screen.getByPlaceholderText(/observación pública/i)).toHaveValue('Borrador sin enviar');
    expect(screen.getByRole('button', { name: /Guardar comentario/i })).toBeDisabled();
    expect(state.send).not.toHaveBeenCalled();
  });

  it('renders the history scope notice supplied by the currently verified backend response', async () => {
    state.lookup.mockResolvedValue({ ...ticket(), history_scope: historyScope() });
    render(<TicketLookup />); await flush();
    expect(screen.getByRole('note')).toHaveTextContent('Aviso recibido del servidor para este reclamo');
    expect(state.send).not.toHaveBeenCalled();
  });

  it('updates or removes the current backend notice during a visible read even when the ticket status is unchanged', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    render(<TicketLookup />); await flush();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    state.lookup.mockResolvedValue({ ...ticket(), history_scope: historyScope('Aviso actualizado del backend') });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(screen.getByRole('note')).toHaveTextContent('Aviso actualizado del backend');
    state.lookup.mockResolvedValue(ticket());
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(state.send).not.toHaveBeenCalled();
  });

  it('does not carry a history scope notice from a retired response into the new ticket', async () => {
    const old = deferred<ReturnType<typeof ticket> & { history_scope: ReturnType<typeof historyScope> }>();
    state.lookup.mockImplementation((number: string) => number === 'M-400' ? old.promise : Promise.resolve({ ...ticket(501), history_scope: historyScope('Aviso actual de B') }));
    const view = render(<TicketLookup />); await flush(); await switchTicket(view);
    await act(async () => { old.resolve({ ...ticket(), history_scope: historyScope('Aviso retirado de A') }); });
    expect(screen.getByRole('note')).toHaveTextContent('Aviso actual de B');
    expect(screen.queryByText('Aviso retirado de A')).not.toBeInTheDocument();
  });

  it.each([
    undefined, null, { notice: 'Invalid scope' },
    { ...historyScope(), contract_version: 'unknown' }, { ...historyScope(), scope: 'contact_history' },
    { ...historyScope(), legacy_conversations_included: true }, { ...historyScope(), retryable: true },
    { ...historyScope(), notice: ['unexpected array'] }, { ...historyScope(), notice: '   ' },
  ])('keeps older or malformed history scope responses compatible without displaying a notice: %j', async (scope) => {
    state.lookup.mockResolvedValue({ ...ticket(), history_scope: scope });
    render(<TicketLookup />); await flush();
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.getByText('Mensaje del reclamo 400')).toBeInTheDocument();
  });

  it('associates the ticket and PIN labels with their own fields using unique IDs per instance', async () => {
    const pending = deferred<ReturnType<typeof ticket>>(); state.lookup.mockReturnValue(pending.promise);
    render(<><TicketLookup /><TicketLookup /></>); await flush();
    const numbers = screen.getAllByLabelText('Número de Reclamo');
    const pins = screen.getAllByLabelText('PIN de Seguridad');
    expect(numbers).toHaveLength(2); expect(pins).toHaveLength(2);
    expect(new Set([...numbers, ...pins].map((field) => field.id)).size).toBe(4);
    numbers.forEach((field) => expect(field).toHaveValue('M-400'));
    pins.forEach((field) => { expect(field).toHaveValue('9999'); expect(field).toHaveAttribute('type', 'password'); });
    fireEvent.change(pins[0], { target: { value: '1234' } });
    expect(pins[0]).toHaveValue('1234'); expect(pins[1]).toHaveValue('9999');
  });

  it('does not replace a newer ticket or cache its old PIN when an initial lookup resolves late', async () => {
    const old = deferred<ReturnType<typeof ticket>>();
    state.lookup.mockImplementation((number: string) => number === 'M-400' ? old.promise : Promise.resolve(ticket(501)));
    const view = render(<TicketLookup />); await flush();
    await switchTicket(view);
    expect(screen.getByText('Mensaje del reclamo 501')).toBeInTheDocument();
    expect(access()).toMatchObject({ ticketId: 501, pin: '8888' });
    const reads = state.timeline.mock.calls.length;
    await act(async () => { old.resolve(ticket()); });
    expect(access()).toMatchObject({ ticketId: 501, pin: '8888' });
    expect(screen.getByText('Mensaje del reclamo 501')).toBeInTheDocument();
    expect(screen.queryByText('Mensaje del reclamo 400')).not.toBeInTheDocument();
    expect(state.timeline).toHaveBeenCalledTimes(reads);
  });

  it('does not merge delayed initial conversation data into another ticket', async () => {
    const old = deferred<ReturnType<typeof timeline>>();
    state.timeline.mockImplementation((id: number) => id === 400 ? old.promise : Promise.resolve(timeline()));
    const view = render(<TicketLookup />); await flush();
    await switchTicket(view);
    expect(screen.getByText('Mensaje del reclamo 501')).toBeInTheDocument();
    await act(async () => { old.resolve(timeline([{ id: 99, author: 'admin', content: 'Respuesta vieja del reclamo 400', timestamp: '2026-10-14T10:01:00Z' }])); });
    expect(screen.queryByText('Respuesta vieja del reclamo 400')).not.toBeInTheDocument();
    expect(screen.getByText('Mensaje del reclamo 501')).toBeInTheDocument();
    expect(access()).toMatchObject({ ticketId: 501, pin: '8888' });
  });

  it.each([403, 404])('does not apply a delayed %s lookup error to the new verified ticket', async (status) => {
    const old = deferred<ReturnType<typeof ticket>>();
    state.lookup.mockImplementation((number: string) => number === 'M-400' ? old.promise : Promise.resolve(ticket(501)));
    const view = render(<TicketLookup />); await flush(); await switchTicket(view);
    await act(async () => { old.reject({ status, requestId: 'request-from-old-ticket' }); });
    expect(screen.queryByText(/request_id: request-from-old-ticket/)).not.toBeInTheDocument();
    expect(screen.getByText('Mensaje del reclamo 501')).toBeInTheDocument();
    expect(state.telemetry).not.toHaveBeenCalledWith('tracking_public_lookup_failed', expect.objectContaining({ request_id: 'request-from-old-ticket' }));
  });

  it('retires the first A lookup across A → B → A even when the public number matches again', async () => {
    const old = deferred<ReturnType<typeof ticket>>(); let firstA = true;
    const fresh = { ...ticket(), messages: [{ id: 2, author: 'user', content: 'Consulta actual de A', timestamp: '2026-10-14T11:00:00Z' }] };
    state.lookup.mockImplementation((number: string) => number === 'M-400' ? firstA ? old.promise : Promise.resolve(fresh) : Promise.resolve(ticket(501)));
    const view = render(<TicketLookup />); await flush(); await switchTicket(view);
    firstA = false; await switchTicket(view, 'M-400', '7777');
    await act(async () => { old.resolve(ticket()); });
    expect(screen.getByText('Consulta actual de A')).toBeInTheDocument();
    expect(screen.queryByText('Mensaje del reclamo 400')).not.toBeInTheDocument();
    expect(access()).toMatchObject({ ticketId: 400, pin: '7777' });
  });

  it('does not release the loading state of a newer lookup when an old lookup completes', async () => {
    const old = deferred<ReturnType<typeof ticket>>(); const next = deferred<ReturnType<typeof ticket>>();
    state.lookup.mockImplementation((number: string) => number === 'M-400' ? old.promise : next.promise);
    const view = render(<TicketLookup />); await flush();
    await switchTicket(view);
    await act(async () => { old.resolve(ticket()); });
    expect(screen.getByRole('button', { name: 'Buscando...' })).toBeDisabled();
    await act(async () => { next.resolve(ticket(501)); });
    expect(screen.getByText('Mensaje del reclamo 501')).toBeInTheDocument();
  });

  it('retires a pending initial lookup on unmount without updating stored access or starting conversation reads', async () => {
    const old = deferred<ReturnType<typeof ticket>>(); state.lookup.mockReturnValue(old.promise);
    const view = render(<TicketLookup />); await flush(); view.unmount();
    window.localStorage.setItem('ticket_public_access', JSON.stringify({ ticketId: 501, pin: '8888' }));
    await act(async () => { old.resolve(ticket()); });
    expect(access()).toMatchObject({ ticketId: 501, pin: '8888' });
    expect(state.timeline).not.toHaveBeenCalled(); expect(state.messages).not.toHaveBeenCalled();
    expect(state.telemetry).not.toHaveBeenCalledWith('tracking_public_lookup_succeeded', expect.anything());
  });

  it('retires pending work when returning to the empty lookup route without replacing the new form', async () => {
    const pending = deferred<ReturnType<typeof ticket>>(); state.lookup.mockReturnValue(pending.promise);
    const view = render(<TicketLookup />); await flush();
    await switchTicket(view, '', '');
    await act(async () => { pending.resolve(ticket()); });
    expect(screen.queryByText('Mensaje del reclamo 400')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Consultar Estado' })).toBeInTheDocument();
    expect(state.timeline).not.toHaveBeenCalled(); expect(window.localStorage.getItem('ticket_public_access')).toBeNull();
  });

  it.each(['success', 'failure'])('does not apply delayed send %s feedback, clear a new draft, or replay the send after switching tickets', async (result) => {
    const old = deferred<{ message: string }>(); state.send.mockReturnValue(old.promise);
    const view = render(<TicketLookup />); await flush();
    fireEvent.click(screen.getAllByRole('button', { name: /Agregar comentario/i })[0]);
    fireEvent.change(screen.getByPlaceholderText(/observación pública/i), { target: { value: 'Mensaje original de A' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar comentario/i })); await flush();
    expect(state.send).toHaveBeenCalledWith(400, 'municipio', 'Mensaje original de A', undefined, undefined, { public: true, pin: '9999' });
    await switchTicket(view);
    fireEvent.change(screen.getByPlaceholderText(/observación pública/i), { target: { value: 'Borrador nuevo de B' } });
    const reads = state.timeline.mock.calls.length;
    await act(async () => { result === 'success' ? old.resolve({ message: 'Confirmación vieja de A' }) : old.reject({ status: 403 }); });
    expect(screen.getByPlaceholderText(/observación pública/i)).toHaveValue('Borrador nuevo de B');
    expect(state.timeline).toHaveBeenCalledTimes(reads);
    expect(state.success).not.toHaveBeenCalled(); expect(state.error).not.toHaveBeenCalled();
    expect(state.telemetry).not.toHaveBeenCalledWith('tracking_public_message_sent', expect.anything());
    expect(state.send).toHaveBeenCalledTimes(1);
  });

  it('sends with the PIN actually verified for the current ticket and preserves a draft edited during the send', async () => {
    const pending = deferred<{ message: string }>(); state.send.mockReturnValue(pending.promise);
    const view = render(<TicketLookup />); await flush(); await switchTicket(view);
    fireEvent.click(screen.getAllByRole('button', { name: /Agregar comentario/i })[0]);
    fireEvent.change(screen.getByPlaceholderText(/observación pública/i), { target: { value: 'Comentario enviado' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar comentario/i })); await flush();
    expect(state.send).toHaveBeenCalledWith(501, 'municipio', 'Comentario enviado', undefined, undefined, { public: true, pin: '8888' });
    fireEvent.change(screen.getByPlaceholderText(/observación pública/i), { target: { value: 'Borrador editado mientras espera' } });
    await act(async () => { pending.resolve({ message: 'Comentario aceptado' }); });
    expect(state.success).toHaveBeenCalledWith('Comentario aceptado');
    expect(state.send).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByRole('button', { name: /Agregar comentario/i })[0]);
    expect(screen.getByPlaceholderText(/observación pública/i)).toHaveValue('Borrador editado mientras espera');
    expect(state.timeline).toHaveBeenLastCalledWith(501, 'municipio', { public: true, pin: '8888' });
  });

  it('keeps a draft but prevents sending with the old access while a new ticket verification is pending', async () => {
    const pending = deferred<ReturnType<typeof ticket>>();
    const view = render(<TicketLookup />); await flush();
    fireEvent.click(screen.getAllByRole('button', { name: /Agregar comentario/i })[0]);
    fireEvent.change(screen.getByPlaceholderText(/observación pública/i), { target: { value: 'Borrador conservado' } });
    state.lookup.mockReturnValue(pending.promise); await switchTicket(view);
    const submit = screen.getByRole('button', { name: /Guardar comentario/i });
    expect(submit).toBeDisabled(); fireEvent.click(submit);
    expect(state.send).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText(/observación pública/i)).toHaveValue('Borrador conservado');
    await act(async () => { pending.resolve(ticket(501)); });
    expect(screen.getByRole('button', { name: /Guardar comentario/i })).toBeEnabled();
    expect(access()).toMatchObject({ ticketId: 501, pin: '8888' });
  });

  it('uses the new route PIN for a manual refresh instead of the input PIN initialized by the old route', async () => {
    state.lookup.mockImplementation((number: string, pin: string) => {
      if (number === 'M-400') return Promise.resolve(ticket());
      return pin === '8888' ? Promise.resolve(ticket(501)) : Promise.reject({ status: 403 });
    });
    const view = render(<TicketLookup />); await flush(); await switchTicket(view);
    fireEvent.click(screen.getByRole('button', { name: /Actualizar estado del reclamo/i })); await flush();
    expect(state.lookup).toHaveBeenLastCalledWith('M-501', '8888');
    expect(screen.getByText('Mensaje del reclamo 501')).toBeInTheDocument();
    expect(access()).toMatchObject({ ticketId: 501, pin: '8888' });
  });

  it('does not release the new send button or replay either mutation when an old send completes', async () => {
    const old = deferred<{ message: string }>(); const next = deferred<{ message: string }>();
    state.send.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const view = render(<TicketLookup />); await flush();
    fireEvent.click(screen.getAllByRole('button', { name: /Agregar comentario/i })[0]);
    fireEvent.change(screen.getByPlaceholderText(/observación pública/i), { target: { value: 'Comentario A' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar comentario/i })); await flush();
    await switchTicket(view);
    fireEvent.change(screen.getByPlaceholderText(/observación pública/i), { target: { value: 'Comentario B' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar comentario/i })); await flush();
    await act(async () => { old.resolve({ message: 'Respuesta de A' }); });
    expect(screen.getByRole('button', { name: /Guardar comentario/i })).toBeDisabled();
    expect(screen.getByPlaceholderText(/observación pública/i)).toHaveValue('Comentario B');
    expect(state.success).not.toHaveBeenCalled(); expect(state.send).toHaveBeenCalledTimes(2);
    await act(async () => { next.resolve({ message: 'Respuesta de B' }); });
    expect(state.success).toHaveBeenCalledWith('Respuesta de B');
    expect(state.send).toHaveBeenLastCalledWith(501, 'municipio', 'Comentario B', undefined, undefined, { public: true, pin: '8888' });
  });

  it('releases an obsolete send busy state when manually refreshing the same ticket without replaying the send', async () => {
    const pending = deferred<{ message: string }>(); state.send.mockReturnValue(pending.promise);
    render(<TicketLookup />); await flush();
    fireEvent.click(screen.getAllByRole('button', { name: /Agregar comentario/i })[0]);
    fireEvent.change(screen.getByPlaceholderText(/observación pública/i), { target: { value: 'Borrador durante envío' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar comentario/i })); await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Close' })); await flush();
    fireEvent.click(screen.getByRole('button', { name: /Actualizar estado del reclamo/i })); await flush();
    fireEvent.click(screen.getAllByRole('button', { name: /Agregar comentario/i })[0]);
    expect(screen.getByRole('button', { name: /Guardar comentario/i })).toBeEnabled();
    await act(async () => { pending.resolve({ message: 'Respuesta retirada' }); });
    expect(screen.getByPlaceholderText(/observación pública/i)).toHaveValue('Borrador durante envío');
    expect(state.success).not.toHaveBeenCalled(); expect(state.send).toHaveBeenCalledTimes(1);
  });

  it('retires a post-send conversation read after the ticket changes and keeps the new dialog open', async () => {
    const old = deferred<ReturnType<typeof timeline>>(); state.send.mockResolvedValue({ message: 'Enviado' });
    const view = render(<TicketLookup />); await flush();
    state.timeline.mockReturnValueOnce(old.promise);
    fireEvent.click(screen.getAllByRole('button', { name: /Agregar comentario/i })[0]);
    fireEvent.change(screen.getByPlaceholderText(/observación pública/i), { target: { value: 'Comentario A' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar comentario/i })); await flush();
    await switchTicket(view);
    fireEvent.change(screen.getByPlaceholderText(/observación pública/i), { target: { value: 'Borrador B' } });
    await act(async () => { old.resolve(timeline([{ id: 99, author: 'admin', content: 'Lectura antigua posterior al envío', timestamp: '2026-10-14T10:01:00Z' }])); });
    expect(screen.queryByText('Lectura antigua posterior al envío')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/observación pública/i)).toHaveValue('Borrador B');
    expect(access()).toMatchObject({ ticketId: 501, pin: '8888' });
  });

  it('does not show feedback or start conversation reads when a pending send finishes after unmount', async () => {
    const pending = deferred<{ message: string }>(); state.send.mockReturnValue(pending.promise);
    const view = render(<TicketLookup />); await flush();
    fireEvent.click(screen.getAllByRole('button', { name: /Agregar comentario/i })[0]);
    fireEvent.change(screen.getByPlaceholderText(/observación pública/i), { target: { value: 'Comentario A' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar comentario/i })); await flush();
    const reads = state.timeline.mock.calls.length; view.unmount();
    await act(async () => { pending.resolve({ message: 'Enviado después de salir' }); });
    expect(state.success).not.toHaveBeenCalled(); expect(state.timeline).toHaveBeenCalledTimes(reads);
    expect(state.send).toHaveBeenCalledTimes(1);
  });

  it('does not open the new ticket dialog or show old feedback when a manual chat-status check resolves late', async () => {
    const old = deferred<{ enabled: boolean; available: boolean }>();
    state.schedule.mockImplementation((tenant: string) => tenant === 'tenant-400' ? old.promise : Promise.resolve({ enabled: true, available: true, socket_enabled: false }));
    const view = render(<TicketLookup />); await flush();
    fireEvent.click(screen.getAllByRole('button', { name: /Dejar mensaje en el reclamo/i })[0]);
    await switchTicket(view);
    await act(async () => { old.resolve({ enabled: true, available: false }); });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(state.success).not.toHaveBeenCalled();
    expect(state.telemetry).not.toHaveBeenCalledWith('tracking_live_chat_status_checked', expect.objectContaining({ ticket_id: 400 }));
    expect(screen.getByText('Mensaje del reclamo 501')).toBeInTheDocument();
  });

  it.each([403, 404])('keeps current %s access failures and their request IDs visible', async (status) => {
    state.lookup.mockRejectedValue({ status, requestId: `current-${status}` });
    render(<TicketLookup />); await flush();
    expect(screen.getByText(status === 403 ? 'PIN incorrecto.' : 'No se encontró el reclamo. Verificá el número.')).toBeInTheDocument();
    expect(screen.getByText(`request_id: current-${status}`)).toBeInTheDocument();
    expect(state.telemetry).toHaveBeenCalledWith('tracking_public_lookup_failed', expect.objectContaining({ status, request_id: `current-${status}` }));
    expect(state.send).not.toHaveBeenCalled(); expect(state.timeline).not.toHaveBeenCalled();
  });

  it.each([403, 404])('retires the old visible ticket and its polling when the new lookup fails with %s', async (status) => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    state.lookup.mockImplementation((number: string) => number === 'M-400'
      ? Promise.resolve(ticket()) : Promise.reject({ status, requestId: `denied-new-${status}` }));
    const view = render(<TicketLookup />); await flush();
    expect(screen.getByText('Mensaje del reclamo 400')).toBeInTheDocument();
    await switchTicket(view);
    const afterDenied = state.lookup.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(state.lookup).toHaveBeenCalledTimes(afterDenied);
    expect(screen.queryByText('Mensaje del reclamo 400')).not.toBeInTheDocument();
    expect(screen.getByText(`request_id: denied-new-${status}`)).toBeInTheDocument();
    expect(screen.getByText(status === 403 ? 'PIN incorrecto.' : 'No se encontró el reclamo. Verificá el número.')).toBeInTheDocument();
    expect(state.send).not.toHaveBeenCalled();
  });
});
