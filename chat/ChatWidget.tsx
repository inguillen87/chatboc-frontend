import React, { useState, useEffect, useCallback, Suspense } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/hooks/useUser";
import { apiFetch } from "@/utils/api";
import { playOpenSound, playProactiveSound, resumeAudioContext } from "@/utils/sounds";
import ProactiveBubble from "./ProactiveBubble";
import ChatUserRegisterPanel from "./ChatUserRegisterPanel";
import ChatUserLoginPanel from "./ChatUserLoginPanel";
import ChatUserPanel from "./ChatUserPanel";
import ChatHeader from "./ChatHeader";
import EntityInfoPanel from "./EntityInfoPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { useWindowSize } from "@/hooks/useWindowSize";

const ChatPanel = React.lazy(() => import("./ChatPanel"));

interface ChatWidgetProps {
  mode?: "standalone" | "iframe" | "script";
  initialPosition?: { bottom: number; right: number };
  defaultOpen?: boolean;
  initialView?: 'chat' | 'register' | 'login' | 'user' | 'info';
  widgetId?: string;
  entityToken?: string;
  initialRubro?: string;
  openWidth?: string;
  openHeight?: string;
  closedWidth?: string;
  closedHeight?: string;
  tipoChat?: "pyme" | "municipio";
  ctaMessage?: string;
}

const PROACTIVE_MESSAGES = ["¿Necesitas ayuda?"];

let proactiveMessageTimeout: NodeJS.Timeout | null = null;
let hideProactiveBubbleTimeout: NodeJS.Timeout | null = null;

