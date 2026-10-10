/** Native, voluntary audio transport. No API key, recording or browser storage. */
export type OwnerVoiceState = 'idle' | 'connecting' | 'live' | 'ended' | 'error' | 'pending';
export type VoiceCaption = { id: string; speaker: 'you' | 'assistant'; text: string };
export type VoiceAnswer = { session_id: string; sdp: string; limits: { client_duration_seconds: number } };
export type OwnerVoiceOptions = {
  exchange: (sdp: string) => Promise<VoiceAnswer>;
  stop: (id: string) => Promise<{ provider_close_accepted: boolean }>;
  audio: HTMLAudioElement;
  state: (state: OwnerVoiceState) => void;
  captions: (captions: VoiceCaption[]) => void;
  speaking: (speaking: boolean) => void;
  playbackBlocked: () => void;
};

export function createOwnerVoiceTransport(options: OwnerVoiceOptions) {
  let peer: RTCPeerConnection | null = null;
  let stream: MediaStream | null = null;
  let channel: RTCDataChannel | null = null;
  let closed = false;
  let issued = false;
  let exchangeIssued = false;
  let sessionId: string | null = null;
  let stopAttempt: Promise<boolean> | null = null;
  let duration: ReturnType<typeof setTimeout> | undefined;
  let connectionDeadline: ReturnType<typeof setTimeout> | undefined;
  const captions = new Map<string, VoiceCaption>();

  const stopOnce = async () => {
    if (!sessionId) return !exchangeIssued;
    if (!stopAttempt) {
      stopAttempt = options.stop(sessionId).then(result => result.provider_close_accepted === true, () => false);
    }
    return stopAttempt;
  };
  const release = () => {
    clearTimeout(duration);
    clearTimeout(connectionDeadline);
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    channel?.close();
    if (peer) {
      peer.onconnectionstatechange = null;
      peer.ontrack = null;
      peer.close();
    }
    peer = null;
    channel = null;
    options.audio.pause();
    options.audio.srcObject = null;
    options.speaking(false);
  };
  const close = async () => {
    closed = true;
    release(); // Mic turns off immediately, before waiting for the server.
    const stopped = await stopOnce();
    options.state(stopped ? 'ended' : 'pending');
    return stopped;
  };
  const fail = async () => {
    const stopped = await close();
    if (stopped) options.state('error');
  };
  const ready = () => {
    if (closed || peer?.connectionState !== 'connected' || channel?.readyState !== 'open') return;
    clearTimeout(connectionDeadline);
    options.state('live');
  };
  const caption = (event: Record<string, unknown>) => {
    if (closed || typeof event.type !== 'string') return;
    if (event.type === 'output_audio_buffer.started') options.speaking(true);
    if (['output_audio_buffer.stopped', 'output_audio_buffer.cleared', 'response.done'].includes(event.type)) options.speaking(false);
    if (event.type === 'error') { void fail(); return; }
    const user = event.type === 'conversation.item.input_audio_transcription.completed';
    const delta = event.type === 'response.output_audio_transcript.delta';
    const done = event.type === 'response.output_audio_transcript.done';
    if (!user && !delta && !done) return;
    if (typeof event.item_id !== 'string' || event.item_id.length > 180) return;
    const text = delta ? event.delta : event.transcript;
    if (typeof text !== 'string' || text.length > 4000) return;
    const id = `${user ? 'you' : 'assistant'}:${event.item_id}`;
    const previous = captions.get(id)?.text || '';
    captions.set(id, { id, speaker: user ? 'you' : 'assistant', text: (delta ? previous + text : text).slice(0, 4000) });
    while (captions.size > 20) captions.delete(captions.keys().next().value!);
    options.captions([...captions.values()]);
  };
  return {
    async start() {
      if (issued || closed) return;
      issued = true;
      options.state('connecting');
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') throw new Error('unsupported');
        const received = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (closed) { received.getTracks().forEach(track => track.stop()); return; }
        stream = received;
        peer = new RTCPeerConnection();
        for (const track of stream.getAudioTracks()) peer.addTrack(track, stream);
        peer.ontrack = event => {
          if (closed) return;
          options.audio.srcObject = event.streams[0] || new MediaStream([event.track]);
          void options.audio.play().catch(() => { if (!closed) options.playbackBlocked(); });
        };
        peer.onconnectionstatechange = () => {
          if (closed) return;
          if (peer?.connectionState === 'failed' || peer?.connectionState === 'closed') void fail();
          else ready();
        };
        channel = peer.createDataChannel('oai-events');
        channel.onopen = ready;
        channel.onmessage = event => {
          if (typeof event.data !== 'string' || event.data.length > 16 * 1024) return;
          try { caption(JSON.parse(event.data)); } catch { /* Ignore malformed event, never log voice data. */ }
        };
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        if (closed) return;
        // Do not abort an issued exchange: receive the ID and close a late call.
        exchangeIssued = true;
        const answer = await options.exchange(offer.sdp || '');
        sessionId = answer.session_id;
        if (closed) { const stopped = await stopOnce(); options.state(stopped ? 'ended' : 'pending'); return; }
        if (!/^[a-f0-9]{32}$/.test(sessionId) || answer.sdp.length > 48 * 1024
            || answer.limits.client_duration_seconds !== 120) throw new Error('invalid_contract');
        await peer!.setRemoteDescription({ type: 'answer', sdp: answer.sdp });
        connectionDeadline = setTimeout(() => { void fail(); }, 15_000);
        // UX duration only. The server contract explicitly denies a billing guarantee.
        duration = setTimeout(() => { void close(); }, 120_000);
        ready();
      } catch {
        if (!closed) await fail();
      }
    },
    close,
    mute(value: boolean) { stream?.getAudioTracks().forEach(track => { track.enabled = !value; }); },
  };
}
