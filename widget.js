(function () {
  "use strict";

  function init() {
    const SCRIPT_CONFIG = {
      WIDGET_JS_FILENAME: "widget.js",
      DEFAULT_TOKEN: "demo-anon",
      DEFAULT_Z_INDEX: "9999",
      DEFAULT_INITIAL_BOTTOM: "24px",
      DEFAULT_INITIAL_RIGHT: "24px",
      DEFAULT_OPEN_WIDTH: "380px",
      DEFAULT_OPEN_HEIGHT: "580px",
      DEFAULT_CLOSED_WIDTH: "56px",
      DEFAULT_CLOSED_HEIGHT: "56px",
      MOBILE_BREAKPOINT_PX: 640,
      LOADER_TIMEOUT_MS: 10000,
      DEFAULT_CHATBOC_DOMAIN: "https://www.chatboc.ar",
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

    const token = script.getAttribute("data-token") || SCRIPT_CONFIG.DEFAULT_TOKEN;
    const registry = (window.__chatbocWidgets = window.__chatbocWidgets || {});

    if (registry[token]) {
      if (script.getAttribute("data-force") === "true") {
        if (typeof registry[token].destroy === "function") {
          registry[token].destroy();
        }
        delete registry[token];
      } else {
        console.warn(
          `Chatboc widget already loaded for token ${token}. Skipping.`
        );
        return;
      }
    }

    const scriptOrigin = (script.src && new URL(script.src, window.location.href).origin) || SCRIPT_CONFIG.DEFAULT_CHATBOC_DOMAIN;
    const chatbocDomain = script.getAttribute("data-domain") || scriptOrigin;

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
    const endpointAttr = script.getAttribute("data-endpoint");
    const tipoChat = endpointAttr === "municipio" || endpointAttr === "pyme" ? endpointAttr : (window.APP_TARGET === "municipio" ? "municipio" : "pyme");

    function buildWidget(finalCta) {
      const zIndexBase = parseInt(script.getAttribute("data-z") || SCRIPT_CONFIG.DEFAULT_Z_INDEX, 10);
      const iframeId = `chatboc-dynamic-iframe-${Math.random().toString(36).substring(2, 9)}`;
      let iframeIsCurrentlyOpen = defaultOpen;

      function computeResponsiveDims(base, isOpen) {
        const isMobile = window.innerWidth < SCRIPT_CONFIG.MOBILE_BREAKPOINT_PX;
        if (isOpen && isMobile) {
          return {
            width: "100vw",
            height: "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
          };
        }
        if (isMobile) { // Closed on mobile
            return WIDGET_DIMENSIONS.CLOSED;
        }
        // Desktop
        return base;
      }

      let currentDims = iframeIsCurrentlyOpen
        ? computeResponsiveDims(WIDGET_DIMENSIONS.OPEN, true)
        : WIDGET_DIMENSIONS.CLOSED;

      const widgetContainer = document.createElement("div");
      widgetContainer.id = `chatboc-widget-container-${iframeId}`;
      widgetContainer.setAttribute("data-chatboc-token", token);
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
        background: "#007aff",
        cursor: "pointer",
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
        background: "hsl(var(--primary, 218 92% 41%))",
        borderRadius: "inherit",
        transition: "opacity 0.3s ease-out 0.1s",
        zIndex: "2",
      });
      loader.innerHTML = `<img src="${chatbocDomain}/favicon/favicon-96x96.png" alt="Cargando Chatboc..." style="width: 60%; height: 60%; max-width: 96px; max-height: 96px; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.2));"/>`;
      widgetContainer.appendChild(loader);

      const iframe = document.createElement("iframe");
      iframe.id = iframeId;
      // Use explicit .html path so integrations without rewrite rules work
      const iframeSrc = new URL(`${chatbocDomain}/iframe.html`);
      iframeSrc.searchParams.set("token", token);
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
      iframe.src = iframeSrc.toString();

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
      iframe.allow = "clipboard-write; geolocation";
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
          iframe.src = `${chatbocDomain}/iframe`;
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
        const isSafeOrigin = event.origin === chatbocDomain || chatbocDomain.startsWith("http://localhost");
        if (!isSafeOrigin) {
          if (event.data?.type?.startsWith('chatboc-')) {
            console.warn(`Chatboc widget: Ignored message from unsafe origin: ${event.origin}`);
          }
          return;
        }

        if (event.data?.type === "chatboc-state-change" && event.data.widgetId === iframeId) {
          iframeIsCurrentlyOpen = event.data.isOpen;
          const newDims = computeResponsiveDims(
            iframeIsCurrentlyOpen ? WIDGET_DIMENSIONS.OPEN : WIDGET_DIMENSIONS.CLOSED,
            iframeIsCurrentlyOpen
          );
          if (iframeIsCurrentlyOpen) {
            Object.assign(widgetContainer.style, {
              width: newDims.width,
              height: newDims.height,
              borderRadius: window.innerWidth <= SCRIPT_CONFIG.MOBILE_BREAKPOINT_PX ? "16px 16px 0 0" : "16px",
              boxShadow: "0 8px 40px rgba(0, 0, 0, 0.2)",
              background: "white",
              transform: "scale(1)",
              cursor: "default",
            });
          } else {
            Object.assign(widgetContainer.style, {
              width: newDims.width,
              height: newDims.height,
              borderRadius: "50%",
              boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              background: "#007aff",
              cursor: "pointer",
            });
          }
        }
      }
      window.addEventListener("message", messageHandler);

      function resizeHandler() {
        if (!iframeIsCurrentlyOpen) return;
        const newDims = computeResponsiveDims(WIDGET_DIMENSIONS.OPEN, true);
        Object.assign(widgetContainer.style, {
          width: newDims.width,
          height: newDims.height,
          borderRadius: window.innerWidth < SCRIPT_CONFIG.MOBILE_BREAKPOINT_PX ? "0" : "16px",
        });
      }
      window.addEventListener("resize", resizeHandler);

      // Fallback click listener
      widgetContainer.addEventListener("click", () => {
        if (iframeIsCurrentlyOpen) return;
        postToIframe({ type: "TOGGLE_CHAT", isOpen: true });
      });


      function postToIframe(msg) {
        iframe?.contentWindow?.postMessage({ ...msg, widgetId: iframeId }, chatbocDomain);
      }

      function destroy() {
        window.removeEventListener("message", messageHandler);
        window.removeEventListener("resize", resizeHandler);
        widgetContainer.removeEventListener("mousedown", dragStart);
        widgetContainer.removeEventListener("touchstart", dragStart);
        widgetContainer?.remove();
        delete registry[token];
      }

      registry[token] = { destroy, container: widgetContainer, post: postToIframe };

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
      fetch(`${chatbocDomain}/widget/attention`)
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
