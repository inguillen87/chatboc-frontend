// Chatboc embeddable widget loader (LIMPIO Y MINIMALISTA)
(function () {
  "use strict";

  function init() {
    const script =
      document.currentScript ||
      Array.from(document.getElementsByTagName("script")).find((s) =>
        s.src && s.src.includes("widget.js")
      );
    if (!script) {
      console.error("Chatboc widget.js FATAL: script tag not found.");
      return;
    }

    const token = script.getAttribute("data-token") || "demo-anon";
    const initialBottom = script.getAttribute("data-bottom") || "32px";
    const initialRight = script.getAttribute("data-right") || "32px";
    const defaultOpen = script.getAttribute("data-default-open") === "true";
    const theme = script.getAttribute("data-theme") || "";
    const endpointAttr = script.getAttribute("data-endpoint") || "pyme";
    const endpoint = endpointAttr === "municipio" ? "municipio" : "pyme";

    const scriptOrigin = (script.getAttribute("src") && new URL(script.getAttribute("src"), window.location.href).origin) || "https://www.chatboc.ar";
    const chatbocDomain = script.getAttribute("data-domain") || scriptOrigin;
    const zIndexBase = parseInt(script.getAttribute("data-z") || "999999", 10);
    const iframeId = "chatboc-dynamic-iframe-" + Math.random().toString(36).substring(2, 9);

    const WIDGET_DIMENSIONS = {
      OPEN: {
        width: script.getAttribute("data-width") || "370px",
        height: script.getAttribute("data-height") || "540px",
      },
      CLOSED: {
        width: script.getAttribute("data-closed-width") || "88px",
        height: script.getAttribute("data-closed-height") || "88px",
      },
    };

    let currentDims = defaultOpen ? WIDGET_DIMENSIONS.OPEN : WIDGET_DIMENSIONS.CLOSED;
    let iframeIsOpen = defaultOpen;

    // Contenedor básico, solo lo esencial
    const widgetContainer = document.createElement("div");
    widgetContainer.id = "chatboc-widget-container-" + iframeId;
    Object.assign(widgetContainer.style, {
      position: "fixed",
      bottom: `calc(${initialBottom} + env(safe-area-inset-bottom))`,
      right: `calc(${initialRight} + env(safe-area-inset-right))`,
      width: currentDims.width,
      height: currentDims.height,
      zIndex: zIndexBase.toString(),
      overflow: "hidden",
      padding: "0",
      margin: "0",
      background: "transparent",
      boxSizing: "border-box",
      fontFamily: "Arial, sans-serif",
      fontSize: "14px"
    });
    if (!document.getElementById(widgetContainer.id)) {
      document.body.appendChild(widgetContainer);
    }

    // Loader simple
    const loader = document.createElement("div");
    loader.id = "chatboc-loader-" + iframeId;
    Object.assign(loader.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--background, #f8fafc)",
      zIndex: "2",
      pointerEvents: "none"
    });
    loader.innerHTML = `<img src="${chatbocDomain}/favicon/favicon-48x48.png" alt="Chatboc" style="width:48px;height:48px;"/>`;
    widgetContainer.appendChild(loader);

    // Iframe ocupa todo, sin estilos visuales extra
    const iframe = document.createElement("iframe");
    iframe.id = iframeId;
    iframe.src = `${chatbocDomain}/iframe?token=${encodeURIComponent(token)}&widgetId=${iframeId}&defaultOpen=${defaultOpen}&openWidth=${encodeURIComponent(WIDGET_DIMENSIONS.OPEN.width)}&openHeight=${encodeURIComponent(WIDGET_DIMENSIONS.OPEN.height)}&closedWidth=${encodeURIComponent(WIDGET_DIMENSIONS.CLOSED.width)}&closedHeight=${encodeURIComponent(WIDGET_DIMENSIONS.CLOSED.height)}${theme ? `&theme=${encodeURIComponent(theme)}` : ""}&tipo_chat=${endpoint}`;
    Object.assign(iframe.style, {
      border: "none",
      width: "100%",
      height: "100%",
      background: "transparent",
      display: "block",
      opacity: "0",
      zIndex: "1",
      margin: "0",
      padding: "0"
    });
    iframe.allow = "clipboard-write";
    iframe.setAttribute("title", "Chatboc Chatbot");
    widgetContainer.appendChild(iframe);

    // Loader de fallback (10s)
    let iframeHasLoaded = false;
    const loadTimeout = setTimeout(() => {
      if (!iframeHasLoaded) {
        loader.innerHTML = '<div style="font-family: Arial, sans-serif; color: #777; font-size:12px; text-align:center;">Servicio no disponible</div>';
        loader.style.backgroundColor = "var(--background, #f8fafc)";
      }
    }, 10000);

    iframe.onload = function () {
      iframeHasLoaded = true;
      clearTimeout(loadTimeout);
      loader.style.opacity = "0";
      setTimeout(() => loader.remove(), 250);
      iframe.style.opacity = "1";
    };

    iframe.onerror = function () {
      iframeHasLoaded = true;
      clearTimeout(loadTimeout);
      loader.innerHTML = '<div style="font-family: Arial, sans-serif; color: #777; font-size:12px; text-align:center;">Servicio no disponible</div>';
      loader.style.backgroundColor = "var(--background, #f8fafc)";
      iframe.style.display = "none";
    };

    // Solo cambia tamaño: el diseño está 100% adentro del iframe.
    window.addEventListener("message", function (event) {
      if (event.origin !== chatbocDomain && !(chatbocDomain.startsWith("http://localhost"))) {
        return;
      }
      if (event.data && event.data.type === "chatboc-state-change" && event.data.widgetId === iframeId) {
        iframeIsOpen = event.data.isOpen;
        currentDims = iframeIsOpen ? WIDGET_DIMENSIONS.OPEN : WIDGET_DIMENSIONS.CLOSED;
        Object.assign(widgetContainer.style, {
          width: currentDims.width,
          height: currentDims.height,
          bottom: `calc(${initialBottom} + env(safe-area-inset-bottom))`,
          right: `calc(${initialRight} + env(safe-area-inset-right))`,
          left: "",
          top: "",
        });
      }
    });

    // Drag solo si está cerrado (opcional)
    let isDragging = false, dragStartX, dragStartY, containerStartLeft, containerStartTop;
    widgetContainer.addEventListener("mousedown", dragStart);
    widgetContainer.addEventListener("touchstart", dragStart, { passive: false });

    function dragStart(e) {
      if (iframeIsOpen) return; // Solo cuando está cerrado
      isDragging = true;
      const rect = widgetContainer.getBoundingClientRect();
      containerStartLeft = rect.left;
      containerStartTop = rect.top;
      dragStartX = e.touches ? e.touches[0].clientX : e.clientX;
      dragStartY = e.touches ? e.touches[0].clientY : e.clientY;
      widgetContainer.style.userSelect = "none";
      document.body.style.cursor = "move";
      document.addEventListener("mousemove", dragMove);
      document.addEventListener("mouseup", dragEnd);
      document.addEventListener("touchmove", dragMove, { passive: false });
      document.addEventListener("touchend", dragEnd);
      if (e.type === "touchstart" && e.cancelable) e.preventDefault();
    }

    function dragMove(e) {
      if (!isDragging) return;
      if (e.type === "touchmove" && e.cancelable) e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      let newLeft = containerStartLeft + (clientX - dragStartX);
      let newTop = containerStartTop + (clientY - dragStartY);
      const currentContainerWidth = parseInt(currentDims.width);
      const currentContainerHeight = parseInt(currentDims.height);
      newLeft = Math.max(0, Math.min(window.innerWidth - currentContainerWidth, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - currentContainerHeight, newTop));
      widgetContainer.style.left = newLeft + "px";
      widgetContainer.style.top = newTop + "px";
      widgetContainer.style.right = "auto";
      widgetContainer.style.bottom = "auto";
    }

    function dragEnd() {
      if (!isDragging) return;
      isDragging = false;
      widgetContainer.style.userSelect = "";
      document.body.style.cursor = "default";
      document.removeEventListener("mousemove", dragMove);
      document.removeEventListener("mouseup", dragEnd);
      document.removeEventListener("touchmove", dragMove);
      document.removeEventListener("touchend", dragEnd);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
