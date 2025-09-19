import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useDarkMode } from "@/hooks/useDarkMode";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { extractRubroKey } from "@/utils/rubros";
import getOrCreateAnonId from "@/utils/anonId";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/hooks/useUser";
import { apiFetch, getErrorMessage } from "@/utils/api";
import { playOpenSound, playProactiveSound } from "@/utils/sounds";
import ProactiveBubble from "./ProactiveBubble";
import ChatUserRegisterPanel from "./ChatUserRegisterPanel";
import ChatUserLoginPanel from "./ChatUserLoginPanel";
import ChatUserPanel from "./ChatUserPanel";
import ChatHeader from "./ChatHeader";
import EntityInfoPanel from "./EntityInfoPanel";
import ChatPanel from "./ChatPanel";
import ReadingRuler from "./ReadingRuler";
import type { Prefs } from "./AccessibilityToggle";

interface ChatWidgetProps {
  mode?: "standalone" | "iframe" | "script";
  initialPosition?: { bottom: number; right: number };
  defaultOpen?: boolean;
  initialView?: 'chat' | 'register' | 'login' | 'user' | 'info';
  widgetId?: string;
  ownerToken?: string;
  initialRubro?: string;
  openWidth?: string;
  openHeight?: string;
  closedWidth?: string;
  closedHeight?: string;
  tipoChat?: "pyme" | "municipio";
  ctaMessage?: string;
  customLauncherLogoUrl?: string;
  logoAnimation?: string;
  headerLogoUrl?: string;
  welcomeTitle?: string;
  welcomeSubtitle?: string;
}

const PROACTIVE_MESSAGES = [
  "¿Necesitas ayuda?",
  "¿Querés hacer una sugerencia?",
  "¿Tenés un reclamo?",
  "¿Tenés consultas? ¡Preguntame!",
];

const LS_KEY = "chatboc_accessibility";

