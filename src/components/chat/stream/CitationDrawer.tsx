import React, { useState } from 'react';
import { Citation } from '@/schemas/api';
import { BookOpen, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

interface CitationDrawerProps {
  citations: Citation[];
}

export const CitationDrawer: React.FC<CitationDrawerProps> = ({ citations }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!citations || citations.length === 0) return null;

  return (
    <div className="w-full">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground mb-1 w-full justify-start"
        onClick={() => setIsOpen(!isOpen)}
      >
        <BookOpen className="w-3.5 h-3.5 mr-2" />
        Fuentes utilizadas ({citations.length})
        {isOpen ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
      </Button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 p-2 bg-muted/30 rounded-md border text-xs">
              {citations.map((cit, idx) => {
                const isInternal = !cit.url || cit.url.startsWith('/');
                return (
                  <div key={cit.id || idx} className="p-2 bg-background rounded border shadow-sm flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-primary truncate" title={cit.source || 'Fuente del sistema'}>
                        {cit.source || 'Fuente del sistema'}
                      </span>
                      <div className="flex gap-1 items-center shrink-0">
                        {cit.score && <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-normal">{(cit.score * 100).toFixed(0)}% ref</Badge>}
                        {isInternal ? (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Interno</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-blue-50 text-blue-700 border-blue-200">Web</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-muted-foreground line-clamp-3 leading-relaxed">
                      "{cit.content}"
                    </p>
                    {cit.url && (
                      <a href={cit.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-[10px] font-medium text-blue-600 hover:underline mt-1 w-max">
                        Abrir documento original <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
