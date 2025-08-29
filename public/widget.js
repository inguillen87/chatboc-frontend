(function () {
  "use strict";

  const script =
    document.currentScript ||
    Array.from(document.getElementsByTagName("script")).find((s) =>
      s.src && s.src.includes("widget.js")
    );

  const DEFAULT_DOMAIN = "https://chatboc.ar";
  const chatbocDomain =
    (script &&
      (script.getAttribute("data-domain") || new URL(script.src).origin)) ||
    DEFAULT_DOMAIN;

  // Ensure only one widget container exists
  const existingRoot = document.getElementById('chatboc-widget-root');
  if (existingRoot) existingRoot.remove();

  const randomId = Math.random().toString(36).substring(2, 9);
  const iframeId = `chatboc-iframe-${randomId}`;
  const containerId = 'chatboc-widget-root';

  const ds = script ? script.dataset : {};

  const cfg = {
    host: chatbocDomain,
    iframePath: ds.iframePath || "/iframe",
    endpoint: ds.endpoint || "municipio",
    entityToken: ds.token || ds.entityToken || "demo-anon",
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
    closedWidth: cfg.closedWidth,
    closedHeight: cfg.closedHeight,
    bottom: cfg.bottom,
    right: cfg.right,
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

  let lastDims = { width: cfg.closedWidth, height: cfg.closedHeight };

  function applyDims(dims) {
    const host = shadow.host;
    const desiredWidth = parseInt(dims.width, 10);
    const maxWidth = window.innerWidth - parseInt(cfg.right, 10);
    host.style.width =
      !isNaN(desiredWidth)
        ? Math.min(desiredWidth, maxWidth) + "px"
        : dims.width;

    const desiredHeight = parseInt(dims.height, 10);
    const maxHeight = window.innerHeight - parseInt(cfg.bottom, 10);
    host.style.height =
      !isNaN(desiredHeight)
        ? Math.min(desiredHeight, maxHeight) + "px"
        : dims.height;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== iframe.contentWindow || event.data.widgetId !== iframeId) {
      return;
    }

    if (event.data.type === "chatboc-state-change") {
      lastDims = event.data.dimensions;
      applyDims(lastDims);
    }
  });

  window.addEventListener("resize", () => applyDims(lastDims));
})();

