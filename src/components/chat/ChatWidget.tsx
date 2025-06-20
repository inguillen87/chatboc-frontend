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
  initialPosition = { bottom: 30, right: 30 },
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [view, setView] = useState<'chat' | 'register'>('chat');

  // Responsive para mobile
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const widgetWidth = isMobile ? "98vw" : openWidth;
  const widgetHeight = isMobile ? "80vh" : openHeight;
  const bubbleSize = isMobile ? "64px" : closedWidth;

  // Mensaje al parent si está en iframe
  const sendStateMessageToParent = useCallback(
    (open: boolean) => {
      if (mode === "iframe" && typeof window !== "undefined" && window.parent !== window && widgetId) {
        const dims = open
          ? { width: widgetWidth, height: widgetHeight }
          : { width: bubbleSize, height: bubbleSize };
        window.parent.postMessage({ type: "chatboc-state-change", widgetId, dimensions: dims, isOpen: open }, "*");
      }
    },
    [mode, widgetId, widgetWidth, widgetHeight, bubbleSize]
  );

  useEffect(() => {
    sendStateMessageToParent(isOpen);
  }, [isOpen, sendStateMessageToParent]);

  // Escucha de toggle externo (postMessage)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "TOGGLE_CHAT" && event.data.widgetId === widgetId) {
        const newIsOpen = event.data.isOpen;
        if (newIsOpen !== isOpen) setIsOpen(newIsOpen);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [widgetId, isOpen]);

  const toggleChat = () => setIsOpen((open) => !open);

  useEffect(() => {
    if (entityToken) {
      safeLocalStorage.setItem("entityToken", entityToken);
    }
  }, [entityToken]);

  return (
    <div className="z-[999999]">
      <Suspense fallback={null}>
        {/* Panel principal */}
        <motion.div
          className={cn(
            "chatboc-panel-wrapper",
            "fixed z-[999999]",
            "bg-card border shadow-2xl rounded-3xl",
            "flex flex-col overflow-hidden",
            "transition-all duration-300",
            isOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-90 pointer-events-none"
          )}
          style={{
            bottom: initialPosition.bottom,
            right: initialPosition.right,
            width: widgetWidth,
            height: widgetHeight,
            minWidth: "280px",
            maxWidth: "98vw",
            maxHeight: "98vh",
            borderRadius: "24px",
          }}
          initial={{ opacity: 0, scale: 0.6, y: 30 }}
          animate={isOpen ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.6, y: 30 }}
          exit={{ opacity: 0, scale: 0.6, y: 30 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
        >
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
        </motion.div>

        {/* Botón flotante */}
        <Button
          className={cn(
            "chatboc-toggle-button",
            "fixed z-[999999]",
            "rounded-full flex items-center justify-center",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "shadow-lg transition-all duration-300",
            isOpen ? "opacity-0 scale-0 pointer-events-none" : "opacity-100 scale-100 pointer-events-auto"
          )}
          style={{
            bottom: initialPosition.bottom,
            right: initialPosition.right,
            width: bubbleSize,
            height: bubbleSize,
            borderRadius: "50%",
            background: 'var(--primary)',
          }}
          onClick={toggleChat}
          aria-label={isOpen ? "Cerrar chat" : "Abrir chat"}
        >
          {isOpen ? <X className="h-8 w-8" /> : <MessageCircle className="h-8 w-8" />}
          {!isOpen && (
            <motion.span
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 0.8, repeatDelay: 4 }}
            >
              <ChatbocLogoAnimated
                size={parseInt(bubbleSize.toString(), 10) * 0.7}
              />
            </motion.span>
          )}
        </Button>
      </Suspense>
    </div>
  );
};

export default ChatWidget;
