// public/widget.js (VERSIÓN FINAL Y FUNCIONAL - CON CORRECCIÓN DE FONDO BLANCO)

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
        width: script.getAttribute("data-width") || "370px",
        height: script.getAttribute("data-height") || "540px",
      },
      CLOSED: {
        width: script.getAttribute("data-closed-width") || "88px",
        height: script.getAttribute("data-closed-height") || "88px",
      },
    };

    let currentDims = defaultOpen ? WIDGET_DIMENSIONS_JS.OPEN : WIDGET_DIMENSIONS_JS.CLOSED;
    let iframeIsCurrentlyOpen = defaultOpen;

    // --- Contenedor principal del widget (loader y iframe) ---
    const widgetContainer = document.createElement("div");
    widgetContainer.id = "chatboc-widget-container-" + iframeId;
    Object.assign(widgetContainer.style, {
      position: "fixed", 
      bottom: initialBottom,
      right: initialRight,
      width: currentDims.width,
      height: currentDims.height,
      zIndex: zIndexBase.toString(),
      borderRadius: iframeIsCurrentlyOpen ? "16px" : "50%", // Aplicado al contenedor
      boxShadow: iframeIsCurrentlyOpen ? "0 6px 20px rgba(0,0,0,0.2)" : "0 4px 12px rgba(0,0,0,0.15)", // Aplicado al contenedor
      transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease-in-out",
      overflow: "hidden", // Crucial para recortar el contenido en estado circular
      display: "flex", // Para centrar el loader/iframe
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer", 
      background: "transparent", // Asegurar transparencia para que el background del loader se vea si es un div simple.
    });
    // Se añade directamente al body del host.
    if (!document.getElementById(widgetContainer.id)) document.body.appendChild(widgetContainer);

    // --- Loader (El círculo blanco proviene de aquí o del iframe transparente sin contenido) ---
    const loader = document.createElement("div");
    loader.id = "chatboc-loader-" + iframeId;
    Object.assign(loader.style, {
      position: "absolute", // Posicionado dentro del widgetContainer
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "white", // Fondo blanco visible para el loader
      borderRadius: "inherit", // Hereda el border-radius del contenedor padre
      transition: "opacity 0.3s ease-out",
      pointerEvents: "auto", // Para que reciba clics mientras está visible
      zIndex: "2", // Por encima del iframe inicialmente
    });
    // El logo aquí solo se muestra hasta que el iframe carga
    loader.innerHTML = `<img src="${chatbocDomain}/favicon/favicon-48x48.png" alt="Chatboc" style="width:48px;height:48px;"/>`;
    widgetContainer.appendChild(loader); 

    // --- Iframe ---
    const iframe = document.createElement("iframe");
    iframe.id = iframeId;
    iframe.src = `${chatbocDomain}/iframe?token=${encodeURIComponent(token)}&widgetId=${iframeId}&defaultOpen=${defaultOpen}&openWidth=${encodeURIComponent(WIDGET_DIMENSIONS_JS.OPEN.width)}&openHeight=${encodeURIComponent(WIDGET_DIMENSIONS_JS.OPEN.height)}&closedWidth=${encodeURIComponent(WIDGET_DIMENSIONS_JS.CLOSED.width)}&closedHeight=${encodeURIComponent(WIDGET_DIMENSIONS_JS.CLOSED.height)}${theme ? `&theme=${encodeURIComponent(theme)}` : ""}`;
    Object.assign(iframe.style, {
      border: "none",
      width: "100%",
      height: "100%",
      backgroundColor: "transparent", // El iframe es transparente, el fondo lo da el widgetContainer o el contenido de React
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
        loader.innerHTML = '<div style="font-family: Arial, sans-serif; color: #777; font-size:12px; text-align:center;">Servicio no disponible</div>';
        loader.style.backgroundColor = "lightgray"; // Fondo si falla la carga
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
      loader.innerHTML = '<div style="font-family: Arial, sans-serif; color: #777; font-size:12px; text-align:center;">Servicio no disponible</div>';
      loader.style.backgroundColor = "lightgray";
      iframe.style.display = "none";
    };

    // Escuchar mensajes del iframe para redimensionar y cambiar estado
    window.addEventListener("message", function (event) {
      if (event.origin !== chatbocDomain && !(chatbocDomain.startsWith("http://localhost"))) {
        return;
      }

      if (event.data && event.data.type === "chatboc-state-change" && event.data.widgetId === iframeId) {
        iframeIsCurrentlyOpen = event.data.isOpen;
        currentDims = iframeIsCurrentlyOpen ? WIDGET_DIMENSIONS_JS.OPEN : WIDGET_DIMENSIONS_JS.CLOSED;

        Object.assign(widgetContainer.style, {
          width: currentDims.width,
          height: currentDims.height,
          borderRadius: iframeIsCurrentlyOpen ? "16px" : "50%",
          boxShadow: iframeIsCurrentlyOpen ? "0 6px 20px rgba(0,0,0,0.2)" : "0 4px 12px rgba(0,0,0,0.15)",
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();