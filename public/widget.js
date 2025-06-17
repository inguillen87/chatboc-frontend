// Chatboc embeddable widget loader
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

  const WIDGET_DIMENSIONS_JS = { // Usar los mismos nombres que en ChatWidget.tsx
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

  // --- Loader ---
  const loader = document.createElement("div");
  loader.id = "chatboc-loader-" + iframeId;
  loader.style.position = "fixed";
  loader.style.bottom = initialBottom;
  loader.style.right = initialRight;
  loader.style.width = currentDims.width; // Tamaño inicial basado en defaultOpen
  loader.style.height = currentDims.height;
  loader.style.zIndex = zIndexBase.toString();
  loader.style.display = "flex";
  loader.style.alignItems = "center";
  loader.style.justifyContent = "center";
  loader.style.borderRadius = defaultOpen ? "16px" : "50%";
  loader.style.background = "transparent";
  loader.style.boxShadow = "none";
  loader.style.transition = "opacity 0.3s ease-out"; // Transición para el loader
  loader.innerHTML = `<img src="${chatbocDomain}/favicon/favicon-48x48.png" alt="Chatboc" style="width:48px;height:48px;"/>`;
  if (!document.getElementById(loader.id)) document.body.appendChild(loader);


  // --- Iframe ---
  const iframe = document.createElement("iframe");
  iframe.id = iframeId;
  // Pasamos defaultOpen y widgetId a ChatWidget.tsx para que sepa su estado inicial
  iframe.src = `${chatbocDomain}/iframe?token=${encodeURIComponent(token)}&widgetId=${iframeId}&defaultOpen=${defaultOpen}&initialWidth=${encodeURIComponent(currentDims.width)}&initialHeight=${encodeURIComponent(currentDims.height)}${theme ? `&theme=${encodeURIComponent(theme)}` : ""}`;
  iframe.style.position = "fixed";
  iframe.style.bottom = initialBottom;
  iframe.style.right = initialRight;
  iframe.style.left = "auto";
  iframe.style.top = "auto";
  iframe.style.width = currentDims.width; 
  iframe.style.height = currentDims.height; 
  iframe.style.border = "none";
  iframe.style.zIndex = zIndexBase.toString();
  iframe.style.borderRadius = iframeIsCurrentlyOpen ? "16px" : "50%";
  iframe.style.boxShadow = "0 4px 16px rgba(0,0,0,0.25)";
  iframe.style.transition = "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease-in-out";
  iframe.style.overflow = "hidden"; 
  iframe.style.opacity = "0"; 
  iframe.allow = "clipboard-write";
  iframe.setAttribute("title", "Chatboc Chatbot");
  iframe.style.display = "block"; // Asegurar que el iframe sea display block desde el inicio

  let iframeHasLoaded = false;
  const loadTimeout = setTimeout(() => {
    if (!iframeHasLoaded) {

      loader.innerHTML = '<div style="font-family: Arial, sans-serif; color: #fff; font-size:11px; text-align:center;">Servicio no disponible</div>';
      iframe.style.display = 'none';
    }
  }, 10000);
  iframe.onload = function () {
    iframeHasLoaded = true;
    clearTimeout(loadTimeout);
    const loaderEl = document.getElementById(loader.id);
    if (loaderEl) {
        loaderEl.style.opacity = "0";
        setTimeout(() => loaderEl.remove(), 300); // Quitar loader después de la transición
    }
    iframe.style.opacity = "1"; // Mostrar iframe
  };
  if (!document.getElementById(iframeId)) document.body.appendChild(iframe);

  iframe.onerror = function () {
    clearTimeout(loadTimeout);

    loader.innerHTML = '<div style="font-family: Arial, sans-serif; color: #fff; font-size:11px; text-align:center;">Servicio no disponible</div>';
    iframe.style.display = 'none';
  };


  // Escuchar mensajes del iframe para redimensionar
  window.addEventListener("message", function(event) {
    if (event.origin !== chatbocDomain && !(chatbocDomain.startsWith("http://localhost")) ) { // Asegurar origen
        return;
    }

    if (event.data && event.data.type === "chatboc-resize" && event.data.widgetId === iframeId) {
      const newDims = event.data.dimensions; 
      iframeIsCurrentlyOpen = event.data.isOpen;

      iframe.style.width = newDims.width; 
      iframe.style.height = newDims.height;
      iframe.style.borderRadius = iframeIsCurrentlyOpen ? "16px" : "50%";
      iframe.style.boxShadow = iframeIsCurrentlyOpen ? "0 6px 20px rgba(0,0,0,0.2)" : "0 4px 12px rgba(0,0,0,0.15)";
      iframe.style.display = "block"; // Asegurar que el iframe sea display block al redimensionar

      currentDims = newDims; 
    }
  });

  // --- Lógica de Arrastre (para el iframe) ---
  let isDragging = false, dragStartX, dragStartY, iframeStartLeft, iframeStartTop;
  
  iframe.addEventListener("mousedown", dragStart);
  iframe.addEventListener("touchstart", dragStart, { passive: false });

  function dragStart(e) {
    isDragging = true;
    const rect = iframe.getBoundingClientRect();
    iframeStartLeft = rect.left;
    iframeStartTop = rect.top;
    dragStartX = e.touches ? e.touches[0].clientX : e.clientX;
    dragStartY = e.touches ? e.touches[0].clientY : e.clientY;
    
    iframe.style.transition = "none"; 
    iframe.style.userSelect = 'none';
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

    let newLeft = iframeStartLeft + (clientX - dragStartX);
    let newTop = iframeStartTop + (clientY - dragStartY);

    const currentIframeWidth = parseInt(currentDims.width); // Usa las dimensiones actuales del iframe
    const currentIframeHeight = parseInt(currentDims.height);

    newLeft = Math.max(0, Math.min(window.innerWidth - currentIframeWidth, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - currentIframeHeight, newTop));

    iframe.style.left = newLeft + "px";
    iframe.style.top = newTop + "px";
    iframe.style.right = "auto";
    iframe.style.bottom = "auto";
  }

  function dragEnd() {
    if (!isDragging) return;
    isDragging = false;
    iframe.style.userSelect = '';
    document.body.style.cursor = 'default';
    // Reactivar transición
    setTimeout(() => {
      iframe.style.transition = "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease-in-out";
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
