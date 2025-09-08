import { useEffect, useState } from "react";
import { BookOpen, List } from "lucide-react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type Prefs = {
  dyslexia: boolean;
  simplified: boolean;
};

const LS_KEY = "chatboc_accessibility";

export default function AccessibilityToggle({
  onChange,
}: {
  onChange?: (p: Prefs) => void;
}) {
  const [prefs, setPrefs] = useState<Prefs>(() => {
    try {
      return (
        JSON.parse(safeLocalStorage.getItem(LS_KEY) || "") || {
          dyslexia: false,
          simplified: true,
        }
      );
    } catch {
      return { dyslexia: false, simplified: true };
    }
  });

  useEffect(() => {
    safeLocalStorage.setItem(LS_KEY, JSON.stringify(prefs));
    onChange?.(prefs);
    const root = document.documentElement;
    root.classList.toggle("a11y-dyslexia", !!prefs.dyslexia);
    root.classList.toggle("a11y-simplified", !!prefs.simplified);
  }, [prefs, onChange]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-8 w-8",
                prefs.dyslexia && "bg-amber-100 text-amber-900"
              )}
              onClick={() => setPrefs((p) => ({ ...p, dyslexia: !p.dyslexia }))}
              aria-pressed={prefs.dyslexia}
              aria-label="Modo dislexia"
            >
              <BookOpen className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Modo dislexia</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-8 w-8",
                prefs.simplified && "bg-amber-100 text-amber-900"
              )}
              onClick={() =>
                setPrefs((p) => ({ ...p, simplified: !p.simplified }))
              }
              aria-pressed={prefs.simplified}
              aria-label="Texto simplificado"
            >
              <List className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Texto simplificado</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

