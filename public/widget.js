(function () {
  "use strict"; // Usar modo estricto

  const script = document.currentScript;
  if (!script) {
    console.error("Chatboc: No se pudo obtener el script actual para la configuración.");
    return;
  }

  const token = script.getAttribute("data-token") || "demo-anon";
  const initialBottom = script.getAttribute("data-bottom") || "20px";
  const initialRight = script.getAttribute("data-right") || "20px";
  const defaultOpen = script.getAttribute("data-default-open") === "true";
  const chatbocDomain = script.getAttribute("data-domain") || "https://www.chatboc.ar"; // Permite configurar el dominio

  const zIndexBase = parseInt(script.getAttribute("data-z") || "999990", 10);
  const iframeId = "chatboc-iframe-" + Math.random().toString(36).substring(2, 9);
  const globitoId = "chatboc-globito-" + Math.random().toString(36).substring(2, 9);

  const chatWindowWidth = script.getAttribute("data-width") || "360px";
  const chatWindowHeight = script.getAttribute("data-height") || "520px";
  const globitoSize = "64px";

  let isChatCurrentlyOpen = defaultOpen;
  let iframeHasLoaded = false;
  let currentIframeLeft = null; // Para guardar la posición si se arrastra
  let currentIframeTop = null;

  // --- Estilos para animación ---
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = `
    #${iframeId}, #${globitoId} {
      transition: opacity 0.25s ease-in-out, transform 0.25s ease-in-out, width 0.25s ease-in-out, height 0.25s ease-in-out, border-radius 0.25s ease-in-out;
      transform-origin: bottom right;
      will-change: opacity, transform; /* Optimización para animaciones */
    }
    .chatboc-element {
      position: fixed;
      bottom: ${initialBottom};
      right: ${initialRight};
      /* left y top se establecerán si se arrastra */
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
  globitoButton.classList.add("chatboc-element"); // Aplicar clase base para posición
  globitoButton.style.width = globitoSize;
  globitoButton.style.height = globitoSize;
  globitoButton.style.borderRadius = "50%";
  globitoButton.style.border = "1px solid #ddd"; // Borde sutil
  globitoButton.style.background = "#fff";
  globitoButton.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
  globitoButton.style.cursor = "pointer";
  globitoButton.style.display = "flex";
  globitoButton.style.alignItems = "center";
  globitoButton.style.justifyContent = "center";
  globitoButton.style.padding = "0";
  globitoButton.style.zIndex = (zIndexBase + 2).toString();
  globitoButton.classList.add(isChatCurrentlyOpen ? "chatboc-hidden" : "chatboc-visible");
  // Asegúrate que la URL del logo sea accesible públicamente desde cualquier dominio
  globitoButton.innerHTML = `
    <img src="${chatbocDomain}/chatboc_logo_clean_transparent.png" alt="Chatboc" style="width: 32px; height: 32px; border-radius: 4px; pointer-events: none;">
    <span style="position: absolute; top: 2px; right: 2px; width: 12px; height: 12px; background-color: #28a745; border-radius: 50%; border: 2px solid white; pointer-events: none;"></span>
  `;
  if (!document.getElementById(globitoId)) document.body.appendChild(globitoButton);

  // --- Iframe (Ventana de Chat) ---
  const iframe = document.createElement("iframe");
  iframe.id = iframeId;
  iframe.src = `${chatbocDomain}/iframe?token=${encodeURIComponent(token)}&widgetId=${iframeId}`;
  iframe.classList.add("chatboc-element"); // Aplicar clase base para posición
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
  
  iframe.onload = function () {
    iframeHasLoaded = true;
    updateWidgetVisibility(); // Asegura que se muestre el estado correcto al cargar
  };
  if (!document.getElementById(iframeId)) document.body.appendChild(iframe);


  // --- Funciones para controlar visibilidad ---
  function updateWidgetVisibility() {
    if (!iframeHasLoaded && isChatCurrentlyOpen) { 
        // Si se supone que debe estar abierto pero el iframe no ha cargado, esperar a onload.
        // Esto evita mostrar un iframe vacío si defaultOpen es true.
        return; 
    }

    if (isChatCurrentlyOpen) {
      iframe.classList.remove("chatboc-hidden");
      iframe.classList.add("chatboc-visible");
      globitoButton.classList.remove("chatboc-visible");
      globitoButton.classList.add("chatboc-hidden");
    } else {
      iframe.classList.remove("chatboc-visible");
      iframe.classList.add("chatboc-hidden");
      globitoButton.classList.remove("chatboc-hidden");
      globitoButton.classList.add("chatboc-visible");
    }
  }
  
  // Inicializar visibilidad. Si es defaultOpen y el iframe ya cargó, se mostrará.
  // Si no, se mostrará el globito, y luego en iframe.onload se re-evaluará.
  updateWidgetVisibility();


  // --- Event Listeners ---
  globitoButton.onclick = function () {
    isChatCurrentlyOpen = true;
    updateWidgetVisibility();
  };

  window.addEventListener("message", function(event) {
    // IMPORTANTE: Verifica event.origin en producción.
    if (event.origin !== chatbocDomain) { // Compara con el dominio desde donde se sirve el iframe
        // console.warn("Chatboc: Mensaje ignorado de origen no confiable:", event.origin);
        return;
    }

    if (event.data && event.data.type === "chatboc-minimize-request" && event.data.widgetId === iframeId) {
      isChatCurrentlyOpen = false;
      updateWidgetVisibility();
    }
  });

  // --- Lógica de Arrastre (para el iframe cuando está abierto) ---
  let isDragging = false, dragStartX, dragStartY, iframeStartLeft, iframeStartTop;
  
  iframe.addEventListener("mousedown", dragStart);
  iframe.addEventListener("touchstart", dragStart, { passive: false });

  function dragStart(e) {
    if (!isChatCurrentlyOpen) return; // Solo arrastrar la ventana de chat abierta
    
    // Heurística simple: no arrastrar si el click es sobre un input, textarea o button dentro del iframe
    // Esto solo funciona si el contenido del iframe NO previene la propagación del evento mousedown/touchstart.
    const targetTagName = e.target ? (e.target as HTMLElement).tagName.toLowerCase() : '';
    if (targetTagName === 'input' || targetTagName === 'textarea' || targetTagName === 'button' || targetTagName === 'a') {
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
    document.body.style.cursor = 'move'; // Cambiar cursor globalmente
    
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

    const currentIframeWidth = parseInt(chatWindowWidth);
    const currentIframeHeight = parseInt(chatWindowHeight);

    newLeft = Math.max(0, Math.min(window.innerWidth - currentIframeWidth, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - currentIframeHeight, newTop));

    iframe.style.left = newLeft + "px";
    iframe.style.top = newTop + "px";
    iframe.style.right = "auto";
    iframe.style.bottom = "auto";

    // Guardar la posición actual para que el globito pueda volver aquí si se desea
    currentIframeLeft = iframe.style.left;
    currentIframeTop = iframe.style.top;
  }

  function dragEnd() {
    if (!isDragging) return;
    isDragging = false;
    iframe.style.userSelect = '';
    document.body.style.cursor = 'default';
    // Reactivar transición después de un pequeño delay
    setTimeout(() => {
      iframe.style.transition = "opacity 0.25s ease-in-out, transform 0.25s ease-in-out, width 0.25s ease-in-out, height 0.25s ease-in-out, border-radius 0.25s ease-in-out";
    }, 50); // 50ms delay
    document.removeEventListener("mousemove", dragMove);
    document.removeEventListener("mouseup", dragEnd);
    document.removeEventListener("touchmove", dragMove);
    document.removeEventListener("touchend", dragEnd);
  }
})();