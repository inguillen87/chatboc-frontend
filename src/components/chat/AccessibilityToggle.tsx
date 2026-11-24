import { useEffect, useId, useMemo, useState, type ComponentType } from "react";
import { Accessibility, BookOpen, Captions, Eye, List, MousePointer2, PauseCircle } from "lucide-react";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { ensureOptionalFonts } from "@/utils/optionalFonts";
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
export const ACCESSIBILITY_EVENT = "chatboc:a11y-change";
// Distinguish an explicit choice from hydration and cross-editor broadcasts.
export const ACCESSIBILITY_INTENT_EVENT = "chatboc:a11y-user-intent";
export type AccessibilityPreferenceIntent = { key: keyof Prefs; value: boolean };

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

export const applyAccessibilityPrefs = (prefs: Prefs) => {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("a11y-dyslexia", !!prefs.dyslexia);
  // The spaced-reading typeface is requested when that mode is on, not on every page.
  if (prefs.dyslexia) ensureOptionalFonts("Lexend");
  root.classList.toggle("a11y-simplified", !!prefs.simplified);
  root.classList.toggle("a11y-high-contrast", !!prefs.highContrast);
  root.classList.toggle("a11y-large-controls", !!prefs.largeControls);
  root.classList.toggle("a11y-captions", !!prefs.captions);
  root.classList.toggle("a11y-reduced-motion", !!prefs.reducedMotion);
};

export const persistAccessibilityPrefs = (prefs: Prefs) => {
  safeLocalStorage.setItem(LS_KEY, JSON.stringify(prefs));
  applyAccessibilityPrefs(prefs);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ACCESSIBILITY_EVENT, { detail: prefs }));
  }
};

const arePrefsEqual = (a: Prefs, b: Prefs) =>
  a.dyslexia === b.dyslexia &&
  a.simplified === b.simplified &&
  a.highContrast === b.highContrast &&
  a.largeControls === b.largeControls &&
  a.captions === b.captions &&
  a.reducedMotion === b.reducedMotion;

const options = [
  {
    key: "dyslexia",
    label: "Lectura espaciada",
    description: "Más aire, lectura alineada a la izquierda y guía visual.",
    icon: BookOpen,
  },
  {
    key: "simplified",
    label: "Texto simple",
    description: "Mensajes más cortos y fáciles de recorrer.",
    icon: List,
  },
  {
    key: "highContrast",
    label: "Alto contraste",
    description: "Bordes y foco más visibles.",
    icon: Eye,
  },
  {
    key: "largeControls",
    label: "Controles grandes",
    description: "Botones táctiles más cómodos.",
    icon: MousePointer2,
  },
  {
    key: "captions",
    label: "Subtítulos",
    description: "Apoyo visual para audio y voz cuando esté disponible.",
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
  variant = "default",
}: {
  onChange?: (p: Prefs) => void;
  compact?: boolean;
  className?: string;
  hints?: ChatWidgetUiHints["accessibility"];
  variant?: "default" | "header";
}) {
  const [prefs, setPrefs] = useState<Prefs>(readAccessibilityPrefs);
  const panelTitleId = useId();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncPrefs = (event: Event) => {
      const detail = (event as CustomEvent<Prefs>).detail;
      if (!detail) return;
      setPrefs((current) => (arePrefsEqual(current, detail) ? current : detail));
    };
    window.addEventListener(ACCESSIBILITY_EVENT, syncPrefs as EventListener);
    return () => window.removeEventListener(ACCESSIBILITY_EVENT, syncPrefs as EventListener);
  }, []);

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
    persistAccessibilityPrefs(prefs);
    onChange?.(prefs);
  }, [prefs, onChange]);

  const customActiveCount = visibleOptions.reduce(
    (total, option) =>
      total + Number(Boolean(prefs[option.key]) && !DEFAULT_ACCESSIBILITY_PREFS[option.key]),
    0,
  );
  const isHeaderVariant = variant === "header";
  const countDescription =
    customActiveCount === 1
      ? "1 ajuste de accesibilidad activo"
      : `${customActiveCount} ajustes de accesibilidad activos`;
  const triggerAriaLabel =
    isHeaderVariant && customActiveCount > 0
      ? `Abrir ajustes de accesibilidad (${countDescription})`
      : "Abrir ajustes de accesibilidad";

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
                  isHeaderVariant
                    ? "relative h-11 w-11 shrink-0 rounded-xl border border-white/25 bg-slate-950/25 text-white transition-colors hover:bg-slate-950/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                    : cn(
                        "relative h-9 w-9 rounded-full border border-white/10 bg-white/10 text-white/90 backdrop-blur transition hover:bg-white/16 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-1 focus-visible:ring-offset-primary",
                        compact && "h-9 w-9",
                        customActiveCount > 0 && "bg-amber-100 text-amber-950 hover:bg-amber-100 hover:text-amber-950",
                      ),
                  isHeaderVariant && customActiveCount > 0 && "border-white/50 bg-slate-950/40",
                  className,
                )}
                aria-label={triggerAriaLabel}
              >
                {/* The universal access figure: a book here read as "documents", the same
                    glyph the institutional reader uses for its sources. */}
                <Accessibility className="h-5 w-5" aria-hidden="true" />
                {customActiveCount > 0 ? (
                  <span
                    aria-hidden={isHeaderVariant ? "true" : undefined}
                    aria-label={isHeaderVariant ? undefined : countDescription}
                    className={cn(
                      "pointer-events-none absolute flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none",
                      isHeaderVariant
                        ? "right-0.5 top-0.5 border border-slate-950/25 bg-white text-slate-950 shadow-sm"
                        : "-right-0.5 -top-0.5 bg-emerald-700 text-white",
                    )}
                  >
                    {customActiveCount}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">Accesibilidad</TooltipContent>
        </Tooltip>
        <PopoverContent
          align="end"
          side="bottom"
          collisionPadding={12}
          aria-labelledby={panelTitleId}
          className="z-[1000002] w-[min(320px,calc(100vw-24px))] rounded-2xl p-3"
          style={{
            maxHeight: "min(var(--radix-popover-content-available-height, 100dvh), calc(100dvh - 24px))",
            overflowY: "auto",
            overscrollBehavior: "contain",
          }}
        >
          <div className="mb-3">
            <p id={panelTitleId} className="text-sm font-semibold">Accesibilidad</p>
            <p className="text-xs text-muted-foreground">
              Ajustes rápidos para leer, escuchar y tocar mejor.
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
                  onClick={() => {
                    const value = !prefs[key];
                    setPrefs(current => ({ ...current, [key]: value }));
                    window.dispatchEvent(new CustomEvent<AccessibilityPreferenceIntent>(ACCESSIBILITY_INTENT_EVENT, {
                      detail: { key, value },
                    }));
                  }}
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
