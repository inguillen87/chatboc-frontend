import React, { useState, useEffect, useCallback, Suspense } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/hooks/useUser";
import { apiFetch } from "@/utils/api";
import { useHostMessageHandler, sendMessageToHost } from "@/utils/postMessage";
import { playOpenSound, playProactiveSound } from "@/utils/sounds";
import ProactiveBubble from "./ProactiveBubble";
import ChatUserRegisterPanel from "./ChatUserRegisterPanel";
import ChatUserLoginPanel from "./ChatUserLoginPanel";
import ChatUserPanel from "./ChatUserPanel";
import ChatHeader from "./ChatHeader";
import EntityInfoPanel from "./EntityInfoPanel";
import { Skeleton } from "@/components/ui/skeleton";

const ChatPanel = React.lazy(() => import("./ChatPanel"));

interface ChatWidgetProps {
  mode?: "standalone" | "iframe" | "script";
  initialPosition?: { bottom: string; right: string };
  defaultOpen?: boolean;
  initialView?: 'chat' | 'register' | 'login' | 'user' | 'info';
  widgetId?: string;
  hostDomain?: string;
  entityToken?: string;
  initialRubro?: string;
  openWidth?: string;
  openHeight?: string;
  closedWidth?: string;
  closedHeight?: string;
  tipoChat?: "pyme" | "municipio";
  ctaMessage?: string;
}

const PROACTIVE_MESSAGES = [
  "¿Necesitas ayuda para encontrar algo?",
  "¡Hola! Estoy aquí para asistirte.",
  "¿Tienes alguna consulta? ¡Pregúntame!",
  "Explora nuestros servicios, ¡te ayudo!",
];

let proactiveMessageTimeout: NodeJS.Timeout | null = null;
let hideProactiveBubbleTimeout: NodeJS.Timeout | null = null;

