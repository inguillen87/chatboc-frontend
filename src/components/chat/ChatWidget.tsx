// src/components/chat/ChatWidget.tsx (VERSIÓN FINAL Y OPTIMIZADA)

import React, { useState, useEffect, useCallback, Suspense } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react"; 
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeLocalStorage"; 

const ChatRegisterPanel = React.lazy(() => import("./ChatRegisterPanel"));
import ChatHeader from "./ChatHeader"; 
const ChatPanel = React.lazy(() => import("./ChatPanel")); 

interface ChatWidgetProps {
  mode?: "standalone" | "iframe" | "script";
  initialPosition?: { bottom: number; right: number }; // Solo para modo standalone
  defaultOpen?: boolean;
  widgetId?: string;
  entityToken?: string; 
  openWidth?: string;
  openHeight?: string;
  closedWidth?: string;
  closedHeight?: string;
  tipoChat?: "pyme" | "municipio";
}

const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode = "standalone",
  defaultOpen = false,
  widgetId = "chatboc-widget-iframe",
  entityToken, 
  openWidth = "370px",
  openHeight = "540px",
  closedWidth = "88px", 
  closedHeight = "88px",
  tipoChat = getCurrentTipoChat(),
  initialPosition = { bottom: 32, right: 32 }, // Mantener para standalone
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [view, setView] = useState<'chat' | 'register'>('chat');

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

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
    [mode, widgetId, finalOpenWidth, finalOpenHeight, finalClosedWidth, finalClosedHeight]
  );

  useEffect(() => {
    sendStateMessageToParent(isOpen);
  }, [isOpen, sendStateMessageToParent]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "TOGGLE_CHAT" && event.data.widgetId === widgetId) {
        setIsOpen(event.data.isOpen);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [widgetId]);

  const toggleChat = () => setIsOpen((open) => !open);

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
        bottom: `calc(${initialPosition.bottom}px + env(safe-area-inset-bottom))`,
        right: `calc(${initialPosition.right}px + env(safe-area-inset-right))`,
        left: "auto",
        top: "auto",
        width: isOpen ? (isMobile ? "96vw" : finalOpenWidth) : finalClosedWidth,
        height: isOpen ? (isMobile ? "96vh" : finalOpenHeight) : finalClosedHeight,
        minWidth: isOpen ? "320px" : finalClosedWidth,
        minHeight: isOpen ? "64px" : finalClosedHeight,
        maxWidth: "98vw",
        maxHeight: "98vh",
        borderRadius: isOpen ? "24px" : "50%",
        overflow: "hidden",
        boxShadow: "0 8px 32px 0 rgba(0,0,0,0.20)",
        background: isOpen ? "#fff" : "var(--primary, #2563eb)",
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
              style={{ borderRadius: "24px", background: "#fff" }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 250, damping: 18 }}
            >
              <ChatHeader onClose={toggleChat} />
              {view === "register" ? (
                <ChatRegisterPanel onSuccess={() => setView("chat")} />
              ) : (
                <ChatPanel
                  mode={mode}
                  widgetId={widgetId}
                  entityToken={entityToken}
                  openWidth={finalOpenWidth}
                  openHeight={finalOpenHeight}
                  onClose={toggleChat}
                  tipoChat={tipoChat}
                  onRequireAuth={() => setView("register")}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {!isOpen && (
          <motion.button
            key="chatboc-btn"
            className={cn(
              commonButtonStyles,
              "w-[88px] h-[88px] absolute bottom-0 right-0 border-none shadow-xl",
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
              <ChatbocLogoAnimated size={isMobile ? 42 : 62} blinking />
            </motion.span>
          </motion.button>
        )}
      </Suspense>
    </div>
  );
}


  // Modo iframe (este es el que se usa cuando el widget se incrusta en otras páginas)
  // Este div NO debe ser fixed. Su padre (el iframe) ya es fixed.
  // Este div ocupará el 100% del iframe.
  return (
  <div
    className={cn(
      "relative w-full h-full",
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
              width: finalOpenWidth,
              height: finalOpenHeight,
              borderRadius: "20px",
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
            <ChatHeader onClose={toggleChat} />
            {view === "register" ? (
              <ChatRegisterPanel onSuccess={() => setView("chat")} />
            ) : (
              <ChatPanel
                mode={mode}
                widgetId={widgetId}
                entityToken={entityToken}
                openWidth={finalOpenWidth}
                openHeight={finalOpenHeight}
                onClose={toggleChat}
                tipoChat={tipoChat}
                onRequireAuth={() => setView("register")}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="chatboc-btn"
            className={cn(
              commonButtonStyles,
              commonPanelAndButtonAbsoluteClasses,
              "w-[88px] h-[88px] border-none shadow-xl",
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
              <ChatbocLogoAnimated size={62} blinking />
            </motion.span>
          </motion.button>
        )}
      </AnimatePresence>
    </Suspense>
   </div>
  );
} // <-- ¡NO TE


export default ChatWidget;