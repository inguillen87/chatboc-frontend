import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { List, ChevronRight, Sparkles } from "lucide-react";
import { MenuSection, InteractiveListConfig } from "@/types/chat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { filterLegacyDemoSelectorSections } from "@/utils/legacyDemoSelector";

interface InteractiveMenuProps {
  sections?: MenuSection[];
  config?: InteractiveListConfig;
  isDemoSelector?: boolean;
  onSelect: (item: { id: string; title: string }) => void;
}

const InteractiveMenu: React.FC<InteractiveMenuProps> = ({ sections, config, isDemoSelector = false, onSelect }) => {
  const [open, setOpen] = React.useState(false);

  // Normalize input: use config sections if available, otherwise explicit sections prop
  const activeSections = filterLegacyDemoSelectorSections(config?.sections || sections || []);
  const buttonLabel = config?.buttonLabel || "Elegir experiencia";
  const title = config?.title || "Seleccionar una opción";

  if (activeSections.length === 0) return null;

  const handleSelect = (item: { id?: string; title?: string }) => {
      const title = item.title || item.id || 'opcion';
      onSelect({ id: item.id || title, title });
      setOpen(false);
  };

  return (
    <div className="my-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            className={`w-full justify-between group transition-all ${isDemoSelector ? 'border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 shadow-sm' : 'border-primary/20 hover:bg-primary/5 hover:border-primary/50'}`}
          >
            <span className="flex items-center gap-2">
                {isDemoSelector ? <Sparkles className="w-4 h-4 text-primary" /> : <List className="w-4 h-4 text-primary" />}
                {buttonLabel}
            </span>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh] rounded-t-[20px] p-0 flex flex-col">
            <SheetHeader className="p-6 pb-2 border-b">
                <SheetTitle className="text-xl font-bold flex items-center gap-2">
                    {title}
                </SheetTitle>
                <SheetDescription>
                    {isDemoSelector ? 'Elegí la demo que querés explorar' : 'Selecciona una opción de la lista'}
                </SheetDescription>
            </SheetHeader>
            <ScrollArea className="flex-1 p-6 pt-2">
                <div className="space-y-6 pb-8">
                    {activeSections.map((section, idx) => (
                        <div key={idx} className="space-y-3">
                            {section.title && (
                                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider pl-1 flex items-center gap-2">
                                    {section.title}
                                </h4>
                            )}
                            <div className={`grid gap-3 ${isDemoSelector ? 'sm:grid-cols-2' : ''}`}>
                                {section.rows.map((row) => (
                                    <button
                                        key={row.id}
                                        onClick={() => handleSelect(row)}
                                        className={`flex flex-col items-start w-full rounded-xl border text-left transition-all active:scale-[0.99] ${isDemoSelector ? 'p-4 bg-gradient-to-br from-background via-background to-primary/[0.04] hover:border-primary/40 hover:bg-primary/[0.06] shadow-sm min-h-[108px]' : 'p-3 bg-card hover:bg-accent hover:border-primary/30'}`}
                                    >
                                        <div className="font-semibold text-base">{row.title}</div>
                                        {row.description && (
                                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{row.description}</div>
                                        )}
                                        {isDemoSelector ? (
                                          <div className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                                            Explorar demo
                                            <ChevronRight className="h-3.5 w-3.5" />
                                          </div>
                                        ) : null}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default InteractiveMenu;
