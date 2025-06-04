(function () {
  "use strict";
  console.log("Chatboc widget.js: Script execution started.");

  const script = document.currentScript;
  if (!script) {
    console.error("Chatboc widget.js FATAL ERROR: document.currentScript is null. Esto suele ocurrir si el script se carga con 'async' o 'defer' de forma incorrecta. El widget no puede inicializarse.");
    // Intento de fallback (menos confiable, requiere que tu script sea el último o tenga un ID específico)
    // const scripts = document.getElementsByTagName('script');
    // script = scripts[scripts.length - 1]; // Asume que es el último script, puede no serlo.
    // if (!script || !script.src || !script.src.includes('widget.js')) { // Una comprobación más
    //   console.error("Chatboc widget.js: Fallback para encontrar el script también falló.");
    //   return;
    // }
    // console.warn("Chatboc widget.js: Usando fallback para obtener el script. Esto es menos confiable.");
    return; // Detener si document.currentScript es null es más seguro que un fallback propenso a errores.
  }

  const token = script.getAttribute("data-token") || "demo-anon";
  const initialBottom = script.getAttribute("data-bottom") || "20px";
  const initialRight = script.getAttribute("data-right") || "20px";
  const defaultOpen = script.getAttribute("data-default-open") === "true";
  const chatbocDomain = script.getAttribute("data-domain") || "https://www.chatboc.ar"; // Usa tu dominio real

  console.log("Chatboc widget.js: Configuración leída:", { token, initialBottom, initialRight, defaultOpen, chatbocDomain });

  const zIndexBase = parseInt(script.getAttribute("data-z") || "999990", 10);
  const iframeId = "chatboc-iframe-" + Math.random().toString(36).substring(2, 9);
  const globitoId = "chatboc-globito-" + Math.random().toString(36).substring(2, 9);

  const chatWindowWidth = script.getAttribute("data-width") || "360px";
  const chatWindowHeight = script.getAttribute("data-height") || "520px";
  const globitoSize = "64px";

  let isChatCurrentlyOpen = defaultOpen;
  let iframeHasLoaded = false;
  let currentIframeLeft = null; 
  let currentIframeTop = null;

  console.log("Chatboc widget.js: Estado inicial - isChatCurrentlyOpen:", isChatCurrentlyOpen);

  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = `
    #${iframeId}, #${globitoId} {
      transition: opacity 0.25s ease-in-out, transform 0.25s ease-in-out !important;
      transform-origin: bottom right !important;
      will-change: opacity, transform !important;
    }
    .chatboc-element {
      position: fixed !important;
      /* bottom y right se aplican directamente o left/top si se arrastra */
    }
    .chatboc-visible {
      opacity: 1 !important;
      transform: scale(1) !important;
      pointer-events: auto !important;
      visibility: visible !important; /* Asegurar visibilidad */
    }
    .chatboc-hidden {
      opacity: 0 !important;
      transform: scale(0.8) !important;
      pointer-events: none !important;
      visibility: hidden !important; /* Asegurar que esté oculto */
    }
  `;
  document.head.appendChild(styleSheet);
  console.log("Chatboc widget.js: Estilos CSS inyectados.");

  const globitoButton = document.createElement("button");
  globitoButton.id = globitoId;
  globitoButton.title = "Abrir Chatboc";
  globitoButton.classList.add("chatboc-element");
  globitoButton.style.bottom = initialBottom;
  globitoButton.style.right = initialRight;
  globitoButton.style.width = globitoSize;
  globitoButton.style.height = globitoSize;
  globitoButton.style.borderRadius = "50%";
  globitoButton.style.border = "1px solid #ddd";
  globitoButton.style.background = "#fff";
  globitoButton.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
  globitoButton.style.cursor = "pointer";
  globitoButton.style.display = "flex";
  globitoButton.style.alignItems = "center";
  globitoButton.style.justifyContent = "center";
  globitoButton.style.padding = "0";
  globitoButton.style.zIndex = (zIndexBase + 2).toString();
  // Asegúrate que la URL del logo sea correcta y accesible públicamente
  globitoButton.innerHTML = `
    <img src="${chatbocDomain}/chatboc_logo_clean_transparent.png" alt="Chatboc" style="width: 32px; height: 32px; border-radius: 4px; pointer-events: none;">
    <span style="position: absolute; top: 2px; right: 2px; width: 12px; height: 12px; background-color: #28a745; border-radius: 50%; border: 2px solid white; pointer-events: none;"></span>
  `;
  
  const iframe = document.createElement("iframe");
  iframe.id = iframeId;
  iframe.src = `${chatbocDomain}/iframe?token=${encodeURIComponent(token)}&widgetId=${iframeId}`;
  iframe.classList.add("chatboc-element");
  iframe.style.bottom = initialBottom;
  iframe.style.right = initialRight;
  iframe.style.width = chatWindowWidth;
  iframe.style.height = chatWindowHeight;
  iframe.style.border = "none";
  iframe.style.zIndex = (zIndexBase + 1).toString();
  iframe.style.borderRadius = "16px";
  iframe.style.boxShadow = "0 6px 20px rgba(0,0,0,0.2)";
  iframe.style.overflow = "hidden";
  iframe.allow = "clipboard-write";
  iframe.setAttribute("title", "Chatboc Chatbot");
  
  console.log("Chatboc widget.js: Elementos globito e iframe creados en memoria.");

  function updateWidgetVisibility() {
    console.log("Chatboc widget.js: updateWidgetVisibility llamado. isChatCurrentlyOpen:", isChatCurrentlyOpen, "iframeHasLoaded:", iframeHasLoaded);
    if (isChatCurrentlyOpen) {
      if (iframeHasLoaded) {
        iframe.classList.remove("chatboc-hidden");
        iframe.classList.add("chatboc-visible");
        console.log("Chatboc widget.js: Mostrando iframe.");
      } else {
        console.log("Chatboc widget.js: Iframe debe estar abierto pero no ha cargado. Esperando onload.");
        // Se oculta explícitamente para evitar mostrar un iframe vacío antes de onload.
        iframe.classList.remove("chatboc-visible");
        iframe.classList.add("chatboc-hidden");
      }
      globitoButton.classList.remove("chatboc-visible");
      globitoButton.classList.add("chatboc-hidden");
    } else {
      iframe.classList.remove("chatboc-visible");
      iframe.classList.add("chatboc-hidden");
      globitoButton.classList.remove("chatboc-hidden");
      globitoButton.classList.add("chatboc-visible");
      console.log("Chatboc widget.js: Mostrando globito.");
    }
  }
  
  // Establecer clases iniciales ANTES de añadir al DOM
  globitoButton.classList.add(isChatCurrentlyOpen ? "chatboc-hidden" : "chatboc-visible");
  iframe.classList.add(isChatCurrentlyOpen && iframeHasLoaded ? "chatboc-visible" : "chatboc-hidden");


  if (!document.getElementById(globitoId)) {
    document.body.appendChild(globitoButton);
    console.log("Chatboc widget.js: Globito añadido al DOM.");
  }
  if (!document.getElementById(iframeId)) {
    document.body.appendChild(iframe);
    console.log("Chatboc widget.js: Iframe añadido al DOM.");
  }

  iframe.onload = function () {
    console.log("Chatboc widget.js: Iframe onload event disparado.");
    iframeHasLoaded = true;
    updateWidgetVisibility(); 
  };
  // Si defaultOpen es false, el globito ya tiene la clase visible.
  // Si defaultOpen es true, updateWidgetVisibility se llamará en iframe.onload para mostrar el iframe.
  // Llamada inicial para asegurar el estado correcto si el iframe ya estuviera cacheado y cargara instantáneamente (poco probable pero seguro)
  updateWidgetVisibility();


  globitoButton.onclick = function () {
    console.log("Chatboc widget.js: Globito clickeado.");
    isChatCurrentlyOpen = true;
    updateWidgetVisibility();
  };

  window.addEventListener("message", function(event) {
    if (event.origin !== chatbocDomain && !(chatbocDomain.startsWith("http://localhost")) ) { // Permitir localhost para desarrollo
        // console.warn("Chatboc widget.js: Mensaje ignorado de origen no confiable:", event.origin, "Esperado:", chatbocDomain);
        return;
    }
    if (event.data && event.data.type === "chatboc-minimize-request" && event.data.widgetId === iframeId) {
      console.log("Chatboc widget.js: Mensaje 'chatboc-minimize-request' recibido del iframe.");
      isChatCurrentlyOpen = false;
      updateWidgetVisibility();
    }
  });

  // --- Lógica de Arrastre (sin cambios funcionales significativos, ya debería estar bien) ---
  let isDragging = false, dragStartX, dragStartY, iframeStartLeft, iframeStartTop;
  iframe.addEventListener("mousedown", dragStart);
  iframe.addEventListener("touchstart", dragStart, { passive: false });
  function dragStart(e) {
    if (!isChatCurrentlyOpen) return;
    const targetTagName = e.target ? (e.target as HTMLElement).tagName.toLowerCase() : '';
    if (targetTagName === 'input' || targetTagName === 'textarea' || targetTagName === 'button' || targetTagName === 'a') {
        return;
    }
    isDragging = true; /* ... (resto de la lógica de dragStart como en la respuesta #18) ... */ }
  function dragMove(e) { if (!isDragging) return; /* ... (resto de la lógica de dragMove como en la respuesta #18) ... */ }
  function dragEnd() { if (!isDragging) return; /* ... (resto de la lógica de dragEnd como en la respuesta #18) ... */ }

  console.log("Chatboc widget.js: Script execution finished.");
})();