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

  const finalOpenWidth = openWidth || "370px";
  const finalOpenHeight = openHeight || "540px";
  const finalClosedWidth = closedWidth || "88px";
  const finalClosedHeight = closedHeight || "88px";

  // Responsive único: todo controlado desde acá
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const widgetWidth = isOpen
    ? isMobile
      ? "96vw"
      : finalOpenWidth
    : isMobile
    ? "64px"
    : finalClosedWidth;
  const widgetHeight = isOpen
    ? isMobile
      ? "96vh"
      : finalOpenHeight
    : isMobile
    ? "64px"
    : finalClosedHeight;
  const standaloneIframe = mode === "iframe";

  // Comando para avisar a parent (NO TOCAR)
  const sendStateMessageToParent = useCallback(
    (open: boolean) => {
      if (mode === "iframe" && typeof window !== "undefined" && window.parent !== window && widgetId) {
        const dims = open
          ? { width: widgetWidth, height: widgetHeight }
          : { width: finalClosedWidth, height: finalClosedHeight };
        window.parent.postMessage({ type: "chatboc-state-change", widgetId, dimensions: dims, isOpen: open }, "*");
      }
    },
    [mode, widgetId, widgetWidth, widgetHeight, finalClosedWidth, finalClosedHeight]
  );

  useEffect(() => {
    sendStateMessageToParent(isOpen);
  }, [isOpen, sendStateMessageToParent]);

  // Permite toggle externo por mensaje (usalo si querés cerrar el chat desde afuera)
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

  return (
    <div className="z-[999999]">
      <Suspense fallback={null}>
        {/* Panel principal: acá vive toda la estética */}
        <motion.div
          className={cn(
            "chatboc-panel-wrapper",
            "fixed z-[999999]",
            "bg-card border shadow-2xl",
            "flex flex-col overflow-hidden",
            "transition-all duration-300",
            isOpen ? "pointer-events-auto" : "pointer-events-none"
          )}
          style={{
            bottom: standaloneIframe ? undefined : `calc(${initialPosition.bottom}px + env(safe-area-inset-bottom))`,
            right: standaloneIframe ? undefined : `calc(${initialPosition.right}px + env(safe-area-inset-right))`,
            top: standaloneIframe ? "50%" : undefined,
            left: standaloneIframe ? "50%" : undefined,
            transform: standaloneIframe ? "translate(-50%, -50%)" : undefined,
            transformOrigin: standaloneIframe ? "center" : "bottom right",
            background: "var(--background, #f8fafc)",
            width: widgetWidth,
            height: widgetHeight,
            minWidth: "320px",
            minHeight: "64px",
            maxWidth: "98vw",
            maxHeight: "98vh",
            borderRadius: isOpen ? "24px" : "50%",
            opacity: isOpen ? 1 : 0,
            scale: isOpen ? 1 : 0.85,
            transformOrigin: "bottom right",
          }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={isOpen ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.7 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
        >
          {isOpen && (
            <>
              <ChatHeader onClose={toggleChat} />
              {view === 'register' ? (
                <ChatRegisterPanel onSuccess={() => setView('chat')} />
              ) : (
                <ChatPanel
                  mode={mode}
                  widgetId={widgetId}
                  entityToken={entityToken}
                  openWidth={widgetWidth}
                  openHeight={widgetHeight}
                  onClose={toggleChat}
                  tipoChat={tipoChat}
                  onRequireAuth={() => setView('register')}
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
              "fixed z-[999999]",
              "rounded-full flex items-center justify-center",
              "bg-primary text-primary-foreground hover:bg-primary/90",
              "shadow-lg transition-all duration-300",
              "opacity-100 scale-100 pointer-events-auto"
            )}
            style={{
              bottom: `calc(${initialPosition.bottom}px + env(safe-area-inset-bottom))`,
              right: `calc(${initialPosition.right}px + env(safe-area-inset-right))`,
              width: finalClosedWidth,
              height: finalClosedHeight,
              borderRadius: "50%",
              background: 'var(--primary)',
              minWidth: isMobile ? "64px" : finalClosedWidth,
              minHeight: isMobile ? "64px" : finalClosedHeight,
            }}
            onClick={toggleChat}
            aria-label="Abrir chat"
          >
            <motion.span
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 0.8, repeatDelay: 4 }}
            >
              <ChatbocLogoAnimated
                size={parseInt((isMobile ? "64" : closedWidth).toString(), 10) * 0.7}
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
