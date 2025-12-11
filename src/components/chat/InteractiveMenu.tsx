import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { List, ChevronRight, Info } from "lucide-react";
import { MenuSection, InteractiveListConfig, Boton } from "@/types/chat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface InteractiveMenuProps {
  sections?: MenuSection[];
  config?: InteractiveListConfig;
  onSelect: (item: { id: string; title: string }) => void;
}

const InteractiveMenu: React.FC<InteractiveMenuProps> = ({ sections, config, onSelect }) => {
  const [open, setOpen] = React.useState(false);

  // Normalize input: use config sections if available, otherwise explicit sections prop
  const activeSections = config?.sections || sections || [];
  const buttonLabel = config?.buttonLabel || "Ver Opciones";
  const title = config?.title || "Seleccionar una opción";

  if (activeSections.length === 0) return null;

  const handleSelect = (item: { id: string; title: string }) => {
      onSelect(item);
      setOpen(false);
  };

  return (
    <div className="my-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="w-full justify-between group border-primary/20 hover:bg-primary/5 hover:border-primary/50 transition-all">
            <span className="flex items-center gap-2">
                <List className="w-4 h-4 text-primary" />
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
                    Selecciona una opción de la lista
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
                            <div className="grid gap-2">
                                {section.rows.map((row) => (
                                    <button
                                        key={row.id}
                                        onClick={() => handleSelect(row)}
                                        className="flex flex-col items-start w-full p-3 rounded-xl border bg-card hover:bg-accent hover:border-primary/30 text-left transition-all active:scale-[0.99]"
                                    >
                                        <div className="font-semibold text-base">{row.title}</div>
                                        {row.description && (
                                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{row.description}</div>
                                        )}
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
