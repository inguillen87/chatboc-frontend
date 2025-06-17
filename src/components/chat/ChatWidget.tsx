import React, { useState, useEffect, useCallback, Suspense } from "react";
import ChatbocLogoAnimated from "./ChatbocLogoAnimated";

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
}

const ChatWidget: React.FC<ChatWidgetProps> = ({
  mode = "standalone",
  initialPosition = { bottom: 30, right: 30 },
  defaultOpen = false,
  widgetId = "chatboc-widget-iframe",
  authToken,
  initialIframeWidth,
  initialIframeHeight,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
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
        onClick={() => setIsOpen(true)}
        aria-label="Abrir chat"
      >
        <ChatbocLogoAnimated size={62} />
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
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
      />
    </Suspense>
  );
};

export default ChatWidget;
