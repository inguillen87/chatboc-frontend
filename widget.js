(function () {
  "use strict";

  function init() {
    const SCRIPT_CONFIG = {
      WIDGET_JS_FILENAME: "widget.js",
      DEFAULT_TOKEN: "demo-anon",
      DEFAULT_Z_INDEX: "999990",
      DEFAULT_INITIAL_BOTTOM: "20px",
      DEFAULT_INITIAL_RIGHT: "20px",
      DEFAULT_OPEN_WIDTH: "460px",
      DEFAULT_OPEN_HEIGHT: "680px",
      DEFAULT_CLOSED_WIDTH: "96px",
      DEFAULT_CLOSED_HEIGHT: "96px",
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
            const closedWidthNum = parseInt(WIDGET_DIMENSIONS.CLOSED.width, 10);
            return {
                width: `${closedWidthNum}px`,
                height: `${parseInt(WIDGET_DIMENSIONS.CLOSED.height, 10)}px`,
            };
        }
        // Desktop
        const widthNum = parseInt(base.width, 10);
        const heightNum = parseInt(base.height, 10);
        const constrainedWidth = Math.min(widthNum, window.innerWidth - 40);
        const constrainedHeight = Math.min(heightNum, window.innerHeight - 40);
        return { width: `${constrainedWidth}px`, height: `${constrainedHeight}px` };
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
        borderRadius: iframeIsCurrentlyOpen && window.innerWidth < SCRIPT_CONFIG.MOBILE_BREAKPOINT_PX ? "0px" : iframeIsCurrentlyOpen ? "16px" : "50%",
        boxShadow: iframeIsCurrentlyOpen ? "0 6px 20px rgba(0,0,0,0.2)" : "0 4px 12px rgba(0,0,0,0.15)",
        transition: "box-shadow 0.3s ease, background-color 0.3s ease, width 0.3s ease, height 0.3s ease, border-radius 0.3s ease",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: iframeIsCurrentlyOpen ? "transparent" : "hsl(var(--primary, 218 92% 41%))",
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
      const iframeSrc = new URL(`${chatbocDomain}/iframe`);
      iframeSrc.searchParams.set("token", token);
      iframeSrc.searchParams.set("widgetId", iframeId);
      iframeSrc.searchParams.set("defaultOpen", defaultOpen);
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

      iframe.onerror = () => {
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
          Object.assign(widgetContainer.style, {
            width: newDims.width,
            height: newDims.height,
            borderRadius: iframeIsCurrentlyOpen && window.innerWidth < SCRIPT_CONFIG.MOBILE_BREAKPOINT_PX ? "0" : iframeIsCurrentlyOpen ? "16px" : "50%",
            boxShadow: iframeIsCurrentlyOpen ? "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)" : "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
            background: iframeIsCurrentlyOpen ? "transparent" : "hsl(var(--primary, 218 92% 41%))",
          });
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

      // --- Drag and Drop Logic ---
      let isDragging = false, dragStartX, dragStartY, containerStartLeft, containerStartTop;

      function dragStart(e) {
        if (iframeIsCurrentlyOpen) return;
        isDragging = true;
        const rect = widgetContainer.getBoundingClientRect();
        containerStartLeft = rect.left;
        containerStartTop = rect.top;
        dragStartX = e.touches ? e.touches[0].clientX : e.clientX;
        dragStartY = e.touches ? e.touches[0].clientY : e.clientY;

        widgetContainer.style.transition = "none";
        widgetContainer.style.cursor = "grabbing";
        document.body.style.cursor = "grabbing";

        document.addEventListener("mousemove", dragMove);
        document.addEventListener("mouseup", dragEnd);
        document.addEventListener("touchmove", dragMove, { passive: false });
        document.addEventListener("touchend", dragEnd);

        if (e.cancelable) e.preventDefault();
      }

      function dragMove(e) {
        if (!isDragging) return;
        if (e.cancelable) e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        let newLeft = containerStartLeft + (clientX - dragStartX);
        let newTop = containerStartTop + (clientY - dragStartY);

        const containerWidth = widgetContainer.offsetWidth;
        const containerHeight = widgetContainer.offsetHeight;

        newLeft = Math.max(8, Math.min(window.innerWidth - containerWidth - 8, newLeft));
        newTop = Math.max(8, Math.min(window.innerHeight - containerHeight - 8, newTop));

        widgetContainer.style.left = `${newLeft}px`;
        widgetContainer.style.top = `${newTop}px`;
        widgetContainer.style.right = "auto";
        widgetContainer.style.bottom = "auto";
      }

      function dragEnd() {
        if (!isDragging) return;
        isDragging = false;

        widgetContainer.style.transition = "box-shadow 0.3s ease, background-color 0.3s ease, width 0.3s ease, height 0.3s ease, border-radius 0.3s ease";
        widgetContainer.style.cursor = "pointer";
        document.body.style.cursor = "default";

        document.removeEventListener("mousemove", dragMove);
        document.removeEventListener("mouseup", dragEnd);
        document.removeEventListener("touchmove", dragMove);
        document.removeEventListener("touchend", dragEnd);
      }

      widgetContainer.addEventListener("mousedown", dragStart);
      widgetContainer.addEventListener("touchstart", dragStart, { passive: false });

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
