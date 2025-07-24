import React from 'react';
import { createRoot } from 'react-dom/client';
import SelfContainedWidget from './components/chat/SelfContainedWidget';
import { GoogleOAuthProvider } from "@react-oauth/google";
import ErrorBoundary from './components/ErrorBoundary';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

const Widget = () => {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <SelfContainedWidget />
    </GoogleOAuthProvider>
  );
};

const container = document.getElementById('root')!;
createRoot(container).render(
    <ErrorBoundary>
        <Widget />
    </ErrorBoundary>
);
