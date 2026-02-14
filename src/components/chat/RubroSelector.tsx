import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { Rubro } from '@/types/rubro';

interface RubroSelectorProps {
  rubros: Rubro[];
  onSelect: (rubro: Rubro) => void;
}

const RubroSelector: React.FC<RubroSelectorProps> = ({ rubros, onSelect }) => {
  const getPreviewClass = (preset?: string) => {
    if (!preset) return 'border-primary/10 hover:border-primary/30 hover:bg-primary/10';
    const normalized = preset.toLowerCase();
    if (normalized.includes('civic')) {
      return 'border-sky-300/40 hover:border-sky-400/60 hover:bg-sky-500/10';
    }
    if (normalized.includes('commerce') || normalized.includes('neon')) {
      return 'border-fuchsia-300/40 hover:border-fuchsia-400/60 hover:bg-fuchsia-500/10';
    }
    return 'border-primary/10 hover:border-primary/30 hover:bg-primary/10';
  };

  // Deduplicate and merge rubros based on Name to handle backend fragmentation
  const uniqueRubros = useMemo(() => {
    const mergedMap = new Map<string, Rubro>();

    rubros.forEach(r => {
        const key = r.nombre.trim().toLowerCase();
        if (mergedMap.has(key)) {
            // Merge subrubros if existing
            const existing = mergedMap.get(key)!;
            const newSubs = r.subrubros || [];
            const existingSubs = existing.subrubros || [];

            // Simple merge of subrubros
            existing.subrubros = [...existingSubs, ...newSubs];
        } else {
            mergedMap.set(key, { ...r });
        }
    });

    return Array.from(mergedMap.values());
  }, [rubros]);

  return (
    <div className="h-full min-h-0 overflow-y-auto pr-1">
      <Accordion type="single" collapsible className="w-full space-y-2">
        {uniqueRubros.map((root) => (
          <AccordionItem
            key={root.id}
            value={String(root.id)}
            className="border border-primary/20 bg-gradient-to-r from-primary/[0.06] via-background to-secondary/10 rounded-xl px-2 shadow-sm backdrop-blur"
          >
            <AccordionTrigger className="capitalize text-base font-semibold py-3 hover:no-underline px-1 transition-colors hover:text-primary">
                {root.nombre}
            </AccordionTrigger>
            <AccordionContent className="pb-3 pt-1">
              {/* Level 1: Subcategories */}
              {Array.isArray(root.subrubros) && root.subrubros.length > 0 ? (
                <div className="space-y-4">
                  {root.subrubros.map((level1) => (
                    <div key={level1.id} className="space-y-2">
                        {/* Only show header if it has children (Level 2 items) */}
                        {level1.subrubros && level1.subrubros.length > 0 ? (
                            <>
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 border-b pb-1 mb-2">
                                    {level1.nombre}
                                </h4>
                                <div className="grid grid-cols-1 gap-2">
                                    {level1.subrubros.map((level2) => (
                                        level2.demo ? (
                                            <motion.div key={level2.id} whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
                                                <Button
                                                    variant="secondary"
                                                    className={`w-full justify-between h-auto py-2 px-3 bg-background/80 border text-left whitespace-normal rounded-lg shadow-sm hover:shadow-md transition-all ${getPreviewClass(level2.demo.widget_preview?.preset)}`}
                                                    onClick={() => onSelect(level2)}
                                                    data-widget-preset={level2.demo.widget_preview?.preset}
                                                    data-motion-level={level2.demo.widget_preview?.motion_level}
                                                    data-gradient-start={level2.demo.widget_preview?.gradient_start}
                                                    data-gradient-end={level2.demo.widget_preview?.gradient_end}
                                                >
                                                    <div className="flex flex-col items-start gap-0.5">
                                                        <span className="font-medium text-sm">{level2.demo.nombre || level2.nombre}</span>
                                                        {level2.demo.descripcion && (
                                                            <span className="text-[10px] text-muted-foreground line-clamp-1 font-normal">
                                                                {level2.demo.descripcion}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                                                </Button>
                                            </motion.div>
                                        ) : null
                                    ))}
                                </div>
                            </>
                        ) : level1.demo ? (
                            // Direct Level 1 Item (no subcategories, just a demo itself)
                            <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
                                <Button
                                    variant="secondary"
                                    className={`w-full justify-between h-auto py-2 px-3 bg-background/80 border text-left whitespace-normal rounded-lg shadow-sm hover:shadow-md transition-all ${getPreviewClass(level1.demo.widget_preview?.preset)}`}
                                    onClick={() => onSelect(level1)}
                                    data-widget-preset={level1.demo.widget_preview?.preset}
                                    data-motion-level={level1.demo.widget_preview?.motion_level}
                                    data-gradient-start={level1.demo.widget_preview?.gradient_start}
                                    data-gradient-end={level1.demo.widget_preview?.gradient_end}
                                >
                                    <div className="flex flex-col items-start gap-0.5">
                                        <span className="font-medium text-sm">{level1.demo.nombre || level1.nombre}</span>
                                        {level1.demo.descripcion && (
                                            <span className="text-[10px] text-muted-foreground line-clamp-1 font-normal">
                                                {level1.demo.descripcion}
                                            </span>
                                        )}
                                    </div>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                                </Button>
                            </motion.div>
                        ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                // Fallback for roots without subcategories (direct items?)
                <div className="text-sm text-muted-foreground p-2">
                    No hay opciones disponibles.
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default RubroSelector;
