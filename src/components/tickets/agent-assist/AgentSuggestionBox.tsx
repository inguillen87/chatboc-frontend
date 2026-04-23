import React from 'react';
import { Sparkles, Check, X, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CitationDrawer } from '@/components/chat/stream';
import { Citation } from '@/schemas/api';
import { motion, AnimatePresence } from 'framer-motion';

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
  if (!suggestion) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 mb-3"
      >
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-medium text-indigo-700">Sugerencia del copiloto</span>
        </div>

        <p className="text-sm text-foreground/90 mb-3 whitespace-pre-wrap">{suggestion}</p>

        {citations && citations.length > 0 && (
           <div className="mb-3">
             <CitationDrawer citations={citations} />
           </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-2">
          <Button variant="ghost" size="sm" className="h-7 text-muted-foreground hover:text-red-600 hover:bg-red-50" onClick={onReject}>
            <X className="w-3.5 h-3.5 mr-1.5" /> Descartar
          </Button>
          {onEdit && (
            <Button variant="outline" size="sm" className="h-7" onClick={() => onEdit(suggestion)}>
              <Edit3 className="w-3.5 h-3.5 mr-1.5" /> Editar
            </Button>
          )}
          <Button size="sm" className="h-7 bg-indigo-600 hover:bg-indigo-700" onClick={() => onAccept(suggestion)}>
            <Check className="w-3.5 h-3.5 mr-1.5" /> Aplicar sugerencia
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
