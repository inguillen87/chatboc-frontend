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
    const registry = (window.__chatbocWidgets = window.__chatbocWidgets || {});
    if (registry[token]) {
      if (script.getAttribute("data-force") === "true") {
        if (typeof registry[token].destroy === "function") {
          registry[token].destroy();
        }
        delete registry[token];
      } else {
        console.warn(
          "Chatboc widget already loaded for token " + token + ". Skipping."
        );
        return;
      }
    }
    const endpointAttr = script.getAttribute("data-endpoint");
    const tipoChat =
      endpointAttr === "municipio" || endpointAttr === "pyme"
        ? endpointAttr
        : (typeof window !== "undefined" && window.APP_TARGET === "municipio"
            ? "municipio"
            : "pyme");
    const initialBottom = script.getAttribute("data-bottom") || "20px";
    const initialRight = script.getAttribute("data-right") || "20px";
    const defaultOpen = script.getAttribute("data-default-open") === "true";
    const theme = script.getAttribute("data-theme") || "";
    const scriptOrigin = (script.getAttribute("src") && new URL(script.getAttribute("src"), window.location.href).origin) || "https://www.chatboc.ar";
    const chatbocDomain = script.getAttribute("data-domain") || scriptOrigin;

    const zIndexBase = parseInt(script.getAttribute("data-z") || "999990", 10);
    const iframeId = "chatboc-dynamic-iframe-" + Math.random().toString(36).substring(2, 9);

    const WIDGET_DIMENSIONS_JS = {
      OPEN: {
        width: script.getAttribute("data-width") || "460px",
        height: script.getAttribute("data-height") || "680px",
      },
      CLOSED: {
        width: script.getAttribute("data-closed-width") || "96px",
        height: script.getAttribute("data-closed-height") || "96px",
      },
    };

    function computeResponsiveDims(base) {
      if (window.innerWidth < 640) {
        return {
          width: "100vw",
          height:
            "calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
        };
      }
      const widthNum = parseInt(base.width, 10);
      const heightNum = parseInt(base.height, 10);
      const width = Math.min(widthNum, window.innerWidth - 20) + "px";
      const height = Math.min(heightNum, window.innerHeight - 20) + "px";
      return { width, height };
    }

    let currentDims = defaultOpen
      ? computeResponsiveDims(WIDGET_DIMENSIONS_JS.OPEN)
      : WIDGET_DIMENSIONS_JS.CLOSED;
    let iframeIsCurrentlyOpen = defaultOpen;

    // --- Contenedor principal del widget (loader y iframe) ---
    // Este div es el que realmente manejará el tamaño, forma y color de fondo inicial.
    const widgetContainer = document.createElement("div");
    widgetContainer.id = "chatboc-widget-container-" + iframeId;
    widgetContainer.setAttribute("data-chatboc-token", token);
    Object.assign(widgetContainer.style, {
      position: "fixed", 
      bottom: initialBottom,
      right: initialRight,
      width: currentDims.width,
      height: currentDims.height,
      zIndex: zIndexBase.toString(),
      borderRadius: iframeIsCurrentlyOpen ? "16px" : "50%", 
      boxShadow: iframeIsCurrentlyOpen ? "0 6px 20px rgba(0,0,0,0.2)" : "0 4px 12px rgba(0,0,0,0.15)",
      transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease-in-out",
      overflow: "hidden", 
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer", 
      // El background del contenedor principal DEBE tener un color sólido para el estado de botón cerrado.
      background: "hsl(var(--primary, 218 92% 41%))", // Usar el color primario de tu tema para el botón
    });
    document.body.appendChild(widgetContainer);

    // --- Loader (Aseguramos que el logo del loader siempre se vea sobre un fondo) ---
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
      background: "hsl(var(--primary, 218 92% 41%))", // Fondo del loader, igual que el botón
      borderRadius: "inherit", // Hereda el border-radius del contenedor padre
      transition: "opacity 0.3s ease-out",
      pointerEvents: "auto", // Puede recibir clics
      zIndex: "2", // Por encima del iframe inicialmente
    });
    // El logo en el loader
    loader.innerHTML = `<img src="${chatbocDomain}/favicon/favicon-48x48.png" alt="Chatboc" style="width:48px;height:48px; filter: invert(100%);"/>`; // Invertir color si el fondo es oscuro
    widgetContainer.appendChild(loader); 

    // --- Iframe ---
    const iframe = document.createElement("iframe");
    iframe.id = iframeId;
    iframe.src = `${chatbocDomain}/iframe?token=${encodeURIComponent(token)}&widgetId=${iframeId}&defaultOpen=${defaultOpen}&tipo_chat=${tipoChat}&openWidth=${encodeURIComponent(WIDGET_DIMENSIONS_JS.OPEN.width)}&openHeight=${encodeURIComponent(WIDGET_DIMENSIONS_JS.OPEN.height)}&closedWidth=${encodeURIComponent(WIDGET_DIMENSIONS_JS.CLOSED.width)}&closedHeight=${encodeURIComponent(WIDGET_DIMENSIONS_JS.CLOSED.height)}${theme ? `&theme=${encodeURIComponent(theme)}` : ""}`;
    Object.assign(iframe.style, {
      border: "none",
      width: "100%", 
      height: "100%", 
      backgroundColor: "transparent", // Sigue transparente, el fondo lo dará el contenido de React
      display: "block",
      opacity: "0", // Oculto inicialmente, se muestra cuando carga
      transition: "opacity 0.3s ease-in",
      zIndex: "1" // Por debajo del loader inicialmente
    });
    iframe.allow = "clipboard-write";
    iframe.setAttribute("title", "Chatboc Chatbot");
    widgetContainer.appendChild(iframe);

    let iframeHasLoaded = false;
    const loadTimeout = setTimeout(() => {
      if (!iframeHasLoaded) {
        loader.innerHTML = '<div style="font-family: Arial, sans-serif; color: white; font-size:12px; text-align:center;">Servicio no disponible</div>'; // Texto de error en blanco
        loader.style.backgroundColor = "hsl(var(--destructive, 0 84.2% 60.2%))"; // Fondo de error
      }
    }, 10000);

    iframe.onload = function () {
      iframeHasLoaded = true;
      clearTimeout(loadTimeout);
      loader.style.opacity = "0"; // Oculta el loader
      setTimeout(() => loader.remove(), 250); // Remueve el loader después de la transición
      iframe.style.opacity = "1"; // Muestra el iframe
    };

    iframe.onerror = function () {
      iframeHasLoaded = true;
      clearTimeout(loadTimeout);
      loader.innerHTML = '<div style="font-family: Arial, sans-serif; color: white; font-size:12px; text-align:center;">Servicio no disponible</div>';
      loader.style.backgroundColor = "hsl(var(--destructive, 0 84.2% 60.2%))";
      iframe.style.display = "none";
    };

    // Escuchar mensajes del iframe para redimensionar y cambiar estado
    function messageHandler(event) {
      if (event.origin !== chatbocDomain && !(chatbocDomain.startsWith("http://localhost"))) {
        return;
      }

      if (event.data && event.data.type === "chatboc-state-change" && event.data.widgetId === iframeId) {
        iframeIsCurrentlyOpen = event.data.isOpen;
        if (event.data.dimensions) {
          currentDims = computeResponsiveDims(event.data.dimensions);
        } else if (iframeIsCurrentlyOpen) {
          currentDims = computeResponsiveDims(WIDGET_DIMENSIONS_JS.OPEN);
        } else {
          currentDims = WIDGET_DIMENSIONS_JS.CLOSED;
        }

        Object.assign(widgetContainer.style, {
          width: currentDims.width,
          height: currentDims.height,
          borderRadius: iframeIsCurrentlyOpen && window.innerWidth < 640 ? "0" : iframeIsCurrentlyOpen ? "16px" : "50%",
          boxShadow: iframeIsCurrentlyOpen ? "0 6px 20px rgba(0,0,0,0.2)" : "0 4px 12px rgba(0,0,0,0.15)",
          // El color de fondo del widgetContainer cambia si el panel está abierto
          background: iframeIsCurrentlyOpen ? "transparent" : "hsl(var(--primary, 218 92% 41%))",
        });
      }
    }
    window.addEventListener("message", messageHandler);

    function adjustOpenDimensions() {
      if (!iframeIsCurrentlyOpen) return;
      currentDims = computeResponsiveDims(WIDGET_DIMENSIONS_JS.OPEN);
      Object.assign(widgetContainer.style, {
        width: currentDims.width,
        height: currentDims.height,
        borderRadius: window.innerWidth < 640 ? "0" : "16px",
      });
    }

    window.addEventListener("resize", adjustOpenDimensions);

    // Si el iframe no responde, forzar apertura al hacer click en el contenedor
    widgetContainer.addEventListener("click", function () {
      if (!iframeIsCurrentlyOpen) {
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            { type: "TOGGLE_CHAT", widgetId: iframeId, isOpen: true },
            "*"
          );
        }
        // Aplicar estilos de apertura como respaldo inmediato
        iframeIsCurrentlyOpen = true;
        currentDims = computeResponsiveDims(WIDGET_DIMENSIONS_JS.OPEN);
        Object.assign(widgetContainer.style, {
          width: currentDims.width,
          height: currentDims.height,
          borderRadius: window.innerWidth < 640 ? "0" : "16px",
          boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
        });
      }
    });

    // --- Lógica de Arrastre (solo para el modo fixed) ---
    let isDragging = false, dragStartX, dragStartY, containerStartLeft, containerStartTop;
    widgetContainer.addEventListener("mousedown", dragStart);
    widgetContainer.addEventListener("touchstart", dragStart, { passive: false });

    function dragStart(e) {
      if (iframeIsCurrentlyOpen) return; 
      isDragging = true;
      const rect = widgetContainer.getBoundingClientRect();
      containerStartLeft = rect.left;
      containerStartTop = rect.top;
      dragStartX = e.touches ? e.touches[0].clientX : e.clientX;
      dragStartY = e.touches ? e.touches[0].clientY : e.clientY;
      widgetContainer.style.transition = "none";
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
      setTimeout(() => {
        widgetContainer.style.transition = "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease-in-out";
      }, 50);
      document.removeEventListener("mousemove", dragMove);
      document.removeEventListener("mouseup", dragEnd);
      document.removeEventListener("touchmove", dragMove);
      document.removeEventListener("touchend", dragEnd);
    }

    function postToIframe(msg) {
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ ...msg, widgetId: iframeId }, "*");
      }
    }

    function destroy() {
      window.removeEventListener("message", messageHandler);
      window.removeEventListener("resize", adjustOpenDimensions);
      widgetContainer.removeEventListener("mousedown", dragStart);
      widgetContainer.removeEventListener("touchstart", dragStart);
      widgetContainer.remove();
    }

    registry[token] = { destroy, container: widgetContainer, post: postToIframe };

    if (!window.Chatboc) window.Chatboc = {};
    window.Chatboc.setView = function (view) {
      postToIframe({ type: "SET_VIEW", view });
    };
    window.Chatboc.open = function () {
      postToIframe({ type: "TOGGLE_CHAT", isOpen: true });
    };
    window.Chatboc.close = function () {
      postToIframe({ type: "TOGGLE_CHAT", isOpen: false });
    };
    window.Chatboc.toggle = function () {
      postToIframe({ type: "TOGGLE_CHAT", isOpen: !iframeIsCurrentlyOpen });
    };
    if (!window.chatbocDestroyWidget) {
      window.chatbocDestroyWidget = function (tok) {
        if (registry[tok] && typeof registry[tok].destroy === "function") {
          registry[tok].destroy();
          delete registry[tok];
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
