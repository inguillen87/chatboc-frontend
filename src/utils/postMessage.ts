/**
 * Utility for safe cross-origin communication between the iframe widget and the host page.
 */

// Define the structure of messages sent from the iframe to the host
interface HostMessage {
  type: "CHATBOC_RESIZE_CONTAINER";
  widgetId: string;
  style: {
    width: string;
    height: string;
    bottom: string;
    right: string;
    borderRadius: string;
    boxShadow: string;
    transition: string;
  };
}

// Define the structure of messages sent from the host to the iframe
interface IframeMessage {
  type: "CHATBOC_OPEN" | "CHATBOC_CLOSE" | "CHATBOC_TOGGLE" | "CHATBOC_SET_VIEW";
  widgetId: string;
  view?: 'chat' | 'register' | 'login' | 'user' | 'info';
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
      // Security: Always verify the origin of the message.
      if (event.origin !== hostDomain) {
        return;
      }

      const data = event.data as IframeMessage;

      // Ensure the message is for this widget instance
      if (data && data.widgetId === widgetId) {
        handler(data);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [widgetId, hostDomain, handler]);
}
