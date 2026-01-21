(function () {
  "use strict";

  const script =
    document.currentScript ||
    Array.from(document.getElementsByTagName("script")).find((s) =>
      s.src && s.src.includes("widget.js")
    );

  const DEFAULT_DOMAIN = "https://chatboc.ar";
  const scriptOrigin = (() => {
    if (!script || !script.src) return DEFAULT_DOMAIN;
    try {
      return new URL(script.src).origin;
    } catch (err) {
      console.warn(
        "[Chatboc] No pudimos leer el origen del script del widget. Usando el dominio por defecto.",
        err,
      );
      return DEFAULT_DOMAIN;
    }
  })();

  const providedDomain = script?.getAttribute("data-domain");

  const chatbocDomain = (() => {
    if (providedDomain) {
      try {
        return new URL(providedDomain).origin;
      } catch (err) {
        console.warn(
          `[Chatboc] data-domain="${providedDomain}" no es una URL válida. Se usará ${DEFAULT_DOMAIN}.`,
          err,
        );
        return DEFAULT_DOMAIN;
      }
    }

    if (scriptOrigin) {
      if (scriptOrigin !== DEFAULT_DOMAIN) {
        console.warn(
          `[Chatboc] data-domain no está definido. Se usará el origen del script (${scriptOrigin}) para mantener coherencia de dominio.`,
        );
      }
      return scriptOrigin;
    }

    return DEFAULT_DOMAIN;
  })();

  // Ensure only one widget container exists
  const existingRoot = document.getElementById('chatboc-widget-root');
  if (existingRoot) existingRoot.remove();

  const randomId = Math.random().toString(36).substring(2, 9);
  const iframeId = `chatboc-iframe-${randomId}`;
  const containerId = 'chatboc-widget-root';

  const ds = script ? script.dataset : {};
  const useShadowDom = ds.shadowDom !== "false";

  const normalizeLength = (value, fallback) => {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;

    // Accept values with CSS units or percentages as-is
    const hasUnit = /[%a-zA-Z)]$/.test(trimmed);
    if (hasUnit) return trimmed;

    // Numeric values are coerced to px
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return `${numeric}px`;

    return fallback;
  };

  const normalizeColor = (value, fallback) => {
    if (typeof value !== "string") return fallback;
    const trimmed = value.trim();
    return trimmed ? trimmed : fallback;
  };

  const cfg = {
    host: chatbocDomain,
    iframePath: ds.iframePath || "/iframe",
    endpoint: ds.endpoint || "municipio",
    tenantSlug: ds.tenantSlug || ds.tenant_slug || ds.tenant || "",
    entityToken:
      ds.token ||
      ds.entityToken ||
      ds.entity_token ||
      ds.ownerToken ||
      ds.owner_token ||
      ds.widgetToken ||
      ds.widget_token ||
      "demo-anon",
    defaultOpen: ds.defaultOpen === "true",
    width: normalizeLength(ds.width, "480px"),
    height: normalizeLength(ds.height, "750px"),
    closedWidth: normalizeLength(ds.closedWidth, "72px"),
    closedHeight: normalizeLength(ds.closedHeight, "72px"),
    bottom: normalizeLength(ds.bottom, "20px"),
    right: normalizeLength(ds.right, "20px"),
    primaryColor: normalizeColor(ds.primaryColor, "#007aff"),
    accentColor: normalizeColor(ds.accentColor, ""),
    logoUrl: normalizeColor(ds.logoUrl, ""),
    headerLogoUrl: normalizeColor(ds.headerLogoUrl || ds.logoUrl, ""),
    logoAnimation: normalizeColor(ds.logoAnimation, ""),
    welcomeTitle: normalizeColor(ds.welcomeTitle, ""),
    welcomeSubtitle: normalizeColor(ds.welcomeSubtitle, ""),
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
    primaryColor: cfg.primaryColor,
    accentColor: cfg.accentColor,
    logoUrl: cfg.logoUrl,
    headerLogoUrl: cfg.headerLogoUrl,
    logoAnimation: cfg.logoAnimation,
    welcomeTitle: cfg.welcomeTitle,
    welcomeSubtitle: cfg.welcomeSubtitle,
  });

  if (cfg.tenantSlug) {
    qs.set("tenantSlug", cfg.tenantSlug);
    qs.set("tenant", cfg.tenantSlug);
  }

  const iframeSrc = `${cfg.host}${cfg.iframePath}?${qs.toString()}`;

  const container = document.createElement("div");
  container.id = containerId;
  document.body.appendChild(container);

  let root;
  if (useShadowDom) {
    root = container.attachShadow({ mode: "open" });
  } else {
    root = container;
  }

  const iframe = document.createElement("iframe");
  iframe.id = iframeId;
  iframe.title = "Chatboc Widget";
  iframe.src = iframeSrc;
  iframe.style.cssText =
    "width: 100%; height: 100%; border: none; background: transparent;";
  iframe.allow = "microphone; geolocation; clipboard-write; camera";
  // Allow popups to fully open outside of the sandbox so links like WhatsApp URLs work
  iframe.sandbox = [
    "allow-forms",
    "allow-popups",
    "allow-popups-to-escape-sandbox",
    "allow-top-navigation-by-user-activation",
    "allow-modals",
    "allow-scripts",
    "allow-same-origin",
    "allow-downloads",
  ].join(" ");

  const style = document.createElement("style");
  if (useShadowDom) {
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
  } else {
      style.textContent = `
        #${containerId} {
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
  }

  root.appendChild(style);
  root.appendChild(iframe);

  let lastDims = { width: cfg.closedWidth, height: cfg.closedHeight };

  function applyDims(dims) {
    const host = container; // Container handles positioning in both modes (via :host or #id style)

    const desiredWidth = parseInt(dims.width, 10);
    const rightOffset = parseInt(cfg.right, 10);
    const maxWidth = window.innerWidth - (isNaN(rightOffset) ? 20 : rightOffset);
    host.style.width =
      !isNaN(desiredWidth)
        ? Math.min(desiredWidth, maxWidth) + "px"
        : normalizeLength(dims.width, cfg.closedWidth);

    const desiredHeight = parseInt(dims.height, 10);
    const bottomOffset = parseInt(cfg.bottom, 10);
    const maxHeight = window.innerHeight - (isNaN(bottomOffset) ? 20 : bottomOffset);
    host.style.height =
      !isNaN(desiredHeight)
        ? Math.min(desiredHeight, maxHeight) + "px"
        : normalizeLength(dims.height, cfg.closedHeight);
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
