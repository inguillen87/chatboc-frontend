(function () {
  "use strict";

  // Debounce function to limit the rate at which a function get fired.
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function init() {
    const script = document.currentScript || Array.from(document.getElementsByTagName("script")).find(s => s.src && s.src.includes("widget.js"));
    if (!script) {
      console.error("Chatboc widget.js FATAL: script tag not found.");
      return;
    }

    const token = script.getAttribute("data-token") || "demo-anon";
    const registry = (window.__chatbocWidgets = window.__chatbocWidgets || {});
    if (registry[token]) {
      console.warn(`Chatboc widget with token ${token} already loaded. Skipping.`);
      return;
    }

    const chatbocDomain = script.getAttribute("data-domain") || new URL(script.src).origin;
    const iframeId = `chatboc-iframe-${Math.random().toString(36).substring(2, 9)}`;

    // Create a container for the iframe. This will just hold the iframe and nothing else.
    const widgetContainer = document.createElement("div");
    widgetContainer.id = `chatboc-widget-container-${iframeId}`;
    widgetContainer.style.cssText = "position: fixed; bottom: 0; right: 0; width: 0; height: 0; z-index: 2147483647; border: none; background: transparent; overflow: hidden;";
    document.body.appendChild(widgetContainer);

    const iframe = document.createElement("iframe");
    iframe.id = iframeId;
    iframe.title = "Chatboc Widget";
    iframe.style.cssText = "width: 100%; height: 100%; border: none; background: transparent;";
    iframe.allow = "clipboard-write; geolocation";

    // Collect all data attributes to pass them to the iframe URL
    const params = new URLSearchParams();
    for (const attr of script.attributes) {
      if (attr.name.startsWith('data-')) {
        params.set(attr.name.replace('data-', ''), attr.value);
      }
    }
    params.set('widgetId', iframeId);
    params.set('token', token);

    // Ensure the domain is passed so the iframe knows where to post messages back to
    params.set('hostDomain', window.location.origin);

    iframe.src = `${chatbocDomain}/iframe.html?${params.toString()}`;

    widgetContainer.appendChild(iframe);

    // The iframe will send a message to set its container's size and position.
    function messageHandler(event) {
      // Security: Always check the origin of the message
      if (event.origin !== chatbocDomain) {
        return;
      }
      if (event.data && event.data.widgetId === iframeId) {
        if (event.data.type === "CHATBOC_RESIZE_CONTAINER") {
          const { width, height, bottom, right, borderRadius, boxShadow, transition } = event.data.style;
          widgetContainer.style.width = width;
          widgetContainer.style.height = height;
          widgetContainer.style.bottom = bottom;
          widgetContainer.style.right = right;
          widgetContainer.style.borderRadius = borderRadius || '0px';
          widgetContainer.style.boxShadow = boxShadow || 'none';
          widgetContainer.style.transition = transition || 'none';
        }
      }
    }

    window.addEventListener("message", messageHandler);

    // API to communicate with the iframe
    function postToIframe(msg) {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ ...msg, widgetId: iframeId }, chatbocDomain);
      }
    }

    function destroy() {
      window.removeEventListener("message", messageHandler);
      widgetContainer.remove();
      delete registry[token];
    }

    registry[token] = { destroy, post: postToIframe };

    // Global API
    if (!window.Chatboc) window.Chatboc = {};
    window.Chatboc.setView = (view) => postToIframe({ type: "CHATBOC_SET_VIEW", view });
    window.Chatboc.open = () => postToIframe({ type: "CHATBOC_OPEN" });
    window.Chatboc.close = () => postToIframe({ type: "CHATBOC_CLOSE" });
    window.Chatboc.toggle = () => postToIframe({ type: "CHATBOC_TOGGLE" });

    // Function to destroy a specific widget instance
    if (!window.chatbocDestroyWidget) {
      window.chatbocDestroyWidget = function (tok) {
        if (registry[tok] && typeof registry[tok].destroy === "function") {
          registry[tok].destroy();
        }
      };
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
