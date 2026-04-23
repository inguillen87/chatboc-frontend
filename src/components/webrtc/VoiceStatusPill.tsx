import React from 'react';
import { Mic, MicOff, Loader2, AlertCircle, PhoneCall } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type VoiceState = 'idle' | 'requesting_permission' | 'connecting' | 'listening' | 'speaking' | 'reconnecting' | 'handoff' | 'ended' | 'failed';

interface VoiceStatusPillProps {
  status: VoiceState;
}

export const VoiceStatusPill: React.FC<VoiceStatusPillProps> = ({ status }) => {
  if (status === 'idle') return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border shadow-sm backdrop-blur-sm"
      >
        {status === 'requesting_permission' && (
          <><Mic className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> Solicitando micrófono...</>
        )}

        {(status === 'connecting' || status === 'reconnecting') && (
          <><Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" /> Conectando voz...</>
        )}

        {status === 'listening' && (
          <><Mic className="w-3.5 h-3.5 text-green-500" /> Escuchando...</>
        )}

        {status === 'speaking' && (
          <><div className="flex items-center gap-0.5 w-3.5 h-3.5">
             <motion.span animate={{ height: ['4px', '12px', '4px'] }} transition={{ repeat: Infinity, duration: 0.5 }} className="w-1 bg-purple-500 rounded-full" />
             <motion.span animate={{ height: ['8px', '4px', '8px'] }} transition={{ repeat: Infinity, duration: 0.4 }} className="w-1 bg-purple-500 rounded-full" />
             <motion.span animate={{ height: ['4px', '10px', '4px'] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1 bg-purple-500 rounded-full" />
          </div> Asistente hablando...</>
        )}

        {status === 'handoff' && (
          <><PhoneCall className="w-3.5 h-3.5 text-orange-500 animate-pulse" /> Transfiriendo a humano...</>
        )}

        {status === 'failed' && (
          <><AlertCircle className="w-3.5 h-3.5 text-red-500" /> Falla de conexión. Usa texto.</>
        )}

        {status === 'ended' && (
          <><MicOff className="w-3.5 h-3.5 text-muted-foreground" /> Llamada finalizada</>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
