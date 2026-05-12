import { useEffect, useMemo, useState, type ComponentType } from "react";
import { BookOpen, Captions, Eye, List, MousePointer2, PauseCircle } from "lucide-react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatWidgetUiHints } from "@/types/chat";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type Prefs = {
  dyslexia: boolean;
  simplified: boolean;
  highContrast: boolean;
  largeControls: boolean;
  captions: boolean;
  reducedMotion: boolean;
};

const LS_KEY = "chatboc_accessibility";

export const DEFAULT_ACCESSIBILITY_PREFS: Prefs = {
  dyslexia: false,
  simplified: true,
  highContrast: false,
  largeControls: false,
  captions: false,
  reducedMotion: false,
};

export const readAccessibilityPrefs = (): Prefs => {
  try {
    const saved = JSON.parse(safeLocalStorage.getItem(LS_KEY) || "{}");
    return {
      ...DEFAULT_ACCESSIBILITY_PREFS,
      ...(saved && typeof saved === "object" ? saved : {}),
    };
  } catch {
    return DEFAULT_ACCESSIBILITY_PREFS;
  }
};

const options = [
  {
    key: "dyslexia",
    label: "Modo dislexia",
    description: "Mas aire, lectura izquierda y guia visual.",
    icon: BookOpen,
  },
  {
    key: "simplified",
    label: "Texto simple",
    description: "Mensajes mas cortos y faciles de escanear.",
    icon: List,
  },
  {
    key: "highContrast",
    label: "Alto contraste",
    description: "Bordes y foco mas visibles.",
    icon: Eye,
  },
  {
    key: "largeControls",
    label: "Controles grandes",
    description: "Botones tactiles mas comodos.",
    icon: MousePointer2,
  },
  {
    key: "captions",
    label: "Subtitulos",
    description: "Apoyo visual para audio y voz cuando este disponible.",
    icon: Captions,
  },
  {
    key: "reducedMotion",
    label: "Menos movimiento",
    description: "Reduce animaciones y transiciones del chat.",
    icon: PauseCircle,
  },
] satisfies Array<{
  key: keyof Prefs;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}>;

type AccessibilityHints = NonNullable<ChatWidgetUiHints["accessibility"]>;

const isHintAllowed = (
  hints: AccessibilityHints | null | undefined,
  keys: string[],
  fallback = true,
) => {
  if (!hints) return fallback;
  for (const key of keys) {
    const value = hints[key];
    if (typeof value === "boolean") return value;
  }
  return fallback;
};

export default function AccessibilityToggle({
  onChange,
  compact = false,
  className,
  hints,
}: {
  onChange?: (p: Prefs) => void;
  compact?: boolean;
  className?: string;
  hints?: ChatWidgetUiHints["accessibility"];
}) {
  const [prefs, setPrefs] = useState<Prefs>(readAccessibilityPrefs);

  const visibleOptions = useMemo(
    () =>
      options.filter((option) => {
        if (option.key === "dyslexia") {
          return isHintAllowed(hints, ["dyslexia", "dyslexia_mode", "dyslexia_friendly"]);
        }
        if (option.key === "simplified") {
          return isHintAllowed(hints, ["simple_text", "simplified_text", "simplified"]);
        }
        if (option.key === "highContrast") {
          return isHintAllowed(hints, ["high_contrast", "highContrast"]);
        }
        if (option.key === "largeControls") {
          return isHintAllowed(hints, ["large_controls", "largeControls"]);
        }
        if (option.key === "captions") {
          return isHintAllowed(hints, ["captions"]);
        }
        if (option.key === "reducedMotion") {
          return isHintAllowed(hints, ["reduced_motion", "reducedMotion"]);
        }
        return true;
      }),
    [hints],
  );

  useEffect(() => {
    safeLocalStorage.setItem(LS_KEY, JSON.stringify(prefs));
    onChange?.(prefs);
    const root = document.documentElement;
    root.classList.toggle("a11y-dyslexia", !!prefs.dyslexia);
    root.classList.toggle("a11y-simplified", !!prefs.simplified);
    root.classList.toggle("a11y-high-contrast", !!prefs.highContrast);
    root.classList.toggle("a11y-large-controls", !!prefs.largeControls);
    root.classList.toggle("a11y-captions", !!prefs.captions);
    root.classList.toggle("a11y-reduced-motion", !!prefs.reducedMotion);
  }, [prefs, onChange]);

  const activeCount = visibleOptions.reduce(
    (total, option) => total + Number(Boolean(prefs[option.key])),
    0,
  );

  if (visibleOptions.length === 0) return null;

  return (
    <TooltipProvider delayDuration={0}>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  "relative h-9 w-9 rounded-full border border-white/10 bg-white/10 text-white/90 backdrop-blur transition hover:bg-white/16 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-1 focus-visible:ring-offset-primary",
                  compact && "h-9 w-9",
                  activeCount > 0 && "bg-amber-100 text-amber-950 hover:bg-amber-100 hover:text-amber-950",
                  className,
                )}
                aria-label="Abrir ajustes de accesibilidad"
              >
                <BookOpen className="h-5 w-5" />
                {activeCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold leading-none text-white">
                    {activeCount}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">Accesibilidad</TooltipContent>
        </Tooltip>
        <PopoverContent align="end" side="bottom" className="z-[1000002] w-[min(320px,calc(100vw-24px))] rounded-2xl p-3">
          <div className="mb-3">
            <p className="text-sm font-semibold">Accesibilidad</p>
            <p className="text-xs text-muted-foreground">
              Ajustes rapidos para leer, escuchar y tocar mejor.
            </p>
          </div>
          <div className="space-y-2">
            {visibleOptions.map(({ key, label, description, icon: Icon }) => {
              const active = Boolean(prefs[key]);
              return (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                    active ? "border-primary/50 bg-primary/10" : "border-border bg-background hover:bg-muted/60",
                  )}
                  onClick={() => setPrefs((current) => ({ ...current, [key]: !current[key] }))}
                  aria-pressed={active}
                >
                  <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full border", active ? "border-primary/40 bg-primary text-primary-foreground" : "border-border bg-muted")}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block text-xs leading-5 text-muted-foreground">{description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
