(function () {
  const script = document.currentScript;
  const token = script.getAttribute("data-token") || "demo-anon";
  const initialBottom = script.getAttribute("data-bottom") || "20px";
  const initialRight = script.getAttribute("data-right") || "20px";
  const defaultOpen = script.getAttribute("data-default-open") === "true";

  const zIndexBase = parseInt(script.getAttribute("data-z") || "999990");
  // Generar un ID único para cada instancia del widget en la página
  const iframeId = "chatboc-iframe-" + Math.random().toString(36).substring(2, 9);
  const globitoId = "chatboc-globito-" + Math.random().toString(36).substring(2, 9);

  const chatWindowWidth = script.getAttribute("data-width") || "360px";
  const chatWindowHeight = script.getAttribute("data-height") || "520px";
  const globitoSize = "64px";

  let isChatCurrentlyOpen = defaultOpen; // Estado visual actual

  // --- Estilos para animación ---
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = `
    #${iframeId}, #${globitoId} {
      transition: opacity 0.25s ease-in-out, transform 0.25s ease-in-out, width 0.25s ease-in-out, height 0.25s ease-in-out, border-radius 0.25s ease-in-out;
      transform-origin: bottom right; /* Animación desde la esquina */
    }
    .chatboc-visible {
      opacity: 1 !important;
      transform: scale(1) !important;
      pointer-events: auto !important;
    }
    .chatboc-hidden {
      opacity: 0 !important;
      transform: scale(0.8) !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(styleSheet);

  // --- Globito (Botón para abrir/minimizar) ---
  const globitoButton = document.createElement("button");
  globitoButton.id = globitoId;
  globitoButton.title = "Abrir Chatboc";
  globitoButton.style.position = "fixed";
  globitoButton.style.bottom = initialBottom;
  globitoButton.style.right = initialRight;
  globitoButton.style.width = globitoSize;
  globitoButton.style.height = globitoSize;
  globitoButton.style.borderRadius = "50%";
  globitoButton.style.border = "1px solid #ddd";
  globitoButton.style.background = "#fff"; // Puede ser sobrescrito por estilos de tema oscuro
  globitoButton.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
  globitoButton.style.cursor = "pointer";
  globitoButton.style.display = "flex";
  globitoButton.style.alignItems = "center";
  globitoButton.style.justifyContent = "center";
  globitoButton.style.padding = "0";
  globitoButton.style.zIndex = (zIndexBase + 2).toString();
  globitoButton.classList.add(isChatCurrentlyOpen ? "chatboc-hidden" : "chatboc-visible");
  globitoButton.innerHTML = `
    <img src="https://www.chatboc.ar/chatboc_logo_clean_transparent.png" alt="Chatboc" style="width: 32px; height: 32px; border-radius: 4px; pointer-events: none;">
    <span style="position: absolute; top: 2px; right: 2px; width: 12px; height: 12px; background-color: #28a745; border-radius: 50%; border: 2px solid white; pointer-events: none;"></span>
  `;
  if (!document.getElementById(globitoId)) document.body.appendChild(globitoButton);

  // --- Iframe (Ventana de Chat) ---
  const iframe = document.createElement("iframe");
  iframe.id = iframeId;
  iframe.src = `https://www.chatboc.ar/iframe?token=${encodeURIComponent(token)}&widgetId=${iframeId}`;
  iframe.style.position = "fixed";
  iframe.style.bottom = initialBottom;
  iframe.style.right = initialRight;
  iframe.style.width = chatWindowWidth;
  iframe.style.height = chatWindowHeight;
  iframe.style.border = "none";
  iframe.style.zIndex = (zIndexBase + 1).toString();
  iframe.style.borderRadius = "16px";
  iframe.style.boxShadow = "0 6px 20px rgba(0,0,0,0.2)";
  iframe.style.overflow = "hidden";
  iframe.classList.add(isChatCurrentlyOpen ? "chatboc-visible" : "chatboc-hidden");
  iframe.allow = "clipboard-write";
  iframe.setAttribute("title", "Chatboc Chatbot");
  
  // No mostramos el iframe hasta que cargue para evitar un flash de contenido vacío.
  // La visibilidad inicial se maneja por las clases chatboc-visible/chatboc-hidden.
  // if (!isChatCurrentlyOpen) { iframe.style.visibility = "hidden"; }


  let iframeHasLoaded = false;
  iframe.onload = function () {
    iframeHasLoaded = true;
    // Si defaultOpen era true, el iframe ya tiene la clase visible.
    // Si no, el globito tiene la clase visible.
    // No se necesita hacer nada más aquí respecto a la visibilidad inicial.
  };
  if (!document.getElementById(iframeId)) document.body.appendChild(iframe);

  // --- Funciones para controlar visibilidad ---
  function showChatWindow() {
    if (!iframeHasLoaded) { // Si el iframe no ha cargado, esperar a que cargue
        isChatCurrentlyOpen = true; // Marcar para que se abra en onload
        // Podríamos forzar el src de nuevo si tememos que no cargó, pero es mejor esperar.
        return;
    }
    isChatCurrentlyOpen = true;
    iframe.classList.remove("chatboc-hidden");
    iframe.classList.add("chatboc-visible");
    globitoButton.classList.remove("chatboc-visible");
    globitoButton.classList.add("chatboc-hidden");
  }

  function showGlobito() {
    isChatCurrentlyOpen = false;
    iframe.classList.remove("chatboc-visible");
    iframe.classList.add("chatboc-hidden");
    globitoButton.classList.remove("chatboc-hidden");
    globitoButton.classList.add("chatboc-visible");
  }

  // --- Event Listeners ---
  globitoButton.onclick = showChatWindow;

  window.addEventListener("message", function(event) {
    // IMPORTANTE: Verifica event.origin en producción.
    // if (event.origin !== "https://www.chatboc.ar") return;

    if (event.data && event.data.type === "chatboc-minimize-request" && event.data.widgetId === iframeId) {
      showGlobito();
    }
  });

  // --- Lógica de Arrastre (para el iframe cuando está abierto) ---
  let isDragging = false, dragStartX, dragStartY, iframeStartLeft, iframeStartTop;
  
  iframe.addEventListener("mousedown", dragStart);
  iframe.addEventListener("touchstart", dragStart, { passive: false });

  function dragStart(e) {
    if (!isChatCurrentlyOpen) return; // Solo arrastrar si la ventana de chat está abierta
    
    // Heurística para no arrastrar si se interactúa con elementos dentro del iframe
    let targetElement = e.target;
    if (targetElement !== iframe) { 
        // Si el click fue en un elemento interno y no el scrollbar del iframe.
        // Esto es difícil de determinar perfectamente sin acceso al DOM del iframe.
        // Si el contenido del iframe no ocupa todo el espacio o tiene áreas "muertas",
        // el click podría ser en el iframe mismo.
        // Si el contenido del iframe previene la propagación del mousedown, esto no funcionará.
        // Mejor si el header del iframe comunicara para iniciar/detener drag, pero es más complejo.
        return;
    }


    isDragging = true;
    const rect = iframe.getBoundingClientRect();
    iframeStartLeft = rect.left;
    iframeStartTop = rect.top;
    dragStartX = e.touches ? e.touches[0].clientX : e.clientX;
    dragStartY = e.touches ? e.touches[0].clientY : e.clientY;
    
    iframe.style.transition = "none";
    iframe.style.userSelect = 'none';
    
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

    newLeft = Math.max(0, Math.min(window.innerWidth - parseInt(chatWindowWidth), newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - parseInt(chatWindowHeight), newTop));

    iframe.style.left = newLeft + "px";
    iframe.style.top = newTop + "px";
    iframe.style.right = "auto";
    iframe.style.bottom = "auto";
    // El globito mantiene su posición original, no se mueve con el drag del iframe.
    // Si quisieras que el globito se mueva, tendrías que actualizar initialBottom/Right aquí
    // y que el globito los use.
  }

  function dragEnd() {
    if (!isDragging) return;
    isDragging = false;
    iframe.style.userSelect = '';
    setTimeout(() => {
      iframe.style.transition = "opacity 0.3s ease-in-out, transform 0.3s ease-in-out";
    }, 0);
    document.removeEventListener("mousemove", dragMove);
    document.removeEventListener("mouseup", dragEnd);
    document.removeEventListener("touchmove", dragMove);
    document.removeEventListener("touchend", dragEnd);
  }
})();