const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode = "standalone",
  defaultOpen = false,
  initialView = 'chat',
  widgetId = "chatboc-widget-iframe",
  hostDomain = "",
  entityToken,
  initialRubro,
  openWidth = "460px",
  openHeight = "680px",
  closedWidth = "100px",
  closedHeight = "100px",
  tipoChat = getCurrentTipoChat(),
  initialPosition = { bottom: "20px", right: "20px" },
  ctaMessage,
}) => {
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

  const [isMobileView, setIsMobileView] = useState(
    typeof window !== "undefined" && window.innerWidth < 640
  );

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

  const [showCta, setShowCta] = useState(false);
  const [proactiveMessage, setProactiveMessage] = useState<string | null>(null);
  const [showProactiveBubble, setShowProactiveBubble] = useState(false);
  const [proactiveCycle, setProactiveCycle] = useState(0);

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

  const finalOpenWidth = openWidth;
  const finalOpenHeight = openHeight;

  const mobileClosedSize = "72px";
  const finalClosedWidth = isMobileView ? mobileClosedSize : closedWidth;
  const finalClosedHeight = isMobileView ? mobileClosedSize : closedHeight;
  const logoSizeFactor = 0.62;
  const closedWidthPx = parseInt(finalClosedWidth.replace('px', ''), 10);
  const calculatedLogoSize = Math.floor(closedWidthPx * logoSizeFactor);

  const commonPanelAndButtonAbsoluteClasses = cn("absolute bottom-0 right-0");
  const commonPanelStyles = cn("bg-card border shadow-lg", "flex flex-col overflow-hidden");
  const commonButtonStyles = cn(
    "rounded-full flex items-center justify-center",
    "bg-primary text-primary-foreground hover:bg-primary/90",
    "shadow-lg"
  );

  useEffect(() => {
    if (mode !== "iframe" || !widgetId || !hostDomain) return;

    const style = {
      width: isOpen ? (isMobileView ? "100vw" : finalOpenWidth) : finalClosedWidth,
      height: isOpen ? (isMobileView ? "100dvh" : finalOpenHeight) : finalClosedHeight,
      bottom: isOpen && isMobileView ? "0px" : initialPosition.bottom,
      right: isOpen && isMobileView ? "0px" : initialPosition.right,
      borderRadius: isOpen ? (isMobileView ? "0" : "16px") : "50%",
      boxShadow: isOpen ? "0 6px 20px rgba(0,0,0,0.2)" : "0 4px 12px rgba(0,0,0,0.15)",
      transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease-in-out",
    };

    sendMessageToHost({ type: "CHATBOC_RESIZE_CONTAINER", widgetId, style }, hostDomain);

    if (isOpen) {
      setShowProactiveBubble(false);
      if (proactiveMessageTimeout) clearTimeout(proactiveMessageTimeout);
      if (hideProactiveBubbleTimeout) clearTimeout(hideProactiveBubbleTimeout);
    }
  }, [isOpen, isMobileView, mode, widgetId, hostDomain, finalOpenWidth, finalOpenHeight, finalClosedWidth, finalClosedHeight, initialPosition]);

  useEffect(() => {
    if (isOpen || mode === 'standalone') {
      if (proactiveMessageTimeout) clearTimeout(proactiveMessageTimeout);
      if (hideProactiveBubbleTimeout) clearTimeout(hideProactiveBubbleTimeout);
      setShowProactiveBubble(false);
      return;
    }
    if (proactiveMessageTimeout) clearTimeout(proactiveMessageTimeout);
    if (hideProactiveBubbleTimeout) clearTimeout(hideProactiveBubbleTimeout);

    const alreadyShownProactive = safeLocalStorage.getItem("proactive_bubble_session_shown") === "1";
    if (alreadyShownProactive) return;

    proactiveMessageTimeout = setTimeout(() => {
      const nextMessage = PROACTIVE_MESSAGES[proactiveCycle % PROACTIVE_MESSAGES.length];
      setProactiveMessage(nextMessage);
      setShowProactiveBubble(true);
      if (!muted) playProactiveSound();
      safeLocalStorage.setItem("proactive_bubble_session_shown", "1");

      hideProactiveBubbleTimeout = setTimeout(() => {
        setShowProactiveBubble(false);
        setProactiveCycle(prev => prev + 1);
      }, 7000);

    }, 10000);

    return () => {
      if (proactiveMessageTimeout) clearTimeout(proactiveMessageTimeout);
      if (hideProactiveBubbleTimeout) clearTimeout(hideProactiveBubbleTimeout);
    };
  }, [isOpen, muted, proactiveCycle, mode]);

  const handleHostMessage = useCallback((data) => {
    const { type, view } = data;
    switch (type) {
      case "CHATBOC_TOGGLE":
        toggleChat();
        break;
      case "CHATBOC_OPEN":
        setIsOpen(true);
        break;
      case "CHATBOC_CLOSE":
        setIsOpen(false);
        break;
      case "CHATBOC_SET_VIEW":
        if (view && ['chat', 'register', 'login', 'user', 'info'].includes(view)) {
          setView(view);
          if (!isOpen) setIsOpen(true);
        }
        break;
    }
  }, [toggleChat, isOpen]);

  useHostMessageHandler(widgetId, hostDomain, handleHostMessage);

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
        if (proactiveMessageTimeout) clearTimeout(proactiveMessageTimeout);
        if (hideProactiveBubbleTimeout) clearTimeout(hideProactiveBubbleTimeout);
      }
      return nextIsOpen;
    });
  }, [isOpen, muted]); // Added isOpen to the dependency array

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
    if (mode === "iframe" && entityToken) {
      safeLocalStorage.setItem("entityToken", entityToken);
    } else if (mode === "iframe" && !entityToken) {
      safeLocalStorage.removeItem("entityToken");
    }
  }, [mode, entityToken]);

  useEffect(() => {
    async function fetchEntityProfile() {
      if (!entityToken) return;
      try {
        const data = await apiFetch<any>("/perfil", {
          sendEntityToken: true,
          skipAuth: true,
        });
        if (data && typeof data.esPublico === "boolean") {
          setResolvedTipoChat(data.esPublico ? "municipio" : "pyme");
        } else if (data && data.tipo_chat) {
          setResolvedTipoChat(data.tipo_chat === "municipio" ? "municipio" : "pyme");
        }
        setEntityInfo(data);
      } catch (e) { /* Silenciar */ }
    }
    fetchEntityProfile();
  }, [entityToken]);

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

  const containerStyle = mode === 'standalone' ? {
    bottom: isOpen && isMobileView ? 0 : `calc(${initialPosition.bottom} + env(safe-area-inset-bottom))`,
    right: isOpen && isMobileView ? 0 : `calc(${initialPosition.right} + env(safe-area-inset-right))`,
    left: isOpen && isMobileView ? 0 : "auto",
    top: isOpen && isMobileView ? "env(safe-area-inset-top)" : "auto",
    width: isOpen ? (isMobileView ? "100vw" : finalOpenWidth) : finalClosedWidth,
    height: isOpen ? (isMobileView ? "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))" : finalOpenHeight) : finalClosedHeight,
    borderRadius: isOpen ? (isMobileView ? "0" : "16px") : "50%",
  } : {
    width: '100%',
    height: '100%',
  };

  return (
    <div
      className={cn(
        "chatboc-container",
        mode === 'standalone' && "fixed z-[999999]",
        "flex flex-col items-end justify-end",
      )}
      style={{
        ...containerStyle,
        overflow: "visible",
        background: "transparent",
      }}
    >
    <Suspense fallback={
      <div
        className={cn(commonPanelStyles, "w-full h-full items-center justify-center")}
        style={{ borderRadius: isOpen ? (isMobileView ? "0" : "16px") : "50%", background: "hsl(var(--card))" }}
      >
        <ChatbocLogoAnimated size={calculatedLogoSize > 0 ? calculatedLogoSize : (isMobileView ? 32 : 48)} />
        <Skeleton className="h-4 w-[60%] mt-3" />
        <Skeleton className="h-4 w-[40%] mt-2" />
      </div>
    }>
      <AnimatePresence mode="wait" initial={false}>
        {isOpen ? (
          <motion.div
            key="chatboc-panel-open"
            className={cn(commonPanelStyles, "w-full h-full shadow-xl")}
            style={{ borderRadius: isMobileView ? "0" : "16px", background: "hsl(var(--card))" }}
            {...panelAnimation}
          >
            {(view === "register" || view === "login" || view === "user" || view === "info") && (
              <ChatHeader onClose={toggleChat} onBack={() => setView("chat")} showProfile={false} muted={muted} onToggleSound={toggleMuted} onCart={openCart} />
            )}
            {view === "register" ? <ChatUserRegisterPanel onSuccess={() => setView("chat")} onShowLogin={() => setView("login")} entityToken={entityToken} />
              : view === "login" ? <ChatUserLoginPanel onSuccess={() => setView("chat")} onShowRegister={() => setView("register")} />
              : view === "user" ? <ChatUserPanel onClose={() => setView("chat")} />
              : view === "info" ? <EntityInfoPanel info={entityInfo} onClose={() => setView("chat")} />
              : <ChatPanel mode={mode} widgetId={widgetId} entityToken={entityToken} initialRubro={initialRubro} openWidth={finalOpenWidth} openHeight={finalOpenHeight} onClose={toggleChat} tipoChat={resolvedTipoChat} onRequireAuth={() => setView("register")} onShowLogin={() => setView("login")} onShowRegister={() => setView("register")} onOpenUserPanel={openUserPanel} muted={muted} onToggleSound={toggleMuted} onCart={openCart} />}
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
                <ChatbocLogoAnimated size={calculatedLogoSize} blinking={!isOpen} floating={!isOpen} pulsing={!isOpen} />
              </motion.div>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </Suspense>
    </div>
  );
}

export default ChatWidget;
