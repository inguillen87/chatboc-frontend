import React, { useState, useEffect, useCallback, Suspense } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeLocalStorage";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/hooks/useUser";

import ChatUserRegisterPanel from "./ChatUserRegisterPanel";
import ChatUserLoginPanel from "./ChatUserLoginPanel";
import ChatUserPanel from "./ChatUserPanel";
import ChatHeader from "./ChatHeader";
const ChatPanel = React.lazy(() => import("./ChatPanel"));

interface ChatWidgetProps {
  mode?: "standalone" | "iframe" | "script";
  initialPosition?: { bottom: number; right: number }; // Solo para modo standalone
  defaultOpen?: boolean;
  initialView?: 'chat' | 'register' | 'login' | 'user';
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

const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode = "standalone",
  defaultOpen = false,
  initialView = 'chat',
  widgetId = "chatboc-widget-iframe",
  entityToken,
  initialRubro,
  openWidth = "460px",
  openHeight = "680px",
  closedWidth = "96px",
  closedHeight = "96px",
  tipoChat = getCurrentTipoChat(),
  initialPosition = { bottom: 32, right: 32 }, // Mantener para standalone
  ctaMessage,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [view, setView] = useState<'chat' | 'register' | 'login' | 'user'>(initialView);
  const { user } = useUser();

