import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatInput from '@/components/chat/ChatInput';
import ChatPanel from './ChatPanel';
import { ApiError, apiFetch } from '@/utils/api';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
vi.mock('@/utils/api', async original => ({ ...await original<typeof import('@/utils/api')>(), apiFetch: vi.fn() }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: null }) }));
vi.mock('@/utils/widgetTelemetry', () => ({ trackWidgetEvent: vi.fn() }));

// Componentes, grabador, reproductor y cliente de subida reales. Micrófono, identidad, HTTP y
// URL de objeto son sintéticos: ningún caso reproduce audio real ni llama a un proveedor.
const originalDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
let created: Array<{ blob: Blob; url: string }>;
let revoked: string[];
let play: ReturnType<typeof vi.spyOn>;
class FakeRecorder {
  mimeType = 'audio/webm'; state = 'inactive';
  onstart: (() => void) | null = null;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start() { this.state = 'recording'; this.onstart?.(); }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['synthetic-speech'], { type: this.mimeType }) }); this.onstop?.(); }
  constructor(readonly stream: MediaStream) {}
}
const prepare = { ok: true, contract_version: 'chat.attachment.direct.v1', operation: 'prepare_direct_upload', upload_id: 'synthetic-upload', intent_token: 'synthetic-intent',
  upload: { method: 'PUT', url: 'https://objects.example.test/synthetic-audio', headers: { 'Content-Type': 'audio/webm' }, expires_in_seconds: 300 },
  constraints: { max_file_bytes: 1024, exact_size_required: true } };
const uploaded = { ok: true, url: 'https://objects.example.test/synthetic-audio.webm', filename: 'synthetic-audio.webm', mime_type: 'audio/webm' };
const caps = (endpoint: string) => ({ composer: { actions: [{ id: 'audio', type: 'audio', label: 'Nota de voz' }] }, input_modes: { audio: { enabled: true, chat_endpoint: endpoint, multipart_field: 'audio_file' } } });
const context = (slug = 'synthetic-tdf', endpoint = '/ask') => ({ tipoChat: 'municipio' as const, sector: 'gobierno', tenantSlug: slug, chatBootstrap: {
  contract_version: 'demo.chat_bootstrap.v1', endpoint, method: 'POST', payload: { tipo_chat: 'municipio', tenant_slug: slug },
  session: { chat_session_id: 'synthetic-audio-session', tenant_slug: slug },
} });

beforeEach(() => {
  vi.mocked(apiFetch).mockReset();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream) } });
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 200 })));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  created = []; revoked = [];
  URL.createObjectURL = vi.fn((blob: Blob) => { const url = `blob:synthetic-draft-${created.length + 1}`; created.push({ blob, url }); return url; }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn((url: string) => { revoked.push(url); }) as typeof URL.revokeObjectURL;
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  window.localStorage.clear(); window.sessionStorage.clear();
});
afterEach(() => {
  cleanup();
  URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke;
  if (originalDevices) Object.defineProperty(navigator, 'mediaDevices', originalDevices); else Reflect.deleteProperty(navigator, 'mediaDevices');
  vi.unstubAllGlobals(); vi.restoreAllMocks();
});

async function recordAndStop(label = 'Audio') {
  fireEvent.click(screen.getByRole('button', { name: label }));
  await screen.findByRole('button', { name: 'Detener grabación' });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Detener grabación' })); });
}
const draftPanel = () => screen.getByRole('button', { name: 'Descartar grabación' }).closest('div')!.parentElement!;
const draftAudio = () => draftPanel().querySelector('audio');
const expectListenableDraft = async () => {
  const panel = draftPanel();
  expect(within(panel).getByRole('button', { name: 'Reproducir audio de voz' })).toBeVisible();
  const audio = draftAudio()!;
  expect(created).toHaveLength(1);
  expect(audio.getAttribute('src')).toBe(created[0].url);
  expect(created[0].blob.type).toBe('audio/webm');
  expect(audio.autoplay).toBe(false);
  expect(play).not.toHaveBeenCalled();
};
const expectNoStoredAudio = () => expect(Object.keys(localStorage).concat(Object.keys(sessionStorage)).some(key => /audio|recording|blob/i.test(key))).toBe(false);

