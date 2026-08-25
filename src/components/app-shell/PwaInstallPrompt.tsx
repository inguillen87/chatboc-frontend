import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, X } from "lucide-react";
import { useLocation } from "react-router-dom";

import {
  getMobileNavigationServerSnapshot,
  getMobileNavigationSnapshot,
  subscribeToMobileNavigation,
} from "@/components/app-shell/mobileNavigationOverlay";
import { Button } from "@/components/ui/button";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const DISMISSED_KEY = "chatboc_pwa_install_dismissed_at";
const DISMISS_DAYS = 14;

function recentlyDismissed() {
  const raw = safeLocalStorage.getItem(DISMISSED_KEY);
  const dismissedAt = raw ? Number(raw) : 0;
  if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) return false;
  return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PwaInstallPrompt() {
  const { pathname } = useLocation();
  const suppressOnPresentationRoute = pathname === "/demo" || pathname.startsWith("/demo/");
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneDisplay);
  const [dismissed, setDismissed] = useState(recentlyDismissed);
  const mobileNavigationOpen = useSyncExternalStore(
    subscribeToMobileNavigation,
    getMobileNavigationSnapshot,
    getMobileNavigationServerSnapshot,
  );

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (suppressOnPresentationRoute || recentlyDismissed() || isStandaloneDisplay()) return;
      setInstallEvent(event as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [suppressOnPresentationRoute]);

  if (
    suppressOnPresentationRoute ||
    !installEvent ||
    dismissed ||
    isInstalled ||
    mobileNavigationOpen
  ) {
    return null;
  }

  const dismiss = () => {
    safeLocalStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setDismissed(true);
  };

  const install = async () => {
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setIsInstalled(true);
      setInstallEvent(null);
      return;
    }
    dismiss();
  };

  return (
    <aside className="chatboc-pwa-install" aria-labelledby="chatboc-pwa-install-title">
      <div className="min-w-0">
        <p id="chatboc-pwa-install-title" className="text-sm font-semibold text-foreground">
          Instalar Chatboc
        </p>
        <p className="text-xs leading-5 text-muted-foreground">
          Acceso rápido, pantalla completa y mejor experiencia móvil.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" className="h-9 rounded-[8px] gap-2" onClick={() => void install()}>
          <Download className="h-4 w-4" />
          Instalar
        </Button>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-border/70 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          onClick={dismiss}
          aria-label="Cerrar aviso de instalación"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
