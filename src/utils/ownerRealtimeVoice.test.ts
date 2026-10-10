import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOwnerVoiceTransport, type VoiceAnswer } from './ownerRealtimeVoice';

const answer: VoiceAnswer = { session_id: 'a'.repeat(32), sdp: 'v=0\r\nm=audio 9 X\r\n', limits: { client_duration_seconds: 120 } };
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
let track: { stop: ReturnType<typeof vi.fn>; enabled: boolean };
let channel: any;
let peer: any;
let media: any;
let getMedia: ReturnType<typeof vi.fn>;

function fixture(overrides: Record<string, unknown> = {}) {
  const options = {
    exchange: vi.fn().mockResolvedValue(answer), stop: vi.fn().mockResolvedValue({ provider_close_accepted: true }),
    audio: { pause: vi.fn(), play: vi.fn().mockResolvedValue(undefined), srcObject: null } as unknown as HTMLAudioElement,
    state: vi.fn(), captions: vi.fn(), speaking: vi.fn(), playbackBlocked: vi.fn(), ...overrides,
  };
  return { options, transport: createOwnerVoiceTransport(options) };
}
beforeEach(() => {
  vi.useFakeTimers();
  track = { stop: vi.fn(), enabled: true };
  media = { getTracks: () => [track], getAudioTracks: () => [track] };
  getMedia = vi.fn().mockResolvedValue(media);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: getMedia } });
  channel = { close: vi.fn(), readyState: 'connecting', onmessage: null, onopen: null };
  peer = { addTrack: vi.fn(), createDataChannel: vi.fn(() => channel), createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: answer.sdp }),
    setLocalDescription: vi.fn().mockResolvedValue(undefined), setRemoteDescription: vi.fn().mockResolvedValue(undefined), close: vi.fn(), connectionState: 'connecting' };
  vi.stubGlobal('RTCPeerConnection', function () { return peer; });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('owner voice browser transport (offline)', () => {
  it('does not start a microphone or exchange before an explicit start', () => {
    const { options } = fixture();
    expect(getMedia).not.toHaveBeenCalled(); expect(options.exchange).not.toHaveBeenCalled();
  });
  it('requires the real peer and channel before announcing connected', async () => {
    const { transport, options } = fixture(); await transport.start();
    expect(getMedia).toHaveBeenCalledWith({ audio: true, video: false });
    expect(options.state).not.toHaveBeenCalledWith('live');
    peer.connectionState = 'connected'; peer.onconnectionstatechange();
    expect(options.state).not.toHaveBeenCalledWith('live');
    channel.readyState = 'open'; channel.onopen();
    expect(options.state).toHaveBeenCalledWith('live');
    expect(options.speaking).not.toHaveBeenCalledWith(true);
    await transport.close();
  });
  it('actually mutes the audio track, then immediately closes mic before awaiting hangup', async () => {
    const hangup = deferred<{ provider_close_accepted: boolean }>();
    const { transport, options } = fixture({ stop: vi.fn(() => hangup.promise) }); await transport.start();
    transport.mute(true); expect(track.enabled).toBe(false);
    transport.mute(false); expect(track.enabled).toBe(true);
    const closing = transport.close();
    expect(track.stop).toHaveBeenCalledOnce(); expect(peer.close).toHaveBeenCalledOnce();
    hangup.resolve({ provider_close_accepted: true }); await closing;
    await transport.close(); expect(options.stop).toHaveBeenCalledOnce();
  });
  it('stops microphone tracks that arrive after cancellation without issuing a call', async () => {
    const permission = deferred<MediaStream>(); getMedia.mockReturnValue(permission.promise);
    const { transport, options } = fixture(); const starting = transport.start(); await transport.close();
    permission.resolve(media); await starting;
    expect(track.stop).toHaveBeenCalledOnce(); expect(options.exchange).not.toHaveBeenCalled();
  });
  it('closes a late server-created call once and never attaches its answer', async () => {
    const exchange = deferred<VoiceAnswer>();
    const { transport, options } = fixture({ exchange: vi.fn(() => exchange.promise) });
    const starting = transport.start(); await vi.waitFor(() => expect(options.exchange).toHaveBeenCalledOnce());
    await transport.close(); expect(options.state).toHaveBeenCalledWith('pending');
    exchange.resolve(answer); await starting;
    expect(options.stop).toHaveBeenCalledOnce(); expect(peer.setRemoteDescription).not.toHaveBeenCalled();
    expect(options.state).toHaveBeenLastCalledWith('ended');
  });
  it('keeps unknown hangup pending without retrying', async () => {
    const { transport, options } = fixture({ stop: vi.fn().mockRejectedValue(new Error('offline')) });
    await transport.start(); await transport.close(); await transport.close();
    expect(options.stop).toHaveBeenCalledOnce(); expect(options.state).toHaveBeenLastCalledWith('pending');
  });
  it('does not recreate timers after cancellation during remote SDP attachment', async () => {
    const attach=deferred<void>(); peer.setRemoteDescription.mockReturnValue(attach.promise);
    const { transport, options }=fixture(); const starting=transport.start();
    await vi.waitFor(() => expect(peer.setRemoteDescription).toHaveBeenCalledOnce());
    await transport.close(); const count=options.state.mock.calls.length;
    attach.resolve(undefined); await starting;
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(120000);
    expect(options.state.mock.calls).toHaveLength(count);
    expect(options.stop).toHaveBeenCalledOnce(); expect(options.exchange).toHaveBeenCalledOnce();
  });
  it('collects full captions, never sends tool or session updates, and uses actual speaking events', async () => {
    const { transport, options } = fixture(); await transport.start();
    const send = (event: unknown) => channel.onmessage({ data: JSON.stringify(event) });
    send({ type: 'response.output_audio_transcript.delta', item_id: '1', delta: 'Hola ' });
    send({ type: 'response.output_audio_transcript.delta', item_id: '1', delta: '¿cómo estás?' });
    expect(options.captions).toHaveBeenLastCalledWith([{ id: 'assistant:1', speaker: 'assistant', text: 'Hola ¿cómo estás?' }]);
    send({ type: 'conversation.item.input_audio_transcription.completed', item_id: '2', transcript: 'Quiero información' });
    expect(options.captions.mock.calls.at(-1)?.[0]).toHaveLength(2);
    send({ type: 'output_audio_buffer.started' }); expect(options.speaking).toHaveBeenCalledWith(true);
    send({ type: 'output_audio_buffer.stopped' }); expect(options.speaking).toHaveBeenLastCalledWith(false);
    await transport.close();
  });
  it('bounds events and ignores captions after local close', async () => {
    const { transport, options } = fixture(); await transport.start();
    const handler = channel.onmessage;
    handler({ data: 'x'.repeat(20000) }); handler({ data: '{' });
    expect(options.captions).not.toHaveBeenCalled();
    await transport.close();
    handler({ data: JSON.stringify({ type: 'response.output_audio_transcript.delta', item_id: '1', delta: 'late' }) });
    expect(options.captions).not.toHaveBeenCalled();
  });
  it('uses the explicit UX duration and connection timeout without restarting', async () => {
    const { transport, options } = fixture(); await transport.start();
    peer.connectionState = 'connected'; channel.readyState = 'open'; channel.onopen();
    await vi.advanceTimersByTimeAsync(120000);
    expect(track.stop).toHaveBeenCalledOnce(); expect(options.stop).toHaveBeenCalledOnce();
    expect(options.exchange).toHaveBeenCalledOnce();
  });
});
