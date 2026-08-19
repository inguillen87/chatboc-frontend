import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  className?: string;
  senderName?: string;
}

const SPEEDS = [1, 1.5, 2] as const;

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, className, senderName }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [speedIndex, setSpeedIndex] = useState(0);

  const playbackSpeed = SPEEDS[speedIndex];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration || 0);
      setCurrentTime(audio.currentTime || 0);
      setIsLoading(false);
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onPlaying = () => setIsLoading(false);
    const onWaiting = () => setIsLoading(true);

    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('waiting', onWaiting);

    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('waiting', onWaiting);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || isLoading) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.playbackRate = playbackSpeed;
      audio.play().then(() => setIsPlaying(true)).catch((e) => console.error('Error playing audio:', e));
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextIdx = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(nextIdx);
    const newSpeed = SPEEDS[nextIdx];
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pos * duration;
    setCurrentTime(pos * duration);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time === 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Generate 28 waveform bars
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
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
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play / Pause button */}
      <Button
        onClick={togglePlayPause}
        variant="default"
        size="icon"
        className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-md transition-transform active:scale-95"
        disabled={isLoading}
        aria-label={isPlaying ? 'Pausar audio de voz' : 'Reproducir audio de voz'}
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
      </Button>

      {/* Waveform and Progress */}
      <div className="flex-1 flex flex-col justify-center gap-1.5 min-w-0">
        <div
          onClick={handleSeek}
          className="relative h-6 flex items-center gap-[2.5px] cursor-pointer py-1 select-none"
          title="Click para adelantar o retroceder"
        >
          {barHeights.map((h, i) => {
            const barPercent = (i / barHeights.length) * 100;
            const isFilled = barPercent <= progressPercent;
            return (
              <div
                key={i}
                className={cn(
                  'flex-1 rounded-full transition-colors duration-150',
                  isFilled ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-muted-foreground/30'
                )}
                style={{ height: `${h}%`, minHeight: '3px' }}
              />
            );
          })}
        </div>

        {/* Time and sender info */}
        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span className="tabular-nums">
            {isPlaying ? formatTime(currentTime) : formatTime(duration || 0)}
          </span>

          <div className="flex items-center gap-1.5">
            <Mic className="w-3 h-3 text-emerald-600" />
            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">Nota de Voz</span>
          </div>
        </div>
      </div>

      {/* Playback speed toggle */}
      <button
        type="button"
        onClick={cycleSpeed}
        className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-[11px] font-extrabold transition-colors shrink-0"
        title="Cambiar velocidad de reproducción"
      >
        {playbackSpeed}x
      </button>
    </div>
  );
};

export default AudioPlayer;