const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode = "standalone",
  defaultOpen = false,
  initialView = 'chat',
  widgetId = "chatboc-widget-iframe",
  ownerToken,
  initialRubro,
  openWidth = "460px",
  openHeight = "680px",
  closedWidth = "100px",
  closedHeight = "100px",
  tipoChat = getCurrentTipoChat(),
  initialPosition = { bottom: 32, right: 32 },
  ctaMessage,
  customLauncherLogoUrl,
  logoAnimation,
  headerLogoUrl,
  welcomeTitle,
  welcomeSubtitle,
}) => {
  const proactiveMessageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideProactiveBubbleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDarkMode = useDarkMode();

  const [isOpen, setIsOpen] = useState(() => {
    if (mode !== 'standalone' && typeof defaultOpen === 'string') {
      return defaultOpen === 'true';
    }
    return !!defaultOpen;
  });
  const [muted, setMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return safeLocalStorage.getItem('chatboc_muted') === '1';
  });
  const [view, setView] = useState<'chat' | 'register' | 'login' | 'user' | 'info'>(initialView);
  const { user } = useUser();
  const [resolvedTipoChat, setResolvedTipoChat] = useState<'pyme' | 'municipio'>(tipoChat);
  const [entityInfo, setEntityInfo] = useState<any | null>(null);
  const [isProfileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [isMobileView, setIsMobileView] = useState(
    typeof window !== "undefined" && window.innerWidth < 640
  );

  const isEmbedded = mode !== "standalone";

  const derivedEntityTitle =
    (typeof entityInfo?.nombre_empresa === "string" && entityInfo.nombre_empresa.trim()) ||
    (typeof entityInfo?.nombre === "string" && entityInfo.nombre.trim()) ||
    (typeof entityInfo?.nombre_publico === "string" && entityInfo.nombre_publico.trim()) ||
    (typeof entityInfo?.nombre_fantasia === "string" && entityInfo.nombre_fantasia.trim()) ||
    (typeof entityInfo?.nombreFantasia === "string" && entityInfo.nombreFantasia.trim()) ||
    (typeof entityInfo?.nombre_asistente === "string" && entityInfo.nombre_asistente.trim()) ||
    (typeof entityInfo?.nombreAsistente === "string" && entityInfo.nombreAsistente.trim()) ||
    (typeof entityInfo?.bot_nombre === "string" && entityInfo.bot_nombre.trim()) ||
    (typeof entityInfo?.botNombre === "string" && entityInfo.botNombre.trim()) ||
    (typeof entityInfo?.display_name === "string" && entityInfo.display_name.trim()) ||
    (typeof entityInfo?.municipio_nombre === "string" && entityInfo.municipio_nombre.trim()) ||
    (typeof entityInfo?.municipio === "string" && entityInfo.municipio.trim()) ||
    "";

  const derivedEntitySubtitle =
    (typeof entityInfo?.rubro === "string" && entityInfo.rubro.trim()) ||
    (typeof entityInfo?.descripcion === "string" && entityInfo.descripcion.trim()) ||
    (typeof entityInfo?.descripcion_corta === "string" && entityInfo.descripcion_corta.trim()) ||
    (typeof entityInfo?.tagline === "string" && entityInfo.tagline.trim()) ||
    (typeof entityInfo?.eslogan === "string" && entityInfo.eslogan.trim()) ||
    (typeof entityInfo?.slogan === "string" && entityInfo.slogan.trim()) ||
    "";

  const headerTitle = isEmbedded ? derivedEntityTitle : welcomeTitle;
  const headerSubtitle = isEmbedded ? derivedEntitySubtitle : welcomeSubtitle;

  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== "undefined") {
        setIsMobileView(window.innerWidth < 640);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    getOrCreateAnonId();
  }, []);

  const [showCta, setShowCta] = useState(false);
  const [proactiveMessage, setProactiveMessage] = useState<string | null>(null);
  const [showProactiveBubble, setShowProactiveBubble] = useState(false);
  const [proactiveCycle, setProactiveCycle] = useState(0);
  const [selectedRubro, setSelectedRubro] = useState<string | null>(() => extractRubroKey(initialRubro) ?? null);
  const entityDefaultRubro = useMemo(() => {
    if (!entityInfo) return null;

    const info: any = entityInfo;
    const rawRubro =
      info?.rubro_clave ??
      info?.rubroClave ??
      info?.rubro_nombre ??
      info?.rubroNombre ??
      info?.defaultRubro ??
      info?.rubro_default ??
      info?.rubro;

    const normalized = extractRubroKey(rawRubro);
    return normalized;
  }, [entityInfo]);
  const [a11yPrefs, setA11yPrefs] = useState<Prefs>(() => {
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
    const handleStorage = () => {
      try {
        const p = JSON.parse(safeLocalStorage.getItem(LS_KEY) || "") || {
          dyslexia: false,
          simplified: true,
        };
        setA11yPrefs(p);
      } catch {
        /* ignore */
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
      return () => window.removeEventListener("storage", handleStorage);
    }
  }, []);

  const lastOwnerTokenRef = useRef<string | null | undefined>(ownerToken);

  useEffect(() => {
    if (selectedRubro) {
      return;
    }

    const fallbackCandidate = initialRubro ?? entityDefaultRubro;
    const fallbackRubro =
      typeof fallbackCandidate === "string"
        ? fallbackCandidate.trim()
        : fallbackCandidate;

    const normalizedFallback = extractRubroKey(fallbackRubro);
    if (normalizedFallback) {
      setSelectedRubro(normalizedFallback);
    }
  }, [selectedRubro, initialRubro, entityDefaultRubro]);

  useEffect(() => {
    const trimmedInitial =
      typeof initialRubro === "string" ? initialRubro.trim() : null;

    const normalizedInitial = trimmedInitial ? extractRubroKey(trimmedInitial) : null;

    if (normalizedInitial) {
      if (selectedRubro !== normalizedInitial) {
        setSelectedRubro(normalizedInitial);
      }
    } else if (lastOwnerTokenRef.current !== ownerToken) {
      setSelectedRubro(null);
    }

    lastOwnerTokenRef.current = ownerToken;
  }, [ownerToken, initialRubro, selectedRubro]);

  const openUserPanel = useCallback(() => {
    if (user) {
      if (user.rol && user.rol !== 'usuario') {
        window.location.href = '/perfil';
      } else {
        setView('user');
      }
    } else if (entityInfo) {
      setView('info');
    } else {
      setView('login');
    }
  }, [user, entityInfo]);

  const openCart = useCallback(() => {
    window.open('/cart', '_blank');
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      const nv = !m;
      safeLocalStorage.setItem('chatboc_muted', nv ? '1' : '0');
      return nv;
    });
  }, []);

  const handleRubroSelect = useCallback((value: any) => {
    const normalized = extractRubroKey(value);
    setSelectedRubro(normalized ?? null);
  }, []);

  const [viewport, setViewport] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  });

  useEffect(() => {
    const onResize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const finalOpenWidth = useMemo(() => {
    const desired = parseInt(openWidth, 10);
    const max = viewport.width - (initialPosition.right || 0) - 16;
    return !isNaN(desired) && viewport.width
      ? `${Math.min(desired, max)}px`
      : openWidth;
  }, [openWidth, viewport.width, initialPosition.right]);

  const finalOpenHeight = useMemo(() => {
    const desired = parseInt(openHeight, 10);
    const max = viewport.height - (initialPosition.bottom || 0) - 16;
    return !isNaN(desired) && viewport.height
      ? `${Math.min(desired, max)}px`
      : openHeight;
  }, [openHeight, viewport.height, initialPosition.bottom]);

  const finalClosedWidth = closedWidth;
  const finalClosedHeight = closedHeight;
  const logoSizeFactor = 0.62;
  const closedWidthPx = parseInt(finalClosedWidth.replace('px', ''), 10);
  const calculatedLogoSize = Math.floor(closedWidthPx * logoSizeFactor);

  const commonPanelStyles = cn("chat-root bg-card border shadow-lg", "flex flex-col overflow-hidden");
  const commonButtonStyles = cn(
    "rounded-full flex items-center justify-center",
    "bg-primary text-primary-foreground hover:bg-primary/90",
    "shadow-lg"
  );

  const sendStateMessageToParent = useCallback(
    (open: boolean) => {
      if (mode === "iframe" && typeof window !== "undefined" && window.parent !== window && widgetId) {
        const dims = open
          ? { width: openWidth, height: openHeight }
          : { width: finalClosedWidth, height: finalClosedHeight };

        window.parent.postMessage(
          { type: "chatboc-state-change", widgetId, dimensions: dims, isOpen: open },
          "*"
        );
      }
    },
    [mode, widgetId, openWidth, openHeight, finalClosedWidth, finalClosedHeight]
  );

  useEffect(() => {
    if (mode === "iframe" && typeof window !== "undefined" && window.parent !== window && widgetId) {
      window.parent.postMessage({ type: "chatboc-ready", widgetId }, "*");
    }
  }, [mode, widgetId]);

  useEffect(() => {
    sendStateMessageToParent(isOpen);
    if (isOpen) {
      setShowProactiveBubble(false);
      if (proactiveMessageTimeoutRef.current) clearTimeout(proactiveMessageTimeoutRef.current);
      if (hideProactiveBubbleTimeoutRef.current) clearTimeout(hideProactiveBubbleTimeoutRef.current);
    }
  }, [isOpen, sendStateMessageToParent]);

  useEffect(() => {
    if (isOpen) {
      sendStateMessageToParent(true);
    }
  }, [viewport, isOpen, sendStateMessageToParent]);

  useEffect(() => {
    if (isOpen || mode === 'standalone') {
      if (proactiveMessageTimeoutRef.current) clearTimeout(proactiveMessageTimeoutRef.current);
      if (hideProactiveBubbleTimeoutRef.current) clearTimeout(hideProactiveBubbleTimeoutRef.current);
      setShowProactiveBubble(false);
      return;
    }
    if (proactiveMessageTimeoutRef.current) clearTimeout(proactiveMessageTimeoutRef.current);
    if (hideProactiveBubbleTimeoutRef.current) clearTimeout(hideProactiveBubbleTimeoutRef.current);

    const alreadyShownProactive = safeLocalStorage.getItem("proactive_bubble_session_shown") === "1";
    if (alreadyShownProactive) return;

    proactiveMessageTimeoutRef.current = setTimeout(() => {
      const nextMessage = PROACTIVE_MESSAGES[proactiveCycle % PROACTIVE_MESSAGES.length];
      setProactiveMessage(nextMessage);
      setShowProactiveBubble(true);
      if (!muted) playProactiveSound();
      safeLocalStorage.setItem("proactive_bubble_session_shown", "1");

      hideProactiveBubbleTimeoutRef.current = setTimeout(() => {
        setShowProactiveBubble(false);
        setProactiveCycle(prev => prev + 1);
      }, 7000);

    }, 10000);

    return () => {
      if (proactiveMessageTimeoutRef.current) clearTimeout(proactiveMessageTimeoutRef.current);
      if (hideProactiveBubbleTimeoutRef.current) clearTimeout(hideProactiveBubbleTimeoutRef.current);
    };
  }, [isOpen, muted, proactiveCycle, mode]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.widgetId !== widgetId) return;
      if (event.data.type === "TOGGLE_CHAT") {
        setIsOpen(event.data.isOpen);
      } else if (event.data.type === "SET_VIEW") {
        const v = event.data.view;
        if (['chat', 'register', 'login', 'user', 'info'].includes(v)) {
          setView(v as any);
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [widgetId]);

  const toggleChat = useCallback(() => {
    // Ensure AudioContext is resumed on user gesture, especially for the first click
    if (typeof window !== "undefined" && window.AudioContext && window.AudioContext.state === "suspended") {
      window.AudioContext.resume();
    }

    setIsOpen((prevIsOpen) => {
      const nextIsOpen = !prevIsOpen;
      if (nextIsOpen && !muted) {
        playOpenSound();
      }
      if (nextIsOpen) { // If opening chat
        setShowProactiveBubble(false); // Hide proactive bubble
        if (proactiveMessageTimeoutRef.current) clearTimeout(proactiveMessageTimeoutRef.current);
        if (hideProactiveBubbleTimeoutRef.current) clearTimeout(hideProactiveBubbleTimeoutRef.current);
      }
      return nextIsOpen;
    });
  }, [isOpen, muted]);

  useEffect(() => {
    if (!ctaMessage || isOpen || showProactiveBubble) {
      setShowCta(false);
      return;
    }
    if (safeLocalStorage.getItem("cta_seen") === "1") return;
    const delay = setTimeout(() => {
      setShowCta(true);
      const hide = setTimeout(() => setShowCta(false), 8000);
      safeLocalStorage.setItem("cta_seen", "1");
      return () => clearTimeout(hide);
    }, 2500);
    return () => clearTimeout(delay);
  }, [ctaMessage, isOpen, showProactiveBubble]);


  useEffect(() => {
    async function fetchEntityProfile() {
      // Wait until the token is resolved before deciding what to do.
      if (ownerToken === undefined) {
        setProfileLoading(false);
        return;
      }
      if (!ownerToken) {
        console.log("ChatWidget: No hay ownerToken, se asume configuración por defecto.");
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      setProfileError(null);
      console.log("ChatWidget: Intentando obtener perfil con token:", ownerToken);

      try {
        const data = await apiFetch<any>("/perfil", {
          entityToken: ownerToken,
        });
        console.log("ChatWidget: Perfil recibido:", data);
        if (data && typeof data.esPublico === "boolean") {
          setResolvedTipoChat(data.esPublico ? "municipio" : "pyme");
        } else if (data && data.tipo_chat) {
          setResolvedTipoChat(data.tipo_chat === "municipio" ? "municipio" : "pyme");
        }
        setEntityInfo(data);
      } catch (e) {
        console.error("ChatWidget: Error al obtener el perfil de la entidad:", e);
        setEntityInfo(null);
        setProfileError(getErrorMessage(e, "No se pudo cargar la configuración del widget."));
      } finally {
        setProfileLoading(false);
      }
    }
    fetchEntityProfile();
  }, [ownerToken]);

  // Fallback to avoid indefinite loading spinner if the profile request hangs
  useEffect(() => {
    if (!isProfileLoading) return;
    const timeout = setTimeout(() => {
      if (isProfileLoading) {
        setProfileError("No se pudo cargar la configuración del widget.");
        setProfileLoading(false);
      }
    }, 10000);
    return () => clearTimeout(timeout);
  }, [isProfileLoading]);

  const openSpring = { type: "spring", stiffness: 280, damping: 28 };
  const closeSpring = { type: "spring", stiffness: 300, damping: 30 };

  const panelAnimation = {
    initial: { opacity: 0, y: 50, scale: 0.9, borderRadius: "50%" },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      borderRadius: isMobileView ? "0px" : "16px",
      transition: { type: "tween", duration: 0.4, ease: "easeOut" }
    },
    exit: {
      opacity: 0,
      y: 50,
      scale: 0.9,
      borderRadius: "50%",
      transition: { type: "tween", duration: 0.3, ease: "easeIn" }
    }
  };

  const buttonAnimation = {
    initial: { opacity: 0, scale: 0.7, rotate: 0 },
    animate: {
      opacity: 1,
      scale: 1,
      rotate: 0,
      transition: { ...openSpring, delay: 0.1 }
    },
    exit: {
      opacity: 0,
      scale: 0.8,
      rotate: 30,
      transition: { ...closeSpring, duration: 0.15 }
    },
  };

  const iconAnimation = {
    closed: { rotate: 0, scale: 1, opacity: 1 },
    open: { rotate: 180, scale: 0, opacity: 0 }
  };

  const containerStyle =
    mode === "standalone"
      ? {
          bottom: isOpen && isMobileView ? 0 : `calc(${initialPosition.bottom}px + env(safe-area-inset-bottom))`,
          right: isOpen && isMobileView ? 0 : `calc(${initialPosition.right}px + env(safe-area-inset-right))`,
          left: isOpen && isMobileView ? 0 : "auto",
          top: isOpen && isMobileView ? "env(safe-area-inset-top)" : "auto",
          width: isOpen ? (isMobileView ? "100vw" : finalOpenWidth) : finalClosedWidth,
          height: isOpen ? (isMobileView ? "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))" : finalOpenHeight) : finalClosedHeight,
          borderRadius: isOpen ? (isMobileView ? "0" : "16px") : "50%",
        }
      : {
          width: "100%",
          height: "100%",
          overflow: "hidden",
        };

  if (mode === "standalone" || mode === "iframe") {
    return (
      <div
        data-testid="chat-widget"
        data-mode={mode}
        data-default-open={defaultOpen}
        data-widget-id={widgetId}
        data-owner-token={ownerToken}
        data-tipo-chat={tipoChat}
        data-initial-rubro={initialRubro}
        className={cn(
          "chatboc-container flex flex-col",
          mode === "standalone"
            ? "fixed z-[999999] items-end justify-end"
            : "w-full h-full"
        )}
        style={containerStyle}
      >
        {isOpen && a11yPrefs.dyslexia && <ReadingRuler />}
        {isProfileLoading ? (
          <div className="w-full h-full flex items-center justify-center bg-card rounded-2xl">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : profileError ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-4 bg-card rounded-2xl">
            <p className="text-destructive font-semibold">Error</p>
            <p className="text-sm text-muted-foreground">{profileError}</p>
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {isOpen ? (
            <motion.div
              key="chatboc-panel-open"
              className={cn(commonPanelStyles, "w-full h-full shadow-xl")}
              style={{ borderRadius: isMobileView ? "0" : "16px", background: "hsl(var(--card))" }}
              {...panelAnimation}
            >
              {(view === "register" || view === "login" || view === "user" || view === "info") && (
                <ChatHeader
                  onClose={toggleChat}
                  onBack={() => setView("chat")}
                  showProfile={false}
                  muted={muted}
                  onToggleSound={toggleMuted}
                  onCart={openCart}
                  logoUrl={headerLogoUrl || customLauncherLogoUrl || entityInfo?.logo_url || (isDarkMode ? '/chatbocar.png' : '/chatbocar2.png')}
                  title={headerTitle}
                  subtitle={headerSubtitle}
                  logoAnimation={logoAnimation}
                  onA11yChange={setA11yPrefs}
                />
              )}
              {view === "register" ? <ChatUserRegisterPanel onSuccess={() => setView("chat")} onShowLogin={() => setView("login")} entityToken={ownerToken} />
                : view === "login" ? <ChatUserLoginPanel onSuccess={() => setView("chat")} onShowRegister={() => setView("register")} />
                : view === "user" ? <ChatUserPanel onClose={() => setView("chat")} />
                : view === "info" ? <EntityInfoPanel info={entityInfo} onClose={() => setView("chat")} />
                : <ChatPanel
                    mode={mode}
                    widgetId={widgetId}
                    entityToken={ownerToken}
                    openWidth={finalOpenWidth}
                    openHeight={finalOpenHeight}
                    onClose={toggleChat}
                    tipoChat={resolvedTipoChat}
                    onRequireAuth={() => setView("register")}
                    onShowLogin={() => setView("login")}
                    onShowRegister={() => setView("register")}
                    onOpenUserPanel={openUserPanel}
                    muted={muted}
                    onToggleSound={toggleMuted}
                    onCart={openCart}
                    selectedRubro={selectedRubro ?? entityDefaultRubro}
                    onRubroSelect={handleRubroSelect}
                    headerLogoUrl={headerLogoUrl || customLauncherLogoUrl || entityInfo?.logo_url || (isDarkMode ? '/chatbocar.png' : '/chatbocar2.png')}
                    welcomeTitle={headerTitle}
                    welcomeSubtitle={headerSubtitle}
                    logoAnimation={logoAnimation}
                    onA11yChange={setA11yPrefs}
                    a11yPrefs={a11yPrefs}
                  />}
            </motion.div>
          ) : (
            <motion.div
              key="chatboc-panel-closed"
              className="relative w-full h-full"
            >
              <ProactiveBubble
                message={proactiveMessage || ""}
                onClick={toggleChat}
                visible={showProactiveBubble && !showCta}
                logoUrl={headerLogoUrl || customLauncherLogoUrl || entityInfo?.logo_url || (isDarkMode ? '/chatbocar.png' : '/chatbocar2.png')}
                logoAnimation={logoAnimation}
              />
              {showCta && ctaMessage && !showProactiveBubble && (
                <motion.div
                  key="chatboc-cta"
                  className="absolute right-0 text-sm bg-background border rounded-lg shadow-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700"
                  style={{ bottom: "calc(100% + 8px)" }}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  {ctaMessage}
                </motion.div>
              )}
              <motion.button
                key="chatboc-toggle-btn"
                className={cn(
                  commonButtonStyles,
                  "w-full h-full border-none shadow-xl"
                )}
                style={{
                  borderRadius: "50%",
                  background: "var(--primary, #2563eb)",
                  boxShadow: "0 6px 24px 0 rgba(0,0,0,0.15)",
                }}
                {...buttonAnimation}
                whileHover={{ scale: 1.1, transition: { type: "spring", stiffness: 400, damping: 15 } }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleChat}
                aria-label="Abrir chat"
              >
                <motion.div
                  variants={iconAnimation}
                  animate={isOpen ? "open" : "closed"}
                  transition={openSpring}
                >
                  <ChatbocLogoAnimated
                    src={entityInfo?.logo_url || customLauncherLogoUrl || (isDarkMode ? '/chatbocar.png' : '/chatbocar2.png')}
                    size={calculatedLogoSize}
                    blinking={!isOpen}
                    floating={!isOpen}
                    pulsing={!isOpen}
                    animation={logoAnimation}
                  />
                </motion.div>
              </motion.button>
            </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    );
  }

  return null;
};

export default ChatWidget;
