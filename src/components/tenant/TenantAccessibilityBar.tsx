import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Eye, Type, Volume2 } from 'lucide-react';

import {
  ACCESSIBILITY_EVENT,
  ACCESSIBILITY_INTENT_EVENT,
  persistAccessibilityPrefs,
  readAccessibilityPrefs,
  type AccessibilityPreferenceIntent,
  type Prefs,
  readInstitutionalLargeText,
  rememberInstitutionalLargeText,
} from '@/components/chat/AccessibilityToggle';
import { cn } from '@/lib/utils';

type TenantAccessibilityValue = {
  largeText: boolean;
  setLargeText: (value: boolean) => void;
  readAloudAvailable: boolean;
  setReadAloudAvailable: (value: boolean) => void;
};

export const TENANT_READ_ALOUD_TARGET_ID = 'tenant-read-aloud-control';

const TenantAccessibilityContext = createContext<TenantAccessibilityValue | null>(null);

export function TenantAccessibilityProvider({ children }: { children: ReactNode }) {
  const [largeText, setLargeTextState] = useState(readInstitutionalLargeText);
  const [readAloudAvailable, setReadAloudAvailable] = useState(false);
  const setLargeText = useCallback((value: boolean) => {
    rememberInstitutionalLargeText(value);
    setLargeTextState(value);
  }, []);
  const value = useMemo(
    () => ({ largeText, setLargeText, readAloudAvailable, setReadAloudAvailable }),
    [largeText, readAloudAvailable, setLargeText],
  );
  return (
    <TenantAccessibilityContext.Provider value={value}>
      {children}
    </TenantAccessibilityContext.Provider>
  );
}

export const useTenantAccessibility = () => useContext(TenantAccessibilityContext);

export function TenantAccessibilityBar({ className }: { className?: string }) {
  const tenantAccessibility = useTenantAccessibility();
  const [preferences, setPreferences] = useState<Prefs>(readAccessibilityPrefs);

  useEffect(() => {
    const synchronize = (event: Event) => {
      const next = (event as CustomEvent<Prefs>).detail;
      if (next) setPreferences(next);
    };
    window.addEventListener(ACCESSIBILITY_EVENT, synchronize as EventListener);
    return () => window.removeEventListener(ACCESSIBILITY_EVENT, synchronize as EventListener);
  }, []);

  if (!tenantAccessibility) return null;

  const toggleHighContrast = () => {
    const value = !preferences.highContrast;
    const next = { ...preferences, highContrast: value };
    setPreferences(next);
    persistAccessibilityPrefs(next);
    window.dispatchEvent(new CustomEvent<AccessibilityPreferenceIntent>(ACCESSIBILITY_INTENT_EVENT, {
      detail: { key: 'highContrast', value },
    }));
  };

  const startReading = () => {
    const target = document.getElementById(TENANT_READ_ALOUD_TARGET_ID);
    const control = target?.querySelector<HTMLButtonElement>('button');
    if (!control) return;
    target.scrollIntoView?.({ block: 'nearest', behavior: 'auto' });
    control.click();
    control.focus({ preventScroll: true });
  };

  return (
    <section
      className={cn(
        'tenant-accessibility-bar flex flex-col gap-2 border-y border-border/80 py-3 min-[641px]:flex-row min-[641px]:items-center min-[641px]:gap-3',
        className,
      )}
      aria-label="Accesibilidad"
    >
      <p className="shrink-0 text-sm font-semibold text-foreground">Accesibilidad</p>
      <div className="grid min-w-0 flex-1 grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-2 min-[641px]:flex min-[641px]:flex-wrap">
        <button
          type="button"
          className="inline-flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-lg border border-border bg-background px-2 py-2 text-center text-xs font-semibold leading-tight min-[641px]:flex-row min-[641px]:gap-2 min-[641px]:px-4 min-[641px]:text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-[641px]:w-auto"
          aria-pressed={tenantAccessibility.largeText}
          onClick={() => tenantAccessibility.setLargeText(!tenantAccessibility.largeText)}
        >
          <Type className="h-5 w-5" aria-hidden="true" />
          Texto ampliado
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-lg border border-border bg-background px-2 py-2 text-center text-xs font-semibold leading-tight min-[641px]:flex-row min-[641px]:gap-2 min-[641px]:px-4 min-[641px]:text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-[641px]:w-auto"
          aria-pressed={preferences.highContrast}
          onClick={toggleHighContrast}
        >
          <Eye className="h-5 w-5" aria-hidden="true" />
          Alto contraste
        </button>
        {tenantAccessibility.readAloudAvailable ? (
          <button
            type="button"
            className="inline-flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-lg border border-border bg-background px-2 py-2 text-center text-xs font-semibold leading-tight min-[641px]:flex-row min-[641px]:gap-2 min-[641px]:px-4 min-[641px]:text-sm text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-[641px]:w-auto"
            aria-controls={TENANT_READ_ALOUD_TARGET_ID}
            onClick={startReading}
          >
            <Volume2 className="h-5 w-5" aria-hidden="true" />
            Leer en voz alta
          </button>
        ) : null}
      </div>
    </section>
  );
}
