(function () {
  "use strict";

  const script =
    document.currentScript ||
    Array.from(document.getElementsByTagName("script")).find((s) =>
      s.src && s.src.includes("widget.js")
    );

  const DEFAULT_DOMAIN = "https://www.chatboc.ar";
  const chatbocDomain =
    (script &&
      (script.getAttribute("data-domain") || new URL(script.src).origin)) ||
    DEFAULT_DOMAIN;

  const randomId = Math.random().toString(36).substring(2, 9);
  const iframeId = `chatboc-iframe-${randomId}`;
  const containerId = `chatboc-widget-container-${randomId}`;

  const ds = script ? script.dataset : {};

  const cfg = {
    host: chatbocDomain,
    iframePath: ds.iframePath || "/iframe",
    endpoint: ds.endpoint || "municipio",
    entityToken: ds.token || "demo-anon",
    defaultOpen: ds.defaultOpen === "true",
    width: ds.width || "460px",
    height: ds.height || "680px",
    closedWidth: ds.closedWidth || "72px",
    closedHeight: ds.closedHeight || "72px",
    bottom: ds.bottom || "20px",
    right: ds.right || "20px",
  };

  const qs = new URLSearchParams({
    endpoint: cfg.endpoint,
    entityToken: cfg.entityToken,
    defaultOpen: String(cfg.defaultOpen),
    width: cfg.width,
    height: cfg.height,
    widgetId: iframeId,
    hostDomain: window.location.origin,
  });

  const iframeSrc = `${cfg.host}${cfg.iframePath}?${qs.toString()}`;

  const container = document.createElement("div");
  container.id = containerId;
  document.body.appendChild(container);

  const shadow = container.attachShadow({ mode: "open" });

  const iframe = document.createElement("iframe");
  iframe.id = iframeId;
  iframe.title = "Chatboc Widget";
  iframe.src = iframeSrc;
  iframe.style.cssText =
    "width: 100%; height: 100%; border: none; background: transparent;";
  iframe.allow = "microphone; geolocation; clipboard-write";
  iframe.sandbox =
    "allow-forms allow-popups allow-modals allow-scripts allow-same-origin allow-downloads";

  const style = document.createElement("style");
  style.textContent = `
    :host {
      position: fixed;
      bottom: ${cfg.bottom};
      right: ${cfg.right};
      width: ${cfg.closedWidth};
      height: ${cfg.closedHeight};
      z-index: 2147483647;
      border: none;
      background: transparent;
      overflow: visible;
      transition: width 0.3s ease, height 0.3s ease;
    }
  `;

  shadow.appendChild(style);
  shadow.appendChild(iframe);

  window.addEventListener("message", (event) => {
    if (event.source !== iframe.contentWindow || event.data.widgetId !== iframeId) {
      return;
    }

    if (event.data.type === "chatboc-state-change") {
      const { dimensions } = event.data;
      const host = shadow.host;
      host.style.width = dimensions.width;
      host.style.height = dimensions.height;
    }
  });
})();

