import "../index.css";
import { createRoot } from 'react-dom/client';
import React from "react";
import ChatWidget from "../components/chat/ChatWidget";
import { GoogleOAuthProvider } from "@react-oauth/google";
import ErrorBoundary from '../components/ErrorBoundary';
import { MemoryRouter } from "react-router-dom";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

// Read config from the global object set by iframe.html
const cfg = (window as any).CHATBOC_CONFIG || {};

const IframeApp = () => {
  const ChatWidgetComponent = () => (
    <ChatWidget
      mode="iframe"
      entityToken={cfg.entityToken}
      defaultOpen={cfg.defaultOpen}
      tipoChat={cfg.endpoint}
      openWidth={cfg.width}
      openHeight={cfg.height}
    />
  );

  if (!GOOGLE_CLIENT_ID) {
    return (
      <MemoryRouter>
        <ChatWidgetComponent />
      </MemoryRouter>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <MemoryRouter>
        <ChatWidgetComponent />
      </MemoryRouter>
    </GoogleOAuthProvider>
  );
};

const container = document.getElementById('root')!;
createRoot(container).render(
  <ErrorBoundary>
    <IframeApp />
  </ErrorBoundary>
);
