(function () {
  const script = document.currentScript;
  const token = script.getAttribute("data-token") || "demo-anon";
  const initialBottom = script.getAttribute("data-bottom") || "20px";
  const initialRight = script.getAttribute("data-right") || "20px";
  const defaultOpen = script.getAttribute("data-default-open") === "true";

  const zIndexBase = parseInt(script.getAttribute("data-z") || "999990");
  // Generar un ID único para cada instancia del widget en la página
  const iframeId = "chatboc-widget-iframe-" + Math.random().toString(36).substring(2, 9);

  // Leer dimensiones de los atributos o usar defaults
  const WIDGET_DIMENSIONS_CONFIG = {
    OPEN: {
      width: script.getAttribute("data-width") || "360px",
      height: script.getAttribute("data-height") || "520px",
    },
    CLOSED: { // Dimensiones del globito
      width: script.getAttribute("data-closed-width") || "80px",
      height: script.getAttribute("data-closed-height") || "80px",
    },
  };

  let currentDims = defaultOpen ? WIDGET_DIMENSIONS_CONFIG.OPEN : WIDGET_DIMENSIONS_CONFIG.CLOSED;
  let iframeIsCurrentlyOpen = defaultOpen;

  // --- Loader ---
  const loader = document.createElement("div");
  loader.id = "chatboc-loader-" + iframeId;
  // (Estilos del loader como los tenías, usando currentDims para tamaño inicial y borderRadius)
  loader.style.position = "fixed";
  loader.style.bottom = initialBottom;
  loader.style.right = initialRight;
  loader.style.width = currentDims.width;
  loader.style.height = currentDims.height;
  loader.style.zIndex = zIndexBase.toString();
  loader.style.display = "flex";
  loader.style.alignItems = "center";
  loader.style.justifyContent = "center";
  loader.style.borderRadius = iframeIsCurrentlyOpen ? "16px" : "50%";
  loader.style.background = "rgba(230,230,230,0.7)"; // Un poco más visible
  loader.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";
  loader.innerHTML = `<div style="font-family: Arial, sans-serif; color: #555; font-size:11px; text-align:center;">Cargando<br/>Chatboc...</div>`;
  if (!document.getElementById(loader.id)) document.body.appendChild(loader);


  // --- Iframe ---
  const iframe = document.createElement("iframe");
  iframe.id = iframeId;
  // Pasar defaultOpen y widgetId como parámetros GET al iframe para que ChatWidget los use
  iframe.src = `https://www.chatboc.ar/iframe?token=${encodeURIComponent(token)}&widgetId=${iframeId}&defaultOpen=${defaultOpen}`;
  iframe.style.position = "fixed";
  iframe.style.bottom = initialBottom; // Posición inicial
  iframe.style.right = initialRight;  // Posición inicial
  iframe.style.left = "auto";
  iframe.style.top = "auto";
  iframe.style.width = currentDims.width;
  iframe.style.height = currentDims.height;
  iframe.style.border = "none"; // El contenido del iframe puede tener su propio borde si es necesario
  iframe.style.zIndex = zIndexBase.toString();
  iframe.style.borderRadius = iframeIsCurrentlyOpen ? "16px" : "50%"; // Adaptar según estado
  iframe.style.boxShadow = "0 4px 16px rgba(0,0,0,0.25)"; // Sombra consistente
  iframe.style.transition = "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.25s cubic-bezier(0.4, 0, 0.2, 1)";
  iframe.style.overflow = "hidden";
  iframe.allow = "clipboard-write";
  iframe.setAttribute("title", "Chatboc Chatbot");
  iframe.style.display = "none"; // Oculto hasta que cargue

  iframe.onload = function () {
    const loaderEl = document.getElementById(loader.id);
    if (loaderEl) loaderEl.remove();
    iframe.style.display = "block";
  };
  if (!document.getElementById(iframeId)) document.body.appendChild(iframe);

  // Escuchar mensajes del iframe para redimensionar
  window.addEventListener("message", function(event) {
    // IMPORTANTE: VERIFICAR event.origin EN PRODUCCIÓN para mayor seguridad
    // if (event.origin !== "https://www.chatboc.ar") {
    //   console.warn("Mensaje ignorado de origen no confiable:", event.origin);
    //   return;
    // }

    if (event.data && event.data.type === "chatboc-resize" && event.data.widgetId === iframeId) {
      const newDims = event.data.dimensions;
      const receivedIsOpen = event.data.isOpen;

      iframe.style.width = newDims.width;
      iframe.style.height = newDims.height;
      iframe.style.borderRadius = receivedIsOpen ? "16px" : "50%";
      
      currentDims = newDims; // Actualizar dimensiones actuales para el drag
      iframeIsCurrentlyOpen = receivedIsOpen; // Actualizar estado para el drag
    }
  });

  // --- Lógica de Arrastre (Drag & Drop) ---
  let isDragging = false, dragStartX, dragStartY, iframeStartLeft, iframeStartTop;
  
  iframe.addEventListener("mousedown", dragStart);
  iframe.addEventListener("touchstart", dragStart, { passive: false }); // passive:false para poder usar preventDefault

  function dragStart(e) {
    // Solo permitir arrastre si el iframe está ABIERTO (ventana grande)
    // O si el target es el iframe mismo (para el globito).
    // Si el clic es en un input DENTRO del iframe, NO iniciar arrastre.
    // Esta es una heurística, `e.target` será el iframe. La comunicación desde el iframe sería más robusta.
    if (iframeIsCurrentlyOpen && e.target !== iframe && e.target.tagName && (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'textarea' || e.target.tagName.toLowerCase() === 'button')) {
        return; // No arrastrar si se hizo clic en un elemento interactivo dentro de un iframe abierto
    }


    isDragging = true;
    const rect = iframe.getBoundingClientRect();
    iframeStartLeft = rect.left;
    iframeStartTop = rect.top;
    dragStartX = e.touches ? e.touches[0].clientX : e.clientX;
    dragStartY = e.touches ? e.touches[0].clientY : e.clientY;
    
    iframe.style.transition = "none"; // Desactivar transición durante el arrastre para fluidez
    iframe.style.userSelect = 'none'; // Evitar selección de texto
    
    document.addEventListener("mousemove", dragMove);
    document.addEventListener("mouseup", dragEnd);
    document.addEventListener("touchmove", dragMove, { passive: false });
    document.addEventListener("touchend", dragEnd);
     if (e.type === 'touchstart' && e.cancelable) e.preventDefault(); // Prevenir scroll en touch
  }

  function dragMove(e) {
    if (!isDragging) return;
    if (e.type === 'touchmove' && e.cancelable) e.preventDefault(); // Prevenir scroll en touch

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    let newLeft = iframeStartLeft + (clientX - dragStartX);
    let newTop = iframeStartTop + (clientY - dragStartY);

    const currentIframeWidth = parseInt(currentDims.width);
    const currentIframeHeight = parseInt(currentDims.height);

    newLeft = Math.max(0, Math.min(window.innerWidth - currentIframeWidth, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - currentIframeHeight, newTop));

    iframe.style.left = newLeft + "px";
    iframe.style.top = newTop + "px";
    iframe.style.right = "auto"; // Cambiar a posicionamiento left/top
    iframe.style.bottom = "auto";
  }

  function dragEnd() {
    if (!isDragging) return;
    isDragging = false;
    iframe.style.userSelect = ''; // Restaurar selección de texto
    // Reactivar transición después de un pequeño delay para evitar que se aplique al último movimiento
    setTimeout(() => {
        iframe.style.transition = "width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.25s cubic-bezier(0.4, 0, 0.2, 1)";
    }, 0);
    document.removeEventListener("mousemove", dragMove);
    document.removeEventListener("mouseup", dragEnd);
    document.removeEventListener("touchmove", dragMove);
    document.removeEventListener("touchend", dragEnd);
  }
})();