import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/utils/api';
import { CHATBOC_AGENT_AVATAR, CHATBOC_AGENT_MARK } from '@/utils/brandAssets';
import { createOwnerVoiceTransport, type OwnerVoiceState, type VoiceAnswer, type VoiceCaption } from '@/utils/ownerRealtimeVoice';

type Capability = { enabled: boolean; revision?: string; ui: Record<string, string>;
  contract_version: string; owner_trial: boolean; tenant: { slug: string } };

/** Authenticated owner trial only. The server decides enablement and supplies copy. */
export default function OwnerRealtimeVoicePanel({ tenantSlug, logoUrl, reducedMotion = false }: { tenantSlug: string; logoUrl?: string; reducedMotion?: boolean }) {
  const [capability, setCapability] = useState<Capability | null>(null);
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<OwnerVoiceState>('idle');
  const [captions, setCaptions] = useState<VoiceCaption[]>([]);
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);
  const startButton = useRef<HTMLButtonElement>(null);
  const transport = useRef<ReturnType<typeof createOwnerVoiceTransport> | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const base = `/api/admin/tenants/${encodeURIComponent(tenantSlug)}/realtime/browser`;
  const requestOptions = { tenantSlug, omitEntityToken: true, omitChatSessionId: true,
    suppressPanel401Redirect: true, preserveAuthOn401: true, allowSafeBaseFallback: false };
  useEffect(() => {
    const current = ++generation.current;
    busy.current = false;
    setCapability(null); setConsent(false); setCaptions([]); setState('idle');
    void apiFetch<Capability>(`${base}/capabilities`, requestOptions).then(value => {
      if (current !== generation.current || value.contract_version !== 'browser.realtime.owner_trial.v1'
          || value.owner_trial !== true || value.tenant?.slug !== tenantSlug || !value.ui) return;
      setCapability(value);
    }, () => { /* A public visitor or employee does not get an owner trial UI. */ });
    return () => { generation.current++; void transport.current?.close(); transport.current = null; };
  }, [tenantSlug]);
  if (!capability) return null;
  const ui = capability.ui;
  const active = state === 'connecting' || state === 'live';
  const stop = async () => { await transport.current?.close(); startButton.current?.focus(); };
  const start = () => {
    if (!capability.enabled || !capability.revision || !consent || active || busy.current || !audio.current || state === 'pending') return;
    busy.current = true;
    const current = ++generation.current;
    setCaptions([]); setMuted(false); setSpeaking(false); setPlaybackBlocked(false);
    const guarded = <T,>(setter: (value: T) => void) => (value: T) => { if (current === generation.current) setter(value); };
    const instance = createOwnerVoiceTransport({
      audio: audio.current,
      exchange: sdp => apiFetch<VoiceAnswer>(`${base}/sessions`, { ...requestOptions, method: 'POST',
        body: { sdp, revision: capability.revision, consent: true } }),
      stop: sessionId => apiFetch(`${base}/sessions/${encodeURIComponent(sessionId)}/stop`, { ...requestOptions, method: 'POST', body: {} }),
      state: value => { if (current === generation.current) { busy.current = ['connecting', 'live', 'pending'].includes(value); setState(value); } },
      captions: guarded(setCaptions), speaking: guarded(setSpeaking),
      playbackBlocked: () => { if (current === generation.current) setPlaybackBlocked(true); },
    });
    transport.current = instance;
    void instance.start();
  };
  return (
    <section aria-label={ui.title} className="mx-3 my-2 rounded-2xl border border-border bg-card p-3 text-card-foreground">
      <div className="flex items-center gap-3">
        <img src={reducedMotion ? CHATBOC_AGENT_MARK : logoUrl || CHATBOC_AGENT_AVATAR} alt="" width={48} height={48}
          className={`h-12 w-12 rounded-xl object-contain ${speaking && !reducedMotion ? 'motion-safe:animate-pulse' : ''}`}
          onError={event => { const fallback = reducedMotion ? CHATBOC_AGENT_MARK : CHATBOC_AGENT_AVATAR; if (!event.currentTarget.src.includes(fallback)) event.currentTarget.src = fallback; }} />
        <div><h3 className="font-semibold">{ui.title}</h3><p className="text-sm">{ui.description}</p></div>
      </div>
      <p role="status" aria-live="polite" className="mt-2 text-sm">{ui[state]}</p>
      <p className="mt-1 text-xs">{ui.avatar_notice}</p>
      {!capability.enabled ? <p className="mt-2 text-sm">{ui.disabled}</p> : (
        <>
          {!active && <label className="my-3 flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consent} disabled={state === 'pending'} onChange={event => setConsent(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" />
            <span>{ui.consent}</span>
          </label>}
          <div className="mt-2 flex flex-wrap gap-2">
            {!active ? <button ref={startButton} type="button" disabled={!consent || state === 'pending'} onClick={start}
              className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-50">{ui.start}</button> : (
              <><button type="button" onClick={() => { void stop(); }} className="min-h-11 rounded-lg border px-4">{ui.stop}</button>
                <button type="button" aria-pressed={muted} onClick={() => { transport.current?.mute(!muted); setMuted(!muted); }}
                  className="min-h-11 rounded-lg border px-4">{muted ? ui.unmute : ui.mute}</button></>
            )}
            {active && <button type="button" onClick={() => { void stop(); }} className="min-h-11 rounded-lg border px-4">{ui.text}</button>}
            {playbackBlocked && active && <button type="button" onClick={() => { void audio.current?.play().then(() => setPlaybackBlocked(false), () => {}); }} className="min-h-11 rounded-lg border px-4">{ui.play}</button>}
          </div>
          <p className="mt-2 text-xs">{ui.limit_notice}</p>
          {captions.length > 0 && <div role="log" aria-live="polite" aria-label={ui.captions} className="mt-3 max-h-48 overflow-auto rounded-lg border p-2 text-base leading-relaxed">
            {captions.map(line => <p key={line.id} className="mb-2 whitespace-pre-wrap break-words"><strong>{ui[line.speaker]}: </strong>{line.text}</p>)}
          </div>}
        </>
      )}
      <audio ref={audio} />
    </section>
  );
}
