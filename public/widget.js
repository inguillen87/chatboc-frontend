// public/widget.js

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
  const defaultOpen = script.getAttribute("data-default-open") === "true"; // Si el chat debe iniciar abierto
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
      CLOSED: { // Dimensiones del globito
        width: script.getAttribute("data-closed-width") || "88px",
        height: script.getAttribute("data-closed-height") || "88px",
      },
    };

    let currentDims = defaultOpen ? WIDGET_DIMENSIONS_JS.OPEN : WIDGET_DIMENSIONS_JS.CLOSED;
    let iframeIsCurrentlyOpen = defaultOpen; // Sincronizado con ChatWidget interno

    // --- Contenedor principal del widget (loader y iframe) ---
    // Este div es el que realmente manejará el tamaño y la forma
    const widgetContainer = document.createElement("div");
    widgetContainer.id = "chatboc-widget-container-" + iframeId;
    Object.assign(widgetContainer.style, {
      position: "fixed",
      bottom: initialBottom,
      right: initialRight,
      width: currentDims.width,
      height: currentDims.height,
      zIndex: zIndexBase.toString(),
      borderRadius: iframeIsCurrentlyOpen ? "16px" : "50%", // Inicial según defaultOpen
      boxShadow: iframeIsCurrentlyOpen ? "0 6px 20px rgba(0,0,0,0.2)" : "0 4px 12px rgba(0,0,0,0.15)", // Sombra inicial
      transition: "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease-in-out",
      overflow: "hidden", // Crucial para recortar el contenido en estado circular
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer" // Indica que es clickeable
    });
    if (!document.getElementById(widgetContainer.id)) document.body.appendChild(widgetContainer);

    // --- Loader ---
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
      background: "white", // Fondo del loader
      transition: "opacity 0.3s ease-out",
      pointerEvents: "auto", // Para que reciba clics mientras está visible
      zIndex: "2" // Por encima del iframe inicialmente
    });
    loader.innerHTML = `<img src="${chatbocDomain}/favicon/favicon-48x48.png" alt="Chatboc" style="width:48px;height:48px;"/>`;
    widgetContainer.appendChild(loader);

    // --- Iframe ---
    const iframe = document.createElement("iframe");
    iframe.id = iframeId;
    // Pasa TODAS las dimensiones posibles para que ChatWidget.tsx tenga toda la info
    iframe.src = `${chatbocDomain}/iframe?token=${encodeURIComponent(token)}&widgetId=${iframeId}&defaultOpen=${defaultOpen}&openWidth=${encodeURIComponent(WIDGET_DIMENSIONS_JS.OPEN.width)}&openHeight=${encodeURIComponent(WIDGET_DIMENSIONS_JS.OPEN.height)}&closedWidth=${encodeURIComponent(WIDGET_DIMENSIONS_JS.CLOSED.width)}&closedHeight=${encodeURIComponent(WIDGET_DIMENSIONS_JS.CLOSED.height)}${theme ? `&theme=${encodeURIComponent(theme)}` : ""}`;
    Object.assign(iframe.style, {
      border: "none",
      width: "100%", // Siempre 100% del contenedor padre (widgetContainer)
      height: "100%", // Siempre 100% del contenedor padre (widgetContainer)
      backgroundColor: "transparent",
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
        loader.innerHTML = '<div style="font-family: Arial, sans-serif; color: #777; font-size:11px; text-align:center;">Servicio no disponible</div>';
        loader.style.backgroundColor = 'lightgray'; // Cambiar fondo del loader si falla
        // widgetContainer.style.display = 'none'; // No ocultar el contenedor, solo cambiar el loader
      }
    }, 10000);

    iframe.onload = function () {
      iframeHasLoaded = true;
      clearTimeout(loadTimeout);
      loader.style.opacity = "0";
      // Añade un pequeño retraso para que la transición de opacidad sea visible antes de eliminarlo
      setTimeout(() => loader.remove(), 300);
      iframe.style.opacity = "1"; // Muestra el iframe
    };

    iframe.onerror = function () {
      iframeHasLoaded = true; // Considerar esto como "cargado" para no disparar el timeout
      clearTimeout(loadTimeout);
      loader.innerHTML = '<div style="font-family: Arial, sans-serif; color: #777; font-size:11px; text-align:center;">Servicio no disponible</div>';
      loader.style.backgroundColor = 'lightgray';
      iframe.style.display = 'none'; // Ocultar el iframe si hay un error
    };

    // Escuchar mensajes del iframe para redimensionar y cambiar estado
    window.addEventListener("message", function (event) {
      // Si el origen no coincide y no es localhost, ignora por seguridad
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

    // --- Lógica de Arrastre (para el contenedor del widget) ---
    // Asociamos la lógica de arrastre al widgetContainer
    let isDragging = false, dragStartX, dragStartY, containerStartLeft, containerStartTop;

    widgetContainer.addEventListener("mousedown", dragStart);
    widgetContainer.addEventListener("touchstart", dragStart, { passive: false });

    function dragStart(e) {
      if (iframeIsCurrentlyOpen) {
          // Si el chat está abierto, permitimos la interacción normal DENTRO del iframe
          // Solo iniciamos el arrastre si el click es en una zona específica o si queremos que todo el panel se arrastre
          // Para evitar que arrastre cuando se intenta interactuar con el chat.
          // Podríamos, por ejemplo, adjuntar un listener de arrastre a un "handle" de arrastre en el header del chat.
          // Por ahora, solo permitimos arrastrar si el click no es para interactuar con el chat.
          // Si el ChatWidget.tsx maneja su propio botón, no queremos que un click en el botón lo arrastre.
          return; // No arrastrar si el chat está abierto para permitir interacción interna
      }

      isDragging = true;
      const rect = widgetContainer.getBoundingClientRect();
      containerStartLeft = rect.left;
      containerStartTop = rect.top;
      dragStartX = e.touches ? e.touches[0].clientX : e.clientX;
      dragStartY = e.touches ? e.touches[0].clientY : e.clientY;

      widgetContainer.style.transition = "none"; // Desactivar transiciones durante el arrastre
      widgetContainer.style.userSelect = 'none';
      document.body.style.cursor = 'move';

      document.addEventListener("mousemove", dragMove);
      document.addEventListener("mouseup", dragEnd);
      document.addEventListener("touchmove", dragMove, { passive: false });
      document.addEventListener("touchend", dragEnd);
      if (e.type === 'touchstart' && e.cancelable) e.preventDefault();
    }

    function dragMove(e) {
      if (!isDragging) return;
      if (e.type === 'touchmove' && e.cancelable) e.preventDefault();

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      let newLeft = containerStartLeft + (clientX - dragStartX);
      let newTop = containerStartTop + (clientY - dragStartY);

      const currentContainerWidth = parseInt(currentDims.width);
      const currentContainerHeight = parseInt(currentDims.height);

      // Limitar el arrastre a los límites de la ventana
      newLeft = Math.max(0, Math.min(window.innerWidth - currentContainerWidth, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - currentContainerHeight, newTop));

      widgetContainer.style.left = newLeft + "px";
      widgetContainer.style.top = newTop + "px";
      widgetContainer.style.right = "auto"; // Asegurar que no haya conflicto con right/bottom
      widgetContainer.style.bottom = "auto";
    }

    function dragEnd() {
      if (!isDragging) return;
      isDragging = false;
      widgetContainer.style.userSelect = '';
      document.body.style.cursor = 'default';
      // Reactivar transición después de un breve retraso
      setTimeout(() => {
        widgetContainer.style.transition = "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease-in-out";
      }, 50);
      document.removeEventListener("mousemove", dragMove);
      document.removeEventListener("mouseup", dragEnd);
      document.removeEventListener("touchmove", dragMove);
      document.removeEventListener("touchend", dragEnd);
    }

    // Si el chat está cerrado, un click en el contenedor (el globito) debería abrirlo
    // Esto se maneja dentro del iframe por el ChatWidget, pero el widget.js debe permitir el evento
    // o comunicar al iframe que se abra si el click es en el globito.
    // La forma más robusta es que el ChatWidget internamente tenga el botón
    // y al clickearlo, envíe un mensaje al padre.
    // Esto lo veremos en ChatWidget.tsx.
    // Eliminamos el listener de click directo en el contenedor para evitar conflictos con el botón interno del iframe.
    // El iframe en sí mismo tendrá su botón que manejará el estado.
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();