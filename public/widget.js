(function () {
  "use strict";
  console.log("Chatboc widget.js: v16-style execution started.");

  const script = document.currentScript;
  if (!script) {
    console.error("Chatboc widget.js FATAL: document.currentScript is null.");
    return;
  }

  const token = script.getAttribute("data-token") || "demo-anon";
  const initialBottom = script.getAttribute("data-bottom") || "24px"; // Usar 24px para ser consistente
  const initialRight = script.getAttribute("data-right") || "24px"; // Usar 24px para ser consistente
  const defaultOpen = script.getAttribute("data-default-open") === "true"; 
  const chatbocDomain = script.getAttribute("data-domain") || "https://www.chatboc.ar";

  const zIndexBase = parseInt(script.getAttribute("data-z") || "999990", 10);
  const iframeId = "chatboc-dynamic-iframe-" + Math.random().toString(36).substring(2, 9);

  // Definimos las dimensiones aquí, para que sean la fuente de la verdad para el iframe
  const IFRAME_OPEN_WIDTH = script.getAttribute("data-width") || "360px";
  const IFRAME_OPEN_HEIGHT = script.getAttribute("data-height") || "520px";
  const IFRAME_CLOSED_WIDTH = script.getAttribute("data-closed-width") || "80px";
  const IFRAME_CLOSED_HEIGHT = script.getAttribute("data-closed-height") || "80px";


  // --- Loader (se mantiene igual) ---
  const loader = document.createElement("div");
  loader.id = "chatboc-loader-" + iframeId;
  loader.style.position = "fixed";
  loader.style.bottom = initialBottom;
  loader.style.right = initialRight;
  loader.style.width = defaultOpen ? IFRAME_OPEN_WIDTH : IFRAME_CLOSED_WIDTH; // Usar dimensiones OPEN/CLOSED
  loader.style.height = defaultOpen ? IFRAME_OPEN_HEIGHT : IFRAME_CLOSED_HEIGHT; // Usar dimensiones OPEN/CLOSED
  loader.style.zIndex = zIndexBase.toString();
  loader.style.display = "flex";
  loader.style.alignItems = "center";
  loader.style.justifyContent = "center";
  loader.style.borderRadius = defaultOpen ? "16px" : "50%";
  loader.style.background = "rgba(230,230,230,0.8)";
  loader.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
  loader.style.transition = "opacity 0.3s ease-out";
  loader.innerHTML = `<div style="font-family: Arial, sans-serif; color: #555; font-size:11px; text-align:center;">Cargando<br/>Chatboc...</div>`;
  if (!document.getElementById(loader.id)) document.body.appendChild(loader);


  // --- Iframe ---
const iframe = document.createElement("iframe");
iframe.id = iframeId;
iframe.src = `${chatbocDomain}/iframe?token=${encodeURIComponent(token)}&widgetId=${iframeId}&defaultOpen=${defaultOpen}&initialWidth=${encodeURIComponent(IFRAME_OPEN_WIDTH)}&initialHeight=${encodeURIComponent(IFRAME_OPEN_HEIGHT)}`; 
iframe.style.position = "fixed";
iframe.style.bottom = initialBottom;
iframe.style.right = initialRight;
iframe.style.left = "auto";
iframe.style.top = "auto";
iframe.style.border = "none";
iframe.style.zIndex = zIndexBase.toString();
iframe.style.transition = "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease-in-out";
iframe.style.overflow = "hidden"; 
iframe.style.opacity = "0"; 
iframe.allow = "clipboard-write";
iframe.setAttribute("title", "Chatboc Chatbot");
iframe.style.display = "block"; 

// Aplicar estilos iniciales del IFRAME de forma explícita con !important
if (defaultOpen) {
  iframe.style.width = `${IFRAME_OPEN_WIDTH} !important`; // <<<<<<<<<<<<<< !important
  iframe.style.height = `${IFRAME_OPEN_HEIGHT} !important`; // <<<<<<<<<<<<<< !important
  iframe.style.borderRadius = "16px";
  iframe.style.boxShadow = "0 4px 16px rgba(0,0,0,0.25)";
} else {
  iframe.style.width = `${IFRAME_CLOSED_WIDTH} !important`; // <<<<<<<<<<<<<< !important
  iframe.style.height = `${IFRAME_CLOSED_HEIGHT} !important`; // <<<<<<<<<<<<<< !important
  iframe.style.borderRadius = "50%";
  iframe.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
}
iframe.style.minWidth = `${IFRAME_CLOSED_WIDTH} !important`; 
iframe.style.minHeight = `${IFRAME_CLOSED_HEIGHT} !important`;
iframe.style.maxWidth = `${IFRAME_OPEN_WIDTH} !important`; 
iframe.style.maxHeight = `${IFRAME_OPEN_HEIGHT} !important`;


  let iframeHasLoaded = false;
  iframe.onload = function () {
    console.log("Chatboc widget.js: Iframe onload disparado.");
    iframeHasLoaded = true;
    const loaderEl = document.getElementById(loader.id);
    if (loaderEl) {
        loaderEl.style.opacity = "0";
        setTimeout(() => loaderEl.remove(), 300);
    }
    iframe.style.opacity = "1"; // Mostrar iframe
  };
  if (!document.getElementById(iframeId)) document.body.appendChild(iframe);


  // Escuchar mensajes del iframe para redimensionar (desde ChatWidget.tsx)
  window.addEventListener("message", function(event) {
  // ...
  if (event.data && event.data.type === "chatboc-resize" && event.data.widgetId === iframeId) {
    console.log("Chatboc widget.js: Mensaje 'chatboc-resize' recibido:", event.data);
    const newDims = event.data.dimensions; 
    const isOpenMessage = event.data.isOpen; 

    // <<<<<<<<<<<<<< APLICAR ESTILOS Y DIMENSIONES AL REDIMENSIONAR CON !important >>>>>>>>>>>>>>
    iframe.style.width = `${newDims.width} !important`; 
    iframe.style.height = `${newDims.height} !important`;
    iframe.style.borderRadius = isOpenMessage ? "16px" : "50%"; 
    iframe.style.boxShadow = isOpenMessage ? "0 6px 20px rgba(0,0,0,0.2)" : "0 4px 12px rgba(0,0,0,0.15)";
    iframe.style.display = "block"; 
    
    iframe.style.minWidth = `${IFRAME_CLOSED_WIDTH} !important`; 
    iframe.style.minHeight = `${IFRAME_CLOSED_HEIGHT} !important`;
    iframe.style.maxWidth = `${IFRAME_OPEN_WIDTH} !important`; 
    iframe.style.maxHeight = `${IFRAME_OPEN_HEIGHT} !important`;
    // <<<<<<<<<<<<<< FIN APLICACIÓN AL REDIMENSIONAR >>>>>>>>>>>>>>
  }
});
  // --- Lógica de Arrastre (para el iframe) ---
  // Esta lógica se mantiene independiente de los mensajes de resize
  let isDragging = false, dragStartX, dragStartY, iframeStartLeft, iframeStartTop;
  
  iframe.addEventListener("mousedown", dragStart);
  iframe.addEventListener("touchstart", dragStart, { passive: false });

  function dragStart(e) {
    // Si el iframe está cerrado (globito), se puede arrastrar.
    // Si está abierto, solo se permite arrastrar desde el header (gestionado por ChatWidget)
    // o si no se detecta un clic dentro del contenido.
    // Aquí, lo mantenemos como estaba, permitiendo el arrastre del iframe en general.
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

    // currentDims ya no se actualiza por el mensaje de resize,
    // por lo que usamos las dimensiones esperadas (abierto o cerrado)
    const effectiveWidth = iframeIsCurrentlyOpen ? parseInt(IFRAME_OPEN_WIDTH) : parseInt(IFRAME_CLOSED_WIDTH);
    const effectiveHeight = iframeIsCurrentlyOpen ? parseInt(IFRAME_OPEN_HEIGHT) : parseInt(IFRAME_CLOSED_HEIGHT);

    newLeft = Math.max(0, Math.min(window.innerWidth - effectiveWidth, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - effectiveHeight, newTop));

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
  console.log("Chatboc widget.js: v16-style ejecución finalizada.");
})();