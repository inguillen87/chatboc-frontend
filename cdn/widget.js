(function () {
  console.log("Chatboc widget v1");
  const S = document.currentScript;
  const API = (S?.dataset?.apiBase || "https://chatboc.ar").replace(/\/+$/, "");
  const OWNER = S?.dataset?.ownerToken || "";
  let token = null, timer = null, retry = 15000;

  function notify(t) {
    try { window.dispatchEvent(new CustomEvent("chatboc-token", { detail: t })); }
    catch (e) { console.error("chatboc-token dispatch failed", e); }
  }

  function decode(t) {
    try {
      const p = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(atob(p));
    } catch { return {}; }
  }

  async function mint() {
    const r = await fetch(API + "/auth/widget-token", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, OWNER ? { "Authorization": OWNER } : {}),
      body: "{}"
    });
    const j = await r.json();
    if (!r.ok || !j.token) throw new Error("mint_failed");
    return j.token;
  }

  async function refresh(old) {
    const r = await fetch(API + "/auth/widget-refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: old })
    });
    const j = await r.json();
    if (!r.ok || !j.token) throw new Error("refresh_failed");
    return j.token;
  }

  function schedule(t) {
    const { exp } = decode(t), now = Math.floor(Date.now() / 1000);
    const secs = (exp || 0) - now, wait = Math.max(secs - 120, 15) * 1000;
    clearTimeout(timer);
    notify(t);
    timer = setTimeout(async () => {
      try {
        token = await refresh(token);
        retry = 15000;
      } catch {
        try {
          token = await mint();
          retry = 15000;
        } catch {
          timer = setTimeout(() => schedule(token), retry);
          retry = Math.min(retry * 2, 600000);
          return;
        }
      }
      schedule(token);
    }, wait);
  }

  async function ensureToken() {
    if (!token) { token = await mint(); schedule(token); }
    return token;
  }

  async function apiFetch(url, init) {
    const t = await ensureToken();
    const opts = Object.assign({}, init || {}, {
      headers: Object.assign({}, (init && init.headers) || {}, { "Authorization": "Bearer " + t })
    });
    return fetch(url, opts);
  }

  window.chatbocAuth = { ensureToken, apiFetch };
})();