describe('the person can listen to the audio draft before deciding', () => {
  it('widget: a retained recording after an upload error is listenable and revoked on discard', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('prepare_unavailable', 503));
    render(<ChatInput onSendMessage={vi.fn()} isTyping={false} tenantSlug="synthetic-tdf" />); await recordAndStop();
    await screen.findByRole('button', { name: 'Comprobar envío' });
    await expectListenableDraft();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar grabación' }));
    expect(screen.queryByRole('button', { name: 'Reproducir audio de voz' })).toBeNull();
    expect(revoked).toEqual([created[0].url]);
    expect(play).not.toHaveBeenCalled(); expectNoStoredAudio();
  });

  it('widget: plays only through the explicit control', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('prepare_unavailable', 503));
    render(<ChatInput onSendMessage={vi.fn()} isTyping={false} tenantSlug="synthetic-tdf" />); await recordAndStop();
    await screen.findByRole('button', { name: 'Comprobar envío' });
    const audio = draftAudio()!;
    Object.defineProperty(audio, 'duration', { configurable: true, value: 3 });
    act(() => { audio.dispatchEvent(new Event('loadedmetadata')); audio.dispatchEvent(new Event('canplay')); });
    expect(play).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(within(draftPanel()).getByRole('button', { name: 'Reproducir audio de voz' })); });
    expect(play).toHaveBeenCalledOnce();
    expect(apiFetch).toHaveBeenCalledOnce();
  });

  it('widget: a confirmed explicit check retires and revokes the playback URL', async () => {
    const send = vi.fn(payload => payload.audioRecovery?.onSuccess());
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('prepare_unavailable', 503)).mockResolvedValueOnce(prepare).mockResolvedValueOnce(uploaded);
    render(<ChatInput onSendMessage={send} isTyping={false} tenantSlug="synthetic-tdf" />); await recordAndStop();
    await screen.findByRole('button', { name: 'Comprobar envío' });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Comprobar envío' })); });
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reproducir audio de voz' })).toBeNull());
    expect(created.map(item => item.url)).toEqual(revoked);
    expect(play).not.toHaveBeenCalled();
  });

  it('widget: a session change retires the draft and its URL; the next identity gets nothing', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('prepare_unavailable', 503));
    render(<ChatInput onSendMessage={vi.fn()} isTyping={false} tenantSlug="synthetic-tdf" />); await recordAndStop();
    await screen.findByRole('button', { name: 'Comprobar envío' });
    await act(async () => { advanceChatbocSessionRevision(); });
    expect(screen.queryByRole('button', { name: 'Reproducir audio de voz' })).toBeNull();
    expect(revoked).toEqual([created[0].url]); expect(created).toHaveLength(1);
    expectNoStoredAudio();
  });

  it('widget: a scope change and unmount revoke the URL', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('prepare_unavailable', 503));
    const view = (slug: string) => <ChatInput onSendMessage={vi.fn()} isTyping={false} tenantSlug={slug} />;
    const mounted = render(view('synthetic-tdf')); await recordAndStop();
    await screen.findByRole('button', { name: 'Comprobar envío' });
    mounted.rerender(view('synthetic-otro'));
    expect(screen.queryByRole('button', { name: 'Reproducir audio de voz' })).toBeNull();
    expect(revoked).toEqual([created[0].url]);
    mounted.unmount();
    expect(revoked).toEqual([created[0].url]); expect(created).toHaveLength(1);
  });

  it('web panel: a retained recording is listenable and revoked on discard', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('unavailable', 503));
    render(<ChatPanel variant="standalone" context={context()} mediaCapabilities={caps('/ask')} />); await recordAndStop('Nota de voz');
    await screen.findByRole('button', { name: 'Descartar grabación' });
    await expectListenableDraft();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar grabación' }));
    expect(screen.queryByRole('button', { name: 'Reproducir audio de voz' })).toBeNull();
    expect(revoked).toEqual([created[0].url]);
    expect(play).not.toHaveBeenCalled(); expectNoStoredAudio();
  });
});
