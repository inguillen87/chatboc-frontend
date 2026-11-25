import React from 'react';
import { Sparkles, Check, X, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CitationDrawer } from '@/components/chat/stream';
import { Citation } from '@/schemas/api';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface AgentSuggestionBoxProps {
  suggestion: string;
  citations?: Citation[];
  onAccept: (text: string) => void;
  onReject: () => void;
  onEdit?: (text: string) => void;
}

export const AgentSuggestionBox: React.FC<AgentSuggestionBoxProps> = ({
  suggestion, citations, onAccept, onReject, onEdit
}) => {
  const reduceMotion = Boolean(useReducedMotion());
  if (!suggestion) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
        transition={{ duration: reduceMotion ? 0 : 0.2 }}
        className="mb-3 w-full rounded-xl border border-primary/25 bg-primary/[0.06] p-3.5 shadow-sm"
      >
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-xs font-semibold text-foreground">Sugerencia del copiloto</span>
        </div>

        <p className="mb-3 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{suggestion}</p>

        {citations && citations.length > 0 && (
           <div className="mb-3">
             <CitationDrawer citations={citations} />
           </div>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={onReject}>
            <X className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Descartar
          </Button>
          {onEdit && (
            <Button variant="outline" size="sm" className="h-8" onClick={() => onEdit(suggestion)}>
              <Edit3 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Editar
            </Button>
          )}
          <Button size="sm" className="h-8 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onAccept(suggestion)}>
            <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Aplicar sugerencia
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
