import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ChatPage from '@/pages/ChatPage';
import { ApiError, apiFetch } from '@/utils/api';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import { toast } from '@/components/ui/use-toast';

// Real caller, ChatInput, recorder hook, upload adapter and recovery owner.
// Identity, media devices, HTTP and unrelated presentation leaves are fixtures.
const fixture = vi.hoisted(() => ({
  user: null as any, tenant: null as any,
  refresh: vi.fn(), ask: vi.fn(), humanReply: vi.fn(), historyEmail: vi.fn(),
}));
vi.mock('react-router-dom', async () => await vi.importActual('react-router-dom'));
vi.mock('@/utils/api', async () => ({ ...await vi.importActual<typeof import('@/utils/api')>('@/utils/api'), apiFetch: vi.fn() }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: fixture.user, refreshUser: fixture.refresh, loading: false }) }));
vi.mock('@/context/TenantContext', () => ({ useTenantContextPresence: () => fixture.tenant }));
vi.mock('@/components/layout/Navbar', () => ({ default: () => <nav data-testid="navbar-fixture" /> }));
vi.mock('@/components/chat/ChatMessage', () => ({ default: ({ message }: any) => <p>{message.text}</p> }));
vi.mock('@/components/TicketMap', () => ({ default: () => <div data-testid="ticket-map-fixture" /> }));
vi.mock('@/components/tickets/TicketTimeline', () => ({ default: () => <div /> }));
vi.mock('@/components/ui/AddressAutocomplete', () => ({ default: () => <div /> }));
vi.mock('@/components/ui/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/services/ticketService', async () => ({
  ...await vi.importActual<typeof import('@/services/ticketService')>('@/services/ticketService'),
  getTicketTimeline: vi.fn(async () => ({ history: [], messages: [], estado_chat: 'abierto' })),
  requestTicketHistoryEmail: (...args: unknown[]) => fixture.historyEmail(...args),
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tenant = (slug = 'synthetic-a', id = 22) => ({
  currentSlug: slug, tenant: { slug, publishedIdentity: { tenantId: id, tenantSlug: slug } },
  isLoadingTenant: false, tenantError: null,
});
const prepare = {
  ok: true, contract_version: 'chat.attachment.direct.v1', operation: 'prepare_direct_upload',
  upload_id: 'synthetic-audio-upload', intent_token: 'synthetic-audio-intent',
  upload: { method: 'PUT', url: 'https://objects.example.test/page-audio', headers: { 'Content-Type': 'audio/webm' }, expires_in_seconds: 300 },
  constraints: { max_file_bytes: 1024, exact_size_required: true },
};
const uploaded = { ok: true, url: 'https://objects.example.test/page-audio.webm', filename: 'page-audio.webm', mime_type: 'audio/webm' };
const originalDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
let tracks: Array<{ stop: ReturnType<typeof vi.fn> }>;
let objectPut: ReturnType<typeof vi.fn>;
class FakeRecorder {
  mimeType = 'audio/webm'; state = 'inactive';
  onstart: (() => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  constructor(readonly stream: MediaStream) {}
  start() { this.state = 'recording'; this.onstart?.(); }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['synthetic-page-speech'], { type: this.mimeType }) }); this.onstop?.(); }
}
const view = () => <MemoryRouter initialEntries={['/chat']}><ChatPage /></MemoryRouter>;
const asks = () => vi.mocked(apiFetch).mock.calls.filter(([url]) => /^\/ask(?:\/|$)/.test(String(url)));
async function recordAndStop() {
  fireEvent.click(screen.getByRole('button', { name: 'Audio', exact: true }));
  await screen.findByRole('button', { name: 'Detener grabación' });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Detener grabación' })); });
  await waitFor(() => expect(asks()).toHaveLength(1));
}
const expectDiscardOnly = async () => {
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('no podemos confirmar su envío'));
  expect(screen.getByRole('button', { name: 'Descartar grabación' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Comprobar envío' })).toBeNull();
  expect(screen.getByRole('textbox', { name: 'Escribir mensaje' })).toBeEnabled();
};
beforeEach(() => {
  window.localStorage.clear(); window.sessionStorage.clear();
  fixture.user = null; fixture.tenant = tenant(); tracks = [];
  fixture.ask.mockReset().mockResolvedValue({ respuesta_usuario: 'synthetic-current-reply' });
  fixture.humanReply.mockReset().mockRejectedValue(new ApiError('synthetic-empty-comment-rejected', 400));
  fixture.refresh.mockReset().mockResolvedValue(undefined);
  fixture.historyEmail.mockReset().mockResolvedValue({});
  vi.mocked(toast).mockClear();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })));
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => {
    const track = { stop: vi.fn() }; tracks.push(track); return { getTracks: () => [track] } as unknown as MediaStream;
  }) } });
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  objectPut = vi.fn(async (url: unknown) => {
    if (url !== prepare.upload.url) throw new Error('unexpected_fixture_object_fetch');
    return new Response('', { status: 200 });
  });
  vi.stubGlobal('fetch', objectPut);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(apiFetch).mockReset().mockImplementation(async (url, options) => {
    if (options?.body?.operation === 'prepare_direct_upload') return prepare;
    if (options?.body?.operation === 'complete_direct_upload') return uploaded;
    if (/^\/ask(?:\/|$)/.test(String(url))) return fixture.ask(url, options);
    if (/responder_ciudadano$/.test(String(url))) return fixture.humanReply(url, options);
    if (/\/mensajes\?/.test(String(url))) return { mensajes: [], estado_chat: 'abierto' };
    if (String(url) === '/tickets/municipio/77') return { id: 77, tipo: 'municipio', estado: 'abierto' };
    throw new Error('unexpected_fixture_api_path');
  });
});
afterEach(() => {
  cleanup(); tracks.forEach(track => track.stop());
  if (originalDevices) Object.defineProperty(navigator, 'mediaDevices', originalDevices);
  else Reflect.deleteProperty(navigator, 'mediaDevices');
  vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe('ChatPage consumes the real ChatInput audio recovery contract', () => {
  it('retires the uploaded audio only after an acknowledged chat reply', async () => {
    const ack = deferred<unknown>(); fixture.ask.mockReturnValueOnce(ack.promise);
    render(view()); await recordAndStop();
    expect(screen.getByRole('status')).toHaveTextContent('Enviando tu grabación');
    expect(asks()[0][1]).toMatchObject({ singleAttempt: true, isCurrent: expect.any(Function) });
    expect(asks()[0][1]?.body.attachment_info.url).toBe(uploaded.url);
    await act(async () => ack.resolve({ respuesta_usuario: 'synthetic-acknowledged-reply' }));
    expect(await screen.findByText('synthetic-acknowledged-reply')).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull());
    expect(objectPut).toHaveBeenCalledOnce(); expect(asks()).toHaveLength(1);
  });
  it.each(['http503', 'lost_transport_ack'])('preserves the draft without a blind retry after %s', async kind => {
    fixture.ask.mockRejectedValueOnce(kind === 'http503' ? new ApiError('synthetic-unavailable', 503) : new TypeError('synthetic-ack-lost'));
    render(view()); await recordAndStop(); await expectDiscardOnly();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar grabación' }));
    expect(asks()).toHaveLength(1); expect(objectPut).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull();
  });
  it('keeps a determined HTTP400 rejection distinct from uncertain delivery', async () => {
    fixture.ask.mockRejectedValueOnce(new ApiError('synthetic-validation-rejected', 400));
    render(view()); await recordAndStop();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('synthetic-validation-rejected'));
    expect(screen.getByRole('status')).not.toHaveTextContent('no podemos confirmar');
    expect(screen.queryByRole('button', { name: 'Comprobar envío' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Escribir mensaje' })).toBeEnabled();
    expect(asks()).toHaveLength(1);
  });
  it('does not treat a successful HTTP response with no reply as an audio ACK', async () => {
    fixture.ask.mockResolvedValueOnce({}); render(view()); await recordAndStop();
    await expectDiscardOnly(); expect(asks()).toHaveLength(1);
  });
  it('does not turn a confirmed audio reply into a failed send when profile refresh fails', async () => {
    fixture.user = { id: 101, rubro: 'synthetic-sector' };
    localStorage.setItem('authToken', 'synthetic-test-session');
    fixture.refresh.mockRejectedValueOnce(new Error('synthetic-refresh-failed'));
    render(view()); await recordAndStop();
    expect(await screen.findByText('synthetic-current-reply')).toBeVisible();
    await waitFor(() => expect(fixture.refresh).toHaveBeenCalledOnce());
    expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull();
    expect(screen.queryByText('synthetic-refresh-failed')).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });
  it('releases confirmed audio typing before a deferred profile refresh without releasing a newer request', async () => {
    const profile = deferred<void>(), text = deferred<unknown>();
    fixture.user = { id: 101, rubro: 'synthetic-sector' };
    localStorage.setItem('authToken', 'synthetic-test-session');
    fixture.refresh.mockResolvedValue(undefined).mockReturnValueOnce(profile.promise);
    fixture.ask.mockResolvedValueOnce({ respuesta_usuario: 'synthetic-audio-confirmed' }).mockReturnValueOnce(text.promise);
    render(view()); await recordAndStop();
    await screen.findByText('synthetic-audio-confirmed');
    await waitFor(() => expect(fixture.refresh).toHaveBeenCalledOnce());
    expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull();
    const input = screen.getByRole('textbox', { name: 'Escribir mensaje' });
    expect(input).toBeEnabled();
    fireEvent.change(input, { target: { value: 'synthetic-text-during-profile-refresh' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await waitFor(() => expect(asks()).toHaveLength(2)); expect(input).toBeDisabled();
    await act(async () => profile.resolve(undefined));
    expect(input).toBeDisabled();
    await act(async () => text.resolve({ respuesta_usuario: 'synthetic-newer-text-confirmed' }));
    expect(await screen.findByText('synthetic-newer-text-confirmed')).toBeVisible();
    expect(input).toBeEnabled(); expect(fixture.refresh).toHaveBeenCalledTimes(2);
  });
  it.each(['success', 'failure'])('rejects a delayed audio %s after tenant A to B to A', async outcome => {
    const ack = deferred<unknown>(); fixture.ask.mockReturnValueOnce(ack.promise);
    const mounted = render(view()); await recordAndStop();
    fixture.tenant = tenant('synthetic-b', 33); mounted.rerender(view());
    fixture.tenant = tenant(); mounted.rerender(view());
    await act(async () => {
      if (outcome === 'success') ack.resolve({ respuesta_usuario: 'synthetic-retired-audio' });
      else ack.reject(new Error('synthetic-retired-audio'));
    });
    expect(screen.queryByText('synthetic-retired-audio')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull();
    expect(toast).not.toHaveBeenCalled(); expect(asks()).toHaveLength(1);
  });
  it('retires an old session without showing its late error in the current conversation', async () => {
    const ack = deferred<unknown>(); fixture.ask.mockReturnValueOnce(ack.promise);
    render(view()); await recordAndStop();
    act(() => { advanceChatbocSessionRevision(); advanceChatbocSessionRevision(); });
    await act(async () => ack.reject(new Error('synthetic-retired-session-error')));
    expect(screen.queryByText('synthetic-retired-session-error')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull();
    expect(toast).not.toHaveBeenCalled();
  });
  it('discard releases only audio typing while its late ACK cannot replace the newer text request', async () => {
    const audio = deferred<unknown>(), text = deferred<unknown>();
    fixture.ask.mockReturnValueOnce(audio.promise).mockReturnValueOnce(text.promise);
    render(view()); await recordAndStop();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar grabación' }));
    const input = screen.getByRole('textbox', { name: 'Escribir mensaje' }); expect(input).toBeEnabled();
    fireEvent.change(input, { target: { value: 'synthetic-newer-text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await waitFor(() => expect(asks()).toHaveLength(2)); expect(input).toBeDisabled();
    await act(async () => audio.resolve({ respuesta_usuario: 'synthetic-retired-ack' }));
    expect(input).toBeDisabled(); expect(screen.queryByText('synthetic-retired-ack')).toBeNull();
    await act(async () => text.resolve({ respuesta_usuario: 'synthetic-current-text-ack' }));
    expect(await screen.findByText('synthetic-current-text-ack')).toBeVisible(); expect(input).toBeEnabled();
  });
  it('retires the audio transport ownership at unmount without any later request', async () => {
    const ack = deferred<unknown>(); fixture.ask.mockReturnValueOnce(ack.promise);
    const mounted = render(view()); await recordAndStop();
    const options = asks()[0][1]; expect(options?.isCurrent?.()).toBe(true);
    mounted.unmount(); expect(options?.isCurrent?.()).toBe(false);
    await act(async () => ack.resolve({ respuesta_usuario: 'synthetic-unmounted-reply', ticket_id: 77 }));
    expect(fixture.historyEmail).not.toHaveBeenCalled(); expect(asks()).toHaveLength(1);
  });
  it('retains room audio on the existing empty-comment HTTP400 without claiming room media support', async () => {
    fixture.ask.mockResolvedValueOnce({ respuesta_usuario: 'synthetic-ticket-ready', ticket_id: 77 });
    render(view());
    fireEvent.change(screen.getByRole('textbox', { name: 'Escribir mensaje' }), { target: { value: 'synthetic-create-ticket' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    await screen.findByText('synthetic-ticket-ready');
    fireEvent.click(screen.getByRole('button', { name: 'Audio', exact: true }));
    await screen.findByRole('button', { name: 'Detener grabación' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Detener grabación' })); });
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('synthetic-empty-comment-rejected'));
    expect(screen.getByRole('status')).not.toHaveTextContent('no podemos confirmar');
    expect(screen.getByRole('button', { name: 'Descartar grabación' })).toBeVisible();
    expect(fixture.humanReply).toHaveBeenCalledOnce();
    expect(fixture.humanReply.mock.calls[0][1]).toMatchObject({ singleAttempt: true, isCurrent: expect.any(Function) });
  });
  it('preserves the existing ordinary text request behavior', async () => {
    render(view());
    fireEvent.change(screen.getByRole('textbox', { name: 'Escribir mensaje' }), { target: { value: 'synthetic-text-only' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensaje' }));
    expect(await screen.findByText('synthetic-current-reply')).toBeVisible();
    expect(asks()).toHaveLength(1); expect(asks()[0][1]?.singleAttempt).toBeUndefined();
    expect(objectPut).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull();
  });
});