  const openUserPanel = useCallback(() => {
    if (user) {
      if (user.rol && user.rol !== 'usuario') {
        window.location.href = '/perfil';
      } else {
        setView('user');
      }
    } else {
      setView('login');
    }
  }, [user]);

  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 640
  );

  useEffect(() => {
    const handleResize = () => {
      if (typeof window !== "undefined") {
        setIsMobile(window.innerWidth < 640);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const finalOpenWidth = openWidth;
  const finalOpenHeight = openHeight;
  const finalClosedWidth = closedWidth;
  const finalClosedHeight = closedHeight;

  // Clases comunes para el panel y el botón (para posicionamiento absoluto dentro del contenedor)
  const commonPanelAndButtonAbsoluteClasses = cn(
    "absolute bottom-0 right-0", // Posicionamiento absoluto en la esquina inferior derecha
  );

  const commonPanelStyles = cn(
    "bg-card border shadow-lg", // Estilos de la tarjeta
    "flex flex-col overflow-hidden",
    "transition-all duration-300 ease-in-out",
  );

  const commonButtonStyles = cn(
    "rounded-full flex items-center justify-center",
    "bg-primary text-primary-foreground hover:bg-primary/90",
    "shadow-lg transition-all duration-300 ease-in-out",
  );

  const sendStateMessageToParent = useCallback(
    (open: boolean) => {
      if (
        mode === "iframe" &&
        typeof window !== "undefined" &&
        window.parent !== window &&
        widgetId
      ) {
        const dims = open
          ? { width: finalOpenWidth, height: finalOpenHeight }
          : { width: finalClosedWidth, height: finalClosedHeight };
        window.parent.postMessage(
          { type: "chatboc-state-change", widgetId, dimensions: dims, isOpen: open },
          "*" 
        );
      }
    },
    [mode, widgetId, finalOpenWidth, finalOpenHeight, finalClosedWidth, finalClosedHeight, isMobile]
  );

  useEffect(() => {
    sendStateMessageToParent(isOpen);
  }, [isOpen, sendStateMessageToParent]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || event.data.widgetId !== widgetId) return;
      if (event.data.type === "TOGGLE_CHAT") {
        setIsOpen(event.data.isOpen);
      } else if (event.data.type === "SET_VIEW") {
        const v = event.data.view;
        if (v === 'chat' || v === 'register' || v === 'login' || v === 'user') {
          setView(v);
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [widgetId]);

  const toggleChat = () => setIsOpen((open) => !open);

  const [showCta, setShowCta] = useState(false);

  // Muestra la burbuja cada vez que se recibe `ctaMessage` y el chat está cerrado
  useEffect(() => {
    if (!ctaMessage || isOpen) {
      setShowCta(false);
      return;
    }
    setShowCta(true);
    const timer = setTimeout(() => setShowCta(false), 8000);
    return () => clearTimeout(timer);
  }, [ctaMessage, isOpen]);

  useEffect(() => {
    if (mode === "iframe" && entityToken) {
      safeLocalStorage.setItem("entityToken", entityToken);
    } else if (mode === "iframe" && !entityToken) {
      safeLocalStorage.removeItem("entityToken");
    }
  }, [mode, entityToken]);

  // Renderizado principal del ChatWidget
  if (mode === "standalone") {
  return (
    <div
      className={cn(
        "chatboc-container-standalone fixed z-[999999]",
      )}
      style={{
        bottom: isOpen && isMobile
          ? 0
          : `calc(${initialPosition.bottom}px + env(safe-area-inset-bottom))`,
        right: isOpen && isMobile
          ? 0
          : `calc(${initialPosition.right}px + env(safe-area-inset-right))`,
        left: isOpen && isMobile ? 0 : "auto",
        top: isOpen && isMobile ? "env(safe-area-inset-top)" : "auto",
        width: isOpen ? (isMobile ? "100vw" : finalOpenWidth) : finalClosedWidth,
        height: isOpen
          ? isMobile
            ? "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))"
            : finalOpenHeight
          : finalClosedHeight,
        minWidth: isOpen ? "320px" : finalClosedWidth,
        minHeight: isOpen ? "64px" : finalClosedHeight,
        maxWidth: "100vw",
        maxHeight: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
        borderRadius: isOpen ? (isMobile ? "0" : "16px") : "50%",
        overflow: isOpen ? "hidden" : "visible",
        boxShadow: "0 8px 32px 0 rgba(0,0,0,0.20)",
        background: isOpen ? "transparent" : "var(--primary, #2563eb)",
        transition: "all 0.25s cubic-bezier(.42,0,.58,1)",
        padding: 0,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "flex-end",
      }}
    >
      <Suspense fallback={null}>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="chatboc-panel"
              className={cn(commonPanelStyles, "w-full h-full")}
              style={{ borderRadius: isMobile ? "0" : "16px", background: "#fff" }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 250, damping: 18 }}
            >
              {(view === "register" || view === "login" || view === "user") && (
                <ChatHeader
                  onClose={toggleChat}
                  onBack={() => setView("chat")}
                  showProfile={false}
                />
              )}
              {view === "register" ? (
                <ChatUserRegisterPanel
                  onSuccess={() => setView("chat")}
                  onShowLogin={() => setView("login")}
                />
              ) : view === "login" ? (
                <ChatUserLoginPanel
                  onSuccess={() => setView("chat")}
                  onShowRegister={() => setView("register")}
                />
              ) : view === "user" ? (
                <ChatUserPanel onClose={() => setView("chat")} />
              ) : (
                <ChatPanel
                  mode={mode}
                  widgetId={widgetId}
                  entityToken={entityToken}
                  initialRubro={initialRubro}
                  openWidth={finalOpenWidth}
                  openHeight={finalOpenHeight}
                  onClose={toggleChat}
                  tipoChat={tipoChat}
                  onRequireAuth={() => setView("register")}
                  onShowLogin={() => setView("login")}
                  onShowRegister={() => setView("register")}
                  onOpenUserPanel={openUserPanel}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {!isOpen && (
          <>
            <AnimatePresence>
              {showCta && ctaMessage && (
                <motion.div
                  key="chatboc-cta"
                  className="absolute right-0 text-sm bg-background border rounded-lg shadow-lg px-3 py-2"
                  style={{ bottom: "calc(100% + 8px)" }}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  {ctaMessage}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              key="chatboc-btn"
              className={cn(
                commonButtonStyles,
                "w-[96px] h-[96px] absolute bottom-0 right-0 border-none shadow-xl",
              )}
              style={{
                borderRadius: "50%",
                background: "var(--primary, #2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 6px 24px 0 rgba(0,0,0,0.15)",
              }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              onClick={toggleChat}
              aria-label="Abrir chat"
            >
              <motion.span
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 1, repeatDelay: 3 }}
              >
                <ChatbocLogoAnimated size={isMobile ? 42 : 62} blinking floating pulsing />
              </motion.span>
            </motion.button>
          </>
        )}
      </Suspense>
    </div>
  );
}


  // Modo iframe (se incrusta dentro de un iframe externo)
  // No uses wrappers que hagan fullscreen; solo posiciona el botón/panel.
  return (
  <div
    className={cn(
      "fixed bottom-0 right-0",
      "flex flex-col items-end justify-end",
    )}
    style={{ overflow: "visible" }}
  >
    <Suspense fallback={null}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chatboc-panel"
            className={cn(commonPanelStyles, commonPanelAndButtonAbsoluteClasses)}
            style={{
              width: isMobile ? "100vw" : finalOpenWidth,
              height: isMobile
                ? "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))"
                : finalOpenHeight,
              borderRadius: isMobile ? "0" : "16px",
              background: "#fff",
              opacity: 1,
              zIndex: 10,
              boxShadow: "0 12px 40px 0 rgba(0,0,0,0.18)",
            }}
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.93 }}
            transition={{ type: "spring", stiffness: 250, damping: 22 }}
          >
            {(view === "register" || view === "login" || view === "user") && (
              <ChatHeader
                onClose={toggleChat}
                onBack={() => setView("chat")}
                showProfile={false}
              />
            )}
            {view === "register" ? (
              <ChatUserRegisterPanel
                onSuccess={() => setView("chat")}
                onShowLogin={() => setView("login")}
              />
            ) : view === "login" ? (
              <ChatUserLoginPanel
                onSuccess={() => setView("chat")}
                onShowRegister={() => setView("register")}
              />
            ) : view === "user" ? (
              <ChatUserPanel onClose={() => setView("chat")} />
            ) : (
              <ChatPanel
                mode={mode}
                widgetId={widgetId}
                entityToken={entityToken}
                initialRubro={initialRubro}
                openWidth={finalOpenWidth}
                openHeight={finalOpenHeight}
                onClose={toggleChat}
                tipoChat={tipoChat}
                onRequireAuth={() => setView("register")}
                onShowLogin={() => setView("login")}
                onShowRegister={() => setView("register")}
                onOpenUserPanel={openUserPanel}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!isOpen && (
          <>
            <AnimatePresence>
              {showCta && ctaMessage && (
                <motion.div
                  key="chatboc-cta"
                  className="absolute right-0 text-sm bg-background border rounded-lg shadow-lg px-3 py-2"
                  style={{ bottom: "calc(100% + 8px)" }}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                >
                  {ctaMessage}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.button
              key="chatboc-btn"
              className={cn(
                commonButtonStyles,
                commonPanelAndButtonAbsoluteClasses,
                "w-[96px] h-[96px] border-none shadow-xl",
              )}
              style={{
                borderRadius: "50%",
                background: "var(--primary, #2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 20,
              }}
              initial={{ opacity: 0, scale: 0.87 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.87 }}
              transition={{ type: "spring", stiffness: 320, damping: 16 }}
              onClick={toggleChat}
              aria-label="Abrir chat"
            >
              <motion.span
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 0.9, repeatDelay: 4 }}
              >
                <ChatbocLogoAnimated size={62} blinking floating pulsing />
              </motion.span>
            </motion.button>
          </>
        )}
      </AnimatePresence>
    </Suspense>
   </div>
  );
}

export default ChatWidget;
