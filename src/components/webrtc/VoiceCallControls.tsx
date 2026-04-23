import React from 'react';
import { Mic, PhoneOff, Hand } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VoiceState } from './VoiceStatusPill';

interface VoiceCallControlsProps {
  status: VoiceState;
  onStart: () => void;
  onStop: () => void;
  onInterrupt?: () => void;
}

export const VoiceCallControls: React.FC<VoiceCallControlsProps> = ({ status, onStart, onStop, onInterrupt }) => {
  const isCallActive = ['connecting', 'listening', 'speaking', 'reconnecting', 'requesting_permission'].includes(status);

  if (!isCallActive) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="rounded-full w-10 h-10 border-primary/20 text-primary hover:bg-primary/10 transition-colors"
        onClick={onStart}
        title="Iniciar llamada de voz"
      >
        <Mic className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {status === 'speaking' && onInterrupt && (
        <Button
          variant="secondary"
          size="sm"
          className="rounded-full h-10 px-3 bg-muted/80 text-muted-foreground hover:bg-muted"
          onClick={onInterrupt}
        >
          <Hand className="w-4 h-4 mr-1.5" /> Interrumpir
        </Button>
      )}
      <Button
        variant="destructive"
        size="icon"
        className="rounded-full w-10 h-10 shadow-sm"
        onClick={onStop}
        title="Finalizar llamada"
      >
        <PhoneOff className="w-4 h-4" />
      </Button>
    </div>
  );
};
