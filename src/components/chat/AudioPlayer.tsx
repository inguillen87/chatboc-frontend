import React, { useState, useRef, useLayoutEffect } from 'react';
import { Play, Pause, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  className?: string;
  senderName?: string;
}

const SPEEDS = [1, 1.5, 2] as const;

type Owner = { src: string; generation: number };
type PlayerState = {
  generation: number;
  duration: number;
  currentTime: number;
  loading: boolean;
  playing: boolean;
  pending: boolean;
  retrying: boolean;
  waiting: boolean;
  error: 'load' | 'play' | null;
};
type Runtime = {
  owner: Owner;
  audio: HTMLAudioElement;
  active: boolean;
  sequence: number;
  ready: boolean;
  playing: boolean;
  pending: boolean;
  error: PlayerState['error'];
};
const initialState = (generation: number): PlayerState => ({
  generation, duration: 0, currentTime: 0, loading: true,
  playing: false, pending: false, retrying: false, waiting: false, error: null,
});
const finiteDuration = (value: number) => Number.isFinite(value) && value > 0 ? value : 0;
const boundedTime = (value: number, duration: number) => Number.isFinite(value)
  ? Math.max(0, Math.min(duration || 0, value)) : 0;
const formatTime = (value: number) => {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, className }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const ownerRef = useRef<Owner>({ src, generation: 0 });
  if (ownerRef.current.src !== src) {
    ownerRef.current = { src, generation: ownerRef.current.generation + 1 };
  }
  const runtimeRef = useRef<Runtime | null>(null);
  const [state, setState] = useState<PlayerState>(() => initialState(0));
  const [speedIndex, setSpeedIndex] = useState(0);
  const playbackSpeed = SPEEDS[speedIndex];
  const view = state.generation === ownerRef.current.generation
    ? state : initialState(ownerRef.current.generation);
  const isCurrent = (runtime: Runtime) => runtime.active
    && runtime.owner === ownerRef.current && audioRef.current === runtime.audio;
  const update = (runtime: Runtime, patch: Partial<PlayerState>) => {
    if (!isCurrent(runtime)) return;
    setState((previous) => isCurrent(runtime)
      ? { ...(previous.generation === runtime.owner.generation ? previous : initialState(runtime.owner.generation)), ...patch }
      : previous);
  };

  useLayoutEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const runtime: Runtime = {
      owner: ownerRef.current, audio, active: true, sequence: 0,
      ready: false, playing: false, pending: false, error: null,
    };
    runtimeRef.current = runtime;
    setState(initialState(runtime.owner.generation));
    const setAudioData = () => {
      if (!isCurrent(runtime)) return;
      runtime.ready = true;
      runtime.error = null;
      const duration = finiteDuration(audio.duration);
      update(runtime, { duration, currentTime: boundedTime(audio.currentTime, duration), loading: false, retrying: false, error: null });
    };
    const setAudioTime = () => update(runtime, {
      currentTime: boundedTime(audio.currentTime, finiteDuration(audio.duration)),
    });
    const onEnded = () => {
      if (!isCurrent(runtime)) return;
      runtime.sequence += 1;
      runtime.playing = false;
      runtime.pending = false;
      update(runtime, { playing: false, pending: false, waiting: false, currentTime: 0 });
    };
    const onPlaying = () => {
      if (!isCurrent(runtime) || (!runtime.pending && !runtime.playing)) return;
      runtime.playing = true;
      update(runtime, { playing: true, loading: false, waiting: false });
    };
    const onPause = () => {
      if (!isCurrent(runtime) || !audio.paused) return;
      runtime.sequence += 1;
      runtime.playing = false;
      runtime.pending = false;
      update(runtime, { playing: false, pending: false, waiting: false });
    };
    const onWaiting = () => update(runtime, { waiting: true });
    const onError = () => {
      if (!isCurrent(runtime)) return;
      runtime.sequence += 1;
      runtime.ready = false;
      runtime.playing = false;
      runtime.pending = false;
      runtime.error = 'load';
      try { audio.pause(); } catch { /* Best-effort local media cleanup. */ }
      update(runtime, { loading: false, retrying: false, playing: false, pending: false, waiting: false, error: 'load' });
    };
    const listeners = {
      loadeddata: setAudioData, loadedmetadata: setAudioData, canplay: setAudioData,
      durationchange: () => update(runtime, {
        duration: finiteDuration(audio.duration),
        currentTime: boundedTime(audio.currentTime, finiteDuration(audio.duration)),
      }), timeupdate: setAudioTime, ended: onEnded,
      playing: onPlaying, pause: onPause, waiting: onWaiting, error: onError,
    };
    for (const [event, listener] of Object.entries(listeners)) audio.addEventListener(event, listener);
    return () => {
      runtime.active = false;
      runtime.sequence += 1;
      for (const [event, listener] of Object.entries(listeners)) audio.removeEventListener(event, listener);
      try { audio.pause(); } catch { /* A retired element cannot update this player. */ }
      if (runtimeRef.current === runtime) runtimeRef.current = null;
    };
  }, [src]);

  const togglePlayPause = () => {
    const runtime = runtimeRef.current;
    if (!runtime || !isCurrent(runtime)) return;
    const audio = runtime.audio;
    if (runtime.playing || runtime.pending) {
      runtime.sequence += 1;
      runtime.playing = false;
      runtime.pending = false;
      try { audio.pause(); } catch { /* Keep the local pause action recoverable. */ }
      update(runtime, { playing: false, pending: false, waiting: false });
      return;
    }
    if (runtime.error === 'load') {
      runtime.sequence += 1;
      runtime.error = null;
      runtime.ready = false;
      update(runtime, { ...initialState(runtime.owner.generation), retrying: true });
      try { audio.load(); } catch {
        runtime.error = 'load';
        update(runtime, { loading: false, retrying: false, error: 'load' });
      }
      return;
    }
    if (runtime.pending || !runtime.ready) return;
    const sequence = ++runtime.sequence;
    runtime.pending = true;
    runtime.error = null;
    update(runtime, { pending: true, error: null });
    const settled = () => isCurrent(runtime) && runtime.sequence === sequence;
    const failed = () => {
      if (!settled()) return;
      runtime.pending = false;
      runtime.playing = false;
      runtime.error = 'play';
      update(runtime, { pending: false, playing: false, waiting: false, loading: false, error: 'play' });
    };
    try {
      audio.playbackRate = playbackSpeed;
      Promise.resolve(audio.play()).then(() => {
        if (!settled()) return;
        runtime.pending = false;
        runtime.playing = true;
        update(runtime, { pending: false, playing: true, loading: false, waiting: false });
      }, failed);
    } catch { failed(); }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(nextIdx);
    const newSpeed = SPEEDS[nextIdx];
    const runtime = runtimeRef.current;
    if (runtime && isCurrent(runtime)) runtime.audio.playbackRate = newSpeed;
  };

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const runtime = runtimeRef.current;
    if (!runtime || !isCurrent(runtime) || !runtime.ready || view.duration <= 0 || view.error) return;
    const value = Number(event.currentTarget.value);
    if (!Number.isFinite(value)) return;
    const currentTime = boundedTime(value, view.duration);
    try { runtime.audio.currentTime = currentTime; update(runtime, { currentTime }); } catch { /* Preserve the current position when the media cannot seek. */ }
  };

  // Generate 28 waveform bars
  const progressPercent = view.duration > 0 ? (view.currentTime / view.duration) * 100 : 0;
  const barHeights = [
    30, 45, 70, 90, 60, 40, 80, 100, 75, 50, 65, 85, 95, 70, 50, 40, 65, 90, 100, 80, 55, 45, 70, 85, 60, 40, 50, 35
  ];

  return (
    <div
      className={cn(
        'group flex items-center gap-3 w-full max-w-sm p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 shadow-sm transition-all hover:bg-emerald-500/15',
        className
      )}
    >
      <audio key={ownerRef.current.generation} ref={audioRef} src={src} preload="metadata" />

      {/* Play / Pause button */}
      <Button
        onClick={togglePlayPause}
        variant="default"
        size="icon"
        className="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-md transition-transform active:scale-95"
        disabled={view.loading && !view.playing && !view.pending && !view.retrying}
        aria-disabled={view.retrying}
        aria-label={view.playing || view.pending ? 'Pausar audio de voz' : view.error === 'load' || view.retrying ? 'Volver a cargar audio' : 'Reproducir audio de voz'}
      >
        {view.playing || view.pending ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
      </Button>

      {/* Waveform and Progress */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
        <div
          className="relative h-8 flex items-center gap-[2.5px] py-1 select-none rounded focus-within:ring-2 focus-within:ring-emerald-600 dark:focus-within:ring-emerald-300 focus-within:ring-offset-2"
        >
          {barHeights.map((h, i) => {
            const barPercent = (i / barHeights.length) * 100;
            const isFilled = barPercent <= progressPercent;
            return (
              <div
                key={i}
                aria-hidden="true"
                className={cn(
                  'flex-1 rounded-full transition-colors duration-150',
                  isFilled ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-muted-foreground/30'
                )}
                style={{ height: `${h}%`, minHeight: '3px' }}
              />
            );
          })}
          <input
            type="range"
            aria-label="Posición del audio"
            aria-valuetext={`${formatTime(view.currentTime)} de ${formatTime(view.duration)}`}
            min={0}
            max={view.duration || 0}
            step={0.1}
            value={view.currentTime}
            disabled={view.duration <= 0 || view.loading || Boolean(view.error)}
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
          />
        </div>

        {/* Time and sender info */}
        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span className="tabular-nums">
            {view.playing ? formatTime(view.currentTime) : formatTime(view.duration)}
          </span>

          <div className="flex items-center gap-1.5">
            <Mic className="w-3 h-3 text-emerald-600" />
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">Nota de Voz</span>
          </div>
        </div>
        {view.error ? (
          <p role="alert" className="text-xs text-destructive">
            {view.error === 'load' ? 'No se pudo cargar el audio. Podés volver a cargarlo.' : 'No se pudo reproducir el audio. Podés volver a intentarlo.'}
          </p>
        ) : (view.pending || view.waiting) ? (
          <p role="status" className="text-xs text-muted-foreground">
            {view.waiting ? 'Esperando el audio. Podés pausarlo.' : 'Preparando el audio…'}
          </p>
        ) : null}
      </div>

      {/* Playback speed toggle */}
      <button
        type="button"
        onClick={cycleSpeed}
        className="min-h-11 min-w-11 px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-extrabold transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 dark:focus-visible:ring-emerald-300"
        title="Cambiar velocidad de reproducción"
        aria-label={`Velocidad de reproducción: ${playbackSpeed} veces. Cambiar velocidad.`}
      >
        {playbackSpeed}x
      </button>
    </div>
  );
};

export default AudioPlayer;
