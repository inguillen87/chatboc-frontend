import React, { useState, useEffect, useCallback, Suspense } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";
import { getCurrentTipoChat } from "@/utils/tipoChat";
import { motion } from "framer-motion";
const ChatRegisterPanel = React.lazy(() => import("./ChatRegisterPanel"));
import ChatHeader from "./ChatHeader";

const ChatPanel = React.lazy(() => import("./ChatPanel"));

const CIRCLE_SIZE = 88;
const CARD_WIDTH = 370;
const CARD_HEIGHT = 540;

interface ChatWidgetProps {
  mode?: "standalone" | "iframe" | "script";
  initialPosition?: { bottom: number; right: number };
  defaultOpen?: boolean;
  widgetId?: string;
  authToken?: string;
  initialIframeWidth?: string;
  initialIframeHeight?: string;
  tipoChat?: 'pyme' | 'municipio';
}

const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode = "standalone",
  initialPosition = { bottom: 30, right: 30 },
  defaultOpen = false,
  widgetId = "chatboc-widget-iframe",
  authToken,
  initialIframeWidth,
  initialIframeHeight,
  tipoChat = getCurrentTipoChat(),
}) => {
const [isOpen, setIsOpen] = useState(defaultOpen);
const [view, setView] = useState<'chat' | 'register'>('chat');
  const [openWidth, setOpenWidth] = useState<number>(CARD_WIDTH);
  const [openHeight, setOpenHeight] = useState<number>(CARD_HEIGHT);

  useEffect(() => {
    if (mode === "iframe") {
      const width = initialIframeWidth
        ? parseInt(initialIframeWidth as string, 10)
        : typeof window !== "undefined"
          ? Math.min(window.innerWidth, CARD_WIDTH)
          : CARD_WIDTH;
      const height = initialIframeHeight
        ? parseInt(initialIframeHeight as string, 10)
        : typeof window !== "undefined"
          ? Math.min(window.innerHeight, CARD_HEIGHT)
          : CARD_HEIGHT;
      setOpenWidth(width);
      setOpenHeight(height);
    }
  }, [mode, initialIframeWidth, initialIframeHeight]);

  const openDims = { width: `${openWidth}px`, height: `${openHeight}px` };
  const closedDims = { width: `${CIRCLE_SIZE}px`, height: `${CIRCLE_SIZE}px` };

  const sendResizeMessage = useCallback(
    (open: boolean) => {
      if (mode !== "iframe" || typeof window === "undefined") return;
      const dims = open ? openDims : closedDims;
      window.parent.postMessage(
        { type: "chatboc-resize", widgetId, dimensions: dims, isOpen: open },
        "*",
      );
    },
    [mode, widgetId, openDims, closedDims],
  );

  useEffect(() => {
    sendResizeMessage(isOpen);
  }, [isOpen, sendResizeMessage]);

  if (!isOpen) {
    return (
      <div
        className="fixed shadow-xl z-[999999] flex items-center justify-center transition-all duration-300 cursor-pointer"
        style={{
          bottom: initialPosition.bottom,
          right: initialPosition.right,
          width: closedDims.width,
          height: closedDims.height,
          borderRadius: "50%",
          background: "transparent",
        }}
        onClick={() => {
          setView('chat');
          setIsOpen(true);
        }}
        aria-label="Abrir chat"
      >
        <ChatbocLogoAnimated size={62} />
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      {view === 'register' ? (
        <motion.div
          className="fixed z-[999999] flex flex-col shadow-2xl border bg-card text-card-foreground border-border"
          style={{
            bottom: initialPosition.bottom,
            right: initialPosition.right,
            width: mode === 'iframe' ? openDims.width : `${CARD_WIDTH}px`,
            height: mode === 'iframe' ? openDims.height : 'auto',
            borderRadius: 24,
          }}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <ChatHeader onClose={() => { setIsOpen(false); setView('chat'); }} />
          <ChatRegisterPanel onSuccess={() => setView('chat')} />
        </motion.div>
      ) : (
        <ChatPanel
          mode={mode}
          initialPosition={initialPosition}
          widgetId={widgetId}
          authToken={authToken}
          initialIframeWidth={initialIframeWidth}
          initialIframeHeight={initialIframeHeight}
          onClose={() => setIsOpen(false)}
          openWidth={openWidth}
          openHeight={openHeight}
          tipoChat={tipoChat}
          onRequireAuth={() => setView('register')}
        />
      )}
    </Suspense>
  );
};

export default ChatWidget;