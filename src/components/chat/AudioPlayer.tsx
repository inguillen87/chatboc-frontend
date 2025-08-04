// src/components/chat/AudioPlayer.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  className?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, className }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
      setIsLoading(false);
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);
    const onPlaying = () => setIsLoading(false);
    const onWaiting = () => setIsLoading(true);

    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('waiting', onWaiting);


    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
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
    } else {
      audio.play().catch(e => console.error("Error playing audio:", e));
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time === 0) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className={cn("flex items-center gap-2 w-full p-2 rounded-lg bg-muted/50 my-1.5", className)}>
      <audio ref={audioRef} src={src} preload="metadata"></audio>
      <Button onClick={togglePlayPause} variant="ghost" size="icon" className="w-8 h-8 flex-shrink-0" disabled={isLoading}>
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </Button>
      <div className="flex-grow h-4 flex items-center">
        <div className="w-full bg-background rounded-full h-1 relative">
            <div
            className="bg-primary h-1 rounded-full"
            style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
            ></div>
        </div>
      </div>
      <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
        {formatTime(duration)}
      </span>
    </div>
  );
};

export default AudioPlayer;
