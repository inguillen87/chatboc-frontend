import React, { useMemo, Suspense } from "react";
import { TenantProvider, useTenantContextPresence } from "@/context/TenantContext";
import { MemoryRouter, useInRouterContext } from "react-router-dom";
import ChatWidgetInner from "./ChatWidgetInner";
import type { ChatWidgetProps } from "./types";

const ChatWidget: React.FC<ChatWidgetProps> = (props) => {
  const tenantContext = useTenantContextPresence();
  const isInRouter = useInRouterContext();

  const initialEntry = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return `${window.location.pathname}${window.location.search}`;
  }, []);

  // Suspense fallback
  const loader = (
    <div className="w-12 h-12 flex items-center justify-center bg-transparent rounded-full overflow-hidden">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!tenantContext) {
    const widgetTree = (
      <TenantProvider>
        <Suspense fallback={loader}>
           <ChatWidgetInner {...props} />
        </Suspense>
      </TenantProvider>
    );

    if (isInRouter) {
      return widgetTree;
    }

    return (
      <MemoryRouter initialEntries={[initialEntry]}>
        {widgetTree}
      </MemoryRouter>
    );
  }

  return (
    <Suspense fallback={loader}>
        <ChatWidgetInner {...props} />
    </Suspense>
  );
};

export default ChatWidget;