(function () {
  "use strict";

  async function init() {
    const SCRIPT_CONFIG = {
      WIDGET_JS_FILENAME: "widget.js",
      DEFAULT_TOKEN: "demo-anon",
      PLACEHOLDER_PREFIX: "demo-anon",
      DEFAULT_Z_INDEX: "9999",
      DEFAULT_INITIAL_BOTTOM: "24px",
      DEFAULT_INITIAL_RIGHT: "24px",
      DEFAULT_OPEN_WIDTH: "380px",
      DEFAULT_OPEN_HEIGHT: "580px",
      DEFAULT_CLOSED_WIDTH: "56px",
      DEFAULT_CLOSED_HEIGHT: "56px",
      MOBILE_BREAKPOINT_PX: 640,
      LOADER_TIMEOUT_MS: 10000,
      DEFAULT_CHATBOC_DOMAIN: "https://chatboc.ar",
    };

    const script =
      document.currentScript ||
      Array.from(document.getElementsByTagName("script")).find(
        (s) => s.src && s.src.includes(SCRIPT_CONFIG.WIDGET_JS_FILENAME)
      );

    if (!script) {
      console.error("Chatboc widget.js FATAL: script tag not found.");
      return;
    }

    const sanitizeEntityToken = (token) => {
      if (!token) return null;
      const trimmed = token.trim();
      if (!trimmed) return null;
      return trimmed.toLowerCase().startsWith(SCRIPT_CONFIG.PLACEHOLDER_PREFIX)
        ? null
        : trimmed;
    };

    const ownerTokenAttr =
      script.getAttribute("data-owner-token") || script.getAttribute("data-entity-token");
    const trimmedOwnerTokenAttr = ownerTokenAttr ? ownerTokenAttr.trim() : "";
    const ownerToken = trimmedOwnerTokenAttr || SCRIPT_CONFIG.DEFAULT_TOKEN;
    const iframeEntityToken = sanitizeEntityToken(trimmedOwnerTokenAttr);
    const registry = (window.__chatbocWidgets = window.__chatbocWidgets || {});

    if (registry[ownerToken]) {
      if (script.getAttribute("data-force") === "true") {
        if (typeof registry[ownerToken].destroy === "function") {
          registry[ownerToken].destroy();
        }
        delete registry[ownerToken];
      } else {
        console.warn(
          `Chatboc widget already loaded for token ${ownerToken}. Skipping.`
        );
        return;
      }
    }

    const scriptOrigin =
      (script.src && new URL(script.src, window.location.href).origin) ||
      SCRIPT_CONFIG.DEFAULT_CHATBOC_DOMAIN;
    const apiBase = (script.getAttribute("data-api-base") || scriptOrigin).replace(/\/+$/, "");

    const WIDGET_DIMENSIONS = {
      OPEN: {
        width: script.getAttribute("data-width") || SCRIPT_CONFIG.DEFAULT_OPEN_WIDTH,
        height: script.getAttribute("data-height") || SCRIPT_CONFIG.DEFAULT_OPEN_HEIGHT,
      },
      CLOSED: {
        width: script.getAttribute("data-closed-width") || SCRIPT_CONFIG.DEFAULT_CLOSED_WIDTH,
        height: script.getAttribute("data-closed-height") || SCRIPT_CONFIG.DEFAULT_CLOSED_HEIGHT,
      },
    };

    const initialBottom = script.getAttribute("data-bottom") || SCRIPT_CONFIG.DEFAULT_INITIAL_BOTTOM;
    const initialRight = script.getAttribute("data-right") || SCRIPT_CONFIG.DEFAULT_INITIAL_RIGHT;
    const defaultOpen = script.getAttribute("data-default-open") === "true";
    const theme = script.getAttribute("data-theme") || "";
    const rubroAttr = script.getAttribute("data-rubro") || "";
    const ctaMessageAttr = script.getAttribute("data-cta-message") || "";
    const langAttr = script.getAttribute("data-lang") || "";
    const primaryColor = script.getAttribute("data-primary-color") || "#007aff";
    const accentColor = script.getAttribute("data-accent-color") || "";
    const logoUrlAttr = script.getAttribute("data-logo-url");
    const headerLogoUrlAttr = script.getAttribute("data-header-logo-url");
    const logoAnimationAttr = script.getAttribute("data-logo-animation") || "";
    const welcomeTitleAttr = script.getAttribute("data-welcome-title") || "";
    const welcomeSubtitleAttr = script.getAttribute("data-welcome-subtitle") || "";
    const logoUrl = logoUrlAttr || `${apiBase}/chatboc_widget_64x64.webp`;
    const headerLogoUrl = headerLogoUrlAttr || logoUrl;
    const endpointAttr = script.getAttribute("data-endpoint");
    const tipoChat =
      endpointAttr === "municipio" || endpointAttr === "pyme" ? endpointAttr : "pyme";

    let latestToken = null;
    window.addEventListener("chatboc-token", (e) => {
      latestToken = e.detail;
      const reg = registry[ownerToken];
      if (reg && typeof reg.post === "function") {
        reg.post({ type: "AUTH", token: latestToken });
      }
    });

    latestToken = await window.chatbocAuth.ensureToken();

    function buildWidget(finalCta) {
      const zIndexBase = parseInt(script.getAttribute("data-z") || SCRIPT_CONFIG.DEFAULT_Z_INDEX, 10);
      const iframeId = `chatboc-dynamic-iframe-${Math.random().toString(36).substring(2, 9)}`;
      let iframeIsCurrentlyOpen = defaultOpen;

      const parsePx = (val) => parseInt(val, 10) || 0;

      function computeResponsiveDims(base, isOpen) {
        const isMobile = window.innerWidth < SCRIPT_CONFIG.MOBILE_BREAKPOINT_PX;
        if (isOpen && isMobile) {
          return {
            width: "100vw",
            height: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
          };
        }
        if (isMobile) {
          // Closed on mobile
          return WIDGET_DIMENSIONS.CLOSED;
        }
        // Desktop: ensure widget fits within viewport when open
        if (isOpen) {
          const desiredWidth = parsePx(base.width);
          const desiredHeight = parsePx(base.height);
          const maxWidth = window.innerWidth - parsePx(initialRight) - 16;
          const maxHeight =
            window.innerHeight - parsePx(initialBottom) - 16;
          const finalWidth = !isNaN(desiredWidth)
            ? Math.min(desiredWidth, maxWidth) + "px"
            : base.width;
          const finalHeight = !isNaN(desiredHeight)
            ? Math.min(desiredHeight, maxHeight) + "px"
            : base.height;
          return { width: finalWidth, height: finalHeight };
        }
        return base;
      }

      let currentDims = iframeIsCurrentlyOpen
        ? computeResponsiveDims(WIDGET_DIMENSIONS.OPEN, true)
        : WIDGET_DIMENSIONS.CLOSED;

      const widgetContainer = document.createElement("div");
      widgetContainer.id = `chatboc-widget-container-${iframeId}`;
      widgetContainer.setAttribute("data-chatboc-token", ownerToken);
      Object.assign(widgetContainer.style, {
        position: "fixed",
        bottom: initialBottom,
        right: initialRight,
        width: currentDims.width,
        height: currentDims.height,
        zIndex: zIndexBase.toString(),
        borderRadius: "50%",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease, width 0.3s ease, height 0.3s ease, border-radius 0.3s ease",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: defaultOpen ? "white" : primaryColor,
        cursor: defaultOpen ? "default" : "pointer",
      });

      widgetContainer.addEventListener("mouseenter", () => {
        if (!iframeIsCurrentlyOpen) {
          widgetContainer.style.transform = "scale(1.05)";
          widgetContainer.style.boxShadow = "0 6px 18px rgba(0,0,0,0.2)";
        }
      });

      widgetContainer.addEventListener("mouseleave", () => {
        if (!iframeIsCurrentlyOpen) {
          widgetContainer.style.transform = "scale(1)";
          widgetContainer.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
        }
      });
      document.body.appendChild(widgetContainer);

      const logoImg = document.createElement("img");
      logoImg.id = `chatboc-logo-${iframeId}`;
      logoImg.src = logoUrl;
      logoImg.alt = "Abrir chat";
      Object.assign(logoImg.style, {
        width: "70%",
        height: "70%",
        objectFit: "contain",
        pointerEvents: "none",
        transition: "opacity 0.3s ease",
        opacity: iframeIsCurrentlyOpen ? "0" : "1",
      });
      if (logoAnimationAttr) logoImg.style.animation = logoAnimationAttr;
      widgetContainer.appendChild(logoImg);

      const loader = document.createElement("div");
      loader.id = `chatboc-loader-${iframeId}`;
      Object.assign(loader.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: primaryColor,
        borderRadius: "inherit",
        transition: "opacity 0.3s ease-out 0.1s",
        zIndex: "2",
      });
      loader.innerHTML = `<img src="${apiBase}/favicon/favicon-96x96.png" alt="Cargando Chatboc..." style="width: 60%; height: 60%; max-width: 96px; max-height: 96px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.2));"/>`;
      widgetContainer.appendChild(loader);

      const iframe = document.createElement("iframe");
      iframe.id = iframeId;
      // Use explicit .html path so integrations without rewrite rules work
      const iframeSrc = new URL(`${apiBase}/iframe.html`);
      iframeSrc.searchParams.set("token", latestToken);
      if (iframeEntityToken) {
        iframeSrc.searchParams.set("entityToken", iframeEntityToken);
      }
      iframeSrc.searchParams.set("widgetId", iframeId);
      iframeSrc.searchParams.set("defaultOpen", String(defaultOpen));
      iframeSrc.searchParams.set("tipo_chat", tipoChat);
      iframeSrc.searchParams.set("openWidth", WIDGET_DIMENSIONS.OPEN.width);
      iframeSrc.searchParams.set("openHeight", WIDGET_DIMENSIONS.OPEN.height);
      iframeSrc.searchParams.set("closedWidth", WIDGET_DIMENSIONS.CLOSED.width);
      iframeSrc.searchParams.set("closedHeight", WIDGET_DIMENSIONS.CLOSED.height);
      if (theme) iframeSrc.searchParams.set("theme", theme);
      if (rubroAttr) iframeSrc.searchParams.set("rubro", rubroAttr);
      if (finalCta) iframeSrc.searchParams.set("ctaMessage", finalCta);
      if (langAttr) iframeSrc.searchParams.set("lang", langAttr);
      if (primaryColor) iframeSrc.searchParams.set("primaryColor", primaryColor);
      if (accentColor) iframeSrc.searchParams.set("accentColor", accentColor);
      if (logoUrlAttr) iframeSrc.searchParams.set("logoUrl", logoUrlAttr);
      if (headerLogoUrlAttr) iframeSrc.searchParams.set("headerLogoUrl", headerLogoUrlAttr);
      if (logoAnimationAttr) iframeSrc.searchParams.set("logoAnimation", logoAnimationAttr);
      if (welcomeTitleAttr) iframeSrc.searchParams.set("welcomeTitle", welcomeTitleAttr);
      if (welcomeSubtitleAttr) iframeSrc.searchParams.set("welcomeSubtitle", welcomeSubtitleAttr);
      iframe.src = iframeSrc.toString();

      if (langAttr) iframe.setAttribute("lang", langAttr);

      Object.assign(iframe.style, {
        border: "none",
        width: "100%",
        height: "100%",
        backgroundColor: "transparent",
        display: "block",
        opacity: "0",
        transition: "opacity 0.4s ease-in",
        zIndex: "1",
      });
      iframe.setAttribute("width", "100%");
      iframe.setAttribute("height", "100%");
      iframe.setAttribute("frameborder", "0");
      iframe.allow = "clipboard-write; geolocation; microphone; camera";
      iframe.setAttribute("title", "Chatboc Asistente Virtual");
      widgetContainer.appendChild(iframe);

      let iframeHasLoaded = false;
      const loadTimeout = setTimeout(() => {
        if (iframeHasLoaded) return;
        loader.innerHTML = `<div style="font-family: system-ui, sans-serif; color: white; font-size: 14px; text-align: center; padding: 10px;">Servicio no disponible</div>`;
        loader.style.backgroundColor = "hsl(var(--destructive, 0 84.2% 60.2%))";
      }, SCRIPT_CONFIG.LOADER_TIMEOUT_MS);

      iframe.onload = () => {
        iframeHasLoaded = true;
        clearTimeout(loadTimeout);
        loader.style.opacity = "0";
        setTimeout(() => loader.remove(), 300);
        iframe.style.opacity = "1";
      };

      let attemptedFallback = false;
      iframe.onerror = () => {
        if (!attemptedFallback) {
          attemptedFallback = true;
          iframe.style.display = "none";
          iframe.src = `${apiBase}/iframe`;
          iframe.style.display = "block";
          return;
        }
        iframeHasLoaded = true;
        clearTimeout(loadTimeout);
        loader.innerHTML = `<div style="font-family: system-ui, sans-serif; color: white; font-size: 14px; text-align: center; padding: 10px;">Error al cargar. Intente de nuevo.</div>`;
        loader.style.backgroundColor = "hsl(var(--destructive, 0 84.2% 60.2%))";
        iframe.style.display = "none";
      };

      function messageHandler(event) {
        const isSafeOrigin = event.origin === apiBase || apiBase.startsWith("http://localhost");
        if (!isSafeOrigin) {
          if (event.data?.type?.startsWith('chatboc-')) {
            console.warn(`Chatboc widget: Ignored message from unsafe origin: ${event.origin}`);
          }
          return;
        }

        if (event.data?.type === "chatboc-ready" && event.data.widgetId === iframeId) {
          loader.style.opacity = "0";
          setTimeout(() => loader.remove(), 300);
          iframe.style.opacity = "1";
          postToIframe({ type: "AUTH", token: latestToken });
          return;
        }

        if (event.data?.type === "chatboc-state-change" && event.data.widgetId === iframeId) {
          iframeIsCurrentlyOpen = event.data.isOpen;
          const newDims = computeResponsiveDims(
            iframeIsCurrentlyOpen ? WIDGET_DIMENSIONS.OPEN : WIDGET_DIMENSIONS.CLOSED,
            iframeIsCurrentlyOpen
          );
          const isMobile = window.innerWidth <= SCRIPT_CONFIG.MOBILE_BREAKPOINT_PX;
          if (iframeIsCurrentlyOpen) {
            const style = {
              width: newDims.width,
              height: newDims.height,
              borderRadius: isMobile ? "16px 16px 0 0" : "16px",
              boxShadow: "0 8px 40px rgba(0, 0, 0, 0.2)",
              background: "white",
              transform: "scale(1)",
              cursor: "default",
              right: isMobile ? "0" : initialRight,
              left: isMobile ? "0" : "auto",
            };
            if (isMobile) {
              style.bottom = "env(safe-area-inset-bottom)";
              style.top = "env(safe-area-inset-top)";
            } else {
              style.bottom = initialBottom;
              style.top = "auto";
            }
            Object.assign(widgetContainer.style, style);
            logoImg.style.opacity = "0";
          } else {
            Object.assign(widgetContainer.style, {
              width: newDims.width,
              height: newDims.height,
              borderRadius: "50%",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              background: primaryColor,
              cursor: "pointer",
              bottom:
                window.innerWidth <= SCRIPT_CONFIG.MOBILE_BREAKPOINT_PX
                  ? "env(safe-area-inset-bottom)"
                  : initialBottom,
              right: initialRight,
              top: "auto",
              left: "auto",
            });
            logoImg.style.opacity = "1";
          }
        }
      }
      window.addEventListener("message", messageHandler);

      function resizeHandler() {
        if (!iframeIsCurrentlyOpen) return;
        const newDims = computeResponsiveDims(WIDGET_DIMENSIONS.OPEN, true);
        const isMobile = window.innerWidth < SCRIPT_CONFIG.MOBILE_BREAKPOINT_PX;
        const style = {
          width: newDims.width,
          height: newDims.height,
          borderRadius: isMobile ? "0" : "16px",
          right: isMobile ? "0" : initialRight,
          left: isMobile ? "0" : "auto",
        };
        if (isMobile) {
          style.bottom = "env(safe-area-inset-bottom)";
          style.top = "env(safe-area-inset-top)";
        } else {
          style.bottom = initialBottom;
          style.top = "auto";
        }
        Object.assign(widgetContainer.style, style);
      }
      window.addEventListener("resize", resizeHandler);
      if (iframeIsCurrentlyOpen) resizeHandler();

      // Fallback click listener
      widgetContainer.addEventListener("click", () => {
        if (iframeIsCurrentlyOpen) return;
        postToIframe({ type: "TOGGLE_CHAT", isOpen: true });
      });


      function postToIframe(msg) {
        iframe?.contentWindow?.postMessage({ ...msg, widgetId: iframeId }, apiBase);
      }

      function destroy() {
        window.removeEventListener("message", messageHandler);
        window.removeEventListener("resize", resizeHandler);
        widgetContainer.removeEventListener("mousedown", dragStart);
        widgetContainer.removeEventListener("touchstart", dragStart);
        widgetContainer?.remove();
        delete registry[ownerToken];
      }

      registry[ownerToken] = { destroy, container: widgetContainer, post: postToIframe };

      // Global API
      if (!window.Chatboc) window.Chatboc = {};
      window.Chatboc.setView = (view) => postToIframe({ type: "SET_VIEW", view });
      window.Chatboc.open = () => postToIframe({ type: "TOGGLE_CHAT", isOpen: true });
      window.Chatboc.close = () => postToIframe({ type: "TOGGLE_CHAT", isOpen: false });
      window.Chatboc.toggle = () => postToIframe({ type: "TOGGLE_CHAT", isOpen: !iframeIsCurrentlyOpen });

      if (!window.chatbocDestroyWidget) {
        window.chatbocDestroyWidget = (tok) => {
          registry[tok]?.destroy();
        };
      }
    }

    // Fetch CTA message and then build the widget
    if (ctaMessageAttr) {
      buildWidget(ctaMessageAttr);
    } else {
      window.chatbocAuth
        .apiFetch(`${apiBase}/widget/attention`)
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => buildWidget(d.message || ""))
        .catch(() => buildWidget("")); // Always build widget, even if fetch fails
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
