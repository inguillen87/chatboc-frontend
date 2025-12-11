import React, { useMemo } from "react";
import { TenantProvider, useTenantContextPresence } from "@/context/TenantContext";
import { MemoryRouter, useInRouterContext } from "react-router-dom";
import ChatWidgetInner, { ChatWidgetProps } from "./ChatWidgetInner";

const ChatWidget: React.FC<ChatWidgetProps> = (props) => {
  const tenantContext = useTenantContextPresence();
  const isInRouter = useInRouterContext();

  const initialEntry = useMemo(() => {
    if (typeof window === "undefined") return "/";
    return `${window.location.pathname}${window.location.search}`;
  }, []);

  if (!tenantContext) {
    const widgetTree = (
      <TenantProvider>
        <ChatWidgetInner {...props} />
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

  return <ChatWidgetInner {...props} />;
};

export default ChatWidget;
