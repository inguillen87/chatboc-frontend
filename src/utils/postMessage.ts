// utils/postMessage.ts

/**
 * Utility for safe cross-origin communication between the iframe widget and the host page.
 */
import { useEffect } from "react";

// Define the structure of messages sent from the iframe to the host
interface HostMessage {
  type: "CHATBOC_RESIZE_CONTAINER" | "chatboc-state-change" | "chatboc-ready" | "chatboc:auth-token";
  widgetId?: string;
  style?: {
    width: string;
    height: string;
    bottom: string;
    right: string;
    borderRadius: string;
    boxShadow: string;
    transition: string;
  };
  dimensions?: {
    width: string;
    height: string;
  };
  isOpen?: boolean;
  token?: string;
  tenant?: string | null;
  source?: string;
  emittedAt?: number;
}

// Define the structure of messages sent from the host to the iframe
interface IframeMessage {
  type: "CHATBOC_OPEN" | "CHATBOC_CLOSE" | "CHATBOC_TOGGLE" | "CHATBOC_SET_VIEW" | "OPEN_CHAT_WITH_CONTEXT";
  widgetId?: string;
  view?: 'chat' | 'register' | 'login' | 'user' | 'info';
  tenantSlug?: string;
  tipoChat?: 'pyme' | 'municipio';
  context?: any;
}

/**
 * Sends a message from the iframe to the host window.
 * @param message The message object to send.
 * @param hostDomain The domain of the host page for security.
 */
export function sendMessageToHost(message: HostMessage, hostDomain: string) {
  if (typeof window !== 'undefined' && window.parent !== window) {
    // Important: The second argument specifies the target origin.
    // This is a crucial security measure to prevent sending data to malicious sites.
    // If hostDomain is '*', we rely on the receiver to validate the message.
    window.parent.postMessage(message, hostDomain);
  }
}

/**
 * A hook for handling messages received from the host window.
 * @param widgetId The ID of the current widget instance.
 * @param hostDomain The expected domain of the host page.
 * @param handler A function to process the received message.
 */
export function useHostMessageHandler(
  widgetId: string,
  hostDomain: string,
  handler: (data: IframeMessage) => void
) {
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 1. Basic Availability Check
      if (!event.data) return;
      const d = event.data;

      // 2. Strict Noise Filtering (Extensions, Google Maps, React DevTools)
      // Filter known extension noise
      if (d?.target === 'inpage' || d?.target === 'contentscript') return;
      if (typeof d?.target === 'string' && d.target.startsWith('metamask-')) return;
      if (d?.source === 'react-devtools-bridge') return;
      // Filter Google Maps / Third-party embed noise
      if (typeof event.origin === 'string' && (
          event.origin.includes('maps.google') ||
          event.origin.includes('googleusercontent') ||
          event.origin.includes('youtube.com')
      )) return;

      // 3. Security: Verify Origin
      // If hostDomain is '*', we accept from anywhere but must validate payload structure.
      // If hostDomain is specific, we strictly enforce it.
      if (hostDomain !== '*' && event.origin !== hostDomain) {
        return;
      }

      // 4. Payload Validation
      // Ensure the message is relevant to our widget
      const isGlobalOpen = d === "OPEN_CHAT" || d?.type === "OPEN_CHAT" || d?.type === "OPEN_CHAT_WITH_CONTEXT";
      const isTargeted = d && d.widgetId === widgetId;

      if (isGlobalOpen || isTargeted) {
        handler(d as IframeMessage);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [widgetId, hostDomain, handler]);
}

const isEmbeddedContext = () => typeof window !== "undefined" && window.parent !== window;

/**
 * Broadcasts the current auth token to the host page so it can persist
 * the session outside the iframe (e.g., for external widget embeds).
 */
export function broadcastAuthTokenToHost(
  token: string | null | undefined,
  tenant?: string | null,
  source: string = "widget",
) {
  if (!token || typeof token !== "string" || !token.trim()) return;
  if (!isEmbeddedContext()) return;

  const message: HostMessage = {
    type: "chatboc:auth-token",
    token,
    tenant: tenant || undefined,
    source,
    emittedAt: Date.now(),
  };

  try {
    window.parent.postMessage(message, "*");
  } catch (error) {
    console.warn("[postMessage] No se pudo enviar el token al host", error);
  }
}