const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode = "standalone",
  defaultOpen = false,
  initialView = 'chat',
  widgetId = "chatboc-widget-iframe",
  entityToken,
  initialRubro,
  openWidth = "380px",
  openHeight = "580px",
  closedWidth = "56px",
  closedHeight = "56px",
  tipoChat = getCurrentTipoChat(),
  initialPosition = { bottom: 32, right: 32 },
  ctaMessage,
}) => {
  const [isOpen, setIsOpen] = useState(!!defaultOpen);
  const [muted, setMuted] = useState(() => safeLocalStorage.getItem('chatboc_muted') === '1');
  const [view, setView] = useState(initialView);
  const { user } = useUser();
  const [resolvedTipoChat, setResolvedTipoChat] = useState(tipoChat);
  const [entityInfo, setEntityInfo] = useState<any | null>(null);
  const { width: windowWidth } = useWindowSize();
  const isMobileView = windowWidth < 640;

  const [showCta, setShowCta] = useState(false);
  const [proactiveMessage, setProactiveMessage] = useState<string | null>(null);
  const [showProactiveBubble, setShowProactiveBubble] = useState(false);
  const [proactiveCycle, setProactiveCycle] = useState(0);

  const openUserPanel = useCallback(() => {
    if (user) {
      setView(user.rol && user.rol !== 'usuario' ? 'info' : 'user');
    } else {
      setView(entityInfo ? 'info' : 'login');
    }
  }, [user, entityInfo]);

  const openCart = useCallback(() => window.open('/cart', '_blank'), []);
  const toggleMuted = useCallback(() => setMuted(m => {
    const newMuted = !m;
    safeLocalStorage.setItem('chatboc_muted', newMuted ? '1' : '0');
    return newMuted;
  }), []);

  const finalClosedWidth = isMobileView ? "80px" : closedWidth;
  const finalClosedHeight = isMobileView ? "80px" : closedHeight;
  const logoSize = isMobileView ? 40 : Math.floor(parseInt(finalClosedWidth.replace('px', ''), 10) * 0.62);

  const sendStateMessageToParent = useCallback((open: boolean) => {
    if (mode === "iframe" && window.parent !== window && widgetId) {
      const dims = open
        ? { width: openWidth, height: openHeight }
        : { width: finalClosedWidth, height: finalClosedHeight };
      window.parent.postMessage({ type: "chatboc-state-change", widgetId, dimensions: dims, isOpen: open }, "*");
    }
  }, [mode, widgetId, openWidth, openHeight, finalClosedWidth, finalClosedHeight]);

  useEffect(() => {
    sendStateMessageToParent(isOpen);
    if (isOpen) {
      setShowProactiveBubble(false);
      if (proactiveMessageTimeout) clearTimeout(proactiveMessageTimeout);
      if (hideProactiveBubbleTimeout) clearTimeout(hideProactiveBubbleTimeout);
    }
  }, [isOpen, sendStateMessageToParent]);

  useEffect(() => {
    if (isOpen || mode === 'standalone' || safeLocalStorage.getItem("proactive_bubble_session_shown") === "1") {
      return;
    }
    if (proactiveMessageTimeout) clearTimeout(proactiveMessageTimeout);
    if (hideProactiveBubbleTimeout) clearTimeout(hideProactiveBubbleTimeout);

    proactiveMessageTimeout = setTimeout(() => {
      setProactiveMessage(PROACTIVE_MESSAGES[proactiveCycle % PROACTIVE_MESSAGES.length]);
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

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.widgetId !== widgetId) return;
      if (event.data.type === "TOGGLE_CHAT") setIsOpen(event.data.isOpen);
      else if (event.data.type === "SET_VIEW") setView(event.data.view);
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [widgetId]);

  const toggleChat = useCallback(() => {
    if (!isOpen) resumeAudioContext();
    setIsOpen(prev => {
      const nextIsOpen = !prev;
      if (nextIsOpen && !muted) playOpenSound();
      if (nextIsOpen) {
        setShowProactiveBubble(false);
        if (proactiveMessageTimeout) clearTimeout(proactiveMessageTimeout);
        if (hideProactiveBubbleTimeout) clearTimeout(hideProactiveBubbleTimeout);
      }
      return nextIsOpen;
    });
  }, [isOpen, muted]);

  useEffect(() => {
    if (!ctaMessage || isOpen || showProactiveBubble || safeLocalStorage.getItem("cta_seen") === "1") {
      setShowCta(false);
      return;
    }
    const delay = setTimeout(() => {
      setShowCta(true);
      const hide = setTimeout(() => setShowCta(false), 8000);
      safeLocalStorage.setItem("cta_seen", "1");
      return () => clearTimeout(hide);
    }, 2500);
    return () => clearTimeout(delay);
  }, [ctaMessage, isOpen, showProactiveBubble]);

  useEffect(() => {
    if ((mode === "iframe" || mode === "script")) {
      if (entityToken) safeLocalStorage.setItem("entityToken", entityToken);
      else safeLocalStorage.removeItem("entityToken");
    }
  }, [mode, entityToken]);

  useEffect(() => {
    if (!entityToken) {
      setEntityInfo(null);
      setResolvedTipoChat(tipoChat);
      return;
    }
    apiFetch<any>("/perfil", { sendEntityToken: true, skipAuth: true })
      .then(data => {
        if (data) {
          setResolvedTipoChat(data.esPublico ? "municipio" : "pyme");
          setEntityInfo(data);
        } else {
          setResolvedTipoChat(tipoChat);
        }
      })
      .catch(e => {
        console.error("ChatWidget: Error fetching entity profile:", e);
        setEntityInfo(null);
        setResolvedTipoChat(tipoChat);
      });
  }, [entityToken, tipoChat]);

  const panelAnimation = {
    initial: { opacity: 0, transform: "scale(0.9) translateY(20px)" },
    animate: { opacity: 1, transform: "scale(1) translateY(0px)" },
    exit: { opacity: 0, transform: "scale(0.9) translateY(20px)" },
    transition: { type: "spring", stiffness: 500, damping: 30 }
  };
  const buttonAnimation = {
    initial: { opacity: 0, scale: 0.7 },
    animate: { opacity: 1, scale: 1, transition: { ...spring, delay: 0.1 } },
    exit: { opacity: 0, scale: 0.8, transition: { duration: 0.15 } },
  };

  const renderPanelContent = () => {
    switch (view) {
      case 'register': return <ChatUserRegisterPanel onSuccess={() => setView("chat")} onShowLogin={() => setView("login")} />;
      case 'login': return <ChatUserLoginPanel onSuccess={() => setView("chat")} onShowRegister={() => setView("register")} />;
      case 'user': return <ChatUserPanel onClose={() => setView("chat")} />;
      case 'info': return <EntityInfoPanel info={entityInfo} onClose={() => setView("chat")} />;
      default: return <ChatPanel {...{ mode, widgetId, entityToken, initialRubro, openWidth, openHeight, onClose: toggleChat, tipoChat: resolvedTipoChat, onRequireAuth: () => setView("register"), onShowLogin: () => setView("login"), onShowRegister: () => setView("register"), onOpenUserPanel, muted, onToggleSound: toggleMuted, onCart: openCart }} />;
    }
  };

  const containerStyle: React.CSSProperties = mode === "standalone" ? {
    position: 'fixed',
    zIndex: 9999,
    bottom: isOpen && isMobileView ? 0 : `calc(${initialPosition.bottom}px + env(safe-area-inset-bottom))`,
    right: isOpen && isMobileView ? 0 : `calc(${initialPosition.right}px + env(safe-area-inset-right))`,
    left: isOpen && isMobileView ? 0 : "auto",
    top: isOpen && isMobileView ? "env(safe-area-inset-top)" : "auto",
    width: isOpen ? (isMobileView ? "100vw" : openWidth) : finalClosedWidth,
    height: isOpen ? (isMobileView ? "90vh" : openHeight) : finalClosedHeight,
    minWidth: isOpen ? "320px" : finalClosedWidth,
    minHeight: isOpen ? "64px" : finalClosedHeight,
    maxWidth: "100vw",
    maxHeight: "100vh",
    borderRadius: isOpen ? (isMobileView ? "16px 16px 0 0" : "16px") : "50%",
    overflow: "visible",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "flex-end",
  } : {
    position: 'fixed',
    bottom: 0,
    right: 0,
    overflow: "visible",
    display: "flex",
    flexDirection: "column",
    alignItems: "end",
    justifyContent: "end"
  };

  return (
    <div className={cn("chatboc-container", { "standalone": mode === "standalone" })} style={containerStyle}>
      <Suspense fallback={<Skeleton className={cn("w-full h-full", isOpen ? "rounded-2xl" : "rounded-full")} />}>
        <AnimatePresence mode="popLayout">
          {isOpen ? (
            <motion.div
              key="chatboc-panel-open"
              className="bg-card border shadow-xl flex flex-col overflow-hidden w-full h-full"
              style={{ borderRadius: isMobileView ? "16px 16px 0 0" : "16px" }}
              {...panelAnimation}
            >
              {view !== 'chat' && (
                <ChatHeader onClose={toggleChat} onBack={() => setView("chat")} showProfile={false} muted={muted} onToggleSound={toggleMuted} onCart={openCart} />
              )}
              {renderPanelContent()}
            </motion.div>
          ) : (
            <motion.div
              key="chatboc-panel-closed"
              className="relative"
              style={{ width: finalClosedWidth, height: finalClosedHeight }}
              initial={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
            >
              <ProactiveBubble message={proactiveMessage || ""} onClick={toggleChat} visible={showProactiveBubble && !showCta} />
              {showCta && ctaMessage && !showProactiveBubble && (
                <motion.div
                  key="chatboc-cta"
                  className="absolute right-0 text-sm bg-background border rounded-lg shadow-lg px-3 py-2 dark:bg-slate-800 dark:border-slate-700"
                  style={{ bottom: "calc(100% + 8px)" }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.3 }}
                >
                  {ctaMessage}
                </motion.div>
              )}
              <motion.button
                key="chatboc-toggle-btn"
                className="w-full h-full rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 shadow-xl border-none"
                style={{ zIndex: 20 }}
                {...buttonAnimation}
                whileHover={{ scale: 1.1, transition: { type: "spring", stiffness: 400, damping: 15 } }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleChat}
                aria-label="Abrir chat"
              >
                <ChatbocLogoAnimated size={logoSize} blinking={!isOpen && !showProactiveBubble && !showCta} floating={!isOpen} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
};

export default ChatWidget;
