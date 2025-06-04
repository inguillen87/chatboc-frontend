(function () {
  "use strict";

  const script = document.currentScript;
  if (!script) {
    console.error("Chatboc Error: No se pudo obtener el script actual (document.currentScript es null). Asegúrate de que widget.js no se carga con 'async' o 'defer' de forma que impida esto.");
    return;
  }

  const token = script.getAttribute("data-token") || "demo-anon";
  const initialBottom = script.getAttribute("data-bottom") || "20px";
  const initialRight = script.getAttribute("data-right") || "20px";
  const defaultOpen = script.getAttribute("data-default-open") === "true";
  const chatbocDomain = script.getAttribute("data-domain") || "https://www.chatboc.ar";

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

  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = `
    #${iframeId}, #${globitoId} {
      transition: opacity 0.25s ease-in-out, transform 0.25s ease-in-out; /* Quitado width/height/borderRadius para simplificar y evitar conflictos si el contenido no está listo */
      transform-origin: bottom right;
      will-change: opacity, transform;
    }
    .chatboc-element {
      position: fixed;
      /* La posición inicial (bottom/right) se aplica directamente. Left/top se usan si se arrastra. */
    }
    .chatboc-visible {
      opacity: 1 !important;
      transform: scale(1) !important;
      pointer-events: auto !important;
    }
    .chatboc-hidden {
      opacity: 0 !important;
      transform: scale(0.8) !important; /* O scale(0) para desaparecer completamente */
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(styleSheet);

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
  globitoButton.innerHTML = `
    <img src="${chatbocDomain}/chatboc_logo_clean_transparent.png" alt="Chatboc" style="width: 32px; height: 32px; border-radius: 4px; pointer-events: none;">
    <span style="position: absolute; top: 2px; right: 2px; width: 12px; height: 12px; background-color: #28a745; border-radius: 50%; border: 2px solid white; pointer-events: none;"></span>
  `;
  if (!document.getElementById(globitoId)) document.body.appendChild(globitoButton);

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
  
  function updateWidgetVisibility() {
    if (isChatCurrentlyOpen) {
      if (iframeHasLoaded) { // Solo mostrar iframe si ya cargó
        iframe.classList.remove("chatboc-hidden");
        iframe.classList.add("chatboc-visible");
      } else {
        // Si el iframe no ha cargado y debe estar abierto, considera mostrar un loader o nada temporalmente
        // Por ahora, no lo mostramos explícitamente hasta que cargue para evitar un flash
      }
      globitoButton.classList.remove("chatboc-visible");
      globitoButton.classList.add("chatboc-hidden");
    } else {
      iframe.classList.remove("chatboc-visible");
      iframe.classList.add("chatboc-hidden");
      globitoButton.classList.remove("chatboc-hidden");
      globitoButton.classList.add("chatboc-visible");
    }
  }
  
  // Establecer estado inicial de clases antes de que iframe.onload pueda dispararse
  globitoButton.classList.add(isChatCurrentlyOpen ? "chatboc-hidden" : "chatboc-visible");
  iframe.classList.add(isChatCurrentlyOpen ? "chatboc-visible" : "chatboc-hidden");
  // Si está abierto por defecto, pero el iframe no ha cargado, ocultarlo temporalmente
  if (isChatCurrentlyOpen && !iframeHasLoaded) {
      iframe.classList.remove("chatboc-visible");
      iframe.classList.add("chatboc-hidden"); // Asegurar que esté oculto hasta onload
  }


  iframe.onload = function () {
    iframeHasLoaded = true;
    updateWidgetVisibility(); // Ahora que cargó, mostrarlo si corresponde
  };
  if (!document.getElementById(iframeId)) document.body.appendChild(iframe);

  globitoButton.onclick = function () {
    isChatCurrentlyOpen = true;
    updateWidgetVisibility();
  };

  window.addEventListener("message", function(event) {
    if (event.origin !== chatbocDomain && chatbocDomain !== "https://www.chatboc.ar") { // Permitir localhost para desarrollo si es necesario
        // O una comprobación más laxa si data-domain no siempre se establece:
        // if (!event.origin.includes("localhost") && event.origin !== new URL(chatbocDomain).origin) return;
        return;
    }
    if (event.data && event.data.type === "chatboc-minimize-request" && event.data.widgetId === iframeId) {
      isChatCurrentlyOpen = false;
      updateWidgetVisibility();
    }
  });

  let isDragging = false, dragStartX, dragStartY, iframeStartLeft, iframeStartTop;
  iframe.addEventListener("mousedown", dragStart);
  iframe.addEventListener("touchstart", dragStart, { passive: false });

  function dragStart(e) {
    if (!isChatCurrentlyOpen) return;
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
    newLeft = Math.max(0, Math.min(window.innerWidth - parseInt(chatWindowWidth), newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - parseInt(chatWindowHeight), newTop));
    iframe.style.left = newLeft + "px";
    iframe.style.top = newTop + "px";
    iframe.style.right = "auto";
    iframe.style.bottom = "auto";
    currentIframeLeft = iframe.style.left; // Guardar para el globito si se mueve
    currentIframeTop = iframe.style.top;   // Guardar para el globito si se mueve
  }

  function dragEnd() {
    if (!isDragging) return;
    isDragging = false;
    iframe.style.userSelect = '';
    document.body.style.cursor = 'default';
    setTimeout(() => {
      iframe.style.transition = "opacity 0.25s ease-in-out, transform 0.25s ease-in-out";
    }, 50);
    document.removeEventListener("mousemove", dragMove);
    document.removeEventListener("mouseup", dragEnd);
    document.removeEventListener("touchmove", dragMove);
    document.removeEventListener("touchend", dragEnd);
  }
})();