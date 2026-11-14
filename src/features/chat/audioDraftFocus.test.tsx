import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatInput from '@/components/chat/ChatInput';
import ChatPanel from './ChatPanel';
import { ApiError, apiFetch } from '@/utils/api';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
vi.mock('@/utils/api', async original => ({ ...await original<typeof import('@/utils/api')>(), apiFetch: vi.fn() }));
vi.mock('@/hooks/useUser', () => ({ useUser: () => ({ user: null }) }));
vi.mock('@/utils/widgetTelemetry', () => ({ trackWidgetEvent: vi.fn() }));

// Componentes, grabador y cliente de subida reales. Micrófono, identidad y HTTP son sintéticos:
// ningún caso llama a un proveedor ni comprueba que voz o transcripción estén disponibles.
const originalDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
let objectPut: ReturnType<typeof vi.fn>;
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
  objectPut = vi.fn(async () => new Response('', { status: 200 }));
  vi.stubGlobal('fetch', objectPut); vi.spyOn(console, 'error').mockImplementation(() => {});
  window.localStorage.clear(); window.sessionStorage.clear();
});
afterEach(() => { cleanup(); if (originalDevices) Object.defineProperty(navigator, 'mediaDevices', originalDevices); else Reflect.deleteProperty(navigator, 'mediaDevices'); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function recordAndStop(label = 'Audio') {
  fireEvent.click(screen.getByRole('button', { name: label }));
  await screen.findByRole('button', { name: 'Detener grabación' });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Detener grabación' })); });
}
const messageField = () => screen.getByRole('textbox');
const recordAction = (label = 'Audio') => screen.getByRole('button', { name: label });
/** Una persona que usa teclado llega al botón con Tab; el clic no mueve el foco en jsdom. */
const activate = (name: string) => { const button = screen.getByRole('button', { name }); button.focus(); expect(button).toHaveFocus(); fireEvent.click(button); };

describe('audio draft keeps a keyboard exit after an upload or runtime error', () => {
  it('widget: discarding the retained recording returns focus to the record action', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('prepare_unavailable', 503));
    render(<ChatInput onSendMessage={vi.fn()} isTyping={false} tenantSlug="synthetic-tdf" />); await recordAndStop();
    await screen.findByRole('button', { name: 'Comprobar envío' });
    activate('Descartar grabación');
    expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull();
    expect(recordAction()).toHaveFocus(); expect(recordAction()).toBeEnabled();
    expect(apiFetch).toHaveBeenCalledOnce(); expect(objectPut).not.toHaveBeenCalled();
  });

  it('widget: a confirmed explicit retry returns focus to the record action without resending', async () => {
    const send = vi.fn(payload => payload.audioRecovery?.onSuccess());
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('prepare_unavailable', 503)).mockResolvedValueOnce(prepare).mockResolvedValueOnce(uploaded);
    render(<ChatInput onSendMessage={send} isTyping={false} tenantSlug="synthetic-tdf" />); await recordAndStop();
    await screen.findByRole('button', { name: 'Comprobar envío' });
    await act(async () => { activate('Comprobar envío'); });
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull());
    expect(recordAction()).toHaveFocus();
    expect(apiFetch).toHaveBeenCalledTimes(3); expect(objectPut).toHaveBeenCalledOnce();
  });

  it('web panel: discarding the retained recording returns focus to the record action', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('unavailable', 503));
    render(<ChatPanel variant="standalone" context={context()} mediaCapabilities={caps('/ask')} />); await recordAndStop('Nota de voz');
    await screen.findByRole('button', { name: 'Descartar grabación' });
    activate('Descartar grabación');
    expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull();
    expect(recordAction('Nota de voz')).toHaveFocus(); expect(recordAction('Nota de voz')).toBeEnabled();
    expect(apiFetch).toHaveBeenCalledOnce();
  });

  it('does not take focus from another control when the draft is retired', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('prepare_unavailable', 503));
    render(<><button type="button">Otro control</button><ChatInput onSendMessage={vi.fn()} isTyping={false} tenantSlug="synthetic-tdf" /></>); await recordAndStop();
    await screen.findByRole('button', { name: 'Comprobar envío' });
    screen.getByRole('button', { name: 'Descartar grabación' }).focus();
    const other = screen.getByRole('button', { name: 'Otro control' }); other.focus();
    await act(async () => { advanceChatbocSessionRevision(); });
    expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull();
    expect(other).toHaveFocus();
  });

  it('does not carry an unconfirmed retry over to a later session retirement', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('prepare_unavailable', 503)).mockRejectedValueOnce(new ApiError('prepare_unavailable', 503));
    render(<ChatInput onSendMessage={vi.fn()} isTyping={false} tenantSlug="synthetic-tdf" />); await recordAndStop();
    await screen.findByRole('button', { name: 'Comprobar envío' });
    await act(async () => { activate('Comprobar envío'); });
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Descartar grabación' })).toBeVisible();
    expect(recordAction()).not.toHaveFocus();
    await act(async () => { advanceChatbocSessionRevision(); });
    expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull();
    expect(recordAction()).not.toHaveFocus(); expect(messageField()).not.toHaveFocus();
    expect(apiFetch).toHaveBeenCalledTimes(2); expect(objectPut).not.toHaveBeenCalled();
  });

  it('retires the draft on a session change without focusing a field for the previous identity', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('prepare_unavailable', 503));
    const view = (slug: string, disabled = false) => <ChatInput onSendMessage={vi.fn()} isTyping={false} tenantSlug={slug} disabled={disabled} />;
    const mounted = render(view('synthetic-tdf')); await recordAndStop();
    await screen.findByRole('button', { name: 'Comprobar envío' });
    screen.getByRole('button', { name: 'Descartar grabación' }).focus();
    mounted.rerender(view('synthetic-otro', true));
    expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Comprobar envío' })).toBeNull();
    expect(messageField()).not.toHaveFocus(); expect(document.activeElement).toBe(document.body);
    expect(apiFetch).toHaveBeenCalledOnce();
  });
});
