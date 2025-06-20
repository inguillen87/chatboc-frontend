import React, { useState, useEffect, useCallback, Suspense } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { safeLocalStorage } from "@/utils/safeLocalStorage";

const ChatRegisterPanel = React.lazy(() => import("./ChatRegisterPanel"));
import ChatHeader from "./ChatHeader";
const ChatPanel = React.lazy(() => import("./ChatPanel"));

interface ChatWidgetProps {
  mode?: "standalone" | "iframe" | "script";
  initialPosition?: { bottom: number; right: number };
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
  initialPosition = { bottom: 32, right: 32 },
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [view, setView] = useState<'chat' | 'register'>('chat');

  // Adaptabilidad real: mobile, iframe, script, etc
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  // Usar solo width/height, NUNCA min/max ni hardcodear px de más.
  const widgetWidth = isOpen
    ? (isMobile ? "98vw" : openWidth)
    : (isMobile ? "60px" : closedWidth);

  const widgetHeight = isOpen
    ? (isMobile ? "96vh" : openHeight)
    : (isMobile ? "60px" : closedHeight);

  // Modo iframe: centrado. Script/standalone: abajo a la derecha.
  const mainPosition = mode === "iframe"
    ? {
        position: "fixed" as "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        margin: 0,
        padding: 0,
      }
    : {
        position: "fixed" as "fixed",
        bottom: `calc(${initialPosition.bottom}px + env(safe-area-inset-bottom, 0px))`,
        right: `calc(${initialPosition.right}px + env(safe-area-inset-right, 0px))`,
        margin: 0,
        padding: 0,
      };

  // Permite avisar a parent (iframe) para redimensionar si hace falta
  const sendStateMessageToParent = useCallback(
    (open: boolean) => {
      if (
        mode === "iframe" &&
        typeof window !== "undefined" &&
        window.parent !== window &&
        widgetId
      ) {
        const dims = open
          ? { width: widgetWidth, height: widgetHeight }
          : { width: closedWidth, height: closedHeight };
        window.parent.postMessage(
          { type: "chatboc-state-change", widgetId, dimensions: dims, isOpen: open },
          "*"
        );
      }
    },
    [mode, widgetId, widgetWidth, widgetHeight, closedWidth, closedHeight]
  );

  useEffect(() => {
    sendStateMessageToParent(isOpen);
  }, [isOpen, sendStateMessageToParent]);

  // Permite toggle externo (ej: desde el host)
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
    if (entityToken) {
      safeLocalStorage.setItem("entityToken", entityToken);
    }
  }, [entityToken]);

  // --- STYLES y estructura ---
  return (
    <div style={{ zIndex: 999999, position: "relative" }}>
      <Suspense fallback={null}>
        <motion.div
          className={cn(
            "chatboc-panel-wrapper",
            "bg-card border shadow-2xl",
            "flex flex-col overflow-hidden",
            "transition-all duration-300",
            isOpen ? "pointer-events-auto" : "pointer-events-none"
          )}
          style={{
            ...mainPosition,
            zIndex: 999999,
            width: widgetWidth,
            height: widgetHeight,
            borderRadius: isOpen ? "24px" : "50%",
            opacity: isOpen ? 1 : 0,
            scale: isOpen ? 1 : 0.90,
            boxShadow: "0 10px 36px 0 rgba(0,0,0,0.20)",
            background: "var(--background, #f5f8fa)", // fallback seguro
            maxWidth: "98vw",
            maxHeight: "98vh",
            minWidth: isOpen ? (isMobile ? "180px" : "320px") : (isMobile ? "60px" : closedWidth),
            minHeight: isOpen ? (isMobile ? "180px" : "160px") : (isMobile ? "60px" : closedHeight),
            overflow: "hidden",
            transition: "all 0.2s cubic-bezier(.4,2,.4,1)",
          }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={isOpen ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
        >
          {isOpen && (
            <>
              <ChatHeader onClose={toggleChat} />
              {view === "register" ? (
                <ChatRegisterPanel onSuccess={() => setView("chat")} />
              ) : (
                <ChatPanel
                  mode={mode}
                  widgetId={widgetId}
                  entityToken={entityToken}
                  openWidth={widgetWidth}
                  openHeight={widgetHeight}
                  onClose={toggleChat}
                  tipoChat={tipoChat}
                  onRequireAuth={() => setView("register")}
                />
              )}
            </>
          )}
        </motion.div>

        {/* Botón flotante */}
        {!isOpen && (
          <Button
            className={cn(
              "chatboc-toggle-button",
              "rounded-full flex items-center justify-center",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "shadow-lg transition-all duration-300",
              "opacity-100 scale-100 pointer-events-auto"
            )}
            style={{
              ...mainPosition,
              width: closedWidth,
              height: closedHeight,
              borderRadius: "50%",
              background: "var(--primary, #2260ff)",
              minWidth: isMobile ? "60px" : closedWidth,
              minHeight: isMobile ? "60px" : closedHeight,
              zIndex: 999999,
            }}
            onClick={toggleChat}
            aria-label="Abrir chat"
          >
            <motion.span
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 0.8, repeatDelay: 4 }}
            >
              <ChatbocLogoAnimated
                size={parseInt((isMobile ? "60" : closedWidth).toString(), 10) * 0.7}
                blinking
              />
            </motion.span>
          </Button>
        )}
      </Suspense>
    </div>
  );
};

export default ChatWidget;
