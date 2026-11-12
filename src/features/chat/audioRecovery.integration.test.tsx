import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatInput from '@/components/chat/ChatInput';
import ChatPanel from './ChatPanel';
import { ApiError, apiFetch } from '@/utils/api';
import { advanceChatbocSessionRevision } from '@/utils/chatbocSessionRevision';
import {useChatLogic} from '@/hooks/useChatLogic';
vi.mock('@/utils/api', async original => ({ ...await original<typeof import('@/utils/api')>(), apiFetch: vi.fn() }));
vi.mock('@/hooks/useUser',()=>({useUser:()=>({user:null})}));
vi.mock('@/utils/widgetTelemetry',()=>({trackWidgetEvent:vi.fn()}));

// Real components, uploader and runtime adapter. Device, identity and HTTP
// boundaries are synthetic; these cases do not call any provider or microphone.
const originalDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
let tracks: Array<{ stop: ReturnType<typeof vi.fn> }>;
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
const context = (slug = 'synthetic-tdf', endpoint = '/ask/municipio') => ({ tipoChat: 'municipio' as const, sector: 'gobierno', tenantSlug: slug, chatBootstrap: {
  contract_version: 'demo.chat_bootstrap.v1', endpoint, method: 'POST', payload: { tipo_chat: 'municipio', tenant_slug: slug },
  session: { chat_session_id: 'synthetic-audio-session', tenant_slug: slug },
} });
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((r, j) => { resolve = r; reject = j; }); return { promise, resolve, reject }; };
let currentLogic:ReturnType<typeof useChatLogic>;
function HookInput({runtime=true,bootstrap}:{runtime?:boolean;bootstrap?:ReturnType<typeof context>['chatBootstrap']}){
  currentLogic=useChatLogic({tipoChat:'municipio',tenantSlug:'synthetic-tdf',skipAuth:true,socketEnabled:false,autoInitEnabled:false,chatBootstrap:bootstrap});
  return <><output data-testid="typing">{String(currentLogic.isTyping)}</output>
    {currentLogic.messages.map(message=><p key={message.id}>{message.text}</p>)}
    <ChatInput onSendMessage={payload=>{void currentLogic.handleSend(payload);}} isTyping={currentLogic.isTyping}
      tenantSlug="synthetic-tdf" audioContextKey={JSON.stringify(bootstrap??null)} mediaCapabilities={runtime?caps('/ask/municipio'):undefined}/></>;
}
const readFileText=(file:Blob)=>new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsText(file);});
beforeEach(() => {
  tracks = []; vi.mocked(apiFetch).mockReset();
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(async () => {
    const track = { stop: vi.fn() }; tracks.push(track); return { getTracks: () => [track] } as unknown as MediaStream;
  }) } });
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  objectPut = vi.fn(async (url: unknown) => { if (url !== prepare.upload.url) throw new Error('unexpected_synthetic_fetch'); return new Response('', { status: 200 }); });
  vi.stubGlobal('fetch', objectPut); vi.spyOn(console, 'error').mockImplementation(() => {});
  window.localStorage.clear(); window.sessionStorage.clear();
});
afterEach(() => { cleanup(); tracks.forEach(track => track.stop()); if (originalDevices) Object.defineProperty(navigator, 'mediaDevices', originalDevices); else Reflect.deleteProperty(navigator, 'mediaDevices'); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function recordAndStop(label = 'Audio') {
  fireEvent.click(screen.getByRole('button', { name: label }));
  await screen.findByRole('button', { name: 'Detener grabación' });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Detener grabación' })); });
}
describe('owned audio recovery without fresh uncertain writes', () => {
  it('retains prepare503 and explicitly prepares once before one object PUT and completion', async () => {
    const send = vi.fn(payload=>payload.audioRecovery?.onSuccess()); vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('prepare_unavailable', 503)).mockResolvedValueOnce(prepare).mockResolvedValueOnce(uploaded);
    render(<ChatInput onSendMessage={send} isTyping={false} tenantSlug="synthetic-tdf" />); await recordAndStop();
    expect(await screen.findByRole('button', { name: 'Comprobar envío' })).toBeVisible();
    expect(apiFetch).toHaveBeenCalledOnce(); expect(objectPut).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Comprobar envío' })));
    await waitFor(() => expect(send).toHaveBeenCalledOnce());
    expect(apiFetch).toHaveBeenCalledTimes(3); expect(objectPut).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull();
  });
  it('reconciles a lost completion ACK with the same intent and never repeats PUT or prepare', async () => {
    const send = vi.fn(payload=>payload.audioRecovery?.onSuccess()), ack = deferred<unknown>();
    vi.mocked(apiFetch).mockResolvedValueOnce(prepare).mockRejectedValueOnce(new TypeError('completion_ack_lost')).mockReturnValueOnce(ack.promise);
    render(<ChatInput onSendMessage={send} isTyping={false} tenantSlug="synthetic-tdf" />); await recordAndStop();
    const retry = await screen.findByRole('button', { name: 'Comprobar envío' });
    fireEvent.click(retry); fireEvent.click(retry);
    expect(apiFetch).toHaveBeenCalledTimes(3); expect(objectPut).toHaveBeenCalledOnce();
    expect(vi.mocked(apiFetch).mock.calls[2][1]?.body).toEqual(vi.mocked(apiFetch).mock.calls[1][1]?.body);
    expect(vi.mocked(apiFetch).mock.calls.every(([, options]) => options?.singleAttempt)).toBe(true);
    await act(async () => ack.resolve(uploaded)); await waitFor(() => expect(send).toHaveBeenCalledOnce());
  });
  it('does not mint another prepare after expired completion intent410', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(prepare).mockRejectedValueOnce(new ApiError('expired', 410, { code: 'upload_intent_expired' }));
    render(<ChatInput onSendMessage={vi.fn()} isTyping={false} tenantSlug="synthetic-tdf" />); await recordAndStop();
    expect(await screen.findByRole('button', { name: 'Descartar grabación' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Comprobar envío' })).toBeNull();
    expect(apiFetch).toHaveBeenCalledTimes(2); expect(objectPut).toHaveBeenCalledOnce();
  });
  it('retains an uncertain object PUT without offering any new PUT or message retry', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(prepare); objectPut.mockRejectedValueOnce(new TypeError('object_ack_lost'));
    render(<ChatInput onSendMessage={vi.fn()} isTyping={false} tenantSlug="synthetic-tdf" />); await recordAndStop();
    expect(await screen.findByRole('button', { name: 'Descartar grabación' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Comprobar envío' })).toBeNull();
    expect(apiFetch).toHaveBeenCalledOnce(); expect(objectPut).toHaveBeenCalledOnce();
  });
  it('keeps generic runtime uncertainty in memory with discard only and one chosen destination', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('unavailable', 503));
    render(<ChatPanel variant="standalone" context={context('synthetic-tdf', '/ask')} mediaCapabilities={caps('/ask')} />); await recordAndStop('Nota de voz');
    expect(await screen.findByRole('button', { name: 'Descartar grabación' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Comprobar envío' })).toBeNull(); expect(apiFetch).toHaveBeenCalledOnce();
    expect(vi.mocked(apiFetch).mock.calls[0][1]?.singleAttempt).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Descartar grabación' }));
    expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull(); expect(apiFetch).toHaveBeenCalledOnce();
  });
  it('replays municipal runtime through the same body, filename, route and key without a second user placeholder', async () => {
    const ack = deferred<unknown>(); vi.mocked(apiFetch).mockRejectedValueOnce(new TypeError('ack_lost')).mockReturnValueOnce(ack.promise);
    render(<ChatPanel variant="standalone" context={context()} mediaCapabilities={caps('/ask/municipio')} />); await recordAndStop('Nota de voz');
    const retry = await screen.findByRole('button', { name: 'Comprobar envío' }); fireEvent.click(retry); fireEvent.click(retry);
    expect(apiFetch).toHaveBeenCalledTimes(2);
    const first = vi.mocked(apiFetch).mock.calls[0], second = vi.mocked(apiFetch).mock.calls[1];
    expect(second[0]).toBe(first[0]); expect(second[1]?.body).toBe(first[1]?.body); expect(second[1]?.headers).toEqual(first[1]?.headers);
    const firstFile=(first[1]?.body as FormData).get('audio_file') as File;
    const secondFile=(second[1]?.body as FormData).get('audio_file') as File;
    expect(firstFile.name).toMatch(/^audio-\d+\.webm$/);expect(secondFile.name).toBe(firstFile.name);
    expect(secondFile.type).toBe('audio/webm');expect(secondFile.size).toBe(firstFile.size);
    expect(await readFileText(firstFile)).toBe('synthetic-speech');expect(await readFileText(secondFile)).toBe('synthetic-speech');
    expect(first[1]?.headers?.['Idempotency-Key']).toMatch(/^[A-Za-z0-9_.:-]{8,128}$/); expect(second[1]?.singleAttempt).toBe(true);
    await act(async () => ack.resolve({ message_body: 'synthetic_recovered_reply' }));
    expect(await screen.findByText('synthetic_recovered_reply')).toBeVisible();
    expect(screen.getAllByText('Audio')).toHaveLength(1); expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull();
  });
  it.each([400,410,503])('does not retry cached terminal municipal%s or reconciliation', async status => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError('blocked', status, { reason_code: status===503?'municipio_chat_idempotency_reconciliation_required':'terminal', retryable: false }));
    render(<ChatPanel variant="standalone" context={context()} mediaCapabilities={caps('/ask/municipio')} />); await recordAndStop('Nota de voz');
    expect(await screen.findByRole('button', { name: 'Descartar grabación' })).toBeVisible(); expect(screen.queryByRole('button', { name: 'Comprobar envío' })).toBeNull();
    expect(apiFetch).toHaveBeenCalledOnce();
  });
  it('retires pending recovery and its ACK when a current recording is discarded', async () => {
    const ack = deferred<unknown>(); vi.mocked(apiFetch).mockRejectedValueOnce(new TypeError('ack_lost')).mockReturnValueOnce(ack.promise);
    render(<ChatPanel variant="standalone" context={context()} mediaCapabilities={caps('/ask/municipio')} />); await recordAndStop('Nota de voz');
    fireEvent.click(await screen.findByRole('button', { name: 'Comprobar envío' })); fireEvent.click(screen.getByRole('button', { name: 'Descartar grabación' }));
    await act(async () => ack.resolve({ message_body: 'retired_reply' }));
    expect(screen.queryByText('retired_reply')).toBeNull(); expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull(); expect(apiFetch).toHaveBeenCalledTimes(2);
  });
  it('retires memory-only audio after tenant navigation, session ABA or unmount', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new TypeError('ack_lost'));
    const view = (slug: string) => <ChatPanel variant="standalone" context={context(slug)} mediaCapabilities={caps('/ask/municipio')} />;
    const mounted = render(view('synthetic-tdf')); await recordAndStop('Nota de voz');
    await screen.findByRole('button', { name: 'Comprobar envío' }); mounted.rerender(view('synthetic-other'));
    expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull(); mounted.rerender(view('synthetic-tdf'));
    expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull();
    vi.mocked(apiFetch).mockRejectedValueOnce(new TypeError('ack_lost_again')); await recordAndStop('Nota de voz');
    await screen.findByRole('button', { name: 'Comprobar envío' }); act(() => { advanceChatbocSessionRevision(); advanceChatbocSessionRevision(); });
    expect(screen.queryByRole('button', { name: 'Descartar grabación' })).toBeNull(); mounted.unmount();
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(Object.keys(localStorage).some(key => /audio|recording|blob/i.test(key))).toBe(false);
  });
  it.each(['success','error'])('releases only its typing indicator after discard during pending recovery %s',async outcome=>{
    const ack=deferred<unknown>();vi.mocked(apiFetch).mockRejectedValueOnce(new TypeError('ack_lost')).mockReturnValueOnce(ack.promise);
    render(<HookInput/>);await recordAndStop('Nota de voz');
    fireEvent.click(await screen.findByRole('button',{name:'Comprobar envío'}));expect(screen.getByTestId('typing')).toHaveTextContent('true');
    fireEvent.click(screen.getByRole('button',{name:'Descartar grabación'}));expect(screen.getByTestId('typing')).toHaveTextContent('false');
    await act(async()=>{if(outcome==='success')ack.resolve({message_body:'retired_audio_ack'});else ack.reject(new TypeError('retired_error'));});
    expect(screen.getByTestId('typing')).toHaveTextContent('false');expect(screen.queryByText('retired_audio_ack')).toBeNull();expect(screen.queryByText('retired_error')).toBeNull();
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });
  it('does not clear a newer text request typing indicator when a discarded audio ACK settles',async()=>{
    const audioAck=deferred<unknown>(),textAck=deferred<unknown>();
    vi.mocked(apiFetch).mockRejectedValueOnce(new TypeError('ack_lost')).mockReturnValueOnce(audioAck.promise).mockReturnValueOnce(textAck.promise);
    render(<HookInput/>);await recordAndStop('Nota de voz');fireEvent.click(await screen.findByRole('button',{name:'Comprobar envío'}));
    fireEvent.click(screen.getByRole('button',{name:'Descartar grabación'}));
    let textJob!:Promise<void>;act(()=>{textJob=currentLogic.handleSend({text:'nueva consulta',source:'input'});});
    expect(screen.getByTestId('typing')).toHaveTextContent('true');
    await act(async()=>audioAck.resolve({message_body:'retired_audio_ack'}));expect(screen.getByTestId('typing')).toHaveTextContent('true');
    await act(async()=>{textAck.resolve({message_body:'current_text_ack'});await textJob;});expect(screen.getByTestId('typing')).toHaveTextContent('false');
  });
  it.each(['503','network'])('keeps uploaded audio until the following chat ACK and blocks unsafe recovery after %s',async kind=>{
    vi.mocked(apiFetch).mockResolvedValueOnce(prepare).mockResolvedValueOnce(uploaded)
      .mockRejectedValueOnce(kind==='503'?new ApiError('message_unconfirmed',503):new TypeError('message_ack_lost'));
    render(<HookInput runtime={false}/>);await recordAndStop();
    await waitFor(()=>expect(screen.getByText(/no podemos confirmar su envío/)).toBeVisible());
    expect(screen.getByRole('button',{name:'Descartar grabación'})).toBeVisible();expect(screen.queryByRole('button',{name:'Comprobar envío'})).toBeNull();
    expect(apiFetch).toHaveBeenCalledTimes(3);expect(objectPut).toHaveBeenCalledOnce();
    expect(vi.mocked(apiFetch).mock.calls[2][1]?.singleAttempt).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Descartar grabación'}));expect(apiFetch).toHaveBeenCalledTimes(3);
  });
  it('blocks a second standalone recording while the first dispatch is awaiting ACK',async()=>{
    const first=deferred<unknown>(),second=deferred<unknown>();vi.mocked(apiFetch).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    render(<ChatPanel variant="standalone" context={context()} mediaCapabilities={caps('/ask/municipio')}/>);await recordAndStop('Nota de voz');
    expect(screen.getByRole('button',{name:'Nota de voz'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Nota de voz'}));expect(apiFetch).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button',{name:'Descartar grabación'}));await recordAndStop('Nota de voz');expect(apiFetch).toHaveBeenCalledTimes(2);
    await act(async()=>first.reject(new TypeError('retired_first_failure')));expect(screen.queryByRole('button',{name:'Comprobar envío'})).toBeNull();
    expect(screen.getByRole('button',{name:'Descartar grabación'})).toBeVisible();
    await act(async()=>second.reject(new TypeError('current_second_failure')));expect(await screen.findByRole('button',{name:'Comprobar envío'})).toBeVisible();
  });
  it.each(['endpoint','query','session','scope','capabilities'])('retires same-tenant runtime and ABA when %s changes',async field=>{
    const ack=deferred<unknown>();vi.mocked(apiFetch).mockReturnValueOnce(ack.promise);
    const original=context(),changed=structuredClone(original),originalCaps=caps('/ask/municipio'),changedCaps=structuredClone(originalCaps);
    if(field==='endpoint')changed.chatBootstrap.endpoint='/api/ask/municipio';
    if(field==='query')Object.assign(changed.chatBootstrap,{query:{revision:'new'}});
    if(field==='session')changed.chatBootstrap.session.chat_session_id='new-session';
    if(field==='scope')Object.assign(changed.chatBootstrap,{headers:{'X-Tenant-Slug':'new-bound-scope'}});
    if(field==='capabilities')changedCaps.input_modes.audio.enabled=false;
    const mounted=render(<ChatPanel variant="standalone" context={original} mediaCapabilities={originalCaps}/>);await recordAndStop('Nota de voz');
    mounted.rerender(<ChatPanel variant="standalone" context={changed} mediaCapabilities={changedCaps}/>);
    mounted.rerender(<ChatPanel variant="standalone" context={original} mediaCapabilities={originalCaps}/>);
    await act(async()=>ack.resolve({message_body:'retired_scope_ack'}));expect(screen.queryByText('retired_scope_ack')).toBeNull();
    expect(screen.queryByRole('button',{name:'Descartar grabación'})).toBeNull();expect(apiFetch).toHaveBeenCalledOnce();
  });
  it('fails closed when persistent identity cannot be read instead of offering a new audio identity retry',async()=>{
    const get=vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new DOMException('blocked','SecurityError');});
    render(<ChatPanel variant="standalone" context={context()} mediaCapabilities={caps('/ask/municipio')}/>);await recordAndStop('Nota de voz');
    expect(await screen.findByRole('button',{name:'Descartar grabación'})).toBeVisible();expect(screen.queryByRole('button',{name:'Comprobar envío'})).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();get.mockRestore();
  });
  it.each(['query','session','headers'])('retires widget audio typing and delayed ACK under same-tenant bootstrap %s ABA',async field=>{
    const ack=deferred<unknown>();vi.mocked(apiFetch).mockReturnValueOnce(ack.promise);
    const original=context().chatBootstrap,changed=structuredClone(original);
    if(field==='query')Object.assign(changed,{query:{revision:'new'}});
    if(field==='session')changed.session.chat_session_id='new-session';
    if(field==='headers')Object.assign(changed,{headers:{'X-Tenant-Slug':'new-scope'}});
    const mounted=render(<HookInput bootstrap={original}/>);await recordAndStop('Nota de voz');expect(screen.getByTestId('typing')).toHaveTextContent('true');
    mounted.rerender(<HookInput bootstrap={changed}/>);expect(screen.getByTestId('typing')).toHaveTextContent('false');mounted.rerender(<HookInput bootstrap={original}/>);
    await act(async()=>ack.resolve({message_body:'retired_bootstrap_ack'}));expect(screen.queryByText('retired_bootstrap_ack')).toBeNull();
    expect(screen.queryByRole('button',{name:'Descartar grabación'})).toBeNull();expect(apiFetch).toHaveBeenCalledOnce();
  });
});
