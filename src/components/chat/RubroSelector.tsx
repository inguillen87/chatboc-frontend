import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';
import { Rubro, TenantDemoSummary } from '@/types/rubro';

interface RubroSelectorProps {
  rubros: Rubro[];
  onSelect: (rubro: Rubro) => void;
}

const getRubroLabel = (rubro: Rubro | any) =>
  String(
    rubro?.demo?.nombre ||
      rubro?.nombre ||
      rubro?.label ||
      rubro?.title ||
      rubro?.name ||
      rubro?.key ||
      rubro?.slug ||
      '',
  ).trim();

const getRubroDescription = (rubro: Rubro | any) =>
  String(rubro?.demo?.descripcion || rubro?.descripcion || rubro?.description || rubro?.subtitle || '').trim();

const getRubroDemoPreview = (rubro: Rubro | any): TenantDemoSummary['widget_preview'] | undefined =>
  rubro?.demo?.widget_preview || rubro?.widget_preview || rubro?.preview || undefined;

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

  const getPreviewStyle = (preview?: TenantDemoSummary['widget_preview']) => {
    const start = preview?.gradient_start;
    const end = preview?.gradient_end;
    if (!start || !end) return undefined;
    return {
      background: `linear-gradient(135deg, color-mix(in oklab, ${start} 12%, transparent), color-mix(in oklab, ${end} 12%, transparent))`,
    } as React.CSSProperties;
  };

  // Deduplicate and merge rubros based on Name to handle backend fragmentation
  const uniqueRubros = useMemo(() => {
    const mergedMap = new Map<string, Rubro>();

    rubros.forEach((r, index) => {
        const label = getRubroLabel(r);
        if (!label) return;
        const key = String((r as any).id ?? (r as any).key ?? (r as any).slug ?? label ?? index).trim().toLowerCase();
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
            key={String((root as any).id ?? (root as any).key ?? (root as any).slug ?? getRubroLabel(root))}
            value={String((root as any).id ?? (root as any).key ?? (root as any).slug ?? getRubroLabel(root))}
            className="border border-primary/20 bg-gradient-to-r from-primary/[0.06] via-background to-secondary/10 rounded-xl px-2 shadow-sm backdrop-blur"
          >
            <AccordionTrigger className="capitalize text-base font-semibold py-3 hover:no-underline px-1 transition-colors hover:text-primary">
                {getRubroLabel(root)}
            </AccordionTrigger>
            <AccordionContent className="pb-3 pt-1">
              {/* Level 1: Subcategories */}
              {Array.isArray(root.subrubros) && root.subrubros.length > 0 ? (
                <div className="space-y-4">
                  {(root.demo || getRubroDescription(root)) ? (
                    <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        variant="secondary"
                        className={`w-full justify-between h-auto py-2 px-3 bg-background/80 border text-left whitespace-normal rounded-lg shadow-sm hover:shadow-md transition-all ${getPreviewClass(getRubroDemoPreview(root)?.preset)}`}
                        style={getPreviewStyle(getRubroDemoPreview(root))}
                        onClick={() => onSelect(root)}
                        data-widget-preset={getRubroDemoPreview(root)?.preset}
                        data-motion-level={getRubroDemoPreview(root)?.motion_level}
                        data-gradient-start={getRubroDemoPreview(root)?.gradient_start}
                        data-gradient-end={getRubroDemoPreview(root)?.gradient_end}
                      >
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="font-medium text-sm">{getRubroLabel(root)}</span>
                          {getRubroDescription(root) && (
                            <span className="text-[10px] text-muted-foreground line-clamp-1 font-normal">
                              {getRubroDescription(root)}
                            </span>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                      </Button>
                    </motion.div>
                  ) : null}
                  {root.subrubros.map((level1) => (
                    <div key={level1.id} className="space-y-2">
                        {/* Only show header if it has children (Level 2 items) */}
                        {level1.subrubros && level1.subrubros.length > 0 ? (
                            <>
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1 border-b pb-1 mb-2">
                                    {getRubroLabel(level1)}
                                </h4>
                                <div className="grid grid-cols-1 gap-2">
                                    {level1.subrubros.map((level2) => (
                                        (level2.demo || getRubroDescription(level2)) ? (
                                            <motion.div key={(level2 as any).id ?? (level2 as any).key ?? (level2 as any).slug ?? getRubroLabel(level2)} whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
                                                <Button
                                                    variant="secondary"
                                                    className={`w-full justify-between h-auto py-2 px-3 bg-background/80 border text-left whitespace-normal rounded-lg shadow-sm hover:shadow-md transition-all ${getPreviewClass(getRubroDemoPreview(level2)?.preset)}`}
                                                    style={getPreviewStyle(getRubroDemoPreview(level2))}
                                                    onClick={() => onSelect(level2)}
                                                    data-widget-preset={getRubroDemoPreview(level2)?.preset}
                                                    data-motion-level={getRubroDemoPreview(level2)?.motion_level}
                                                    data-gradient-start={getRubroDemoPreview(level2)?.gradient_start}
                                                    data-gradient-end={getRubroDemoPreview(level2)?.gradient_end}
                                                >
                                                    <div className="flex flex-col items-start gap-0.5">
                                                        <span className="font-medium text-sm">{getRubroLabel(level2)}</span>
                                                        {getRubroDescription(level2) && (
                                                            <span className="text-[10px] text-muted-foreground line-clamp-1 font-normal">
                                                                {getRubroDescription(level2)}
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
                        ) : (level1.demo || getRubroLabel(level1)) ? (
                            // Direct Level 1 Item (no subcategories, just a demo itself)
                            <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
                                <Button
                                    variant="secondary"
                                    className={`w-full justify-between h-auto py-2 px-3 bg-background/80 border text-left whitespace-normal rounded-lg shadow-sm hover:shadow-md transition-all ${getPreviewClass(getRubroDemoPreview(level1)?.preset)}`}
                                    style={getPreviewStyle(getRubroDemoPreview(level1))}
                                    onClick={() => onSelect(level1)}
                                    data-widget-preset={getRubroDemoPreview(level1)?.preset}
                                    data-motion-level={getRubroDemoPreview(level1)?.motion_level}
                                    data-gradient-start={getRubroDemoPreview(level1)?.gradient_start}
                                    data-gradient-end={getRubroDemoPreview(level1)?.gradient_end}
                                >
                                    <div className="flex flex-col items-start gap-0.5">
                                        <span className="font-medium text-sm">{getRubroLabel(level1)}</span>
                                        {getRubroDescription(level1) && (
                                            <span className="text-[10px] text-muted-foreground line-clamp-1 font-normal">
                                                {getRubroDescription(level1)}
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
                (root.demo || getRubroLabel(root)) ? (
                  <motion.div whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }}>
                    <Button
                      variant="secondary"
                      className={`w-full justify-between h-auto py-2 px-3 bg-background/80 border text-left whitespace-normal rounded-lg shadow-sm hover:shadow-md transition-all ${getPreviewClass(getRubroDemoPreview(root)?.preset)}`}
                      style={getPreviewStyle(getRubroDemoPreview(root))}
                      onClick={() => onSelect(root)}
                      data-widget-preset={getRubroDemoPreview(root)?.preset}
                      data-motion-level={getRubroDemoPreview(root)?.motion_level}
                      data-gradient-start={getRubroDemoPreview(root)?.gradient_start}
                      data-gradient-end={getRubroDemoPreview(root)?.gradient_end}
                    >
                      <div className="flex flex-col items-start gap-0.5">
                        <span className="font-medium text-sm">{getRubroLabel(root)}</span>
                        {getRubroDescription(root) && (
                          <span className="text-[10px] text-muted-foreground line-clamp-1 font-normal">
                            {getRubroDescription(root)}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                    </Button>
                  </motion.div>
                ) : (
                  <div className="text-sm text-muted-foreground p-2">
                    No hay opciones disponibles.
                  </div>
                )
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
};

export default RubroSelector;
